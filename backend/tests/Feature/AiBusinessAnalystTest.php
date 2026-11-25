<?php

namespace Tests\Feature;

use App\Models\Milestone;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Models\FinancialBudget;
use App\Models\FinancialTransaction;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AiBusinessAnalystTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $pimpinanUser;
    protected User $pmUser;
    protected User $memberUser;
    protected Project $erpProject;
    protected Project $delayedProject;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedTestData();
    }

    protected function seedTestData(): void
    {
        $this->adminUser = User::create([
            'name' => 'Admin PKM',
            'email' => 'admin.ai@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->pimpinanUser = User::create([
            'name' => 'Direktur PKM',
            'email' => 'direktur.ai@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'pimpinan',
            'is_active' => true,
        ]);

        $this->pmUser = User::create([
            'name' => 'Project Manager',
            'email' => 'pm.ai@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        $this->memberUser = User::create([
            'name' => 'Rian Hidayat',
            'email' => 'rian.ai@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'member',
            'is_active' => true,
        ]);

        $this->erpProject = Project::create([
            'code' => 'PKM-ERP-01',
            'name' => 'Sistem ERP PKM',
            'client' => 'PT Karya Mandiri Sejahtera',
            'progress' => 80,
            'target_progress' => 80,
            'status' => 'on_track',
            'risk_level' => 'low',
            'deadline' => Carbon::now()->addDays(30)->toDateString(),
            'is_active' => true,
        ]);

        $this->delayedProject = Project::create([
            'code' => 'PKM-WBS-02',
            'name' => 'Portal Vendor PKM',
            'client' => 'PT Mitra Terpercaya',
            'progress' => 35,
            'target_progress' => 70,
            'status' => 'delayed',
            'risk_level' => 'high',
            'risk_factor' => 'Keterlambatan approval arsitektur dan keterbatasan resource',
            'deadline' => Carbon::now()->addDays(5)->toDateString(),
            'is_active' => true,
        ]);

        Milestone::create([
            'project_id' => $this->erpProject->id,
            'title' => 'Fase 1 - Database Schema',
            'progress' => 100,
            'status' => 'completed',
            'due_date' => Carbon::now()->subDays(10)->toDateString(),
        ]);

        Milestone::create([
            'project_id' => $this->delayedProject->id,
            'title' => 'Fase 2 - API Gateway',
            'progress' => 30,
            'status' => 'in_progress',
            'due_date' => Carbon::now()->addDays(3)->toDateString(),
        ]);

        Task::create([
            'project_id' => $this->delayedProject->id,
            'user_id' => $this->memberUser->id,
            'assignee_id' => $this->memberUser->id,
            'assignee_name' => $this->memberUser->name,
            'title' => 'Integrasi Payment Gateway',
            'priority' => 'high',
            'is_completed' => false,
            'deadline' => Carbon::now()->subDays(2)->toDateString(),
        ]);

        Task::create([
            'project_id' => $this->erpProject->id,
            'user_id' => $this->memberUser->id,
            'assignee_id' => $this->memberUser->id,
            'assignee_name' => $this->memberUser->name,
            'title' => 'Setup User Roles',
            'priority' => 'medium',
            'is_completed' => true,
            'deadline' => Carbon::now()->subDays(5)->toDateString(),
        ]);
    }

    /**
     * Skenario 1: Business Overview Query ("Baca kondisi bisnis saya sekarang dan harus ke mana saya melangkah?")
     */
    public function test_01_business_overview_query_contains_8_structured_sections(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $res = $this->postJson('/api/ai/ask', [
            'prompt' => 'Baca kondisi bisnis saya sekarang dan harus ke mana saya melangkah?',
        ]);

        $res->assertStatus(200)
            ->assertJson(['success' => true, 'type' => 'business_overview']);

        $reply = $res->json('reply');
        $this->assertStringContainsString('Ringkasan Eksekutif & Posisi Bisnis Saat Ini', $reply);
        $this->assertStringContainsString('Skor Kesehatan Perusahaan (Corporate Health Index / CHI)', $reply);
        $this->assertStringContainsString('Masalah Utama & Blocker Kritis', $reply);
        $this->assertStringContainsString('Peluang Pertumbuhan & Potensi Ekspansi', $reply);
        $this->assertStringContainsString('Rekomendasi Strategis Berbasis Data', $reply);
        $this->assertStringContainsString('Prioritas Investasi & Alokasi Sumber Daya', $reply);
        $this->assertStringContainsString('Action Plan Terukur', $reply);
        $this->assertStringContainsString('Catatan Keterbukaan & Keterbatasan Data', $reply);
    }

    /**
     * Skenario 2: Strategic Direction & Roadmap
     */
    public function test_02_strategic_planning_roadmap(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $res = $this->postJson('/api/ai/ask', [
            'prompt' => 'Rencana strategis dan roadmap perusahaan ke depan',
        ]);

        $res->assertStatus(200)
            ->assertJson(['success' => true, 'type' => 'strategic_planning']);

        $reply = $res->json('reply');
        $this->assertStringContainsString('Horizon 1: Stabilisasi Delivery', $reply);
        $this->assertStringContainsString('Horizon 2: Skalabilitas Operasional', $reply);
        $this->assertStringContainsString('Horizon 3: Pertumbuhan Berkelanjutan', $reply);
    }

    /**
     * Skenario 3: Investment Prioritization without fabricated ROI
     */
    public function test_03_investment_prioritization_query(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $res = $this->postJson('/api/ai/ask', [
            'prompt' => 'Harus invest ke mana agar saya bertumbuh?',
        ]);

        $res->assertStatus(200)
            ->assertJson(['success' => true, 'type' => 'investment_prioritization']);

        $reply = $res->json('reply');
        $this->assertStringContainsString('Prioritas 1: Mitigasi Bottleneck & Penyelesaian Proyek', $reply);
        $this->assertStringContainsString('Prioritas 2: Peningkatan Kapasitas & Standarisasi Internal', $reply);
        $this->assertStringContainsString('Prioritas 3: Ekspansi Penawaran & Kemitraan Klien', $reply);
    }

    /**
     * Skenario 4: Problem Diagnosis identifies real delayed projects and overdue tasks
     */
    public function test_04_problem_diagnosis_query(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $res = $this->postJson('/api/ai/ask', [
            'prompt' => 'Apa masalah terbesar PKM saat ini?',
        ]);

        $res->assertStatus(200)
            ->assertJson(['success' => true, 'type' => 'problem_diagnosis']);

        $reply = $res->json('reply');
        $this->assertStringContainsString('Portal Vendor PKM', $reply);
        $this->assertStringContainsString('DELAYED', $reply);
        $this->assertStringContainsString('overdue', strtolower($reply));
    }

    /**
     * Skenario 5: Financial Analysis for Pimpinan displays factual figures
     */
    public function test_05_financial_analysis_for_pimpinan(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        FinancialBudget::create([
            'label' => 'Anggaran Operasional 2026',
            'fiscal_year' => (int) date('Y'),
            'fiscal_period' => 'quarterly',
            'period_code' => '2026-Q1',
            'start_date' => Carbon::now()->startOfYear()->toDateString(),
            'end_date' => Carbon::now()->endOfYear()->toDateString(),
            'revenue_target' => 500000000,
            'expense_budget' => 300000000,
            'is_active' => true,
            'created_by' => $this->adminUser->id,
        ]);

        FinancialTransaction::create([
            'transaction_date' => Carbon::now()->toDateString(),
            'type' => 'income',
            'category' => 'Termin Proyek',
            'amount' => 150000000,
            'description' => 'Pembayaran termin ERP',
            'recorded_by' => $this->adminUser->id,
        ]);

        FinancialTransaction::create([
            'transaction_date' => Carbon::now()->toDateString(),
            'type' => 'expense',
            'category' => 'Server & Cloud',
            'amount' => 50000000,
            'description' => 'Biaya AWS dan database',
            'recorded_by' => $this->adminUser->id,
        ]);

        $res = $this->postJson('/api/ai/ask', [
            'prompt' => 'Bagaimana analisis keuangan dan profitabilitas saat ini?',
        ]);

        $res->assertStatus(200)
            ->assertJson(['success' => true, 'type' => 'financial_analysis']);

        $reply = $res->json('reply');
        $this->assertStringContainsString('Total Pendapatan', $reply);
        $this->assertStringContainsString('150.000.000', $reply);
        $this->assertStringContainsString('Total Pengeluaran', $reply);
        $this->assertStringContainsString('50.000.000', $reply);
    }

    /**
     * Skenario 6: Financial Analysis data protection for Member role
     */
    public function test_06_financial_analysis_restricted_for_member(): void
    {
        Sanctum::actingAs($this->memberUser);

        $res = $this->postJson('/api/ai/ask', [
            'prompt' => 'Bagaimana analisis keuangan dan arus kas perusahaan?',
        ]);

        $res->assertStatus(200)
            ->assertJson(['success' => true, 'type' => 'financial_analysis']);

        $reply = $res->json('reply');
        $this->assertStringContainsString('Pembatasan Akses Keamanan Data', $reply);
        $this->assertStringContainsString('MEMBER', $reply);
    }

    /**
     * Skenario 7: Project Performance & Troubled Portfolio
     */
    public function test_07_project_performance_and_portfolio_risks(): void
    {
        Sanctum::actingAs($this->pmUser);

        $res = $this->postJson('/api/ai/ask', [
            'prompt' => 'Coba cek proyek yang lagi bermasalah atau delayed',
        ]);

        $res->assertStatus(200)
            ->assertJson(['success' => true, 'type' => 'all_project_risks']);

        $reply = $res->json('reply');
        $this->assertStringContainsString('Portal Vendor PKM', $reply);
        $this->assertStringContainsString('DELAYED', $reply);
    }

    /**
     * Skenario 8: Team Productivity & Workload Imbalance
     */
    public function test_08_team_workload_analysis(): void
    {
        Sanctum::actingAs($this->pmUser);

        $res = $this->postJson('/api/ai/ask', [
            'prompt' => 'Siapa anggota tim yang punya beban kerja paling banyak?',
        ]);

        $res->assertStatus(200)
            ->assertJson(['success' => true, 'type' => 'employee_workload']);

        $reply = $res->json('reply');
        $this->assertStringContainsString('Rian Hidayat', $reply);
        $this->assertStringContainsString('Penyeimbangan Beban (Load Balancing)', $reply);
    }

    /**
     * Skenario 9: Period Comparison Query
     */
    public function test_09_period_comparison_query(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $res = $this->postJson('/api/ai/ask', [
            'prompt' => 'Bandingkan performa bulan ini dengan bulan lalu',
        ]);

        $res->assertStatus(200)
            ->assertJson(['success' => true, 'type' => 'data_comparison']);

        $reply = $res->json('reply');
        $this->assertStringContainsString('Analisis Perbandingan Data Portofolio', $reply);
        $this->assertStringContainsString('Laporan & Analitik (Reports 2.0)', $reply);
    }

    /**
     * Skenario 10: Growth Opportunities Query
     */
    public function test_10_growth_opportunities_query(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $res = $this->postJson('/api/ai/ask', [
            'prompt' => 'Apa peluang pertumbuhan bisnis PKM saat ini?',
        ]);

        $res->assertStatus(200)
            ->assertJson(['success' => true, 'type' => 'growth_opportunities']);

        $reply = $res->json('reply');
        $this->assertStringContainsString('Peluang Pertumbuhan & Potensi Ekspansi', $reply);
    }

    /**
     * Skenario 11: Free-form Indonesian Colloquial Query
     */
    public function test_11_freeform_colloquial_query(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $res = $this->postJson('/api/ai/ask', [
            'prompt' => 'menurut kamu gimana kondisi perusahaan kita skr?',
        ]);

        $res->assertStatus(200)
            ->assertJson(['success' => true, 'type' => 'business_overview']);
    }

    /**
     * Skenario 12: Follow-up Conversational Memory
     */
    public function test_12_follow_up_conversational_pronoun_resolution(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $history = [
            [
                'user' => 'Jelaskan kondisi proyek Portal Vendor PKM',
                'reply' => 'Proyek Portal Vendor PKM berstatus delayed.',
            ]
        ];

        $res = $this->postJson('/api/ai/ask', [
            'prompt' => 'Kenapa proyek itu terlambat?',
            'history' => $history,
        ]);

        $res->assertStatus(200)
            ->assertJson(['success' => true, 'type' => 'single_project_analysis']);

        $reply = $res->json('reply');
        $this->assertStringContainsString('Portal Vendor PKM', $reply);
    }

    /**
     * Skenario 13: Incomplete Financial Data Transparency
     */
    public function test_13_incomplete_financial_data_honesty(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $res = $this->postJson('/api/ai/ask', [
            'prompt' => 'Bagaimana analisis keuangan dan profitabilitas saat ini?',
        ]);

        $res->assertStatus(200);
        $reply = $res->json('reply');
        $this->assertStringContainsString('Belum ada', $reply);
    }

    /**
     * Skenario 14: Honest Missing ROI Data in Investment Query
     */
    public function test_14_honest_missing_roi_data(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $res = $this->postJson('/api/ai/ask', [
            'prompt' => 'Harus invest ke mana agar saya bertumbuh?',
        ]);

        $res->assertStatus(200);
        $reply = $res->json('reply');
        $this->assertStringNotContainsString('ROI 350%', $reply);
        $this->assertStringContainsString('Keterbatasan Informasi', $reply);
    }

    /**
     * Skenario 15: Gemini Timeout Graceful Fallback
     */
    public function test_15_gemini_timeout_graceful_fallback(): void
    {
        Sanctum::actingAs($this->adminUser);

        putenv('GEMINI_API_KEY=test-gemini-key');
        $_ENV['GEMINI_API_KEY'] = 'test-gemini-key';

        Http::fake(function () {
            throw new \Illuminate\Http\Client\ConnectionException('Operation timed out after 25000ms');
        });

        $res = $this->postJson('/api/ai/ask', [
            'prompt' => 'Baca kondisi bisnis saya sekarang dan harus ke mana saya melangkah?',
        ]);

        $res->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertStringContainsString('timeout', strtolower($res->json('note') ?? ''));
        $this->assertNotEmpty($res->json('reply'));

        putenv('GEMINI_API_KEY=');
        unset($_ENV['GEMINI_API_KEY']);
    }

    /**
     * Skenario 16: Gemini Rate Limit (429) & Server Error (500) Graceful Fallback
     */
    public function test_16_gemini_rate_limit_and_500_fallback(): void
    {
        Sanctum::actingAs($this->adminUser);

        putenv('GEMINI_API_KEY=test-gemini-key');
        $_ENV['GEMINI_API_KEY'] = 'test-gemini-key';

        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(['error' => 'Rate limit exceeded'], 429),
        ]);

        $res = $this->postJson('/api/ai/ask', [
            'prompt' => 'Apa masalah terbesar PKM saat ini?',
        ]);

        $res->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertNotEmpty($res->json('reply'));
        $this->assertStringContainsString('Portal Vendor PKM', $res->json('reply'));

        putenv('GEMINI_API_KEY=');
        unset($_ENV['GEMINI_API_KEY']);
    }

    /**
     * Skenario 17: Context Endpoint Role Scoping Isolation
     */
    public function test_17_context_endpoint_role_scoping_isolation(): void
    {
        // 1. Pimpinan has full company health and financial access
        Sanctum::actingAs($this->pimpinanUser);
        $resPimpinan = $this->getJson('/api/ai/context');
        $resPimpinan->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'context' => [
                    'company_health' => ['chi_score', 'chi_category'],
                    'financial',
                ]
            ]);
        $this->assertFalse($resPimpinan->json('context.financial.restricted') ?? false);

        // 2. Member has financial fields restricted
        Sanctum::actingAs($this->memberUser);
        $resMember = $this->getJson('/api/ai/context');
        $resMember->assertStatus(200);
        $this->assertTrue($resMember->json('context.financial.restricted') ?? false);
    }
}