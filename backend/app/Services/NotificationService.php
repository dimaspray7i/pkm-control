<?php

namespace App\Services;

use App\Models\Task;
use App\Models\User;
use App\Models\UserNotification;
use Carbon\Carbon;

class NotificationService
{
    /**
     * Notifikasi saat tugas baru ditugaskan ke Member
     */
    public static function notifyTaskAssigned(Task $task, ?User $actor = null): ?UserNotification
    {
        if (!$task->assignee_id) {
            return null;
        }

        // Hindari duplikasi jika notifikasi serupa sudah dibuat dalam 5 menit terakhir untuk task_id yang sama
        $existing = UserNotification::where('user_id', $task->assignee_id)
            ->where('task_id', $task->id)
            ->where('type', 'task_assigned')
            ->where('created_at', '>=', now()->subMinutes(5))
            ->first();

        if ($existing) {
            return $existing;
        }

        $projectName = $task->project?->name ?? 'Proyek PKM';
        $projectCode = $task->project?->code ?? '';
        $deadlineStr = $task->deadline ? Carbon::parse($task->deadline)->format('d M Y') : 'Tidak ditentukan';

        return UserNotification::create([
            'user_id'    => $task->assignee_id,
            'actor_id'   => $actor?->id ?? $task->creator_id,
            'task_id'    => $task->id,
            'project_id' => $task->project_id,
            'type'       => 'task_assigned',
            'title'      => 'Tugas Baru Diberikan: ' . $task->title,
            'message'    => "Project Manager menugaskan tugas '{$task->title}' pada proyek {$projectName} ({$projectCode}). Tenggat waktu: {$deadlineStr}.",
            'data'       => [
                'task_title'   => $task->title,
                'project_name' => $projectName,
                'project_code' => $projectCode,
                'priority'     => $task->priority,
                'deadline'     => $task->deadline ? Carbon::parse($task->deadline)->toDateString() : null,
                'actor_name'   => $actor?->name ?? 'Project Manager',
            ],
            'is_read'    => false,
        ]);
    }

    /**
     * Notifikasi saat PM menyetujui tugas (Approval)
     */
    public static function notifyReviewApproved(Task $task, User $actor, ?string $notes = null): ?UserNotification
    {
        if (!$task->assignee_id) {
            return null;
        }

        $projectName = $task->project?->name ?? 'Proyek PKM';
        $noteSnippet = $notes ? ": \"{$notes}\"" : '.';

        return UserNotification::create([
            'user_id'    => $task->assignee_id,
            'actor_id'   => $actor->id,
            'task_id'    => $task->id,
            'project_id' => $task->project_id,
            'type'       => 'review_approved',
            'title'      => 'Tugas Disetujui: ' . $task->title,
            'message'    => "Pekerjaan Anda pada '{$task->title}' telah disetujui oleh {$actor->name}{$noteSnippet}",
            'data'       => [
                'task_title'   => $task->title,
                'project_name' => $projectName,
                'project_code' => $task->project?->code ?? '',
                'approval_notes' => $notes,
                'actor_name'   => $actor->name,
                'status'       => 'done',
            ],
            'is_read'    => false,
        ]);
    }

    /**
     * Notifikasi saat PM meminta revisi pekerjaan
     */
    public static function notifyReviewRevision(Task $task, User $actor, string $notes): ?UserNotification
    {
        if (!$task->assignee_id) {
            return null;
        }

        $projectName = $task->project?->name ?? 'Proyek PKM';

        return UserNotification::create([
            'user_id'    => $task->assignee_id,
            'actor_id'   => $actor->id,
            'task_id'    => $task->id,
            'project_id' => $task->project_id,
            'type'       => 'review_revision',
            'title'      => 'Permintaan Revisi: ' . $task->title,
            'message'    => "PM {$actor->name} meminta revisi pada tugas '{$task->title}'. Catatan: \"{$notes}\"",
            'data'       => [
                'task_title'     => $task->title,
                'project_name'   => $projectName,
                'project_code'   => $task->project?->code ?? '',
                'revision_notes' => $notes,
                'actor_name'     => $actor->name,
                'status'         => 'in_progress',
            ],
            'is_read'    => false,
        ]);
    }

    /**
     * Notifikasi saat PM membuka kembali tugas yang sudah selesai (Reopen)
     */
    public static function notifyTaskReopened(Task $task, User $actor, ?string $reason = null): ?UserNotification
    {
        if (!$task->assignee_id) {
            return null;
        }

        $projectName = $task->project?->name ?? 'Proyek PKM';
        $reasonSnippet = $reason ? ": \"{$reason}\"" : '.';

        return UserNotification::create([
            'user_id'    => $task->assignee_id,
            'actor_id'   => $actor->id,
            'task_id'    => $task->id,
            'project_id' => $task->project_id,
            'type'       => 'task_reopened',
            'title'      => 'Tugas Dibuka Kembali: ' . $task->title,
            'message'    => "Tugas '{$task->title}' telah dibuka kembali oleh PM {$actor->name}{$reasonSnippet}",
            'data'       => [
                'task_title'   => $task->title,
                'project_name' => $projectName,
                'project_code' => $task->project?->code ?? '',
                'reopen_reason'=> $reason,
                'actor_name'   => $actor->name,
                'status'       => 'in_progress',
            ],
            'is_read'    => false,
        ]);
    }

    /**
     * Generate & Sync Deadline Reminders secara on-demand & aman
     * Memeriksa seluruh tugas aktif milik user (atau spesifik user) yang mendekati deadline,
     * deadline hari ini, atau terlambat. Bersifat Idempotent (1 notif per task per tipe per hari).
     */
    public static function syncDeadlineRemindersForUser(int $userId): int
    {
        $now = Carbon::now('Asia/Jakarta');
        $todayStr = $now->toDateString();
        $in3DaysStr = (clone $now)->addDays(3)->toDateString();

        // Cari tugas aktif milik member (bukan completed / done)
        $tasks = Task::with('project')
            ->where('assignee_id', $userId)
            ->where('is_completed', false)
            ->whereNotIn('status', ['completed', 'done'])
            ->whereNotNull('deadline')
            ->get();

        $generatedCount = 0;

        foreach ($tasks as $task) {
            $deadline = Carbon::parse($task->deadline)->toDateString();
            $type = null;
            $title = null;
            $message = null;

            if ($deadline < $todayStr) {
                $type = 'deadline_overdue';
                $diff = Carbon::parse($todayStr)->diffInDays(Carbon::parse($deadline));
                $title = 'Peringatan Terlambat: ' . $task->title;
                $message = "Tugas '{$task->title}' telah melewati batas waktu {$diff} hari yang lalu (Deadline: " . Carbon::parse($deadline)->format('d M Y') . "). Segera lakukan penyelesaian.";
            } elseif ($deadline === $todayStr) {
                $type = 'deadline_today';
                $title = 'Jatuh Tempo Hari Ini: ' . $task->title;
                $message = "Tugas '{$task->title}' jatuh tempo hari ini. Pastikan seluruh butir checklist selesai dan ajukan review ke PM.";
            } elseif ($deadline > $todayStr && $deadline <= $in3DaysStr) {
                $type = 'deadline_near';
                $diff = Carbon::parse($todayStr)->diffInDays(Carbon::parse($deadline));
                $title = 'Mendekati Deadline: ' . $task->title;
                $message = "Tugas '{$task->title}' akan jatuh tempo dalam {$diff} hari (Deadline: " . Carbon::parse($deadline)->format('d M Y') . ").";
            }

            if ($type) {
                // Idempotensi: Jangan buat duplikat jika notifikasi tipe yang sama sudah dibuat hari ini untuk task ini
                $alreadyExists = UserNotification::where('user_id', $userId)
                    ->where('task_id', $task->id)
                    ->where('type', $type)
                    ->whereDate('created_at', $todayStr)
                    ->exists();

                if (!$alreadyExists) {
                    UserNotification::create([
                        'user_id'    => $userId,
                        'task_id'    => $task->id,
                        'project_id' => $task->project_id,
                        'type'       => $type,
                        'title'      => $title,
                        'message'    => $message,
                        'data'       => [
                            'task_title'   => $task->title,
                            'project_name' => $task->project?->name ?? 'Proyek PKM',
                            'project_code' => $task->project?->code ?? '',
                            'priority'     => $task->priority,
                            'deadline'     => $deadline,
                        ],
                        'is_read'    => false,
                    ]);
                    $generatedCount++;
                }
            }
        }

        return $generatedCount;
    }

    /**
     * Notifikasi saat PM memberikan feedback pengembangan diri kepada Member (Tahap M-D)
     */
    public static function notifyDevelopmentFeedback($feedback, User $reviewer): ?UserNotification
    {
        $preview = \Illuminate\Support\Str::limit($feedback->feedback, 120);

        return UserNotification::create([
            'user_id'    => $feedback->user_id,
            'actor_id'   => $reviewer->id,
            'type'       => 'development_feedback',
            'title'      => 'Feedback Pengembangan dari ' . $reviewer->name,
            'message'    => "{$reviewer->name} memberikan arahan pengembangan diri: \"{$preview}\"",
            'data'       => [
                'feedback_id' => $feedback->id,
                'goal_id'     => $feedback->goal_id,
                'reviewer'    => $reviewer->name,
            ],
            'is_read'    => false,
        ]);
    }
}
