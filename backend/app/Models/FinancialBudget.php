<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinancialBudget extends Model
{
    protected $fillable = [
        'label', 'fiscal_year', 'fiscal_period', 'period_code',
        'start_date', 'end_date', 'revenue_target', 'expense_budget',
        'notes', 'is_active', 'created_by',
    ];

    protected $casts = [
        'fiscal_year'      => 'integer',
        'revenue_target'   => 'decimal:2',
        'expense_budget'   => 'decimal:2',
        'is_active'        => 'boolean',
        'start_date'       => 'date',
        'end_date'         => 'date',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(FinancialTransaction::class, 'budget_id');
    }

    // Computed: total actual income within this budget period
    public function getTotalIncomeAttribute(): float
    {
        return (float) $this->transactions()->where('type', 'income')->sum('amount');
    }

    // Computed: total actual expense within this budget period
    public function getTotalExpenseAttribute(): float
    {
        return (float) $this->transactions()->where('type', 'expense')->sum('amount');
    }
}
