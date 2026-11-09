<?php

namespace Tests\Feature;

use App\Models\Milestone;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProjectManagerAuthorizationTest extends TestCase
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

    /**
     * Seed data fixture untuk pengujian otorisasi peran Project Manager.
     */
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
            'name' => 'Member 1',
            'email' => 'member1@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'member',
            'is_active' => true,
        ]);

        $this->member2User = User::create([
            'name' => 'Member 2',
            'email' => 'member2@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'member',
            'is_active' => true,
        ]);

        // Proyek 1 milik PM 1
        $this->projectPm1 = Project::create([
            'code' => 'PRJ-PM1-001',
            'name' => 'Proyek Milik PM 1',
            'client' => 'PT Klien PM 1',
            'category' => 'web',
            'pic_id' => $this->pm1User->id,
            'pic_name' => $this->pm1User->name,
            'status' => 'on_track',
            'risk_level' => 'low',
            'is_active' => true,
        ]);

        // Proyek 2 milik PM 2
        $this->projectPm2 = Project::create([
            'code' => 'PRJ-PM2-002',
            'name' => 'Proyek Milik PM 2',
            'client' => 'PT Klien PM 2',
            'category' => 'mobile',
            'pic_id' => $this->pm2User->id,
            'pic_name' => $this->pm2User->name,
            'status' => 'on_track',
            'risk_level' => 'low',
            'is_active' => true,
        ]);

        // Milestone untuk Proyek 1
        $this->milestonePm1 = Milestone::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Sprint 1 - PM 1 Foundation',
            'phase_order' => 1,
            'status' => 'in_progress',
            'progress' => 0,
        ]);

        // Milestone untuk Proyek 2
        $this->milestonePm2 = Milestone::create([
            'project_id' => $this->projectPm2->id,
            'title' => 'Sprint 1 - PM 2 Foundation',
            'phase_order' => 1,
            'status' => 'in_progress',
            'progress' => 0,
        ]);

        // Task pada Proyek 1 ditugaskan ke Member 1
        $this->taskPm1 = Task::create([
            'project_id' => $this->projectPm1->id,
            'milestone_id' => $this->milestonePm1->id,
            'title' => 'Tugas A Proyek PM 1',
            'priority' => 'high',
            'status' => 'pending',
            'is_completed' => false,
            'assignee_id' => $this->member1User->id,
            'assignee_name' => $this->member1User->name,
        ]);

        // Task pada Proyek 2 ditugaskan ke Member 2
        $this->taskPm2 = Task::create([
            'project_id' => $this->projectPm2->id,
            'milestone_id' => $this->milestonePm2->id,
            'title' => 'Tugas B Proyek PM 2',
            'priority' => 'medium',
            'status' => 'pending',
            'is_completed' => false,
            'assignee_id' => $this->member2User->id,
            'assignee_name' => $this->member2User->name,
        ]);
    }

    /**
     * Uji 1: PM hanya melihat proyek miliknya pada endpoint listing.
     */
    public function test_pm_only_sees_their_own_projects_in_listing(): void
    {
        Sanctum::actingAs($this->pm1User);

        $response = $this->getJson('/api/projects');

        $response->assertStatus(200);
        $projectIds = collect($response->json('projects'))->pluck('id')->all();

        $this->assertContains($this->projectPm1->id, $projectIds);
        $this->assertNotContains($this->projectPm2->id, $projectIds);
    }

    /**
     * Uji 2: PM tidak dapat mengubah proyek milik PM lain.
     */
    public function test_pm_cannot_update_another_pms_project(): void
    {
        Sanctum::actingAs($this->pm1User);

        $response = $this->putJson("/api/projects/{$this->projectPm2->id}", [
            'name' => 'Upaya Pembajakan Proyek PM 2',
            'client' => 'Klien Bajakan',
        ]);

        $response->assertStatus(403);
        $this->assertDatabaseHas('projects', [
            'id' => $this->projectPm2->id,
            'name' => 'Proyek Milik PM 2',
        ]);
    }

    /**
     * Uji 3: PM tidak dapat menghapus proyek milik PM lain.
     */
    public function test_pm_cannot_delete_another_pms_project(): void
    {
        Sanctum::actingAs($this->pm1User);

        $response = $this->deleteJson("/api/projects/{$this->projectPm2->id}");

        $response->assertStatus(403);
        $this->assertDatabaseHas('projects', [
            'id' => $this->projectPm2->id,
        ]);
    }

    /**
     * Uji 4: PM tidak dapat membuat task di proyek milik PM lain.
     */
    public function test_pm_cannot_create_task_in_another_pms_project(): void
    {
        Sanctum::actingAs($this->pm1User);

        $response = $this->postJson('/api/tasks', [
            'project_id' => $this->projectPm2->id,
            'title' => 'Tugas Ilegal di Proyek PM 2',
            'priority' => 'high',
        ]);

        $response->assertStatus(403);
        $this->assertDatabaseMissing('tasks', [
            'title' => 'Tugas Ilegal di Proyek PM 2',
        ]);
    }

    /**
     * Uji 5: PM tidak dapat mengubah task proyek milik PM lain.
     */
    public function test_pm_cannot_update_task_in_another_pms_project(): void
    {
        Sanctum::actingAs($this->pm1User);

        $response = $this->putJson("/api/tasks/{$this->taskPm2->id}", [
            'project_id' => $this->projectPm2->id,
            'title' => 'Tugas B Diubah Ilegal',
            'priority' => 'high',
        ]);

        $response->assertStatus(403);
        $this->assertDatabaseHas('tasks', [
            'id' => $this->taskPm2->id,
            'title' => 'Tugas B Proyek PM 2',
        ]);
    }

    /**
     * Uji 6: PM tidak dapat menghapus task proyek milik PM lain.
     */
    public function test_pm_cannot_delete_task_in_another_pms_project(): void
    {
        Sanctum::actingAs($this->pm1User);

        $response = $this->deleteJson("/api/tasks/{$this->taskPm2->id}");

        $response->assertStatus(403);
        $this->assertDatabaseHas('tasks', [
            'id' => $this->taskPm2->id,
        ]);
    }

    /**
     * Uji 7: PM tidak dapat memindahkan task ke proyek milik PM lain.
     */
    public function test_pm_cannot_move_task_to_another_pms_project(): void
    {
        Sanctum::actingAs($this->pm1User);

        $response = $this->putJson("/api/tasks/{$this->taskPm1->id}", [
            'project_id' => $this->projectPm2->id,
            'title' => 'Pindah Paksa ke Proyek PM 2',
            'priority' => 'high',
        ]);

        $response->assertStatus(403);
        $this->assertEquals($this->projectPm1->id, $this->taskPm1->fresh()->project_id);
    }

    /**
     * Uji 8: PM tidak dapat mengelola sprint proyek milik PM lain (create, update, delete).
     */
    public function test_pm_cannot_manage_sprint_in_another_pms_project(): void
    {
        Sanctum::actingAs($this->pm1User);

        // Create sprint pada proyek PM 2
        $resCreate = $this->postJson('/api/milestones', [
            'project_id' => $this->projectPm2->id,
            'title' => 'Sprint Ilegal PM 1',
        ]);
        $resCreate->assertStatus(403);

        // Update sprint pada proyek PM 2
        $resUpdate = $this->putJson("/api/milestones/{$this->milestonePm2->id}", [
            'title' => 'Sprint 1 Diubah PM 1',
        ]);
        $resUpdate->assertStatus(403);

        // Delete sprint pada proyek PM 2
        $resDelete = $this->deleteJson("/api/milestones/{$this->milestonePm2->id}");
        $resDelete->assertStatus(403);
        $this->assertDatabaseHas('milestones', ['id' => $this->milestonePm2->id]);
    }

    /**
     * Uji 9: PM tidak dapat menugaskan admin atau pimpinan sebagai member pelaksana.
     */
    public function test_pm_cannot_assign_admin_or_pimpinan_as_task_worker(): void
    {
        Sanctum::actingAs($this->pm1User);

        // Coba menugaskan Admin saat membuat task
        $resAdmin = $this->postJson('/api/tasks', [
            'project_id' => $this->projectPm1->id,
            'title' => 'Tugas dengan Assignee Admin',
            'priority' => 'medium',
            'assignee_id' => $this->adminUser->id,
        ]);
        $resAdmin->assertStatus(422);

        // Coba menugaskan Pimpinan saat membuat task
        $resPimpinan = $this->postJson('/api/tasks', [
            'project_id' => $this->projectPm1->id,
            'title' => 'Tugas dengan Assignee Pimpinan',
            'priority' => 'medium',
            'assignee_id' => $this->pimpinanUser->id,
        ]);
        $resPimpinan->assertStatus(422);

        // Coba mengubah task eksisting menjadi ditugaskan ke Admin
        $resUpdate = $this->putJson("/api/tasks/{$this->taskPm1->id}", [
            'project_id' => $this->projectPm1->id,
            'title' => $this->taskPm1->title,
            'priority' => 'medium',
            'assignee_id' => $this->adminUser->id,
        ]);
        $resUpdate->assertStatus(422);
    }

    /**
     * Uji 10: Admin tetap dapat mengelola proyek lintas PM secara global.
     */
    public function test_admin_can_manage_projects_and_tasks_globally(): void
    {
        Sanctum::actingAs($this->adminUser);

        // Admin melihat kedua proyek di listing
        $resList = $this->getJson('/api/projects');
        $resList->assertStatus(200);
        $projectIds = collect($resList->json('projects'))->pluck('id')->all();
        $this->assertContains($this->projectPm1->id, $projectIds);
        $this->assertContains($this->projectPm2->id, $projectIds);

        // Admin dapat mengubah proyek milik PM manapun
        $resUpdate = $this->putJson("/api/projects/{$this->projectPm1->id}", [
            'name' => 'Proyek PM 1 Direvisi Super Admin',
            'client' => 'PT Klien PM 1',
        ]);
        $resUpdate->assertStatus(200);

        // Admin dapat membuat task di proyek manapun
        $resTask = $this->postJson('/api/tasks', [
            'project_id' => $this->projectPm2->id,
            'title' => 'Task Dibuat Admin di Proyek PM 2',
            'priority' => 'high',
        ]);
        $resTask->assertStatus(201);
    }

    /**
     * Uji 11: Pimpinan mempertahankan akses pemantauan (view-only) sesuai kontrak sebelumnya.
     */
    public function test_pimpinan_maintains_view_only_access(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        // Pimpinan dapat melihat seluruh proyek di listing
        $resList = $this->getJson('/api/projects');
        $resList->assertStatus(200);
        $projectIds = collect($resList->json('projects'))->pluck('id')->all();
        $this->assertContains($this->projectPm1->id, $projectIds);
        $this->assertContains($this->projectPm2->id, $projectIds);

        // Pimpinan tidak dapat mengubah proyek
        $resUpdateProj = $this->putJson("/api/projects/{$this->projectPm1->id}", [
            'name' => 'Pimpinan Mencoba Mengubah Proyek',
        ]);
        $resUpdateProj->assertStatus(403);

        // Pimpinan tidak dapat membuat task
        $resCreateTask = $this->postJson('/api/tasks', [
            'project_id' => $this->projectPm1->id,
            'title' => 'Tugas Pimpinan',
            'priority' => 'medium',
        ]);
        $resCreateTask->assertStatus(403);

        // Pimpinan tidak dapat mentoggle task
        $resToggle = $this->postJson("/api/tasks/{$this->taskPm1->id}/toggle");
        $resToggle->assertStatus(403);
    }

    /**
     * Uji 12: Member tetap mempertahankan hak akses sebelumnya.
     */
    public function test_member_maintains_their_access_rights(): void
    {
        Sanctum::actingAs($this->member1User);

        // Member dapat melihat detail tugas miliknya
        $resShow = $this->getJson("/api/tasks/{$this->taskPm1->id}");
        $resShow->assertStatus(200);

        // Member dapat mentoggle tugas yang ditugaskan kepadanya
        $resToggleOwn = $this->postJson("/api/tasks/{$this->taskPm1->id}/toggle");
        $resToggleOwn->assertStatus(200);
        $this->assertTrue((bool) $this->taskPm1->fresh()->is_completed);

        // Member tidak dapat mentoggle tugas milik member lain
        $resToggleOther = $this->postJson("/api/tasks/{$this->taskPm2->id}/toggle");
        $resToggleOther->assertStatus(403);

        // Member tidak dapat membuat tugas baru
        $resCreate = $this->postJson('/api/tasks', [
            'project_id' => $this->projectPm1->id,
            'title' => 'Tugas dari Member',
            'priority' => 'low',
        ]);
        $resCreate->assertStatus(403);

        // Member tidak dapat menghapus tugas
        $resDelete = $this->deleteJson("/api/tasks/{$this->taskPm1->id}");
        $resDelete->assertStatus(403);
    }

    /**
     * Uji 13: PM tidak dapat membuat proyek dengan pic_id milik pengguna lain.
     */
    public function test_pm_cannot_create_project_with_another_users_pic_id(): void
    {
        Sanctum::actingAs($this->pm1User);

        $response = $this->postJson('/api/projects', [
            'code' => 'PRJ-ILLEGAL-001',
            'name' => 'Proyek Ilegal',
            'client' => 'Klien Ilegal',
            'category' => 'web',
            'pic_id' => $this->pm2User->id,
        ]);

        $response->assertStatus(403);
        $this->assertDatabaseMissing('projects', [
            'code' => 'PRJ-ILLEGAL-001',
        ]);
    }

    /**
     * Uji 14: PM tidak dapat memindahkan kepemilikan proyek ke PM lain saat update.
     */
    public function test_pm_cannot_reassign_project_ownership_to_another_user(): void
    {
        Sanctum::actingAs($this->pm1User);

        $response = $this->putJson("/api/projects/{$this->projectPm1->id}", [
            'pic_id' => $this->pm2User->id,
            'name' => 'Proyek Dipindahkan Kepemilikannya',
        ]);

        $response->assertStatus(403);
        $this->assertEquals($this->pm1User->id, $this->projectPm1->fresh()->pic_id);
    }

    /**
     * Uji 15: PM tidak dapat melihat detail proyek PM lain.
     */
    public function test_pm_cannot_view_details_of_another_pms_project(): void
    {
        Sanctum::actingAs($this->pm1User);

        $response = $this->getJson("/api/projects/{$this->projectPm2->id}");
        $response->assertStatus(403);

        // Namun dapat melihat proyek miliknya sendiri
        $ownResponse = $this->getJson("/api/projects/{$this->projectPm1->id}");
        $ownResponse->assertStatus(200);
    }

    /**
     * Uji 16: PM tidak dapat melihat detail tugas proyek PM lain.
     */
    public function test_pm_cannot_view_details_of_another_pms_task(): void
    {
        Sanctum::actingAs($this->pm1User);

        $response = $this->getJson("/api/tasks/{$this->taskPm2->id}");
        $response->assertStatus(403);

        // Namun dapat melihat tugas proyek miliknya sendiri
        $ownResponse = $this->getJson("/api/tasks/{$this->taskPm1->id}");
        $ownResponse->assertStatus(200);
    }

    /**
     * Uji 17: PM tidak dapat melihat sprint proyek PM lain.
     */
    public function test_pm_cannot_view_sprints_of_another_pms_project(): void
    {
        Sanctum::actingAs($this->pm1User);

        $resIndex = $this->getJson("/api/projects/{$this->projectPm2->id}/milestones");
        $resIndex->assertStatus(403);

        $resShow = $this->getJson("/api/milestones/{$this->milestonePm2->id}");
        $resShow->assertStatus(403);

        // Namun dapat melihat sprint proyek miliknya
        $ownRes = $this->getJson("/api/projects/{$this->projectPm1->id}/milestones");
        $ownRes->assertStatus(200);
    }

    /**
     * Uji 18: Perhitungan progres proyek dan milestone tetap bekerja secara akurat.
     */
    public function test_project_and_milestone_progress_calculation_remains_accurate(): void
    {
        Sanctum::actingAs($this->pm1User);

        // Status awal: 1 tugas pending -> progress 0%
        $this->assertEquals(0, $this->projectPm1->fresh()->calculateActualProgress());

        // Tandai tugas A selesai melalui toggle
        Sanctum::actingAs($this->member1User);
        $resToggle = $this->postJson("/api/tasks/{$this->taskPm1->id}/toggle");
        $resToggle->assertStatus(200);

        // 1 tugas selesai dari 1 tugas -> progress 100%
        $this->assertEquals(100, $this->projectPm1->fresh()->calculateActualProgress());
        $this->assertEquals(100, $this->projectPm1->fresh()->progress);
        $this->assertEquals(100, $this->milestonePm1->fresh()->progress);
    }
}
