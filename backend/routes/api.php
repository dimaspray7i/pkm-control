<?php

use App\Http\Controllers\Api\AiAnalystController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\MilestoneController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\TaskController;
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

    // AI Analyst (Live LLM + Rule-Based fallback on DB context)
    Route::post('/ai/ask', [AiAnalystController::class, 'ask']);
    Route::get('/ai/context', [AiAnalystController::class, 'context']);

    // Project Management (Full CRUD)
    Route::get('/projects', [ProjectController::class, 'index']);
    Route::post('/projects', [ProjectController::class, 'store']);
    Route::get('/projects/{id}', [ProjectController::class, 'show']);
    Route::put('/projects/{id}', [ProjectController::class, 'update']);
    Route::delete('/projects/{id}', [ProjectController::class, 'destroy']);

    // Task Management (Full CRUD + Toggle)
    Route::get('/tasks', [TaskController::class, 'index']);
    Route::post('/tasks', [TaskController::class, 'store']);
    Route::get('/tasks/{id}', [TaskController::class, 'show']);
    Route::put('/tasks/{id}', [TaskController::class, 'update']);
    Route::delete('/tasks/{id}', [TaskController::class, 'destroy']);
    Route::post('/tasks/{id}/toggle', [TaskController::class, 'toggle']);

    // Milestone / Development Tracker (CRUD synced with project progress)
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
    Route::get('/team', [UserController::class, 'team']);

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
