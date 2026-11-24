<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MemberPortfolioProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'headline',
        'summary_bio',
        'is_public_within_team',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'is_public_within_team' => 'boolean',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
