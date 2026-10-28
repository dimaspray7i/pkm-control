<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Milestone;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MilestoneController extends Controller
{
    /**
     * Get all milestones for a specific project.
     * Auto-seeds standard phases if none exist.
     */
    public function index($projectId)
    {
        $project = Project::findOrFail($projectId);

        $milestones = Milestone::where('project_id', $projectId)
            ->orderBy('phase_order', 'asc')
            ->get();

        if ($milestones->isEmpty()) {
            // Seed 4 standard phases based on current project progress
            $baseProgress = $project->progress;
            $defaults = [
                [
                    'phase_order' => 1,
                    'title' => 'Requirements & Discovery',
                    'description' => 'Requirement gathering, stakeholder alignment, and project brief sign-off.',
                    'progress' => $baseProgress >= 25 ? 100 : min(100, $baseProgress * 4),
                    'status' => $baseProgress >= 25 ? 'completed' : ($baseProgress > 0 ? 'in_progress' : 'pending'),
                    'due_date' => now()->subDays(20)->format('Y-m-d'),
                ],
                [
                    'phase_order' => 2,
                    'title' => 'System Architecture & UI/UX',
                    'description' => 'Wireframes, interactive prototype, DB schema design and API contracts.',
                    'progress' => $baseProgress >= 50 ? 100 : ($baseProgress <= 25 ? 0 : min(100, ($baseProgress - 25) * 4)),
                    'status' => $baseProgress >= 50 ? 'completed' : ($baseProgress > 25 ? 'in_progress' : 'pending'),
                    'due_date' => now()->subDays(5)->format('Y-m-d'),
                ],
                [
                    'phase_order' => 3,
                    'title' => 'Core Development & Integration',
                    'description' => 'Frontend components, backend business logic, database migrations and external APIs.',
                    'progress' => $baseProgress >= 75 ? 100 : ($baseProgress <= 50 ? 0 : min(100, ($baseProgress - 50) * 4)),
                    'status' => $baseProgress >= 75 ? 'completed' : ($baseProgress > 50 ? 'in_progress' : 'pending'),
                    'due_date' => now()->addDays(15)->format('Y-m-d'),
                ],
                [
                    'phase_order' => 4,
                    'title' => 'QA Testing, Security Audit & Deployment',
                    'description' => 'End-to-end testing, security penetration checks, UAT sign-off, production release.',
                    'progress' => $baseProgress >= 100 ? 100 : ($baseProgress <= 75 ? 0 : min(100, ($baseProgress - 75) * 4)),
                    'status' => $baseProgress >= 100 ? 'completed' : ($baseProgress > 75 ? 'in_progress' : 'pending'),
                    'due_date' => $project->deadline ? $project->deadline->format('Y-m-d') : now()->addDays(30)->format('Y-m-d'),
                ],
            ];

            foreach ($defaults as $d) {
                Milestone::create(array_merge($d, ['project_id' => $projectId]));
            }

            $milestones = Milestone::where('project_id', $projectId)
                ->orderBy('phase_order', 'asc')
                ->get();
        }

        return response()->json([
            'success' => true,
            'project' => $project,
            'data' => $milestones,
        ]);
    }

    /**
     * Create a milestone for a project.
     */
    public function store(Request $request, $projectId)
    {
        $user = $request->user();
        if ($user && !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki hak akses untuk menambah milestone.',
            ], 403);
        }

        $project = Project::findOrFail($projectId);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'phase_order' => 'required|integer|min:1',
            'progress' => 'required|integer|min:0|max:100',
            'status' => 'required|in:pending,in_progress,completed,blocked',
            'due_date' => 'nullable|date',
        ]);

        $milestone = DB::transaction(function () use ($validated, $projectId, $project, $user) {
            $created = Milestone::create(array_merge($validated, ['project_id' => $projectId]));

            // Recalculate project progress
            $avgProgress = (int) round(Milestone::where('project_id', $projectId)->avg('progress'));
            $project->update(['progress' => $avgProgress]);

            Activity::create([
                'user_name' => $user ? $user->name : 'System',
                'action' => 'menambahkan milestone ' . $created->title,
                'target_name' => $created->title,
                'project_name' => $project->name,
                'avatar_color' => '#FF2F92',
            ]);

            return $created;
        });

        return response()->json([
            'success' => true,
            'message' => 'Milestone berhasil ditambahkan.',
            'data' => $milestone,
        ], 201);
    }

    /**
     * Update a milestone.
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();
        if ($user && !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki hak akses untuk mengubah milestone.',
            ], 403);
        }

        $milestone = Milestone::findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'phase_order' => 'sometimes|required|integer|min:1',
            'progress' => 'sometimes|required|integer|min:0|max:100',
            'status' => 'sometimes|required|in:pending,in_progress,completed,blocked',
            'due_date' => 'nullable|date',
        ]);

        DB::transaction(function () use ($milestone, $validated, $user) {
            $milestone->update($validated);

            // Recalculate project progress
            $projectId = $milestone->project_id;
            $avgProgress = (int) round(Milestone::where('project_id', $projectId)->avg('progress'));
            
            $project = Project::find($projectId);
            if ($project) {
                $projectStatus = $project->status;
                if ($avgProgress >= 100) {
                    $projectStatus = 'completed';
                } elseif ($projectStatus === 'completed' && $avgProgress < 100) {
                    $projectStatus = 'on_track';
                }

                $project->update([
                    'progress' => $avgProgress,
                    'status' => $projectStatus,
                ]);
            }

            Activity::create([
                'user_name' => $user ? $user->name : 'System',
                'action' => 'memperbarui progres milestone ' . $milestone->title,
                'target_name' => $milestone->title,
                'project_name' => $project ? $project->name : '-',
                'avatar_color' => '#FFD83D',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Milestone berhasil diperbarui.',
            'data' => $milestone->fresh(),
        ]);
    }

    /**
     * Delete a milestone.
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        if ($user && !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki hak akses untuk menghapus milestone.',
            ], 403);
        }

        $milestone = Milestone::findOrFail($id);
        $projectId = $milestone->project_id;
        $title = $milestone->title;

        DB::transaction(function () use ($milestone, $projectId, $title, $user) {
            $milestone->delete();

            $avgProgress = (int) round(Milestone::where('project_id', $projectId)->avg('progress') ?? 0);
            $project = Project::find($projectId);
            if ($project) {
                $project->update(['progress' => $avgProgress]);
            }

            Activity::create([
                'user_name' => $user ? $user->name : 'System',
                'action' => 'menghapus milestone ' . $title,
                'target_name' => $title,
                'project_name' => $project ? $project->name : '-',
                'avatar_color' => '#171717',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Milestone berhasil dihapus.',
        ]);
    }
}
