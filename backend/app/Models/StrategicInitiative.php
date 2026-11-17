<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StrategicInitiative extends Model
{
    use HasFactory;

    protected $table = 'strategic_initiatives';

    protected $fillable = [
        'code',
        'title',
        'description',
        'objective_id',
        'lead_id',
        'category',
        'priority',
        'status',
        'start_date',
        'target_date',
        'progress',
        'allocated_budget',
        'spent_budget',
        'strategic_rationale',
        'created_by',
    ];

    protected $casts = [
        'progress' => 'float',
        'allocated_budget' => 'float',
        'spent_budget' => 'float',
        'start_date' => 'date:Y-m-d',
        'target_date' => 'date:Y-m-d',
    ];

    public function objective()
    {
        return $this->belongsTo(StrategicObjective::class, 'objective_id');
    }

    public function lead()
    {
        return $this->belongsTo(User::class, 'lead_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function resourceAllocations()
    {
        return $this->hasMany(StrategicResourceAllocation::class, 'initiative_id');
    }

    public function resources()
    {
        return $this->belongsToMany(User::class, 'strategic_resource_allocations', 'initiative_id', 'user_id')
            ->withPivot(['id', 'role_in_initiative', 'allocation_percentage', 'start_date', 'end_date', 'notes'])
            ->withTimestamps();
    }

    public function projects()
    {
        return $this->belongsToMany(Project::class, 'strategic_initiative_projects', 'initiative_id', 'project_id')
            ->withPivot(['id', 'impact_description'])
            ->withTimestamps();
    }
}
