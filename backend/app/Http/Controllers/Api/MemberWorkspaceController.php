<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Task;
use App\Models\TaskReview;
use App\Models\TaskUpdate;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MemberWorkspaceController extends Controller
{
    /**
     * GET /api/member/workspace
     *
     * Mengembalikan data workspace pribadi member secara teragregasi:
     * - Metrik ringkasan kerja pribadi (summary)
     * - Tugas prioritas saat ini (priority_tasks)
     * - Statistik progres personal (personal_progress)
     * - Aktivitas terkini pribadi (recent_activities)
     * - Histori semua laporan progres (all_updates)
     * - Arsip riwayat pekerjaan selesai (completed_history)
     */
    public function index(Request $request)
    {
        $user = $request->user();

        // Guard: hanya untuk role member
        if (!$user || $user->role !== 'member') {
            return response()->json([
                'message' => 'Endpoint ini hanya tersedia untuk anggota tim (member).',
            ], 403);
        }

        $userId = $user->id;
        $today  = Carbon::now()->toDateString();
        $driver = DB::connection()->getDriverName();

        // ----------------------------------------------------------------
        // 1. Ringkasan Metrik Kerja Pribadi
        // ----------------------------------------------------------------
        $baseQuery = Task::where('assignee_id', $userId);

        $summary = [
            'total'      => (clone $baseQuery)->count(),
            'todo'       => (clone $baseQuery)->whereIn('status', ['pending', 'todo'])->where('is_completed', false)->count(),
            'in_progress'=> (clone $baseQuery)->where('status', 'in_progress')->where('is_completed', false)->count(),
            'in_review'  => (clone $baseQuery)->where('status', 'in_review')->where('is_completed', false)->count(),
            'done'       => (clone $baseQuery)->where(function ($q) {
                $q->where('status', 'completed')->orWhere('is_completed', true);
            })->count(),
            'overdue'    => (clone $baseQuery)->where('is_completed', false)
                ->whereNotNull('deadline')
                ->where('deadline', '<', $today)
                ->count(),
        ];

        // ----------------------------------------------------------------
        // 2. Tugas Prioritas Saat Ini (Urgent & High yang belum selesai)
        // ----------------------------------------------------------------
        $priorityOrder = $driver === 'mysql'
            ? "FIELD(priority, 'urgent', 'high', 'medium', 'low')"
            : "CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END";

        $priorityTasks = Task::with([
                'project:id,code,name,client,status',
                'checklists',
                'latestReview:id,task_id,action,notes,created_at',
            ])
            ->where('assignee_id', $userId)
            ->where('is_completed', false)
            ->whereNotIn('status', ['completed', 'done'])
            ->orderByRaw($priorityOrder)
            ->orderByRaw("CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline ASC")
            ->limit(10)
            ->get()
            ->map(function ($task) use ($today) {
                $checklists  = $task->checklists;
                $chkTotal    = $checklists->count();
                $chkDone     = $chkTotal > 0 ? $checklists->where('is_completed', true)->count() : 0;
                $chkProgress = $chkTotal > 0 ? (int) round(($chkDone / $chkTotal) * 100) : 0;

                $isOverdue = !$task->is_completed && $task->deadline
                    && $task->deadline->toDateString() < $today;

                return [
                    'id'                 => $task->id,
                    'title'              => $task->title,
                    'description'        => $task->description,
                    'priority'           => $task->priority,
                    'status'             => $task->status,
                    'deadline'           => $task->deadline ? $task->deadline->toDateString() : null,
                    'is_overdue'         => $isOverdue,
                    'checklist_total'    => $chkTotal,
                    'checklist_completed'=> $chkDone,
                    'checklist_progress' => $chkProgress,
                    'project'            => $task->project ? [
                        'id'   => $task->project->id,
                        'code' => $task->project->code,
                        'name' => $task->project->name,
                    ] : null,
                    'latest_review_action' => $task->latestReview?->action,
                    'revision_notes'       => $task->latestReview?->action === 'revision_requested'
                        ? $task->latestReview?->notes
                        : null,
                ];
            });

        // ----------------------------------------------------------------
        // 3. Statistik Progres Personal
        // ----------------------------------------------------------------
        $totalTasks      = $summary['total'];
        $completedTasks  = $summary['done'];
        $completionRate  = $totalTasks > 0 ? (int) round(($completedTasks / $totalTasks) * 100) : 0;

        // Hitung total checklist items untuk member
        $allTaskIds = Task::where('assignee_id', $userId)->pluck('id');
        $totalChecklists     = \App\Models\TaskChecklist::whereIn('task_id', $allTaskIds)->count();
        $completedChecklists = \App\Models\TaskChecklist::whereIn('task_id', $allTaskIds)->where('is_completed', true)->count();
        $checklistRate       = $totalChecklists > 0 ? (int) round(($completedChecklists / $totalChecklists) * 100) : 0;

        // Tren produktivitas 7 hari: tugas selesai per hari berdasarkan DB
        $weeklyTrend = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = Carbon::now()->subDays($i);
            $dayLabel = $day->translatedFormat('d M');
            // Hitung tugas yang disubmit/diupdate hari itu
            $dailyUpdates = TaskUpdate::whereHas('task', function ($q) use ($userId) {
                    $q->where('assignee_id', $userId);
                })
                ->whereDate('created_at', $day->toDateString())
                ->count();

            $weeklyTrend[] = [
                'date'    => $dayLabel,
                'updates' => $dailyUpdates,
            ];
        }

        $personal_progress = [
            'completion_rate'       => $completionRate,
            'completed_tasks'       => $completedTasks,
            'total_tasks'           => $totalTasks,
            'checklist_rate'        => $checklistRate,
            'completed_checklists'  => $completedChecklists,
            'total_checklists'      => $totalChecklists,
            'weekly_trend'          => $weeklyTrend,
        ];

        // ----------------------------------------------------------------
        // 4. Aktivitas Terkini Pribadi (dari Activity log + TaskReviews)
        // ----------------------------------------------------------------
        // Ambil activity log untuk user yang bersangkutan (task updates & review submissions)
        $recentActivities = Activity::where('user_name', $user->name)
            ->orderBy('created_at', 'desc')
            ->limit(15)
            ->get()
            ->map(function ($act) {
                return [
                    'id'           => $act->id,
                    'user_name'    => $act->user_name,
                    'action'       => $act->action,
                    'target_name'  => $act->target_name,
                    'project_name' => $act->project_name,
                    'avatar_color' => $act->avatar_color ?: '#FF2F92',
                    'time_ago'     => $act->created_at ? $act->created_at->diffForHumans() : 'baru saja',
                    'created_at'   => $act->created_at ? $act->created_at->toDateTimeString() : null,
                ];
            });

        // Tambahkan: notifikasi revisi & approval yang diterima member dari PM
        $pmReviews = TaskReview::with(['task:id,title,project_id', 'task.project:id,name', 'user:id,name,role'])
            ->whereHas('task', function ($q) use ($userId) {
                $q->where('assignee_id', $userId);
            })
            ->whereIn('action', ['revision_requested', 'approved'])
            ->where('user_id', '!=', $userId) // hanya dari PM/admin
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get()
            ->map(function ($review) {
                $actionLabel = $review->action === 'approved'
                    ? 'menyetujui penyelesaian tugas Anda'
                    : 'meminta revisi pada tugas Anda';

                return [
                    'id'           => 'review_' . $review->id,
                    'user_name'    => $review->user?->name ?? 'Project Manager',
                    'action'       => $actionLabel,
                    'target_name'  => $review->task?->title ?? '',
                    'project_name' => $review->task?->project?->name ?? 'Proyek PKM',
                    'avatar_color' => $review->action === 'approved' ? '#10B981' : '#FF5722',
                    'notes'        => $review->notes,
                    'time_ago'     => $review->created_at ? $review->created_at->diffForHumans() : 'baru saja',
                    'created_at'   => $review->created_at ? $review->created_at->toDateTimeString() : null,
                    'type'         => $review->action,
                ];
            });

        // ----------------------------------------------------------------
        // 5. Semua Laporan Progres Kerja (semua task_updates milik member)
        // ----------------------------------------------------------------
        $allUpdates = TaskUpdate::with([
                'task:id,title,project_id,status,is_completed',
                'task.project:id,name,code',
            ])
            ->where('user_id', $userId)
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get()
            ->map(function ($update) {
                return [
                    'id'                   => $update->id,
                    'task_id'              => $update->task_id,
                    'task_title'           => $update->task?->title ?? '',
                    'project_name'         => $update->task?->project?->name ?? '',
                    'project_code'         => $update->task?->project?->code ?? '',
                    'work_description'     => $update->work_description,
                    'progress_snapshot'    => $update->progress_snapshot,
                    'completed_checklists' => $update->completed_checklists,
                    'total_checklists'     => $update->total_checklists,
                    'blocker'              => $update->blocker,
                    'next_plan'            => $update->next_plan,
                    'has_attachment'       => !empty($update->attachment_path),
                    'attachment_name'      => $update->attachment_name,
                    'attachment_id'        => $update->id,
                    'created_at'           => $update->created_at ? $update->created_at->toDateTimeString() : null,
                    'time_ago'             => $update->created_at ? $update->created_at->diffForHumans() : 'baru saja',
                ];
            });

        // ----------------------------------------------------------------
        // 6. Riwayat Pekerjaan Selesai & Disetujui PM
        // ----------------------------------------------------------------
        $completedHistory = Task::with([
                'project:id,name,code,client',
                'reviews' => function ($q) {
                    $q->whereIn('action', ['approved', 'revision_requested'])
                      ->with('user:id,name,role')
                      ->orderBy('created_at', 'desc');
                },
            ])
            ->where('assignee_id', $userId)
            ->where(function ($q) {
                $q->where('status', 'completed')
                  ->orWhere('is_completed', true);
            })
            ->orderBy('updated_at', 'desc')
            ->limit(30)
            ->get()
            ->map(function ($task) {
                $approvedReview   = $task->reviews->firstWhere('action', 'approved');
                $revisionCount    = $task->reviews->where('action', 'revision_requested')->count();

                $chkStats = $task->getChecklistStats();

                return [
                    'id'               => $task->id,
                    'title'            => $task->title,
                    'priority'         => $task->priority,
                    'deadline'         => $task->deadline ? $task->deadline->toDateString() : null,
                    'completed_at'     => $task->updated_at ? $task->updated_at->toDateTimeString() : null,
                    'completed_at_ago' => $task->updated_at ? $task->updated_at->diffForHumans() : null,
                    'project'          => $task->project ? [
                        'id'   => $task->project->id,
                        'code' => $task->project->code,
                        'name' => $task->project->name,
                    ] : null,
                    'approved_by'      => $approvedReview ? $approvedReview->user?->name : null,
                    'approval_notes'   => $approvedReview ? $approvedReview->notes : null,
                    'approval_date'    => $approvedReview ? $approvedReview->created_at?->toDateString() : null,
                    'revision_count'   => $revisionCount,
                    'checklist_stats'  => $chkStats,
                ];
            });

        return response()->json([
            'summary'           => $summary,
            'priority_tasks'    => $priorityTasks,
            'personal_progress' => $personal_progress,
            'recent_activities' => $recentActivities,
            'pm_notifications'  => $pmReviews,
            'all_updates'       => $allUpdates,
            'completed_history' => $completedHistory,
        ]);
    }

    /**
     * GET /api/member/calendar
     *
     * Pusat Jadwal & Kalender Kerja Pribadi Karyawan:
     * - Hanya data milik user yang sedang login (assignee_id = auth()->id())
     * - Mendukung filter rentang tanggal (start_date, end_date), status, prioritas, pencarian
     * - KPI: deadline hari ini, minggu ini, mendekati deadline (1-3 hari), overdue, selesai bulan ini
     * - Distribusi beban kerja harian (daily_distribution)
     * - Daftar deadline berikutnya (upcoming_deadlines, maks 5)
     * - Seluruh tugas dengan deadline terpetakan
     */
    public function calendar(Request $request)
    {
        $user = $request->user();

        // Guard: hanya untuk role member
        if (!$user || $user->role !== 'member') {
            return response()->json([
                'message' => 'Endpoint ini hanya tersedia untuk anggota tim (member).',
            ], 403);
        }

        $userId = $user->id;
        $now = Carbon::now('Asia/Jakarta');
        $todayStr = $now->toDateString();
        $startOfWeekStr = (clone $now)->startOfWeek()->toDateString();
        $endOfWeekStr = (clone $now)->endOfWeek()->toDateString();
        $startOfMonthStr = (clone $now)->startOfMonth()->toDateString();
        $endOfMonthStr = (clone $now)->endOfMonth()->toDateString();
        $in3DaysStr = (clone $now)->addDays(3)->toDateString();

        // Query dasar terisolasi hanya untuk user yang sedang login
        $baseQuery = Task::with([
            'project:id,name,code,status',
            'milestone:id,title,start_date,due_date',
            'checklists' => function ($q) {
                $q->orderBy('position', 'asc');
            },
            'latestReview' => function ($q) {
                $q->with('user:id,name');
            },
        ])->where('assignee_id', $userId);

        // 1. KPI Schedule Overview (Dihitung dari seluruh tugas member tanpa filter tampilan)
        $allMemberTasks = (clone $baseQuery)->get();

        $dueTodayCount = 0;
        $dueThisWeekCount = 0;
        $nearDeadlineCount = 0;
        $overdueCount = 0;
        $completedThisMonthCount = 0;

        foreach ($allMemberTasks as $t) {
            $isDone = $t->is_completed || in_array($t->status, ['completed', 'done']);
            $deadline = $t->deadline ? Carbon::parse($t->deadline)->toDateString() : null;

            if ($isDone) {
                // Selesai bulan ini
                if ($t->updated_at && Carbon::parse($t->updated_at)->timezone('Asia/Jakarta')->between($startOfMonthStr, $endOfMonthStr)) {
                    $completedThisMonthCount++;
                }
            } else {
                // Tugas aktif (termasuk todo, in_progress, in_review)
                if ($deadline) {
                    if ($deadline < $todayStr) {
                        $overdueCount++;
                    } elseif ($deadline === $todayStr) {
                        $dueTodayCount++;
                    }

                    if ($deadline >= $startOfWeekStr && $deadline <= $endOfWeekStr) {
                        $dueThisWeekCount++;
                    }

                    if ($deadline > $todayStr && $deadline <= $in3DaysStr) {
                        $nearDeadlineCount++;
                    }
                }
            }
        }

        $scheduleOverview = [
            'due_today'              => $dueTodayCount,
            'due_this_week'          => $dueThisWeekCount,
            'near_deadline'          => $nearDeadlineCount,
            'overdue'                => $overdueCount,
            'completed_this_month'   => $completedThisMonthCount,
        ];

        // 2. Daftar 5 Deadline Berikutnya (Upcoming Deadlines: tugas aktif dengan deadline terdekat, termasuk overdue & hari ini)
        $upcomingDeadlines = $allMemberTasks
            ->filter(function ($t) {
                $isDone = $t->is_completed || in_array($t->status, ['completed', 'done']);
                return !$isDone && !empty($t->deadline);
            })
            ->sortBy(function ($t) {
                return Carbon::parse($t->deadline)->timestamp;
            })
            ->take(5)
            ->values()
            ->map(function ($t) use ($todayStr, $now) {
                $deadline = Carbon::parse($t->deadline)->toDateString();
                $diffDays = Carbon::parse($todayStr)->diffInDays(Carbon::parse($deadline), false);

                if ($diffDays < 0) {
                    $timeLabel = 'Terlambat ' . abs($diffDays) . ' hari';
                    $urgency = 'overdue';
                } elseif ($diffDays === 0) {
                    $timeLabel = 'Hari ini';
                    $urgency = 'today';
                } elseif ($diffDays === 1) {
                    $timeLabel = 'Besok';
                    $urgency = 'tomorrow';
                } elseif ($diffDays <= 3) {
                    $timeLabel = "Dalam {$diffDays} hari";
                    $urgency = 'near';
                } elseif ($diffDays <= 7) {
                    $timeLabel = "Dalam {$diffDays} hari";
                    $urgency = 'week';
                } else {
                    $timeLabel = Carbon::parse($deadline)->translatedFormat('d M Y');
                    $urgency = 'later';
                }

                $chkStats = $t->getChecklistStats();

                return [
                    'id'                 => $t->id,
                    'title'              => $t->title,
                    'project_id'         => $t->project_id,
                    'project_name'       => $t->project?->name ?? '—',
                    'project_code'       => $t->project?->code ?? '—',
                    'deadline'           => $deadline,
                    'time_label'         => $timeLabel,
                    'urgency'            => $urgency,
                    'diff_days'          => $diffDays,
                    'priority'           => $t->priority,
                    'status'             => $t->status,
                    'checklist_progress' => $chkStats['progress'],
                    'checklist_total'    => $chkStats['total'],
                    'checklist_completed'=> $chkStats['completed'],
                ];
            });

        // 3. Filter Query untuk Kalender (start_date, end_date, filter_status, priority, search)
        $calendarQuery = clone $baseQuery;

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $calendarQuery->whereBetween('deadline', [$request->start_date, $request->end_date]);
        }

        if ($request->filled('priority') && in_array($request->priority, ['urgent', 'high', 'medium', 'low'])) {
            $calendarQuery->where('priority', $request->priority);
        }

        if ($request->filled('status')) {
            $st = $request->status;
            if ($st === 'overdue') {
                $calendarQuery->where('is_completed', false)
                    ->whereNotIn('status', ['completed', 'done'])
                    ->whereNotNull('deadline')
                    ->where('deadline', '<', $todayStr);
            } elseif ($st === 'due_today') {
                $calendarQuery->where('is_completed', false)
                    ->whereNotIn('status', ['completed', 'done'])
                    ->where('deadline', $todayStr);
            } elseif ($st === 'upcoming') {
                $calendarQuery->where('is_completed', false)
                    ->whereNotIn('status', ['completed', 'done'])
                    ->whereNotNull('deadline')
                    ->where('deadline', '>', $todayStr);
            } elseif ($st === 'completed') {
                $calendarQuery->where(function ($q) {
                    $q->where('status', 'completed')->orWhere('is_completed', true);
                });
            } elseif (in_array($st, ['todo', 'pending', 'in_progress', 'in_review'])) {
                $calendarQuery->where('status', $st)->where('is_completed', false);
            }
        }

        if ($request->filled('search')) {
            $q = trim($request->search);
            $calendarQuery->where(function ($sq) use ($q) {
                $sq->where('title', 'like', "%{$q}%")
                   ->orWhere('description', 'like', "%{$q}%")
                   ->orWhereHas('project', function ($pq) use ($q) {
                       $pq->where('name', 'like', "%{$q}%")
                          ->orWhere('code', 'like', "%{$q}%");
                   });
            });
        }

        $calendarTasks = $calendarQuery->orderBy('deadline', 'asc')->get();

        // Pemetaan tugas kalender dengan metadata lengkap
        $mappedTasks = $calendarTasks->map(function ($task) use ($todayStr) {
            $isDone = $task->is_completed || in_array($task->status, ['completed', 'done']);
            $deadline = $task->deadline ? Carbon::parse($task->deadline)->toDateString() : null;
            $chkStats = $task->getChecklistStats();

            $isOverdue = false;
            $isDueToday = false;
            if (!$isDone && $deadline) {
                if ($deadline < $todayStr) {
                    $isOverdue = true;
                } elseif ($deadline === $todayStr) {
                    $isDueToday = true;
                }
            }

            return [
                'id'                 => $task->id,
                'title'              => $task->title,
                'description'        => $task->description,
                'project_id'         => $task->project_id,
                'project_name'       => $task->project?->name ?? '—',
                'project_code'       => $task->project?->code ?? '—',
                'milestone_id'       => $task->milestone_id,
                'milestone_title'    => $task->milestone?->title,
                'deadline'           => $deadline,
                'priority'           => $task->priority,
                'status'             => $task->status,
                'is_completed'       => $isDone,
                'is_overdue'         => $isOverdue,
                'is_due_today'       => $isDueToday,
                'checklist_total'    => $chkStats['total'],
                'checklist_completed'=> $chkStats['completed'],
                'checklist_progress' => $chkStats['progress'],
                'checklists'         => $task->checklists,
                'latest_review'      => $task->latestReview ? [
                    'action'     => $task->latestReview->action,
                    'notes'      => $task->latestReview->notes,
                    'reviewer'   => $task->latestReview->user?->name,
                    'created_at' => $task->latestReview->created_at?->toDateTimeString(),
                ] : null,
            ];
        });

        // 4. Distribusi Beban Kerja Harian (Berdasarkan rentang atau 30 hari ke depan)
        $dailyDistribution = [];
        foreach ($mappedTasks as $t) {
            if ($t['deadline']) {
                $d = $t['deadline'];
                if (!isset($dailyDistribution[$d])) {
                    $dailyDistribution[$d] = [
                        'date'      => $d,
                        'total'     => 0,
                        'active'    => 0,
                        'completed' => 0,
                        'overdue'   => 0,
                    ];
                }
                $dailyDistribution[$d]['total']++;
                if ($t['is_completed']) {
                    $dailyDistribution[$d]['completed']++;
                } else {
                    $dailyDistribution[$d]['active']++;
                    if ($t['is_overdue']) {
                        $dailyDistribution[$d]['overdue']++;
                    }
                }
            }
        }
        ksort($dailyDistribution);

        return response()->json([
            'overview'            => $scheduleOverview,
            'upcoming_deadlines'  => $upcomingDeadlines,
            'tasks'               => $mappedTasks,
            'daily_distribution'  => array_values($dailyDistribution),
            'meta'                => [
                'current_date'    => $todayStr,
                'current_time'    => $now->format('H:i') . ' WIB',
                'timezone'        => 'Asia/Jakarta',
            ],
        ]);
    }
}

