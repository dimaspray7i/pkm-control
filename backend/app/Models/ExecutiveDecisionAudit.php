<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExecutiveDecisionAudit extends Model
{
    use HasFactory;

    protected $fillable = [
        'decision_id',
        'user_id',
        'user_name',
        'action',
        'notes',
        'changes',
    ];

    protected function casts(): array
    {
        return [
            'decision_id' => 'integer',
            'user_id' => 'integer',
            'changes' => 'array',
        ];
    }

    public function decision()
    {
        return $this->belongsTo(ExecutiveDecision::class, 'decision_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
