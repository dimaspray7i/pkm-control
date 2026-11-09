<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;

class PmTeamWorkloadController extends Controller
{
    /**
     * Workload threshold constants.
     * Light: 0–2 | Moderate: 3–5 | High: 6–8 | Overloaded: 9+
     */
    const THRESHOLD_LIGHT    = 2;
    const THRESHOLD_MODERATE = 5;
    const THRESHOLD_HIGH     = 8;

    // Status values that mean "done / finished" — not counted as active
    const DONE_STATUSES = ['done', 'completed'];

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Return 403 if the authenticated user is a member.
     * Return the scoped project IDs for the authenticated user.
     */
    private function authorizeAndScope(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            abort(401, 'Unauthenticated.');
        }

        if ($user->role === 'member') {
            abort(403, 'Forbidden.');
        }

        $projectIds = $user->role === 'project_manager'
            ? Project::where('pic_id', $user->id)->pluck('id')
            : Project::pluck('id');

        return [$user, $projectIds];
    }

    /**
     * Calculate workload level label from active task count.
     */
    private function workloadLevel(int $activeCount): string
    {
        if ($activeCount <= self::THRESHOLD_LIGHT) {
            return 'Light';
        }
        if ($activeCount <= self::THRESHOLD_MODERATE) {
            return 'Moderate';
        }
        if ($activeCount <= self::THRESHOLD_HIGH) {
            return 'High';
        }
        return 'Overloaded';
    }

    /**
     * Compute average checklist progress for a collection of tasks.
     * Each task's progress = completed_checklists / total_checklists * 100.
     * Tasks with no checklists contribute 0.
     */
    private function computeAvgProgress($tasks): float
    {
        if ($tasks->isEmpty()) {
            return 0.0;
        }

        $total = 0;
        foreach ($tasks as $task) {
            $checklists = $task->checklists;
            $count      = $checklists->count();
            $completed  = $checklists->where('is_completed', true)->count();
            $total     += $count > 0 ? round(($completed / $count) * 100) : 0;
        }

        return round($total / $tasks->count(), 1);
    }

    /**
     * Map deadline to a named deadline group.
     */
    private function deadlineGroup(?string $deadline): string
    {
        if (!$deadline) {
            return 'no_deadline';
        }
        $today    = Carbon::today();
        $dueDate  = Carbon::parse($deadline)->startOfDay();
        $diffDays = $today->diffInDays($dueDate, false);

        if ($diffDays < 0) {
            return 'overdue';
        }
        if ($diffDays === 0) {
            return 'due_today';
        }
        if ($diffDays <= 7) {
            return 'due_soon';
        }
        return 'upcoming';
    }

    /**
     * Resolve member IDs in the given project scope, ensuring deduplication.
     */
    private function memberIdsInScope($projectIds)
    {
        return Task::whereIn('project_id', $projectIds)
            ->whereNotNull('assignee_id')
            ->distinct()
            ->pluck('assignee_id');
    }

    // -------------------------------------------------------------------------
    // A. Summary KPIs — GET /api/workload/summary
    // -------------------------------------------------------------------------

    public function summary(Request $request)
    {
        [$user, $projectIds] = $this->authorizeAndScope($request);

        $today = Carbon::today()->toDateString();

        // Active tasks: status NOT IN done_statuses AND is_completed = false
        $activeTasks = Task::whereIn('project_id', $projectIds)
            ->whereNotIn('status', self::DONE_STATUSES)
            ->where('is_completed', false);

        $totalActiveMembers = $this->memberIdsInScope($projectIds)->count();
        $totalActiveTasks   = (clone $activeTasks)->count();
        $totalInReview      = (clone $activeTasks)->where('status', 'in_review')->count();
        $totalOverdue       = (clone $activeTasks)
            ->whereNotNull('deadline')
            ->where('deadline', '<', $today)
            ->count();
        $totalDone          = Task::whereIn('project_id', $projectIds)
            ->where(function ($q) {
                $q->whereIn('status', self::DONE_STATUSES)
                  ->orWhere('is_completed', true);
            })
            ->count();

        // Highest workload member: member with most active tasks
        $highestWorkload = Task::whereIn('project_id', $projectIds)
            ->whereNotNull('assignee_id')
            ->whereNotIn('status', self::DONE_STATUSES)
            ->where('is_completed', false)
            ->selectRaw('assignee_id, COUNT(*) as task_count')
            ->groupBy('assignee_id')
            ->orderByDesc('task_count')
            ->with('assignee:id,name')
            ->first();

        return response()->json([
            'total_active_members'   => $totalActiveMembers,
            'total_active_tasks'     => $totalActiveTasks,
            'total_in_review'        => $totalInReview,
            'total_overdue'          => $totalOverdue,
            'total_done'             => $totalDone,
            'highest_workload_member' => $highestWorkload ? [
                'name'       => $highestWorkload->assignee->name ?? '—',
                'task_count' => $highestWorkload->task_count,
                'level'      => $this->workloadLevel($highestWorkload->task_count),
            ] : null,
        ]);
    }

    // -------------------------------------------------------------------------
    // B. Member List — GET /api/workload/members
    // -------------------------------------------------------------------------

    public function memberList(Request $request)
    {
        [$user, $projectIds] = $this->authorizeAndScope($request);

        $today = Carbon::today()->toDateString();

        // Collect member IDs in scope
        $memberIds = $this->memberIdsInScope($projectIds);

        // Build base member query
        $memberQuery = User::whereIn('id', $memberIds)->where('role', 'member');

        // Filter: search by name
        if ($request->filled('search')) {
            $memberQuery->where('name', 'like', '%' . $request->search . '%');
        }

        $members = $memberQuery->get(['id', 'name', 'email', 'avatar', 'position', 'department']);

        $result = [];

        foreach ($members as $member) {
            // Fetch all tasks for this member within the scoped projects
            $memberTasks = Task::whereIn('project_id', $projectIds)
                ->where('assignee_id', $member->id)
                ->with(['checklists', 'project:id,name'])
                ->get();

            // Active tasks
            $activeTasks = $memberTasks->filter(fn ($t) =>
                !in_array($t->status, self::DONE_STATUSES) && !$t->is_completed
            );

            $activeCount    = $activeTasks->count();
            $inReviewCount  = $activeTasks->where('status', 'in_review')->count();
            $overdueCount   = $activeTasks->filter(fn ($t) =>
                $t->deadline && $t->deadline < $today
            )->count();
            $doneCount      = $memberTasks->filter(fn ($t) =>
                in_array($t->status, self::DONE_STATUSES) || $t->is_completed
            )->count();

            // Avg checklist progress across active tasks
            $avgProgress = $this->computeAvgProgress($activeTasks);

            // Nearest deadline (from active, non-null deadlines)
            $nearestDeadline = $activeTasks
                ->filter(fn ($t) => !is_null($t->deadline))
                ->sortBy('deadline')
                ->first()?->deadline;

            // Distinct projects
            $projects = $memberTasks->pluck('project')->unique('id')->values()->map(fn ($p) => [
                'id'   => $p->id,
                'name' => $p->name,
            ])->toArray();

            $level = $this->workloadLevel($activeCount);

            // Filters applied after computing stats
            if ($request->filled('workload_level') && $level !== $request->workload_level) {
                continue;
            }
            if ($request->filled('project_id') && !in_array($request->project_id, array_column($projects, 'id'))) {
                continue;
            }
            if ($request->filled('deadline_group')) {
                $near = $nearestDeadline ? $this->deadlineGroup($nearestDeadline) : 'no_deadline';
                if ($near !== $request->deadline_group) {
                    continue;
                }
            }

            $result[] = [
                'id'              => $member->id,
                'name'            => $member->name,
                'email'           => $member->email,
                'avatar'          => $member->avatar,
                'position'        => $member->position,
                'department'      => $member->department,
                'active_tasks'    => $activeCount,
                'in_review_tasks' => $inReviewCount,
                'overdue_tasks'   => $overdueCount,
                'done_tasks'      => $doneCount,
                'total_tasks'     => $memberTasks->count(),
                'avg_progress'    => $avgProgress,
                'nearest_deadline' => $nearestDeadline,
                'projects'        => $projects,
                'workload_level'  => $level,
            ];
        }

        // Sort by active tasks descending by default
        usort($result, fn ($a, $b) => $b['active_tasks'] <=> $a['active_tasks']);

        return response()->json(['members' => $result]);
    }

    // -------------------------------------------------------------------------
    // C. Member Detail — GET /api/workload/members/{id}
    // -------------------------------------------------------------------------

    public function memberDetail(Request $request, $memberId)
    {
        [$user, $projectIds] = $this->authorizeAndScope($request);

        $today = Carbon::today()->toDateString();

        // Ensure member has tasks in scoped projects (scope enforcement)
        $hasAccess = Task::whereIn('project_id', $projectIds)
            ->where('assignee_id', $memberId)
            ->exists();

        if (!$hasAccess) {
            return response()->json(['message' => 'Member not found in your projects.'], 404);
        }

        $member = User::find($memberId, ['id', 'name', 'email', 'avatar', 'position', 'department', 'phone']);

        if (!$member) {
            return response()->json(['message' => 'User not found.'], 404);
        }

        // All tasks for this member in scope
        $memberTasksQuery = Task::whereIn('project_id', $projectIds)
            ->where('assignee_id', $memberId)
            ->with(['checklists', 'project:id,name', 'milestone:id,name']);

        // Optional filters
        if ($request->filled('project_id')) {
            $memberTasksQuery->where('project_id', $request->project_id);
        }
        if ($request->filled('status')) {
            $memberTasksQuery->where('status', $request->status);
        }
        if ($request->filled('priority')) {
            $memberTasksQuery->where('priority', $request->priority);
        }
        if ($request->filled('deadline_group')) {
            $group = $request->deadline_group;
            switch ($group) {
                case 'overdue':
                    $memberTasksQuery->whereNotNull('deadline')->where('deadline', '<', $today)
                        ->whereNotIn('status', self::DONE_STATUSES)->where('is_completed', false);
                    break;
                case 'due_today':
                    $memberTasksQuery->where('deadline', $today);
                    break;
                case 'due_soon':
                    $memberTasksQuery->whereNotNull('deadline')
                        ->where('deadline', '>=', $today)
                        ->where('deadline', '<=', Carbon::today()->addDays(7)->toDateString());
                    break;
                case 'no_deadline':
                    $memberTasksQuery->whereNull('deadline');
                    break;
            }
        }

        $memberTasks = $memberTasksQuery->orderBy('deadline')->get();

        // Build task list
        $taskList = $memberTasks->map(function ($task) use ($today) {
            $checklists  = $task->checklists;
            $total       = $checklists->count();
            $completed   = $checklists->where('is_completed', true)->count();
            $progress    = $total > 0 ? round(($completed / $total) * 100) : 0;
            $isOverdue   = $task->deadline && $task->deadline < $today
                && !in_array($task->status, self::DONE_STATUSES) && !$task->is_completed;

            return [
                'id'                 => $task->id,
                'title'              => $task->title,
                'status'             => $task->status,
                'priority'           => $task->priority,
                'deadline'           => $task->deadline,
                'is_overdue'         => $isOverdue,
                'checklist_progress' => $progress,
                'total_checklists'   => $total,
                'completed_checklists' => $completed,
                'project'            => $task->project ? ['id' => $task->project->id, 'name' => $task->project->name] : null,
                'milestone'          => $task->milestone ? ['id' => $task->milestone->id, 'name' => $task->milestone->name] : null,
                'deadline_group'     => $this->deadlineGroup($task->deadline),
            ];
        });

        // Summary stats
        $activeTasks   = $memberTasks->filter(fn ($t) => !in_array($t->status, self::DONE_STATUSES) && !$t->is_completed);
        $activeCount   = $activeTasks->count();
        $summary       = [
            'total_tasks'    => $memberTasks->count(),
            'active_tasks'   => $activeCount,
            'in_review'      => $activeTasks->where('status', 'in_review')->count(),
            'overdue'        => $activeTasks->filter(fn ($t) => $t->deadline && $t->deadline < $today)->count(),
            'done'           => $memberTasks->filter(fn ($t) => in_array($t->status, self::DONE_STATUSES) || $t->is_completed)->count(),
            'avg_progress'   => $this->computeAvgProgress($activeTasks),
            'workload_level' => $this->workloadLevel($activeCount),
        ];

        // Recent progress history (TaskUpdates) — last 15, scoped to PM's projects
        $progressHistory = \App\Models\TaskUpdate::whereHas('task', function ($q) use ($projectIds, $memberId) {
            $q->whereIn('project_id', $projectIds)->where('assignee_id', $memberId);
        })
        ->with(['task:id,title'])
        ->orderByDesc('created_at')
        ->limit(15)
        ->get()
        ->map(fn ($u) => [
            'id'            => $u->id,
            'task_id'       => $u->task_id,
            'task_title'    => $u->task?->title,
            'description'   => $u->work_description,
            'progress'      => $u->progress_snapshot,
            'blocker'       => $u->blocker,
            'next_plan'     => $u->next_plan,
            'created_at'    => $u->created_at,
        ]);

        // Recent approval history (TaskReviews) — last 15
        $approvalHistory = \App\Models\TaskReview::whereHas('task', function ($q) use ($projectIds, $memberId) {
            $q->whereIn('project_id', $projectIds)->where('assignee_id', $memberId);
        })
        ->with(['task:id,title', 'user:id,name'])
        ->orderByDesc('created_at')
        ->limit(15)
        ->get()
        ->map(fn ($r) => [
            'id'          => $r->id,
            'task_id'     => $r->task_id,
            'task_title'  => $r->task?->title,
            'action'      => $r->action,
            'notes'       => $r->notes,
            'reviewer'    => $r->user?->name,
            'created_at'  => $r->created_at,
        ]);

        return response()->json([
            'member'           => [
                'id'         => $member->id,
                'name'       => $member->name,
                'email'      => $member->email,
                'avatar'     => $member->avatar,
                'position'   => $member->position,
                'department' => $member->department,
                'phone'      => $member->phone,
            ],
            'summary'          => $summary,
            'tasks'            => $taskList,
            'progress_history' => $progressHistory,
            'approval_history' => $approvalHistory,
        ]);
    }

    // -------------------------------------------------------------------------
    // D. Distribution Charts & Insights — GET /api/workload/distribution
    // -------------------------------------------------------------------------

    public function distribution(Request $request)
    {
        [$user, $projectIds] = $this->authorizeAndScope($request);

        $today = Carbon::today()->toDateString();

        $memberIds = $this->memberIdsInScope($projectIds);

        // Per-member task count by status (for charts)
        $members = User::whereIn('id', $memberIds)->get(['id', 'name']);

        $memberStats = $members->map(function ($member) use ($projectIds, $today) {
            $tasks = Task::whereIn('project_id', $projectIds)
                ->where('assignee_id', $member->id)
                ->get(['id', 'status', 'priority', 'deadline', 'is_completed']);

            $active   = $tasks->filter(fn ($t) => !in_array($t->status, self::DONE_STATUSES) && !$t->is_completed);
            $overdue  = $active->filter(fn ($t) => $t->deadline && $t->deadline < $today)->count();

            return [
                'member_id'   => $member->id,
                'member_name' => $member->name,
                'todo'        => $active->whereIn('status', ['todo', 'pending'])->count(),
                'in_progress' => $active->where('status', 'in_progress')->count(),
                'in_review'   => $active->where('status', 'in_review')->count(),
                'done'        => $tasks->filter(fn ($t) => in_array($t->status, self::DONE_STATUSES) || $t->is_completed)->count(),
                'active'      => $active->count(),
                'overdue'     => $overdue,
            ];
        })->sortByDesc('active')->values();

        // Overall status distribution (pie chart)
        $allTasks = Task::whereIn('project_id', $projectIds)->whereNotNull('assignee_id')->get(['status', 'is_completed']);
        $statusDist = [
            ['status' => 'Todo',        'count' => $allTasks->whereIn('status', ['todo', 'pending'])->filter(fn ($t) => !$t->is_completed)->count()],
            ['status' => 'In Progress', 'count' => $allTasks->where('status', 'in_progress')->filter(fn ($t) => !$t->is_completed)->count()],
            ['status' => 'In Review',   'count' => $allTasks->where('status', 'in_review')->filter(fn ($t) => !$t->is_completed)->count()],
            ['status' => 'Done',        'count' => $allTasks->filter(fn ($t) => in_array($t->status, self::DONE_STATUSES) || $t->is_completed)->count()],
        ];

        // Priority distribution
        $priorityDist = [
            ['priority' => 'Low',    'count' => $allTasks->where('priority', 'low')->count()],
            ['priority' => 'Medium', 'count' => $allTasks->where('priority', 'medium')->count()],
            ['priority' => 'High',   'count' => $allTasks->where('priority', 'high')->count()],
            ['priority' => 'Urgent', 'count' => $allTasks->where('priority', 'urgent')->count()],
        ];

        // --- Data-driven insights ---
        $insights = $this->generateInsights($memberStats, $projectIds, $today);

        return response()->json([
            'member_workload'   => $memberStats,
            'status_dist'       => $statusDist,
            'priority_dist'     => $priorityDist,
            'insights'          => $insights,
        ]);
    }

    // -------------------------------------------------------------------------
    // Insight Generator — purely data-driven
    // -------------------------------------------------------------------------

    private function generateInsights($memberStats, $projectIds, string $today): array
    {
        $insights = [];
        $totalMembers = $memberStats->count();

        if ($totalMembers === 0) {
            $insights[] = ['type' => 'info', 'message' => 'Belum ada member yang memiliki tugas pada proyek Anda.'];
            return $insights;
        }

        // 1. Overloaded members
        $overloaded = $memberStats->where('active', '>', self::THRESHOLD_HIGH);
        if ($overloaded->count() > 0) {
            $names = $overloaded->pluck('member_name')->implode(', ');
            $insights[] = [
                'type'    => 'warning',
                'message' => $overloaded->count() === 1
                    ? "{$names} memiliki beban kerja berlebih ({$overloaded->first()['active']} tugas aktif). Pertimbangkan untuk mendistribusikan ulang tugas."
                    : "{$overloaded->count()} member berada dalam kondisi Overloaded: {$names}.",
            ];
        }

        // 2. Overdue tasks
        $totalOverdue = $memberStats->sum('overdue');
        if ($totalOverdue > 0) {
            $worstMember = $memberStats->sortByDesc('overdue')->first();
            $insights[]  = [
                'type'    => 'danger',
                'message' => "Terdapat {$totalOverdue} tugas yang melewati deadline. {$worstMember['member_name']} memiliki {$worstMember['overdue']} tugas terlambat.",
            ];
        }

        // 3. In-review backlog
        $totalInReview = $memberStats->sum('in_review');
        if ($totalInReview >= 3) {
            $insights[] = [
                'type'    => 'info',
                'message' => "Ada {$totalInReview} tugas menunggu review Anda. Segera lakukan review agar pekerjaan member tidak terhambat.",
            ];
        }

        // 4. Light-workload members (potential capacity)
        $light = $memberStats->filter(fn ($m) => $m['active'] <= self::THRESHOLD_LIGHT);
        if ($light->count() > 0 && $overloaded->count() > 0) {
            $lightNames = $light->pluck('member_name')->implode(', ');
            $insights[] = [
                'type'    => 'success',
                'message' => "{$light->count()} member memiliki kapasitas yang tersedia ({$lightNames}). Pertimbangkan untuk menyerahkan tugas baru kepada mereka.",
            ];
        }

        // 5. All members light — no workload concern
        if ($overloaded->count() === 0 && $totalOverdue === 0 && $totalInReview < 3) {
            $insights[] = [
                'type'    => 'success',
                'message' => 'Distribusi pekerjaan tim terlihat seimbang. Tidak ada anggota yang kelebihan beban saat ini.',
            ];
        }

        return $insights;
    }
}
