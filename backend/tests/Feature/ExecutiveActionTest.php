<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\ExecutiveAction;
use App\Models\ExecutiveActionHistory;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ExecutiveActionTest extends TestCase
{
    use RefreshDatabase;

    private function adminToken(): array
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $token = $admin->createToken('test')->plainTextToken;
        return ['Authorization' => "Bearer $token", 'user' => $admin];
    }

    private function pimpinanToken(): array
    {
        $p = User::factory()->create(['role' => 'pimpinan']);
        $token = $p->createToken('test')->plainTextToken;
        return ['Authorization' => "Bearer $token", 'user' => $p];
    }

    private function pmToken(): array
    {
        $pm = User::factory()->create(['role' => 'project_manager']);
        $token = $pm->createToken('test')->plainTextToken;
        return ['Authorization' => "Bearer $token", 'user' => $pm];
    }

    private function memberToken(): array
    {
        $m = User::factory()->create(['role' => 'member']);
        $token = $m->createToken('test')->plainTextToken;
        return ['Authorization' => "Bearer $token", 'user' => $m];
    }

    public function test_admin_and_pimpinan_can_create_action(): void
    {
        $auth = $this->pimpinanToken();
        $pm = User::factory()->create(['role' => 'project_manager']);

        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])
            ->postJson('/api/leadership/actions', [
                'title' => 'Investigasi Deviasi Biaya Server',
                'description' => 'Evaluasi pengeluaran cloud hosting kuartal 4.',
                'priority' => 'critical',
                'status' => 'pending',
                'assigned_to' => $pm->id,
                'due_date' => Carbon::now()->addDays(5)->toDateString(),
            ]);

        $res->assertStatus(201)
            ->assertJson(['success' => true])
            ->assertJsonPath('action.priority', 'critical')
            ->assertJsonPath('action.status', 'pending');

        $this->assertDatabaseHas('executive_actions', [
            'title' => 'Investigasi Deviasi Biaya Server',
            'priority' => 'critical',
            'assigned_to' => $pm->id,
        ]);

        $this->assertDatabaseHas('executive_action_histories', [
            'event_type' => 'created',
            'actor_id' => $auth['user']->id,
        ]);
    }

    public function test_pm_cannot_create_action(): void
    {
        $auth = $this->pmToken();

        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])
            ->postJson('/api/leadership/actions', [
                'title' => 'Aksi Ilegal PM',
                'priority' => 'high',
            ]);

        $res->assertStatus(403);
    }

    public function test_member_denied_access_to_actions(): void
    {
        $auth = $this->memberToken();

        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])
            ->getJson('/api/leadership/actions/summary');

        $res->assertStatus(403);

        $res2 = $this->withHeaders(['Authorization' => $auth['Authorization']])
            ->getJson('/api/leadership/actions');

        $res2->assertStatus(403);
    }

    public function test_update_action_status_and_progress_with_audit_trail(): void
    {
        $admin = $this->adminToken();
        $action = ExecutiveAction::create([
            'action_code' => 'ACT-TEST-001',
            'title' => 'Penyesuaian Timeline Desain',
            'priority' => 'medium',
            'status' => 'pending',
            'created_by' => $admin['user']->id,
        ]);

        $res = $this->withHeaders(['Authorization' => $admin['Authorization']])
            ->putJson("/api/leadership/actions/{$action->id}", [
                'status' => 'in_progress',
                'progress' => 50,
                'additional_note' => 'Sprint meeting telah dilakukan.',
            ]);

        $res->assertStatus(200)
            ->assertJson(['success' => true])
            ->assertJsonPath('action.status', 'in_progress')
            ->assertJsonPath('action.progress', 50);

        $this->assertDatabaseHas('executive_action_histories', [
            'action_id' => $action->id,
            'event_type' => 'status_changed',
            'old_value' => 'pending',
            'new_value' => 'in_progress',
        ]);

        $this->assertDatabaseHas('executive_action_histories', [
            'action_id' => $action->id,
            'event_type' => 'progress_updated',
            'new_value' => '50',
        ]);
    }

    public function test_complete_action_sets_progress_100_and_completed_at(): void
    {
        $admin = $this->adminToken();
        $action = ExecutiveAction::create([
            'action_code' => 'ACT-TEST-002',
            'title' => 'Audit Keamanan Database',
            'priority' => 'high',
            'status' => 'in_progress',
            'progress' => 80,
            'created_by' => $admin['user']->id,
        ]);

        $res = $this->withHeaders(['Authorization' => $admin['Authorization']])
            ->putJson("/api/leadership/actions/{$action->id}", [
                'status' => 'completed',
                'completion_notes' => 'Seluruh celah ditutup dan diverifikasi.',
            ]);

        $res->assertStatus(200)
            ->assertJsonPath('action.status', 'completed')
            ->assertJsonPath('action.progress', 100);

        $fresh = $action->fresh();
        $this->assertNotNull($fresh->completed_at);
        $this->assertEquals('Seluruh celah ditutup dan diverifikasi.', $fresh->completion_notes);
    }

    public function test_cancel_action_requires_cancellation_reason(): void
    {
        $admin = $this->adminToken();
        $action = ExecutiveAction::create([
            'action_code' => 'ACT-TEST-003',
            'title' => 'Pengadaan Lisensi Tambahan',
            'priority' => 'low',
            'status' => 'pending',
            'created_by' => $admin['user']->id,
        ]);

        // Failed without reason
        $resFail = $this->withHeaders(['Authorization' => $admin['Authorization']])
            ->postJson("/api/leadership/actions/{$action->id}/cancel", []);
        $resFail->assertStatus(422);

        // Success with valid reason
        $resOk = $this->withHeaders(['Authorization' => $admin['Authorization']])
            ->postJson("/api/leadership/actions/{$action->id}/cancel", [
                'reason' => 'Vendor memberikan diskon komprehensif paket enterprise.',
            ]);

        $resOk->assertStatus(200)
            ->assertJsonPath('action.status', 'cancelled');

        $this->assertDatabaseHas('executive_actions', [
            'id' => $action->id,
            'status' => 'cancelled',
            'cancelled_reason' => 'Vendor memberikan diskon komprehensif paket enterprise.',
        ]);

        $this->assertDatabaseHas('executive_action_histories', [
            'action_id' => $action->id,
            'event_type' => 'cancelled',
        ]);
    }

    public function test_overdue_actions_detected_in_summary(): void
    {
        $admin = $this->adminToken();

        // Overdue action
        ExecutiveAction::create([
            'action_code' => 'ACT-TEST-OD1',
            'title' => 'Overdue Task Action',
            'priority' => 'critical',
            'status' => 'pending',
            'due_date' => Carbon::yesterday()->toDateString(),
            'created_by' => $admin['user']->id,
        ]);

        // Not overdue (completed)
        ExecutiveAction::create([
            'action_code' => 'ACT-TEST-OD2',
            'title' => 'Completed Action',
            'priority' => 'medium',
            'status' => 'completed',
            'due_date' => Carbon::yesterday()->toDateString(),
            'created_by' => $admin['user']->id,
        ]);

        $res = $this->withHeaders(['Authorization' => $admin['Authorization']])
            ->getJson('/api/leadership/actions/summary');

        $res->assertStatus(200);
        $summary = $res->json('summary');
        $this->assertGreaterThanOrEqual(1, $summary['overdue_count']);
        $this->assertGreaterThanOrEqual(1, $summary['critical_priority_count']);
    }

    public function test_create_action_from_business_intelligence_insight(): void
    {
        $pimpinan = $this->pimpinanToken();

        $res = $this->withHeaders(['Authorization' => $pimpinan['Authorization']])
            ->postJson('/api/leadership/actions/from-insight', [
                'id' => 'insight-proj-delayed',
                'title' => 'Proyek Terlambat & Deviasi Jadwal',
                'summary' => 'Proyek Alpha melewati tenggat waktu.',
                'recommendation' => 'Panggil PM untuk evaluasi.',
                'priority' => 'critical',
                'due_date' => Carbon::now()->addDays(3)->toDateString(),
            ]);

        $res->assertStatus(201)
            ->assertJson(['success' => true])
            ->assertJsonPath('action.source_type', 'business_intelligence')
            ->assertJsonPath('action.priority', 'critical');

        $this->assertDatabaseHas('executive_actions', [
            'source_type' => 'business_intelligence',
            'source_id' => 'insight-proj-delayed',
            'priority' => 'critical',
        ]);
    }

    public function test_convert_action_to_project_task_and_prevent_duplicates(): void
    {
        $admin = $this->adminToken();
        $pm = User::factory()->create(['role' => 'project_manager']);
        $project = Project::factory()->create(['pic_id' => $pm->id]);

        $action = ExecutiveAction::create([
            'action_code' => 'ACT-TEST-CONV',
            'title' => 'Optimasi Index Database',
            'description' => 'Tambah index pada task_reviews untuk query percepatan.',
            'priority' => 'high',
            'status' => 'pending',
            'project_id' => $project->id,
            'assigned_to' => $pm->id,
            'due_date' => Carbon::now()->addDays(4)->toDateString(),
            'created_by' => $admin['user']->id,
        ]);

        // First conversion
        $res = $this->withHeaders(['Authorization' => $admin['Authorization']])
            ->postJson("/api/leadership/actions/{$action->id}/convert-task", [
                'project_id' => $project->id,
                'assignee_id' => $pm->id,
            ]);

        $res->assertStatus(200)
            ->assertJson(['success' => true]);

        $taskId = $res->json('task.id');
        $this->assertNotNull($taskId);

        $this->assertDatabaseHas('tasks', [
            'id' => $taskId,
            'project_id' => $project->id,
            'assignee_id' => $pm->id,
            'status' => 'todo',
        ]);

        $freshAction = $action->fresh();
        $this->assertEquals($taskId, $freshAction->converted_task_id);
        $this->assertEquals('in_progress', $freshAction->status);

        // Attempt second conversion - MUST BE REJECTED (no duplicate tasks)
        $resDuplicate = $this->withHeaders(['Authorization' => $admin['Authorization']])
            ->postJson("/api/leadership/actions/{$action->id}/convert-task", [
                'project_id' => $project->id,
            ]);

        $resDuplicate->assertStatus(422);
    }

    public function test_pm_can_only_access_assigned_actions(): void
    {
        $admin = $this->adminToken();
        $pm1 = User::factory()->create(['role' => 'project_manager']);
        $pm2 = User::factory()->create(['role' => 'project_manager']);

        $actionPm1 = ExecutiveAction::create([
            'action_code' => 'ACT-PM1',
            'title' => 'Tugas Khusus PM 1',
            'priority' => 'medium',
            'status' => 'pending',
            'assigned_to' => $pm1->id,
            'created_by' => $admin['user']->id,
        ]);

        // PM 1 can view
        Sanctum::actingAs($pm1);
        $resPm1 = $this->getJson("/api/leadership/actions/{$actionPm1->id}");
        $resPm1->assertStatus(200);

        // PM 2 forbidden
        Sanctum::actingAs($pm2);
        $resPm2 = $this->getJson("/api/leadership/actions/{$actionPm1->id}");
        $resPm2->assertStatus(403);
    }

    public function test_deleting_assigned_user_preserves_action_with_null_assigned_to(): void
    {
        $admin = $this->adminToken();
        $user = User::factory()->create(['role' => 'project_manager']);

        $action = ExecutiveAction::create([
            'action_code' => 'ACT-PRESERVE',
            'title' => 'Action Must Survive User Deletion',
            'priority' => 'high',
            'status' => 'pending',
            'assigned_to' => $user->id,
            'created_by' => $admin['user']->id,
        ]);

        $this->assertEquals($user->id, $action->fresh()->assigned_to);

        // Delete user
        $user->delete();

        $fresh = $action->fresh();
        $this->assertNotNull($fresh);
        $this->assertNull($fresh->assigned_to);
    }

    public function test_actions_empty_state_returns_zero_summary(): void
    {
        $admin = $this->adminToken();

        $res = $this->withHeaders(['Authorization' => $admin['Authorization']])
            ->getJson('/api/leadership/actions/summary');

        $res->assertStatus(200)
            ->assertJsonPath('summary.total_actions', 0)
            ->assertJsonPath('summary.overdue_count', 0);

        $resList = $this->withHeaders(['Authorization' => $admin['Authorization']])
            ->getJson('/api/leadership/actions');

        $resList->assertStatus(200)
            ->assertJsonPath('actions', []);
    }
}