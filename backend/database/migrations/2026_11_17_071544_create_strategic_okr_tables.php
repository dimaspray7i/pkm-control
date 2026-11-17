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
        // 1. Strategic Objectives Table
        if (!Schema::hasTable('strategic_objectives')) {
            Schema::create('strategic_objectives', function (Blueprint $table) {
                $table->id();
                $table->string('title');
                $table->text('description')->nullable();
                $table->string('category', 60)->default('Project Delivery');
                $table->date('period_start');
                $table->date('period_end');
                $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('priority', 20)->default('high'); // low, medium, high, critical
                $table->string('status', 30)->default('draft'); // draft, active, at_risk, achieved, not_achieved, archived
                $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
                $table->timestamps();

                $table->index(['status', 'priority']);
                $table->index(['period_start', 'period_end']);
                $table->index('category');
            });
        }

        // 2. Strategic Key Results Table
        if (!Schema::hasTable('strategic_key_results')) {
            Schema::create('strategic_key_results', function (Blueprint $table) {
                $table->id();
                $table->foreignId('objective_id')->constrained('strategic_objectives')->cascadeOnDelete();
                $table->string('title');
                $table->text('description')->nullable();
                $table->string('metric_type', 30)->default('numeric_increase'); // numeric_increase, numeric_decrease, boolean, milestone_based
                $table->string('unit', 50)->nullable();
                $table->decimal('baseline_value', 12, 2)->default(0.00);
                $table->decimal('target_value', 12, 2)->default(100.00);
                $table->decimal('current_value', 12, 2)->default(0.00);
                $table->decimal('progress', 5, 2)->default(0.00); // 0.00 to 100.00%
                $table->decimal('weight', 5, 2)->default(1.00);
                $table->string('source_type', 50)->default('manual_checkin');
                $table->string('source_reference')->nullable();
                $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
                $table->date('deadline')->nullable();
                $table->string('status', 30)->default('on_track'); // on_track, behind, at_risk, achieved
                $table->timestamps();

                $table->index(['objective_id', 'status']);
                $table->index('owner_id');
            });
        }

        // 3. Strategic Objective Projects (Pivot Alignment Table)
        if (!Schema::hasTable('strategic_objective_projects')) {
            Schema::create('strategic_objective_projects', function (Blueprint $table) {
                $table->id();
                $table->foreignId('objective_id')->constrained('strategic_objectives')->cascadeOnDelete();
                $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
                $table->text('contribution_notes')->nullable();
                $table->timestamps();

                $table->unique(['objective_id', 'project_id'], 'obj_proj_unique');
                $table->index('project_id');
            });
        }

        // 4. Strategic Key Result Check-ins (Immutable Audit Log)
        if (!Schema::hasTable('strategic_key_result_checkins')) {
            Schema::create('strategic_key_result_checkins', function (Blueprint $table) {
                $table->id();
                $table->foreignId('key_result_id')->constrained('strategic_key_results')->cascadeOnDelete();
                $table->decimal('previous_value', 12, 2);
                $table->decimal('new_value', 12, 2);
                $table->decimal('progress_snapshot', 5, 2);
                $table->text('notes')->nullable();
                $table->string('evidence_reference')->nullable();
                $table->foreignId('updated_by')->constrained('users')->cascadeOnDelete();
                $table->timestamp('created_at')->useCurrent();

                $table->index(['key_result_id', 'created_at']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('strategic_key_result_checkins');
        Schema::dropIfExists('strategic_objective_projects');
        Schema::dropIfExists('strategic_key_results');
        Schema::dropIfExists('strategic_objectives');
    }
};
