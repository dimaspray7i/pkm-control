<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Project;
use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Http\Request;

class PmWorkspaceController extends Controller
{
    /**
     * PM Workspace Dashboard — returns data scoped to the authenticated PM's projects.
     * For role project_manager: scoped by projects.pic_id = auth user id.
     * For role admin / pimpinan: retains access per contract.
     */
    public function index(Request $request)
    {
        $user  = $request->user();
        $today = Carbon::now()->toDateString();

        // Base project query scoped by role
        $baseProjectQuery = Project::query();
        if ($user && $user->role === 'project_manager') {
            $baseProjectQuery->where('pic_id', $user->id);
        }

        // --- Scoped project IDs ---
        $myProjectIds = (clone $baseProjectQuery)->pluck('id');

        // --- KPI: Project counts ---
        $totalProjects     = (clone $baseProjectQuery)->count();
        $activeProjects    = (clone $baseProjectQuery)
            ->where('is_active', true)
            ->where('status', '!=', 'completed')
            ->count();
        $completedProjects = (clone $baseProjectQuery)
            ->where('status', 'completed')
            ->count();
        $atRiskProjects    = (clone $baseProjectQuery)
            ->where('is_active', true)
            ->whereIn('status', ['at_risk', 'delayed'])
            ->count();

        // --- KPI: Task counts scoped to projects ---
        $totalTasks      = Task::whereIn('project_id', $myProjectIds)->count();
        $tasksInProgress = Task::whereIn('project_id', $myProjectIds)
            ->where('status', 'in_progress')
            ->where('is_completed', false)
            ->count();
        $overdueTasks    = Task::whereIn('project_id', $myProjectIds)
            ->where('is_completed', false)
            ->whereNotNull('deadline')
            ->where('deadline', '<', $today)
            ->count();
        $unassignedTasks = Task::whereIn('project_id', $myProjectIds)
            ->whereNull('assignee_id')
            ->where('is_completed', false)
            ->count();
        $pendingTasks    = Task::whereIn('project_id', $myProjectIds)
            ->where('is_completed', false)
            ->where('status', 'pending')
            ->count();

        // --- Average progress of active projects ---
        $avgProgress = (int) round(
            (clone $baseProjectQuery)
                ->where('is_active', true)
                ->where('status', '!=', 'completed')
                ->avg('progress') ?: 0
        );

        // --- My Active Projects (up to 6, most urgent first) ---
        $myProjects = (clone $baseProjectQuery)
            ->where('is_active', true)
            ->orderByRaw("FIELD(status, 'delayed', 'at_risk', 'on_track', 'completed')")
            ->orderBy('deadline', 'asc')
            ->limit(6)
            ->get()
            ->map(function ($proj) {
                $projectTasks = Task::where('project_id', $proj->id);
                $totalTasks   = (clone $projectTasks)->count();
                $doneTasks    = (clone $projectTasks)
                    ->where(function ($q) {
                        $q->where('is_completed', true)->orWhere('status', 'completed');
                    })->count();
                $overdueCount = (clone $projectTasks)
                    ->where('is_completed', false)
                    ->whereNotNull('deadline')
                    ->where('deadline', '<', Carbon::now()->toDateString())
                    ->count();

                return [
                    'id'          => $proj->id,
                    'code'        => $proj->code,
                    'name'        => $proj->name,
                    'client'      => $proj->client,
                    'status'      => $proj->status,
                    'risk_level'  => $proj->risk_level,
                    'progress'    => $proj->progress,
                    'deadline'    => $proj->deadline,
                    'category'    => $proj->category,
                    'tasks_total' => $totalTasks,
                    'tasks_done'  => $doneTasks,
                    'overdue'     => $overdueCount,
                ];
            });

        // --- Needs Attention: overdue or unassigned tasks from PM's projects ---
        $attentionTasks = Task::with('project:id,code,name')
            ->whereIn('project_id', $myProjectIds)
            ->where('is_completed', false)
            ->where(function ($q) use ($today) {
                $q->where(function ($inner) use ($today) {
                    $inner->whereNotNull('deadline')->where('deadline', '<', $today);
                })->orWhereNull('assignee_id');
            })
            ->orderByRaw("deadline IS NULL, deadline ASC")
            ->limit(5)
            ->get()
            ->map(fn($t) => [
                'id'            => $t->id,
                'title'         => $t->title,
                'priority'      => $t->priority,
                'status'        => $t->status,
                'deadline'      => $t->deadline,
                'assignee_name' => $t->assignee_name,
                'assignee_id'   => $t->assignee_id,
                'project_id'    => $t->project_id,
                'project_code'  => $t->project?->code,
                'project_name'  => $t->project?->name,
                'is_overdue'    => $t->deadline && $t->deadline < $today,
                'is_unassigned' => is_null($t->assignee_id),
            ]);

        // --- At-risk / delayed projects for attention panel ---
        $attentionProjects = (clone $baseProjectQuery)
            ->where('is_active', true)
            ->whereIn('status', ['at_risk', 'delayed'])
            ->orderByRaw("FIELD(risk_level, 'high', 'medium', 'low', 'none')")
            ->limit(3)
            ->get(['id', 'code', 'name', 'status', 'risk_level', 'progress', 'deadline']);

        // --- Recent Activities ---
        $recentActivities = Activity::orderBy('created_at', 'desc')
            ->limit(5)
            ->get()
            ->map(fn($act) => [
                'id'           => $act->id,
                'user_name'    => $act->user_name,
                'action'       => $act->action,
                'target_name'  => $act->target_name,
                'project_name' => $act->project_name,
                'avatar_color' => $act->avatar_color ?: '#FF2F92',
                'time_ago'     => $act->created_at ? $act->created_at->diffForHumans() : 'baru saja',
            ]);

        return response()->json([
            'kpi' => [
                'total_projects'     => $totalProjects,
                'active_projects'    => $activeProjects,
                'completed_projects' => $completedProjects,
                'at_risk_projects'   => $atRiskProjects,
                'total_tasks'        => $totalTasks,
                'tasks_in_progress'  => $tasksInProgress,
                'overdue_tasks'      => $overdueTasks,
                'unassigned_tasks'   => $unassignedTasks,
                'pending_tasks'      => $pendingTasks,
                'avg_progress'       => $avgProgress,
            ],
            'my_projects'        => $myProjects,
            'attention_tasks'    => $attentionTasks,
            'attention_projects' => $attentionProjects,
            'recent_activities'  => $recentActivities,
        ]);
    }
}
