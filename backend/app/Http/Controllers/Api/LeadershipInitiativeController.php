<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\StrategicInitiative;
use App\Models\StrategicObjective;
use App\Models\StrategicResourceAllocation;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class LeadershipInitiativeController extends Controller
{
    /**
     * Strategic Initiatives KPI Overview
     */
    public function overview(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'pimpinan'], true)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $allInitiatives = StrategicInitiative::with(['resourceAllocations', 'projects'])->get();
        $totalCount = $allInitiatives->count();
        $activeCount = $allInitiatives->where('status', 'active')->count();
        $plannedCount = $allInitiatives->where('status', 'planned')->count();
        $completedCount = $allInitiatives->where('status', 'completed')->count();
        $onHoldCount = $allInitiatives->where('status', 'on_hold')->count();

        $totalAllocatedBudget = (float) $allInitiatives->sum('allocated_budget');
        $totalSpentBudget = (float) $allInitiatives->sum('spent_budget');
        $budgetUtilizationRate = $totalAllocatedBudget > 0
            ? round(($totalSpentBudget / $totalAllocatedBudget) * 100, 1)
            : 0.0;

        $averageProgress = $totalCount > 0
            ? round($allInitiatives->avg('progress'), 1)
            : 0.0;

        // Resource Allocation Statistics
        $allocations = StrategicResourceAllocation::all();
        $assignedUserIds = $allocations->pluck('user_id')->unique();
        $totalAllocatedStaff = $assignedUserIds->count();

        // Calculate member workload across initiatives
        $overloadedStaffCount = 0;
        $activeInitiativeIds = $allInitiatives->whereIn('status', ['active', 'planned'])->pluck('id');
        $activeAllocations = $allocations->whereIn('initiative_id', $activeInitiativeIds);
        $userTotalCapacity = $activeAllocations->groupBy('user_id')->map(fn($group) => $group->sum('allocation_percentage'));

        foreach ($userTotalCapacity as $userId => $capacity) {
            if ($capacity > 100) {
                $overloadedStaffCount++;
            }
        }

        // Linked projects
        $linkedProjectsCount = DB::table('strategic_initiative_projects')->distinct('project_id')->count('project_id');
        // Linked OKRs
        $linkedObjectivesCount = $allInitiatives->whereNotNull('objective_id')->pluck('objective_id')->unique()->count();

        return response()->json([
            'success' => true,
            'overview' => [
                'total_initiatives' => $totalCount,
                'active_initiatives' => $activeCount,
                'planned_initiatives' => $plannedCount,
                'completed_initiatives' => $completedCount,
                'on_hold_initiatives' => $onHoldCount,
                'average_progress' => $averageProgress,
                'total_allocated_budget' => $totalAllocatedBudget,
                'total_spent_budget' => $totalSpentBudget,
                'budget_utilization_rate' => $budgetUtilizationRate,
                'total_allocated_staff' => $totalAllocatedStaff,
                'overloaded_staff_count' => $overloadedStaffCount,
                'linked_projects_count' => $linkedProjectsCount,
                'linked_objectives_count' => $linkedObjectivesCount,
            ]
        ]);
    }

    /**
     * List Initiatives with Filters
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'pimpinan'], true)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $query = StrategicInitiative::with([
            'objective:id,title,category,priority,status',
            'lead:id,name,email,role',
            'creator:id,name',
            'resourceAllocations.user:id,name,email,role',
            'projects:id,code,name,status,progress'
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
            $term = '%' . trim($request->search) . '%';
            $query->where(function ($q) use ($term) {
                $q->where('title', 'like', $term)
                  ->orWhere('code', 'like', $term)
                  ->orWhere('description', 'like', $term);
            });
        }

        $initiatives = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'success' => true,
            'initiatives' => $initiatives,
        ]);
    }

    /**
     * Store New Strategic Initiative
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'pimpinan'], true)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'objective_id' => 'nullable|exists:strategic_objectives,id',
            'lead_id' => 'nullable|exists:users,id',
            'category' => 'required|string|max:60',
            'priority' => 'required|in:low,medium,high,critical',
            'status' => 'required|in:draft,planned,active,on_hold,completed,cancelled',
            'start_date' => 'nullable|date',
            'target_date' => 'nullable|date|after_or_equal:start_date',
            'progress' => 'nullable|numeric|min:0|max:100',
            'allocated_budget' => 'nullable|numeric|min:0',
            'spent_budget' => 'nullable|numeric|min:0',
            'strategic_rationale' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Data inisiatif strategis tidak valid.',
                'errors' => $validator->errors()
            ], 422);
        }

        // Generate sequential code (e.g. INIT-2026-001)
        $year = Carbon::now()->format('Y');
        $lastRecord = StrategicInitiative::where('code', 'like', "INIT-{$year}-%")->orderBy('id', 'desc')->first();
        $nextNum = 1;
        if ($lastRecord && preg_match("/INIT-{$year}-(\d+)/", $lastRecord->code, $matches)) {
            $nextNum = ((int) $matches[1]) + 1;
        }
        $code = sprintf("INIT-%s-%03d", $year, $nextNum);

        $initiative = StrategicInitiative::create([
            'code' => $code,
            'title' => $request->title,
            'description' => $request->description,
            'objective_id' => $request->objective_id,
            'lead_id' => $request->lead_id,
            'category' => $request->category,
            'priority' => $request->priority,
            'status' => $request->status,
            'start_date' => $request->start_date,
            'target_date' => $request->target_date,
            'progress' => $request->progress ?? 0.00,
            'allocated_budget' => $request->allocated_budget ?? 0.00,
            'spent_budget' => $request->spent_budget ?? 0.00,
            'strategic_rationale' => $request->strategic_rationale,
            'created_by' => $user->id,
        ]);

        $initiative->load([
            'objective:id,title,category,priority,status',
            'lead:id,name,email,role',
            'creator:id,name',
            'resourceAllocations.user:id,name,email,role',
            'projects:id,code,name,status,progress'
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Inisiatif strategis berhasil dibuat.',
            'initiative' => $initiative,
        ], 201);
    }

    /**
     * Show Initiative Details
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'pimpinan'], true)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $initiative = StrategicInitiative::with([
            'objective:id,title,description,category,priority,status',
            'lead:id,name,email,role',
            'creator:id,name',
            'resourceAllocations.user:id,name,email,role',
            'projects:id,code,name,status,progress,deadline'
        ])->find($id);

        if (!$initiative) {
            return response()->json(['message' => 'Inisiatif strategis tidak ditemukan.'], 404);
        }

        return response()->json([
            'success' => true,
            'initiative' => $initiative,
        ]);
    }

    /**
     * Update Strategic Initiative
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'pimpinan'], true)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $initiative = StrategicInitiative::find($id);
        if (!$initiative) {
            return response()->json(['message' => 'Inisiatif strategis tidak ditemukan.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'objective_id' => 'nullable|exists:strategic_objectives,id',
            'lead_id' => 'nullable|exists:users,id',
            'category' => 'sometimes|required|string|max:60',
            'priority' => 'sometimes|required|in:low,medium,high,critical',
            'status' => 'sometimes|required|in:draft,planned,active,on_hold,completed,cancelled',
            'start_date' => 'nullable|date',
            'target_date' => 'nullable|date',
            'progress' => 'nullable|numeric|min:0|max:100',
            'allocated_budget' => 'nullable|numeric|min:0',
            'spent_budget' => 'nullable|numeric|min:0',
            'strategic_rationale' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Data pembaruan inisiatif strategis tidak valid.',
                'errors' => $validator->errors()
            ], 422);
        }

        $initiative->update($request->only([
            'title',
            'description',
            'objective_id',
            'lead_id',
            'category',
            'priority',
            'status',
            'start_date',
            'target_date',
            'progress',
            'allocated_budget',
            'spent_budget',
            'strategic_rationale',
        ]));

        $initiative->load([
            'objective:id,title,category,priority,status',
            'lead:id,name,email,role',
            'creator:id,name',
            'resourceAllocations.user:id,name,email,role',
            'projects:id,code,name,status,progress'
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Inisiatif strategis berhasil diperbarui.',
            'initiative' => $initiative,
        ]);
    }

    /**
     * Delete Strategic Initiative
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'pimpinan'], true)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $initiative = StrategicInitiative::find($id);
        if (!$initiative) {
            return response()->json(['message' => 'Inisiatif strategis tidak ditemukan.'], 404);
        }

        $initiative->delete();

        return response()->json([
            'success' => true,
            'message' => 'Inisiatif strategis berhasil dihapus.',
        ]);
    }

    /**
     * Allocate Resource (Team Member) to Initiative
     */
    public function allocateResource(Request $request, $id)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'pimpinan'], true)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $initiative = StrategicInitiative::find($id);
        if (!$initiative) {
            return response()->json(['message' => 'Inisiatif strategis tidak ditemukan.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'role_in_initiative' => 'required|string|max:100',
            'allocation_percentage' => 'required|integer|min:5|max:100',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Data alokasi sumber daya tidak valid.',
                'errors' => $validator->errors()
            ], 422);
        }

        // Check if user is already assigned to this initiative
        $existing = StrategicResourceAllocation::where('initiative_id', $id)
            ->where('user_id', $request->user_id)
            ->first();

        if ($existing) {
            $existing->update([
                'role_in_initiative' => $request->role_in_initiative,
                'allocation_percentage' => $request->allocation_percentage,
                'start_date' => $request->start_date,
                'end_date' => $request->end_date,
                'notes' => $request->notes,
            ]);
            $allocation = $existing;
        } else {
            $allocation = StrategicResourceAllocation::create([
                'initiative_id' => $id,
                'user_id' => $request->user_id,
                'role_in_initiative' => $request->role_in_initiative,
                'allocation_percentage' => $request->allocation_percentage,
                'start_date' => $request->start_date,
                'end_date' => $request->end_date,
                'notes' => $request->notes,
            ]);
        }

        $allocation->load('user:id,name,email,role');

        return response()->json([
            'success' => true,
            'message' => 'Alokasi sumber daya berhasil disimpan.',
            'allocation' => $allocation,
        ]);
    }

    /**
     * Remove Resource from Initiative
     */
    public function removeResource(Request $request, $id, $userId)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'pimpinan'], true)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $deleted = StrategicResourceAllocation::where('initiative_id', $id)
            ->where('user_id', $userId)
            ->delete();

        if (!$deleted) {
            return response()->json(['message' => 'Alokasi sumber daya tidak ditemukan.'], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Alokasi sumber daya berhasil dihapus.',
        ]);
    }

    /**
     * Link Project to Initiative
     */
    public function linkProject(Request $request, $id)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'pimpinan'], true)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $initiative = StrategicInitiative::find($id);
        if (!$initiative) {
            return response()->json(['message' => 'Inisiatif strategis tidak ditemukan.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'project_id' => 'required|exists:projects,id',
            'impact_description' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Data tautan proyek tidak valid.',
                'errors' => $validator->errors()
            ], 422);
        }

        $exists = DB::table('strategic_initiative_projects')
            ->where('initiative_id', $id)
            ->where('project_id', $request->project_id)
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'Proyek sudah terhubung dengan inisiatif strategis ini.',
            ], 422);
        }

        DB::table('strategic_initiative_projects')->insert([
            'initiative_id' => $id,
            'project_id' => $request->project_id,
            'impact_description' => $request->impact_description,
            'created_at' => Carbon::now(),
            'updated_at' => Carbon::now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Proyek berhasil dihubungkan dengan inisiatif strategis.',
        ]);
    }

    /**
     * Unlink Project from Initiative
     */
    public function unlinkProject(Request $request, $id, $projectId)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'pimpinan'], true)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $deleted = DB::table('strategic_initiative_projects')
            ->where('initiative_id', $id)
            ->where('project_id', $projectId)
            ->delete();

        if (!$deleted) {
            return response()->json(['message' => 'Hubungan proyek tidak ditemukan.'], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Hubungan proyek berhasil dilepaskan.',
        ]);
    }

    /**
     * Resource Capacity & Workload Analysis
     */
    public function resourceCapacity(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'pimpinan'], true)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        // Get all members & PMs
        $users = User::whereIn('role', ['member', 'project_manager'])
            ->where('is_active', true)
            ->select('id', 'name', 'email', 'role')
            ->get();

        $activeInitiatives = StrategicInitiative::whereIn('status', ['active', 'planned'])
            ->with(['resourceAllocations'])
            ->get();

        $allocations = StrategicResourceAllocation::with('initiative:id,code,title,status,priority')
            ->whereIn('initiative_id', $activeInitiatives->pluck('id'))
            ->get();

        $capacityList = [];
        foreach ($users as $u) {
            $userAllocations = $allocations->where('user_id', $u->id);
            $totalAllocation = $userAllocations->sum('allocation_percentage');

            $status = 'available'; // available, ideal, overloaded
            if ($totalAllocation > 100) {
                $status = 'overloaded';
            } elseif ($totalAllocation >= 70) {
                $status = 'ideal';
            } elseif ($totalAllocation > 0) {
                $status = 'partial';
            }

            $capacityList[] = [
                'user_id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role,
                'total_allocation_percentage' => (int) $totalAllocation,
                'status' => $status,
                'initiatives_count' => $userAllocations->count(),
                'allocations' => $userAllocations->map(fn($a) => [
                    'id' => $a->id,
                    'initiative_id' => $a->initiative_id,
                    'initiative_code' => $a->initiative?->code,
                    'initiative_title' => $a->initiative?->title,
                    'role_in_initiative' => $a->role_in_initiative,
                    'percentage' => $a->allocation_percentage,
                ])->values(),
            ];
        }

        return response()->json([
            'success' => true,
            'capacity' => $capacityList,
        ]);
    }
}
