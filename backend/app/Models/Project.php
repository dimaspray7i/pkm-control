<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Project extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'client',
        'pic_id',
        'pic_name',
        'progress',
        'target_progress',
        'status',
        'risk_level',
        'risk_factor',
        'deadline',
        'category',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'pic_id' => 'integer',
            'progress' => 'integer',
            'target_progress' => 'integer',
            'is_active' => 'boolean',
            'deadline' => 'date:Y-m-d',
        ];
    }

    public function pic()
    {
        return $this->belongsTo(User::class, 'pic_id');
    }

    public function tasks()
    {
        return $this->hasMany(Task::class);
    }

    public function milestones()
    {
        return $this->hasMany(Milestone::class)->orderBy('phase_order', 'asc');
    }

    /**
     * Hitung progres aktual proyek berdasarkan penyelesaian tugas (tasks).
     * Rumus: (jumlah tugas selesai / total tugas) * 100%
     * Jika tidak ada tugas: 0% (atau 100% jika status telah selesai).
     */
    public function calculateActualProgress(): int
    {
        $totalTasks = $this->tasks()->count();
        if ($totalTasks === 0) {
            return $this->status === 'completed' ? 100 : 0;
        }

        $completedTasks = $this->tasks()
            ->where(function ($q) {
                $q->where('is_completed', true)
                  ->orWhere('status', 'completed');
            })
            ->count();

        return (int) round(($completedTasks / $totalTasks) * 100);
    }

    /**
     * Sinkronisasikan kolom 'progress' dengan perhitungan aktual di database.
     */
    public function syncProgress(): int
    {
        $actual = $this->calculateActualProgress();
        if ($this->progress !== $actual) {
            $this->updateQuietly(['progress' => $actual]);
        }
        return $actual;
    }

    /**
     * Helper statis untuk sinkronisasi progres proyek tertentu.
     */
    public static function recalculateProgressFor($projectId): ?int
    {
        if (!$projectId) return null;
        $project = static::find($projectId);
        return $project ? $project->syncProgress() : null;
    }
}
