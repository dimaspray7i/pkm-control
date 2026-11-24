<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MemberSkill extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'category',
        'description',
        'current_level',
        'target_level',
        'experience_notes',
        'evidence_url',
        'evidence_notes',
    ];

    protected function casts(): array
    {
        return [
            'user_id'       => 'integer',
            'current_level' => 'integer',
            'target_level'  => 'integer',
        ];
    }

    public const LEVEL_LABELS = [
        1 => 'Beginner',
        2 => 'Basic',
        3 => 'Intermediate',
        4 => 'Advanced',
        5 => 'Expert',
    ];

    public function getLevelLabelAttribute(): string
    {
        return self::LEVEL_LABELS[$this->current_level] ?? 'Beginner';
    }

    public function getTargetLevelLabelAttribute(): string
    {
        return self::LEVEL_LABELS[$this->target_level] ?? 'Intermediate';
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function goals()
    {
        return $this->hasMany(MemberDevelopmentGoal::class, 'skill_id');
    }

    public function activities()
    {
        return $this->hasMany(MemberLearningActivity::class, 'skill_id');
    }

    public function portfolioAchievements()
    {
        return $this->hasMany(MemberPortfolioAchievement::class, 'skill_id');
    }
}
