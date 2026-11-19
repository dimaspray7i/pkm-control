<?php

namespace App\Services;

use App\Models\Project;
use App\Models\Task;
use App\Models\StrategicRisk;
use App\Models\StrategicInitiative;
use App\Models\StrategicObjective;
use App\Models\FinancialAlert;
use App\Models\FinancialTransaction;
use App\Models\ExecutiveDecision;
use App\Models\User;
use Carbon\Carbon;

class BusinessIntelligenceService
{
    public function __construct(
        protected FinancialIntelligenceService $financialService
    ) {}

    /**
     * Get cross-module executive insights based on actual stored database records.
     */
    public function getCrossModuleInsights(): array
    {
        $insights = [];
        $today = Carbon::today()->toDateString();

        // 1. PROJECT DELAY & CRITICAL PROGRESS DEVIATION
        $delayedProjects = Project::where('is_active', true)
            ->where(function ($q) use ($today) {
                $q->where('status', 'delayed')
                  ->orWhere(function ($sq) use ($today) {
                      $sq->whereNotNull('deadline')
                         ->where('deadline', '<', $today)
                         ->where('progress', '<', 100);
                  });
            })
            ->get();

        if ($delayedProjects->isNotEmpty()) {
            $count = $delayedProjects->count();
            $names = $delayedProjects->pluck('name')->take(3)->implode(', ');
            $insights[] = [
                'id' => 'insight-proj-delayed',
                'title' => 'Proyek Terlambat & Deviasi Jadwal',
                'summary' => "Terdapat {$count} proyek aktif yang telah melewati batas waktu atau berstatus terlambat ({$names}).",
                'priority' => 'critical',
                'source_module' => 'projects',
                'metric_value' => $count,
                'metric_label' => 'Proyek Terlambat',
                'recommendation' => 'Pimpinan disarankan memanggil Project Manager untuk evaluasi alokasi sprint dan penjadwalan ulang prioritas tugas.',
                'data' => [
                    'project_ids' => $delayedProjects->pluck('id')->values()->all(),
                    'delayed_count' => $count,
                ],
            ];
        }

        // 2. TEAM OVERLOAD & BOTTLENECK DETECTION
        $usersWithTasks = User::withCount([
            'tasks as active_tasks_count' => function ($q) {
                $q->where('is_completed', false);
            },
            'tasks as overdue_tasks_count' => function ($q) use ($today) {
                $q->where('is_completed', false)
                  ->whereNotNull('deadline')
                  ->where('deadline', '<', $today);
            }
        ])->get();

        $overloadedUsers = $usersWithTasks->filter(function ($u) {
            return $u->active_tasks_count >= 5 || $u->overdue_tasks_count >= 2;
        });

        if ($overloadedUsers->isNotEmpty()) {
            $userNames = $overloadedUsers->pluck('name')->take(3)->implode(', ');
            $totalOverdue = $overloadedUsers->sum('overdue_tasks_count');
            $insights[] = [
                'id' => 'insight-team-overload',
                'title' => 'Beban Kerja Tim & Konsentrasi Tugas',
                'summary' => "Terdapat {$overloadedUsers->count()} personil dengan beban tugas tinggi (>= 5 tugas aktif atau memiliki akumulasi tugas overdue: {$userNames}).",
                'priority' => 'high',
                'source_module' => 'tasks',
                'metric_value' => $totalOverdue,
                'metric_label' => 'Total Tugas Overdue',
                'recommendation' => 'Lakukan redistribusi tugas melalui PM Task Distribution Board untuk mencegah keterlambatan berkelanjutan.',
                'data' => [
                    'affected_members' => $overloadedUsers->map(fn($u) => [
                        'id' => $u->id,
                        'name' => $u->name,
                        'active' => $u->active_tasks_count,
                        'overdue' => $u->overdue_tasks_count,
                    ])->values()->all(),
                ],
            ];
        }

        // 3. FINANCIAL ANOMALIES & BUDGET OVERRUN ALERTS
        $activeAlerts = FinancialAlert::where('status', 'active')->get();
        $criticalAlerts = $activeAlerts->where('severity', 'critical');

        if ($criticalAlerts->isNotEmpty()) {
            $count = $criticalAlerts->count();
            $totalInvolved = $criticalAlerts->sum('amount_involved');
            $insights[] = [
                'id' => 'insight-fin-critical',
                'title' => 'Anomali Anggaran & Pengeluaran Melebihi Pagu',
                'summary' => "Terdeteksi {$count} peringatan finansial berstatus kritis dengan potensi deviasi anggaran sebesar Rp " . number_format($totalInvolved, 0, ',', '.') . ".",
                'priority' => 'critical',
                'source_module' => 'financial',
                'metric_value' => 'Rp ' . number_format($totalInvolved, 0, ',', '.'),
                'metric_label' => 'Total Nilai Anomali',
                'recommendation' => 'Segera tinjau tab Peringatan Finansial atau eskalasikan alert ke Risiko Strategis agar tim finance melakukan audit transaksi.',
                'data' => [
                    'critical_count' => $count,
                    'total_amount' => $totalInvolved,
                ],
            ];
        }

        // 4. STRATEGIC INITIATIVE BUDGET RECONCILIATION
        $initiatives = StrategicInitiative::all();
        $overBudgetInitiatives = [];

        foreach ($initiatives as $init) {
            $recon = $this->financialService->getInitiativeFinancialReconciliation($init->id);
            if (!empty($recon['is_over_budget'])) {
                $overBudgetInitiatives[] = [
                    'id' => $init->id,
                    'title' => $init->title,
                    'allocated' => $recon['allocated_budget'] ?? 0,
                    'actual' => $recon['actual_transaction_expense'] ?? 0,
                    'variance' => $recon['variance'] ?? 0,
                ];
            }
        }

        if (!empty($overBudgetInitiatives)) {
            $overCount = count($overBudgetInitiatives);
            $titles = collect($overBudgetInitiatives)->pluck('title')->take(2)->implode(', ');
            $insights[] = [
                'id' => 'insight-initiative-overrun',
                'title' => 'Inisiatif Strategis Melebihi Anggaran Riil',
                'summary' => "Terdapat {$overCount} inisiatif strategis dengan transaksi aktual melampaui pagu teralokasi ({$titles}).",
                'priority' => 'high',
                'source_module' => 'initiatives',
                'metric_value' => $overCount,
                'metric_label' => 'Inisiatif Over-Budget',
                'recommendation' => 'Evaluasi alokasi kas inisiatif dan sesuaikan kembali proyeksi pengeluaran operasional perusahaan.',
                'data' => $overBudgetInitiatives,
            ];
        }

        // 5. STRATEGIC RISKS NEEDING MITIGATION FOLLOW-UP
        $unresolvedRisks = StrategicRisk::whereIn('status', ['identified', 'assessed', 'active'])
            ->whereIn('risk_level', ['High', 'Critical'])
            ->get();

        if ($unresolvedRisks->isNotEmpty()) {
            $count = $unresolvedRisks->count();
            $highRiskTitles = $unresolvedRisks->pluck('title')->take(2)->implode(', ');
            $insights[] = [
                'id' => 'insight-risk-unmitigated',
                'title' => 'Risiko Strategis Prioritas Tinggi Aktif',
                'summary' => "Terdapat {$count} risiko bisnis dengan kategori High/Critical yang masih berstatus aktif ({$highRiskTitles}).",
                'priority' => 'high',
                'source_module' => 'risk',
                'metric_value' => $count,
                'metric_label' => 'Risiko Kritis & Tinggi',
                'recommendation' => 'Pimpinan disarankan menetapkan keputusan eksekutif definitif pada Risk & Decision Center untuk mitigasi pencegahan.',
                'data' => [
                    'risk_ids' => $unresolvedRisks->pluck('id')->values()->all(),
                ],
            ];
        }

        // 6. EXECUTIVE DECISION ACTION FOLLOW-UP
        $pendingDecisions = ExecutiveDecision::whereIn('status', ['draft', 'pending', 'in_progress'])
            ->whereNotNull('due_date')
            ->where('due_date', '<', $today)
            ->get();

        if ($pendingDecisions->isNotEmpty()) {
            $count = $pendingDecisions->count();
            $insights[] = [
                'id' => 'insight-decisions-overdue',
                'title' => 'Tindak Lanjut Keputusan Eksekutif Melewati Target',
                'summary' => "Terdapat {$count} keputusan pimpinan yang masih berstatus pending/in-progress melewati target tanggal realisasi.",
                'priority' => 'medium',
                'source_module' => 'decisions',
                'metric_value' => $count,
                'metric_label' => 'Keputusan Overdue',
                'recommendation' => 'Tinjau lembar kerja tindak lanjut keputusan dan konfirmasi status implementasi kepada PIC terkait.',
                'data' => [
                    'decision_ids' => $pendingDecisions->pluck('id')->values()->all(),
                ],
            ];
        }

        // 7. STRATEGIC OBJECTIVES PROGRESS LAG
        $objectives = StrategicObjective::with('keyResults')->get();
        if ($objectives->isNotEmpty()) {
            $laggingObjectives = $objectives->filter(function ($obj) {
                return in_array($obj->status, ['at_risk', 'not_achieved']);
            });

            if ($laggingObjectives->isNotEmpty()) {
                $count = $laggingObjectives->count();
                $titles = $laggingObjectives->pluck('title')->take(2)->implode(', ');
                $insights[] = [
                    'id' => 'insight-okr-lagging',
                    'title' => 'Pencapaian Sasaran Strategis (OKR) Berisiko',
                    'summary' => "Terdapat {$count} Objective strategis yang berstatus At Risk atau belum mencapai target berkala ({$titles}).",
                    'priority' => 'medium',
                    'source_module' => 'okr',
                    'metric_value' => $count,
                    'metric_label' => 'Objective Berisiko',
                    'recommendation' => 'Periksa Key Results pendukung dan sinkronkan kontribusi proyek terkait untuk mengakselerasi ketercapaian target.',
                    'data' => [
                        'lagging_ids' => $laggingObjectives->pluck('id')->values()->all(),
                    ],
                ];
            }
        }

        return [
            'total_insights' => count($insights),
            'critical_count' => collect($insights)->where('priority', 'critical')->count(),
            'high_count' => collect($insights)->where('priority', 'high')->count(),
            'medium_count' => collect($insights)->where('priority', 'medium')->count(),
            'insights' => $insights,
            'generated_at' => Carbon::now()->toIso8601String(),
        ];
    }

    /**
     * Correlate project delivery progress with actual financial expenditures.
     */
    public function getProjectFinanceCorrelation(): array
    {
        $projects = Project::where('is_active', true)->get();
        $correlation = [];

        foreach ($projects as $proj) {
            $txExpense = (float) FinancialTransaction::where('project_id', $proj->id)
                ->where('type', 'expense')
                ->sum('amount');

            $correlation[] = [
                'project_id' => $proj->id,
                'project_code' => $proj->code,
                'project_name' => $proj->name,
                'status' => $proj->status,
                'progress' => (int) $proj->progress,
                'target_progress' => (int) $proj->target_progress,
                'actual_expense' => $txExpense,
                'formatted_expense' => 'Rp ' . number_format($txExpense, 0, ',', '.'),
            ];
        }

        return [
            'total_tracked_projects' => count($correlation),
            'projects' => $correlation,
        ];
    }

    /**
     * Get team workload distribution and delivery bottleneck indicators.
     */
    public function getTeamWorkloadIntelligence(): array
    {
        $today = Carbon::today()->toDateString();
        $members = User::where('role', '!=', 'admin')->get();

        $stats = $members->map(function ($m) use ($today) {
            $assigned = Task::where('assignee_id', $m->id)->get();
            $completed = $assigned->where('is_completed', true)->count();
            $active = $assigned->where('is_completed', false);
            $overdue = $active->filter(fn($t) => !empty($t->deadline) && $t->deadline < $today)->count();

            $loadLevel = 'Light';
            if ($active->count() >= 8 || $overdue >= 3) {
                $loadLevel = 'Overloaded';
            } elseif ($active->count() >= 5 || $overdue >= 1) {
                $loadLevel = 'High';
            } elseif ($active->count() >= 2) {
                $loadLevel = 'Moderate';
            }

            return [
                'user_id' => $m->id,
                'name' => $m->name,
                'role' => $m->role,
                'total_tasks' => $assigned->count(),
                'active_tasks' => $active->count(),
                'completed_tasks' => $completed,
                'overdue_tasks' => $overdue,
                'workload_level' => $loadLevel,
            ];
        });

        return [
            'total_members' => $stats->count(),
            'overloaded_members_count' => $stats->where('workload_level', 'Overloaded')->count(),
            'high_workload_count' => $stats->where('workload_level', 'High')->count(),
            'members' => $stats->values()->all(),
        ];
    }

    /**
     * Get alignment matrix between OKRs and Strategic Initiatives.
     */
    public function getStrategicAlignmentIntelligence(): array
    {
        $objectives = StrategicObjective::with('keyResults')->get();

        $matrix = $objectives->map(function ($obj) {
            $avgKrProgress = $obj->keyResults->isNotEmpty()
                ? round($obj->keyResults->avg('current_value'), 1)
                : 0;

            $initCount = StrategicInitiative::where('objective_id', $obj->id)->count();

            return [
                'objective_id' => $obj->id,
                'objective_title' => $obj->title,
                'category' => $obj->category,
                'status' => $obj->status,
                'key_results_count' => $obj->keyResults->count(),
                'initiatives_count' => $initCount,
                'avg_kr_progress' => $avgKrProgress,
                'alignment_status' => $initCount > 0 ? 'Aligned' : 'No Linked Initiatives',
            ];
        });

        return [
            'total_objectives' => $matrix->count(),
            'aligned_objectives_count' => $matrix->where('alignment_status', 'Aligned')->count(),
            'unaligned_count' => $matrix->where('alignment_status', 'No Linked Initiatives')->count(),
            'objectives' => $matrix->values()->all(),
        ];
    }
}