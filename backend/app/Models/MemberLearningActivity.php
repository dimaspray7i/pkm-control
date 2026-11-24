<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MemberLearningActivity extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'skill_id',
        'goal_id',
        'title',
        'activity_type',
        'description',
        'activity_date',
        'duration_minutes',
        'learning_source',
        'learning_notes',
        'evidence_url',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'user_id'          => 'integer',
            'skill_id'         => 'integer',
            'goal_id'          => 'integer',
            'duration_minutes' => 'integer',
            'activity_date'    => 'date:Y-m-d',
        ];
    }

    public const TYPE_LABELS = [
        'self_learning'       => 'Belajar Mandiri',
        'online_course'       => 'Kursus Online',
        'offline_training'    => 'Pelatihan Offline',
        'workshop'            => 'Workshop / Seminar',
        'mentoring'           => 'Mentoring / Coaching',
        'reading_research'    => 'Membaca & Riset',
        'practice_experiment' => 'Praktik & Eksperimen',
        'other'               => 'Lainnya',
    ];

    public function getTypeLabelAttribute(): string
    {
        return self::TYPE_LABELS[$this->activity_type] ?? 'Lainnya';
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function skill()
    {
        return $this->belongsTo(MemberSkill::class, 'skill_id');
    }

    public function goal()
    {
        return $this->belongsTo(MemberDevelopmentGoal::class, 'goal_id');
    }
}
