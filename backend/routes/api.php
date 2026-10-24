<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

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

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');