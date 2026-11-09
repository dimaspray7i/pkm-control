<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Task;
use App\Models\TaskUpdate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class TaskUpdateController extends Controller
{
    /**
     * Ambil histori laporan progres suatu tugas.
     */
    public function index(Request $request, $taskId)
    {
        $user = $request->user();
        $task = Task::with('project')->findOrFail($taskId);

        // Otorisasi Member: hanya dapat membaca histori tugas miliknya
        if ($user && $user->role === 'member') {
            if ((int) $task->assignee_id !== (int) $user->id) {
                return response()->json([
                    'message' => 'Anda tidak memiliki hak akses ke histori tugas ini.',
                ], 403);
            }
        }

        // Otorisasi PM: hanya dapat membaca histori tugas pada proyek yang dipimpinnya atau ditugaskan kepadanya
        if ($user && $user->role === 'project_manager') {
            $isPic = $task->project && (int) $task->project->pic_id === (int) $user->id;
            $isAssignee = (int) $task->assignee_id === (int) $user->id;
            if (!$isPic && !$isAssignee) {
                return response()->json([
                    'message' => 'Anda tidak memiliki hak akses ke histori tugas ini.',
                ], 403);
            }
        }

        // Admin dan Pimpinan memiliki akses baca global

        $updates = $task->updates()
            ->with('user:id,name,role,email')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'task_id' => $task->id,
            'updates' => $updates,
        ]);
    }

    /**
     * Simpan progress update baru dari Member.
     */
    public function store(Request $request, $taskId)
    {
        $user = $request->user();
        $task = Task::with(['project', 'checklists'])->findOrFail($taskId);

        // Validasi otorisasi pembuatan laporan
        if ($user && $user->role === 'member') {
            if ((int) $task->assignee_id !== (int) $user->id) {
                return response()->json([
                    'message' => 'Anda hanya dapat membuat laporan pada tugas yang ditugaskan kepada Anda.',
                ], 403);
            }
        } elseif ($user && $user->role === 'project_manager') {
            $isPic = $task->project && (int) $task->project->pic_id === (int) $user->id;
            $isAssignee = (int) $task->assignee_id === (int) $user->id;
            if (!$isPic && !$isAssignee) {
                return response()->json([
                    'message' => 'Anda tidak memiliki hak akses untuk membuat laporan pada tugas ini.',
                ], 403);
            }
        } elseif (!$user || !in_array($user->role, ['admin', 'project_manager', 'member'])) {
            return response()->json([
                'message' => 'Anda tidak memiliki hak akses untuk membuat laporan.',
            ], 403);
        }

        $validated = $request->validate([
            'work_description' => ['required', 'string', 'min:3', 'max:2000'],
            'blocker' => ['nullable', 'string', 'max:1000'],
            'next_plan' => ['nullable', 'string', 'max:1000'],
            'attachment' => ['nullable', 'file', 'max:10240', 'mimes:pdf,doc,docx,xls,xlsx,png,jpg,jpeg,zip'],
        ], [
            'work_description.required' => 'Deskripsi pekerjaan wajib diisi.',
            'work_description.min' => 'Deskripsi pekerjaan minimal 3 karakter.',
            'attachment.max' => 'Ukuran lampiran maksimal 10 MB.',
            'attachment.mimes' => 'Format lampiran harus berupa dokumen atau gambar yang diizinkan (PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG, ZIP).',
        ]);

        $update = DB::transaction(function () use ($task, $user, $request, $validated) {
            // Hitung snapshot kondisi aktual saat ini
            $totalChecklists = $task->checklists()->count();
            $completedChecklists = $totalChecklists > 0
                ? $task->checklists()->where('is_completed', true)->count()
                : 0;

            $progressSnapshot = $totalChecklists > 0
                ? (int) round(($completedChecklists / $totalChecklists) * 100)
                : (int) ($task->progress ?? 0);

            $attachmentPath = null;
            $attachmentName = null;

            if ($request->hasFile('attachment')) {
                $file = $request->file('attachment');
                $attachmentName = $file->getClientOriginalName();
                $attachmentPath = $file->store('task-updates', 'local');
            }

            $record = TaskUpdate::create([
                'task_id' => $task->id,
                'user_id' => $user->id,
                'work_description' => trim($validated['work_description']),
                'completed_checklists' => $completedChecklists,
                'total_checklists' => $totalChecklists,
                'progress_snapshot' => $progressSnapshot,
                'blocker' => !empty($validated['blocker']) ? trim($validated['blocker']) : null,
                'next_plan' => !empty($validated['next_plan']) ? trim($validated['next_plan']) : null,
                'attachment_path' => $attachmentPath,
                'attachment_name' => $attachmentName,
            ]);

            // Catat log aktivitas sistem
            Activity::create([
                'user_name' => $user->name,
                'action' => 'mencatat progres pekerjaan',
                'target_name' => $task->title,
                'project_name' => $task->project->name ?? 'Proyek PKM',
                'avatar_color' => 'bg-[#FF2F92]',
            ]);

            return $record;
        });

        return response()->json([
            'message' => 'Progress update berhasil dicatat.',
            'update' => $update->load('user:id,name,role,email'),
        ], 201);
    }

    /**
     * Unduh lampiran progress update secara aman.
     */
    public function download(Request $request, $id)
    {
        $user = $request->user();
        $update = TaskUpdate::with('task.project')->findOrFail($id);
        $task = $update->task;

        // Otorisasi Member
        if ($user && $user->role === 'member') {
            if ((int) $task->assignee_id !== (int) $user->id) {
                return response()->json([
                    'message' => 'Anda tidak memiliki hak akses untuk mengunduh lampiran ini.',
                ], 403);
            }
        }

        // Otorisasi PM
        if ($user && $user->role === 'project_manager') {
            $isPic = $task->project && (int) $task->project->pic_id === (int) $user->id;
            $isAssignee = (int) $task->assignee_id === (int) $user->id;
            if (!$isPic && !$isAssignee) {
                return response()->json([
                    'message' => 'Anda tidak memiliki hak akses untuk mengunduh lampiran ini.',
                ], 403);
            }
        }

        if (!$update->attachment_path || !Storage::disk('local')->exists($update->attachment_path)) {
            return response()->json([
                'message' => 'File lampiran tidak ditemukan di penyimpanan server.',
            ], 404);
        }

        return Storage::disk('local')->download($update->attachment_path, $update->attachment_name ?: 'lampiran');
    }
}
