<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StrategicKeyResultCheckin extends Model
{
    use HasFactory;

    // Immutable checkin table: does not update 'updated_at'
    const UPDATED_AT = null;

    protected $fillable = [
        'key_result_id',
        'previous_value',
        'new_value',
        'progress_snapshot',
        'notes',
        'evidence_reference',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'previous_value' => 'float',
            'new_value' => 'float',
            'progress_snapshot' => 'float',
            'created_at' => 'datetime',
        ];
    }

    public function keyResult()
    {
        return $this->belongsTo(StrategicKeyResult::class, 'key_result_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
