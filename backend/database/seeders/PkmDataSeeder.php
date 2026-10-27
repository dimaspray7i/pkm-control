<?php

namespace Database\Seeders;

use App\Models\Activity;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class PkmDataSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Update/Ensure User Budi Santoso (Super Admin)
        $admin = User::firstOrNew(['email' => 'admin@pkm.co.id']);
        $admin->name = 'Budi Santoso';
        $admin->password = Hash::make('admin123');
        $admin->role = 'admin';
        $admin->phone = '081234567890';
        $admin->is_active = true;
        $admin->save();

        // 2. Clear previous projects, tasks, activities to ensure consistent state
        Task::query()->delete();
        Project::query()->delete();
        Activity::query()->delete();

        // 3. Seed Featured Projects (Matching Reference UI)
        $p1 = Project::create([
            'code' => 'PKM-001',
            'name' => 'Website Klien A',
            'client' => 'PT. Global Solusi',
            'progress' => 75,
            'target_progress' => 80,
            'status' => 'on_track',
            'risk_level' => 'low',
            'risk_factor' => 'Perkembangan sesuai timeline sprint',
            'deadline' => Carbon::now()->addDays(25),
            'category' => 'web',
            'is_active' => true,
        ]);

        $p2 = Project::create([
            'code' => 'PKM-002',
            'name' => 'Sistem Internal',
            'client' => 'PT. Maju Bersama',
            'progress' => 40,
            'target_progress' => 60,
            'status' => 'at_risk',
            'risk_level' => 'high',
            'risk_factor' => 'Menunggu feedback client',
            'deadline' => Carbon::now()->addDays(5),
            'category' => 'system',
            'is_active' => true,
        ]);

        $p3 = Project::create([
            'code' => 'PKM-003',
            'name' => 'Aplikasi Mobile',
            'client' => 'PT. Digital Nusantara',
            'progress' => 55,
            'target_progress' => 80,
            'status' => 'at_risk',
            'risk_level' => 'medium',
            'risk_factor' => 'Bug pada fitur login',
            'deadline' => Carbon::now()->addDays(11),
            'category' => 'mobile',
            'is_active' => true,
        ]);

        $p4 = Project::create([
            'code' => 'PKM-004',
            'name' => 'Website Klien B',
            'client' => 'CV. Kreatif Media',
            'progress' => 30,
            'target_progress' => 50,
            'status' => 'delayed',
            'risk_level' => 'medium',
            'risk_factor' => 'Kekurangan resource tim',
            'deadline' => Carbon::now()->addDays(16),
            'category' => 'web',
            'is_active' => true,
        ]);

        // Proyek aktif lainnya sehingga total aktif = 12 (4 di atas + 8 di bawah)
        $otherActive = [
            ['code' => 'PKM-005', 'name' => 'E-Commerce Retail', 'client' => 'PT. Sentosa Jaya', 'progress' => 85, 'status' => 'on_track', 'risk_level' => 'low'],
            ['code' => 'PKM-006', 'name' => 'Portal Layanan Publik', 'client' => 'Dinas Kominfo', 'progress' => 65, 'status' => 'on_track', 'risk_level' => 'low'],
            ['code' => 'PKM-007', 'name' => 'Dashboard Logistik', 'client' => 'PT. Ekspedisi Cepat', 'progress' => 50, 'status' => 'at_risk', 'risk_level' => 'medium'],
            ['code' => 'PKM-008', 'name' => 'Integrasi Payment Gateway', 'client' => 'Fintech Indo', 'progress' => 70, 'status' => 'on_track', 'risk_level' => 'low'],
            ['code' => 'PKM-009', 'name' => 'CRM Kemitraan', 'client' => 'CV. Mitra Prima', 'progress' => 45, 'status' => 'on_track', 'risk_level' => 'low'],
            ['code' => 'PKM-010', 'name' => 'Sistem Presensi Geolocation', 'client' => 'PT. Mega Solusi', 'progress' => 80, 'status' => 'on_track', 'risk_level' => 'low'],
            ['code' => 'PKM-011', 'name' => 'Redesign Landing Page', 'client' => 'Studio Digital', 'progress' => 90, 'status' => 'on_track', 'risk_level' => 'low'],
            ['code' => 'PKM-012', 'name' => 'API Inventory Sync', 'client' => 'PT. Gudang Modern', 'progress' => 60, 'status' => 'on_track', 'risk_level' => 'low'],
        ];

        foreach ($otherActive as $proj) {
            Project::create([
                'code' => $proj['code'],
                'name' => $proj['name'],
                'client' => $proj['client'],
                'progress' => $proj['progress'],
                'target_progress' => $proj['progress'] + 10,
                'status' => $proj['status'],
                'risk_level' => $proj['risk_level'],
                'deadline' => Carbon::now()->addDays(30),
                'category' => 'web',
                'is_active' => true,
            ]);
        }

        // 8 Proyek Selesai (sehingga Proyek Selesai = 8)
        for ($i = 1; $i <= 8; $i++) {
            Project::create([
                'code' => sprintf('PKM-ARCH-%02d', $i),
                'name' => 'Proyek Selesai ' . $i,
                'client' => 'Klien Mitra ' . chr(64 + $i),
                'progress' => 100,
                'target_progress' => 100,
                'status' => 'completed',
                'risk_level' => 'none',
                'deadline' => Carbon::now()->subDays(10 * $i),
                'category' => 'web',
                'is_active' => false,
            ]);
        }

        // 4. Seed Priority Tasks (Matching Reference UI)
        Task::create([
            'project_id' => $p1->id,
            'title' => 'Review UI/UX landing page',
            'priority' => 'high',
            'status' => 'pending',
            'is_completed' => false,
            'deadline' => Carbon::now()->addDay(),
            'assignee_name' => 'Andi Pratama',
        ]);

        Task::create([
            'project_id' => $p3->id,
            'title' => 'Fix bug login mobile',
            'priority' => 'high',
            'status' => 'pending',
            'is_completed' => false,
            'deadline' => Carbon::now()->addDays(2),
            'assignee_name' => 'Rizky Maulana',
        ]);

        Task::create([
            'project_id' => $p2->id,
            'title' => 'Update laporan mingguan',
            'priority' => 'medium',
            'status' => 'pending',
            'is_completed' => false,
            'deadline' => Carbon::now()->addDays(2),
            'assignee_name' => 'Siti Rahma',
        ]);

        Task::create([
            'project_id' => $p4->id,
            'title' => 'Meeting dengan klien',
            'priority' => 'low',
            'status' => 'pending',
            'is_completed' => false,
            'deadline' => Carbon::now()->addDays(3),
            'assignee_name' => 'Budi Santoso',
        ]);

        Task::create([
            'project_id' => $p3->id,
            'title' => 'Testing fitur pembayaran',
            'priority' => 'low',
            'status' => 'pending',
            'is_completed' => false,
            'deadline' => Carbon::now()->addDays(4),
            'assignee_name' => 'Dewi Lestari',
        ]);

        // Tambah 6 tugas yang lewat deadline (overdue)
        for ($i = 1; $i <= 6; $i++) {
            Task::create([
                'project_id' => ($i % 2 == 0) ? $p2->id : $p4->id,
                'title' => 'Tugas Tertunda ' . $i . ' (Deadline Terlewati)',
                'priority' => 'high',
                'status' => 'pending',
                'is_completed' => false,
                'deadline' => Carbon::now()->subDays($i + 1),
                'assignee_name' => 'Tim Teknis',
            ]);
        }

        // Tambah sisa tugas pending agar total Tugas Belum Selesai = 47 (5 + 6 + 36)
        for ($i = 1; $i <= 36; $i++) {
            Task::create([
                'project_id' => $p1->id,
                'title' => 'Item Pekerjaan Modul ' . $i,
                'priority' => ($i % 3 == 0) ? 'high' : (($i % 2 == 0) ? 'medium' : 'low'),
                'status' => 'pending',
                'is_completed' => false,
                'deadline' => Carbon::now()->addDays($i + 5),
                'assignee_name' => 'Staff ' . ($i % 5 + 1),
            ]);
        }

        // 5. Seed Recent Activities (Matching Reference UI)
        $activities = [
            [
                'user_name' => 'Andi Pratama',
                'action' => 'menyelesaikan tugas "Implementasi API"',
                'target_name' => 'Implementasi API',
                'project_name' => 'Website Klien A',
                'avatar_color' => 'pink',
                'created_at' => Carbon::now()->subMinutes(2),
            ],
            [
                'user_name' => 'Siti Rahma',
                'action' => 'menambahkan komentar di proyek',
                'target_name' => 'Komentar Desain',
                'project_name' => 'Sistem Internal',
                'avatar_color' => 'purple',
                'created_at' => Carbon::now()->subMinutes(15),
            ],
            [
                'user_name' => 'Budi Santoso',
                'action' => 'membuat proyek baru "Aplikasi Mobile"',
                'target_name' => 'Aplikasi Mobile',
                'project_name' => null,
                'avatar_color' => 'yellow',
                'created_at' => Carbon::now()->subHour(),
            ],
            [
                'user_name' => 'Rizky Maulana',
                'action' => 'mengubah status tugas menjadi In Progress',
                'target_name' => 'Setup SQLite',
                'project_name' => 'Aplikasi Mobile',
                'avatar_color' => 'pink',
                'created_at' => Carbon::now()->subHours(2),
            ],
            [
                'user_name' => 'Dewi Lestari',
                'action' => 'mengunggah file desain UI',
                'target_name' => 'Mockup Landing Page',
                'project_name' => 'Website Klien B',
                'avatar_color' => 'purple',
                'created_at' => Carbon::now()->subHours(3),
            ],
        ];

        foreach ($activities as $act) {
            Activity::create($act);
        }
    }
}
