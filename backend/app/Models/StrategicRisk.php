<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StrategicRisk extends Model
{
    use HasFactory;

    protected $fillable = [
        'risk_code',
        'title',
        'description',
        'category',
        'project_id',
        'source',
        'impact',
        'likelihood',
        'risk_score',
        'risk_level',
        'mitigation',
        'owner_id',
        'owner_name',
        'identified_date',
        'target_resolution_date',
        'status',
        'resolution_notes',
        'resolved_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'project_id' => 'integer',
            'owner_id' => 'integer',
            'created_by' => 'integer',
            'impact' => 'integer',
            'likelihood' => 'integer',
            'risk_score' => 'integer',
            'identified_date' => 'date:Y-m-d',
            'target_resolution_date' => 'date:Y-m-d',
            'resolved_at' => 'datetime',
        ];
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function decisions()
    {
        return $this->hasMany(ExecutiveDecision::class, 'risk_id');
    }

    /**
     * Hitung skor risiko (1-25) dan level risiko secara matematis.
     * Likelihood (1-5) * Impact (1-5)
     */
    public static function calculateScoreAndLevel(int $likelihood, int $impact): array
    {
        $likelihood = max(1, min(5, $likelihood));
        $impact = max(1, min(5, $impact));
        $score = $likelihood * $impact;

        $level = 'low';
        if ($score >= 17) {
            $level = 'critical';
        } elseif ($score >= 10) {
            $level = 'high';
        } elseif ($score >= 5) {
            $level = 'medium';
        }

        return [
            'score' => $score,
            'level' => $level,
        ];
    }

    /**
     * Generate format kode unik risiko (e.g., RSK-202611-001)
     */
    public static function generateRiskCode(): string
    {
        $prefix = 'RSK-' . date('Ym') . '-';
        $latest = static::where('risk_code', 'like', "{$prefix}%")
            ->orderBy('id', 'desc')
            ->first();

        $nextNum = 1;
        if ($latest && preg_match('/-(\d+)$/', $latest->risk_code, $matches)) {
            $nextNum = (int) $matches[1] + 1;
        }

        return $prefix . str_pad((string) $nextNum, 3, '0', STR_PAD_LEFT);
    }
}
