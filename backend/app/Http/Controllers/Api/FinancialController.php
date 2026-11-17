<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FinancialAlert;
use App\Models\FinancialBudget;
use App\Models\FinancialTransaction;
use App\Services\FinancialIntelligenceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class FinancialController extends Controller
{
    protected FinancialIntelligenceService $intelligenceService;

    public function __construct(FinancialIntelligenceService $intelligenceService)
    {
        $this->intelligenceService = $intelligenceService;
    }

    /**
     * Financial Dashboard — Ringkasan kondisi keuangan & anggaran.
     * Accessible by: admin, pimpinan
     */
    public function dashboard(Request $request)
    {
        $period = $request->query('period', 'all');

        // Automatically detect new anomalies
        $this->intelligenceService->detectAndSyncAlerts();

        $intelligence = $this->intelligenceService->getIntelligenceSummary($period);

        $txnQuery    = FinancialTransaction::query();
        $budgetQuery = FinancialBudget::query();

        if (str_starts_with($period, 'year:')) {
            $year = (int) substr($period, 5);
            $txnQuery->whereYear('transaction_date', $year);
            $budgetQuery->where('fiscal_year', $year);
        } elseif (str_starts_with($period, 'budget:')) {
            $budgetId = (int) substr($period, 7);
            $txnQuery->where('budget_id', $budgetId);
        }

        $totalIncome  = (float) (clone $txnQuery)->where('type', 'income')->sum('amount');
        $totalExpense = (float) (clone $txnQuery)->where('type', 'expense')->sum('amount');
        $netResult    = $totalIncome - $totalExpense;

        $totalBudgets       = (clone $budgetQuery)->count();
        $totalRevTarget     = (float) (clone $budgetQuery)->sum('revenue_target');
        $totalExpBudget     = (float) (clone $budgetQuery)->sum('expense_budget');

        $budgetUtilization = $totalExpBudget > 0 ? round(($totalExpense / $totalExpBudget) * 100, 1) : null;
        $budgetVariance    = $totalExpBudget > 0 ? $totalExpense - $totalExpBudget : null;

        $varianceStatus = null;
        if ($budgetVariance !== null) {
            if ($budgetVariance < 0) {
                $varianceStatus = 'under_budget';
            } elseif ($budgetVariance == 0.0) {
                $varianceStatus = 'on_budget';
            } else {
                $varianceStatus = 'over_budget';
            }
        }

        $byProject = FinancialTransaction::with('project:id,name,code')
            ->whereNotNull('project_id')
            ->select('project_id', 'type', DB::raw('SUM(amount) as total'))
            ->groupBy('project_id', 'type')
            ->get()
            ->groupBy('project_id')
            ->map(function ($items) {
                $income  = $items->where('type', 'income')->sum('total');
                $expense = $items->where('type', 'expense')->sum('total');
                $project = $items->first()->project;
                return [
                    'project_id'   => $items->first()->project_id,
                    'project_name' => $project?->name ?? 'Proyek Tidak Dikenal',
                    'project_code' => $project?->code ?? '-',
                    'income'       => (float) $income,
                    'expense'      => (float) $expense,
                    'net'          => (float) ($income - $expense),
                ];
            })->values();

        $byInitiative = FinancialTransaction::with('initiative:id,title,code')
            ->whereNotNull('initiative_id')
            ->select('initiative_id', 'type', DB::raw('SUM(amount) as total'))
            ->groupBy('initiative_id', 'type')
            ->get()
            ->groupBy('initiative_id')
            ->map(function ($items) {
                $income    = $items->where('type', 'income')->sum('total');
                $expense   = $items->where('type', 'expense')->sum('total');
                $init      = $items->first()->initiative;
                return [
                    'initiative_id'    => $items->first()->initiative_id,
                    'initiative_title' => $init?->title ?? 'Inisiatif Tidak Dikenal',
                    'initiative_code'  => $init?->code ?? '-',
                    'expense'          => (float) $expense,
                ];
            })->values();

        $budgetsWithTx    = FinancialBudget::has('transactions')->count();
        $dataCompleteness = $totalBudgets > 0 ? round(($budgetsWithTx / $totalBudgets) * 100, 0) : 0;
        $hasData          = FinancialTransaction::exists();

        $trend = FinancialTransaction::where('transaction_date', '>=', Carbon::now()->subMonths(12)->startOfMonth())
            ->get()
            ->groupBy(function ($txn) {
                return Carbon::parse($txn->transaction_date)->format('Y-m');
            })
            ->map(function ($items, $p) {
                return [
                    'period'  => $p,
                    'income'  => (float) $items->where('type', 'income')->sum('amount'),
                    'expense' => (float) $items->where('type', 'expense')->sum('amount'),
                ];
            })
            ->sortKeys()
            ->values();

        $recentAlerts = FinancialAlert::where('status', 'open')
            ->orderByRaw("CASE WHEN severity = 'critical' THEN 1 WHEN severity = 'warning' THEN 2 ELSE 3 END")
            ->orderBy('detected_date', 'desc')
            ->limit(5)
            ->get();

        return response()->json([
            'has_data'          => $hasData,
            'data_completeness' => $dataCompleteness,
            'period'            => $period,
            'health'            => $intelligence['health'],
            'summary'           => [
                'total_income'        => $totalIncome,
                'total_expense'       => $totalExpense,
                'net_result'          => $netResult,
                'revenue_target'      => $totalRevTarget,
                'expense_budget'      => $totalExpBudget,
                'budget_utilization'  => $budgetUtilization,
                'budget_variance'     => $budgetVariance,
                'revenue_achievement' => $intelligence['kpis']['revenue_achievement'],
                'variance_status'     => $varianceStatus,
                'total_budgets'       => $totalBudgets,
                'total_transactions'  => FinancialTransaction::count(),
                'active_alerts'       => $intelligence['kpis']['active_alerts'],
                'critical_alerts'     => $intelligence['kpis']['critical_alerts'],
            ],
            'alerts'         => $recentAlerts,
            'trend'          => $trend,
            'by_project'     => $byProject,
            'by_initiative'  => $byInitiative,
        ]);
    }

    public function budgetIndex()
    {
        $budgets = FinancialBudget::with('creator:id,name')
            ->withCount('transactions')
            ->orderByDesc('fiscal_year')
            ->orderByDesc('created_at')
            ->paginate(15);

        $budgets->getCollection()->transform(function ($b) {
            $b->total_income  = (float) $b->transactions()->where('type', 'income')->sum('amount');
            $b->total_expense = (float) $b->transactions()->where('type', 'expense')->sum('amount');
            $b->net_result    = $b->total_income - $b->total_expense;
            return $b;
        });

        return response()->json($budgets);
    }

    public function budgetStore(Request $request)
    {
        if (auth()->user()->role !== 'admin') {
            return response()->json(['message' => 'Hanya Administrator yang dapat membuat anggaran.'], 403);
        }
        $validated = $request->validate([
            'label'          => 'required|string|max:100',
            'fiscal_year'    => 'required|integer|min:2000|max:2100',
            'fiscal_period'  => 'required|in:monthly,quarterly,annual',
            'period_code'    => 'nullable|string|max:20',
            'start_date'     => 'required|date',
            'end_date'       => 'required|date|after:start_date',
            'revenue_target' => 'required|numeric|min:0',
            'expense_budget' => 'required|numeric|min:0',
            'notes'          => 'nullable|string|max:1000',
            'is_active'      => 'boolean',
        ]);
        $budget = DB::transaction(fn() => FinancialBudget::create(array_merge($validated, ['created_by' => auth()->id()])));
        return response()->json(['message' => 'Anggaran berhasil dibuat.', 'budget' => $budget->load('creator:id,name')], 201);
    }

    public function budgetUpdate(Request $request, $id)
    {
        if (auth()->user()->role !== 'admin') {
            return response()->json(['message' => 'Hanya Administrator yang dapat mengubah anggaran.'], 403);
        }
        $budget = FinancialBudget::findOrFail($id);
        $validated = $request->validate([
            'label'          => 'sometimes|string|max:100',
            'fiscal_year'    => 'sometimes|integer|min:2000|max:2100',
            'fiscal_period'  => 'sometimes|in:monthly,quarterly,annual',
            'period_code'    => 'nullable|string|max:20',
            'start_date'     => 'sometimes|date',
            'end_date'       => 'sometimes|date',
            'revenue_target' => 'sometimes|numeric|min:0',
            'expense_budget' => 'sometimes|numeric|min:0',
            'notes'          => 'nullable|string|max:1000',
            'is_active'      => 'boolean',
        ]);
        $budget->update($validated);
        return response()->json(['message' => 'Anggaran berhasil diperbarui.', 'budget' => $budget->fresh()->load('creator:id,name')]);
    }

    public function budgetDestroy($id)
    {
        if (auth()->user()->role !== 'admin') {
            return response()->json(['message' => 'Hanya Administrator yang dapat menghapus anggaran.'], 403);
        }
        $budget = FinancialBudget::findOrFail($id);
        if ($budget->transactions()->exists()) {
            return response()->json(['message' => 'Anggaran tidak dapat dihapus karena masih memiliki transaksi terkait.'], 422);
        }
        $budget->delete();
        return response()->json(['message' => 'Anggaran berhasil dihapus.']);
    }

    public function transactionIndex(Request $request)
    {
        $query = FinancialTransaction::with([
            'recorder:id,name', 'project:id,name,code',
            'initiative:id,title,code', 'budget:id,label',
        ])->orderByDesc('transaction_date')->orderByDesc('created_at');

        if ($request->filled('type'))       $query->where('type', $request->type);
        if ($request->filled('budget_id'))   $query->where('budget_id', $request->budget_id);
        if ($request->filled('start_date'))  $query->where('transaction_date', '>=', $request->start_date);
        if ($request->filled('end_date'))    $query->where('transaction_date', '<=', $request->end_date);
        if ($request->filled('category'))    $query->where('category', 'like', '%' . $request->category . '%');

        return response()->json($query->paginate(15));
    }

    public function transactionStore(Request $request)
    {
        if (auth()->user()->role !== 'admin') {
            return response()->json(['message' => 'Hanya Administrator yang dapat mencatat transaksi.'], 403);
        }
        $validated = $request->validate([
            'transaction_date' => 'required|date',
            'type'             => 'required|in:income,expense',
            'category'         => 'required|string|max:100',
            'description'      => 'required|string|max:500',
            'amount'           => 'required|numeric|min:0.01',
            'reference_number' => 'nullable|string|max:100',
            'budget_id'        => 'nullable|exists:financial_budgets,id',
            'project_id'       => 'nullable|exists:projects,id',
            'initiative_id'    => 'nullable|exists:strategic_initiatives,id',
            'notes'            => 'nullable|string|max:1000',
        ]);
        $txn = DB::transaction(fn() => FinancialTransaction::create(array_merge($validated, ['recorded_by' => auth()->id()])));
        return response()->json([
            'message'     => 'Transaksi berhasil dicatat.',
            'transaction' => $txn->load(['recorder:id,name', 'project:id,name', 'initiative:id,title', 'budget:id,label']),
        ], 201);
    }

    public function transactionUpdate(Request $request, $id)
    {
        if (auth()->user()->role !== 'admin') {
            return response()->json(['message' => 'Hanya Administrator yang dapat mengubah transaksi.'], 403);
        }
        $txn = FinancialTransaction::findOrFail($id);
        $validated = $request->validate([
            'transaction_date' => 'sometimes|date',
            'type'             => 'sometimes|in:income,expense',
            'category'         => 'sometimes|string|max:100',
            'description'      => 'sometimes|string|max:500',
            'amount'           => 'sometimes|numeric|min:0.01',
            'reference_number' => 'nullable|string|max:100',
            'budget_id'        => 'nullable|exists:financial_budgets,id',
            'project_id'       => 'nullable|exists:projects,id',
            'initiative_id'    => 'nullable|exists:strategic_initiatives,id',
            'notes'            => 'nullable|string|max:1000',
        ]);
        $txn->update($validated);
        return response()->json([
            'message'     => 'Transaksi berhasil diperbarui.',
            'transaction' => $txn->fresh()->load(['recorder:id,name', 'project:id,name', 'initiative:id,title', 'budget:id,label']),
        ]);
    }

    public function transactionDestroy($id)
    {
        if (auth()->user()->role !== 'admin') {
            return response()->json(['message' => 'Hanya Administrator yang dapat menghapus transaksi.'], 403);
        }
        $txn = FinancialTransaction::findOrFail($id);
        $txn->delete();
        return response()->json(['message' => 'Transaksi berhasil dihapus.']);
    }

    /**
     * Financial Alert Center — Daftar seluruh anomali dan peringatan.
     * Accessible by: admin, pimpinan
     */
    public function alertIndex(Request $request)
    {
        // Detect latest anomalies on view
        $this->intelligenceService->detectAndSyncAlerts();

        $query = FinancialAlert::with(['budget:id,label', 'project:id,name,code', 'initiative:id,title,code', 'acknowledgedBy:id,name', 'resolvedBy:id,name'])
            ->orderByRaw("CASE WHEN status = 'open' THEN 1 WHEN status = 'acknowledged' THEN 2 ELSE 3 END")
            ->orderByRaw("CASE WHEN severity = 'critical' THEN 1 WHEN severity = 'warning' THEN 2 ELSE 3 END")
            ->orderByDesc('detected_date');

        if ($request->filled('severity') && $request->severity !== 'all') {
            $query->where('severity', $request->severity);
        }
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }
        if ($request->filled('source') && $request->source !== 'all') {
            $query->where('source', $request->source);
        }

        $alerts = $query->paginate(15);

        $summary = [
            'total' => FinancialAlert::count(),
            'open' => FinancialAlert::where('status', 'open')->count(),
            'critical' => FinancialAlert::where('status', 'open')->where('severity', 'critical')->count(),
            'warning' => FinancialAlert::where('status', 'open')->where('severity', 'warning')->count(),
            'acknowledged' => FinancialAlert::where('status', 'acknowledged')->count(),
            'resolved' => FinancialAlert::where('status', 'resolved')->count(),
        ];

        return response()->json([
            'alerts' => $alerts,
            'summary' => $summary,
        ]);
    }

    /**
     * Update alert status (open -> acknowledged / resolved).
     * Accessible by: admin, pimpinan
     */
    public function alertUpdateStatus(Request $request, $id)
    {
        $alert = FinancialAlert::findOrFail($id);
        $validated = $request->validate([
            'status' => 'required|in:open,acknowledged,resolved',
            'resolution_notes' => 'nullable|string|max:1000',
        ]);

        $userId = auth()->id();
        $now = Carbon::now();

        if ($validated['status'] === 'acknowledged') {
            $alert->acknowledged_by = $userId;
            $alert->acknowledged_at = $now;
        } elseif ($validated['status'] === 'resolved') {
            $alert->resolved_by = $userId;
            $alert->resolved_at = $now;
        }

        if (isset($validated['resolution_notes'])) {
            $alert->resolution_notes = $validated['resolution_notes'];
        }
        $alert->status = $validated['status'];
        $alert->save();

        return response()->json([
            'message' => 'Status alert berhasil diperbarui.',
            'alert' => $alert->fresh()->load(['budget:id,label', 'project:id,name', 'initiative:id,title', 'acknowledgedBy:id,name', 'resolvedBy:id,name']),
        ]);
    }

    /**
     * Escalate critical financial alert to StrategicRisk in Risk & Decision Center.
     * Accessible by: admin, pimpinan
     */
    public function alertEscalate(Request $request, $id)
    {
        $risk = $this->intelligenceService->escalateAlertToRisk((int) $id, auth()->id());

        return response()->json([
            'message' => 'Peringatan finansial berhasil dieskalasikan ke Risk & Decision Center.',
            'risk' => $risk,
        ]);
    }

    /**
     * Get financial reconciliation for a specific strategic initiative.
     * Accessible by: admin, pimpinan
     */
    public function initiativeReconciliation($id)
    {
        $reconciliation = $this->intelligenceService->getInitiativeFinancialReconciliation((int) $id);

        return response()->json($reconciliation);
    }
}
