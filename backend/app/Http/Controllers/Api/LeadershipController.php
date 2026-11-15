<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\ProjectReport;
use App\Models\Task;
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
}
