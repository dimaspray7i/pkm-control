<?php

namespace Tests\Feature;

use App\Models\Milestone;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskChecklist;
use App\Models\TaskUpdate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TaskProgressUpdateTest extends TestCase
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

    protected Task $taskM1;
    protected Task $taskM2;

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

        $this->taskM1 = Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Implementasi Modul Autentikasi',
            'description' => 'Mengerjakan sistem otentikasi Sanctum dan role authorization',
            'priority' => 'high',
            'status' => 'in_progress',
            'is_completed' => false,
            'deadline' => now()->addDays(5)->toDateString(),
            'assignee_id' => $this->member1User->id,
            'assignee_name' => $this->member1User->name,
            'created_by' => $this->pm1User->id,
        ]);

        $this->taskM2 = Task::create([
            'project_id' => $this->projectPm2->id,
            'title' => 'Desain Wireframe UI/UX',
            'description' => 'Membuat wireframe landing page dan workspace',
            'priority' => 'medium',
            'status' => 'pending',
            'is_completed' => false,
            'deadline' => now()->addDays(7)->toDateString(),
            'assignee_id' => $this->member2User->id,
            'assignee_name' => $this->member2User->name,
            'created_by' => $this->pm2User->id,
        ]);

        // Berikan checklist pada taskM1: 2 selesai dari 4 (50%)
        TaskChecklist::create(['task_id' => $this->taskM1->id, 'title' => 'Checklist 1', 'is_completed' => true, 'position' => 1]);
        TaskChecklist::create(['task_id' => $this->taskM1->id, 'title' => 'Checklist 2', 'is_completed' => true, 'position' => 2]);
        TaskChecklist::create(['task_id' => $this->taskM1->id, 'title' => 'Checklist 3', 'is_completed' => false, 'position' => 3]);
        TaskChecklist::create(['task_id' => $this->taskM1->id, 'title' => 'Checklist 4', 'is_completed' => false, 'position' => 4]);
    }

    /**
     * 1. Member berhasil membuat progress update untuk task miliknya.
     */
    public function test_member_can_create_progress_update_for_own_task()
    {
        Sanctum::actingAs($this->member1User);

        $response = $this->postJson("/api/tasks/{$this->taskM1->id}/updates", [
            'work_description' => 'Menyelesaikan modul login dan middleware auth',
            'blocker' => 'Perlu pengecekan CORS di staging',
            'next_plan' => 'Lanjut pembuatan feature test',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('update.work_description', 'Menyelesaikan modul login dan middleware auth');
        $response->assertJsonPath('update.completed_checklists', 2);
        $response->assertJsonPath('update.total_checklists', 4);
        $response->assertJsonPath('update.progress_snapshot', 50);
        $response->assertJsonPath('update.blocker', 'Perlu pengecekan CORS di staging');
        $response->assertJsonPath('update.next_plan', 'Lanjut pembuatan feature test');

        $this->assertDatabaseHas('task_updates', [
            'task_id' => $this->taskM1->id,
            'user_id' => $this->member1User->id,
            'work_description' => 'Menyelesaikan modul login dan middleware auth',
            'progress_snapshot' => 50,
        ]);
    }

    /**
     * 2. Deskripsi pekerjaan wajib diisi.
     */
    public function test_work_description_is_required()
    {
        Sanctum::actingAs($this->member1User);

        $response = $this->postJson("/api/tasks/{$this->taskM1->id}/updates", [
            'work_description' => '',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['work_description']);
    }

    /**
     * 3. Snapshot progres tersimpan dengan benar berdasarkan checklist aktual.
     */
    public function test_progress_snapshot_is_accurately_captured()
    {
        Sanctum::actingAs($this->member1User);

        // Saat ini: 2 dari 4 selesai = 50%
        $res = $this->postJson("/api/tasks/{$this->taskM1->id}/updates", [
            'work_description' => 'Update progres pertama',
        ]);

        $res->assertStatus(201);
        $res->assertJsonPath('update.progress_snapshot', 50);
        $res->assertJsonPath('update.completed_checklists', 2);
        $res->assertJsonPath('update.total_checklists', 4);
    }

    /**
     * 4. Snapshot histori tidak berubah setelah checklist task diubah di kemudian hari.
     */
    public function test_snapshot_remains_intact_when_task_checklists_change_later()
    {
        Sanctum::actingAs($this->member1User);

        // Buat laporan saat 50%
        $res = $this->postJson("/api/tasks/{$this->taskM1->id}/updates", [
            'work_description' => 'Laporan saat 50% progress',
        ]);
        $updateId = $res->json('update.id');

        // Ubah checklist menjadi 100% selesai (centang checklist 3 dan 4)
        $this->taskM1->checklists()->update(['is_completed' => true]);

        // Cek kembali record update di database dan via API
        $historyRes = $this->getJson("/api/tasks/{$this->taskM1->id}/updates");
        $historyRes->assertStatus(200);

        $savedUpdate = collect($historyRes->json('updates'))->firstWhere('id', $updateId);
        $this->assertEquals(50, $savedUpdate['progress_snapshot']);
        $this->assertEquals(2, $savedUpdate['completed_checklists']);
        $this->assertEquals(4, $savedUpdate['total_checklists']);
    }

    /**
     * 5. Setiap laporan menghasilkan record baru dan laporan lama tidak tertimpa.
     */
    public function test_each_update_creates_a_new_record_without_overwriting_previous_ones()
    {
        Sanctum::actingAs($this->member1User);

        $this->postJson("/api/tasks/{$this->taskM1->id}/updates", [
            'work_description' => 'Laporan 1: Desain awal',
        ])->assertStatus(201);

        $this->postJson("/api/tasks/{$this->taskM1->id}/updates", [
            'work_description' => 'Laporan 2: Coding backend',
        ])->assertStatus(201);

        $this->postJson("/api/tasks/{$this->taskM1->id}/updates", [
            'work_description' => 'Laporan 3: Pengujian integrasi',
        ])->assertStatus(201);

        $this->assertEquals(3, TaskUpdate::where('task_id', $this->taskM1->id)->count());

        $res = $this->getJson("/api/tasks/{$this->taskM1->id}/updates");
        $res->assertStatus(200);
        $res->assertJsonCount(3, 'updates');

        // Pastikan urutan terbaru di atas
        $updates = $res->json('updates');
        $this->assertEquals('Laporan 3: Pengujian integrasi', $updates[0]['work_description']);
        $this->assertEquals('Laporan 1: Desain awal', $updates[2]['work_description']);
    }

    /**
     * 6. Member A tidak dapat membuat laporan untuk task Member B.
     */
    public function test_member_cannot_create_update_for_another_members_task()
    {
        Sanctum::actingAs($this->member1User);

        // Task M2 adalah milik Member 2
        $response = $this->postJson("/api/tasks/{$this->taskM2->id}/updates", [
            'work_description' => 'Mencoba membuat laporan pada tugas orang lain',
        ]);

        $response->assertStatus(403);
    }

    /**
     * 7. Member A tidak dapat membaca histori task Member B.
     */
    public function test_member_cannot_read_history_of_another_members_task()
    {
        Sanctum::actingAs($this->member1User);

        $response = $this->getJson("/api/tasks/{$this->taskM2->id}/updates");
        $response->assertStatus(403);
    }

    /**
     * 8. Member tidak dapat mengedit atau menghapus laporan.
     */
    public function test_member_cannot_update_or_delete_reports()
    {
        Sanctum::actingAs($this->member1User);

        $res = $this->postJson("/api/tasks/{$this->taskM1->id}/updates", [
            'work_description' => 'Laporan asli',
        ]);
        $updateId = $res->json('update.id');

        // Percobaan PUT / PATCH / DELETE ke endpoint updates harus ditolak (404/405 tidak ada route modifikasi)
        $this->putJson("/api/task-updates/{$updateId}", ['work_description' => 'Hack deskripsi'])->assertStatus(404);
        $this->deleteJson("/api/task-updates/{$updateId}")->assertStatus(404);
    }

    /**
     * 9. PM dapat membaca histori task di proyek miliknya.
     */
    public function test_pm_can_read_history_of_tasks_in_own_project()
    {
        // Member 1 buat update di taskM1 (proyek dipimpin PM 1)
        Sanctum::actingAs($this->member1User);
        $this->postJson("/api/tasks/{$this->taskM1->id}/updates", [
            'work_description' => 'Update pengerjaan modul auth oleh member 1',
        ]);

        // Login sebagai PM 1
        Sanctum::actingAs($this->pm1User);
        $response = $this->getJson("/api/tasks/{$this->taskM1->id}/updates");

        $response->assertStatus(200);
        $response->assertJsonCount(1, 'updates');
        $response->assertJsonPath('updates.0.work_description', 'Update pengerjaan modul auth oleh member 1');
    }

    /**
     * 10. PM tidak dapat membaca histori task di proyek milik PM lain.
     */
    public function test_pm_cannot_read_history_of_tasks_in_other_pms_project()
    {
        // Login sebagai PM 2 mencoba membaca taskM1 (milik PM 1)
        Sanctum::actingAs($this->pm2User);
        $response = $this->getJson("/api/tasks/{$this->taskM1->id}/updates");

        $response->assertStatus(403);
    }

    /**
     * 11. Admin dapat membaca histori seluruh task.
     */
    public function test_admin_has_global_access_to_read_task_history()
    {
        Sanctum::actingAs($this->member1User);
        $this->postJson("/api/tasks/{$this->taskM1->id}/updates", [
            'work_description' => 'Laporan member 1',
        ]);

        Sanctum::actingAs($this->adminUser);
        $response = $this->getJson("/api/tasks/{$this->taskM1->id}/updates");
        $response->assertStatus(200);
        $response->assertJsonCount(1, 'updates');
    }

    /**
     * 12. Pimpinan dapat membaca histori task (read-only).
     */
    public function test_pimpinan_has_read_only_access_to_task_history()
    {
        Sanctum::actingAs($this->member1User);
        $this->postJson("/api/tasks/{$this->taskM1->id}/updates", [
            'work_description' => 'Laporan member 1 untuk pimpinan',
        ]);

        Sanctum::actingAs($this->pimpinanUser);
        $response = $this->getJson("/api/tasks/{$this->taskM1->id}/updates");
        $response->assertStatus(200);

        // Pimpinan tidak boleh membuat laporan
        $createRes = $this->postJson("/api/tasks/{$this->taskM1->id}/updates", [
            'work_description' => 'Pimpinan mencoba membuat laporan',
        ]);
        $createRes->assertStatus(403);
    }

    /**
     * 13. Laporan tidak mengubah status task menjadi done/completed.
     */
    public function test_progress_update_does_not_change_task_status_to_done()
    {
        Sanctum::actingAs($this->member1User);

        // Buat semua checklist selesai (100%)
        $this->taskM1->checklists()->update(['is_completed' => true]);

        // Simpan progress update saat 100%
        $this->postJson("/api/tasks/{$this->taskM1->id}/updates", [
            'work_description' => 'Semua checklist selesai dikerjakan',
        ])->assertStatus(201);

        // Pastikan status task tetap 'in_progress' dan is_completed tetap false
        $this->taskM1->refresh();
        $this->assertEquals('in_progress', $this->taskM1->status);
        $this->assertFalse($this->taskM1->is_completed);
    }

    /**
     * 14. Endpoint menolak request tanpa autentikasi (401).
     */
    public function test_unauthenticated_request_is_rejected()
    {
        $response = $this->getJson("/api/tasks/{$this->taskM1->id}/updates");
        $response->assertStatus(401);

        $postResponse = $this->postJson("/api/tasks/{$this->taskM1->id}/updates", [
            'work_description' => 'Tanpa login',
        ]);
        $postResponse->assertStatus(401);
    }

    /**
     * 15. Lampiran aman: upload, private storage, dan download dengan validasi otorisasi.
     */
    public function test_attachment_upload_and_secure_download_with_authorization()
    {
        Storage::fake('local');
        Sanctum::actingAs($this->member1User);

        $file = UploadedFile::fake()->create('dokumen_laporan.pdf', 200, 'application/pdf');

        $response = $this->postJson("/api/tasks/{$this->taskM1->id}/updates", [
            'work_description' => 'Laporan dengan lampiran PDF',
            'attachment' => $file,
        ]);

        $response->assertStatus(201);
        $updateId = $response->json('update.id');

        $update = TaskUpdate::find($updateId);
        $this->assertNotNull($update->attachment_path);
        $this->assertEquals('dokumen_laporan.pdf', $update->attachment_name);
        Storage::disk('local')->assertExists($update->attachment_path);

        // Member 1 (pemilik) dapat mengunduh lampiran
        $downloadRes = $this->get("/api/task-updates/{$updateId}/download");
        $downloadRes->assertStatus(200);

        // PM 1 (PM proyek) dapat mengunduh lampiran
        Sanctum::actingAs($this->pm1User);
        $pmDownloadRes = $this->get("/api/task-updates/{$updateId}/download");
        $pmDownloadRes->assertStatus(200);

        // Member 2 (bukan pemilik) DITOLAK (403)
        Sanctum::actingAs($this->member2User);
        $m2DownloadRes = $this->get("/api/task-updates/{$updateId}/download");
        $m2DownloadRes->assertStatus(403);

        // PM 2 (PM proyek lain) DITOLAK (403)
        Sanctum::actingAs($this->pm2User);
        $pm2DownloadRes = $this->get("/api/task-updates/{$updateId}/download");
        $pm2DownloadRes->assertStatus(403);
    }
}
