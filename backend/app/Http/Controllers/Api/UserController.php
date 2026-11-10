<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * Get list of users with search and role filters.
     */
    public function index(Request $request)
    {
        $query = User::query();

        if ($request->filled('role') && $request->role !== 'all') {
            $query->where('role', $request->role);
        }

        if ($request->has('is_active') && $request->is_active !== 'all') {
            $val = $request->is_active;
            if ($val === 'active' || $val === '1' || $val === 'true' || $val === true) {
                $query->where('is_active', true);
            } elseif ($val === 'inactive' || $val === '0' || $val === 'false' || $val === false) {
                $query->where('is_active', false);
            }
        }

        if ($request->filled('search')) {
            $search = trim($request->search);

            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $users = $query->withCount(['projects', 'tasks'])->orderBy('name', 'asc')->get();

        return response()->json([
            'users' => $users,
            'total' => $users->count(),
        ]);
    }

    /**
     * Create a new user (admin only).
     */
    public function store(Request $request)
    {
        $currentUser = $request->user();

        if (!$currentUser || $currentUser->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya Super Admin yang dapat menambahkan pengguna.',
            ], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'role' => [
                'required',
                Rule::in(['admin', 'pimpinan', 'project_manager', 'member']),
            ],
            'phone' => 'nullable|string|max:30',
            'password' => 'required|string|min:6',
            'is_active' => 'nullable|boolean',
        ], [
            'name.required' => 'Nama pengguna wajib diisi.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email ini sudah terdaftar di sistem.',
            'role.required' => 'Peran pengguna wajib dipilih.',
            'role.in' => 'Peran pengguna yang dipilih tidak valid.',
            'password.required' => 'Password wajib diisi.',
            'password.min' => 'Password minimal 6 karakter.',
        ]);

        $user = DB::transaction(function () use ($validated, $currentUser) {
            $created = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'role' => $validated['role'],
                'phone' => $validated['phone'] ?? null,
                'password' => Hash::make($validated['password']),
                'is_active' => $validated['is_active'] ?? true,
            ]);

            Activity::create([
                'user_name' => $currentUser ? $currentUser->name : 'Sistem PKM',
                'action' => 'menambahkan user baru: ' . $created->name,
                'target_name' => $created->name,
                'project_name' => 'User Management',
                'avatar_color' => '#FF2F92',
            ]);

            return $created;
        });

        return response()->json([
            'success' => true,
            'message' => 'Pengguna berhasil ditambahkan.',
            'user' => $user,
        ], 201);
    }

    /**
     * Show single user.
     */
    public function show($id)
    {
        $user = User::withCount(['projects', 'tasks'])->findOrFail($id);

        return response()->json([
            'user' => $user,
        ]);
    }

    /**
     * Update user (admin only, prevent self-role alteration and self-deactivation).
     */
    public function update(Request $request, $id)
    {
        $currentUser = $request->user();

        if (!$currentUser || $currentUser->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya Super Admin yang dapat memperbarui data pengguna.',
            ], 403);
        }

        $user = User::findOrFail($id);

        // Aturan Keamanan 1: Pengguna tidak boleh mengubah atau menaikkan role akunnya sendiri
        if ((int) $currentUser->id === (int) $id && $request->has('role') && $request->role !== $user->role) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak dapat mengubah atau menaikkan role akun Anda sendiri.',
                'errors' => [
                    'role' => ['Anda tidak dapat mengubah atau menaikkan role akun Anda sendiri.'],
                ],
            ], 422);
        }

        // Aturan Keamanan 2: Pengguna tidak boleh menonaktifkan akunnya sendiri saat sedang masuk
        if ((int) $currentUser->id === (int) $id && $request->has('is_active')) {
            $isActiveInput = filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN);
            if (!$isActiveInput) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak dapat menonaktifkan akun Anda sendiri saat sedang masuk.',
                    'errors' => [
                        'is_active' => ['Anda tidak dapat menonaktifkan akun Anda sendiri saat sedang masuk.'],
                    ],
                ], 422);
            }
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => [
                'sometimes',
                'required',
                'email',
                'max:255',
                Rule::unique('users')->ignore($user->id),
            ],
            'role' => [
                'sometimes',
                'required',
                Rule::in(['admin', 'pimpinan', 'project_manager', 'member']),
            ],
            'phone' => 'nullable|string|max:30',
            'password' => 'nullable|string|min:6',
            'is_active' => 'sometimes|boolean',
        ], [
            'name.required' => 'Nama pengguna wajib diisi.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email ini sudah digunakan oleh akun lain.',
            'role.required' => 'Peran pengguna wajib dipilih.',
            'role.in' => 'Peran pengguna tidak valid.',
            'password.min' => 'Password minimal 6 karakter jika ingin diubah.',
        ]);

        DB::transaction(function () use ($user, $validated, $currentUser) {
            $dataToUpdate = [
                'name' => $validated['name'] ?? $user->name,
                'email' => $validated['email'] ?? $user->email,
                'role' => $validated['role'] ?? $user->role,
                'phone' => array_key_exists('phone', $validated)
                    ? $validated['phone']
                    : $user->phone,
                'is_active' => array_key_exists('is_active', $validated)
                    ? $validated['is_active']
                    : $user->is_active,
            ];

            if (!empty($validated['password'])) {
                $dataToUpdate['password'] = Hash::make($validated['password']);
            }

            $user->update($dataToUpdate);

            // Jika akun dinonaktifkan, cabut seluruh token login aktif pengguna tersebut
            if (array_key_exists('is_active', $validated) && !$validated['is_active']) {
                $user->tokens()->delete();
            }

            Activity::create([
                'user_name' => $currentUser ? $currentUser->name : 'Sistem PKM',
                'action' => 'memperbarui data akun ' . $user->name,
                'target_name' => $user->name,
                'project_name' => 'User Management',
                'avatar_color' => '#FFD83D',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Pengguna berhasil diperbarui.',
            'user' => $user->fresh(),
        ]);
    }

    /**
     * Delete user (admin only, prevent self-deletion).
     */
    public function destroy(Request $request, $id)
    {
        $currentUser = $request->user();

        if (!$currentUser || $currentUser->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya Super Admin yang dapat menghapus pengguna.',
            ], 403);
        }

        if ((int) $currentUser->id === (int) $id) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak dapat menghapus akun Anda sendiri saat sedang masuk.',
                'errors' => [
                    'user' => ['Anda tidak dapat menghapus akun Anda sendiri saat sedang masuk.'],
                ],
            ], 422);
        }

        $user = User::findOrFail($id);
        $name = $user->name;

        // Audit Retensi PM-K: Cegah penghapusan user yang telah menyusun laporan terpublikasi
        if ($user->projectReports()->where('status', 'published')->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Pengguna tidak dapat dihapus karena tercatat sebagai penyusun laporan mingguan yang telah terpublikasi. Nonaktifkan status akun pengguna alih-alih menghapusnya demi integritas riwayat pelaporan.',
            ], 422);
        }

        DB::transaction(function () use ($user, $name, $currentUser) {
            // Defensif: pastikan referensi PIC dan Assignee dilepas ke NULL (tanpa menghapus proyek/tugas)
            Project::where('pic_id', $user->id)->update(['pic_id' => null]);
            Task::where('assignee_id', $user->id)->update(['assignee_id' => null]);

            $user->tokens()->delete();
            $user->delete();

            Activity::create([
                'user_name' => $currentUser ? $currentUser->name : 'Sistem PKM',
                'action' => 'menghapus pengguna ' . $name,
                'target_name' => $name,
                'project_name' => 'User Management',
                'avatar_color' => '#171717',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Pengguna berhasil dihapus. Data proyek dan tugas tetap tersimpan dengan aman.',
        ]);
    }

    /**
     * Toggle active/inactive status (admin only, prevent self-deactivation).
     */
    public function toggleStatus(Request $request, $id)
    {
        $currentUser = $request->user();

        if (!$currentUser || $currentUser->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya Super Admin yang dapat mengubah status akun pengguna.',
            ], 403);
        }

        $user = User::findOrFail($id);

        // Jika mencoba menonaktifkan akun sendiri
        if ((int) $currentUser->id === (int) $id && $user->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak dapat menonaktifkan akun Anda sendiri saat sedang masuk.',
                'errors' => [
                    'is_active' => ['Anda tidak dapat menonaktifkan akun Anda sendiri saat sedang masuk.'],
                ],
            ], 422);
        }

        DB::transaction(function () use ($user, $currentUser) {
            $user->is_active = !$user->is_active;
            if (!$user->is_active) {
                $user->tokens()->delete();
            }
            $user->save();

            Activity::create([
                'user_name' => $currentUser ? $currentUser->name : 'Sistem PKM',
                'action' => ($user->is_active ? 'mengaktifkan' : 'menonaktifkan') . ' akun ' . $user->name,
                'target_name' => $user->name,
                'project_name' => 'User Management',
                'avatar_color' => $user->is_active ? '#10B981' : '#FF2F92',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Status akun ' . $user->name . ' berhasil diubah menjadi ' . ($user->is_active ? 'Aktif' : 'Nonaktif') . '.',
            'user' => $user->fresh(),
        ]);
    }

    /**
     * Team directory endpoint with search, filters, sorting, and aggregated workload.
     */
    public function team(Request $request)
    {
        $today = now()->toDateString();

        $query = User::query();

        // Filter status
        if ($request->has('status') && $request->status !== 'all') {
            $isActive = $request->status === 'active' || filter_var($request->status, FILTER_VALIDATE_BOOLEAN);
            $query->where('is_active', $isActive);
        }

        // Filter role
        if ($request->filled('role') && $request->role !== 'all') {
            $query->where('role', $request->role);
        }

        // Search name, email, phone
        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $users = $query->with(['projects' => function ($q) {
            $q->select('id', 'code', 'name', 'client', 'status', 'progress', 'pic_id');
        }])->get();

        // Dapatkan task statistics per user (baik via assignee_id maupun fallback assignee_name)
        $userIds = $users->pluck('id')->toArray();
        $userNames = $users->pluck('name')->toArray();

        $tasks = Task::where(function ($q) use ($userIds, $userNames) {
            $q->whereIn('assignee_id', $userIds)
              ->orWhereIn('assignee_name', $userNames);
        })->get();

        $teamData = $users->map(function ($user) use ($tasks, $today) {
            $userTasks = $tasks->filter(function ($t) use ($user) {
                return (int) $t->assignee_id === (int) $user->id
                    || ($t->assignee_name && strcasecmp(trim($t->assignee_name), trim($user->name)) === 0);
            });

            $totalTasks = $userTasks->count();
            $completedTasks = $userTasks->filter(fn($t) => $t->is_completed || $t->status === 'completed')->count();
            $inProgressTasks = $userTasks->filter(fn($t) => !$t->is_completed && $t->status === 'in_progress')->count();
            $pendingTasks = $totalTasks - $completedTasks;
            $overdueTasks = $userTasks->filter(function ($t) use ($today) {
                return !$t->is_completed && $t->status !== 'completed' && $t->deadline && $t->deadline < $today;
            })->count();

            $projects = $user->projects;
            $projectsCount = $projects->count();

            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'phone' => $user->phone ?? '-',
                'status' => $user->is_active ? 'active' : 'inactive',
                'is_active' => (bool) $user->is_active,
                'projects_count' => $projectsCount,
                'projects' => $projects,
                'stats' => [
                    'total_tasks' => $totalTasks,
                    'completed_tasks' => $completedTasks,
                    'in_progress_tasks' => $inProgressTasks,
                    'pending_tasks' => $pendingTasks,
                    'overdue_tasks' => $overdueTasks,
                    'completion_rate' => $totalTasks > 0
                        ? (int) round(($completedTasks / $totalTasks) * 100)
                        : 0,
                ],
            ];
        });

        // Sorting
        $sort = $request->input('sort', 'name');
        $order = strtolower($request->input('order', 'asc')) === 'desc' ? 'desc' : 'asc';

        if ($sort === 'tasks_count') {
            $teamData = $order === 'desc'
                ? $teamData->sortByDesc('stats.total_tasks')->values()
                : $teamData->sortBy('stats.total_tasks')->values();
        } elseif ($sort === 'projects_count') {
            $teamData = $order === 'desc'
                ? $teamData->sortByDesc('projects_count')->values()
                : $teamData->sortBy('projects_count')->values();
        } elseif ($sort === 'completion_rate') {
            $teamData = $order === 'desc'
                ? $teamData->sortByDesc('stats.completion_rate')->values()
                : $teamData->sortBy('stats.completion_rate')->values();
        } else {
            $teamData = $order === 'desc'
                ? $teamData->sortByDesc('name')->values()
                : $teamData->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)->values();
        }

        // Global workload summary
        $allTasks = Task::all();
        $totalMembers = User::count();
        $activeMembers = User::where('is_active', true)->count();
        $totalSystemTasks = $allTasks->count();
        $inProgressSystemTasks = $allTasks->filter(fn($t) => !$t->is_completed && $t->status === 'in_progress')->count();
        $pendingSystemTasks = $allTasks->filter(fn($t) => !$t->is_completed && $t->status !== 'completed')->count();
        $overdueSystemTasks = $allTasks->filter(fn($t) => !$t->is_completed && $t->status !== 'completed' && $t->deadline && $t->deadline < $today)->count();

        return response()->json([
            'team' => $teamData,
            'total' => $teamData->count(),
            'summary' => [
                'total_members' => $totalMembers,
                'active_members' => $activeMembers,
                'total_tasks' => $totalSystemTasks,
                'in_progress_tasks' => $inProgressSystemTasks,
                'pending_tasks' => $pendingSystemTasks,
                'overdue_tasks' => $overdueSystemTasks,
            ],
        ]);
    }

    /**
     * Detail personel lengkap: profil, proyek yang ditangani (PIC), dan tugas terhubung.
     */
    public function teamMember($id)
    {
        $today = now()->toDateString();
        $user = User::findOrFail($id);

        // Ambil proyek di mana user adalah PIC
        $projects = Project::where('pic_id', $user->id)
            ->select('id', 'code', 'name', 'client', 'status', 'progress', 'category', 'deadline')
            ->get()
            ->map(function ($p) {
                $p->setAttribute('role_in_project', 'PIC Proyek');
                return $p;
            });

        // Ambil tugas yang ditugaskan ke user
        $tasks = Task::with([
            'project:id,code,name',
            'milestone:id,title,phase_order,status',
        ])
        ->where(function ($q) use ($user) {
            $q->where('assignee_id', $user->id)
              ->orWhere('assignee_name', $user->name);
        })
        ->orderBy('is_completed', 'asc')
        ->orderByRaw("FIELD(priority, 'high', 'medium', 'low')")
        ->orderByRaw("deadline IS NULL, deadline ASC")
        ->get();

        $totalTasks = $tasks->count();
        $completedTasks = $tasks->filter(fn($t) => $t->is_completed || $t->status === 'completed')->count();
        $inProgressTasks = $tasks->filter(fn($t) => !$t->is_completed && $t->status === 'in_progress')->count();
        $pendingTasks = $totalTasks - $completedTasks;
        $overdueTasks = $tasks->filter(function ($t) use ($today) {
            return !$t->is_completed && $t->status !== 'completed' && $t->deadline && $t->deadline < $today;
        })->count();

        $completionRate = $totalTasks > 0
            ? (int) round(($completedTasks / $totalTasks) * 100)
            : 0;

        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'phone' => $user->phone ?? '-',
                'status' => $user->is_active ? 'active' : 'inactive',
                'is_active' => (bool) $user->is_active,
                'created_at' => $user->created_at ? $user->created_at->format('Y-m-d') : null,
            ],
            'projects' => $projects,
            'tasks' => $tasks,
            'stats' => [
                'total_projects' => $projects->count(),
                'total_tasks' => $totalTasks,
                'completed_tasks' => $completedTasks,
                'in_progress_tasks' => $inProgressTasks,
                'pending_tasks' => $pendingTasks,
                'overdue_tasks' => $overdueTasks,
                'completion_rate' => $completionRate,
            ],
        ]);
    }

    /**
     * Update current authenticated user profile.
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:30',
            'current_password' => 'nullable|string',
            'new_password' => 'nullable|string|min:6|confirmed',
        ], [
            'name.required' => 'Nama lengkap wajib diisi.',
            'new_password.min' => 'Password baru minimal 6 karakter.',
            'new_password.confirmed' => 'Konfirmasi password baru tidak cocok.',
        ]);

        if (!empty($validated['new_password'])) {
            if (
                empty($validated['current_password']) ||
                !Hash::check($validated['current_password'], $user->password)
            ) {
                return response()->json([
                    'success' => false,
                    'message' => 'Password saat ini salah.',
                    'errors' => [
                        'current_password' => [
                            'Password saat ini yang Anda masukkan salah.',
                        ],
                    ],
                ], 422);
            }

            $user->password = Hash::make($validated['new_password']);
        }

        $user->name = $validated['name'];

        if (array_key_exists('phone', $validated)) {
            $user->phone = $validated['phone'];
        }

        $user->save();

        Activity::create([
            'user_name' => $user->name,
            'action' => 'memperbarui profil akun',
            'target_name' => $user->name,
            'project_name' => 'Account Settings',
            'avatar_color' => '#B8A0F0',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Profil berhasil diperbarui.',
            'user' => $user,
        ]);
    }
}
