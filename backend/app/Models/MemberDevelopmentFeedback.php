<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MemberDevelopmentFeedback extends Model
{
    use HasFactory;

    protected $table = 'member_development_feedbacks';

    protected $fillable = [
        'user_id',
        'reviewer_id',
        'goal_id',
        'feedback',
        'action_recommendations',
    ];

    protected function casts(): array
    {
        return [
            'user_id'     => 'integer',
            'reviewer_id' => 'integer',
            'goal_id'     => 'integer',
        ];
    }

    public function recipient()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    public function goal()
    {
        return $this->belongsTo(MemberDevelopmentGoal::class, 'goal_id');
    }
}
