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
        Schema::create('user_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 50); // task_assigned, review_approved, review_revision, task_reopened, deadline_near, deadline_today, deadline_overdue, work_progress
            $table->string('title', 255);
            $table->text('message');
            $table->foreignId('task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete(); // PM/User yang memicu
            $table->json('data')->nullable(); // metadata tambahan (e.g. deadline, revision_notes, diff_days, project_code)
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'is_read', 'created_at'], 'un_user_read_created_idx');
            $table->index(['user_id', 'type'], 'un_user_type_idx');
            $table->index(['task_id', 'type'], 'un_task_type_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_notifications');
    }
};
