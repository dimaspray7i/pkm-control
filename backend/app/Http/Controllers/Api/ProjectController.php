<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProjectController extends Controller
{
    /**
     * Tampilkan daftar proyek.
     */
    public function index(Request $request)
    {
        $query = Project::query();

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%")
                  ->orWhere('client', 'like', "%{$search}%");
            });
        }

        $projects = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'projects' => $projects,
            'total' => $projects->count(),
        ]);
    }

    /**
     * Simpan proyek baru ke database.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        // Cek otorisasi role
        if (!$user || !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'message' => 'Hanya Super Admin dan Project Manager yang memiliki izin menambah proyek.',
            ], 403);
        }

        $validated = $request->validate([
            'code' => ['required', 'string', 'max:50', 'unique:projects,code'],
            'name' => ['required', 'string', 'max:255'],
            'client' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', Rule::in(['web', 'mobile', 'system', 'code'])],
            'progress' => ['nullable', 'integer', 'min:0', 'max:100'],
            'target_progress' => ['nullable', 'integer', 'min:0', 'max:100'],
            'status' => ['nullable', 'string', Rule::in(['on_track', 'at_risk', 'delayed', 'completed'])],
            'risk_level' => ['nullable', 'string', Rule::in(['none', 'low', 'medium', 'high'])],
            'risk_factor' => ['nullable', 'string', 'max:500'],
            'deadline' => ['nullable', 'date'],
        ], [
            'code.required' => 'Kode proyek wajib diisi.',
            'code.unique' => 'Kode proyek sudah digunakan oleh proyek lain.',
            'name.required' => 'Nama proyek wajib diisi.',
            'client.required' => 'Nama klien wajib diisi.',
            'category.in' => 'Kategori harus berupa web, mobile, system, atau code.',
            'status.in' => 'Status tidak valid.',
        ]);

        $project = DB::transaction(function () use ($validated, $user) {
            $proj = Project::create([
                'code' => strtoupper(trim($validated['code'])),
                'name' => trim($validated['name']),
                'client' => trim($validated['client']),
                'category' => $validated['category'] ?? 'web',
                'progress' => $validated['progress'] ?? 0,
                'target_progress' => $validated['target_progress'] ?? ($validated['progress'] ?? 0),
                'status' => $validated['status'] ?? 'on_track',
                'risk_level' => $validated['risk_level'] ?? 'low',
                'risk_factor' => $validated['risk_factor'] ?? null,
                'deadline' => $validated['deadline'] ?? null,
                'is_active' => true,
            ]);

            // Catat ke log aktivitas
            Activity::create([
                'user_name' => $user->name,
                'action' => 'menambahkan proyek baru "' . $proj->name . '" (' . $proj->code . ')',
                'target_name' => $proj->name,
                'project_name' => $proj->name,
                'avatar_color' => 'pink',
            ]);

            return $proj;
        });

        return response()->json([
            'message' => 'Proyek baru berhasil ditambahkan ke sistem.',
            'project' => $project,
        ], 201);
    }

    /**
     * Tampilkan detail proyek tunggal beserta tugasnya.
     */
    public function show($id)
    {
        $project = Project::with(['tasks' => function ($q) {
            $q->orderBy('created_at', 'desc');
        }])->findOrFail($id);

        return response()->json([
            'project' => $project,
        ]);
    }

    /**
     * Perbarui data proyek yang sudah ada.
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();

        // Cek otorisasi role
        if (!$user || !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'message' => 'Hanya Super Admin dan Project Manager yang memiliki izin mengubah proyek.',
            ], 403);
        }

        $project = Project::findOrFail($id);

        $validated = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('projects', 'code')->ignore($project->id)],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'client' => ['sometimes', 'required', 'string', 'max:255'],
            'category' => ['sometimes', 'required', 'string', Rule::in(['web', 'mobile', 'system', 'code'])],
            'progress' => ['nullable', 'integer', 'min:0', 'max:100'],
            'target_progress' => ['nullable', 'integer', 'min:0', 'max:100'],
            'status' => ['nullable', 'string', Rule::in(['on_track', 'at_risk', 'delayed', 'completed'])],
            'risk_level' => ['nullable', 'string', Rule::in(['none', 'low', 'medium', 'high'])],
            'risk_factor' => ['nullable', 'string', 'max:500'],
            'deadline' => ['nullable', 'date'],
            'is_active' => ['nullable', 'boolean'],
        ], [
            'code.required' => 'Kode proyek wajib diisi.',
            'code.unique' => 'Kode proyek sudah digunakan oleh proyek lain.',
            'name.required' => 'Nama proyek wajib diisi.',
            'client.required' => 'Nama klien wajib diisi.',
        ]);

        $project = DB::transaction(function () use ($project, $validated, $user) {
            $project->update([
                'code' => isset($validated['code']) ? strtoupper(trim($validated['code'])) : $project->code,
                'name' => isset($validated['name']) ? trim($validated['name']) : $project->name,
                'client' => isset($validated['client']) ? trim($validated['client']) : $project->client,
                'category' => $validated['category'] ?? $project->category,
                'progress' => $validated['progress'] ?? $project->progress,
                'target_progress' => $validated['target_progress'] ?? $project->target_progress,
                'status' => $validated['status'] ?? $project->status,
                'risk_level' => $validated['risk_level'] ?? $project->risk_level,
                'risk_factor' => array_key_exists('risk_factor', $validated) ? $validated['risk_factor'] : $project->risk_factor,
                'deadline' => $validated['deadline'] ?? $project->deadline,
                'is_active' => $validated['is_active'] ?? $project->is_active,
            ]);

            // Catat ke log aktivitas
            Activity::create([
                'user_name' => $user->name,
                'action' => 'memperbarui data proyek "' . $project->name . '" (' . $project->code . ')',
                'target_name' => $project->name,
                'project_name' => $project->name,
                'avatar_color' => 'yellow',
            ]);

            return $project;
        });

        return response()->json([
            'message' => 'Data proyek berhasil diperbarui.',
            'project' => $project,
        ]);
    }

    /**
     * Hapus proyek dari database beserta tugas terkait (cascade).
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();

        // Cek otorisasi role
        if (!$user || !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'message' => 'Hanya Super Admin dan Project Manager yang memiliki izin menghapus proyek.',
            ], 403);
        }

        $project = Project::withCount('tasks')->findOrFail($id);
        $projectName = $project->name;
        $projectCode = $project->code;
        $tasksCount = $project->tasks_count;

        DB::transaction(function () use ($project, $user, $projectName, $projectCode, $tasksCount) {
            // Hapus proyek (tugas di-cascade secara otomatis sesuai FK schema)
            $project->delete();

            // Catat log aktivitas penghapusan
            Activity::create([
                'user_name' => $user->name,
                'action' => 'menghapus proyek "' . $projectName . '" (' . $projectCode . ')' . ($tasksCount > 0 ? " beserta {$tasksCount} tugas terkait" : ''),
                'target_name' => $projectName,
                'project_name' => $projectName,
                'avatar_color' => 'purple',
            ]);
        });

        return response()->json([
            'message' => 'Proyek berhasil dihapus dari sistem.',
        ]);
    }
}
