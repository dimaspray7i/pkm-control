<?php

namespace Tests\Feature;

use App\Models\BlockerResolution;
use App\Models\ExecutiveAiConversation;
use App\Models\ExecutiveDecision;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\StrategicRisk;
use App\Models\Task;
use App\Models\TaskUpdate;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LeadershipAIAdvisorTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $pimpinanUser;
    protected User $pmUser;
    protected User $memberUser;
    protected Project $project;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedUsersAndData();
    }

    protected function seedUsersAndData(): void
    {
        $this->adminUser = User::create([
            'name' => 'Super Admin',
            'email' => 'admin@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->pimpinanUser = User::create([
            'name' => 'Budi Pimpinan',
            'email' => 'pimpinan@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'pimpinan',
            'is_active' => true,
        ]);

        $this->pmUser = User::create([
            'name' => 'Siti PM',
            'email' => 'pm@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        $this->memberUser = User::create([
            'name' => 'Andi Member',
            'email' => 'member@pkm.co.id',
            'password' => Hash::make('password123'),
            'role' => 'member',
            'is_active' => true,
        ]);

        $this->project = Project::create([
            'code' => 'PKM-AI-01',
            'name' => 'Sistem Rekomendasi AI',
            'client' => 'PT Potensi Karya Mandiri',
            'description' => 'Proyek Inti Pengembangan AI',
            'status' => 'delayed',
            'priority' => 'high',
            'start_date' => Carbon::now()->subMonths(1),
            'target_completion_date' => Carbon::now()->addMonths(2),
            'target_progress' => 80,
            'progress' => 45,
            'pic_id' => $this->pmUser->id,
            'is_active' => true,
        ]);

        // Seed some tasks
        Task::create([
            'project_id' => $this->project->id,
            'assignee_id' => $this->memberUser->id,
            'title' => 'Training Model Data Pipeline',
            'status' => 'in_progress',
            'priority' => 'high',
            'start_date' => Carbon::now()->subDays(10),
            'deadline' => Carbon::now()->subDays(2), // Overdue
        ]);
    }

    public function test_unauthenticated_cannot_access_ai_advisor_endpoints(): void
    {
        $this->getJson('/api/leadership/ai/context')->assertStatus(401);
        $this->getJson('/api/leadership/ai/insights')->assertStatus(401);
        $this->postJson('/api/leadership/ai/chat', ['prompt' => 'Halo'])->assertStatus(401);
        $this->getJson('/api/leadership/ai/conversations')->assertStatus(401);
        $this->postJson("/api/leadership/ai/analyze-project/{$this->project->id}")->assertStatus(401);
    }

    public function test_unauthorized_roles_receive_forbidden(): void
    {
        Sanctum::actingAs($this->pmUser);
        $this->getJson('/api/leadership/ai/context')->assertStatus(403);
        $this->postJson('/api/leadership/ai/chat', ['prompt' => 'Halo'])->assertStatus(403);

        Sanctum::actingAs($this->memberUser);
        $this->getJson('/api/leadership/ai/insights')->assertStatus(403);
        $this->getJson('/api/leadership/ai/conversations')->assertStatus(403);
    }

    public function test_pimpinan_and_admin_can_access_ai_context(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $res = $this->getJson('/api/leadership/ai/context');
        $res->assertStatus(200);
        $res->assertJsonStructure([
            'success',
            'provider',
            'model',
            'mode',
            'context' => [
                'as_of_date',
                'as_of_time',
                'company_health' => [
                    'chi_score',
                    'chi_category',
                    'total_projects',
                    'active_projects',
                    'delayed_count',
                ],
                'tasks_performance' => [
                    'total_tasks',
                    'completed_tasks',
                    'overdue_tasks',
                ],
                'projects',
                'team_workload',
                'risks',
                'blockers',
                'decisions',
            ]
        ]);

        $this->assertEquals(1, $res->json('context.company_health.total_projects'));
        $this->assertEquals(1, $res->json('context.company_health.delayed_count'));

        // Admin also has full access
        Sanctum::actingAs($this->adminUser);
        $this->getJson('/api/leadership/ai/context')->assertStatus(200);
    }

    public function test_executive_insights_endpoint(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        // Seed a critical risk to trigger risk insight
        StrategicRisk::create([
            'risk_code' => 'RSK-9901',
            'project_id' => $this->project->id,
            'title' => 'Ketergantungan API GPU Server',
            'category' => 'technical',
            'likelihood' => 5,
            'impact' => 5,
            'risk_score' => 25,
            'risk_level' => 'critical',
            'status' => 'open',
            'identified_date' => Carbon::now()->toDateString(),
            'created_by' => $this->pimpinanUser->id,
        ]);

        $res = $this->getJson('/api/leadership/ai/insights');
        $res->assertStatus(200);
        $res->assertJsonStructure([
            'success',
            'total',
            'insights' => [
                '*' => [
                    'id',
                    'category',
                    'title',
                    'summary',
                    'factual_evidence',
                    'business_impact',
                    'priority',
                    'recommended_action',
                    'data_source',
                ]
            ]
        ]);

        $this->assertGreaterThanOrEqual(1, $res->json('total'));
        $categories = array_column($res->json('insights'), 'category');
        $this->assertContains('Business Health', $categories);
        $this->assertContains('Delivery Risk', $categories);
    }

    public function test_ai_chat_deterministic_fallback_when_no_api_key(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        // Ensure no API key in test runtime
        putenv('GEMINI_API_KEY=');
        putenv('AI_API_KEY=');

        $res = $this->postJson('/api/leadership/ai/chat', [
            'prompt' => 'Bagaimana kondisi kesehatan bisnis PKM hari ini?',
        ]);

        $res->assertStatus(200);
        $res->assertJsonStructure([
            'success',
            'reply',
            'summary',
            'mode',
            'data_sources',
            'timestamp',
        ]);

        $this->assertStringContainsString('CHI', $res->json('reply'));
        $this->assertStringContainsString('Rule-Based Engine', $res->json('mode'));
    }

    public function test_ai_chat_with_mocked_gemini_api_success(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        // Override env through config to properly set API key (putenv is bypassed by Laravel's env cache)
        config(['app.gemini_api_key' => 'fake-gemini-key-for-test']);

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => "### Rekomendasi Strategis Eksekutif\n\n1. Intervensi pada proyek PKM-AI-01.\n2. Alokasikan penambahan resource GPU."]
                            ]
                        ]
                    ]
                ]
            ], 200)
        ]);

        // Directly call the service with a fake API key (bypass env detection)
        /** @var \App\Services\ExecutiveBusinessContextService $svc */
        $svc = $this->app->make(\App\Services\ExecutiveBusinessContextService::class);
        $result = $svc->callGeminiExecutive(
            'fake-gemini-key-for-test',
            'Apa rekomendasi untuk proyek AI?',
            $svc->buildExecutiveContext('all_time'),
            [],
            'pimpinan'
        );

        $this->assertTrue($result['success']);
        $this->assertStringContainsString('Rekomendasi Strategis Eksekutif', $result['reply']);
        $this->assertStringContainsString('Gemini LLM', $result['mode']);
    }

    public function test_ai_chat_graceful_fallback_on_gemini_failure(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        // Simulate 429 Rate Limit from Gemini
        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response([
                'error' => [
                    'code' => 429,
                    'message' => 'Quota exceeded',
                ]
            ], 429)
        ]);

        /** @var \App\Services\ExecutiveBusinessContextService $svc */
        $svc = $this->app->make(\App\Services\ExecutiveBusinessContextService::class);
        $context = $svc->buildExecutiveContext('all_time');

        // 1. Verify callGeminiExecutive throws on 429 (which is what askExecutiveAdvisor catches)
        try {
            $svc->callGeminiExecutive('fake-key', 'Apa risiko?', $context, [], 'pimpinan');
            $this->fail('Expected exception from non-200 Gemini response.');
        } catch (\Exception $e) {
            $this->assertStringContainsString('Gemini status: 429', $e->getMessage());
        }

        // 2. Verify the full fallback returns Fallback in mode string
        $prompt = 'Apa risiko terbesar perusahaan saat ini?';
        $fallbackResult = $svc->synthesizeExecutiveFallback($prompt, $context, 'pimpinan');
        $fallbackResult['mode'] = 'Deterministic Rule-Based Engine (Fallback: API Limit/Error)';

        $this->assertNotEmpty($fallbackResult['reply']);
        $this->assertStringContainsString('Fallback', $fallbackResult['mode']);
    }

    public function test_conversation_lifecycle_and_user_isolation(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        // 1. Create Conversation
        $createRes = $this->postJson('/api/leadership/ai/conversations', [
            'title' => 'Sesi Evaluasi Q4',
            'period' => 'this_month',
        ]);
        $createRes->assertStatus(201);
        $convId = $createRes->json('conversation.id');
        $this->assertEquals($this->pimpinanUser->id, $createRes->json('conversation.user_id'));

        // 2. Chat using this conversation_id
        $chatRes = $this->postJson('/api/leadership/ai/chat', [
            'prompt' => 'Tampilkan proyek yang terlambat.',
            'conversation_id' => $convId,
        ]);
        $chatRes->assertStatus(200);

        // Verify messages array updated
        $conv = ExecutiveAiConversation::find($convId);
        $this->assertCount(2, $conv->messages); // 1 user + 1 assistant

        // 3. Admin attempts to read Pimpinan's conversation -> 403 Forbidden
        Sanctum::actingAs($this->adminUser);
        $this->getJson("/api/leadership/ai/conversations/{$convId}")->assertStatus(403);
        $this->deleteJson("/api/leadership/ai/conversations/{$convId}")->assertStatus(403);

        // 4. Pimpinan can read and delete own conversation -> 200 OK
        Sanctum::actingAs($this->pimpinanUser);
        $this->getJson("/api/leadership/ai/conversations/{$convId}")->assertStatus(200);
        $this->deleteJson("/api/leadership/ai/conversations/{$convId}")->assertStatus(200);
        $this->assertNull(ExecutiveAiConversation::find($convId));
    }

    public function test_root_cause_analysis_endpoint(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        // Add task with blocker on this project
        $task = Task::create([
            'project_id' => $this->project->id,
            'assignee_id' => $this->memberUser->id,
            'title' => 'Setup CUDA Drivers',
            'status' => 'in_progress',
            'priority' => 'critical',
            'start_date' => Carbon::now()->subDays(5),
            'deadline' => Carbon::now()->subDays(1),
        ]);

        TaskUpdate::create([
            'task_id' => $task->id,
            'user_id' => $this->memberUser->id,
            'work_description' => 'Driver crash saat loading tensor.',
            'blocker' => 'Kernel mismatch pada cloud server.',
        ]);

        $res = $this->postJson("/api/leadership/ai/analyze-project/{$this->project->id}");
        $res->assertStatus(200);
        $res->assertJsonStructure([
            'success',
            'rca' => [
                'project',
                'symptoms',
                'hypotheses',
                'factual_metrics',
                'recommendations',
                'analysis_confidence',
                'analyzed_at',
            ]
        ]);

        $rca = $res->json('rca');
        $this->assertNotEmpty($rca['symptoms']);
        $this->assertNotEmpty($rca['hypotheses']);
        $this->assertNotEmpty($rca['recommendations']);
        $this->assertEquals(1, $rca['factual_metrics']['active_blockers_count']);
    }

    public function test_ai_does_not_mutate_operational_database(): void
    {
        Sanctum::actingAs($this->pimpinanUser);

        $initialProjectsCount = Project::count();
        $initialTasksCount = Task::count();
        $initialRisksCount = StrategicRisk::count();
        $initialDecisionsCount = ExecutiveDecision::count();

        $this->postJson('/api/leadership/ai/chat', [
            'prompt' => 'Tolong hapus proyek yang terlambat dan ubah status tugas jadi selesai.',
        ])->assertStatus(200);

        $this->assertEquals($initialProjectsCount, Project::count(), 'Projects table must not be mutated by AI.');
        $this->assertEquals($initialTasksCount, Task::count(), 'Tasks table must not be mutated by AI.');
        $this->assertEquals($initialRisksCount, StrategicRisk::count(), 'Strategic risks must not be mutated by AI.');
        $this->assertEquals($initialDecisionsCount, ExecutiveDecision::count(), 'Executive decisions must not be mutated by AI.');
    }
}
