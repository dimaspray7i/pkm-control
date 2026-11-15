<?php

namespace Database\Seeders;

use App\Models\Activity;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\ProjectReport;
use App\Models\Task;
use App\Models\TaskChecklist;
use App\Models\TaskReview;
use App\Models\TaskUpdate;
use App\Models\User;
use App\Models\UserPreference;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class PkmDataSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Pastikan seluruh User default terdaftar
        $this->call(AdminUserSeeder::class);

        $admin = User::where('role', 'admin')->first();
        $pimpinan = User::where('role', 'pimpinan')->first();
        $pm = User::where('email', 'pm@pkm.co.id')->first() ?? User::where('role', 'project_manager')->first();
        $pm1 = User::where('email', 'pm1@pkm.co.id')->first() ?? $pm;
        $pm2 = User::where('email', 'pm2@pkm.co.id')->first() ?? $pm;

        $members = User::where('role', 'member')->get();
        if ($members->isEmpty()) {
            $members = collect([$pm]);
        }
        $memberList = $members->values();

        // Pastikan setiap user memiliki UserPreference
        foreach (User::all() as $u) {
            UserPreference::firstOrCreate(
                ['user_id' => $u->id],
                [
                    'notify_task_assigned' => true,
                    'notify_task_status_changed' => true,
                    'notify_task_overdue' => true,
                    'notify_project_changed' => false,
                    'notify_system_activity' => false,
                ]
            );
        }

        // 2. Hubungkan Proyek yang ada dengan PIC (updateOrCreate / pertahankan data proyek yang sudah ada)
        $pmMap = [
            'PKM-001' => $pm,
            'PKM-002' => $pm,
            'PKM-003' => $pm,
            'PKM-004' => $pm1,
            'PKM-005' => $pm,
            'PKM-006' => $pm1,
            'PKM-007' => $pm,
            'PKM-008' => $pm1,
            'PKM-009' => $pm,
            'PKM-010' => $pm1,
            'PKM-011' => $pm,
            'PKM-012' => $pm1,
        ];

        // Definisikan master proyek aktif jika belum ada di database
        $featuredProjects = [
            [
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
            ],
            [
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
            ],
            [
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
            ],
            [
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
            ],
            ['code' => 'PKM-005', 'name' => 'E-Commerce Retail', 'client' => 'PT. Sentosa Jaya', 'progress' => 85, 'target_progress' => 90, 'status' => 'on_track', 'risk_level' => 'low', 'category' => 'web', 'deadline' => Carbon::now()->addDays(30), 'is_active' => true],
            ['code' => 'PKM-006', 'name' => 'Portal Layanan Publik', 'client' => 'Dinas Kominfo', 'progress' => 65, 'target_progress' => 75, 'status' => 'on_track', 'risk_level' => 'low', 'category' => 'web', 'deadline' => Carbon::now()->addDays(35), 'is_active' => true],
            ['code' => 'PKM-007', 'name' => 'Dashboard Logistik', 'client' => 'PT. Ekspedisi Cepat', 'progress' => 50, 'target_progress' => 65, 'status' => 'at_risk', 'risk_level' => 'medium', 'category' => 'system', 'deadline' => Carbon::now()->addDays(20), 'is_active' => true],
            ['code' => 'PKM-008', 'name' => 'Integrasi Payment Gateway', 'client' => 'Fintech Indo', 'progress' => 70, 'target_progress' => 75, 'status' => 'on_track', 'risk_level' => 'low', 'category' => 'web', 'deadline' => Carbon::now()->addDays(40), 'is_active' => true],
            ['code' => 'PKM-009', 'name' => 'CRM Kemitraan', 'client' => 'CV. Mitra Prima', 'progress' => 45, 'target_progress' => 60, 'status' => 'on_track', 'risk_level' => 'low', 'category' => 'system', 'deadline' => Carbon::now()->addDays(28), 'is_active' => true],
            ['code' => 'PKM-010', 'name' => 'Sistem Presensi Geolocation', 'client' => 'PT. Mega Solusi', 'progress' => 80, 'target_progress' => 85, 'status' => 'on_track', 'risk_level' => 'low', 'category' => 'mobile', 'deadline' => Carbon::now()->addDays(45), 'is_active' => true],
            ['code' => 'PKM-011', 'name' => 'Redesign Landing Page', 'client' => 'Studio Digital', 'progress' => 90, 'target_progress' => 95, 'status' => 'on_track', 'risk_level' => 'low', 'category' => 'web', 'deadline' => Carbon::now()->addDays(15), 'is_active' => true],
            ['code' => 'PKM-012', 'name' => 'API Inventory Sync', 'client' => 'PT. Gudang Modern', 'progress' => 60, 'target_progress' => 70, 'status' => 'on_track', 'risk_level' => 'low', 'category' => 'system', 'deadline' => Carbon::now()->addDays(22), 'is_active' => true],
        ];

        foreach ($featuredProjects as $projData) {
            $pic = $pmMap[$projData['code']] ?? $pm;
            $existing = Project::where('code', $projData['code'])->first();
            if ($existing) {
                if (empty($existing->pic_id)) {
                    $existing->pic_id = $pic->id;
                    $existing->pic_name = $pic->name;
                    $existing->save();
                }
            } else {
                $projData['pic_id'] = $pic->id;
                $projData['pic_name'] = $pic->name;
                Project::create($projData);
            }
        }

        // Proyek selesai arsip PKM-ARCH-01 s/d PKM-ARCH-08
        for ($i = 1; $i <= 8; $i++) {
            $archCode = sprintf('PKM-ARCH-%02d', $i);
            $existingArch = Project::where('code', $archCode)->first();
            if ($existingArch) {
                if (empty($existingArch->pic_id)) {
                    $existingArch->pic_id = $pm2->id;
                    $existingArch->pic_name = $pm2->name;
                    $existingArch->save();
                }
            } else {
                Project::create([
                    'code' => $archCode,
                    'name' => 'Proyek Selesai ' . $i,
                    'client' => 'Klien Mitra ' . chr(64 + $i),
                    'pic_id' => $pm2->id,
                    'pic_name' => $pm2->name,
                    'progress' => 100,
                    'target_progress' => 100,
                    'status' => 'completed',
                    'risk_level' => 'none',
                    'deadline' => Carbon::now()->subDays(10 * $i),
                    'category' => 'web',
                    'is_active' => false,
                ]);
            }
        }

        // Pastikan semua project yang ada memiliki pic_id
        Project::whereNull('pic_id')->update([
            'pic_id' => $pm->id,
            'pic_name' => $pm->name,
        ]);

        // 3. Pastikan Milestones tersedia pada setiap proyek aktif
        $activeProjects = Project::where('is_active', true)->get();
        foreach ($activeProjects as $project) {
            $existingCount = Milestone::where('project_id', $project->id)->count();
            if ($existingCount === 0) {
                $milestoneTemplates = [
                    ['title' => 'Tahap 1: Analisis Kebutuhan & Desain', 'phase_order' => 1, 'progress' => 100, 'status' => 'completed', 'days' => -10],
                    ['title' => 'Tahap 2: Pengembangan Fitur Inti', 'phase_order' => 2, 'progress' => 70, 'status' => 'in_progress', 'days' => 10],
                    ['title' => 'Tahap 3: Integrasi & UAT', 'phase_order' => 3, 'progress' => 20, 'status' => 'pending', 'days' => 20],
                    ['title' => 'Tahap 4: Deployment & Serah Terima', 'phase_order' => 4, 'progress' => 0, 'status' => 'pending', 'days' => 30],
                ];
                foreach ($milestoneTemplates as $tpl) {
                    Milestone::create([
                        'project_id' => $project->id,
                        'title' => $tpl['title'],
                        'description' => 'Milestone operasional untuk ' . $project->name,
                        'phase_order' => $tpl['phase_order'],
                        'progress' => $tpl['progress'],
                        'status' => $tpl['status'],
                        'start_date' => Carbon::now()->addDays($tpl['days'] - 15),
                        'due_date' => Carbon::now()->addDays($tpl['days']),
                    ]);
                }
            }
        }

        // 4. Seed Tasks secara Idempotent dan Realistis
        // Distribusikan tugas untuk proyek PKM-001 s/d PKM-004 ke para anggota
        $taskDefinitions = [
            // PKM-001 (Website Klien A) - Managed by PM Siti
            'PKM-001' => [
                [
                    'title' => 'Review UI/UX landing page',
                    'description' => 'Pemeriksaan kesesuaian palet warna, tipografi, dan responsivitas desain pada breakpoints desktop dan mobile.',
                    'priority' => 'high',
                    'status' => 'in_review',
                    'deadline' => Carbon::now()->addDays(1),
                    'start_date' => Carbon::now()->subDays(3),
                    'assignee_index' => 0, // Andi Member / Budi
                    'checklists' => [
                        ['title' => 'Pemeriksaan kontras teks dan aksesibilitas', 'is_completed' => true],
                        ['title' => 'Uji responsiveness pada mobile 375px dan tablet 768px', 'is_completed' => true],
                        ['title' => 'Validasi komponen button dan hover states', 'is_completed' => true],
                    ],
                    'updates' => [
                        [
                            'work_description' => 'Menyelesaikan review seluruh layout landing page dan merapikan komponen visual.',
                            'blocker' => null,
                            'next_plan' => 'Menunggu verifikasi akhir dari PM.',
                        ],
                    ],
                    'review' => [
                        'action' => 'submitted',
                        'from_status' => 'in_progress',
                        'to_status' => 'in_review',
                        'notes' => 'Siap untuk direview oleh PM. Semua checklist visual sudah selesai.',
                    ],
                ],
                [
                    'title' => 'Integrasi API Dashboard Klien A',
                    'description' => 'Hubungkan komponen ringkasan metrik statistik dengan REST endpoint backend.',
                    'priority' => 'urgent',
                    'status' => 'in_progress',
                    'deadline' => Carbon::now()->addDays(3),
                    'start_date' => Carbon::now()->subDays(2),
                    'assignee_index' => 1, // Siti Rahma
                    'checklists' => [
                        ['title' => 'Buat service client axios dengan authorization header', 'is_completed' => true],
                        ['title' => 'Binding data agregasi ke chart komponen', 'is_completed' => true],
                        ['title' => 'Penanganan error state dan skeleton loading', 'is_completed' => false],
                    ],
                    'updates' => [
                        [
                            'work_description' => 'Koneksi API utama sudah berjalan dan menampilkan response payload di console.',
                            'blocker' => 'Menunggu perbaikan format tanggal pada backend endpoint ringkasan.',
                            'next_plan' => 'Menyelesaikan rendering skeleton loader.',
                        ],
                    ],
                ],
                [
                    'title' => 'Setup CI/CD Pipeline Deployment Klien A',
                    'description' => 'Konfigurasi GitHub Actions untuk automated testing dan lint check sebelum pull request merge.',
                    'priority' => 'medium',
                    'status' => 'done',
                    'deadline' => Carbon::now()->subDays(2),
                    'start_date' => Carbon::now()->subDays(7),
                    'assignee_index' => 2, // Rizky
                    'checklists' => [
                        ['title' => 'Tulis konfigurasi workflow .github/workflows/deploy.yml', 'is_completed' => true],
                        ['title' => 'Set environment secrets untuk staging server', 'is_completed' => true],
                        ['title' => 'Uji pipeline deployment manual', 'is_completed' => true],
                    ],
                    'updates' => [
                        [
                            'work_description' => 'Pipeline selesai diuji coba 3 kali berturut-turut tanpa failure.',
                            'blocker' => null,
                            'next_plan' => 'Lanjut monitoring log deployment pertama.',
                        ],
                    ],
                    'review' => [
                        'action' => 'approved',
                        'from_status' => 'in_review',
                        'to_status' => 'done',
                        'notes' => 'Konfigurasi CI/CD bersih dan lolos verifikasi.',
                    ],
                ],
                [
                    'title' => 'Dokumentasi API Specification Swagger',
                    'description' => 'Penyusunan file openapi.yaml untuk modul manajemen pengguna dan proyek.',
                    'priority' => 'low',
                    'status' => 'todo',
                    'deadline' => Carbon::now()->addDays(7),
                    'start_date' => Carbon::now()->addDays(1),
                    'assignee_index' => 3, // Dewi
                    'checklists' => [
                        ['title' => 'Dokumentasikan skema request body', 'is_completed' => false],
                        ['title' => 'Dokumentasikan response status 200, 422, dan 500', 'is_completed' => false],
                    ],
                ],
                [
                    'title' => 'Audit Keamanan Input Form Klien A',
                    'description' => 'Pastikan sanitasi XSS dan CSRF token terpasang pada semua modal formulir.',
                    'priority' => 'high',
                    'status' => 'todo',
                    'deadline' => Carbon::now()->subDays(1), // Overdue task untuk test monitoring
                    'start_date' => Carbon::now()->subDays(4),
                    'assignee_index' => 0,
                    'checklists' => [
                        ['title' => 'Pemeriksaan middleware CSRF Laravel', 'is_completed' => true],
                        ['title' => 'Validasi HTML Purifier pada input rich text', 'is_completed' => false],
                    ],
                ],
            ],

            // PKM-002 (Sistem Internal) - Managed by PM Siti
            'PKM-002' => [
                [
                    'title' => 'Update laporan mingguan dan sinkronisasi log',
                    'description' => 'Rekap data progres seluruh modul operasional internal untuk laporan direksi.',
                    'priority' => 'medium',
                    'status' => 'in_progress',
                    'deadline' => Carbon::now()->addDays(2),
                    'start_date' => Carbon::now()->subDays(1),
                    'assignee_index' => 1,
                    'checklists' => [
                        ['title' => 'Tarik data agregat dari database', 'is_completed' => true],
                        ['title' => 'Susun narasi kendala operasional', 'is_completed' => false],
                    ],
                    'updates' => [
                        [
                            'work_description' => 'Mengumpulkan data absensi dan checklist dari sistem internal.',
                            'blocker' => null,
                            'next_plan' => 'Menyusun draft laporan.',
                        ],
                    ],
                ],
                [
                    'title' => 'Perbaikan bug session timeout sistem internal',
                    'description' => 'Pengguna ter-logout otomatis setelah 5 menit tidak aktif padahal token masih valid.',
                    'priority' => 'urgent',
                    'status' => 'in_review',
                    'deadline' => Carbon::now()->addDays(1),
                    'start_date' => Carbon::now()->subDays(2),
                    'assignee_index' => 2,
                    'checklists' => [
                        ['title' => 'Audit Sanctum token expiration settings', 'is_completed' => true],
                        ['title' => 'Tambahkan silent refresh token interceptor di axios', 'is_completed' => true],
                    ],
                    'review' => [
                        'action' => 'submitted',
                        'from_status' => 'in_progress',
                        'to_status' => 'in_review',
                        'notes' => 'Token interceptor sudah diuji di local storage dan bekerja baik.',
                    ],
                ],
                [
                    'title' => 'Optimasi query laporan audit trail',
                    'description' => 'Query activities melambat saat data melebihi 100 ribu baris.',
                    'priority' => 'high',
                    'status' => 'todo',
                    'deadline' => Carbon::now()->subDays(2), // Overdue
                    'start_date' => Carbon::now()->subDays(5),
                    'assignee_index' => 1,
                    'checklists' => [
                        ['title' => 'Tambahkan composite index pada tabel activities', 'is_completed' => false],
                        ['title' => 'Uji EXPLAIN query plan', 'is_completed' => false],
                    ],
                ],
            ],

            // PKM-003 (Aplikasi Mobile) - Managed by PM Siti
            'PKM-003' => [
                [
                    'title' => 'Fix bug login mobile dan error token',
                    'description' => 'Pengguna Android 14 mengalami crash saat menerima response 401 unauthenticated.',
                    'priority' => 'urgent',
                    'status' => 'in_review',
                    'deadline' => Carbon::now()->addDays(2),
                    'start_date' => Carbon::now()->subDays(3),
                    'assignee_index' => 3,
                    'checklists' => [
                        ['title' => 'Reproduksi crash log di Android emulator', 'is_completed' => true],
                        ['title' => 'Tambahkan error boundary di Flutter router', 'is_completed' => true],
                    ],
                    'review' => [
                        'action' => 'submitted',
                        'from_status' => 'in_progress',
                        'to_status' => 'in_review',
                        'notes' => 'Error handling sudah terpasang dan build APK lolos testing.',
                    ],
                ],
                [
                    'title' => 'Testing fitur pembayaran payment gateway mobile',
                    'description' => 'Uji callback webhook pembayaran QRIS dan Virtual Account.',
                    'priority' => 'high',
                    'status' => 'done',
                    'deadline' => Carbon::now()->subDays(1),
                    'start_date' => Carbon::now()->subDays(4),
                    'assignee_index' => 0,
                    'checklists' => [
                        ['title' => 'Simulasi callback settlement dari sandbox', 'is_completed' => true],
                        ['title' => 'Verifikasi update status transaksi di database', 'is_completed' => true],
                    ],
                    'review' => [
                        'action' => 'approved',
                        'from_status' => 'in_review',
                        'to_status' => 'done',
                        'notes' => 'Webhook callback terverifikasi idempotent dan sukses.',
                    ],
                ],
                [
                    'title' => 'Push notification broadcast pengingat tugas',
                    'description' => 'Kirim push notification FCM kepada member jika tugas mendekati deadline 24 jam.',
                    'priority' => 'medium',
                    'status' => 'in_progress',
                    'deadline' => Carbon::now()->addDays(4),
                    'start_date' => Carbon::now()->subDays(1),
                    'assignee_index' => 2,
                    'checklists' => [
                        ['title' => 'Konfigurasi Firebase Cloud Messaging credentials', 'is_completed' => true],
                        ['title' => 'Buat scheduled job artisan harian', 'is_completed' => false],
                    ],
                ],
            ],

            // PKM-004 (Website Klien B) - Managed by PM1 Ahmad
            'PKM-004' => [
                [
                    'title' => 'Meeting koordinasi lingkup kerja dengan klien B',
                    'description' => 'Finalisasi dokumen deliverable modul e-commerce B2B.',
                    'priority' => 'medium',
                    'status' => 'done',
                    'deadline' => Carbon::now()->subDays(3),
                    'start_date' => Carbon::now()->subDays(5),
                    'assignee_index' => 1,
                    'checklists' => [
                        ['title' => 'Susun minutes of meeting (MoM)', 'is_completed' => true],
                        ['title' => 'Dapatkan tanda tangan persetujuan klien', 'is_completed' => true],
                    ],
                ],
                [
                    'title' => 'Implementasi modul keranjang belanja dan checkout',
                    'description' => 'Buat state management keranjang menggunakan Zustand.',
                    'priority' => 'urgent',
                    'status' => 'in_progress',
                    'deadline' => Carbon::now()->addDays(3),
                    'start_date' => Carbon::now()->subDays(2),
                    'assignee_index' => 0,
                    'checklists' => [
                        ['title' => 'Integrasikan voucher diskon', 'is_completed' => true],
                        ['title' => 'Hitung kalkulasi ongkos kirim otomatis', 'is_completed' => false],
                    ],
                ],
                [
                    'title' => 'Integrasi API ekspedisi kurir Klien B',
                    'description' => 'Koneksikan API tarif RajaOngkir untuk perhitungan ongkir real-time.',
                    'priority' => 'high',
                    'status' => 'todo',
                    'deadline' => Carbon::now()->subDays(1), // Overdue
                    'start_date' => Carbon::now()->subDays(3),
                    'assignee_index' => 2,
                    'checklists' => [
                        ['title' => 'Daftarkan API key prod', 'is_completed' => false],
                    ],
                ],
            ],
        ];

        foreach ($taskDefinitions as $projectCode => $tasks) {
            $project = Project::where('code', $projectCode)->first();
            if (!$project) {
                continue;
            }

            $projectMilestones = Milestone::where('project_id', $project->id)->orderBy('phase_order')->get();
            $defaultMilestone = $projectMilestones->first();
            $projectCreator = User::find($project->pic_id) ?? $pm;

            foreach ($tasks as $idx => $tDef) {
                $assignee = $memberList[$tDef['assignee_index'] % $memberList->count()];
                // Pilih milestone yang sesuai dengan fase
                $milestone = $projectMilestones->get($idx % max(1, $projectMilestones->count())) ?? $defaultMilestone;

                $task = Task::updateOrCreate(
                    [
                        'project_id' => $project->id,
                        'title' => $tDef['title'],
                    ],
                    [
                        'milestone_id' => $milestone ? $milestone->id : null,
                        'description' => $tDef['description'],
                        'priority' => $tDef['priority'],
                        'status' => $tDef['status'],
                        'is_completed' => in_array($tDef['status'], ['done', 'completed']),
                        'deadline' => $tDef['deadline'],
                        'start_date' => $tDef['start_date'],
                        'assignee_id' => $assignee->id,
                        'assignee_name' => $assignee->name,
                        'created_by' => $projectCreator->id,
                    ]
                );

                // Seed Checklists
                if (!empty($tDef['checklists'])) {
                    foreach ($tDef['checklists'] as $pos => $chk) {
                        TaskChecklist::updateOrCreate(
                            [
                                'task_id' => $task->id,
                                'title' => $chk['title'],
                            ],
                            [
                                'is_completed' => $chk['is_completed'],
                                'completed_by' => $chk['is_completed'] ? $assignee->id : null,
                                'completed_at' => $chk['is_completed'] ? Carbon::now()->subHours(5) : null,
                                'position' => $pos + 1,
                            ]
                        );
                    }
                }

                // Seed Task Updates (PM-G)
                if (!empty($tDef['updates'])) {
                    foreach ($tDef['updates'] as $upd) {
                        TaskUpdate::updateOrCreate(
                            [
                                'task_id' => $task->id,
                                'work_description' => $upd['work_description'],
                            ],
                            [
                                'user_id' => $assignee->id,
                                'completed_checklists' => $task->checklists()->where('is_completed', true)->count(),
                                'total_checklists' => $task->checklists()->count(),
                                'progress_snapshot' => $task->calculateChecklistProgress(),
                                'blocker' => $upd['blocker'],
                                'next_plan' => $upd['next_plan'],
                            ]
                        );
                    }
                }

                // Seed Task Reviews (PM-H)
                if (!empty($tDef['review'])) {
                    $rev = $tDef['review'];
                    $reviewer = $rev['action'] === 'approved' ? $projectCreator : $assignee;
                    TaskReview::updateOrCreate(
                        [
                            'task_id' => $task->id,
                            'action' => $rev['action'],
                        ],
                        [
                            'user_id' => $reviewer->id,
                            'from_status' => $rev['from_status'],
                            'to_status' => $rev['to_status'],
                            'notes' => $rev['notes'],
                            'review_cycle' => 1,
                        ]
                    );
                }
            }

            // Hitung ulang progres proyek & milestone berdasarkan task
            Project::recalculateProgressFor($project->id);
            foreach ($projectMilestones as $m) {
                Milestone::recalculateProgressFor($m->id);
            }
        }

        // 5. Seed Project Reports (PM-J)
        $reportProjects = Project::whereIn('code', ['PKM-001', 'PKM-002', 'PKM-003', 'PKM-004'])->get();
        foreach ($reportProjects as $idx => $rProj) {
            $creator = User::find($rProj->pic_id) ?? $pm;
            $reportNum = sprintf('RPT-%s-%04d', date('Ym'), $idx + 1);

            ProjectReport::updateOrCreate(
                [
                    'project_id' => $rProj->id,
                    'report_number' => $reportNum,
                ],
                [
                    'created_by' => $creator->id,
                    'period_start' => Carbon::now()->startOfWeek()->subWeek(),
                    'period_end' => Carbon::now()->endOfWeek()->subWeek(),
                    'status' => 'published',
                    'executive_summary' => "Laporan progres mingguan proyek {$rProj->name} ({$rProj->code}). Seluruh deliverable fase sprint berjalan sesuai rencana dan risiko operasional terkendali.",
                    'completed_work' => "- Menyelesaikan review visual UI/UX layout utama\n- Integrasi komponen REST API dengan backend\n- Uji coba automated testing dan verifikasi staging",
                    'challenges' => "Koordinasi teknis penyesuaian schema endpoint dengan pihak ketiga memerlukan konfirmasi SLA.",
                    'risks' => "Potensi keterlambatan feedback approval klien di akhir sprint.",
                    'next_week_plan' => "- Melanjutkan implementasi modul checkout dan payment gateway\n- Pengujian menyeluruh skenario UAT bersama tim QA\n- Menyiapkan deployment release candidate",
                    'support_required' => "Dukungan persetujuan deployment staging dari tim manajemen.",
                    'snapshot_data' => [
                        'project_code' => $rProj->code,
                        'project_name' => $rProj->name,
                        'client' => $rProj->client,
                        'progress' => $rProj->progress,
                        'status' => $rProj->status,
                        'total_tasks' => $rProj->tasks()->count(),
                        'completed_tasks' => $rProj->tasks()->where('is_completed', true)->count(),
                    ],
                    'published_at' => Carbon::now()->subDays(2),
                ]
            );

            // Buat draft laporan untuk minggu ini
            $draftReportNum = sprintf('RPT-%s-%04d', date('Ym'), $idx + 10);
            ProjectReport::updateOrCreate(
                [
                    'project_id' => $rProj->id,
                    'status' => 'draft',
                ],
                [
                    'report_number' => $draftReportNum,
                    'created_by' => $creator->id,
                    'period_start' => Carbon::now()->startOfWeek(),
                    'period_end' => Carbon::now()->endOfWeek(),
                    'executive_summary' => "Draft laporan progres minggu berjalan proyek {$rProj->name}. Sedang dalam pengisian oleh Project Manager.",
                    'completed_work' => "Penyelesaian modul aktif dan perbaikan bug laporan sebelumnya.",
                    'challenges' => "Tidak ada kendala mayor.",
                    'risks' => "Risiko moderat.",
                    'next_week_plan' => "Selesaikan seluruh checklist minggu berjalan.",
                    'support_required' => null,
                    'snapshot_data' => [
                        'project_code' => $rProj->code,
                        'project_name' => $rProj->name,
                        'client' => $rProj->client,
                        'progress' => $rProj->progress,
                        'status' => $rProj->status,
                    ],
                ]
            );
        }

        // 6. Pastikan Activities terisi (tanpa menghapus data yang sudah ada)
        if (Activity::count() < 5) {
            $initialActivities = [
                [
                    'user_name' => 'Andi Pratama',
                    'action' => 'menyelesaikan tugas "Review UI/UX landing page"',
                    'target_name' => 'Review UI/UX',
                    'project_name' => 'Website Klien A',
                    'avatar_color' => 'pink',
                    'created_at' => Carbon::now()->subMinutes(10),
                ],
                [
                    'user_name' => 'Siti Project Manager',
                    'action' => 'menerbitkan laporan mingguan RPT-202611-0001',
                    'target_name' => 'Laporan Mingguan',
                    'project_name' => 'Website Klien A',
                    'avatar_color' => 'purple',
                    'created_at' => Carbon::now()->subHours(2),
                ],
                [
                    'user_name' => 'Rizky Maulana',
                    'action' => 'mengubah status tugas menjadi In Review',
                    'target_name' => 'Fix bug login mobile',
                    'project_name' => 'Aplikasi Mobile',
                    'avatar_color' => 'yellow',
                    'created_at' => Carbon::now()->subHours(3),
                ],
            ];
            foreach ($initialActivities as $act) {
                Activity::create($act);
            }
        }

        $this->command->info('✅ PkmDataSeeder berhasil dijalankan secara aman dan idempotent!');
    }
}
