<?php

namespace Tests\Feature;

use App\Models\Milestone;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PmWorkspaceDashboardTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $pimpinanUser;
    protected User $pm1User;
    protected User $pm2User;
    protected User $memberUser;

    protected Project $projectPm1A;
    protected Project $projectPm1B;
    protected Project $projectPm2;

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

        $this->memberUser = User::create([
            'name' => 'Member PKM',
            'email' => 'member@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'member',
            'is_active' => true,
        ]);

        // Projects for PM1
        $this->projectPm1A = Project::create([
            'code' => 'PRJ-PM1-A',
            'name' => 'Proyek PM 1 Alpha',
            'client' => 'Klien Alpha',
            'pic_id' => $this->pm1User->id,
            'pic_name' => $this->pm1User->name,
            'category' => 'web',
            'status' => 'on_track',
            'progress' => 50,
            'risk_level' => 'low',
            'deadline' => Carbon::now()->addDays(14)->toDateString(),
            'is_active' => true,
        ]);

        $this->projectPm1B = Project::create([
            'code' => 'PRJ-PM1-B',
            'name' => 'Proyek PM 1 Beta',
            'client' => 'Klien Beta',
            'pic_id' => $this->pm1User->id,
            'pic_name' => $this->pm1User->name,
            'category' => 'mobile',
            'status' => 'at_risk',
            'progress' => 0,
            'risk_level' => 'high',
            'deadline' => Carbon::now()->addDays(7)->toDateString(),
            'is_active' => true,
        ]);

        // Project for PM2
        $this->projectPm2 = Project::create([
            'code' => 'PRJ-PM2-X',
            'name' => 'Proyek PM 2 Xylon',
            'client' => 'Klien Xylon',
            'pic_id' => $this->pm2User->id,
            'pic_name' => $this->pm2User->name,
            'category' => 'system',
            'status' => 'on_track',
            'progress' => 80,
            'risk_level' => 'low',
            'deadline' => Carbon::now()->addDays(30)->toDateString(),
            'is_active' => true,
        ]);

        // Tasks for PM1 project A
        Task::create([
            'project_id' => $this->projectPm1A->id,
            'title' => 'Tugas PM1 Selesai',
            'status' => 'completed',
            'is_completed' => true,
            'assignee_id' => $this->memberUser->id,
            'assignee_name' => $this->memberUser->name,
            'deadline' => Carbon::now()->subDays(2)->toDateString(),
            'priority' => 'medium',
        ]);

        Task::create([
            'project_id' => $this->projectPm1A->id,
            'title' => 'Tugas PM1 Sedang Dikerjakan (Overdue)',
            'status' => 'in_progress',
            'is_completed' => false,
            'assignee_id' => $this->memberUser->id,
            'assignee_name' => $this->memberUser->name,
            'deadline' => Carbon::now()->subDays(1)->toDateString(), // Overdue
            'priority' => 'high',
        ]);

        Task::create([
            'project_id' => $this->projectPm1A->id,
            'title' => 'Tugas PM1 Belum Ada Assignee',
            'status' => 'pending',
            'is_completed' => false,
            'assignee_id' => null,
            'assignee_name' => null,
            'deadline' => Carbon::now()->addDays(5)->toDateString(),
            'priority' => 'low',
        ]);

        // Tasks for PM2 project
        Task::create([
            'project_id' => $this->projectPm2->id,
            'title' => 'Tugas PM2 Overdue Milik PM Lain',
            'status' => 'in_progress',
            'is_completed' => false,
            'assignee_id' => $this->memberUser->id,
            'assignee_name' => $this->memberUser->name,
            'deadline' => Carbon::now()->subDays(5)->toDateString(), // Overdue but for PM2
            'priority' => 'high',
        ]);
    }

    /** 1. PM only gets stats for their own projects */
    public function test_pm_only_gets_stats_for_their_own_projects(): void
    {
        Sanctum::actingAs($this->pm1User);

        $response = $this->getJson('/api/pm/workspace');

        $response->assertStatus(200);
        $data = $response->json();

        // PM1 has 2 projects (PRJ-PM1-A and PRJ-PM1-B), not PRJ-PM2-X
        $this->assertEquals(2, $data['kpi']['total_projects']);
        $this->assertEquals(2, $data['kpi']['active_projects']);
    }

    /** 2. PM does not get stats for other PM's projects */
    public function test_pm_does_not_get_stats_for_other_pm_projects(): void
    {
        Sanctum::actingAs($this->pm2User);

        $response = $this->getJson('/api/pm/workspace');

        $response->assertStatus(200);
        $data = $response->json();

        // PM2 only has 1 project
        $this->assertEquals(1, $data['kpi']['total_projects']);
        $this->assertEquals(1, count($data['my_projects']));
        $this->assertEquals('PRJ-PM2-X', $data['my_projects'][0]['code']);
    }

    /** 3. Task KPI only counts tasks from PM's projects */
    public function test_task_kpi_only_counts_tasks_from_pm_projects(): void
    {
        Sanctum::actingAs($this->pm1User);

        $response = $this->getJson('/api/pm/workspace');

        $response->assertStatus(200);
        $data = $response->json();

        // PM1 projects have 3 tasks total (1 completed, 1 in_progress, 1 pending)
        // PM2 project task should NOT be included
        $this->assertEquals(3, $data['kpi']['total_tasks']);
        $this->assertEquals(1, $data['kpi']['tasks_in_progress']);
        $this->assertEquals(1, $data['kpi']['pending_tasks']);
    }

    /** 4. Overdue only counts relevant tasks from PM's own projects */
    public function test_overdue_only_counts_relevant_tasks_from_pm_projects(): void
    {
        Sanctum::actingAs($this->pm1User);

        $response = $this->getJson('/api/pm/workspace');

        $response->assertStatus(200);
        $data = $response->json();

        // PM1 has exactly 1 incomplete overdue task (the completed overdue task is excluded)
        // PM2's overdue task must not leak here
        $this->assertEquals(1, $data['kpi']['overdue_tasks']);
    }

    /** 5. Unassigned tasks count only from PM's projects */
    public function test_unassigned_tasks_count_only_from_pm_projects(): void
    {
        Sanctum::actingAs($this->pm1User);

        $response = $this->getJson('/api/pm/workspace');

        $response->assertStatus(200);
        $data = $response->json();

        // PM1 has 1 task with assignee_id = null
        $this->assertEquals(1, $data['kpi']['unassigned_tasks']);
    }

    /** 6. Admin still gets access per their contract */
    public function test_admin_still_gets_access_per_contract(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/pm/workspace');

        $response->assertStatus(200);
        $data = $response->json();

        // Admin has global visibility across all 3 projects
        $this->assertEquals(3, $data['kpi']['total_projects']);
    }

    /** 7. Pimpinan still gets access per their contract */
    public function test_pimpinan_still_gets_access_per_contract(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $response = $this->getJson('/api/pm/workspace');

        $response->assertStatus(200);
        $data = $response->json();

        // Pimpinan also has global visibility
        $this->assertEquals(3, $data['kpi']['total_projects']);
    }

    /** 8. Member cannot access PM Workspace endpoint (403) */
    public function test_member_cannot_access_pm_workspace_endpoint(): void
    {
        Sanctum::actingAs($this->memberUser);

        $response = $this->getJson('/api/pm/workspace');

        $response->assertStatus(403);
    }

    /** 9. Project with no tasks returns progress 0% */
    public function test_project_with_no_tasks_returns_progress_zero(): void
    {
        $emptyProject = Project::create([
            'code' => 'PRJ-EMPTY',
            'name' => 'Proyek Kosong',
            'client' => 'Klien Kosong',
            'pic_id' => $this->pm1User->id,
            'pic_name' => $this->pm1User->name,
            'category' => 'web',
            'status' => 'on_track',
            'progress' => 0,
            'risk_level' => 'low',
            'deadline' => Carbon::now()->addDays(20)->toDateString(),
            'is_active' => true,
        ]);

        $this->assertEquals(0, $emptyProject->calculateActualProgress());
    }

    /** 10. Verify project does not reach 100% if tasks not all completed */
    public function test_project_does_not_reach_100_percent_if_tasks_not_all_completed(): void
    {
        $testProject = Project::create([
            'code' => 'PRJ-PROGRESS',
            'name' => 'Proyek Uji Progres',
            'client' => 'Klien Progres',
            'pic_id' => $this->pm1User->id,
            'pic_name' => $this->pm1User->name,
            'category' => 'web',
            'status' => 'on_track',
            'progress' => 0,
            'risk_level' => 'low',
            'is_active' => true,
        ]);

        // Create 2 tasks: 1 completed, 1 pending
        Task::create([
            'project_id' => $testProject->id,
            'title' => 'Task 1 Selesai',
            'status' => 'completed',
            'is_completed' => true,
            'assignee_id' => $this->memberUser->id,
        ]);

        Task::create([
            'project_id' => $testProject->id,
            'title' => 'Task 2 Belum Selesai',
            'status' => 'pending',
            'is_completed' => false,
            'assignee_id' => $this->memberUser->id,
        ]);

        $actualProgress = $testProject->calculateActualProgress();
        $this->assertEquals(50, $actualProgress);
        $this->assertLessThan(100, $actualProgress);
    }
}
