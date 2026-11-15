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
        // Jika tabel tasks hilang (misal akibat crash pemulihan DB), pulihkan tabel dasar terlebih dahulu
        if (!Schema::hasTable('tasks')) {
            Schema::create('tasks', function (Blueprint $table) {
                $table->id();
                $table->foreignId('project_id')->constrained('projects')->onDelete('cascade');
                $table->foreignId('milestone_id')->nullable()->constrained('milestones')->nullOnDelete();
                $table->string('title');
                $table->string('priority', 20)->default('medium');
                $table->string('status', 30)->default('pending');
                $table->boolean('is_completed')->default(false);
                $table->date('deadline')->nullable();
                $table->string('assignee_name')->nullable();
                $table->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
            return;
        }

        Schema::table('tasks', function (Blueprint $table) {
            if (!Schema::hasColumn('tasks', 'milestone_id')) {
                $table->foreignId('milestone_id')->nullable()->after('project_id')->constrained('milestones')->nullOnDelete();
            }
            if (!Schema::hasColumn('tasks', 'assignee_id')) {
                $table->foreignId('assignee_id')->nullable()->after('assignee_name')->constrained('users')->nullOnDelete();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('tasks')) {
            Schema::table('tasks', function (Blueprint $table) {
                if (Schema::hasColumn('tasks', 'milestone_id')) {
                    $table->dropForeign(['milestone_id']);
                    $table->dropColumn(['milestone_id']);
                }
                if (Schema::hasColumn('tasks', 'assignee_id')) {
                    $table->dropForeign(['assignee_id']);
                    $table->dropColumn(['assignee_id']);
                }
            });
        }
    }
};
