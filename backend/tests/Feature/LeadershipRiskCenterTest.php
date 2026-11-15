<?php

namespace Tests\Feature;

use App\Models\BlockerResolution;
use App\Models\ExecutiveDecision;
use App\Models\ExecutiveDecisionAudit;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\StrategicRisk;
use App\Models\Task;
use App\Models\TaskUpdate;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LeadershipRiskCenterTest extends TestCase
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
            'code' => 'PRJ-ALPHA',
            'name' => 'Proyek Alpha Core',
            'client' => 'PT Potensi Karya Mandiri',
            'description' => 'Sistem Utama Enterprise PKM',
            'status' => 'in_progress',
            'priority' => 'high',
            'start_date' => Carbon::now()->subMonths(2),
            'target_completion_date' => Carbon::now()->addMonths(2),
            'target_progress' => 80,
            'progress' => 45,
            'pic_id' => $this->pmUser->id,
            'is_active' => true,
        ]);
    }

    public function test_unauthenticated_cannot_access_risk_center_endpoints(): void
    {
        $this->getJson('/api/leadership/risk-overview')->assertStatus(401);
        $this->getJson('/api/leadership/risks')->assertStatus(401);
        $this->getJson('/api/leadership/automatic-risks')->assertStatus(401);
        $this->getJson('/api/leadership/blockers')->assertStatus(401);
        $this->getJson('/api/leadership/decisions')->assertStatus(401);
        $this->getJson('/api/leadership/escalations')->assertStatus(401);
    }

    public function test_unauthorized_roles_cannot_access_risk_center_endpoints(): void
    {
        Sanctum::actingAs($this->pmUser);
        $this->getJson('/api/leadership/risk-overview')->assertStatus(403);
        $this->getJson('/api/leadership/risks')->assertStatus(403);
        $this->getJson('/api/leadership/decisions')->assertStatus(403);

        Sanctum::actingAs($this->memberUser);
        $this->getJson('/api/leadership/risk-overview')->assertStatus(403);
        $this->getJson('/api/leadership/blockers')->assertStatus(403);
        $this->getJson('/api/leadership/escalations')->assertStatus(403);
    }

    public function test_pimpinan_and_admin_can_access_risk_overview(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        // Seed a sample risk
        StrategicRisk::create([
            'risk_code' => 'RSK-9901',
            'project_id' => $this->project->id,
            'title' => 'Keterlambatan Komponen Core',
            'category' => 'technical',
            'likelihood' => 4,
            'impact' => 5,
            'risk_score' => 20,
            'risk_level' => 'critical',
            'status' => 'open',
            'identified_date' => Carbon::now()->toDateString(),
            'created_by' => $this->pimpinanUser->id,
        ]);

        $res = $this->getJson('/api/leadership/risk-overview');
        $res->assertStatus(200);
        $res->assertJsonStructure([
            'metrics' => [
                'total_active_risks',
                'critical_risks',
                'high_risks',
                'medium_risks',
                'low_risks',
                'resolved_risks',
                'overdue_follow_ups',
                'total_active_blockers',
            ],
            'distribution' => [
                'by_level',
                'by_category',
            ],
        ]);

        $this->assertEquals(1, $res->json('metrics.total_active_risks'));
        $this->assertEquals(1, $res->json('metrics.critical_risks'));

        // Admin also has access
        Sanctum::actingAs($this->adminUser);
        $this->getJson('/api/leadership/risk-overview')->assertStatus(200);
    }

    public function test_risk_register_crud_and_scoring_calculation(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        // 1. Create Risk (Likelihood 4, Impact 4 -> Score 16, Level High)
        $payload = [
            'project_id' => $this->project->id,
            'title' => 'Ketergantungan API Eksternal',
            'category' => 'external',
            'likelihood' => 4,
            'impact' => 4,
            'description' => 'Vendor belum merilis sandbox staging.',
            'mitigation' => 'Gunakan mock adapter internal.',
            'owner_id' => $this->pmUser->id,
            'identified_date' => Carbon::now()->toDateString(),
            'target_resolution_date' => Carbon::now()->addDays(14)->toDateString(),
        ];

        $res = $this->postJson('/api/leadership/risks', $payload);
        $res->assertStatus(201);
        $this->assertEquals(16, $res->json('risk.risk_score'));
        $this->assertEquals('high', $res->json('risk.risk_level'));
        $this->assertStringStartsWith('RSK-', $res->json('risk.risk_code'));

        $riskId = $res->json('risk.id');

        // 2. Index with filters
        $indexRes = $this->getJson('/api/leadership/risks?level=high');
        $indexRes->assertStatus(200);
        $this->assertCount(1, $indexRes->json('risks'));

        // 3. Detail
        $detailRes = $this->getJson("/api/leadership/risks/{$riskId}");
        $detailRes->assertStatus(200);
        $this->assertEquals('Ketergantungan API Eksternal', $detailRes->json('risk.title'));
    }

    public function test_risk_resolution_validation(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $risk = StrategicRisk::create([
            'risk_code' => 'RSK-9902',
            'project_id' => $this->project->id,
            'title' => 'Kekurangan Tenaga QA',
            'category' => 'resource',
            'likelihood' => 3,
            'impact' => 2,
            'risk_score' => 6,
            'risk_level' => 'medium',
            'status' => 'open',
            'identified_date' => Carbon::now()->toDateString(),
            'created_by' => $this->pimpinanUser->id,
        ]);

        // Attempt resolving without resolution_notes -> 422
        $failRes = $this->putJson("/api/leadership/risks/{$risk->id}", [
            'status' => 'resolved',
        ]);
        $failRes->assertStatus(422);

        // Resolving with resolution_notes -> 200
        $okRes = $this->putJson("/api/leadership/risks/{$risk->id}", [
            'status' => 'resolved',
            'resolution_notes' => 'Telah dialokasikan 1 freelance QA engineer.',
        ]);
        $okRes->assertStatus(200);
        $this->assertEquals('resolved', $okRes->json('risk.status'));
        $this->assertNotNull($okRes->json('risk.resolved_at'));
    }

    public function test_automatic_risk_detection_engine(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        // Project target_progress=80, actual progress=45 -> variance is -35% (variance <= -20% condition met)
        // Also add an overdue milestone
        Milestone::create([
            'project_id' => $this->project->id,
            'title' => 'Integrasi Payment Gateway',
            'due_date' => Carbon::now()->subDays(5)->toDateString(),
            'status' => 'pending',
            'progress' => 20,
        ]);

        $res = $this->getJson('/api/leadership/automatic-risks');
        $res->assertStatus(200);
        $detections = $res->json('detections');

        $this->assertNotEmpty($detections);
        $types = array_column($detections, 'risk_type');
        $this->assertContains('Deviasi Target Signifikan', $types);
        $this->assertContains('Milestone Melewati Batas Waktu', $types);

        // Check fingerprint stability
        $first = $detections[0];
        $this->assertNotEmpty($first['fingerprint']);
        $this->assertNotEmpty($first['recommendation']);
    }

    public function test_blocker_monitoring_and_resolution_tracking(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        // Create Task and Blocker TaskUpdate
        $task = Task::create([
            'project_id' => $this->project->id,
            'user_id' => $this->memberUser->id,
            'title' => 'Setup Database Replication',
            'status' => 'in_progress',
            'priority' => 'high',
            'start_date' => Carbon::now()->subDays(2),
            'due_date' => Carbon::now()->addDays(3),
        ]);

        $update = TaskUpdate::create([
            'task_id' => $task->id,
            'user_id' => $this->memberUser->id,
            'work_description' => 'Menghadapi masalah izin firewall cloud.',
            'blocker' => 'Firewall cloud memblokir port 3306.',
        ]);

        // Blocker Index
        $listRes = $this->getJson('/api/leadership/blockers');
        $listRes->assertStatus(200);
        $this->assertCount(1, $listRes->json('blockers'));
        $this->assertEquals('new', $listRes->json('blockers.0.status'));

        // Update Blocker Status via Leadership endpoint
        $updateRes = $this->putJson("/api/leadership/blockers/{$update->id}/status", [
            'status' => 'in_progress',
            'resolution_notes' => 'Tiket DevOps #4489 dibuat untuk open firewall.',
        ]);
        $updateRes->assertStatus(200);
        $this->assertEquals('in_progress', $updateRes->json('blocker.status'));

        // Verify task_updates table remains untouched (immutability)
        $freshUpdate = TaskUpdate::find($update->id);
        $this->assertEquals('Firewall cloud memblokir port 3306.', $freshUpdate->blocker);

        // Verify persisted in blocker_resolutions
        $resolution = BlockerResolution::where('task_update_id', $update->id)->first();
        $this->assertNotNull($resolution);
        $this->assertEquals('in_progress', $resolution->status);
    }

    public function test_executive_decision_lifecycle_and_validation(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        // 1. Create Draft Decision
        $res = $this->postJson('/api/leadership/decisions', [
            'project_id' => $this->project->id,
            'title' => 'Penggantian Vendor Cloud Infrastructure',
            'description' => 'Migrasi seluruh instance ke AWS Jakarta Region.',
            'category' => 'resource',
            'priority' => 'high',
            'status' => 'draft',
            'decision_date' => Carbon::now()->toDateString(),
            'underlying_problem' => 'Vendor lama mengalami downtime berulang kali.',
            'rationale' => 'SLA availability mencapai 99.9%.',
        ]);
        $res->assertStatus(201);
        $decisionId = $res->json('decision.id');
        $this->assertEquals('draft', $res->json('decision.status'));
        $this->assertStringStartsWith('DEC-', $res->json('decision.decision_number'));

        // 2. Approve Decision without PIC & due_date -> 422
        $failApprove = $this->putJson("/api/leadership/decisions/{$decisionId}", [
            'status' => 'approved',
        ]);
        $failApprove->assertStatus(422);

        // 3. Approve Decision with PIC & due_date -> 200
        $okApprove = $this->putJson("/api/leadership/decisions/{$decisionId}", [
            'status' => 'approved',
            'pic_id' => $this->pmUser->id,
            'due_date' => Carbon::now()->addDays(10)->toDateString(),
        ]);
        $okApprove->assertStatus(200);
        $this->assertEquals('approved', $okApprove->json('decision.status'));

        // 4. Complete Decision without implementation_result -> 422
        $failComplete = $this->putJson("/api/leadership/decisions/{$decisionId}", [
            'status' => 'completed',
        ]);
        $failComplete->assertStatus(422);

        // 5. Complete Decision with implementation_result -> 200
        $okComplete = $this->putJson("/api/leadership/decisions/{$decisionId}", [
            'status' => 'completed',
            'implementation_result' => 'Migrasi instance AWS selesai, latency turun 40%.',
        ]);
        $okComplete->assertStatus(200);
        $this->assertEquals('completed', $okComplete->json('decision.status'));
        $this->assertNotNull($okComplete->json('decision.completed_at'));
    }

    public function test_executive_decision_audit_trail_recorded(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $decision = ExecutiveDecision::create([
            'decision_number' => 'DEC-9999',
            'project_id' => $this->project->id,
            'title' => 'Penyesuaian Anggaran Q4',
            'description' => 'Alokasikan penambahan modal operasional Rp 50.000.000.',
            'category' => 'budget',
            'priority' => 'critical',
            'underlying_problem' => 'Kebutuhan lisensi tambahan enterprise.',
            'rationale' => 'Aktivitas riset AI berjalan lancar.',
            'decision_date' => Carbon::now()->toDateString(),
            'status' => 'draft',
            'created_by' => $this->pimpinanUser->id,
        ]);

        // Update status to approved
        $this->putJson("/api/leadership/decisions/{$decision->id}", [
            'status' => 'approved',
            'pic_id' => $this->pmUser->id,
            'due_date' => Carbon::now()->addDays(7)->toDateString(),
        ])->assertStatus(200);

        // Verify audit log
        $audits = ExecutiveDecisionAudit::where('decision_id', $decision->id)->get();
        $this->assertGreaterThanOrEqual(1, $audits->count());
        $lastAudit = $audits->last();
        $this->assertEquals($this->pimpinanUser->id, $lastAudit->user_id);
        $this->assertArrayHasKey('status', $lastAudit->changes);
        $this->assertEquals('approved', $lastAudit->changes['status']['to']);
    }

    public function test_escalation_center_aggregates_critical_items(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        // Seed Critical Risk
        StrategicRisk::create([
            'risk_code' => 'RSK-9903',
            'project_id' => $this->project->id,
            'title' => 'Kegagalan Integrasi Security Audit',
            'category' => 'compliance',
            'likelihood' => 5,
            'impact' => 5,
            'risk_score' => 25,
            'risk_level' => 'critical',
            'status' => 'open',
            'identified_date' => Carbon::now()->toDateString(),
            'created_by' => $this->pimpinanUser->id,
        ]);

        // Seed Overdue Decision
        ExecutiveDecision::create([
            'decision_number' => 'DEC-9901',
            'project_id' => $this->project->id,
            'title' => 'Persetujuan Lisensi Pentest',
            'description' => 'Segera bayar lisensi pentest.',
            'category' => 'compliance',
            'priority' => 'critical',
            'underlying_problem' => 'Audit mendekati batas akhir.',
            'rationale' => 'Laporan audit lolos verifikasi.',
            'decision_date' => Carbon::now()->subDays(5)->toDateString(),
            'status' => 'in_progress',
            'pic_id' => $this->pmUser->id,
            'due_date' => Carbon::now()->subDays(3)->toDateString(),
            'created_by' => $this->pimpinanUser->id,
        ]);

        $res = $this->getJson('/api/leadership/escalations');
        $res->assertStatus(200);
        $res->assertJsonStructure([
            'escalations',
            'summary' => [
                'total_escalations',
                'critical_risks_count',
                'overdue_decisions_count',
                'aged_blockers_count',
            ],
        ]);

        $this->assertGreaterThanOrEqual(2, $res->json('summary.total_escalations'));
        $this->assertGreaterThanOrEqual(1, $res->json('summary.critical_risks_count'));
        $this->assertGreaterThanOrEqual(1, $res->json('summary.overdue_decisions_count'));
    }
}
