<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StrategicObjective extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'category',
        'period_start',
        'period_end',
        'owner_id',
        'priority',
        'status',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date:Y-m-d',
            'period_end' => 'date:Y-m-d',
        ];
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function keyResults()
    {
        return $this->hasMany(StrategicKeyResult::class, 'objective_id');
    }

    public function projects()
    {
        return $this->belongsToMany(Project::class, 'strategic_objective_projects', 'objective_id', 'project_id')
            ->withPivot('contribution_notes')
            ->withTimestamps();
    }

    /**
     * Compute aggregated progress across all key results based on weights
     */
    public function getAggregatedProgressAttribute(): float
    {
        $krs = $this->keyResults;
        if ($krs->isEmpty()) {
            return 0.0;
        }

        $totalWeight = $krs->sum('weight');
        if ($totalWeight <= 0) {
            // Unweighted equal average
            return round($krs->avg('progress') ?? 0.0, 2);
        }

        $weightedSum = 0.0;
        foreach ($krs as $kr) {
            $weightedSum += ($kr->progress * $kr->weight);
        }

        return round(max(0.0, min(100.0, $weightedSum / $totalWeight)), 2);
    }
}
