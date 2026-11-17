<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StrategicResourceAllocation extends Model
{
    use HasFactory;

    protected $table = 'strategic_resource_allocations';

    protected $fillable = [
        'initiative_id',
        'user_id',
        'role_in_initiative',
        'allocation_percentage',
        'start_date',
        'end_date',
        'notes',
    ];

    protected $casts = [
        'allocation_percentage' => 'integer',
        'start_date' => 'date:Y-m-d',
        'end_date' => 'date:Y-m-d',
    ];

    public function initiative()
    {
        return $this->belongsTo(StrategicInitiative::class, 'initiative_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
