<?php

namespace Tests\Feature;

use App\Models\ExecutiveDecision;
use App\Models\ExecutiveReport;
use App\Models\Project;
use App\Models\StrategicRisk;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LeadershipExecutiveReportTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $pimpinanUser;
    protected User $pmUser;
    protected User $memberUser;
    protected Project $project;

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

        $this->project = Project::create([
            'code' => 'PKM-ERP-01',
            'name' => 'Enterprise Resource Planning',
            'client' => 'PT Potensi Karya Mandiri',
            'description' => 'Sistem Inti Manajemen Perusahaan',
            'status' => 'on_track',
            'priority' => 'high',
            'start_date' => Carbon::now()->subMonths(2),
            'target_completion_date' => Carbon::now()->addMonths(3),
            'target_progress' => 50,
            'progress' => 55,
            'pic_id' => $this->pmUser->id,
            'is_active' => true,
        ]);

        Task::create([
            'project_id' => $this->project->id,
            'assignee_id' => $this->memberUser->id,
            'title' => 'Modul Finance Integration',
            'status' => 'in_progress',
            'priority' => 'high',
            'start_date' => Carbon::now()->subDays(5),
            'deadline' => Carbon::now()->addDays(10),
        ]);
    }

    /**
     * 1. Authorization Tests
     */
    public function test_unauthenticated_cannot_access_executive_reports_endpoints(): void
    {
        $this->getJson('/api/leadership/executive-reports')->assertStatus(401);
        $this->postJson('/api/leadership/executive-reports', [])->assertStatus(401);
        $this->getJson('/api/leadership/decision-followup')->assertStatus(401);
    }

    public function test_pm_and_member_receive_forbidden_403(): void
    {
        Sanctum::actingAs($this->pmUser);
        $this->getJson('/api/leadership/executive-reports')->assertStatus(403);
        $this->postJson('/api/leadership/executive-reports', ['title' => 'Test'])->assertStatus(403);
        $this->getJson('/api/leadership/decision-followup')->assertStatus(403);

        Sanctum::actingAs($this->memberUser);
        $this->getJson('/api/leadership/executive-reports')->assertStatus(403);
        $this->getJson('/api/leadership/decision-followup')->assertStatus(403);
    }

    public function test_pimpinan_and_admin_can_access_endpoints(): void
    {
        Sanctum::actingAs($this->pimpinanUser);
        $res = $this->getJson('/api/leadership/executive-reports');
        $res->assertStatus(200);
        $res->assertJsonStructure(['success', 'summary', 'total', 'reports']);

        Sanctum::actingAs($this->adminUser);
        $this->getJson('/api/leadership/executive-reports')->assertStatus(200);
    }

    /**
     * 2. Executive Report Creation & Duplicate Protection
     */
    public function test_can_create_executive_report_draft_with_snapshot(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $payload = [
            'title' => 'Laporan Kinerja Eksekutif Q4 2026',
            'report_type' => 'quarterly',
            'period_start' => Carbon::now()->startOfQuarter()->toDateString(),
            'period_end' => Carbon::now()->endOfQuarter()->toDateString(),
            'executive_summary' => 'Performa perusahaan berada pada tren positif dengan CHI yang sehat.',
            'strategic_recommendations' => 'Fokuskan penambahan kapasitas dev pada proyek ERP.',
            'management_attention' => 'Waspadai potensi keterlambatan approval vendor cloud.',
        ];

        $res = $this->postJson('/api/leadership/executive-reports', $payload);
        $res->assertStatus(201);
        $res->assertJsonStructure([
            'success',
            'message',
            'report' => [
                'id',
                'report_number',
                'title',
                'report_type',
                'period_start',
                'period_end',
                'status',
                'snapshot_data' => [
                    'as_of_date',
                    'company_health',
                    'tasks_performance',
                    'projects',
                ],
                'generated_by',
            ]
        ]);

        $this->assertEquals('draft', $res->json('report.status'));
        $this->assertStringStartsWith('PKM-ER-', $res->json('report.report_number'));
        $this->assertNotEmpty($res->json('report.snapshot_data.company_health'));
    }

    public function test_duplicate_period_and_type_is_blocked(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $payload = [
            'title' => 'Laporan Bulanan November 2026',
            'report_type' => 'monthly',
            'period_start' => '2026-11-01',
            'period_end' => '2026-11-30',
        ];

        $res1 = $this->postJson('/api/leadership/executive-reports', $payload);
        $res1->assertStatus(201);

        // Attempt exact duplicate
        $res2 = $this->postJson('/api/leadership/executive-reports', $payload);
        $res2->assertStatus(422);
        $res2->assertJsonValidationErrors(['period']);
    }

    /**
     * 3. Update Draft vs Immutability of Published Reports
     */
    public function test_draft_can_be_updated_and_snapshot_refreshed(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $report = ExecutiveReport::create([
            'report_number' => 'PKM-ER-202611-0001',
            'title' => 'Initial Title',
            'report_type' => 'monthly',
            'period_start' => '2026-11-01',
            'period_end' => '2026-11-30',
            'status' => 'draft',
            'generated_by' => $this->pimpinanUser->id,
            'snapshot_data' => ['company_health' => ['chi_score' => 75]],
        ]);

        $updateRes = $this->putJson("/api/leadership/executive-reports/{$report->id}", [
            'title' => 'Updated Title Nov 2026',
            'executive_summary' => 'Updated executive summary narration.',
            'refresh_snapshot' => true,
        ]);

        $updateRes->assertStatus(200);
        $this->assertEquals('Updated Title Nov 2026', $updateRes->json('report.title'));
        $this->assertEquals('Updated executive summary narration.', $updateRes->json('report.executive_summary'));
    }

    public function test_published_report_is_strictly_immutable(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $report = ExecutiveReport::create([
            'report_number' => 'PKM-ER-202611-0002',
            'title' => 'Laporan Resmi Terbit',
            'report_type' => 'monthly',
            'period_start' => '2026-10-01',
            'period_end' => '2026-10-31',
            'status' => 'published',
            'published_at' => Carbon::now()->subDays(5),
            'published_by' => $this->pimpinanUser->id,
            'generated_by' => $this->pimpinanUser->id,
            'snapshot_data' => ['company_health' => ['chi_score' => 88]],
        ]);

        // Attempt update on published report -> Must fail with 422
        $updateRes = $this->putJson("/api/leadership/executive-reports/{$report->id}", [
            'title' => 'Malicious Modification After Publish',
        ]);
        $updateRes->assertStatus(422);

        // Attempt deletion on published report -> Must fail with 422
        $deleteRes = $this->deleteJson("/api/leadership/executive-reports/{$report->id}");
        $deleteRes->assertStatus(422);

        // Verify title did not change
        $this->assertEquals('Laporan Resmi Terbit', $report->fresh()->title);
    }

    public function test_can_publish_draft_report(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $report = ExecutiveReport::create([
            'report_number' => 'PKM-ER-202611-0003',
            'title' => 'Draft Siap Terbit',
            'report_type' => 'weekly',
            'period_start' => '2026-11-10',
            'period_end' => '2026-11-16',
            'status' => 'draft',
            'generated_by' => $this->pimpinanUser->id,
            'snapshot_data' => ['sample' => true],
        ]);

        $pubRes = $this->postJson("/api/leadership/executive-reports/{$report->id}/publish");
        $pubRes->assertStatus(200);
        $this->assertEquals('published', $pubRes->json('report.status'));
        $this->assertNotNull($pubRes->json('report.published_at'));
        $this->assertEquals($this->pimpinanUser->id, $report->fresh()->published_by);
        $this->assertEquals($this->pimpinanUser->name, $pubRes->json('report.published_by.name'));
    }

    /**
     * 4. Export & Print-Ready Payload
     */
    public function test_can_retrieve_export_ready_payload(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $report = ExecutiveReport::create([
            'report_number' => 'PKM-ER-202611-0004',
            'title' => 'Laporan Ekspor',
            'report_type' => 'monthly',
            'period_start' => '2026-11-01',
            'period_end' => '2026-11-30',
            'status' => 'published',
            'generated_by' => $this->pimpinanUser->id,
            'snapshot_data' => [
                'company_health' => ['chi_score' => 82],
                'projects' => [],
            ],
        ]);

        $res = $this->getJson("/api/leadership/executive-reports/{$report->id}/export");
        $res->assertStatus(200);
        $res->assertJsonStructure([
            'success',
            'company' => ['name', 'unit', 'address'],
            'report',
            'exported_at',
        ]);
        $this->assertEquals('PT Potensi Karya Mandiri', $res->json('company.name'));
    }

    /**
     * 5. Strategic Decision Follow-up & Management Action Tracker
     */
    public function test_decision_followup_and_overdue_detection(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        // Create approved overdue decision
        ExecutiveDecision::create([
            'decision_number' => 'DEC-2026-901',
            'title' => 'Pengadaan Server GPU Tambahan',
            'description' => 'Disposisi penambahan server AI',
            'category' => 'Infrastructure',
            'priority' => 'critical',
            'decision_date' => Carbon::now()->subDays(15)->toDateString(),
            'pic_id' => $this->pmUser->id,
            'due_date' => Carbon::now()->subDays(3)->toDateString(), // OVERDUE!
            'status' => 'in_progress',
            'created_by' => $this->pimpinanUser->id,
        ]);

        // Create completed decision
        ExecutiveDecision::create([
            'decision_number' => 'DEC-2026-902',
            'title' => 'Penyesuaian Scope Sprint 3',
            'description' => 'Penjadwalan ulang deliverable',
            'category' => 'Operational',
            'priority' => 'medium',
            'decision_date' => Carbon::now()->subDays(20)->toDateString(),
            'pic_id' => $this->pmUser->id,
            'due_date' => Carbon::now()->subDays(5)->toDateString(),
            'status' => 'completed',
            'implementation_result' => 'Sprint 3 scope disesuaikan dan tim sudah sinkron.',
            'created_by' => $this->pimpinanUser->id,
        ]);

        // Fetch follow-up dashboard
        $res = $this->getJson('/api/leadership/decision-followup');
        $res->assertStatus(200);
        $res->assertJsonStructure([
            'success',
            'summary' => [
                'total_decisions',
                'completed_count',
                'in_progress_count',
                'overdue_count',
                'resolution_rate',
            ],
            'total',
            'decisions' => [
                '*' => [
                    'id',
                    'decision_number',
                    'title',
                    'status',
                    'is_overdue',
                    'is_approaching',
                    'pic',
                ]
            ]
        ]);

        $this->assertEquals(2, $res->json('summary.total_decisions'));
        $this->assertEquals(1, $res->json('summary.completed_count'));
        $this->assertEquals(1, $res->json('summary.overdue_count'));
        $this->assertEquals(50.0, (float) $res->json('summary.resolution_rate'));

        // Filter overdue only
        $overdueRes = $this->getJson('/api/leadership/decision-followup?overdue=true');
        $overdueRes->assertStatus(200);
        $this->assertEquals(1, $overdueRes->json('total'));
        $this->assertTrue($overdueRes->json('decisions.0.is_overdue'));
        $this->assertEquals('Pengadaan Server GPU Tambahan', $overdueRes->json('decisions.0.title'));
    }
}
