<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Models\Activity;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Support\Facades\Route;

// Public routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    
    // Dashboard & Business Analytics
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::post('/tasks/{id}/toggle', [DashboardController::class, 'toggleTask']);
    Route::post('/ai/ask', [DashboardController::class, 'askAi']);

    // List resources for sub-pages & "Lihat Semua"
    Route::get('/projects', function () {
        return response()->json([
            'projects' => Project::orderBy('created_at', 'desc')->get(),
        ]);
    });

    Route::get('/tasks', function () {
        return response()->json([
            'tasks' => Task::with('project')->orderBy('created_at', 'desc')->get(),
        ]);
    });

    Route::get('/activities', function () {
        return response()->json([
            'activities' => Activity::orderBy('created_at', 'desc')->paginate(20),
        ]);
    });

    // Test endpoint
    Route::get('/test', function () {
        return response()->json([
            'message' => 'PKM Control Center API is running!',
            'timestamp' => now()->toDateTimeString(),
            'data' => [
                'active_projects' => 12,
                'pending_tasks' => 47,
                'team_members' => 18,
            ]
        ]);
    });
});