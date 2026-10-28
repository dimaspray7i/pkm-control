<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
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
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $users = $query->orderBy('name', 'asc')->get();

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
        if ($currentUser && $currentUser->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya Super Admin yang dapat menambahkan pengguna.',
            ], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'role' => ['required', Rule::in(['admin', 'pimpinan', 'project_manager', 'member'])],
            'phone' => 'nullable|string|max:30',
            'password' => 'required|string|min:6',
            'is_active' => 'boolean',
        ], [
            'name.required' => 'Nama pengguna wajib diisi.',
            'email.required' => 'Email wajib diisi.',
            'email.unique' => 'Email ini sudah terdaftar.',
            'role.required' => 'Peran pengguna wajib dipilih.',
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
                'user_name' => $currentUser ? $currentUser->name : 'System',
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
        $user = User::findOrFail($id);
        return response()->json([
            'user' => $user,
        ]);
    }

    /**
     * Update user (admin only).
     */
    public function update(Request $request, $id)
    {
        $currentUser = $request->user();
        if ($currentUser && $currentUser->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya Super Admin yang dapat memperbarui data pengguna.',
            ], 403);
        }

        $user = User::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'role' => ['sometimes', 'required', Rule::in(['admin', 'pimpinan', 'project_manager', 'member'])],
            'phone' => 'nullable|string|max:30',
            'password' => 'nullable|string|min:6',
            'is_active' => 'sometimes|boolean',
        ], [
            'email.unique' => 'Email ini sudah digunakan oleh akun lain.',
            'password.min' => 'Password minimal 6 karakter jika ingin diubah.',
        ]);

        DB::transaction(function () use ($user, $validated, $currentUser) {
            $dataToUpdate = [
                'name' => $validated['name'] ?? $user->name,
                'email' => $validated['email'] ?? $user->email,
                'role' => $validated['role'] ?? $user->role,
                'phone' => array_key_exists('phone', $validated) ? $validated['phone'] : $user->phone,
                'is_active' => array_key_exists('is_active', $validated) ? $validated['is_active'] : $user->is_active,
            ];

            if (!empty($validated['password'])) {
                $dataToUpdate['password'] = Hash::make($validated['password']);
            }

            $user->update($dataToUpdate);

            Activity::create([
                'user_name' => $currentUser ? $currentUser->name : 'System',
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
        if ($currentUser && $currentUser->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya Super Admin yang dapat menghapus pengguna.',
            ], 403);
        }

        if ($currentUser && (int) $currentUser->id === (int) $id) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak dapat menghapus akun Anda sendiri saat sedang masuk.',
            ], 422);
        }

        $user = User::findOrFail($id);
        $name = $user->name;

        DB::transaction(function () use ($user, $name, $currentUser) {
            $user->tokens()->delete();
            $user->delete();

            Activity::create([
                'user_name' => $currentUser ? $currentUser->name : 'System',
                'action' => 'menghapus pengguna ' . $name,
                'target_name' => $name,
                'project_name' => 'User Management',
                'avatar_color' => '#171717',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Pengguna berhasil dihapus.',
        ]);
    }

    /**
     * Team directory endpoint with aggregated task workload.
     */
    public function team()
    {
        $users = User::where('is_active', true)->get();

        $teamData = $users->map(function ($u) {
            // Count tasks assigned to this user's name
            $totalTasks = Task::where('assignee_name', $u->name)->count();
            $completedTasks = Task::where('assignee_name', $u->name)->where('is_completed', true)->count();
            $pendingTasks = $totalTasks - $completedTasks;
            $overdueTasks = Task::where('assignee_name', $u->name)
                ->where('is_completed', false)
                ->whereNotNull('deadline')
                ->where('deadline', '<', now()->toDateString())
                ->count();

            return [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role,
                'phone' => $u->phone ?? '-',
                'status' => $u->is_active ? 'active' : 'inactive',
                'stats' => [
                    'total_tasks' => $totalTasks,
                    'completed_tasks' => $completedTasks,
                    'pending_tasks' => $pendingTasks,
                    'overdue_tasks' => $overdueTasks,
                    'completion_rate' => $totalTasks > 0 ? (int) round(($completedTasks / $totalTasks) * 100) : 100,
                ],
            ];
        });

        return response()->json([
            'team' => $teamData,
            'total' => $teamData->count(),
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
            if (empty($validated['current_password']) || !Hash::check($validated['current_password'], $user->password)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Password saat ini salah.',
                    'errors' => [
                        'current_password' => ['Password saat ini yang Anda masukkan salah.'],
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
