<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExecutiveDecision extends Model
{
    use HasFactory;

    protected $fillable = [
        'decision_number',
        'title',
        'description',
        'category',
        'project_id',
        'risk_id',
        'underlying_problem',
        'rationale',
        'priority',
        'decision_date',
        'pic_id',
        'pic_name',
        'due_date',
        'status',
        'implementation_result',
        'cancellation_reason',
        'completed_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'project_id' => 'integer',
            'risk_id' => 'integer',
            'pic_id' => 'integer',
            'created_by' => 'integer',
            'decision_date' => 'date:Y-m-d',
            'due_date' => 'date:Y-m-d',
            'completed_at' => 'datetime',
        ];
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function risk()
    {
        return $this->belongsTo(StrategicRisk::class, 'risk_id');
    }

    public function pic()
    {
        return $this->belongsTo(User::class, 'pic_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function audits()
    {
        return $this->hasMany(ExecutiveDecisionAudit::class, 'decision_id')->orderBy('created_at', 'desc');
    }

    /**
     * Generate format nomor unik keputusan eksekutif (e.g., DEC-202611-001)
     */
    public static function generateDecisionNumber(): string
    {
        $prefix = 'DEC-' . date('Ym') . '-';
        $latest = static::where('decision_number', 'like', "{$prefix}%")
            ->orderBy('id', 'desc')
            ->first();

        $nextNum = 1;
        if ($latest && preg_match('/-(\d+)$/', $latest->decision_number, $matches)) {
            $nextNum = (int) $matches[1] + 1;
        }

        return $prefix . str_pad((string) $nextNum, 3, '0', STR_PAD_LEFT);
    }
}
