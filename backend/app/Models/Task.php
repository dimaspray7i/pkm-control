<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Task extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'milestone_id',
        'title',
        'description',
        'priority',
        'status',
        'is_completed',
        'start_date',
        'deadline',
        'assignee_id',
        'assignee_name',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'project_id' => 'integer',
            'milestone_id' => 'integer',
            'assignee_id' => 'integer',
            'created_by' => 'integer',
            'is_completed' => 'boolean',
            'start_date' => 'date:Y-m-d',
            'deadline' => 'date:Y-m-d',
        ];
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function milestone()
    {
        return $this->belongsTo(Milestone::class);
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function checklists()
    {
        return $this->hasMany(TaskChecklist::class)->orderBy('position', 'asc');
    }

    public function updates()
    {
        return $this->hasMany(TaskUpdate::class)->orderBy('created_at', 'desc');
    }

    public function reviews()
    {
        return $this->hasMany(TaskReview::class)->orderBy('created_at', 'desc');
    }

    public function latestReview()
    {
        return $this->hasOne(TaskReview::class)->latestOfMany();
    }

    /**
     * Hitung persentase progres checklist secara otomatis.
     * Progress = (Checklist selesai / Total checklist) * 100%
     */
    public function calculateChecklistProgress(): int
    {
        $total = $this->checklists()->count();
        if ($total === 0) {
            return 0;
        }
        $completed = $this->checklists()->where('is_completed', true)->count();
        return (int) round(($completed / $total) * 100);
    }

    /**
     * Ambil statistik checklist ringkas.
     */
    public function getChecklistStats(): array
    {
        $total = $this->checklists()->count();
        $completed = $total > 0 ? $this->checklists()->where('is_completed', true)->count() : 0;
        $progress = $total > 0 ? (int) round(($completed / $total) * 100) : 0;

        return [
            'total' => $total,
            'completed' => $completed,
            'progress' => $progress,
        ];
    }

    /**
     * Booted model hooks untuk otomatis menghitung ulang progres proyek dan sprint/milestone.
     */
    protected static function booted(): void
    {
        static::saved(function (Task $task) {
            if ($task->project_id) {
                Project::recalculateProgressFor($task->project_id);
            }
            if ($task->milestone_id) {
                Milestone::recalculateProgressFor($task->milestone_id);
            }
            // Jika milestone_id berubah dari nilai sebelumnya, hitung ulang milestone lama juga
            if ($task->isDirty('milestone_id') && $task->getOriginal('milestone_id')) {
                Milestone::recalculateProgressFor($task->getOriginal('milestone_id'));
            }
        });

        static::deleted(function (Task $task) {
            if ($task->project_id) {
                Project::recalculateProgressFor($task->project_id);
            }
            if ($task->milestone_id) {
                Milestone::recalculateProgressFor($task->milestone_id);
            }
        });
    }
}
