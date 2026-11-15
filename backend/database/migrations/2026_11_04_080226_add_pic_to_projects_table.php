
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('projects', 'pic_id')) {
            Schema::table('projects', function (Blueprint $table) {
                $table->unsignedBigInteger('pic_id')->nullable()->after('client');
            });
        }

        if (!Schema::hasColumn('projects', 'pic_name')) {
            Schema::table('projects', function (Blueprint $table) {
                $table->string('pic_name')->nullable()->after('pic_id');
            });
        }

        // Buat foreign key hanya jika belum tersedia.
        $foreignExists = false;
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $foreignExists = collect(
                \Illuminate\Support\Facades\DB::select("
                    SELECT CONSTRAINT_NAME
                    FROM information_schema.KEY_COLUMN_USAGE
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'projects'
                    AND COLUMN_NAME = 'pic_id'
                    AND REFERENCED_TABLE_NAME = 'users'
                ")
            )->isNotEmpty();
        }

        if (!$foreignExists) {
            Schema::table('projects', function (Blueprint $table) {
                $table->foreign('pic_id')
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        // Tidak menghapus kolom atau relasi hasil pemulihan database.
    }
};
