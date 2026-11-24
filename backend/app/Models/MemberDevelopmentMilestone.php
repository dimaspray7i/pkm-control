<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MemberDevelopmentMilestone extends Model
{
    use HasFactory;

    protected $fillable = [
        'goal_id',
        'title',
        'description',
        'order',
        'target_date',
        'is_completed',
        'completed_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'goal_id'      => 'integer',
            'order'        => 'integer',
            'is_completed' => 'boolean',
            'target_date'  => 'date:Y-m-d',
            'completed_at' => 'datetime',
        ];
    }

    public function goal()
    {
        return $this->belongsTo(MemberDevelopmentGoal::class, 'goal_id');
    }
}
