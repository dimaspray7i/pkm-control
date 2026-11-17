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
        if (!Schema::hasTable('executive_reports')) {
            Schema::create('executive_reports', function (Blueprint $table) {
                $table->id();
                $table->string('report_number', 50)->unique();
                $table->string('title');
                $table->string('report_type', 30)->default('monthly'); // daily, weekly, monthly, quarterly, custom
                $table->date('period_start');
                $table->date('period_end');
                $table->string('status', 20)->default('draft'); // draft, published
                $table->text('executive_summary')->nullable();
                $table->text('strategic_recommendations')->nullable();
                $table->text('management_attention')->nullable();
                $table->json('snapshot_data')->nullable();
                $table->foreignId('generated_by')->constrained('users')->cascadeOnDelete();
                $table->timestamp('published_at')->nullable();
                $table->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->unique(['report_type', 'period_start', 'period_end'], 'exec_rep_type_period_unique');
                $table->index(['status', 'report_type']);
                $table->index(['period_start', 'period_end']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('executive_reports');
    }
};
