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
        Schema::create('project_reports', function (Blueprint $table) {
            $table->id();
            $table->string('report_number')->nullable()->unique();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->date('period_start');
            $table->date('period_end');
            $table->string('status')->default('draft'); // draft, published
            $table->text('executive_summary')->nullable();
            $table->text('completed_work')->nullable();
            $table->text('challenges')->nullable();
            $table->text('risks')->nullable();
            $table->text('next_week_plan')->nullable();
            $table->text('support_required')->nullable();
            $table->json('snapshot_data')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['project_id', 'status']);
            $table->index(['period_start', 'period_end']);
            $table->index(['created_by', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_reports');
    }
};
