<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExecutiveAction;
use App\Services\ExecutiveActionService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ExecutiveActionController extends Controller
{
    public function __construct(
        protected ExecutiveActionService $actionService
    ) {}

    /**
     * Get KPI Summary of actions.
     */
    public function summary(Request $request)
    {
        $user = $request->user();
        if ($user->role === 'member') {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $summary = $this->actionService->getActionSummary($user);

        return response()->json([
            'success' => true,
            'summary' => $summary,
        ]);
    }

    /**
     * Get list of actions.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if ($user->role === 'member') {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $filters = $request->only([
            'status',
            'priority',
            'source_type',
            'assigned_to',
            'project_id',
            'search',
        ]);

        $actions = $this->actionService->getActions($filters, $user);

        return response()->json([
            'success' => true,
            'actions' => $actions,
        ]);
    }

    /**
     * Store new action.
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!in_array($user->role, ['admin', 'pimpinan'], true)) {
            return response()->json(['message' => 'Hanya Pimpinan dan Admin yang dapat membuat tindakan baru.'], 403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'source_type' => ['nullable', 'string', Rule::in(['business_intelligence', 'strategic_risk', 'executive_decision', 'financial_alert', 'strategic_initiative', 'manual'])],
            'source_id' => 'nullable|string',
            'source_title' => 'nullable|string|max:255',
            'strategic_risk_id' => 'nullable|exists:strategic_risks,id',
            'executive_decision_id' => 'nullable|exists:executive_decisions,id',
            'strategic_initiative_id' => 'nullable|exists:strategic_initiatives,id',
            'project_id' => 'nullable|exists:projects,id',
            'assigned_to' => 'nullable|exists:users,id',
            'priority' => ['required', Rule::in(['critical', 'high', 'medium', 'low'])],
            'status' => ['nullable', Rule::in(['pending', 'in_progress', 'blocked', 'completed', 'cancelled'])],
            'due_date' => 'nullable|date',
            'progress' => 'nullable|integer|min:0|max:100',
        ]);

        $action = $this->actionService->createAction($validated, $user);

        return response()->json([
            'success' => true,
            'message' => 'Tindakan eksekutif berhasil dibuat.',
            'action' => $action,
        ], 201);
    }

    /**
     * Create action from Business Intelligence insight.
     */
    public function createFromInsight(Request $request)
    {
        $user = $request->user();
        if (!in_array($user->role, ['admin', 'pimpinan'], true)) {
            return response()->json(['message' => 'Hanya Pimpinan dan Admin yang dapat membuat tindakan dari insight.'], 403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'summary' => 'nullable|string',
            'recommendation' => 'nullable|string',
            'id' => 'nullable|string',
            'source_id' => 'nullable|string',
            'source_title' => 'nullable|string',
            'priority' => ['nullable', Rule::in(['critical', 'high', 'medium', 'low'])],
            'assigned_to' => 'nullable|exists:users,id',
            'due_date' => 'nullable|date',
            'project_id' => 'nullable|exists:projects,id',
            'strategic_risk_id' => 'nullable|exists:strategic_risks,id',
            'strategic_initiative_id' => 'nullable|exists:strategic_initiatives,id',
        ]);

        $action = $this->actionService->createFromInsight($validated, $user);

        return response()->json([
            'success' => true,
            'message' => 'Tindakan eksekutif berhasil diterbitkan dari insight.',
            'action' => $action,
        ], 201);
    }

    /**
     * Show action detail with complete relationships and audit history.
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role === 'member') {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $action = ExecutiveAction::with([
            'assignedUser:id,name,email,role',
            'creator:id,name,role',
            'project:id,name,code,pic_id',
            'strategicRisk:id,risk_code,title,risk_level,mitigation',
            'executiveDecision:id,decision_number,title,rationale',
            'strategicInitiative:id,code,title,allocated_budget',
            'convertedTask:id,title,status,is_completed,deadline',
            'histories.actor:id,name,role',
        ])->findOrFail($id);

        // PM boundary check
        if ($user->role === 'project_manager') {
            $isAssigned = $action->assigned_to === $user->id;
            $isProjectPic = $action->project && $action->project->pic_id === $user->id;
            if (!$isAssigned && !$isProjectPic) {
                return response()->json(['message' => 'Anda tidak memiliki wewenang untuk melihat tindakan ini.'], 403);
            }
        }

        return response()->json([
            'success' => true,
            'action' => $action,
        ]);
    }

    /**
     * Update action.
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role === 'member') {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $action = ExecutiveAction::with('project')->findOrFail($id);

        // PM boundary check
        if ($user->role === 'project_manager') {
            $isAssigned = $action->assigned_to === $user->id;
            $isProjectPic = $action->project && $action->project->pic_id === $user->id;
            if (!$isAssigned && !$isProjectPic) {
                return response()->json(['message' => 'Anda hanya dapat memperbarui tindakan yang ditugaskan kepada Anda atau proyek Anda.'], 403);
            }

            // PM can only update status, progress, notes, additional_note
            $validated = $request->validate([
                'status' => ['nullable', Rule::in(['in_progress', 'blocked', 'completed'])],
                'progress' => 'nullable|integer|min:0|max:100',
                'completion_notes' => 'nullable|string',
                'additional_note' => 'nullable|string',
            ]);
        } else {
            // Admin & Pimpinan can update all aspects
            $validated = $request->validate([
                'title' => 'nullable|string|max:255',
                'description' => 'nullable|string',
                'priority' => ['nullable', Rule::in(['critical', 'high', 'medium', 'low'])],
                'status' => ['nullable', Rule::in(['pending', 'in_progress', 'blocked', 'completed', 'cancelled'])],
                'project_id' => 'nullable|exists:projects,id',
                'assigned_to' => 'nullable|exists:users,id',
                'due_date' => 'nullable|date',
                'progress' => 'nullable|integer|min:0|max:100',
                'completion_notes' => 'nullable|string',
                'additional_note' => 'nullable|string',
            ]);
        }

        $updated = $this->actionService->updateAction($action, $validated, $user);

        return response()->json([
            'success' => true,
            'message' => 'Tindakan eksekutif berhasil diperbarui.',
            'action' => $updated,
        ]);
    }

    /**
     * Cancel action with mandatory reason.
     */
    public function cancel(Request $request, $id)
    {
        $user = $request->user();
        if (!in_array($user->role, ['admin', 'pimpinan'], true)) {
            return response()->json(['message' => 'Hanya Pimpinan dan Admin yang dapat membatalkan tindakan.'], 403);
        }

        $request->validate([
            'reason' => 'required|string|min:5|max:1000',
        ]);

        $action = ExecutiveAction::findOrFail($id);
        $cancelled = $this->actionService->cancelAction($action, $request->input('reason'), $user);

        return response()->json([
            'success' => true,
            'message' => 'Tindakan eksekutif berhasil dibatalkan.',
            'action' => $cancelled,
        ]);
    }

    /**
     * Convert action to operational task.
     */
    public function convertToTask(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role === 'member') {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $action = ExecutiveAction::with('project')->findOrFail($id);

        // PM can only convert if assigned to them or their project
        if ($user->role === 'project_manager') {
            $isAssigned = $action->assigned_to === $user->id;
            $isProjectPic = $action->project && $action->project->pic_id === $user->id;
            if (!$isAssigned && !$isProjectPic) {
                return response()->json(['message' => 'Anda tidak memiliki wewenang untuk mengonversi tindakan ini.'], 403);
            }
        }

        $validated = $request->validate([
            'project_id' => 'nullable|exists:projects,id',
            'milestone_id' => 'nullable|exists:milestones,id',
            'title' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'priority' => ['nullable', Rule::in(['urgent', 'high', 'medium', 'low'])],
            'assignee_id' => 'nullable|exists:users,id',
            'deadline' => 'nullable|date',
        ]);

        $task = $this->actionService->convertToTask($action, $validated, $user);

        return response()->json([
            'success' => true,
            'message' => 'Tindakan berhasil dikonversi menjadi tugas operasional.',
            'task' => $task,
            'action' => $action->fresh(),
        ]);
    }
}