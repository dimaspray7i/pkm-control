<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MemberDevelopmentGoal extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'skill_id',
        'title',
        'description',
        'current_level',
        'target_level',
        'reason',
        'target_date',
        'priority',
        'status',
        'cancellation_reason',
        'progress',
        'notes',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'user_id'       => 'integer',
            'skill_id'      => 'integer',
            'current_level' => 'integer',
            'target_level'  => 'integer',
            'progress'      => 'integer',
            'target_date'   => 'date:Y-m-d',
            'completed_at'  => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function skill()
    {
        return $this->belongsTo(MemberSkill::class, 'skill_id');
    }

    public function milestones()
    {
        return $this->hasMany(MemberDevelopmentMilestone::class, 'goal_id')->orderBy('order', 'asc');
    }

    public function activities()
    {
        return $this->hasMany(MemberLearningActivity::class, 'goal_id');
    }

    public function feedbacks()
    {
        return $this->hasMany(MemberDevelopmentFeedback::class, 'goal_id');
    }

    /**
     * Hitung ulang persentase progres goal berdasarkan milestone yang selesai.
     */
    public function recalculateProgress(): int
    {
        $total = $this->milestones()->count();
        if ($total === 0) {
            return (int) $this->progress;
        }

        $completed = $this->milestones()->where('is_completed', true)->count();
        $calc = (int) round(($completed / $total) * 100);
        $this->progress = $calc;

        if ($calc === 100 && $this->status === 'planned') {
            $this->status = 'in_progress';
        }

        $this->saveQuietly();
        return $calc;
    }
}
