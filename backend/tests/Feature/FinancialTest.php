<?php

namespace Tests\Feature;

use App\Models\FinancialBudget;
use App\Models\FinancialTransaction;
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
}

