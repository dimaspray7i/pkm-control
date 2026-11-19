<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BusinessIntelligenceTest extends TestCase
{
    use RefreshDatabase;

    private function adminToken(): array
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $token = $admin->createToken('test')->plainTextToken;
        return ['Authorization' => "Bearer $token", 'user' => $admin];
    }

    private function pimpinanToken(): array
    {
        $p = User::factory()->create(['role' => 'pimpinan']);
        $token = $p->createToken('test')->plainTextToken;
        return ['Authorization' => "Bearer $token", 'user' => $p];
    }

    private function pmToken(): array
    {
        $pm = User::factory()->create(['role' => 'project_manager']);
        $token = $pm->createToken('test')->plainTextToken;
        return ['Authorization' => "Bearer $token", 'user' => $pm];
    }

    private function memberToken(): array
    {
        $m = User::factory()->create(['role' => 'member']);
        $token = $m->createToken('test')->plainTextToken;
        return ['Authorization' => "Bearer $token", 'user' => $m];
    }

    public function test_intelligence_endpoint_accessible_by_admin(): void
    {
        $auth = $this->adminToken();
        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])
            ->getJson('/api/leadership/intelligence');

        $res->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    public function test_intelligence_endpoint_accessible_by_pimpinan(): void
    {
        $auth = $this->pimpinanToken();
        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])
            ->getJson('/api/leadership/intelligence');

        $res->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    public function test_intelligence_endpoint_denied_for_pm(): void
    {
        $auth = $this->pmToken();
        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])
            ->getJson('/api/leadership/intelligence');

        $res->assertStatus(403);
    }

    public function test_intelligence_endpoint_denied_for_member(): void
    {
        $auth = $this->memberToken();
        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])
            ->getJson('/api/leadership/intelligence');

        $res->assertStatus(403);
    }

    public function test_intelligence_returns_expected_structure(): void
    {
        $auth = $this->pimpinanToken();
        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])
            ->getJson('/api/leadership/intelligence');

        $res->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'cross_module_insights' => [
                    'total_insights',
                    'critical_count',
                    'high_count',
                    'medium_count',
                    'insights',
                    'generated_at',
                ],
                'project_finance_correlation' => [
                    'total_tracked_projects',
                    'projects',
                ],
                'team_workload_intelligence' => [
                    'total_members',
                    'overloaded_members_count',
                    'high_workload_count',
                    'members',
                ],
                'strategic_alignment' => [
                    'total_objectives',
                    'aligned_objectives_count',
                    'unaligned_count',
                    'objectives',
                ],
                'generated_at',
            ]);
    }

    public function test_cross_module_insights_detects_delayed_projects(): void
    {
        $auth = $this->adminToken();

        Project::factory()->create([
            'name' => 'Proyek Tertunda Alpha',
            'status' => 'delayed',
            'is_active' => true,
            'progress' => 40,
            'deadline' => Carbon::yesterday()->toDateString(),
        ]);

        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])
            ->getJson('/api/leadership/intelligence');

        $res->assertStatus(200);
        $data = $res->json('cross_module_insights');

        $this->assertGreaterThanOrEqual(1, $data['total_insights']);
        $hasDelayedInsight = collect($data['insights'])->contains(fn($i) => $i['id'] === 'insight-proj-delayed');
        $this->assertTrue($hasDelayedInsight);
    }

    public function test_cross_module_insights_handles_empty_database(): void
    {
        $auth = $this->adminToken();

        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])
            ->getJson('/api/leadership/intelligence');

        $res->assertStatus(200);
        $data = $res->json('cross_module_insights');
        $this->assertEquals(0, $data['total_insights']);
        $this->assertIsArray($data['insights']);
    }
}