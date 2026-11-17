<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('financial_alerts', function (Blueprint $table) {
            $table->id();
            $table->string('alert_code', 50)->unique();
            $table->string('title', 255);
            $table->text('description');
            $table->enum('severity', ['info', 'warning', 'critical'])->default('warning');
            $table->string('source', 100);
            $table->decimal('related_amount', 15, 2)->nullable();
            $table->foreignId('budget_id')->nullable()->constrained('financial_budgets')->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->foreignId('initiative_id')->nullable()->constrained('strategic_initiatives')->nullOnDelete();
            $table->date('detected_date');
            $table->text('recommendation')->nullable();
            $table->enum('status', ['open', 'acknowledged', 'resolved'])->default('open');
            $table->foreignId('acknowledged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('acknowledged_at')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->text('resolution_notes')->nullable();
            $table->timestamps();

            $table->index(['status', 'severity'], 'fa_status_severity_idx');
            $table->index('detected_date', 'fa_detected_date_idx');
            $table->index('source', 'fa_source_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('financial_alerts');
    }
};
