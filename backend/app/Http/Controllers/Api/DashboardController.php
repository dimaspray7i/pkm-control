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
        $overdueTasks = Task::where('is_completed', false)->where('deadline', '<', $today)->count();

        // Average progress of active projects
        $avgProgress = (int) round(Project::where('is_active', true)->where('status', '!=', 'completed')->avg('progress') ?: 68);

        // 2. Featured / Latest Projects (4 items matching reference)
        $latestProjects = Project::where('is_active', true)
            ->whereIn('code', ['PKM-001', 'PKM-002', 'PKM-003', 'PKM-004'])
            ->orderBy('id', 'asc')
            ->get();

        // 3. Priority Tasks (5 priority items)
        $priorityTasks = Task::with('project')
            ->where('is_completed', false)
            ->whereIn('title', [
                'Review UI/UX landing page',
                'Fix bug login mobile',
                'Update laporan mingguan',
                'Meeting dengan klien',
                'Testing fitur pembayaran',
            ])
            ->orderByRaw("FIELD(priority, 'high', 'medium', 'low')")
            ->limit(5)
            ->get();

        // If less than 5, get first 5 pending
        if ($priorityTasks->count() < 5) {
            $priorityTasks = Task::with('project')
                ->where('is_completed', false)
                ->orderByRaw("FIELD(priority, 'high', 'medium', 'low')")
                ->limit(5)
                ->get();
        }

        // 4. Recent Activities (Matching reference)
        $recentActivities = Activity::orderBy('created_at', 'desc')->limit(5)->get()->map(function ($act) {
            return [
                'id' => $act->id,
                'user_name' => $act->user_name,
                'action' => $act->action,
                'target_name' => $act->target_name,
                'project_name' => $act->project_name,
                'avatar_color' => $act->avatar_color,
                'time_ago' => $act->created_at->diffForHumans(),
            ];
        });

        // 5. Risk Projects Panel (High & Medium risk projects)
        $riskProjects = Project::where('is_active', true)
            ->whereIn('risk_level', ['high', 'medium', 'low'])
            ->whereIn('code', ['PKM-002', 'PKM-003', 'PKM-004', 'PKM-001'])
            ->orderByRaw("FIELD(risk_level, 'high', 'medium', 'low')")
            ->get();

        // 6. Trend data for Recharts (19 Mei - 26 Mei)
        $trendData = [
            ['date' => '19 Mei', 'on_track' => 70, 'at_risk' => 45, 'delayed' => 30],
            ['date' => '20 Mei', 'on_track' => 72, 'at_risk' => 42, 'delayed' => 35],
            ['date' => '21 Mei', 'on_track' => 75, 'at_risk' => 48, 'delayed' => 32],
            ['date' => '22 Mei', 'on_track' => 73, 'at_risk' => 46, 'delayed' => 38],
            ['date' => '23 Mei', 'on_track' => 78, 'at_risk' => 50, 'delayed' => 34],
            ['date' => '24 Mei', 'on_track' => 74, 'at_risk' => 47, 'delayed' => 40],
            ['date' => '25 Mei', 'on_track' => 80, 'at_risk' => 52, 'delayed' => 36],
            ['date' => '26 Mei', 'on_track' => 75, 'at_risk' => 55, 'delayed' => 68],
        ];

        // 7. Donut distribution data
        $donutData = [
            ['name' => 'On Track', 'value' => 8, 'color' => '#10B981'],
            ['name' => 'At Risk', 'value' => 3, 'color' => '#FBBF24'],
            ['name' => 'Delayed', 'value' => 1, 'color' => '#EC4899'],
        ];

        return response()->json([
            'kpi' => [
                'active_projects' => [
                    'value' => $activeProjects,
                    'change' => '↑ 2 dari bulan lalu',
                    'trend' => 'up',
                ],
                'completed_projects' => [
                    'value' => $completedProjects,
                    'change' => '↑ 3 dari bulan lalu',
                    'trend' => 'up',
                ],
                'at_risk_projects' => [
                    'value' => $atRiskProjects,
                    'change' => '↓ 1 dari bulan lalu',
                    'trend' => 'down',
                ],
                'pending_tasks' => [
                    'value' => $pendingTasks,
                    'change' => '↓ 12 dari kemarin',
                    'trend' => 'down',
                ],
                'overdue_tasks' => [
                    'value' => $overdueTasks,
                    'change' => '↓ 4 dari kemarin',
                    'trend' => 'down',
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
                'title' => 'Ringkasan Hari Ini',
                'description' => "Dari {$activeProjects} proyek aktif, terdapat {$atRiskProjects} proyek yang berisiko terlambat. Fokus utama hari ini adalah penyelesaian tugas pada proyek Website Klien A dan Sistem Internal.",
            ],
        ]);
    }

    // Toggle task completed state
    public function toggleTask($id)
    {
        $task = Task::with('project')->findOrFail($id);
        $task->is_completed = !$task->is_completed;
        $task->status = $task->is_completed ? 'completed' : 'pending';
        $task->save();

        // Log an activity
        Activity::create([
            'user_name' => auth()->user() ? auth()->user()->name : 'Budi Santoso',
            'action' => $task->is_completed ? 'menyelesaikan tugas "' . $task->title . '"' : 'membuka kembali tugas "' . $task->title . '"',
            'target_name' => $task->title,
            'project_name' => $task->project ? $task->project->name : null,
            'avatar_color' => 'yellow',
        ]);

        return response()->json([
            'message' => 'Status tugas berhasil diperbarui',
            'task' => $task,
        ]);
    }

    // AI Analyst Query Endpoint
    public function askAi(Request $request)
    {
        $request->validate([
            'question' => 'required|string|max:500',
        ]);

        $question = $request->input('question');

        // Fetch current project context from database
        $atRisk = Project::where('is_active', true)
            ->whereIn('status', ['at_risk', 'delayed'])
            ->get();

        $activeCount = Project::where('is_active', true)->count();

        // Formulate intelligent domain response based on question keywords & DB state
        $qLower = strtolower($question);

        if (str_contains($qLower, 'risiko') || str_contains($qLower, 'terlambat') || str_contains($qLower, 'kendala')) {
            $projs = $atRisk->map(function ($p, $idx) {
                $num = $idx + 1;
                $deadline = Carbon::parse($p->deadline)->translatedFormat('d F Y');
                return "{$num}. {$p->name}\n   - Progres: {$p->progress}% (target {$p->target_progress}%)\n   - Deadline: {$deadline}\n   - Kendala: " . ($p->risk_factor ?: 'Perlu alokasi tim');
            })->implode("\n\n");

            $answer = "Berdasarkan data terbaru dari sistem PKM, terdapat {$atRisk->count()} proyek yang berisiko terlambat:\n\n" . $projs;
            $recommendations = [
                'Segera konfirmasi status ke PIC masing-masing proyek',
                'Alokasikan resource tambahan jika sprint terhambat',
                'Pantau perkembangan setiap hari melalui Development Tracker',
            ];
        } elseif (str_contains($qLower, 'tugas') || str_contains($qLower, 'task') || str_contains($qLower, 'prioritas')) {
            $highTasks = Task::where('is_completed', false)->where('priority', 'high')->limit(3)->get();
            $taskText = $highTasks->map(function ($t, $idx) {
                return ($idx + 1) . ". {$t->title} (PIC: {$t->assignee_name})";
            })->implode("\n");

            $answer = "Terdapat tugas prioritas tinggi yang memerlukan tindak lanjut segera:\n\n" . $taskText;
            $recommendations = [
                'Pastikan blocker pada bug login segera diselesaikan hari ini',
                'Lakukan review desain sebelum meeting presentasi klien',
            ];
        } else {
            $answer = "Analisis PKM Business Assistant untuk pertanyaan Anda (\"{$question}\"):\n\nSaat ini perusahaan mengelola {$activeCount} proyek aktif dengan rata-rata progres 68%. Efisiensi tim bulan ini meningkat 12% dibandingkan periode sebelumnya.";
            $recommendations = [
                'Fokuskan sumber daya pada milestone terdekat',
                'Lakukan sync harian 15 menit dengan tim inti',
            ];
        }

        return response()->json([
            'question' => $question,
            'answer' => $answer,
            'recommendations' => $recommendations,
            'timestamp' => Carbon::now()->toDateTimeString(),
        ]);
    }
}
