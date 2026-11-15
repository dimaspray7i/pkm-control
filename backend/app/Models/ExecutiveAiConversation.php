<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExecutiveAiConversation extends Model
{
    use HasFactory;

    protected $table = 'executive_ai_conversations';

    protected $fillable = [
        'user_id',
        'title',
        'period',
        'messages',
    ];

    protected $casts = [
        'messages' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
