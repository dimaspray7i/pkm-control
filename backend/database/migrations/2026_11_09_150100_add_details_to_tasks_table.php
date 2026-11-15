<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            if (!Schema::hasColumn('tasks', 'description')) {
                $table->text('description')->nullable()->after('title');
            }
            if (!Schema::hasColumn('tasks', 'start_date')) {
                $table->date('start_date')->nullable()->after('deadline');
            }
            if (!Schema::hasColumn('tasks', 'created_by')) {
                $table->foreignId('created_by')->nullable()->after('assignee_id')->constrained('users')->nullOnDelete();
            }
        });

        // Pada MySQL, ubah tipe kolom enum agar mendukung prioritas 'urgent' dan status baru jika diperlukan
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE tasks MODIFY COLUMN priority VARCHAR(20) DEFAULT 'medium'");
            DB::statement("ALTER TABLE tasks MODIFY COLUMN status VARCHAR(30) DEFAULT 'pending'");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('tasks')) {
            Schema::table('tasks', function (Blueprint $table) {
                if (Schema::hasColumn('tasks', 'created_by')) {
                    $table->dropForeign(['created_by']);
                    $table->dropColumn(['created_by']);
                }
                if (Schema::hasColumn('tasks', 'description')) {
                    $table->dropColumn(['description']);
                }
                if (Schema::hasColumn('tasks', 'start_date')) {
                    $table->dropColumn(['start_date']);
                }
            });
        }
    }
};
