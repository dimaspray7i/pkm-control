<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinancialAlert extends Model
{
    use HasFactory;

    protected $fillable = [
        'alert_code',
        'title',
        'description',
        'severity',
        'source',
        'related_amount',
        'budget_id',
        'project_id',
        'initiative_id',
        'detected_date',
        'recommendation',
        'status',
        'acknowledged_by',
        'acknowledged_at',
        'resolved_by',
        'resolved_at',
        'resolution_notes',
    ];

    protected $casts = [
        'related_amount' => 'decimal:2',
        'detected_date' => 'date',
        'acknowledged_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function budget(): BelongsTo
    {
        return $this->belongsTo(FinancialBudget::class, 'budget_id');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function initiative(): BelongsTo
    {
        return $this->belongsTo(StrategicInitiative::class, 'initiative_id');
    }

    public function acknowledgedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acknowledged_by');
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}

