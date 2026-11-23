<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Milestone;
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

/**
 * Tahap P-O: Member Workspace API Tests
 *
 * Verifikasi endpoint GET /api/member/workspace:
 * - Isolasi data ketat: member hanya melihat data pribadinya
 * - Metrik ringkasan akurat berdasarkan data DB nyata
 * - Tugas prioritas terurut benar (urgent > high > medium > low + deadline)
 * - Kalkulasi statistik progres personal yang sahih
 * - Feed aktivitas dan notifikasi PM yang tepat
 * - Arsip riwayat pekerjaan selesai dengan detail persetujuan PM
 * - Pembaruan profil member yang aman (tanpa role escalation)
 */
class MemberWorkspaceTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $pm;
    protected User $member1;
    protected User $member2;

    protected Project $project;
    protected Milestone $milestone;

    protected Task $taskUrgent;
    protected Task $taskHigh;
    protected Task $taskMedium;
    protected Task $taskDone;
    protected Task $taskOtherMember;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedTestData();
    }

    protected function seedTestData(): void
    {
        $this->admin = User::create([
            'name'      => 'Admin PKM',
            'email'     => 'admin@pkm.test',
            'password'  => Hash::make('password'),
            'role'      => 'admin',
            'is_active' => true,
        ]);

        $this->pm = User::create([
            'name'      => 'Manager PKM',
            'email'     => 'pm@pkm.test',
            'password'  => Hash::make('password'),
            'role'      => 'project_manager',
            'is_active' => true,
        ]);

        $this->member1 = User::create([
            'name'      => 'Andi Member',
            'email'     => 'andi@pkm.test',
            'password'  => Hash::make('password'),
            'role'      => 'member',
            'is_active' => true,
        ]);

        $this->member2 = User::create([
            'name'      => 'Budi Member',
            'email'     => 'budi@pkm.test',
            'password'  => Hash::make('password'),
            'role'      => 'member',
            'is_active' => true,
        ]);

        $this->project = Project::create([
            'code'      => 'PRJ-WS-001',
            'name'      => 'Project Workspace Test',
            'client'    => 'PT Test',
            'pic_id'    => $this->pm->id,
            'pic_name'  => $this->pm->name,
            'category'  => 'web',
            'status'    => 'on_track',
            'progress'  => 0,
            'risk_level'=> 'low',
            'deadline'  => Carbon::now()->addDays(60)->toDateString(),
            'is_active' => true,
        ]);

        $this->milestone = Milestone::create([
            'project_id'  => $this->project->id,
            'title'       => 'Sprint Workspace Test',
            'phase_order' => 1,
            'status'      => 'in_progress',
            'progress'    => 0,
            'deadline'    => Carbon::now()->addDays(30)->toDateString(),
        ]);

        // Task URGENT — milik member1 (belum selesai, deadline sudah lewat)
        $this->taskUrgent = Task::create([
            'project_id'    => $this->project->id,
            'milestone_id'  => $this->milestone->id,
            'title'         => 'Tugas Urgent Member 1',
            'description'   => 'Instruksi urgent dari PM',
            'priority'      => 'urgent',
            'status'        => 'in_progress',
            'is_completed'  => false,
            'deadline'      => Carbon::now()->subDays(2)->toDateString(), // overdue
            'assignee_id'   => $this->member1->id,
            'assignee_name' => $this->member1->name,
            'created_by'    => $this->pm->id,
        ]);

        // Task HIGH — milik member1
        $this->taskHigh = Task::create([
            'project_id'    => $this->project->id,
            'milestone_id'  => $this->milestone->id,
            'title'         => 'Tugas High Member 1',
            'description'   => 'Instruksi high dari PM',
            'priority'      => 'high',
            'status'        => 'todo',
            'is_completed'  => false,
            'deadline'      => Carbon::now()->addDays(5)->toDateString(),
            'assignee_id'   => $this->member1->id,
            'assignee_name' => $this->member1->name,
            'created_by'    => $this->pm->id,
        ]);

        // Task MEDIUM — milik member1
        $this->taskMedium = Task::create([
            'project_id'    => $this->project->id,
            'milestone_id'  => $this->milestone->id,
            'title'         => 'Tugas Medium Member 1',
            'description'   => 'Instruksi medium dari PM',
            'priority'      => 'medium',
            'status'        => 'in_progress',
            'is_completed'  => false,
            'deadline'      => Carbon::now()->addDays(10)->toDateString(),
            'assignee_id'   => $this->member1->id,
            'assignee_name' => $this->member1->name,
            'created_by'    => $this->pm->id,
        ]);

        // Checklist untuk taskMedium
        TaskChecklist::create([
            'task_id'      => $this->taskMedium->id,
            'title'        => 'Checklist A',
            'is_completed' => true,
            'position'     => 1,
        ]);
        TaskChecklist::create([
            'task_id'      => $this->taskMedium->id,
            'title'        => 'Checklist B',
            'is_completed' => false,
            'position'     => 2,
        ]);

        // Task DONE — milik member1 (sudah selesai dan disetujui PM)
        $this->taskDone = Task::create([
            'project_id'    => $this->project->id,
            'milestone_id'  => $this->milestone->id,
            'title'         => 'Tugas Selesai Member 1',
            'description'   => 'Sudah disetujui PM',
            'priority'      => 'medium',
            'status'        => 'completed',
            'is_completed'  => true,
            'deadline'      => Carbon::now()->subDays(5)->toDateString(),
            'assignee_id'   => $this->member1->id,
            'assignee_name' => $this->member1->name,
            'created_by'    => $this->pm->id,
        ]);

        // Review approval dari PM untuk taskDone
        TaskReview::create([
            'task_id'      => $this->taskDone->id,
            'user_id'      => $this->pm->id,
            'action'       => 'approved',
            'from_status'  => 'in_review',
            'to_status'    => 'done',
            'notes'        => 'Pekerjaan sangat baik!',
            'review_cycle' => 1,
        ]);

        // Task milik member2 — member1 tidak boleh melihat
        $this->taskOtherMember = Task::create([
            'project_id'    => $this->project->id,
            'milestone_id'  => $this->milestone->id,
            'title'         => 'Tugas Milik Member 2',
            'description'   => 'Ini bukan milik member1',
            'priority'      => 'high',
            'status'        => 'in_progress',
            'is_completed'  => false,
            'deadline'      => Carbon::now()->addDays(7)->toDateString(),
            'assignee_id'   => $this->member2->id,
            'assignee_name' => $this->member2->name,
            'created_by'    => $this->pm->id,
        ]);

        // Progress update dari member1 pada taskUrgent
        TaskUpdate::create([
            'task_id'              => $this->taskUrgent->id,
            'user_id'              => $this->member1->id,
            'work_description'     => 'Sudah mengerjakan bagian A',
            'completed_checklists' => 0,
            'total_checklists'     => 0,
            'progress_snapshot'    => 30,
            'blocker'              => 'Menunggu feedback klien',
            'next_plan'            => 'Lanjutkan setelah feedback',
        ]);

        // Activity log untuk member1
        Activity::create([
            'user_name'    => $this->member1->name,
            'action'       => 'mencatat progres pekerjaan',
            'target_name'  => $this->taskUrgent->title,
            'project_name' => $this->project->name,
            'avatar_color' => '#FF2F92',
        ]);
    }

    // ================================================================
    // Test 1: Member mengakses workspace dan mendapat data pribadi
    // ================================================================
    public function test_01_member_can_access_workspace_and_gets_personal_summary(): void
    {
        Sanctum::actingAs($this->member1);

        $response = $this->getJson('/api/member/workspace');
        $response->assertStatus(200);

        $data = $response->json();

        $this->assertArrayHasKey('summary', $data);
        $this->assertArrayHasKey('priority_tasks', $data);
        $this->assertArrayHasKey('personal_progress', $data);
        $this->assertArrayHasKey('recent_activities', $data);
        $this->assertArrayHasKey('pm_notifications', $data);
        $this->assertArrayHasKey('all_updates', $data);
        $this->assertArrayHasKey('completed_history', $data);

        $summary = $data['summary'];
        // member1 punya: 3 active + 1 done = 4 total
        $this->assertEquals(4, $summary['total']);
        $this->assertEquals(1, $summary['done']);
        $this->assertGreaterThanOrEqual(1, $summary['overdue']); // taskUrgent sudah overdue
    }

    // ================================================================
    // Test 2: Isolasi data ketat — member tidak melihat task member lain
    // ================================================================
    public function test_02_workspace_strictly_isolates_member_data(): void
    {
        Sanctum::actingAs($this->member1);

        $response = $this->getJson('/api/member/workspace');
        $response->assertStatus(200);

        $priorityTaskIds = collect($response->json('priority_tasks'))->pluck('id')->all();
        $completedIds    = collect($response->json('completed_history'))->pluck('id')->all();
        $allIds          = array_merge($priorityTaskIds, $completedIds);

        // task milik member2 TIDAK boleh muncul
        $this->assertNotContains($this->taskOtherMember->id, $allIds);

        // task milik member1 harus muncul
        $this->assertContains($this->taskUrgent->id, $priorityTaskIds);
    }

    // ================================================================
    // Test 3: Tugas prioritas diurutkan benar (urgent > high > medium)
    // ================================================================
    public function test_03_priority_tasks_ordered_by_priority_then_deadline(): void
    {
        Sanctum::actingAs($this->member1);

        $response = $this->getJson('/api/member/workspace');
        $response->assertStatus(200);

        $tasks = $response->json('priority_tasks');
        $this->assertNotEmpty($tasks);

        // Tugas pertama harus urgent
        $this->assertEquals('urgent', $tasks[0]['priority']);

        // Tugas kedua harus high (atau lebih tinggi)
        if (count($tasks) > 1) {
            $priorities = collect($tasks)->pluck('priority')->all();
            $priorityOrder = ['urgent', 'high', 'medium', 'low'];
            // Verifikasi tidak ada tugas dengan prioritas lebih rendah tampil sebelum yang lebih tinggi
            $prevIdx = 0;
            foreach ($priorities as $p) {
                $idx = array_search($p, $priorityOrder);
                $this->assertGreaterThanOrEqual($prevIdx, $idx);
                $prevIdx = $idx;
            }
        }
    }

    // ================================================================
    // Test 4: Statistik progres personal akurat berdasarkan DB
    // ================================================================
    public function test_04_personal_progress_calculates_authentic_stats(): void
    {
        Sanctum::actingAs($this->member1);

        $response = $this->getJson('/api/member/workspace');
        $response->assertStatus(200);

        $progress = $response->json('personal_progress');

        $this->assertArrayHasKey('completion_rate', $progress);
        $this->assertArrayHasKey('completed_tasks', $progress);
        $this->assertArrayHasKey('total_tasks', $progress);
        $this->assertArrayHasKey('checklist_rate', $progress);
        $this->assertArrayHasKey('weekly_trend', $progress);

        // 1 dari 4 tugas selesai = 25%
        $this->assertEquals(1, $progress['completed_tasks']);
        $this->assertEquals(4, $progress['total_tasks']);
        $this->assertEquals(25, $progress['completion_rate']);

        // Checklist: 1 dari 2 selesai (taskMedium) = 50%
        $this->assertEquals(1, $progress['completed_checklists']);
        $this->assertEquals(2, $progress['total_checklists']);
        $this->assertEquals(50, $progress['checklist_rate']);

        // Weekly trend harus berisi 7 entri
        $this->assertCount(7, $progress['weekly_trend']);
    }

    // ================================================================
    // Test 5: Notifikasi PM (revisi & approval) muncul di pm_notifications
    // ================================================================
    public function test_05_pm_approval_notification_appears_in_workspace(): void
    {
        Sanctum::actingAs($this->member1);

        $response = $this->getJson('/api/member/workspace');
        $response->assertStatus(200);

        $pmNotifications = $response->json('pm_notifications');
        $this->assertNotEmpty($pmNotifications);

        $approvalNotif = collect($pmNotifications)->first(fn($n) => $n['type'] === 'approved');
        $this->assertNotNull($approvalNotif);
        $this->assertStringContainsString('Pekerjaan sangat baik', $approvalNotif['notes']);
    }

    // ================================================================
    // Test 6: Riwayat pekerjaan selesai berisi detail approval PM
    // ================================================================
    public function test_06_completed_history_includes_pm_approval_details(): void
    {
        Sanctum::actingAs($this->member1);

        $response = $this->getJson('/api/member/workspace');
        $response->assertStatus(200);

        $history = $response->json('completed_history');
        $this->assertNotEmpty($history);

        $doneTask = collect($history)->firstWhere('id', $this->taskDone->id);
        $this->assertNotNull($doneTask);
        $this->assertEquals($this->pm->name, $doneTask['approved_by']);
        $this->assertStringContainsString('baik', $doneTask['approval_notes']);
    }

    // ================================================================
    // Test 7: Semua laporan progres milik member tersedia
    // ================================================================
    public function test_07_all_updates_includes_member_work_reports(): void
    {
        Sanctum::actingAs($this->member1);

        $response = $this->getJson('/api/member/workspace');
        $response->assertStatus(200);

        $updates = $response->json('all_updates');
        $this->assertNotEmpty($updates);

        $firstUpdate = $updates[0];
        $this->assertArrayHasKey('work_description', $firstUpdate);
        $this->assertArrayHasKey('progress_snapshot', $firstUpdate);
        $this->assertArrayHasKey('task_title', $firstUpdate);
        $this->assertEquals($this->taskUrgent->title, $firstUpdate['task_title']);
    }

    // ================================================================
    // Test 8: Member lain tidak mendapat data member1
    // ================================================================
    public function test_08_member2_cannot_see_member1_tasks_in_workspace(): void
    {
        Sanctum::actingAs($this->member2);

        $response = $this->getJson('/api/member/workspace');
        $response->assertStatus(200);

        $summary = $response->json('summary');
        // member2 punya 1 task
        $this->assertEquals(1, $summary['total']);

        $priorityTaskIds = collect($response->json('priority_tasks'))->pluck('id')->all();
        // Task member1 tidak boleh muncul
        $this->assertNotContains($this->taskUrgent->id, $priorityTaskIds);
        $this->assertNotContains($this->taskHigh->id, $priorityTaskIds);
    }

    // ================================================================
    // Test 9: Pengguna non-member mendapatkan 403 Forbidden
    // ================================================================
    public function test_09_non_member_role_gets_403(): void
    {
        Sanctum::actingAs($this->pm);
        $this->getJson('/api/member/workspace')->assertStatus(403);

        Sanctum::actingAs($this->admin);
        $this->getJson('/api/member/workspace')->assertStatus(403);
    }

    // ================================================================
    // Test 10: Pengguna tidak terautentikasi mendapatkan 401
    // ================================================================
    public function test_10_unauthenticated_request_to_workspace_returns_401(): void
    {
        $this->getJson('/api/member/workspace')->assertStatus(401);
    }

    // ================================================================
    // Test 11: Member dapat memperbarui profil (nama dan telepon)
    // ================================================================
    public function test_11_member_can_update_own_profile_name_and_phone(): void
    {
        Sanctum::actingAs($this->member1);

        $response = $this->putJson('/api/me', [
            'name'  => 'Andi Member Updated',
            'phone' => '0812-9999-0001',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);

        $this->member1->refresh();
        $this->assertEquals('Andi Member Updated', $this->member1->name);
        $this->assertEquals('0812-9999-0001', $this->member1->phone);
    }

    // ================================================================
    // Test 12: Member tidak dapat menaikkan role sendiri via update profile
    // ================================================================
    public function test_12_member_cannot_escalate_own_role_via_profile_update(): void
    {
        Sanctum::actingAs($this->member1);

        // PUT /api/me tidak menerima field 'role'
        $response = $this->putJson('/api/me', [
            'name' => 'Andi Member',
            'role' => 'admin', // percobaan eskalasi role
        ]);

        // Harus berhasil (200) tetapi role tidak berubah
        $response->assertStatus(200);

        $this->member1->refresh();
        $this->assertEquals('member', $this->member1->role);
    }

    // ================================================================
    // TAHAP M-A: MEMBER PERSONAL WORK CALENDAR TESTS (13 - 24)
    // ================================================================

    // Test 13: Member dapat mengakses kalender kerja miliknya sendiri
    public function test_13_member_can_access_own_work_calendar(): void
    {
        Sanctum::actingAs($this->member1);

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
        $response->assertJsonPath('meta.timezone', 'Asia/Jakarta');
    }

    // Test 14: Member tidak dapat melihat deadline anggota lain (Isolasi data ketat)
    public function test_14_member_calendar_strictly_isolated_from_other_members(): void
    {
        Sanctum::actingAs($this->member1);

        $response = $this->getJson('/api/member/calendar');
        $response->assertStatus(200);

        $taskIds = collect($response->json('tasks'))->pluck('id')->all();
        $this->assertNotContains($this->taskOtherMember->id, $taskIds);
    }

    // Test 15: Tugas completed tidak dihitung sebagai overdue
    public function test_15_completed_tasks_are_not_counted_as_overdue(): void
    {
        Sanctum::actingAs($this->member1);

        // Buat tugas yang sudah lewat deadline tetapi sudah selesai
        $doneOverdueTask = Task::create([
            'project_id'    => $this->project->id,
            'title'         => 'Tugas Selesai Terlampaui',
            'status'        => 'completed',
            'is_completed'  => true,
            'priority'      => 'high',
            'deadline'      => Carbon::now()->subDays(5)->toDateString(),
            'assignee_id'   => $this->member1->id,
            'creator_id'    => $this->pm->id,
        ]);

        $response = $this->getJson('/api/member/calendar');
        $response->assertStatus(200);

        // Pastikan tidak masuk hitungan overdue
        $tasks = collect($response->json('tasks'));
        $found = $tasks->firstWhere('id', $doneOverdueTask->id);
        $this->assertNotNull($found);
        $this->assertTrue($found['is_completed']);
        $this->assertFalse($found['is_overdue']);
    }

    // Test 16: Tugas in_review tetap ditampilkan sebagai pekerjaan aktif menunggu approval
    public function test_16_in_review_tasks_are_active_and_awaiting_approval(): void
    {
        Sanctum::actingAs($this->member1);

        $inReviewTask = Task::create([
            'project_id'    => $this->project->id,
            'title'         => 'Tugas Menunggu Review PM',
            'status'        => 'in_review',
            'is_completed'  => false,
            'priority'      => 'urgent',
            'deadline'      => Carbon::now()->addDays(2)->toDateString(),
            'assignee_id'   => $this->member1->id,
            'creator_id'    => $this->pm->id,
        ]);

        $response = $this->getJson('/api/member/calendar');
        $response->assertStatus(200);

        $tasks = collect($response->json('tasks'));
        $found = $tasks->firstWhere('id', $inReviewTask->id);
        $this->assertNotNull($found);
        $this->assertEquals('in_review', $found['status']);
        $this->assertFalse($found['is_completed']);
    }

    // Test 17: Perhitungan deadline hari ini akurat
    public function test_17_due_today_calculation_is_accurate(): void
    {
        Sanctum::actingAs($this->member1);

        $todayStr = Carbon::now('Asia/Jakarta')->toDateString();

        Task::create([
            'project_id'    => $this->project->id,
            'title'         => 'Tugas Deadline Hari Ini',
            'status'        => 'in_progress',
            'is_completed'  => false,
            'priority'      => 'high',
            'deadline'      => $todayStr,
            'assignee_id'   => $this->member1->id,
            'creator_id'    => $this->pm->id,
        ]);

        $response = $this->getJson('/api/member/calendar');
        $response->assertStatus(200);

        $this->assertGreaterThanOrEqual(1, $response->json('overview.due_today'));
    }

    // Test 18: Perhitungan deadline minggu ini akurat
    public function test_18_due_this_week_calculation_is_accurate(): void
    {
        Sanctum::actingAs($this->member1);

        $now = Carbon::now('Asia/Jakarta');
        $startOfWeek = (clone $now)->startOfWeek()->toDateString();

        Task::create([
            'project_id'    => $this->project->id,
            'title'         => 'Tugas Minggu Ini',
            'status'        => 'todo',
            'is_completed'  => false,
            'priority'      => 'medium',
            'deadline'      => $startOfWeek,
            'assignee_id'   => $this->member1->id,
            'creator_id'    => $this->pm->id,
        ]);

        $response = $this->getJson('/api/member/calendar');
        $response->assertStatus(200);

        $this->assertGreaterThanOrEqual(1, $response->json('overview.due_this_week'));
    }

    // Test 19: Perhitungan upcoming deadline akurat (maks 5 pekerjaan terdekat)
    public function test_19_upcoming_deadlines_accurate_and_capped_at_five(): void
    {
        Sanctum::actingAs($this->member1);

        $response = $this->getJson('/api/member/calendar');
        $response->assertStatus(200);

        $upcoming = $response->json('upcoming_deadlines');
        $this->assertIsArray($upcoming);
        $this->assertLessThanOrEqual(5, count($upcoming));
    }

    // Test 20: Filter prioritas kalender bekerja
    public function test_20_calendar_priority_filter_works(): void
    {
        Sanctum::actingAs($this->member1);

        $response = $this->getJson('/api/member/calendar?priority=urgent');
        $response->assertStatus(200);

        $tasks = collect($response->json('tasks'));
        foreach ($tasks as $t) {
            $this->assertEquals('urgent', $t['priority']);
        }
    }

    // Test 21: Filter status kalender bekerja
    public function test_21_calendar_status_filter_works(): void
    {
        Sanctum::actingAs($this->member1);

        $response = $this->getJson('/api/member/calendar?status=completed');
        $response->assertStatus(200);

        $tasks = collect($response->json('tasks'));
        foreach ($tasks as $t) {
            $this->assertTrue($t['is_completed']);
        }
    }

    // Test 22: Unauthenticated request ke kalender mendapat 401
    public function test_22_unauthenticated_calendar_returns_401(): void
    {
        $this->getJson('/api/member/calendar')->assertStatus(401);
    }

    // Test 23: Role non-member mendapat 403 Forbidden
    public function test_23_non_member_roles_get_403_forbidden_on_calendar(): void
    {
        Sanctum::actingAs($this->pm);
        $this->getJson('/api/member/calendar')->assertStatus(403);

        Sanctum::actingAs($this->admin);
        $this->getJson('/api/member/calendar')->assertStatus(403);
    }

    // Test 24: Filter rentang tanggal pergantian bulan bekerja akurat
    public function test_24_calendar_date_range_filter_works(): void
    {
        Sanctum::actingAs($this->member1);

        $start = Carbon::now()->startOfMonth()->toDateString();
        $end = Carbon::now()->endOfMonth()->toDateString();

        $response = $this->getJson("/api/member/calendar?start_date={$start}&end_date={$end}");
        $response->assertStatus(200);

        $tasks = collect($response->json('tasks'));
        foreach ($tasks as $t) {
            if ($t['deadline']) {
                $this->assertGreaterThanOrEqual($start, $t['deadline']);
                $this->assertLessThanOrEqual($end, $t['deadline']);
            }
        }
    }
}
