<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Financial Budgets — Anggaran per periode
        Schema::create('financial_budgets', function (Blueprint $table) {
            $table->id();
            $table->string('label', 100); // e.g., "Anggaran 2026 Q1"
            $table->year('fiscal_year');
            $table->enum('fiscal_period', ['monthly', 'quarterly', 'annual'])->default('annual');
            $table->string('period_code', 20)->nullable(); // e.g., "2026-Q1", "2026-01"
            $table->date('start_date');
            $table->date('end_date');
            $table->decimal('revenue_target', 15, 2)->default(0.00);
            $table->decimal('expense_budget', 15, 2)->default(0.00);
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->index(['fiscal_year', 'fiscal_period'], 'budget_period_idx');
            $table->index('is_active', 'budget_active_idx');
        });

        // 2. Financial Transactions — Pencatatan transaksi aktual
        Schema::create('financial_transactions', function (Blueprint $table) {
            $table->id();
            $table->date('transaction_date');
            $table->enum('type', ['income', 'expense']);
            $table->string('category', 100);
            $table->string('description', 500);
            $table->decimal('amount', 15, 2);
            $table->string('reference_number', 100)->nullable();
            $table->foreignId('budget_id')->nullable()->constrained('financial_budgets')->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->foreignId('initiative_id')->nullable()->constrained('strategic_initiatives')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->index(['type', 'transaction_date'], 'txn_type_date_idx');
            $table->index(['budget_id'], 'txn_budget_idx');
            $table->index(['project_id'], 'txn_project_idx');
            $table->index(['initiative_id'], 'txn_initiative_idx');
            $table->index('transaction_date', 'txn_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('financial_transactions');
        Schema::dropIfExists('financial_budgets');
    }
};
