<?php

namespace Tests\Feature;

use App\Models\FinancialAlert;
use App\Models\FinancialBudget;
use App\Models\FinancialTransaction;
use App\Models\StrategicInitiative;
use App\Models\StrategicRisk;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FinancialTest extends TestCase
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

    private function memberToken(): array
    {
        $m = User::factory()->create(['role' => 'member']);
        $token = $m->createToken('test')->plainTextToken;
        return ['Authorization' => "Bearer $token", 'user' => $m];
    }

    public function test_admin_can_access_financial_dashboard(): void
    {
        $auth = $this->adminToken();
        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])->getJson('/api/financial/dashboard');
        $res->assertStatus(200)->assertJsonStructure(['has_data', 'summary', 'trend']);
    }

    public function test_pimpinan_can_access_financial_dashboard(): void
    {
        $auth = $this->pimpinanToken();
        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])->getJson('/api/financial/dashboard');
        $res->assertStatus(200);
    }

    public function test_member_cannot_access_financial_dashboard(): void
    {
        $auth = $this->memberToken();
        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])->getJson('/api/financial/dashboard');
        $res->assertStatus(403);
    }

    public function test_unauthenticated_cannot_access_financial(): void
    {
        $this->getJson('/api/financial/dashboard')->assertStatus(401);
    }

    public function test_admin_can_create_budget(): void
    {
        $auth = $this->adminToken();
        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])->postJson('/api/financial/budgets', [
            'label'          => 'Anggaran 2026 Tahunan',
            'fiscal_year'    => 2026,
            'fiscal_period'  => 'annual',
            'start_date'     => '2026-01-01',
            'end_date'       => '2026-12-31',
            'revenue_target' => 1000000000,
            'expense_budget' => 800000000,
        ]);
        $res->assertStatus(201)->assertJsonPath('budget.label', 'Anggaran 2026 Tahunan');
    }

    public function test_pimpinan_cannot_create_budget(): void
    {
        $auth = $this->pimpinanToken();
        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])->postJson('/api/financial/budgets', [
            'label'          => 'Test',
            'fiscal_year'    => 2026,
            'fiscal_period'  => 'annual',
            'start_date'     => '2026-01-01',
            'end_date'       => '2026-12-31',
            'revenue_target' => 100,
            'expense_budget' => 100,
        ]);
        $res->assertStatus(403);
    }

    public function test_budget_validation_requires_valid_dates(): void
    {
        $auth = $this->adminToken();
        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])->postJson('/api/financial/budgets', [
            'label'         => 'Test',
            'fiscal_year'   => 2026,
            'fiscal_period' => 'annual',
            'start_date'    => '2026-12-31',
            'end_date'      => '2026-01-01',
            'revenue_target'=> 100,
            'expense_budget'=> 100,
        ]);
        $res->assertStatus(422);
    }

    public function test_admin_can_list_budgets(): void
    {
        $auth = $this->adminToken();
        FinancialBudget::create([
            'label' => 'Test Budget', 'fiscal_year' => 2026, 'fiscal_period' => 'annual',
            'start_date' => '2026-01-01', 'end_date' => '2026-12-31',
            'revenue_target' => 1000, 'expense_budget' => 800, 'created_by' => $auth['user']->id,
        ]);
        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])->getJson('/api/financial/budgets');
        $res->assertStatus(200)->assertJsonStructure(['data', 'total', 'per_page']);
    }

    public function test_admin_cannot_delete_budget_with_transactions(): void
    {
        $auth = $this->adminToken();
        $budget = FinancialBudget::create([
            'label' => 'B2', 'fiscal_year' => 2026, 'fiscal_period' => 'annual',
            'start_date' => '2026-01-01', 'end_date' => '2026-12-31',
            'revenue_target' => 1000, 'expense_budget' => 800, 'created_by' => $auth['user']->id,
        ]);
        FinancialTransaction::create([
            'transaction_date' => '2026-06-01', 'type' => 'income',
            'category' => 'Jasa', 'description' => 'Test', 'amount' => 1000000,
            'budget_id' => $budget->id, 'recorded_by' => $auth['user']->id,
        ]);
        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])->deleteJson("/api/financial/budgets/{$budget->id}");
        $res->assertStatus(422);
    }

    public function test_admin_can_record_transaction(): void
    {
        $auth = $this->adminToken();
        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])->postJson('/api/financial/transactions', [
            'transaction_date' => '2026-06-15',
            'type'             => 'income',
            'category'         => 'Jasa Konsultasi',
            'description'      => 'Pembayaran klien X',
            'amount'           => 50000000,
        ]);
        $res->assertStatus(201)->assertJsonPath('transaction.type', 'income');
    }

    public function test_pimpinan_cannot_record_transaction(): void
    {
        $auth = $this->pimpinanToken();
        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])->postJson('/api/financial/transactions', [
            'transaction_date' => '2026-06-15',
            'type'             => 'income',
            'category'         => 'Jasa',
            'description'      => 'Test',
            'amount'           => 100,
        ]);
        $res->assertStatus(403);
    }

    public function test_transaction_amount_must_be_positive(): void
    {
        $auth = $this->adminToken();
        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])->postJson('/api/financial/transactions', [
            'transaction_date' => '2026-06-15',
            'type'             => 'income',
            'category'         => 'Jasa',
            'description'      => 'Test',
            'amount'           => -100,
        ]);
        $res->assertStatus(422);
    }

    public function test_pimpinan_can_list_transactions(): void
    {
        $admin = $this->adminToken();
        FinancialTransaction::create([
            'transaction_date' => '2026-06-01', 'type' => 'expense',
            'category' => 'Operasional', 'description' => 'Server', 'amount' => 5000000,
            'recorded_by' => $admin['user']->id,
        ]);
        $pimpinan = $this->pimpinanToken();
        $res = $this->withHeaders(['Authorization' => $pimpinan['Authorization']])->getJson('/api/financial/transactions');
        $res->assertStatus(200);
    }

    public function test_member_cannot_list_transactions(): void
    {
        $auth = $this->memberToken();
        $res = $this->withHeaders(['Authorization' => $auth['Authorization']])->getJson('/api/financial/transactions');
        $res->assertStatus(403);
    }

    public function test_dashboard_returns_correct_totals(): void
    {
        $admin = $this->adminToken();
        FinancialTransaction::create([
            'transaction_date' => '2026-06-01', 'type' => 'income',
            'category' => 'Jasa', 'description' => 'Klien A', 'amount' => 100000000,
            'recorded_by' => $admin['user']->id,
        ]);
        FinancialTransaction::create([
            'transaction_date' => '2026-06-15', 'type' => 'expense',
            'category' => 'Operasional', 'description' => 'Biaya Server', 'amount' => 30000000,
            'recorded_by' => $admin['user']->id,
        ]);
        $res = $this->withHeaders(['Authorization' => $admin['Authorization']])->getJson('/api/financial/dashboard');
        $res->assertStatus(200)
            ->assertJsonPath('summary.total_income', 100000000)
            ->assertJsonPath('summary.total_expense', 30000000)
            ->assertJsonPath('summary.net_result', 70000000)
            ->assertJsonPath('has_data', true);
    }

    public function test_budget_overrun_generates_critical_alert(): void
    {
        $admin = $this->adminToken();
        $budget = FinancialBudget::create([
            'label' => 'Operasional 2026', 'fiscal_year' => 2026, 'fiscal_period' => 'annual',
            'start_date' => '2026-01-01', 'end_date' => '2026-12-31',
            'revenue_target' => 500000000, 'expense_budget' => 100000000,
            'created_by' => $admin['user']->id,
        ]);

        FinancialTransaction::create([
            'transaction_date' => '2026-02-01', 'type' => 'expense',
            'category' => 'Operasional', 'description' => 'Biaya server & tools',
            'amount' => 120000000, 'budget_id' => $budget->id,
            'recorded_by' => $admin['user']->id,
        ]);

        $res = $this->withHeaders(['Authorization' => $admin['Authorization']])->getJson('/api/financial/alerts');
        $res->assertStatus(200);

        $this->assertDatabaseHas('financial_alerts', [
            'severity' => 'critical',
            'source' => 'budget_overrun',
            'budget_id' => $budget->id,
            'status' => 'open',
        ]);
    }

    public function test_alert_escalation_creates_strategic_risk_without_duplication(): void
    {
        $admin = $this->adminToken();
        $alert = FinancialAlert::create([
            'alert_code' => 'ALT-TEST-001',
            'title' => 'Uji Coba Anomali Finansial',
            'description' => 'Deskripsi anomali pengeluaran',
            'severity' => 'critical',
            'source' => 'budget_overrun',
            'detected_date' => '2026-06-01',
            'status' => 'open',
        ]);

        // First escalation
        $res = $this->withHeaders(['Authorization' => $admin['Authorization']])->postJson("/api/financial/alerts/{$alert->id}/escalate");
        $res->assertStatus(200);

        $this->assertDatabaseHas('strategic_risks', [
            'source' => "financial_alert_{$alert->id}",
            'category' => 'Financial',
        ]);

        // Check alert status is now acknowledged
        $this->assertEquals('acknowledged', $alert->fresh()->status);

        // Second escalation attempt should return existing risk (no duplicate created)
        $res2 = $this->withHeaders(['Authorization' => $admin['Authorization']])->postJson("/api/financial/alerts/{$alert->id}/escalate");
        $res2->assertStatus(200);
        $this->assertEquals(1, StrategicRisk::where('source', "financial_alert_{$alert->id}")->count());
    }

    public function test_executive_command_center_contains_financial_health_and_summary(): void
    {
        $admin = $this->adminToken();
        $res = $this->withHeaders(['Authorization' => $admin['Authorization']])->getJson('/api/leadership/command-center');
        $res->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'company_health_index',
                'financial_health' => ['status', 'label', 'color'],
                'financial_summary' => ['total_income', 'total_expense', 'net_result', 'budget_utilization'],
            ]);
    }

    public function test_strategic_initiative_reconciliation_endpoint(): void
    {
        $admin = $this->adminToken();
        $init = StrategicInitiative::create([
            'code' => 'SI-FIN-01',
            'title' => 'Ekspansi Digital',
            'category' => 'Technology',
            'priority' => 'high',
            'status' => 'active',
            'progress' => 40,
            'allocated_budget' => 50000000,
            'spent_budget' => 10000000,
            'created_by' => $admin['user']->id,
        ]);

        FinancialTransaction::create([
            'transaction_date' => '2026-03-01', 'type' => 'expense',
            'category' => 'Infrastruktur', 'description' => 'Server Cloud',
            'amount' => 15000000, 'initiative_id' => $init->id,
            'recorded_by' => $admin['user']->id,
        ]);

        $res = $this->withHeaders(['Authorization' => $admin['Authorization']])->getJson("/api/financial/initiatives/{$init->id}/reconciliation");
        $res->assertStatus(200)
            ->assertJsonPath('allocated_budget', 50000000)
            ->assertJsonPath('actual_transaction_expense', 15000000)
            ->assertJsonPath('remaining_budget', 35000000)
            ->assertJsonPath('is_over_budget', false);
    }
}

