<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskChecklist;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Tahap M-B: Member Notification & Communication Center Feature Tests
 *
 * Verifikasi menyeluruh terhadap 20 skenario pengetesan:
 * 1. Member hanya melihat notifikasinya sendiri.
 * 2. Member tidak bisa membaca notifikasi milik Member lain.
 * 3. Member tidak bisa menandai notifikasi milik orang lain.
 * 4. Member tidak bisa menghapus notifikasi milik orang lain.
 * 5. Endpoint membutuhkan autentikasi (401).
 * 6. Notifikasi tugas baru terkirim kepada assignee yang benar.
 * 7. Notifikasi persetujuan PM terkirim kepada Member terkait.
 * 8. Notifikasi revisi PM terkirim kepada Member terkait.
 * 9. Notifikasi reopen terkirim kepada Member terkait.
 * 10. Notifikasi tidak terduplikasi ketika event diproses ulang.
 * 11. Read dan unread bekerja dengan benar.
 * 12. Read-all hanya memengaruhi notifikasi milik sendiri.
 * 13. Pagination berjalan dengan benar.
 * 14. Filter kategori bekerja (task, deadline, approval, revision).
 * 15. Deadline reminder mengikuti zona waktu Asia/Jakarta.
 * 16. Task done tidak menerima overdue reminder.
 * 17. Task in_review mengikuti kebijakan deadline reminder.
 * 18. Member tidak dapat meningkatkan hak akses melalui endpoint notifikasi.
 * 19. Role lain (PM / Admin) tidak dapat menggunakan endpoint khusus Member (403).
 * 20. Notifikasi tanpa referensi tugas tetap dapat ditampilkan dengan aman.
 */
class MemberNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $pm;
    protected User $member1;
    protected User $member2;

    protected Project $project;
    protected Milestone $milestone;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'name'      => 'Admin PKM',
            'email'     => 'admin@pkm.test',
            'password'  => Hash::make('password'),
            'role'      => 'admin',
            'is_active' => true,
        ]);

        $this->pm = User::create([
            'name'      => 'PM Budi',
            'email'     => 'pm@pkm.test',
            'password'  => Hash::make('password'),
            'role'      => 'project_manager',
            'is_active' => true,
        ]);

        $this->member1 = User::create([
            'name'      => 'Member 1',
            'email'     => 'member1@pkm.test',
            'password'  => Hash::make('password'),
            'role'      => 'member',
            'is_active' => true,
        ]);

        $this->member2 = User::create([
            'name'      => 'Member 2',
            'email'     => 'member2@pkm.test',
            'password'  => Hash::make('password'),
            'role'      => 'member',
            'is_active' => true,
        ]);

        $this->project = Project::create([
            'code'      => 'PRJ-NOTIF',
            'name'      => 'Proyek Notifikasi Test',
            'client'    => 'PT Klien Test',
            'category'  => 'web',
            'pic_id'    => $this->pm->id,
            'pic_name'  => $this->pm->name,
            'progress'  => 0,
            'is_active' => true,
        ]);

        $this->milestone = Milestone::create([
            'project_id'  => $this->project->id,
            'title'       => 'Sprint Notif',
            'phase_order' => 1,
            'status'      => 'in_progress',
        ]);
    }

    // 1. Member hanya melihat notifikasinya sendiri
    public function test_01_member_only_sees_own_notifications(): void
    {
        UserNotification::create([
            'user_id' => $this->member1->id,
            'type'    => 'task_assigned',
            'title'   => 'Notif Member 1',
            'message' => 'Pesan 1',
        ]);

        UserNotification::create([
            'user_id' => $this->member2->id,
            'type'    => 'task_assigned',
            'title'   => 'Notif Member 2',
            'message' => 'Pesan 2',
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/notifications');
        $res->assertStatus(200);

        $titles = collect($res->json('notifications'))->pluck('title');
        $this->assertContains('Notif Member 1', $titles);
        $this->assertNotContains('Notif Member 2', $titles);
    }

    // 2. Member tidak bisa membaca notifikasi milik Member lain
    public function test_02_member_cannot_read_other_member_notifications(): void
    {
        $notifMember2 = UserNotification::create([
            'user_id' => $this->member2->id,
            'type'    => 'task_assigned',
            'title'   => 'Notif Member 2',
            'message' => 'Pesan 2',
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->patchJson("/api/member/notifications/{$notifMember2->id}/read");
        $res->assertStatus(404); // Scoped per user_id, not found for member1
    }

    // 3. Member tidak bisa menandai notifikasi milik orang lain
    public function test_03_member_cannot_mark_other_member_notification(): void
    {
        $notifMember2 = UserNotification::create([
            'user_id' => $this->member2->id,
            'type'    => 'task_assigned',
            'title'   => 'Notif Member 2',
            'message' => 'Pesan 2',
            'is_read' => true,
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->patchJson("/api/member/notifications/{$notifMember2->id}/unread");
        $res->assertStatus(404);
    }

    // 4. Member tidak bisa menghapus notifikasi milik orang lain
    public function test_04_member_cannot_delete_other_member_notification(): void
    {
        $notifMember2 = UserNotification::create([
            'user_id' => $this->member2->id,
            'type'    => 'task_assigned',
            'title'   => 'Notif Member 2',
            'message' => 'Pesan 2',
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->deleteJson("/api/member/notifications/{$notifMember2->id}");
        $res->assertStatus(404);
        $this->assertDatabaseHas('user_notifications', ['id' => $notifMember2->id]);
    }

    // 5. Endpoint membutuhkan autentikasi
    public function test_05_unauthenticated_request_returns_401(): void
    {
        $this->getJson('/api/member/notifications')->assertStatus(401);
        $this->getJson('/api/member/notifications/summary')->assertStatus(401);
        $this->postJson('/api/member/notifications/read-all')->assertStatus(401);
    }

    // 6. Notifikasi tugas baru terkirim kepada assignee yang benar
    public function test_06_new_task_assignment_sends_notification_to_assignee(): void
    {
        Sanctum::actingAs($this->pm);

        $res = $this->postJson('/api/tasks', [
            'project_id'   => $this->project->id,
            'title'        => 'Buat Modul Auth',
            'description'  => 'Instruksi PM',
            'priority'     => 'urgent',
            'deadline'     => Carbon::now()->addDays(5)->toDateString(),
            'assignee_id'  => $this->member1->id,
            'checklists'   => [
                ['title' => 'Subtask 1'],
                ['title' => 'Subtask 2'],
            ],
        ]);

        $res->assertStatus(201);
        $taskId = $res->json('task.id');

        $this->assertDatabaseHas('user_notifications', [
            'user_id' => $this->member1->id,
            'task_id' => $taskId,
            'type'    => 'task_assigned',
        ]);

        // Member 2 tidak boleh menerima notifikasi ini
        $this->assertDatabaseMissing('user_notifications', [
            'user_id' => $this->member2->id,
            'task_id' => $taskId,
        ]);
    }

    // 7. Notifikasi persetujuan PM terkirim kepada Member terkait
    public function test_07_pm_approval_triggers_notification_to_member(): void
    {
        $task = Task::create([
            'project_id'   => $this->project->id,
            'title'        => 'Tugas Selesai Menunggu Approval',
            'status'       => 'in_review',
            'is_completed' => false,
            'priority'     => 'high',
            'deadline'     => Carbon::now()->addDays(3)->toDateString(),
            'assignee_id'  => $this->member1->id,
            'creator_id'   => $this->pm->id,
        ]);

        TaskChecklist::create([
            'task_id'      => $task->id,
            'title'        => 'Item 1',
            'is_completed' => true,
            'position'     => 1,
        ]);

        Sanctum::actingAs($this->pm);
        $res = $this->postJson("/api/tasks/{$task->id}/approve", [
            'notes' => 'Pekerjaan sangat rapi!',
        ]);

        $res->assertStatus(200);

        $this->assertDatabaseHas('user_notifications', [
            'user_id' => $this->member1->id,
            'task_id' => $task->id,
            'type'    => 'review_approved',
        ]);
    }

    // 8. Notifikasi revisi PM terkirim kepada Member terkait
    public function test_08_pm_revision_triggers_notification_to_member(): void
    {
        $task = Task::create([
            'project_id'   => $this->project->id,
            'title'        => 'Tugas Butuh Revisi',
            'status'       => 'in_review',
            'is_completed' => false,
            'priority'     => 'high',
            'deadline'     => Carbon::now()->addDays(2)->toDateString(),
            'assignee_id'  => $this->member1->id,
            'creator_id'   => $this->pm->id,
        ]);

        Sanctum::actingAs($this->pm);
        $res = $this->postJson("/api/tasks/{$task->id}/request-revision", [
            'reason' => 'Perbaiki validasi email dan styling tombol.',
        ]);

        $res->assertStatus(200);

        $this->assertDatabaseHas('user_notifications', [
            'user_id' => $this->member1->id,
            'task_id' => $task->id,
            'type'    => 'review_revision',
        ]);
    }

    // 9. Notifikasi reopen terkirim kepada Member terkait
    public function test_09_pm_reopen_triggers_notification_to_member(): void
    {
        $task = Task::create([
            'project_id'   => $this->project->id,
            'title'        => 'Tugas Reopen',
            'status'       => 'done',
            'is_completed' => true,
            'priority'     => 'high',
            'deadline'     => Carbon::now()->addDays(2)->toDateString(),
            'assignee_id'  => $this->member1->id,
            'creator_id'   => $this->pm->id,
        ]);

        Sanctum::actingAs($this->pm);
        $res = $this->postJson("/api/tasks/{$task->id}/reopen", [
            'reason' => 'Ditemukan bug pada modul pembayaran.',
        ]);

        $res->assertStatus(200);

        $this->assertDatabaseHas('user_notifications', [
            'user_id' => $this->member1->id,
            'task_id' => $task->id,
            'type'    => 'task_reopened',
        ]);
    }

    // 10. Notifikasi tidak terduplikasi ketika event diproses ulang
    public function test_10_notifications_are_not_duplicated_on_repeated_trigger(): void
    {
        $task = Task::create([
            'project_id'   => $this->project->id,
            'title'        => 'Tugas Duplicate Check',
            'status'       => 'todo',
            'is_completed' => false,
            'priority'     => 'medium',
            'deadline'     => Carbon::now()->addDays(4)->toDateString(),
            'assignee_id'  => $this->member1->id,
            'creator_id'   => $this->pm->id,
        ]);

        NotificationService::notifyTaskAssigned($task, $this->pm);
        NotificationService::notifyTaskAssigned($task, $this->pm); // Panggil ulang

        $count = UserNotification::where('user_id', $this->member1->id)
            ->where('task_id', $task->id)
            ->where('type', 'task_assigned')
            ->count();

        $this->assertEquals(1, $count);
    }

    // 11. Read dan unread bekerja dengan benar
    public function test_11_mark_as_read_and_unread_works(): void
    {
        $notif = UserNotification::create([
            'user_id' => $this->member1->id,
            'type'    => 'task_assigned',
            'title'   => 'Test Read',
            'message' => 'Pesan',
            'is_read' => false,
        ]);

        Sanctum::actingAs($this->member1);

        // Mark as read
        $res = $this->patchJson("/api/member/notifications/{$notif->id}/read");
        $res->assertStatus(200);
        $notif->refresh();
        $this->assertTrue($notif->is_read);
        $this->assertNotNull($notif->read_at);

        // Mark as unread
        $res2 = $this->patchJson("/api/member/notifications/{$notif->id}/unread");
        $res2->assertStatus(200);
        $notif->refresh();
        $this->assertFalse($notif->is_read);
        $this->assertNull($notif->read_at);
    }

    // 12. Read-all hanya memengaruhi notifikasi milik sendiri
    public function test_12_read_all_only_affects_own_notifications(): void
    {
        $notif1 = UserNotification::create([
            'user_id' => $this->member1->id,
            'type'    => 'task_assigned',
            'title'   => 'N1',
            'message' => 'P1',
            'is_read' => false,
        ]);

        $notif2 = UserNotification::create([
            'user_id' => $this->member2->id,
            'type'    => 'task_assigned',
            'title'   => 'N2',
            'message' => 'P2',
            'is_read' => false,
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->postJson('/api/member/notifications/read-all');
        $res->assertStatus(200);

        $notif1->refresh();
        $notif2->refresh();

        $this->assertTrue($notif1->is_read);
        $this->assertFalse($notif2->is_read); // Milik member 2 tetap unread
    }

    // 13. Pagination berjalan
    public function test_13_pagination_works_properly(): void
    {
        for ($i = 1; $i <= 12; $i++) {
            UserNotification::create([
                'user_id' => $this->member1->id,
                'type'    => 'task_assigned',
                'title'   => "Notif {$i}",
                'message' => "Pesan {$i}",
                'is_read' => false,
            ]);
        }

        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/notifications?per_page=5&page=1');
        $res->assertStatus(200);
        $this->assertCount(5, $res->json('notifications'));
        $this->assertEquals(12, $res->json('pagination.total'));
        $this->assertEquals(3, $res->json('pagination.last_page'));
    }

    // 14. Filter kategori bekerja
    public function test_14_category_filter_works(): void
    {
        UserNotification::create([
            'user_id' => $this->member1->id,
            'type'    => 'task_assigned',
            'title'   => 'Tugas',
            'message' => 'Msg',
        ]);

        UserNotification::create([
            'user_id' => $this->member1->id,
            'type'    => 'review_approved',
            'title'   => 'Persetujuan',
            'message' => 'Msg',
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/notifications?category=approval');
        $res->assertStatus(200);

        $types = collect($res->json('notifications'))->pluck('type')->unique();
        $this->assertTrue($types->contains('review_approved'));
        $this->assertFalse($types->contains('task_assigned'));
    }

    // 15. Deadline reminder mengikuti zona waktu Asia/Jakarta
    public function test_15_deadline_reminder_follows_jakarta_timezone(): void
    {
        $todayJakarta = Carbon::now('Asia/Jakarta')->toDateString();

        $task = Task::create([
            'project_id'   => $this->project->id,
            'title'        => 'Tugas Deadline Hari Ini',
            'status'       => 'in_progress',
            'is_completed' => false,
            'priority'     => 'urgent',
            'deadline'     => $todayJakarta,
            'assignee_id'  => $this->member1->id,
            'creator_id'   => $this->pm->id,
        ]);

        NotificationService::syncDeadlineRemindersForUser($this->member1->id);

        $this->assertDatabaseHas('user_notifications', [
            'user_id' => $this->member1->id,
            'task_id' => $task->id,
            'type'    => 'deadline_today',
        ]);
    }

    // 16. Task done tidak menerima overdue reminder
    public function test_16_completed_tasks_do_not_receive_overdue_reminders(): void
    {
        $pastDate = Carbon::now('Asia/Jakarta')->subDays(5)->toDateString();

        $doneTask = Task::create([
            'project_id'   => $this->project->id,
            'title'        => 'Tugas Selesai Lampau',
            'status'       => 'completed',
            'is_completed' => true,
            'priority'     => 'medium',
            'deadline'     => $pastDate,
            'assignee_id'  => $this->member1->id,
            'creator_id'   => $this->pm->id,
        ]);

        NotificationService::syncDeadlineRemindersForUser($this->member1->id);

        $this->assertDatabaseMissing('user_notifications', [
            'user_id' => $this->member1->id,
            'task_id' => $doneTask->id,
            'type'    => 'deadline_overdue',
        ]);
    }

    // 17. Task in_review mengikuti kebijakan deadline reminder
    public function test_17_in_review_tasks_follow_deadline_policy(): void
    {
        $pastDate = Carbon::now('Asia/Jakarta')->subDays(2)->toDateString();

        $inReviewTask = Task::create([
            'project_id'   => $this->project->id,
            'title'        => 'Tugas In Review Lampau',
            'status'       => 'in_review',
            'is_completed' => false,
            'priority'     => 'high',
            'deadline'     => $pastDate,
            'assignee_id'  => $this->member1->id,
            'creator_id'   => $this->pm->id,
        ]);

        NotificationService::syncDeadlineRemindersForUser($this->member1->id);

        $this->assertDatabaseHas('user_notifications', [
            'user_id' => $this->member1->id,
            'task_id' => $inReviewTask->id,
            'type'    => 'deadline_overdue',
        ]);
    }

    // 18. Member tidak dapat meningkatkan hak akses melalui endpoint notifikasi
    public function test_18_member_cannot_escalate_role_via_notification_endpoints(): void
    {
        Sanctum::actingAs($this->member1);

        $res = $this->postJson('/api/member/notifications/read-all', [
            'role' => 'admin',
        ]);
        $res->assertStatus(200);

        $this->member1->refresh();
        $this->assertEquals('member', $this->member1->role);
    }

    // 19. Role lain (PM / Admin) tidak dapat menggunakan endpoint khusus Member
    public function test_19_non_member_roles_get_403_on_member_notifications(): void
    {
        Sanctum::actingAs($this->pm);
        $this->getJson('/api/member/notifications')->assertStatus(403);

        Sanctum::actingAs($this->admin);
        $this->getJson('/api/member/notifications')->assertStatus(403);
    }

    // 20. Notifikasi tanpa referensi tugas tetap dapat ditampilkan dengan aman
    public function test_20_notifications_without_task_render_safely(): void
    {
        UserNotification::create([
            'user_id' => $this->member1->id,
            'type'    => 'system_announcement',
            'title'   => 'Pengumuman Sistem',
            'message' => 'Server maintenance akhir pekan.',
            'task_id' => null,
            'project_id' => null,
        ]);

        Sanctum::actingAs($this->member1);
        $res = $this->getJson('/api/member/notifications');
        $res->assertStatus(200);

        $found = collect($res->json('notifications'))->firstWhere('title', 'Pengumuman Sistem');
        $this->assertNotNull($found);
        $this->assertNull($found['task_id']);
        $this->assertNull($found['task_title']);
    }
}
