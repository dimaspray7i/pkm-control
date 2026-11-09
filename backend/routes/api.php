<?php

use App\Http\Controllers\Api\AiAnalystController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
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

    // Project Manager Workspace (Scoped to PM's projects)
    Route::middleware('role:admin,pimpinan,project_manager')->group(function () {
        Route::get('/pm/workspace', [PmWorkspaceController::class, 'index']);
    });

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
