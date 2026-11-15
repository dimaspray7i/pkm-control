<?php

namespace Tests\Feature;

use App\Models\Milestone;
use App\Models\Project;
use App\Models\ProjectReport;
use App\Models\Task;
use App\Models\TaskReview;
use App\Models\TaskUpdate;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LeadershipPerformanceTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $pimpinanUser;
    protected User $pmUser;
    protected User $memberUser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedUsersAndData();
    }

    protected function seedUsersAndData(): void
    {
        $this->adminUser = User::create([
            'name' => 'Super Admin',
            'email' => 'admin@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->pimpinanUser = User::create([
            'name' => 'Budi Pimpinan',
            'email' => 'pimpinan@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'pimpinan',
            'is_active' => true,
        ]);

        $this->pmUser = User::create([
            'name' => 'Siti PM',
            'email' => 'pm@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        $this->memberUser = User::create([
            'name' => 'Andi Member',
            'email' => 'member@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'member',
            'is_active' => true,
        ]);
    }

    /**
     * Test 1: Pimpinan can access Business Performance endpoint.
     */
    public function test_pimpinan_can_access_performance(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $response = $this->getJson('/api/leadership/performance');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'meta' => ['as_of_date', 'as_of_time', 'selected_period', 'period_label', 'refreshed_at'],
                'performance_overview',
                'project_delivery',
                'task_productivity',
                'milestone_performance',
                'team_workload',
                'pm_evaluation',
                'delivery_trend',
                'performance_comparison',
                'performance_insights',
            ]);
    }

    /**
     * Test 2: Admin can access Business Performance endpoint.
     */
    public function test_admin_can_access_performance(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/leadership/performance');

        $response->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    /**
     * Test 3: Project Manager is forbidden with HTTP 403.
     */
    public function test_project_manager_cannot_access_performance(): void
    {
        Sanctum::actingAs($this->pmUser);

        $response = $this->getJson('/api/leadership/performance');

        $response->assertStatus(403);
    }

    /**
     * Test 4: Member is forbidden with HTTP 403.
     */
    public function test_member_cannot_access_performance(): void
    {
        Sanctum::actingAs($this->memberUser);

        $response = $this->getJson('/api/leadership/performance');

        $response->assertStatus(403);
    }

    /**
     * Test 5: Unauthenticated guest is rejected with HTTP 401.
     */
    public function test_unauthenticated_cannot_access_performance(): void
    {
        $response = $this->getJson('/api/leadership/performance');

        $response->assertStatus(401);
    }

    /**
     * Test 6: Accurate calculation of Project Completion Rate and On-Time Delivery Rate.
     */
    public function test_project_completion_and_on_time_delivery_calculation(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        // Project A: Completed on-time (updated_at <= deadline)
        $projA = Project::create([
            'code' => 'PKM-ONTIME',
            'name' => 'Proyek Tepat Waktu',
            'client' => 'Klien A',
            'pic_id' => $this->pmUser->id,
            'status' => 'completed',
            'progress' => 100,
            'deadline' => Carbon::tomorrow()->toDateString(),
            'is_active' => true,
        ]);

        // Project B: Active
        $projB = Project::create([
            'code' => 'PKM-ACTIVE',
            'name' => 'Proyek Aktif',
            'client' => 'Klien B',
            'pic_id' => $this->pmUser->id,
            'status' => 'on_track',
            'progress' => 50,
            'deadline' => Carbon::now()->addDays(10)->toDateString(),
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/leadership/performance');
        $response->assertStatus(200);

        $delivery = $response->json('project_delivery');
        $this->assertEquals(2, $delivery['total_projects']);
        $this->assertEquals(1, $delivery['completed_projects']);
        $this->assertEquals(1, $delivery['active_projects']);
        $this->assertEquals(50.0, $delivery['project_completion_rate']);
        $this->assertEquals(100.0, $delivery['on_time_delivery_rate']);
    }

    /**
     * Test 7: Task Productivity matrix calculation (completion rate, overdue, in-review).
     */
    public function test_task_productivity_matrix_calculation(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $proj = Project::create([
            'code' => 'PKM-TSK',
            'name' => 'Proyek Tugas',
            'client' => 'Klien Tugas',
            'pic_id' => $this->pmUser->id,
            'status' => 'on_track',
            'progress' => 33,
            'is_active' => true,
        ]);

        // Task 1: Completed
        Task::create([
            'project_id' => $proj->id,
            'title' => 'Tugas 1 Selesai',
            'priority' => 'high',
            'status' => 'completed',
            'is_completed' => true,
            'created_by' => $this->pmUser->id,
        ]);

        // Task 2: In Review
        Task::create([
            'project_id' => $proj->id,
            'title' => 'Tugas 2 Menunggu Review',
            'priority' => 'medium',
            'status' => 'in_review',
            'is_completed' => false,
            'created_by' => $this->pmUser->id,
        ]);

        // Task 3: In Progress & Overdue
        Task::create([
            'project_id' => $proj->id,
            'title' => 'Tugas 3 Terlambat',
            'priority' => 'high',
            'status' => 'in_progress',
            'is_completed' => false,
            'deadline' => Carbon::yesterday()->toDateString(),
            'created_by' => $this->pmUser->id,
        ]);

        $response = $this->getJson('/api/leadership/performance');
        $response->assertStatus(200);

        $taskProd = $response->json('task_productivity');
        $this->assertEquals(3, $taskProd['total_tasks']);
        $this->assertEquals(1, $taskProd['completed_tasks']);
        $this->assertEquals(1, $taskProd['in_review_tasks']);
        $this->assertEquals(1, $taskProd['in_progress_tasks']);
        $this->assertEquals(1, $taskProd['overdue_tasks']);
        $this->assertEquals(33.3, $taskProd['task_completion_rate']);
    }

    /**
     * Test 8: Milestone completion rate calculation.
     */
    public function test_milestone_completion_rate_calculation(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $proj = Project::create([
            'code' => 'PKM-MS',
            'name' => 'Proyek Milestone Test',
            'client' => 'Klien MS',
            'pic_id' => $this->pmUser->id,
            'status' => 'on_track',
            'is_active' => true,
        ]);

        Milestone::create([
            'project_id' => $proj->id,
            'title' => 'Milestone 1 Selesai',
            'phase_order' => 1,
            'status' => 'completed',
            'progress' => 100,
        ]);

        Milestone::create([
            'project_id' => $proj->id,
            'title' => 'Milestone 2 In Progress',
            'phase_order' => 2,
            'status' => 'in_progress',
            'progress' => 50,
        ]);

        $response = $this->getJson('/api/leadership/performance');
        $response->assertStatus(200);

        $msPerf = $response->json('milestone_performance');
        $this->assertEquals(2, $msPerf['total_milestones']);
        $this->assertEquals(1, $msPerf['completed_milestones']);
        $this->assertEquals(50.0, $msPerf['milestone_completion_rate']);
    }

    /**
     * Test 9: Target progress achievement handles NULL without assuming zero or fake values.
     */
    public function test_target_progress_achievement_null_safety(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        // Project with explicit target 80 and progress 40 -> 50% achievement
        Project::create([
            'code' => 'PKM-TARG',
            'name' => 'Proyek Target Valid',
            'client' => 'Klien',
            'pic_id' => $this->pmUser->id,
            'status' => 'on_track',
            'progress' => 40,
            'target_progress' => 80,
            'is_active' => true,
        ]);

        // Project with target NULL (must not distort achievement)
        Project::create([
            'code' => 'PKM-NOTARG',
            'name' => 'Proyek Tanpa Target',
            'client' => 'Klien',
            'pic_id' => $this->pmUser->id,
            'status' => 'on_track',
            'progress' => 30,
            'target_progress' => null,
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/leadership/performance');
        $response->assertStatus(200);

        $overview = $response->json('performance_overview');
        $targetKpi = $overview['target_achievement_rate'];

        $this->assertEquals(50.0, $targetKpi['current']);
        $this->assertEquals('%', $targetKpi['unit']);
    }

    /**
     * Test 10: Zero denominator handling when no projects or tasks exist.
     */
    public function test_zero_denominator_handles_empty_dataset_gracefully(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $response = $this->getJson('/api/leadership/performance');
        $response->assertStatus(200);

        $delivery = $response->json('project_delivery');
        $this->assertEquals(0, $delivery['total_projects']);
        $this->assertEquals(0.0, $delivery['project_completion_rate']);

        $taskProd = $response->json('task_productivity');
        $this->assertEquals(0, $taskProd['total_tasks']);
        $this->assertEquals(0.0, $taskProd['task_completion_rate']);
    }

    /**
     * Test 11: Team Workload distribution and balance index.
     */
    public function test_team_workload_distribution_and_balance_index(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $proj = Project::create([
            'code' => 'PKM-WK',
            'name' => 'Proyek Workload',
            'client' => 'Klien Workload',
            'pic_id' => $this->pmUser->id,
            'status' => 'on_track',
            'is_active' => true,
        ]);

        // Assign 2 active tasks to memberUser -> capacity_status = ideal
        Task::create([
            'project_id' => $proj->id,
            'title' => 'Task A',
            'status' => 'in_progress',
            'is_completed' => false,
            'assignee_id' => $this->memberUser->id,
            'created_by' => $this->pmUser->id,
        ]);

        Task::create([
            'project_id' => $proj->id,
            'title' => 'Task B',
            'status' => 'in_progress',
            'is_completed' => false,
            'assignee_id' => $this->memberUser->id,
            'created_by' => $this->pmUser->id,
        ]);

        $response = $this->getJson('/api/leadership/performance');
        $response->assertStatus(200);

        $teamWk = $response->json('team_workload');
        $this->assertEquals(1, $teamWk['total_active_members']);
        $this->assertEquals(1, $teamWk['optimal_capacity_count']);
        $this->assertEquals(100.0, $teamWk['balance_index']);

        $memDist = collect($teamWk['members_distribution'])->firstWhere('member_id', $this->memberUser->id);
        $this->assertNotNull($memDist);
        $this->assertEquals(2, $memDist['active_tasks']);
        $this->assertEquals('ideal', $memDist['capacity_status']);
    }

    /**
     * Test 12: Period query parameter filtering (this_month, last_month, all_time).
     */
    public function test_period_query_parameter_filtering(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $resAll = $this->getJson('/api/leadership/performance?period=all_time');
        $resAll->assertStatus(200);
        $this->assertEquals('all_time', $resAll->json('meta.selected_period'));

        $resThis = $this->getJson('/api/leadership/performance?period=this_month');
        $resThis->assertStatus(200);
        $this->assertEquals('this_month', $resThis->json('meta.selected_period'));

        $resLast = $this->getJson('/api/leadership/performance?period=last_month');
        $resLast->assertStatus(200);
        $this->assertEquals('last_month', $resLast->json('meta.selected_period'));
    }
}
