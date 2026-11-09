<?php

namespace Tests\Feature;

use App\Models\Project;
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

class TeamWorkloadTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $pimpinan;
    protected User $pm1;
    protected User $pm2;
    protected User $member1;
    protected User $member2;
    protected User $member3;

    protected Project $projectPm1;
    protected Project $projectPm1b;
    protected Project $projectPm2;

    protected Task $task1; // pm1-project, member1, in_progress, deadline past
    protected Task $task2; // pm1-project, member1, in_review
    protected Task $task3; // pm1-project, member2, done
    protected Task $task4; // pm2-project, member2, in_progress
    protected Task $task5; // pm1-project2, member1, in_progress

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedTestData();
    }

    protected function seedTestData(): void
    {
        $this->admin = User::create([
            'name'      => 'Admin PKM',
            'email'     => 'admin@pkm.co.id',
            'password'  => Hash::make('password123'),
            'role'      => 'admin',
            'is_active' => true,
        ]);

        $this->pimpinan = User::create([
            'name'      => 'Pimpinan PKM',
            'email'     => 'pimpinan@pkm.co.id',
            'password'  => Hash::make('password123'),
            'role'      => 'pimpinan',
            'is_active' => true,
        ]);

        $this->pm1 = User::create([
            'name'      => 'PM Satu',
            'email'     => 'pm1@pkm.co.id',
            'password'  => Hash::make('password123'),
            'role'      => 'project_manager',
            'is_active' => true,
        ]);

        $this->pm2 = User::create([
            'name'      => 'PM Dua',
            'email'     => 'pm2@pkm.co.id',
            'password'  => Hash::make('password123'),
            'role'      => 'project_manager',
            'is_active' => true,
        ]);

        $this->member1 = User::create([
            'name'      => 'Budi Santoso',
            'email'     => 'budi@pkm.co.id',
            'password'  => Hash::make('password123'),
            'role'      => 'member',
            'is_active' => true,
        ]);

        $this->member2 = User::create([
            'name'      => 'Siti Rahayu',
            'email'     => 'siti@pkm.co.id',
            'password'  => Hash::make('password123'),
            'role'      => 'member',
            'is_active' => true,
        ]);

        $this->member3 = User::create([
            'name'      => 'Eko Prasetyo',
            'email'     => 'eko@pkm.co.id',
            'password'  => Hash::make('password123'),
            'role'      => 'member',
            'is_active' => true,
        ]);

        // pm1 owns 2 projects
        $this->projectPm1 = Project::create([
            'name'     => 'Proyek Alpha',
            'code'     => 'ALPHA-001',
            'client'   => 'Klien Alpha',
            'status'   => 'in_progress',
            'progress' => 0,
            'pic_id'   => $this->pm1->id,
            'pic_name' => $this->pm1->name,
            'budget'   => 50000000,
        ]);

        $this->projectPm1b = Project::create([
            'name'     => 'Proyek Beta',
            'code'     => 'BETA-001',
            'client'   => 'Klien Beta',
            'status'   => 'in_progress',
            'progress' => 0,
            'pic_id'   => $this->pm1->id,
            'pic_name' => $this->pm1->name,
            'budget'   => 30000000,
        ]);

        // pm2 owns 1 project
        $this->projectPm2 = Project::create([
            'name'     => 'Proyek Gamma',
            'code'     => 'GAMMA-001',
            'client'   => 'Klien Gamma',
            'status'   => 'in_progress',
            'progress' => 0,
            'pic_id'   => $this->pm2->id,
            'pic_name' => $this->pm2->name,
            'budget'   => 75000000,
        ]);

        // task1: pm1-project, member1, in_progress, overdue deadline
        $this->task1 = Task::create([
            'project_id'    => $this->projectPm1->id,
            'title'         => 'Tugas A - Overdue',
            'description'   => 'Implementasi fitur X',
            'priority'      => 'high',
            'status'        => 'in_progress',
            'is_completed'  => false,
            'deadline'      => Carbon::yesterday()->toDateString(),
            'assignee_id'   => $this->member1->id,
            'assignee_name' => $this->member1->name,
            'created_by'    => $this->pm1->id,
        ]);

        // task2: pm1-project, member1, in_review (waiting review)
        $this->task2 = Task::create([
            'project_id'    => $this->projectPm1->id,
            'title'         => 'Tugas B - In Review',
            'description'   => 'Desain UI dashboard',
            'priority'      => 'medium',
            'status'        => 'in_review',
            'is_completed'  => false,
            'deadline'      => Carbon::tomorrow()->toDateString(),
            'assignee_id'   => $this->member1->id,
            'assignee_name' => $this->member1->name,
            'created_by'    => $this->pm1->id,
        ]);

        // task3: pm1-project, member2, done
        $this->task3 = Task::create([
            'project_id'    => $this->projectPm1->id,
            'title'         => 'Tugas C - Done',
            'description'   => 'Testing unit',
            'priority'      => 'low',
            'status'        => 'done',
            'is_completed'  => true,
            'deadline'      => Carbon::yesterday()->toDateString(),
            'assignee_id'   => $this->member2->id,
            'assignee_name' => $this->member2->name,
            'created_by'    => $this->pm1->id,
        ]);

        // task4: pm2-project, member2, in_progress (should NOT be visible to pm1)
        $this->task4 = Task::create([
            'project_id'    => $this->projectPm2->id,
            'title'         => 'Tugas D - PM2 Project',
            'description'   => 'Riset pasar',
            'priority'      => 'high',
            'status'        => 'in_progress',
            'is_completed'  => false,
            'deadline'      => Carbon::now()->addDays(5)->toDateString(),
            'assignee_id'   => $this->member2->id,
            'assignee_name' => $this->member2->name,
            'created_by'    => $this->pm2->id,
        ]);

        // task5: pm1-project2, member1, in_progress (second project of pm1)
        $this->task5 = Task::create([
            'project_id'    => $this->projectPm1b->id,
            'title'         => 'Tugas E - Beta Project',
            'description'   => 'Deployment staging',
            'priority'      => 'urgent',
            'status'        => 'in_progress',
            'is_completed'  => false,
            'deadline'      => Carbon::now()->addDays(2)->toDateString(),
            'assignee_id'   => $this->member1->id,
            'assignee_name' => $this->member1->name,
            'created_by'    => $this->pm1->id,
        ]);

        // Checklists for task1 (2 total, 1 done = 50%)
        TaskChecklist::create(['task_id' => $this->task1->id, 'title' => 'CL-A', 'is_completed' => true, 'position' => 1]);
        TaskChecklist::create(['task_id' => $this->task1->id, 'title' => 'CL-B', 'is_completed' => false, 'position' => 2]);

        // Checklists for task2 (2 total, 2 done = 100%)
        TaskChecklist::create(['task_id' => $this->task2->id, 'title' => 'CL-C', 'is_completed' => true, 'position' => 1]);
        TaskChecklist::create(['task_id' => $this->task2->id, 'title' => 'CL-D', 'is_completed' => true, 'position' => 2]);
    }

    // =========================================================================
    // 1. PM only sees members in own projects
    // =========================================================================
    public function test_pm_only_sees_members_in_own_projects()
    {
        Sanctum::actingAs($this->pm1);

        $response = $this->getJson('/api/workload/members');

        $response->assertStatus(200);

        // member1 and member2 have tasks in pm1 projects
        $memberIds = collect($response->json('members'))->pluck('id')->toArray();
        $this->assertContains($this->member1->id, $memberIds);
        $this->assertContains($this->member2->id, $memberIds);

        // member3 has no tasks at all — should NOT appear
        $this->assertNotContains($this->member3->id, $memberIds);
    }

    // =========================================================================
    // 2. PM does not see members exclusive to other PM's projects
    // =========================================================================
    public function test_pm_does_not_see_members_exclusive_to_other_pm_projects()
    {
        Sanctum::actingAs($this->pm1);

        // member2 has task4 in pm2's project (and task3 in pm1's project)
        // task3 is 'done' so member2 may still appear IF done tasks count
        // But member3 has no tasks anywhere — should not appear

        $response = $this->getJson('/api/workload/members');
        $response->assertStatus(200);

        $memberIds = collect($response->json('members'))->pluck('id')->toArray();
        $this->assertNotContains($this->member3->id, $memberIds);
    }

    // =========================================================================
    // 3. PM sees members across multiple own projects without duplication
    // =========================================================================
    public function test_pm_sees_member_across_multiple_own_projects_without_duplication()
    {
        Sanctum::actingAs($this->pm1);

        // member1 has tasks in both projectPm1 and projectPm1b
        $response = $this->getJson('/api/workload/members');
        $response->assertStatus(200);

        $members    = collect($response->json('members'));
        $member1Arr = $members->where('id', $this->member1->id)->values();

        // Should appear exactly once
        $this->assertCount(1, $member1Arr);

        // Should have total_tasks = 3 (task1, task2, task5)
        $this->assertEquals(3, $member1Arr->first()['total_tasks']);
    }

    // =========================================================================
    // 4. Admin sees global workload (all members)
    // =========================================================================
    public function test_admin_sees_global_workload()
    {
        Sanctum::actingAs($this->admin);

        $response = $this->getJson('/api/workload/members');
        $response->assertStatus(200);

        $memberIds = collect($response->json('members'))->pluck('id')->toArray();

        // All members with tasks should appear
        $this->assertContains($this->member1->id, $memberIds);
        $this->assertContains($this->member2->id, $memberIds);
    }

    // =========================================================================
    // 5. Pimpinan sees global workload read-only
    // =========================================================================
    public function test_pimpinan_sees_global_workload()
    {
        Sanctum::actingAs($this->pimpinan);

        $response = $this->getJson('/api/workload/members');
        $response->assertStatus(200);

        $memberIds = collect($response->json('members'))->pluck('id')->toArray();
        $this->assertContains($this->member1->id, $memberIds);
        $this->assertContains($this->member2->id, $memberIds);
    }

    // =========================================================================
    // 6. Member gets 403 on all workload endpoints
    // =========================================================================
    public function test_member_gets_403_on_summary()
    {
        Sanctum::actingAs($this->member1);
        $this->getJson('/api/workload/summary')->assertStatus(403);
    }

    public function test_member_gets_403_on_members_list()
    {
        Sanctum::actingAs($this->member1);
        $this->getJson('/api/workload/members')->assertStatus(403);
    }

    public function test_member_gets_403_on_member_detail()
    {
        Sanctum::actingAs($this->member1);
        $this->getJson("/api/workload/members/{$this->member2->id}")->assertStatus(403);
    }

    public function test_member_gets_403_on_distribution()
    {
        Sanctum::actingAs($this->member1);
        $this->getJson('/api/workload/distribution')->assertStatus(403);
    }

    // =========================================================================
    // 7. PM cannot manipulate project_id to see other PM's data
    // =========================================================================
    public function test_pm_cannot_see_other_pm_member_detail_via_id()
    {
        // member2 has task4 in pm2's project. pm1 should still NOT see that via detail
        // Because detail scopes tasks to pm1's project IDs, task4 won't appear
        Sanctum::actingAs($this->pm1);

        // pm1 CAN see member2 (member2 has task3 in pm1's project)
        $response = $this->getJson("/api/workload/members/{$this->member2->id}");
        $response->assertStatus(200);

        // But the task from pm2 should NOT appear in task list
        $taskIds = collect($response->json('tasks'))->pluck('id')->toArray();
        $this->assertNotContains($this->task4->id, $taskIds);
        $this->assertContains($this->task3->id, $taskIds);
    }

    // =========================================================================
    // 8. Filters don't leak other PM's data
    // =========================================================================
    public function test_pm_workload_summary_scoped_to_own_projects()
    {
        Sanctum::actingAs($this->pm1);

        $response = $this->getJson('/api/workload/summary');
        $response->assertStatus(200);

        // task4 belongs to pm2 and member2 — pm1 should NOT count it
        // pm1 has: task1 (in_progress overdue), task2 (in_review), task3 (done), task5 (in_progress)
        // active (not done/completed) = task1, task2, task5 = 3
        $this->assertEquals(3, $response->json('total_active_tasks'));
    }

    // =========================================================================
    // 9. in_review tasks counted as active
    // =========================================================================
    public function test_in_review_tasks_counted_as_active()
    {
        Sanctum::actingAs($this->pm1);

        $response = $this->getJson('/api/workload/members');
        $response->assertStatus(200);

        $member1Data = collect($response->json('members'))->firstWhere('id', $this->member1->id);

        // task2 is in_review — should be in active_tasks
        $this->assertGreaterThanOrEqual(1, $member1Data['in_review_tasks']);
        $this->assertEquals(1, $member1Data['in_review_tasks']);
    }

    // =========================================================================
    // 10. done tasks NOT counted as active
    // =========================================================================
    public function test_done_tasks_not_counted_as_active()
    {
        Sanctum::actingAs($this->pm1);

        $response = $this->getJson('/api/workload/members');
        $response->assertStatus(200);

        $member2Data = collect($response->json('members'))->firstWhere('id', $this->member2->id);

        // task3 (done) for member2 in pm1 project — active_tasks should be 0
        $this->assertEquals(0, $member2Data['active_tasks']);
        $this->assertEquals(1, $member2Data['done_tasks']);
    }

    // =========================================================================
    // 11. completed status treated consistently (not active)
    // =========================================================================
    public function test_completed_status_not_counted_as_active()
    {
        Sanctum::actingAs($this->pm1);

        // Create a task with status=completed
        Task::create([
            'project_id'    => $this->projectPm1->id,
            'title'         => 'Tugas F - Completed',
            'description'   => 'Old completed task',
            'priority'      => 'low',
            'status'        => 'completed',
            'is_completed'  => true,
            'deadline'      => null,
            'assignee_id'   => $this->member2->id,
            'assignee_name' => $this->member2->name,
            'created_by'    => $this->pm1->id,
        ]);

        $response = $this->getJson('/api/workload/members');
        $response->assertStatus(200);

        $member2Data = collect($response->json('members'))->firstWhere('id', $this->member2->id);

        // The completed task should not increase active_tasks
        $this->assertEquals(0, $member2Data['active_tasks']);
        // done_tasks should now be 2
        $this->assertEquals(2, $member2Data['done_tasks']);
    }

    // =========================================================================
    // 12. Overdue only counts non-done tasks
    // =========================================================================
    public function test_overdue_only_counts_non_done_tasks()
    {
        Sanctum::actingAs($this->pm1);

        $response = $this->getJson('/api/workload/summary');
        $response->assertStatus(200);

        // task1 is overdue (yesterday deadline, in_progress)
        // task3 is also yesterday deadline but status=done — should NOT count as overdue
        $this->assertEquals(1, $response->json('total_overdue'));
    }

    // =========================================================================
    // 13. Due Today calculation correct
    // =========================================================================
    public function test_due_today_filter_works()
    {
        Sanctum::actingAs($this->pm1);

        // Create a task due today
        Task::create([
            'project_id'    => $this->projectPm1->id,
            'title'         => 'Due Today Task',
            'priority'      => 'high',
            'status'        => 'in_progress',
            'is_completed'  => false,
            'deadline'      => Carbon::today()->toDateString(),
            'assignee_id'   => $this->member1->id,
            'assignee_name' => $this->member1->name,
            'created_by'    => $this->pm1->id,
        ]);

        $response = $this->getJson("/api/workload/members/{$this->member1->id}?deadline_group=due_today");
        $response->assertStatus(200);

        $tasks = $response->json('tasks');
        $this->assertCount(1, $tasks);
        // deadline may be returned as ISO datetime or date string
        $this->assertStringStartsWith(Carbon::today()->toDateString(), $tasks[0]['deadline']);
    }

    // =========================================================================
    // 14. Due Soon (7 days) calculation correct
    // =========================================================================
    public function test_due_soon_filter_works()
    {
        Sanctum::actingAs($this->pm1);

        // task5 has deadline in 2 days — should appear in due_soon
        $response = $this->getJson("/api/workload/members/{$this->member1->id}?deadline_group=due_soon");
        $response->assertStatus(200);

        $tasks   = collect($response->json('tasks'));
        $taskIds = $tasks->pluck('id')->toArray();

        $this->assertContains($this->task5->id, $taskIds);
        // task1 (yesterday, overdue) should NOT appear
        $this->assertNotContains($this->task1->id, $taskIds);
    }

    // =========================================================================
    // 15. No Deadline category correct
    // =========================================================================
    public function test_no_deadline_filter_works()
    {
        Sanctum::actingAs($this->pm1);

        // Create a task with no deadline
        $noDeadlineTask = Task::create([
            'project_id'    => $this->projectPm1->id,
            'title'         => 'No Deadline Task',
            'priority'      => 'low',
            'status'        => 'todo',
            'is_completed'  => false,
            'deadline'      => null,
            'assignee_id'   => $this->member1->id,
            'assignee_name' => $this->member1->name,
            'created_by'    => $this->pm1->id,
        ]);

        $response = $this->getJson("/api/workload/members/{$this->member1->id}?deadline_group=no_deadline");
        $response->assertStatus(200);

        $taskIds = collect($response->json('tasks'))->pluck('id')->toArray();
        $this->assertContains($noDeadlineTask->id, $taskIds);
        $this->assertNotContains($this->task1->id, $taskIds);
        $this->assertNotContains($this->task2->id, $taskIds);
    }

    // =========================================================================
    // 16. No duplicate task aggregation in member list
    // =========================================================================
    public function test_no_duplicate_task_aggregation()
    {
        Sanctum::actingAs($this->pm1);

        $response = $this->getJson('/api/workload/members');
        $response->assertStatus(200);

        $members    = collect($response->json('members'));
        $member1Arr = $members->firstWhere('id', $this->member1->id);

        // task1 + task2 (active) + task5 = 3 total tasks; task3 not assigned to member1
        $this->assertEquals(3, $member1Arr['total_tasks']);

        // Active tasks for member1: task1 (in_progress), task2 (in_review), task5 (in_progress)
        $this->assertEquals(3, $member1Arr['active_tasks']);
    }

    // =========================================================================
    // 17. Avg progress computed correctly
    // =========================================================================
    public function test_avg_progress_computed_correctly()
    {
        Sanctum::actingAs($this->pm1);

        // member1 active tasks: task1 (50%), task2 (100%), task5 (no checklists = 0%)
        // avg = (50 + 100 + 0) / 3 ≈ 50.0

        $response = $this->getJson('/api/workload/members');
        $response->assertStatus(200);

        $member1Data = collect($response->json('members'))->firstWhere('id', $this->member1->id);
        $avgProgress = $member1Data['avg_progress'];

        // Should be approximately 50 (50+100+0)/3
        $this->assertEqualsWithDelta(50.0, $avgProgress, 1.0);
    }

    // =========================================================================
    // 18. Progress History and Approval History scoped by project ownership
    // =========================================================================
    public function test_progress_and_approval_history_scoped_to_pm_projects()
    {
        // Create a TaskUpdate for task4 (pm2 project, member2)
        TaskUpdate::create([
            'task_id'          => $this->task4->id,
            'user_id'          => $this->member2->id,
            'work_description' => 'Progress on pm2 project task',
            'completed_checklists' => 0,
            'total_checklists' => 0,
            'progress_snapshot' => 0,
        ]);

        // Create a TaskUpdate for task3 (pm1 project, member2)
        TaskUpdate::create([
            'task_id'          => $this->task3->id,
            'user_id'          => $this->member2->id,
            'work_description' => 'Progress on pm1 project task',
            'completed_checklists' => 2,
            'total_checklists' => 2,
            'progress_snapshot' => 100,
        ]);

        Sanctum::actingAs($this->pm1);

        // pm1 views member2's detail — only pm1 project updates should appear
        $response = $this->getJson("/api/workload/members/{$this->member2->id}");
        $response->assertStatus(200);

        $progressHistory = collect($response->json('progress_history'));
        $taskIds         = $progressHistory->pluck('task_id')->toArray();

        $this->assertContains($this->task3->id, $taskIds);
        $this->assertNotContains($this->task4->id, $taskIds); // pm2 project
    }

    // =========================================================================
    // 19. All endpoints return 401 if not logged in
    // =========================================================================
    public function test_endpoints_return_401_if_unauthenticated()
    {
        $this->getJson('/api/workload/summary')->assertStatus(401);
        $this->getJson('/api/workload/members')->assertStatus(401);
        $this->getJson("/api/workload/members/{$this->member1->id}")->assertStatus(401);
        $this->getJson('/api/workload/distribution')->assertStatus(401);
    }

    // =========================================================================
    // 20. Status / priority filters return correct results
    // =========================================================================
    public function test_member_detail_status_filter()
    {
        Sanctum::actingAs($this->pm1);

        // Filter member1's tasks by status=in_review — only task2 should appear
        $response = $this->getJson("/api/workload/members/{$this->member1->id}?status=in_review");
        $response->assertStatus(200);

        $tasks   = collect($response->json('tasks'));
        $taskIds = $tasks->pluck('id')->toArray();

        $this->assertContains($this->task2->id, $taskIds);
        $this->assertNotContains($this->task1->id, $taskIds);
        $this->assertNotContains($this->task5->id, $taskIds);
    }

    public function test_member_detail_priority_filter()
    {
        Sanctum::actingAs($this->pm1);

        // Filter member1's tasks by priority=urgent — only task5 should appear
        $response = $this->getJson("/api/workload/members/{$this->member1->id}?priority=urgent");
        $response->assertStatus(200);

        $tasks   = collect($response->json('tasks'));
        $taskIds = $tasks->pluck('id')->toArray();

        $this->assertContains($this->task5->id, $taskIds);
        $this->assertNotContains($this->task1->id, $taskIds);
        $this->assertNotContains($this->task2->id, $taskIds);
    }
}
