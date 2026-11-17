<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExecutiveDecision;
use App\Models\ExecutiveReport;
use App\Services\ExecutiveBusinessContextService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class LeadershipReportController extends Controller
{
    protected ExecutiveBusinessContextService $contextService;

    public function __construct(ExecutiveBusinessContextService $contextService)
    {
        $this->contextService = $contextService;
    }

    /**
     * Helper to verify executive role authorization (Admin and Pimpinan only)
     */
    protected function authorizeExecutive(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'pimpinan'], true)) {
            abort(response()->json([
                'message' => 'Akses ditolak. Fitur Executive Reports & Decision Follow-up hanya dapat diakses oleh Pimpinan dan Administrator.',
            ], 403));
        }
        return $user;
    }

    /**
     * GET /api/leadership/executive-reports
     * List all executive reports with search & filtering + summary cards
     */
    public function index(Request $request)
    {
        $this->authorizeExecutive($request);

        $query = ExecutiveReport::with(['generatedBy:id,name,role', 'publishedBy:id,name,role']);

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('report_type') && $request->report_type !== 'all') {
            $query->where('report_type', $request->report_type);
        }

        if ($request->filled('start_date')) {
            $query->where('period_start', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $query->where('period_end', '<=', $request->end_date);
        }

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($w) use ($s) {
                $w->where('title', 'like', "%{$s}%")
                  ->orWhere('report_number', 'like', "%{$s}%")
                  ->orWhere('executive_summary', 'like', "%{$s}%");
            });
        }

        $reports = $query->orderBy('period_end', 'desc')
            ->orderBy('id', 'desc')
            ->get();

        // Overview stats
        $all = ExecutiveReport::all();
        $today = Carbon::today()->toDateString();
        $overdueDecisionsCount = ExecutiveDecision::whereIn('status', ['approved', 'in_progress'])
            ->whereNotNull('due_date')
            ->where('due_date', '<', $today)
            ->count();

        $activeDecisionsCount = ExecutiveDecision::whereIn('status', ['approved', 'in_progress'])->count();

        return response()->json([
            'success' => true,
            'summary' => [
                'total_reports' => $all->count(),
                'published_reports' => $all->where('status', 'published')->count(),
                'draft_reports' => $all->where('status', 'draft')->count(),
                'active_decisions' => $activeDecisionsCount,
                'overdue_decisions' => $overdueDecisionsCount,
            ],
            'total' => $reports->count(),
            'reports' => $reports,
        ]);
    }

    /**
     * POST /api/leadership/executive-reports
     * Generate new executive report draft with live snapshot data
     */
    public function store(Request $request)
    {
        $user = $this->authorizeExecutive($request);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'report_type' => ['required', 'string', Rule::in(['daily', 'weekly', 'monthly', 'quarterly', 'custom'])],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start'],
            'executive_summary' => ['nullable', 'string'],
            'strategic_recommendations' => ['nullable', 'string'],
            'management_attention' => ['nullable', 'string'],
        ], [
            'title.required' => 'Judul laporan eksekutif wajib diisi.',
            'report_type.required' => 'Jenis periode laporan wajib dipilih.',
            'period_start.required' => 'Tanggal awal periode wajib diisi.',
            'period_end.required' => 'Tanggal akhir periode wajib diisi.',
            'period_end.after_or_equal' => 'Tanggal akhir periode tidak boleh lebih awal dari tanggal awal.',
        ]);

        return DB::transaction(function () use ($validated, $user) {
            // Duplication protection check within transaction
            $exists = ExecutiveReport::where('report_type', $validated['report_type'])
                ->where('period_start', $validated['period_start'])
                ->where('period_end', $validated['period_end'])
                ->exists();

            if ($exists) {
                return response()->json([
                    'message' => 'Laporan eksekutif dengan tipe dan rentang periode yang sama sudah ada di sistem.',
                    'errors' => [
                        'period' => ['Laporan untuk rentang periode tersebut sudah pernah dibuat.'],
                    ],
                ], 422);
            }

            // Generate unique report number: PKM-ER-YYYYMM-XXXX
            $datePrefix = Carbon::now()->format('Ym');
            $countThisMonth = ExecutiveReport::whereYear('created_at', Carbon::now()->year)
                ->whereMonth('created_at', Carbon::now()->month)
                ->count();
            $seq = str_pad($countThisMonth + 1, 4, '0', STR_PAD_LEFT);
            $reportNumber = "PKM-ER-{$datePrefix}-{$seq}";

            // Gather comprehensive snapshot data from ExecutiveBusinessContextService
            $context = $this->contextService->buildExecutiveContext('all_time');

            // Format snapshot specifically bounded for historical immutability
            $snapshotData = [
                'as_of_date' => Carbon::now()->toDateString(),
                'as_of_time' => Carbon::now()->format('H:i') . ' WIB',
                'period_label' => strtoupper($validated['report_type']) . " ({$validated['period_start']} s/d {$validated['period_end']})",
                'company_health' => $context['company_health'] ?? [],
                'tasks_performance' => $context['tasks_performance'] ?? [],
                'milestones_performance' => $context['milestones_performance'] ?? [],
                'projects' => $context['projects'] ?? [],
                'team_workload' => $context['team_workload'] ?? [],
                'risks' => $context['risks'] ?? [],
                'blockers' => $context['blockers'] ?? [],
                'decisions' => $context['decisions'] ?? [],
                'financial' => $context['financial'] ?? [],
            ];

            $report = ExecutiveReport::create([
                'report_number' => $reportNumber,
                'title' => $validated['title'],
                'report_type' => $validated['report_type'],
                'period_start' => $validated['period_start'],
                'period_end' => $validated['period_end'],
                'status' => 'draft',
                'executive_summary' => $validated['executive_summary'] ?? null,
                'strategic_recommendations' => $validated['strategic_recommendations'] ?? null,
                'management_attention' => $validated['management_attention'] ?? null,
                'snapshot_data' => $snapshotData,
                'generated_by' => $user->id,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Draft laporan eksekutif berhasil dibuat.',
                'report' => $report->load(['generatedBy:id,name,role']),
            ], 201);
        });
    }

    /**
     * GET /api/leadership/executive-reports/{id}
     * Get single executive report detail
     */
    public function show(Request $request, $id)
    {
        $this->authorizeExecutive($request);

        $report = ExecutiveReport::with(['generatedBy:id,name,role', 'publishedBy:id,name,role'])->find($id);

        if (!$report) {
            return response()->json(['message' => 'Laporan eksekutif tidak ditemukan.'], 404);
        }

        return response()->json([
            'success' => true,
            'report' => $report,
        ]);
    }

    /**
     * PUT /api/leadership/executive-reports/{id}
     * Update draft report. Published reports are strictly immutable!
     */
    public function update(Request $request, $id)
    {
        $this->authorizeExecutive($request);

        $report = ExecutiveReport::find($id);
        if (!$report) {
            return response()->json(['message' => 'Laporan eksekutif tidak ditemukan.'], 404);
        }

        // STRICT IMMUTABILITY ENFORCEMENT
        if ($report->isPublished()) {
            return response()->json([
                'message' => 'Laporan eksekutif yang telah diterbitkan (Published) bersifat arsip permanen (immutable) dan tidak dapat dimodifikasi lagi.',
            ], 422);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'executive_summary' => ['nullable', 'string'],
            'strategic_recommendations' => ['nullable', 'string'],
            'management_attention' => ['nullable', 'string'],
            'refresh_snapshot' => ['nullable', 'boolean'],
        ]);

        if (isset($validated['title'])) {
            $report->title = $validated['title'];
        }
        if (array_key_exists('executive_summary', $validated)) {
            $report->executive_summary = $validated['executive_summary'];
        }
        if (array_key_exists('strategic_recommendations', $validated)) {
            $report->strategic_recommendations = $validated['strategic_recommendations'];
        }
        if (array_key_exists('management_attention', $validated)) {
            $report->management_attention = $validated['management_attention'];
        }

        // If requested, refresh snapshot before publishing
        if (!empty($validated['refresh_snapshot'])) {
            $context = $this->contextService->buildExecutiveContext('all_time');
            $report->snapshot_data = [
                'as_of_date' => Carbon::now()->toDateString(),
                'as_of_time' => Carbon::now()->format('H:i') . ' WIB',
                'period_label' => strtoupper($report->report_type) . " ({$report->period_start} s/d {$report->period_end})",
                'company_health' => $context['company_health'] ?? [],
                'tasks_performance' => $context['tasks_performance'] ?? [],
                'milestones_performance' => $context['milestones_performance'] ?? [],
                'projects' => $context['projects'] ?? [],
                'team_workload' => $context['team_workload'] ?? [],
                'risks' => $context['risks'] ?? [],
                'blockers' => $context['blockers'] ?? [],
                'decisions' => $context['decisions'] ?? [],
            ];
        }

        $report->save();

        return response()->json([
            'success' => true,
            'message' => 'Draft laporan eksekutif berhasil diperbarui.',
            'report' => $report->load(['generatedBy:id,name,role']),
        ]);
    }

    /**
     * POST /api/leadership/executive-reports/{id}/publish
     * Lock and officially publish the executive report (Permanent Snapshot)
     */
    public function publish(Request $request, $id)
    {
        $user = $this->authorizeExecutive($request);

        $report = ExecutiveReport::find($id);
        if (!$report) {
            return response()->json(['message' => 'Laporan eksekutif tidak ditemukan.'], 404);
        }

        if ($report->isPublished()) {
            return response()->json([
                'message' => 'Laporan eksekutif ini sudah diterbitkan sebelumnya pada ' . ($report->published_at ? $report->published_at->format('d M Y H:i') : '') . '.',
            ], 422);
        }

        $report->status = 'published';
        $report->published_at = now();
        $report->published_by = $user->id;
        $report->save();

        return response()->json([
            'success' => true,
            'message' => 'Laporan eksekutif resmi berhasil diterbitkan dan diarsipkan secara permanen.',
            'report' => $report->load(['generatedBy:id,name,role', 'publishedBy:id,name,role']),
        ]);
    }

    /**
     * DELETE /api/leadership/executive-reports/{id}
     * Delete report (Draft only, published cannot be deleted)
     */
    public function destroy(Request $request, $id)
    {
        $this->authorizeExecutive($request);

        $report = ExecutiveReport::find($id);
        if (!$report) {
            return response()->json(['message' => 'Laporan eksekutif tidak ditemukan.'], 404);
        }

        if ($report->isPublished()) {
            return response()->json([
                'message' => 'Laporan yang telah diterbitkan merupakan dokumentasi resmi perusahaan dan tidak boleh dihapus.',
            ], 422);
        }

        $report->delete();

        return response()->json([
            'success' => true,
            'message' => 'Draft laporan eksekutif berhasil dihapus.',
        ]);
    }

    /**
     * GET /api/leadership/executive-reports/{id}/export
     * Get clean print-ready payload for PDF or browser print
     */
    public function export(Request $request, $id)
    {
        $this->authorizeExecutive($request);

        $report = ExecutiveReport::with(['generatedBy:id,name,role', 'publishedBy:id,name,role'])->find($id);

        if (!$report) {
            return response()->json(['message' => 'Laporan eksekutif tidak ditemukan.'], 404);
        }

        return response()->json([
            'success' => true,
            'company' => [
                'name' => 'PT Potensi Karya Mandiri',
                'unit' => 'Executive Management & Business Control Center',
                'address' => 'Gedung PKM Center, Jakarta - Indonesia',
            ],
            'report' => $report,
            'exported_at' => Carbon::now()->toIso8601String(),
        ]);
    }

    /**
     * GET /api/leadership/decision-followup
     * Module B & C: Strategic Decision Follow-up and Management Action Tracker
     */
    public function decisionFollowup(Request $request)
    {
        $this->authorizeExecutive($request);
        $today = Carbon::today()->toDateString();

        $query = ExecutiveDecision::with([
            'project:id,code,name',
            'risk:id,risk_code,title,risk_level',
            'pic:id,name,email,role',
            'creator:id,name,email',
            'audits' => function ($q) {
                $q->orderBy('created_at', 'desc')->limit(10);
            }
        ]);

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('priority') && $request->priority !== 'all') {
            $query->where('priority', $request->priority);
        }

        if ($request->filled('pic_id') && $request->pic_id !== 'all') {
            $query->where('pic_id', $request->pic_id);
        }

        if ($request->filled('overdue') && $request->overdue === 'true') {
            $query->whereIn('status', ['approved', 'in_progress'])
                ->whereNotNull('due_date')
                ->where('due_date', '<', $today);
        }

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($w) use ($s) {
                $w->where('title', 'like', "%{$s}%")
                  ->orWhere('decision_number', 'like', "%{$s}%")
                  ->orWhere('description', 'like', "%{$s}%")
                  ->orWhere('implementation_result', 'like', "%{$s}%");
            });
        }

        $allDecisions = ExecutiveDecision::all();
        $totalDecisions = $allDecisions->count();
        $completedCount = $allDecisions->where('status', 'completed')->count();
        $inProgressCount = $allDecisions->where('status', 'in_progress')->count();
        $approvedCount = $allDecisions->where('status', 'approved')->count();
        $draftCount = $allDecisions->where('status', 'draft')->count();
        $cancelledCount = $allDecisions->where('status', 'cancelled')->count();

        // Calculate overdue decisions (approved or in_progress with due_date < today)
        $overdueDecisions = $allDecisions->filter(function ($d) use ($today) {
            return in_array($d->status, ['approved', 'in_progress'], true)
                && !empty($d->due_date)
                && $d->due_date < $today;
        });

        // Calculate approaching deadline (due in <= 3 days from today and not yet completed)
        $threeDaysLater = Carbon::today()->addDays(3)->toDateString();
        $approachingDecisions = $allDecisions->filter(function ($d) use ($today, $threeDaysLater) {
            return in_array($d->status, ['approved', 'in_progress'], true)
                && !empty($d->due_date)
                && $d->due_date >= $today
                && $d->due_date <= $threeDaysLater;
        });

        $resolutionRate = $totalDecisions > 0 ? round(($completedCount / $totalDecisions) * 100, 1) : 0;

        $decisions = $query->orderBy('due_date', 'asc')
            ->orderBy('decision_date', 'desc')
            ->get();

        // Map decision with computed helper properties
        $decisionsWithComputed = $decisions->map(function ($d) use ($today, $threeDaysLater) {
            $isOverdue = in_array($d->status, ['approved', 'in_progress'], true)
                && !empty($d->due_date)
                && $d->due_date < $today;

            $isApproaching = in_array($d->status, ['approved', 'in_progress'], true)
                && !empty($d->due_date)
                && $d->due_date >= $today
                && $d->due_date <= $threeDaysLater;

            $daysRemaining = null;
            if (!empty($d->due_date)) {
                $daysRemaining = Carbon::parse($today)->diffInDays(Carbon::parse($d->due_date), false);
            }

            return array_merge($d->toArray(), [
                'is_overdue' => $isOverdue,
                'is_approaching' => $isApproaching,
                'days_remaining' => $daysRemaining,
            ]);
        });

        return response()->json([
            'success' => true,
            'summary' => [
                'total_decisions' => $totalDecisions,
                'completed_count' => $completedCount,
                'in_progress_count' => $inProgressCount,
                'approved_count' => $approvedCount,
                'draft_count' => $draftCount,
                'cancelled_count' => $cancelledCount,
                'overdue_count' => $overdueDecisions->count(),
                'approaching_count' => $approachingDecisions->count(),
                'resolution_rate' => $resolutionRate,
            ],
            'total' => $decisionsWithComputed->count(),
            'decisions' => $decisionsWithComputed,
        ]);
    }
}
