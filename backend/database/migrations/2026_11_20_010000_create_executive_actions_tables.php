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
        if (!Schema::hasTable('executive_actions')) {
            Schema::create('executive_actions', function (Blueprint $table) {
                $table->id();
                $table->string('action_code')->unique();
                $table->string('title');
                $table->text('description')->nullable();
                $table->string('source_type', 50)->default('manual');
                $table->string('source_id')->nullable();
                $table->string('source_title')->nullable();
                $table->foreignId('strategic_risk_id')->nullable()->constrained('strategic_risks')->nullOnDelete();
                $table->foreignId('executive_decision_id')->nullable()->constrained('executive_decisions')->nullOnDelete();
                $table->foreignId('strategic_initiative_id')->nullable()->constrained('strategic_initiatives')->nullOnDelete();
                $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
                $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('priority', 20)->default('medium'); // critical, high, medium, low
                $table->string('status', 30)->default('pending');   // pending, in_progress, blocked, completed, cancelled
                $table->date('due_date')->nullable();
                $table->unsignedTinyInteger('progress')->default(0);
                $table->text('completion_notes')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->text('cancelled_reason')->nullable();
                $table->foreignId('converted_task_id')->nullable()->constrained('tasks')->nullOnDelete();
                $table->timestamps();

                $table->index(['status', 'priority']);
                $table->index('assigned_to');
                $table->index('due_date');
            });
        }

        if (!Schema::hasTable('executive_action_histories')) {
            Schema::create('executive_action_histories', function (Blueprint $table) {
                $table->id();
                $table->foreignId('action_id')->constrained('executive_actions')->cascadeOnDelete();
                $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('actor_name')->nullable();
                $table->string('event_type', 50);
                $table->text('old_value')->nullable();
                $table->text('new_value')->nullable();
                $table->text('notes')->nullable();
                $table->timestamp('created_at')->useCurrent();

                $table->index('action_id');
                $table->index('created_at');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('executive_action_histories');
        Schema::dropIfExists('executive_actions');
    }
};