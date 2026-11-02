<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Task extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'title',
        'priority',
        'status',
        'is_completed',
        'deadline',
        'assignee_name',
    ];

    protected function casts(): array
    {
        return [
            'is_completed' => 'boolean',
            'deadline' => 'date:Y-m-d',
        ];
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * Booted model hooks untuk otomatis menghitung ulang progres proyek.
     */
    protected static function booted(): void
    {
        static::saved(function (Task $task) {
            if ($task->project_id) {
                Project::recalculateProgressFor($task->project_id);
            }
        });

        static::deleted(function (Task $task) {
            if ($task->project_id) {
                Project::recalculateProgressFor($task->project_id);
            }
        });
    }
}
