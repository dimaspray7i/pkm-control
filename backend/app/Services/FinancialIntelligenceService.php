<?php

namespace App\Services;

use App\Models\FinancialAlert;
use App\Models\FinancialBudget;
use App\Models\FinancialTransaction;
use App\Models\Project;
use App\Models\StrategicInitiative;
use App\Models\StrategicRisk;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class FinancialIntelligenceService
{
    /**
     * Build unified financial intelligence summary with KPI health indicators.
     * Indicator thresholds:
     * - Healthy: Revenue achievement >= 90% (if target > 0) OR Expense budget utilization <= 85% (when budget > 0) AND Net result >= 0
     * - Warning: Expense budget utilization between 85% and 100% OR Revenue achievement between 70% and 90%
     * - Critical: Expense budget utilization > 100% (overrun) OR Net result significantly negative with > 100% budget utilized
     * - Insufficient Data: No budgets or no transactions registered
     */
    public function getIntelligenceSummary(?string $period = 'all'): array
    {
        $txnQuery = FinancialTransaction::query();
        $budgetQuery = FinancialBudget::query();

        if (str_starts_with($period, 'year:')) {
            $year = (int) substr($period, 5);
            $txnQuery->whereYear('transaction_date', $year);
            $budgetQuery->where('fiscal_year', $year);
        } elseif (str_starts_with($period, 'budget:')) {
            $budgetId = (int) substr($period, 7);
            $txnQuery->where('budget_id', $budgetId);
            $budgetQuery->where('id', $budgetId);
        }

        $totalIncome = (float) (clone $txnQuery)->where('type', 'income')->sum('amount');
        $totalExpense = (float) (clone $txnQuery)->where('type', 'expense')->sum('amount');
        $netResult = $totalIncome - $totalExpense;

        $totalBudgets = (clone $budgetQuery)->count();
        $totalRevTarget = (float) (clone $budgetQuery)->sum('revenue_target');
        $totalExpBudget = (float) (clone $budgetQuery)->sum('expense_budget');
        $totalTransactions = (clone $txnQuery)->count();

        // 1. Budget Utilization (%)
        $budgetUtilization = $totalExpBudget > 0
            ? round(($totalExpense / $totalExpBudget) * 100, 1)
            : null;

        // 2. Budget Variance (Actual - Budget)
        $budgetVariance = $totalExpBudget > 0
            ? round($totalExpense - $totalExpBudget, 2)
            : null;

        // 3. Revenue Target Achievement (%)
        $revenueAchievement = $totalRevTarget > 0
            ? round(($totalIncome / $totalRevTarget) * 100, 1)
            : null;

        // 4. Data Completeness & Health Indicator Calculation
        $budgetsWithTx = FinancialBudget::has('transactions')->count();
        $dataCompleteness = $totalBudgets > 0
            ? round(($budgetsWithTx / $totalBudgets) * 100, 0)
            : 0;

        $hasSufficientData = ($totalBudgets > 0 || $totalTransactions > 0);

        if (!$hasSufficientData || ($totalTransactions === 0 && $totalBudgets === 0)) {
            $financialHealth = 'insufficient_data';
            $healthLabel = 'Data Belum Cukup';
            $healthColor = '#9CA3AF';
            $healthDescription = 'Belum ada transaksi atau pagu anggaran yang tercatat di sistem.';
        } elseif ($budgetUtilization !== null && $budgetUtilization > 100) {
            $financialHealth = 'critical';
            $healthLabel = 'Kritis (Defisit/Overrun)';
            $healthColor = '#FF2F92';
            $healthDescription = 'Pengeluaran aktual telah melampaui pagu anggaran yang ditetapkan (' . $budgetUtilization . '%).';
        } elseif (($budgetUtilization !== null && $budgetUtilization >= 85) || ($revenueAchievement !== null && $revenueAchievement < 70)) {
            $financialHealth = 'warning';
            $healthLabel = 'Perlu Perhatian';
            $healthColor = '#FFD83D';
            $healthDescription = 'Utilisasi anggaran mendekati batas pagu atau pencapaian pendapatan berada di bawah 70%.';
        } else {
            $financialHealth = 'healthy';
            $healthLabel = 'Sehat';
            $healthColor = '#10B981';
            $healthDescription = 'Arus kas dan penyerapan anggaran dalam batas kendali operasional aman.';
        }

        // Active Alert Counts
        $activeAlertsCount = FinancialAlert::where('status', 'open')->count();
        $criticalAlertsCount = FinancialAlert::where('status', 'open')->where('severity', 'critical')->count();

        return [
            'has_data' => $hasSufficientData,
            'data_completeness' => $dataCompleteness,
            'health' => [
                'status' => $financialHealth,
                'label' => $healthLabel,
                'color' => $healthColor,
                'description' => $healthDescription,
            ],
            'kpis' => [
                'total_income' => $totalIncome,
                'total_expense' => $totalExpense,
                'net_result' => $netResult,
                'revenue_target' => $totalRevTarget,
                'expense_budget' => $totalExpBudget,
                'budget_utilization' => $budgetUtilization,
                'budget_variance' => $budgetVariance,
                'revenue_achievement' => $revenueAchievement,
                'total_budgets' => $totalBudgets,
                'total_transactions' => $totalTransactions,
                'active_alerts' => $activeAlertsCount,
                'critical_alerts' => $criticalAlertsCount,
            ],
        ];
    }

    /**
     * Run automatic financial anomaly detection and synchronize alerts.
     * Prevents duplication using deterministic alert codes.
     */
    public function detectAndSyncAlerts(): array
    {
        $today = Carbon::today()->toDateString();
        $generatedAlerts = [];

        // 1. ANOMALY: Budget Overrun (> 100% expense budget)
        $budgets = FinancialBudget::with('transactions')->where('is_active', true)->get();
        foreach ($budgets as $b) {
            $exp = (float) $b->transactions->where('type', 'expense')->sum('amount');
            $budgetLimit = (float) $b->expense_budget;

            if ($budgetLimit > 0 && $exp > $budgetLimit) {
                $overAmount = $exp - $budgetLimit;
                $code = "ALT-OVR-B{$b->id}-" . date('Ym');

                $alert = FinancialAlert::firstOrCreate(
                    ['alert_code' => $code],
                    [
                        'title' => "Pengeluaran Melebihi Anggaran: {$b->label}",
                        'description' => "Realisasi pengeluaran sebesar Rp " . number_format($exp, 0, ',', '.') . " telah melebihi pagu anggaran Rp " . number_format($budgetLimit, 0, ',', '.') . " (Kelebihan: Rp " . number_format($overAmount, 0, ',', '.') . ").",
                        'severity' => 'critical',
                        'source' => 'budget_overrun',
                        'related_amount' => $overAmount,
                        'budget_id' => $b->id,
                        'detected_date' => $today,
                        'recommendation' => 'Segera lakukan evaluasi pengeluaran bersama tim terkait dan ajukan penyesuaian anggaran atau pembekuan pos beban operasional non-esensial.',
                        'status' => 'open',
                    ]
                );
                $generatedAlerts[] = $alert;
            } elseif ($budgetLimit > 0 && ($exp / $budgetLimit) >= 0.85 && ($exp / $budgetLimit) <= 1.0) {
                // ANOMALY: Budget approaching limit (85% - 100%)
                $code = "ALT-APP-B{$b->id}-" . date('Ym');
                $util = round(($exp / $budgetLimit) * 100, 1);

                $alert = FinancialAlert::firstOrCreate(
                    ['alert_code' => $code],
                    [
                        'title' => "Pagu Anggaran Mendekati Batas Maksimal: {$b->label}",
                        'description' => "Utilisasi anggaran telah mencapai {$util}% dari pagu Rp " . number_format($budgetLimit, 0, ',', '.') . ". Sisa anggaran tersisa Rp " . number_format($budgetLimit - $exp, 0, ',', '.') . ".",
                        'severity' => 'warning',
                        'source' => 'budget_limit_approaching',
                        'related_amount' => $budgetLimit - $exp,
                        'budget_id' => $b->id,
                        'detected_date' => $today,
                        'recommendation' => 'Perketat persetujuan pengeluaran baru pada periode berjalan sebelum batas pagu terlampaui.',
                        'status' => 'open',
                    ]
                );
                $generatedAlerts[] = $alert;
            }
        }

        // 2. ANOMALY: High cost unallocated transactions (Transactions without budget_id)
        $unbudgetedExpenses = FinancialTransaction::whereNull('budget_id')
            ->where('type', 'expense')
            ->where('amount', '>=', 5000000)
            ->get();

        foreach ($unbudgetedExpenses as $tx) {
            $code = "ALT-UNB-TX{$tx->id}";
            $alert = FinancialAlert::firstOrCreate(
                ['alert_code' => $code],
                [
                    'title' => "Pengeluaran Signifikan Tanpa Alokasi Anggaran",
                    'description' => "Transaksi pengeluaran '{$tx->description}' sebesar Rp " . number_format($tx->amount, 0, ',', '.') . " pada tanggal {$tx->transaction_date} belum dikaitkan dengan pagu anggaran manapun.",
                    'severity' => 'warning',
                    'source' => 'unallocated_transaction',
                    'related_amount' => $tx->amount,
                    'project_id' => $tx->project_id,
                    'initiative_id' => $tx->initiative_id,
                    'detected_date' => $today,
                    'recommendation' => 'Administrator disarankan menetapkan alokasi anggaran yang sesuai untuk transaksi ini guna menjaga akurasi pembukuan fiskal.',
                    'status' => 'open',
                ]
            );
            $generatedAlerts[] = $alert;
        }

        // 3. ANOMALY: Strategic Initiative Budget Exceeded (Actual transactions > allocated_budget)
        $initiatives = StrategicInitiative::whereIn('status', ['active', 'planned'])->get();
        foreach ($initiatives as $init) {
            $initTxExpenses = (float) FinancialTransaction::where('initiative_id', $init->id)
                ->where('type', 'expense')
                ->sum('amount');

            $allocated = (float) $init->allocated_budget;
            if ($allocated > 0 && $initTxExpenses > $allocated) {
                $code = "ALT-INI-OVR-{$init->id}-" . date('Ym');
                $diff = $initTxExpenses - $allocated;

                $alert = FinancialAlert::firstOrCreate(
                    ['alert_code' => $code],
                    [
                        'title' => "Inisiatif Strategis Melebihi Alokasi Anggaran: {$init->title}",
                        'description' => "Total transaksi pengeluaran aktual (Rp " . number_format($initTxExpenses, 0, ',', '.') . ") telah melampaui pagu inisiatif (Rp " . number_format($allocated, 0, ',', '.') . ").",
                        'severity' => 'critical',
                        'source' => 'initiative_cost_overrun',
                        'related_amount' => $diff,
                        'initiative_id' => $init->id,
                        'detected_date' => $today,
                        'recommendation' => 'Pimpinan dan Lead Inisiatif perlu melakukan peninjauan alokasi sumber daya atau audit pengeluaran inisiatif ini.',
                        'status' => 'open',
                    ]
                );
                $generatedAlerts[] = $alert;
            }
        }

        return $generatedAlerts;
    }

    /**
     * Reconcile initiative spending: return actual transaction expenses vs planned & allocated.
     */
    public function getInitiativeFinancialReconciliation(int $initiativeId): array
    {
        $initiative = StrategicInitiative::find($initiativeId);
        if (!$initiative) {
            return [];
        }

        $actualTxExpense = (float) FinancialTransaction::where('initiative_id', $initiativeId)
            ->where('type', 'expense')
            ->sum('amount');

        $allocated = (float) $initiative->allocated_budget;
        $legacySpent = (float) $initiative->spent_budget;
        $variance = $allocated > 0 ? $allocated - $actualTxExpense : 0;

        return [
            'initiative_id' => $initiative->id,
            'initiative_title' => $initiative->title,
            'allocated_budget' => $allocated,
            'legacy_manual_spent' => $legacySpent,
            'actual_transaction_expense' => $actualTxExpense,
            'remaining_budget' => max(0, $variance),
            'variance' => $variance,
            'is_over_budget' => $allocated > 0 && $actualTxExpense > $allocated,
        ];
    }

    /**
     * Convert critical financial alert into StrategicRisk in Risk & Decision Center.
     */
    public function escalateAlertToRisk(int $alertId, int $userId): StrategicRisk
    {
        $alert = FinancialAlert::findOrFail($alertId);

        // Check if already escalated to prevent duplicate risk entries
        $existingRisk = StrategicRisk::where('source', "financial_alert_{$alert->id}")->first();
        if ($existingRisk) {
            return $existingRisk;
        }

        $riskCode = 'RSK-FIN-' . str_pad($alert->id, 4, '0', STR_PAD_LEFT);

        return DB::transaction(function () use ($alert, $riskCode, $userId) {
            $risk = StrategicRisk::create([
                'risk_code' => $riskCode,
                'title' => "Risiko Finansial: {$alert->title}",
                'description' => $alert->description . "\n\nRekomendasi Tindak Lanjut: " . ($alert->recommendation ?? '-'),
                'category' => 'Financial',
                'project_id' => $alert->project_id,
                'source' => "financial_alert_{$alert->id}",
                'impact' => $alert->severity === 'critical' ? 5 : 3,
                'likelihood' => 4,
                'risk_score' => $alert->severity === 'critical' ? 20 : 12,
                'risk_level' => $alert->severity === 'critical' ? 'critical' : 'high',
                'mitigation' => $alert->recommendation ?? 'Audit pengeluaran fiskal dan evaluasi pagu anggaran.',
                'owner_id' => $userId,
                'identified_date' => $alert->detected_date,
                'target_resolution_date' => Carbon::parse($alert->detected_date)->addDays(14)->toDateString(),
                'status' => 'identified',
                'created_by' => $userId,
            ]);

            $alert->update([
                'status' => 'acknowledged',
                'acknowledged_by' => $userId,
                'acknowledged_at' => Carbon::now(),
                'resolution_notes' => "Dieskalasikan menjadi Risiko Strategis [{$riskCode}].",
            ]);

            return $risk;
        });
    }
}
