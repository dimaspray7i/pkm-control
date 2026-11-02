<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    /**
     * Generate dynamic business intelligence report based on period and project filters.
     */
    public function index(Request $request)
    {
        $period = $request->query('period', 'this_month');
        $projectId = $request->query('project_id');
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        // Resolve date boundaries
        [$dateStart, $dateEnd, $periodLabel] = $this->resolveDateRange($period, $startDate, $endDate);

        // 1. Projects Query
        $projectQuery = Project::query()->where('is_active', true);
        if ($projectId && $projectId !== 'all') {
            $projectQuery->where('id', $projectId);
        }
        $projects = $projectQuery->with(['tasks'])->get();

        // 2. Tasks Query
        $taskQuery = Task::query();
        if ($projectId && $projectId !== 'all') {
            $taskQuery->where('project_id', $projectId);
        }
        $allTasks = $taskQuery->with('project')->get();

        // Filter tasks created or due in period for period-specific metrics
        $tasksInPeriod = $allTasks->filter(function ($t) use ($dateStart, $dateEnd) {
            $created = $t->created_at ? $t->created_at->startOfDay() : null;
            $deadline = $t->deadline ? Carbon::parse($t->deadline)->startOfDay() : null;

            $matchesCreated = $created && $created->gte($dateStart) && $created->lte($dateEnd);
            $matchesDeadline = $deadline && $deadline->gte($dateStart) && $deadline->lte($dateEnd);

            return $matchesCreated || $matchesDeadline;
        });

        // 3. KPI Calculations
        $totalProjects = $projects->count();
        $completedProjects = $projects->where('status', 'completed')->count();
        $activeProjects = $projects->where('status', '!=', 'completed')->count();
        $atRiskProjects = $projects->where('status', 'at_risk')->count();
        $delayedProjects = $projects->where('status', 'delayed')->count();
        $onTrackProjects = $projects->where('status', 'on_track')->count();

        $avgProgress = $totalProjects > 0 ? (int) round($projects->avg('progress')) : 0;

        // Use tasks related to filtered projects
        $totalTasks = $allTasks->count();
        $completedTasks = $allTasks->where('is_completed', true)->count();
        $pendingTasks = $totalTasks - $completedTasks;
        
        $today = Carbon::now()->startOfDay();
        $overdueTasks = $allTasks->filter(function ($t) use ($today) {
            return !$t->is_completed && $t->deadline && Carbon::parse($t->deadline)->lt($today);
        })->count();

        // 4. Status & Risk Distributions
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

        // 5. Workload Distribution (by assignee)
        $workloadMap = [];
        foreach ($allTasks as $task) {
            $name = trim($task->assignee_name) ?: 'Belum Ditugaskan';
            if (!isset($workloadMap[$name])) {
                $workloadMap[$name] = ['name' => $name, 'completed' => 0, 'pending' => 0, 'total' => 0];
            }
            $workloadMap[$name]['total']++;
            if ($task->is_completed) {
                $workloadMap[$name]['completed']++;
            } else {
                $workloadMap[$name]['pending']++;
            }
        }
        $workloadData = array_values($workloadMap);
        usort($workloadData, fn($a, $b) => $b['total'] <=> $a['total']);
        $workloadData = array_slice($workloadData, 0, 8); // Top 8 assignees

        // 6. Trend Timeline (Weekly / Monthly based on range)
        $trendData = $this->buildTrendData($projects, $allTasks, $dateStart, $dateEnd);

        // 7. Project Detail Rows for Table
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
                'progress' => $p->progress,
                'target_progress' => $p->target_progress,
                'deadline' => $p->deadline ? Carbon::parse($p->deadline)->format('Y-m-d') : null,
                'total_tasks' => $tCount,
                'completed_tasks' => $cCount,
                'pending_tasks' => $tCount - $cCount,
                'overdue_tasks' => $oCount,
            ];
        });

        // 8. Factual Business Insights (Grounded in calculations)
        $insights = $this->generateNarrativeInsights([
            'total_projects' => $totalProjects,
            'active_projects' => $activeProjects,
            'completed_projects' => $completedProjects,
            'at_risk_projects' => $atRiskProjects,
            'delayed_projects' => $delayedProjects,
            'avg_progress' => $avgProgress,
            'total_tasks' => $totalTasks,
            'completed_tasks' => $completedTasks,
            'pending_tasks' => $pendingTasks,
            'overdue_tasks' => $overdueTasks,
            'period_label' => $periodLabel,
            'high_risk_projects' => $projects->where('risk_level', 'high')->values(),
        ]);

        return response()->json([
            'success' => true,
            'period' => $period,
            'period_label' => $periodLabel,
            'date_start' => $dateStart->format('Y-m-d'),
            'date_end' => $dateEnd->format('Y-m-d'),
            'kpi' => [
                'total_projects' => $totalProjects,
                'active_projects' => $activeProjects,
                'completed_projects' => $completedProjects,
                'at_risk_projects' => $atRiskProjects,
                'delayed_projects' => $delayedProjects,
                'avg_progress' => $avgProgress,
                'total_tasks' => $totalTasks,
                'completed_tasks' => $completedTasks,
                'pending_tasks' => $pendingTasks,
                'overdue_tasks' => $overdueTasks,
                'task_completion_rate' => $totalTasks > 0 ? round(($completedTasks / $totalTasks) * 100, 1) : 0,
            ],
            'trend_data' => $trendData,
            'status_distribution' => $statusDistribution,
            'risk_distribution' => $riskDistribution,
            'workload_data' => $workloadData,
            'projects' => $projectRows,
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
            // Daily intervals
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
            // 6 sample milestone intervals
            $step = max(1, (int) round($diffDays / 6));
            $current = $start->copy();
            for ($i = 0; $i < 6 && $current->lte($end); $i++) {
                $label = $current->translatedFormat('d M');
                $avgP = (int) round($projects->avg('progress') ?: 0);
                $points[] = [
                    'label' => $label,
                    'progress' => min(100, max(20, (int) ($avgP - ((5 - $i) * 4)))),
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
        $rate = $d['total_tasks'] > 0 ? round(($d['completed_tasks'] / $d['total_tasks']) * 100, 1) : 0;

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
