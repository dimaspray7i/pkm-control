<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TaskUpdate extends Model
{
    use HasFactory;

    protected $fillable = [
        'task_id',
        'user_id',
        'work_description',
        'completed_checklists',
        'total_checklists',
        'progress_snapshot',
        'blocker',
        'next_plan',
        'attachment_path',
        'attachment_name',
    ];

    protected $appends = [
        'has_attachment',
    ];

    protected function casts(): array
    {
        return [
            'task_id' => 'integer',
            'user_id' => 'integer',
            'completed_checklists' => 'integer',
            'total_checklists' => 'integer',
            'progress_snapshot' => 'integer',
        ];
    }

    public function getHasAttachmentAttribute(): bool
    {
        return !empty($this->attachment_path);
    }

    public function task()
    {
        return $this->belongsTo(Task::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
