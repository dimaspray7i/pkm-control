<?php

namespace Tests\Feature;

use App\Models\Milestone;
use App\Models\Project;
use App\Models\ProjectReport;
use App\Models\Task;
use App\Models\TaskChecklist;
use App\Models\TaskReview;
use App\Models\TaskUpdate;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProjectReportTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $pimpinan;
    protected User $pm1;
    protected User $pm2;
    protected User $member1;
    protected User $member2;

    protected Project $projectPm1;
    protected Project $projectPm2;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedTestData();
    }

    protected function seedTestData(): void
    {
        $this->admin = User::create([
            'name' => 'Admin PKM',
            'email' => 'admin@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->pimpinan = User::create([
            'name' => 'Pimpinan PKM',
            'email' => 'pimpinan@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'pimpinan',
            'is_active' => true,
        ]);

        $this->pm1 = User::create([
            'name' => 'PM Satu',
            'email' => 'pm1@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        $this->pm2 = User::create([
            'name' => 'PM Dua',
            'email' => 'pm2@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        $this->member1 = User::create([
            'name' => 'Budi Member',
            'email' => 'budi@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'member',
            'is_active' => true,
        ]);

        $this->member2 = User::create([
            'name' => 'Siti Member',
            'email' => 'siti@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'member',
            'is_active' => true,
        ]);

        // Projects
        $this->projectPm1 = Project::create([
            'name' => 'Proyek Alpha PM1',
            'code' => 'ALPHA-001',
            'client' => 'Klien Alpha',
            'status' => 'in_progress',
            'progress' => 0,
            'pic_id' => $this->pm1->id,
            'pic_name' => $this->pm1->name,
            'deadline' => Carbon::now()->addDays(30)->toDateString(),
            'is_active' => true,
        ]);

        $this->projectPm2 = Project::create([
            'name' => 'Proyek Beta PM2',
            'code' => 'BETA-001',
            'client' => 'Klien Beta',
            'status' => 'in_progress',
            'progress' => 0,
            'pic_id' => $this->pm2->id,
            'pic_name' => $this->pm2->name,
            'deadline' => Carbon::now()->addDays(45)->toDateString(),
            'is_active' => true,
        ]);
    }

    // =========================================================================
    // AUTHORIZATION TESTS (1 - 8)
    // =========================================================================

    public function test_01_unauthenticated_gets_401()
    {
        $this->getJson('/api/project-reports')->assertStatus(401);
        $this->getJson("/api/projects/{$this->projectPm1->id}/reports/preview")->assertStatus(401);
        $this->postJson("/api/projects/{$this->projectPm1->id}/reports", [])->assertStatus(401);
    }

    public function test_02_pm_can_create_report_for_own_project()
    {
        Sanctum::actingAs($this->pm1);

        $response = $this->postJson("/api/projects/{$this->projectPm1->id}/reports", [
            'period_start' => Carbon::now()->startOfWeek()->toDateString(),
            'period_end' => Carbon::now()->endOfWeek()->toDateString(),
            'executive_summary' => 'Draft ringkasan eksekutif awal.',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('project_reports', [
            'project_id' => $this->projectPm1->id,
            'created_by' => $this->pm1->id,
            'status' => 'draft',
        ]);
    }

    public function test_03_pm_cannot_create_report_for_other_pm_project()
    {
        Sanctum::actingAs($this->pm1);

        $response = $this->postJson("/api/projects/{$this->projectPm2->id}/reports", [
            'period_start' => Carbon::now()->startOfWeek()->toDateString(),
            'period_end' => Carbon::now()->endOfWeek()->toDateString(),
        ]);

        $response->assertStatus(403);
    }

    public function test_04_pm_cannot_view_other_pm_project_report()
    {
        // PM2 creates a report
        $reportPm2 = ProjectReport::create([
            'report_number' => 'RPT-TEST-0001',
            'project_id' => $this->projectPm2->id,
            'created_by' => $this->pm2->id,
            'period_start' => '2026-11-01',
            'period_end' => '2026-11-07',
            'status' => 'published',
            'executive_summary' => 'Laporan PM2',
            'snapshot_data' => ['test' => true],
        ]);

        Sanctum::actingAs($this->pm1);

        $this->getJson("/api/project-reports/{$reportPm2->id}")->assertStatus(403);

        $list = $this->getJson('/api/project-reports')->json('data');
        $this->assertEmpty(collect($list)->where('id', $reportPm2->id));
    }

    public function test_05_pimpinan_only_sees_published_reports()
    {
        // 1 Draft, 1 Published
        $draft = ProjectReport::create([
            'report_number' => 'RPT-TEST-0002',
            'project_id' => $this->projectPm1->id,
            'created_by' => $this->pm1->id,
            'period_start' => '2026-11-01',
            'period_end' => '2026-11-07',
            'status' => 'draft',
            'executive_summary' => 'Draft PM1',
            'snapshot_data' => ['test' => true],
        ]);

        $published = ProjectReport::create([
            'report_number' => 'RPT-TEST-0003',
            'project_id' => $this->projectPm1->id,
            'created_by' => $this->pm1->id,
            'period_start' => '2026-10-25',
            'period_end' => '2026-10-31',
            'status' => 'published',
            'executive_summary' => 'Published PM1',
            'snapshot_data' => ['test' => true],
            'published_at' => now(),
        ]);

        Sanctum::actingAs($this->pimpinan);

        $response = $this->getJson('/api/project-reports');
        $response->assertStatus(200);

        $ids = collect($response->json('data'))->pluck('id')->toArray();
        $this->assertContains($published->id, $ids);
        $this->assertNotContains($draft->id, $ids);

        // Accessing draft directly returns 403
        $this->getJson("/api/project-reports/{$draft->id}")->assertStatus(403);
    }

    public function test_06_pimpinan_cannot_modify_or_create_reports()
    {
        $published = ProjectReport::create([
            'report_number' => 'RPT-TEST-0004',
            'project_id' => $this->projectPm1->id,
            'created_by' => $this->pm1->id,
            'period_start' => '2026-10-25',
            'period_end' => '2026-10-31',
            'status' => 'published',
            'executive_summary' => 'Published PM1',
            'snapshot_data' => ['test' => true],
            'published_at' => now(),
        ]);

        Sanctum::actingAs($this->pimpinan);

        $this->postJson("/api/projects/{$this->projectPm1->id}/reports", [
            'period_start' => '2026-11-01',
            'period_end' => '2026-11-07',
        ])->assertStatus(403);

        $this->putJson("/api/project-reports/{$published->id}", [
            'executive_summary' => 'Ubah oleh pimpinan',
        ])->assertStatus(422); // Published report cannot be modified

        $this->deleteJson("/api/project-reports/{$published->id}")->assertStatus(422);
    }

    public function test_07_member_gets_403_on_all_report_endpoints()
    {
        Sanctum::actingAs($this->member1);

        $this->getJson('/api/project-reports')->assertStatus(403);
        $this->getJson("/api/projects/{$this->projectPm1->id}/reports/preview")->assertStatus(403);
        $this->postJson("/api/projects/{$this->projectPm1->id}/reports", [])->assertStatus(403);
        $this->getJson("/api/project-reports/1")->assertStatus(403);
    }

    public function test_08_admin_can_see_global_reports()
    {
        ProjectReport::create([
            'report_number' => 'RPT-TEST-0005',
            'project_id' => $this->projectPm1->id,
            'created_by' => $this->pm1->id,
            'period_start' => '2026-10-25',
            'period_end' => '2026-10-31',
            'status' => 'published',
            'executive_summary' => 'Published PM1',
            'snapshot_data' => ['test' => true],
            'published_at' => now(),
        ]);

        ProjectReport::create([
            'report_number' => 'RPT-TEST-0006',
            'project_id' => $this->projectPm2->id,
            'created_by' => $this->pm2->id,
            'period_start' => '2026-10-25',
            'period_end' => '2026-10-31',
            'status' => 'published',
            'executive_summary' => 'Published PM2',
            'snapshot_data' => ['test' => true],
            'published_at' => now(),
        ]);

        Sanctum::actingAs($this->admin);

        $response = $this->getJson('/api/project-reports');
        $response->assertStatus(200);
        $this->assertCount(2, $response->json('data'));
    }

    // =========================================================================
    // DRAFT WORKFLOW TESTS (9 - 13)
    // =========================================================================

    public function test_09_pm_can_create_draft()
    {
        Sanctum::actingAs($this->pm1);

        $response = $this->postJson("/api/projects/{$this->projectPm1->id}/reports", [
            'period_start' => '2026-11-02',
            'period_end' => '2026-11-08',
            'executive_summary' => 'Summary draft',
            'challenges' => 'Kendala integrasi',
        ]);

        $response->assertStatus(201);
        $this->assertEquals('draft', $response->json('report.status'));
        $this->assertNotEmpty($response->json('report.snapshot_data'));
    }

    public function test_10_pm_can_update_own_draft()
    {
        $draft = ProjectReport::create([
            'report_number' => 'RPT-TEST-0007',
            'project_id' => $this->projectPm1->id,
            'created_by' => $this->pm1->id,
            'period_start' => '2026-11-02',
            'period_end' => '2026-11-08',
            'status' => 'draft',
            'executive_summary' => 'Old summary',
            'snapshot_data' => ['test' => true],
        ]);

        Sanctum::actingAs($this->pm1);

        $response = $this->putJson("/api/project-reports/{$draft->id}", [
            'executive_summary' => 'Updated executive summary',
            'completed_work' => 'Selesai modul A',
        ]);

        $response->assertStatus(200);
        $draft->refresh();
        $this->assertEquals('Updated executive summary', $draft->executive_summary);
        $this->assertEquals('Selesai modul A', $draft->completed_work);
    }

    public function test_11_pm_can_delete_own_draft()
    {
        $draft = ProjectReport::create([
            'report_number' => 'RPT-TEST-0008',
            'project_id' => $this->projectPm1->id,
            'created_by' => $this->pm1->id,
            'period_start' => '2026-11-02',
            'period_end' => '2026-11-08',
            'status' => 'draft',
            'snapshot_data' => ['test' => true],
        ]);

        Sanctum::actingAs($this->pm1);

        $response = $this->deleteJson("/api/project-reports/{$draft->id}");
        $response->assertStatus(200);
        $this->assertDatabaseMissing('project_reports', ['id' => $draft->id]);
    }

    public function test_12_pm_cannot_update_other_pm_draft()
    {
        $draftPm2 = ProjectReport::create([
            'report_number' => 'RPT-TEST-0009',
            'project_id' => $this->projectPm2->id,
            'created_by' => $this->pm2->id,
            'period_start' => '2026-11-02',
            'period_end' => '2026-11-08',
            'status' => 'draft',
            'snapshot_data' => ['test' => true],
        ]);

        Sanctum::actingAs($this->pm1);

        $this->putJson("/api/project-reports/{$draftPm2->id}", [
            'executive_summary' => 'Hacked summary',
        ])->assertStatus(403);
    }

    public function test_13_draft_is_invisible_to_pimpinan()
    {
        ProjectReport::create([
            'report_number' => 'RPT-TEST-0010',
            'project_id' => $this->projectPm1->id,
            'created_by' => $this->pm1->id,
            'period_start' => '2026-11-02',
            'period_end' => '2026-11-08',
            'status' => 'draft',
            'snapshot_data' => ['test' => true],
        ]);

        Sanctum::actingAs($this->pimpinan);

        $response = $this->getJson('/api/project-reports');
        $this->assertEmpty($response->json('data'));
    }

    // =========================================================================
    // PUBLISH WORKFLOW TESTS (14 - 20)
    // =========================================================================

    public function test_14_report_can_be_published_when_mandatory_fields_valid()
    {
        $draft = ProjectReport::create([
            'report_number' => 'RPT-TEST-0011',
            'project_id' => $this->projectPm1->id,
            'created_by' => $this->pm1->id,
            'period_start' => '2026-11-02',
            'period_end' => '2026-11-08',
            'status' => 'draft',
            'executive_summary' => 'Ringkasan lengkap mingguan.',
            'snapshot_data' => ['old_snap' => true],
        ]);

        Sanctum::actingAs($this->pm1);

        $response = $this->postJson("/api/project-reports/{$draft->id}/publish");
        $response->assertStatus(200);

        $draft->refresh();
        $this->assertEquals('published', $draft->status);
        $this->assertNotNull($draft->published_at);
    }

    public function test_15_published_report_cannot_be_modified()
    {
        $published = ProjectReport::create([
            'report_number' => 'RPT-TEST-0012',
            'project_id' => $this->projectPm1->id,
            'created_by' => $this->pm1->id,
            'period_start' => '2026-11-02',
            'period_end' => '2026-11-08',
            'status' => 'published',
            'executive_summary' => 'Ringkasan publikasi.',
            'snapshot_data' => ['test' => true],
            'published_at' => now(),
        ]);

        Sanctum::actingAs($this->pm1);

        $response = $this->putJson("/api/project-reports/{$published->id}", [
            'executive_summary' => 'Coba ubah laporan published',
        ]);

        $response->assertStatus(422);
    }

    public function test_16_published_report_cannot_be_deleted()
    {
        $published = ProjectReport::create([
            'report_number' => 'RPT-TEST-0013',
            'project_id' => $this->projectPm1->id,
            'created_by' => $this->pm1->id,
            'period_start' => '2026-11-02',
            'period_end' => '2026-11-08',
            'status' => 'published',
            'executive_summary' => 'Ringkasan publikasi.',
            'snapshot_data' => ['test' => true],
            'published_at' => now(),
        ]);

        Sanctum::actingAs($this->pm1);

        $response = $this->deleteJson("/api/project-reports/{$published->id}");
        $response->assertStatus(422);
        $this->assertDatabaseHas('project_reports', ['id' => $published->id]);
    }

    public function test_17_publishing_saves_timestamp()
    {
        $draft = ProjectReport::create([
            'report_number' => 'RPT-TEST-0014',
            'project_id' => $this->projectPm1->id,
            'created_by' => $this->pm1->id,
            'period_start' => '2026-11-02',
            'period_end' => '2026-11-08',
            'status' => 'draft',
            'executive_summary' => 'Ringkasan untuk timestamp.',
            'snapshot_data' => ['test' => true],
        ]);

        Sanctum::actingAs($this->pm1);

        $this->postJson("/api/project-reports/{$draft->id}/publish")->assertStatus(200);

        $draft->refresh();
        $this->assertNotNull($draft->published_at);
        $this->assertTrue(Carbon::parse($draft->published_at)->isToday());
    }

    public function test_18_publishing_saves_final_snapshot()
    {
        $draft = ProjectReport::create([
            'report_number' => 'RPT-TEST-0015',
            'project_id' => $this->projectPm1->id,
            'created_by' => $this->pm1->id,
            'period_start' => '2026-11-02',
            'period_end' => '2026-11-08',
            'status' => 'draft',
            'executive_summary' => 'Ringkasan final snapshot.',
            'snapshot_data' => ['dummy' => 'initial'],
        ]);

        // Add a new task to projectPm1 before publishing
        Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Tugas Tambahan Snapshot',
            'priority' => 'high',
            'status' => 'in_progress',
            'is_completed' => false,
            'created_by' => $this->pm1->id,
        ]);

        Sanctum::actingAs($this->pm1);

        $this->postJson("/api/project-reports/{$draft->id}/publish")->assertStatus(200);

        $draft->refresh();
        $snapshot = $draft->snapshot_data;
        $this->assertEquals(1, $snapshot['project']['total_tasks']);
    }

    public function test_19_cannot_create_two_reports_for_same_project_and_period()
    {
        ProjectReport::create([
            'report_number' => 'RPT-TEST-0016',
            'project_id' => $this->projectPm1->id,
            'created_by' => $this->pm1->id,
            'period_start' => '2026-11-02',
            'period_end' => '2026-11-08',
            'status' => 'draft',
            'snapshot_data' => ['test' => true],
        ]);

        Sanctum::actingAs($this->pm1);

        // Try creating duplicate
        $response = $this->postJson("/api/projects/{$this->projectPm1->id}/reports", [
            'period_start' => '2026-11-02',
            'period_end' => '2026-11-08',
            'executive_summary' => 'Duplikat report',
        ]);

        $response->assertStatus(422);
    }

    public function test_20_failed_publishing_leaves_no_partial_data()
    {
        $draft = ProjectReport::create([
            'report_number' => 'RPT-TEST-0017',
            'project_id' => $this->projectPm1->id,
            'created_by' => $this->pm1->id,
            'period_start' => '2026-11-02',
            'period_end' => '2026-11-08',
            'status' => 'draft',
            'executive_summary' => '', // Empty summary!
            'snapshot_data' => ['test' => true],
        ]);

        Sanctum::actingAs($this->pm1);

        $response = $this->postJson("/api/project-reports/{$draft->id}/publish");
        $response->assertStatus(422);

        $draft->refresh();
        $this->assertEquals('draft', $draft->status);
        $this->assertNull($draft->published_at);
    }

    // =========================================================================
    // SNAPSHOT ACCURACY TESTS (21 - 30)
    // =========================================================================

    public function test_21_project_progress_in_snapshot_matches_business_formula()
    {
        // 2 tasks: 1 completed, 1 in_progress => 50%
        Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Task Done',
            'status' => 'done',
            'is_completed' => true,
            'created_by' => $this->pm1->id,
        ]);
        Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Task Active',
            'status' => 'in_progress',
            'is_completed' => false,
            'created_by' => $this->pm1->id,
        ]);

        Sanctum::actingAs($this->pm1);

        $response = $this->getJson("/api/projects/{$this->projectPm1->id}/reports/preview");
        $response->assertStatus(200);

        $snapshot = $response->json('snapshot');
        $this->assertEquals(50, $snapshot['project']['progress']);
    }

    public function test_22_in_review_tasks_counted_accurately()
    {
        Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Task In Review',
            'status' => 'in_review',
            'is_completed' => false,
            'created_by' => $this->pm1->id,
        ]);

        Sanctum::actingAs($this->pm1);

        $response = $this->getJson("/api/projects/{$this->projectPm1->id}/reports/preview");
        $snapshot = $response->json('snapshot');

        $this->assertEquals(1, $snapshot['task_distribution']['in_review']);
        $this->assertEquals(1, $snapshot['project']['in_review_tasks']);
        $this->assertEquals(1, $snapshot['project']['active_tasks']);
    }

    public function test_23_done_and_completed_tasks_not_double_counted()
    {
        // Task with status=done and is_completed=true
        Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Task Done',
            'status' => 'done',
            'is_completed' => true,
            'created_by' => $this->pm1->id,
        ]);

        // Task with legacy status=completed
        Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Task Completed Legacy',
            'status' => 'completed',
            'is_completed' => true,
            'created_by' => $this->pm1->id,
        ]);

        Sanctum::actingAs($this->pm1);

        $response = $this->getJson("/api/projects/{$this->projectPm1->id}/reports/preview");
        $snapshot = $response->json('snapshot');

        $this->assertEquals(2, $snapshot['project']['completed_tasks']);
        $this->assertEquals(2, $snapshot['task_distribution']['total_done']);
    }

    public function test_24_checklist_snapshot_matches_actual_state()
    {
        $task = Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Task with checklists',
            'status' => 'in_progress',
            'is_completed' => false,
            'created_by' => $this->pm1->id,
        ]);

        TaskChecklist::create(['task_id' => $task->id, 'title' => 'CL 1', 'is_completed' => true, 'position' => 1]);
        TaskChecklist::create(['task_id' => $task->id, 'title' => 'CL 2', 'is_completed' => true, 'position' => 2]);
        TaskChecklist::create(['task_id' => $task->id, 'title' => 'CL 3', 'is_completed' => false, 'position' => 3]);

        Sanctum::actingAs($this->pm1);

        $response = $this->getJson("/api/projects/{$this->projectPm1->id}/reports/preview");
        $snapshot = $response->json('snapshot');

        $this->assertEquals(3, $snapshot['checklist_progress']['total_checklists']);
        $this->assertEquals(2, $snapshot['checklist_progress']['completed_checklists']);
        $this->assertEquals(1, $snapshot['checklist_progress']['pending_checklists']);
        $this->assertEquals(66.7, $snapshot['checklist_progress']['completion_rate']);
    }

    public function test_25_milestone_snapshot_reflects_actual_data()
    {
        Milestone::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Sprint 1',
            'status' => 'completed',
            'progress' => 100,
            'phase_order' => 1,
        ]);

        Milestone::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Sprint 2',
            'status' => 'in_progress',
            'progress' => 40,
            'phase_order' => 2,
        ]);

        Sanctum::actingAs($this->pm1);

        $response = $this->getJson("/api/projects/{$this->projectPm1->id}/reports/preview");
        $snapshot = $response->json('snapshot');

        $this->assertEquals(2, $snapshot['milestones']['total']);
        $this->assertEquals(1, $snapshot['milestones']['completed']);
        $this->assertEquals(1, $snapshot['milestones']['active']);
    }

    public function test_26_member_workload_scoped_strictly_to_project()
    {
        // Member 1 has task in PM1 project
        Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Task PM1',
            'status' => 'in_progress',
            'is_completed' => false,
            'assignee_id' => $this->member1->id,
            'created_by' => $this->pm1->id,
        ]);

        // Member 2 has task in PM2 project
        Task::create([
            'project_id' => $this->projectPm2->id,
            'title' => 'Task PM2',
            'status' => 'in_progress',
            'is_completed' => false,
            'assignee_id' => $this->member2->id,
            'created_by' => $this->pm2->id,
        ]);

        Sanctum::actingAs($this->pm1);

        $response = $this->getJson("/api/projects/{$this->projectPm1->id}/reports/preview");
        $snapshot = $response->json('snapshot');

        $memberIds = collect($snapshot['team_workload']['members'])->pluck('id')->toArray();
        $this->assertContains($this->member1->id, $memberIds);
        $this->assertNotContains($this->member2->id, $memberIds);
    }

    public function test_27_overdue_does_not_count_finished_tasks()
    {
        // Finished task with past deadline
        Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Finished Overdue Task',
            'status' => 'done',
            'is_completed' => true,
            'deadline' => Carbon::yesterday()->toDateString(),
            'created_by' => $this->pm1->id,
        ]);

        // Active task with past deadline
        Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Active Overdue Task',
            'status' => 'in_progress',
            'is_completed' => false,
            'deadline' => Carbon::yesterday()->toDateString(),
            'created_by' => $this->pm1->id,
        ]);

        Sanctum::actingAs($this->pm1);

        $response = $this->getJson("/api/projects/{$this->projectPm1->id}/reports/preview");
        $snapshot = $response->json('snapshot');

        $this->assertEquals(1, $snapshot['deadlines']['overdue']);
        $this->assertEquals(1, $snapshot['project']['overdue_tasks']);
    }

    public function test_28_snapshot_does_not_change_when_tasks_change_after_publication()
    {
        $task = Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Initial Task',
            'status' => 'in_progress',
            'is_completed' => false,
            'created_by' => $this->pm1->id,
        ]);

        $report = ProjectReport::create([
            'report_number' => 'RPT-TEST-0018',
            'project_id' => $this->projectPm1->id,
            'created_by' => $this->pm1->id,
            'period_start' => '2026-11-02',
            'period_end' => '2026-11-08',
            'status' => 'draft',
            'executive_summary' => 'Publikasi freeze',
            'snapshot_data' => [],
        ]);

        Sanctum::actingAs($this->pm1);
        $this->postJson("/api/project-reports/{$report->id}/publish")->assertStatus(200);

        // Later, 10 more tasks are added
        for ($i = 0; $i < 10; $i++) {
            Task::create([
                'project_id' => $this->projectPm1->id,
                'title' => "New Task $i",
                'status' => 'done',
                'is_completed' => true,
                'created_by' => $this->pm1->id,
            ]);
        }

        // View published report
        $response = $this->getJson("/api/project-reports/{$report->id}");
        $savedSnapshot = $response->json('report.snapshot_data');

        // Total tasks in saved snapshot must still be 1!
        $this->assertEquals(1, $savedSnapshot['project']['total_tasks']);
    }

    public function test_29_progress_history_does_not_leak_other_project_updates()
    {
        $task1 = Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Task PM1',
            'status' => 'in_progress',
            'is_completed' => false,
            'created_by' => $this->pm1->id,
        ]);

        $task2 = Task::create([
            'project_id' => $this->projectPm2->id,
            'title' => 'Task PM2',
            'status' => 'in_progress',
            'is_completed' => false,
            'created_by' => $this->pm2->id,
        ]);

        TaskUpdate::create([
            'task_id' => $task1->id,
            'user_id' => $this->member1->id,
            'work_description' => 'Update on PM1 project',
            'completed_checklists' => 0,
            'total_checklists' => 0,
            'progress_snapshot' => 0,
        ]);

        TaskUpdate::create([
            'task_id' => $task2->id,
            'user_id' => $this->member2->id,
            'work_description' => 'Update on PM2 project',
            'completed_checklists' => 0,
            'total_checklists' => 0,
            'progress_snapshot' => 0,
        ]);

        Sanctum::actingAs($this->pm1);

        $response = $this->getJson("/api/projects/{$this->projectPm1->id}/reports/preview");
        $snapshot = $response->json('snapshot');

        $descriptions = collect($snapshot['progress_history'])->pluck('description')->toArray();
        $this->assertContains('Update on PM1 project', $descriptions);
        $this->assertNotContains('Update on PM2 project', $descriptions);
    }

    public function test_30_approval_history_does_not_leak_other_project_reviews()
    {
        $task1 = Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Task PM1 Review',
            'status' => 'in_progress',
            'is_completed' => false,
            'created_by' => $this->pm1->id,
        ]);

        $task2 = Task::create([
            'project_id' => $this->projectPm2->id,
            'title' => 'Task PM2 Review',
            'status' => 'in_progress',
            'is_completed' => false,
            'created_by' => $this->pm2->id,
        ]);

        TaskReview::create([
            'task_id' => $task1->id,
            'user_id' => $this->pm1->id,
            'action' => 'approved',
            'from_status' => 'in_review',
            'to_status' => 'done',
            'notes' => 'Review for PM1 task',
        ]);

        TaskReview::create([
            'task_id' => $task2->id,
            'user_id' => $this->pm2->id,
            'action' => 'rejected',
            'from_status' => 'in_review',
            'to_status' => 'in_progress',
            'notes' => 'Review for PM2 task',
        ]);

        Sanctum::actingAs($this->pm1);

        $response = $this->getJson("/api/projects/{$this->projectPm1->id}/reports/preview");
        $snapshot = $response->json('snapshot');

        $notes = collect($snapshot['approval_history'])->pluck('notes')->toArray();
        $this->assertContains('Review for PM1 task', $notes);
        $this->assertNotContains('Review for PM2 task', $notes);
    }

    // =========================================================================
    // REGRESSION TESTS (31 - 33)
    // =========================================================================

    public function test_31_regression_workload_and_tasks_routes_still_work()
    {
        Sanctum::actingAs($this->pm1);

        $this->getJson('/api/workload/summary')->assertStatus(200);
        $this->getJson('/api/workload/members')->assertStatus(200);
        $this->getJson('/api/pm/workspace')->assertStatus(200);
    }

    public function test_32_regression_business_reports_still_work()
    {
        Sanctum::actingAs($this->pimpinan);

        $this->getJson('/api/reports')->assertStatus(200);
        $this->getJson('/api/reports?period=this_month')->assertStatus(200);
    }

    public function test_33_overview_kpis_scoped_by_role()
    {
        ProjectReport::create([
            'report_number' => 'RPT-TEST-0019',
            'project_id' => $this->projectPm1->id,
            'created_by' => $this->pm1->id,
            'period_start' => '2026-11-02',
            'period_end' => '2026-11-08',
            'status' => 'draft',
            'snapshot_data' => ['test' => true],
        ]);

        ProjectReport::create([
            'report_number' => 'RPT-TEST-0020',
            'project_id' => $this->projectPm1->id,
            'created_by' => $this->pm1->id,
            'period_start' => '2026-10-25',
            'period_end' => '2026-10-31',
            'status' => 'published',
            'snapshot_data' => ['test' => true],
            'published_at' => now(),
        ]);

        // Pimpinan sees drafts = 0
        Sanctum::actingAs($this->pimpinan);
        $pimpinanStats = $this->getJson('/api/project-reports/stats/overview')->json();
        $this->assertEquals(0, $pimpinanStats['total_drafts']);
        $this->assertEquals(1, $pimpinanStats['total_published']);

        // PM sees draft = 1, published = 1
        Sanctum::actingAs($this->pm1);
        $pmStats = $this->getJson('/api/project-reports/stats/overview')->json();
        $this->assertEquals(1, $pmStats['total_drafts']);
        $this->assertEquals(1, $pmStats['total_published']);
    }
}
