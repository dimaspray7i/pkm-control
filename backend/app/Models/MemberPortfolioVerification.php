<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MemberPortfolioVerification extends Model
{
    use HasFactory;

    protected $fillable = [
        'achievement_id',
        'reviewer_id',
        'action',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'achievement_id' => 'integer',
            'reviewer_id' => 'integer',
        ];
    }

    public function achievement()
    {
        return $this->belongsTo(MemberPortfolioAchievement::class, 'achievement_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }
}
