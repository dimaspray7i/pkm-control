<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\Task;
use App\Models\TaskChecklist;
use App\Models\TaskReview;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TaskApprovalWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $pimpinanUser;
    protected User $pm1User;
    protected User $pm2User;
    protected User $member1User;
    protected User $member2User;

    protected Project $projectPm1;
    protected Project $projectPm2;

    protected Task $task1;
    protected Task $task2;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedTestData();
    }

    protected function seedTestData(): void
    {
        $this->adminUser = User::create([
            'name' => 'Admin PKM',
            'email' => 'admin@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->pimpinanUser = User::create([
            'name' => 'Pimpinan PKM',
            'email' => 'pimpinan@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'pimpinan',
            'is_active' => true,
        ]);

        $this->pm1User = User::create([
            'name' => 'Project Manager 1',
            'email' => 'pm1@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        $this->pm2User = User::create([
            'name' => 'Project Manager 2',
            'email' => 'pm2@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        $this->member1User = User::create([
            'name' => 'Budi Santoso (Member 1)',
            'email' => 'budi@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'member',
            'is_active' => true,
        ]);

        $this->member2User = User::create([
            'name' => 'Siti Rahma (Member 2)',
            'email' => 'siti@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'member',
            'is_active' => true,
        ]);

        $this->projectPm1 = Project::create([
            'name' => 'Proyek Digitalisasi PKM 1',
            'code' => 'PKM-001',
            'client' => 'Klien Alpha',
            'status' => 'in_progress',
            'progress' => 0,
            'pic_id' => $this->pm1User->id,
            'pic_name' => $this->pm1User->name,
            'budget' => 50000000,
        ]);

        $this->projectPm2 = Project::create([
            'name' => 'Proyek Redesign PKM 2',
            'code' => 'PKM-002',
            'client' => 'Klien Beta',
            'status' => 'in_progress',
            'progress' => 0,
            'pic_id' => $this->pm2User->id,
            'pic_name' => $this->pm2User->name,
            'budget' => 75000000,
        ]);

        $this->task1 = Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Implementasi Fitur Approval',
            'description' => 'Mengerjakan sistem persetujuan tugas',
            'priority' => 'high',
            'status' => 'in_progress',
            'is_completed' => false,
            'deadline' => now()->addDays(3)->toDateString(),
            'assignee_id' => $this->member1User->id,
            'assignee_name' => $this->member1User->name,
            'created_by' => $this->pm1User->id,
        ]);

        $this->task2 = Task::create([
            'project_id' => $this->projectPm2->id,
            'title' => 'Riset Pasar PKM 2',
            'description' => 'Mengerjakan analisis kompetitor',
            'priority' => 'medium',
            'status' => 'in_progress',
            'is_completed' => false,
            'deadline' => now()->addDays(4)->toDateString(),
            'assignee_id' => $this->member2User->id,
            'assignee_name' => $this->member2User->name,
            'created_by' => $this->pm2User->id,
        ]);

        // Berikan checklist pada task1: 2 checklist selesai (100%)
        TaskChecklist::create(['task_id' => $this->task1->id, 'title' => 'Checklist A', 'is_completed' => true, 'position' => 1]);
        TaskChecklist::create(['task_id' => $this->task1->id, 'title' => 'Checklist B', 'is_completed' => true, 'position' => 2]);

        // Berikan checklist pada task2: 1 selesai, 1 belum (50%)
        TaskChecklist::create(['task_id' => $this->task2->id, 'title' => 'Checklist C', 'is_completed' => true, 'position' => 1]);
        TaskChecklist::create(['task_id' => $this->task2->id, 'title' => 'Checklist D', 'is_completed' => false, 'position' => 2]);
    }

    /**
     * 1. Member berhasil submit task dengan checklist 100%.
     */
    public function test_member_can_submit_task_with_100_percent_checklist()
    {
        Sanctum::actingAs($this->member1User);

        $response = $this->postJson("/api/tasks/{$this->task1->id}/submit-review", [
            'notes' => 'Pekerjaan telah selesai sesuai instruksi, mohon review.',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('task.status', 'in_review');

        $this->task1->refresh();
        $this->assertEquals('in_review', $this->task1->status);
        $this->assertFalse($this->task1->is_completed);

        $this->assertDatabaseHas('task_reviews', [
            'task_id' => $this->task1->id,
            'user_id' => $this->member1User->id,
            'action' => 'submitted',
            'from_status' => 'in_progress',
            'to_status' => 'in_review',
        ]);
    }

    /**
     * 2. Member ditolak submit jika checklist belum 100%.
     */
    public function test_member_cannot_submit_if_checklist_not_100_percent()
    {
        Sanctum::actingAs($this->member2User);

        // Task 2 baru 50%
        $response = $this->postJson("/api/tasks/{$this->task2->id}/submit-review");

        $response->assertStatus(422);
        $response->assertJsonPath('checklist_stats.progress', 50);

        $this->task2->refresh();
        $this->assertEquals('in_progress', $this->task2->status);
    }

    /**
     * 3. Member tidak dapat submit task milik orang lain.
     */
    public function test_member_cannot_submit_another_members_task()
    {
        Sanctum::actingAs($this->member2User);

        // Member 2 mencoba submit Task 1 (milik Member 1)
        $response = $this->postJson("/api/tasks/{$this->task1->id}/submit-review");

        $response->assertStatus(403);
    }

    /**
     * 4. Member tidak dapat submit task berulang ketika in_review.
     */
    public function test_member_cannot_resubmit_while_task_is_already_in_review()
    {
        Sanctum::actingAs($this->member1User);

        $this->postJson("/api/tasks/{$this->task1->id}/submit-review")->assertStatus(200);

        // Coba submit ulang saat status sudah in_review
        $response = $this->postJson("/api/tasks/{$this->task1->id}/submit-review");
        $response->assertStatus(422);
    }

    /**
     * 5. Checklist tidak dapat diubah selama in_review.
     */
    public function test_checklist_cannot_be_modified_while_task_is_in_review()
    {
        Sanctum::actingAs($this->member1User);
        $this->postJson("/api/tasks/{$this->task1->id}/submit-review")->assertStatus(200);

        $chk = $this->task1->checklists()->first();

        // Coba toggle checklist item saat in_review
        $response = $this->postJson("/api/checklists/{$chk->id}/toggle");
        $response->assertStatus(422);
    }

    /**
     * 6. PM dapat melihat pending review proyeknya.
     */
    public function test_pm_can_view_pending_reviews_for_own_project()
    {
        Sanctum::actingAs($this->member1User);
        $this->postJson("/api/tasks/{$this->task1->id}/submit-review")->assertStatus(200);

        Sanctum::actingAs($this->pm1User);
        $response = $this->getJson('/api/tasks/pending-review');

        $response->assertStatus(200);
        $response->assertJsonCount(1, 'tasks');
        $response->assertJsonPath('tasks.0.id', $this->task1->id);
    }

    /**
     * 7. PM tidak dapat melihat atau mereview proyek PM lain.
     */
    public function test_pm_cannot_view_or_review_tasks_from_other_pms_project()
    {
        Sanctum::actingAs($this->member1User);
        $this->postJson("/api/tasks/{$this->task1->id}/submit-review")->assertStatus(200);

        // PM 2 cek pending review (tidak boleh melihat task proyek PM 1)
        Sanctum::actingAs($this->pm2User);
        $listRes = $this->getJson('/api/tasks/pending-review');
        $listRes->assertStatus(200);
        $listRes->assertJsonCount(0, 'tasks');

        // PM 2 mencoba approve Task 1
        $approveRes = $this->postJson("/api/tasks/{$this->task1->id}/approve");
        $approveRes->assertStatus(403);

        // PM 2 mencoba request revision pada Task 1
        $revRes = $this->postJson("/api/tasks/{$this->task1->id}/request-revision", ['reason' => 'Alasan PM 2']);
        $revRes->assertStatus(403);
    }

    /**
     * 8. PM berhasil approve task.
     */
    public function test_pm_can_approve_task_successfully()
    {
        Sanctum::actingAs($this->member1User);
        $this->postJson("/api/tasks/{$this->task1->id}/submit-review")->assertStatus(200);

        Sanctum::actingAs($this->pm1User);
        $response = $this->postJson("/api/tasks/{$this->task1->id}/approve", [
            'notes' => 'Pekerjaan sangat baik dan lengkap, disetujui.',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('task.status', 'done');

        $this->task1->refresh();
        $this->assertEquals('done', $this->task1->status);
        $this->assertTrue($this->task1->is_completed);

        $this->assertDatabaseHas('task_reviews', [
            'task_id' => $this->task1->id,
            'user_id' => $this->pm1User->id,
            'action' => 'approved',
            'from_status' => 'in_review',
            'to_status' => 'done',
        ]);
    }

    /**
     * 9. PM berhasil request revision dengan alasan.
     */
    public function test_pm_can_request_revision_with_reason()
    {
        Sanctum::actingAs($this->member1User);
        $this->postJson("/api/tasks/{$this->task1->id}/submit-review")->assertStatus(200);

        Sanctum::actingAs($this->pm1User);
        $response = $this->postJson("/api/tasks/{$this->task1->id}/request-revision", [
            'reason' => 'Format file laporan kurang rapi, tolong perbaiki.',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('task.status', 'in_progress');

        $this->task1->refresh();
        $this->assertEquals('in_progress', $this->task1->status);
        $this->assertFalse($this->task1->is_completed);

        $this->assertDatabaseHas('task_reviews', [
            'task_id' => $this->task1->id,
            'user_id' => $this->pm1User->id,
            'action' => 'revision_requested',
            'from_status' => 'in_review',
            'to_status' => 'in_progress',
            'notes' => 'Format file laporan kurang rapi, tolong perbaiki.',
        ]);
    }

    /**
     * 10. Request revision tanpa alasan ditolak.
     */
    public function test_request_revision_without_reason_is_rejected()
    {
        Sanctum::actingAs($this->member1User);
        $this->postJson("/api/tasks/{$this->task1->id}/submit-review")->assertStatus(200);

        Sanctum::actingAs($this->pm1User);
        $response = $this->postJson("/api/tasks/{$this->task1->id}/request-revision", [
            'reason' => '',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['reason']);
    }

    /**
     * 11. Member dapat melanjutkan checklist setelah revisi.
     */
    public function test_member_can_modify_checklists_after_revision_is_requested()
    {
        Sanctum::actingAs($this->member1User);
        $this->postJson("/api/tasks/{$this->task1->id}/submit-review")->assertStatus(200);

        Sanctum::actingAs($this->pm1User);
        $this->postJson("/api/tasks/{$this->task1->id}/request-revision", ['reason' => 'Perbaiki poin A'])->assertStatus(200);

        // Member toggle checklist kembali (misal uncheck untuk perbaikan)
        Sanctum::actingAs($this->member1User);
        $chk = $this->task1->checklists()->first();
        $toggleRes = $this->postJson("/api/checklists/{$chk->id}/toggle");
        $toggleRes->assertStatus(200);
    }

    /**
     * 12. Member dapat submit ulang setelah checklist 100%.
     */
    public function test_member_can_resubmit_after_completing_checklists_again()
    {
        Sanctum::actingAs($this->member1User);
        $this->postJson("/api/tasks/{$this->task1->id}/submit-review")->assertStatus(200);

        Sanctum::actingAs($this->pm1User);
        $this->postJson("/api/tasks/{$this->task1->id}/request-revision", ['reason' => 'Perbaiki poin B'])->assertStatus(200);

        // Checklist masih 100% (karena kedua checklist masih true), Member submit ulang
        Sanctum::actingAs($this->member1User);
        $resubmitRes = $this->postJson("/api/tasks/{$this->task1->id}/submit-review", [
            'notes' => 'Sudah diperbaiki poin B, mohon review kembali.',
        ]);

        $resubmitRes->assertStatus(200);
        $this->task1->refresh();
        $this->assertEquals('in_review', $this->task1->status);
    }

    /**
     * 13. Approval history menyimpan seluruh siklus review.
     */
    public function test_approval_history_records_full_review_lifecycle()
    {
        Sanctum::actingAs($this->member1User);
        $this->postJson("/api/tasks/{$this->task1->id}/submit-review", ['notes' => 'Siklus 1'])->assertStatus(200);

        Sanctum::actingAs($this->pm1User);
        $this->postJson("/api/tasks/{$this->task1->id}/request-revision", ['reason' => 'Revisi 1'])->assertStatus(200);

        Sanctum::actingAs($this->member1User);
        $this->postJson("/api/tasks/{$this->task1->id}/submit-review", ['notes' => 'Siklus 2'])->assertStatus(200);

        Sanctum::actingAs($this->pm1User);
        $this->postJson("/api/tasks/{$this->task1->id}/approve", ['notes' => 'Disetujui di siklus 2'])->assertStatus(200);

        $historyRes = $this->getJson("/api/tasks/{$this->task1->id}/reviews");
        $historyRes->assertStatus(200);
        $historyRes->assertJsonCount(4, 'reviews');

        $actions = collect($historyRes->json('reviews'))->pluck('action')->all();
        $this->assertEquals(['approved', 'submitted', 'revision_requested', 'submitted'], $actions);
    }

    /**
     * 14. PM dapat reopen task done.
     */
    public function test_pm_can_reopen_completed_task()
    {
        Sanctum::actingAs($this->member1User);
        $this->postJson("/api/tasks/{$this->task1->id}/submit-review")->assertStatus(200);

        Sanctum::actingAs($this->pm1User);
        $this->postJson("/api/tasks/{$this->task1->id}/approve")->assertStatus(200);

        // PM reopen task done
        $reopenRes = $this->postJson("/api/tasks/{$this->task1->id}/reopen", [
            'reason' => 'Klien meminta penyesuaian tambahan pada fungsionalitas.',
        ]);

        $reopenRes->assertStatus(200);
        $this->task1->refresh();
        $this->assertEquals('in_progress', $this->task1->status);
        $this->assertFalse($this->task1->is_completed);

        $this->assertDatabaseHas('task_reviews', [
            'task_id' => $this->task1->id,
            'action' => 'reopened',
            'to_status' => 'in_progress',
        ]);
    }

    /**
     * 15. Reopen wajib memiliki alasan.
     */
    public function test_reopen_requires_a_reason()
    {
        $this->task1->update(['status' => 'done', 'is_completed' => true]);

        Sanctum::actingAs($this->pm1User);
        $res = $this->postJson("/api/tasks/{$this->task1->id}/reopen", ['reason' => '']);

        $res->assertStatus(422);
        $res->assertJsonValidationErrors(['reason']);
    }

    /**
     * 16. Reopen mengembalikan status ke in_progress.
     */
    public function test_reopen_returns_status_to_in_progress()
    {
        $this->task1->update(['status' => 'done', 'is_completed' => true]);

        Sanctum::actingAs($this->pm1User);
        $res = $this->postJson("/api/tasks/{$this->task1->id}/reopen", ['reason' => 'Ada bug baru']);

        $res->assertStatus(200);
        $this->task1->refresh();
        $this->assertEquals('in_progress', $this->task1->status);
        $this->assertFalse($this->task1->is_completed);
    }

    /**
     * 17. Member tidak dapat melakukan approval atau reopen.
     */
    public function test_member_cannot_approve_or_reopen_tasks()
    {
        Sanctum::actingAs($this->member1User);
        $this->task1->update(['status' => 'in_review']);

        $approveRes = $this->postJson("/api/tasks/{$this->task1->id}/approve");
        $approveRes->assertStatus(403);

        $this->task1->update(['status' => 'done', 'is_completed' => true]);
        $reopenRes = $this->postJson("/api/tasks/{$this->task1->id}/reopen", ['reason' => 'Member mencoba reopen']);
        $reopenRes->assertStatus(403);
    }

    /**
     * 18. Pimpinan tidak dapat melakukan mutasi approval (read-only).
     */
    public function test_pimpinan_cannot_perform_approval_mutations()
    {
        $this->task1->update(['status' => 'in_review']);
        Sanctum::actingAs($this->pimpinanUser);

        $this->postJson("/api/tasks/{$this->task1->id}/approve")->assertStatus(403);
        $this->postJson("/api/tasks/{$this->task1->id}/request-revision", ['reason' => 'Catatan pimpinan'])->assertStatus(403);
        $this->postJson("/api/tasks/{$this->task1->id}/reopen", ['reason' => 'Reopen pimpinan'])->assertStatus(403);

        // Tapi pimpinan dapat melihat pending list dan reviews history
        $this->getJson('/api/tasks/pending-review')->assertStatus(200);
        $this->getJson("/api/tasks/{$this->task1->id}/reviews")->assertStatus(200);
    }

    /**
     * 19. Admin dapat mengakses sesuai kebijakan global.
     */
    public function test_admin_has_global_access_for_approval_actions()
    {
        $this->task1->update(['status' => 'in_review']);
        Sanctum::actingAs($this->adminUser);

        // Admin approve task proyek PM 1
        $res = $this->postJson("/api/tasks/{$this->task1->id}/approve", ['notes' => 'Disetujui Admin PKM']);
        $res->assertStatus(200);
        $this->task1->refresh();
        $this->assertEquals('done', $this->task1->status);
    }

    /**
     * 20. User tanpa autentikasi mendapat 401.
     */
    public function test_unauthenticated_requests_are_rejected()
    {
        $this->getJson('/api/tasks/pending-review')->assertStatus(401);
        $this->postJson("/api/tasks/{$this->task1->id}/submit-review")->assertStatus(401);
        $this->postJson("/api/tasks/{$this->task1->id}/approve")->assertStatus(401);
        $this->postJson("/api/tasks/{$this->task1->id}/request-revision")->assertStatus(401);
        $this->postJson("/api/tasks/{$this->task1->id}/reopen")->assertStatus(401);
    }

    /**
     * 21. Status task dan audit trail tetap konsisten ketika transaksi gagal.
     */
    public function test_task_status_and_audit_trail_remain_consistent_on_failure()
    {
        Sanctum::actingAs($this->member1User);

        // Coba request revision saat status task masih in_progress (akan gagal validasi 422)
        Sanctum::actingAs($this->pm1User);
        $failRes = $this->postJson("/api/tasks/{$this->task1->id}/request-revision", ['reason' => 'Gagal']);
        $failRes->assertStatus(422);

        // Pastikan tidak ada record review yang bocor tersimpan
        $this->assertEquals(0, TaskReview::where('task_id', $this->task1->id)->count());
        $this->task1->refresh();
        $this->assertEquals('in_progress', $this->task1->status);
    }

    /**
     * 22. Approval dan reopen menghitung ulang progress proyek secara benar.
     */
    public function test_approval_and_reopen_properly_recalculate_project_progress()
    {
        // Proyek PM 1 hanya memiliki 1 task (task1).
        $this->projectPm1->syncProgress();
        $this->assertEquals(0, $this->projectPm1->progress);

        // Submit dan approve
        Sanctum::actingAs($this->member1User);
        $this->postJson("/api/tasks/{$this->task1->id}/submit-review")->assertStatus(200);

        Sanctum::actingAs($this->pm1User);
        $this->postJson("/api/tasks/{$this->task1->id}/approve")->assertStatus(200);

        // Task done -> progress proyek harus 100%
        $this->projectPm1->refresh();
        $this->assertEquals(100, $this->projectPm1->progress);

        // Reopen task -> progress proyek harus turun kembali ke 0%
        $this->postJson("/api/tasks/{$this->task1->id}/reopen", ['reason' => 'Buka kembali'])->assertStatus(200);
        $this->projectPm1->refresh();
        $this->assertEquals(0, $this->projectPm1->progress);
    }
}
