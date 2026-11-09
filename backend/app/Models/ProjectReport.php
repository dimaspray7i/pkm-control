<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProjectReport extends Model
{
    use HasFactory;

    protected $fillable = [
        'report_number',
        'project_id',
        'created_by',
        'period_start',
        'period_end',
        'status',
        'executive_summary',
        'completed_work',
        'challenges',
        'risks',
        'next_week_plan',
        'support_required',
        'snapshot_data',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'project_id' => 'integer',
            'created_by' => 'integer',
            'period_start' => 'date:Y-m-d',
            'period_end' => 'date:Y-m-d',
            'published_at' => 'datetime',
            'snapshot_data' => 'array',
        ];
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }

    /**
     * Generate unique report number: RPT-YYYYMM-XXXX
     */
    public static function generateReportNumber(): string
    {
        $prefix = 'RPT-' . date('Ym') . '-';
        $lastReport = static::where('report_number', 'like', $prefix . '%')
            ->orderBy('id', 'desc')
            ->first();

        if ($lastReport && preg_match('/-(\d+)$/', $lastReport->report_number, $matches)) {
            $nextSeq = (int) $matches[1] + 1;
        } else {
            $nextSeq = 1;
        }

        return $prefix . str_pad((string) $nextSeq, 4, '0', STR_PAD_LEFT);
    }
}
