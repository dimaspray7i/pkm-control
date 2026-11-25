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
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AiUniversalIntelligenceTest extends TestCase
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
            'email' => 'admin.universal@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->pimpinanUser = User::create([
            'name' => 'Direktur PKM',
            'email' => 'direktur.universal@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'pimpinan',
            'is_active' => true,
        ]);

        $this->pmUser = User::create([
            'name' => 'Project Manager',
            'email' => 'pm.universal@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        $this->memberUser = User::create([
            'name' => 'Rian Hidayat',
            'email' => 'rian.universal@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'member',
            'is_active' => true,
        ]);

        $this->erpProject = Project::create([
            'code' => 'PKM-ERP-01',
            'name' => 'Sistem ERP PKM',
            'client' => 'PT Mandiri Jaya',
            'progress' => 85,
            'target_progress' => 85,
            'status' => 'on_track',
            'risk_level' => 'low',
            'deadline' => Carbon::now()->addDays(30)->toDateString(),
            'is_active' => true,
        ]);

        $this->delayedProject = Project::create([
            'code' => 'PKM-IOT-02',
            'name' => 'Smart Factory IoT',
            'client' => 'PT Manufaktur Maju',
            'progress' => 35,
            'target_progress' => 70,
            'status' => 'delayed',
            'risk_level' => 'high',
            'deadline' => Carbon::now()->subDays(5)->toDateString(),
            'is_active' => true,
        ]);

        Task::create([
            'project_id' => $this->delayedProject->id,
            'title' => 'Integrasi Sensor Gateway',
            'status' => 'in_progress',
            'priority' => 'critical',
            'assigned_to' => $this->memberUser->id,
            'due_date' => Carbon::now()->subDays(3)->toDateString(),
            'is_completed' => false,
        ]);
    }

    /**
     * Test 1: External trend query triggers external_only mode and includes google_search tool.
     */
    public function test_01_external_trend_query_triggers_google_search_tools(): void
    {
        putenv('AI_API_KEY=test_gemini_key_123');
        putenv('AI_MODEL=gemini-3.8-flash');

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => "### Tren Bisnis & Teknologi Terkini\nBerikut adalah tren utama:\n1. Adopsi Generative AI di Operasional Bisnis\n2. Hyperautomation & Cloud ERP"]
                            ]
                        ],
                        'groundingMetadata' => [
                            'webSearchQueries' => ['tren bisnis dan teknologi 2026 2027'],
                            'groundingChunks' => [
                                [
                                    'web' => [
                                        'uri' => 'https://www.gartner.com/top-tech-trends',
                                        'title' => 'Gartner Top Strategic Technology Trends'
                                    ]
                                ],
                                [
                                    'web' => [
                                        'uri' => 'https://www.mckinsey.com/business-trends',
                                        'title' => 'McKinsey Global Business Trends'
                                    ]
                                ]
                            ]
                        ]
                    ]
                ]
            ], 200)
        ]);

        Sanctum::actingAs($this->pimpinanUser);

        $response = $this->postJson('/api/ai/ask', [
            'prompt' => 'Apa tren bisnis & teknologi yang sedang berkembang saat ini?',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'routing_mode' => 'external_only',
                'has_grounding' => true,
            ]);

        $data = $response->json();
        $this->assertCount(2, $data['sources']);
        $this->assertEquals('Gartner Top Strategic Technology Trends', $data['sources'][0]['title']);
        $this->assertEquals('https://www.gartner.com/top-tech-trends', $data['sources'][0]['url']);
        $this->assertContains('tren bisnis dan teknologi 2026 2027', $data['search_queries']);

        // Assert HTTP request sent to Gemini contained google_search in tools
        Http::assertSent(function ($request) {
            $body = json_decode($request->body(), true);
            return isset($body['tools']) &&
                isset($body['tools'][0]['google_search']);
        });
    }

    /**
     * Test 2: Grounding metadata extraction parses chunks into structured sources.
     */
    public function test_02_grounding_metadata_parsed_into_structured_sources(): void
    {
        putenv('AI_API_KEY=test_gemini_key_123');

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => 'Analisis tren komputasi awan 2027.']
                            ]
                        ],
                        'groundingMetadata' => [
                            'webSearchQueries' => ['cloud computing trends 2027'],
                            'groundingChunks' => [
                                [
                                    'web' => [
                                        'uri' => 'https://aws.amazon.com/blogs/trends-2027',
                                        'title' => 'Cloud Trends 2027 by AWS'
                                    ]
                                ]
                            ]
                        ]
                    ]
                ]
            ], 200)
        ]);

        Sanctum::actingAs($this->adminUser);

        $response = $this->postJson('/api/ai/ask', [
            'prompt' => 'Apa peluang layanan digital baru yang bisa dimasuki di 2027?',
        ]);

        $response->assertStatus(200);
        $data = $response->json();
        $this->assertTrue($data['has_grounding']);
        $this->assertEquals('https://aws.amazon.com/blogs/trends-2027', $data['sources'][0]['url']);
        $this->assertEquals('Cloud Trends 2027 by AWS', $data['sources'][0]['title']);
    }

    /**
     * Test 3: Tech forecast query (2027) triggers external mode.
     */
    public function test_03_tech_2027_forecast_triggers_external_mode(): void
    {
        putenv('AI_API_KEY=test_gemini_key_123');

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [['text' => 'Prediksi teknologi 2027 mencakup autonomous agent...']]
                        ],
                    ]
                ]
            ], 200)
        ]);

        Sanctum::actingAs($this->pmUser);

        $response = $this->postJson('/api/ai/ask', [
            'prompt' => 'Apa tren teknologi masa depan tahun 2027 yang akan mengubah industri?',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'routing_mode' => 'external_only',
            ]);
    }

    /**
     * Test 4: Internal only query (project issues) does NOT send google_search tools.
     */
    public function test_04_internal_only_query_does_not_call_google_search(): void
    {
        putenv('AI_API_KEY=test_gemini_key_123');

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [['text' => 'Proyek Smart Factory IoT bermasalah karena keterlambatan 35% vs 70%...']]
                        ],
                    ]
                ]
            ], 200)
        ]);

        Sanctum::actingAs($this->pmUser);

        $response = $this->postJson('/api/ai/ask', [
            'prompt' => 'Coba cek proyek yang lagi bermasalah.',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'routing_mode' => 'internal_only',
                'has_grounding' => false,
            ]);

        // Assert request sent to Gemini did NOT contain tools
        Http::assertSent(function ($request) {
            $body = json_decode($request->body(), true);
            return !isset($body['tools']);
        });
    }

    /**
     * Test 5: Hybrid query triggers hybrid mode with grounding tools and PKM capacity context.
     */
    public function test_05_hybrid_query_combines_grounding_and_pkm_context(): void
    {
        putenv('AI_API_KEY=test_gemini_key_123');

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [['text' => 'Melihat tren AI saat ini dan kapasitas PKM yang memiliki 2 proyek aktif...']]
                        ],
                        'groundingMetadata' => [
                            'webSearchQueries' => ['penerapan AI efisiensi operasional b2b'],
                            'groundingChunks' => [
                                [
                                    'web' => [
                                        'uri' => 'https://hbr.org/ai-adoption',
                                        'title' => 'HBR AI Adoption in Operations'
                                    ]
                                ]
                            ]
                        ]
                    ]
                ]
            ], 200)
        ]);

        Sanctum::actingAs($this->pimpinanUser);

        $response = $this->postJson('/api/ai/ask', [
            'prompt' => 'Teknologi AI apa yang layak diterapkan untuk meningkatkan efisiensi PKM?',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'routing_mode' => 'hybrid',
                'has_grounding' => true,
            ]);

        // Assert Gemini received sanitized internal context in prompt
        Http::assertSent(function ($request) {
            $body = json_decode($request->body(), true);
            $promptText = $body['contents'][0]['parts'][0]['text'] ?? '';
            return str_contains($promptText, 'PROFIL KAPABILITAS PERUSAHAAN (PT POTENSI KARYA MANDIRI)');
        });
    }

    /**
     * Test 6: Innovation proposal returns structured 5-stage roadmap & feasibility.
     */
    public function test_06_innovation_proposal_returns_structured_roadmap(): void
    {
        // Test with Rule-Based Fallback to verify deterministic 5-stage roadmap
        putenv('AI_API_KEY=');

        Sanctum::actingAs($this->pimpinanUser);

        $response = $this->postJson('/api/ai/ask', [
            'prompt' => 'Inovasi apa yang sebaiknya diprioritaskan agar PKM lebih unggul?',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'routing_mode' => 'innovation',
            ]);

        $reply = $response->json('reply');
        $this->assertStringContainsString('Usulan Inovasi Bisnis', $reply);
        $this->assertStringContainsString('Potensi Bisnis & Dampak', $reply);
        $this->assertStringContainsString('Penilaian Kelayakan', $reply);
        $this->assertStringContainsString('Roadmap Inovasi 5-Tahap', $reply);
        $this->assertStringContainsString('Tahap 1 — Eksperimen Awal', $reply);
        $this->assertStringContainsString('Tahap 2 — Validasi Pasar', $reply);
        $this->assertStringContainsString('Tahap 3 — Pengembangan MVP', $reply);
        $this->assertStringContainsString('Tahap 4 — Evaluasi & Pilot Test', $reply);
        $this->assertStringContainsString('Tahap 5 — Peluncuran & Skalasi', $reply);
        $this->assertStringContainsString('Risiko & Hambatan', $reply);
    }

    /**
     * Test 7: Investment query compares internal vs external without fake ROI.
     */
    public function test_07_investment_query_avoids_fake_roi_and_handles_budget(): void
    {
        putenv('AI_API_KEY=');

        Sanctum::actingAs($this->pimpinanUser);

        $response = $this->postJson('/api/ai/ask', [
            'prompt' => 'Harus invest ke mana dengan budget 50 juta agar perusahaan bertumbuh?',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'routing_mode' => 'investment_research',
            ]);

        $reply = $response->json('reply');
        $this->assertStringContainsString('Rp 50.000.000', $reply);
        $this->assertStringContainsString('Perbandingan Opsi Alokasi Investasi', $reply);
        $this->assertStringContainsString('tidak menyajikan angka persentase ROI fiktif', $reply);
    }

    /**
     * Test 8: RBAC protection - Member cannot access sensitive financial numbers.
     */
    public function test_08_rbac_member_cannot_see_sensitive_financial_data(): void
    {
        putenv('AI_API_KEY=');

        Sanctum::actingAs($this->memberUser);

        $response = $this->postJson('/api/ai/ask', [
            'prompt' => 'Bagaimana analisis kesehatan keuangan dan profitabilitas saat ini?',
        ]);

        $response->assertStatus(200);
        $reply = $response->json('reply');
        $this->assertStringContainsString('Pembatasan Akses Keamanan Data', $reply);
        $this->assertStringNotContainsString('Rp ', $reply);
    }

    /**
     * Test 9: Rule-based fallback handles external query transparently when Gemini returns 500 error.
     */
    public function test_09_rule_based_fallback_handles_external_when_gemini_fails(): void
    {
        putenv('AI_API_KEY=faulty_key');

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response([
                'error' => ['message' => 'Internal API error', 'code' => 500]
            ], 500)
        ]);

        Sanctum::actingAs($this->adminUser);

        $response = $this->postJson('/api/ai/ask', [
            'prompt' => 'Apa tren bisnis & teknologi yang sedang berkembang saat ini?',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'routing_mode' => 'external_only',
                'has_grounding' => false,
            ]);

        $data = $response->json();
        $this->assertNotNull($data['note']);
        $this->assertStringContainsString('Rule-Based Engine', $data['mode']);
        $this->assertStringContainsString('Laporan Riset Tren Bisnis & Teknologi Terkini', $data['reply']);
    }

    /**
     * Test 10: Multi-intent routing classification accuracy.
     */
    public function test_10_multi_intent_routing_classification_accuracy(): void
    {
        putenv('AI_API_KEY=');
        Sanctum::actingAs($this->pimpinanUser);

        $queries = [
            'Apa tren bisnis yang sedang berkembang sekarang?' => 'external_only',
            'Apa peluang pasar cloud computing di Indonesia?' => 'external_only',
            'Coba cek proyek yang lagi bermasalah.' => 'internal_only',
            'Siapa anggota tim yang punya beban kerja paling banyak?' => 'internal_only',
            'Teknologi AI apa yang layak diterapkan untuk meningkatkan efisiensi PKM?' => 'hybrid',
            'Inovasi apa yang sebaiknya diprioritaskan agar PKM lebih unggul?' => 'innovation',
            'Harus invest ke mana agar perusahaan bertumbuh?' => 'investment_research',
        ];

        foreach ($queries as $prompt => $expectedMode) {
            $response = $this->postJson('/api/ai/ask', ['prompt' => $prompt]);
            $response->assertStatus(200);
            $this->assertEquals(
                $expectedMode,
                $response->json('routing_mode'),
                "Query '{$prompt}' was expected to be classified as '{$expectedMode}', but got '{$response->json('routing_mode')}'"
            );
        }
    }

    /**
     * Test 11: Cross-user conversational isolation.
     */
    public function test_11_cross_user_conversational_isolation(): void
    {
        putenv('AI_API_KEY=');

        // Admin asks question
        Sanctum::actingAs($this->adminUser);
        $resAdmin = $this->postJson('/api/ai/ask', [
            'prompt' => 'Baca kondisi bisnis PKM sekarang dan harus ke mana melangkah?',
        ]);
        $resAdmin->assertStatus(200);
        $this->assertStringContainsString('Ringkasan Eksekutif & Posisi Bisnis Saat Ini', $resAdmin->json('reply'));

        // Member asks personal task question
        Sanctum::actingAs($this->memberUser);
        $resMember = $this->postJson('/api/ai/ask', [
            'prompt' => 'Tugas apa yang harus saya selesaikan hari ini?',
        ]);
        $resMember->assertStatus(200);
        $this->assertStringContainsString('Prioritas Tindakan Hari Ini', $resMember->json('reply'));
    }

    /**
     * Test 12: Context endpoint returns grounding support metadata.
     */
    public function test_12_context_endpoint_returns_grounding_support_metadata(): void
    {
        putenv('AI_API_KEY=test_key');
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/ai/context');
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'google_search_grounding_supported' => true,
                'supported_modes' => [
                    'external_only',
                    'internal_only',
                    'hybrid',
                    'innovation',
                    'investment_research',
                    'general_knowledge',
                ],
            ]);
    }
}
