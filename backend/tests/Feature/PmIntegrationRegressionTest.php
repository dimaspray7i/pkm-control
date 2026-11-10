<?php

namespace Tests\Feature;

use App\Models\Activity;
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

class PmIntegrationRegressionTest extends TestCase
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
            'name' => 'Project Manager Satu',
            'email' => 'pm1@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        $this->pm2 = User::create([
            'name' => 'Project Manager Dua',
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

        $this->projectPm1 = Project::create([
            'name' => 'Proyek Digitalisasi Alpha',
            'code' => 'ALPHA-001',
            'client' => 'PT Alpha Solusi',
            'status' => 'in_progress',
            'progress' => 0,
            'pic_id' => $this->pm1->id,
            'pic_name' => $this->pm1->name,
            'deadline' => Carbon::now()->addDays(30)->toDateString(),
            'is_active' => true,
        ]);

        $this->projectPm2 = Project::create([
            'name' => 'Proyek Infrastruktur Beta',
            'code' => 'BETA-001',
            'client' => 'PT Beta Global',
            'status' => 'in_progress',
            'progress' => 0,
            'pic_id' => $this->pm2->id,
            'pic_name' => $this->pm2->name,
            'deadline' => Carbon::now()->addDays(40)->toDateString(),
            'is_active' => true,
        ]);
    }

    // =========================================================================
    // ALUR 1: TASK DISTRIBUTION & QUICK ASSIGN
    // =========================================================================

    public function test_alur_1_pm_creates_task_with_checklists_and_assigns_to_member(): void
    {
        Sanctum::actingAs($this->pm1);

        // PM1 creates a task with mandatory checklists for Member1
        $res = $this->postJson('/api/tasks', [
            'project_id' => $this->projectPm1->id,
            'title' => 'Implementasi Modul Pembayaran',
            'description' => 'Integrasi gateway pembayaran QRIS',
            'priority' => 'high',
            'deadline' => Carbon::now()->addDays(5)->toDateString(),
            'assignee_id' => $this->member1->id,
            'checklists' => [
                ['title' => 'Buat akun sandbox'],
                ['title' => 'Koneksikan API QRIS'],
                ['title' => 'Testing transaksi sukses'],
            ],
        ]);

        $res->assertStatus(201);
        $taskId = $res->json('task.id');

        // Verify task exists with checklists
        $task = Task::with('checklists')->find($taskId);
        $this->assertNotNull($task);
        $this->assertEquals(3, $task->checklists->count());
        $this->assertContains($task->status, ['todo', 'pending']);

        // Member1 sees this task
        Sanctum::actingAs($this->member1);
        $m1Res = $this->getJson('/api/tasks');
        $m1Res->assertStatus(200);
        $m1Ids = collect($m1Res->json('tasks'))->pluck('id')->toArray();
        $this->assertContains($taskId, $m1Ids);

        // Member2 does NOT see this task
        Sanctum::actingAs($this->member2);
        $m2Res = $this->getJson('/api/tasks');
        $m2Res->assertStatus(200);
        $m2Ids = collect($m2Res->json('tasks'))->pluck('id')->toArray();
        $this->assertNotContains($taskId, $m2Ids);
    }

    // =========================================================================
    // ALUR 2: MEMBER TO-DO & CHECKLIST PROGRESS
    // =========================================================================

    public function test_alur_2_member_toggles_checklist_and_calculates_progress(): void
    {
        $task = Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Setup Server Staging',
            'priority' => 'medium',
            'status' => 'in_progress',
            'is_completed' => false,
            'assignee_id' => $this->member1->id,
            'created_by' => $this->pm1->id,
        ]);

        $cl1 = TaskChecklist::create(['task_id' => $task->id, 'title' => 'Install Nginx', 'is_completed' => false, 'position' => 1]);
        $cl2 = TaskChecklist::create(['task_id' => $task->id, 'title' => 'Configure SSL', 'is_completed' => false, 'position' => 2]);

        Sanctum::actingAs($this->member1);

        // Toggle first checklist
        $res = $this->postJson("/api/checklists/{$cl1->id}/toggle");
        $res->assertStatus(200);
        $this->assertTrue($cl1->fresh()->is_completed);

        // Progress is now 50%
        $this->assertEquals(50, $task->fresh()->calculateChecklistProgress());

        // Member cannot edit metadata like title/priority via normal endpoints
        $this->putJson("/api/tasks/{$task->id}", [
            'priority' => 'urgent',
            'title' => 'Hacked by member',
        ])->assertStatus(403);
    }

    // =========================================================================
    // ALUR 3 & 4: PROGRESS UPDATE & APPROVAL WORKFLOW
    // =========================================================================

    public function test_alur_3_and_4_full_approval_cycle_and_update_locking(): void
    {
        $task = Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Audit Keamanan Sistem',
            'priority' => 'high',
            'status' => 'in_progress',
            'is_completed' => false,
            'assignee_id' => $this->member1->id,
            'created_by' => $this->pm1->id,
        ]);

        $cl = TaskChecklist::create(['task_id' => $task->id, 'title' => 'Scanning vulnerability', 'is_completed' => false, 'position' => 1]);

        // Step 1: Member creates progress update while in_progress
        Sanctum::actingAs($this->member1);
        $resUpdate = $this->postJson("/api/tasks/{$task->id}/updates", [
            'work_description' => 'Mulai scanning port server',
            'next_plan' => 'Selesaikan checklist scanning',
        ]);
        $resUpdate->assertStatus(201);

        // Step 2: Member cannot submit review if checklist not 100%
        $resSubmitFail = $this->postJson("/api/tasks/{$task->id}/submit-review");
        $resSubmitFail->assertStatus(422);

        // Complete the checklist
        $this->postJson("/api/checklists/{$cl->id}/toggle");
        $this->assertEquals(100, $task->fresh()->calculateChecklistProgress());

        // Step 3: Member submits review successfully
        $resSubmit = $this->postJson("/api/tasks/{$task->id}/submit-review", [
            'notes' => 'Scanning telah selesai 100%, mohon dicek.',
        ]);
        $resSubmit->assertStatus(200);
        $this->assertEquals('in_review', $task->fresh()->status);

        // Step 4: Backend locks progress update and checklist when task is in_review!
        $lockedUpdate = $this->postJson("/api/tasks/{$task->id}/updates", [
            'work_description' => 'Mencoba kirim update saat in_review',
        ]);
        $lockedUpdate->assertStatus(422);

        $lockedChecklist = $this->postJson("/api/checklists/{$cl->id}/toggle");
        $lockedChecklist->assertStatus(422);

        // Step 5: PM requests revision
        Sanctum::actingAs($this->pm1);
        $resRevision = $this->postJson("/api/tasks/{$task->id}/request-revision", [
            'reason' => 'Periksa kembali port 8080.',
        ]);
        $resRevision->assertStatus(200);
        $this->assertEquals('in_progress', $task->fresh()->status);

        // Now member can update again
        Sanctum::actingAs($this->member1);
        $resUpdate2 = $this->postJson("/api/tasks/{$task->id}/updates", [
            'work_description' => 'Port 8080 sudah diamankan',
        ]);
        $resUpdate2->assertStatus(201);

        // Member resubmits review
        $this->postJson("/api/tasks/{$task->id}/submit-review");
        $this->assertEquals('in_review', $task->fresh()->status);

        // Step 6: PM approves
        Sanctum::actingAs($this->pm1);
        $resApprove = $this->postJson("/api/tasks/{$task->id}/approve", [
            'notes' => 'Pekerjaan terverifikasi dengan baik.',
        ]);
        $resApprove->assertStatus(200);
        $this->assertEquals('done', $task->fresh()->status);
        $this->assertTrue($task->fresh()->is_completed);

        // Step 7: Backend locks progress update and checklist when task is done!
        Sanctum::actingAs($this->member1);
        $doneUpdate = $this->postJson("/api/tasks/{$task->id}/updates", [
            'work_description' => 'Coba update tugas done',
        ]);
        $doneUpdate->assertStatus(422);

        $doneChecklist = $this->postJson("/api/checklists/{$cl->id}/toggle");
        $doneChecklist->assertStatus(422);

        // Step 8: PM can reopen done task with mandatory reason
        Sanctum::actingAs($this->pm1);
        $reopenRes = $this->postJson("/api/tasks/{$task->id}/reopen", [
            'reason' => 'Ada vulnerability baru ditemukan pada library.',
        ]);
        $reopenRes->assertStatus(200);
        $this->assertEquals('in_progress', $task->fresh()->status);
        $this->assertFalse($task->fresh()->is_completed);
    }

    // =========================================================================
    // ALUR 5: PROJECT PROGRESS ACCURACY
    // =========================================================================

    public function test_alur_5_project_progress_calculation_and_consistency(): void
    {
        // Empty project has 0% progress
        $this->assertEquals(0, $this->projectPm1->calculateActualProgress());

        // Add 2 tasks
        $taskA = Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Task A',
            'status' => 'done',
            'is_completed' => true,
            'created_by' => $this->pm1->id,
        ]);
        $taskB = Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Task B',
            'status' => 'in_progress',
            'is_completed' => false,
            'created_by' => $this->pm1->id,
        ]);

        // 1 of 2 tasks done => 50%
        $this->assertEquals(50, $this->projectPm1->calculateActualProgress());

        // Mark task B done
        $taskB->update(['status' => 'done', 'is_completed' => true]);
        $this->assertEquals(100, $this->projectPm1->calculateActualProgress());

        // Add task C => progress recalculates down to 67% (2/3)
        Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Task C',
            'status' => 'in_progress',
            'is_completed' => false,
            'created_by' => $this->pm1->id,
        ]);
        $this->assertEquals(67, $this->projectPm1->calculateActualProgress());
    }

    // =========================================================================
    // ALUR 6: TEAM WORKLOAD MONITORING
    // =========================================================================

    public function test_alur_6_team_workload_monitoring_and_authorization(): void
    {
        // Member1 has active task in PM1 project
        Task::create([
            'project_id' => $this->projectPm1->id,
            'title' => 'Task PM1 Member1',
            'status' => 'in_review', // in_review counts as active!
            'is_completed' => false,
            'assignee_id' => $this->member1->id,
            'created_by' => $this->pm1->id,
        ]);

        // Member2 has active task in PM2 project
        Task::create([
            'project_id' => $this->projectPm2->id,
            'title' => 'Task PM2 Member2',
            'status' => 'in_progress',
            'is_completed' => false,
            'assignee_id' => $this->member2->id,
            'created_by' => $this->pm2->id,
        ]);

        // PM1 only sees Member1 in workload
        Sanctum::actingAs($this->pm1);
        $resWorkload = $this->getJson('/api/workload/members');
        $resWorkload->assertStatus(200);

        $memberIds = collect($resWorkload->json('members'))->pluck('id')->toArray();
        $this->assertContains($this->member1->id, $memberIds);
        $this->assertNotContains($this->member2->id, $memberIds);

        // in_review task is counted as active
        $m1Data = collect($resWorkload->json('members'))->firstWhere('id', $this->member1->id);
        $this->assertEquals(1, $m1Data['active_tasks']);
        $this->assertEquals(1, $m1Data['in_review_tasks']);

        // Member cannot access workload (403)
        Sanctum::actingAs($this->member1);
        $this->getJson('/api/workload/summary')->assertStatus(403);
        $this->getJson('/api/workload/members')->assertStatus(403);
    }

    // =========================================================================
    // ALUR 7: PROJECT REPORTS & RETENTION AUDIT
    // =========================================================================

    public function test_alur_7_project_reports_lifecycle_and_retention(): void
    {
        Sanctum::actingAs($this->pm1);

        // Step 1: Create Draft Report
        $createRes = $this->postJson("/api/projects/{$this->projectPm1->id}/reports", [
            'period_start' => '2026-11-02',
            'period_end' => '2026-11-08',
            'executive_summary' => 'Ringkasan performa minggu ke-1.',
            'completed_work' => 'Implementasi modul utama.',
        ]);
        $createRes->assertStatus(201);
        $reportId = $createRes->json('report.id');

        // Pimpinan cannot see draft
        Sanctum::actingAs($this->pimpinan);
        $this->getJson('/api/project-reports')->assertJsonMissing(['id' => $reportId]);
        $this->getJson("/api/project-reports/{$reportId}")->assertStatus(403);

        // Step 2: PM Publishes report
        Sanctum::actingAs($this->pm1);
        $publishRes = $this->postJson("/api/project-reports/{$reportId}/publish", [
            'executive_summary' => 'Final ringkasan eksekutif publikasi.',
        ]);
        $publishRes->assertStatus(200);
        $this->assertEquals('published', $publishRes->json('report.status'));

        // Published report cannot be modified or deleted
        $this->putJson("/api/project-reports/{$reportId}", [
            'executive_summary' => 'Coba edit',
        ])->assertStatus(422);

        $this->deleteJson("/api/project-reports/{$reportId}")->assertStatus(422);

        // Pimpinan now sees published report
        Sanctum::actingAs($this->pimpinan);
        $this->getJson("/api/project-reports/{$reportId}")->assertStatus(200);

        // Step 3: Retention guard - project with published reports cannot be deleted!
        Sanctum::actingAs($this->admin);
        $delProjRes = $this->deleteJson("/api/projects/{$this->projectPm1->id}");
        $delProjRes->assertStatus(422);
        $this->assertDatabaseHas('projects', ['id' => $this->projectPm1->id]);

        // Step 4: Retention guard - user who authored published reports cannot be deleted!
        $delUserRes = $this->deleteJson("/api/users/{$this->pm1->id}");
        $delUserRes->assertStatus(422);
        $this->assertDatabaseHas('users', ['id' => $this->pm1->id]);
    }

    // =========================================================================
    // ROLE AUTHORIZATION MATRIX CHECKS
    // =========================================================================

    public function test_cross_role_authorization_matrix(): void
    {
        // 1. Unauthenticated gets 401
        $this->getJson('/api/tasks')->assertStatus(401);
        $this->getJson('/api/workload/summary')->assertStatus(401);
        $this->getJson('/api/project-reports')->assertStatus(401);

        // 2. Member gets 403 on PM/Admin features
        Sanctum::actingAs($this->member1);
        $this->postJson('/api/tasks', [])->assertStatus(403);
        $this->getJson('/api/workload/members')->assertStatus(403);
        $this->getJson('/api/project-reports')->assertStatus(403);
        $this->postJson("/api/projects/{$this->projectPm1->id}/reports", [])->assertStatus(403);

        // 3. PM cannot manipulate other PM's projects
        Sanctum::actingAs($this->pm1);
        $this->postJson('/api/tasks', [
            'project_id' => $this->projectPm2->id,
            'title' => 'Injected task on PM2 project',
        ])->assertStatus(403);

        $this->postJson("/api/projects/{$this->projectPm2->id}/reports", [
            'period_start' => '2026-11-02',
            'period_end' => '2026-11-08',
        ])->assertStatus(403);

        // 4. Pimpinan is view-only (mutations rejected)
        Sanctum::actingAs($this->pimpinan);
        $this->postJson('/api/tasks', [
            'project_id' => $this->projectPm1->id,
            'title' => 'Pimpinan mutation attempt',
        ])->assertStatus(403);
    }
}
