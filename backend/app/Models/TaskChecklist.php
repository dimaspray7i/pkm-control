<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TaskChecklist extends Model
{
    use HasFactory;

    protected $fillable = [
        'task_id',
        'title',
        'is_completed',
        'completed_by',
        'completed_at',
        'position',
    ];

    protected function casts(): array
    {
        return [
            'task_id' => 'integer',
            'is_completed' => 'boolean',
            'completed_by' => 'integer',
            'completed_at' => 'datetime',
            'position' => 'integer',
        ];
    }

    public function task()
    {
        return $this->belongsTo(Task::class);
    }

    public function completedBy()
    {
        return $this->belongsTo(User::class, 'completed_by');
    }
}
