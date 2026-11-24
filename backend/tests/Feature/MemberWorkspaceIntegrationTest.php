<?php

namespace Tests\Feature;

use App\Models\MemberDevelopmentGoal;
use App\Models\MemberLearningActivity;
use App\Models\MemberPortfolioAchievement;
use App\Models\MemberPortfolioProfile;
use App\Models\MemberSkill;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskChecklist;
use App\Models\TaskReview;
use App\Models\TaskUpdate;
use App\Models\User;
use App\Models\UserNotification;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Tahap M-F: Member Workspace Integration & Final Quality Audit Test Suite
 *
 * Scenarios tested:
 * 1. Task -> Calendar: Tasks assigned to member appear correctly in calendar with deadlines.
 * 2. Task -> Notification: Notifications are triggered on task assignment and deadline reminders.
 * 3. Task Review Workflow: Member submits review -> PM approves -> notification created -> task marked completed.
 * 4. Learning -> Portfolio: Member skill & completed learning activity link to portfolio competencies.
 * 5. Portfolio Verification Workflow: Member submits achievement -> PM approves -> status verified & notification sent.
 * 6. Cross-Member Isolation (Security/IDOR): Member cannot view or modify another member's goals, achievements, or workspace.
 */
class MemberWorkspaceIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected User $memberAlpha;
    protected User $memberBeta;
    protected User $pmAlpha;
    protected User $pmBeta;
    protected Project $projectAlpha;
    protected Milestone $milestoneAlpha;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Users
        $this->memberAlpha = User::create([
            'name'      => 'Ahmad Member Alpha',
            'email'     => 'ahmad@pkm.co.id',
            'password'  => bcrypt('password123'),
            'role'      => 'member',
            'phone'     => '0811111111',
            'is_active' => true,
        ]);

        $this->memberBeta = User::create([
            'name'      => 'Budi Member Beta',
            'email'     => 'budi@pkm.co.id',
            'password'  => bcrypt('password123'),
            'role'      => 'member',
            'phone'     => '0822222222',
            'is_active' => true,
        ]);

        $this->pmAlpha = User::create([
            'name'      => 'Rahmat PM Alpha',
            'email'     => 'rahmat.pm@pkm.co.id',
            'password'  => bcrypt('password123'),
            'role'      => 'project_manager',
            'phone'     => '0833333333',
            'is_active' => true,
        ]);

        $this->pmBeta = User::create([
            'name'      => 'Sandi PM Beta',
            'email'     => 'sandi.pm@pkm.co.id',
            'password'  => bcrypt('password123'),
            'role'      => 'project_manager',
            'phone'     => '0844444444',
            'is_active' => true,
        ]);

        // 2. Project & Milestone
        $this->projectAlpha = Project::create([
            'code'       => 'PRJ-INT-001',
            'name'       => 'Sistem Integrasi PKM',
            'client'     => 'PT Potensi Mandiri',
            'pic_id'     => $this->pmAlpha->id,
            'pic_name'   => $this->pmAlpha->name,
            'category'   => 'web',
            'status'     => 'on_track',
            'progress'   => 40,
            'risk_level' => 'low',
            'deadline'   => Carbon::now()->addDays(45)->toDateString(),
            'is_active'  => true,
        ]);

        $this->milestoneAlpha = Milestone::create([
            'project_id'  => $this->projectAlpha->id,
            'title'       => 'Milestone Integrasi',
            'phase_order' => 1,
            'status'      => 'in_progress',
            'progress'    => 50,
            'deadline'    => Carbon::now()->addDays(30)->toDateString(),
        ]);
    }

    /**
     * Skenario 1: Integrasi Task -> Calendar (P-O + M-A)
     * Tugas yang ditugaskan ke Member Alpha dengan deadline tertentu harus muncul di endpoint Kalender.
     */
    public function test_task_assigned_to_member_appears_in_calendar(): void
    {
        Sanctum::actingAs($this->memberAlpha);

        $deadline = Carbon::now()->addDays(5)->toDateString();

        $task = Task::create([
            'project_id'    => $this->projectAlpha->id,
            'milestone_id'  => $this->milestoneAlpha->id,
            'title'         => 'Desain Arsitektur Microservices',
            'priority'      => 'high',
            'status'        => 'in_progress',
            'is_completed'  => false,
            'start_date'    => Carbon::now()->toDateString(),
            'deadline'      => $deadline,
            'assignee_id'   => $this->memberAlpha->id,
            'assignee_name' => $this->memberAlpha->name,
            'created_by'    => $this->pmAlpha->id,
        ]);

        // Query Kalender Kerja Member
        $response = $this->getJson('/api/member/calendar');
        $response->assertStatus(200);

        $tasks = $response->json('tasks') ?? [];
        $found = collect($tasks)->first(fn($e) => ($e['id'] ?? null) == $task->id);

        $this->assertNotNull($found, 'Task must appear in member calendar view');
    }

    /**
     * Skenario 2: Integrasi Task -> Notification (P-O + M-B)
     * Sinkronisasi notifikasi dan reminder deadline berfungsi saat member mengakses notifikasi.
     */
    public function test_notification_sync_and_category_filtering(): void
    {
        Sanctum::actingAs($this->memberAlpha);

        // Buat notifikasi bertipe development_feedback dan portfolio_verified
        UserNotification::create([
            'user_id'   => $this->memberAlpha->id,
            'actor_id'  => $this->pmAlpha->id,
            'type'      => 'development_feedback',
            'title'     => 'Feedback dari PM Alpha',
            'message'   => 'Tingkatkan pengujian unit pada modul ini.',
            'is_read'   => false,
        ]);

        UserNotification::create([
            'user_id'   => $this->memberAlpha->id,
            'actor_id'  => $this->pmAlpha->id,
            'type'      => 'portfolio_verified',
            'title'     => 'Prestasi Disetujui',
            'message'   => 'Pencapaian implementasi API telah diverifikasi.',
            'is_read'   => false,
        ]);

        // Test filter category=development
        $devRes = $this->getJson('/api/member/notifications?category=development');
        $devRes->assertStatus(200);
        $this->assertCount(1, $devRes->json('notifications'));
        $this->assertEquals('development_feedback', $devRes->json('notifications.0.type'));

        // Test filter category=portfolio
        $portRes = $this->getJson('/api/member/notifications?category=portfolio');
        $portRes->assertStatus(200);
        $this->assertCount(1, $portRes->json('notifications'));
        $this->assertEquals('portfolio_verified', $portRes->json('notifications.0.type'));
    }

    /**
     * Skenario 3: Alur Task Review Workflow (P-O Member Workspace <-> PM Approval)
     * Member mengajukan review -> status in_review -> PM approve -> status completed.
     */
    public function test_task_review_workflow_end_to_end(): void
    {
        $task = Task::create([
            'project_id'    => $this->projectAlpha->id,
            'milestone_id'  => $this->milestoneAlpha->id,
            'title'         => 'Optimasi Indeks Database PKM',
            'priority'      => 'urgent',
            'status'        => 'in_progress',
            'is_completed'  => false,
            'deadline'      => Carbon::now()->addDays(2)->toDateString(),
            'assignee_id'   => $this->memberAlpha->id,
            'assignee_name' => $this->memberAlpha->name,
            'created_by'    => $this->pmAlpha->id,
        ]);

        // Buat checklist 100% selesai untuk memenuhi validasi PM-H
        TaskChecklist::create([
            'task_id'      => $task->id,
            'title'        => 'Semua query benchmark lulus uji',
            'is_completed' => true,
            'position'     => 1,
        ]);

        // Member mengajukan review
        Sanctum::actingAs($this->memberAlpha);
        $submitRes = $this->postJson("/api/tasks/{$task->id}/submit-review", [
            'notes' => 'Semua optimasi query selesai dan lulus benchmark.',
        ]);
        $submitRes->assertStatus(200);

        $task->refresh();
        $this->assertEquals('in_review', $task->status);

        // PM menyetujui review
        Sanctum::actingAs($this->pmAlpha);
        $approveRes = $this->postJson("/api/tasks/{$task->id}/approve", [
            'notes' => 'Kerja bagus, hasil query 10x lebih cepat.',
        ]);
        $approveRes->assertStatus(200);

        $task->refresh();
        $this->assertTrue((bool)$task->is_completed);
        $this->assertContains($task->status, ['completed', 'done']);

        // Pastikan notifikasi review_approved terkirim ke Member Alpha
        $notif = UserNotification::where('user_id', $this->memberAlpha->id)
            ->where('type', 'review_approved')
            ->first();
        $this->assertNotNull($notif, 'Member must receive review_approved notification');
    }

    /**
     * Skenario 4: Integrasi Learning -> Portfolio (M-D + M-E)
     * Kompetensi dan aktivitas pembelajaran yang diselesaikan di M-D muncul di ringkasan M-E.
     */
    public function test_learning_competencies_link_to_career_portfolio(): void
    {
        Sanctum::actingAs($this->memberAlpha);

        // Buat Skill di M-D
        $skill = MemberSkill::create([
            'user_id'          => $this->memberAlpha->id,
            'name'             => 'Laravel Architecture & Design Patterns',
            'category'         => 'Technical Skills',
            'current_level'    => 4,
            'target_level'     => 5,
            'experience_notes' => '3 tahun pengalaman membangun backend REST API.',
        ]);

        // Buat Aktivitas Pembelajaran
        MemberLearningActivity::create([
            'user_id'          => $this->memberAlpha->id,
            'skill_id'         => $skill->id,
            'title'            => 'Workshop Advanced Laravel Design Patterns',
            'activity_type'    => 'course',
            'activity_date'    => Carbon::now()->subDays(5)->toDateString(),
            'duration_minutes' => 180,
            'learning_source'  => 'Laracasts',
            'status'           => 'completed',
        ]);

        // Cek endpoint Competency Evidence di Portfolio (M-E)
        $response = $this->getJson('/api/member/portfolio/competency-evidence');
        $response->assertStatus(200);

        $evidence = $response->json('competency_evidence');
        $this->assertNotEmpty($evidence);

        $foundSkill = collect($evidence)->first(fn($s) => $s['name'] === 'Laravel Architecture & Design Patterns');
        $this->assertNotNull($foundSkill);
        $this->assertEquals(4, $foundSkill['current_level']);
        $this->assertEquals('Advanced', $foundSkill['level_label']);
    }

    /**
     * Skenario 5: Alur Verifikasi Pencapaian Portofolio (M-E <-> PM Authorization)
     * Member mengajukan portofolio -> PM yang mengelola proyek memverifikasi -> terverifikasi.
     */
    public function test_portfolio_achievement_verification_workflow(): void
    {
        Sanctum::actingAs($this->memberAlpha);

        // Buat Prestasi Draft
        $achievement = MemberPortfolioAchievement::create([
            'user_id'             => $this->memberAlpha->id,
            'project_id'          => $this->projectAlpha->id,
            'title'               => 'Refactoring API Gateway PKM',
            'category'            => 'technical_achievement',
            'description'         => 'Migrasi endpoint monolitik menjadi modular micro-services.',
            'achievement_date'    => Carbon::now()->subDays(2)->toDateString(),
            'result_impact'       => 'Response time turun 45%',
            'verification_status' => 'draft',
        ]);

        // Member mengajukan verifikasi
        $submitRes = $this->postJson("/api/member/portfolio/achievements/{$achievement->id}/submit");
        $submitRes->assertStatus(200);

        $achievement->refresh();
        $this->assertEquals('pending_verification', $achievement->verification_status);

        // PM Alpha (PIC proyek) memverifikasi pencapaian
        Sanctum::actingAs($this->pmAlpha);
        $verifyRes = $this->postJson("/api/pm/portfolio/achievements/{$achievement->id}/verify", [
            'notes' => 'Pencapaian terkonfirmasi dengan metrik benchmarking yang valid.',
        ]);
        $verifyRes->assertStatus(200);

        $achievement->refresh();
        $this->assertEquals('verified', $achievement->verification_status);
        $this->assertEquals($this->pmAlpha->id, $achievement->verified_by);

        // Notifikasi diterima oleh Member Alpha
        $notif = UserNotification::where('user_id', $this->memberAlpha->id)
            ->where('type', 'portfolio_verified')
            ->first();
        $this->assertNotNull($notif);
    }

    /**
     * Skenario 6: Isolasi Data Antar-Member & Keamanan IDOR
     * Member Alpha tidak boleh bisa mengubah atau menghapus data milik Member Beta.
     */
    public function test_cross_member_data_isolation_and_idor_protection(): void
    {
        // Buat data milik Member Beta
        $goalBeta = MemberDevelopmentGoal::create([
            'user_id'      => $this->memberBeta->id,
            'title'        => 'Target Rahasia Member Beta',
            'status'       => 'in_progress',
            'target_level' => 4,
            'priority'     => 'high',
        ]);

        $achievementBeta = MemberPortfolioAchievement::create([
            'user_id'             => $this->memberBeta->id,
            'title'               => 'Pencapaian Pribadi Member Beta',
            'category'            => 'project_achievement',
            'description'         => 'Deskripsi detail pencapaian member beta.',
            'achievement_date'    => Carbon::now()->toDateString(),
            'verification_status' => 'draft',
        ]);

        // Login sebagai Member Alpha dan coba akses data milik Member Beta
        Sanctum::actingAs($this->memberAlpha);

        // 1. Coba update goal milik Member Beta -> 404 (Not Found via User Scoping)
        $updateGoalRes = $this->putJson("/api/member/learning/goals/{$goalBeta->id}", [
            'title' => 'Percobaan Hack Judul Target',
        ]);
        $this->assertTrue(in_array($updateGoalRes->status(), [403, 404]));

        // 2. Coba delete goal milik Member Beta -> 404
        $deleteGoalRes = $this->deleteJson("/api/member/learning/goals/{$goalBeta->id}");
        $this->assertTrue(in_array($deleteGoalRes->status(), [403, 404]));

        // 3. Coba update achievement portofolio milik Member Beta -> 404
        $updateAchRes = $this->putJson("/api/member/portfolio/achievements/{$achievementBeta->id}", [
            'title' => 'Percobaan Hack Portofolio',
        ]);
        $this->assertTrue(in_array($updateAchRes->status(), [403, 404]));

        // 4. Coba submit achievement milik Member Beta -> 404
        $submitAchRes = $this->postJson("/api/member/portfolio/achievements/{$achievementBeta->id}/submit");
        $this->assertTrue(in_array($submitAchRes->status(), [403, 404]));

        // 5. Coba PM Beta (bukan PIC project Alpha) verifikasi achievement project Alpha -> 403
        $achievementAlpha = MemberPortfolioAchievement::create([
            'user_id'             => $this->memberAlpha->id,
            'project_id'          => $this->projectAlpha->id,
            'title'               => 'Pencapaian di Project Alpha',
            'category'            => 'project_achievement',
            'description'         => 'Deskripsi detail pencapaian member alpha.',
            'achievement_date'    => Carbon::now()->toDateString(),
            'verification_status' => 'pending_verification',
        ]);

        Sanctum::actingAs($this->pmBeta); // PM Beta bukan PIC dari projectAlpha
        $unauthorizedVerify = $this->postJson("/api/pm/portfolio/achievements/{$achievementAlpha->id}/verify", [
            'notes' => 'Percobaan verifikasi tanpa otoritas.',
        ]);
        $this->assertEquals(403, $unauthorizedVerify->status());
    }
}
