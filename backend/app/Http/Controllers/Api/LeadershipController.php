<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\ProjectReport;
use App\Models\Task;
use App\Models\TaskReview;
use App\Models\TaskUpdate;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;

class LeadershipController extends Controller
{
    /**
     * Executive Command Center Dashboard Data
     * Accessible by: pimpinan, admin
     */
    public function commandCenter(Request $request)
    {
        $user = $request->user();

        // Defense-in-depth role check
        if (!$user || !in_array($user->role, ['admin', 'pimpinan'], true)) {
            return response()->json([
                'message' => 'Akses ditolak. Fitur Executive Command Center hanya dapat diakses oleh Pimpinan dan Administrator.',
            ], 403);
        }

        $today = Carbon::today()->toDateString();
        $now = Carbon::now();

        // =========================================================================
        // 1. PROJECTS & TASKS DATA QUERY (Aggregated for entire company)
        // =========================================================================
        $allProjects = Project::with(['pic:id,name,email', 'milestones'])->where('is_active', true)->get();
        $totalProjects = $allProjects->count();
        $completedProjects = $allProjects->where('status', 'completed')->count();
        $activeProjects = $allProjects->where('status', '!=', 'completed')->values();
        $totalActiveProjects = $activeProjects->count();

        $onTrackProjects = $activeProjects->where('status', 'on_track')->count();
        $atRiskProjects  = $activeProjects->where('status', 'at_risk')->count();
        $delayedProjects = $activeProjects->where('status', 'delayed')->count();

        $allTasks = Task::with('project:id,name,code,pic_id')->get();
        $activeTasks = $allTasks->filter(function ($t) {
            return !$t->is_completed && !in_array($t->status, ['completed', 'done'], true);
        })->values();
        $totalActiveTasks = $activeTasks->count();

        $overdueActiveTasks = $activeTasks->filter(function ($t) use ($today) {
            return !empty($t->deadline) && $t->deadline < $today;
        })->values();
        $overdueTasksCount = $overdueActiveTasks->count();
        $onTimeActiveTasksCount = max(0, $totalActiveTasks - $overdueTasksCount);

        // =========================================================================
        // 2. COMPANY HEALTH INDEX (CHI) FORMULA (0 - 100)
        // CHI = (0.35 * S_project) + (0.25 * S_schedule) + (0.25 * S_delivery) + (0.15 * S_risk)
        // =========================================================================

        // Component 1: S_project (On-Track ratio in active projects)
        $sProject = $totalActiveProjects > 0
            ? round(($onTrackProjects / $totalActiveProjects) * 100, 1)
            : 100.0;

        // Component 2: S_schedule (On-Time ratio in active tasks)
        $sSchedule = $totalActiveTasks > 0
            ? round(($onTimeActiveTasksCount / $totalActiveTasks) * 100, 1)
            : 100.0;

        // Component 3: S_delivery (Actual progress vs target progress ratio, capped at 100)
        $projectsWithTarget = $activeProjects->filter(function ($p) {
            return !is_null($p->target_progress) && (int) $p->target_progress > 0;
        });

        if ($projectsWithTarget->count() > 0) {
            $ratios = $projectsWithTarget->map(function ($p) {
                $actual = (float) ($p->progress ?? 0);
                $target = (float) $p->target_progress;
                return min(100.0, ($actual / $target) * 100);
            });
            $sDelivery = round($ratios->avg(), 1);
            $hasTargetData = true;
        } elseif ($totalActiveProjects > 0) {
            // Fallback: average actual progress if targets are not yet specified
            $sDelivery = round($activeProjects->avg('progress') ?? 0, 1);
            $hasTargetData = false;
        } else {
            $sDelivery = 100.0;
            $hasTargetData = true;
        }

        // Component 4: S_risk (100 minus percentage of high-risk / delayed projects)
        $highRiskProjects = $activeProjects->filter(function ($p) {
            return $p->risk_level === 'high' || $p->status === 'delayed';
        });
        $highRiskCount = $highRiskProjects->count();
        $highRiskPct = $totalActiveProjects > 0
            ? ($highRiskCount / $totalActiveProjects) * 100
            : 0.0;
        $sRisk = max(0.0, round(100.0 - $highRiskPct, 1));

        // Aggregate CHI Calculation
        $chiScore = round((0.35 * $sProject) + (0.25 * $sSchedule) + (0.25 * $sDelivery) + (0.15 * $sRisk), 1);
        $chiScore = max(0.0, min(100.0, $chiScore));

        // Categorize Score
        if ($chiScore >= 90.0) {
            $chiCategory = 'Prima';
            $chiBadge = ['label' => 'Prima', 'color' => '#10B981', 'bg' => 'bg-[#10B981]', 'text' => 'text-white'];
            $chiDescription = 'Performa operasional perusahaan dalam kondisi prima. Sebagian besar proyek berjalan sesuai rencana dan risiko terkendali.';
        } elseif ($chiScore >= 75.0) {
            $chiCategory = 'Baik';
            $chiBadge = ['label' => 'Baik', 'color' => '#FFD83D', 'bg' => 'bg-[#FFD83D]', 'text' => 'text-[#171717]'];
            $chiDescription = 'Kondisi operasional stabil dengan beberapa indikator yang memerlukan pemantauan berkala agar tidak bergeser ke status waspada.';
        } elseif ($chiScore >= 60.0) {
            $chiCategory = 'Waspada';
            $chiBadge = ['label' => 'Waspada', 'color' => '#F59E0B', 'bg' => 'bg-[#F59E0B]', 'text' => 'text-white'];
            $chiDescription = 'Terdeteksi deviasi jadwal dan risiko pada beberapa proyek aktif. Diperlukan supervisi dan koordinasi dengan Project Manager.';
        } else {
            $chiCategory = 'Kritis';
            $chiBadge = ['label' => 'Kritis', 'color' => '#FF2F92', 'bg' => 'bg-[#FF2F92]', 'text' => 'text-white'];
            $chiDescription = 'Kondisi operasional kritis. Terdapat akumulasi keterlambatan dan risiko tinggi yang membutuhkan intervensi kepemimpinan segera.';
        }

        $chiData = [
            'score' => $chiScore,
            'category' => $chiCategory,
            'badge' => $chiBadge,
            'description' => $chiDescription,
            'formula' => 'CHI = (0.35 × S_project) + (0.25 × S_schedule) + (0.25 × S_delivery) + (0.15 × S_risk)',
            'components' => [
                'project' => [
                    'label' => 'Kesehatan Status Proyek (S_project)',
                    'score' => $sProject,
                    'weight' => 0.35,
                    'weighted_score' => round(0.35 * $sProject, 1),
                    'metric' => "{$onTrackProjects} On Track dari {$totalActiveProjects} proyek aktif",
                    'detail' => [
                        'on_track' => $onTrackProjects,
                        'total_active' => $totalActiveProjects,
                    ],
                ],
                'schedule' => [
                    'label' => 'Ketepatan Jadwal Tugas (S_schedule)',
                    'score' => $sSchedule,
                    'weight' => 0.25,
                    'weighted_score' => round(0.25 * $sSchedule, 1),
                    'metric' => "{$onTimeActiveTasksCount} tepat waktu dari {$totalActiveTasks} tugas aktif",
                    'detail' => [
                        'on_time_tasks' => $onTimeActiveTasksCount,
                        'overdue_tasks' => $overdueTasksCount,
                        'total_active_tasks' => $totalActiveTasks,
                    ],
                ],
                'delivery' => [
                    'label' => 'Pencapaian Target Progres (S_delivery)',
                    'score' => $sDelivery,
                    'weight' => 0.25,
                    'weighted_score' => round(0.25 * $sDelivery, 1),
                    'has_target_data' => $hasTargetData,
                    'metric' => $hasTargetData
                        ? "Rasio aktual vs target ({$projectsWithTarget->count()} proyek ber-target)"
                        : 'Berdasarkan rata-rata progres aktual (target belum diset)',
                    'detail' => [
                        'projects_with_target' => $projectsWithTarget->count(),
                        'avg_actual_progress' => round($activeProjects->avg('progress') ?: 0, 1),
                        'avg_target_progress' => round($activeProjects->avg('target_progress') ?: 0, 1),
                    ],
                ],
                'risk' => [
                    'label' => 'Kerapihan Manajemen Risiko (S_risk)',
                    'score' => $sRisk,
                    'weight' => 0.15,
                    'weighted_score' => round(0.15 * $sRisk, 1),
                    'metric' => "{$highRiskCount} proyek High Risk/Delayed dari {$totalActiveProjects} proyek aktif",
                    'detail' => [
                        'high_risk_count' => $highRiskCount,
                        'total_active' => $totalActiveProjects,
                    ],
                ],
            ],
        ];

        // =========================================================================
        // 3. PORTFOLIO STATUS SNAPSHOT
        // =========================================================================
        $portfolioSnapshot = [
            'total_projects' => $totalProjects,
            'active_projects' => $totalActiveProjects,
            'on_track' => $onTrackProjects,
            'at_risk' => $atRiskProjects,
            'delayed' => $delayedProjects,
            'completed' => $completedProjects,
            'completion_rate' => $totalProjects > 0
                ? round(($completedProjects / $totalProjects) * 100, 1)
                : 0.0,
        ];

        // =========================================================================
        // 4. TARGET VS ACTUAL PROGRESS
        // =========================================================================
        $avgActualProg = round($activeProjects->avg('progress') ?: 0, 1);
        $avgTargetProg = round($activeProjects->avg('target_progress') ?: 0, 1);
        $progVariance  = round($avgActualProg - $avgTargetProg, 1);

        $projectsBelowTargetCount = $activeProjects->filter(function ($p) {
            $tgt = (int) ($p->target_progress ?? 0);
            $act = (int) ($p->progress ?? 0);
            return $tgt > 0 && $act < $tgt;
        })->count();

        $projectsOnTargetCount = $activeProjects->filter(function ($p) {
            $tgt = (int) ($p->target_progress ?? 0);
            $act = (int) ($p->progress ?? 0);
            return $tgt > 0 && $act >= $tgt;
        })->count();

        $progressAnalysis = [
            'avg_actual' => $avgActualProg,
            'avg_target' => $avgTargetProg,
            'variance' => $progVariance,
            'is_behind' => $progVariance < 0,
            'projects_below_target' => $projectsBelowTargetCount,
            'projects_on_target' => $projectsOnTargetCount,
            'total_active' => $totalActiveProjects,
        ];

        // =========================================================================
        // 5. ATTENTION RADAR (Projects needing executive attention)
        // =========================================================================
        // Fetch active blockers from task_updates
        $recentBlockers = TaskUpdate::whereNotNull('blocker')
            ->where('blocker', '!=', '')
            ->with(['task:id,project_id,title'])
            ->orderBy('created_at', 'desc')
            ->limit(30)
            ->get();

        $blockersByProject = [];
        foreach ($recentBlockers as $b) {
            if ($b->task && $b->task->project_id) {
                $pid = $b->task->project_id;
                if (!isset($blockersByProject[$pid])) {
                    $blockersByProject[$pid] = [];
                }
                $blockersByProject[$pid][] = [
                    'task_title' => $b->task->title,
                    'blocker' => $b->blocker,
                    'created_at' => $b->created_at ? $b->created_at->format('d M Y') : '-',
                ];
            }
        }

        $radarProjects = $activeProjects->map(function ($proj) use ($today, $blockersByProject) {
            $reasons = [];
            $urgencyScore = 0;

            // 1. Status delayed
            if ($proj->status === 'delayed') {
                $reasons[] = 'Status Proyek Delayed (Keterlambatan Mayor)';
                $urgencyScore += 100;
            } elseif ($proj->status === 'at_risk') {
                $reasons[] = 'Status Proyek At Risk (Beresiko Terlambat)';
                $urgencyScore += 60;
            }

            // 2. Risk level high
            if ($proj->risk_level === 'high') {
                $reasons[] = 'Tingkat Risiko Tinggi (' . ($proj->risk_factor ?: 'Faktor risiko kritis') . ')';
                $urgencyScore += 50;
            }

            // 3. Negative progress variance
            $dev = (int) ($proj->progress ?? 0) - (int) ($proj->target_progress ?? 0);
            if ($proj->target_progress > 0 && $dev < -15) {
                $reasons[] = "Deviasi Progres {$dev}% di bawah target";
                $urgencyScore += min(50, abs($dev));
            }

            // 4. Overdue project deadline
            if ($proj->deadline && $proj->deadline < $today) {
                $reasons[] = 'Tenggat Waktu Proyek Terlewati (' . Carbon::parse($proj->deadline)->format('d M Y') . ')';
                $urgencyScore += 80;
            }

            // 5. Overdue milestones
            $overdueMilestones = $proj->milestones ? $proj->milestones->filter(function ($m) use ($today) {
                return $m->status !== 'completed' && !empty($m->due_date) && $m->due_date < $today;
            }) : collect();

            if ($overdueMilestones->count() > 0) {
                $reasons[] = "{$overdueMilestones->count()} Milestone Terlewat Target Waktu";
                $urgencyScore += ($overdueMilestones->count() * 25);
            }

            // 6. Active blockers
            $projBlockers = $blockersByProject[$proj->id] ?? [];
            if (!empty($projBlockers)) {
                $reasons[] = count($projBlockers) . ' Hambatan/Blocker Teknis Dilaporkan Tim';
                $urgencyScore += (count($projBlockers) * 30);
            }

            $totalMilestones = $proj->milestones ? $proj->milestones->count() : 0;
            $completedMilestones = $proj->milestones ? $proj->milestones->where('status', 'completed')->count() : 0;

            return [
                'id' => $proj->id,
                'code' => $proj->code,
                'name' => $proj->name,
                'client' => $proj->client,
                'status' => $proj->status,
                'risk_level' => $proj->risk_level ?: 'low',
                'progress' => (int) ($proj->progress ?? 0),
                'target_progress' => (int) ($proj->target_progress ?? 0),
                'deviation' => $dev,
                'pic_id' => $proj->pic_id,
                'pic_name' => $proj->pic_name ?: ($proj->pic ? $proj->pic->name : 'Belum Ditugaskan'),
                'deadline' => $proj->deadline ? Carbon::parse($proj->deadline)->format('d M Y') : null,
                'is_deadline_overdue' => $proj->deadline && $proj->deadline < $today,
                'flag_reasons' => $reasons,
                'urgency_score' => $urgencyScore,
                'milestones_completed' => $completedMilestones,
                'milestones_total' => $totalMilestones,
                'blockers' => array_slice($projBlockers, 0, 3),
            ];
        })
        ->filter(fn($p) => !empty($p['flag_reasons']))
        ->sortByDesc('urgency_score')
        ->values()
        ->take(6);

        // =========================================================================
        // 6. TASK REVIEW BACKLOG (Tasks awaiting PM technical approval)
        // =========================================================================
        $inReviewTasks = Task::with(['project.pic:id,name', 'assignee:id,name'])
            ->where('status', 'in_review')
            ->where('is_completed', false)
            ->orderBy('updated_at', 'asc')
            ->get();

        $totalInReview = $inReviewTasks->count();

        $reviewItems = $inReviewTasks->map(function ($task) use ($now) {
            $updatedAt = $task->updated_at ? Carbon::parse($task->updated_at) : Carbon::parse($task->created_at);
            $waitingDays = round($updatedAt->diffInHours($now) / 24, 1);
            $isOverdue = $waitingDays >= 3.0;

            $pmName = $task->project && $task->project->pic ? $task->project->pic->name : ($task->project->pic_name ?? 'Project Manager');

            return [
                'id' => $task->id,
                'title' => $task->title,
                'priority' => $task->priority,
                'project_id' => $task->project_id,
                'project_name' => $task->project ? $task->project->name : '-',
                'project_code' => $task->project ? $task->project->code : '-',
                'pm_name' => $pmName,
                'assignee_name' => $task->assignee ? $task->assignee->name : ($task->assignee_name ?: '-'),
                'waiting_days' => $waitingDays,
                'is_overdue' => $isOverdue,
                'submitted_at' => $updatedAt->format('d M Y, H:i'),
            ];
        });

        $overdueReviewCount = $reviewItems->where('is_overdue', true)->count();

        $reviewBacklog = [
            'total_in_review' => $totalInReview,
            'overdue_count' => $overdueReviewCount,
            'note' => 'Antrean persetujuan teknis Project Manager. Tugas yang menunggu review lebih dari 3 hari berpotensi memperlambat sprint operasional.',
            'items' => $reviewItems->take(6)->values(),
        ];

        // =========================================================================
        // 7. RECENT EXECUTIVE FEED (Strategic event stream)
        // =========================================================================
        $feedItems = collect();

        // Feed A: Published Project Reports (Formal reports published by PM)
        $publishedReports = ProjectReport::with(['project:id,name,code', 'creator:id,name'])
            ->where('status', 'published')
            ->orderBy('published_at', 'desc')
            ->limit(5)
            ->get();

        foreach ($publishedReports as $rpt) {
            $feedItems->push([
                'id' => 'report_' . $rpt->id,
                'type' => 'project_report_published',
                'badge' => ['label' => 'Laporan Mingguan', 'bg' => 'bg-[#FFD83D]', 'text' => 'text-[#171717]'],
                'title' => "Laporan Mingguan {$rpt->report_number} Diterbitkan",
                'description' => "Laporan kemajuan proyek \"{$rpt->project?->name}\" periode " . Carbon::parse($rpt->period_start)->format('d M') . ' – ' . Carbon::parse($rpt->period_end)->format('d M Y') . " telah diterbitkan oleh {$rpt->creator?->name}.",
                'project_name' => $rpt->project?->name,
                'project_code' => $rpt->project?->code,
                'actor_name' => $rpt->creator?->name ?: 'Project Manager',
                'timestamp' => $rpt->published_at ? Carbon::parse($rpt->published_at)->toIso8601String() : $rpt->created_at->toIso8601String(),
                'time_ago' => $rpt->published_at ? Carbon::parse($rpt->published_at)->diffForHumans() : $rpt->created_at->diffForHumans(),
            ]);
        }

        // Feed B: Key Activities from DB
        $activities = Activity::orderBy('created_at', 'desc')->limit(10)->get();
        foreach ($activities as $act) {
            $feedItems->push([
                'id' => 'act_' . $act->id,
                'type' => 'system_activity',
                'badge' => ['label' => 'Aktivitas Tim', 'bg' => 'bg-[#B8A0F0]', 'text' => 'text-[#171717]'],
                'title' => "{$act->user_name} {$act->action}",
                'description' => "Aktivitas pada proyek \"{$act->project_name}\" melibatkan {$act->target_name}.",
                'project_name' => $act->project_name,
                'project_code' => null,
                'actor_name' => $act->user_name,
                'timestamp' => $act->created_at ? $act->created_at->toIso8601String() : null,
                'time_ago' => $act->created_at ? $act->created_at->diffForHumans() : 'baru saja',
            ]);
        }

        $sortedFeed = $feedItems->sortByDesc('timestamp')->take(8)->values();

        // =========================================================================
        // 8. HISTORICAL TREND (Authentic snapshots from project_reports)
        // =========================================================================
        $publishedReportsForTrend = ProjectReport::where('status', 'published')
            ->whereNotNull('period_start')
            ->whereNotNull('period_end')
            ->orderBy('period_start', 'asc')
            ->get();

        // Group reports by period range
        $groupedPeriods = $publishedReportsForTrend->groupBy(function ($r) {
            return $r->period_start . '_' . $r->period_end;
        });

        $hasSufficientTrendData = $groupedPeriods->count() >= 2;
        $trendPeriods = [];

        foreach ($groupedPeriods as $periodKey => $group) {
            [$pStart, $pEnd] = explode('_', $periodKey);
            $label = Carbon::parse($pStart)->format('d M') . ' – ' . Carbon::parse($pEnd)->format('d M');

            $progs = [];
            $onTracks = 0;
            $atRisks = 0;
            $delayeds = 0;

            foreach ($group as $report) {
                if ($report->snapshot_data) {
                    $snap = is_string($report->snapshot_data)
                        ? json_decode($report->snapshot_data, true)
                        : $report->snapshot_data;

                    if (isset($snap['progress'])) {
                        $progs[] = (float) $snap['progress'];
                    }
                    if (isset($snap['status'])) {
                        if ($snap['status'] === 'on_track') $onTracks++;
                        if ($snap['status'] === 'at_risk') $atRisks++;
                        if ($snap['status'] === 'delayed') $delayeds++;
                    }
                }
            }

            $avgProg = count($progs) > 0 ? round(array_sum($progs) / count($progs), 1) : 0.0;

            $trendPeriods[] = [
                'period_label' => $label,
                'period_start' => $pStart,
                'period_end' => $pEnd,
                'reports_count' => $group->count(),
                'avg_portfolio_progress' => $avgProg,
                'on_track_count' => $onTracks,
                'at_risk_count' => $atRisks,
                'delayed_count' => $delayeds,
            ];
        }

        $trendData = [
            'has_sufficient_data' => $hasSufficientTrendData,
            'available_periods_count' => $groupedPeriods->count(),
            'message' => $hasSufficientTrendData
                ? "Tren kemajuan dihitung dari {$groupedPeriods->count()} periode laporan mingguan yang telah dipublikasikan."
                : ($groupedPeriods->count() === 1
                    ? 'Data historis mingguan saat ini baru tersedia 1 periode laporan (' . ($trendPeriods[0]['period_label'] ?? '') . '). Tren multi-periode akan tersaji secara otomatis seiring bertambahnya publikasi laporan mingguan.'
                    : 'Belum ada laporan mingguan proyek yang dipublikasikan. Data tren historis akan tersedia setelah Project Manager mempublikasikan laporan.'),
            'periods' => $trendPeriods,
            'trend_is_estimated' => false, // Strictly false: no synthetic estimation!
        ];

        // =========================================================================
        // 9. RETURN UNIFIED EXECUTIVE COMMAND CENTER RESPONSE
        // =========================================================================
        return response()->json([
            'success' => true,
            'executive' => [
                'name' => $user->name,
                'role' => $user->role,
                'email' => $user->email,
            ],
            'meta' => [
                'as_of_date' => Carbon::now()->translatedFormat('l, d F Y'),
                'as_of_time' => Carbon::now()->format('H:i') . ' WIB',
                'refreshed_at' => Carbon::now()->toIso8601String(),
            ],
            'company_health_index' => $chiData,
            'portfolio_snapshot' => $portfolioSnapshot,
            'progress_analysis' => $progressAnalysis,
            'attention_radar' => $radarProjects,
            'review_backlog' => $reviewBacklog,
            'executive_feed' => $sortedFeed,
            'historical_trend' => $trendData,
        ]);
    }

    /**
     * Strategic Project Portfolio Endpoint
     * Accessible by: pimpinan, admin
     */
    public function portfolio(Request $request)
    {
        $user = $request->user();

        // Defense-in-depth role check
        if (!$user || !in_array($user->role, ['admin', 'pimpinan'], true)) {
            return response()->json([
                'message' => 'Akses ditolak. Fitur Strategic Project Portfolio hanya dapat diakses oleh Pimpinan dan Administrator.',
            ], 403);
        }

        $today = Carbon::today()->toDateString();
        $now = Carbon::now();

        // =========================================================================
        // 1. QUERY ALL PROJECTS WITH RELATIONS
        // =========================================================================
        $allProjects = Project::with([
            'pic:id,name,email,role',
            'milestones' => function ($q) {
                $q->orderBy('phase_order', 'asc')->orderBy('due_date', 'asc');
            },
            'tasks' => function ($q) {
                $q->select('id', 'project_id', 'title', 'priority', 'status', 'is_completed', 'deadline', 'assignee_id', 'assignee_name');
            },
            'reports' => function ($q) {
                $q->orderBy('period_end', 'desc');
            }
        ])->orderBy('created_at', 'desc')->get();

        // Sync and format project data
        $formattedProjects = [];
        $totalProjects = $allProjects->count();
        $completedCount = 0;
        $onTrackCount = 0;
        $atRiskCount = 0;
        $delayedCount = 0;
        $activeCount = 0;

        $targetSum = 0;
        $actualSum = 0;
        $projectsWithTargetCount = 0;
        $aheadCount = 0;
        $onTargetCount = 0;
        $behindCount = 0;
        $noTargetCount = 0;

        // Fetch all active blockers from task_updates for quick in-memory lookup
        $taskIds = $allProjects->flatMap->tasks->pluck('id')->filter()->unique();
        $latestBlockers = collect();
        if ($taskIds->isNotEmpty()) {
            $latestBlockers = TaskUpdate::whereIn('task_id', $taskIds)
                ->whereNotNull('blocker')
                ->where('blocker', '!=', '')
                ->orderBy('created_at', 'desc')
                ->get()
                ->unique('task_id');
        }

        foreach ($allProjects as $proj) {
            $isCompleted = ($proj->status === 'completed');
            if ($isCompleted) {
                $completedCount++;
            } else {
                $activeCount++;
                if ($proj->status === 'on_track') $onTrackCount++;
                elseif ($proj->status === 'at_risk') $atRiskCount++;
                elseif ($proj->status === 'delayed') $delayedCount++;
            }

            // Actual progress
            $actualProg = (int) ($proj->progress ?? 0);

            // Target progress handling: strictly authentic, null if not set
            $hasTarget = !is_null($proj->target_progress) && (int) $proj->target_progress > 0;
            $targetProg = $hasTarget ? (int) $proj->target_progress : null;

            // Variance calculation: Actual - Target (only if target exists)
            $variance = null;
            $varianceStatus = 'no_target';
            $targetAchievementRate = null;

            if ($hasTarget) {
                $variance = $actualProg - $targetProg;
                $targetSum += $targetProg;
                $actualSum += $actualProg;
                $projectsWithTargetCount++;

                if ($variance > 0) {
                    $varianceStatus = 'ahead';
                    $aheadCount++;
                } elseif ($variance === 0) {
                    $varianceStatus = 'on_track';
                    $onTargetCount++;
                } else {
                    $varianceStatus = 'behind';
                    $behindCount++;
                }

                $targetAchievementRate = round(($actualProg / $targetProg) * 100, 1);
            } else {
                $noTargetCount++;
            }

            // Tasks calculation
            $projTasks = $proj->tasks;
            $totalTasks = $projTasks->count();
            $completedTasks = $projTasks->filter(function ($t) {
                return $t->is_completed || in_array($t->status, ['completed', 'done'], true);
            })->count();
            $inReviewTasks = $projTasks->where('status', 'in_review')->count();
            $inProgressTasks = $projTasks->where('status', 'in_progress')->count();
            $pendingTasks = $projTasks->where('status', 'pending')->count();
            $overdueTasks = $projTasks->filter(function ($t) use ($today) {
                return !$t->is_completed
                    && !in_array($t->status, ['completed', 'done'], true)
                    && !empty($t->deadline)
                    && $t->deadline < $today;
            })->values();

            // Next milestone
            $upcomingMilestone = $proj->milestones->first(function ($m) {
                return in_array($m->status, ['pending', 'in_progress'], true);
            });
            $nextMilestoneData = null;
            if ($upcomingMilestone) {
                $nextMilestoneData = [
                    'id' => $upcomingMilestone->id,
                    'title' => $upcomingMilestone->title,
                    'due_date' => $upcomingMilestone->due_date ? Carbon::parse($upcomingMilestone->due_date)->format('Y-m-d') : null,
                    'status' => $upcomingMilestone->status,
                    'progress' => (int) ($upcomingMilestone->progress ?? 0),
                    'is_overdue' => !empty($upcomingMilestone->due_date) && $upcomingMilestone->due_date < $today,
                ];
            }

            // Project start date (from earliest milestone or project created_at)
            $earliestMsStart = $proj->milestones->pluck('start_date')->filter()->sort()->first();
            $startDate = $earliestMsStart
                ? Carbon::parse($earliestMsStart)->format('Y-m-d')
                : $proj->created_at->format('Y-m-d');

            // Blockers count
            $projTaskIds = $projTasks->pluck('id');
            $activeBlockers = $latestBlockers->whereIn('task_id', $projTaskIds);
            $activeBlockersCount = $activeBlockers->count();

            // Risk Assessment
            $riskReasons = [];
            if ($proj->status === 'delayed') {
                $riskReasons[] = 'Status proyek terlambat (Delayed)';
            }
            if ($hasTarget && $variance < -10) {
                $riskReasons[] = 'Deviasi progres tertinggal ' . abs($variance) . '% dari target';
            }
            if ($overdueTasks->count() > 0) {
                $riskReasons[] = $overdueTasks->count() . ' tugas melewati deadline';
            }
            if ($activeBlockersCount > 0) {
                $riskReasons[] = $activeBlockersCount . ' kendala (blocker) aktif di lapangan';
            }
            if ($proj->milestones->where('status', '!=', 'completed')->filter(function ($m) use ($today) {
                return !empty($m->due_date) && $m->due_date < $today;
            })->count() > 0) {
                $riskReasons[] = 'Milestone melewati target jadwal';
            }

            $riskLevelCalculated = $proj->risk_level ?? 'low';
            if ($proj->status === 'delayed' || $activeBlockersCount > 0 || ($hasTarget && $variance <= -20)) {
                $riskLevelCalculated = 'high';
            } elseif ($proj->status === 'at_risk' || $overdueTasks->count() > 0 || ($hasTarget && $variance < 0)) {
                $riskLevelCalculated = 'medium';
            }

            // Latest Report
            $latestReport = $proj->reports->first();
            $latestReportData = null;
            if ($latestReport) {
                $latestReportData = [
                    'id' => $latestReport->id,
                    'report_number' => $latestReport->report_number,
                    'period_start' => $latestReport->period_start ? Carbon::parse($latestReport->period_start)->format('Y-m-d') : null,
                    'period_end' => $latestReport->period_end ? Carbon::parse($latestReport->period_end)->format('Y-m-d') : null,
                    'status' => $latestReport->status,
                    'published_at' => $latestReport->published_at ? Carbon::parse($latestReport->published_at)->toIso8601String() : null,
                ];
            }

            $formattedProjects[] = [
                'id' => $proj->id,
                'code' => $proj->code,
                'name' => $proj->name,
                'client' => $proj->client,
                'category' => $proj->category ?? 'web',
                'status' => $proj->status,
                'risk_level' => $riskLevelCalculated,
                'risk_factor' => $proj->risk_factor,
                'is_active' => (bool) $proj->is_active,
                'pic' => $proj->pic ? [
                    'id' => $proj->pic->id,
                    'name' => $proj->pic->name,
                    'email' => $proj->pic->email,
                    'role' => $proj->pic->role,
                ] : [
                    'id' => null,
                    'name' => $proj->pic_name ?? 'Belum Ditugaskan',
                    'email' => null,
                    'role' => 'project_manager',
                ],
                'actual_progress' => $actualProg,
                'has_target' => $hasTarget,
                'target_progress' => $targetProg,
                'variance' => $variance,
                'variance_status' => $varianceStatus,
                'target_achievement_rate' => $targetAchievementRate,
                'start_date' => $startDate,
                'deadline' => $proj->deadline ? Carbon::parse($proj->deadline)->format('Y-m-d') : null,
                'next_milestone' => $nextMilestoneData,
                'tasks_summary' => [
                    'total' => $totalTasks,
                    'completed' => $completedTasks,
                    'in_review' => $inReviewTasks,
                    'in_progress' => $inProgressTasks,
                    'pending' => $pendingTasks,
                    'overdue' => $overdueTasks->count(),
                ],
                'active_blockers_count' => $activeBlockersCount,
                'risk_indicator' => [
                    'level' => $riskLevelCalculated,
                    'reasons' => $riskReasons,
                ],
                'latest_report' => $latestReportData,
                'created_at' => $proj->created_at->toIso8601String(),
            ];
        }

        // =========================================================================
        // 2. PORTFOLIO OVERVIEW
        // =========================================================================
        $portfolioOverview = [
            'total_projects' => $totalProjects,
            'active_projects' => $activeCount,
            'on_track_projects' => $onTrackCount,
            'at_risk_projects' => $atRiskCount,
            'delayed_projects' => $delayedCount,
            'completed_projects' => $completedCount,
        ];

        // =========================================================================
        // 3. TARGET VS ACTUAL AGGREGATE ANALYSIS
        // =========================================================================
        $averageTarget = $projectsWithTargetCount > 0 ? round($targetSum / $projectsWithTargetCount, 1) : null;
        $averageActual = $totalProjects > 0 ? round($allProjects->avg('progress'), 1) : 0.0;
        $portfolioVariance = $averageTarget !== null ? round($averageActual - $averageTarget, 1) : null;
        $portfolioAchievementRate = ($averageTarget !== null && $averageTarget > 0)
            ? round(($averageActual / $averageTarget) * 100, 1)
            : null;

        $targetVsActualAnalysis = [
            'has_target_data' => $projectsWithTargetCount > 0,
            'average_target_progress' => $averageTarget,
            'average_actual_progress' => $averageActual,
            'portfolio_variance' => $portfolioVariance,
            'portfolio_achievement_rate' => $portfolioAchievementRate,
            'projects_ahead_count' => $aheadCount,
            'projects_on_track_count' => $onTargetCount,
            'projects_behind_count' => $behindCount,
            'projects_no_target_count' => $noTargetCount,
            'period_context' => 'Data aktual per ' . Carbon::now()->translatedFormat('d F Y') . ' berdasarkan baseline target proyek yang tersimpan di sistem.',
        ];

        // =========================================================================
        // 4. MILESTONE TIMELINE ACROSS PORTFOLIO
        // =========================================================================
        $allMilestones = Milestone::with('project:id,name,code,pic_id,pic_name')
            ->orderBy('due_date', 'asc')
            ->orderBy('phase_order', 'asc')
            ->get();

        $milestoneTimeline = $allMilestones->map(function ($ms) use ($today) {
            $isOverdue = ($ms->status !== 'completed' && !empty($ms->due_date) && $ms->due_date < $today);
            $category = 'upcoming';
            if ($ms->status === 'completed') {
                $category = 'completed';
            } elseif ($isOverdue) {
                $category = 'overdue';
            } elseif ($ms->status === 'in_progress') {
                $category = 'on_track';
            }

            return [
                'id' => $ms->id,
                'title' => $ms->title,
                'description' => $ms->description,
                'project_id' => $ms->project_id,
                'project_name' => $ms->project ? $ms->project->name : 'Unknown Project',
                'project_code' => $ms->project ? $ms->project->code : 'PKM-000',
                'phase_order' => (int) $ms->phase_order,
                'status' => $ms->status,
                'progress' => (int) ($ms->progress ?? 0),
                'start_date' => $ms->start_date ? Carbon::parse($ms->start_date)->format('Y-m-d') : null,
                'due_date' => $ms->due_date ? Carbon::parse($ms->due_date)->format('Y-m-d') : null,
                'is_overdue' => $isOverdue,
                'timeline_category' => $category,
            ];
        });

        // =========================================================================
        // 5. PM LEADERSHIP SCORECARD (Authentic data per Project Manager)
        // =========================================================================
        $pmUsers = User::where('role', 'project_manager')->orderBy('name', 'asc')->get();
        $pmScorecards = [];

        foreach ($pmUsers as $pm) {
            $pmProjects = $allProjects->where('pic_id', $pm->id);
            $pmTotalProjs = $pmProjects->count();
            $pmOnTrack = $pmProjects->where('status', 'on_track')->count();
            $pmDelayed = $pmProjects->where('status', 'delayed')->count();
            $pmAtRisk = $pmProjects->where('status', 'at_risk')->count();
            $pmCompleted = $pmProjects->where('status', 'completed')->count();
            $pmAvgProgress = $pmTotalProjs > 0 ? round($pmProjects->avg('progress'), 1) : 0.0;

            $pmProjIds = $pmProjects->pluck('id');
            $pmTasks = Task::whereIn('project_id', $pmProjIds)->get();
            $pmTotalTasks = $pmTasks->count();
            $pmCompletedTasks = $pmTasks->filter(function ($t) {
                return $t->is_completed || in_array($t->status, ['completed', 'done'], true);
            })->count();
            $pmTaskCompletionRate = $pmTotalTasks > 0 ? round(($pmCompletedTasks / $pmTotalTasks) * 100, 1) : 0.0;
            $pmOverdueTasks = $pmTasks->filter(function ($t) use ($today) {
                return !$t->is_completed
                    && !in_array($t->status, ['completed', 'done'], true)
                    && !empty($t->deadline)
                    && $t->deadline < $today;
            })->count();

            $pmMilestones = Milestone::whereIn('project_id', $pmProjIds)->get();
            $pmTotalMilestones = $pmMilestones->count();
            $pmCompletedMilestones = $pmMilestones->where('status', 'completed')->count();
            $pmMilestoneCompletionRate = $pmTotalMilestones > 0 ? round(($pmCompletedMilestones / $pmTotalMilestones) * 100, 1) : 0.0;

            $pmBlockersCount = 0;
            if ($pmTasks->isNotEmpty()) {
                $pmBlockersCount = TaskUpdate::whereIn('task_id', $pmTasks->pluck('id'))
                    ->whereNotNull('blocker')
                    ->where('blocker', '!=', '')
                    ->distinct('task_id')
                    ->count('task_id');
            }

            $pmReports = ProjectReport::whereIn('project_id', $pmProjIds)->get();
            $pmTotalReports = $pmReports->count();
            $pmPublishedReports = $pmReports->where('status', 'published')->count();
            $latestReportPublished = $pmReports->where('status', 'published')->sortByDesc('published_at')->first();

            $pmScorecards[] = [
                'pm_id' => $pm->id,
                'pm_name' => $pm->name,
                'pm_email' => $pm->email,
                'total_projects' => $pmTotalProjs,
                'on_track_projects' => $pmOnTrack,
                'delayed_projects' => $pmDelayed,
                'at_risk_projects' => $pmAtRisk,
                'completed_projects' => $pmCompleted,
                'average_progress' => $pmAvgProgress,
                'total_tasks' => $pmTotalTasks,
                'completed_tasks' => $pmCompletedTasks,
                'task_completion_rate' => $pmTaskCompletionRate,
                'task_overdue' => $pmOverdueTasks,
                'total_milestones' => $pmTotalMilestones,
                'completed_milestones' => $pmCompletedMilestones,
                'milestone_completion_rate' => $pmMilestoneCompletionRate,
                'active_blockers_count' => $pmBlockersCount,
                'weekly_reports_count' => $pmPublishedReports,
                'latest_report_date' => $latestReportPublished ? Carbon::parse($latestReportPublished->published_at)->format('d M Y') : null,
                'has_sufficient_data' => ($pmTotalProjs > 0 && $pmTotalTasks > 0),
            ];
        }

        // =========================================================================
        // 6. STRATEGIC ATTENTION (Factual evidence separated from recommendation)
        // =========================================================================
        $strategicAttention = [];

        foreach ($formattedProjects as $p) {
            $reasons = $p['risk_indicator']['reasons'];
            if (!empty($reasons) || $p['status'] === 'delayed' || $p['status'] === 'at_risk' || $p['active_blockers_count'] > 0) {
                $severity = 'sedang';
                if ($p['status'] === 'delayed' || $p['active_blockers_count'] > 0 || ($p['has_target'] && $p['variance'] <= -20)) {
                    $severity = 'kritis';
                } elseif ($p['status'] === 'at_risk' || ($p['has_target'] && $p['variance'] < 0)) {
                    $severity = 'tinggi';
                }

                $facts = [];
                $recommendations = [];

                if ($p['status'] === 'delayed') {
                    $facts[] = "Status proyek resmi tercatat Delayed di sistem.";
                    $recommendations[] = "Pimpinan perlu meminta revisi roadmap dan mitigasi keterlambatan dari PM " . $p['pic']['name'] . ".";
                }
                if ($p['has_target'] && $p['variance'] < 0) {
                    $facts[] = "Progres aktual (" . $p['actual_progress'] . "%) tertinggal " . abs($p['variance']) . "% dari target (" . $p['target_progress'] . "%).";
                    $recommendations[] = "Lakukan evaluasi kendala eksekusi dan verifikasi kapasitas tim pengerjaan.";
                }
                if ($p['active_blockers_count'] > 0) {
                    $facts[] = "Terdapat " . $p['active_blockers_count'] . " blocker aktif di lapangan yang dilaporkan tim pengerjaan.";
                    $recommendations[] = "Koordinasi dengan divisi terkait untuk segera mengeliminasi hambatan operasional.";
                }
                if ($p['tasks_summary']['overdue'] > 0) {
                    $facts[] = $p['tasks_summary']['overdue'] . " tugas aktif telah melewati batas waktu penyelesaian.";
                    $recommendations[] = "Dorong penyelesaian backlog tugas prioritas oleh tim.";
                }
                if ($p['latest_report'] === null) {
                    $facts[] = "Belum ada laporan perkembangan mingguan yang diterbitkan untuk proyek ini.";
                    $recommendations[] = "Instruksikan Project Manager untuk menerbitkan laporan mingguan perdana.";
                }

                if (!empty($facts)) {
                    $strategicAttention[] = [
                        'project_id' => $p['id'],
                        'project_code' => $p['code'],
                        'project_name' => $p['name'],
                        'pm_name' => $p['pic']['name'],
                        'severity' => $severity,
                        'factual_data' => implode(' ', $facts),
                        'recommendation' => implode(' ', array_unique($recommendations)),
                    ];
                }
            }
        }

        // Sort attention items: kritis first, then tinggi, then sedang
        $severityWeight = ['kritis' => 3, 'tinggi' => 2, 'sedang' => 1];
        usort($strategicAttention, function ($a, $b) use ($severityWeight) {
            return ($severityWeight[$b['severity']] ?? 0) <=> ($severityWeight[$a['severity']] ?? 0);
        });

        // =========================================================================
        // 7. RETURN STRUCTURED STRATEGIC PORTFOLIO RESPONSE
        // =========================================================================
        return response()->json([
            'success' => true,
            'meta' => [
                'as_of_date' => Carbon::now()->translatedFormat('l, d F Y'),
                'as_of_time' => Carbon::now()->format('H:i') . ' WIB',
                'refreshed_at' => Carbon::now()->toIso8601String(),
            ],
            'portfolio_overview' => $portfolioOverview,
            'target_vs_actual_analysis' => $targetVsActualAnalysis,
            'projects' => $formattedProjects,
            'milestone_timeline' => $milestoneTimeline,
            'pm_scorecards' => $pmScorecards,
            'strategic_attention' => $strategicAttention,
        ]);
    }

    /**
     * Strategic Project Portfolio Detail Endpoint
     * Accessible by: pimpinan, admin
     */
    public function portfolioDetail(Request $request, $id)
    {
        $user = $request->user();

        // Defense-in-depth role check
        if (!$user || !in_array($user->role, ['admin', 'pimpinan'], true)) {
            return response()->json([
                'message' => 'Akses ditolak. Fitur Strategic Project Portfolio hanya dapat diakses oleh Pimpinan dan Administrator.',
            ], 403);
        }

        if (!is_numeric($id)) {
            return response()->json([
                'message' => 'ID proyek tidak valid.',
            ], 404);
        }

        $project = Project::with([
            'pic:id,name,email,role,phone',
            'milestones' => function ($q) {
                $q->orderBy('phase_order', 'asc')->orderBy('due_date', 'asc');
            },
            'tasks' => function ($q) {
                $q->with([
                    'assignee:id,name,email,role',
                    'checklists' => function ($c) { $c->orderBy('position', 'asc'); },
                    'updates' => function ($u) { $u->orderBy('created_at', 'desc'); },
                    'latestReview.reviewer:id,name,role'
                ])->orderBy('created_at', 'desc');
            },
            'reports' => function ($q) {
                $q->with('creator:id,name,email,role')->orderBy('period_end', 'desc');
            }
        ])->find($id);

        if (!$project) {
            return response()->json([
                'message' => 'Proyek tidak ditemukan.',
            ], 404);
        }

        $today = Carbon::today()->toDateString();

        // Sync actual progress
        $actualProgress = $project->syncProgress();
        $hasTarget = !is_null($project->target_progress) && (int) $project->target_progress > 0;
        $targetProgress = $hasTarget ? (int) $project->target_progress : null;
        $variance = $hasTarget ? ($actualProgress - $targetProgress) : null;
        $achievementRate = ($hasTarget && $targetProgress > 0)
            ? round(($actualProgress / $targetProgress) * 100, 1)
            : null;

        // Tasks summary
        $tasks = $project->tasks;
        $totalTasks = $tasks->count();
        $completedTasks = $tasks->filter(function ($t) {
            return $t->is_completed || in_array($t->status, ['completed', 'done'], true);
        })->values();
        $inReviewTasks = $tasks->where('status', 'in_review')->values();
        $inProgressTasks = $tasks->where('status', 'in_progress')->values();
        $pendingTasks = $tasks->where('status', 'pending')->values();
        $overdueTasks = $tasks->filter(function ($t) use ($today) {
            return !$t->is_completed
                && !in_array($t->status, ['completed', 'done'], true)
                && !empty($t->deadline)
                && $t->deadline < $today;
        })->values();

        // Active blockers in this project
        $activeBlockers = [];
        foreach ($tasks as $t) {
            $latestUp = $t->updates->first();
            if ($latestUp && !empty($latestUp->blocker)) {
                $activeBlockers[] = [
                    'task_id' => $t->id,
                    'task_title' => $t->title,
                    'reported_by' => $latestUp->user_name ?? ($t->assignee ? $t->assignee->name : 'Anggota Tim'),
                    'blocker' => $latestUp->blocker,
                    'notes' => $latestUp->notes,
                    'reported_at' => $latestUp->created_at->toIso8601String(),
                ];
            }
        }

        // Formatted milestones
        $formattedMilestones = $project->milestones->map(function ($ms) use ($today) {
            $isOverdue = ($ms->status !== 'completed' && !empty($ms->due_date) && $ms->due_date < $today);
            $category = 'upcoming';
            if ($ms->status === 'completed') {
                $category = 'completed';
            } elseif ($isOverdue) {
                $category = 'overdue';
            } elseif ($ms->status === 'in_progress') {
                $category = 'on_track';
            }

            return [
                'id' => $ms->id,
                'title' => $ms->title,
                'description' => $ms->description,
                'phase_order' => (int) $ms->phase_order,
                'status' => $ms->status,
                'progress' => (int) ($ms->progress ?? 0),
                'start_date' => $ms->start_date ? Carbon::parse($ms->start_date)->format('Y-m-d') : null,
                'due_date' => $ms->due_date ? Carbon::parse($ms->due_date)->format('Y-m-d') : null,
                'is_overdue' => $isOverdue,
                'timeline_category' => $category,
            ];
        });

        // Formatted reports
        $formattedReports = $project->reports->map(function ($rep) {
            return [
                'id' => $rep->id,
                'report_number' => $rep->report_number,
                'period_start' => $rep->period_start ? Carbon::parse($rep->period_start)->format('Y-m-d') : null,
                'period_end' => $rep->period_end ? Carbon::parse($rep->period_end)->format('Y-m-d') : null,
                'status' => $rep->status,
                'executive_summary' => $rep->executive_summary,
                'completed_work' => $rep->completed_work,
                'challenges' => $rep->challenges,
                'risks' => $rep->risks,
                'next_week_plan' => $rep->next_week_plan,
                'published_at' => $rep->published_at ? Carbon::parse($rep->published_at)->toIso8601String() : null,
                'creator_name' => $rep->creator ? $rep->creator->name : 'Project Manager',
            ];
        });

        return response()->json([
            'success' => true,
            'project' => [
                'id' => $project->id,
                'code' => $project->code,
                'name' => $project->name,
                'client' => $project->client,
                'category' => $project->category ?? 'web',
                'status' => $project->status,
                'risk_level' => $project->risk_level ?? 'low',
                'risk_factor' => $project->risk_factor,
                'is_active' => (bool) $project->is_active,
                'deadline' => $project->deadline ? Carbon::parse($project->deadline)->format('Y-m-d') : null,
                'created_at' => $project->created_at->toIso8601String(),
                'pic' => $project->pic ? [
                    'id' => $project->pic->id,
                    'name' => $project->pic->name,
                    'email' => $project->pic->email,
                    'role' => $project->pic->role,
                    'phone' => $project->pic->phone ?? null,
                ] : [
                    'id' => null,
                    'name' => $project->pic_name ?? 'Belum Ditugaskan',
                    'email' => null,
                    'role' => 'project_manager',
                    'phone' => null,
                ],
                'actual_progress' => $actualProgress,
                'has_target' => $hasTarget,
                'target_progress' => $targetProgress,
                'variance' => $variance,
                'achievement_rate' => $achievementRate,
            ],
            'tasks_summary' => [
                'total' => $totalTasks,
                'completed' => $completedTasks->count(),
                'in_review' => $inReviewTasks->count(),
                'in_progress' => $inProgressTasks->count(),
                'pending' => $pendingTasks->count(),
                'overdue' => $overdueTasks->count(),
                'overdue_list' => $overdueTasks->map(function ($t) use ($today) {
                    $days = Carbon::parse($t->deadline)->diffInDays(Carbon::parse($today));
                    return [
                        'id' => $t->id,
                        'title' => $t->title,
                        'priority' => $t->priority,
                        'deadline' => Carbon::parse($t->deadline)->format('Y-m-d'),
                        'days_overdue' => (int) $days,
                        'assignee_name' => $t->assignee_name ?? ($t->assignee ? $t->assignee->name : 'Unassigned'),
                    ];
                }),
            ],
            'active_blockers' => $activeBlockers,
            'milestones' => $formattedMilestones,
            'reports' => $formattedReports,
        ]);
    }

    /**
     * Business Performance & KPI Endpoint
     * Accessible by: pimpinan, admin
     */
    public function performance(Request $request)
    {
        $user = $request->user();

        // Defense-in-depth role check
        if (!$user || !in_array($user->role, ['admin', 'pimpinan'], true)) {
            return response()->json([
                'message' => 'Akses ditolak. Fitur Business Performance & KPI hanya dapat diakses oleh Pimpinan dan Administrator.',
            ], 403);
        }

        $period = $request->query('period', 'all_time'); // 'all_time', 'this_month', 'last_month'
        $today = Carbon::today()->toDateString();
        $now = Carbon::now();

        // Period definitions
        $periodStart = null;
        $periodEnd = null;
        $prevPeriodStart = null;
        $prevPeriodEnd = null;
        $periodLabel = 'Semua Waktu (All-Time Cumulative)';
        $comparisonLabel = 'Dibandingkan baseline awal';

        if ($period === 'this_month') {
            $periodStart = Carbon::now()->startOfMonth();
            $periodEnd = Carbon::now()->endOfMonth();
            $prevPeriodStart = Carbon::now()->subMonth()->startOfMonth();
            $prevPeriodEnd = Carbon::now()->subMonth()->endOfMonth();
            $periodLabel = Carbon::now()->translatedFormat('F Y');
            $comparisonLabel = 'vs Bulan Lalu (' . Carbon::now()->subMonth()->translatedFormat('M Y') . ')';
        } elseif ($period === 'last_month') {
            $periodStart = Carbon::now()->subMonth()->startOfMonth();
            $periodEnd = Carbon::now()->subMonth()->endOfMonth();
            $prevPeriodStart = Carbon::now()->subMonths(2)->startOfMonth();
            $prevPeriodEnd = Carbon::now()->subMonths(2)->endOfMonth();
            $periodLabel = Carbon::now()->subMonth()->translatedFormat('F Y');
            $comparisonLabel = 'vs 2 Bulan Lalu (' . Carbon::now()->subMonths(2)->translatedFormat('M Y') . ')';
        }

        // =========================================================================
        // 1. QUERY CORE DATA
        // =========================================================================
        $projectsQuery = Project::with(['pic:id,name,email,role']);
        $tasksQuery = Task::with(['assignee:id,name,email,role', 'project:id,name,code,pic_id']);
        $milestonesQuery = Milestone::with('project:id,name,code');

        if ($periodStart && $periodEnd) {
            $projectsQuery->whereBetween('created_at', [$periodStart, $periodEnd]);
            $tasksQuery->whereBetween('created_at', [$periodStart, $periodEnd]);
            $milestonesQuery->whereBetween('created_at', [$periodStart, $periodEnd]);
        }

        $projects = $projectsQuery->get();
        $tasks = $tasksQuery->get();
        $milestones = $milestonesQuery->get();

        // Fallback for overview if filtered period has 0 projects: provide all-time projects count context
        $allProjects = Project::all();
        $allTasks = Task::all();
        $allMilestones = Milestone::all();

        // =========================================================================
        // 2. CORE KPI 1: PROJECT COMPLETION RATE
        // Formula: (Completed Projects / Total Projects) * 100%
        // =========================================================================
        $targetProjectsSet = ($periodStart && $periodEnd && $projects->count() > 0) ? $projects : $allProjects;
        $totalProjectsCount = $targetProjectsSet->count();
        $completedProjectsCount = $targetProjectsSet->where('status', 'completed')->count();
        $activeProjectsCount = $targetProjectsSet->where('status', '!=', 'completed')->count();

        $projectCompletionRate = $totalProjectsCount > 0
            ? round(($completedProjectsCount / $totalProjectsCount) * 100, 1)
            : 0.0;

        $completedDurations = $targetProjectsSet->where('status', 'completed')->map(function ($p) {
            return $p->created_at->diffInDays($p->updated_at);
        });
        $avgCompletionDurationDays = $completedDurations->count() > 0 ? round($completedDurations->avg(), 1) : null;

        // =========================================================================
        // 3. CORE KPI 2: ON-TIME DELIVERY RATE
        // Formula: (Completed items finished <= deadline) / (Completed items with valid deadline) * 100%
        // =========================================================================
        $completedProjectsWithDeadline = $targetProjectsSet->where('status', 'completed')
            ->filter(fn($p) => !empty($p->deadline));

        $onTimeCompletedProjectsCount = $completedProjectsWithDeadline->filter(function ($p) {
            $completionDate = $p->updated_at ? $p->updated_at->toDateString() : $p->created_at->toDateString();
            return $completionDate <= Carbon::parse($p->deadline)->toDateString();
        })->count();

        $completedTasksWithDeadline = $tasks->filter(function ($t) {
            return ($t->is_completed || in_array($t->status, ['completed', 'done'], true)) && !empty($t->deadline);
        });

        $onTimeTasksCount = $completedTasksWithDeadline->filter(function ($t) {
            $compDate = $t->updated_at ? $t->updated_at->toDateString() : $t->created_at->toDateString();
            return $compDate <= Carbon::parse($t->deadline)->toDateString();
        })->count();

        // Composite On-Time Delivery Rate
        $totalEvaluatedItems = $completedProjectsWithDeadline->count() + $completedTasksWithDeadline->count();
        $totalOnTimeItems = $onTimeCompletedProjectsCount + $onTimeTasksCount;

        $onTimeDeliveryRate = $totalEvaluatedItems > 0
            ? round(($totalOnTimeItems / $totalEvaluatedItems) * 100, 1)
            : 100.0;

        // =========================================================================
        // 4. CORE KPI 3: TASK COMPLETION RATE
        // Formula: (Completed Tasks / Total Tasks) * 100%
        // =========================================================================
        $targetTasksSet = ($periodStart && $periodEnd && $tasks->count() > 0) ? $tasks : $allTasks;
        $totalTasksCount = $targetTasksSet->count();
        $completedTasksCount = $targetTasksSet->filter(fn($t) => $t->is_completed || in_array($t->status, ['completed', 'done'], true))->count();
        $inReviewTasksCount = $targetTasksSet->where('status', 'in_review')->count();
        $inProgressTasksCount = $targetTasksSet->where('status', 'in_progress')->count();
        $pendingTasksCount = $targetTasksSet->where('status', 'pending')->count();
        $overdueTasksCount = $targetTasksSet->filter(function ($t) use ($today) {
            return !$t->is_completed
                && !in_array($t->status, ['completed', 'done'], true)
                && !empty($t->deadline)
                && $t->deadline < $today;
        })->count();

        $taskCompletionRate = $totalTasksCount > 0
            ? round(($completedTasksCount / $totalTasksCount) * 100, 1)
            : 0.0;

        // Revisions from task_reviews
        $taskRevisionCount = TaskReview::where('action', 'revision_requested')->distinct('task_id')->count('task_id');

        $completedTaskDurations = $targetTasksSet->filter(fn($t) => $t->is_completed || in_array($t->status, ['completed', 'done'], true))->map(function ($t) {
            return $t->created_at->diffInDays($t->updated_at);
        });
        $avgTaskDurationDays = $completedTaskDurations->count() > 0 ? round($completedTaskDurations->avg(), 1) : null;

        // =========================================================================
        // 5. CORE KPI 4: MILESTONE COMPLETION RATE
        // Formula: (Completed Milestones / Total Milestones) * 100%
        // =========================================================================
        $targetMilestonesSet = ($periodStart && $periodEnd && $milestones->count() > 0) ? $milestones : $allMilestones;
        $totalMilestonesCount = $targetMilestonesSet->count();
        $completedMilestonesCount = $targetMilestonesSet->where('status', 'completed')->count();
        $overdueMilestonesCount = $targetMilestonesSet->filter(function ($m) use ($today) {
            return $m->status !== 'completed' && !empty($m->due_date) && $m->due_date < $today;
        })->count();

        $milestoneCompletionRate = $totalMilestonesCount > 0
            ? round(($completedMilestonesCount / $totalMilestonesCount) * 100, 1)
            : 0.0;

        // =========================================================================
        // 6. CORE KPI 5: PROJECT TARGET ACHIEVEMENT
        // Formula: Avg(min(100, (actual_progress / target_progress) * 100)) for target_progress > 0
        // =========================================================================
        $activeProjectsWithTarget = $targetProjectsSet->where('status', '!=', 'completed')
            ->filter(fn($p) => !is_null($p->target_progress) && (int) $p->target_progress > 0);

        $hasTargetProgressData = $activeProjectsWithTarget->count() > 0;
        $targetAchievementRate = null;
        if ($hasTargetProgressData) {
            $achievements = $activeProjectsWithTarget->map(function ($p) {
                return min(100.0, ((int) $p->progress / (int) $p->target_progress) * 100);
            });
            $targetAchievementRate = round($achievements->avg(), 1);
        }

        // =========================================================================
        // 7. CORE KPI 6: TEAM WORKLOAD BALANCE & CAPACITY
        // Evaluates balance of active workload among active members
        // =========================================================================
        $activeMembers = User::where('role', 'member')->where('is_active', true)->get();
        $teamWorkloadDistribution = [];
        $optimalCapacityCount = 0;
        $overloadedCount = 0;
        $underutilizedCount = 0;

        foreach ($activeMembers as $mem) {
            $memberTasks = $allTasks->where('assignee_id', $mem->id);
            $mTotal = $memberTasks->count();
            $mCompleted = $memberTasks->filter(fn($t) => $t->is_completed || in_array($t->status, ['completed', 'done'], true))->count();
            $mActive = $memberTasks->filter(fn($t) => !$t->is_completed && !in_array($t->status, ['completed', 'done'], true))->count();
            $mInReview = $memberTasks->where('status', 'in_review')->count();
            $mOverdue = $memberTasks->filter(function ($t) use ($today) {
                return !$t->is_completed
                    && !in_array($t->status, ['completed', 'done'], true)
                    && !empty($t->deadline)
                    && $t->deadline < $today;
            })->count();

            // Capacity indicator: 1-4 active tasks = ideal, > 4 = overloaded, 0 = underutilized
            $capacityStatus = 'ideal';
            if ($mActive > 4) {
                $capacityStatus = 'overloaded';
                $overloadedCount++;
            } elseif ($mActive === 0) {
                $capacityStatus = 'underutilized';
                $underutilizedCount++;
            } else {
                $optimalCapacityCount++;
            }

            $teamWorkloadDistribution[] = [
                'member_id' => $mem->id,
                'name' => $mem->name,
                'email' => $mem->email,
                'department' => $mem->department ?? 'Engineering',
                'total_tasks' => $mTotal,
                'completed_tasks' => $mCompleted,
                'active_tasks' => $mActive,
                'in_review_tasks' => $mInReview,
                'overdue_tasks' => $mOverdue,
                'capacity_status' => $capacityStatus,
            ];
        }

        $totalActiveMembers = $activeMembers->count();
        $teamWorkloadBalanceIndex = $totalActiveMembers > 0
            ? round(($optimalCapacityCount / $totalActiveMembers) * 100, 1)
            : 100.0;

        // =========================================================================
        // 8. PROJECT MANAGER OPERATIONAL EVALUATION (Single PM Model: Siti PM)
        // =========================================================================
        $operationalPm = User::where('role', 'project_manager')->orderBy('id', 'asc')->first();
        $pmManagerialMetrics = null;

        if ($operationalPm) {
            $pmProjects = $allProjects->where('pic_id', $operationalPm->id);
            $pmTotalProjs = $pmProjects->count();
            $pmOnTrack = $pmProjects->where('status', 'on_track')->count();
            $pmDelayed = $pmProjects->where('status', 'delayed')->count();
            $pmAtRisk = $pmProjects->where('status', 'at_risk')->count();
            $pmCompleted = $pmProjects->where('status', 'completed')->count();
            $pmAvgProgress = $pmTotalProjs > 0 ? round($pmProjects->avg('progress'), 1) : 0.0;

            $pmReports = ProjectReport::where('created_by', $operationalPm->id)->get();

            $pmManagerialMetrics = [
                'pm_id' => $operationalPm->id,
                'pm_name' => $operationalPm->name,
                'pm_email' => $operationalPm->email,
                'total_projects_managed' => $pmTotalProjs,
                'on_track_projects' => $pmOnTrack,
                'delayed_projects' => $pmDelayed,
                'at_risk_projects' => $pmAtRisk,
                'completed_projects' => $pmCompleted,
                'average_project_progress' => $pmAvgProgress,
                'published_reports_count' => $pmReports->where('status', 'published')->count(),
                'latest_report_published_at' => $pmReports->where('status', 'published')->max('published_at'),
            ];
        }

        // =========================================================================
        // 9. DELIVERY TREND (From authentic Project Reports snapshots)
        // =========================================================================
        $publishedReports = ProjectReport::where('status', 'published')
            ->orderBy('period_end', 'asc')
            ->get();

        $trendPoints = [];
        foreach ($publishedReports as $rep) {
            $snap = is_array($rep->snapshot_data) ? $rep->snapshot_data : json_decode($rep->snapshot_data, true);
            $periodKey = Carbon::parse($rep->period_start)->format('d M') . ' - ' . Carbon::parse($rep->period_end)->format('d M Y');

            $trendPoints[] = [
                'period_label' => $periodKey,
                'report_number' => $rep->report_number,
                'project_id' => $rep->project_id,
                'published_at' => $rep->published_at ? Carbon::parse($rep->published_at)->format('d M Y') : null,
                'actual_progress' => isset($snap['progress']) ? (int) $snap['progress'] : null,
                'total_tasks' => isset($snap['tasks_summary']['total']) ? (int) $snap['tasks_summary']['total'] : null,
                'completed_tasks' => isset($snap['tasks_summary']['completed']) ? (int) $snap['tasks_summary']['completed'] : null,
                'overdue_tasks' => isset($snap['tasks_summary']['overdue']) ? (int) $snap['tasks_summary']['overdue'] : null,
            ];
        }

        $hasSufficientTrendData = count($trendPoints) >= 2;

        // =========================================================================
        // 10. PERFORMANCE COMPARISON & DIRECTION
        // Direction rule:
        // - Improved: when positive metrics increase OR negative metrics decrease.
        // - Declined: when positive metrics decrease OR negative metrics increase.
        // =========================================================================
        $comparison = [
            'period_label' => $periodLabel,
            'comparison_context' => $comparisonLabel,
            'metrics' => [
                'project_completion_rate' => [
                    'label' => 'Project Completion Rate',
                    'current' => $projectCompletionRate,
                    'unit' => '%',
                    'status' => $projectCompletionRate >= 50 ? 'excellent' : ($projectCompletionRate >= 25 ? 'good' : 'fair'),
                    'direction' => 'neutral',
                    'note' => 'Persentase total proyek yang telah tuntas diserahkan.',
                ],
                'on_time_delivery_rate' => [
                    'label' => 'On-Time Delivery Rate',
                    'current' => $onTimeDeliveryRate,
                    'unit' => '%',
                    'status' => $onTimeDeliveryRate >= 85 ? 'excellent' : ($onTimeDeliveryRate >= 70 ? 'good' : 'critical'),
                    'direction' => 'neutral',
                    'note' => 'Kepatuhan penyelesaian tugas dan proyek terhadap tenggat waktu deadline.',
                ],
                'task_completion_rate' => [
                    'label' => 'Task Completion Rate',
                    'current' => $taskCompletionRate,
                    'unit' => '%',
                    'status' => $taskCompletionRate >= 60 ? 'excellent' : ($taskCompletionRate >= 30 ? 'good' : 'fair'),
                    'direction' => 'neutral',
                    'note' => 'Rasio penyelesaian tugas aktif operasional tim.',
                ],
                'milestone_completion_rate' => [
                    'label' => 'Milestone Completion Rate',
                    'current' => $milestoneCompletionRate,
                    'unit' => '%',
                    'status' => $milestoneCompletionRate >= 50 ? 'excellent' : ($milestoneCompletionRate >= 25 ? 'good' : 'fair'),
                    'direction' => 'neutral',
                    'note' => 'Ketuntasan fase dan sprint milestone di seluruh portofolio.',
                ],
                'target_achievement_rate' => [
                    'label' => 'Project Target Achievement',
                    'current' => $targetAchievementRate,
                    'unit' => $targetAchievementRate !== null ? '%' : 'N/A',
                    'status' => $targetAchievementRate === null ? 'no_target' : ($targetAchievementRate >= 85 ? 'excellent' : ($targetAchievementRate >= 60 ? 'good' : 'critical')),
                    'direction' => 'neutral',
                    'note' => $hasTargetProgressData ? 'Tingkat pencapaian progres riil terhadap target baseline proyek.' : 'Belum ada target progress yang ditetapkan.',
                ],
                'team_workload_balance' => [
                    'label' => 'Team Workload Balance',
                    'current' => $teamWorkloadBalanceIndex,
                    'unit' => '%',
                    'status' => $teamWorkloadBalanceIndex >= 70 ? 'excellent' : ($teamWorkloadBalanceIndex >= 50 ? 'good' : 'fair'),
                    'direction' => 'neutral',
                    'note' => 'Proporsi anggota tim yang berada pada kapasitas beban kerja ideal (1-4 tugas aktif).',
                ],
            ]
        ];

        // =========================================================================
        // 11. RULE-BASED PERFORMANCE INSIGHTS
        // Separate facts from recommendations
        // =========================================================================
        $insights = [];

        // Rule A: Overdue Tasks Alert
        if ($overdueTasksCount > 0) {
            $overduePct = $totalTasksCount > 0 ? round(($overdueTasksCount / $totalTasksCount) * 100, 1) : 0;
            $insights[] = [
                'type' => 'warning',
                'category' => 'Ketepatan Waktu Pengerjaan',
                'factual_data' => "Sebanyak {$overdueTasksCount} tugas ({$overduePct}% dari total tugas) tercatat melewati batas waktu deadline.",
                'period' => $periodLabel,
                'business_impact' => 'Dapat menghambat pencapaian fase milestone berikutnya dan menurunkan skor on-time delivery.',
                'recommendation' => 'Project Manager perlu memprioritaskan penyelesaian tugas overdue dan melakukan asistensi hambatan teknis.',
            ];
        }

        // Rule B: Team Workload Imbalance
        if ($underutilizedCount > 0 && ($optimalCapacityCount > 0 || $overloadedCount > 0)) {
            $insights[] = [
                'type' => 'info',
                'category' => 'Keseimbangan Beban Kerja',
                'factual_data' => "Terdapat {$underutilizedCount} anggota tim aktif yang saat ini belum memiliki alokasi tugas (idle), sementara anggota lain mengelola hingga 4 tugas.",
                'period' => $periodLabel,
                'business_impact' => 'Kapasitas produksi tim belum dimanfaatkan secara optimal untuk mempercepat delivery proyek.',
                'recommendation' => 'Distribusikan sebagian tugas baru atau backlog fase berikutnya kepada anggota tim yang memiliki kapasitas luang.',
            ];
        }

        // Rule C: Tasks In Review
        if ($inReviewTasksCount > 0) {
            $insights[] = [
                'type' => 'action_needed',
                'category' => 'Antrean Review Teknis',
                'factual_data' => "Terdapat {$inReviewTasksCount} tugas selesai yang saat ini menunggu review dan persetujuan dari Project Manager.",
                'period' => $periodLabel,
                'business_impact' => 'Penyelesaian formal tugas dan perhitungan progres milestone tertahan sampai review disetujui.',
                'recommendation' => 'Instruksikan Project Manager untuk segera memeriksa dan memvalidasi pekerjaan anggota tim pada PM Workspace.',
            ];
        }

        // Rule D: Target Baseline Presence
        if (!$hasTargetProgressData) {
            $insights[] = [
                'type' => 'notice',
                'category' => 'Target Baseline Proyek',
                'factual_data' => 'Proyek-proyek aktif belum memiliki target progress tersimpan di sistem.',
                'period' => $periodLabel,
                'business_impact' => 'Analisis variansi target vs aktual belum dapat diukur secara kuantitatif.',
                'recommendation' => 'Tetapkan target progress berkala pada masing-masing proyek aktif untuk mengaktifkan pemantauan deviasi.',
            ];
        }

        // =========================================================================
        // 12. RETURN COMPREHENSIVE BUSINESS PERFORMANCE RESPONSE
        // =========================================================================
        return response()->json([
            'success' => true,
            'meta' => [
                'as_of_date' => Carbon::now()->translatedFormat('l, d F Y'),
                'as_of_time' => Carbon::now()->format('H:i') . ' WIB',
                'selected_period' => $period,
                'period_label' => $periodLabel,
                'refreshed_at' => Carbon::now()->toIso8601String(),
            ],
            'performance_overview' => $comparison['metrics'],
            'project_delivery' => [
                'total_projects' => $totalProjectsCount,
                'completed_projects' => $completedProjectsCount,
                'active_projects' => $activeProjectsCount,
                'on_time_completed_count' => $onTimeCompletedProjectsCount,
                'on_time_delivery_rate' => $onTimeDeliveryRate,
                'project_completion_rate' => $projectCompletionRate,
                'average_duration_days' => $avgCompletionDurationDays,
            ],
            'task_productivity' => [
                'total_tasks' => $totalTasksCount,
                'completed_tasks' => $completedTasksCount,
                'in_progress_tasks' => $inProgressTasksCount,
                'in_review_tasks' => $inReviewTasksCount,
                'pending_tasks' => $pendingTasksCount,
                'overdue_tasks' => $overdueTasksCount,
                'tasks_with_revisions' => $taskRevisionCount,
                'task_completion_rate' => $taskCompletionRate,
                'average_duration_days' => $avgTaskDurationDays,
            ],
            'milestone_performance' => [
                'total_milestones' => $totalMilestonesCount,
                'completed_milestones' => $completedMilestonesCount,
                'overdue_milestones' => $overdueMilestonesCount,
                'milestone_completion_rate' => $milestoneCompletionRate,
            ],
            'team_workload' => [
                'total_active_members' => $totalActiveMembers,
                'optimal_capacity_count' => $optimalCapacityCount,
                'overloaded_count' => $overloadedCount,
                'underutilized_count' => $underutilizedCount,
                'balance_index' => $teamWorkloadBalanceIndex,
                'members_distribution' => $teamWorkloadDistribution,
            ],
            'pm_evaluation' => $pmManagerialMetrics,
            'delivery_trend' => [
                'has_sufficient_data' => $hasSufficientTrendData,
                'total_periods' => count($trendPoints),
                'note' => $hasSufficientTrendData
                    ? 'Tren historis berdasarkan data snapshot laporan mingguan terverifikasi.'
                    : 'Data tren historis saat ini bersumber dari ' . count($trendPoints) . ' laporan mingguan terbit. Grafik tren multi-periode akan berakumulasi seiring siklus mingguan proyek.',
                'points' => $trendPoints,
            ],
            'performance_comparison' => $comparison,
            'performance_insights' => $insights,
        ]);
    }
}
