<?php

namespace Tests\Feature;

use App\Models\MemberDevelopmentFeedback;
use App\Models\MemberDevelopmentGoal;
use App\Models\MemberDevelopmentMilestone;
use App\Models\MemberLearningActivity;
use App\Models\MemberSkill;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MemberLearningTest extends TestCase
{
    use RefreshDatabase;

    protected User $member1;
    protected User $member2;
    protected User $pm;
    protected User $admin;
    protected User $pimpinan;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'name'      => 'Admin PKM',
            'email'     => 'admin@pkm.test',
            'password'  => bcrypt('password'),
            'role'      => 'admin',
            'is_active' => true,
        ]);

        $this->pimpinan = User::create([
            'name'      => 'Pimpinan PKM',
            'email'     => 'pimpinan@pkm.test',
            'password'  => bcrypt('password'),
            'role'      => 'pimpinan',
            'is_active' => true,
        ]);

        $this->pm = User::create([
            'name'      => 'PM Senior',
            'email'     => 'pm@pkm.test',
            'password'  => bcrypt('password'),
            'role'      => 'project_manager',
            'is_active' => true,
        ]);

        $this->member1 = User::create([
            'name'      => 'Dimas Member',
            'email'     => 'member1@pkm.test',
            'password'  => bcrypt('password'),
            'role'      => 'member',
            'is_active' => true,
        ]);

        $this->member2 = User::create([
            'name'      => 'Budi Member',
            'email'     => 'member2@pkm.test',
            'password'  => bcrypt('password'),
            'role'      => 'member',
            'is_active' => true,
        ]);
    }

    // =========================================================================
    // SKILLS (1 - 7)
    // =========================================================================

    // 1. Member dapat melihat skill miliknya
    public function test_01_member_can_fetch_own_skills(): void
    {
        MemberSkill::create([
            'user_id'       => $this->member1->id,
            'name'          => 'React Frontend Architecture',
            'category'      => 'Technical Skills',
            'current_level' => 3,
            'target_level'  => 4,
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/learning/skills');

        $res->assertStatus(200);
        $this->assertEquals(1, $res->json('count'));
        $this->assertEquals('React Frontend Architecture', $res->json('skills.0.name'));
    }

    // 2. Member dapat membuat skill
    public function test_02_member_can_create_skill(): void
    {
        Sanctum::actingAs($this->member1);

        $res = $this->postJson('/api/member/learning/skills', [
            'name'          => 'Laravel REST API',
            'category'      => 'Technical Skills',
            'description'   => 'Pembuatan microservice dan API terstruktur',
            'current_level' => 3,
            'target_level'  => 5,
        ]);

        $res->assertStatus(201);
        $this->assertDatabaseHas('member_skills', [
            'user_id' => $this->member1->id,
            'name'    => 'Laravel REST API',
        ]);
    }

    // 3. Member dapat mengubah skill miliknya
    public function test_03_member_can_update_own_skill(): void
    {
        $skill = MemberSkill::create([
            'user_id'       => $this->member1->id,
            'name'          => 'PostgreSQL Database',
            'category'      => 'Technical Skills',
            'current_level' => 2,
            'target_level'  => 4,
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->putJson("/api/member/learning/skills/{$skill->id}", [
            'current_level'    => 3,
            'experience_notes' => 'Telah mempraktikkan indexing dan explain query',
        ]);

        $res->assertStatus(200);
        $this->assertEquals(3, $res->json('skill.current_level'));
    }

    // 4. Member tidak dapat mengubah skill milik orang lain
    public function test_04_member_cannot_update_other_member_skill(): void
    {
        $skill = MemberSkill::create([
            'user_id'       => $this->member2->id,
            'name'          => 'Docker Containerization',
            'category'      => 'Operational Skills',
            'current_level' => 2,
            'target_level'  => 4,
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->putJson("/api/member/learning/skills/{$skill->id}", [
            'current_level' => 5,
        ]);

        $res->assertStatus(403);
    }

    // 5. Member tidak dapat menghapus skill milik orang lain
    public function test_05_member_cannot_delete_other_member_skill(): void
    {
        $skill = MemberSkill::create([
            'user_id'       => $this->member2->id,
            'name'          => 'Public Speaking',
            'category'      => 'Communication',
            'current_level' => 2,
            'target_level'  => 3,
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->deleteJson("/api/member/learning/skills/{$skill->id}");

        $res->assertStatus(403);
        $this->assertDatabaseHas('member_skills', ['id' => $skill->id]);
    }

    // 6. Validasi level kompetensi berjalan
    public function test_06_competence_level_validation_enforced(): void
    {
        Sanctum::actingAs($this->member1);

        $res = $this->postJson('/api/member/learning/skills', [
            'name'          => 'Invalid Skill Level',
            'category'      => 'Technical Skills',
            'current_level' => 6, // level harus 1-5
            'target_level'  => 0,
        ]);

        $res->assertStatus(422)
            ->assertJsonValidationErrors(['current_level', 'target_level']);
    }

    // 7. Skill duplikat ditangani dengan benar
    public function test_07_duplicate_skill_handled_properly(): void
    {
        MemberSkill::create([
            'user_id'       => $this->member1->id,
            'name'          => 'Git Collaboration',
            'category'      => 'Technical Skills',
            'current_level' => 3,
            'target_level'  => 4,
        ]);

        Sanctum::actingAs($this->member1);

        $res = $this->postJson('/api/member/learning/skills', [
            'name'          => 'git collaboration', // case-insensitive duplicate
            'category'      => 'Technical Skills',
            'current_level' => 3,
            'target_level'  => 4,
        ]);

        $res->assertStatus(422);
    }

    // =========================================================================
    // DEVELOPMENT GOALS (8 - 15)
    // =========================================================================

    // 8. Member dapat membuat development goal
    public function test_08_member_can_create_development_goal(): void
    {
        $skill = MemberSkill::create([
            'user_id'       => $this->member1->id,
            'name'          => 'Tailwind CSS Mastery',
            'category'      => 'Technical Skills',
            'current_level' => 2,
            'target_level'  => 4,
        ]);

        Sanctum::actingAs($this->member1);

        $res = $this->postJson('/api/member/learning/goals', [
            'title'        => 'Menguasai Custom Theme Tailwind v4',
            'skill_id'     => $skill->id,
            'description'  => 'Mampu mengimplementasikan design system neobrutalisme',
            'priority'     => 'high',
            'status'       => 'planned',
            'target_date'  => Carbon::now()->addDays(30)->toDateString(),
            'milestones'   => [
                ['title' => 'Membaca Dokumentasi Tailwind'],
                ['title' => 'Membuat Komponen Mockup'],
            ],
        ]);

        $res->assertStatus(201);
        $this->assertDatabaseHas('member_development_goals', [
            'user_id' => $this->member1->id,
            'title'   => 'Menguasai Custom Theme Tailwind v4',
        ]);
        $this->assertDatabaseHas('member_development_milestones', [
            'title' => 'Membaca Dokumentasi Tailwind',
        ]);
    }

    // 9. Member dapat melihat goal miliknya
    public function test_09_member_can_fetch_own_goals(): void
    {
        MemberDevelopmentGoal::create([
            'user_id'  => $this->member1->id,
            'title'    => 'Target 1',
            'priority' => 'medium',
            'status'   => 'in_progress',
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/learning/goals');

        $res->assertStatus(200);
        $this->assertEquals(1, $res->json('count'));
    }

    // 10. Member tidak dapat mengakses goal orang lain
    public function test_10_member_cannot_access_other_member_goal(): void
    {
        $goal = MemberDevelopmentGoal::create([
            'user_id'  => $this->member2->id,
            'title'    => 'Target Rahasia Budi',
            'priority' => 'medium',
            'status'   => 'in_progress',
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->getJson("/api/member/learning/goals/{$goal->id}");

        $res->assertStatus(403);
    }

    // 11. Member dapat mengubah goal miliknya
    public function test_11_member_can_update_own_goal(): void
    {
        $goal = MemberDevelopmentGoal::create([
            'user_id'  => $this->member1->id,
            'title'    => 'Target Awal',
            'priority' => 'low',
            'status'   => 'planned',
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->putJson("/api/member/learning/goals/{$goal->id}", [
            'title'    => 'Target Diperbarui',
            'priority' => 'urgent',
            'status'   => 'in_progress',
        ]);

        $res->assertStatus(200);
        $this->assertEquals('Target Diperbarui', $res->json('goal.title'));
        $this->assertEquals('urgent', $res->json('goal.priority'));
    }

    // 12. Validasi status goal berjalan
    public function test_12_goal_status_validation_enforced(): void
    {
        Sanctum::actingAs($this->member1);

        $res = $this->postJson('/api/member/learning/goals', [
            'title'  => 'Status Invalid Goal',
            'status' => 'unknown_status',
        ]);

        $res->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    // 13. Target tanggal tervalidasi
    public function test_13_target_date_validated_properly(): void
    {
        Sanctum::actingAs($this->member1);

        $res = $this->postJson('/api/member/learning/goals', [
            'title'       => 'Date Validation Goal',
            'target_date' => 'bukan-tanggal-valid',
        ]);

        $res->assertStatus(422)
            ->assertJsonValidationErrors(['target_date']);
    }

    // 14. Progress tidak dibuat-buat (harus dari milestone atau eksplisit)
    public function test_14_goal_progress_is_not_fabricated(): void
    {
        $goal = MemberDevelopmentGoal::create([
            'user_id'  => $this->member1->id,
            'title'    => 'Target Tanpa Milestone',
            'status'   => 'planned',
            'progress' => 0,
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->getJson("/api/member/learning/goals/{$goal->id}");

        $this->assertEquals(0, $res->json('goal.progress'));
    }

    // 15. Goal completed memiliki aturan transisi yang benar
    public function test_15_goal_completed_transition_sets_100_progress_and_completed_at(): void
    {
        $goal = MemberDevelopmentGoal::create([
            'user_id'  => $this->member1->id,
            'title'    => 'Target Selesai',
            'status'   => 'in_progress',
            'progress' => 50,
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->putJson("/api/member/learning/goals/{$goal->id}", [
            'status' => 'completed',
        ]);

        $res->assertStatus(200);
        $this->assertEquals(100, $res->json('goal.progress'));
        $this->assertNotNull($res->json('goal.completed_at'));
    }

    // =========================================================================
    // MILESTONES (16 - 20)
    // =========================================================================

    // 16. Member dapat membuat milestone pada goal miliknya
    public function test_16_member_can_add_milestone_to_own_goal(): void
    {
        $goal = MemberDevelopmentGoal::create([
            'user_id'  => $this->member1->id,
            'title'    => 'Target Sertifikasi',
            'status'   => 'in_progress',
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->postJson("/api/member/learning/goals/{$goal->id}/milestones", [
            'title'       => 'Menyelesaikan Modul Dasar',
            'target_date' => Carbon::now()->addDays(7)->toDateString(),
        ]);

        $res->assertStatus(201);
        $this->assertDatabaseHas('member_development_milestones', [
            'goal_id' => $goal->id,
            'title'   => 'Menyelesaikan Modul Dasar',
        ]);
    }

    // 17. Member tidak dapat menambahkan milestone ke goal orang lain
    public function test_17_member_cannot_add_milestone_to_other_member_goal(): void
    {
        $goal = MemberDevelopmentGoal::create([
            'user_id'  => $this->member2->id,
            'title'    => 'Target Budi',
            'status'   => 'in_progress',
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->postJson("/api/member/learning/goals/{$goal->id}/milestones", [
            'title' => 'Milestone Ilegal',
        ]);

        $res->assertStatus(403);
    }

    // 18. Progress goal dihitung sesuai milestone
    public function test_18_goal_progress_recalculated_from_milestones(): void
    {
        $goal = MemberDevelopmentGoal::create([
            'user_id'  => $this->member1->id,
            'title'    => 'Target Belajar Vue',
            'status'   => 'in_progress',
            'progress' => 0,
        ]);

        $m1 = MemberDevelopmentMilestone::create([
            'goal_id'      => $goal->id,
            'title'        => 'M1 Selesai',
            'is_completed' => true,
            'completed_at' => Carbon::now(),
        ]);

        $m2 = MemberDevelopmentMilestone::create([
            'goal_id'      => $goal->id,
            'title'        => 'M2 Belum',
            'is_completed' => false,
        ]);

        $goal->recalculateProgress();
        $this->assertEquals(50, $goal->fresh()->progress);

        // Tandai M2 selesai melalui API
        Sanctum::actingAs($this->member1);
        $res = $this->putJson("/api/member/learning/milestones/{$m2->id}", [
            'is_completed' => true,
        ]);

        $res->assertStatus(200);
        $this->assertEquals(100, $res->json('progress'));
        $this->assertEquals(100, $goal->fresh()->progress);
    }

    // 19. Milestone yang selesai memiliki tanggal penyelesaian
    public function test_19_completed_milestone_has_completion_timestamp(): void
    {
        $goal = MemberDevelopmentGoal::create([
            'user_id' => $this->member1->id,
            'title'   => 'Goal Test',
        ]);

        $milestone = MemberDevelopmentMilestone::create([
            'goal_id'      => $goal->id,
            'title'        => 'Milestone 1',
            'is_completed' => false,
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->putJson("/api/member/learning/milestones/{$milestone->id}", [
            'is_completed' => true,
        ]);

        $res->assertStatus(200);
        $this->assertTrue($res->json('milestone.is_completed'));
        $this->assertNotNull($res->json('milestone.completed_at'));
    }

    // 20. Perubahan milestone tidak merusak histori
    public function test_20_milestone_deletion_recalculates_progress_cleanly(): void
    {
        $goal = MemberDevelopmentGoal::create([
            'user_id' => $this->member1->id,
            'title'   => 'Goal Test Deletion',
        ]);

        $m1 = MemberDevelopmentMilestone::create([
            'goal_id'      => $goal->id,
            'title'        => 'M1',
            'is_completed' => true,
            'completed_at' => Carbon::now(),
        ]);

        $m2 = MemberDevelopmentMilestone::create([
            'goal_id'      => $goal->id,
            'title'        => 'M2 yang akan dihapus',
            'is_completed' => false,
        ]);

        $goal->recalculateProgress();
        $this->assertEquals(50, $goal->fresh()->progress);

        Sanctum::actingAs($this->member1);
        $res = $this->deleteJson("/api/member/learning/milestones/{$m2->id}");

        $res->assertStatus(200);
        $this->assertEquals(100, $goal->fresh()->progress); // sekarang 1 dari 1 selesai = 100%
    }

    // =========================================================================
    // LEARNING ACTIVITIES (21 - 26)
    // =========================================================================

    // 21. Member dapat membuat aktivitas pembelajaran
    public function test_21_member_can_create_learning_activity(): void
    {
        Sanctum::actingAs($this->member1);

        $res = $this->postJson('/api/member/learning/activities', [
            'title'            => 'Mengikuti Webinar Clean Architecture',
            'activity_type'    => 'workshop',
            'description'      => 'Pembahasan SOLID principles',
            'activity_date'    => Carbon::now()->toDateString(),
            'duration_minutes' => 90,
            'learning_source'  => 'YouTube Tech Series',
            'learning_notes'   => 'Poin penting: Single Responsibility Principle',
            'status'           => 'completed',
        ]);

        $res->assertStatus(201);
        $this->assertDatabaseHas('member_learning_activities', [
            'user_id'          => $this->member1->id,
            'duration_minutes' => 90,
        ]);
    }

    // 22. Member dapat mengubah aktivitas miliknya
    public function test_22_member_can_update_own_learning_activity(): void
    {
        $act = MemberLearningActivity::create([
            'user_id'          => $this->member1->id,
            'title'            => 'Belajar Awal',
            'activity_type'    => 'self_learning',
            'activity_date'    => Carbon::now()->toDateString(),
            'duration_minutes' => 30,
            'status'           => 'planned',
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->putJson("/api/member/learning/activities/{$act->id}", [
            'title'            => 'Belajar Selesai',
            'duration_minutes' => 60,
            'status'           => 'completed',
        ]);

        $res->assertStatus(200);
        $this->assertEquals(60, $res->json('activity.duration_minutes'));
        $this->assertEquals('completed', $res->json('activity.status'));
    }

    // 23. Member tidak dapat mengakses aktivitas orang lain
    public function test_23_member_cannot_modify_other_member_activity(): void
    {
        $act = MemberLearningActivity::create([
            'user_id'       => $this->member2->id,
            'title'         => 'Aktivitas Budi',
            'activity_type' => 'mentoring',
            'activity_date' => Carbon::now()->toDateString(),
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->putJson("/api/member/learning/activities/{$act->id}", [
            'title' => 'Modifikasi Ilegal',
        ]);

        $res->assertStatus(403);
    }

    // 24. Durasi pembelajaran tervalidasi
    public function test_24_learning_duration_validated(): void
    {
        Sanctum::actingAs($this->member1);

        $res = $this->postJson('/api/member/learning/activities', [
            'title'            => 'Test Durasi',
            'activity_type'    => 'self_learning',
            'activity_date'    => Carbon::now()->toDateString(),
            'duration_minutes' => -10, // negatif tidak boleh
        ]);

        $res->assertStatus(422)
            ->assertJsonValidationErrors(['duration_minutes']);
    }

    // 25. Aktivitas dapat terhubung ke skill dan goal yang sesuai
    public function test_25_activity_can_be_linked_to_skill_and_goal(): void
    {
        $skill = MemberSkill::create([
            'user_id'       => $this->member1->id,
            'name'          => 'Unit Testing',
            'category'      => 'Technical Skills',
            'current_level' => 3,
            'target_level'  => 4,
        ]);

        $goal = MemberDevelopmentGoal::create([
            'user_id'  => $this->member1->id,
            'skill_id' => $skill->id,
            'title'    => 'Paham Mocking & TDD',
        ]);

        Sanctum::actingAs($this->member1);

        $res = $this->postJson('/api/member/learning/activities', [
            'title'         => 'Latihan PHPUnit Mockery',
            'activity_type' => 'practice_experiment',
            'activity_date' => Carbon::now()->toDateString(),
            'skill_id'      => $skill->id,
            'goal_id'       => $goal->id,
        ]);

        $res->assertStatus(201);
        $this->assertEquals($skill->id, $res->json('activity.skill_id'));
        $this->assertEquals($goal->id, $res->json('activity.goal_id'));
    }

    // 26. URL referensi tervalidasi
    public function test_26_reference_url_is_validated(): void
    {
        Sanctum::actingAs($this->member1);

        $res = $this->postJson('/api/member/learning/activities', [
            'title'         => 'Test URL',
            'activity_type' => 'self_learning',
            'activity_date' => Carbon::now()->toDateString(),
            'evidence_url'  => 'bukan-url-valid',
        ]);

        $res->assertStatus(422)
            ->assertJsonValidationErrors(['evidence_url']);
    }

    // =========================================================================
    // FEEDBACK & SECURITY (27 - 34)
    // =========================================================================

    // 27. Member dapat melihat feedback miliknya
    public function test_27_member_can_view_own_feedback(): void
    {
        MemberDevelopmentFeedback::create([
            'user_id'                => $this->member1->id,
            'reviewer_id'            => $this->pm->id,
            'feedback'               => 'Pertahankan performa pengerjaan modul auth yang bersih.',
            'action_recommendations' => 'Pelajari caching Redis untuk tahap berikutnya.',
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/learning/feedback');

        $res->assertStatus(200);
        $this->assertEquals(1, $res->json('count'));
        $this->assertEquals('PM Senior', $res->json('feedbacks.0.reviewer.name'));
    }

    // 28. Member tidak dapat membuat feedback PM palsu
    public function test_28_member_cannot_fabricate_pm_feedback(): void
    {
        Sanctum::actingAs($this->member1);

        $res = $this->postJson('/api/member/learning/feedback', [
            'user_id'  => $this->member1->id,
            'feedback' => 'Feedback palsu',
        ]);

        $res->assertStatus(403);
    }

    // 29. Member tidak dapat mengubah feedback PM (tidak ada endpoint update feedback)
    public function test_29_member_cannot_modify_pm_feedback(): void
    {
        $fb = MemberDevelopmentFeedback::create([
            'user_id'     => $this->member1->id,
            'reviewer_id' => $this->pm->id,
            'feedback'    => 'Feedback Asli PM',
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->putJson("/api/member/learning/feedback/{$fb->id}", [
            'feedback' => 'Diubah oleh Member',
        ]);

        // Method not allowed or not found
        $this->assertTrue(in_array($res->status(), [404, 405]));
    }

    // 30. PM dapat memberikan feedback kepada Member
    public function test_30_pm_can_submit_development_feedback_to_member(): void
    {
        Sanctum::actingAs($this->pm);

        $res = $this->postJson('/api/member/learning/feedback', [
            'user_id'                => $this->member1->id,
            'feedback'               => 'Kemampuan analisis log Anda sangat baik.',
            'action_recommendations' => 'Tingkatkan penulisan automated test.',
        ]);

        $res->assertStatus(201);
        $this->assertDatabaseHas('member_development_feedbacks', [
            'user_id'     => $this->member1->id,
            'reviewer_id' => $this->pm->id,
        ]);
        // Tahap M-B Integration: notifikasi dibuat untuk member
        $this->assertDatabaseHas('user_notifications', [
            'user_id'  => $this->member1->id,
            'type'     => 'development_feedback',
        ]);
    }

    // 31. Unauthenticated request menghasilkan 401
    public function test_31_unauthenticated_request_returns_401(): void
    {
        $this->getJson('/api/member/learning/overview')->assertStatus(401);
        $this->getJson('/api/member/learning/skills')->assertStatus(401);
        $this->getJson('/api/member/learning/goals')->assertStatus(401);
    }

    // 32. Role yang tidak berhak menerima 403
    public function test_32_unauthorized_roles_receive_403_on_member_overview(): void
    {
        Sanctum::actingAs($this->pimpinan);
        $this->getJson('/api/member/learning/overview')->assertStatus(403);
    }

    // 33. User tidak dapat meningkatkan privilege melalui request
    public function test_33_user_cannot_alter_ownership_via_payload(): void
    {
        Sanctum::actingAs($this->member1);

        // Mencoba mengirim user_id member2 saat membuat skill
        $res = $this->postJson('/api/member/learning/skills', [
            'user_id'       => $this->member2->id,
            'name'          => 'Injected Skill',
            'category'      => 'Technical Skills',
            'current_level' => 3,
            'target_level'  => 4,
        ]);

        $res->assertStatus(201);
        // Sistem tetap menggunakan auth()->id() member1
        $this->assertEquals($this->member1->id, $res->json('skill.user_id'));
    }

    // 34. Penghapusan data mengikuti aturan foreign key yang aman (cascade milestone saat goal dihapus)
    public function test_34_cascade_deletion_cleans_up_milestones(): void
    {
        $goal = MemberDevelopmentGoal::create([
            'user_id' => $this->member1->id,
            'title'   => 'Goal Cascade Test',
        ]);

        $milestone = MemberDevelopmentMilestone::create([
            'goal_id' => $goal->id,
            'title'   => 'Milestone to be cascaded',
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->deleteJson("/api/member/learning/goals/{$goal->id}");

        $res->assertStatus(200);
        $this->assertDatabaseMissing('member_development_goals', ['id' => $goal->id]);
        $this->assertDatabaseMissing('member_development_milestones', ['id' => $milestone->id]);
    }
}
