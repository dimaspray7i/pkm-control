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
        // 1. Tabel Profil Ringkasan Portofolio Member (Headline & Bio)
        if (!Schema::hasTable('member_portfolio_profiles')) {
            Schema::create('member_portfolio_profiles', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->unique()->constrained('users')->onDelete('cascade');
                $table->string('headline', 255)->nullable();
                $table->text('summary_bio')->nullable();
                $table->boolean('is_public_within_team')->default(false);
                $table->timestamps();
            });
        }

        // 2. Tabel Pencapaian Portofolio Profesional (Portfolio Achievements)
        if (!Schema::hasTable('member_portfolio_achievements')) {
            Schema::create('member_portfolio_achievements', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
                $table->foreignId('skill_id')->nullable()->constrained('member_skills')->nullOnDelete();
                $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('title', 255);
                $table->string('category', 50)->default('project_achievement');
                $table->text('description');
                $table->date('achievement_date');
                $table->text('result_impact')->nullable();
                $table->string('evidence_url', 500)->nullable();
                $table->text('evidence_notes')->nullable();
                $table->string('verification_status', 30)->default('draft'); // draft, pending_verification, verified, revision_requested
                $table->timestamp('verified_at')->nullable();
                $table->boolean('is_featured')->default(false);
                $table->boolean('is_visible')->default(true);
                $table->integer('sort_order')->default(0);
                $table->timestamps();

                $table->index(['user_id', 'verification_status']);
                $table->index(['user_id', 'category']);
                $table->index(['user_id', 'is_featured']);
                $table->index(['project_id']);
                $table->index(['skill_id']);
            });
        }

        // 3. Tabel Riwayat Audit Verifikasi Pencapaian (Verification History)
        if (!Schema::hasTable('member_portfolio_verifications')) {
            Schema::create('member_portfolio_verifications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('achievement_id')->constrained('member_portfolio_achievements')->onDelete('cascade');
                $table->foreignId('reviewer_id')->constrained('users')->onDelete('cascade');
                $table->string('action', 30); // submitted, verified, revision_requested, resubmitted
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['achievement_id', 'created_at']);
                $table->index(['reviewer_id']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('member_portfolio_verifications');
        Schema::dropIfExists('member_portfolio_achievements');
        Schema::dropIfExists('member_portfolio_profiles');
    }
};
