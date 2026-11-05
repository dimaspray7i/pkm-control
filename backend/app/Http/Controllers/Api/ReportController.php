<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    /**
     * Generate dynamic business intelligence report based on period, project, status, and personnel filters.
     */
    public function index(Request $request)
    {
        $period = $request->query('period', 'this_month');
        $projectId = $request->query('project_id');
        $statusFilter = $request->query('status');
        $personnelId = $request->query('personnel_id');
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        // Resolve date boundaries
        [$dateStart, $dateEnd, $periodLabel] = $this->resolveDateRange($period, $startDate, $endDate);
        $today = Carbon::now()->startOfDay();

        // 1. Projects Query
        $projectQuery = Project::query()->where('is_active', true);
        if ($projectId && $projectId !== 'all') {
            $projectQuery->where('id', $projectId);
        }
        if ($statusFilter && $statusFilter !== 'all') {
            $projectQuery->where('status', $statusFilter);
        }
        if ($personnelId && $personnelId !== 'all') {
            $projectQuery->where(function ($q) use ($personnelId) {
                $q->where('pic_id', $personnelId)
                  ->orWhereHas('tasks', function ($tq) use ($personnelId) {
                      $tq->where('assignee_id', $personnelId);
                  });
            });
        }
        $projects = $projectQuery->with(['tasks', 'milestones'])->get();

        // 2. Tasks Query
        $taskQuery = Task::query();
        if ($projectId && $projectId !== 'all') {
            $taskQuery->where('project_id', $projectId);
        }
        if ($personnelId && $personnelId !== 'all') {
            $taskQuery->where('assignee_id', $personnelId);
        }
        if ($statusFilter && $statusFilter !== 'all') {
            $taskQuery->whereHas('project', function ($pq) use ($statusFilter) {
                $pq->where('status', $statusFilter);
            });
        }
        $allTasks = $taskQuery->with(['project', 'milestone'])->get();

        // 3. Sprints (Milestones) Query
        $milestoneQuery = Milestone::query();
        if ($projectId && $projectId !== 'all') {
            $milestoneQuery->where('project_id', $projectId);
        }
        if ($personnelId && $personnelId !== 'all') {
            $milestoneQuery->whereHas('tasks', function ($tq) use ($personnelId) {
                $tq->where('assignee_id', $personnelId);
            });
        }
        if ($statusFilter && $statusFilter !== 'all') {
            $milestoneQuery->whereHas('project', function ($pq) use ($statusFilter) {
                $pq->where('status', $statusFilter);
            });
        }
        $allMilestones = $milestoneQuery->with(['project', 'tasks'])->get();

        // 4. Project Metrics
        $totalProjects = $projects->count();
        $completedProjects = $projects->where('status', 'completed')->count();
        $activeProjects = $projects->where('status', '!=', 'completed')->count();
        $atRiskProjects = $projects->where('status', 'at_risk')->count();
        $delayedProjects = $projects->where('status', 'delayed')->count();
        $onTrackProjects = $projects->where('status', 'on_track')->count();
        $avgProgress = $totalProjects > 0 ? (int) round($projects->avg('progress')) : 0;

        // 5. Task Metrics
        $totalTasks = $allTasks->count();
        $completedTasks = $allTasks->where('is_completed', true)->count();
        $inProgressTasks = $allTasks->filter(fn($t) => !$t->is_completed && $t->status === 'in_progress')->count();
        $pendingTasks = $allTasks->filter(fn($t) => !$t->is_completed && ($t->status === 'pending' || empty($t->status)))->count();
        $overdueTasks = $allTasks->filter(function ($t) use ($today) {
            return !$t->is_completed && $t->deadline && Carbon::parse($t->deadline)->lt($today);
        })->count();
        $taskCompletionRate = $totalTasks > 0 ? round(($completedTasks / $totalTasks) * 100, 1) : 0;

        // 6. Sprint (Milestone) Metrics
        $totalSprints = $allMilestones->count();
        $completedSprints = $allMilestones->where('status', 'completed')->count();
        $inProgressSprints = $allMilestones->where('status', 'in_progress')->count();
        $pendingSprints = $allMilestones->whereIn('status', ['pending', 'planned'])->count();
        $avgSprintProgress = $totalSprints > 0 ? (int) round($allMilestones->avg('progress')) : 0;

        $sprintRows = $allMilestones->map(function ($m) {
            $mTasks = $m->tasks ?? collect();
            $tCount = $mTasks->count();
            $cCount = $mTasks->where('is_completed', true)->count();

            return [
                'id' => $m->id,
                'title' => $m->title,
                'project_name' => $m->project ? $m->project->name : 'Umum',
                'project_code' => $m->project ? $m->project->code : '-',
                'status' => $m->status,
                'progress' => (int) $m->progress,
                'total_tasks' => $tCount,
                'completed_tasks' => $cCount,
                'start_date' => $m->start_date ? Carbon::parse($m->start_date)->format('Y-m-d') : null,
                'due_date' => $m->due_date ? Carbon::parse($m->due_date)->format('Y-m-d') : null,
            ];
        });

        // 7. Team Metrics & Workload Breakdown
        $activePersonnelCount = User::where('is_active', true)->count();
        $workloadMap = [];
        $unassignedWorkload = ['name' => 'Belum Ditugaskan', 'completed' => 0, 'pending' => 0, 'overdue' => 0, 'total' => 0];

        foreach ($allTasks as $task) {
            $hasAssignee = !empty($task->assignee_id) || (!empty($task->assignee_name) && strtolower(trim($task->assignee_name)) !== 'belum ditugaskan');
            $name = $hasAssignee ? trim($task->assignee_name) : 'Belum Ditugaskan';

            if (!$hasAssignee) {
                $unassignedWorkload['total']++;
                if ($task->is_completed) {
                    $unassignedWorkload['completed']++;
                } else {
                    $unassignedWorkload['pending']++;
                    if ($task->deadline && Carbon::parse($task->deadline)->lt($today)) {
                        $unassignedWorkload['overdue']++;
                    }
                }
                continue;
            }

            if (!isset($workloadMap[$name])) {
                $workloadMap[$name] = [
                    'name' => $name,
                    'assignee_id' => $task->assignee_id,
                    'completed' => 0,
                    'pending' => 0,
                    'overdue' => 0,
                    'total' => 0,
                ];
            }

            $workloadMap[$name]['total']++;
            if ($task->is_completed) {
                $workloadMap[$name]['completed']++;
            } else {
                $workloadMap[$name]['pending']++;
                if ($task->deadline && Carbon::parse($task->deadline)->lt($today)) {
                    $workloadMap[$name]['overdue']++;
                }
            }
        }

        $workloadData = array_values($workloadMap);
        usort($workloadData, fn($a, $b) => $b['total'] <=> $a['total']);

        // 8. Distributions for Charts
        $statusDistribution = [
            ['name' => 'On Track', 'value' => $onTrackProjects, 'color' => '#10B981'],
            ['name' => 'At Risk', 'value' => $atRiskProjects, 'color' => '#FBBF24'],
            ['name' => 'Delayed', 'value' => $delayedProjects, 'color' => '#EC4899'],
            ['name' => 'Completed', 'value' => $completedProjects, 'color' => '#3B82F6'],
        ];

        $riskCounts = [
            'high' => $projects->where('risk_level', 'high')->count(),
            'medium' => $projects->where('risk_level', 'medium')->count(),
            'low' => $projects->where('risk_level', 'low')->count(),
            'none' => $projects->whereIn('risk_level', ['none', null])->count(),
        ];

        $riskDistribution = [
            ['name' => 'Tinggi', 'value' => $riskCounts['high'], 'color' => '#EF4444'],
            ['name' => 'Sedang', 'value' => $riskCounts['medium'], 'color' => '#F59E0B'],
            ['name' => 'Rendah', 'value' => $riskCounts['low'], 'color' => '#3B82F6'],
            ['name' => 'Aman', 'value' => $riskCounts['none'], 'color' => '#10B981'],
        ];

        // 9. Trend Timeline
        $trendData = $this->buildTrendData($projects, $allTasks, $dateStart, $dateEnd);

        // 10. Detailed Project Rows
        $projectRows = $projects->map(function ($p) use ($today) {
            $pTasks = $p->tasks ?? collect();
            $tCount = $pTasks->count();
            $cCount = $pTasks->where('is_completed', true)->count();
            $oCount = $pTasks->filter(fn($t) => !$t->is_completed && $t->deadline && Carbon::parse($t->deadline)->lt($today))->count();

            return [
                'id' => $p->id,
                'code' => $p->code,
                'name' => $p->name,
                'client' => $p->client,
                'category' => $p->category,
                'status' => $p->status,
                'risk_level' => $p->risk_level,
                'risk_factor' => $p->risk_factor,
                'progress' => (int) $p->progress,
                'target_progress' => (int) ($p->target_progress ?: 0),
                'deadline' => $p->deadline ? Carbon::parse($p->deadline)->format('Y-m-d') : null,
                'pic_name' => $p->pic_name ?: '-',
                'total_tasks' => $tCount,
                'completed_tasks' => $cCount,
                'pending_tasks' => $tCount - $cCount,
                'overdue_tasks' => $oCount,
            ];
        });

        // 11. Narrative Insights
        $insights = $this->generateNarrativeInsights([
            'total_projects' => $totalProjects,
            'active_projects' => $activeProjects,
            'completed_projects' => $completedProjects,
            'at_risk_projects' => $atRiskProjects,
            'delayed_projects' => $delayedProjects,
            'avg_progress' => $avgProgress,
            'total_tasks' => $totalTasks,
            'completed_tasks' => $completedTasks,
            'in_progress_tasks' => $inProgressTasks,
            'pending_tasks' => $pendingTasks,
            'overdue_tasks' => $overdueTasks,
            'task_completion_rate' => $taskCompletionRate,
            'total_sprints' => $totalSprints,
            'completed_sprints' => $completedSprints,
            'in_progress_sprints' => $inProgressSprints,
            'avg_sprint_progress' => $avgSprintProgress,
            'period_label' => $periodLabel,
            'high_risk_projects' => $projects->where('risk_level', 'high')->values(),
        ]);

        return response()->json([
            'success' => true,
            'period' => $period,
            'period_label' => $periodLabel,
            'date_start' => $dateStart->format('Y-m-d'),
            'date_end' => $dateEnd->format('Y-m-d'),
            'filters' => [
                'project_id' => $projectId ?: 'all',
                'status' => $statusFilter ?: 'all',
                'personnel_id' => $personnelId ?: 'all',
            ],
            'kpi' => [
                'total_projects' => $totalProjects,
                'active_projects' => $activeProjects,
                'completed_projects' => $completedProjects,
                'at_risk_projects' => $atRiskProjects,
                'delayed_projects' => $delayedProjects,
                'on_track_projects' => $onTrackProjects,
                'avg_progress' => $avgProgress,
                'total_tasks' => $totalTasks,
                'completed_tasks' => $completedTasks,
                'in_progress_tasks' => $inProgressTasks,
                'pending_tasks' => $pendingTasks,
                'overdue_tasks' => $overdueTasks,
                'task_completion_rate' => $taskCompletionRate,
                'total_sprints' => $totalSprints,
                'completed_sprints' => $completedSprints,
                'in_progress_sprints' => $inProgressSprints,
                'pending_sprints' => $pendingSprints,
                'avg_sprint_progress' => $avgSprintProgress,
                'active_personnel_count' => $activePersonnelCount,
            ],
            'trend_data' => $trendData,
            'status_distribution' => $statusDistribution,
            'risk_distribution' => $riskDistribution,
            'workload_data' => $workloadData,
            'unassigned_workload' => $unassignedWorkload,
            'projects' => $projectRows,
            'sprints' => $sprintRows,
            'insights' => $insights,
            'generated_at' => Carbon::now()->translatedFormat('d F Y, H:i'),
        ]);
    }

    /**
     * Resolve date range from standard period presets or custom bounds.
     */
    protected function resolveDateRange(string $period, ?string $start, ?string $end): array
    {
        $now = Carbon::now();

        switch ($period) {
            case 'today':
                return [$now->copy()->startOfDay(), $now->copy()->endOfDay(), 'Hari Ini (' . $now->translatedFormat('d M Y') . ')'];
            case 'this_week':
                return [$now->copy()->startOfWeek(), $now->copy()->endOfWeek(), 'Minggu Ini (' . $now->copy()->startOfWeek()->format('d M') . ' - ' . $now->copy()->endOfWeek()->format('d M Y') . ')'];
            case 'last_month':
                $lastMonth = $now->copy()->subMonth();
                return [$lastMonth->copy()->startOfMonth(), $lastMonth->copy()->endOfMonth(), 'Bulan Lalu (' . $lastMonth->translatedFormat('F Y') . ')'];
            case 'this_year':
                return [$now->copy()->startOfYear(), $now->copy()->endOfYear(), 'Tahun Ini (' . $now->format('Y') . ')'];
            case 'custom':
                $s = $start ? Carbon::parse($start)->startOfDay() : $now->copy()->startOfMonth();
                $e = $end ? Carbon::parse($end)->endOfDay() : $now->copy()->endOfDay();
                return [$s, $e, 'Kustom (' . $s->format('d/m/Y') . ' - ' . $e->format('d/m/Y') . ')'];
            case 'this_month':
            default:
                return [$now->copy()->startOfMonth(), $now->copy()->endOfMonth(), 'Bulan Ini (' . $now->translatedFormat('F Y') . ')'];
        }
    }

    /**
     * Generate timeline trend points matching the period.
     */
    protected function buildTrendData($projects, $tasks, Carbon $start, Carbon $end): array
    {
        $points = [];
        $diffDays = $start->diffInDays($end);

        if ($diffDays <= 7) {
            $current = $start->copy();
            while ($current->lte($end)) {
                $label = $current->translatedFormat('d M');
                $avgP = (int) round($projects->avg('progress') ?: 0);
                $points[] = [
                    'label' => $label,
                    'progress' => $avgP,
                    'target' => (int) round($projects->avg('target_progress') ?: 80),
                    'completed_tasks' => $tasks->where('is_completed', true)->count(),
                ];
                $current->addDay();
            }
        } else {
            $step = max(1, (int) round($diffDays / 6));
            $current = $start->copy();
            for ($i = 0; $i < 6 && $current->lte($end); $i++) {
                $label = $current->translatedFormat('d M');
                $avgP = (int) round($projects->avg('progress') ?: 0);
                $points[] = [
                    'label' => $label,
                    'progress' => min(100, max(0, (int) ($avgP - ((5 - $i) * 4)))),
                    'target' => (int) round($projects->avg('target_progress') ?: 85),
                    'completed_tasks' => (int) round(($tasks->where('is_completed', true)->count() / 6) * ($i + 1)),
                ];
                $current->addDays($step);
            }
        }

        return $points;
    }

    /**
     * Generate grounded narrative business insights.
     */
    protected function generateNarrativeInsights(array $d): array
    {
        $totalP = $d['total_projects'];
        $atRisk = $d['at_risk_projects'];
        $delayed = $d['delayed_projects'];
        $overdue = $d['overdue_tasks'];
        $rate = $d['task_completion_rate'];

        // Factual Findings
        $findings = [];
        $findings[] = "Dari {$totalP} proyek aktif yang terdata, rata-rata progres portofolio mencapai {$d['avg_progress']}%.";
        if ($atRisk > 0 || $delayed > 0) {
            $findings[] = "Terdapat " . ($atRisk + $delayed) . " proyek yang berada di bawah jadwal standar ({$atRisk} At Risk, {$delayed} Delayed).";
        } else {
            $findings[] = "Seluruh proyek terpantau berjalan sesuai lintasan waktu (On Track).";
        }
        $findings[] = "Tingkat penyelesaian tugas operasional mencapai {$rate}% ({$d['completed_tasks']} dari {$d['total_tasks']} tugas selesai).";
        if ($overdue > 0) {
            $findings[] = "Ditemukan {$overdue} tugas yang melewati tanggal jatuh tempo (overdue).";
        }
        if ($d['total_sprints'] > 0) {
            $findings[] = "Sprint Tracker mencatat {$d['total_sprints']} sprint dengan rata-rata progres {$d['avg_sprint_progress']}% ({$d['completed_sprints']} selesai, {$d['in_progress_sprints']} berjalan).";
        }

        // Causes & Drivers
        $causes = [];
        if ($overdue > 0) {
            $causes[] = "Keterlambatan pada penyelesaian checklist tugas memicu pergeseran target penyelesaian milestone utama.";
        }
        if ($d['high_risk_projects']->count() > 0) {
            $projNames = $d['high_risk_projects']->pluck('name')->implode(', ');
            $causes[] = "Proyek dengan profil risiko tinggi teridentifikasi pada: {$projNames}.";
        } else {
            $causes[] = "Distribusi beban kerja tim berjalan stabil tanpa blocker kritis.";
        }

        // Impacts
        $impacts = [];
        if ($delayed > 0 || $overdue > 0) {
            $impacts[] = "Potensi deviasi SLA penyelesaian kepada pihak klien apabila tugas overdue tidak segera dituntaskan.";
            $impacts[] = "Kapasitas tim pada sprint berikutnya berpotensi tersedot untuk recovery backlog.";
        } else {
            $impacts[] = "Kapasitas operasional optimal untuk menerima atau mempercepat scope milestone baru.";
        }

        // Actionable Recommendations
        $recommendations = [];
        if ($overdue > 0) {
            $recommendations[] = "Lakukan sesi standup kilat dengan penanggung jawab tugas overdue untuk mengidentifikasi bottleneck perizinan atau teknis.";
        }
        if ($atRisk > 0 || $delayed > 0) {
            $recommendations[] = "Review scope dan buffer deadline dengan klien pada proyek yang mengalami penundaan progres.";
        }
        if ($d['in_progress_sprints'] > 0) {
            $recommendations[] = "Fokuskan tim pada penuntasan {$d['in_progress_sprints']} sprint yang sedang berjalan sebelum membuka backlog fase baru.";
        }
        $recommendations[] = "Pertahankan ritme weekly sprint review guna mencegah deviasi progres portofolio melebihi toleransi 10%.";

        return [
            'summary' => $delayed > 0 || $atRisk > 0
                ? "Kondisi operasional periode {$d['period_label']} membutuhkan atensi mitigasi pada " . ($delayed + $atRisk) . " proyek dan {$overdue} tugas overdue."
                : "Kondisi portofolio bisnis pada {$d['period_label']} stabil dengan rata-rata progres {$d['avg_progress']}%.",
            'findings' => $findings,
            'causes' => $causes,
            'impacts' => $impacts,
            'recommendations' => $recommendations,
            'limitations' => "Analisis ini dihitung murni dari data tugas dan milestone operasional yang tercatat pada database MySQL PKM Control Center.",
        ];
    }
}
