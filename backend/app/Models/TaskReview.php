<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TaskReview extends Model
{
    use HasFactory;

    protected $fillable = [
        'task_id',
        'user_id',
        'action',
        'from_status',
        'to_status',
        'notes',
        'review_cycle',
    ];

    protected function casts(): array
    {
        return [
            'task_id' => 'integer',
            'user_id' => 'integer',
            'review_cycle' => 'integer',
        ];
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
