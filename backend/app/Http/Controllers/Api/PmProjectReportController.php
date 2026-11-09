<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectReport;
use App\Models\Task;
use App\Models\TaskChecklist;
use App\Models\TaskReview;
use App\Models\TaskUpdate;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PmProjectReportController extends Controller
{
    /**
     * Map active tasks count to workload level.
     */
    protected function workloadLevel(int $activeCount): string
    {
        if ($activeCount <= 2) {
            return 'Light';
        }
        if ($activeCount <= 5) {
            return 'Moderate';
        }
        if ($activeCount <= 8) {
            return 'High';
        }
        return 'Overloaded';
    }

    /**
     * Helper to verify user permissions and get scoped project query.
     */
    protected function getAuthorizedUser(Request $request): User
    {
        $user = $request->user();
        if (!$user) {
            abort(401, 'Unauthenticated.');
        }
        if ($user->role === 'member') {
            abort(403, 'Akses ditolak. Member tidak memiliki izin untuk mengakses laporan proyek.');
        }
        return $user;
    }

    /**
     * Check if PM owns the given project.
     */
    protected function authorizeProjectAccess(User $user, Project $project): void
    {
        if ($user->role === 'project_manager' && $project->pic_id !== $user->id) {
            abort(403, 'Anda tidak memiliki hak akses untuk proyek ini.');
        }
        if ($user->role === 'pimpinan') {
            abort(403, 'Pimpinan memiliki akses read-only pada laporan yang sudah diterbitkan.');
        }
    }

    /**
     * Generate immutable snapshot data from actual database records of a single project.
     */
    public function generateSnapshot(Project $project, string $periodStart, string $periodEnd): array
    {
        $today = Carbon::today()->toDateString();

        // 1. Project progress calculation via official method
        $projectProgress = $project->calculateActualProgress();

        // 2. Tasks query strictly scoped to this project
        $tasks = Task::where('project_id', $project->id)->with('checklists')->get();
        $totalTasks = $tasks->count();

        // Tasks status breakdown (distinct without double counting)
        $doneTasks = $tasks->filter(fn ($t) => $t->status === 'done' || ($t->is_completed && $t->status !== 'completed'))->count();
        $completedLegacyTasks = $tasks->filter(fn ($t) => $t->status === 'completed' && $t->status !== 'done')->count();
        $inReviewTasks = $tasks->filter(fn ($t) => !$t->is_completed && $t->status === 'in_review')->count();
        $inProgressTasks = $tasks->filter(fn ($t) => !$t->is_completed && $t->status === 'in_progress')->count();
        $todoTasks = $tasks->filter(fn ($t) => !$t->is_completed && in_array($t->status, ['todo', 'pending']))->count();

        $totalCompleted = $tasks->filter(fn ($t) => $t->is_completed || in_array($t->status, ['done', 'completed']))->count();
        $totalActive = $totalTasks - $totalCompleted;

        // Overdue tasks: non-done, non-completed, deadline < today
        $overdueTasks = $tasks->filter(function ($t) use ($today) {
            $isFinished = $t->is_completed || in_array($t->status, ['done', 'completed']);
            return !$isFinished && !empty($t->deadline) && $t->deadline < $today;
        })->count();

        // Deadline categorization
        $dueTodayTasks = $tasks->filter(function ($t) use ($today) {
            $isFinished = $t->is_completed || in_array($t->status, ['done', 'completed']);
            return !$isFinished && !empty($t->deadline) && $t->deadline === $today;
        })->count();

        $sevenDaysAhead = Carbon::today()->addDays(7)->toDateString();
        $dueSoonTasks = $tasks->filter(function ($t) use ($today, $sevenDaysAhead) {
            $isFinished = $t->is_completed || in_array($t->status, ['done', 'completed']);
            return !$isFinished && !empty($t->deadline) && $t->deadline > $today && $t->deadline <= $sevenDaysAhead;
        })->count();

        $noDeadlineTasks = $tasks->filter(function ($t) {
            $isFinished = $t->is_completed || in_array($t->status, ['done', 'completed']);
            return !$isFinished && empty($t->deadline);
        })->count();

        // 3. Checklist aggregation
        $taskIds = $tasks->pluck('id')->toArray();
        $checklists = TaskChecklist::whereIn('task_id', $taskIds)->get();
        $totalChecklists = $checklists->count();
        $completedChecklists = $checklists->where('is_completed', true)->count();
        $pendingChecklists = $totalChecklists - $completedChecklists;
        $checklistRate = $totalChecklists > 0 ? round(($completedChecklists / $totalChecklists) * 100, 1) : 0;

        // 4. Milestones
        $milestones = $project->milestones()->get();
        $totalMilestones = $milestones->count();
        $completedMilestones = $milestones->where('status', 'completed')->count();
        $activeMilestones = $milestones->where('status', '!=', 'completed')->count();
        $overdueMilestones = $milestones->filter(function ($m) use ($today) {
            $dueDate = $m->due_date ?? $m->target_date;
            return $m->status !== 'completed' && !empty($dueDate) && $dueDate < $today;
        })->count();

        $milestoneList = $milestones->map(fn ($m) => [
            'id' => $m->id,
            'title' => $m->title ?? $m->name ?? '—',
            'name' => $m->title ?? $m->name ?? '—',
            'status' => $m->status,
            'progress' => $m->progress ?? 0,
            'due_date' => $m->due_date,
            'target_date' => $m->due_date,
        ])->toArray();

        // 5. Team Workload (scoped strictly to this project)
        $assigneeIds = $tasks->whereNotNull('assignee_id')->pluck('assignee_id')->unique()->values();
        $membersData = [];

        if ($assigneeIds->isNotEmpty()) {
            $users = User::whereIn('id', $assigneeIds)->get(['id', 'name', 'email', 'position', 'avatar']);
            foreach ($users as $u) {
                $mTasks = $tasks->where('assignee_id', $u->id);
                $mActive = $mTasks->filter(fn ($t) => !$t->is_completed && !in_array($t->status, ['done', 'completed']))->count();
                $mOverdue = $mTasks->filter(fn ($t) => !$t->is_completed && !in_array($t->status, ['done', 'completed']) && !empty($t->deadline) && $t->deadline < $today)->count();
                $mInReview = $mTasks->filter(fn ($t) => !$t->is_completed && $t->status === 'in_review')->count();
                $mDone = $mTasks->filter(fn ($t) => $t->is_completed || in_array($t->status, ['done', 'completed']))->count();

                $membersData[] = [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'position' => $u->position,
                    'total_tasks' => $mTasks->count(),
                    'active_tasks' => $mActive,
                    'overdue_tasks' => $mOverdue,
                    'in_review_tasks' => $mInReview,
                    'done_tasks' => $mDone,
                    'workload_level' => $this->workloadLevel($mActive),
                ];
            }
        }

        // 6. Recent Task Updates (Progress History for this project)
        $recentUpdates = TaskUpdate::whereIn('task_id', $taskIds)
            ->with(['task:id,title', 'user:id,name'])
            ->orderByDesc('created_at')
            ->limit(15)
            ->get()
            ->map(fn ($u) => [
                'id' => $u->id,
                'task_title' => $u->task?->title ?? '—',
                'author_name' => $u->user?->name ?? '—',
                'description' => $u->work_description,
                'progress_snapshot' => $u->progress_snapshot,
                'blocker' => $u->blocker,
                'next_plan' => $u->next_plan,
                'created_at' => $u->created_at?->toIso8601String(),
            ])->toArray();

        // 7. Recent Task Reviews (Approval History for this project)
        $recentReviews = TaskReview::whereIn('task_id', $taskIds)
            ->with(['task:id,title', 'user:id,name'])
            ->orderByDesc('created_at')
            ->limit(15)
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'task_title' => $r->task?->title ?? '—',
                'reviewer_name' => $r->user?->name ?? '—',
                'action' => $r->action,
                'from_status' => $r->from_status,
                'to_status' => $r->to_status,
                'notes' => $r->notes,
                'created_at' => $r->created_at?->toIso8601String(),
            ])->toArray();

        return [
            'captured_at' => Carbon::now()->toIso8601String(),
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'code' => $project->code,
                'client' => $project->client,
                'status' => $project->status,
                'pic_id' => $project->pic_id,
                'pic_name' => $project->pic_name,
                'deadline' => $project->deadline,
                'period_start' => $periodStart,
                'period_end' => $periodEnd,
                'progress' => $projectProgress,
                'target_progress' => $project->target_progress ?? 100,
                'total_tasks' => $totalTasks,
                'completed_tasks' => $totalCompleted,
                'active_tasks' => $totalActive,
                'in_review_tasks' => $inReviewTasks,
                'overdue_tasks' => $overdueTasks,
            ],
            'task_distribution' => [
                'todo' => $todoTasks,
                'in_progress' => $inProgressTasks,
                'in_review' => $inReviewTasks,
                'done' => $doneTasks,
                'completed' => $completedLegacyTasks,
                'total_done' => $totalCompleted,
            ],
            'checklist_progress' => [
                'total_checklists' => $totalChecklists,
                'completed_checklists' => $completedChecklists,
                'pending_checklists' => $pendingChecklists,
                'completion_rate' => $checklistRate,
            ],
            'deadlines' => [
                'overdue' => $overdueTasks,
                'due_today' => $dueTodayTasks,
                'due_soon' => $dueSoonTasks,
                'no_deadline' => $noDeadlineTasks,
            ],
            'milestones' => [
                'total' => $totalMilestones,
                'completed' => $completedMilestones,
                'active' => $activeMilestones,
                'overdue' => $overdueMilestones,
                'list' => $milestoneList,
            ],
            'team_workload' => [
                'total_members' => count($membersData),
                'members' => $membersData,
            ],
            'progress_history' => $recentUpdates,
            'approval_history' => $recentReviews,
        ];
    }

    /**
     * GET /api/project-reports/stats/overview
     * Summary overview of reports for header metrics.
     */
    public function overview(Request $request)
    {
        $user = $this->getAuthorizedUser($request);

        $query = ProjectReport::query();

        if ($user->role === 'project_manager') {
            $myProjectIds = Project::where('pic_id', $user->id)->pluck('id');
            $query->whereIn('project_id', $myProjectIds);
        } elseif ($user->role === 'pimpinan') {
            $query->where('status', 'published');
        }

        $totalReports = (clone $query)->count();
        $totalDrafts = $user->role === 'pimpinan' ? 0 : (clone $query)->where('status', 'draft')->count();
        $totalPublished = (clone $query)->where('status', 'published')->count();

        // Project coverage
        $projectsQuery = Project::query()->where('is_active', true);
        if ($user->role === 'project_manager') {
            $projectsQuery->where('pic_id', $user->id);
        }
        $myProjects = $projectsQuery->get(['id', 'name', 'code']);

        $currentWeekStart = Carbon::now()->startOfWeek()->toDateString();
        $currentWeekEnd = Carbon::now()->endOfWeek()->toDateString();

        $reportedProjectIds = (clone $query)
            ->where('period_start', '<=', $currentWeekEnd)
            ->where('period_end', '>=', $currentWeekStart)
            ->pluck('project_id')
            ->unique();

        $projectsWithoutReport = $myProjects->whereNotIn('id', $reportedProjectIds)->values();

        $latestPublished = (clone $query)
            ->where('status', 'published')
            ->with(['project:id,name,code', 'creator:id,name'])
            ->orderByDesc('published_at')
            ->first();

        return response()->json([
            'total_reports' => $totalReports,
            'total_drafts' => $totalDrafts,
            'total_published' => $totalPublished,
            'total_projects' => $myProjects->count(),
            'projects_unreported_this_week_count' => $projectsWithoutReport->count(),
            'projects_unreported_this_week' => $projectsWithoutReport,
            'latest_published' => $latestPublished,
        ]);
    }

    /**
     * GET /api/project-reports
     * List project reports with search, filter, and role scoping.
     */
    public function index(Request $request)
    {
        $user = $this->getAuthorizedUser($request);

        $query = ProjectReport::with(['project:id,name,code,pic_id,pic_name,status', 'creator:id,name,email']);

        // Scope by role
        if ($user->role === 'project_manager') {
            $myProjectIds = Project::where('pic_id', $user->id)->pluck('id');
            $query->whereIn('project_id', $myProjectIds);
        } elseif ($user->role === 'pimpinan') {
            // Pimpinan only sees published reports!
            $query->where('status', 'published');
        }

        // Filter status
        if ($request->filled('status') && $request->status !== 'all') {
            if ($user->role === 'pimpinan') {
                $query->where('status', 'published');
            } else {
                $query->where('status', $request->status);
            }
        }

        // Filter project
        if ($request->filled('project_id') && $request->project_id !== 'all') {
            $query->where('project_id', $request->project_id);
        }

        // Filter period dates
        if ($request->filled('period_start')) {
            $query->where('period_start', '>=', $request->period_start);
        }
        if ($request->filled('period_end')) {
            $query->where('period_end', '<=', $request->period_end);
        }

        // Search in project name or report number or summary
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('report_number', 'like', "%{$search}%")
                  ->orWhere('executive_summary', 'like', "%{$search}%")
                  ->orWhereHas('project', function ($pq) use ($search) {
                      $pq->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%");
                  });
            });
        }

        $perPage = min((int) $request->input('per_page', 15), 50);
        $reports = $query->orderByDesc('id')->paginate($perPage);

        return response()->json($reports);
    }

    /**
     * GET /api/project-reports/{id}
     * Report detail with full snapshot and narrative.
     */
    public function show(Request $request, $id)
    {
        $user = $this->getAuthorizedUser($request);

        $report = ProjectReport::with(['project:id,name,code,client,pic_id,pic_name,status,deadline', 'creator:id,name,email,position'])
            ->find($id);

        if (!$report) {
            return response()->json(['message' => 'Laporan proyek tidak ditemukan.'], 404);
        }

        // Role authorization check
        if ($user->role === 'project_manager') {
            if ($report->project->pic_id !== $user->id) {
                return response()->json(['message' => 'Akses ditolak. Anda hanya dapat melihat laporan proyek milik Anda.'], 403);
            }
        } elseif ($user->role === 'pimpinan') {
            if ($report->status !== 'published') {
                return response()->json(['message' => 'Laporan berstatus draft tidak dapat diakses oleh pimpinan.'], 403);
            }
        }

        return response()->json([
            'report' => $report,
        ]);
    }

    /**
     * GET /api/projects/{projectId}/reports/preview
     * Live snapshot preview before creating or saving a report.
     */
    public function previewSnapshot(Request $request, $projectId)
    {
        $user = $this->getAuthorizedUser($request);
        $project = Project::find($projectId);

        if (!$project) {
            return response()->json(['message' => 'Proyek tidak ditemukan.'], 404);
        }

        $this->authorizeProjectAccess($user, $project);

        $periodStart = $request->input('period_start', Carbon::now()->startOfWeek()->toDateString());
        $periodEnd = $request->input('period_end', Carbon::now()->endOfWeek()->toDateString());

        $snapshot = $this->generateSnapshot($project, $periodStart, $periodEnd);

        return response()->json([
            'project_id' => $project->id,
            'project_name' => $project->name,
            'period_start' => $periodStart,
            'period_end' => $periodEnd,
            'snapshot' => $snapshot,
        ]);
    }

    /**
     * POST /api/projects/{projectId}/reports
     * Create a new draft project report with automatic snapshot.
     */
    public function store(Request $request, $projectId)
    {
        $user = $this->getAuthorizedUser($request);

        $project = Project::find($projectId);
        if (!$project) {
            return response()->json(['message' => 'Proyek tidak ditemukan.'], 404);
        }

        $this->authorizeProjectAccess($user, $project);

        $validated = $request->validate([
            'period_start' => 'required|date',
            'period_end' => 'required|date|after_or_equal:period_start',
            'executive_summary' => 'nullable|string',
            'completed_work' => 'nullable|string',
            'challenges' => 'nullable|string',
            'risks' => 'nullable|string',
            'next_week_plan' => 'nullable|string',
            'support_required' => 'nullable|string',
        ], [
            'period_start.required' => 'Tanggal awal periode wajib diisi.',
            'period_end.required' => 'Tanggal akhir periode wajib diisi.',
            'period_end.after_or_equal' => 'Tanggal akhir periode tidak boleh sebelum tanggal awal.',
        ]);

        // Prevent accidental duplicates for exact same project and period
        $existing = ProjectReport::where('project_id', $project->id)
            ->where('period_start', $validated['period_start'])
            ->where('period_end', $validated['period_end'])
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'Laporan untuk proyek dan rentang periode ini sudah terdaftar (' . strtoupper($existing->status) . ').',
                'report_id' => $existing->id,
            ], 422);
        }

        return DB::transaction(function () use ($project, $user, $validated) {
            // Generate snapshot at creation time
            $snapshot = $this->generateSnapshot($project, $validated['period_start'], $validated['period_end']);
            $reportNumber = ProjectReport::generateReportNumber();

            $report = ProjectReport::create([
                'report_number' => $reportNumber,
                'project_id' => $project->id,
                'created_by' => $user->id,
                'period_start' => $validated['period_start'],
                'period_end' => $validated['period_end'],
                'status' => 'draft',
                'executive_summary' => $validated['executive_summary'] ?? null,
                'completed_work' => $validated['completed_work'] ?? null,
                'challenges' => $validated['challenges'] ?? null,
                'risks' => $validated['risks'] ?? null,
                'next_week_plan' => $validated['next_week_plan'] ?? null,
                'support_required' => $validated['support_required'] ?? null,
                'snapshot_data' => $snapshot,
                'published_at' => null,
            ]);

            return response()->json([
                'message' => 'Draft laporan proyek berhasil dibuat.',
                'report' => $report->load(['project:id,name,code', 'creator:id,name']),
            ], 201);
        });
    }

    /**
     * PUT /api/project-reports/{id}
     * Update draft report (published reports are strictly immutable).
     */
    public function update(Request $request, $id)
    {
        $user = $this->getAuthorizedUser($request);

        $report = ProjectReport::with('project')->find($id);
        if (!$report) {
            return response()->json(['message' => 'Laporan proyek tidak ditemukan.'], 404);
        }

        // Immutable published report guard
        if ($report->status === 'published') {
            return response()->json([
                'message' => 'Laporan yang telah diterbitkan bersifat permanen dan tidak dapat diubah.',
            ], 422);
        }

        // Ownership authorization
        if ($user->role === 'project_manager') {
            if ($report->project->pic_id !== $user->id || $report->created_by !== $user->id) {
                return response()->json(['message' => 'Anda tidak memiliki hak untuk mengubah draft laporan ini.'], 403);
            }
        } elseif ($user->role === 'pimpinan') {
            return response()->json(['message' => 'Pimpinan tidak diizinkan mengubah laporan.'], 403);
        }

        $validated = $request->validate([
            'period_start' => 'sometimes|date',
            'period_end' => 'sometimes|date|after_or_equal:period_start',
            'executive_summary' => 'nullable|string',
            'completed_work' => 'nullable|string',
            'challenges' => 'nullable|string',
            'risks' => 'nullable|string',
            'next_week_plan' => 'nullable|string',
            'support_required' => 'nullable|string',
            'refresh_snapshot' => 'sometimes|boolean',
        ]);

        // Duplicate period check if dates changed
        $periodStart = $validated['period_start'] ?? $report->period_start;
        $periodEnd = $validated['period_end'] ?? $report->period_end;

        $duplicate = ProjectReport::where('project_id', $report->project_id)
            ->where('id', '!=', $report->id)
            ->where('period_start', $periodStart)
            ->where('period_end', $periodEnd)
            ->exists();

        if ($duplicate) {
            return response()->json([
                'message' => 'Sudah ada laporan lain untuk proyek dan periode ini.',
            ], 422);
        }

        return DB::transaction(function () use ($report, $validated, $periodStart, $periodEnd) {
            $updates = [
                'period_start' => $periodStart,
                'period_end' => $periodEnd,
            ];

            foreach (['executive_summary', 'completed_work', 'challenges', 'risks', 'next_week_plan', 'support_required'] as $field) {
                if (array_key_exists($field, $validated)) {
                    $updates[$field] = $validated[$field];
                }
            }

            // Regenerate snapshot if requested
            if (!empty($validated['refresh_snapshot'])) {
                $updates['snapshot_data'] = $this->generateSnapshot($report->project, (string) $periodStart, (string) $periodEnd);
            }

            $report->update($updates);

            return response()->json([
                'message' => 'Draft laporan proyek berhasil diperbarui.',
                'report' => $report->fresh(['project:id,name,code', 'creator:id,name']),
            ]);
        });
    }

    /**
     * POST /api/project-reports/{id}/publish
     * Publish a draft report with final validation and immutable snapshot.
     */
    public function publish(Request $request, $id)
    {
        $user = $this->getAuthorizedUser($request);

        $report = ProjectReport::with('project')->find($id);
        if (!$report) {
            return response()->json(['message' => 'Laporan proyek tidak ditemukan.'], 404);
        }

        if ($report->status === 'published') {
            return response()->json([
                'message' => 'Laporan ini sudah diterbitkan sebelumnya.',
            ], 422);
        }

        if ($user->role === 'project_manager') {
            if ($report->project->pic_id !== $user->id) {
                return response()->json(['message' => 'Anda tidak memiliki hak untuk menerbitkan laporan ini.'], 403);
            }
        } elseif ($user->role === 'pimpinan') {
            return response()->json(['message' => 'Pimpinan tidak memiliki akses menerbitkan laporan.'], 403);
        }

        // Validate mandatory fields for publishing
        $executiveSummary = trim($request->input('executive_summary', $report->executive_summary ?? ''));
        if (empty($executiveSummary)) {
            return response()->json([
                'message' => 'Executive summary wajib diisi sebelum menerbitkan laporan.',
                'errors' => ['executive_summary' => ['Executive summary tidak boleh kosong.']],
            ], 422);
        }

        return DB::transaction(function () use ($report, $executiveSummary, $request) {
            // Optional narrative updates provided at publish time
            $updates = [
                'executive_summary' => $executiveSummary,
                'status' => 'published',
                'published_at' => Carbon::now(),
            ];

            foreach (['completed_work', 'challenges', 'risks', 'next_week_plan', 'support_required'] as $field) {
                if ($request->has($field)) {
                    $updates[$field] = $request->input($field);
                }
            }

            // Capture final authoritative snapshot upon publication
            $updates['snapshot_data'] = $this->generateSnapshot(
                $report->project,
                (string) $report->period_start,
                (string) $report->period_end
            );

            $report->update($updates);

            return response()->json([
                'message' => 'Laporan mingguan proyek berhasil diterbitkan.',
                'report' => $report->fresh(['project:id,name,code', 'creator:id,name']),
            ]);
        });
    }

    /**
     * DELETE /api/project-reports/{id}
     * Delete draft report (published reports CANNOT be deleted).
     */
    public function destroy(Request $request, $id)
    {
        $user = $this->getAuthorizedUser($request);

        $report = ProjectReport::with('project')->find($id);
        if (!$report) {
            return response()->json(['message' => 'Laporan proyek tidak ditemukan.'], 404);
        }

        // Immutable published guard
        if ($report->status === 'published') {
            return response()->json([
                'message' => 'Laporan yang telah diterbitkan tidak dapat dihapus.',
            ], 422);
        }

        // Ownership authorization
        if ($user->role === 'project_manager') {
            if ($report->project->pic_id !== $user->id || $report->created_by !== $user->id) {
                return response()->json(['message' => 'Anda tidak memiliki hak untuk menghapus draft laporan ini.'], 403);
            }
        } elseif ($user->role === 'pimpinan') {
            return response()->json(['message' => 'Pimpinan tidak memiliki akses menghapus laporan.'], 403);
        }

        $report->delete();

        return response()->json([
            'message' => 'Draft laporan proyek berhasil dihapus.',
        ]);
    }
}
