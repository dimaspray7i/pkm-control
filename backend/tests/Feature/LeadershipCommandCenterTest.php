<?php

namespace Tests\Feature;

use App\Models\Activity;
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

class LeadershipCommandCenterTest extends TestCase
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
     * Test 1: Pimpinan can access Executive Command Center endpoint with 200 OK.
     */
    public function test_pimpinan_can_access_command_center(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $response = $this->getJson('/api/leadership/command-center');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'executive' => ['name', 'role', 'email'],
                'meta' => ['as_of_date', 'as_of_time'],
                'company_health_index' => ['score', 'category', 'badge', 'formula', 'components'],
                'portfolio_snapshot' => ['total_projects', 'active_projects', 'on_track', 'at_risk', 'delayed', 'completed'],
                'progress_analysis' => ['avg_actual', 'avg_target', 'variance', 'projects_below_target'],
                'attention_radar',
                'review_backlog' => ['total_in_review', 'overdue_count', 'items'],
                'executive_feed',
                'historical_trend' => ['has_sufficient_data', 'trend_is_estimated'],
            ]);
    }

    /**
     * Test 2: Admin can access Executive Command Center endpoint with 200 OK.
     */
    public function test_admin_can_access_command_center(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/leadership/command-center');

        $response->assertStatus(200);
    }

    /**
     * Test 3: Project Manager is forbidden from Executive Command Center (403).
     */
    public function test_project_manager_is_forbidden_from_command_center(): void
    {
        Sanctum::actingAs($this->pmUser);

        $response = $this->getJson('/api/leadership/command-center');

        $response->assertStatus(403);
    }

    /**
     * Test 4: Member is forbidden from Executive Command Center (403).
     */
    public function test_member_is_forbidden_from_command_center(): void
    {
        Sanctum::actingAs($this->memberUser);

        $response = $this->getJson('/api/leadership/command-center');

        $response->assertStatus(403);
    }

    /**
     * Test 5: Unauthenticated request is rejected (401).
     */
    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->getJson('/api/leadership/command-center');

        $response->assertStatus(401);
    }

    /**
     * Test 6: Company Health Index is computed accurately according to formula.
     */
    public function test_company_health_index_calculation(): void
    {
        // 2 Projects: 1 On Track (progress 80, target 80), 1 Delayed (progress 20, target 60, risk_level high)
        $p1 = Project::create([
            'code' => 'PRJ-1',
            'name' => 'Project Alpha',
            'client' => 'Client A',
            'status' => 'on_track',
            'target_progress' => 50,
            'risk_level' => 'low',
            'is_active' => true,
        ]);

        $p2 = Project::create([
            'code' => 'PRJ-2',
            'name' => 'Project Beta',
            'client' => 'Client B',
            'status' => 'delayed',
            'target_progress' => 80,
            'risk_level' => 'high',
            'is_active' => true,
        ]);

        // P1 tasks: 1 completed (progress becomes 50%), 1 on-time active
        Task::create([
            'project_id' => $p1->id,
            'title' => 'P1 Task 1',
            'status' => 'completed',
            'is_completed' => true,
        ]);
        Task::create([
            'project_id' => $p1->id,
            'title' => 'P1 Task 2 (On Time)',
            'status' => 'in_progress',
            'is_completed' => false,
            'deadline' => Carbon::today()->addDays(5)->toDateString(),
        ]);

        // P2 tasks: 1 completed (progress becomes 50%), 1 overdue active
        Task::create([
            'project_id' => $p2->id,
            'title' => 'P2 Task 1',
            'status' => 'completed',
            'is_completed' => true,
        ]);
        Task::create([
            'project_id' => $p2->id,
            'title' => 'P2 Task 2 (Overdue)',
            'status' => 'in_progress',
            'is_completed' => false,
            'deadline' => Carbon::today()->subDays(2)->toDateString(),
        ]);

        Sanctum::actingAs($this->pimpinanUser);

        $response = $this->getJson('/api/leadership/command-center');

        $response->assertStatus(200);
        $chi = $response->json('company_health_index');

        // S_project = 1/2 on_track = 50.0%
        $this->assertEquals(50.0, $chi['components']['project']['score']);
        // S_schedule = 1 on-time of 2 active tasks = 50.0%
        $this->assertEquals(50.0, $chi['components']['schedule']['score']);
        // S_delivery = avg( min(100, 50/50*100=100), min(100, 50/80*100=62.5) ) = 81.3%
        $this->assertGreaterThanOrEqual(80.0, $chi['components']['delivery']['score']);
        // S_risk = 100 - (1 high risk/delayed of 2 active * 100) = 50.0%
        $this->assertEquals(50.0, $chi['components']['risk']['score']);

        $this->assertGreaterThan(0, $chi['score']);
        $this->assertLessThanOrEqual(100, $chi['score']);
    }

    /**
     * Test 7: Zero division is gracefully handled when database has no active projects.
     */
    public function test_graceful_handling_when_no_active_projects(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $response = $this->getJson('/api/leadership/command-center');

        $response->assertStatus(200);
        $chi = $response->json('company_health_index');
        $this->assertEquals(100.0, $chi['score']);
        $this->assertEquals('Prima', $chi['category']);
    }

    /**
     * Test 8: Attention Radar identifies and flags delayed and at-risk projects.
     */
    public function test_attention_radar_flags_problematic_projects(): void
    {
        $proj = Project::create([
            'code' => 'PRJ-CRIT',
            'name' => 'Critical Delayed Project',
            'client' => 'Urgent Client',
            'status' => 'delayed',
            'progress' => 10,
            'target_progress' => 90,
            'risk_level' => 'high',
            'deadline' => Carbon::today()->subDays(5)->toDateString(),
            'is_active' => true,
        ]);

        Sanctum::actingAs($this->pimpinanUser);

        $response = $this->getJson('/api/leadership/command-center');

        $response->assertStatus(200);
        $radar = $response->json('attention_radar');
        $this->assertNotEmpty($radar);
        $this->assertEquals('PRJ-CRIT', $radar[0]['code']);
        $this->assertContains('Status Proyek Delayed (Keterlambatan Mayor)', $radar[0]['flag_reasons']);
    }

    /**
     * Test 9: Task review backlog lists in_review tasks and computes waiting duration.
     */
    public function test_task_review_backlog_tracks_in_review_tasks(): void
    {
        $proj = Project::create([
            'code' => 'PRJ-REV',
            'name' => 'Project In Review',
            'client' => 'Client Review',
            'status' => 'on_track',
            'is_active' => true,
        ]);

        $task = Task::create([
            'project_id' => $proj->id,
            'title' => 'Pending Review Task Old',
            'status' => 'in_review',
            'is_completed' => false,
        ]);
        $task->updated_at = Carbon::now()->subDays(4);
        $task->saveQuietly();

        Sanctum::actingAs($this->pimpinanUser);

        $response = $this->getJson('/api/leadership/command-center');

        $response->assertStatus(200);
        $backlog = $response->json('review_backlog');
        $this->assertEquals(1, $backlog['total_in_review']);
        $this->assertEquals(1, $backlog['overdue_count']);
        $this->assertTrue($backlog['items'][0]['is_overdue']);
        $this->assertGreaterThanOrEqual(3.5, $backlog['items'][0]['waiting_days']);
    }

    /**
     * Test 10: Historical trend has trend_is_estimated = false and handles insufficient snapshots.
     */
    public function test_historical_trend_is_never_synthetic(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $response = $this->getJson('/api/leadership/command-center');

        $response->assertStatus(200);
        $trend = $response->json('historical_trend');
        $this->assertFalse($trend['trend_is_estimated']);
        $this->assertFalse($trend['has_sufficient_data']);
    }

    /**
     * Test 11: Admin dashboard route remains unaffected (no regression).
     */
    public function test_admin_dashboard_continues_to_operate(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/dashboard');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'kpi',
                'trend_data',
                'donut_data',
                'latest_projects',
            ]);
    }
}
