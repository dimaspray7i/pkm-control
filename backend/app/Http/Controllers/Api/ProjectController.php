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
        $user = $request->user();
        $query = Project::query();

        // Scoping otorisasi: Project Manager hanya melihat proyek dengan pic_id miliknya
        if ($user && $user->role === 'project_manager') {
            $query->where('pic_id', $user->id);
        }

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('category') && $request->category !== 'all') {
            $query->where('category', $request->category);
        }

        if ($request->filled('risk_level') && $request->risk_level !== 'all') {
            $query->where('risk_level', $request->risk_level);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%")
                  ->orWhere('client', 'like', "%{$search}%")
                  ->orWhere('pic_name', 'like', "%{$search}%");
            });
        }

        $projects = $query->with('pic:id,name,email,role')->orderBy('created_at', 'desc')->get();

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

        // PM tidak boleh membuat proyek dengan pic_id milik orang lain
        if ($user->role === 'project_manager' && $request->filled('pic_id') && (int) $request->pic_id !== (int) $user->id) {
            return response()->json([
                'message' => 'Project Manager tidak diizinkan mendaftarkan proyek atas nama pengguna lain.',
                'errors' => [
                    'pic_id' => ['Project Manager hanya dapat mendaftarkan proyek atas nama dirinya sendiri.'],
                ],
            ], 403);
        }

        $validated = $request->validate([
            'code' => ['required', 'string', 'max:50', 'unique:projects,code'],
            'name' => ['required', 'string', 'max:255'],
            'client' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', Rule::in(['web', 'mobile', 'system', 'code'])],
            'pic_id' => ['nullable', 'exists:users,id'],
            'pic_name' => ['nullable', 'string', 'max:255'],
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
            'pic_id.exists' => 'Person in Charge (PIC) yang dipilih tidak terdaftar di sistem.',
        ]);

        $project = DB::transaction(function () use ($validated, $user) {
            // Untuk Project Manager, kepemilikan proyek otomatis disetel ke dirinya sendiri
            if ($user->role === 'project_manager') {
                $validated['pic_id'] = $user->id;
                $picName = $user->name;
            } else {
                // Resolve PIC name if pic_id provided
                $picName = $validated['pic_name'] ?? null;
                if (!empty($validated['pic_id']) && empty($picName)) {
                    $assignedUser = \App\Models\User::find($validated['pic_id']);
                    if ($assignedUser) {
                        $picName = $assignedUser->name;
                    }
                }
            }

            $proj = Project::create([
                'code' => strtoupper(trim($validated['code'])),
                'name' => trim($validated['name']),
                'client' => trim($validated['client']),
                'category' => $validated['category'] ?? 'web',
                'pic_id' => $validated['pic_id'] ?? null,
                'pic_name' => $picName,
                'progress' => 0, // Progres awal selalu 0%, dihitung otomatis saat tugas ditambahkan
                'target_progress' => $validated['target_progress'] ?? 0,
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
     * Tampilkan detail proyek tunggal beserta tugas, milestone, dan aktivitasnya.
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();

        if (!is_numeric($id)) {
            return response()->json([
                'message' => 'Proyek tidak ditemukan (ID tidak valid).',
            ], 404);
        }

        $project = Project::with([
            'pic:id,name,email,role,phone',
            'tasks' => function ($q) {
                $q->orderByRaw("FIELD(priority, 'high', 'medium', 'low')")
                  ->orderBy('created_at', 'desc');
            },
            'milestones' => function ($q) {
                $q->orderBy('phase_order', 'asc');
            }
        ])->find($id);

        if (!$project) {
            return response()->json([
                'message' => 'Proyek tidak ditemukan.',
            ], 404);
        }

        // Scoping otorisasi: PM hanya boleh melihat proyek yang dipimpinnya
        if ($user && $user->role === 'project_manager' && (int) $project->pic_id !== (int) $user->id) {
            return response()->json([
                'message' => 'Anda tidak memiliki hak akses untuk melihat proyek milik Project Manager lain.',
            ], 403);
        }

        // Sinkronisasi otomatis progres aktual dari tugas terkait
        $actualProgress = $project->syncProgress();
        $totalTasks = $project->tasks->count();
        $completedTasks = $project->tasks->filter(function ($t) {
            return $t->is_completed || $t->status === 'completed';
        })->count();

        $project->setAttribute('completed_tasks_count', $completedTasks);
        $project->setAttribute('total_tasks_count', $totalTasks);
        $project->setAttribute('actual_progress', $actualProgress);

        $activities = Activity::where('project_name', $project->name)
            ->orWhere('target_name', $project->name)
            ->orWhere('action', 'like', "%{$project->code}%")
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();

        return response()->json([
            'project' => $project,
            'activities' => $activities,
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

        // Scoping otorisasi: PM hanya boleh mengubah proyek miliknya
        if ($user->role === 'project_manager' && (int) $project->pic_id !== (int) $user->id) {
            return response()->json([
                'message' => 'Anda tidak memiliki hak untuk mengubah proyek milik Project Manager lain.',
            ], 403);
        }

        // PM tidak boleh memindahkan kepemilikan proyek ke pengguna lain
        if ($user->role === 'project_manager' && $request->filled('pic_id') && (int) $request->pic_id !== (int) $user->id) {
            return response()->json([
                'message' => 'Project Manager tidak diizinkan memindahkan kepemilikan proyek ke pengguna lain.',
                'errors' => [
                    'pic_id' => ['Kepemilikan proyek hanya dapat diubah oleh Super Admin.'],
                ],
            ], 403);
        }

        $validated = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('projects', 'code')->ignore($project->id)],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'client' => ['sometimes', 'required', 'string', 'max:255'],
            'category' => ['sometimes', 'required', 'string', Rule::in(['web', 'mobile', 'system', 'code'])],
            'pic_id' => ['nullable', 'exists:users,id'],
            'pic_name' => ['nullable', 'string', 'max:255'],
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
            'pic_id.exists' => 'Person in Charge (PIC) yang dipilih tidak terdaftar di sistem.',
        ]);

        $project = DB::transaction(function () use ($project, $validated, $user) {
            if ($user->role === 'project_manager') {
                $picId = $project->pic_id;
                $picName = $project->pic_name;
            } else {
                $picId = array_key_exists('pic_id', $validated) ? $validated['pic_id'] : $project->pic_id;

                // If pic_id is updated, automatically re-resolve or update pic_name
                if (array_key_exists('pic_id', $validated)) {
                    if (!empty($picId)) {
                        $assignedUser = \App\Models\User::find($picId);
                        $picName = $assignedUser ? $assignedUser->name : ($validated['pic_name'] ?? null);
                    } else {
                        $picName = null;
                    }
                } else {
                    $picName = array_key_exists('pic_name', $validated) ? $validated['pic_name'] : $project->pic_name;
                }
            }

            $project->update([
                'code' => isset($validated['code']) ? strtoupper(trim($validated['code'])) : $project->code,
                'name' => isset($validated['name']) ? trim($validated['name']) : $project->name,
                'client' => isset($validated['client']) ? trim($validated['client']) : $project->client,
                'category' => $validated['category'] ?? $project->category,
                'pic_id' => $picId,
                'pic_name' => $picName,
                'progress' => $project->calculateActualProgress(), // Progres selalu dihitung otomatis dari data tugas
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

        if (!is_numeric($id)) {
            return response()->json([
                'message' => 'Proyek tidak ditemukan (ID tidak valid).',
            ], 404);
        }

        $project = Project::withCount(['tasks', 'milestones'])->find($id);
        if (!$project) {
            return response()->json([
                'message' => 'Proyek tidak ditemukan.',
            ], 404);
        }

        // Scoping otorisasi: PM hanya boleh menghapus proyek miliknya
        if ($user->role === 'project_manager' && (int) $project->pic_id !== (int) $user->id) {
            return response()->json([
                'message' => 'Anda tidak memiliki hak untuk menghapus proyek milik Project Manager lain.',
            ], 403);
        }

        // Audit Retensi PM-K: Cegah penghapusan proyek yang telah memiliki laporan terpublikasi
        if ($project->reports()->where('status', 'published')->exists()) {
            return response()->json([
                'message' => 'Proyek tidak dapat dihapus karena telah memiliki laporan mingguan yang terpublikasi. Arsipkan proyek alih-alih menghapusnya demi kepatuhan audit.',
            ], 422);
        }

        $projectName = $project->name;
        $projectCode = $project->code;
        $tasksCount = $project->tasks_count;
        $milestonesCount = $project->milestones_count;

        DB::transaction(function () use ($project, $user, $projectName, $projectCode, $tasksCount, $milestonesCount) {
            // Hapus proyek (tugas dan milestone di-cascade secara otomatis sesuai FK schema)
            $project->delete();

            // Catat log aktivitas penghapusan dengan rincian data terkait
            $detailList = [];
            if ($tasksCount > 0) $detailList[] = "{$tasksCount} tugas";
            if ($milestonesCount > 0) $detailList[] = "{$milestonesCount} milestone";
            $suffix = !empty($detailList) ? ' beserta ' . implode(' dan ', $detailList) . ' terkait' : '';

            Activity::create([
                'user_name' => $user->name,
                'action' => 'menghapus proyek "' . $projectName . '" (' . $projectCode . ')' . $suffix,
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
