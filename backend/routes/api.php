<?php

use App\Http\Controllers\Api\AiAnalystController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExecutiveActionController;
use App\Http\Controllers\Api\FinancialController;
use App\Http\Controllers\Api\LeadershipAIController;
use App\Http\Controllers\Api\LeadershipController;
use App\Http\Controllers\Api\LeadershipInitiativeController;
use App\Http\Controllers\Api\LeadershipOkrController;
use App\Http\Controllers\Api\LeadershipReportController;
use App\Http\Controllers\Api\LeadershipRiskController;
use App\Http\Controllers\Api\MemberLearningController;
use App\Http\Controllers\Api\MemberNotificationController;
use App\Http\Controllers\Api\MemberPerformanceController;
use App\Http\Controllers\Api\MemberWorkspaceController;
use App\Http\Controllers\Api\MilestoneController;
use App\Http\Controllers\Api\PmWorkspaceController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\TaskChecklistController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\TaskReviewController;
use App\Http\Controllers\Api\TaskUpdateController;
use App\Http\Controllers\Api\UserController;
use App\Models\Activity;
use Illuminate\Support\Facades\Route;

// Public routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth & Profile
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me', [UserController::class, 'updateProfile']);

    // Dashboard & Business Analytics
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/search', [DashboardController::class, 'search']);

    // Executive Command Center & Strategic Portfolio (Restricted to pimpinan and admin)
    Route::middleware('role:admin,pimpinan')->group(function () {
        Route::get('/leadership/command-center', [LeadershipController::class, 'commandCenter']);
        Route::get('/leadership/portfolio', [LeadershipController::class, 'portfolio']);
        Route::get('/leadership/portfolio/{id}', [LeadershipController::class, 'portfolioDetail']);
        Route::get('/leadership/performance', [LeadershipController::class, 'performance']);
        Route::get('/leadership/intelligence', [LeadershipController::class, 'intelligence']);

        // Tahap P-E: Risk & Decision Center
        Route::get('/leadership/risk-overview', [LeadershipRiskController::class, 'overview']);
        Route::get('/leadership/risks', [LeadershipRiskController::class, 'risksIndex']);
        Route::post('/leadership/risks', [LeadershipRiskController::class, 'risksStore']);
        Route::get('/leadership/risks/{id}', [LeadershipRiskController::class, 'risksShow']);
        Route::put('/leadership/risks/{id}', [LeadershipRiskController::class, 'risksUpdate']);
        Route::get('/leadership/automatic-risks', [LeadershipRiskController::class, 'automaticRisks']);
        Route::get('/leadership/blockers', [LeadershipRiskController::class, 'blockersIndex']);
        Route::put('/leadership/blockers/{id}/status', [LeadershipRiskController::class, 'blockersUpdateStatus']);
        Route::get('/leadership/decisions', [LeadershipRiskController::class, 'decisionsIndex']);
        Route::post('/leadership/decisions', [LeadershipRiskController::class, 'decisionsStore']);
        Route::get('/leadership/decisions/{id}', [LeadershipRiskController::class, 'decisionsShow']);
        Route::put('/leadership/decisions/{id}', [LeadershipRiskController::class, 'decisionsUpdate']);
        Route::get('/leadership/escalations', [LeadershipRiskController::class, 'escalationsIndex']);

        // Tahap P-F: AI Executive Advisor
        Route::get('/leadership/ai/context', [LeadershipAIController::class, 'context']);
        Route::get('/leadership/ai/insights', [LeadershipAIController::class, 'insights']);
        Route::post('/leadership/ai/chat', [LeadershipAIController::class, 'chat']);
        Route::post('/leadership/ai/analyze-project/{id}', [LeadershipAIController::class, 'analyzeProject']);
        Route::get('/leadership/ai/conversations', [LeadershipAIController::class, 'conversationsIndex']);
        Route::post('/leadership/ai/conversations', [LeadershipAIController::class, 'conversationsStore']);
        Route::get('/leadership/ai/conversations/{id}', [LeadershipAIController::class, 'conversationsShow']);
        Route::delete('/leadership/ai/conversations/{id}', [LeadershipAIController::class, 'conversationsDestroy']);

        // Tahap P-G: Executive Reports & Strategic Decision Follow-up
        Route::get('/leadership/executive-reports', [LeadershipReportController::class, 'index']);
        Route::post('/leadership/executive-reports', [LeadershipReportController::class, 'store']);
        Route::get('/leadership/executive-reports/{id}', [LeadershipReportController::class, 'show']);
        Route::put('/leadership/executive-reports/{id}', [LeadershipReportController::class, 'update']);
        Route::delete('/leadership/executive-reports/{id}', [LeadershipReportController::class, 'destroy']);
        Route::post('/leadership/executive-reports/{id}/publish', [LeadershipReportController::class, 'publish']);
        Route::get('/leadership/executive-reports/{id}/export', [LeadershipReportController::class, 'export']);
        Route::get('/leadership/decision-followup', [LeadershipReportController::class, 'decisionFollowup']);

        // Tahap P-H: Strategic Objectives & OKR Management
        Route::get('/leadership/okr/overview', [LeadershipOkrController::class, 'overview']);
        Route::get('/leadership/okr/objectives', [LeadershipOkrController::class, 'index']);
        Route::post('/leadership/okr/objectives', [LeadershipOkrController::class, 'store']);
        Route::get('/leadership/okr/objectives/{id}', [LeadershipOkrController::class, 'show']);
        Route::put('/leadership/okr/objectives/{id}', [LeadershipOkrController::class, 'update']);
        Route::delete('/leadership/okr/objectives/{id}', [LeadershipOkrController::class, 'destroy']);
        Route::post('/leadership/okr/objectives/{id}/projects', [LeadershipOkrController::class, 'linkProject']);
        Route::delete('/leadership/okr/objectives/{id}/projects/{projectId}', [LeadershipOkrController::class, 'unlinkProject']);
        Route::post('/leadership/okr/objectives/{id}/key-results', [LeadershipOkrController::class, 'storeKeyResult']);
        Route::put('/leadership/okr/key-results/{id}', [LeadershipOkrController::class, 'updateKeyResult']);
        Route::delete('/leadership/okr/key-results/{id}', [LeadershipOkrController::class, 'destroyKeyResult']);
        Route::post('/leadership/okr/key-results/{id}/checkin', [LeadershipOkrController::class, 'checkinKeyResult']);

        // Tahap P-I: Strategic Initiatives & Resource Allocation
        Route::get('/leadership/initiatives/overview', [LeadershipInitiativeController::class, 'overview']);
        Route::get('/leadership/initiatives', [LeadershipInitiativeController::class, 'index']);
        Route::post('/leadership/initiatives', [LeadershipInitiativeController::class, 'store']);
        Route::get('/leadership/initiatives/resource-capacity', [LeadershipInitiativeController::class, 'resourceCapacity']);
        Route::get('/leadership/initiatives/{id}', [LeadershipInitiativeController::class, 'show']);
        Route::put('/leadership/initiatives/{id}', [LeadershipInitiativeController::class, 'update']);
        Route::delete('/leadership/initiatives/{id}', [LeadershipInitiativeController::class, 'destroy']);
        Route::post('/leadership/initiatives/{id}/resources', [LeadershipInitiativeController::class, 'allocateResource']);
        Route::delete('/leadership/initiatives/{id}/resources/{userId}', [LeadershipInitiativeController::class, 'removeResource']);
        Route::post('/leadership/initiatives/{id}/projects', [LeadershipInitiativeController::class, 'linkProject']);
        Route::delete('/leadership/initiatives/{id}/projects/{projectId}', [LeadershipInitiativeController::class, 'unlinkProject']);

        // Tahap P-J & P-K: Financial Performance, Intelligence & Alert Center
        Route::get('/financial/dashboard', [FinancialController::class, 'dashboard']);
        Route::get('/financial/budgets', [FinancialController::class, 'budgetIndex']);
        Route::post('/financial/budgets', [FinancialController::class, 'budgetStore']);
        Route::put('/financial/budgets/{id}', [FinancialController::class, 'budgetUpdate']);
        Route::delete('/financial/budgets/{id}', [FinancialController::class, 'budgetDestroy']);
        Route::get('/financial/transactions', [FinancialController::class, 'transactionIndex']);
        Route::post('/financial/transactions', [FinancialController::class, 'transactionStore']);
        Route::put('/financial/transactions/{id}', [FinancialController::class, 'transactionUpdate']);
        Route::delete('/financial/transactions/{id}', [FinancialController::class, 'transactionDestroy']);
        Route::get('/financial/alerts', [FinancialController::class, 'alertIndex']);
        Route::put('/financial/alerts/{id}/status', [FinancialController::class, 'alertUpdateStatus']);
        Route::post('/financial/alerts/{id}/escalate', [FinancialController::class, 'alertEscalate']);
        Route::get('/financial/initiatives/{id}/reconciliation', [FinancialController::class, 'initiativeReconciliation']);
    });

    // Tahap P-M: Executive Actions & Strategic Execution Center (Admin, Pimpinan, PM)
    Route::middleware('role:admin,pimpinan,project_manager')->group(function () {
        Route::get('/leadership/actions/summary', [ExecutiveActionController::class, 'summary']);
        Route::get('/leadership/actions', [ExecutiveActionController::class, 'index']);
        Route::post('/leadership/actions', [ExecutiveActionController::class, 'store']);
        Route::post('/leadership/actions/from-insight', [ExecutiveActionController::class, 'createFromInsight']);
        Route::get('/leadership/actions/{id}', [ExecutiveActionController::class, 'show']);
        Route::put('/leadership/actions/{id}', [ExecutiveActionController::class, 'update']);
        Route::post('/leadership/actions/{id}/cancel', [ExecutiveActionController::class, 'cancel']);
        Route::post('/leadership/actions/{id}/convert-task', [ExecutiveActionController::class, 'convertToTask']);
    });

    // Project Manager Workspace (Scoped to PM's projects)
    Route::middleware('role:admin,pimpinan,project_manager')->group(function () {
        Route::get('/pm/workspace', [PmWorkspaceController::class, 'index']);
    });

    // Tahap P-O, M-A, M-B, M-C: Member Workspace, Calendar, Notification & Performance Center (Member role only)
    Route::get('/member/workspace', [MemberWorkspaceController::class, 'index']);
    Route::get('/member/calendar', [MemberWorkspaceController::class, 'calendar']);
    Route::get('/member/performance', [MemberPerformanceController::class, 'index']);

    // Tahap M-B: Member Notification Center Routes
    Route::get('/member/notifications', [MemberNotificationController::class, 'index']);
    Route::get('/member/notifications/summary', [MemberNotificationController::class, 'summary']);
    Route::patch('/member/notifications/{id}/read', [MemberNotificationController::class, 'markAsRead']);
    Route::patch('/member/notifications/{id}/unread', [MemberNotificationController::class, 'markAsUnread']);
    Route::post('/member/notifications/read-all', [MemberNotificationController::class, 'markAllAsRead']);
    Route::delete('/member/notifications/{id}', [MemberNotificationController::class, 'destroy']);

    // Tahap M-D: Member Learning & Development Center Routes
    Route::get('/member/learning/overview', [MemberLearningController::class, 'overview']);
    Route::get('/member/learning/skills', [MemberLearningController::class, 'indexSkills']);
    Route::post('/member/learning/skills', [MemberLearningController::class, 'storeSkill']);
    Route::put('/member/learning/skills/{id}', [MemberLearningController::class, 'updateSkill']);
    Route::delete('/member/learning/skills/{id}', [MemberLearningController::class, 'destroySkill']);

    Route::get('/member/learning/goals', [MemberLearningController::class, 'indexGoals']);
    Route::post('/member/learning/goals', [MemberLearningController::class, 'storeGoal']);
    Route::get('/member/learning/goals/{id}', [MemberLearningController::class, 'showGoal']);
    Route::put('/member/learning/goals/{id}', [MemberLearningController::class, 'updateGoal']);
    Route::delete('/member/learning/goals/{id}', [MemberLearningController::class, 'destroyGoal']);

    Route::post('/member/learning/goals/{id}/milestones', [MemberLearningController::class, 'storeMilestone']);
    Route::put('/member/learning/milestones/{id}', [MemberLearningController::class, 'updateMilestone']);
    Route::delete('/member/learning/milestones/{id}', [MemberLearningController::class, 'destroyMilestone']);

    Route::get('/member/learning/activities', [MemberLearningController::class, 'indexActivities']);
    Route::post('/member/learning/activities', [MemberLearningController::class, 'storeActivity']);
    Route::put('/member/learning/activities/{id}', [MemberLearningController::class, 'updateActivity']);
    Route::delete('/member/learning/activities/{id}', [MemberLearningController::class, 'destroyActivity']);

    Route::get('/member/learning/feedback', [MemberLearningController::class, 'indexFeedback']);
    Route::post('/member/learning/feedback', [MemberLearningController::class, 'storeFeedback']);

    // AI Analyst (Live LLM + Rule-Based fallback on DB context)
    Route::post('/ai/ask', [AiAnalystController::class, 'ask']);
    Route::post('/ai/chat', [AiAnalystController::class, 'ask']);
    Route::get('/ai/context', [AiAnalystController::class, 'context']);

    // Reports 2.0 (Dynamic Business Intelligence) - Restricted to admin, pimpinan, project_manager
    Route::middleware('role:admin,pimpinan,project_manager')->group(function () {
        Route::get('/reports', [ReportController::class, 'index']);
        Route::get('/reports/overview', [ReportController::class, 'index']);
    });

    // Project Management (Full CRUD)
    Route::get('/projects', [ProjectController::class, 'index']);
    Route::post('/projects', [ProjectController::class, 'store']);
    Route::get('/projects/{id}', [ProjectController::class, 'show']);
    Route::put('/projects/{id}', [ProjectController::class, 'update']);
    Route::delete('/projects/{id}', [ProjectController::class, 'destroy']);

    // Task Management (Full CRUD + Toggle + Quick Assign + Summary)
    Route::get('/tasks/summary', [TaskController::class, 'summary']);
    Route::get('/tasks/pending-review', [TaskReviewController::class, 'pending']);
    Route::get('/tasks', [TaskController::class, 'index']);
    Route::post('/tasks', [TaskController::class, 'store']);
    Route::get('/tasks/{id}', [TaskController::class, 'show']);
    Route::put('/tasks/{id}', [TaskController::class, 'update']);
    Route::delete('/tasks/{id}', [TaskController::class, 'destroy']);
    Route::post('/tasks/{id}/toggle', [TaskController::class, 'toggle']);
    Route::match(['patch', 'post'], '/tasks/{id}/assign', [TaskController::class, 'assign']);

    // Task Checklist Management
    Route::get('/tasks/{taskId}/checklists', [TaskChecklistController::class, 'index']);
    Route::post('/tasks/{taskId}/checklists', [TaskChecklistController::class, 'store']);
    Route::put('/checklists/{id}', [TaskChecklistController::class, 'update']);
    Route::post('/checklists/{id}/toggle', [TaskChecklistController::class, 'toggle']);
    Route::delete('/checklists/{id}', [TaskChecklistController::class, 'destroy']);

    // Task Progress Updates & Work Reports (PM-G)
    Route::get('/tasks/{taskId}/updates', [TaskUpdateController::class, 'index']);
    Route::post('/tasks/{taskId}/updates', [TaskUpdateController::class, 'store']);
    Route::get('/task-updates/{id}/download', [TaskUpdateController::class, 'download']);

    // Task Approval Workflow & Reviews (PM-H)
    Route::get('/tasks/{taskId}/reviews', [TaskReviewController::class, 'index']);
    Route::post('/tasks/{taskId}/submit-review', [TaskReviewController::class, 'submit']);
    Route::post('/tasks/{taskId}/approve', [TaskReviewController::class, 'approve']);
    Route::post('/tasks/{taskId}/request-revision', [TaskReviewController::class, 'requestRevision']);
    Route::post('/tasks/{taskId}/reopen', [TaskReviewController::class, 'reopen']);

    // Milestone / Sprint Tracker (CRUD synced with project progress)
    Route::get('/milestones', [MilestoneController::class, 'all']);
    Route::get('/milestones/{id}', [MilestoneController::class, 'show']);
    Route::post('/milestones', [MilestoneController::class, 'store']);
    Route::get('/projects/{projectId}/milestones', [MilestoneController::class, 'index']);
    Route::post('/projects/{projectId}/milestones', [MilestoneController::class, 'store']);
    Route::put('/milestones/{id}', [MilestoneController::class, 'update']);
    Route::delete('/milestones/{id}', [MilestoneController::class, 'destroy']);

    // User Management & Team Directory
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::get('/users/{id}', [UserController::class, 'show']);
    Route::put('/users/{id}', [UserController::class, 'update']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);
    Route::post('/users/{id}/toggle-status', [UserController::class, 'toggleStatus']);
    Route::get('/team', [UserController::class, 'team']);
    Route::get('/team/{id}', [UserController::class, 'teamMember']);

    // PM-I: Team Workload & Member Capacity Monitoring
    Route::get('/workload/summary', [\App\Http\Controllers\Api\PmTeamWorkloadController::class, 'summary']);
    Route::get('/workload/members', [\App\Http\Controllers\Api\PmTeamWorkloadController::class, 'memberList']);
    Route::get('/workload/members/{id}', [\App\Http\Controllers\Api\PmTeamWorkloadController::class, 'memberDetail']);
    Route::get('/workload/distribution', [\App\Http\Controllers\Api\PmTeamWorkloadController::class, 'distribution']);

    // PM-J: Project Reports & Weekly Progress Reporting
    Route::get('/project-reports/stats/overview', [\App\Http\Controllers\Api\PmProjectReportController::class, 'overview']);
    Route::get('/project-reports', [\App\Http\Controllers\Api\PmProjectReportController::class, 'index']);
    Route::get('/project-reports/{id}', [\App\Http\Controllers\Api\PmProjectReportController::class, 'show']);
    Route::put('/project-reports/{id}', [\App\Http\Controllers\Api\PmProjectReportController::class, 'update']);
    Route::delete('/project-reports/{id}', [\App\Http\Controllers\Api\PmProjectReportController::class, 'destroy']);
    Route::post('/project-reports/{id}/publish', [\App\Http\Controllers\Api\PmProjectReportController::class, 'publish']);
    Route::get('/projects/{projectId}/reports/preview', [\App\Http\Controllers\Api\PmProjectReportController::class, 'previewSnapshot']);
    Route::post('/projects/{projectId}/reports', [\App\Http\Controllers\Api\PmProjectReportController::class, 'store']);

    // Settings & Notification Preferences
    Route::get('/settings/preferences', [SettingsController::class, 'getPreferences']);
    Route::put('/settings/preferences', [SettingsController::class, 'updatePreferences']);

    // Activities Log
    Route::get('/activities', function () {
        return response()->json([
            'activities' => Activity::orderBy('created_at', 'desc')->paginate(20),
        ]);
    });

    // Health / Test endpoint
    Route::get('/test', function () {
        return response()->json([
            'message' => 'PKM Control Center API is running!',
            'timestamp' => now()->toDateTimeString(),
        ]);
    });
});
