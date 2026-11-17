<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StrategicKeyResult extends Model
{
    use HasFactory;

    protected $fillable = [
        'objective_id',
        'title',
        'description',
        'metric_type',
        'unit',
        'baseline_value',
        'target_value',
        'current_value',
        'progress',
        'weight',
        'source_type',
        'source_reference',
        'owner_id',
        'deadline',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'baseline_value' => 'float',
            'target_value' => 'float',
            'current_value' => 'float',
            'progress' => 'float',
            'weight' => 'float',
            'deadline' => 'date:Y-m-d',
        ];
    }

    public function objective()
    {
        return $this->belongsTo(StrategicObjective::class, 'objective_id');
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function checkins()
    {
        return $this->hasMany(StrategicKeyResultCheckin::class, 'key_result_id')->orderBy('created_at', 'desc');
    }

    /**
     * Compute progress percentage (0 - 100%) based on metric_type
     * Handles zero-denominator and edge cases cleanly without NaN/Infinity
     */
    public function computeProgress(): float
    {
        $baseline = (float) $this->baseline_value;
        $target = (float) $this->target_value;
        $current = (float) $this->current_value;
        $type = $this->metric_type ?? 'numeric_increase';

        $progress = 0.0;

        switch ($type) {
            case 'numeric_increase':
                $diff = $target - $baseline;
                if ($diff <= 0) {
                    $progress = $current >= $target ? 100.0 : 0.0;
                } else {
                    $progress = (($current - $baseline) / $diff) * 100.0;
                }
                break;

            case 'numeric_decrease':
                // Lower is better (e.g. overdue tasks reduction, bug count)
                $diff = $baseline - $target;
                if ($diff <= 0) {
                    $progress = $current <= $target ? 100.0 : 0.0;
                } else {
                    $progress = (($baseline - $current) / $diff) * 100.0;
                }
                break;

            case 'boolean':
                $progress = ($current >= 1.0 || (string)$current === (string)$target) ? 100.0 : 0.0;
                break;

            case 'milestone_based':
                if ($target <= 0) {
                    $progress = $current > 0 ? 100.0 : 0.0;
                } else {
                    $progress = ($current / $target) * 100.0;
                }
                break;

            default:
                $diff = $target - $baseline;
                $progress = $diff > 0 ? (($current - $baseline) / $diff) * 100.0 : 0.0;
                break;
        }

        // Cap strictly between 0 and 100%
        return round(max(0.0, min(100.0, $progress)), 2);
    }
}
