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
        'priority',
        'status',
        'is_completed',
        'deadline',
        'assignee_id',
        'assignee_name',
    ];

    protected function casts(): array
    {
        return [
            'project_id' => 'integer',
            'milestone_id' => 'integer',
            'assignee_id' => 'integer',
            'is_completed' => 'boolean',
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
