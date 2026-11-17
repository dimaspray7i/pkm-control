<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\StrategicKeyResult;
use App\Models\StrategicKeyResultCheckin;
use App\Models\StrategicObjective;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LeadershipOkrTest extends TestCase
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
    }

    /**
     * 1. Authorization Tests
     */
    public function test_unauthenticated_cannot_access_okr_endpoints(): void
    {
        $this->getJson('/api/leadership/okr/overview')->assertStatus(401);
        $this->getJson('/api/leadership/okr/objectives')->assertStatus(401);
        $this->postJson('/api/leadership/okr/objectives', [])->assertStatus(401);
    }

    public function test_member_cannot_modify_okrs(): void
    {
        Sanctum::actingAs($this->memberUser);
        $this->getJson('/api/leadership/okr/overview')->assertStatus(403);
        $this->getJson('/api/leadership/okr/objectives')->assertStatus(403);
        $this->postJson('/api/leadership/okr/objectives', ['title' => 'Test'])->assertStatus(403);
    }

    public function test_pimpinan_and_admin_have_full_management_access(): void
    {
        Sanctum::actingAs($this->pimpinanUser);
        $res = $this->getJson('/api/leadership/okr/overview');
        $res->assertStatus(200);
        $res->assertJsonStructure(['success', 'summary']);

        Sanctum::actingAs($this->adminUser);
        $resAdmin = $this->getJson('/api/leadership/okr/objectives');
        $resAdmin->assertStatus(200);
    }

    /**
     * 2. Objective CRUD & Filtering
     */
    public function test_can_create_and_update_strategic_objective(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $payload = [
            'title' => 'Peningkatan Kecepatan Delivery Proyek Klien',
            'description' => 'Memastikan proyek selesai tepat waktu dengan standar mutu tinggi.',
            'category' => 'Project Delivery',
            'period_start' => '2026-01-01',
            'period_end' => '2026-12-31',
            'priority' => 'critical',
            'status' => 'active',
            'owner_id' => $this->pimpinanUser->id,
            'project_ids' => [$this->project->id],
        ];

        $createRes = $this->postJson('/api/leadership/okr/objectives', $payload);
        $createRes->assertStatus(201);
        $createRes->assertJsonStructure([
            'success',
            'objective' => ['id', 'title', 'category', 'status', 'projects']
        ]);

        $objId = $createRes->json('objective.id');
        $this->assertEquals(1, count($createRes->json('objective.projects')));

        // Update
        $updateRes = $this->putJson("/api/leadership/okr/objectives/{$objId}", [
            'title' => 'Peningkatan Kecepatan Delivery Proyek Klien (Revisi)',
            'priority' => 'high',
        ]);
        $updateRes->assertStatus(200);
        $this->assertEquals('Peningkatan Kecepatan Delivery Proyek Klien (Revisi)', $updateRes->json('objective.title'));
    }

    /**
     * 3. Key Result Metric Calculation Engine
     */
    public function test_metric_calculations_for_all_types(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $obj = StrategicObjective::create([
            'title' => 'Sasaran Pengujian Metrik',
            'category' => 'Operational Excellence',
            'period_start' => '2026-01-01',
            'period_end' => '2026-06-30',
            'priority' => 'high',
            'status' => 'active',
            'created_by' => $this->pimpinanUser->id,
        ]);

        // A. Numeric Increase: baseline 20, target 100, current 60 => (60-20)/(100-20) = 40/80 = 50%
        $krIncrease = StrategicKeyResult::create([
            'objective_id' => $obj->id,
            'title' => 'On-Time Delivery Rate',
            'metric_type' => 'numeric_increase',
            'baseline_value' => 20,
            'target_value' => 100,
            'current_value' => 60,
            'weight' => 1.0,
        ]);
        $this->assertEquals(50.0, $krIncrease->computeProgress());

        // B. Numeric Decrease: baseline 50, target 10, current 30 => (50-30)/(50-10) = 20/40 = 50%
        $krDecrease = StrategicKeyResult::create([
            'objective_id' => $obj->id,
            'title' => 'Overdue Tasks Reduction',
            'metric_type' => 'numeric_decrease',
            'baseline_value' => 50,
            'target_value' => 10,
            'current_value' => 30,
            'weight' => 1.0,
        ]);
        $this->assertEquals(50.0, $krDecrease->computeProgress());

        // C. Boolean: target 1, current 0 => 0%, current 1 => 100%
        $krBoolean = StrategicKeyResult::create([
            'objective_id' => $obj->id,
            'title' => 'Implementasi CI/CD Automated Testing',
            'metric_type' => 'boolean',
            'baseline_value' => 0,
            'target_value' => 1,
            'current_value' => 0,
            'weight' => 1.0,
        ]);
        $this->assertEquals(0.0, $krBoolean->computeProgress());
        $krBoolean->current_value = 1;
        $this->assertEquals(100.0, $krBoolean->computeProgress());

        // D. Milestone-based: target 4, current 3 => 3/4 = 75%
        $krMilestone = StrategicKeyResult::create([
            'objective_id' => $obj->id,
            'title' => 'Selesaikan 4 Milestone Utama',
            'metric_type' => 'milestone_based',
            'baseline_value' => 0,
            'target_value' => 4,
            'current_value' => 3,
            'weight' => 1.0,
        ]);
        $this->assertEquals(75.0, $krMilestone->computeProgress());

        // E. Zero Denominator Safety: baseline 50, target 50 => does not crash with divide-by-zero
        $krZeroDiv = StrategicKeyResult::create([
            'objective_id' => $obj->id,
            'title' => 'Zero Denominator Test',
            'metric_type' => 'numeric_increase',
            'baseline_value' => 50,
            'target_value' => 50,
            'current_value' => 50,
            'weight' => 1.0,
        ]);
        $this->assertEquals(100.0, $krZeroDiv->computeProgress());

        // F. Cap at 100%: baseline 0, target 50, current 80 => 100% (not 160%)
        $krCap = StrategicKeyResult::create([
            'objective_id' => $obj->id,
            'title' => 'Capped at 100%',
            'metric_type' => 'numeric_increase',
            'baseline_value' => 0,
            'target_value' => 50,
            'current_value' => 80,
            'weight' => 1.0,
        ]);
        $this->assertEquals(100.0, $krCap->computeProgress());
    }

    /**
     * 4. Check-in & Immutable Audit Log
     */
    public function test_key_result_checkin_creates_immutable_log(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $obj = StrategicObjective::create([
            'title' => 'Sasaran Check-in',
            'category' => 'Team & Organization',
            'period_start' => '2026-01-01',
            'period_end' => '2026-12-31',
            'priority' => 'medium',
            'status' => 'active',
            'created_by' => $this->pimpinanUser->id,
        ]);

        $kr = StrategicKeyResult::create([
            'objective_id' => $obj->id,
            'title' => 'Pelatihan Sertifikasi 10 Developer',
            'metric_type' => 'numeric_increase',
            'baseline_value' => 0,
            'target_value' => 10,
            'current_value' => 2,
            'progress' => 20.0,
            'weight' => 1.0,
        ]);

        $checkinPayload = [
            'new_value' => 5,
            'notes' => 'Tiga developer tambahan berhasil lulus sertifikasi AWS.',
            'evidence_reference' => 'https://cert.pkm.co.id/batch-2',
        ];

        $res = $this->postJson("/api/leadership/okr/key-results/{$kr->id}/checkin", $checkinPayload);
        $res->assertStatus(200);
        $res->assertJsonStructure([
            'success',
            'key_result',
            'checkin' => ['id', 'previous_value', 'new_value', 'progress_snapshot', 'notes'],
            'objective_progress'
        ]);

        $this->assertEquals(5.0, $res->json('key_result.current_value'));
        $this->assertEquals(50.0, $res->json('key_result.progress'));
        $this->assertEquals(2.0, $res->json('checkin.previous_value'));
        $this->assertEquals(5.0, $res->json('checkin.new_value'));

        // Verify record in database
        $this->assertDatabaseHas('strategic_key_result_checkins', [
            'key_result_id' => $kr->id,
            'previous_value' => 2.0,
            'new_value' => 5.0,
            'progress_snapshot' => 50.0,
        ]);
    }

    /**
     * 5. Project Alignment Link & Unlink
     */
    public function test_can_link_and_unlink_project_alignment(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $obj = StrategicObjective::create([
            'title' => 'Sasaran Alignment Proyek',
            'category' => 'Customer Satisfaction',
            'period_start' => '2026-01-01',
            'period_end' => '2026-12-31',
            'priority' => 'high',
            'status' => 'active',
            'created_by' => $this->pimpinanUser->id,
        ]);

        // Link
        $linkRes = $this->postJson("/api/leadership/okr/objectives/{$obj->id}/projects", [
            'project_id' => $this->project->id,
            'contribution_notes' => 'Proyek ERP mendukung pilar transformasi operasional.',
        ]);
        $linkRes->assertStatus(200);
        $this->assertEquals(1, count($linkRes->json('projects')));

        // Duplicate link blocked
        $dupRes = $this->postJson("/api/leadership/okr/objectives/{$obj->id}/projects", [
            'project_id' => $this->project->id,
        ]);
        $dupRes->assertStatus(422);

        // Unlink
        $unlinkRes = $this->deleteJson("/api/leadership/okr/objectives/{$obj->id}/projects/{$this->project->id}");
        $unlinkRes->assertStatus(200);
        $this->assertEquals(0, count($unlinkRes->json('projects')));
    }
}
