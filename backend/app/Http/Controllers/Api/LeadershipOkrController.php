<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\StrategicKeyResult;
use App\Models\StrategicKeyResultCheckin;
use App\Models\StrategicObjective;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class LeadershipOkrController extends Controller
{
    /**
     * Helper to verify executive role authorization (Admin and Pimpinan)
     */
    protected function authorizeExecutive(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'pimpinan'], true)) {
            abort(response()->json([
                'message' => 'Akses ditolak. Fitur Strategic Objectives & OKR Management hanya dapat dikelola oleh Pimpinan dan Administrator.',
            ], 403));
        }
        return $user;
    }

    /**
     * GET /api/leadership/okr/overview
     * High-level Strategic Performance Dashboard metrics
     */
    public function overview(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'pimpinan', 'project_manager'], true)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $allObjectives = StrategicObjective::with('keyResults')->get();
        $totalObjectives = $allObjectives->count();
        $activeObjectives = $allObjectives->where('status', 'active');
        $achievedObjectives = $allObjectives->where('status', 'achieved');
        $atRiskObjectives = $allObjectives->where('status', 'at_risk');
        $notAchievedObjectives = $allObjectives->where('status', 'not_achieved');
        $draftObjectives = $allObjectives->where('status', 'draft');
        $archivedObjectives = $allObjectives->where('status', 'archived');

        // Aggregated average progress across all active + at_risk + achieved objectives
        $monitoredObjectives = $allObjectives->whereIn('status', ['active', 'at_risk', 'achieved', 'not_achieved']);
        $avgProgress = $monitoredObjectives->count() > 0
            ? round($monitoredObjectives->avg(fn($o) => $o->aggregated_progress), 1)
            : 0.0;

        // Key results breakdown
        $allKrs = StrategicKeyResult::all();
        $totalKrs = $allKrs->count();
        $krsOnTrack = $allKrs->where('status', 'on_track')->count();
        $krsBehind = $allKrs->where('status', 'behind')->count();
        $krsAtRisk = $allKrs->where('status', 'at_risk')->count();
        $krsAchieved = $allKrs->where('status', 'achieved')->count();

        // Objectives without supporting projects
        $objectivesWithoutProjects = StrategicObjective::whereDoesntHave('projects')
            ->whereNotIn('status', ['archived'])
            ->count();

        return response()->json([
            'success' => true,
            'summary' => [
                'total_objectives' => $totalObjectives,
                'active_count' => $activeObjectives->count(),
                'achieved_count' => $achievedObjectives->count(),
                'at_risk_count' => $atRiskObjectives->count(),
                'not_achieved_count' => $notAchievedObjectives->count(),
                'draft_count' => $draftObjectives->count(),
                'archived_count' => $archivedObjectives->count(),
                'avg_progress' => $avgProgress,
                'total_key_results' => $totalKrs,
                'krs_on_track' => $krsOnTrack,
                'krs_behind' => $krsBehind,
                'krs_at_risk' => $krsAtRisk,
                'krs_achieved' => $krsAchieved,
                'objectives_without_projects' => $objectivesWithoutProjects,
            ],
        ]);
    }

    /**
     * GET /api/leadership/okr/objectives
     * List all strategic objectives with relations and filters
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'pimpinan', 'project_manager'], true)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $query = StrategicObjective::with([
            'owner:id,name,role',
            'creator:id,name,role',
            'keyResults.owner:id,name,role',
            'projects:id,code,name,status,progress',
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

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($w) use ($s) {
                $w->where('title', 'like', "%{$s}%")
                  ->orWhere('description', 'like', "%{$s}%")
                  ->orWhere('category', 'like', "%{$s}%");
            });
        }

        $objectives = $query->orderBy('period_end', 'asc')
            ->orderBy('id', 'desc')
            ->get();

        // Append computed aggregated_progress on response
        $objectives->each(function ($obj) {
            $obj->aggregated_progress = $obj->aggregated_progress;
        });

        return response()->json([
            'success' => true,
            'total' => $objectives->count(),
            'objectives' => $objectives,
        ]);
    }

    /**
     * POST /api/leadership/okr/objectives
     * Create a new Strategic Objective
     */
    public function store(Request $request)
    {
        $user = $this->authorizeExecutive($request);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category' => ['required', 'string', 'max:60'],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start'],
            'owner_id' => ['nullable', 'exists:users,id'],
            'priority' => ['required', 'string', Rule::in(['low', 'medium', 'high', 'critical'])],
            'status' => ['required', 'string', Rule::in(['draft', 'active', 'at_risk', 'achieved', 'not_achieved', 'archived'])],
            'project_ids' => ['nullable', 'array'],
            'project_ids.*' => ['exists:projects,id'],
        ], [
            'title.required' => 'Judul sasaran strategis (Objective) wajib diisi.',
            'category.required' => 'Kategori sasaran strategis wajib dipilih.',
            'period_start.required' => 'Tanggal awal periode sasaran wajib ditentukan.',
            'period_end.required' => 'Tanggal akhir target sasaran wajib ditentukan.',
            'period_end.after_or_equal' => 'Tanggal akhir periode tidak boleh lebih awal dari tanggal mulai.',
        ]);

        return DB::transaction(function () use ($validated, $user) {
            $objective = StrategicObjective::create([
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'category' => $validated['category'],
                'period_start' => $validated['period_start'],
                'period_end' => $validated['period_end'],
                'owner_id' => $validated['owner_id'] ?? null,
                'priority' => $validated['priority'],
                'status' => $validated['status'],
                'created_by' => $user->id,
            ]);

            if (!empty($validated['project_ids'])) {
                $objective->projects()->sync($validated['project_ids']);
            }

            $objective->load(['owner:id,name,role', 'projects:id,code,name,status,progress', 'keyResults']);
            $objective->aggregated_progress = $objective->aggregated_progress;

            return response()->json([
                'success' => true,
                'message' => 'Sasaran strategis berhasil dibuat.',
                'objective' => $objective,
            ], 201);
        });
    }

    /**
     * GET /api/leadership/okr/objectives/{id}
     * Get single Strategic Objective detail with checkins
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'pimpinan', 'project_manager'], true)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $objective = StrategicObjective::with([
            'owner:id,name,role',
            'creator:id,name,role',
            'keyResults' => function ($q) {
                $q->with([
                    'owner:id,name,role',
                    'checkins.user:id,name,role',
                ]);
            },
            'projects:id,code,name,status,progress,pic_id',
        ])->find($id);

        if (!$objective) {
            return response()->json(['message' => 'Sasaran strategis tidak ditemukan.'], 404);
        }

        $objective->aggregated_progress = $objective->aggregated_progress;

        return response()->json([
            'success' => true,
            'objective' => $objective,
        ]);
    }

    /**
     * PUT /api/leadership/okr/objectives/{id}
     * Update Strategic Objective
     */
    public function update(Request $request, $id)
    {
        $this->authorizeExecutive($request);

        $objective = StrategicObjective::find($id);
        if (!$objective) {
            return response()->json(['message' => 'Sasaran strategis tidak ditemukan.'], 404);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category' => ['sometimes', 'required', 'string', 'max:60'],
            'period_start' => ['sometimes', 'required', 'date'],
            'period_end' => ['sometimes', 'required', 'date', 'after_or_equal:period_start'],
            'owner_id' => ['nullable', 'exists:users,id'],
            'priority' => ['sometimes', 'required', 'string', Rule::in(['low', 'medium', 'high', 'critical'])],
            'status' => ['sometimes', 'required', 'string', Rule::in(['draft', 'active', 'at_risk', 'achieved', 'not_achieved', 'archived'])],
            'project_ids' => ['nullable', 'array'],
            'project_ids.*' => ['exists:projects,id'],
        ]);

        return DB::transaction(function () use ($objective, $validated) {
            $objective->update($validated);

            if (array_key_exists('project_ids', $validated)) {
                $objective->projects()->sync($validated['project_ids'] ?? []);
            }

            $objective->load(['owner:id,name,role', 'projects:id,code,name,status,progress', 'keyResults']);
            $objective->aggregated_progress = $objective->aggregated_progress;

            return response()->json([
                'success' => true,
                'message' => 'Sasaran strategis berhasil diperbarui.',
                'objective' => $objective,
            ]);
        });
    }

    /**
     * DELETE /api/leadership/okr/objectives/{id}
     * Archive or delete Objective
     */
    public function destroy(Request $request, $id)
    {
        $this->authorizeExecutive($request);

        $objective = StrategicObjective::find($id);
        if (!$objective) {
            return response()->json(['message' => 'Sasaran strategis tidak ditemukan.'], 404);
        }

        // If objective has check-ins on its KRs, default to archived instead of hard delete to preserve historical integrity
        $hasCheckins = StrategicKeyResultCheckin::whereIn('key_result_id', $objective->keyResults()->pluck('id'))->exists();
        if ($hasCheckins && $request->input('force') !== true) {
            $objective->status = 'archived';
            $objective->save();

            return response()->json([
                'success' => true,
                'message' => 'Sasaran strategis memiliki rekam jejak progres historis dan telah diarsipkan.',
                'archived' => true,
            ]);
        }

        $objective->delete();

        return response()->json([
            'success' => true,
            'message' => 'Sasaran strategis berhasil dihapus.',
        ]);
    }

    /**
     * POST /api/leadership/okr/objectives/{id}/projects
     * Link project to Objective
     */
    public function linkProject(Request $request, $id)
    {
        $this->authorizeExecutive($request);

        $objective = StrategicObjective::find($id);
        if (!$objective) {
            return response()->json(['message' => 'Sasaran strategis tidak ditemukan.'], 404);
        }

        $validated = $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'contribution_notes' => ['nullable', 'string', 'max:500'],
        ]);

        // Prevent duplicate relationship
        if ($objective->projects()->where('project_id', $validated['project_id'])->exists()) {
            return response()->json([
                'message' => 'Proyek ini sudah terhubung dengan sasaran strategis terkait.',
            ], 422);
        }

        $objective->projects()->attach($validated['project_id'], [
            'contribution_notes' => $validated['contribution_notes'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Proyek berhasil dihubungkan dengan sasaran strategis.',
            'projects' => $objective->projects()->select('projects.id', 'projects.code', 'projects.name', 'projects.status', 'projects.progress')->get(),
        ]);
    }

    /**
     * DELETE /api/leadership/okr/objectives/{id}/projects/{projectId}
     * Unlink project from Objective
     */
    public function unlinkProject(Request $request, $id, $projectId)
    {
        $this->authorizeExecutive($request);

        $objective = StrategicObjective::find($id);
        if (!$objective) {
            return response()->json(['message' => 'Sasaran strategis tidak ditemukan.'], 404);
        }

        $objective->projects()->detach($projectId);

        return response()->json([
            'success' => true,
            'message' => 'Hubungan proyek dengan sasaran strategis berhasil dilepaskan.',
            'projects' => $objective->projects()->select('projects.id', 'projects.code', 'projects.name', 'projects.status', 'projects.progress')->get(),
        ]);
    }

    /**
     * POST /api/leadership/okr/objectives/{id}/key-results
     * Create Key Result under Objective
     */
    public function storeKeyResult(Request $request, $id)
    {
        $this->authorizeExecutive($request);

        $objective = StrategicObjective::find($id);
        if (!$objective) {
            return response()->json(['message' => 'Sasaran strategis tidak ditemukan.'], 404);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'metric_type' => ['required', 'string', Rule::in(['numeric_increase', 'numeric_decrease', 'boolean', 'milestone_based'])],
            'unit' => ['nullable', 'string', 'max:50'],
            'baseline_value' => ['required', 'numeric'],
            'target_value' => ['required', 'numeric'],
            'current_value' => ['nullable', 'numeric'],
            'weight' => ['required', 'numeric', 'min:0.1', 'max:100'],
            'source_type' => ['nullable', 'string', 'max:50'],
            'source_reference' => ['nullable', 'string', 'max:255'],
            'owner_id' => ['nullable', 'exists:users,id'],
            'deadline' => ['nullable', 'date'],
            'status' => ['nullable', 'string', Rule::in(['on_track', 'behind', 'at_risk', 'achieved'])],
        ]);

        $initialCurrent = $validated['current_value'] ?? $validated['baseline_value'];

        $kr = new StrategicKeyResult();
        $kr->objective_id = $objective->id;
        $kr->title = $validated['title'];
        $kr->description = $validated['description'] ?? null;
        $kr->metric_type = $validated['metric_type'];
        $kr->unit = $validated['unit'] ?? null;
        $kr->baseline_value = $validated['baseline_value'];
        $kr->target_value = $validated['target_value'];
        $kr->current_value = $initialCurrent;
        $kr->weight = $validated['weight'] ?? 1.0;
        $kr->source_type = $validated['source_type'] ?? 'manual_checkin';
        $kr->source_reference = $validated['source_reference'] ?? null;
        $kr->owner_id = $validated['owner_id'] ?? null;
        $kr->deadline = $validated['deadline'] ?? null;
        $kr->status = $validated['status'] ?? 'on_track';
        $kr->progress = $kr->computeProgress();
        $kr->save();

        return response()->json([
            'success' => true,
            'message' => 'Key Result berhasil ditambahkan.',
            'key_result' => $kr->load(['owner:id,name,role']),
        ], 201);
    }

    /**
     * PUT /api/leadership/okr/key-results/{id}
     * Update Key Result metadata/configuration
     */
    public function updateKeyResult(Request $request, $id)
    {
        $this->authorizeExecutive($request);

        $kr = StrategicKeyResult::find($id);
        if (!$kr) {
            return response()->json(['message' => 'Key Result tidak ditemukan.'], 404);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'metric_type' => ['sometimes', 'required', 'string', Rule::in(['numeric_increase', 'numeric_decrease', 'boolean', 'milestone_based'])],
            'unit' => ['nullable', 'string', 'max:50'],
            'baseline_value' => ['sometimes', 'required', 'numeric'],
            'target_value' => ['sometimes', 'required', 'numeric'],
            'weight' => ['sometimes', 'required', 'numeric', 'min:0.1', 'max:100'],
            'source_type' => ['nullable', 'string', 'max:50'],
            'source_reference' => ['nullable', 'string', 'max:255'],
            'owner_id' => ['nullable', 'exists:users,id'],
            'deadline' => ['nullable', 'date'],
            'status' => ['nullable', 'string', Rule::in(['on_track', 'behind', 'at_risk', 'achieved'])],
        ]);

        $kr->update($validated);
        $kr->progress = $kr->computeProgress();
        $kr->save();

        return response()->json([
            'success' => true,
            'message' => 'Key Result berhasil diperbarui.',
            'key_result' => $kr->load(['owner:id,name,role']),
        ]);
    }

    /**
     * DELETE /api/leadership/okr/key-results/{id}
     * Remove Key Result
     */
    public function destroyKeyResult(Request $request, $id)
    {
        $this->authorizeExecutive($request);

        $kr = StrategicKeyResult::find($id);
        if (!$kr) {
            return response()->json(['message' => 'Key Result tidak ditemukan.'], 404);
        }

        $kr->delete();

        return response()->json([
            'success' => true,
            'message' => 'Key Result berhasil dihapus.',
        ]);
    }

    /**
     * POST /api/leadership/okr/key-results/{id}/checkin
     * Progress Update & Check-in with Immutable Audit Log
     */
    public function checkinKeyResult(Request $request, $id)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'pimpinan', 'project_manager'], true)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $kr = StrategicKeyResult::with('objective')->find($id);
        if (!$kr) {
            return response()->json(['message' => 'Key Result tidak ditemukan.'], 404);
        }

        // Project Manager authorization check: PM can only check-in if assigned as owner
        if ($user->role === 'project_manager' && $kr->owner_id !== $user->id) {
            return response()->json([
                'message' => 'Sebagai Project Manager, Anda hanya diizinkan melakukan pembaruan pada Key Result yang ditugaskan kepada Anda.',
            ], 403);
        }

        $validated = $request->validate([
            'new_value' => ['required', 'numeric'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'evidence_reference' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', Rule::in(['on_track', 'behind', 'at_risk', 'achieved'])],
        ], [
            'new_value.required' => 'Nilai realisasi terkini (new value) wajib diisi.',
            'new_value.numeric' => 'Nilai realisasi harus berupa angka valid.',
        ]);

        return DB::transaction(function () use ($kr, $validated, $user) {
            $previousValue = (float) $kr->current_value;
            $newValue = (float) $validated['new_value'];

            // Update current value
            $kr->current_value = $newValue;
            $progressSnapshot = $kr->computeProgress();
            $kr->progress = $progressSnapshot;

            if (!empty($validated['status'])) {
                $kr->status = $validated['status'];
            } elseif ($progressSnapshot >= 100.0) {
                $kr->status = 'achieved';
            } elseif ($progressSnapshot < 40.0) {
                $kr->status = 'behind';
            } else {
                $kr->status = 'on_track';
            }
            $kr->save();

            // Record immutable check-in log
            $checkin = StrategicKeyResultCheckin::create([
                'key_result_id' => $kr->id,
                'previous_value' => $previousValue,
                'new_value' => $newValue,
                'progress_snapshot' => $progressSnapshot,
                'notes' => $validated['notes'] ?? null,
                'evidence_reference' => $validated['evidence_reference'] ?? null,
                'updated_by' => $user->id,
            ]);

            // Recompute parent objective status if all KRs are achieved
            $objective = $kr->objective;
            if ($objective) {
                $objective->load('keyResults');
                $aggProgress = $objective->aggregated_progress;

                if ($aggProgress >= 100.0) {
                    $objective->status = 'achieved';
                    $objective->save();
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Check-in progres Key Result berhasil dicatat.',
                'key_result' => $kr->fresh(['owner:id,name,role', 'checkins.user:id,name,role']),
                'checkin' => $checkin->load('user:id,name,role'),
                'objective_progress' => $objective ? $objective->aggregated_progress : null,
            ]);
        });
    }
}
