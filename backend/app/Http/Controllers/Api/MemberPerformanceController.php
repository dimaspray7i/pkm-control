<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\TaskChecklist;
use App\Models\TaskReview;
use App\Models\TaskUpdate;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class MemberPerformanceController extends Controller
{
    /**
     * GET /api/member/performance
     *
     * Pusat Analitik Kinerja & Produktivitas Personal Member:
     * - Hanya data milik member terautentikasi (assignee_id = auth()->id())
     * - Strict role checking: role !== 'member' mengembalikan 403
     * - Parameter: period ('7d', '30d', 'this_month', '3m', 'this_year', 'custom'), start_date, end_date
     * - Zona waktu: Asia/Jakarta
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // 1. Authorization: Khusus role member
        if (!$user || $user->role !== 'member') {
            return response()->json([
                'message' => 'Endpoint ini hanya tersedia untuk anggota tim (member).',
            ], 403);
        }

        $userId = (int) $user->id;
        $now = Carbon::now('Asia/Jakarta');
        $todayStr = $now->toDateString();
        $startOfWeekStr = (clone $now)->startOfWeek()->toDateString();
        $endOfWeekStr = (clone $now)->endOfWeek()->toDateString();

        // 2. Filter Periode
        $period = $request->query('period', '30d');

        if ($period === 'custom') {
            $validator = Validator::make($request->all(), [
                'start_date' => 'required|date_format:Y-m-d',
                'end_date'   => 'required|date_format:Y-m-d|after_or_equal:start_date',
            ], [
                'start_date.required'       => 'Tanggal awal wajib ditentukan untuk periode kustom.',
                'start_date.date_format'    => 'Format tanggal awal tidak valid (harus Y-m-d).',
                'end_date.required'         => 'Tanggal akhir wajib ditentukan untuk periode kustom.',
                'end_date.date_format'      => 'Format tanggal akhir tidak valid (harus Y-m-d).',
                'end_date.after_or_equal'   => 'Tanggal akhir harus sama dengan atau setelah tanggal awal.',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Validasi rentang tanggal gagal.',
                    'errors'  => $validator->errors(),
                ], 422);
            }

            $startDate = Carbon::createFromFormat('Y-m-d', $request->start_date, 'Asia/Jakarta')->startOfDay();
            $endDate   = Carbon::createFromFormat('Y-m-d', $request->end_date, 'Asia/Jakarta')->endOfDay();
        } elseif ($period === '7d') {
            $startDate = (clone $now)->subDays(6)->startOfDay();
            $endDate   = (clone $now)->endOfDay();
        } elseif ($period === 'this_month') {
            $startDate = (clone $now)->startOfMonth()->startOfDay();
            $endDate   = (clone $now)->endOfMonth()->endOfDay();
        } elseif ($period === '3m') {
            $startDate = (clone $now)->subMonths(3)->startOfDay();
            $endDate   = (clone $now)->endOfDay();
        } elseif ($period === 'this_year') {
            $startDate = (clone $now)->startOfYear()->startOfDay();
            $endDate   = (clone $now)->endOfYear()->endOfDay();
        } else {
            $period = '30d';
            $startDate = (clone $now)->subDays(29)->startOfDay();
            $endDate   = (clone $now)->endOfDay();
        }

        // 3. Ambil Tugas Member dalam Periode Terpilih
        $tasks = Task::with([
            'project:id,name,code,status',
            'checklists',
            'reviews' => function ($q) {
                $q->orderBy('created_at', 'desc');
            },
        ])->where('assignee_id', $userId)
          ->whereBetween('created_at', [$startDate, $endDate])
          ->get();

        // Helper untuk mencari tanggal penyelesaian aktual dari TaskReview (prioritas utama)
        $getActualCompletionDate = function (Task $t) {
            $approvedReview = $t->reviews->first(function ($r) {
                return in_array($r->action, ['approved', 'done']) || $r->to_status === 'done';
            });

            if ($approvedReview && $approvedReview->created_at) {
                return Carbon::parse($approvedReview->created_at)->timezone('Asia/Jakarta');
            }

            if ($t->is_completed || in_array($t->status, ['completed', 'done'])) {
                return $t->updated_at ? Carbon::parse($t->updated_at)->timezone('Asia/Jakarta') : null;
            }

            return null;
        };

        // 4. Perhitungan Metrik Performance Overview
        $totalTasks = $tasks->count();
        $completedTasks = 0;
        $activeTasks = 0;
        $inReviewTasks = 0;
        $onTimeCount = 0;
        $lateCount = 0;
        $withoutDeadlineCount = 0;
        $overdueActiveCount = 0;
        $dueThisWeekCount = 0;

        $durationsList = [];

        // Checklist aggregation
        $totalChecklists = 0;
        $completedChecklists = 0;

        // Distribusi Status
        $statusCounts = [
            'todo'        => 0,
            'in_progress' => 0,
            'in_review'   => 0,
            'done'        => 0,
        ];

        // Distribusi Prioritas
        $priorityCounts = [
            'urgent' => 0,
            'high'   => 0,
            'medium' => 0,
            'low'    => 0,
        ];

        // Completion map per tanggal (Y-m-d)
        $dailyCompletedMap = [];

        foreach ($tasks as $t) {
            $isDone = (bool) $t->is_completed || in_array($t->status, ['completed', 'done']);
            $isInReview = !$isDone && $t->status === 'in_review';
            $isActive = !$isDone && in_array($t->status, ['pending', 'todo', 'in_progress']);

            // Status Distribution
            if ($isDone) {
                $statusCounts['done']++;
            } elseif ($isInReview) {
                $statusCounts['in_review']++;
            } elseif ($t->status === 'in_progress') {
                $statusCounts['in_progress']++;
            } else {
                $statusCounts['todo']++;
            }

            // Priority Distribution
            $p = strtolower($t->priority ?? 'medium');
            if (isset($priorityCounts[$p])) {
                $priorityCounts[$p]++;
            } else {
                $priorityCounts['medium']++;
            }

            // Checklists
            if ($t->checklists) {
                $totalChecklists += $t->checklists->count();
                $completedChecklists += $t->checklists->where('is_completed', true)->count();
            }

            // Deadline string
            $deadlineStr = $t->deadline ? Carbon::parse($t->deadline)->toDateString() : null;

            if ($isDone) {
                $completedTasks++;
                $actualCompletion = $getActualCompletionDate($t);

                if ($deadlineStr) {
                    if ($actualCompletion) {
                        $compDateStr = $actualCompletion->toDateString();
                        if ($compDateStr <= $deadlineStr) {
                            $onTimeCount++;
                        } else {
                            $lateCount++;
                        }
                    } else {
                        // Jika tidak ada timestamp, anggap tepat waktu jika deadline belum terlewat
                        $onTimeCount++;
                    }
                } else {
                    $withoutDeadlineCount++;
                }

                // Hitung durasi penyelesaian jika ada start_date dan actualCompletion
                if ($t->start_date && $actualCompletion) {
                    $startDateParsed = Carbon::parse($t->start_date)->startOfDay();
                    $days = max(1, $startDateParsed->diffInDays($actualCompletion->copy()->endOfDay()));
                    $durationsList[] = $days;
                }

                // Catat tanggal selesai untuk grafik tren
                if ($actualCompletion) {
                    $dStr = $actualCompletion->toDateString();
                    $dailyCompletedMap[$dStr] = ($dailyCompletedMap[$dStr] ?? 0) + 1;
                }
            } else {
                // Tugas belum selesai
                if ($isInReview) {
                    $inReviewTasks++;
                } else {
                    $activeTasks++;
                }

                // Overdue aktif: belum selesai dan deadline melewati hari ini
                if ($deadlineStr && $deadlineStr < $todayStr) {
                    $overdueActiveCount++;
                }

                // Jatuh tempo minggu ini
                if ($deadlineStr && $deadlineStr >= $startOfWeekStr && $deadlineStr <= $endOfWeekStr) {
                    $dueThisWeekCount++;
                }
            }
        }

        // Completion Rate
        $completionRate = $totalTasks > 0 ? round(($completedTasks / $totalTasks) * 100, 1) : 0.0;

        // On-time Percentage (dari tugas selesai yang memiliki deadline)
        $completedWithDeadline = $onTimeCount + $lateCount;
        $onTimePercentage = $completedWithDeadline > 0 ? round(($onTimeCount / $completedWithDeadline) * 100, 1) : 0.0;

        // Checklist completion rate
        $checklistCompletionRate = $totalChecklists > 0 ? round(($completedChecklists / $totalChecklists) * 100, 1) : 0.0;

        // Average duration
        $averageDurationDays = count($durationsList) > 0 ? round(array_sum($durationsList) / count($durationsList), 1) : null;

        // 5. Task Completion Trend (Grafik Harian / Mingguan / Bulanan)
        $trendData = [];
        $daysDiff = $startDate->diffInDays($endDate);

        if ($daysDiff <= 31) {
            // Harian
            $aggregationMode = 'daily';
            $periodRange = CarbonPeriod::create($startDate, '1 day', $endDate);
            foreach ($periodRange as $date) {
                $dStr = $date->toDateString();
                $trendData[] = [
                    'date'            => $dStr,
                    'label'           => $date->locale('id')->isoFormat('D MMM'),
                    'completed_count' => $dailyCompletedMap[$dStr] ?? 0,
                ];
            }
        } elseif ($daysDiff <= 95) {
            // Mingguan
            $aggregationMode = 'weekly';
            $curr = $startDate->copy()->startOfWeek();
            $weekIndex = 1;
            while ($curr <= $endDate) {
                $weekEnd = $curr->copy()->endOfWeek();
                $weekCount = 0;
                foreach ($dailyCompletedMap as $dStr => $cnt) {
                    if ($dStr >= $curr->toDateString() && $dStr <= $weekEnd->toDateString()) {
                        $weekCount += $cnt;
                    }
                }
                $trendData[] = [
                    'date'            => $curr->toDateString(),
                    'label'           => 'Mg ' . $weekIndex . ' (' . $curr->format('d/m') . ')',
                    'completed_count' => $weekCount,
                ];
                $curr->addWeek();
                $weekIndex++;
            }
        } else {
            // Bulanan
            $aggregationMode = 'monthly';
            $curr = $startDate->copy()->startOfMonth();
            while ($curr <= $endDate) {
                $monthEnd = $curr->copy()->endOfMonth();
                $monthCount = 0;
                foreach ($dailyCompletedMap as $dStr => $cnt) {
                    if ($dStr >= $curr->toDateString() && $dStr <= $monthEnd->toDateString()) {
                        $monthCount += $cnt;
                    }
                }
                $trendData[] = [
                    'date'            => $curr->toDateString(),
                    'label'           => $curr->locale('id')->isoFormat('MMM YYYY'),
                    'completed_count' => $monthCount,
                ];
                $curr->addMonth();
            }
        }

        // 6. Format Distribusi Status & Prioritas
        $statusDistribution = [
            [
                'status'     => 'todo',
                'label'      => 'Daftar Tugas',
                'count'      => $statusCounts['todo'],
                'percentage' => $totalTasks > 0 ? round(($statusCounts['todo'] / $totalTasks) * 100, 1) : 0.0,
                'color'      => '#FAF7F2',
            ],
            [
                'status'     => 'in_progress',
                'label'      => 'Sedang Berjalan',
                'count'      => $statusCounts['in_progress'],
                'percentage' => $totalTasks > 0 ? round(($statusCounts['in_progress'] / $totalTasks) * 100, 1) : 0.0,
                'color'      => '#FFD83D',
            ],
            [
                'status'     => 'in_review',
                'label'      => 'Menunggu Review PM',
                'count'      => $statusCounts['in_review'],
                'percentage' => $totalTasks > 0 ? round(($statusCounts['in_review'] / $totalTasks) * 100, 1) : 0.0,
                'color'      => '#B8A0F0',
            ],
            [
                'status'     => 'done',
                'label'      => 'Selesai',
                'count'      => $statusCounts['done'],
                'percentage' => $totalTasks > 0 ? round(($statusCounts['done'] / $totalTasks) * 100, 1) : 0.0,
                'color'      => '#10B981',
            ],
        ];

        $priorityDistribution = [
            [
                'priority'   => 'urgent',
                'label'      => 'Mendesak',
                'count'      => $priorityCounts['urgent'],
                'percentage' => $totalTasks > 0 ? round(($priorityCounts['urgent'] / $totalTasks) * 100, 1) : 0.0,
                'color'      => '#FF2F92',
            ],
            [
                'priority'   => 'high',
                'label'      => 'Tinggi',
                'count'      => $priorityCounts['high'],
                'percentage' => $totalTasks > 0 ? round(($priorityCounts['high'] / $totalTasks) * 100, 1) : 0.0,
                'color'      => '#FF5722',
            ],
            [
                'priority'   => 'medium',
                'label'      => 'Sedang',
                'count'      => $priorityCounts['medium'],
                'percentage' => $totalTasks > 0 ? round(($priorityCounts['medium'] / $totalTasks) * 100, 1) : 0.0,
                'color'      => '#FFD83D',
            ],
            [
                'priority'   => 'low',
                'label'      => 'Rendah',
                'count'      => $priorityCounts['low'],
                'percentage' => $totalTasks > 0 ? round(($priorityCounts['low'] / $totalTasks) * 100, 1) : 0.0,
                'color'      => '#B8A0F0',
            ],
        ];

        // 7. Riwayat Aktivitas & Konsistensi Kerja (Work Consistency & Activity History)
        // Ambil data task_updates dari database aktual
        $updatesQuery = TaskUpdate::with('task:id,title,project_id', 'task.project:id,name')
            ->where('user_id', $userId)
            ->whereBetween('created_at', [$startDate, $endDate])
            ->orderBy('created_at', 'desc');

        $totalUpdatesSent = $updatesQuery->count();
        $recentUpdates = $updatesQuery->limit(10)->get();

        // Ambil riwayat review PM terhadap tugas milik member
        $taskIds = $tasks->pluck('id')->toArray();
        $reviewsQuery = TaskReview::with('user:id,name,role', 'task:id,title')
            ->whereIn('task_id', $taskIds)
            ->whereBetween('created_at', [$startDate, $endDate])
            ->orderBy('created_at', 'desc');

        $totalReviewsReceived = $reviewsQuery->count();
        $recentReviews = $reviewsQuery->limit(10)->get();

        // Hitung Hari & Minggu Aktif
        $activeDaysSet = [];
        $activeWeeksSet = [];

        // 1) Dari updates
        $allUpdatesTimestamps = TaskUpdate::where('user_id', $userId)
            ->whereBetween('created_at', [$startDate, $endDate])
            ->pluck('created_at');

        foreach ($allUpdatesTimestamps as $ts) {
            $c = Carbon::parse($ts)->timezone('Asia/Jakarta');
            $activeDaysSet[$c->toDateString()] = true;
            $activeWeeksSet[$c->format('o-W')] = true;
        }

        // 2) Dari penyelesaian tugas
        foreach ($dailyCompletedMap as $dStr => $cnt) {
            $c = Carbon::parse($dStr, 'Asia/Jakarta');
            $activeDaysSet[$dStr] = true;
            $activeWeeksSet[$c->format('o-W')] = true;
        }

        $activeDaysCount = count($activeDaysSet);
        $activeWeeksCount = count($activeWeeksSet);

        // Feed Histori Aktivitas Terpadu
        $activityFeed = [];

        foreach ($recentUpdates as $upd) {
            $activityFeed[] = [
                'id'          => 'upd-' . $upd->id,
                'type'        => 'update',
                'title'       => 'Mengirim Laporan Progres',
                'description' => $upd->work_description,
                'task_title'  => $upd->task->title ?? 'Tugas',
                'project_name'=> $upd->task->project->name ?? '-',
                'progress'    => $upd->progress_snapshot,
                'timestamp'   => $upd->created_at ? Carbon::parse($upd->created_at)->timezone('Asia/Jakarta')->toISOString() : null,
                'created_at'  => $upd->created_at,
            ];
        }

        foreach ($recentReviews as $rev) {
            $isApproval = in_array($rev->action, ['approved', 'done']) || $rev->to_status === 'done';
            $isRevision = $rev->action === 'revision' || $rev->action === 'needs_revision';

            $activityFeed[] = [
                'id'          => 'rev-' . $rev->id,
                'type'        => $isApproval ? 'approval' : ($isRevision ? 'revision' : 'review'),
                'title'       => $isApproval ? 'Tugas Disetujui PM' : ($isRevision ? 'PM Meminta Revisi' : 'Catatan PM'),
                'description' => $rev->notes ?? '-',
                'task_title'  => $rev->task->title ?? 'Tugas',
                'reviewer'    => $rev->user->name ?? 'PM',
                'timestamp'   => $rev->created_at ? Carbon::parse($rev->created_at)->timezone('Asia/Jakarta')->toISOString() : null,
                'created_at'  => $rev->created_at,
            ];
        }

        // Urutkan feed aktivitas berdasarkan timestamp desc
        usort($activityFeed, function ($a, $b) {
            return strtotime($b['created_at'] ?? '0') <=> strtotime($a['created_at'] ?? '0');
        });

        // 8. Personal Performance Insights (Rule-Based, Konstruktif, Berbasis Data Nyata)
        $insights = [];

        if ($totalTasks === 0) {
            $insights[] = [
                'type'        => 'info',
                'title'       => 'Belum Ada Penugasan Baru',
                'description' => 'Tidak ditemukan data penugasan tugas baru pada periode yang dipilih.',
                'metric'      => '0 Tugas',
            ];
        } else {
            // Insight Ketepatan Waktu
            if ($completedWithDeadline > 0) {
                if ($onTimePercentage === 100.0) {
                    $insights[] = [
                        'type'        => 'success',
                        'title'       => 'Ketepatan Waktu Maksimal',
                        'description' => "Seluruh {$completedWithDeadline} tugas selesai diselesaikan tepat waktu (100% on-time).",
                        'metric'      => '100% On-Time',
                    ];
                } elseif ($onTimePercentage >= 75.0) {
                    $insights[] = [
                        'type'        => 'success',
                        'title'       => 'Ketepatan Waktu Baik',
                        'description' => "Sebanyak {$onTimeCount} dari {$completedWithDeadline} tugas diselesaikan sebelum atau tepat pada deadline ({$onTimePercentage}%).",
                        'metric'      => "{$onTimePercentage}%",
                    ];
                } else {
                    $insights[] = [
                        'type'        => 'warning',
                        'title'       => 'Perhatian Batas Waktu',
                        'description' => "Terdapat {$lateCount} tugas yang diselesaikan melewati deadline dari total {$completedWithDeadline} tugas selesai.",
                        'metric'      => "{$lateCount} Terlambat",
                    ];
                }
            }

            // Insight Tugas Overdue Aktif
            if ($overdueActiveCount > 0) {
                $insights[] = [
                    'type'        => 'warning',
                    'title'       => 'Tugas Melewati Deadline',
                    'description' => "Terdapat {$overdueActiveCount} tugas aktif yang telah melewati tanggal batas waktu dan memerlukan prioritas penyelesaian.",
                    'metric'      => "{$overdueActiveCount} Overdue",
                ];
            }

            // Insight In-Review
            if ($inReviewTasks > 0) {
                $insights[] = [
                    'type'        => 'info',
                    'title'       => 'Tugas Menunggu Review PM',
                    'description' => "Saat ini ada {$inReviewTasks} tugas yang telah diajukan dan sedang dalam antrean pemeriksaan oleh Project Manager.",
                    'metric'      => "{$inReviewTasks} In-Review",
                ];
            }

            // Insight Checklist Completion
            if ($totalChecklists > 0) {
                if ($checklistCompletionRate === 100.0) {
                    $insights[] = [
                        'type'        => 'success',
                        'title'       => 'Checklist Tuntas',
                        'description' => "Seluruh {$totalChecklists} item checklist pekerjaan pada tugas periode ini telah diselesaikan 100%.",
                        'metric'      => '100% Checklist',
                    ];
                } else {
                    $insights[] = [
                        'type'        => 'info',
                        'title'       => 'Progres Checklist',
                        'description' => "Tercatat {$completedChecklists} dari {$totalChecklists} item checklist berhasil diselesaikan ({$checklistCompletionRate}%).",
                        'metric'      => "{$checklistCompletionRate}%",
                    ];
                }
            }

            // Insight Pelaporan Progres
            if ($totalUpdatesSent > 0) {
                $insights[] = [
                    'type'        => 'info',
                    'title'       => 'Konsistensi Pelaporan',
                    'description' => "Tercatat {$totalUpdatesSent} kali pelaporan progres kerja pada {$activeDaysCount} hari aktif selama periode ini.",
                    'metric'      => "{$totalUpdatesSent} Update",
                ];
            }
        }

        // 9. Return Response Terstruktur
        return response()->json([
            'period'                => $period,
            'start_date'            => $startDate->toDateString(),
            'end_date'              => $endDate->toDateString(),
            'timezone'              => 'Asia/Jakarta',
            'summary'               => [
                'total_tasks'               => $totalTasks,
                'completed_tasks'           => $completedTasks,
                'active_tasks'              => $activeTasks,
                'in_review_tasks'           => $inReviewTasks,
                'on_time_count'             => $onTimeCount,
                'late_count'                => $lateCount,
                'without_deadline_count'    => $withoutDeadlineCount,
                'on_time_percentage'        => $onTimePercentage,
                'overdue_active_count'      => $overdueActiveCount,
                'due_this_week_count'       => $dueThisWeekCount,
                'completion_rate'           => $completionRate,
                'total_checklists'          => $totalChecklists,
                'completed_checklists'      => $completedChecklists,
                'checklist_completion_rate' => $checklistCompletionRate,
            ],
            'task_completion'       => [
                'completion_rate'  => $completionRate,
                'aggregation'      => $aggregationMode,
                'trend'            => $trendData,
            ],
            'status_distribution'   => $statusDistribution,
            'priority_distribution' => $priorityDistribution,
            'deadline_performance'  => [
                'on_time_count'          => $onTimeCount,
                'late_count'             => $lateCount,
                'without_deadline_count' => $withoutDeadlineCount,
                'overdue_active_count'   => $overdueActiveCount,
                'due_this_week_count'    => $dueThisWeekCount,
                'on_time_rate'           => $onTimePercentage,
                'average_duration_days'  => $averageDurationDays,
                'duration_available'     => $averageDurationDays !== null,
                'duration_note'          => $averageDurationDays !== null
                    ? 'Rata-rata dihitung dari tugas yang memiliki data tanggal mulai dan tanggal selesai valid.'
                    : 'Data tanggal mulai belum tersedia pada sebagian besar tugas untuk menghitung rata-rata durasi penyelesaian secara akurat.',
            ],
            'productivity_analytics'=> [
                'total_updates'   => $totalUpdatesSent,
                'checklist_stats' => [
                    'total'           => $totalChecklists,
                    'completed'       => $completedChecklists,
                    'pending'         => max(0, $totalChecklists - $completedChecklists),
                    'completion_rate' => $checklistCompletionRate,
                ],
            ],
            'consistency'           => [
                'active_days_count'      => $activeDaysCount,
                'active_weeks_count'     => $activeWeeksCount,
                'total_updates_sent'     => $totalUpdatesSent,
                'total_reviews_received' => $totalReviewsReceived,
                'activities'             => array_slice($activityFeed, 0, 15),
            ],
            'personal_insights'     => $insights,
            'meta'                  => [
                'generated_at' => $now->toISOString(),
                'member_id'    => $userId,
                'member_name'  => $user->name,
                'notice'       => 'Metrik ini dihitung langsung dari data operasional aktual dan ditujukan semata-mata untuk evaluasi produktivitas pribadi Anda.',
            ],
        ]);
    }
}
