<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Milestone extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'title',
        'description',
        'phase_order',
        'progress',
        'status',
        'due_date',
    ];

    protected function casts(): array
    {
        return [
            'phase_order' => 'integer',
            'progress' => 'integer',
            'due_date' => 'date:Y-m-d',
        ];
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }
}
