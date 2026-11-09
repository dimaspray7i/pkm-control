<?php

namespace Tests\Feature;

use App\Models\Milestone;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskChecklist;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PmTaskDistributionTest extends TestCase
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

    protected Milestone $milestonePm1;
    protected Milestone $milestonePm2;

    protected Task $taskPm1;
    protected Task $taskPm2;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedTestData();
    }

    protected function seedTestData(): void
    {
        $this->adminUser = User::create([
            'name' => 'Super Admin PKM',
            'email' => 'admin@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->pimpinanUser = User::create([
            'name' => 'Direktur Utama PKM',
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
            'name' => 'Andi Wijaya',
            'email' => 'andi@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'member',
            'is_active' => true,
        ]);

        $this->member2User = User::create([
            'name' => 'Budi Santoso',
            'email' => 'budi@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'member',
            'is_active' => true,
        ]);

        // Proyek PM 1
        $this->projectPm1 = Project::create([
            'code' => 'PRJ-PM1',
            'name' => 'Business Control Center PKM',
            'client' => 'PT Potensi Karya Mandiri',
            'pic_id' => $this->pm1User->id,
            'pic_name' => $this->pm1User->name,
            'category' => 'web',
            'status' => 'on_track',
            'progress' => 0,
            'risk_level' => 'low',
            'deadline' => Carbon::now()->addDays(30)->toDateString(),
            'is_active' => true,
        ]);

        // Proyek PM 2
        $this->projectPm2 = Project::create([
            'code' => 'PRJ-PM2',
            'name' => 'Warehouse Logistic System',
            'client' => 'PT Mitra Logistik',
            'pic_id' => $this->pm2User->id,
            'pic_name' => $this->pm2User->name,
            'category' => 'system',
            'status' => 'on_track',
            'progress' => 0,
            'risk_level' => 'low',
            'deadline' => Carbon::now()->addDays(60)->toDateString(),
            'is_active' => true,
        ]);

        // Milestone untuk Proyek PM 1
        $this->milestonePm1 = Milestone::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Sprint 1 - Authentication & Core',
            'phase_order' => 1,
            'status' => 'in_progress',
            'progress' => 0,
            'deadline' => Carbon::now()->addDays(14)->toDateString(),
        ]);

        // Milestone untuk Proyek PM 2
        $this->milestonePm2 = Milestone::create([
            'project_id' => $this->projectPm2->id,
            'title' => 'Sprint Alpha - Database Schema',
            'phase_order' => 1,
            'status' => 'in_progress',
            'progress' => 0,
            'deadline' => Carbon::now()->addDays(14)->toDateString(),
        ]);

        // Tugas di Proyek PM 1
        $this->taskPm1 = Task::create([
            'project_id' => $this->projectPm1->id,
            'milestone_id' => $this->milestonePm1->id,
            'title' => 'Membuat halaman laporan penjualan',
            'description' => 'Implementasi tabel dan grafik laporan omset.',
            'priority' => 'high',
            'status' => 'in_progress',
            'is_completed' => false,
            'deadline' => Carbon::now()->addDays(5)->toDateString(),
            'assignee_id' => $this->member1User->id,
            'assignee_name' => $this->member1User->name,
            'created_by' => $this->pm1User->id,
        ]);

        // Tugas di Proyek PM 2
        $this->taskPm2 = Task::create([
            'project_id' => $this->projectPm2->id,
            'milestone_id' => $this->milestonePm2->id,
            'title' => 'Integrasi barcode scanner warehouse',
            'description' => 'Koneksi REST API barcode scanner.',
            'priority' => 'medium',
            'status' => 'pending',
            'is_completed' => false,
            'deadline' => Carbon::now()->addDays(10)->toDateString(),
            'assignee_id' => $this->member2User->id,
            'assignee_name' => $this->member2User->name,
            'created_by' => $this->pm2User->id,
        ]);
    }

    /** 1. PM dapat melihat tugas dari proyek miliknya */
    public function test_pm_can_view_tasks_from_their_own_project(): void
    {
        Sanctum::actingAs($this->pm1User);

        $response = $this->getJson('/api/tasks');
        $response->assertStatus(200);

        $taskIds = collect($response->json('tasks'))->pluck('id')->all();
        $this->assertContains($this->taskPm1->id, $taskIds);
    }

    /** 2. PM tidak dapat melihat tugas proyek PM lain */
    public function test_pm_cannot_view_tasks_from_other_pm_projects(): void
    {
        Sanctum::actingAs($this->pm1User);

        $response = $this->getJson('/api/tasks');
        $response->assertStatus(200);

        $taskIds = collect($response->json('tasks'))->pluck('id')->all();
        $this->assertNotContains($this->taskPm2->id, $taskIds);
    }

    /** 3. PM dapat membuat tugas valid (dengan checklist dan assignee member) */
    public function test_pm_can_create_valid_task(): void
    {
        Sanctum::actingAs($this->pm1User);

        $payload = [
            'project_id' => $this->projectPm1->id,
            'milestone_id' => $this->milestonePm1->id,
            'title' => 'Membuat komponen React Dashboard',
            'description' => 'Desain komponen UI neobrutalism',
            'assignee_id' => $this->member1User->id,
            'priority' => 'high',
            'deadline' => Carbon::now()->addDays(7)->toDateString(),
            'checklists' => [
                ['title' => 'Membuat sketsa wireframe'],
                ['title' => 'Koding JSX komponen'],
            ],
        ];

        $response = $this->postJson('/api/tasks', $payload);
        $response->assertStatus(201);
        $this->assertDatabaseHas('tasks', ['title' => 'Membuat komponen React Dashboard']);
        $this->assertDatabaseHas('task_checklists', ['title' => 'Membuat sketsa wireframe']);
    }

    /** 4. PM tidak dapat membuat tugas tanpa checklist */
    public function test_pm_cannot_create_task_without_checklist(): void
    {
        Sanctum::actingAs($this->pm1User);

        $payload = [
            'project_id' => $this->projectPm1->id,
            'title' => 'Tugas Tanpa Checklist',
            'description' => 'Deskripsi tugas',
            'assignee_id' => $this->member1User->id,
            'priority' => 'medium',
            'deadline' => Carbon::now()->addDays(7)->toDateString(),
            'checklists' => [],
        ];

        $response = $this->postJson('/api/tasks', $payload);
        $response->assertStatus(422);
        $response->assertJsonValidationErrors('checklists');
    }

    /** 5. PM tidak dapat membuat tugas tanpa assignee */
    public function test_pm_cannot_create_task_without_assignee(): void
    {
        Sanctum::actingAs($this->pm1User);

        $payload = [
            'project_id' => $this->projectPm1->id,
            'title' => 'Tugas Tanpa Assignee',
            'description' => 'Deskripsi tugas',
            'priority' => 'medium',
            'deadline' => Carbon::now()->addDays(7)->toDateString(),
            'checklists' => [
                ['title' => 'Checklist 1'],
            ],
        ];

        $response = $this->postJson('/api/tasks', $payload);
        $response->assertStatus(422);
        $response->assertJsonValidationErrors('assignee_id');
    }

    /** 6. PM tidak dapat memilih Admin sebagai assignee */
    public function test_pm_cannot_assign_admin_as_task_assignee(): void
    {
        Sanctum::actingAs($this->pm1User);

        $payload = [
            'project_id' => $this->projectPm1->id,
            'title' => 'Tugas dengan Assignee Admin',
            'description' => 'Deskripsi tugas',
            'assignee_id' => $this->adminUser->id,
            'priority' => 'medium',
            'deadline' => Carbon::now()->addDays(7)->toDateString(),
            'checklists' => [
                ['title' => 'Item 1'],
            ],
        ];

        $response = $this->postJson('/api/tasks', $payload);
        $response->assertStatus(422);
        $response->assertJsonValidationErrors('assignee_id');
    }

    /** 7. PM tidak dapat memilih Pimpinan sebagai assignee */
    public function test_pm_cannot_assign_pimpinan_as_task_assignee(): void
    {
        Sanctum::actingAs($this->pm1User);

        $payload = [
            'project_id' => $this->projectPm1->id,
            'title' => 'Tugas dengan Assignee Pimpinan',
            'description' => 'Deskripsi tugas',
            'assignee_id' => $this->pimpinanUser->id,
            'priority' => 'medium',
            'deadline' => Carbon::now()->addDays(7)->toDateString(),
            'checklists' => [
                ['title' => 'Item 1'],
            ],
        ];

        $response = $this->postJson('/api/tasks', $payload);
        $response->assertStatus(422);
        $response->assertJsonValidationErrors('assignee_id');
    }

    /** 8. PM tidak dapat menggunakan project_id milik PM lain */
    public function test_pm_cannot_use_other_pm_project_id(): void
    {
        Sanctum::actingAs($this->pm1User);

        $payload = [
            'project_id' => $this->projectPm2->id,
            'title' => 'Tugas Menyusup ke Proyek PM 2',
            'description' => 'Deskripsi',
            'assignee_id' => $this->member1User->id,
            'priority' => 'high',
            'deadline' => Carbon::now()->addDays(7)->toDateString(),
            'checklists' => [
                ['title' => 'Item 1'],
            ],
        ];

        $response = $this->postJson('/api/tasks', $payload);
        $response->assertStatus(403);
    }

    /** 9. PM tidak dapat menggunakan milestone dari proyek lain */
    public function test_pm_cannot_use_milestone_from_other_project(): void
    {
        Sanctum::actingAs($this->pm1User);

        $payload = [
            'project_id' => $this->projectPm1->id,
            'milestone_id' => $this->milestonePm2->id, // Milestone milik proyek PM 2
            'title' => 'Tugas dengan Milestone Salah',
            'description' => 'Deskripsi',
            'assignee_id' => $this->member1User->id,
            'priority' => 'medium',
            'deadline' => Carbon::now()->addDays(7)->toDateString(),
            'checklists' => [
                ['title' => 'Item 1'],
            ],
        ];

        $response = $this->postJson('/api/tasks', $payload);
        $response->assertStatus(422);
        $response->assertJsonValidationErrors('milestone_id');
    }

    /** 10. PM dapat mengubah assignee pada tugas proyeknya (Quick Assign) */
    public function test_pm_can_quick_assign_member(): void
    {
        Sanctum::actingAs($this->pm1User);

        $response = $this->patchJson("/api/tasks/{$this->taskPm1->id}/assign", [
            'assignee_id' => $this->member2User->id,
        ]);

        $response->assertStatus(200);
        $this->assertEquals($this->member2User->id, $response->json('task.assignee_id'));
        $this->assertEquals($this->member2User->name, $response->json('task.assignee_name'));
        $this->assertDatabaseHas('tasks', [
            'id' => $this->taskPm1->id,
            'assignee_id' => $this->member2User->id,
        ]);
    }

    /** 11. PM tidak dapat mengubah tugas proyek PM lain */
    public function test_pm_cannot_update_task_in_other_pm_project(): void
    {
        Sanctum::actingAs($this->pm1User);

        $response = $this->putJson("/api/tasks/{$this->taskPm2->id}", [
            'project_id' => $this->projectPm2->id,
            'title' => 'Judul Baru yang Ilegal',
            'priority' => 'low',
        ]);

        $response->assertStatus(403);
    }

    /** 12. PM tidak dapat memindahkan tugas ke proyek PM lain */
    public function test_pm_cannot_move_task_to_another_pm_project(): void
    {
        Sanctum::actingAs($this->pm1User);

        $response = $this->putJson("/api/tasks/{$this->taskPm1->id}", [
            'project_id' => $this->projectPm2->id, // Memindahkan ke proyek PM 2
            'title' => $this->taskPm1->title,
            'priority' => 'high',
        ]);

        $response->assertStatus(403);
    }

    /** 13. Checklist progress dihitung otomatis */
    public function test_checklist_progress_is_calculated_automatically(): void
    {
        Sanctum::actingAs($this->pm1User);

        // Buat 4 checklist untuk taskPm1
        $c1 = TaskChecklist::create(['task_id' => $this->taskPm1->id, 'title' => 'C1', 'is_completed' => true, 'position' => 1]);
        $c2 = TaskChecklist::create(['task_id' => $this->taskPm1->id, 'title' => 'C2', 'is_completed' => true, 'position' => 2]);
        $c3 = TaskChecklist::create(['task_id' => $this->taskPm1->id, 'title' => 'C3', 'is_completed' => false, 'position' => 3]);
        $c4 = TaskChecklist::create(['task_id' => $this->taskPm1->id, 'title' => 'C4', 'is_completed' => false, 'position' => 4]);

        $this->assertEquals(50, $this->taskPm1->calculateChecklistProgress());

        // Tandai C3 selesai -> progres menjadi 75%
        $c3->update(['is_completed' => true]);
        $this->assertEquals(75, $this->taskPm1->calculateChecklistProgress());
    }

    /** 14. Checklist 100% tidak otomatis menjadikan task 'done' */
    public function test_checklist_100_percent_does_not_automatically_mark_task_as_done(): void
    {
        Sanctum::actingAs($this->pm1User);

        $c1 = TaskChecklist::create(['task_id' => $this->taskPm1->id, 'title' => 'Checklist A', 'is_completed' => false, 'position' => 1]);

        // Toggle checklist melalui API
        $response = $this->postJson("/api/checklists/{$c1->id}/toggle");
        $response->assertStatus(200);

        $this->taskPm1->refresh();
        $this->assertEquals(100, $this->taskPm1->calculateChecklistProgress());
        // Status task tetap 'in_progress', bukan 'completed' atau 'done'
        $this->assertEquals('in_progress', $this->taskPm1->status);
        $this->assertFalse($this->taskPm1->is_completed);
    }

    /** 15. Member tidak dapat mengakses endpoint pembuatan atau penghapusan tugas */
    public function test_member_cannot_create_or_delete_tasks(): void
    {
        Sanctum::actingAs($this->member1User);

        $resCreate = $this->postJson('/api/tasks', [
            'project_id' => $this->projectPm1->id,
            'title' => 'Tugas Ilegal oleh Member',
            'priority' => 'low',
        ]);
        $resCreate->assertStatus(403);

        $resDelete = $this->deleteJson("/api/tasks/{$this->taskPm1->id}");
        $resDelete->assertStatus(403);
    }

    /** 16. Admin tetap memiliki akses sesuai haknya */
    public function test_admin_retains_full_global_access(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/tasks');
        $response->assertStatus(200);

        // Admin dapat melihat semua tugas lintas proyek
        $taskIds = collect($response->json('tasks'))->pluck('id')->all();
        $this->assertContains($this->taskPm1->id, $taskIds);
        $this->assertContains($this->taskPm2->id, $taskIds);
    }

    /** 17. Pimpinan tetap memiliki hak akses sesuai kontrak yang berlaku (view-only) */
    public function test_pimpinan_has_view_only_access_and_cannot_modify(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        // Pimpinan dapat melihat daftar tugas
        $resList = $this->getJson('/api/tasks');
        $resList->assertStatus(200);

        // Pimpinan tidak dapat membuat tugas
        $resCreate = $this->postJson('/api/tasks', [
            'project_id' => $this->projectPm1->id,
            'title' => 'Tugas Ditolak untuk Pimpinan',
            'priority' => 'low',
        ]);
        $resCreate->assertStatus(403);

        // Pimpinan tidak dapat toggle status
        $resToggle = $this->postJson("/api/tasks/{$this->taskPm1->id}/toggle");
        $resToggle->assertStatus(403);
    }

    /** 18. Progress task dan project tidak mengalami regresi */
    public function test_task_and_project_progress_calculations_do_not_regress(): void
    {
        Project::recalculateProgressFor($this->projectPm1->id);
        $initialProjectProgress = $this->projectPm1->fresh()->progress;

        // Proyek dengan 1 task belum selesai -> progres = 0%
        $this->assertEquals(0, $initialProjectProgress);

        // Selesaikan taskPm1
        $this->taskPm1->update([
            'is_completed' => true,
            'status' => 'completed',
        ]);

        $updatedProjectProgress = $this->projectPm1->fresh()->progress;
        // Sekarang 1/1 task selesai -> progres proyek = 100%
        $this->assertEquals(100, $updatedProjectProgress);
    }
}
