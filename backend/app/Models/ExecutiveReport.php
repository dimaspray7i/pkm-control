<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExecutiveReport extends Model
{
    use HasFactory;

    protected $fillable = [
        'report_number',
        'title',
        'report_type',
        'period_start',
        'period_end',
        'status',
        'executive_summary',
        'strategic_recommendations',
        'management_attention',
        'snapshot_data',
        'generated_by',
        'published_at',
        'published_by',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date:Y-m-d',
            'period_end' => 'date:Y-m-d',
            'snapshot_data' => 'array',
            'published_at' => 'datetime',
            'generated_by' => 'integer',
            'published_by' => 'integer',
        ];
    }

    public function generatedBy()
    {
        return $this->belongsTo(User::class, 'generated_by');
    }

    public function publishedBy()
    {
        return $this->belongsTo(User::class, 'published_by');
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }
}
