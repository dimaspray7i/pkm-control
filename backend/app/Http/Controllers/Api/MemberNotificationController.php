<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserNotification;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class MemberNotificationController extends Controller
{
    /**
     * GET /api/member/notifications
     *
     * Daftar notifikasi milik member dengan filter, pencarian, dan pagination.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->role !== 'member') {
            return response()->json([
                'message' => 'Endpoint ini hanya tersedia untuk anggota tim (member).',
            ], 403);
        }

        // Sinkronkan deadline reminders harian secara otomatis & idempotent
        NotificationService::syncDeadlineRemindersForUser($user->id);

        $query = UserNotification::with([
            'task:id,title,project_id,deadline,priority,status,is_completed',
            'task.project:id,name,code',
            'actor:id,name,role',
        ])->where('user_id', $user->id);

        // Filter: Status Read / Unread
        if ($request->filled('filter')) {
            $f = $request->filter;
            if ($f === 'unread') {
                $query->where('is_read', false);
            } elseif ($f === 'read') {
                $query->where('is_read', true);
            } elseif ($f === 'task') {
                $query->where('type', 'task_assigned');
            } elseif ($f === 'deadline') {
                $query->whereIn('type', ['deadline_near', 'deadline_today', 'deadline_overdue']);
            } elseif ($f === 'approval') {
                $query->where('type', 'review_approved');
            } elseif ($f === 'revision') {
                $query->where('type', 'review_revision');
            } elseif ($f === 'reopen') {
                $query->where('type', 'task_reopened');
            }
        }

        // Filter Kategori Khusus (category param)
        if ($request->filled('category') && $request->category !== 'all') {
            $cat = $request->category;
            if ($cat === 'task') {
                $query->where('type', 'task_assigned');
            } elseif ($cat === 'deadline') {
                $query->whereIn('type', ['deadline_near', 'deadline_today', 'deadline_overdue']);
            } elseif ($cat === 'approval') {
                $query->where('type', 'review_approved');
            } elseif ($cat === 'revision') {
                $query->where('type', 'review_revision');
            } elseif ($cat === 'work_progress') {
                $query->whereIn('type', ['task_reopened', 'work_progress']);
            }
        }

        // Pencarian (Search Query)
        if ($request->filled('search')) {
            $s = trim($request->search);
            $query->where(function ($q) use ($s) {
                $q->where('title', 'like', "%{$s}%")
                  ->orWhere('message', 'like', "%{$s}%")
                  ->orWhereHas('task', function ($tq) use ($s) {
                      $tq->where('title', 'like', "%{$s}%")
                         ->orWhereHas('project', function ($pq) use ($s) {
                             $pq->where('name', 'like', "%{$s}%")
                                ->orWhere('code', 'like', "%{$s}%");
                         });
                  });
            });
        }

        // Pengurutan
        $sortOrder = $request->get('sort', 'desc') === 'asc' ? 'asc' : 'desc';
        $query->orderBy('created_at', $sortOrder);

        $perPage = min(max((int) $request->get('per_page', 15), 5), 50);
        $notifications = $query->paginate($perPage);

        // Transform respons dengan pengelompokan waktu Indonesia (Hari ini, Kemarin, Minggu ini, Sebelumnya)
        $now = Carbon::now('Asia/Jakarta');
        $todayStr = $now->toDateString();
        $yesterdayStr = (clone $now)->subDay()->toDateString();
        $startOfWeekStr = (clone $now)->startOfWeek()->toDateString();

        $transformed = $notifications->getCollection()->map(function ($n) use ($todayStr, $yesterdayStr, $startOfWeekStr) {
            $created = $n->created_at ? Carbon::parse($n->created_at)->timezone('Asia/Jakarta') : null;
            $createdDate = $created ? $created->toDateString() : null;

            if ($createdDate === $todayStr) {
                $timeGroup = 'Hari Ini';
            } elseif ($createdDate === $yesterdayStr) {
                $timeGroup = 'Kemarin';
            } elseif ($createdDate >= $startOfWeekStr) {
                $timeGroup = 'Minggu Ini';
            } else {
                $timeGroup = 'Sebelumnya';
            }

            return [
                'id'            => $n->id,
                'user_id'       => $n->user_id,
                'type'          => $n->type,
                'title'         => $n->title,
                'message'       => $n->message,
                'task_id'       => $n->task_id,
                'project_id'    => $n->project_id,
                'task_title'    => $n->task?->title,
                'project_name'  => $n->task?->project?->name ?? $n->project?->name,
                'project_code'  => $n->task?->project?->code ?? $n->project?->code,
                'actor_name'    => $n->actor?->name ?? 'Project Manager',
                'actor_role'    => $n->actor?->role,
                'data'          => $n->data,
                'is_read'       => (bool) $n->is_read,
                'read_at'       => $n->read_at ? Carbon::parse($n->read_at)->toDateTimeString() : null,
                'created_at'    => $created ? $created->toDateTimeString() : null,
                'created_at_fmt'=> $created ? $created->format('d M Y, H:i') . ' WIB' : '—',
                'time_ago'      => $created ? $created->diffForHumans() : 'baru saja',
                'time_group'    => $timeGroup,
            ];
        });

        return response()->json([
            'notifications' => $transformed,
            'pagination'    => [
                'current_page' => $notifications->currentPage(),
                'last_page'    => $notifications->lastPage(),
                'per_page'     => $notifications->perPage(),
                'total'        => $notifications->total(),
            ],
            'unread_count'  => UserNotification::where('user_id', $user->id)->where('is_read', false)->count(),
        ]);
    }

    /**
     * GET /api/member/notifications/summary
     *
     * Ringkasan metrik notifikasi personal.
     */
    public function summary(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->role !== 'member') {
            return response()->json([
                'message' => 'Endpoint ini hanya tersedia untuk anggota tim (member).',
            ], 403);
        }

        // Sinkronkan deadline reminders
        NotificationService::syncDeadlineRemindersForUser($user->id);

        $base = UserNotification::where('user_id', $user->id);

        $total = (clone $base)->count();
        $unread = (clone $base)->where('is_read', false)->count();
        $taskCount = (clone $base)->where('type', 'task_assigned')->count();
        $approvalRevisionCount = (clone $base)->whereIn('type', ['review_approved', 'review_revision', 'task_reopened'])->count();
        $deadlineCount = (clone $base)->whereIn('type', ['deadline_near', 'deadline_today', 'deadline_overdue'])->count();

        return response()->json([
            'total'               => $total,
            'unread'              => $unread,
            'task_notifications'  => $taskCount,
            'approval_revision'   => $approvalRevisionCount,
            'deadline_reminders'  => $deadlineCount,
        ]);
    }

    /**
     * PATCH /api/member/notifications/{id}/read
     *
     * Tandai notifikasi sebagai sudah dibaca.
     */
    public function markAsRead(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->role !== 'member') {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $notification = UserNotification::where('user_id', $user->id)->findOrFail($id);
        $notification->markAsRead();

        return response()->json([
            'success'      => true,
            'message'      => 'Notifikasi ditandai sebagai sudah dibaca.',
            'notification' => [
                'id'      => $notification->id,
                'is_read' => true,
                'read_at' => $notification->read_at?->toDateTimeString(),
            ],
            'unread_count' => UserNotification::where('user_id', $user->id)->where('is_read', false)->count(),
        ]);
    }

    /**
     * PATCH /api/member/notifications/{id}/unread
     *
     * Tandai notifikasi sebagai belum dibaca.
     */
    public function markAsUnread(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->role !== 'member') {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $notification = UserNotification::where('user_id', $user->id)->findOrFail($id);
        $notification->markAsUnread();

        return response()->json([
            'success'      => true,
            'message'      => 'Notifikasi ditandai sebagai belum dibaca.',
            'notification' => [
                'id'      => $notification->id,
                'is_read' => false,
                'read_at' => null,
            ],
            'unread_count' => UserNotification::where('user_id', $user->id)->where('is_read', false)->count(),
        ]);
    }

    /**
     * POST /api/member/notifications/read-all
     *
     * Tandai seluruh notifikasi milik member sebagai sudah dibaca.
     */
    public function markAllAsRead(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->role !== 'member') {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $updatedCount = UserNotification::where('user_id', $user->id)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => now(),
            ]);

        return response()->json([
            'success'       => true,
            'message'       => "{$updatedCount} notifikasi berhasil ditandai sebagai sudah dibaca.",
            'updated_count' => $updatedCount,
            'unread_count'  => 0,
        ]);
    }

    /**
     * DELETE /api/member/notifications/{id}
     *
     * Hapus notifikasi milik sendiri.
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || $user->role !== 'member') {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $notification = UserNotification::where('user_id', $user->id)->findOrFail($id);
        $notification->delete();

        return response()->json([
            'success'      => true,
            'message'      => 'Notifikasi berhasil dihapus.',
            'unread_count' => UserNotification::where('user_id', $user->id)->where('is_read', false)->count(),
        ]);
    }
}
