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

class MemberTodoListTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $pimpinanUser;
    protected User $pmUser;
    protected User $member1User;
    protected User $member2User;

    protected Project $project;
    protected Milestone $milestone;

    protected Task $taskMember1;
    protected Task $taskMember2;

    protected TaskChecklist $checklistM1;
    protected TaskChecklist $checklistM2;

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

        $this->pmUser = User::create([
            'name' => 'Project Manager PKM',
            'email' => 'pm@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        $this->member1User = User::create([
            'name' => 'Andi Member 1',
            'email' => 'andi@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'member',
            'is_active' => true,
        ]);

        $this->member2User = User::create([
            'name' => 'Budi Member 2',
            'email' => 'budi@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'member',
            'is_active' => true,
        ]);

        $this->project = Project::create([
            'code' => 'PRJ-MEMBER-TEST',
            'name' => 'Project Member Test',
            'client' => 'PT Test Mandiri',
            'pic_id' => $this->pmUser->id,
            'pic_name' => $this->pmUser->name,
            'category' => 'web',
            'status' => 'on_track',
            'progress' => 0,
            'risk_level' => 'low',
            'deadline' => Carbon::now()->addDays(30)->toDateString(),
            'is_active' => true,
        ]);

        $this->milestone = Milestone::create([
            'project_id' => $this->project->id,
            'title' => 'Sprint 1 Member Testing',
            'phase_order' => 1,
            'status' => 'in_progress',
            'progress' => 0,
            'deadline' => Carbon::now()->addDays(14)->toDateString(),
        ]);

        // Task milik Member 1
        $this->taskMember1 = Task::create([
            'project_id' => $this->project->id,
            'milestone_id' => $this->milestone->id,
            'title' => 'Tugas Spesifik untuk Member 1',
            'description' => 'Instruksi pengerjaan tugas member 1',
            'priority' => 'high',
            'status' => 'in_progress',
            'is_completed' => false,
            'deadline' => Carbon::now()->addDays(3)->toDateString(),
            'assignee_id' => $this->member1User->id,
            'assignee_name' => $this->member1User->name,
            'created_by' => $this->pmUser->id,
        ]);

        // Task milik Member 2
        $this->taskMember2 = Task::create([
            'project_id' => $this->project->id,
            'milestone_id' => $this->milestone->id,
            'title' => 'Tugas Spesifik untuk Member 2',
            'description' => 'Instruksi pengerjaan tugas member 2',
            'priority' => 'medium',
            'status' => 'pending',
            'is_completed' => false,
            'deadline' => Carbon::now()->addDays(5)->toDateString(),
            'assignee_id' => $this->member2User->id,
            'assignee_name' => $this->member2User->name,
            'created_by' => $this->pmUser->id,
        ]);

        // Checklist untuk Task Member 1
        $this->checklistM1 = TaskChecklist::create([
            'task_id' => $this->taskMember1->id,
            'title' => 'Checklist 1 Milik Member 1',
            'is_completed' => false,
            'position' => 1,
        ]);

        // Checklist untuk Task Member 2
        $this->checklistM2 = TaskChecklist::create([
            'task_id' => $this->taskMember2->id,
            'title' => 'Checklist 2 Milik Member 2',
            'is_completed' => false,
            'position' => 1,
        ]);
    }

    /** 1. Member hanya melihat tugas yang ditugaskan kepadanya */
    public function test_member_only_sees_assigned_tasks(): void
    {
        Sanctum::actingAs($this->member1User);

        $response = $this->getJson('/api/tasks');
        $response->assertStatus(200);

        $taskIds = collect($response->json('tasks'))->pluck('id')->all();
        $this->assertContains($this->taskMember1->id, $taskIds);
        $this->assertCount(1, $taskIds);
    }

    /** 2. Member tidak melihat tugas Member lain */
    public function test_member_does_not_see_other_members_tasks(): void
    {
        Sanctum::actingAs($this->member1User);

        $response = $this->getJson('/api/tasks');
        $response->assertStatus(200);

        $taskIds = collect($response->json('tasks'))->pluck('id')->all();
        $this->assertNotContains($this->taskMember2->id, $taskIds);
    }

    /** 3. Member dapat membuka detail tugas sendiri */
    public function test_member_can_view_own_task_detail(): void
    {
        Sanctum::actingAs($this->member1User);

        $response = $this->getJson("/api/tasks/{$this->taskMember1->id}");
        $response->assertStatus(200);
        $this->assertEquals($this->taskMember1->id, $response->json('task.id'));
        $this->assertEquals($this->taskMember1->title, $response->json('task.title'));
    }

    /** 4. Member tidak dapat membuka detail tugas Member lain */
    public function test_member_cannot_view_other_members_task_detail(): void
    {
        Sanctum::actingAs($this->member1User);

        $response = $this->getJson("/api/tasks/{$this->taskMember2->id}");
        $response->assertStatus(403);
    }

    /** 5. Member dapat membaca checklist tugas sendiri */
    public function test_member_can_view_own_task_checklists(): void
    {
        Sanctum::actingAs($this->member1User);

        $response = $this->getJson("/api/tasks/{$this->taskMember1->id}/checklists");
        $response->assertStatus(200);

        $chkIds = collect($response->json('checklists'))->pluck('id')->all();
        $this->assertContains($this->checklistM1->id, $chkIds);
    }

    /** 6. Member tidak dapat membaca checklist tugas lain */
    public function test_member_cannot_view_other_members_task_checklists(): void
    {
        Sanctum::actingAs($this->member1User);

        $response = $this->getJson("/api/tasks/{$this->taskMember2->id}/checklists");
        $response->assertStatus(403);
    }

    /** 7. Member dapat toggle checklist tugas sendiri */
    public function test_member_can_toggle_own_task_checklist(): void
    {
        Sanctum::actingAs($this->member1User);

        $response = $this->postJson("/api/checklists/{$this->checklistM1->id}/toggle");
        $response->assertStatus(200);

        $this->checklistM1->refresh();
        $this->assertTrue($this->checklistM1->is_completed);
        $this->assertEquals($this->member1User->id, $this->checklistM1->completed_by);
    }

    /** 8. Member tidak dapat toggle checklist tugas lain */
    public function test_member_cannot_toggle_other_members_task_checklist(): void
    {
        Sanctum::actingAs($this->member1User);

        $response = $this->postJson("/api/checklists/{$this->checklistM2->id}/toggle");
        $response->assertStatus(403);
    }

    /** 9. Progress dihitung otomatis setelah checklist berubah */
    public function test_progress_is_calculated_automatically_after_checklist_toggle(): void
    {
        Sanctum::actingAs($this->member1User);

        // Tambah checklist kedua untuk taskMember1
        $chk2 = TaskChecklist::create([
            'task_id' => $this->taskMember1->id,
            'title' => 'Checklist 2 Milik Member 1',
            'is_completed' => false,
            'position' => 2,
        ]);

        // Toggle checklist 1
        $resToggle = $this->postJson("/api/checklists/{$this->checklistM1->id}/toggle");
        $resToggle->assertStatus(200);

        // Progres 1 dari 2 selesai = 50%
        $this->assertEquals(50, $resToggle->json('stats.progress'));
        $this->assertEquals(50, $this->taskMember1->calculateChecklistProgress());
    }

    /** 10. Checklist 100% tidak otomatis menjadikan tugas Done */
    public function test_checklist_100_percent_does_not_automatically_make_task_done(): void
    {
        Sanctum::actingAs($this->member1User);

        $resToggle = $this->postJson("/api/checklists/{$this->checklistM1->id}/toggle");
        $resToggle->assertStatus(200);

        $this->taskMember1->refresh();
        $this->assertEquals(100, $this->taskMember1->calculateChecklistProgress());
        // Status tugas tetap 'in_progress', belum menjadi 'completed' atau 'done'
        $this->assertEquals('in_progress', $this->taskMember1->status);
        $this->assertFalse($this->taskMember1->is_completed);
    }

    /** 11. Member tidak dapat membuat tugas */
    public function test_member_cannot_create_task(): void
    {
        Sanctum::actingAs($this->member1User);

        $response = $this->postJson('/api/tasks', [
            'project_id' => $this->project->id,
            'title' => 'Tugas Ilegal Member',
            'description' => 'Deskripsi',
            'priority' => 'low',
        ]);

        $response->assertStatus(403);
    }

    /** 12. Member tidak dapat mengedit informasi tugas */
    public function test_member_cannot_edit_task(): void
    {
        Sanctum::actingAs($this->member1User);

        $response = $this->putJson("/api/tasks/{$this->taskMember1->id}", [
            'project_id' => $this->project->id,
            'title' => 'Judul Diubah Member',
            'priority' => 'urgent',
        ]);

        $response->assertStatus(403);
    }

    /** 13. Member tidak dapat mengganti assignee */
    public function test_member_cannot_change_assignee(): void
    {
        Sanctum::actingAs($this->member1User);

        $response = $this->patchJson("/api/tasks/{$this->taskMember1->id}/assign", [
            'assignee_id' => $this->member2User->id,
        ]);

        $response->assertStatus(403);
    }

    /** 14. Member tidak dapat menghapus tugas */
    public function test_member_cannot_delete_task(): void
    {
        Sanctum::actingAs($this->member1User);

        $response = $this->deleteJson("/api/tasks/{$this->taskMember1->id}");
        $response->assertStatus(403);
    }

    /** 15. Member tidak dapat mengakses endpoint distribusi tugas PM */
    public function test_member_cannot_access_pm_workspace(): void
    {
        Sanctum::actingAs($this->member1User);

        $response = $this->getJson('/api/pm/workspace');
        $response->assertStatus(403);
    }

    /** 16. PM tetap dapat mengelola tugas dalam proyeknya */
    public function test_pm_can_manage_tasks_in_own_project(): void
    {
        Sanctum::actingAs($this->pmUser);

        $response = $this->getJson('/api/tasks');
        $response->assertStatus(200);

        // PM melihat kedua tugas pada proyeknya
        $taskIds = collect($response->json('tasks'))->pluck('id')->all();
        $this->assertContains($this->taskMember1->id, $taskIds);
        $this->assertContains($this->taskMember2->id, $taskIds);
    }

    /** 17. Admin tetap memiliki hak akses sesuai kontrak */
    public function test_admin_retains_full_access(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/tasks');
        $response->assertStatus(200);

        $taskIds = collect($response->json('tasks'))->pluck('id')->all();
        $this->assertContains($this->taskMember1->id, $taskIds);
        $this->assertContains($this->taskMember2->id, $taskIds);
    }

    /** 18. Pimpinan tetap read-only */
    public function test_pimpinan_retains_read_only_access(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $resList = $this->getJson('/api/tasks');
        $resList->assertStatus(200);

        $resCreate = $this->postJson('/api/tasks', [
            'project_id' => $this->project->id,
            'title' => 'Tugas Ilegal Pimpinan',
            'priority' => 'low',
        ]);
        $resCreate->assertStatus(403);
    }

    /** 19. Pengguna tidak terautentikasi mendapatkan 401 */
    public function test_unauthenticated_user_gets_401(): void
    {
        $response = $this->getJson('/api/tasks');
        $response->assertStatus(401);
    }
}
