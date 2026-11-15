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
        if (!Schema::hasTable('projects')) {
            Schema::create('projects', function (Blueprint $table) {
                $table->id();
                $table->string('code')->unique();
                $table->string('name');
                $table->string('client');
                $table->integer('progress')->default(0);
                $table->integer('target_progress')->nullable()->default(0);
                $table->enum('status', ['on_track', 'at_risk', 'delayed', 'completed'])->default('on_track');
                $table->enum('risk_level', ['none', 'low', 'medium', 'high'])->default('low');
                $table->text('risk_factor')->nullable();
                $table->date('deadline')->nullable();
                $table->string('category')->default('web');
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('tasks')) {
            Schema::create('tasks', function (Blueprint $table) {
                $table->id();
                $table->foreignId('project_id')->constrained('projects')->onDelete('cascade');
                $table->string('title');
                $table->string('priority', 20)->default('medium');
                $table->string('status', 30)->default('pending');
                $table->boolean('is_completed')->default(false);
                $table->date('deadline')->nullable();
                $table->string('assignee_name')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('activities')) {
            Schema::create('activities', function (Blueprint $table) {
                $table->id();
                $table->string('user_name');
                $table->string('action');
                $table->string('target_name')->nullable();
                $table->string('project_name')->nullable();
                $table->string('avatar_color')->default('pink');
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('activities');
        Schema::dropIfExists('tasks');
        Schema::dropIfExists('projects');
    }
};
