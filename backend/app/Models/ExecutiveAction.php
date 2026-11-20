<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExecutiveAction extends Model
{
    use HasFactory;

    protected $fillable = [
        'action_code',
        'title',
        'description',
        'source_type',
        'source_id',
        'source_title',
        'strategic_risk_id',
        'executive_decision_id',
        'strategic_initiative_id',
        'project_id',
        'assigned_to',
        'created_by',
        'priority',
        'status',
        'due_date',
        'progress',
        'completion_notes',
        'completed_at',
        'cancelled_reason',
        'converted_task_id',
    ];

    protected $casts = [
        'due_date' => 'date:Y-m-d',
        'progress' => 'integer',
        'completed_at' => 'datetime',
        'strategic_risk_id' => 'integer',
        'executive_decision_id' => 'integer',
        'strategic_initiative_id' => 'integer',
        'project_id' => 'integer',
        'assigned_to' => 'integer',
        'created_by' => 'integer',
        'converted_task_id' => 'integer',
    ];

    public function assignedUser()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function strategicRisk()
    {
        return $this->belongsTo(StrategicRisk::class, 'strategic_risk_id');
    }

    public function executiveDecision()
    {
        return $this->belongsTo(ExecutiveDecision::class, 'executive_decision_id');
    }

    public function strategicInitiative()
    {
        return $this->belongsTo(StrategicInitiative::class, 'strategic_initiative_id');
    }

    public function project()
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function convertedTask()
    {
        return $this->belongsTo(Task::class, 'converted_task_id');
    }

    public function histories()
    {
        return $this->hasMany(ExecutiveActionHistory::class, 'action_id')->orderBy('created_at', 'desc');
    }

    public function isOverdue(): bool
    {
        if (in_array($this->status, ['completed', 'cancelled'])) {
            return false;
        }

        return $this->due_date && $this->due_date->isPast();
    }
}