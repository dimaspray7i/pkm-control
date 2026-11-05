<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserPreference extends Model
{
    protected $fillable = [
        'user_id',
        'notify_task_assigned',
        'notify_task_status_changed',
        'notify_task_overdue',
        'notify_project_changed',
        'notify_system_activity',
    ];

    protected function casts(): array
    {
        return [
            'notify_task_assigned'       => 'boolean',
            'notify_task_status_changed' => 'boolean',
            'notify_task_overdue'        => 'boolean',
            'notify_project_changed'     => 'boolean',
            'notify_system_activity'     => 'boolean',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
