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
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MemberPerformanceTest extends TestCase
{
    use RefreshDatabase;

    protected User $member1;
    protected User $member2;
    protected User $pm;
    protected User $admin;
    protected User $pimpinan;
    protected Project $project;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'name'      => 'Admin PKM',
            'email'     => 'admin@pkm.test',
            'password'  => bcrypt('password'),
            'role'      => 'admin',
            'is_active' => true,
        ]);

        $this->pimpinan = User::create([
            'name'      => 'Direktur PKM',
            'email'     => 'direktur@pkm.test',
            'password'  => bcrypt('password'),
            'role'      => 'pimpinan',
            'is_active' => true,
        ]);

        $this->pm = User::create([
            'name'      => 'PM Senior',
            'email'     => 'pm@pkm.test',
            'password'  => bcrypt('password'),
            'role'      => 'project_manager',
            'is_active' => true,
        ]);

        $this->member1 = User::create([
            'name'      => 'Member Alpha',
            'email'     => 'member1@pkm.test',
            'password'  => bcrypt('password'),
            'role'      => 'member',
            'is_active' => true,
        ]);

        $this->member2 = User::create([
            'name'      => 'Member Beta',
            'email'     => 'member2@pkm.test',
            'password'  => bcrypt('password'),
            'role'      => 'member',
            'is_active' => true,
        ]);

        $this->project = Project::create([
            'code'       => 'PRJ-TEST-001',
            'name'       => 'PKM System Development',
            'client'     => 'PT Potensi Karya Mandiri',
            'pic_id'     => $this->pm->id,
            'pic_name'   => $this->pm->name,
            'category'   => 'web',
            'status'     => 'on_track',
            'progress'   => 0,
            'risk_level' => 'low',
            'deadline'   => Carbon::now()->addDays(60)->toDateString(),
            'is_active'  => true,
        ]);
    }

    protected function createTask(array $attributes = []): Task
    {
        return Task::create(array_merge([
            'project_id'   => $this->project->id,
            'title'        => 'Test Task ' . uniqid(),
            'priority'     => 'medium',
            'status'       => 'todo',
            'is_completed' => false,
            'deadline'     => Carbon::now()->addDays(7)->toDateString(),
            'assignee_id'  => $this->member1->id,
            'created_by'   => $this->pm->id,
        ], $attributes));
    }

    // 1. Member terautentikasi dapat mengambil analitik sendiri
    public function test_01_authenticated_member_can_fetch_own_analytics(): void
    {
        Sanctum::actingAs($this->member1);

        $res = $this->getJson('/api/member/performance');
        $res->assertStatus(200)
            ->assertJsonStructure([
                'period',
                'start_date',
                'end_date',
                'timezone',
                'summary' => [
                    'total_tasks',
                    'completed_tasks',
                    'active_tasks',
                    'in_review_tasks',
                    'on_time_count',
                    'late_count',
                    'without_deadline_count',
                    'on_time_percentage',
                    'overdue_active_count',
                    'completion_rate',
                    'total_checklists',
                    'completed_checklists',
                    'checklist_completion_rate',
                ],
                'task_completion',
                'status_distribution',
                'priority_distribution',
                'deadline_performance',
                'productivity_analytics',
                'consistency',
                'personal_insights',
                'meta' => [
                    'generated_at',
                    'member_id',
                    'member_name',
                ],
            ]);

        $this->assertEquals($this->member1->id, $res->json('meta.member_id'));
    }

    // 2. User tanpa autentikasi mendapat 401
    public function test_02_unauthenticated_request_returns_401(): void
    {
        $res = $this->getJson('/api/member/performance');
        $res->assertStatus(401);
    }

    // 3. Member tidak dapat melihat data tugas Member lain
    public function test_03_member_cannot_see_other_member_tasks(): void
    {
        $this->createTask([
            'assignee_id'  => $this->member2->id,
            'title'        => 'Tugas Rahasia Member 2',
            'status'       => 'todo',
            'is_completed' => false,
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/performance');

        $res->assertStatus(200);
        $this->assertEquals(0, $res->json('summary.total_tasks'));
    }

    // 4. Data analitik hanya menghitung tugas milik Member terkait
    public function test_04_analytics_only_counts_authenticated_member_tasks(): void
    {
        // 2 tugas untuk member 1
        $this->createTask([
            'assignee_id'  => $this->member1->id,
            'status'       => 'in_progress',
            'is_completed' => false,
        ]);
        $this->createTask([
            'assignee_id'  => $this->member1->id,
            'status'       => 'done',
            'is_completed' => true,
        ]);

        // 3 tugas untuk member 2
        for ($i = 0; $i < 3; $i++) {
            $this->createTask([
                'assignee_id'  => $this->member2->id,
                'status'       => 'done',
                'is_completed' => true,
            ]);
        }

        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/performance');

        $res->assertStatus(200);
        $this->assertEquals(2, $res->json('summary.total_tasks'));
        $this->assertEquals(1, $res->json('summary.completed_tasks'));
        $this->assertEquals(1, $res->json('summary.active_tasks'));
    }

    // 5. Completed tasks hanya menghitung status yang benar-benar selesai
    public function test_05_completed_tasks_only_counts_completed_status(): void
    {
        $this->createTask([
            'assignee_id'  => $this->member1->id,
            'status'       => 'done',
            'is_completed' => true,
        ]);
        $this->createTask([
            'assignee_id'  => $this->member1->id,
            'status'       => 'completed',
            'is_completed' => true,
        ]);
        $this->createTask([
            'assignee_id'  => $this->member1->id,
            'status'       => 'in_progress',
            'is_completed' => false,
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/performance');

        $this->assertEquals(2, $res->json('summary.completed_tasks'));
    }

    // 6. In-review tidak dihitung sebagai completed
    public function test_06_in_review_is_not_counted_as_completed(): void
    {
        $this->createTask([
            'assignee_id'  => $this->member1->id,
            'status'       => 'in_review',
            'is_completed' => false,
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/performance');

        $this->assertEquals(0, $res->json('summary.completed_tasks'));
        $this->assertEquals(1, $res->json('summary.in_review_tasks'));
    }

    // 7. On-time completion dihitung dengan benar
    public function test_07_on_time_completion_calculated_correctly(): void
    {
        $now = Carbon::now('Asia/Jakarta');
        $task = $this->createTask([
            'assignee_id'  => $this->member1->id,
            'status'       => 'done',
            'is_completed' => true,
            'deadline'     => $now->copy()->addDays(2)->toDateString(),
        ]);

        // Catat review approved pada hari ini (sebelum deadline)
        TaskReview::create([
            'task_id'      => $task->id,
            'user_id'      => $this->pm->id,
            'action'       => 'approved',
            'from_status'  => 'in_review',
            'to_status'    => 'done',
            'notes'        => 'Bagus',
            'review_cycle' => 1,
            'created_at'   => $now,
            'updated_at'   => $now,
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/performance');

        $this->assertEquals(1, $res->json('summary.on_time_count'));
        $this->assertEquals(0, $res->json('summary.late_count'));
        $this->assertEquals(100.0, $res->json('summary.on_time_percentage'));
    }

    // 8. Late completion dihitung dengan benar
    public function test_08_late_completion_calculated_correctly(): void
    {
        $now = Carbon::now('Asia/Jakarta');
        $task = $this->createTask([
            'assignee_id'  => $this->member1->id,
            'status'       => 'done',
            'is_completed' => true,
            'deadline'     => $now->copy()->subDays(3)->toDateString(),
        ]);

        // Catat review approved hari ini (setelah deadline yang sudah lewat 3 hari lalu)
        TaskReview::create([
            'task_id'      => $task->id,
            'user_id'      => $this->pm->id,
            'action'       => 'approved',
            'from_status'  => 'in_review',
            'to_status'    => 'done',
            'notes'        => 'Terlambat tapi selesai',
            'review_cycle' => 1,
            'created_at'   => $now,
            'updated_at'   => $now,
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/performance');

        $this->assertEquals(0, $res->json('summary.on_time_count'));
        $this->assertEquals(1, $res->json('summary.late_count'));
        $this->assertEquals(0.0, $res->json('summary.on_time_percentage'));
    }

    // 9. Overdue aktif tidak memasukkan tugas done
    public function test_09_overdue_active_does_not_include_done_tasks(): void
    {
        $now = Carbon::now('Asia/Jakarta');

        // Tugas 1: Selesai tapi deadline lewat -> late completion, BUKAN active overdue
        $this->createTask([
            'assignee_id'  => $this->member1->id,
            'status'       => 'done',
            'is_completed' => true,
            'deadline'     => $now->copy()->subDays(5)->toDateString(),
        ]);

        // Tugas 2: Masih in_progress dan deadline lewat -> ACTIVE OVERDUE
        $this->createTask([
            'assignee_id'  => $this->member1->id,
            'status'       => 'in_progress',
            'is_completed' => false,
            'deadline'     => $now->copy()->subDays(2)->toDateString(),
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/performance');

        $this->assertEquals(1, $res->json('summary.overdue_active_count'));
    }

    // 10. Task tanpa deadline tidak masuk perhitungan on-time
    public function test_10_task_without_deadline_excluded_from_on_time(): void
    {
        $this->createTask([
            'assignee_id'  => $this->member1->id,
            'status'       => 'done',
            'is_completed' => true,
            'deadline'     => null,
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/performance');

        $this->assertEquals(1, $res->json('summary.without_deadline_count'));
        $this->assertEquals(0, $res->json('summary.on_time_count'));
        $this->assertEquals(0, $res->json('summary.late_count'));
        $this->assertEquals(0.0, $res->json('summary.on_time_percentage'));
    }

    // 11. Completion rate benar
    public function test_11_completion_rate_calculated_properly(): void
    {
        // 3 selesai, 1 aktif -> 75%
        for ($i = 0; $i < 3; $i++) {
            $this->createTask([
                'assignee_id'  => $this->member1->id,
                'status'       => 'done',
                'is_completed' => true,
            ]);
        }
        $this->createTask([
            'assignee_id'  => $this->member1->id,
            'status'       => 'in_progress',
            'is_completed' => false,
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/performance');

        $this->assertEquals(75.0, $res->json('summary.completion_rate'));
    }

    // 12. Pembagi nol ditangani dengan aman
    public function test_12_division_by_zero_handled_safely(): void
    {
        // Member tanpa tugas sama sekali
        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/performance');

        $res->assertStatus(200);
        $this->assertEquals(0, $res->json('summary.total_tasks'));
        $this->assertEquals(0.0, $res->json('summary.completion_rate'));
        $this->assertEquals(0.0, $res->json('summary.on_time_percentage'));
        $this->assertEquals(0.0, $res->json('summary.checklist_completion_rate'));
    }

    // 13. Distribusi status benar
    public function test_13_status_distribution_returns_exact_breakdown(): void
    {
        $this->createTask([
            'assignee_id'  => $this->member1->id,
            'status'       => 'todo',
            'is_completed' => false,
        ]);
        $this->createTask([
            'assignee_id'  => $this->member1->id,
            'status'       => 'in_progress',
            'is_completed' => false,
        ]);
        $this->createTask([
            'assignee_id'  => $this->member1->id,
            'status'       => 'in_review',
            'is_completed' => false,
        ]);
        $this->createTask([
            'assignee_id'  => $this->member1->id,
            'status'       => 'done',
            'is_completed' => true,
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/performance');

        $dist = collect($res->json('status_distribution'))->keyBy('status');
        $this->assertEquals(1, $dist['todo']['count']);
        $this->assertEquals(1, $dist['in_progress']['count']);
        $this->assertEquals(1, $dist['in_review']['count']);
        $this->assertEquals(1, $dist['done']['count']);
    }

    // 14. Distribusi prioritas benar
    public function test_14_priority_distribution_returns_exact_breakdown(): void
    {
        $this->createTask([
            'assignee_id'  => $this->member1->id,
            'priority'     => 'urgent',
        ]);
        $this->createTask([
            'assignee_id'  => $this->member1->id,
            'priority'     => 'high',
        ]);
        $this->createTask([
            'assignee_id'  => $this->member1->id,
            'priority'     => 'medium',
        ]);
        $this->createTask([
            'assignee_id'  => $this->member1->id,
            'priority'     => 'low',
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/performance');

        $dist = collect($res->json('priority_distribution'))->keyBy('priority');
        $this->assertEquals(1, $dist['urgent']['count']);
        $this->assertEquals(1, $dist['high']['count']);
        $this->assertEquals(1, $dist['medium']['count']);
        $this->assertEquals(1, $dist['low']['count']);
    }

    // 15. Filter periode bekerja
    public function test_15_period_filter_filters_tasks_accurately(): void
    {
        $now = Carbon::now('Asia/Jakarta');

        // Tugas dalam 7 hari terakhir
        $task1 = $this->createTask([
            'assignee_id' => $this->member1->id,
        ]);
        \Illuminate\Support\Facades\DB::table('tasks')->where('id', $task1->id)->update([
            'created_at' => $now->copy()->subDays(2)->toDateTimeString(),
        ]);

        // Tugas 20 hari lalu (masuk 30d, tidak masuk 7d)
        $task2 = $this->createTask([
            'assignee_id' => $this->member1->id,
        ]);
        \Illuminate\Support\Facades\DB::table('tasks')->where('id', $task2->id)->update([
            'created_at' => $now->copy()->subDays(20)->toDateTimeString(),
        ]);

        Sanctum::actingAs($this->member1);

        $res7d = $this->getJson('/api/member/performance?period=7d');
        $this->assertEquals(1, $res7d->json('summary.total_tasks'));

        $res30d = $this->getJson('/api/member/performance?period=30d');
        $this->assertEquals(2, $res30d->json('summary.total_tasks'));
    }

    // 16. Filter tanggal custom tervalidasi
    public function test_16_custom_date_range_is_validated(): void
    {
        Sanctum::actingAs($this->member1);

        // Tanpa start_date / end_date
        $resInvalid = $this->getJson('/api/member/performance?period=custom');
        $resInvalid->assertStatus(422);

        // end_date sebelum start_date
        $resBackward = $this->getJson('/api/member/performance?period=custom&start_date=2026-11-20&end_date=2026-11-10');
        $resBackward->assertStatus(422);

        // Rentang valid
        $resValid = $this->getJson('/api/member/performance?period=custom&start_date=2026-11-01&end_date=2026-11-20');
        $resValid->assertStatus(200);
        $this->assertEquals('2026-11-01', $resValid->json('start_date'));
        $this->assertEquals('2026-11-20', $resValid->json('end_date'));
    }

    // 17. Zona waktu Asia/Jakarta diterapkan
    public function test_17_asia_jakarta_timezone_is_applied(): void
    {
        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/performance');

        $res->assertStatus(200);
        $this->assertEquals('Asia/Jakarta', $res->json('timezone'));
    }

    // 18. Data kosong tidak menyebabkan error
    public function test_18_empty_dataset_returns_clean_zeroed_structure(): void
    {
        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/performance?period=7d');

        $res->assertStatus(200);
        $this->assertEquals(0, $res->json('summary.total_tasks'));
        $this->assertEquals([], $res->json('consistency.activities'));
        $this->assertNotEmpty($res->json('personal_insights'));
    }

    // 19. Aktivitas berasal dari histori aktual (TaskUpdate & TaskReview)
    public function test_19_activity_history_reflects_actual_database_records(): void
    {
        $task = $this->createTask([
            'assignee_id'  => $this->member1->id,
            'title'        => 'Pengujian Autentikasi',
        ]);

        TaskUpdate::create([
            'task_id'              => $task->id,
            'user_id'              => $this->member1->id,
            'work_description'     => 'Menyelesaikan modul form login',
            'progress_snapshot'    => 50,
            'completed_checklists' => 2,
            'total_checklists'     => 4,
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/performance');

        $this->assertEquals(1, $res->json('productivity_analytics.total_updates'));
        $this->assertCount(1, $res->json('consistency.activities'));
        $this->assertEquals('Menyelesaikan modul form login', $res->json('consistency.activities.0.description'));
    }

    // 20. Role non-member tidak dapat mengakses endpoint khusus Member
    public function test_20_non_member_roles_forbidden_from_accessing_member_performance(): void
    {
        // Admin
        Sanctum::actingAs($this->admin);
        $this->getJson('/api/member/performance')->assertStatus(403);

        // Pimpinan
        Sanctum::actingAs($this->pimpinan);
        $this->getJson('/api/member/performance')->assertStatus(403);

        // Project Manager
        Sanctum::actingAs($this->pm);
        $this->getJson('/api/member/performance')->assertStatus(403);
    }
}
