<?php

namespace App\Services;

use App\Models\BlockerResolution;
use App\Models\ExecutiveDecision;
use App\Models\ExecutiveDecisionAudit;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\ProjectReport;
use App\Models\StrategicRisk;
use App\Models\Task;
use App\Models\TaskReview;
use App\Models\TaskUpdate;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ExecutiveBusinessContextService
{
    /**
     * Build structured executive business context across all core modules.
     */
    public function buildExecutiveContext(?string $period = 'all_time'): array
    {
        $today = Carbon::today()->toDateString();
        $now = Carbon::now();

        // 1. PROJECTS BREAKDOWN & CHI CALCULATION
        $allProjects = Project::with(['pic:id,name'])->get();
        $activeProjects = $allProjects->where('status', '!=', 'completed');
        $totalProjects = $allProjects->count();
        $completedProjects = $allProjects->where('status', 'completed')->count();
        $delayedProjects = $allProjects->where('status', 'delayed')->values();
        $onTrackProjects = $allProjects->where('status', 'on_track')->values();
        $atRiskProjects = $allProjects->where('status', 'at_risk')->values();

        $avgProgress = $totalProjects > 0 ? round($allProjects->avg('progress'), 1) : 0;
        $onTrackRate = $totalProjects > 0 ? round(($onTrackProjects->count() / $totalProjects) * 100, 1) : 0;

        // Tasks snapshot
        $allTasks = Task::with('project:id,code,name')->get();
        $totalTasks = $allTasks->count();
        $completedTasks = $allTasks->where('is_completed', true)->count();
        $pendingTasks = $totalTasks - $completedTasks;
        $overdueTasks = $allTasks->filter(function ($t) use ($today) {
            return !$t->is_completed && !empty($t->deadline) && $t->deadline < $today;
        });
        $inReviewTasks = $allTasks->where('status', 'in_review')->count();
        $overdueTaskRate = $totalTasks > 0 ? round(($overdueTasks->count() / $totalTasks) * 100, 1) : 0;

        // Milestones snapshot
        $allMilestones = Milestone::all();
        $totalMilestones = $allMilestones->count();
        $completedMilestones = $allMilestones->where('status', 'completed')->count();
        $overdueMilestones = $allMilestones->filter(function ($m) use ($today) {
            return $m->status !== 'completed' && !empty($m->due_date) && $m->due_date < $today;
        });
        $milestoneOnTimeRate = $totalMilestones > 0 ? round((($totalMilestones - $overdueMilestones->count()) / $totalMilestones) * 100, 1) : 100;

        // Corporate Health Index (CHI)
        $chiScore = round(($onTrackRate * 0.4) + ($avgProgress * 0.3) + ($milestoneOnTimeRate * 0.2) + ((100 - min(100, $overdueTaskRate)) * 0.1), 1);
        $chiCategory = 'Baik';
        if ($chiScore >= 80) $chiCategory = 'Sangat Sehat';
        elseif ($chiScore >= 65) $chiCategory = 'Sehat';
        elseif ($chiScore >= 50) $chiCategory = 'Cukup / Perlu Perhatian';
        else $chiCategory = 'Kritis / Perlu Intervensi';

        // Compact Project Performance Summary
        $projectSummaries = $allProjects->map(function ($p) {
            $variance = !empty($p->target_progress) ? ((int)$p->progress - (int)$p->target_progress) : 0;
            return [
                'id' => $p->id,
                'code' => $p->code,
                'name' => $p->name,
                'status' => $p->status,
                'progress' => (int)$p->progress,
                'target_progress' => (int)($p->target_progress ?? 0),
                'deviation' => $variance,
                'deadline' => $p->target_completion_date ?? $p->deadline,
                'pic' => $p->pic ? $p->pic->name : ($p->pic_name ?? 'Unassigned'),
            ];
        })->values()->take(15)->all();

        // 2. TEAM WORKLOAD & CAPACITY INTELLIGENCE
        $teamMembers = User::where('is_active', true)->whereIn('role', ['project_manager', 'member'])->get();
        $workloadSummary = $teamMembers->map(function ($u) use ($allTasks, $today) {
            $userTasks = $allTasks->where('user_id', $u->id);
            $userPending = $userTasks->where('is_completed', false)->count();
            $userOverdue = $userTasks->filter(function ($t) use ($today) {
                return !$t->is_completed && !empty($t->due_date) && $t->due_date < $today;
            })->count();

            return [
                'id' => $u->id,
                'name' => $u->name,
                'role' => $u->role,
                'total_tasks' => $userTasks->count(),
                'pending_tasks' => $userPending,
                'overdue_tasks' => $userOverdue,
                'is_overloaded' => $userPending > 4,
            ];
        })->sortByDesc('pending_tasks')->values()->take(10)->all();

        $overloadedMembers = array_values(array_filter($workloadSummary, fn($m) => $m['is_overloaded']));

        // 3. RISK INTELLIGENCE (Strategic Risks & Auto Detections)
        $allRisks = StrategicRisk::with('project:id,code,name')->get();
        $activeRisks = $allRisks->whereIn('status', ['open', 'mitigating', 'monitoring']);
        $criticalRisks = $activeRisks->where('risk_level', 'critical')->values();
        $highRisks = $activeRisks->where('risk_level', 'high')->values();
        $overdueRisks = $activeRisks->filter(function ($r) use ($today) {
            return !empty($r->target_resolution_date) && $r->target_resolution_date < $today;
        })->values();

        $topRisks = $activeRisks->sortByDesc('risk_score')->take(6)->map(function ($r) {
            return [
                'code' => $r->risk_code,
                'title' => $r->title,
                'project' => $r->project ? $r->project->code : 'General',
                'category' => $r->category,
                'score' => $r->risk_score,
                'level' => $r->risk_level,
                'mitigation' => $r->mitigation,
                'target_date' => $r->target_resolution_date,
            ];
        })->values()->all();

        // 4. BLOCKER INTELLIGENCE
        $resolvedBlockerIds = BlockerResolution::where('status', 'resolved')->pluck('task_update_id');
        $activeBlockerUpdates = TaskUpdate::with(['task.project:id,code,name', 'user:id,name'])
            ->whereNotNull('blocker')
            ->where('blocker', '!=', '')
            ->whereNotIn('id', $resolvedBlockerIds)
            ->orderBy('created_at', 'desc')
            ->take(8)
            ->get();

        $blockersList = $activeBlockerUpdates->map(function ($bu) use ($today) {
            $daysOpen = Carbon::parse($bu->created_at)->diffInDays(Carbon::parse($today));
            return [
                'id' => $bu->id,
                'task' => $bu->task ? $bu->task->title : 'Task #' . $bu->task_id,
                'project' => $bu->task && $bu->task->project ? $bu->task->project->code : 'PKM-000',
                'reported_by' => $bu->user ? $bu->user->name : 'Anggota',
                'days_open' => (int) $daysOpen,
                'blocker_text' => $bu->blocker,
                'is_critical_aged' => $daysOpen >= 2,
            ];
        })->values()->all();

        // 5. EXECUTIVE DECISIONS INTELLIGENCE
        $allDecisions = ExecutiveDecision::with(['project:id,code', 'pic:id,name'])->get();
        $totalDecisions = $allDecisions->count();
        $activeDecisions = $allDecisions->whereIn('status', ['draft', 'approved', 'in_progress']);
        $completedDecisions = $allDecisions->where('status', 'completed');
        $overdueDecisions = $allDecisions->filter(function ($d) use ($today) {
            return in_array($d->status, ['approved', 'in_progress'], true) && !empty($d->due_date) && $d->due_date < $today;
        });

        $topDecisions = $allDecisions->sortByDesc('created_at')->take(5)->map(function ($d) {
            return [
                'number' => $d->decision_number,
                'title' => $d->title,
                'status' => $d->status,
                'priority' => $d->priority,
                'pic' => $d->pic ? $d->pic->name : ($d->pic_name ?? 'Belum ada'),
                'due_date' => $d->due_date,
            ];
        })->values()->all();

        // 6. WEEKLY REPORTS INTELLIGENCE
        $latestReports = ProjectReport::with('project:id,code,name')
            ->where('status', 'published')
            ->orderBy('created_at', 'desc')
            ->take(5)
            ->get()
            ->map(function ($rep) {
                return [
                    'project' => $rep->project ? $rep->project->code : 'Proyek',
                    'period' => $rep->report_period ?? ($rep->start_date . ' s/d ' . $rep->end_date),
                    'progress_at_report' => $rep->progress_percentage ?? $rep->progress_snapshot,
                    'summary' => substr($rep->executive_summary ?? $rep->work_accomplished ?? '', 0, 150),
                ];
            })->values()->all();

        return [
            'as_of_date' => $now->translatedFormat('l, d F Y'),
            'as_of_time' => $now->format('H:i') . ' WIB',
            'period' => $period,
            'company_health' => [
                'chi_score' => $chiScore,
                'chi_category' => $chiCategory,
                'total_projects' => $totalProjects,
                'active_projects' => $activeProjects->count(),
                'completed_projects' => $completedProjects,
                'on_track_count' => $onTrackProjects->count(),
                'delayed_count' => $delayedProjects->count(),
                'at_risk_count' => $atRiskProjects->count(),
                'avg_progress' => $avgProgress,
                'on_track_rate' => $onTrackRate,
            ],
            'tasks_performance' => [
                'total_tasks' => $totalTasks,
                'completed_tasks' => $completedTasks,
                'pending_tasks' => $pendingTasks,
                'overdue_tasks' => $overdueTasks->count(),
                'overdue_task_rate' => $overdueTaskRate,
                'in_review_tasks' => $inReviewTasks,
            ],
            'milestones_performance' => [
                'total_milestones' => $totalMilestones,
                'completed_milestones' => $completedMilestones,
                'overdue_milestones' => $overdueMilestones->count(),
                'milestone_on_time_rate' => $milestoneOnTimeRate,
            ],
            'projects' => $projectSummaries,
            'team_workload' => [
                'total_tracked_members' => count($workloadSummary),
                'overloaded_members_count' => count($overloadedMembers),
                'overloaded_members' => $overloadedMembers,
                'top_workloads' => $workloadSummary,
            ],
            'risks' => [
                'total_active' => $activeRisks->count(),
                'critical_count' => $criticalRisks->count(),
                'high_count' => $highRisks->count(),
                'overdue_count' => $overdueRisks->count(),
                'top_active_risks' => $topRisks,
            ],
            'blockers' => [
                'total_active' => count($blockersList),
                'critical_aged_count' => count(array_filter($blockersList, fn($b) => $b['is_critical_aged'])),
                'active_blockers' => $blockersList,
            ],
            'decisions' => [
                'total_all' => $totalDecisions,
                'active_count' => $activeDecisions->count(),
                'completed_count' => $completedDecisions->count(),
                'overdue_count' => $overdueDecisions->count(),
                'recent_decisions' => $topDecisions,
            ],
            'weekly_reports' => $latestReports,
        ];
    }

    /**
     * Generate structured Executive Insights categorized across 6 operational areas.
     */
    public function getExecutiveInsights(?string $period = 'all_time'): array
    {
        $ctx = $this->buildExecutiveContext($period);
        $insights = [];

        // 1. Business Health Insight
        $chi = $ctx['company_health']['chi_score'];
        $delayedCount = $ctx['company_health']['delayed_count'];
        $totalProj = $ctx['company_health']['total_projects'];

        $insights[] = [
            'id' => 'ins-health-1',
            'category' => 'Business Health',
            'title' => "Indeks Kesehatan Perusahaan (CHI): {$chi}/100 — Kategori {$ctx['company_health']['chi_category']}",
            'summary' => "Kondisi umum perusahaan berada pada level {$ctx['company_health']['chi_category']} dengan {$ctx['company_health']['on_track_count']} dari {$totalProj} proyek berstatus On Track.",
            'factual_evidence' => "Rasio proyek on-track: {$ctx['company_health']['on_track_rate']}%. Rata-rata progres proyek: {$ctx['company_health']['avg_progress']}%. Proyek delayed: {$delayedCount}.",
            'business_impact' => $delayedCount > 0 ? "Terdapat {$delayedCount} proyek terlambat yang berpotensi menimbulkan penalti komersial dan persepsi negatif klien." : "Operasional berjalan stabil sesuai target baseline perusahaan.",
            'priority' => $chi < 60 ? 'critical' : ($chi < 75 ? 'high' : 'medium'),
            'recommended_action' => $delayedCount > 0 ? "Fokuskan intervensi mingguan pada pemulihan jadwal proyek delayed." : "Pertahankan ritme deliverable dan monitor sprint milestone.",
            'data_source' => 'Corporate Health Index (CHI) Algorithmic Engine',
        ];

        // 2. Project Performance Insight
        $delayedProjects = array_values(array_filter($ctx['projects'], fn($p) => $p['status'] === 'delayed' || $p['deviation'] <= -15));
        if (!empty($delayedProjects)) {
            $worstProj = $delayedProjects[0];
            $insights[] = [
                'id' => 'ins-proj-1',
                'category' => 'Project Performance',
                'title' => "Deviasi Signifikan: Proyek {$worstProj['name']} ({$worstProj['code']})",
                'summary' => "Proyek {$worstProj['code']} mengalami defisit progres sebesar " . abs($worstProj['deviation']) . "% di bawah target.",
                'factual_evidence' => "Progres aktual {$worstProj['progress']}% vs target {$worstProj['target_progress']}%. PIC penanggung jawab: {$worstProj['pic']}. Deadline: {$worstProj['deadline']}.",
                'business_impact' => "Keterlambatan penyelesaian berisiko menunda penagihan termin kontrak berikutnya.",
                'recommended_action' => "Pimpinan dapat memanggil PIC {$worstProj['pic']} untuk merevisi master timeline atau menyetujui alokasi resource tambahan.",
                'priority' => 'critical',
                'data_source' => 'Analisis Deviasi Progres Portofolio',
            ];
        }

        // 3. Delivery Risk Insight
        $critRisksCount = $ctx['risks']['critical_count'];
        $highRisksCount = $ctx['risks']['high_count'];
        if ($critRisksCount > 0 || $highRisksCount > 0) {
            $topRisk = $ctx['risks']['top_active_risks'][0] ?? null;
            $insights[] = [
                'id' => 'ins-risk-1',
                'category' => 'Delivery Risk',
                'title' => "Terdapat {$critRisksCount} Risiko Kritis dan {$highRisksCount} Risiko Tinggi Aktif",
                'summary' => $topRisk ? "Risiko paling menonjol: [{$topRisk['code']}] {$topRisk['title']} (Score: {$topRisk['score']})." : "Risiko strategis memerlukan penanganan mitigasi terencana.",
                'factual_evidence' => $topRisk ? "Kategori: {$topRisk['category']}. Mitigasi direncanakan: \"{$topRisk['mitigation']}\"." : "Risiko aktif tercatat di Risk Register.",
                'business_impact' => "Risiko yang tidak termitigasi dapat berkembang menjadi blocker langsung pada timeline sprint.",
                'recommended_action' => "Evaluasi efektivitas rencana mitigasi dan tetapkan PIC eksekutif bila diperlukan.",
                'priority' => $critRisksCount > 0 ? 'critical' : 'high',
                'data_source' => 'Executive Risk Register (Score L x I)',
            ];
        }

        // 4. Team Productivity & Workload Bottleneck Insight
        $overloadedCount = $ctx['team_workload']['overloaded_members_count'];
        if ($overloadedCount > 0) {
            $overloadedNames = implode(', ', array_map(fn($m) => $m['name'] . ' (' . $m['pending_tasks'] . ' tugas)', array_slice($ctx['team_workload']['overloaded_members'], 0, 2)));
            $insights[] = [
                'id' => 'ins-team-1',
                'category' => 'Team Productivity',
                'title' => "Ketimpangan Beban Kerja: {$overloadedCount} Anggota Tim Mengalami Overload",
                'summary' => "Personil internal dengan beban lebih dari 4 tugas aktif: {$overloadedNames}.",
                'factual_evidence' => "Terdapat total {$ctx['tasks_performance']['overdue_tasks']} tugas overdue di seluruh divisi.",
                'business_impact' => "Beban berlebih pada segelintir personil menciptakan bottleneck operasional dan meningkatkan risiko cacat mutu pekerjaan.",
                'recommended_action' => "Disposisikan Project Manager untuk menyeimbangkan penugasan tugas kepada anggota tim dengan kapasitas longgar.",
                'priority' => 'high',
                'data_source' => 'Workload Distribution & Member Capacity Matrix',
            ];
        }

        // 5. Operational Blocker Insight
        $blockersCount = $ctx['blockers']['total_active'];
        $critBlockers = $ctx['blockers']['critical_aged_count'];
        if ($blockersCount > 0) {
            $firstBlk = $ctx['blockers']['active_blockers'][0] ?? null;
            $insights[] = [
                'id' => 'ins-blk-1',
                'category' => 'Operational Blocker',
                'title' => "{$blockersCount} Kendala Lapangan Aktif ({$critBlockers} Tertahan &ge; 2 Hari)",
                'summary' => $firstBlk ? "Blocker pada tugas '{$firstBlk['task']}' ({$firstBlk['project']}): \"{$firstBlk['blocker_text']}\"." : "Terdapat blocker operasional.",
                'factual_evidence' => $firstBlk ? "Dilaporkan oleh {$firstBlk['reported_by']} sejak {$firstBlk['days_open']} hari yang lalu." : "Blocker terdata dari laporan harian.",
                'business_impact' => "Pekerjaan teknis anggota tim terhenti total dan memperlambat pencapaian checklist tugas.",
                'recommended_action' => "Buka koordinasi lintas departemen atau buat Keputusan Eksekutif untuk menyelesaikan hambatan akses/pihak ketiga.",
                'priority' => $critBlockers > 0 ? 'critical' : 'high',
                'data_source' => 'Task Updates & Blocker Resolutions Stream',
            ];
        }

        // 6. Strategic Decision Follow-up Insight
        $overdueDecisionsCount = $ctx['decisions']['overdue_count'];
        if ($overdueDecisionsCount > 0) {
            $insights[] = [
                'id' => 'ins-dec-1',
                'category' => 'Strategic Decision',
                'title' => "{$overdueDecisionsCount} Keputusan Eksekutif Melewati Target Tenggat Waktu",
                'summary' => "Instruksi pimpinan yang telah disetujui belum rampung dieksekusi oleh PIC terkait.",
                'factual_evidence' => "Total keputusan aktif: {$ctx['decisions']['active_count']}. Keputusan overdue: {$overdueDecisionsCount}.",
                'business_impact' => "Keterlambatan eksekusi keputusan manajemen menunda dampak perbaikan performa yang diharapkan.",
                'recommended_action' => "Tinjau status implementasi bersama PIC terkait dan perbarui tenggat waktu baru bila diperlukan.",
                'priority' => 'high',
                'data_source' => 'Executive Decision Registry & Audit Trail',
            ];
        }

        return $insights;
    }

    /**
     * Conduct deep-dive Root Cause Analysis (RCA) on a specific project.
     */
    public function analyzeProjectRootCause(int $projectId): array
    {
        $today = Carbon::today()->toDateString();
        $project = Project::with([
            'pic:id,name,email',
            'tasks.assignee:id,name',
            'milestones',
            'reports' => fn($q) => $q->orderBy('created_at', 'desc')->take(3)
        ])->find($projectId);

        if (!$project) {
            throw new \Exception('Proyek tidak ditemukan.');
        }

        $variance = !empty($project->target_progress) ? ((int)$project->progress - (int)$project->target_progress) : 0;
        $tasks = $project->tasks ?? collect();
        $totalTasks = $tasks->count();
        $completedTasks = $tasks->where('is_completed', true)->count();
        $overdueTasks = $tasks->filter(function ($t) use ($today) {
            return !$t->is_completed && !empty($t->deadline) && $t->deadline < $today;
        })->values();

        $inReviewTasks = $tasks->where('status', 'in_review')->values();

        // Overdue milestones
        $overdueMilestones = ($project->milestones ?? collect())->filter(function ($m) use ($today) {
            return $m->status !== 'completed' && !empty($m->due_date) && $m->due_date < $today;
        })->values();

        // Active blockers on this project's tasks
        $taskIds = $tasks->pluck('id');
        $resolvedBlockerIds = BlockerResolution::where('status', 'resolved')->pluck('task_update_id');
        $activeBlockers = TaskUpdate::with('user:id,name')
            ->whereIn('task_id', $taskIds)
            ->whereNotNull('blocker')
            ->where('blocker', '!=', '')
            ->whereNotIn('id', $resolvedBlockerIds)
            ->get();

        // Associated Strategic Risks
        $projectRisks = StrategicRisk::where('project_id', $project->id)
            ->whereIn('status', ['open', 'mitigating', 'monitoring'])
            ->get();

        // Symptoms (Fakta Masalah)
        $symptoms = [];
        $symptoms[] = "Progres aktual saat ini ({$project->progress}%) mengalami deviasi " . abs($variance) . "% dari target baseline ({$project->target_progress}%).";
        $symptoms[] = "Status resmi proyek di sistem adalah '" . strtoupper($project->status) . "'.";
        if ($overdueTasks->count() > 0) {
            $symptoms[] = "Terdapat {$overdueTasks->count()} tugas operasional yang telah melewati deadline penyelesaian.";
        }
        if ($overdueMilestones->count() > 0) {
            $symptoms[] = "Terdapat {$overdueMilestones->count()} milestone tahapan sprint yang kadaluarsa: " . $overdueMilestones->pluck('title')->implode(', ') . ".";
        }
        if ($activeBlockers->count() > 0) {
            $symptoms[] = "Tercatat {$activeBlockers->count()} kendala lapangan (blocker) aktif yang belum terselesaikan.";
        }
        if ($inReviewTasks->count() > 0) {
            $symptoms[] = "Terdapat {$inReviewTasks->count()} tugas tertahan dalam tahap review/approval PM.";
        }

        // Potential Root Causes (Hypotheses)
        $hypotheses = [];
        if ($activeBlockers->count() > 0) {
            $hypotheses[] = [
                'hypothesis' => 'Ketergantungan Eksternal atau Akses Terhambat (Terbukti oleh Blocker Lapangan)',
                'confidence' => 'Tinggi (85%)',
                'evidence' => "Blocker aktual: \"" . substr($activeBlockers->first()->blocker, 0, 100) . "...\"",
            ];
        }
        if ($overdueTasks->count() > 0 && $overdueTasks->count() >= ($totalTasks * 0.3)) {
            $hypotheses[] = [
                'hypothesis' => 'Estimasi Waktu Sprint Kurang Realistis atau Keterbatasan Kapasitas Anggota',
                'confidence' => 'Tinggi (80%)',
                'evidence' => "Lebih dari 30% tugas proyek ({$overdueTasks->count()} tugas) terlambat dari jadwal awal.",
            ];
        }
        if ($inReviewTasks->count() >= 3) {
            $hypotheses[] = [
                'hypothesis' => 'Bottleneck pada Siklus Persetujuan Review Tugas oleh PM',
                'confidence' => 'Sedang (70%)',
                'evidence' => "{$inReviewTasks->count()} tugas telah disubmit oleh tim namun belum disetujui atau dikoreksi oleh PM.",
            ];
        }
        if (empty($hypotheses)) {
            $hypotheses[] = [
                'hypothesis' => 'Pergeseran Prioritas Kerja Tim atau Kendala Koordinasi Non-Teknis',
                'confidence' => 'Sedang (60%)',
                'evidence' => "Tidak ditemukan blocker resmi tercatat, namun kecepatan penyelesaian tugas menurun.",
            ];
        }

        // Actionable Recommendations
        $recommendations = [];
        if ($activeBlockers->count() > 0) {
            $recommendations[] = [
                'action' => 'Eskalasi Penyelesaian Blocker',
                'priority' => 'Critical',
                'owner' => 'Pimpinan & PM',
                'detail' => 'Selesaikan kendala akses/vendor yang dilaporkan pada ' . $activeBlockers->count() . ' blocker aktif.',
            ];
        }
        if ($overdueTasks->count() > 0) {
            $recommendations[] = [
                'action' => 'Penyusunan Rencana Pemulihan Jadwal (Recovery Plan)',
                'priority' => 'High',
                'owner' => $project->pic ? $project->pic->name : 'Project Manager',
                'detail' => 'Instruksikan PM menyusun pemetaan ulang deadline ' . $overdueTasks->count() . ' tugas yang terlambat.',
            ];
        }
        $recommendations[] = [
            'action' => 'Evaluasi Alokasi Sumber Daya Proyek',
            'priority' => 'Medium',
            'owner' => 'Pimpinan',
            'detail' => 'Pertimbangkan penambahan 1 personil perbantuan untuk sprint kritis berikutnya.',
        ];

        return [
            'project' => [
                'id' => $project->id,
                'code' => $project->code,
                'name' => $project->name,
                'client' => $project->client ?? 'Internal PKM',
                'pic' => $project->pic ? $project->pic->name : 'Unassigned',
                'status' => $project->status,
                'progress' => (int) $project->progress,
                'target_progress' => (int) ($project->target_progress ?? 0),
                'deviation' => $variance,
                'deadline' => $project->target_completion_date ?? $project->deadline,
            ],
            'symptoms' => $symptoms,
            'hypotheses' => $hypotheses,
            'factual_metrics' => [
                'total_tasks' => $totalTasks,
                'completed_tasks' => $completedTasks,
                'overdue_tasks_count' => $overdueTasks->count(),
                'in_review_tasks_count' => $inReviewTasks->count(),
                'overdue_milestones_count' => $overdueMilestones->count(),
                'active_blockers_count' => $activeBlockers->count(),
                'strategic_risks_count' => $projectRisks->count(),
            ],
            'recommendations' => $recommendations,
            'analysis_confidence' => 'Tinggi (Berdasarkan Data Aktual Database)',
            'analyzed_at' => Carbon::now()->toIso8601String(),
        ];
    }

    /**
     * Executive AI Chat Dispatcher: Tries Google Gemini API first, gracefully falls back to deterministic engine.
     */
    public function askExecutiveAdvisor(string $prompt, array $history = [], ?string $period = 'all_time', ?User $user = null): array
    {
        $prompt = substr(trim($prompt), 0, 1000);
        $userRole = $user ? $user->role : 'pimpinan';
        $apiKey = env('GEMINI_API_KEY') ?: env('AI_API_KEY');

        // Build compact, rich business context
        $context = $this->buildExecutiveContext($period);

        // If Gemini API Key exists, invoke Google Gemini Free Tier
        if (!empty($apiKey)) {
            try {
                return $this->callGeminiExecutive($apiKey, $prompt, $context, $history, $userRole);
            } catch (\Illuminate\Http\Client\ConnectionException $e) {
                Log::warning('Gemini Connection Timeout in Executive Advisor: ' . $e->getMessage());
                $res = $this->synthesizeExecutiveFallback($prompt, $context, $userRole);
                $res['mode'] = 'Deterministic Rule-Based Engine (Fallback: Connection Timeout)';
                return $res;
            } catch (\Exception $e) {
                Log::warning('Gemini API Error in Executive Advisor: ' . $e->getMessage());
                $res = $this->synthesizeExecutiveFallback($prompt, $context, $userRole);
                $res['mode'] = 'Deterministic Rule-Based Engine (Fallback: API Limit/Error)';
                return $res;
            }
        }

        // Deterministic fallback if API key not set
        return $this->synthesizeExecutiveFallback($prompt, $context, $userRole);
    }

    /**
     * Call Google Gemini API with Executive Persona and Bounded Business Context.
     */
    public function callGeminiExecutive(string $apiKey, string $prompt, array $context, array $history, string $userRole): array
    {
        $model = env('AI_MODEL', 'gemini-3.8-flash');

        // Bounded context summary to prevent token overflow
        $compactContext = [
            'as_of' => $context['as_of_date'] . ' ' . $context['as_of_time'],
            'company_health' => $context['company_health'],
            'tasks' => $context['tasks_performance'],
            'milestones' => $context['milestones_performance'],
            'top_delayed_projects' => array_values(array_filter($context['projects'], fn($p) => $p['status'] === 'delayed' || $p['deviation'] <= -10)),
            'overloaded_members' => $context['team_workload']['overloaded_members'],
            'critical_and_high_risks' => $context['risks']['top_active_risks'],
            'active_blockers' => $context['blockers']['active_blockers'],
            'overdue_decisions' => $context['decisions']['overdue_count'],
        ];

        $contextJson = json_encode($compactContext, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        $systemPrompt = <<<SYS
Anda adalah AI Executive Advisor & Chief Business Intelligence Analyst resmi untuk Pimpinan PT Potensi Karya Mandiri (PKM Business Control Center).
Peran pengguna yang sedang berbicara dengan Anda: {$userRole}.

DATA BISNIS AKTUAL SAAT INI (REAL-TIME DATABASE SNAPSHOT):
{$contextJson}

PEDOMAN ANALISIS EKSEKUTIF:
1. GUNAKAN DATA AKTUAL DI ATAS. Dilarang keras mengarang angka, nama proyek, nama anggota tim, atau status fiktif.
2. JAWAB SELALU DALAM BAHASA INDONESIA PROFESIONAL, NATURAL, DAN MUDAH DIPAHAMI EKSEKUTIF.
3. BEDAKAN DENGAN JELAS:
   - FAKTA: Data kuantitatif aktual dari database (misal: "Progres proyek 45% vs target 80%").
   - INTERPRETASI: Analisis dampak bisnis terhadap operasional PKM.
   - ASUMSI / HIPOTESIS: Dugaan penyebab yang belum diverifikasi di lapangan.
4. FORMAT JAWABAN PROFESIONAL MENGGUNAKAN MARKDOWN:
   - Gunakan judul heading (###), bullet points, dan penekanan tebal (bold).
   - Tentukan tingkat prioritas tindakan dalam Bahasa Indonesia (Kritis, Tinggi, Sedang, Rendah).
   - Berikan rekomendasi strategis yang spesifik: Masalah, Bukti Data, Dampak Bisnis, Aksi Rekomendasi, dan PIC yang disarankan.
5. BATASAN SISTEM: Rekomendasi Anda adalah instrumen pendukung keputusan. Anda TIDAK BISA dan TIDAK BOLEH memutasi database secara otomatis. Seluruh keputusan berada di tangan Pimpinan.
SYS;

        // Sanitize conversation history
        $sanitizedHistory = [];
        foreach (array_slice($history, -4) as $h) {
            if (!empty($h['user'])) $sanitizedHistory[] = 'Pimpinan: ' . substr(trim((string)$h['user']), 0, 300);
            if (!empty($h['reply'])) $sanitizedHistory[] = 'AI Advisor: ' . substr(trim((string)$h['reply']), 0, 300);
        }
        $historyText = !empty($sanitizedHistory) ? implode("\n\n", $sanitizedHistory) : 'Tidak ada riwayat sebelumnya.';

        $contents = [
            [
                'role' => 'user',
                'parts' => [
                    ['text' => "{$systemPrompt}\n\nRIWAYAT PERCAKAPAN:\n{$historyText}\n\nPERTANYAAN PIMPINAN: {$prompt}"]
                ]
            ]
        ];

        $response = Http::timeout(25)->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}", [
            'contents' => $contents,
            'generationConfig' => [
                'maxOutputTokens' => 2000,
                'temperature' => 0.2,
            ]
        ]);

        if ($response->successful()) {
            $data = $response->json();
            $reply = $data['candidates'][0]['content']['parts'][0]['text'] ?? 'Tidak ada respon dari model AI.';

            return [
                'success' => true,
                'reply' => $reply,
                'summary' => 'Analisis strategis disusun oleh Google Gemini AI berdasarkan snapshot data aktual PKM.',
                'mode' => 'Google Gemini LLM (' . $model . ')',
                'data_sources' => [
                    'Corporate Health Index (CHI)',
                    'Portfolio Project Statuses',
                    'Strategic Risk Register',
                    'Blocker Stream & Resolutions',
                    'Executive Decisions',
                ],
                'timestamp' => Carbon::now()->format('H:i, d M Y'),
            ];
        }

        throw new \Exception('Gemini status: ' . $response->status());
    }

    /**
     * Deterministic Rule-Based Fallback Engine for Executive Queries.
     */
    public function synthesizeExecutiveFallback(string $prompt, array $context, string $userRole): array
    {
        $norm = strtolower($prompt);
        $ch = $context['company_health'];
        $tasks = $context['tasks_performance'];
        $risks = $context['risks'];
        $blockers = $context['blockers'];
        $decisions = $context['decisions'];

        $reply = "";
        $sources = ['Database PKM Control Center Real-Time'];

        // Pattern 1: Kondisi Bisnis / Kesehatan Perusahaan
        if (preg_match('/(kondisi|kesehatan|chi|overview|performa.*bisnis|bagaimana.*bisnis|kabar.*perusahaan)/i', $norm)) {
            $reply = "### Ringkasan Kondisi Bisnis PT Potensi Karya Mandiri\n\n"
                . "**1. Indeks Kesehatan Perusahaan (CHI):** `{$ch['chi_score']}/100` ({$ch['chi_category']})\n"
                . "- Proyek Aktif: **{$ch['active_projects']} proyek** (On Track: **{$ch['on_track_count']}**, Delayed: **{$ch['delayed_count']}**, At Risk: **{$ch['at_risk_count']}**)\n"
                . "- Rata-rata Progres Proyek: **{$ch['avg_progress']}%** (Rasio On Track: **{$ch['on_track_rate']}%**)\n\n"
                . "**2. Eksekusi Tugas & Milestone:**\n"
                . "- Tugas Selesai: **{$tasks['completed_tasks']} dari {$tasks['total_tasks']}** ({$tasks['overdue_tasks']} tugas overdue / {$tasks['overdue_task_rate']}%)\n"
                . "- Milestone On-Time Rate: **{$context['milestones_performance']['milestone_on_time_rate']}%**\n\n"
                . "**3. Risiko & Blocker Kritis:**\n"
                . "- Risiko Aktif: **{$risks['total_active']} risiko** ({$risks['critical_count']} Kritis, {$risks['high_count']} Tinggi)\n"
                . "- Blocker Lapangan Tertahan: **{$blockers['total_active']} kendala** ({$blockers['critical_aged_count']} tertahan $\\ge 2$ hari)\n\n"
                . "> **Rekomendasi Eksekutif:** Prioritaskan intervensi pada pemulihan jadwal {$ch['delayed_count']} proyek yang berstatus delayed dan eliminasi {$blockers['total_active']} blocker lapangan aktif.";
            $sources[] = 'Corporate Health Index (CHI)';
            $sources[] = 'Portfolio Overview';
        }
        // Pattern 2: Risiko Terbesar / Risk Register
        elseif (preg_match('/(risiko|risk|ancaman|bahaya|mitigasi)/i', $norm)) {
            $topList = "";
            foreach ($risks['top_active_risks'] as $idx => $r) {
                $num = $idx + 1;
                $topList .= "{$num}. **[{$r['code']}] {$r['title']}** (Proyek: {$r['project']})\n"
                    . "   - Level: `{$r['level']}` (Score: {$r['score']}) | Kategori: {$r['category']}\n"
                    . "   - Mitigasi: {$r['mitigation']}\n\n";
            }
            if (empty($topList)) $topList = "Saat ini tidak tercatat risiko aktif berkategori kritis.\n";

            $reply = "### Analisis Risiko Utama Perusahaan\n\n"
                . "Berdasarkan evaluasi *Risk & Decision Center*, tercatat **{$risks['total_active']} risiko aktif** ({$risks['critical_count']} Kritis, {$risks['high_count']} Tinggi, {$risks['overdue_count']} melewati tenggat):\n\n"
                . $topList
                . "> **Prioritas Tindakan:** Pastikan PIC pelaksana memperbarui progres mitigasi untuk risiko dengan tingkat *Critical*.";
            $sources[] = 'Executive Risk Register';
        }
        // Pattern 3: Proyek Terlambat / Intervensi
        elseif (preg_match('/(proyek.*terlambat|proyek.*bermasalah|intervensi|delayed|defisit|deviasi)/i', $norm)) {
            $delayed = array_values(array_filter($context['projects'], fn($p) => $p['status'] === 'delayed' || $p['deviation'] <= -15));
            $pList = "";
            foreach ($delayed as $p) {
                $pList .= "- **{$p['name']} ({$p['code']})**\n"
                    . "  - Status: `" . strtoupper($p['status']) . "` | Progres: **{$p['progress']}%** (Target: {$p['target_progress']}%, Deviasi: **{$p['deviation']}%**)\n"
                    . "  - PIC: {$p['pic']} | Deadline: {$p['deadline']}\n\n";
            }
            if (empty($pList)) $pList = "Seluruh proyek saat ini berada pada ambang batas deviasi yang dapat ditoleransi.\n";

            $reply = "### Daftar Proyek yang Membutuhkan Intervensi Pimpinan\n\n"
                . $pList
                . "> **Rekomendasi Strategis:** Instruksikan Project Manager terkait untuk menyusun *Schedule Recovery Plan* dengan re-alokasi checklist tugas operasional.";
            $sources[] = 'Project Delivery Tracking';
        }
        // Pattern 4: Beban Kerja / Workload Tim
        elseif (preg_match('/(beban|workload|anggota|tim|kapasitas|overload|sibuk)/i', $norm)) {
            $mList = "";
            foreach ($context['team_workload']['top_workloads'] as $m) {
                $statusTag = $m['is_overloaded'] ? "🚨 OVERLOAD" : "NORMAL";
                $mList .= "- **{$m['name']}** ({$m['role']}): **{$m['pending_tasks']} tugas aktif** ({$m['overdue_tasks']} overdue) — `{$statusTag}`\n";
            }

            $reply = "### Analisis Kapasitas & Beban Kerja Tim\n\n"
                . "Hasil audit distribusi tugas mendeteksi **{$context['team_workload']['overloaded_members_count']} personil mengalami overload** (>4 tugas aktif):\n\n"
                . $mList . "\n"
                . "> **Dampak Bisnis:** Konsentrasi tugas pada personil tertentu meningkatkan risiko *single-point-of-failure* dan memperlambat delivery proyek.";
            $sources[] = 'Team Workload Distribution';
        }
        // Pattern 5: Blocker Lapangan
        elseif (preg_match('/(blocker|kendala|hambatan|tertahan)/i', $norm)) {
            $bList = "";
            foreach ($blockers['active_blockers'] as $b) {
                $bList .= "- **Tugas: {$b['task']} ({$b['project']})**\n"
                    . "  - Kendala: *\"{$b['blocker_text']}\"*\n"
                    . "  - Pelapor: {$b['reported_by']} (Tertahan: **{$b['days_open']} hari**)\n\n";
            }
            if (empty($bList)) $bList = "Tidak ada blocker lapangan aktif saat ini.\n";

            $reply = "### Pemantauan Blocker Lapangan Aktif\n\n"
                . "Tercatat **{$blockers['total_active']} kendala lapangan** yang dilaporkan anggota tim:\n\n"
                . $bList
                . "> **Rekomendasi Tindakan:** Berikan arahan tindak lanjut pada *Blocker Monitoring Board* untuk membuka akses atau disposisi bantuan teknis.";
            $sources[] = 'Task Updates & Blocker Resolutions';
        }
        // Default General Consultation
        else {
            $reply = "### Analisis Strategis PKM Control Center\n\n"
                . "Berdasarkan pemantauan indikator kunci operasional PT Potensi Karya Mandiri:\n"
                . "- **Corporate Health Index:** `{$ch['chi_score']}/100` ({$ch['chi_category']})\n"
                . "- **Proyek Memerlukan Atensi:** {$ch['delayed_count']} proyek delayed dan {$risks['critical_count']} risiko kritis.\n"
                . "- **Blocker Aktif:** {$blockers['total_active']} kendala operasional lapangan.\n"
                . "- **Keputusan Tertunda:** {$decisions['overdue_count']} keputusan melewati tenggat waktu.\n\n"
                . "Silakan ajukan pertanyaan spesifik terkait: kondisi proyek tertentu, evaluasi kapasitas tim, analisis risiko kritis, atau rekomendasi tindakan mingguan.";
        }

        return [
            'success' => true,
            'reply' => $reply,
            'summary' => 'Analisis deterministik disusun secara real-time berdasarkan data operasional PT Potensi Karya Mandiri.',
            'mode' => 'Deterministic Rule-Based Engine (Fallback: Default)',
            'data_sources' => $sources,
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }
}
