<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MilestoneController extends Controller
{
    /**
     * Helper untuk menghitung metrik tugas dan menyinkronkan progres sprint.
     */
    protected function enrichMilestone(Milestone $milestone): Milestone
    {
        $total = $milestone->tasks->count();
        $completed = $milestone->tasks->filter(fn($t) => $t->is_completed || $t->status === 'completed')->count();
        $milestone->setAttribute('total_tasks', $total);
        $milestone->setAttribute('completed_tasks', $completed);
        $milestone->setAttribute('pending_tasks', $total - $completed);

        // Jika ada tugas, sinkronkan progres dan status berdasarkan penyelesaian tugas
        if ($total > 0) {
            $computedProgress = (int) round(($completed / $total) * 100);
            $milestone->progress = $computedProgress;
            if ($computedProgress >= 100) {
                $milestone->status = 'completed';
            } elseif ($computedProgress > 0 && $milestone->status === 'pending') {
                $milestone->status = 'in_progress';
            }
        }

        return $milestone;
    }

    /**
     * Dapatkan daftar seluruh milestone di sistem atau difilter berdasarkan project_id.
     */
    public function all(Request $request)
    {
        $query = Milestone::with([
            'project',
            'tasks' => function ($q) {
                $q->with('assignee')
                  ->orderBy('is_completed', 'asc')
                  ->orderByRaw("FIELD(priority, 'high', 'medium', 'low')")
                  ->orderByRaw("deadline IS NULL, deadline ASC");
            }
        ])->orderBy('phase_order', 'asc');

        if ($request->filled('project_id')) {
            $query->where('project_id', $request->input('project_id'));
        }

        $milestones = $query->get()->map(fn($m) => $this->enrichMilestone($m));

        return response()->json([
            'success' => true,
            'data' => $milestones,
        ]);
    }

    /**
     * Dapatkan seluruh milestone untuk proyek tertentu.
     * Auto-seed 4 fase standar jika belum ada milestone.
     */
    public function index($projectId)
    {
        $project = Project::findOrFail($projectId);

        $milestones = Milestone::with([
            'project',
            'tasks' => function ($q) {
                $q->with('assignee')
                  ->orderBy('is_completed', 'asc')
                  ->orderByRaw("FIELD(priority, 'high', 'medium', 'low')")
                  ->orderByRaw("deadline IS NULL, deadline ASC");
            }
        ])
        ->where('project_id', $projectId)
        ->orderBy('phase_order', 'asc')
        ->get();

        if ($milestones->isEmpty()) {
            $baseProgress = $project->progress;
            $defaults = [
                [
                    'phase_order' => 1,
                    'title' => 'Requirements & Discovery',
                    'description' => 'Requirement gathering, stakeholder alignment, and project brief sign-off.',
                    'start_date' => now()->subDays(30)->format('Y-m-d'),
                    'due_date' => now()->subDays(20)->format('Y-m-d'),
                    'progress' => $baseProgress >= 25 ? 100 : min(100, $baseProgress * 4),
                    'status' => $baseProgress >= 25 ? 'completed' : ($baseProgress > 0 ? 'in_progress' : 'pending'),
                ],
                [
                    'phase_order' => 2,
                    'title' => 'System Architecture & UI/UX',
                    'description' => 'Wireframes, interactive prototype, DB schema design and API contracts.',
                    'start_date' => now()->subDays(19)->format('Y-m-d'),
                    'due_date' => now()->subDays(5)->format('Y-m-d'),
                    'progress' => $baseProgress >= 50 ? 100 : ($baseProgress <= 25 ? 0 : min(100, ($baseProgress - 25) * 4)),
                    'status' => $baseProgress >= 50 ? 'completed' : ($baseProgress > 25 ? 'in_progress' : 'pending'),
                ],
                [
                    'phase_order' => 3,
                    'title' => 'Core Development & Integration',
                    'description' => 'Frontend components, backend business logic, database migrations and external APIs.',
                    'start_date' => now()->subDays(4)->format('Y-m-d'),
                    'due_date' => now()->addDays(15)->format('Y-m-d'),
                    'progress' => $baseProgress >= 75 ? 100 : ($baseProgress <= 50 ? 0 : min(100, ($baseProgress - 50) * 4)),
                    'status' => $baseProgress >= 75 ? 'completed' : ($baseProgress > 50 ? 'in_progress' : 'pending'),
                ],
                [
                    'phase_order' => 4,
                    'title' => 'QA Testing, Security Audit & Deployment',
                    'description' => 'End-to-end testing, security penetration checks, UAT sign-off, production release.',
                    'start_date' => now()->addDays(16)->format('Y-m-d'),
                    'due_date' => $project->deadline ? $project->deadline->format('Y-m-d') : now()->addDays(30)->format('Y-m-d'),
                    'progress' => $baseProgress >= 100 ? 100 : ($baseProgress <= 75 ? 0 : min(100, ($baseProgress - 75) * 4)),
                    'status' => $baseProgress >= 100 ? 'completed' : ($baseProgress > 75 ? 'in_progress' : 'pending'),
                ],
            ];

            foreach ($defaults as $d) {
                Milestone::create(array_merge($d, ['project_id' => $projectId]));
            }

            $milestones = Milestone::with([
                'project',
                'tasks' => function ($q) {
                    $q->with('assignee')
                      ->orderBy('is_completed', 'asc')
                      ->orderByRaw("FIELD(priority, 'high', 'medium', 'low')")
                      ->orderByRaw("deadline IS NULL, deadline ASC");
                }
            ])
            ->where('project_id', $projectId)
            ->orderBy('phase_order', 'asc')
            ->get();
        }

        $milestones->each(fn($m) => $this->enrichMilestone($m));

        return response()->json([
            'success' => true,
            'project' => $project,
            'data' => $milestones,
        ]);
    }

    /**
     * Dapatkan detail satu milestone dengan daftar task lengkap.
     */
    public function show($id)
    {
        $milestone = Milestone::with([
            'project',
            'tasks' => function ($q) {
                $q->with('assignee')
                  ->orderBy('is_completed', 'asc')
                  ->orderByRaw("FIELD(priority, 'high', 'medium', 'low')")
                  ->orderByRaw("deadline IS NULL, deadline ASC");
            }
        ])->findOrFail($id);

        $this->enrichMilestone($milestone);

        return response()->json([
            'success' => true,
            'data' => $milestone,
        ]);
    }

    /**
     * Simpan Sprint/Milestone baru.
     * Menerima request baik dari /api/projects/{projectId}/milestones maupun /api/milestones.
     */
    public function store(Request $request, $projectId = null)
    {
        $user = $request->user();
        if ($user && !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki hak akses untuk menambah Sprint/Milestone.',
            ], 403);
        }

        $resolvedProjectId = $projectId ?? $request->input('project_id');

        $rules = [
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'start_date' => 'nullable|date',
            'due_date' => 'nullable|date',
            'phase_order' => 'nullable|integer|min:1',
            'progress' => 'nullable|integer|min:0|max:100',
            'status' => 'nullable|in:pending,in_progress,completed',
        ];

        if (!$projectId) {
            $rules['project_id'] = 'required|exists:projects,id';
        }

        $messages = [
            'title.required' => 'Nama Sprint wajib diisi.',
            'project_id.required' => 'Proyek induk wajib dipilih.',
            'project_id.exists' => 'Proyek yang dipilih tidak terdaftar di sistem.',
        ];

        $validated = $request->validate($rules, $messages);

        if (!$resolvedProjectId || !Project::where('id', $resolvedProjectId)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Proyek induk wajib dipilih.',
                'errors' => [
                    'project_id' => ['Proyek induk wajib dipilih dan harus valid.'],
                ],
            ], 422);
        }

        // Validasi tanggal: due_date tidak boleh lebih awal dari start_date
        $startDate = $validated['start_date'] ?? null;
        $dueDate = $validated['due_date'] ?? null;
        if ($startDate && $dueDate && $dueDate < $startDate) {
            return response()->json([
                'success' => false,
                'message' => 'Tanggal selesai tidak boleh lebih awal daripada tanggal mulai.',
                'errors' => [
                    'due_date' => ['Tanggal selesai tidak boleh lebih awal daripada tanggal mulai.'],
                ],
            ], 422);
        }

        $project = Project::findOrFail($resolvedProjectId);

        $milestone = DB::transaction(function () use ($validated, $resolvedProjectId, $project, $user) {
            // Urutan fase otomatis jika tidak disediakan
            if (empty($validated['phase_order'])) {
                $maxOrder = Milestone::where('project_id', $resolvedProjectId)->max('phase_order') ?? 0;
                $validated['phase_order'] = $maxOrder + 1;
            }

            $validated['progress'] = $validated['progress'] ?? 0;
            $validated['status'] = $validated['status'] ?? 'pending';

            $created = Milestone::create(array_merge($validated, ['project_id' => $resolvedProjectId]));

            // Recalculate project progress
            Project::recalculateProgressFor($resolvedProjectId);

            Activity::create([
                'user_name' => $user ? $user->name : 'Sistem PKM',
                'action' => 'membuat sprint baru "' . $created->title . '"',
                'target_name' => $created->title,
                'project_name' => $project->name,
                'avatar_color' => '#FF2F92',
            ]);

            return $created;
        });

        $milestone->load([
            'project',
            'tasks.assignee',
        ]);
        $this->enrichMilestone($milestone);

        return response()->json([
            'success' => true,
            'message' => 'Sprint berhasil dibuat.',
            'data' => $milestone,
        ], 201);
    }

    /**
     * Perbarui data Sprint/Milestone.
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();
        if ($user && !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki hak akses untuk mengubah Sprint/Milestone.',
            ], 403);
        }

        $milestone = Milestone::findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'start_date' => 'nullable|date',
            'due_date' => 'nullable|date',
            'phase_order' => 'sometimes|required|integer|min:1',
            'progress' => 'sometimes|required|integer|min:0|max:100',
            'status' => 'sometimes|required|in:pending,in_progress,completed',
        ], [
            'title.required' => 'Nama Sprint wajib diisi.',
        ]);

        // Periksa validasi tanggal lintas input dan data existing
        $effectiveStartDate = array_key_exists('start_date', $validated)
            ? $validated['start_date']
            : ($milestone->start_date ? $milestone->start_date->format('Y-m-d') : null);

        $effectiveDueDate = array_key_exists('due_date', $validated)
            ? $validated['due_date']
            : ($milestone->due_date ? $milestone->due_date->format('Y-m-d') : null);

        if ($effectiveStartDate && $effectiveDueDate && $effectiveDueDate < $effectiveStartDate) {
            return response()->json([
                'success' => false,
                'message' => 'Tanggal selesai tidak boleh lebih awal daripada tanggal mulai.',
                'errors' => [
                    'due_date' => ['Tanggal selesai tidak boleh lebih awal daripada tanggal mulai.'],
                ],
            ], 422);
        }

        DB::transaction(function () use ($milestone, $validated, $user) {
            $milestone->update($validated);

            // Jika ada task terhubung, pastikan progres tetap sinkron
            if ($milestone->tasks()->count() > 0) {
                $milestone->syncProgress();
            }

            // Recalculate project progress
            Project::recalculateProgressFor($milestone->project_id);

            Activity::create([
                'user_name' => $user ? $user->name : 'Sistem PKM',
                'action' => 'memperbarui sprint "' . $milestone->title . '"',
                'target_name' => $milestone->title,
                'project_name' => $milestone->project ? $milestone->project->name : '-',
                'avatar_color' => '#FFD83D',
            ]);
        });

        $milestone->load([
            'project',
            'tasks.assignee',
        ]);
        $this->enrichMilestone($milestone);

        return response()->json([
            'success' => true,
            'message' => 'Sprint berhasil diperbarui.',
            'data' => $milestone,
        ]);
    }

    /**
     * Hapus Sprint/Milestone.
     * Task terkait TETAP DIPERTAHANKAN dan milestone_id disetel menjadi NULL.
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        if ($user && !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki hak akses untuk menghapus Sprint/Milestone.',
            ], 403);
        }

        $milestone = Milestone::findOrFail($id);
        $projectId = $milestone->project_id;
        $title = $milestone->title;

        DB::transaction(function () use ($milestone, $projectId, $title, $user) {
            // Lepaskan task yang terhubung dengan aman (milestone_id -> NULL)
            // Task tetap ada dan tetap terhubung dengan project_id induknya
            Task::where('milestone_id', $milestone->id)->update(['milestone_id' => null]);

            $milestone->delete();

            // Recalculate project progress setelah milestone dihapus
            Project::recalculateProgressFor($projectId);

            Activity::create([
                'user_name' => $user ? $user->name : 'Sistem PKM',
                'action' => 'menghapus sprint "' . $title . '"',
                'target_name' => $title,
                'project_name' => Project::where('id', $projectId)->value('name') ?? '-',
                'avatar_color' => '#171717',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Sprint berhasil dihapus. Task terkait tetap tersimpan dengan aman.',
        ]);
    }
}
