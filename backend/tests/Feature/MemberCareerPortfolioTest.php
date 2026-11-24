<?php

namespace Tests\Feature;

use App\Models\MemberLearningActivity;
use App\Models\MemberPortfolioAchievement;
use App\Models\MemberPortfolioProfile;
use App\Models\MemberPortfolioVerification;
use App\Models\MemberSkill;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MemberCareerPortfolioTest extends TestCase
{
    use RefreshDatabase;

    protected User $memberA;
    protected User $memberB;
    protected User $pmAuthorized;
    protected User $pmOther;
    protected User $admin;
    protected User $pimpinan;
    protected Project $projectA;
    protected Project $projectB;
    protected Task $taskA;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Setup Users
        $this->memberA = User::create([
            'name' => 'Budi Member A',
            'email' => 'budia@example.com',
            'password' => bcrypt('password'),
            'role' => 'member',
            'phone' => '081234567890',
            'is_active' => true,
        ]);

        $this->memberB = User::create([
            'name' => 'Siti Member B',
            'email' => 'sitib@example.com',
            'password' => bcrypt('password'),
            'role' => 'member',
            'phone' => '081234567891',
            'is_active' => true,
        ]);

        $this->pmAuthorized = User::create([
            'name' => 'Doni PM Alpha',
            'email' => 'donipm@example.com',
            'password' => bcrypt('password'),
            'role' => 'project_manager',
            'phone' => '081234567892',
            'is_active' => true,
        ]);

        $this->pmOther = User::create([
            'name' => 'Rina PM Beta',
            'email' => 'rinapm@example.com',
            'password' => bcrypt('password'),
            'role' => 'project_manager',
            'phone' => '081234567893',
            'is_active' => true,
        ]);

        $this->admin = User::create([
            'name' => 'Super Admin',
            'email' => 'admin@example.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'phone' => '081234567894',
            'is_active' => true,
        ]);

        $this->pimpinan = User::create([
            'name' => 'Direktur Utama',
            'email' => 'direktur@example.com',
            'password' => bcrypt('password'),
            'role' => 'pimpinan',
            'phone' => '081234567895',
            'is_active' => true,
        ]);

        // 2. Setup Projects
        $this->projectA = Project::create([
            'code' => 'PRJ-ALPHA',
            'name' => 'Sistem Informasi PKM Alpha',
            'client' => 'PT Klien Utama',
            'pic_id' => $this->pmAuthorized->id,
            'pic_name' => $this->pmAuthorized->name,
            'progress' => 50,
            'status' => 'on_track',
            'risk_level' => 'low',
            'deadline' => now()->addDays(30)->toDateString(),
            'category' => 'web',
            'is_active' => true,
        ]);

        $this->projectB = Project::create([
            'code' => 'PRJ-BETA',
            'name' => 'Portal Aplikasi Beta',
            'client' => 'PT Mitra Kedua',
            'pic_id' => $this->pmOther->id,
            'pic_name' => $this->pmOther->name,
            'progress' => 20,
            'status' => 'on_track',
            'risk_level' => 'low',
            'deadline' => now()->addDays(60)->toDateString(),
            'category' => 'mobile',
            'is_active' => true,
        ]);

        // 3. Setup Task penugasan Member A pada Project A (Member A berkontribusi pada Project A)
        $this->taskA = Task::create([
            'project_id' => $this->projectA->id,
            'title' => 'Implementasi Backend API Autentikasi',
            'priority' => 'high',
            'status' => 'completed',
            'is_completed' => true,
            'deadline' => now()->addDays(5)->toDateString(),
            'assignee_id' => $this->memberA->id,
            'assignee_name' => $this->memberA->name,
            'created_by' => $this->pmAuthorized->id,
        ]);
    }

    /**
     * Skenario 1: Member dapat melihat portofolio miliknya.
     */
    public function test_member_can_view_own_portfolio_overview(): void
    {
        $response = $this->actingAs($this->memberA)
            ->getJson('/api/member/portfolio/overview');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'metrics' => [
                    'total_achievements',
                    'verified_achievements',
                    'pending_verification',
                    'revision_requested',
                    'draft_achievements',
                    'total_projects_contributed',
                    'completed_tasks_count',
                    'skills_with_evidence',
                    'learning_hours',
                ],
                'recent_achievements',
                'recent_tasks',
                'profile',
            ]);

        $this->assertEquals(1, $response->json('metrics.total_projects_contributed'));
        $this->assertEquals(1, $response->json('metrics.completed_tasks_count'));
    }

    /**
     * Skenario 2: Member dapat membuat pencapaian.
     */
    public function test_member_can_create_achievement(): void
    {
        $payload = [
            'title' => 'Optimasi Query Database 40%',
            'category' => 'technical_achievement',
            'description' => 'Melakukan indeks ulang dan refactoring query pada modul laporan keuangan.',
            'achievement_date' => now()->subDays(2)->toDateString(),
            'project_id' => $this->projectA->id,
            'result_impact' => 'Waktu response turun dari 1200ms menjadi 180ms.',
            'evidence_url' => 'https://github.com/pkm/benchmark',
            'evidence_notes' => 'Tersimpan pada log sistem benchmark staging.',
            'is_featured' => true,
        ];

        $response = $this->actingAs($this->memberA)
            ->postJson('/api/member/portfolio/achievements', $payload);

        $response->assertStatus(201)
            ->assertJsonFragment([
                'title' => 'Optimasi Query Database 40%',
                'verification_status' => 'draft',
                'is_featured' => true,
            ]);

        $this->assertDatabaseHas('member_portfolio_achievements', [
            'user_id' => $this->memberA->id,
            'title' => 'Optimasi Query Database 40%',
            'verification_status' => 'draft',
        ]);
    }

    /**
     * Skenario 3: Member dapat mengubah pencapaian miliknya saat status draft.
     */
    public function test_member_can_update_own_draft_achievement(): void
    {
        $achievement = MemberPortfolioAchievement::create([
            'user_id' => $this->memberA->id,
            'title' => 'Judul Awal',
            'category' => 'project_achievement',
            'description' => 'Deskripsi lama.',
            'achievement_date' => now()->toDateString(),
            'verification_status' => 'draft',
        ]);

        $response = $this->actingAs($this->memberA)
            ->putJson("/api/member/portfolio/achievements/{$achievement->id}", [
                'title' => 'Judul Baru Diperbarui',
                'category' => 'project_achievement',
                'description' => 'Deskripsi baru setelah revisi draft.',
                'achievement_date' => now()->toDateString(),
            ]);

        $response->assertStatus(200)
            ->assertJsonFragment(['title' => 'Judul Baru Diperbarui']);

        $this->assertDatabaseHas('member_portfolio_achievements', [
            'id' => $achievement->id,
            'title' => 'Judul Baru Diperbarui',
        ]);
    }

    /**
     * Skenario 4: Member dapat menghapus draft miliknya.
     */
    public function test_member_can_delete_own_draft_achievement(): void
    {
        $achievement = MemberPortfolioAchievement::create([
            'user_id' => $this->memberA->id,
            'title' => 'Pencapaian Sementara',
            'category' => 'other_achievement',
            'description' => 'Akan segera dihapus.',
            'achievement_date' => now()->toDateString(),
            'verification_status' => 'draft',
        ]);

        $response = $this->actingAs($this->memberA)
            ->deleteJson("/api/member/portfolio/achievements/{$achievement->id}");

        $response->assertStatus(200);
        $this->assertDatabaseMissing('member_portfolio_achievements', ['id' => $achievement->id]);
    }

    /**
     * Skenario 5: Member tidak dapat mengakses pencapaian member lain (IDOR Prevention).
     */
    public function test_member_cannot_access_other_members_achievement(): void
    {
        $achievementB = MemberPortfolioAchievement::create([
            'user_id' => $this->memberB->id,
            'title' => 'Pencapaian Rahasia Member B',
            'category' => 'innovation',
            'description' => 'Hanya untuk Siti.',
            'achievement_date' => now()->toDateString(),
            'verification_status' => 'draft',
        ]);

        $response = $this->actingAs($this->memberA)
            ->getJson("/api/member/portfolio/achievements/{$achievementB->id}");

        $response->assertStatus(404);
    }

    /**
     * Skenario 6: Member tidak dapat mengubah pencapaian member lain.
     */
    public function test_member_cannot_update_other_members_achievement(): void
    {
        $achievementB = MemberPortfolioAchievement::create([
            'user_id' => $this->memberB->id,
            'title' => 'Prestasi Asli Member B',
            'category' => 'technical_achievement',
            'description' => 'Milik Member B.',
            'achievement_date' => now()->toDateString(),
            'verification_status' => 'draft',
        ]);

        $response = $this->actingAs($this->memberA)
            ->putJson("/api/member/portfolio/achievements/{$achievementB->id}", [
                'title' => 'Mencoba Bajak Prestasi',
                'category' => 'technical_achievement',
                'description' => 'Eksploitasi IDOR.',
                'achievement_date' => now()->toDateString(),
            ]);

        $response->assertStatus(404);
        $this->assertDatabaseHas('member_portfolio_achievements', [
            'id' => $achievementB->id,
            'title' => 'Prestasi Asli Member B',
        ]);
    }

    /**
     * Skenario 7: Member dapat mengirim pencapaian untuk verifikasi.
     */
    public function test_member_can_submit_achievement_for_verification(): void
    {
        $achievement = MemberPortfolioAchievement::create([
            'user_id' => $this->memberA->id,
            'project_id' => $this->projectA->id,
            'title' => 'Peluncuran Modul Pembayaran',
            'category' => 'project_achievement',
            'description' => 'Selesai tepat waktu dan lolos QA.',
            'achievement_date' => now()->toDateString(),
            'verification_status' => 'draft',
        ]);

        $response = $this->actingAs($this->memberA)
            ->postJson("/api/member/portfolio/achievements/{$achievement->id}/submit", [
                'notes' => 'Mohon ditinjau Pak PM Doni.',
            ]);

        $response->assertStatus(200)
            ->assertJsonFragment(['verification_status' => 'pending_verification']);

        $this->assertDatabaseHas('member_portfolio_achievements', [
            'id' => $achievement->id,
            'verification_status' => 'pending_verification',
        ]);

        $this->assertDatabaseHas('member_portfolio_verifications', [
            'achievement_id' => $achievement->id,
            'reviewer_id' => $this->memberA->id,
            'action' => 'submitted',
        ]);

        // Verifikasi notifikasi terkirim ke PM Doni
        $this->assertDatabaseHas('user_notifications', [
            'user_id' => $this->pmAuthorized->id,
            'type' => 'portfolio_submission',
        ]);
    }

    /**
     * Skenario 8: Member tidak dapat memverifikasi pencapaiannya sendiri.
     */
    public function test_member_cannot_verify_own_achievement(): void
    {
        $achievement = MemberPortfolioAchievement::create([
            'user_id' => $this->memberA->id,
            'title' => 'Prestasi Mandiri',
            'category' => 'technical_achievement',
            'description' => 'Coba verify diri sendiri.',
            'achievement_date' => now()->toDateString(),
            'verification_status' => 'pending_verification',
        ]);

        $response = $this->actingAs($this->memberA)
            ->postJson("/api/pm/portfolio/achievements/{$achievement->id}/verify");

        $response->assertStatus(403);
        $this->assertEquals('pending_verification', $achievement->fresh()->verification_status);
    }

    /**
     * Skenario 9: PM dapat memverifikasi pencapaian dalam lingkup kewenangannya.
     */
    public function test_pm_can_verify_achievement_in_authorized_project(): void
    {
        $achievement = MemberPortfolioAchievement::create([
            'user_id' => $this->memberA->id,
            'project_id' => $this->projectA->id, // Project A dipimpin oleh PM Doni (pmAuthorized)
            'title' => 'Integrasi API Payment Gateway',
            'category' => 'technical_achievement',
            'description' => 'Selesai dengan zero critical defect.',
            'achievement_date' => now()->toDateString(),
            'verification_status' => 'pending_verification',
        ]);

        $response = $this->actingAs($this->pmAuthorized)
            ->postJson("/api/pm/portfolio/achievements/{$achievement->id}/verify", [
                'notes' => 'Pekerjaan sangat rapi dan dokumentasi lengkap. Approved.',
            ]);

        $response->assertStatus(200)
            ->assertJsonFragment(['verification_status' => 'verified']);

        $this->assertDatabaseHas('member_portfolio_achievements', [
            'id' => $achievement->id,
            'verification_status' => 'verified',
            'verified_by' => $this->pmAuthorized->id,
        ]);

        // Notifikasi sampai ke Member A
        $this->assertDatabaseHas('user_notifications', [
            'user_id' => $this->memberA->id,
            'type' => 'portfolio_verified',
        ]);
    }

    /**
     * Skenario 10: PM ditolak untuk memverifikasi pencapaian di luar kewenangannya.
     */
    public function test_pm_rejected_when_verifying_outside_authority(): void
    {
        $achievement = MemberPortfolioAchievement::create([
            'user_id' => $this->memberA->id,
            'project_id' => $this->projectA->id, // Project A dipimpin oleh PM Doni, bukan PM Rina (pmOther)
            'title' => 'Tugas di Proyek Alpha',
            'category' => 'project_achievement',
            'description' => 'Milik Proyek Alpha.',
            'achievement_date' => now()->toDateString(),
            'verification_status' => 'pending_verification',
        ]);

        $response = $this->actingAs($this->pmOther)
            ->postJson("/api/pm/portfolio/achievements/{$achievement->id}/verify", [
                'notes' => 'Saya ingin approve.',
            ]);

        $response->assertStatus(403)
            ->assertJsonFragment([
                'message' => 'Anda tidak memiliki kewenangan untuk memverifikasi pencapaian pada proyek atau anggota tim ini.',
            ]);

        $this->assertEquals('pending_verification', $achievement->fresh()->verification_status);
    }

    /**
     * Skenario 11: PM dapat meminta revisi dengan alasan wajib.
     */
    public function test_pm_can_request_revision_with_mandatory_notes(): void
    {
        $achievement = MemberPortfolioAchievement::create([
            'user_id' => $this->memberA->id,
            'project_id' => $this->projectA->id,
            'title' => 'Pembuatan Dokumentasi API',
            'category' => 'process_improvement',
            'description' => 'Dokumentasi OpenAPI.',
            'achievement_date' => now()->toDateString(),
            'verification_status' => 'pending_verification',
        ]);

        // Uji coba kirim tanpa notes -> Harus gagal 422
        $failResponse = $this->actingAs($this->pmAuthorized)
            ->postJson("/api/pm/portfolio/achievements/{$achievement->id}/revision", [
                'notes' => '',
            ]);
        $failResponse->assertStatus(422);

        // Kirim dengan notes valid
        $successResponse = $this->actingAs($this->pmAuthorized)
            ->postJson("/api/pm/portfolio/achievements/{$achievement->id}/revision", [
                'notes' => 'Tolong lampirkan URL OpenAPI Swagger pada kolom bukti pendukung.',
            ]);

        $successResponse->assertStatus(200)
            ->assertJsonFragment(['verification_status' => 'revision_requested']);

        $this->assertDatabaseHas('member_portfolio_achievements', [
            'id' => $achievement->id,
            'verification_status' => 'revision_requested',
        ]);

        // Verifikasi notifikasi terkirim ke Member A
        $this->assertDatabaseHas('user_notifications', [
            'user_id' => $this->memberA->id,
            'type' => 'portfolio_revision',
        ]);
    }

    /**
     * Skenario 12: Member dapat mengirim ulang setelah revisi.
     */
    public function test_member_can_resubmit_after_revision_requested(): void
    {
        $achievement = MemberPortfolioAchievement::create([
            'user_id' => $this->memberA->id,
            'project_id' => $this->projectA->id,
            'title' => 'Dokumentasi Swagger Lengkap',
            'category' => 'process_improvement',
            'description' => 'Dokumentasi telah diperbaiki dengan endpoint lengkap.',
            'achievement_date' => now()->toDateString(),
            'evidence_url' => 'https://api.pkm.co.id/docs',
            'verification_status' => 'revision_requested',
        ]);

        $response = $this->actingAs($this->memberA)
            ->postJson("/api/member/portfolio/achievements/{$achievement->id}/submit", [
                'notes' => 'Sudah saya lengkapi URL Swagger sesuai arahan Pak PM.',
            ]);

        $response->assertStatus(200)
            ->assertJsonFragment(['verification_status' => 'pending_verification']);

        $this->assertDatabaseHas('member_portfolio_verifications', [
            'achievement_id' => $achievement->id,
            'action' => 'resubmitted',
        ]);
    }

    /**
     * Skenario 13: Riwayat verifikasi tersimpan lengkap.
     */
    public function test_verification_history_is_preserved(): void
    {
        $achievement = MemberPortfolioAchievement::create([
            'user_id' => $this->memberA->id,
            'project_id' => $this->projectA->id,
            'title' => 'Arsitektur Microservices',
            'category' => 'technical_achievement',
            'description' => 'Pemisahan modul.',
            'achievement_date' => now()->toDateString(),
            'verification_status' => 'draft',
        ]);

        // 1. Submit
        $this->actingAs($this->memberA)->postJson("/api/member/portfolio/achievements/{$achievement->id}/submit");
        // 2. PM Request Revision
        $this->actingAs($this->pmAuthorized)->postJson("/api/pm/portfolio/achievements/{$achievement->id}/revision", [
            'notes' => 'Perjelas diagram arsitekturnya.',
        ]);
        // 3. Resubmit
        $this->actingAs($this->memberA)->postJson("/api/member/portfolio/achievements/{$achievement->id}/submit", [
            'notes' => 'Sudah diupdate diagramnya.',
        ]);
        // 4. Verify
        $this->actingAs($this->pmAuthorized)->postJson("/api/pm/portfolio/achievements/{$achievement->id}/verify", [
            'notes' => 'Sempurna, disetujui.',
        ]);

        $history = MemberPortfolioVerification::where('achievement_id', $achievement->id)->get();
        $this->assertCount(4, $history);
        $this->assertEquals(['submitted', 'revision_requested', 'resubmitted', 'verified'], $history->pluck('action')->toArray());
    }

    /**
     * Skenario 14: Data proyek hanya menampilkan kontribusi member terkait.
     */
    public function test_project_contributions_only_shows_member_contributions(): void
    {
        // Member A hanya memiliki tugas di Project A, bukan Project B
        $response = $this->actingAs($this->memberA)
            ->getJson('/api/member/portfolio/project-contributions');

        $response->assertStatus(200);
        $contributions = $response->json('contributions');

        $this->assertCount(1, $contributions);
        $this->assertEquals('PRJ-ALPHA', $contributions[0]['project_code']);
        $this->assertFalse($contributions[0]['is_pic']);
        $this->assertEquals('Doni PM Alpha', $contributions[0]['pic_name']);
        $this->assertEquals(1, $contributions[0]['total_tasks_assigned']);
        $this->assertEquals(1, $contributions[0]['completed_tasks_count']);
    }

    /**
     * Skenario 15: Integrasi kompetensi mengambil data aktual M-D.
     */
    public function test_competency_evidence_integrates_actual_md_data(): void
    {
        $skill = MemberSkill::create([
            'user_id' => $this->memberA->id,
            'name' => 'Laravel Framework',
            'category' => 'Technical Skills',
            'current_level' => 4,
            'target_level' => 5,
            'evidence_url' => 'https://laravel.com/certs/12345',
            'evidence_notes' => 'Certified Laravel Developer 2026',
        ]);

        $learningActivity = MemberLearningActivity::create([
            'user_id' => $this->memberA->id,
            'skill_id' => $skill->id,
            'title' => 'Mastering Laravel Concurrency',
            'activity_type' => 'online_course',
            'activity_date' => now()->subDays(5)->toDateString(),
            'duration_minutes' => 120,
            'evidence_url' => 'https://laracasts.com/cert/concurrency',
            'status' => 'completed',
        ]);

        $response = $this->actingAs($this->memberA)
            ->getJson('/api/member/portfolio/competency-evidence');

        $response->assertStatus(200)
            ->assertJsonFragment([
                'name' => 'Laravel Framework',
                'current_level' => 4,
                'has_direct_evidence' => true,
            ]);

        $this->assertNotEmpty($response->json('learning_certificates'));
    }

    /**
     * Skenario 16: Pengaturan visibilitas & kurasi tidak mengekspos portofolio privat.
     */
    public function test_visibility_curation_preserves_private_settings(): void
    {
        $achievement = MemberPortfolioAchievement::create([
            'user_id' => $this->memberA->id,
            'title' => 'Proyek Internal Bersifat Privat',
            'category' => 'technical_achievement',
            'description' => 'Tidak untuk konsumsi publik.',
            'achievement_date' => now()->toDateString(),
            'verification_status' => 'verified',
            'is_visible' => false,
        ]);

        // Periksa tampilan presentasi -> harus mengecualikan item dengan is_visible = false
        $response = $this->actingAs($this->memberA)
            ->getJson('/api/member/portfolio/presentation');

        $response->assertStatus(200);
        $achievements = $response->json('achievements');
        $this->assertEmpty(collect($achievements)->where('id', $achievement->id));

        // Member toggle curate menjadi visible
        $patchResponse = $this->actingAs($this->memberA)
            ->patchJson("/api/member/portfolio/achievements/{$achievement->id}/curate", [
                'is_visible' => true,
                'is_featured' => true,
            ]);
        $patchResponse->assertStatus(200);

        $this->assertTrue($achievement->fresh()->is_visible);
        $this->assertTrue($achievement->fresh()->is_featured);
    }

    /**
     * Skenario 17: Endpoint menolak akses tanpa autentikasi (401).
     */
    public function test_endpoints_reject_unauthenticated_access(): void
    {
        $this->getJson('/api/member/portfolio/overview')->assertStatus(401);
        $this->getJson('/api/member/portfolio/achievements')->assertStatus(401);
        $this->postJson('/api/member/portfolio/achievements', [])->assertStatus(401);
        $this->getJson('/api/pm/portfolio/verification-queue')->assertStatus(401);
    }

    /**
     * Skenario 18: Role lain (bukan member) tidak dapat mengakses endpoint member tanpa izin (403).
     */
    public function test_non_members_cannot_access_member_portfolio_endpoints(): void
    {
        $this->actingAs($this->admin)
            ->getJson('/api/member/portfolio/overview')
            ->assertStatus(403);

        $this->actingAs($this->pmAuthorized)
            ->getJson('/api/member/portfolio/overview')
            ->assertStatus(403);

        $this->actingAs($this->pimpinan)
            ->getJson('/api/member/portfolio/overview')
            ->assertStatus(403);
    }

    /**
     * Skenario 19: Member tidak dapat menghapus atau mengubah pencapaian yang sudah terverifikasi.
     */
    public function test_member_cannot_modify_or_delete_verified_achievement(): void
    {
        $verifiedAchievement = MemberPortfolioAchievement::create([
            'user_id' => $this->memberA->id,
            'title' => 'Pencapaian Sah Terverifikasi',
            'category' => 'technical_achievement',
            'description' => 'Sudah tervalidasi.',
            'achievement_date' => now()->toDateString(),
            'verification_status' => 'verified',
        ]);

        $updateResponse = $this->actingAs($this->memberA)
            ->putJson("/api/member/portfolio/achievements/{$verifiedAchievement->id}", [
                'title' => 'Coba Ubah Yang Sudah Verified',
                'category' => 'technical_achievement',
                'description' => 'Harus ditolak.',
                'achievement_date' => now()->toDateString(),
            ]);
        $updateResponse->assertStatus(422);

        $deleteResponse = $this->actingAs($this->memberA)
            ->deleteJson("/api/member/portfolio/achievements/{$verifiedAchievement->id}");
        $deleteResponse->assertStatus(422);
    }

    /**
     * Skenario 20: Validasi integritas proyek (member tidak dapat mengaitkan proyek yang tidak pernah ia kerjakan).
     */
    public function test_member_cannot_link_project_without_actual_contribution(): void
    {
        // Project B tidak memiliki tugas yang ditugaskan ke Member A
        $response = $this->actingAs($this->memberA)
            ->postJson('/api/member/portfolio/achievements', [
                'title' => 'Klaim Palsu Proyek Beta',
                'category' => 'project_achievement',
                'description' => 'Mengklaim proyek tanpa penugasan.',
                'achievement_date' => now()->toDateString(),
                'project_id' => $this->projectB->id,
            ]);

        $response->assertStatus(422)
            ->assertJsonFragment([
                'message' => 'Anda hanya dapat mengaitkan proyek yang memang memiliki tugas penugasan untuk Anda.',
            ]);
    }

    /**
     * Skenario 21: Admin dapat memverifikasi pencapaian dari proyek manapun.
     */
    public function test_admin_can_verify_any_achievement(): void
    {
        $achievement = MemberPortfolioAchievement::create([
            'user_id' => $this->memberA->id,
            'project_id' => $this->projectA->id,
            'title' => 'Prestasi Skala Perusahaan',
            'category' => 'innovation',
            'description' => 'Diverifikasi langsung oleh Admin.',
            'achievement_date' => now()->toDateString(),
            'verification_status' => 'pending_verification',
        ]);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/pm/portfolio/achievements/{$achievement->id}/verify", [
                'notes' => 'Disetujui oleh Administrator Pusat.',
            ]);

        $response->assertStatus(200)
            ->assertJsonFragment(['verification_status' => 'verified']);

        $this->assertEquals($this->admin->id, $achievement->fresh()->verified_by);
    }

    /**
     * Skenario 22: Update headline dan bio profil portofolio berhasil.
     */
    public function test_member_can_update_portfolio_profile(): void
    {
        $response = $this->actingAs($this->memberA)
            ->putJson('/api/member/portfolio/presentation/profile', [
                'headline' => 'Senior Backend Engineer & Cloud Specialist',
                'summary_bio' => 'Berpengalaman 5 tahun dalam ekosistem Laravel dan arsitektur database terdistribusi.',
                'is_public_within_team' => true,
            ]);

        $response->assertStatus(200);

        $this->assertDatabaseHas('member_portfolio_profiles', [
            'user_id' => $this->memberA->id,
            'headline' => 'Senior Backend Engineer & Cloud Specialist',
            'is_public_within_team' => true,
        ]);
    }
}
