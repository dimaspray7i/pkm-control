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
        $query = Task::with('project');

        // Filter berdasarkan proyek
        if ($request->filled('project_id') && $request->project_id !== 'all') {
            $query->where('project_id', $request->project_id);
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
            'title' => ['required', 'string', 'max:255'],
            'priority' => ['required', Rule::in(['low', 'medium', 'high'])],
            'status' => ['nullable', Rule::in(['pending', 'in_progress', 'completed'])],
            'deadline' => ['nullable', 'date'],
            'assignee_name' => ['nullable', 'string', 'max:255'],
            'is_completed' => ['nullable', 'boolean'],
        ], [
            'project_id.required' => 'Proyek wajib dipilih.',
            'project_id.exists' => 'Proyek yang dipilih tidak valid.',
            'title.required' => 'Judul tugas wajib diisi.',
            'priority.required' => 'Prioritas tugas wajib dipilih.',
            'priority.in' => 'Prioritas harus low, medium, atau high.',
        ]);

        $task = DB::transaction(function () use ($validated, $user) {
            $isCompleted = !empty($validated['is_completed']) || ($validated['status'] ?? '') === 'completed';
            $status = $isCompleted ? 'completed' : ($validated['status'] ?? 'pending');

            $t = Task::create([
                'project_id' => $validated['project_id'],
                'title' => trim($validated['title']),
                'priority' => $validated['priority'],
                'status' => $status,
                'is_completed' => $isCompleted,
                'deadline' => $validated['deadline'] ?? null,
                'assignee_name' => !empty($validated['assignee_name']) ? trim($validated['assignee_name']) : null,
            ]);

            // Muat relasi proyek untuk log aktivitas
            $t->load('project');

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
        $task = Task::with('project')->findOrFail($id);

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
            'title' => ['required', 'string', 'max:255'],
            'priority' => ['required', Rule::in(['low', 'medium', 'high'])],
            'status' => ['nullable', Rule::in(['pending', 'in_progress', 'completed'])],
            'deadline' => ['nullable', 'date'],
            'assignee_name' => ['nullable', 'string', 'max:255'],
            'is_completed' => ['nullable', 'boolean'],
        ], [
            'project_id.required' => 'Proyek wajib dipilih.',
            'project_id.exists' => 'Proyek yang dipilih tidak valid.',
            'title.required' => 'Judul tugas wajib diisi.',
            'priority.required' => 'Prioritas tugas wajib dipilih.',
        ]);

        $task = DB::transaction(function () use ($task, $validated, $user) {
            $isCompleted = isset($validated['is_completed'])
                ? (bool) $validated['is_completed']
                : (($validated['status'] ?? '') === 'completed');

            $status = isset($validated['status'])
                ? $validated['status']
                : ($isCompleted ? 'completed' : 'pending');

            $task->update([
                'project_id' => $validated['project_id'],
                'title' => trim($validated['title']),
                'priority' => $validated['priority'],
                'status' => $status,
                'is_completed' => $isCompleted,
                'deadline' => $validated['deadline'] ?? $task->deadline,
                'assignee_name' => array_key_exists('assignee_name', $validated) ? trim($validated['assignee_name']) : $task->assignee_name,
            ]);

            $task->load('project');

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
        $task = Task::with('project')->findOrFail($id);

        $task->is_completed = !$task->is_completed;
        $task->status = $task->is_completed ? 'completed' : 'pending';
        $task->save();

        Activity::create([
            'user_name' => $user ? $user->name : 'Budi Santoso',
            'action' => $task->is_completed ? 'menyelesaikan tugas "' . $task->title . '"' : 'membuka kembali tugas "' . $task->title . '"',
            'target_name' => $task->title,
            'project_name' => $task->project ? $task->project->name : null,
            'avatar_color' => 'yellow',
        ]);

        return response()->json([
            'message' => 'Status tugas berhasil diperbarui.',
            'task' => $task,
        ]);
    }
}
