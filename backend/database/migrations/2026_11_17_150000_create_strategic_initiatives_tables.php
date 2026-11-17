<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop partial tables if existed from failed run
        Schema::dropIfExists('strategic_initiative_projects');
        Schema::dropIfExists('strategic_resource_allocations');
        Schema::dropIfExists('strategic_initiatives');

        // 1. Strategic Initiatives Table
        Schema::create('strategic_initiatives', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->foreignId('objective_id')->nullable()->constrained('strategic_objectives')->nullOnDelete();
            $table->foreignId('lead_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('category', 60)->default('Operational Expansion'); // Operational Expansion, Tech Innovation, Process Improvement, Market Penetration, Quality & Compliance
            $table->enum('priority', ['low', 'medium', 'high', 'critical'])->default('high');
            $table->enum('status', ['draft', 'planned', 'active', 'on_hold', 'completed', 'cancelled'])->default('planned');
            $table->date('start_date')->nullable();
            $table->date('target_date')->nullable();
            $table->decimal('progress', 5, 2)->default(0.00);
            $table->decimal('allocated_budget', 15, 2)->default(0.00);
            $table->decimal('spent_budget', 15, 2)->default(0.00);
            $table->text('strategic_rationale')->nullable();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->index(['status', 'priority'], 'init_status_priority_idx');
            $table->index('category', 'init_category_idx');
            $table->index('target_date', 'init_target_date_idx');
        });

        // 2. Strategic Resource Allocations Table
        Schema::create('strategic_resource_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('initiative_id')->constrained('strategic_initiatives')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role_in_initiative', 100)->default('Specialist');
            $table->unsignedInteger('allocation_percentage')->default(100);
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['initiative_id', 'user_id'], 'init_user_unique');
            $table->index(['user_id', 'allocation_percentage'], 'res_user_alloc_idx');
        });

        // 3. Strategic Initiative Projects Table (Many-to-Many Pivot)
        Schema::create('strategic_initiative_projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('initiative_id')->constrained('strategic_initiatives')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->text('impact_description')->nullable();
            $table->timestamps();

            $table->unique(['initiative_id', 'project_id'], 'init_proj_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('strategic_initiative_projects');
        Schema::dropIfExists('strategic_resource_allocations');
        Schema::dropIfExists('strategic_initiatives');
    }
};
