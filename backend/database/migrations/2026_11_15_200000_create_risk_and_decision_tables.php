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
        // 1. Strategic Risks Table (Modul B & C: Risk Register & Assessment)
        if (!Schema::hasTable('strategic_risks')) {
            Schema::create('strategic_risks', function (Blueprint $table) {
                $table->id();
                $table->string('risk_code')->unique();
                $table->string('title');
                $table->text('description')->nullable();
                $table->string('category')->default('Operational');
                $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
                $table->string('source')->nullable();
                $table->unsignedTinyInteger('impact')->default(3); // 1-5
                $table->unsignedTinyInteger('likelihood')->default(3); // 1-5
                $table->unsignedTinyInteger('risk_score')->default(9); // impact * likelihood (1-25)
                $table->string('risk_level', 20)->default('medium'); // low, medium, high, critical
                $table->text('mitigation')->nullable();
                $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('owner_name')->nullable();
                $table->date('identified_date');
                $table->date('target_resolution_date')->nullable();
                $table->string('status', 30)->default('open'); // open, mitigating, monitoring, resolved, accepted
                $table->text('resolution_notes')->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
                $table->timestamps();

                $table->index(['status', 'risk_level']);
                $table->index('project_id');
            });
        }

        // 2. Executive Decisions Table (Modul F & G: Decision Registry & Tracking)
        if (!Schema::hasTable('executive_decisions')) {
            Schema::create('executive_decisions', function (Blueprint $table) {
                $table->id();
                $table->string('decision_number')->unique();
                $table->string('title');
                $table->text('description');
                $table->string('category')->default('Strategic Initiative');
                $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
                $table->foreignId('risk_id')->nullable()->constrained('strategic_risks')->nullOnDelete();
                $table->text('underlying_problem')->nullable();
                $table->text('rationale')->nullable();
                $table->string('priority', 20)->default('medium'); // low, medium, high, critical
                $table->date('decision_date');
                $table->foreignId('pic_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('pic_name')->nullable();
                $table->date('due_date')->nullable();
                $table->string('status', 30)->default('draft'); // draft, approved, in_progress, completed, cancelled
                $table->text('implementation_result')->nullable();
                $table->text('cancellation_reason')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
                $table->timestamps();

                $table->index(['status', 'priority']);
                $table->index(['decision_date', 'due_date']);
                $table->index('project_id');
            });
        }

        // 3. Executive Decision Audits Table (Audit Trail)
        if (!Schema::hasTable('executive_decision_audits')) {
            Schema::create('executive_decision_audits', function (Blueprint $table) {
                $table->id();
                $table->foreignId('decision_id')->constrained('executive_decisions')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('user_name');
                $table->string('action'); // created, approved, in_progress, completed, cancelled, updated
                $table->text('notes')->nullable();
                $table->json('changes')->nullable();
                $table->timestamps();

                $table->index(['decision_id', 'created_at']);
            });
        }

        // 4. Blocker Resolutions Table (Modul E: Blocker Tracking without modifying append-only task_updates)
        if (!Schema::hasTable('blocker_resolutions')) {
            Schema::create('blocker_resolutions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('task_update_id')->unique()->constrained('task_updates')->cascadeOnDelete();
                $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
                $table->string('status', 30)->default('new'); // new, acknowledged, in_progress, resolved
                $table->foreignId('acknowledged_by')->nullable()->constrained('users')->nullOnDelete();
                $table->text('resolution_notes')->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->timestamps();

                $table->index(['status', 'task_id']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('blocker_resolutions');
        Schema::dropIfExists('executive_decision_audits');
        Schema::dropIfExists('executive_decisions');
        Schema::dropIfExists('strategic_risks');
    }
};
