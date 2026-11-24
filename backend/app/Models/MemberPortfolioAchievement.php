<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MemberPortfolioAchievement extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'project_id',
        'skill_id',
        'verified_by',
        'title',
        'category',
        'description',
        'achievement_date',
        'result_impact',
        'evidence_url',
        'evidence_notes',
        'verification_status',
        'verified_at',
        'is_featured',
        'is_visible',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'project_id' => 'integer',
            'skill_id' => 'integer',
            'verified_by' => 'integer',
            'achievement_date' => 'date:Y-m-d',
            'verified_at' => 'datetime',
            'is_featured' => 'boolean',
            'is_visible' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public const CATEGORIES = [
        'project_achievement' => 'Project Achievement',
        'technical_achievement' => 'Technical Achievement',
        'process_improvement' => 'Process Improvement',
        'team_contribution' => 'Team Contribution',
        'learning_achievement' => 'Learning Achievement',
        'innovation' => 'Innovation',
        'other_achievement' => 'Other Achievement',
    ];

    public const STATUSES = [
        'draft' => 'Draft',
        'pending_verification' => 'Pending Verification',
        'verified' => 'Verified',
        'revision_requested' => 'Revision Requested',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function skill()
    {
        return $this->belongsTo(MemberSkill::class, 'skill_id');
    }

    public function verifier()
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function verifications()
    {
        return $this->hasMany(MemberPortfolioVerification::class, 'achievement_id')->orderBy('created_at', 'desc');
    }

    public function latestVerification()
    {
        return $this->hasOne(MemberPortfolioVerification::class, 'achievement_id')->latestOfMany();
    }
}
