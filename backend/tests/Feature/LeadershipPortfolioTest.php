<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\ProjectReport;
use App\Models\Task;
use App\Models\TaskUpdate;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LeadershipPortfolioTest extends TestCase
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
     * Test 1: Pimpinan can access Strategic Project Portfolio endpoint with 200 OK.
     */
    public function test_pimpinan_can_access_portfolio(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $response = $this->getJson('/api/leadership/portfolio');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'meta' => ['as_of_date', 'as_of_time', 'refreshed_at'],
                'portfolio_overview' => [
                    'total_projects',
                    'active_projects',
                    'on_track_projects',
                    'at_risk_projects',
                    'delayed_projects',
                    'completed_projects',
                ],
                'target_vs_actual_analysis' => [
                    'has_target_data',
                    'average_target_progress',
                    'average_actual_progress',
                    'portfolio_variance',
                    'portfolio_achievement_rate',
                    'projects_ahead_count',
                    'projects_on_track_count',
                    'projects_behind_count',
                    'projects_no_target_count',
                    'period_context',
                ],
                'projects',
                'milestone_timeline',
                'pm_scorecards',
                'strategic_attention',
            ]);
    }

    /**
     * Test 2: Admin can access portfolio endpoint as system manager.
     */
    public function test_admin_can_access_portfolio(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/leadership/portfolio');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
    }

    /**
     * Test 3: Project Manager is forbidden with HTTP 403.
     */
    public function test_project_manager_cannot_access_portfolio(): void
    {
        Sanctum::actingAs($this->pmUser);

        $response = $this->getJson('/api/leadership/portfolio');

        $response->assertStatus(403);
    }

    /**
     * Test 4: Member is forbidden with HTTP 403.
     */
    public function test_member_cannot_access_portfolio(): void
    {
        Sanctum::actingAs($this->memberUser);

        $response = $this->getJson('/api/leadership/portfolio');

        $response->assertStatus(403);
    }

    /**
     * Test 5: Unauthenticated guest is rejected with HTTP 401.
     */
    public function test_unauthenticated_cannot_access_portfolio(): void
    {
        $response = $this->getJson('/api/leadership/portfolio');

        $response->assertStatus(401);
    }

    /**
     * Test 6: Portfolio counts and structures are calculated accurately.
     */
    public function test_portfolio_overview_counts_accurately(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        Project::create([
            'code' => 'PKM-001',
            'name' => 'Proyek On Track 1',
            'client' => 'Klien A',
            'pic_id' => $this->pmUser->id,
            'status' => 'on_track',
            'progress' => 50,
            'target_progress' => 50,
            'is_active' => true,
        ]);

        Project::create([
            'code' => 'PKM-002',
            'name' => 'Proyek At Risk 1',
            'client' => 'Klien B',
            'pic_id' => $this->pmUser->id,
            'status' => 'at_risk',
            'progress' => 30,
            'target_progress' => 60,
            'is_active' => true,
        ]);

        Project::create([
            'code' => 'PKM-003',
            'name' => 'Proyek Delayed 1',
            'client' => 'Klien C',
            'pic_id' => $this->pmUser->id,
            'status' => 'delayed',
            'progress' => 10,
            'target_progress' => 70,
            'is_active' => true,
        ]);

        Project::create([
            'code' => 'PKM-004',
            'name' => 'Proyek Selesai 1',
            'client' => 'Klien D',
            'pic_id' => $this->pmUser->id,
            'status' => 'completed',
            'progress' => 100,
            'target_progress' => 100,
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/leadership/portfolio');

        $response->assertStatus(200);
        $overview = $response->json('portfolio_overview');

        $this->assertEquals(4, $overview['total_projects']);
        $this->assertEquals(3, $overview['active_projects']);
        $this->assertEquals(1, $overview['on_track_projects']);
        $this->assertEquals(1, $overview['at_risk_projects']);
        $this->assertEquals(1, $overview['delayed_projects']);
        $this->assertEquals(1, $overview['completed_projects']);
    }

    /**
     * Test 7: Target vs Actual analysis, variance, and null handling.
     */
    public function test_target_vs_actual_and_variance_handling(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        // Project A: Ahead (Actual 80, Target 60, Variance +20)
        Project::create([
            'code' => 'PKM-AH',
            'name' => 'Proyek Ahead',
            'client' => 'Klien A',
            'pic_id' => $this->pmUser->id,
            'status' => 'on_track',
            'progress' => 80,
            'target_progress' => 60,
            'is_active' => true,
        ]);

        // Project B: On Track (Actual 50, Target 50, Variance 0)
        Project::create([
            'code' => 'PKM-EQ',
            'name' => 'Proyek Equal',
            'client' => 'Klien B',
            'pic_id' => $this->pmUser->id,
            'status' => 'on_track',
            'progress' => 50,
            'target_progress' => 50,
            'is_active' => true,
        ]);

        // Project C: Behind (Actual 20, Target 70, Variance -50)
        Project::create([
            'code' => 'PKM-BH',
            'name' => 'Proyek Behind',
            'client' => 'Klien C',
            'pic_id' => $this->pmUser->id,
            'status' => 'delayed',
            'progress' => 20,
            'target_progress' => 70,
            'is_active' => true,
        ]);

        // Project D: No Target (Actual 40, Target null)
        Project::create([
            'code' => 'PKM-NT',
            'name' => 'Proyek No Target',
            'client' => 'Klien D',
            'pic_id' => $this->pmUser->id,
            'status' => 'on_track',
            'progress' => 40,
            'target_progress' => null,
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/leadership/portfolio');
        $response->assertStatus(200);

        $analysis = $response->json('target_vs_actual_analysis');
        $this->assertTrue($analysis['has_target_data']);
        $this->assertEquals(1, $analysis['projects_ahead_count']);
        $this->assertEquals(1, $analysis['projects_on_track_count']);
        $this->assertEquals(1, $analysis['projects_behind_count']);
        $this->assertEquals(1, $analysis['projects_no_target_count']);

        // Check individual projects variance in response
        $projects = collect($response->json('projects'));

        $aheadProj = $projects->firstWhere('code', 'PKM-AH');
        $this->assertTrue($aheadProj['has_target']);
        $this->assertEquals(20, $aheadProj['variance']);
        $this->assertEquals('ahead', $aheadProj['variance_status']);

        $equalProj = $projects->firstWhere('code', 'PKM-EQ');
        $this->assertTrue($equalProj['has_target']);
        $this->assertEquals(0, $equalProj['variance']);
        $this->assertEquals('on_track', $equalProj['variance_status']);

        $behindProj = $projects->firstWhere('code', 'PKM-BH');
        $this->assertTrue($behindProj['has_target']);
        $this->assertEquals(-50, $behindProj['variance']);
        $this->assertEquals('behind', $behindProj['variance_status']);

        $noTargetProj = $projects->firstWhere('code', 'PKM-NT');
        $this->assertFalse($noTargetProj['has_target']);
        $this->assertNull($noTargetProj['target_progress']);
        $this->assertNull($noTargetProj['variance']);
        $this->assertEquals('no_target', $noTargetProj['variance_status']);
    }

    /**
     * Test 8: Milestone timeline categories and overdue detection.
     */
    public function test_milestone_timeline_and_overdue_detection(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $proj = Project::create([
            'code' => 'PKM-MS',
            'name' => 'Proyek Milestones',
            'client' => 'Klien X',
            'pic_id' => $this->pmUser->id,
            'status' => 'on_track',
            'progress' => 30,
            'is_active' => true,
        ]);

        // Completed milestone
        Milestone::create([
            'project_id' => $proj->id,
            'title' => 'Fase 1: Analisis',
            'phase_order' => 1,
            'status' => 'completed',
            'progress' => 100,
            'due_date' => Carbon::yesterday()->toDateString(),
        ]);

        // Overdue milestone (past due, not completed)
        Milestone::create([
            'project_id' => $proj->id,
            'title' => 'Fase 2: Desain UI',
            'phase_order' => 2,
            'status' => 'in_progress',
            'progress' => 50,
            'due_date' => Carbon::yesterday()->toDateString(),
        ]);

        // On track milestone (future due, in progress)
        Milestone::create([
            'project_id' => $proj->id,
            'title' => 'Fase 3: Pengembangan',
            'phase_order' => 3,
            'status' => 'in_progress',
            'progress' => 20,
            'due_date' => Carbon::tomorrow()->toDateString(),
        ]);

        // Upcoming milestone (future due, pending)
        Milestone::create([
            'project_id' => $proj->id,
            'title' => 'Fase 4: Testing & Rilis',
            'phase_order' => 4,
            'status' => 'pending',
            'progress' => 0,
            'due_date' => Carbon::now()->addDays(10)->toDateString(),
        ]);

        $response = $this->getJson('/api/leadership/portfolio');
        $response->assertStatus(200);

        $timeline = collect($response->json('milestone_timeline'));

        $completedMs = $timeline->firstWhere('title', 'Fase 1: Analisis');
        $this->assertEquals('completed', $completedMs['timeline_category']);
        $this->assertFalse($completedMs['is_overdue']);

        $overdueMs = $timeline->firstWhere('title', 'Fase 2: Desain UI');
        $this->assertEquals('overdue', $overdueMs['timeline_category']);
        $this->assertTrue($overdueMs['is_overdue']);

        $onTrackMs = $timeline->firstWhere('title', 'Fase 3: Pengembangan');
        $this->assertEquals('on_track', $onTrackMs['timeline_category']);
        $this->assertFalse($onTrackMs['is_overdue']);

        $upcomingMs = $timeline->firstWhere('title', 'Fase 4: Testing & Rilis');
        $this->assertEquals('upcoming', $upcomingMs['timeline_category']);
        $this->assertFalse($upcomingMs['is_overdue']);
    }

    /**
     * Test 9: Active blockers detected from task updates.
     */
    public function test_active_blockers_detected(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $proj = Project::create([
            'code' => 'PKM-BLK',
            'name' => 'Proyek Blocker',
            'client' => 'Klien Y',
            'pic_id' => $this->pmUser->id,
            'status' => 'on_track',
            'progress' => 20,
            'is_active' => true,
        ]);

        $task = Task::create([
            'project_id' => $proj->id,
            'title' => 'Integrasi API Payment',
            'priority' => 'high',
            'status' => 'in_progress',
            'is_completed' => false,
            'created_by' => $this->pmUser->id,
        ]);

        TaskUpdate::create([
            'task_id' => $task->id,
            'user_id' => $this->memberUser->id,
            'user_name' => $this->memberUser->name,
            'progress_percentage' => 40,
            'work_description' => 'Menghubungkan webhook payment gateway',
            'blocker' => 'Menunggu kredensial production dari vendor Bank',
        ]);

        $response = $this->getJson('/api/leadership/portfolio');
        $response->assertStatus(200);

        $projects = collect($response->json('projects'));
        $p = $projects->firstWhere('code', 'PKM-BLK');

        $this->assertEquals(1, $p['active_blockers_count']);
        $this->assertContains('1 kendala (blocker) aktif di lapangan', $p['risk_indicator']['reasons']);
    }

    /**
     * Test 10: PM Leadership Scorecard calculates clean metrics.
     */
    public function test_pm_leadership_scorecard(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $proj = Project::create([
            'code' => 'PKM-SCORE',
            'name' => 'Proyek PM Siti',
            'client' => 'Klien Score',
            'pic_id' => $this->pmUser->id,
            'status' => 'on_track',
            'progress' => 50,
            'is_active' => true,
        ]);

        Task::create([
            'project_id' => $proj->id,
            'title' => 'Tugas 1 Selesai',
            'priority' => 'medium',
            'status' => 'completed',
            'is_completed' => true,
            'created_by' => $this->pmUser->id,
        ]);

        Task::create([
            'project_id' => $proj->id,
            'title' => 'Tugas 2 Belum Selesai',
            'priority' => 'medium',
            'status' => 'in_progress',
            'is_completed' => false,
            'created_by' => $this->pmUser->id,
        ]);

        $response = $this->getJson('/api/leadership/portfolio');
        $response->assertStatus(200);

        $scorecards = collect($response->json('pm_scorecards'));
        $pmCard = $scorecards->firstWhere('pm_id', $this->pmUser->id);

        $this->assertNotNull($pmCard);
        $this->assertEquals('Siti PM', $pmCard['pm_name']);
        $this->assertEquals(1, $pmCard['total_projects']);
        $this->assertEquals(1, $pmCard['on_track_projects']);
        $this->assertEquals(2, $pmCard['total_tasks']);
        $this->assertEquals(1, $pmCard['completed_tasks']);
        $this->assertEquals(50.0, $pmCard['task_completion_rate']);
    }

    /**
     * Test 11: Portfolio detail endpoint returns comprehensive deep-dive data.
     */
    public function test_portfolio_detail_endpoint(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $proj = Project::create([
            'code' => 'PKM-DET',
            'name' => 'Proyek Detail Insight',
            'client' => 'PT Mandiri Sejahtera',
            'category' => 'web',
            'pic_id' => $this->pmUser->id,
            'status' => 'at_risk',
            'progress' => 45,
            'target_progress' => 60,
            'deadline' => Carbon::now()->addDays(20)->toDateString(),
            'is_active' => true,
        ]);

        Milestone::create([
            'project_id' => $proj->id,
            'title' => 'Sprint 1',
            'phase_order' => 1,
            'status' => 'in_progress',
            'progress' => 45,
            'due_date' => Carbon::now()->addDays(5)->toDateString(),
        ]);

        $task = Task::create([
            'project_id' => $proj->id,
            'title' => 'Backend API Endpoint',
            'priority' => 'high',
            'status' => 'in_progress',
            'is_completed' => false,
            'deadline' => Carbon::yesterday()->toDateString(), // Overdue
            'created_by' => $this->pmUser->id,
        ]);

        TaskUpdate::create([
            'task_id' => $task->id,
            'user_id' => $this->memberUser->id,
            'user_name' => $this->memberUser->name,
            'progress_percentage' => 45,
            'work_description' => 'Mengerjakan controller API',
            'blocker' => 'Spesifikasi requirement belum dikonfirmasi klien',
        ]);

        ProjectReport::create([
            'report_number' => 'REP-DET-001',
            'project_id' => $proj->id,
            'created_by' => $this->pmUser->id,
            'period_start' => Carbon::now()->subDays(7)->toDateString(),
            'period_end' => Carbon::now()->toDateString(),
            'status' => 'published',
            'executive_summary' => 'Pengerjaan fase backend sedang berlangsung',
            'published_at' => Carbon::now(),
        ]);

        $response = $this->getJson("/api/leadership/portfolio/{$proj->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'project' => [
                    'id',
                    'code',
                    'name',
                    'client',
                    'status',
                    'pic',
                    'actual_progress',
                    'target_progress',
                    'variance',
                ],
                'tasks_summary' => [
                    'total',
                    'completed',
                    'overdue',
                    'overdue_list',
                ],
                'active_blockers',
                'milestones',
                'reports',
            ]);

        $this->assertEquals('PKM-DET', $response->json('project.code'));
        $this->assertEquals(1, $response->json('tasks_summary.overdue'));
        $this->assertCount(1, $response->json('active_blockers'));
        $this->assertEquals('Spesifikasi requirement belum dikonfirmasi klien', $response->json('active_blockers.0.blocker'));
        $this->assertCount(1, $response->json('reports'));
    }

    /**
     * Test 12: Project Manager cannot access portfolio detail.
     */
    public function test_pm_cannot_access_portfolio_detail(): void
    {
        Sanctum::actingAs($this->pmUser);

        $proj = Project::create([
            'code' => 'PKM-FORBID',
            'name' => 'Proyek PM',
            'client' => 'Klien',
            'pic_id' => $this->pmUser->id,
            'status' => 'on_track',
            'is_active' => true,
        ]);

        $response = $this->getJson("/api/leadership/portfolio/{$proj->id}");

        $response->assertStatus(403);
    }
}
