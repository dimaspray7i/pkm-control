<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExecutiveActionHistory extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'action_id',
        'actor_id',
        'actor_name',
        'event_type',
        'old_value',
        'new_value',
        'notes',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'action_id' => 'integer',
        'actor_id' => 'integer',
    ];

    public function action()
    {
        return $this->belongsTo(ExecutiveAction::class, 'action_id');
    }

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}