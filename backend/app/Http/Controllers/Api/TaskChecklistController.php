<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Task;
use App\Models\TaskChecklist;
use Illuminate\Http\Request;

class TaskChecklistController extends Controller
{
    /**
     * Ambil daftar checklist untuk suatu tugas.
     */
    public function index(Request $request, $taskId)
    {
        $user = $request->user();
        $task = Task::with('project')->findOrFail($taskId);

        // Otorisasi PM: hanya dapat melihat checklist pada proyek yang dipimpinnya atau ditugaskan kepadanya
        if ($user && $user->role === 'project_manager') {
            $isPic = $task->project && (int) $task->project->pic_id === (int) $user->id;
            $isAssignee = (int) $task->assignee_id === (int) $user->id;
            if (!$isPic && !$isAssignee) {
                return response()->json([
                    'message' => 'Anda tidak memiliki hak akses ke checklist tugas ini.',
                ], 403);
            }
        }

        // Otorisasi Member: hanya dapat melihat checklist pada tugas miliknya
        if ($user && $user->role === 'member') {
            if ((int) $task->assignee_id !== (int) $user->id) {
                return response()->json([
                    'message' => 'Anda tidak memiliki hak akses ke checklist tugas ini.',
                ], 403);
            }
        }

        $checklists = $task->checklists()->with('completedBy:id,name')->get();

        return response()->json([
            'task_id' => $task->id,
            'checklists' => $checklists,
            'stats' => $task->getChecklistStats(),
        ]);
    }

    /**
     * Tambah item checklist baru ke tugas.
     */
    public function store(Request $request, $taskId)
    {
        $user = $request->user();
        $task = Task::with('project')->findOrFail($taskId);

        if (!$user || !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'message' => 'Hanya Admin dan Project Manager yang dapat menambah checklist tugas.',
            ], 403);
        }

        if ($user->role === 'project_manager' && (int) $task->project->pic_id !== (int) $user->id) {
            return response()->json([
                'message' => 'Anda hanya dapat menambah checklist pada tugas di proyek yang Anda pimpin.',
            ], 403);
        }

        if ($task->status === 'in_review') {
            return response()->json([
                'message' => 'Checklist tidak dapat ditambah karena tugas sedang dalam tahap peninjauan (in_review).',
            ], 422);
        }

        if (in_array($task->status, ['completed', 'done']) || $task->is_completed) {
            return response()->json([
                'message' => 'Checklist tidak dapat ditambah karena tugas sudah selesai (done).',
            ], 422);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'position' => ['nullable', 'integer'],
        ], [
            'title.required' => 'Judul checklist wajib diisi.',
        ]);

        $maxPos = $task->checklists()->max('position') ?? 0;
        $position = $validated['position'] ?? ($maxPos + 1);

        $checklist = TaskChecklist::create([
            'task_id' => $task->id,
            'title' => trim($validated['title']),
            'is_completed' => false,
            'position' => $position,
        ]);

        return response()->json([
            'message' => 'Checklist berhasil ditambahkan.',
            'checklist' => $checklist,
            'stats' => $task->getChecklistStats(),
        ], 201);
    }

    /**
     * Perbarui judul atau urutan checklist.
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();
        $checklist = TaskChecklist::with('task.project')->findOrFail($id);
        $task = $checklist->task;

        if (!$user || !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'message' => 'Hanya Admin dan Project Manager yang dapat mengubah checklist tugas.',
            ], 403);
        }

        if ($user->role === 'project_manager' && (int) $task->project->pic_id !== (int) $user->id) {
            return response()->json([
                'message' => 'Anda hanya dapat mengubah checklist pada proyek yang Anda pimpin.',
            ], 403);
        }

        if ($task->status === 'in_review') {
            return response()->json([
                'message' => 'Checklist tidak dapat diubah karena tugas sedang dalam tahap peninjauan (in_review).',
            ], 422);
        }

        if (in_array($task->status, ['completed', 'done']) || $task->is_completed) {
            return response()->json([
                'message' => 'Checklist tidak dapat diubah karena tugas sudah selesai (done).',
            ], 422);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'position' => ['nullable', 'integer'],
            'is_completed' => ['nullable', 'boolean'],
        ]);

        if (isset($validated['title'])) {
            $checklist->title = trim($validated['title']);
        }
        if (isset($validated['position'])) {
            $checklist->position = $validated['position'];
        }
        if (isset($validated['is_completed'])) {
            $checklist->is_completed = (bool) $validated['is_completed'];
            if ($checklist->is_completed) {
                $checklist->completed_by = $user->id;
                $checklist->completed_at = now();
            } else {
                $checklist->completed_by = null;
                $checklist->completed_at = null;
            }
        }
        $checklist->save();

        return response()->json([
            'message' => 'Checklist berhasil diperbarui.',
            'checklist' => $checklist,
            'stats' => $task->getChecklistStats(),
        ]);
    }

    /**
     * Toggle status selesai / belum selesai pada item checklist.
     * PENTING: Checklist 100% tidak otomatis mengubah status task menjadi 'done'.
     */
    public function toggle(Request $request, $id)
    {
        $user = $request->user();
        $checklist = TaskChecklist::with('task.project')->findOrFail($id);
        $task = $checklist->task;

        if ($user && $user->role === 'pimpinan') {
            return response()->json([
                'message' => 'Pimpinan hanya memiliki hak akses pemantauan (view-only).',
            ], 403);
        }

        if ($user && $user->role === 'project_manager') {
            $isPic = $task->project && (int) $task->project->pic_id === (int) $user->id;
            $isAssignee = (int) $task->assignee_id === (int) $user->id;
            if (!$isPic && !$isAssignee) {
                return response()->json([
                    'message' => 'Anda hanya dapat memperbarui checklist pada proyek yang Anda pimpin.',
                ], 403);
            }
        }

        if ($user && $user->role === 'member') {
            if ((int) $task->assignee_id !== (int) $user->id) {
                return response()->json([
                    'message' => 'Anda hanya dapat memperbarui checklist pada tugas yang ditugaskan kepada Anda.',
                ], 403);
            }
        }

        if ($task->status === 'in_review') {
            return response()->json([
                'message' => 'Checklist tidak dapat diubah karena tugas sedang dalam tahap peninjauan (in_review).',
            ], 422);
        }

        if (in_array($task->status, ['completed', 'done']) || $task->is_completed) {
            return response()->json([
                'message' => 'Checklist tidak dapat diubah karena tugas sudah selesai (done). Buka kembali tugas (reopen) untuk mengubah checklist.',
            ], 422);
        }

        $checklist->is_completed = !$checklist->is_completed;
        if ($checklist->is_completed) {
            $checklist->completed_by = $user ? $user->id : null;
            $checklist->completed_at = now();
        } else {
            $checklist->completed_by = null;
            $checklist->completed_at = null;
        }
        $checklist->save();

        return response()->json([
            'message' => 'Status checklist berhasil diperbarui.',
            'checklist' => $checklist,
            'task_status' => $task->status,
            'is_task_completed' => $task->is_completed,
            'stats' => $task->getChecklistStats(),
        ]);
    }

    /**
     * Hapus item checklist.
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $checklist = TaskChecklist::with('task.project')->findOrFail($id);
        $task = $checklist->task;

        if (!$user || !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'message' => 'Hanya Admin dan Project Manager yang dapat menghapus checklist tugas.',
            ], 403);
        }

        if ($user->role === 'project_manager' && (int) $task->project->pic_id !== (int) $user->id) {
            return response()->json([
                'message' => 'Anda hanya dapat menghapus checklist pada proyek yang Anda pimpin.',
            ], 403);
        }

        if ($task->status === 'in_review') {
            return response()->json([
                'message' => 'Checklist tidak dapat dihapus karena tugas sedang dalam tahap peninjauan (in_review).',
            ], 422);
        }

        if (in_array($task->status, ['completed', 'done']) || $task->is_completed) {
            return response()->json([
                'message' => 'Checklist tidak dapat dihapus karena tugas sudah selesai (done).',
            ], 422);
        }

        $checklist->delete();

        return response()->json([
            'message' => 'Checklist berhasil dihapus.',
            'stats' => $task->getChecklistStats(),
        ]);
    }
}
