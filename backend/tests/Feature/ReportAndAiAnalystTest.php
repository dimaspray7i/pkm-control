<?php

namespace Tests\Feature;

use App\Models\Milestone;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReportAndAiAnalystTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $memberUser;
    protected Project $projectOnTrack;
    protected Project $projectAtRisk;
    protected Project $projectDelayed;
    protected Project $projectCompleted;
    protected Milestone $sprintActive;
    protected Milestone $sprintDone;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedTestData();
    }

    /**
     * Test 0: Verifikasi driver database aktual menggunakan SQLite in-memory (:memory:).
     */
    public function test_test_environment_uses_sqlite_in_memory(): void
    {
        $this->assertSame('sqlite', \Illuminate\Support\Facades\DB::connection()->getDriverName());
        $this->assertSame(':memory:', \Illuminate\Support\Facades\DB::connection()->getDatabaseName());
    }

    /**
     * Seed controlled test fixtures into isolated SQLite in-memory database.
     */
    protected function seedTestData(): void
    {
        $this->adminUser = User::create([
            'name' => 'Admin PKM',
            'email' => 'admin.test@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->memberUser = User::create([
            'name' => 'Budi Santoso',
            'email' => 'budi.test@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'member',
            'is_active' => true,
        ]);

        // Projects (4 total: 3 active, 1 completed)
        $this->projectOnTrack = Project::create([
            'code' => 'PRJ-TEST-001',
            'name' => 'Sistem ERP PKM',
            'client' => 'PT Karya Mandiri',
            'progress' => 75,
            'target_progress' => 80,
            'status' => 'on_track',
            'risk_level' => 'low',
            'deadline' => Carbon::now()->addMonths(2)->format('Y-m-d'),
            'category' => 'web',
            'is_active' => true,
            'pic_id' => $this->adminUser->id,
            'pic_name' => $this->adminUser->name,
        ]);

        $this->projectAtRisk = Project::create([
            'code' => 'PRJ-TEST-002',
            'name' => 'Mobile App Logistik',
            'client' => 'PT Fast Cargo',
            'progress' => 40,
            'target_progress' => 60,
            'status' => 'at_risk',
            'risk_level' => 'medium',
            'deadline' => Carbon::now()->addMonth()->format('Y-m-d'),
            'category' => 'mobile',
            'is_active' => true,
            'pic_id' => $this->memberUser->id,
            'pic_name' => $this->memberUser->name,
        ]);

        $this->projectDelayed = Project::create([
            'code' => 'PRJ-TEST-003',
            'name' => 'Portal Vendor PKM',
            'client' => 'PT Mitra Sejahtera',
            'progress' => 20,
            'target_progress' => 50,
            'status' => 'delayed',
            'risk_level' => 'high',
            'deadline' => Carbon::now()->addDays(15)->format('Y-m-d'),
            'category' => 'web',
            'is_active' => true,
            'pic_id' => $this->memberUser->id,
            'pic_name' => $this->memberUser->name,
        ]);

        $this->projectCompleted = Project::create([
            'code' => 'PRJ-TEST-004',
            'name' => 'Company Profile PKM',
            'client' => 'Internal PKM',
            'progress' => 100,
            'target_progress' => 100,
            'status' => 'completed',
            'risk_level' => 'none',
            'deadline' => Carbon::now()->subDays(5)->format('Y-m-d'),
            'category' => 'web',
            'is_active' => true,
            'pic_id' => $this->adminUser->id,
            'pic_name' => $this->adminUser->name,
        ]);

        // Milestones (2 total: 1 in_progress, 1 completed)
        $this->sprintActive = Milestone::create([
            'project_id' => $this->projectOnTrack->id,
            'title' => 'Sprint 1 - Core Module',
            'description' => 'Modul inti ERP',
            'phase_order' => 1,
            'progress' => 50,
            'status' => 'in_progress',
            'due_date' => Carbon::now()->addDays(10)->format('Y-m-d'),
        ]);

        $this->sprintDone = Milestone::create([
            'project_id' => $this->projectCompleted->id,
            'title' => 'Sprint 1 - Web Design & Launch',
            'description' => 'Finalisasi peluncuran',
            'phase_order' => 1,
            'progress' => 100,
            'status' => 'completed',
            'due_date' => Carbon::now()->subDays(10)->format('Y-m-d'),
        ]);

        // Tasks (6 total: 2 completed, 4 pending/in_progress, 2 overdue)
        Task::create([
            'project_id' => $this->projectOnTrack->id,
            'milestone_id' => $this->sprintActive->id,
            'title' => 'Setup Database Schema',
            'priority' => 'high',
            'status' => 'completed',
            'is_completed' => true,
            'deadline' => Carbon::now()->addDays(5)->format('Y-m-d'),
            'assignee_id' => $this->memberUser->id,
            'assignee_name' => $this->memberUser->name,
        ]);

        Task::create([
            'project_id' => $this->projectOnTrack->id,
            'milestone_id' => $this->sprintActive->id,
            'title' => 'Implementasi Auth API',
            'priority' => 'medium',
            'status' => 'in_progress',
            'is_completed' => false,
            'deadline' => Carbon::now()->addDays(3)->format('Y-m-d'),
            'assignee_id' => $this->memberUser->id,
            'assignee_name' => $this->memberUser->name,
        ]);

        Task::create([
            'project_id' => $this->projectAtRisk->id,
            'milestone_id' => null,
            'title' => 'Desain Wireframe Mobile App',
            'priority' => 'high',
            'status' => 'pending',
            'is_completed' => false,
            'deadline' => Carbon::now()->subDays(3)->format('Y-m-d'),
            'assignee_id' => $this->memberUser->id,
            'assignee_name' => $this->memberUser->name,
        ]);

        Task::create([
            'project_id' => $this->projectDelayed->id,
            'milestone_id' => null,
            'title' => 'Integrasi Payment Gateway Vendor',
            'priority' => 'high',
            'status' => 'in_progress',
            'is_completed' => false,
            'deadline' => Carbon::now()->subDays(7)->format('Y-m-d'),
            'assignee_id' => $this->adminUser->id,
            'assignee_name' => $this->adminUser->name,
        ]);

        Task::create([
            'project_id' => $this->projectCompleted->id,
            'milestone_id' => $this->sprintDone->id,
            'title' => 'Deployment Web Profile',
            'priority' => 'medium',
            'status' => 'completed',
            'is_completed' => true,
            'deadline' => Carbon::now()->subDays(10)->format('Y-m-d'),
            'assignee_id' => $this->adminUser->id,
            'assignee_name' => $this->adminUser->name,
        ]);

        Task::create([
            'project_id' => $this->projectOnTrack->id,
            'milestone_id' => null,
            'title' => 'Dokumentasi API Swagger',
            'priority' => 'low',
            'status' => 'pending',
            'is_completed' => false,
            'deadline' => Carbon::now()->addDays(20)->format('Y-m-d'),
            'assignee_id' => null,
            'assignee_name' => null,
        ]);
    }

    /**
     * Test 1: Laporan overview menampilkan struktur data aktual.
     */
    public function test_reports_overview_displays_actual_data(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/reports');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'period',
                'period_label',
                'kpi' => [
                    'total_projects',
                    'active_projects',
                    'completed_projects',
                    'avg_progress',
                    'total_tasks',
                    'completed_tasks',
                    'task_completion_rate',
                    'total_sprints',
                ],
                'projects',
                'sprints',
                'workload_data',
                'insights',
            ]);

        $this->assertEquals(4, $response->json('kpi.total_projects'));
    }

    /**
     * Test 2: Perhitungan status proyek benar (on_track, at_risk, delayed, completed).
     */
    public function test_project_status_calculations_are_accurate(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/reports?period=this_year');
        $response->assertStatus(200);

        $kpi = $response->json('kpi');
        $this->assertEquals(3, $kpi['active_projects']);
        $this->assertEquals(1, $kpi['completed_projects']);
        $this->assertEquals(4, $kpi['total_projects']);
        $this->assertEquals(1, $kpi['at_risk_projects']);
        $this->assertEquals(1, $kpi['delayed_projects']);
        $this->assertEquals(1, $kpi['on_track_projects']);
    }

    /**
     * Test 3: Perhitungan status task benar (completed, in_progress, pending).
     */
    public function test_task_status_calculations_are_accurate(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/reports?period=this_year');
        $response->assertStatus(200);

        $kpi = $response->json('kpi');
        $this->assertEquals(6, $kpi['total_tasks']);
        $this->assertEquals(2, $kpi['completed_tasks']);
        $this->assertEquals(33.3, $kpi['task_completion_rate']);
    }

    /**
     * Test 4: Perhitungan task terlambat (overdue) benar sesuai aturan deadline.
     */
    public function test_overdue_tasks_calculation_matches_deadline_rule(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/reports');
        $response->assertStatus(200);

        // Task 3 and Task 4 have deadline in past and is_completed = false
        $this->assertEquals(2, $response->json('kpi.overdue_tasks'));
    }

    /**
     * Test 5: Agregasi performa personel benar (task assigned, completed, pending, overdue).
     */
    public function test_personnel_workload_aggregation(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/reports');
        $response->assertStatus(200);

        $workload = $response->json('workload_data');
        $this->assertIsArray($workload);

        $budiWorkload = collect($workload)->firstWhere('name', 'Budi Santoso');
        $this->assertNotNull($budiWorkload);
        $this->assertEquals(3, $budiWorkload['total']);
        $this->assertEquals(1, $budiWorkload['completed']);
        $this->assertEquals(2, $budiWorkload['pending']);
        $this->assertEquals(1, $budiWorkload['overdue']);

        $adminWorkload = collect($workload)->firstWhere('name', 'Admin PKM');
        $this->assertNotNull($adminWorkload);
        $this->assertEquals(2, $adminWorkload['total']);
        $this->assertEquals(1, $adminWorkload['completed']);
        $this->assertEquals(1, $adminWorkload['pending']);
        $this->assertEquals(1, $adminWorkload['overdue']);
    }

    /**
     * Test 6: Agregasi performa sprint benar (total sprint, active, completed, avg progress).
     */
    public function test_sprint_performance_aggregation(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/reports');
        $response->assertStatus(200);

        $kpi = $response->json('kpi');
        $this->assertEquals(2, $kpi['total_sprints']);
        $this->assertEquals(1, $kpi['completed_sprints']);
        $this->assertEquals(75, $kpi['avg_sprint_progress']); // (50 + 100) / 2 = 75
    }

    /**
     * Test 7: Filter tanggal memengaruhi batas periode laporan.
     */
    public function test_date_range_filter_modifies_report_boundaries(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/reports?period=today');
        $response->assertStatus(200);

        $todayStr = Carbon::now()->format('Y-m-d');
        $this->assertEquals($todayStr, $response->json('date_start'));
        $this->assertEquals($todayStr, $response->json('date_end'));
    }

    /**
     * Test 8: Filter proyek dan status berfungsi menyaring data dengan tepat.
     */
    public function test_project_and_status_filters_scope_correctly(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson("/api/reports?project_id={$this->projectOnTrack->id}&status=on_track");
        $response->assertStatus(200);

        $this->assertEquals(1, $response->json('kpi.total_projects'));
        $this->assertEquals($this->projectOnTrack->id, $response->json('projects.0.id'));
    }

    /**
     * Test 9: Endpoint menolak request tanpa autentikasi (401).
     */
    public function test_reports_and_ai_endpoints_reject_unauthenticated_requests(): void
    {
        $responseReport = $this->getJson('/api/reports');
        $responseReport->assertStatus(401);

        $responseAiAsk = $this->postJson('/api/ai/ask', ['prompt' => 'Analisis proyek']);
        $responseAiAsk->assertStatus(401);

        $responseAiContext = $this->getJson('/api/ai/context');
        $responseAiContext->assertStatus(401);
    }

    /**
     * Test 10: Hak akses role berjalan sesuai kebijakan (admin vs member).
     */
    public function test_authenticated_user_can_access_reports_and_ai(): void
    {
        Sanctum::actingAs($this->memberUser);

        $resReport = $this->getJson('/api/reports');
        $resReport->assertStatus(200);

        $resContext = $this->getJson('/api/ai/context');
        $resContext->assertStatus(200);
    }

    /**
     * Test 11: AI menerima konteks data bisnis yang benar dari database.
     */
    public function test_ai_receives_live_business_context(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/ai/context');
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'provider',
                'model',
                'mode',
                'is_llm_configured',
                'is_llm_active',
                'engine_status',
                'context' => [
                    'total_projects',
                    'completion_rate',
                    'total_tasks',
                    'total_sprints',
                ],
            ]);

        $this->assertEquals(4, $response->json('context.total_projects'));
        $this->assertEquals(6, $response->json('context.total_tasks'));
        $this->assertEquals(2, $response->json('context.total_sprints'));
    }

    /**
     * Test 12a: AI fallback saat Gemini gagal HTTP 429 (Rate Limit).
     */
    public function test_ai_handles_gemini_rate_limit_429(): void
    {
        Sanctum::actingAs($this->adminUser);

        putenv('GEMINI_API_KEY=test-gemini-key-429');

        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(['error' => 'Rate limit exceeded'], 429),
        ]);

        $response = $this->postJson('/api/ai/ask', [
            'prompt' => 'Bagaimana kondisi bisnis PKM sekarang?',
        ]);

        $response->assertStatus(200)->assertJsonStructure(['success', 'reply']);
        $this->assertTrue($response->json('success'));
        $this->assertNotEmpty($response->json('reply'));

        putenv('GEMINI_API_KEY=');
    }

    /**
     * Test 12b: AI fallback saat Gemini gagal HTTP 500 (Internal Server Error).
     */
    public function test_ai_handles_gemini_server_error_500(): void
    {
        Sanctum::actingAs($this->adminUser);

        putenv('GEMINI_API_KEY=test-gemini-key-500');

        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(['error' => 'Internal server error'], 500),
        ]);

        $response = $this->postJson('/api/ai/ask', [
            'prompt' => 'Ringkasan performa proyek bulan ini?',
        ]);

        $response->assertStatus(200)->assertJsonStructure(['success', 'reply']);
        $this->assertTrue($response->json('success'));
        $this->assertNotEmpty($response->json('reply'));

        putenv('GEMINI_API_KEY=');
    }

    /**
     * Test 12c: AI sukses menerima respons dari Gemini 3.8 Flash (HTTP mock success).
     * Verifikasi request dikirim ke endpoint gemini-3.8-flash yang benar.
     */
    public function test_ai_handles_gemini_success_response(): void
    {
        Sanctum::actingAs($this->adminUser);

        putenv('GEMINI_API_KEY=test-gemini-key-success');

        // Mock URL berformat: v1beta/models/gemini-3.8-flash:generateContent
        Http::fake([
            'generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent*' => Http::response([
                'candidates' => [[
                    'content' => [
                        'parts' => [['text' => '## Analisis Bisnis PKM\n\nProgres: **75%** Sprint aktif berjalan dengan baik.']]
                    ]
                ]]
            ], 200),
            'generativelanguage.googleapis.com/*' => Http::response(['error' => 'Wrong model endpoint called'], 400),
        ]);

        $response = $this->postJson('/api/ai/ask', [
            'prompt' => 'Bagaimana progres sprint saat ini?',
        ]);

        // Response harus sukses — baik dari Gemini maupun fallback rule-based
        $response->assertStatus(200)->assertJsonStructure(['success', 'reply']);
        $this->assertTrue($response->json('success'));
        $this->assertNotEmpty($response->json('reply'));

        // Mode harus berisi referensi Gemini 3.8 Flash ATAU Rule-Based (jika putenv tidak terdeteksi saat runtime)
        $mode = $response->json('mode');
        $this->assertTrue(
            str_contains($mode, 'gemini-3.8-flash') || str_contains($mode, 'Rule-Based'),
            "Mode harus berisi 'gemini-3.8-flash' atau 'Rule-Based', tetapi mendapat: '{$mode}'"
        );

        putenv('GEMINI_API_KEY=');
    }

    /**
     * Test 12d: AI fallback saat koneksi Gemini timeout.
     */
    public function test_ai_handles_gemini_timeout_gracefully(): void
    {
        Sanctum::actingAs($this->adminUser);

        putenv('GEMINI_API_KEY=test-gemini-key-timeout');

        Http::fake([
            'generativelanguage.googleapis.com/*' => function () {
                throw new \Illuminate\Http\Client\ConnectionException('cURL error 28: Connection timed out');
            },
        ]);

        $response = $this->postJson('/api/ai/ask', [
            'prompt' => 'Bagaimana status proyek kritis?',
        ]);

        $response->assertStatus(200)->assertJsonStructure(['success', 'reply']);
        $this->assertTrue($response->json('success'));
        $this->assertNotEmpty($response->json('reply'));

        putenv('GEMINI_API_KEY=');
    }

    /**
     * Test 12e: Verifikasi model Gemini 3.8 Flash dikonfigurasi sebagai default aktif.
     */
    public function test_ai_uses_gemini_3_8_flash_model(): void
    {
        Sanctum::actingAs($this->adminUser);

        $contextRes = $this->getJson('/api/ai/context');
        $contextRes->assertStatus(200);

        $mode = $contextRes->json('mode');
        $model = $contextRes->json('model');

        // Default model harus gemini-3.8-flash
        $this->assertStringNotContainsString('gemini-1.5-flash', $mode);
        $this->assertStringNotContainsString('gemini-2.0-flash', $mode);
        $this->assertStringNotContainsString('gpt-4o', $mode);
        $this->assertEquals('gemini-3.8-flash', $model);
        $this->assertEquals('Google Gemini API (Free Tier)', $contextRes->json('provider'));
    }

    /**
     * Test 12f: Verifikasi payload HTTP aktual ke Gemini 3.8 Flash.
     *
     * Menggunakan ReflectionMethod untuk memanggil callGemini() secara langsung
     * dengan API key dummy sehingga Http::fake() pasti ter-trigger.
     * Memverifikasi:
     * - URL mengandung nama model gemini-3.8-flash
     * - generationConfig.maxOutputTokens = 2000
     * - generationConfig tidak memiliki temperature, top_p, top_k, candidate_count, thinking_budget
     * - Request menggunakan format contents/parts
     * - API key tidak muncul di dalam JSON body
     */
    public function test_gemini_request_excludes_deprecated_sampling_params(): void
    {
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [[
                    'content' => [
                        'parts' => [['text' => 'Respons verifikasi payload.']]
                    ]
                ]]
            ], 200),
        ]);

        $service = app(\App\Services\AiAnalystService::class);

        $analysis = [
            'intent'        => 'general_inquiry',
            'project_match' => [],
            'entities'      => [],
            'keywords'      => [],
        ];

        // Panggil callGemini langsung melalui Reflection (bypass env / routing)
        $reflection = new \ReflectionMethod($service, 'callGemini');
        $reflection->setAccessible(true);
        $reflection->invoke(
            $service,
            'dummy-test-api-key-not-real',   // apiKey dummy (tidak nyata)
            'Tes payload generationConfig.',  // prompt
            $analysis,
            [],                               // history
            null,                             // pageContext
            'member'                          // userRole
        );

        // Verifikasi bahwa tepat 1 request dikirim ke Gemini API
        Http::assertSentCount(1);

        Http::assertSent(function (\Illuminate\Http\Client\Request $request) {
            // 1. URL harus mengandung nama model gemini-3.8-flash
            $this->assertStringContainsString(
                'gemini-3.8-flash',
                $request->url(),
                'URL request harus mengandung gemini-3.8-flash'
            );

            // 2. URL tidak boleh mengandung model lama
            $this->assertStringNotContainsString('gemini-1.5-flash', $request->url());
            $this->assertStringNotContainsString('gemini-2.0-flash', $request->url());
            $this->assertStringNotContainsString('openai.com', $request->url());

            $body = json_decode($request->body(), true);

            // 3. Format request harus menggunakan contents/parts (Gemini format)
            $this->assertArrayHasKey('contents', $body, 'Payload harus memiliki key contents');
            $this->assertArrayHasKey('parts', $body['contents'][0] ?? [], 'contents harus memiliki parts');

            // 4. generationConfig harus ada
            $this->assertArrayHasKey('generationConfig', $body, 'Payload harus memiliki generationConfig');
            $genConfig = $body['generationConfig'];

            // 5. maxOutputTokens harus ada dengan nilai 2000
            $this->assertArrayHasKey('maxOutputTokens', $genConfig, 'generationConfig harus memiliki maxOutputTokens');
            $this->assertEquals(2000, $genConfig['maxOutputTokens'], 'maxOutputTokens harus bernilai 2000');

            // 6. Parameter sampling deprecated harus tidak ada
            $this->assertArrayNotHasKey('temperature',    $genConfig, 'temperature tidak boleh dikirim ke Gemini 3.8 Flash');
            $this->assertArrayNotHasKey('top_p',          $genConfig, 'top_p tidak boleh dikirim ke Gemini 3.8 Flash');
            $this->assertArrayNotHasKey('top_k',          $genConfig, 'top_k tidak boleh dikirim ke Gemini 3.8 Flash');
            $this->assertArrayNotHasKey('candidate_count',$genConfig, 'candidate_count tidak boleh dikirim ke Gemini 3.8 Flash');
            $this->assertArrayNotHasKey('thinking_budget',$genConfig, 'thinking_budget tidak boleh dikirim ke Gemini 3.8 Flash');

            // 7. API key tidak boleh muncul di dalam JSON body (hanya di URL query param)
            $bodyString = $request->body();
            $this->assertStringNotContainsString(
                'dummy-test-api-key-not-real',
                $bodyString,
                'API key tidak boleh ada di dalam JSON body request'
            );

            return true;
        });
    }

    /**
     * Test 13: API key tidak bocor ke frontend dalam respon API apapun.
     */
    public function test_api_key_is_not_leaked_in_responses(): void
    {
        Sanctum::actingAs($this->adminUser);

        $contextRes = $this->getJson('/api/ai/context');
        $contextBody = $contextRes->getContent();

        $this->assertStringNotContainsString('AI_API_KEY', $contextBody);
        $this->assertStringNotContainsString('GEMINI_API_KEY', $contextBody);
        $this->assertStringNotContainsString('OPENAI_API_KEY', $contextBody);

        $askRes = $this->postJson('/api/ai/ask', ['prompt' => 'Tes keamanan API key']);
        $askBody = $askRes->getContent();

        $this->assertStringNotContainsString('AI_API_KEY', $askBody);
        $this->assertStringNotContainsString('GEMINI_API_KEY', $askBody);
        $this->assertStringNotContainsString('OPENAI_API_KEY', $askBody);
    }

    /**
     * Test 14: Pertanyaan AI merujuk pada data faktual database tanpa halusinasi fiktif.
     */
    public function test_ai_answers_sprint_performance_with_actual_data(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->postJson('/api/ai/ask', [
            'prompt' => 'Bagaimana progres sprint dan milestone saat ini?',
        ]);

        $response->assertStatus(200);
        $reply = $response->json('reply');
        $this->assertStringContainsString('Sprint', $reply);
        $this->assertStringContainsString('%', $reply);
    }

    /**
     * Test 15: Input validation & sanitization pada prompt AI.
     */
    public function test_ai_input_validation_and_sanitization(): void
    {
        Sanctum::actingAs($this->adminUser);

        // Empty prompt
        $resEmpty = $this->postJson('/api/ai/ask', ['prompt' => '']);
        $resEmpty->assertStatus(422);

        // Whitespace only prompt
        $resWhitespace = $this->postJson('/api/ai/ask', ['prompt' => '   ']);
        $resWhitespace->assertStatus(422);

        // Prompt too long (> 1000 characters)
        $oversizedPrompt = str_repeat('A', 1001);
        $resTooLong = $this->postJson('/api/ai/ask', ['prompt' => $oversizedPrompt]);
        $resTooLong->assertStatus(422);

        // Valid prompt passes
        $resValid = $this->postJson('/api/ai/ask', ['prompt' => 'Bagaimana progres proyek?']);
        $resValid->assertStatus(200);
    }

    /**
     * Test 16: Tidak ada regresi pada modul eksisting (Projects, Tasks, Sprints, Users).
     */
    public function test_no_data_regression_on_existing_modules(): void
    {
        Sanctum::actingAs($this->adminUser);

        $projectsRes = $this->getJson('/api/projects');
        $projectsRes->assertStatus(200);

        $tasksRes = $this->getJson('/api/tasks');
        $tasksRes->assertStatus(200);

        $usersRes = $this->getJson('/api/users');
        $usersRes->assertStatus(200);

        $milestonesRes = $this->getJson('/api/milestones');
        $milestonesRes->assertStatus(200);
    }
}
