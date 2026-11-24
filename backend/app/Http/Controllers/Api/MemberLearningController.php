<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MemberDevelopmentFeedback;
use App\Models\MemberDevelopmentGoal;
use App\Models\MemberDevelopmentMilestone;
use App\Models\MemberLearningActivity;
use App\Models\MemberSkill;
use App\Models\User;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class MemberLearningController extends Controller
{
    /**
     * GET /api/member/learning/overview
     *
     * Ringkasan Pengembangan Diri & KPI Pembelajaran Personal Member.
     */
    public function overview(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user || $user->role !== 'member') {
            return response()->json([
                'message' => 'Endpoint ini hanya tersedia untuk anggota tim (member).',
            ], 403);
        }

        $userId = (int) $user->id;
        $now = Carbon::now('Asia/Jakarta');
        $todayStr = $now->toDateString();
        $in14DaysStr = $now->copy()->addDays(14)->toDateString();

        // 1. KPI Metrik Utama
        $totalSkills = MemberSkill::where('user_id', $userId)->count();

        $activeGoalsCount = MemberDevelopmentGoal::where('user_id', $userId)
            ->whereIn('status', ['planned', 'in_progress'])
            ->count();

        $completedGoalsCount = MemberDevelopmentGoal::where('user_id', $userId)
            ->where('status', 'completed')
            ->count();

        $totalActivities = MemberLearningActivity::where('user_id', $userId)
            ->where('status', 'completed')
            ->count();

        $totalDurationMinutes = (int) MemberLearningActivity::where('user_id', $userId)
            ->where('status', 'completed')
            ->sum('duration_minutes');

        $learningHours = $totalDurationMinutes > 0 ? round($totalDurationMinutes / 60, 1) : 0.0;

        $upcomingDeadlineGoals = MemberDevelopmentGoal::where('user_id', $userId)
            ->whereIn('status', ['planned', 'in_progress'])
            ->whereNotNull('target_date')
            ->whereBetween('target_date', [$todayStr, $in14DaysStr])
            ->count();

        // Overall progress: rata-rata progres target aktif
        $activeGoals = MemberDevelopmentGoal::where('user_id', $userId)
            ->whereIn('status', ['planned', 'in_progress'])
            ->get();

        $overallProgress = $activeGoals->count() > 0 ? (int) round($activeGoals->avg('progress')) : 0;

        // 2. Daftar Ringkasan Target Aktif (maksimal 5)
        $activeGoalsList = MemberDevelopmentGoal::with(['skill:id,name,category', 'milestones'])
            ->where('user_id', $userId)
            ->whereIn('status', ['planned', 'in_progress'])
            ->orderByRaw('CASE WHEN target_date IS NULL THEN 1 ELSE 0 END, target_date ASC')
            ->limit(5)
            ->get();

        // 3. Aktivitas Pembelajaran Terbaru (maksimal 5)
        $recentActivities = MemberLearningActivity::with(['skill:id,name,category', 'goal:id,title'])
            ->where('user_id', $userId)
            ->orderBy('activity_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get();

        // 4. Kompetensi yang Sedang Dikembangkan (terhubung ke target aktif)
        $developingSkillIds = $activeGoals->pluck('skill_id')->filter()->unique();
        $developingSkills = MemberSkill::whereIn('id', $developingSkillIds)->get();

        // 5. Feedback PM Terbaru
        $recentFeedbacks = MemberDevelopmentFeedback::with(['reviewer:id,name,role', 'goal:id,title'])
            ->where('user_id', $userId)
            ->orderBy('created_at', 'desc')
            ->limit(3)
            ->get();

        return response()->json([
            'summary' => [
                'total_skills'            => $totalSkills,
                'active_goals'            => $activeGoalsCount,
                'completed_goals'         => $completedGoalsCount,
                'total_activities'        => $totalActivities,
                'total_duration_minutes'  => $totalDurationMinutes,
                'learning_hours'          => $learningHours,
                'upcoming_deadline_goals' => $upcomingDeadlineGoals,
                'overall_progress'        => $overallProgress,
            ],
            'active_goals'       => $activeGoalsList,
            'recent_activities'  => $recentActivities,
            'developing_skills'  => $developingSkills,
            'recent_feedbacks'   => $recentFeedbacks,
            'meta'               => [
                'member_id'    => $userId,
                'member_name'  => $user->name,
                'generated_at' => $now->toISOString(),
            ],
        ]);
    }

    // =========================================================================
    // SKILLS & COMPETENCIES CRUD
    // =========================================================================

    /**
     * GET /api/member/learning/skills
     */
    public function indexSkills(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== 'member') {
            return response()->json(['message' => 'Hanya untuk anggota tim (member).'], 403);
        }

        $skills = MemberSkill::withCount(['goals', 'activities'])
            ->where('user_id', $user->id)
            ->orderBy('category')
            ->orderBy('name')
            ->get();

        return response()->json([
            'skills' => $skills,
            'count'  => $skills->count(),
        ]);
    }

    /**
     * POST /api/member/learning/skills
     */
    public function storeSkill(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== 'member') {
            return response()->json(['message' => 'Hanya untuk anggota tim (member).'], 403);
        }

        $validator = Validator::make($request->all(), [
            'name'             => ['required', 'string', 'max:255'],
            'category'         => ['required', 'string', 'max:100'],
            'description'      => ['nullable', 'string'],
            'current_level'    => ['required', 'integer', 'min:1', 'max:5'],
            'target_level'     => ['required', 'integer', 'min:1', 'max:5'],
            'experience_notes' => ['nullable', 'string'],
            'evidence_url'     => ['nullable', 'url', 'max:500'],
            'evidence_notes'   => ['nullable', 'string'],
        ], [
            'name.required'          => 'Nama kompetensi wajib diisi.',
            'category.required'      => 'Kategori kompetensi wajib dipilih.',
            'current_level.required' => 'Tingkat kemampuan saat ini wajib ditentukan.',
            'current_level.min'      => 'Tingkat kemampuan minimal adalah 1 (Beginner).',
            'current_level.max'      => 'Tingkat kemampuan maksimal adalah 5 (Expert).',
            'target_level.required'  => 'Target tingkat kemampuan wajib ditentukan.',
            'target_level.min'       => 'Target kemampuan minimal adalah 1 (Beginner).',
            'target_level.max'       => 'Target kemampuan maksimal adalah 5 (Expert).',
            'evidence_url.url'       => 'Format URL bukti pendukung tidak valid.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validasi data kompetensi gagal.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $trimmedName = trim($request->name);

        // Cek duplikasi nama kompetensi pada user yang sama
        $exists = MemberSkill::where('user_id', $user->id)
            ->whereRaw('LOWER(name) = ?', [strtolower($trimmedName)])
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => "Kompetensi dengan nama '{$trimmedName}' sudah terdaftar dalam profil Anda.",
                'errors'  => ['name' => ['Kompetensi ini sudah terdaftar.']],
            ], 422);
        }

        $skill = MemberSkill::create([
            'user_id'          => $user->id,
            'name'             => $trimmedName,
            'category'         => $request->category,
            'description'      => $request->description,
            'current_level'    => (int) $request->current_level,
            'target_level'     => (int) $request->target_level,
            'experience_notes' => $request->experience_notes,
            'evidence_url'     => $request->evidence_url,
            'evidence_notes'   => $request->evidence_notes,
        ]);

        return response()->json([
            'message' => 'Kompetensi berhasil dicatat.',
            'skill'   => $skill,
        ], 201);
    }

    /**
     * PUT /api/member/learning/skills/{id}
     */
    public function updateSkill(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== 'member') {
            return response()->json(['message' => 'Hanya untuk anggota tim (member).'], 403);
        }

        $skill = MemberSkill::findOrFail($id);

        if ((int) $skill->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Anda tidak memiliki hak akses mengubah kompetensi ini.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'name'             => ['sometimes', 'required', 'string', 'max:255'],
            'category'         => ['sometimes', 'required', 'string', 'max:100'],
            'description'      => ['nullable', 'string'],
            'current_level'    => ['sometimes', 'required', 'integer', 'min:1', 'max:5'],
            'target_level'     => ['sometimes', 'required', 'integer', 'min:1', 'max:5'],
            'experience_notes' => ['nullable', 'string'],
            'evidence_url'     => ['nullable', 'url', 'max:500'],
            'evidence_notes'   => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validasi pembaruan kompetensi gagal.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        if ($request->has('name')) {
            $trimmedName = trim($request->name);
            $duplicate = MemberSkill::where('user_id', $user->id)
                ->where('id', '!=', $skill->id)
                ->whereRaw('LOWER(name) = ?', [strtolower($trimmedName)])
                ->exists();

            if ($duplicate) {
                return response()->json([
                    'message' => "Kompetensi dengan nama '{$trimmedName}' sudah terdaftar.",
                    'errors'  => ['name' => ['Nama kompetensi sudah digunakan.']],
                ], 422);
            }
            $skill->name = $trimmedName;
        }

        $skill->fill($request->only([
            'category',
            'description',
            'current_level',
            'target_level',
            'experience_notes',
            'evidence_url',
            'evidence_notes',
        ]));

        $skill->save();

        return response()->json([
            'message' => 'Kompetensi berhasil diperbarui.',
            'skill'   => $skill,
        ]);
    }

    /**
     * DELETE /api/member/learning/skills/{id}
     */
    public function destroySkill(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== 'member') {
            return response()->json(['message' => 'Hanya untuk anggota tim (member).'], 403);
        }

        $skill = MemberSkill::findOrFail($id);

        if ((int) $skill->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Anda tidak memiliki hak akses menghapus kompetensi ini.'], 403);
        }

        $skill->delete();

        return response()->json(['message' => 'Kompetensi berhasil dihapus.']);
    }

    // =========================================================================
    // DEVELOPMENT GOALS CRUD
    // =========================================================================

    /**
     * GET /api/member/learning/goals
     */
    public function indexGoals(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== 'member') {
            return response()->json(['message' => 'Hanya untuk anggota tim (member).'], 403);
        }

        $query = MemberDevelopmentGoal::with(['skill:id,name,category', 'milestones'])
            ->where('user_id', $user->id);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $goals = $query->orderByRaw('CASE WHEN target_date IS NULL THEN 1 ELSE 0 END, target_date ASC')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'goals' => $goals,
            'count' => $goals->count(),
        ]);
    }

    /**
     * POST /api/member/learning/goals
     */
    public function storeGoal(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== 'member') {
            return response()->json(['message' => 'Hanya untuk anggota tim (member).'], 403);
        }

        $validator = Validator::make($request->all(), [
            'title'               => ['required', 'string', 'max:255'],
            'skill_id'            => ['nullable', 'exists:member_skills,id'],
            'description'         => ['nullable', 'string'],
            'current_level'       => ['nullable', 'integer', 'min:1', 'max:5'],
            'target_level'        => ['nullable', 'integer', 'min:1', 'max:5'],
            'reason'              => ['nullable', 'string'],
            'target_date'         => ['nullable', 'date'],
            'priority'            => ['nullable', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'status'              => ['nullable', Rule::in(['planned', 'in_progress', 'completed', 'paused', 'cancelled'])],
            'notes'               => ['nullable', 'string'],
            'milestones'          => ['nullable', 'array'],
            'milestones.*.title'  => ['required_with:milestones', 'string', 'max:255'],
        ], [
            'title.required' => 'Judul target pengembangan wajib diisi.',
            'target_date.date' => 'Format target tanggal penyelesaian tidak valid.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validasi target pengembangan gagal.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        // Jika skill_id disediakan, pastikan milik user yang login
        if ($request->filled('skill_id')) {
            $skill = MemberSkill::find($request->skill_id);
            if (!$skill || (int) $skill->user_id !== (int) $user->id) {
                return response()->json([
                    'message' => 'Kompetensi yang dipilih tidak valid atau bukan milik Anda.',
                    'errors'  => ['skill_id' => ['Kompetensi tidak valid.']],
                ], 422);
            }
        }

        $goal = DB::transaction(function () use ($request, $user) {
            $status = $request->status ?? 'planned';
            $isCompleted = $status === 'completed';

            $newGoal = MemberDevelopmentGoal::create([
                'user_id'       => $user->id,
                'skill_id'      => $request->skill_id,
                'title'         => trim($request->title),
                'description'   => $request->description,
                'current_level' => $request->current_level,
                'target_level'  => $request->target_level,
                'reason'        => $request->reason,
                'target_date'   => $request->target_date,
                'priority'      => $request->priority ?? 'medium',
                'status'        => $status,
                'progress'      => $isCompleted ? 100 : 0,
                'notes'         => $request->notes,
                'completed_at'  => $isCompleted ? Carbon::now('Asia/Jakarta') : null,
            ]);

            // Jika ada milestones awal
            if ($request->has('milestones') && is_array($request->milestones)) {
                $order = 1;
                foreach ($request->milestones as $m) {
                    if (!empty($m['title'])) {
                        MemberDevelopmentMilestone::create([
                            'goal_id'      => $newGoal->id,
                            'title'        => trim($m['title']),
                            'description'  => $m['description'] ?? null,
                            'order'        => $order++,
                            'target_date'  => $m['target_date'] ?? null,
                            'is_completed' => false,
                        ]);
                    }
                }
                $newGoal->recalculateProgress();
            }

            return $newGoal;
        });

        $goal->load(['skill', 'milestones']);

        return response()->json([
            'message' => 'Target pengembangan berhasil dibuat.',
            'goal'    => $goal,
        ], 201);
    }

    /**
     * GET /api/member/learning/goals/{id}
     */
    public function showGoal(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== 'member') {
            return response()->json(['message' => 'Hanya untuk anggota tim (member).'], 403);
        }

        $goal = MemberDevelopmentGoal::with([
            'skill',
            'milestones',
            'activities',
            'feedbacks.reviewer:id,name,role',
        ])->findOrFail($id);

        if ((int) $goal->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Anda tidak memiliki hak akses target pengembangan ini.'], 403);
        }

        return response()->json(['goal' => $goal]);
    }

    /**
     * PUT /api/member/learning/goals/{id}
     */
    public function updateGoal(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== 'member') {
            return response()->json(['message' => 'Hanya untuk anggota tim (member).'], 403);
        }

        $goal = MemberDevelopmentGoal::findOrFail($id);

        if ((int) $goal->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Anda tidak memiliki hak akses mengubah target pengembangan ini.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'title'               => ['sometimes', 'required', 'string', 'max:255'],
            'skill_id'            => ['nullable', 'exists:member_skills,id'],
            'description'         => ['nullable', 'string'],
            'current_level'       => ['nullable', 'integer', 'min:1', 'max:5'],
            'target_level'        => ['nullable', 'integer', 'min:1', 'max:5'],
            'reason'              => ['nullable', 'string'],
            'target_date'         => ['nullable', 'date'],
            'priority'            => ['nullable', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'status'              => ['nullable', Rule::in(['planned', 'in_progress', 'completed', 'paused', 'cancelled'])],
            'cancellation_reason' => ['nullable', 'string'],
            'progress'            => ['nullable', 'integer', 'min:0', 'max:100'],
            'notes'               => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validasi pembaruan target pengembangan gagal.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        if ($request->filled('skill_id')) {
            $skill = MemberSkill::find($request->skill_id);
            if (!$skill || (int) $skill->user_id !== (int) $user->id) {
                return response()->json([
                    'message' => 'Kompetensi tidak valid atau bukan milik Anda.',
                    'errors'  => ['skill_id' => ['Kompetensi tidak valid.']],
                ], 422);
            }
        }

        // Aturan transisi status
        if ($request->has('status')) {
            $newStatus = $request->status;
            if ($newStatus === 'completed') {
                $goal->status = 'completed';
                $goal->progress = 100;
                $goal->completed_at = Carbon::now('Asia/Jakarta');
            } elseif ($newStatus === 'cancelled') {
                $goal->status = 'cancelled';
                $goal->cancellation_reason = $request->cancellation_reason ?? 'Dibatalkan oleh Member.';
            } else {
                $goal->status = $newStatus;
                if ($goal->status !== 'completed') {
                    $goal->completed_at = null;
                }
            }
        }

        $goal->fill($request->only([
            'title',
            'skill_id',
            'description',
            'current_level',
            'target_level',
            'reason',
            'target_date',
            'priority',
            'notes',
        ]));

        if ($request->has('progress') && $goal->status !== 'completed') {
            $goal->progress = (int) $request->progress;
        }

        $goal->save();
        $goal->load(['skill', 'milestones']);

        return response()->json([
            'message' => 'Target pengembangan berhasil diperbarui.',
            'goal'    => $goal,
        ]);
    }

    /**
     * DELETE /api/member/learning/goals/{id}
     */
    public function destroyGoal(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== 'member') {
            return response()->json(['message' => 'Hanya untuk anggota tim (member).'], 403);
        }

        $goal = MemberDevelopmentGoal::findOrFail($id);

        if ((int) $goal->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Anda tidak memiliki hak akses menghapus target pengembangan ini.'], 403);
        }

        $goal->delete();

        return response()->json(['message' => 'Target pengembangan berhasil dihapus.']);
    }

    // =========================================================================
    // MILESTONES
    // =========================================================================

    /**
     * POST /api/member/learning/goals/{id}/milestones
     */
    public function storeMilestone(Request $request, int $goalId): JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== 'member') {
            return response()->json(['message' => 'Hanya untuk anggota tim (member).'], 403);
        }

        $goal = MemberDevelopmentGoal::findOrFail($goalId);

        if ((int) $goal->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Anda tidak dapat menambahkan milestone ke target milik orang lain.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'title'        => ['required', 'string', 'max:255'],
            'description'  => ['nullable', 'string'],
            'order'        => ['nullable', 'integer'],
            'target_date'  => ['nullable', 'date'],
            'is_completed' => ['nullable', 'boolean'],
            'notes'        => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validasi milestone gagal.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $nextOrder = $request->order ?? ($goal->milestones()->max('order') + 1);
        $isCompleted = (bool) $request->is_completed;

        $milestone = MemberDevelopmentMilestone::create([
            'goal_id'      => $goal->id,
            'title'        => trim($request->title),
            'description'  => $request->description,
            'order'        => $nextOrder,
            'target_date'  => $request->target_date,
            'is_completed' => $isCompleted,
            'completed_at' => $isCompleted ? Carbon::now('Asia/Jakarta') : null,
            'notes'        => $request->notes,
        ]);

        $goal->recalculateProgress();

        return response()->json([
            'message'   => 'Milestone berhasil ditambahkan.',
            'milestone' => $milestone,
            'progress'  => $goal->progress,
        ], 201);
    }

    /**
     * PUT /api/member/learning/milestones/{id}
     */
    public function updateMilestone(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== 'member') {
            return response()->json(['message' => 'Hanya untuk anggota tim (member).'], 403);
        }

        $milestone = MemberDevelopmentMilestone::with('goal')->findOrFail($id);

        if ((int) $milestone->goal->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Anda tidak memiliki hak akses mengubah milestone ini.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'title'        => ['sometimes', 'required', 'string', 'max:255'],
            'description'  => ['nullable', 'string'],
            'order'        => ['nullable', 'integer'],
            'target_date'  => ['nullable', 'date'],
            'is_completed' => ['nullable', 'boolean'],
            'notes'        => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validasi pembaruan milestone gagal.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        if ($request->has('is_completed')) {
            $milestone->is_completed = (bool) $request->is_completed;
            $milestone->completed_at = $milestone->is_completed ? Carbon::now('Asia/Jakarta') : null;
        }

        $milestone->fill($request->only([
            'title',
            'description',
            'order',
            'target_date',
            'notes',
        ]));

        $milestone->save();

        $milestone->goal->recalculateProgress();

        return response()->json([
            'message'   => 'Milestone berhasil diperbarui.',
            'milestone' => $milestone,
            'progress'  => $milestone->goal->progress,
        ]);
    }

    /**
     * DELETE /api/member/learning/milestones/{id}
     */
    public function destroyMilestone(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== 'member') {
            return response()->json(['message' => 'Hanya untuk anggota tim (member).'], 403);
        }

        $milestone = MemberDevelopmentMilestone::with('goal')->findOrFail($id);

        if ((int) $milestone->goal->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Anda tidak memiliki hak akses menghapus milestone ini.'], 403);
        }

        $goal = $milestone->goal;
        $milestone->delete();

        $goal->recalculateProgress();

        return response()->json([
            'message'  => 'Milestone berhasil dihapus.',
            'progress' => $goal->progress,
        ]);
    }

    // =========================================================================
    // LEARNING ACTIVITIES CRUD
    // =========================================================================

    /**
     * GET /api/member/learning/activities
     */
    public function indexActivities(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== 'member') {
            return response()->json(['message' => 'Hanya untuk anggota tim (member).'], 403);
        }

        $query = MemberLearningActivity::with(['skill:id,name,category', 'goal:id,title,status'])
            ->where('user_id', $user->id);

        if ($request->filled('activity_type')) {
            $query->where('activity_type', $request->activity_type);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $activities = $query->orderBy('activity_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'activities' => $activities,
            'count'      => $activities->count(),
        ]);
    }

    /**
     * POST /api/member/learning/activities
     */
    public function storeActivity(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== 'member') {
            return response()->json(['message' => 'Hanya untuk anggota tim (member).'], 403);
        }

        $validator = Validator::make($request->all(), [
            'title'            => ['required', 'string', 'max:255'],
            'activity_type'    => [
                'required',
                Rule::in([
                    'self_learning',
                    'online_course',
                    'offline_training',
                    'workshop',
                    'mentoring',
                    'reading_research',
                    'practice_experiment',
                    'other',
                ]),
            ],
            'description'      => ['nullable', 'string'],
            'activity_date'    => ['required', 'date'],
            'duration_minutes' => ['nullable', 'integer', 'min:1'],
            'learning_source'  => ['nullable', 'string', 'max:255'],
            'learning_notes'   => ['nullable', 'string'],
            'evidence_url'     => ['nullable', 'url', 'max:500'],
            'status'           => ['nullable', Rule::in(['planned', 'in_progress', 'completed'])],
            'skill_id'         => ['nullable', 'exists:member_skills,id'],
            'goal_id'          => ['nullable', 'exists:member_development_goals,id'],
        ], [
            'title.required'         => 'Judul aktivitas pembelajaran wajib diisi.',
            'activity_type.required' => 'Jenis aktivitas pembelajaran wajib dipilih.',
            'activity_date.required' => 'Tanggal pelaksanaan aktivitas wajib diisi.',
            'evidence_url.url'       => 'Format URL bukti pembelajaran tidak valid.',
            'duration_minutes.min'   => 'Durasi pembelajaran minimal 1 menit.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validasi aktivitas pembelajaran gagal.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        // Verifikasi kepemilikan skill dan goal jika disediakan
        if ($request->filled('skill_id')) {
            $skill = MemberSkill::find($request->skill_id);
            if (!$skill || (int) $skill->user_id !== (int) $user->id) {
                return response()->json([
                    'message' => 'Kompetensi tidak valid atau bukan milik Anda.',
                    'errors'  => ['skill_id' => ['Kompetensi tidak valid.']],
                ], 422);
            }
        }

        if ($request->filled('goal_id')) {
            $goal = MemberDevelopmentGoal::find($request->goal_id);
            if (!$goal || (int) $goal->user_id !== (int) $user->id) {
                return response()->json([
                    'message' => 'Target pengembangan tidak valid atau bukan milik Anda.',
                    'errors'  => ['goal_id' => ['Target pengembangan tidak valid.']],
                ], 422);
            }
        }

        $activity = MemberLearningActivity::create([
            'user_id'          => $user->id,
            'skill_id'         => $request->skill_id,
            'goal_id'          => $request->goal_id,
            'title'            => trim($request->title),
            'activity_type'    => $request->activity_type,
            'description'      => $request->description,
            'activity_date'    => $request->activity_date,
            'duration_minutes' => $request->duration_minutes,
            'learning_source'  => $request->learning_source,
            'learning_notes'   => $request->learning_notes,
            'evidence_url'     => $request->evidence_url,
            'status'           => $request->status ?? 'completed',
        ]);

        $activity->load(['skill', 'goal']);

        return response()->json([
            'message'  => 'Aktivitas pembelajaran berhasil dicatat.',
            'activity' => $activity,
        ], 201);
    }

    /**
     * PUT /api/member/learning/activities/{id}
     */
    public function updateActivity(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== 'member') {
            return response()->json(['message' => 'Hanya untuk anggota tim (member).'], 403);
        }

        $activity = MemberLearningActivity::findOrFail($id);

        if ((int) $activity->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Anda tidak memiliki hak akses mengubah aktivitas ini.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'title'            => ['sometimes', 'required', 'string', 'max:255'],
            'activity_type'    => [
                'sometimes',
                'required',
                Rule::in([
                    'self_learning',
                    'online_course',
                    'offline_training',
                    'workshop',
                    'mentoring',
                    'reading_research',
                    'practice_experiment',
                    'other',
                ]),
            ],
            'description'      => ['nullable', 'string'],
            'activity_date'    => ['sometimes', 'required', 'date'],
            'duration_minutes' => ['nullable', 'integer', 'min:1'],
            'learning_source'  => ['nullable', 'string', 'max:255'],
            'learning_notes'   => ['nullable', 'string'],
            'evidence_url'     => ['nullable', 'url', 'max:500'],
            'status'           => ['nullable', Rule::in(['planned', 'in_progress', 'completed'])],
            'skill_id'         => ['nullable', 'exists:member_skills,id'],
            'goal_id'          => ['nullable', 'exists:member_development_goals,id'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validasi pembaruan aktivitas pembelajaran gagal.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        if ($request->filled('skill_id')) {
            $skill = MemberSkill::find($request->skill_id);
            if (!$skill || (int) $skill->user_id !== (int) $user->id) {
                return response()->json([
                    'message' => 'Kompetensi tidak valid.',
                    'errors'  => ['skill_id' => ['Kompetensi tidak valid.']],
                ], 422);
            }
        }

        if ($request->filled('goal_id')) {
            $goal = MemberDevelopmentGoal::find($request->goal_id);
            if (!$goal || (int) $goal->user_id !== (int) $user->id) {
                return response()->json([
                    'message' => 'Target pengembangan tidak valid.',
                    'errors'  => ['goal_id' => ['Target tidak valid.']],
                ], 422);
            }
        }

        $activity->fill($request->only([
            'title',
            'activity_type',
            'description',
            'activity_date',
            'duration_minutes',
            'learning_source',
            'learning_notes',
            'evidence_url',
            'status',
            'skill_id',
            'goal_id',
        ]));

        $activity->save();
        $activity->load(['skill', 'goal']);

        return response()->json([
            'message'  => 'Aktivitas pembelajaran berhasil diperbarui.',
            'activity' => $activity,
        ]);
    }

    /**
     * DELETE /api/member/learning/activities/{id}
     */
    public function destroyActivity(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== 'member') {
            return response()->json(['message' => 'Hanya untuk anggota tim (member).'], 403);
        }

        $activity = MemberLearningActivity::findOrFail($id);

        if ((int) $activity->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Anda tidak memiliki hak akses menghapus aktivitas ini.'], 403);
        }

        $activity->delete();

        return response()->json(['message' => 'Aktivitas pembelajaran berhasil dihapus.']);
    }

    // =========================================================================
    // PM FEEDBACK
    // =========================================================================

    /**
     * GET /api/member/learning/feedback
     *
     * Member melihat feedback yang ditujukan kepada dirinya.
     */
    public function indexFeedback(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $feedbacks = MemberDevelopmentFeedback::with(['reviewer:id,name,role', 'goal:id,title'])
            ->where('user_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'feedbacks' => $feedbacks,
            'count'     => $feedbacks->count(),
        ]);
    }

    /**
     * POST /api/member/learning/feedback
     *
     * PM atau Admin memberikan feedback pengembangan diri kepada Member.
     */
    public function storeFeedback(Request $request): JsonResponse
    {
        $user = $request->user();

        // Member dilarang membuat feedback PM untuk dirinya sendiri
        if (!$user || !in_array($user->role, ['project_manager', 'admin'])) {
            return response()->json([
                'message' => 'Hanya Project Manager atau Administrator yang berwenang memberikan feedback pengembangan.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'user_id'                => ['required', 'exists:users,id'],
            'goal_id'                => ['nullable', 'exists:member_development_goals,id'],
            'feedback'               => ['required', 'string'],
            'action_recommendations' => ['nullable', 'string'],
        ], [
            'user_id.required'  => 'Member penerima feedback wajib ditentukan.',
            'feedback.required' => 'Catatan feedback pengembangan wajib diisi.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validasi feedback pengembangan gagal.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $recipient = User::findOrFail($request->user_id);
        if ($recipient->role !== 'member') {
            return response()->json([
                'message' => 'Feedback pengembangan hanya dapat diberikan kepada anggota tim (member).',
            ], 422);
        }

        $feedback = MemberDevelopmentFeedback::create([
            'user_id'                => $recipient->id,
            'reviewer_id'            => $user->id,
            'goal_id'                => $request->goal_id,
            'feedback'               => trim($request->feedback),
            'action_recommendations' => $request->action_recommendations,
        ]);

        // Integrasi M-B: Buat notifikasi ke recipient member
        try {
            NotificationService::notifyDevelopmentFeedback($feedback, $user);
        } catch (\Throwable $e) {
            // Silently log failure without breaking feedback save
            \Illuminate\Support\Facades\Log::warning('Failed creating feedback notification: ' . $e->getMessage());
        }

        $feedback->load(['reviewer:id,name,role', 'goal:id,title']);

        return response()->json([
            'message'  => 'Feedback pengembangan berhasil dikirim kepada Member.',
            'feedback' => $feedback,
        ], 201);
    }
}
