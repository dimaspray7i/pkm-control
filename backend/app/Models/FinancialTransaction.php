<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinancialTransaction extends Model
{
    protected $fillable = [
        'transaction_date', 'type', 'category', 'description',
        'amount', 'reference_number', 'budget_id', 'project_id',
        'initiative_id', 'notes', 'recorded_by',
    ];

    protected $casts = [
        'transaction_date' => 'date',
        'amount'           => 'decimal:2',
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

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
