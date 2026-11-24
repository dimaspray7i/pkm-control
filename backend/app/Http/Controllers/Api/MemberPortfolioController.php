<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MemberLearningActivity;
use App\Models\MemberPortfolioAchievement;
use App\Models\MemberPortfolioProfile;
use App\Models\MemberPortfolioVerification;
use App\Models\MemberSkill;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class MemberPortfolioController extends Controller
{
    /**
     * Helper: Cek apakah user adalah role member
     */
    protected function ensureMember(Request $request): ?JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== 'member') {
            return response()->json([
                'message' => 'Endpoint ini hanya tersedia untuk anggota tim (member).',
            ], 403);
        }
        return null;
    }

    /**
     * GET /api/member/portfolio/overview
     * Ringkasan Portofolio & KPI Pribadi Karyawan
     */
    public function overview(Request $request): JsonResponse
    {
        if ($deny = $this->ensureMember($request)) {
            return $deny;
        }

        $userId = (int) $request->user()->id;

        // 1. KPI Metrik Utama
        $totalAchievements = MemberPortfolioAchievement::where('user_id', $userId)->count();
        $verifiedCount = MemberPortfolioAchievement::where('user_id', $userId)->where('verification_status', 'verified')->count();
        $pendingCount = MemberPortfolioAchievement::where('user_id', $userId)->where('verification_status', 'pending_verification')->count();
        $revisionCount = MemberPortfolioAchievement::where('user_id', $userId)->where('verification_status', 'revision_requested')->count();
        $draftCount = MemberPortfolioAchievement::where('user_id', $userId)->where('verification_status', 'draft')->count();

        // Proyek yang dikontribusikan (dari tabel tasks aktual)
        $contributedProjectIds = Task::where('assignee_id', $userId)
            ->whereNotNull('project_id')
            ->distinct()
            ->pluck('project_id');
        $totalProjectsContributed = $contributedProjectIds->count();

        // Tugas selesai
        $completedTasksCount = Task::where('assignee_id', $userId)
            ->where('is_completed', true)
            ->count();

        // Kompetensi yang memiliki bukti (evidence_url / evidence_notes / prestasi terverifikasi)
        $skillsWithEvidence = MemberSkill::where('user_id', $userId)
            ->where(function ($q) {
                $q->whereNotNull('evidence_url')
                  ->orWhereNotNull('evidence_notes');
            })
            ->count();

        // Jam belajar aktual dari M-D
        $totalLearningMinutes = (int) MemberLearningActivity::where('user_id', $userId)
            ->where('status', 'completed')
            ->sum('duration_minutes');
        $learningHours = $totalLearningMinutes > 0 ? round($totalLearningMinutes / 60, 1) : 0.0;

        // 2. Pencapaian Terbaru (maksimal 5)
        $recentAchievements = MemberPortfolioAchievement::with([
            'project:id,code,name,status',
            'skill:id,name,category,current_level',
            'verifier:id,name,role',
        ])
            ->where('user_id', $userId)
            ->orderBy('achievement_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get();

        // 3. Tugas Kontribusi Terbaru (maksimal 5)
        $recentTasks = Task::with('project:id,code,name,status')
            ->where('assignee_id', $userId)
            ->orderBy('updated_at', 'desc')
            ->limit(5)
            ->get(['id', 'project_id', 'title', 'status', 'is_completed', 'deadline', 'priority', 'updated_at']);

        // 4. Profil Portofolio (Headline & Bio)
        $profile = MemberPortfolioProfile::firstOrCreate(
            ['user_id' => $userId],
            [
                'headline' => 'Profesional PT Potensi Karya Mandiri',
                'summary_bio' => '',
                'is_public_within_team' => false,
            ]
        );

        return response()->json([
            'metrics' => [
                'total_achievements' => $totalAchievements,
                'verified_achievements' => $verifiedCount,
                'pending_verification' => $pendingCount,
                'revision_requested' => $revisionCount,
                'draft_achievements' => $draftCount,
                'total_projects_contributed' => $totalProjectsContributed,
                'completed_tasks_count' => $completedTasksCount,
                'skills_with_evidence' => $skillsWithEvidence,
                'learning_hours' => $learningHours,
            ],
            'recent_achievements' => $recentAchievements,
            'recent_tasks' => $recentTasks,
            'profile' => $profile,
        ]);
    }

    /**
     * GET /api/member/portfolio/summary
     * Quick summary statistics
     */
    public function summary(Request $request): JsonResponse
    {
        if ($deny = $this->ensureMember($request)) {
            return $deny;
        }

        $userId = (int) $request->user()->id;

        $total = MemberPortfolioAchievement::where('user_id', $userId)->count();
        $verified = MemberPortfolioAchievement::where('user_id', $userId)->where('verification_status', 'verified')->count();
        $projects = Task::where('assignee_id', $userId)->whereNotNull('project_id')->distinct('project_id')->count('project_id');

        return response()->json([
            'total_achievements' => $total,
            'verified_achievements' => $verified,
            'projects_contributed' => $projects,
        ]);
    }

    /**
     * GET /api/member/portfolio/achievements
     * Daftar Pencapaian Milik Member
     */
    public function achievements(Request $request): JsonResponse
    {
        if ($deny = $this->ensureMember($request)) {
            return $deny;
        }

        $userId = (int) $request->user()->id;
        $query = MemberPortfolioAchievement::with([
            'project:id,code,name,status,pic_id,pic_name',
            'skill:id,name,category,current_level',
            'verifier:id,name,role',
            'latestVerification.reviewer:id,name,role',
        ])->where('user_id', $userId);

        // Filter Kategori
        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        // Filter Status Verifikasi
        if ($request->filled('verification_status')) {
            $query->where('verification_status', $request->verification_status);
        }

        // Filter Proyek
        if ($request->filled('project_id')) {
            $query->where('project_id', $request->project_id);
        }

        // Filter Skill
        if ($request->filled('skill_id')) {
            $query->where('skill_id', $request->skill_id);
        }

        // Filter Featured
        if ($request->has('is_featured')) {
            $query->where('is_featured', filter_var($request->is_featured, FILTER_VALIDATE_BOOLEAN));
        }

        // Search Keyword
        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhere('result_impact', 'like', "%{$search}%");
            });
        }

        // Sort
        $sortBy = $request->get('sort_by', 'date_desc');
        switch ($sortBy) {
            case 'date_asc':
                $query->orderBy('achievement_date', 'asc');
                break;
            case 'created_asc':
                $query->orderBy('created_at', 'asc');
                break;
            case 'created_desc':
                $query->orderBy('created_at', 'desc');
                break;
            case 'title_asc':
                $query->orderBy('title', 'asc');
                break;
            case 'date_desc':
            default:
                $query->orderBy('achievement_date', 'desc')->orderBy('created_at', 'desc');
                break;
        }

        $achievements = $query->get();

        return response()->json([
            'achievements' => $achievements,
            'total' => $achievements->count(),
            'categories' => MemberPortfolioAchievement::CATEGORIES,
            'statuses' => MemberPortfolioAchievement::STATUSES,
        ]);
    }

    /**
     * POST /api/member/portfolio/achievements
     * Tambah Pencapaian Baru (Selalu Draft Awal)
     */
    public function storeAchievement(Request $request): JsonResponse
    {
        if ($deny = $this->ensureMember($request)) {
            return $deny;
        }

        $userId = (int) $request->user()->id;

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'category' => 'required|string|in:' . implode(',', array_keys(MemberPortfolioAchievement::CATEGORIES)),
            'description' => 'required|string|max:2000',
            'achievement_date' => 'required|date',
            'project_id' => 'nullable|integer|exists:projects,id',
            'skill_id' => 'nullable|integer|exists:member_skills,id',
            'result_impact' => 'nullable|string|max:2000',
            'evidence_url' => 'nullable|url|max:500',
            'evidence_notes' => 'nullable|string|max:1000',
            'is_featured' => 'nullable|boolean',
            'is_visible' => 'nullable|boolean',
        ], [
            'title.required' => 'Judul pencapaian wajib diisi.',
            'category.required' => 'Kategori pencapaian wajib dipilih.',
            'category.in' => 'Kategori pencapaian tidak valid.',
            'description.required' => 'Deskripsi pencapaian wajib diisi.',
            'achievement_date.required' => 'Tanggal pencapaian wajib diisi.',
            'evidence_url.url' => 'Format URL bukti pendukung tidak valid.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validasi gagal.',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Validasi Relasi Proyek: Member harus pernah berkontribusi pada proyek ini
        if ($request->filled('project_id')) {
            $hasContributed = Task::where('project_id', $request->project_id)
                ->where('assignee_id', $userId)
                ->exists();

            if (!$hasContributed) {
                return response()->json([
                    'message' => 'Anda hanya dapat mengaitkan proyek yang memang memiliki tugas penugasan untuk Anda.',
                ], 422);
            }
        }

        // Validasi Relasi Skill: Skill harus milik member sendiri
        if ($request->filled('skill_id')) {
            $ownSkill = MemberSkill::where('id', $request->skill_id)
                ->where('user_id', $userId)
                ->exists();

            if (!$ownSkill) {
                return response()->json([
                    'message' => 'Kompetensi yang dipilih bukan milik profil Anda.',
                ], 422);
            }
        }

        $achievement = MemberPortfolioAchievement::create([
            'user_id' => $userId,
            'project_id' => $request->project_id,
            'skill_id' => $request->skill_id,
            'title' => trim($request->title),
            'category' => $request->category,
            'description' => trim($request->description),
            'achievement_date' => $request->achievement_date,
            'result_impact' => $request->result_impact ? trim($request->result_impact) : null,
            'evidence_url' => $request->evidence_url ? trim($request->evidence_url) : null,
            'evidence_notes' => $request->evidence_notes ? trim($request->evidence_notes) : null,
            'verification_status' => 'draft',
            'is_featured' => $request->boolean('is_featured', false),
            'is_visible' => $request->boolean('is_visible', true),
        ]);

        $achievement->load([
            'project:id,code,name,status',
            'skill:id,name,category,current_level',
        ]);

        return response()->json([
            'message' => 'Pencapaian berhasil disimpan sebagai draft.',
            'achievement' => $achievement,
        ], 201);
    }

    /**
     * GET /api/member/portfolio/achievements/{id}
     * Detail Pencapaian (Dengan Otorisasi IDOR)
     */
    public function showAchievement(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $achievement = MemberPortfolioAchievement::with([
            'project:id,code,name,status,pic_id,pic_name',
            'skill:id,name,category,current_level,evidence_url',
            'verifier:id,name,role',
            'verifications.reviewer:id,name,role',
        ])->find($id);

        if (!$achievement) {
            return response()->json(['message' => 'Pencapaian tidak ditemukan.'], 404);
        }

        // Cek Hak Akses
        if ($user->role === 'member') {
            if ($achievement->user_id !== $user->id) {
                return response()->json(['message' => 'Pencapaian tidak ditemukan atau bukan milik Anda.'], 404);
            }
        } elseif ($user->role === 'project_manager') {
            // PM hanya boleh melihat jika proyeknya relevan atau member disupervisi
            $isPic = $achievement->project && (int) $achievement->project->pic_id === (int) $user->id;
            $supervisesMember = Project::where('pic_id', $user->id)
                ->whereHas('tasks', fn($q) => $q->where('assignee_id', $achievement->user_id))
                ->exists();

            if (!$isPic && !$supervisesMember) {
                return response()->json(['message' => 'Anda tidak memiliki hak akses ke pencapaian ini.'], 403);
            }
        }

        return response()->json([
            'achievement' => $achievement,
        ]);
    }

    /**
     * PUT /api/member/portfolio/achievements/{id}
     * Update Pencapaian (Hanya status draft atau revision_requested)
     */
    public function updateAchievement(Request $request, $id): JsonResponse
    {
        if ($deny = $this->ensureMember($request)) {
            return $deny;
        }

        $userId = (int) $request->user()->id;
        $achievement = MemberPortfolioAchievement::where('id', $id)
            ->where('user_id', $userId)
            ->first();

        if (!$achievement) {
            return response()->json(['message' => 'Pencapaian tidak ditemukan.'], 404);
        }

        // Tolak jika sedang pending_verification atau sudah verified
        if (in_array($achievement->verification_status, ['pending_verification', 'verified'])) {
            return response()->json([
                'message' => 'Pencapaian yang sedang dalam proses verifikasi atau sudah diverifikasi tidak dapat diubah.',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'category' => 'required|string|in:' . implode(',', array_keys(MemberPortfolioAchievement::CATEGORIES)),
            'description' => 'required|string|max:2000',
            'achievement_date' => 'required|date',
            'project_id' => 'nullable|integer|exists:projects,id',
            'skill_id' => 'nullable|integer|exists:member_skills,id',
            'result_impact' => 'nullable|string|max:2000',
            'evidence_url' => 'nullable|url|max:500',
            'evidence_notes' => 'nullable|string|max:1000',
            'is_featured' => 'nullable|boolean',
            'is_visible' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validasi gagal.',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Validasi Project
        if ($request->filled('project_id')) {
            $hasContributed = Task::where('project_id', $request->project_id)
                ->where('assignee_id', $userId)
                ->exists();

            if (!$hasContributed) {
                return response()->json([
                    'message' => 'Anda hanya dapat mengaitkan proyek yang memang memiliki tugas penugasan untuk Anda.',
                ], 422);
            }
        }

        // Validasi Skill
        if ($request->filled('skill_id')) {
            $ownSkill = MemberSkill::where('id', $request->skill_id)
                ->where('user_id', $userId)
                ->exists();

            if (!$ownSkill) {
                return response()->json([
                    'message' => 'Kompetensi yang dipilih bukan milik profil Anda.',
                ], 422);
            }
        }

        $achievement->update([
            'project_id' => $request->project_id,
            'skill_id' => $request->skill_id,
            'title' => trim($request->title),
            'category' => $request->category,
            'description' => trim($request->description),
            'achievement_date' => $request->achievement_date,
            'result_impact' => $request->result_impact ? trim($request->result_impact) : null,
            'evidence_url' => $request->evidence_url ? trim($request->evidence_url) : null,
            'evidence_notes' => $request->evidence_notes ? trim($request->evidence_notes) : null,
            'is_featured' => $request->has('is_featured') ? $request->boolean('is_featured') : $achievement->is_featured,
            'is_visible' => $request->has('is_visible') ? $request->boolean('is_visible') : $achievement->is_visible,
        ]);

        $achievement->load([
            'project:id,code,name,status',
            'skill:id,name,category,current_level',
        ]);

        return response()->json([
            'message' => 'Pencapaian berhasil diperbarui.',
            'achievement' => $achievement,
        ]);
    }

    /**
     * DELETE /api/member/portfolio/achievements/{id}
     * Hapus Pencapaian (Hanya draft atau revision_requested)
     */
    public function destroyAchievement(Request $request, $id): JsonResponse
    {
        if ($deny = $this->ensureMember($request)) {
            return $deny;
        }

        $userId = (int) $request->user()->id;
        $achievement = MemberPortfolioAchievement::where('id', $id)
            ->where('user_id', $userId)
            ->first();

        if (!$achievement) {
            return response()->json(['message' => 'Pencapaian tidak ditemukan.'], 404);
        }

        if (in_array($achievement->verification_status, ['verified', 'pending_verification'])) {
            return response()->json([
                'message' => 'Hanya pencapaian berstatus draft atau permintaan revisi yang dapat dihapus.',
            ], 422);
        }

        $achievement->delete();

        return response()->json([
            'message' => 'Pencapaian berhasil dihapus.',
        ]);
    }

    /**
     * POST /api/member/portfolio/achievements/{id}/submit
     * Ajukan Pencapaian untuk Diverifikasi PM
     */
    public function submitAchievement(Request $request, $id): JsonResponse
    {
        if ($deny = $this->ensureMember($request)) {
            return $deny;
        }

        $user = $request->user();
        $achievement = MemberPortfolioAchievement::with('project')
            ->where('id', $id)
            ->where('user_id', $user->id)
            ->first();

        if (!$achievement) {
            return response()->json(['message' => 'Pencapaian tidak ditemukan.'], 404);
        }

        if ($achievement->verification_status === 'pending_verification') {
            return response()->json([
                'message' => 'Pencapaian ini sudah dalam antrean verifikasi.',
            ], 422);
        }

        if ($achievement->verification_status === 'verified') {
            return response()->json([
                'message' => 'Pencapaian ini sudah terverifikasi.',
            ], 422);
        }

        $isResubmission = $achievement->verification_status === 'revision_requested';

        DB::transaction(function () use ($achievement, $user, $isResubmission, $request) {
            $achievement->update([
                'verification_status' => 'pending_verification',
            ]);

            MemberPortfolioVerification::create([
                'achievement_id' => $achievement->id,
                'reviewer_id' => $user->id,
                'action' => $isResubmission ? 'resubmitted' : 'submitted',
                'notes' => $request->notes ?? ($isResubmission ? 'Pengiriman ulang setelah perbaikan revisi' : 'Pengajuan verifikasi pencapaian baru'),
            ]);

            NotificationService::notifyAchievementSubmitted($achievement, $user, $isResubmission);
        });

        $achievement->load([
            'project:id,code,name,status',
            'skill:id,name,category,current_level',
            'latestVerification',
        ]);

        return response()->json([
            'message' => $isResubmission
                ? 'Pencapaian berhasil dikirim ulang untuk verifikasi.'
                : 'Pencapaian berhasil diajukan untuk verifikasi oleh Project Manager.',
            'achievement' => $achievement,
        ]);
    }

    /**
     * GET /api/member/portfolio/project-contributions
     * Portofolio Pengalaman & Kontribusi Proyek Aktual
     */
    public function projectContributions(Request $request): JsonResponse
    {
        if ($deny = $this->ensureMember($request)) {
            return $deny;
        }

        $userId = (int) $request->user()->id;

        // Cari seluruh project ID tempat member memiliki penugasan tugas
        $projectIds = Task::where('assignee_id', $userId)
            ->whereNotNull('project_id')
            ->distinct()
            ->pluck('project_id');

        $projects = Project::with([
            'pic:id,name,role,email',
            'tasks' => function ($q) use ($userId) {
                $q->where('assignee_id', $userId)
                  ->orderBy('deadline', 'asc');
            },
            'portfolioAchievements' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            },
        ])
            ->whereIn('id', $projectIds)
            ->get();

        $contributions = $projects->map(function ($project) use ($userId) {
            $memberTasks = $project->tasks;
            $totalTasks = $memberTasks->count();
            $completedTasks = $memberTasks->where('is_completed', true)->count();
            $completionRate = $totalTasks > 0 ? (int) round(($completedTasks / $totalTasks) * 100) : 0;

            // Cari rentang tanggal kontribusi member
            $earliestDate = $memberTasks->min('start_date') ?: $memberTasks->min('created_at');
            $latestDate = $memberTasks->max('deadline') ?: $memberTasks->max('updated_at');

            return [
                'project_id' => $project->id,
                'project_code' => $project->code,
                'project_name' => $project->name,
                'client' => $project->client,
                'status' => $project->status,
                'overall_project_progress' => $project->progress,
                'project_deadline' => $project->deadline,
                'pic_name' => $project->pic?->name ?? $project->pic_name ?? 'Project Manager',
                'is_pic' => (int) $project->pic_id === $userId, // Pastikan tidak menganggap member sebagai PIC jika bukan PIC
                'total_tasks_assigned' => $totalTasks,
                'completed_tasks_count' => $completedTasks,
                'completion_rate' => $completionRate,
                'contribution_period' => [
                    'start' => $earliestDate ? Carbon::parse($earliestDate)->toDateString() : null,
                    'end' => $latestDate ? Carbon::parse($latestDate)->toDateString() : null,
                ],
                'tasks' => $memberTasks->map(fn($t) => [
                    'id' => $t->id,
                    'title' => $t->title,
                    'priority' => $t->priority,
                    'status' => $t->status,
                    'is_completed' => (bool) $t->is_completed,
                    'deadline' => $t->deadline ? Carbon::parse($t->deadline)->toDateString() : null,
                ])->values(),
                'achievements' => $project->portfolioAchievements->map(fn($a) => [
                    'id' => $a->id,
                    'title' => $a->title,
                    'category' => $a->category,
                    'verification_status' => $a->verification_status,
                    'achievement_date' => $a->achievement_date ? Carbon::parse($a->achievement_date)->toDateString() : null,
                ])->values(),
            ];
        });

        return response()->json([
            'contributions' => $contributions,
            'total_projects' => $contributions->count(),
        ]);
    }

    /**
     * GET /api/member/portfolio/competency-evidence
     * Bukti Kompetensi Nyata (Integrasi M-D)
     */
    public function competencyEvidence(Request $request): JsonResponse
    {
        if ($deny = $this->ensureMember($request)) {
            return $deny;
        }

        $userId = (int) $request->user()->id;

        // Ambil skill terdaftar milik member
        $skills = MemberSkill::with([
            'portfolioAchievements' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            },
            'activities' => function ($q) use ($userId) {
                $q->where('user_id', $userId)->where('status', 'completed');
            },
            'goals' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            },
        ])
            ->where('user_id', $userId)
            ->get();

        $evidenceList = $skills->map(function ($skill) {
            $verifiedAchievements = $skill->portfolioAchievements->where('verification_status', 'verified');
            $activitiesWithProof = $skill->activities->whereNotNull('evidence_url');

            return [
                'skill_id' => $skill->id,
                'name' => $skill->name,
                'category' => $skill->category,
                'current_level' => $skill->current_level,
                'target_level' => $skill->target_level,
                'level_label' => $skill->level_label,
                'description' => $skill->description,
                'evidence_url' => $skill->evidence_url,
                'evidence_notes' => $skill->evidence_notes,
                'experience_notes' => $skill->experience_notes,
                'has_direct_evidence' => !empty($skill->evidence_url) || !empty($skill->evidence_notes),
                'verified_achievements_count' => $verifiedAchievements->count(),
                'total_achievements_count' => $skill->portfolioAchievements->count(),
                'completed_activities_count' => $skill->activities->count(),
                'certified_activities_count' => $activitiesWithProof->count(),
                'verified_achievements' => $verifiedAchievements->map(fn($a) => [
                    'id' => $a->id,
                    'title' => $a->title,
                    'category' => $a->category,
                    'achievement_date' => $a->achievement_date ? Carbon::parse($a->achievement_date)->toDateString() : null,
                    'result_impact' => $a->result_impact,
                ])->values(),
            ];
        });

        // Ambil aktivitas pembelajaran yang memiliki sertifikat bukti
        $learningCertificates = MemberLearningActivity::with('skill:id,name,category')
            ->where('user_id', $userId)
            ->whereNotNull('evidence_url')
            ->where('evidence_url', '!=', '')
            ->orderBy('activity_date', 'desc')
            ->get();

        return response()->json([
            'competency_evidence' => $evidenceList,
            'learning_certificates' => $learningCertificates,
        ]);
    }

    /**
     * GET /api/member/portfolio/presentation
     * Tampilan Portofolio Profesional Siap Saji (Curated & Private by default)
     */
    public function presentation(Request $request): JsonResponse
    {
        if ($deny = $this->ensureMember($request)) {
            return $deny;
        }

        $user = $request->user();
        $userId = (int) $user->id;

        $profile = MemberPortfolioProfile::firstOrCreate(
            ['user_id' => $userId],
            [
                'headline' => 'Profesional PT Potensi Karya Mandiri',
                'summary_bio' => '',
                'is_public_within_team' => false,
            ]
        );

        // Hanya pencapaian yang is_visible = true
        $presentationAchievements = MemberPortfolioAchievement::with([
            'project:id,code,name,status,pic_name',
            'skill:id,name,category,current_level',
            'verifier:id,name,role',
        ])
            ->where('user_id', $userId)
            ->where('is_visible', true)
            ->orderBy('is_featured', 'desc')
            ->orderBy('achievement_date', 'desc')
            ->get();

        // Project Highlights (proyek dengan tugas selesai)
        $projectIds = Task::where('assignee_id', $userId)
            ->where('is_completed', true)
            ->distinct()
            ->pluck('project_id');

        $projectHighlights = Project::whereIn('id', $projectIds)
            ->get(['id', 'code', 'name', 'client', 'status', 'progress', 'deadline']);

        // Skill Highlights (level >= 3 atau punya bukti)
        $skillHighlights = MemberSkill::where('user_id', $userId)
            ->where(function ($q) {
                $q->where('current_level', '>=', 3)
                  ->orWhereNotNull('evidence_url')
                  ->orWhereNotNull('evidence_notes');
            })
            ->orderBy('current_level', 'desc')
            ->get();

        return response()->json([
            'profile' => [
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'phone' => $user->phone,
                'member_since' => $user->created_at ? Carbon::parse($user->created_at)->toDateString() : null,
                'headline' => $profile->headline,
                'summary_bio' => $profile->summary_bio,
                'is_public_within_team' => $profile->is_public_within_team,
            ],
            'achievements' => $presentationAchievements,
            'project_highlights' => $projectHighlights,
            'skill_highlights' => $skillHighlights,
            'stats' => [
                'total_achievements' => $presentationAchievements->count(),
                'verified_count' => $presentationAchievements->where('verification_status', 'verified')->count(),
                'featured_count' => $presentationAchievements->where('is_featured', true)->count(),
                'projects_count' => $projectHighlights->count(),
            ],
        ]);
    }

    /**
     * PUT /api/member/portfolio/presentation/profile
     * Simpan Headline & Bio Profil Portofolio
     */
    public function updateProfile(Request $request): JsonResponse
    {
        if ($deny = $this->ensureMember($request)) {
            return $deny;
        }

        $userId = (int) $request->user()->id;

        $validator = Validator::make($request->all(), [
            'headline' => 'nullable|string|max:255',
            'summary_bio' => 'nullable|string|max:3000',
            'is_public_within_team' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validasi gagal.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $profile = MemberPortfolioProfile::updateOrCreate(
            ['user_id' => $userId],
            [
                'headline' => $request->headline ? trim($request->headline) : null,
                'summary_bio' => $request->summary_bio ? trim($request->summary_bio) : null,
                'is_public_within_team' => $request->boolean('is_public_within_team', false),
            ]
        );

        return response()->json([
            'message' => 'Profil portofolio berhasil diperbarui.',
            'profile' => $profile,
        ]);
    }

    /**
     * PATCH /api/member/portfolio/achievements/{id}/curate
     * Atur Kurasi (Featured / Visible) pada Tampilan Portofolio
     */
    public function curateAchievement(Request $request, $id): JsonResponse
    {
        if ($deny = $this->ensureMember($request)) {
            return $deny;
        }

        $userId = (int) $request->user()->id;
        $achievement = MemberPortfolioAchievement::where('id', $id)
            ->where('user_id', $userId)
            ->first();

        if (!$achievement) {
            return response()->json(['message' => 'Pencapaian tidak ditemukan.'], 404);
        }

        $updates = [];
        if ($request->has('is_featured')) {
            $updates['is_featured'] = $request->boolean('is_featured');
        }
        if ($request->has('is_visible')) {
            $updates['is_visible'] = $request->boolean('is_visible');
        }

        $achievement->update($updates);

        return response()->json([
            'message' => 'Kurasi tampilan pencapaian berhasil diperbarui.',
            'achievement' => $achievement,
        ]);
    }

    /* =========================================================================
     * PM / ADMIN VERIFICATION ENDPOINTS
     * ========================================================================= */

    /**
     * GET /api/pm/portfolio/verification-queue
     * Antrean Verifikasi Pencapaian untuk PM & Admin
     */
    public function verificationQueue(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'message' => 'Anda tidak memiliki hak akses ke antrean verifikasi.',
            ], 403);
        }

        $query = MemberPortfolioAchievement::with([
            'user:id,name,email,role',
            'project:id,code,name,status,pic_id,pic_name',
            'skill:id,name,category,current_level',
            'verifications' => fn($q) => $q->orderBy('created_at', 'desc')->limit(3),
        ])->where('verification_status', 'pending_verification');

        // Jika PM: batasi hanya pada pencapaian dalam lingkup kewenangannya
        if ($user->role === 'project_manager') {
            $managedProjectIds = Project::where('pic_id', $user->id)->pluck('id');

            // Anggota tim yang memiliki tugas di bawah proyek binaan PM ini
            $supervisedMemberIds = Task::whereIn('project_id', $managedProjectIds)
                ->whereNotNull('assignee_id')
                ->distinct()
                ->pluck('assignee_id');

            $query->where(function ($q) use ($managedProjectIds, $supervisedMemberIds) {
                // Pencapaian yang terkait langsung dengan proyek binaan PM
                $q->whereIn('project_id', $managedProjectIds)
                  // ATAU pencapaian non-proyek yang dibuat oleh anggota tim binaannya
                  ->orWhere(function ($sub) use ($supervisedMemberIds) {
                      $sub->whereNull('project_id')
                          ->whereIn('user_id', $supervisedMemberIds);
                  });
            });
        }

        $queue = $query->orderBy('updated_at', 'asc')->get();

        return response()->json([
            'queue' => $queue,
            'count' => $queue->count(),
        ]);
    }

    /**
     * POST /api/pm/portfolio/achievements/{id}/verify
     * PM / Admin Menyetujui Verifikasi Pencapaian
     */
    public function verifyAchievement(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'message' => 'Anda tidak memiliki hak akses untuk memverifikasi pencapaian.',
            ], 403);
        }

        $achievement = MemberPortfolioAchievement::with('project')->find($id);
        if (!$achievement) {
            return response()->json(['message' => 'Pencapaian tidak ditemukan.'], 404);
        }

        // Aturan: Member tidak dapat memverifikasi pencapaian miliknya sendiri
        if ((int) $achievement->user_id === (int) $user->id) {
            return response()->json([
                'message' => 'Anda tidak dapat memverifikasi pencapaian Anda sendiri.',
            ], 403);
        }

        // Aturan Kewenangan PM
        if ($user->role === 'project_manager') {
            $isAuthorized = false;
            if ($achievement->project_id) {
                // Proyek harus dipimpin oleh PM ini
                $isAuthorized = (int) $achievement->project?->pic_id === (int) $user->id;
            } else {
                // Jika tidak terkait proyek, PM harus menyupervisi anggota tim tersebut dalam salah satu proyeknya
                $isAuthorized = Project::where('pic_id', $user->id)
                    ->whereHas('tasks', fn($q) => $q->where('assignee_id', $achievement->user_id))
                    ->exists();
            }

            if (!$isAuthorized) {
                return response()->json([
                    'message' => 'Anda tidak memiliki kewenangan untuk memverifikasi pencapaian pada proyek atau anggota tim ini.',
                ], 403);
            }
        }

        DB::transaction(function () use ($achievement, $user, $request) {
            $achievement->update([
                'verification_status' => 'verified',
                'verified_at' => now(),
                'verified_by' => $user->id,
            ]);

            MemberPortfolioVerification::create([
                'achievement_id' => $achievement->id,
                'reviewer_id' => $user->id,
                'action' => 'verified',
                'notes' => $request->notes ? trim($request->notes) : 'Pencapaian telah diverifikasi dan disetujui.',
            ]);

            NotificationService::notifyAchievementVerified($achievement, $user, $request->notes);
        });

        $achievement->load([
            'project:id,code,name,status',
            'skill:id,name,category,current_level',
            'verifier:id,name,role',
        ]);

        return response()->json([
            'message' => 'Pencapaian berhasil diverifikasi.',
            'achievement' => $achievement,
        ]);
    }

    /**
     * POST /api/pm/portfolio/achievements/{id}/revision
     * PM / Admin Meminta Revisi Pencapaian (Alasan Wajib)
     */
    public function requestRevision(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'message' => 'Anda tidak memiliki hak akses untuk meminta revisi pencapaian.',
            ], 403);
        }

        $achievement = MemberPortfolioAchievement::with('project')->find($id);
        if (!$achievement) {
            return response()->json(['message' => 'Pencapaian tidak ditemukan.'], 404);
        }

        // Member tidak dapat mereview pencapaiannya sendiri
        if ((int) $achievement->user_id === (int) $user->id) {
            return response()->json([
                'message' => 'Anda tidak dapat mereview pencapaian Anda sendiri.',
            ], 403);
        }

        // Aturan Kewenangan PM
        if ($user->role === 'project_manager') {
            $isAuthorized = false;
            if ($achievement->project_id) {
                $isAuthorized = (int) $achievement->project?->pic_id === (int) $user->id;
            } else {
                $isAuthorized = Project::where('pic_id', $user->id)
                    ->whereHas('tasks', fn($q) => $q->where('assignee_id', $achievement->user_id))
                    ->exists();
            }

            if (!$isAuthorized) {
                return response()->json([
                    'message' => 'Anda tidak memiliki kewenangan untuk meminta revisi pencapaian pada proyek atau anggota tim ini.',
                ], 403);
            }
        }

        // PM wajib memberikan alasan revisi
        $validator = Validator::make($request->all(), [
            'notes' => 'required|string|min:5|max:1000',
        ], [
            'notes.required' => 'Alasan permintaan revisi wajib diisi oleh peninjau.',
            'notes.min' => 'Alasan permintaan revisi minimal 5 karakter.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validasi gagal.',
                'errors' => $validator->errors(),
            ], 422);
        }

        DB::transaction(function () use ($achievement, $user, $request) {
            $achievement->update([
                'verification_status' => 'revision_requested',
            ]);

            MemberPortfolioVerification::create([
                'achievement_id' => $achievement->id,
                'reviewer_id' => $user->id,
                'action' => 'revision_requested',
                'notes' => trim($request->notes),
            ]);

            NotificationService::notifyAchievementRevisionRequested($achievement, $user, trim($request->notes));
        });

        $achievement->load([
            'project:id,code,name,status',
            'skill:id,name,category,current_level',
            'latestVerification',
        ]);

        return response()->json([
            'message' => 'Permintaan revisi pencapaian berhasil dikirim ke anggota tim.',
            'achievement' => $achievement,
        ]);
    }
}
