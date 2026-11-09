<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Milestone extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'title',
        'description',
        'start_date',
        'phase_order',
        'progress',
        'status',
        'due_date',
    ];

    protected function casts(): array
    {
        return [
            'phase_order' => 'integer',
            'progress' => 'integer',
            'start_date' => 'date:Y-m-d',
            'due_date' => 'date:Y-m-d',
        ];
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function tasks()
    {
        return $this->hasMany(Task::class);
    }

    /**
     * Hitung progres aktual milestone/sprint berdasarkan penyelesaian tugas yang terhubung.
     * Jika ada tugas: (jumlah tugas selesai / total tugas) * 100%
     * Jika tidak ada tugas: mempertahankan progres manual yang diinput pengguna.
     */
    public function calculateActualProgress(): int
    {
        $totalTasks = $this->tasks()->count();
        if ($totalTasks === 0) {
            return (int) $this->progress;
        }

        $completedTasks = $this->tasks()
            ->where(function ($q) {
                $q->where('is_completed', true)
                  ->orWhereIn('status', ['completed', 'done']);
            })
            ->count();

        return (int) round(($completedTasks / $totalTasks) * 100);
    }

    /**
     * Sinkronisasikan kolom 'progress' dan 'status' milestone.
     */
    public function syncProgress(): int
    {
        $totalTasks = $this->tasks()->count();
        if ($totalTasks === 0) {
            return (int) $this->progress;
        }

        $actual = $this->calculateActualProgress();
        $updates = ['progress' => $actual];

        if ($actual >= 100) {
            $updates['status'] = 'completed';
        } elseif ($actual > 0 && $this->status === 'pending') {
            $updates['status'] = 'in_progress';
        } elseif ($actual < 100 && $this->status === 'completed') {
            $updates['status'] = 'in_progress';
        }

        $this->updateQuietly($updates);
        return $actual;
    }

    /**
     * Helper statis untuk sinkronisasi progres milestone tertentu.
     */
    public static function recalculateProgressFor($milestoneId): ?int
    {
        if (!$milestoneId) return null;
        $ms = static::find($milestoneId);
        return $ms ? $ms->syncProgress() : null;
    }
}
