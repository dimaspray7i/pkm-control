<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BlockerResolution;
use App\Models\ExecutiveDecision;
use App\Models\ExecutiveDecisionAudit;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\StrategicRisk;
use App\Models\Task;
use App\Models\TaskUpdate;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class LeadershipRiskController extends Controller
{
    /**
     * Helper to verify executive role authorization
     */
    protected function authorizeExecutive(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'pimpinan'], true)) {
            abort(response()->json([
                'message' => 'Akses ditolak. Fitur Risk & Decision Center hanya dapat diakses oleh Pimpinan dan Administrator.',
            ], 403));
        }
        return $user;
    }

    /**
     * Modul A: Executive Risk Overview
     */
    public function overview(Request $request)
    {
        $this->authorizeExecutive($request);
        $today = Carbon::today()->toDateString();

        // 1. Strategic Risks
        $allRisks = StrategicRisk::all();
        $totalRisks = $allRisks->count();
        $activeRisks = $allRisks->whereIn('status', ['open', 'mitigating', 'monitoring'])->values();
        $totalActiveRisks = $activeRisks->count();

        $criticalRisksCount = $activeRisks->where('risk_level', 'critical')->count();
        $highRisksCount     = $activeRisks->where('risk_level', 'high')->count();
        $mediumRisksCount   = $activeRisks->where('risk_level', 'medium')->count();
        $lowRisksCount      = $activeRisks->where('risk_level', 'low')->count();

        $resolvedRisksCount = $allRisks->where('status', 'resolved')->count();
        $acceptedRisksCount = $allRisks->where('status', 'accepted')->count();

        $overdueRisksCount = $activeRisks->filter(function ($r) use ($today) {
            return !empty($r->target_resolution_date) && $r->target_resolution_date < $today;
        })->count();

        // 2. Active Blockers from Task Updates
        $resolvedBlockerIds = BlockerResolution::where('status', 'resolved')->pluck('task_update_id');
        $activeBlockersCount = TaskUpdate::whereNotNull('blocker')
            ->where('blocker', '!=', '')
            ->whereNotIn('id', $resolvedBlockerIds)
            ->count();

        // 3. Executive Decisions Overview
        $allDecisions = ExecutiveDecision::all();
        $totalDecisions = $allDecisions->count();
        $draftDecisions = $allDecisions->where('status', 'draft')->count();
        $approvedDecisions = $allDecisions->where('status', 'approved')->count();
        $inProgressDecisions = $allDecisions->where('status', 'in_progress')->count();
        $completedDecisions = $allDecisions->where('status', 'completed')->count();
        $cancelledDecisions = $allDecisions->where('status', 'cancelled')->count();

        $overdueDecisionsCount = $allDecisions->filter(function ($d) use ($today) {
            return in_array($d->status, ['approved', 'in_progress'], true)
                && !empty($d->due_date)
                && $d->due_date < $today;
        })->count();

        // 4. Escalations count
        $escalationsCount = $criticalRisksCount + $overdueDecisionsCount + ($activeBlockersCount > 0 ? 1 : 0);

        return response()->json([
            'success' => true,
            'meta' => [
                'as_of_date' => Carbon::now()->translatedFormat('l, d F Y'),
                'as_of_time' => Carbon::now()->format('H:i') . ' WIB',
                'refreshed_at' => Carbon::now()->toIso8601String(),
            ],
            'risks_summary' => [
                'total_active' => $totalActiveRisks,
                'critical' => $criticalRisksCount,
                'high' => $highRisksCount,
                'medium' => $mediumRisksCount,
                'low' => $lowRisksCount,
                'resolved' => $resolvedRisksCount,
                'accepted' => $acceptedRisksCount,
                'overdue' => $overdueRisksCount,
                'total_all' => $totalRisks,
            ],
            'metrics' => [
                'total_active_risks' => $totalActiveRisks,
                'critical_risks' => $criticalRisksCount,
                'high_risks' => $highRisksCount,
                'medium_risks' => $mediumRisksCount,
                'low_risks' => $lowRisksCount,
                'resolved_risks' => $resolvedRisksCount,
                'overdue_follow_ups' => $overdueRisksCount,
                'total_active_blockers' => $activeBlockersCount,
            ],
            'distribution' => [
                'by_level' => [
                    'critical' => $criticalRisksCount,
                    'high' => $highRisksCount,
                    'medium' => $mediumRisksCount,
                    'low' => $lowRisksCount,
                ],
                'by_category' => $allRisks->groupBy('category')->map->count(),
            ],
            'blockers_summary' => [
                'total_active' => $activeBlockersCount,
            ],
            'decisions_summary' => [
                'total' => $totalDecisions,
                'draft' => $draftDecisions,
                'approved' => $approvedDecisions,
                'in_progress' => $inProgressDecisions,
                'completed' => $completedDecisions,
                'cancelled' => $cancelledDecisions,
                'overdue' => $overdueDecisionsCount,
            ],
            'escalations_count' => $escalationsCount,
        ]);
    }

    /**
     * Modul B: Risk Register - List All Strategic Risks
     */
    public function risksIndex(Request $request)
    {
        $this->authorizeExecutive($request);

        $query = StrategicRisk::with([
            'project:id,code,name,client,status',
            'owner:id,name,email,role',
            'creator:id,name,email'
        ]);

        if ($request->filled('status') && $request->status !== 'all') {
            if ($request->status === 'active') {
                $query->whereIn('status', ['open', 'mitigating', 'monitoring']);
            } else {
                $query->where('status', $request->status);
            }
        }

        if ($request->filled('risk_level') && $request->risk_level !== 'all') {
            $query->where('risk_level', $request->risk_level);
        }

        if ($request->filled('category') && $request->category !== 'all') {
            $query->where('category', $request->category);
        }

        if ($request->filled('project_id') && $request->project_id !== 'all') {
            $query->where('project_id', $request->project_id);
        }

        if ($request->filled('search')) {
            $q = $request->search;
            $query->where(function ($w) use ($q) {
                $w->where('title', 'like', "%{$q}%")
                  ->orWhere('risk_code', 'like', "%{$q}%")
                  ->orWhere('description', 'like', "%{$q}%")
                  ->orWhere('mitigation', 'like', "%{$q}%");
            });
        }

        $risks = $query->orderBy('risk_score', 'desc')
            ->orderBy('identified_date', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'risks' => $risks,
            'total' => $risks->count(),
        ]);
    }

    /**
     * Modul B: Create Strategic Risk
     */
    public function risksStore(Request $request)
    {
        $user = $this->authorizeExecutive($request);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category' => ['required', 'string', 'max:100'],
            'project_id' => ['nullable', 'exists:projects,id'],
            'source' => ['nullable', 'string', 'max:255'],
            'impact' => ['required', 'integer', 'min:1', 'max:5'],
            'likelihood' => ['required', 'integer', 'min:1', 'max:5'],
            'mitigation' => ['nullable', 'string'],
            'owner_id' => ['nullable', 'exists:users,id'],
            'identified_date' => ['required', 'date'],
            'target_resolution_date' => ['nullable', 'date'],
            'status' => ['nullable', 'string', Rule::in(['open', 'mitigating', 'monitoring', 'resolved', 'accepted'])],
            'resolution_notes' => ['nullable', 'string'],
        ], [
            'title.required' => 'Judul risiko wajib diisi.',
            'category.required' => 'Kategori risiko wajib dipilih.',
            'impact.min' => 'Skala dampak minimal 1 (Insignificant).',
            'impact.max' => 'Skala dampak maksimal 5 (Severe).',
            'likelihood.min' => 'Skala kemungkinan minimal 1 (Rare).',
            'likelihood.max' => 'Skala kemungkinan maksimal 5 (Almost Certain).',
            'identified_date.required' => 'Tanggal identifikasi risiko wajib diisi.',
        ]);

        $scoreAndLevel = StrategicRisk::calculateScoreAndLevel((int) $validated['likelihood'], (int) $validated['impact']);

        $status = $validated['status'] ?? 'open';
        $resolvedAt = null;
        if ($status === 'resolved') {
            if (empty($validated['resolution_notes'])) {
                return response()->json([
                    'message' => 'Penutupan risiko (status resolved) mewajibkan pengisian catatan penyelesaian.',
                    'errors' => ['resolution_notes' => ['Catatan penyelesaian wajib diisi saat menutup risiko.']],
                ], 422);
            }
            $resolvedAt = now();
        }

        $ownerName = null;
        if (!empty($validated['owner_id'])) {
            $ownerUser = User::find($validated['owner_id']);
            $ownerName = $ownerUser ? $ownerUser->name : null;
        }

        $risk = StrategicRisk::create([
            'risk_code' => StrategicRisk::generateRiskCode(),
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'category' => $validated['category'],
            'project_id' => $validated['project_id'] ?? null,
            'source' => $validated['source'] ?? 'Manual Pimpinan',
            'impact' => (int) $validated['impact'],
            'likelihood' => (int) $validated['likelihood'],
            'risk_score' => $scoreAndLevel['score'],
            'risk_level' => $scoreAndLevel['level'],
            'mitigation' => $validated['mitigation'] ?? null,
            'owner_id' => $validated['owner_id'] ?? null,
            'owner_name' => $ownerName,
            'identified_date' => $validated['identified_date'],
            'target_resolution_date' => $validated['target_resolution_date'] ?? null,
            'status' => $status,
            'resolution_notes' => $validated['resolution_notes'] ?? null,
            'resolved_at' => $resolvedAt,
            'created_by' => $user->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Risiko strategis berhasil dicatat ke Risk Register.',
            'risk' => $risk->load(['project:id,code,name', 'owner:id,name,email']),
        ], 201);
    }

    /**
     * Modul B: Show Strategic Risk
     */
    public function risksShow(Request $request, $id)
    {
        $this->authorizeExecutive($request);

        $risk = StrategicRisk::with([
            'project:id,code,name,client,status',
            'owner:id,name,email,role,phone',
            'creator:id,name,email',
            'decisions' => function ($q) {
                $q->orderBy('created_at', 'desc');
            }
        ])->find($id);

        if (!$risk) {
            return response()->json(['message' => 'Risiko tidak ditemukan.'], 404);
        }

        return response()->json([
            'success' => true,
            'risk' => $risk,
        ]);
    }

    /**
     * Modul B & C: Update Strategic Risk
     */
    public function risksUpdate(Request $request, $id)
    {
        $user = $this->authorizeExecutive($request);

        $risk = StrategicRisk::find($id);
        if (!$risk) {
            return response()->json(['message' => 'Risiko tidak ditemukan.'], 404);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category' => ['sometimes', 'required', 'string', 'max:100'],
            'project_id' => ['nullable', 'exists:projects,id'],
            'source' => ['nullable', 'string', 'max:255'],
            'impact' => ['sometimes', 'required', 'integer', 'min:1', 'max:5'],
            'likelihood' => ['sometimes', 'required', 'integer', 'min:1', 'max:5'],
            'mitigation' => ['nullable', 'string'],
            'owner_id' => ['nullable', 'exists:users,id'],
            'target_resolution_date' => ['nullable', 'date'],
            'status' => ['sometimes', 'required', 'string', Rule::in(['open', 'mitigating', 'monitoring', 'resolved', 'accepted'])],
            'resolution_notes' => ['nullable', 'string'],
        ]);

        $impact = isset($validated['impact']) ? (int) $validated['impact'] : $risk->impact;
        $likelihood = isset($validated['likelihood']) ? (int) $validated['likelihood'] : $risk->likelihood;
        $scoreAndLevel = StrategicRisk::calculateScoreAndLevel($likelihood, $impact);

        $newStatus = $validated['status'] ?? $risk->status;
        $resolvedAt = $risk->resolved_at;

        if ($newStatus === 'resolved') {
            $notes = $validated['resolution_notes'] ?? $risk->resolution_notes;
            if (empty($notes)) {
                return response()->json([
                    'message' => 'Penutupan risiko (status resolved) mewajibkan pengisian catatan penyelesaian.',
                    'errors' => ['resolution_notes' => ['Catatan penyelesaian wajib diisi saat menutup risiko.']],
                ], 422);
            }
            if (!$resolvedAt) {
                $resolvedAt = now();
            }
        } elseif ($newStatus !== 'resolved') {
            $resolvedAt = null;
        }

        $ownerName = $risk->owner_name;
        if (array_key_exists('owner_id', $validated)) {
            if ($validated['owner_id']) {
                $ownerUser = User::find($validated['owner_id']);
                $ownerName = $ownerUser ? $ownerUser->name : null;
            } else {
                $ownerName = null;
            }
        }

        $risk->update([
            'title' => $validated['title'] ?? $risk->title,
            'description' => array_key_exists('description', $validated) ? $validated['description'] : $risk->description,
            'category' => $validated['category'] ?? $risk->category,
            'project_id' => array_key_exists('project_id', $validated) ? $validated['project_id'] : $risk->project_id,
            'source' => $validated['source'] ?? $risk->source,
            'impact' => $impact,
            'likelihood' => $likelihood,
            'risk_score' => $scoreAndLevel['score'],
            'risk_level' => $scoreAndLevel['level'],
            'mitigation' => array_key_exists('mitigation', $validated) ? $validated['mitigation'] : $risk->mitigation,
            'owner_id' => array_key_exists('owner_id', $validated) ? $validated['owner_id'] : $risk->owner_id,
            'owner_name' => $ownerName,
            'target_resolution_date' => array_key_exists('target_resolution_date', $validated) ? $validated['target_resolution_date'] : $risk->target_resolution_date,
            'status' => $newStatus,
            'resolution_notes' => $validated['resolution_notes'] ?? $risk->resolution_notes,
            'resolved_at' => $resolvedAt,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Data risiko berhasil diperbarui.',
            'risk' => $risk->fresh(['project:id,code,name', 'owner:id,name,email']),
        ]);
    }

    /**
     * Modul D: Automatic Risk Detection Engine
     * Detects operational anomalies from real DB data with stable fingerprints
     */
    public function automaticRisks(Request $request)
    {
        $this->authorizeExecutive($request);

        $today = Carbon::today()->toDateString();
        $detections = [];

        // 1. Projects with status 'delayed'
        $delayedProjects = Project::with('pic:id,name')->where('status', 'delayed')->where('is_active', true)->get();
        foreach ($delayedProjects as $p) {
            $detections[] = [
                'fingerprint' => 'auto-delayed-proj-' . $p->id,
                'risk_type' => 'Keterlambatan Proyek (Delayed Status)',
                'project_id' => $p->id,
                'project_code' => $p->code,
                'project_name' => $p->name,
                'source' => 'Database Proyek PKM',
                'severity' => 'critical',
                'factual_evidence' => "Proyek {$p->code} secara resmi berstatus 'delayed' di sistem. Deadline: " . ($p->deadline ?? 'Belum ditentukan') . ", PIC: " . ($p->pic ? $p->pic->name : $p->pic_name),
                'business_impact' => 'Keterlambatan penyerahan output berisiko penalti kontrak atau ketidakpuasan klien.',
                'recommendation' => 'Pimpinan perlu memanggil PM terkait untuk revisi timeline dan mitigasi percepatan.',
                'detected_at' => $p->updated_at ? $p->updated_at->format('Y-m-d') : $today,
            ];
        }

        // 2. Active Projects with negative target variance <= -20%
        $laggingProjects = Project::with('pic:id,name')
            ->where('status', '!=', 'completed')
            ->whereNotNull('target_progress')
            ->where('target_progress', '>', 0)
            ->get()
            ->filter(function ($p) {
                return ((int) $p->progress - (int) $p->target_progress) <= -20;
            });

        foreach ($laggingProjects as $p) {
            $variance = (int) $p->progress - (int) $p->target_progress;
            $detections[] = [
                'fingerprint' => 'auto-variance-proj-' . $p->id,
                'risk_type' => 'Deviasi Target Signifikan',
                'project_id' => $p->id,
                'project_code' => $p->code,
                'project_name' => $p->name,
                'source' => 'Analisis Target vs Aktual',
                'severity' => 'high',
                'factual_evidence' => "Progres aktual proyek ({$p->progress}%) tertinggal " . abs($variance) . "% dari target baseline ({$p->target_progress}%).",
                'business_impact' => 'Deviasi target yang tinggi mengindikasikan ketidakefektifan fase eksekusi atau estimasi kerja yang tidak realistis.',
                'recommendation' => 'Evaluasi kendala teknis bersama PM dan pertimbangkan alokasi sumber daya tambahan.',
                'detected_at' => $today,
            ];
        }

        // 3. Active Blockers reported in task_updates
        $resolvedBlockerIds = BlockerResolution::where('status', 'resolved')->pluck('task_update_id');
        $activeBlockerUpdates = TaskUpdate::with(['task.project', 'user:id,name'])
            ->whereNotNull('blocker')
            ->where('blocker', '!=', '')
            ->whereNotIn('id', $resolvedBlockerIds)
            ->orderBy('created_at', 'desc')
            ->get();

        foreach ($activeBlockerUpdates as $bu) {
            $task = $bu->task;
            $proj = $task ? $task->project : null;
            $daysOpen = Carbon::parse($bu->created_at)->diffInDays(Carbon::parse($today));

            $detections[] = [
                'fingerprint' => 'auto-blocker-update-' . $bu->id,
                'risk_type' => 'Kendala (Blocker) Lapangan Aktif',
                'project_id' => $proj ? $proj->id : null,
                'project_code' => $proj ? $proj->code : 'PKM-000',
                'project_name' => $proj ? $proj->name : 'Operasional Tugas',
                'source' => 'Laporan Progres Harian Anggota',
                'severity' => $daysOpen >= 3 ? 'critical' : 'high',
                'factual_evidence' => "Blocker pada tugas '{$task->title}' dilaporkan oleh {$bu->user_name} sejak {$daysOpen} hari lalu: \"{$bu->blocker}\".",
                'business_impact' => 'Pekerjaan anggota tim terhenti langsung akibat ketergantungan pihak ketiga atau kendala teknis.',
                'recommendation' => 'Pimpinan dapat membuat Keputusan Eksekutif untuk disposisi koordinasi eksternal atau penyediaan akses.',
                'detected_at' => Carbon::parse($bu->created_at)->format('Y-m-d'),
            ];
        }

        // 4. Overdue Milestones
        $overdueMilestones = Milestone::with('project:id,code,name')
            ->where('status', '!=', 'completed')
            ->whereNotNull('due_date')
            ->where('due_date', '<', $today)
            ->get();

        foreach ($overdueMilestones as $ms) {
            $daysOverdue = Carbon::parse($ms->due_date)->diffInDays(Carbon::parse($today));
            $proj = $ms->project;

            $detections[] = [
                'fingerprint' => 'auto-overdue-ms-' . $ms->id,
                'risk_type' => 'Milestone Melewati Batas Waktu',
                'project_id' => $proj ? $proj->id : null,
                'project_code' => $proj ? $proj->code : 'PKM-000',
                'project_name' => $proj ? $proj->name : 'Milestone',
                'source' => 'Roadmap Milestone Portofolio',
                'severity' => $daysOverdue >= 7 ? 'high' : 'medium',
                'factual_evidence' => "Milestone '{$ms->title}' dengan target tanggal {$ms->due_date} telah melewati batas waktu {$daysOverdue} hari (Progres: {$ms->progress}%).",
                'business_impact' => 'Sprint pengerjaan proyek mengalami pergeseran jadwal secara kumulatif.',
                'recommendation' => 'Verifikasi kendala penyelesaian tugas dalam milestone ini.',
                'detected_at' => $today,
            ];
        }

        // Sort detections: critical -> high -> medium
        $severityWeight = ['critical' => 3, 'high' => 2, 'medium' => 1];
        usort($detections, function ($a, $b) use ($severityWeight) {
            return ($severityWeight[$b['severity']] ?? 0) <=> ($severityWeight[$a['severity']] ?? 0);
        });

        return response()->json([
            'success' => true,
            'total' => count($detections),
            'detections' => $detections,
        ]);
    }

    /**
     * Modul E: Blocker Monitoring Panel
     */
    public function blockersIndex(Request $request)
    {
        $this->authorizeExecutive($request);
        $today = Carbon::today()->toDateString();

        $blockerUpdates = TaskUpdate::with([
            'task.project:id,code,name,pic_id,pic_name',
            'task.assignee:id,name,email',
            'user:id,name,email'
        ])
        ->whereNotNull('blocker')
        ->where('blocker', '!=', '')
        ->orderBy('created_at', 'desc')
        ->get();

        $resolutions = BlockerResolution::with('acknowledgedBy:id,name')->get()->keyBy('task_update_id');

        $formattedBlockers = $blockerUpdates->map(function ($bu) use ($resolutions, $today) {
            $res = $resolutions->get($bu->id);
            $task = $bu->task;
            $proj = $task ? $task->project : null;
            $reportedAt = Carbon::parse($bu->created_at);
            $daysOpen = $reportedAt->diffInDays(Carbon::parse($today));

            $status = $res ? $res->status : 'new';

            return [
                'id' => $bu->id,
                'task_id' => $bu->task_id,
                'task_title' => $task ? $task->title : 'Tugas #' . $bu->task_id,
                'project_id' => $proj ? $proj->id : null,
                'project_code' => $proj ? $proj->code : 'PKM-000',
                'project_name' => $proj ? $proj->name : 'General Operasional',
                'reported_by_id' => $bu->user_id,
                'reported_by_name' => $bu->user_name ?? ($bu->user ? $bu->user->name : 'Anggota Tim'),
                'work_description' => $bu->work_description,
                'blocker' => $bu->blocker,
                'reported_at' => $reportedAt->toIso8601String(),
                'days_open' => (int) $daysOpen,
                'status' => $status,
                'resolution_notes' => $res ? $res->resolution_notes : null,
                'resolved_at' => $res && $res->resolved_at ? Carbon::parse($res->resolved_at)->toIso8601String() : null,
                'acknowledged_by' => $res && $res->acknowledgedBy ? $res->acknowledgedBy->name : null,
            ];
        });

        // Filter if requested
        if ($request->filled('status') && $request->status !== 'all') {
            $formattedBlockers = $formattedBlockers->where('status', $request->status)->values();
        }

        return response()->json([
            'success' => true,
            'total' => $formattedBlockers->count(),
            'blockers' => $formattedBlockers,
        ]);
    }

    /**
     * Modul E: Update Blocker Resolution Status
     */
    public function blockersUpdateStatus(Request $request, $id)
    {
        $user = $this->authorizeExecutive($request);

        $blockerUpdate = TaskUpdate::find($id);
        if (!$blockerUpdate) {
            return response()->json(['message' => 'Laporan blocker tidak ditemukan.'], 404);
        }

        $validated = $request->validate([
            'status' => ['required', 'string', Rule::in(['new', 'acknowledged', 'in_progress', 'resolved'])],
            'resolution_notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $resolvedAt = null;
        if ($validated['status'] === 'resolved') {
            $resolvedAt = now();
        }

        $resolution = BlockerResolution::updateOrCreate(
            ['task_update_id' => $blockerUpdate->id],
            [
                'task_id' => $blockerUpdate->task_id,
                'status' => $validated['status'],
                'acknowledged_by' => $user->id,
                'resolution_notes' => $validated['resolution_notes'] ?? null,
                'resolved_at' => $resolvedAt,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Status penanganan blocker berhasil diperbarui.',
            'resolution' => $resolution->load('acknowledgedBy:id,name'),
            'blocker' => [
                'id' => $blockerUpdate->id,
                'status' => $resolution->status,
                'resolution_notes' => $resolution->resolution_notes,
                'resolved_at' => $resolution->resolved_at,
            ],
        ]);
    }

    /**
     * Modul F & G: Executive Decisions - List All Decisions
     */
    public function decisionsIndex(Request $request)
    {
        $this->authorizeExecutive($request);

        $query = ExecutiveDecision::with([
            'project:id,code,name',
            'risk:id,risk_code,title,risk_level',
            'pic:id,name,email,role',
            'creator:id,name,email',
            'audits' => function ($q) {
                $q->limit(5);
            }
        ]);

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('category') && $request->category !== 'all') {
            $query->where('category', $request->category);
        }

        if ($request->filled('priority') && $request->priority !== 'all') {
            $query->where('priority', $request->priority);
        }

        if ($request->filled('project_id') && $request->project_id !== 'all') {
            $query->where('project_id', $request->project_id);
        }

        if ($request->filled('search')) {
            $q = $request->search;
            $query->where(function ($w) use ($q) {
                $w->where('title', 'like', "%{$q}%")
                  ->orWhere('decision_number', 'like', "%{$q}%")
                  ->orWhere('description', 'like', "%{$q}%")
                  ->orWhere('rationale', 'like', "%{$q}%");
            });
        }

        $decisions = $query->orderBy('decision_date', 'desc')
            ->orderBy('id', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'total' => $decisions->count(),
            'decisions' => $decisions,
        ]);
    }

    /**
     * Modul F: Create Executive Decision
     */
    public function decisionsStore(Request $request)
    {
        $user = $this->authorizeExecutive($request);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'category' => ['required', 'string', 'max:100'],
            'project_id' => ['nullable', 'exists:projects,id'],
            'risk_id' => ['nullable', 'exists:strategic_risks,id'],
            'underlying_problem' => ['nullable', 'string'],
            'rationale' => ['nullable', 'string'],
            'priority' => ['required', 'string', Rule::in(['low', 'medium', 'high', 'critical'])],
            'decision_date' => ['required', 'date'],
            'pic_id' => ['nullable', 'exists:users,id'],
            'due_date' => ['nullable', 'date'],
            'status' => ['required', 'string', Rule::in(['draft', 'approved', 'in_progress', 'completed', 'cancelled'])],
            'implementation_result' => ['nullable', 'string'],
            'cancellation_reason' => ['nullable', 'string'],
        ], [
            'title.required' => 'Judul keputusan wajib diisi.',
            'description.required' => 'Deskripsi keputusan wajib diisi.',
            'category.required' => 'Kategori keputusan wajib dipilih.',
            'priority.required' => 'Prioritas keputusan wajib ditentukan.',
            'decision_date.required' => 'Tanggal keputusan wajib diisi.',
        ]);

        // Enforcement: Approved decision requires PIC and due_date
        if (in_array($validated['status'], ['approved', 'in_progress'], true)) {
            if (empty($validated['pic_id']) || empty($validated['due_date'])) {
                return response()->json([
                    'message' => 'Keputusan berstatus Approved atau In Progress mewajibkan penentuan Penanggung Jawab (PIC) dan target batas waktu (Deadline).',
                    'errors' => [
                        'pic_id' => empty($validated['pic_id']) ? ['PIC wajib ditentukan saat mengesahkan keputusan.'] : [],
                        'due_date' => empty($validated['due_date']) ? ['Batas waktu (Deadline) wajib diisi saat mengesahkan keputusan.'] : [],
                    ],
                ], 422);
            }
        }

        // Enforcement: Completed decision requires implementation_result
        if ($validated['status'] === 'completed') {
            if (empty($validated['implementation_result'])) {
                return response()->json([
                    'message' => 'Penyelesaian keputusan (status completed) mewajibkan pencatatan hasil tindak lanjut.',
                    'errors' => ['implementation_result' => ['Hasil tindak lanjut wajib dicatat saat menyelesaikan keputusan.']],
                ], 422);
            }
        }

        // Enforcement: Cancelled decision requires cancellation_reason
        if ($validated['status'] === 'cancelled') {
            if (empty($validated['cancellation_reason'])) {
                return response()->json([
                    'message' => 'Pembatalan keputusan mewajibkan pencatatan alasan pembatalan.',
                    'errors' => ['cancellation_reason' => ['Alasan pembatalan wajib diisi.']],
                ], 422);
            }
        }

        $picName = null;
        if (!empty($validated['pic_id'])) {
            $picUser = User::find($validated['pic_id']);
            $picName = $picUser ? $picUser->name : null;
        }

        $decisionNumber = ExecutiveDecision::generateDecisionNumber();
        $completedAt = $validated['status'] === 'completed' ? now() : null;

        $decision = ExecutiveDecision::create([
            'decision_number' => $decisionNumber,
            'title' => $validated['title'],
            'description' => $validated['description'],
            'category' => $validated['category'],
            'project_id' => $validated['project_id'] ?? null,
            'risk_id' => $validated['risk_id'] ?? null,
            'underlying_problem' => $validated['underlying_problem'] ?? null,
            'rationale' => $validated['rationale'] ?? null,
            'priority' => $validated['priority'],
            'decision_date' => $validated['decision_date'],
            'pic_id' => $validated['pic_id'] ?? null,
            'pic_name' => $picName,
            'due_date' => $validated['due_date'] ?? null,
            'status' => $validated['status'],
            'implementation_result' => $validated['implementation_result'] ?? null,
            'cancellation_reason' => $validated['cancellation_reason'] ?? null,
            'completed_at' => $completedAt,
            'created_by' => $user->id,
        ]);

        // Audit Trail Entry
        ExecutiveDecisionAudit::create([
            'decision_id' => $decision->id,
            'user_id' => $user->id,
            'user_name' => $user->name,
            'action' => 'created',
            'notes' => 'Keputusan strategis dibuat dengan status ' . strtoupper($decision->status),
            'changes' => [
                'status' => $decision->status,
                'priority' => $decision->priority,
                'pic' => $picName,
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Keputusan strategis berhasil dicatat ke Decision Registry.',
            'decision' => $decision->load(['project:id,code,name', 'pic:id,name,email', 'risk:id,risk_code,title']),
        ], 201);
    }

    /**
     * Modul F: Show Executive Decision
     */
    public function decisionsShow(Request $request, $id)
    {
        $this->authorizeExecutive($request);

        $decision = ExecutiveDecision::with([
            'project:id,code,name,client',
            'risk:id,risk_code,title,risk_level,status',
            'pic:id,name,email,role,phone',
            'creator:id,name,email',
            'audits.user:id,name,email'
        ])->find($id);

        if (!$decision) {
            return response()->json(['message' => 'Keputusan eksekutif tidak ditemukan.'], 404);
        }

        return response()->json([
            'success' => true,
            'decision' => $decision,
        ]);
    }

    /**
     * Modul F & G: Update Executive Decision with Audit Trail
     */
    public function decisionsUpdate(Request $request, $id)
    {
        $user = $this->authorizeExecutive($request);

        $decision = ExecutiveDecision::find($id);
        if (!$decision) {
            return response()->json(['message' => 'Keputusan eksekutif tidak ditemukan.'], 404);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'required', 'string'],
            'category' => ['sometimes', 'required', 'string', 'max:100'],
            'project_id' => ['nullable', 'exists:projects,id'],
            'risk_id' => ['nullable', 'exists:strategic_risks,id'],
            'underlying_problem' => ['nullable', 'string'],
            'rationale' => ['nullable', 'string'],
            'priority' => ['sometimes', 'required', 'string', Rule::in(['low', 'medium', 'high', 'critical'])],
            'pic_id' => ['nullable', 'exists:users,id'],
            'due_date' => ['nullable', 'date'],
            'status' => ['sometimes', 'required', 'string', Rule::in(['draft', 'approved', 'in_progress', 'completed', 'cancelled'])],
            'implementation_result' => ['nullable', 'string'],
            'cancellation_reason' => ['nullable', 'string'],
            'audit_notes' => ['nullable', 'string', 'max:500'],
        ]);

        $newStatus = $validated['status'] ?? $decision->status;
        $picId = array_key_exists('pic_id', $validated) ? $validated['pic_id'] : $decision->pic_id;
        $dueDate = array_key_exists('due_date', $validated) ? $validated['due_date'] : $decision->due_date;

        // Enforcement: Approved decision requires PIC and due_date
        if (in_array($newStatus, ['approved', 'in_progress'], true)) {
            if (empty($picId) || empty($dueDate)) {
                return response()->json([
                    'message' => 'Keputusan berstatus Approved atau In Progress mewajibkan penentuan Penanggung Jawab (PIC) dan target batas waktu (Deadline).',
                    'errors' => [
                        'pic_id' => empty($picId) ? ['PIC wajib ditentukan saat mengesahkan keputusan.'] : [],
                        'due_date' => empty($dueDate) ? ['Batas waktu (Deadline) wajib diisi saat mengesahkan keputusan.'] : [],
                    ],
                ], 422);
            }
        }

        // Enforcement: Completed decision requires implementation_result
        $implResult = $validated['implementation_result'] ?? $decision->implementation_result;
        if ($newStatus === 'completed' && empty($implResult)) {
            return response()->json([
                'message' => 'Penyelesaian keputusan (status completed) mewajibkan pencatatan hasil tindak lanjut.',
                'errors' => ['implementation_result' => ['Hasil tindak lanjut wajib dicatat saat menyelesaikan keputusan.']],
            ], 422);
        }

        // Enforcement: Cancelled decision requires cancellation_reason
        $cancelReason = $validated['cancellation_reason'] ?? $decision->cancellation_reason;
        if ($newStatus === 'cancelled' && empty($cancelReason)) {
            return response()->json([
                'message' => 'Pembatalan keputusan mewajibkan pencatatan alasan pembatalan.',
                'errors' => ['cancellation_reason' => ['Alasan pembatalan wajib diisi.']],
            ], 422);
        }

        $picName = $decision->pic_name;
        if (array_key_exists('pic_id', $validated)) {
            if ($validated['pic_id']) {
                $picUser = User::find($validated['pic_id']);
                $picName = $picUser ? $picUser->name : null;
            } else {
                $picName = null;
            }
        }

        $completedAt = $decision->completed_at;
        if ($newStatus === 'completed' && !$completedAt) {
            $completedAt = now();
        } elseif ($newStatus !== 'completed') {
            $completedAt = null;
        }

        // Record changes for audit trail
        $changes = [];
        if ($decision->status !== $newStatus) {
            $changes['status'] = ['from' => $decision->status, 'to' => $newStatus];
        }
        if (isset($validated['priority']) && $decision->priority !== $validated['priority']) {
            $changes['priority'] = ['from' => $decision->priority, 'to' => $validated['priority']];
        }
        if ($decision->pic_id !== $picId) {
            $changes['pic'] = ['from' => $decision->pic_name, 'to' => $picName];
        }
        if ($decision->due_date !== $dueDate) {
            $changes['due_date'] = ['from' => $decision->due_date, 'to' => $dueDate];
        }

        $decision->update([
            'title' => $validated['title'] ?? $decision->title,
            'description' => $validated['description'] ?? $decision->description,
            'category' => $validated['category'] ?? $decision->category,
            'project_id' => array_key_exists('project_id', $validated) ? $validated['project_id'] : $decision->project_id,
            'risk_id' => array_key_exists('risk_id', $validated) ? $validated['risk_id'] : $decision->risk_id,
            'underlying_problem' => array_key_exists('underlying_problem', $validated) ? $validated['underlying_problem'] : $decision->underlying_problem,
            'rationale' => array_key_exists('rationale', $validated) ? $validated['rationale'] : $decision->rationale,
            'priority' => $validated['priority'] ?? $decision->priority,
            'pic_id' => $picId,
            'pic_name' => $picName,
            'due_date' => $dueDate,
            'status' => $newStatus,
            'implementation_result' => $implResult,
            'cancellation_reason' => $cancelReason,
            'completed_at' => $completedAt,
        ]);

        // Audit Trail Entry
        ExecutiveDecisionAudit::create([
            'decision_id' => $decision->id,
            'user_id' => $user->id,
            'user_name' => $user->name,
            'action' => $newStatus !== $decision->getOriginal('status') ? $newStatus : 'updated',
            'notes' => $validated['audit_notes'] ?? ('Pembaruan keputusan status: ' . strtoupper($newStatus)),
            'changes' => !empty($changes) ? $changes : null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Data keputusan eksekutif berhasil diperbarui.',
            'decision' => $decision->fresh(['project:id,code,name', 'pic:id,name,email', 'risk:id,risk_code,title', 'audits.user:id,name']),
        ]);
    }

    /**
     * Modul H: Escalation Center
     * Gathers all critical operational matters requiring C-level executive intervention
     */
    public function escalationsIndex(Request $request)
    {
        $this->authorizeExecutive($request);
        $today = Carbon::today()->toDateString();
        $escalations = [];

        // 1. Critical & High Risks active
        $criticalRisks = StrategicRisk::with('project:id,code,name', 'owner:id,name')
            ->whereIn('risk_level', ['critical', 'high'])
            ->whereIn('status', ['open', 'mitigating', 'monitoring'])
            ->orderBy('risk_score', 'desc')
            ->get();

        foreach ($criticalRisks as $cr) {
            $daysOpen = Carbon::parse($cr->identified_date)->diffInDays(Carbon::parse($today));
            $escalations[] = [
                'id' => 'esc-risk-' . $cr->id,
                'source_type' => 'risk',
                'source_id' => $cr->id,
                'issue' => $cr->title,
                'project_code' => $cr->project ? $cr->project->code : null,
                'project_name' => $cr->project ? $cr->project->name : 'Operasional Perusahaan',
                'urgency' => $cr->risk_level, // 'critical' or 'high'
                'days_active' => (int) $daysOpen,
                'data_evidence' => "Skor risiko: {$cr->risk_score}/25 (Dampak: {$cr->impact}, Peluang: {$cr->likelihood}). Mitigasi: " . ($cr->mitigation ?? 'Belum ada rencana mitigasi'),
                'impact' => $cr->description ?? 'Dapat mengancam keberhasilan penyelesaian proyek strategis.',
                'action_recommendation' => 'Pimpinan perlu menetapkan keputusan mitigasi formal dan penanggung jawab tindak lanjut.',
                'link_route' => '/risk-center?tab=register&risk_id=' . $cr->id,
            ];
        }

        // 2. Overdue Executive Decisions (follow-up past due)
        $overdueDecisions = ExecutiveDecision::with('project:id,code,name', 'pic:id,name')
            ->whereIn('status', ['approved', 'in_progress'])
            ->whereNotNull('due_date')
            ->where('due_date', '<', $today)
            ->get();

        foreach ($overdueDecisions as $od) {
            $daysOverdue = Carbon::parse($od->due_date)->diffInDays(Carbon::parse($today));
            $escalations[] = [
                'id' => 'esc-dec-' . $od->id,
                'source_type' => 'decision',
                'source_id' => $od->id,
                'issue' => 'Tindak Lanjut Keputusan Melewati Tenggat: ' . $od->title,
                'project_code' => $od->project ? $od->project->code : null,
                'project_name' => $od->project ? $od->project->name : 'Inisiatif Strategis',
                'urgency' => 'critical',
                'days_active' => (int) $daysOverdue,
                'data_evidence' => "Batas waktu implementasi adalah {$od->due_date} (terlambat {$daysOverdue} hari). PIC: {$od->pic_name}.",
                'impact' => 'Keputusan pimpinan yang tertunda berisiko memperparah hambatan di lapangan.',
                'action_recommendation' => 'Pimpinan perlu meminta konfirmasi perkembangan langsung dari PIC ' . $od->pic_name . '.',
                'link_route' => '/risk-center?tab=decisions&decision_id=' . $od->id,
            ];
        }

        // 3. Active Blockers in Field older than 2 days
        $resolvedBlockerIds = BlockerResolution::where('status', 'resolved')->pluck('task_update_id');
        $agedBlockers = TaskUpdate::with('task.project', 'user')
            ->whereNotNull('blocker')
            ->where('blocker', '!=', '')
            ->whereNotIn('id', $resolvedBlockerIds)
            ->get()
            ->filter(function ($bu) use ($today) {
                return Carbon::parse($bu->created_at)->diffInDays(Carbon::parse($today)) >= 2;
            });

        foreach ($agedBlockers as $ab) {
            $daysOpen = Carbon::parse($ab->created_at)->diffInDays(Carbon::parse($today));
            $task = $ab->task;
            $proj = $task ? $task->project : null;

            $escalations[] = [
                'id' => 'esc-blk-' . $ab->id,
                'source_type' => 'blocker',
                'source_id' => $ab->id,
                'issue' => 'Kendala Lapangan Tertahan ' . $daysOpen . ' Hari: ' . ($task ? $task->title : 'Tugas #' . $ab->task_id),
                'project_code' => $proj ? $proj->code : null,
                'project_name' => $proj ? $proj->name : 'Operasional Lapangan',
                'urgency' => $daysOpen >= 4 ? 'critical' : 'high',
                'days_active' => (int) $daysOpen,
                'data_evidence' => "Blocker: \"{$ab->blocker}\". Dilaporkan oleh {$ab->user_name} pada " . Carbon::parse($ab->created_at)->format('d M Y'),
                'impact' => 'Pengerjaan tugas anggota tim terhenti dan belum tereliminasi dalam 48+ jam.',
                'action_recommendation' => 'Pimpinan dapat membuat keputusan eskalasi atau menugaskan PM mengeliminasi kendala.',
                'link_route' => '/risk-center?tab=blockers&update_id=' . $ab->id,
            ];
        }

        // Sort by urgency: critical first, then high
        $weight = ['critical' => 3, 'high' => 2, 'medium' => 1];
        usort($escalations, function ($a, $b) use ($weight) {
            return ($weight[$b['urgency']] ?? 0) <=> ($weight[$a['urgency']] ?? 0);
        });

        return response()->json([
            'success' => true,
            'total' => count($escalations),
            'escalations' => $escalations,
            'summary' => [
                'total_escalations' => count($escalations),
                'critical_risks_count' => $criticalRisks->count(),
                'overdue_decisions_count' => $overdueDecisions->count(),
                'aged_blockers_count' => $agedBlockers->count(),
            ],
        ]);
    }
}
