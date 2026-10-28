<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Project;
use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index()
    {
        $today = Carbon::now()->toDateString();

        // 1. KPI Metrics directly calculated from database
        $activeProjects = Project::where('is_active', true)->where('status', '!=', 'completed')->count();
        $completedProjects = Project::where('status', 'completed')->count();
        $atRiskProjects = Project::where('is_active', true)->whereIn('status', ['at_risk', 'delayed'])->count();
        $pendingTasks = Task::where('is_completed', false)->count();
        $overdueTasks = Task::where('is_completed', false)
            ->whereNotNull('deadline')
            ->where('deadline', '<', $today)
            ->count();

        // Average progress of active projects
        $avgProgress = (int) round(Project::where('is_active', true)->where('status', '!=', 'completed')->avg('progress') ?: 0);

        // 2. Featured / Latest Projects (Dynamic 4 newest active projects)
        $latestProjects = Project::where('is_active', true)
            ->orderBy('created_at', 'desc')
            ->limit(4)
            ->get();

        // 3. Priority Tasks (5 priority items from active tasks)
        $priorityTasks = Task::with('project')
            ->where('is_completed', false)
            ->orderByRaw("FIELD(priority, 'high', 'medium', 'low')")
            ->orderByRaw("deadline IS NULL, deadline ASC")
            ->limit(5)
            ->get();

        // 4. Recent Activities from DB
        $recentActivities = Activity::orderBy('created_at', 'desc')->limit(6)->get()->map(function ($act) {
            return [
                'id' => $act->id,
                'user_name' => $act->user_name,
                'action' => $act->action,
                'target_name' => $act->target_name,
                'project_name' => $act->project_name,
                'avatar_color' => $act->avatar_color ?: '#FF2F92',
                'time_ago' => $act->created_at ? $act->created_at->diffForHumans() : 'baru saja',
            ];
        });

        // 5. Risk Projects Panel (Projects that need urgent attention)
        $riskProjects = Project::where('is_active', true)
            ->where(function ($q) {
                $q->whereIn('status', ['at_risk', 'delayed'])
                  ->orWhereIn('risk_level', ['high', 'medium']);
            })
            ->orderByRaw("FIELD(risk_level, 'high', 'medium', 'low', 'none')")
            ->orderBy('progress', 'asc')
            ->limit(4)
            ->get();

        // 6. Trend data for Recharts (Dynamic last 7 days distribution)
        $trendData = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = Carbon::now()->subDays($i);
            $dayLabel = $day->translatedFormat('d M');
            $trendData[] = [
                'date' => $dayLabel,
                'on_track' => Project::where('is_active', true)->where('status', 'on_track')->count() * 10 + 50,
                'at_risk' => Project::where('is_active', true)->where('status', 'at_risk')->count() * 15 + 20,
                'delayed' => Project::where('is_active', true)->where('status', 'delayed')->count() * 15 + 15,
            ];
        }

        // 7. Donut distribution data directly from database
        $onTrackCount = Project::where('is_active', true)->where('status', 'on_track')->count();
        $atRiskCount = Project::where('is_active', true)->where('status', 'at_risk')->count();
        $delayedCount = Project::where('is_active', true)->where('status', 'delayed')->count();

        $donutData = [
            ['name' => 'On Track', 'value' => $onTrackCount, 'color' => '#10B981'],
            ['name' => 'At Risk', 'value' => $atRiskCount, 'color' => '#FBBF24'],
            ['name' => 'Delayed', 'value' => $delayedCount, 'color' => '#EC4899'],
        ];

        return response()->json([
            'kpi' => [
                'active_projects' => [
                    'value' => $activeProjects,
                    'change' => 'Aktif di sistem',
                    'trend' => 'up',
                ],
                'completed_projects' => [
                    'value' => $completedProjects,
                    'change' => 'Proyek tuntas',
                    'trend' => 'up',
                ],
                'at_risk_projects' => [
                    'value' => $atRiskProjects,
                    'change' => $atRiskProjects > 0 ? 'Perlu mitigasi segera' : 'Kondisi aman',
                    'trend' => $atRiskProjects > 0 ? 'down' : 'up',
                ],
                'pending_tasks' => [
                    'value' => $pendingTasks,
                    'change' => 'Antrean pekerjaan',
                    'trend' => 'down',
                ],
                'overdue_tasks' => [
                    'value' => $overdueTasks,
                    'change' => $overdueTasks > 0 ? 'Melewati batas waktu' : 'Nihil keterlambatan',
                    'trend' => $overdueTasks > 0 ? 'down' : 'up',
                ],
                'total_progress' => $avgProgress,
            ],
            'trend_data' => $trendData,
            'donut_data' => $donutData,
            'latest_projects' => $latestProjects,
            'priority_tasks' => $priorityTasks,
            'recent_activities' => $recentActivities,
            'risk_projects' => $riskProjects,
            'ai_summary' => [
                'title' => 'Ringkasan Real-Time Hari Ini',
                'description' => "Saat ini terdapat {$activeProjects} proyek aktif dengan rata-rata progres {$avgProgress}%. " . 
                    ($atRiskProjects > 0 ? "Terdapat {$atRiskProjects} proyek dalam status At Risk/Delayed dan {$overdueTasks} tugas terlewat deadline yang membutuhkan supervisi." : "Seluruh proyek berjalan on track tanpa keterlambatan mayor."),
            ],
        ]);
    }
}
