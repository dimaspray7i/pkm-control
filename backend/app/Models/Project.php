<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Project extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'client',
        'progress',
        'target_progress',
        'status',
        'risk_level',
        'risk_factor',
        'deadline',
        'category',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'progress' => 'integer',
            'target_progress' => 'integer',
            'is_active' => 'boolean',
            'deadline' => 'date:Y-m-d',
        ];
    }

    public function tasks()
    {
        return $this->hasMany(Task::class);
    }

    public function milestones()
    {
        return $this->hasMany(Milestone::class)->orderBy('phase_order', 'asc');
    }
}
