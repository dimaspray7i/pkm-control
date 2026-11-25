<?php

namespace Tests\Feature;

use App\Models\Milestone;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskChecklist;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Tahap N: Calendar API Hotfix Tests
 *
 * Scenarios:
 * 1. Member calendar loads successfully (200 OK) with full response structure.
 * 2. No SQL unknown column error occurs when querying calendar with milestones.
 * 3. Tasks returned belong strictly to the authenticated member (assignee_id = auth()->id()).
 * 4. Milestone relation is loaded properly without query failure.
 * 5. Member cannot see other member's tasks in calendar.
 * 6. Unauthenticated request receives 401.
 * 7. Non-member role without access receives 403.
 * 8. Calendar functions properly when milestone is null.
 * 9. Calendar functions properly when task deadline is null.
 * 10. Deadlines spanning month and year transitions are calculated accurately.
 */
class MemberCalendarTest extends TestCase
{
    use RefreshDatabase;

    protected User $memberA;
    protected User $memberB;
    protected User $pmUser;
    protected Project $project;
    protected Milestone $milestone;

    protected function setUp(): void
    {
        parent::setUp();

        $this->memberA = User::create([
            'name'      => 'Ahmad Member Alpha',
            'email'     => 'ahmad.cal@pkm.co.id',
            'password'  => bcrypt('password123'),
            'role'      => 'member',
            'is_active' => true,
        ]);

        $this->memberB = User::create([
            'name'      => 'Budi Member Beta',
            'email'     => 'budi.cal@pkm.co.id',
            'password'  => bcrypt('password123'),
            'role'      => 'member',
            'is_active' => true,
        ]);

        $this->pmUser = User::create([
            'name'      => 'Rahmat PM',
            'email'     => 'rahmat.pm.cal@pkm.co.id',
            'password'  => bcrypt('password123'),
            'role'      => 'project_manager',
            'is_active' => true,
        ]);

        $this->project = Project::create([
            'code'       => 'PRJ-CAL-01',
            'name'       => 'Proyek Uji Kalender',
            'client'     => 'PT Klien PKM',
            'pic_id'     => $this->pmUser->id,
            'pic_name'   => $this->pmUser->name,
            'category'   => 'web',
            'status'     => 'on_track',
            'progress'   => 50,
            'risk_level' => 'low',
            'deadline'   => Carbon::now()->addDays(60)->toDateString(),
            'is_active'  => true,
        ]);

        $this->milestone = Milestone::create([
            'project_id'  => $this->project->id,
            'title'       => 'Sprint Fondasi Kalender',
            'phase_order' => 1,
            'progress'    => 60,
            'status'      => 'in_progress',
            'start_date'  => Carbon::now()->subDays(5)->toDateString(),
            'due_date'    => Carbon::now()->addDays(20)->toDateString(),
        ]);
    }

    /** 1. Kalender member berhasil dimuat dengan respons 200 OK & struktur lengkap */
    public function test_member_calendar_loads_successfully_with_full_structure(): void
    {
        Sanctum::actingAs($this->memberA);

        Task::create([
            'project_id'    => $this->project->id,
            'milestone_id'  => $this->milestone->id,
            'title'         => 'Pekerjaan Utama Member Alpha',
            'priority'      => 'high',
            'status'        => 'in_progress',
            'is_completed'  => false,
            'deadline'      => Carbon::now()->addDays(3)->toDateString(),
            'assignee_id'   => $this->memberA->id,
            'assignee_name' => $this->memberA->name,
            'created_by'    => $this->pmUser->id,
        ]);

        $response = $this->getJson('/api/member/calendar');
        $response->assertStatus(200);
        $response->assertJsonStructure([
            'overview' => [
                'due_today',
                'due_this_week',
                'near_deadline',
                'overdue',
                'completed_this_month',
            ],
            'upcoming_deadlines',
            'tasks',
            'daily_distribution',
            'meta' => [
                'current_date',
                'current_time',
                'timezone',
            ],
        ]);
    }

    /** 2. Tidak terjadi SQL unknown column error saat query eager load milestone */
    public function test_no_sql_unknown_column_error_on_milestones(): void
    {
        Sanctum::actingAs($this->memberA);

        Task::create([
            'project_id'    => $this->project->id,
            'milestone_id'  => $this->milestone->id,
            'title'         => 'Validasi Kolom Milestone',
            'priority'      => 'medium',
            'status'        => 'todo',
            'is_completed'  => false,
            'deadline'      => Carbon::now()->addDays(2)->toDateString(),
            'assignee_id'   => $this->memberA->id,
            'assignee_name' => $this->memberA->name,
            'created_by'    => $this->pmUser->id,
        ]);

        $response = $this->getJson('/api/member/calendar');
        $response->assertStatus(200);

        $tasks = $response->json('tasks');
        $this->assertNotEmpty($tasks);
        $this->assertEquals($this->milestone->title, $tasks[0]['milestone_title']);
    }

    /** 3. Data tugas pada kalender hanya milik member yang sedang login */
    public function test_calendar_tasks_strictly_belong_to_logged_in_member(): void
    {
        // Task untuk Member A
        $taskA = Task::create([
            'project_id'    => $this->project->id,
            'title'         => 'Task Milik Member A',
            'priority'      => 'high',
            'status'        => 'in_progress',
            'is_completed'  => false,
            'deadline'      => Carbon::now()->addDays(1)->toDateString(),
            'assignee_id'   => $this->memberA->id,
            'assignee_name' => $this->memberA->name,
            'created_by'    => $this->pmUser->id,
        ]);

        // Task untuk Member B
        $taskB = Task::create([
            'project_id'    => $this->project->id,
            'title'         => 'Task Milik Member B',
            'priority'      => 'low',
            'status'        => 'in_progress',
            'is_completed'  => false,
            'deadline'      => Carbon::now()->addDays(2)->toDateString(),
            'assignee_id'   => $this->memberB->id,
            'assignee_name' => $this->memberB->name,
            'created_by'    => $this->pmUser->id,
        ]);

        Sanctum::actingAs($this->memberA);
        $response = $this->getJson('/api/member/calendar');
        $response->assertStatus(200);

        $taskIds = collect($response->json('tasks'))->pluck('id')->all();
        $this->assertContains($taskA->id, $taskIds);
        $this->assertNotContains($taskB->id, $taskIds);
    }

    /** 4. Data milestone tidak menyebabkan kegagalan query dan end_date accessor bekerja */
    public function test_milestone_data_and_end_date_accessor(): void
    {
        $this->assertNotNull($this->milestone->due_date);
        $this->assertEquals($this->milestone->due_date->format('Y-m-d'), $this->milestone->end_date);
    }

    /** 5. Member B tidak dapat membaca kalender Member A */
    public function test_member_cannot_read_other_members_calendar_tasks(): void
    {
        Task::create([
            'project_id'    => $this->project->id,
            'title'         => 'Rahasia Pekerjaan Member A',
            'priority'      => 'urgent',
            'status'        => 'in_progress',
            'is_completed'  => false,
            'deadline'      => Carbon::now()->toDateString(),
            'assignee_id'   => $this->memberA->id,
            'assignee_name' => $this->memberA->name,
            'created_by'    => $this->pmUser->id,
        ]);

        Sanctum::actingAs($this->memberB);
        $response = $this->getJson('/api/member/calendar');
        $response->assertStatus(200);

        $tasks = $response->json('tasks');
        $this->assertEmpty($tasks);
        $this->assertEquals(0, $response->json('overview.due_today'));
    }

    /** 6. Permintaan tanpa autentikasi mendapat 401 */
    public function test_unauthenticated_request_returns_401(): void
    {
        $response = $this->getJson('/api/member/calendar');
        $response->assertStatus(401);
    }

    /** 7. Role non-member ditolak dengan 403 */
    public function test_non_member_role_receives_403(): void
    {
        Sanctum::actingAs($this->pmUser);
        $response = $this->getJson('/api/member/calendar');
        $response->assertStatus(403);
    }

    /** 8. Kalender tetap berfungsi ketika milestone kosong/null */
    public function test_calendar_works_when_milestone_is_null(): void
    {
        Sanctum::actingAs($this->memberA);

        $taskNoMilestone = Task::create([
            'project_id'    => $this->project->id,
            'milestone_id'  => null,
            'title'         => 'Tugas Tanpa Milestone',
            'priority'      => 'medium',
            'status'        => 'in_progress',
            'is_completed'  => false,
            'deadline'      => Carbon::now()->addDays(4)->toDateString(),
            'assignee_id'   => $this->memberA->id,
            'assignee_name' => $this->memberA->name,
            'created_by'    => $this->pmUser->id,
        ]);

        $response = $this->getJson('/api/member/calendar');
        $response->assertStatus(200);

        $tasks = $response->json('tasks');
        $this->assertCount(1, $tasks);
        $this->assertNull($tasks[0]['milestone_title']);
    }

    /** 9. Kalender tetap berfungsi ketika deadline tugas bernilai null */
    public function test_calendar_works_when_deadline_is_null(): void
    {
        Sanctum::actingAs($this->memberA);

        Task::create([
            'project_id'    => $this->project->id,
            'milestone_id'  => $this->milestone->id,
            'title'         => 'Tugas Tanpa Tenggat Waktu',
            'priority'      => 'low',
            'status'        => 'todo',
            'is_completed'  => false,
            'deadline'      => null,
            'assignee_id'   => $this->memberA->id,
            'assignee_name' => $this->memberA->name,
            'created_by'    => $this->pmUser->id,
        ]);

        $response = $this->getJson('/api/member/calendar');
        $response->assertStatus(200);

        $tasks = $response->json('tasks');
        $this->assertCount(1, $tasks);
        $this->assertNull($tasks[0]['deadline']);
    }

    /** 10. Data deadline tetap benar pada pergantian bulan dan tahun */
    public function test_deadlines_accurate_across_month_and_year_transitions(): void
    {
        Sanctum::actingAs($this->memberA);

        $nextYearDeadline = Carbon::now()->addYear()->startOfYear()->toDateString();

        $taskNewYear = Task::create([
            'project_id'    => $this->project->id,
            'milestone_id'  => $this->milestone->id,
            'title'         => 'Rencana Awal Tahun Depan',
            'priority'      => 'medium',
            'status'        => 'todo',
            'is_completed'  => false,
            'deadline'      => $nextYearDeadline,
            'assignee_id'   => $this->memberA->id,
            'assignee_name' => $this->memberA->name,
            'created_by'    => $this->pmUser->id,
        ]);

        $response = $this->getJson('/api/member/calendar');
        $response->assertStatus(200);

        $tasks = $response->json('tasks');
        $found = collect($tasks)->firstWhere('id', $taskNewYear->id);
        $this->assertNotNull($found);
        $this->assertEquals($nextYearDeadline, $found['deadline']);
    }
}