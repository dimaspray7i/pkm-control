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
        // 1. Tabel Kompetensi Personal (Member Skills)
        if (!Schema::hasTable('member_skills')) {
            Schema::create('member_skills', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                $table->string('name');
                $table->string('category', 100)->default('Technical Skills');
                $table->text('description')->nullable();
                $table->unsignedTinyInteger('current_level')->default(1); // 1: Beginner .. 5: Expert
                $table->unsignedTinyInteger('target_level')->default(3);
                $table->text('experience_notes')->nullable();
                $table->string('evidence_url', 500)->nullable();
                $table->text('evidence_notes')->nullable();
                $table->timestamps();

                $table->unique(['user_id', 'name']);
                $table->index(['user_id', 'category']);
            });
        }

        // 2. Tabel Target Pengembangan Diri (Development Goals)
        if (!Schema::hasTable('member_development_goals')) {
            Schema::create('member_development_goals', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                $table->foreignId('skill_id')->nullable()->constrained('member_skills')->nullOnDelete();
                $table->string('title');
                $table->text('description')->nullable();
                $table->unsignedTinyInteger('current_level')->nullable();
                $table->unsignedTinyInteger('target_level')->nullable();
                $table->text('reason')->nullable();
                $table->date('target_date')->nullable();
                $table->string('priority', 20)->default('medium'); // low, medium, high, urgent
                $table->string('status', 30)->default('planned'); // planned, in_progress, completed, paused, cancelled
                $table->text('cancellation_reason')->nullable();
                $table->unsignedTinyInteger('progress')->default(0); // 0 - 100
                $table->text('notes')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();

                $table->index(['user_id', 'status']);
                $table->index(['user_id', 'target_date']);
            });
        }

        // 3. Tabel Milestone Target Pengembangan (Development Milestones)
        if (!Schema::hasTable('member_development_milestones')) {
            Schema::create('member_development_milestones', function (Blueprint $table) {
                $table->id();
                $table->foreignId('goal_id')->constrained('member_development_goals')->onDelete('cascade');
                $table->string('title');
                $table->text('description')->nullable();
                $table->integer('order')->default(1);
                $table->date('target_date')->nullable();
                $table->boolean('is_completed')->default(false);
                $table->timestamp('completed_at')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['goal_id', 'order']);
            });
        }

        // 4. Tabel Aktivitas Pembelajaran Personal (Learning Activities)
        if (!Schema::hasTable('member_learning_activities')) {
            Schema::create('member_learning_activities', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                $table->foreignId('skill_id')->nullable()->constrained('member_skills')->nullOnDelete();
                $table->foreignId('goal_id')->nullable()->constrained('member_development_goals')->nullOnDelete();
                $table->string('title');
                $table->string('activity_type', 50)->default('self_learning');
                $table->text('description')->nullable();
                $table->date('activity_date');
                $table->unsignedInteger('duration_minutes')->nullable();
                $table->string('learning_source')->nullable();
                $table->text('learning_notes')->nullable();
                $table->string('evidence_url', 500)->nullable();
                $table->string('status', 30)->default('completed'); // planned, in_progress, completed
                $table->timestamps();

                $table->index(['user_id', 'activity_date']);
                $table->index(['user_id', 'activity_type']);
            });
        }

        // 5. Tabel Catatan Feedback Pengembangan PM (Development Feedbacks)
        if (!Schema::hasTable('member_development_feedbacks')) {
            Schema::create('member_development_feedbacks', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade'); // Penerima
                $table->foreignId('reviewer_id')->constrained('users')->onDelete('cascade'); // Pemberi review
                $table->foreignId('goal_id')->nullable()->constrained('member_development_goals')->nullOnDelete();
                $table->text('feedback');
                $table->text('action_recommendations')->nullable();
                $table->timestamps();

                $table->index(['user_id', 'created_at']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('member_development_feedbacks');
        Schema::dropIfExists('member_learning_activities');
        Schema::dropIfExists('member_development_milestones');
        Schema::dropIfExists('member_development_goals');
        Schema::dropIfExists('member_skills');
    }
};
