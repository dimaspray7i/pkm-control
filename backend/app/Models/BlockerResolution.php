<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BlockerResolution extends Model
{
    use HasFactory;

    protected $fillable = [
        'task_update_id',
        'task_id',
        'status',
        'acknowledged_by',
        'resolution_notes',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'task_update_id' => 'integer',
            'task_id' => 'integer',
            'acknowledged_by' => 'integer',
            'resolved_at' => 'datetime',
        ];
    }

    public function taskUpdate()
    {
        return $this->belongsTo(TaskUpdate::class, 'task_update_id');
    }

    public function task()
    {
        return $this->belongsTo(Task::class, 'task_id');
    }

    public function acknowledgedBy()
    {
        return $this->belongsTo(User::class, 'acknowledged_by');
    }
}
