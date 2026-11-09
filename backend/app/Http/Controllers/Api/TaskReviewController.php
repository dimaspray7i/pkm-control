<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskReview;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TaskReviewController extends Controller
{
    /**
     * Ambil riwayat audit approval tugas (Approval History).
     */
    public function index(Request $request, $taskId)
    {
        $user = $request->user();
        $task = Task::with('project')->findOrFail($taskId);

        // Otorisasi Member: hanya tugas miliknya
        if ($user && $user->role === 'member') {
            if ((int) $task->assignee_id !== (int) $user->id) {
                return response()->json([
                    'message' => 'Anda tidak memiliki hak akses ke riwayat approval tugas ini.',
                ], 403);
            }
        }

        // Otorisasi PM: hanya tugas pada proyek binaannya atau ditugaskan kepadanya
        if ($user && $user->role === 'project_manager') {
            $isPic = $task->project && (int) $task->project->pic_id === (int) $user->id;
            $isAssignee = (int) $task->assignee_id === (int) $user->id;
            if (!$isPic && !$isAssignee) {
                return response()->json([
                    'message' => 'Anda tidak memiliki hak akses ke riwayat approval tugas ini.',
                ], 403);
            }
        }

        $reviews = $task->reviews()
            ->with('user:id,name,role,email')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'task_id' => $task->id,
            'reviews' => $reviews,
        ]);
    }

    /**
     * Ambil daftar tugas yang sedang menunggu peninjauan (in_review).
     */
    public function pending(Request $request)
    {
        $user = $request->user();
        $query = Task::with([
            'project:id,code,name,client,pic_id',
            'assignee:id,name,role,email',
            'checklists',
            'latestReview.user:id,name,role',
        ])->where('status', 'in_review');

        if ($user && $user->role === 'project_manager') {
            $query->whereHas('project', function ($pq) use ($user) {
                $pq->where('pic_id', $user->id);
            });
        } elseif ($user && $user->role === 'member') {
            $query->where('assignee_id', $user->id);
        }

        $tasks = $query->orderBy('updated_at', 'desc')->get();

        return response()->json([
            'tasks' => $tasks,
            'count' => $tasks->count(),
        ]);
    }

    /**
     * Member mengajukan penyelesaian tugas untuk direview PM (Submit for Review).
     */
    public function submit(Request $request, $taskId)
    {
        $user = $request->user();
        $task = Task::with(['project', 'checklists'])->findOrFail($taskId);

        // Otorisasi Member
        if ($user && $user->role === 'member') {
            if ((int) $task->assignee_id !== (int) $user->id) {
                return response()->json([
                    'message' => 'Anda hanya dapat mengajukan tugas yang ditugaskan kepada Anda.',
                ], 403);
            }
        } elseif (!$user || !in_array($user->role, ['admin', 'project_manager', 'member'])) {
            return response()->json([
                'message' => 'Anda tidak memiliki hak akses untuk mengajukan review tugas.',
            ], 403);
        }

        // Validasi status saat ini
        if ($task->status === 'in_review') {
            return response()->json([
                'message' => 'Tugas ini sudah dalam tahap peninjauan (in_review).',
            ], 422);
        }

        if (in_array($task->status, ['completed', 'done']) || $task->is_completed) {
            return response()->json([
                'message' => 'Tugas ini sudah selesai dan tidak dapat diajukan kembali tanpa reopen.',
            ], 422);
        }

        // Validasi checklist wajib 100%
        $stats = $task->getChecklistStats();
        if ($stats['total'] === 0 || $stats['completed'] < $stats['total'] || $stats['progress'] < 100) {
            return response()->json([
                'message' => 'Tugas hanya dapat diajukan untuk review jika seluruh checklist telah diselesaikan (100%).',
                'checklist_stats' => $stats,
            ], 422);
        }

        $notes = $request->input('notes');

        $result = DB::transaction(function () use ($taskId, $user, $notes) {
            $lockedTask = Task::where('id', $taskId)->lockForUpdate()->firstOrFail();

            if ($lockedTask->status === 'in_review') {
                abort(422, 'Tugas ini sudah dalam tahap peninjauan.');
            }

            $lastCycle = TaskReview::where('task_id', $lockedTask->id)->max('review_cycle') ?: 1;
            $oldStatus = $lockedTask->status;

            $lockedTask->status = 'in_review';
            $lockedTask->is_completed = false;
            $lockedTask->save();

            $review = TaskReview::create([
                'task_id' => $lockedTask->id,
                'user_id' => $user->id,
                'action' => 'submitted',
                'from_status' => $oldStatus,
                'to_status' => 'in_review',
                'notes' => !empty($notes) ? trim($notes) : 'Member mengajukan penyelesaian tugas.',
                'review_cycle' => $lastCycle,
            ]);

            Activity::create([
                'user_name' => $user->name,
                'action' => 'mengajukan review penyelesaian tugas',
                'target_name' => $lockedTask->title,
                'project_name' => $lockedTask->project->name ?? 'Proyek PKM',
                'avatar_color' => 'bg-[#FFD83D]',
            ]);

            return ['task' => $lockedTask, 'review' => $review];
        });

        return response()->json([
            'message' => 'Penyelesaian tugas berhasil diajukan! Tugas sekarang menunggu review dan persetujuan Project Manager.',
            'task' => $result['task'],
            'review' => $result['review']->load('user:id,name,role'),
        ]);
    }

    /**
     * PM menyetujui penyelesaian tugas (Approve).
     */
    public function approve(Request $request, $taskId)
    {
        $user = $request->user();
        $task = Task::with(['project', 'checklists'])->findOrFail($taskId);

        // Otorisasi role: Member & Pimpinan dilarang
        if ($user && $user->role === 'member') {
            return response()->json([
                'message' => 'Member tidak memiliki hak untuk menyetujui penyelesaian tugas.',
            ], 403);
        }

        if ($user && $user->role === 'pimpinan') {
            return response()->json([
                'message' => 'Pimpinan hanya memiliki hak akses pemantauan (view-only).',
            ], 403);
        }

        // PM hanya pada proyek miliknya
        if ($user && $user->role === 'project_manager') {
            if (!$task->project || (int) $task->project->pic_id !== (int) $user->id) {
                return response()->json([
                    'message' => 'Anda hanya dapat menyetujui tugas pada proyek yang Anda pimpin.',
                ], 403);
            }
        }

        // Validasi status peninjauan
        if ($task->status !== 'in_review') {
            return response()->json([
                'message' => 'Hanya tugas dengan status peninjauan (in_review) yang dapat disetujui.',
            ], 422);
        }

        // Validasi checklist masih 100%
        $stats = $task->getChecklistStats();
        if ($stats['total'] === 0 || $stats['completed'] < $stats['total'] || $stats['progress'] < 100) {
            return response()->json([
                'message' => 'Checklist tugas belum 100% selesai.',
            ], 422);
        }

        $notes = $request->input('notes');

        $result = DB::transaction(function () use ($taskId, $user, $notes) {
            $lockedTask = Task::where('id', $taskId)->lockForUpdate()->firstOrFail();

            if ($lockedTask->status !== 'in_review') {
                abort(422, 'Tugas tidak lagi dalam status peninjauan.');
            }

            $lastCycle = TaskReview::where('task_id', $lockedTask->id)->max('review_cycle') ?: 1;

            $lockedTask->status = 'done';
            $lockedTask->is_completed = true;
            $lockedTask->save();

            // Hitung ulang progres proyek dan sprint/milestone
            $projectProgress = Project::recalculateProgressFor($lockedTask->project_id);
            if ($lockedTask->milestone_id) {
                Milestone::recalculateProgressFor($lockedTask->milestone_id);
            }

            $review = TaskReview::create([
                'task_id' => $lockedTask->id,
                'user_id' => $user->id,
                'action' => 'approved',
                'from_status' => 'in_review',
                'to_status' => 'done',
                'notes' => !empty($notes) ? trim($notes) : 'Disetujui oleh Project Manager.',
                'review_cycle' => $lastCycle,
            ]);

            Activity::create([
                'user_name' => $user->name,
                'action' => 'menyetujui penyelesaian tugas (Done)',
                'target_name' => $lockedTask->title,
                'project_name' => $lockedTask->project->name ?? 'Proyek PKM',
                'avatar_color' => 'bg-[#10B981]',
            ]);

            return [
                'task' => $lockedTask,
                'review' => $review,
                'project_progress' => $projectProgress,
            ];
        });

        return response()->json([
            'message' => 'Tugas berhasil disetujui dan ditandai sebagai Done!',
            'task' => $result['task'],
            'project_progress' => $result['project_progress'],
            'review' => $result['review']->load('user:id,name,role'),
        ]);
    }

    /**
     * PM meminta revisi pekerjaan (Request Revision).
     */
    public function requestRevision(Request $request, $taskId)
    {
        $user = $request->user();
        $task = Task::with('project')->findOrFail($taskId);

        // Otorisasi role: Member & Pimpinan dilarang
        if ($user && $user->role === 'member') {
            return response()->json([
                'message' => 'Member tidak memiliki hak untuk meminta revisi tugas.',
            ], 403);
        }

        if ($user && $user->role === 'pimpinan') {
            return response()->json([
                'message' => 'Pimpinan hanya memiliki hak akses pemantauan (view-only).',
            ], 403);
        }

        // PM hanya pada proyek miliknya
        if ($user && $user->role === 'project_manager') {
            if (!$task->project || (int) $task->project->pic_id !== (int) $user->id) {
                return response()->json([
                    'message' => 'Anda hanya dapat meminta revisi tugas pada proyek yang Anda pimpin.',
                ], 403);
            }
        }

        if ($task->status !== 'in_review') {
            return response()->json([
                'message' => 'Hanya tugas dengan status peninjauan (in_review) yang dapat diminta revisi.',
            ], 422);
        }

        // Alasan revisi wajib diisi
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:3', 'max:2000'],
        ], [
            'reason.required' => 'Alasan revisi wajib diisi.',
            'reason.min' => 'Alasan revisi minimal 3 karakter.',
        ]);

        $reason = trim($validated['reason']);

        $result = DB::transaction(function () use ($taskId, $user, $reason) {
            $lockedTask = Task::where('id', $taskId)->lockForUpdate()->firstOrFail();

            if ($lockedTask->status !== 'in_review') {
                abort(422, 'Tugas tidak lagi dalam status peninjauan.');
            }

            $lastCycle = TaskReview::where('task_id', $lockedTask->id)->max('review_cycle') ?: 1;

            $lockedTask->status = 'in_progress';
            $lockedTask->is_completed = false;
            $lockedTask->save();

            $review = TaskReview::create([
                'task_id' => $lockedTask->id,
                'user_id' => $user->id,
                'action' => 'revision_requested',
                'from_status' => 'in_review',
                'to_status' => 'in_progress',
                'notes' => $reason,
                'review_cycle' => $lastCycle,
            ]);

            Activity::create([
                'user_name' => $user->name,
                'action' => 'meminta revisi tugas',
                'target_name' => $lockedTask->title,
                'project_name' => $lockedTask->project->name ?? 'Proyek PKM',
                'avatar_color' => 'bg-[#FF5722]',
            ]);

            return ['task' => $lockedTask, 'review' => $review];
        });

        return response()->json([
            'message' => 'Permintaan revisi berhasil dikirim ke Member.',
            'task' => $result['task'],
            'review' => $result['review']->load('user:id,name,role'),
        ]);
    }

    /**
     * PM membuka kembali tugas yang sudah selesai (Reopen Completed Task).
     */
    public function reopen(Request $request, $taskId)
    {
        $user = $request->user();
        $task = Task::with('project')->findOrFail($taskId);

        // Otorisasi role: Member & Pimpinan dilarang
        if ($user && $user->role === 'member') {
            return response()->json([
                'message' => 'Member tidak memiliki hak untuk membuka kembali tugas.',
            ], 403);
        }

        if ($user && $user->role === 'pimpinan') {
            return response()->json([
                'message' => 'Pimpinan hanya memiliki hak akses pemantauan (view-only).',
            ], 403);
        }

        // PM hanya pada proyek miliknya
        if ($user && $user->role === 'project_manager') {
            if (!$task->project || (int) $task->project->pic_id !== (int) $user->id) {
                return response()->json([
                    'message' => 'Anda hanya dapat membuka kembali tugas pada proyek yang Anda pimpin.',
                ], 403);
            }
        }

        if (!in_array($task->status, ['completed', 'done']) && !$task->is_completed) {
            return response()->json([
                'message' => 'Hanya tugas yang sudah selesai (done) yang dapat dibuka kembali.',
            ], 422);
        }

        // Alasan reopen wajib diisi
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:3', 'max:2000'],
        ], [
            'reason.required' => 'Alasan membuka kembali tugas (reopen) wajib diisi.',
            'reason.min' => 'Alasan membuka kembali tugas minimal 3 karakter.',
        ]);

        $reason = trim($validated['reason']);

        $result = DB::transaction(function () use ($taskId, $user, $reason) {
            $lockedTask = Task::where('id', $taskId)->lockForUpdate()->firstOrFail();

            if (!in_array($lockedTask->status, ['completed', 'done']) && !$lockedTask->is_completed) {
                abort(422, 'Tugas belum berstatus selesai.');
            }

            $lastCycle = TaskReview::where('task_id', $lockedTask->id)->max('review_cycle') ?: 1;

            $lockedTask->status = 'in_progress';
            $lockedTask->is_completed = false;
            $lockedTask->save();

            // Hitung ulang progres proyek & milestone setelah task di-reopen
            $projectProgress = Project::recalculateProgressFor($lockedTask->project_id);
            if ($lockedTask->milestone_id) {
                Milestone::recalculateProgressFor($lockedTask->milestone_id);
            }

            $review = TaskReview::create([
                'task_id' => $lockedTask->id,
                'user_id' => $user->id,
                'action' => 'reopened',
                'from_status' => 'done',
                'to_status' => 'in_progress',
                'notes' => $reason,
                'review_cycle' => $lastCycle + 1,
            ]);

            Activity::create([
                'user_name' => $user->name,
                'action' => 'membuka kembali tugas (reopen)',
                'target_name' => $lockedTask->title,
                'project_name' => $lockedTask->project->name ?? 'Proyek PKM',
                'avatar_color' => 'bg-[#FF2F92]',
            ]);

            return [
                'task' => $lockedTask,
                'review' => $review,
                'project_progress' => $projectProgress,
            ];
        });

        return response()->json([
            'message' => 'Tugas berhasil dibuka kembali (in_progress).',
            'task' => $result['task'],
            'project_progress' => $result['project_progress'],
            'review' => $result['review']->load('user:id,name,role'),
        ]);
    }
}
