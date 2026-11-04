<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Project;
use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TaskController extends Controller
{
    /**
     * Tampilkan daftar tugas operasional dengan filter dan relasi proyek.
     */
    public function index(Request $request)
    {
        $query = Task::with([
            'project:id,code,name,client,status',
            'milestone:id,project_id,title,phase_order,status',
            'assignee:id,name,email,role'
        ]);

        // Filter berdasarkan proyek
        if ($request->filled('project_id') && $request->project_id !== 'all') {
            $query->where('project_id', $request->project_id);
        }

        // Filter berdasarkan milestone / sprint
        if ($request->filled('milestone_id') && $request->milestone_id !== 'all') {
            $query->where('milestone_id', $request->milestone_id);
        }

        // Filter prioritas
        if ($request->filled('priority') && $request->priority !== 'all') {
            $query->where('priority', $request->priority);
        }

        // Filter status selesai
        if ($request->has('is_completed') && $request->is_completed !== 'all') {
            $isComp = filter_var($request->is_completed, FILTER_VALIDATE_BOOLEAN);
            $query->where('is_completed', $isComp);
        }

        // Filter status operasional
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Filter overdue (terlewat deadline)
        if ($request->boolean('overdue')) {
            $today = Carbon::now()->toDateString();
            $query->where('is_completed', false)
                  ->whereNotNull('deadline')
                  ->where('deadline', '<', $today);
        }

        // Pencarian (judul, nama PIC, nama proyek)
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('assignee_name', 'like', "%{$search}%")
                  ->orWhereHas('project', function ($pq) use ($search) {
                      $pq->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%");
                  })
                  ->orWhereHas('milestone', function ($mq) use ($search) {
                      $mq->where('title', 'like', "%{$search}%");
                  });
            });
        }

        // Sorting: belum selesai terlebih dahulu, prioritas high -> medium -> low, deadline terdekat
        $tasks = $query->orderBy('is_completed', 'asc')
                       ->orderByRaw("FIELD(priority, 'high', 'medium', 'low')")
                       ->orderByRaw("deadline IS NULL, deadline ASC")
                       ->orderBy('created_at', 'desc')
                       ->get();

        return response()->json([
            'tasks' => $tasks,
            'total' => $tasks->count(),
        ]);
    }

    /**
     * Buat tugas baru di database.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        // Otorisasi role: hanya admin dan project_manager yang dapat menambah tugas
        if (!$user || !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'message' => 'Hanya Super Admin dan Project Manager yang memiliki izin menambah tugas.',
            ], 403);
        }

        $validated = $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'milestone_id' => ['nullable', 'exists:milestones,id'],
            'title' => ['required', 'string', 'max:255'],
            'priority' => ['required', Rule::in(['low', 'medium', 'high'])],
            'status' => ['nullable', Rule::in(['pending', 'in_progress', 'completed'])],
            'deadline' => ['nullable', 'date'],
            'assignee_id' => ['nullable', 'exists:users,id'],
            'assignee_name' => ['nullable', 'string', 'max:255'],
            'is_completed' => ['nullable', 'boolean'],
        ], [
            'project_id.required' => 'Proyek wajib dipilih.',
            'project_id.exists' => 'Proyek yang dipilih tidak valid.',
            'milestone_id.exists' => 'Sprint/Milestone yang dipilih tidak valid.',
            'title.required' => 'Judul tugas wajib diisi.',
            'priority.required' => 'Prioritas tugas wajib dipilih.',
            'priority.in' => 'Prioritas harus low, medium, atau high.',
            'assignee_id.exists' => 'Personel PIC yang dipilih tidak terdaftar di sistem.',
        ]);

        // Validasi lintas relasi: jika milestone_id disediakan, harus berasal dari project_id yang sama
        if (!empty($validated['milestone_id'])) {
            $ms = \App\Models\Milestone::find($validated['milestone_id']);
            if (!$ms || (int) $ms->project_id !== (int) $validated['project_id']) {
                return response()->json([
                    'message' => 'Sprint/Milestone yang dipilih tidak sesuai dengan proyek yang ditentukan.',
                    'errors' => [
                        'milestone_id' => ['Sprint/Milestone harus berasal dari proyek yang sama.'],
                    ],
                ], 422);
            }
        }

        $task = DB::transaction(function () use ($validated, $user) {
            $isCompleted = !empty($validated['is_completed']) || ($validated['status'] ?? '') === 'completed';
            $status = $isCompleted ? 'completed' : ($validated['status'] ?? 'pending');

            // Resolusi nama PIC dari assignee_id jika ada
            $assigneeId = $validated['assignee_id'] ?? null;
            $assigneeName = $validated['assignee_name'] ?? null;
            if (!empty($assigneeId) && empty($assigneeName)) {
                $u = \App\Models\User::find($assigneeId);
                if ($u) $assigneeName = $u->name;
            } elseif (empty($assigneeId) && !empty($assigneeName)) {
                $u = \App\Models\User::where('name', trim($assigneeName))->first();
                if ($u) $assigneeId = $u->id;
            }

            $t = Task::create([
                'project_id' => $validated['project_id'],
                'milestone_id' => $validated['milestone_id'] ?? null,
                'title' => trim($validated['title']),
                'priority' => $validated['priority'],
                'status' => $status,
                'is_completed' => $isCompleted,
                'deadline' => $validated['deadline'] ?? null,
                'assignee_id' => $assigneeId,
                'assignee_name' => !empty($assigneeName) ? trim($assigneeName) : null,
            ]);

            // Muat relasi proyek dan milestone untuk log aktivitas
            $t->load(['project', 'milestone', 'assignee']);

            Activity::create([
                'user_name' => $user ? $user->name : 'Sistem PKM',
                'action' => 'menambahkan tugas baru "' . $t->title . '"',
                'target_name' => $t->title,
                'project_name' => $t->project ? $t->project->name : null,
                'avatar_color' => 'yellow',
            ]);

            return $t;
        });

        return response()->json([
            'message' => 'Tugas baru berhasil ditambahkan.',
            'task' => $task,
        ], 201);
    }

    /**
     * Tampilkan detail tugas tunggal.
     */
    public function show($id)
    {
        $task = Task::with([
            'project:id,code,name,client,status',
            'milestone:id,project_id,title,phase_order,status',
            'assignee:id,name,email,role'
        ])->findOrFail($id);

        return response()->json([
            'task' => $task,
        ]);
    }

    /**
     * Perbarui data tugas yang sudah ada.
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();

        // Otorisasi role: hanya admin dan project_manager yang dapat mengubah tugas
        if (!$user || !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'message' => 'Hanya Super Admin dan Project Manager yang memiliki izin mengubah tugas.',
            ], 403);
        }

        $task = Task::findOrFail($id);

        $validated = $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'milestone_id' => ['nullable', 'exists:milestones,id'],
            'title' => ['required', 'string', 'max:255'],
            'priority' => ['required', Rule::in(['low', 'medium', 'high'])],
            'status' => ['nullable', Rule::in(['pending', 'in_progress', 'completed'])],
            'deadline' => ['nullable', 'date'],
            'assignee_id' => ['nullable', 'exists:users,id'],
            'assignee_name' => ['nullable', 'string', 'max:255'],
            'is_completed' => ['nullable', 'boolean'],
        ], [
            'project_id.required' => 'Proyek wajib dipilih.',
            'project_id.exists' => 'Proyek yang dipilih tidak valid.',
            'milestone_id.exists' => 'Sprint/Milestone yang dipilih tidak valid.',
            'title.required' => 'Judul tugas wajib diisi.',
            'priority.required' => 'Prioritas tugas wajib dipilih.',
            'assignee_id.exists' => 'Personel PIC yang dipilih tidak terdaftar di sistem.',
        ]);

        // Validasi lintas relasi: jika milestone_id disediakan, harus berasal dari project_id yang sama
        if (!empty($validated['milestone_id'])) {
            $ms = \App\Models\Milestone::find($validated['milestone_id']);
            if (!$ms || (int) $ms->project_id !== (int) $validated['project_id']) {
                return response()->json([
                    'message' => 'Sprint/Milestone yang dipilih tidak sesuai dengan proyek yang ditentukan.',
                    'errors' => [
                        'milestone_id' => ['Sprint/Milestone harus berasal dari proyek yang sama.'],
                    ],
                ], 422);
            }
        }

        $task = DB::transaction(function () use ($task, $validated, $user) {
            $isCompleted = isset($validated['is_completed'])
                ? (bool) $validated['is_completed']
                : (($validated['status'] ?? '') === 'completed');

            $status = isset($validated['status'])
                ? $validated['status']
                : ($isCompleted ? 'completed' : 'pending');

            // Resolusi nama dan ID PIC
            $assigneeId = array_key_exists('assignee_id', $validated) ? $validated['assignee_id'] : $task->assignee_id;
            if (array_key_exists('assignee_id', $validated)) {
                if (!empty($assigneeId)) {
                    $u = \App\Models\User::find($assigneeId);
                    $assigneeName = $u ? $u->name : ($validated['assignee_name'] ?? null);
                } else {
                    $assigneeName = null;
                }
            } else {
                $assigneeName = array_key_exists('assignee_name', $validated) ? trim($validated['assignee_name']) : $task->assignee_name;
            }

            $task->update([
                'project_id' => $validated['project_id'],
                'milestone_id' => array_key_exists('milestone_id', $validated) ? $validated['milestone_id'] : $task->milestone_id,
                'title' => trim($validated['title']),
                'priority' => $validated['priority'],
                'status' => $status,
                'is_completed' => $isCompleted,
                'deadline' => $validated['deadline'] ?? $task->deadline,
                'assignee_id' => $assigneeId,
                'assignee_name' => $assigneeName,
            ]);

            $task->load(['project', 'milestone', 'assignee']);

            Activity::create([
                'user_name' => $user ? $user->name : 'Sistem PKM',
                'action' => 'memperbarui tugas "' . $task->title . '"',
                'target_name' => $task->title,
                'project_name' => $task->project ? $task->project->name : null,
                'avatar_color' => 'yellow',
            ]);

            return $task;
        });

        return response()->json([
            'message' => 'Tugas berhasil diperbarui.',
            'task' => $task,
        ]);
    }

    /**
     * Hapus tugas dari database.
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();

        // Otorisasi role: hanya admin dan project_manager yang dapat menghapus tugas
        if (!$user || !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'message' => 'Hanya Super Admin dan Project Manager yang memiliki izin menghapus tugas.',
            ], 403);
        }

        $task = Task::with('project')->findOrFail($id);
        $taskTitle = $task->title;
        $projectName = $task->project ? $task->project->name : null;

        DB::transaction(function () use ($task, $user, $taskTitle, $projectName) {
            $task->delete();

            Activity::create([
                'user_name' => $user ? $user->name : 'Sistem PKM',
                'action' => 'menghapus tugas "' . $taskTitle . '"',
                'target_name' => $taskTitle,
                'project_name' => $projectName,
                'avatar_color' => 'purple',
            ]);
        });

        return response()->json([
            'message' => 'Tugas berhasil dihapus.',
        ]);
    }

    /**
     * Toggle status penyelesaian tugas (checked / unchecked).
     */
    public function toggle(Request $request, $id)
    {
        $user = $request->user();

        // RBAC: Pimpinan hanya memiliki akses pemantauan (view-only)
        if ($user && $user->role === 'pimpinan') {
            return response()->json([
                'message' => 'Pimpinan hanya memiliki hak akses pemantauan (view-only).',
            ], 403);
        }

        $task = Task::with('project')->findOrFail($id);

        // RBAC: Member (karyawan) hanya dapat mengubah status tugas yang ditugaskan kepadanya
        if ($user && $user->role === 'member' && !empty($task->assignee_name)) {
            $userLower = strtolower(trim($user->name));
            $assigneeLower = strtolower(trim($task->assignee_name));
            if (strpos($userLower, $assigneeLower) === false && strpos($assigneeLower, $userLower) === false) {
                return response()->json([
                    'message' => 'Anda hanya berhak memperbarui status tugas yang ditugaskan kepada Anda (' . $task->assignee_name . ').',
                ], 403);
            }
        }

        $task->is_completed = !$task->is_completed;
        $task->status = $task->is_completed ? 'completed' : 'pending';
        $task->save();

        Activity::create([
            'user_name' => $user ? $user->name : 'Sistem PKM',
            'action' => $task->is_completed ? 'menyelesaikan tugas "' . $task->title . '"' : 'membuka kembali tugas "' . $task->title . '"',
            'target_name' => $task->title,
            'project_name' => $task->project ? $task->project->name : null,
            'avatar_color' => 'yellow',
        ]);

        $projectProgress = $task->project ? $task->project->calculateActualProgress() : 0;

        return response()->json([
            'message' => 'Status tugas berhasil diperbarui.',
            'task' => $task,
            'project_progress' => $projectProgress,
        ]);
    }
}
