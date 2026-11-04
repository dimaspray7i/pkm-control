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
        Schema::table('tasks', function (Blueprint $table) {
            $table->foreignId('milestone_id')->nullable()->after('project_id')->constrained('milestones')->nullOnDelete();
            $table->foreignId('assignee_id')->nullable()->after('assignee_name')->constrained('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropForeign(['milestone_id']);
            $table->dropForeign(['assignee_id']);
            $table->dropColumn(['milestone_id', 'assignee_id']);
        });
    }
};
