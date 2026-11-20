<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\ExecutiveAction;
use App\Models\ExecutiveActionHistory;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ExecutiveActionService
{
    /**
     * Get KPI summary of actions.
     */
    public function getActionSummary(?User $user = null): array
    {
        $query = ExecutiveAction::query();

        // Scope by PM if role is PM
        if ($user && $user->role === 'project_manager') {
            $query->where(function ($q) use ($user) {
                $q->where('assigned_to', $user->id)
                  ->orWhereHas('project', function ($pq) use ($user) {
                      $pq->where('pic_id', $user->id);
                  });
            });
        }

        $allActions = $query->get();
        $today = Carbon::today()->toDateString();

        $total = $allActions->count();
        $pending = $allActions->where('status', 'pending')->count();
        $inProgress = $allActions->where('status', 'in_progress')->count();
        $blocked = $allActions->where('status', 'blocked')->count();
        $completed = $allActions->where('status', 'completed')->count();
        $cancelled = $allActions->where('status', 'cancelled')->count();
        $critical = $allActions->where('priority', 'critical')->count();
        $high = $allActions->where('priority', 'high')->count();

        $overdue = $allActions->filter(function ($act) use ($today) {
            return !in_array($act->status, ['completed', 'cancelled'], true)
                && !empty($act->due_date)
                && Carbon::parse($act->due_date)->lt($today);
        })->count();

        return [
            'total_actions' => $total,
            'pending_count' => $pending,
            'in_progress_count' => $inProgress,
            'blocked_count' => $blocked,
            'completed_count' => $completed,
            'cancelled_count' => $cancelled,
            'overdue_count' => $overdue,
            'critical_priority_count' => $critical,
            'high_priority_count' => $high,
        ];
    }

    /**
     * Get filtered list of executive actions.
     */
    public function getActions(array $filters, User $user)
    {
        $query = ExecutiveAction::with([
            'assignedUser:id,name,role',
            'creator:id,name,role',
            'project:id,name,code,pic_id',
            'strategicRisk:id,risk_code,title,risk_level',
            'executiveDecision:id,decision_number,title',
            'strategicInitiative:id,code,title',
            'convertedTask:id,title,status,is_completed',
        ]);

        // Authorization scope
        if ($user->role === 'project_manager') {
            $query->where(function ($q) use ($user) {
                $q->where('assigned_to', $user->id)
                  ->orWhereHas('project', function ($pq) use ($user) {
                      $pq->where('pic_id', $user->id);
                  });
            });
        } elseif ($user->role === 'member') {
            // Members have no access to executive action center
            return collect();
        }

        // Status filter
        if (!empty($filters['status']) && $filters['status'] !== 'all') {
            if ($filters['status'] === 'overdue') {
                $today = Carbon::today()->toDateString();
                $query->whereNotIn('status', ['completed', 'cancelled'])
                      ->whereNotNull('due_date')
                      ->where('due_date', '<', $today);
            } else {
                $query->where('status', $filters['status']);
            }
        }

        // Priority filter
        if (!empty($filters['priority']) && $filters['priority'] !== 'all') {
            $query->where('priority', $filters['priority']);
        }

        // Source filter
        if (!empty($filters['source_type']) && $filters['source_type'] !== 'all') {
            $query->where('source_type', $filters['source_type']);
        }

        // Assignee filter
        if (!empty($filters['assigned_to']) && $filters['assigned_to'] !== 'all') {
            $query->where('assigned_to', (int) $filters['assigned_to']);
        }

        // Project filter
        if (!empty($filters['project_id']) && $filters['project_id'] !== 'all') {
            $query->where('project_id', (int) $filters['project_id']);
        }

        // Search filter
        if (!empty($filters['search'])) {
            $s = '%' . $filters['search'] . '%';
            $query->where(function ($q) use ($s) {
                $q->where('title', 'like', $s)
                  ->orWhere('action_code', 'like', $s)
                  ->orWhere('description', 'like', $s)
                  ->orWhere('source_title', 'like', $s);
            });
        }

        return $query->orderByRaw("
            CASE priority 
                WHEN 'critical' THEN 1 
                WHEN 'high' THEN 2 
                WHEN 'medium' THEN 3 
                WHEN 'low' THEN 4 
                ELSE 5 
            END ASC
        ")->orderBy('due_date', 'asc')
          ->orderBy('created_at', 'desc')
          ->get();
    }

    /**
     * Create an Executive Action with audit history.
     */
    public function createAction(array $data, User $actor): ExecutiveAction
    {
        return DB::transaction(function () use ($data, $actor) {
            $actionCode = $this->generateActionCode();

            $action = ExecutiveAction::create([
                'action_code' => $actionCode,
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'source_type' => $data['source_type'] ?? 'manual',
                'source_id' => $data['source_id'] ?? null,
                'source_title' => $data['source_title'] ?? null,
                'strategic_risk_id' => $data['strategic_risk_id'] ?? null,
                'executive_decision_id' => $data['executive_decision_id'] ?? null,
                'strategic_initiative_id' => $data['strategic_initiative_id'] ?? null,
                'project_id' => $data['project_id'] ?? null,
                'assigned_to' => $data['assigned_to'] ?? null,
                'created_by' => $actor->id,
                'priority' => $data['priority'] ?? 'medium',
                'status' => $data['status'] ?? 'pending',
                'due_date' => $data['due_date'] ?? null,
                'progress' => $data['progress'] ?? 0,
            ]);

            // Create initial history
            ExecutiveActionHistory::create([
                'action_id' => $action->id,
                'actor_id' => $actor->id,
                'actor_name' => $actor->name,
                'event_type' => 'created',
                'new_value' => json_encode([
                    'title' => $action->title,
                    'priority' => $action->priority,
                    'assigned_to' => $action->assigned_to,
                    'due_date' => $action->due_date?->toDateString(),
                ]),
                'notes' => 'Tindakan eksekutif dibuat oleh ' . $actor->name,
            ]);

            // Notification / Activity
            Activity::create([
                'user_name' => $actor->name,
                'action' => 'membuat tindakan eksekutif baru',
                'target_name' => $action->action_code . ' - ' . $action->title,
                'project_name' => $action->project?->name ?? 'Executive Center',
                'avatar_color' => '#FF2F92',
            ]);

            return $action->fresh([
                'assignedUser:id,name,role',
                'creator:id,name,role',
                'project:id,name,code',
                'histories',
            ]);
        });
    }

    /**
     * Update an Executive Action with comprehensive audit logging.
     */
    public function updateAction(ExecutiveAction $action, array $data, User $actor): ExecutiveAction
    {
        return DB::transaction(function () use ($action, $data, $actor) {
            $oldStatus = $action->status;
            $oldPriority = $action->priority;
            $oldAssignedTo = $action->assigned_to;
            $oldDueDate = $action->due_date?->toDateString();
            $oldProgress = $action->progress;

            // Update basic fields
            if (isset($data['title'])) $action->title = $data['title'];
            if (array_key_exists('description', $data)) $action->description = $data['description'];
            if (isset($data['priority'])) $action->priority = $data['priority'];
            if (array_key_exists('project_id', $data)) $action->project_id = $data['project_id'];
            if (array_key_exists('assigned_to', $data)) $action->assigned_to = $data['assigned_to'];
            if (array_key_exists('due_date', $data)) $action->due_date = $data['due_date'];
            if (isset($data['progress'])) $action->progress = (int) $data['progress'];

            // Status transitions
            if (isset($data['status']) && $data['status'] !== $oldStatus) {
                $newStatus = $data['status'];
                $action->status = $newStatus;

                if ($newStatus === 'completed') {
                    $action->completed_at = Carbon::now();
                    $action->progress = 100;
                    if (isset($data['completion_notes'])) {
                        $action->completion_notes = $data['completion_notes'];
                    }
                } elseif ($oldStatus === 'completed') {
                    // Reopened
                    $action->completed_at = null;
                }

                ExecutiveActionHistory::create([
                    'action_id' => $action->id,
                    'actor_id' => $actor->id,
                    'actor_name' => $actor->name,
                    'event_type' => $newStatus === 'completed' ? 'completed' : 'status_changed',
                    'old_value' => $oldStatus,
                    'new_value' => $newStatus,
                    'notes' => $data['notes'] ?? ($newStatus === 'completed' ? ($data['completion_notes'] ?? 'Tindakan diselesaikan') : "Status diubah dari {$oldStatus} ke {$newStatus}"),
                ]);
            }

            // Assignee change history
            if (array_key_exists('assigned_to', $data) && $data['assigned_to'] != $oldAssignedTo) {
                $newAssignee = User::find($data['assigned_to']);
                ExecutiveActionHistory::create([
                    'action_id' => $action->id,
                    'actor_id' => $actor->id,
                    'actor_name' => $actor->name,
                    'event_type' => 'assigned',
                    'old_value' => (string) $oldAssignedTo,
                    'new_value' => (string) $data['assigned_to'],
                    'notes' => 'Penanggung jawab dialihkan ke ' . ($newAssignee?->name ?? 'Tidak Ada'),
                ]);
            }

            // Due date change history
            if (array_key_exists('due_date', $data) && $data['due_date'] != $oldDueDate) {
                ExecutiveActionHistory::create([
                    'action_id' => $action->id,
                    'actor_id' => $actor->id,
                    'actor_name' => $actor->name,
                    'event_type' => 'deadline_extended',
                    'old_value' => (string) $oldDueDate,
                    'new_value' => (string) $data['due_date'],
                    'notes' => 'Tenggat waktu diperbarui menjadi ' . ($data['due_date'] ?? 'Tanpa Batas'),
                ]);
            }

            // Progress change history
            if (isset($data['progress']) && $data['progress'] != $oldProgress) {
                ExecutiveActionHistory::create([
                    'action_id' => $action->id,
                    'actor_id' => $actor->id,
                    'actor_name' => $actor->name,
                    'event_type' => 'progress_updated',
                    'old_value' => (string) $oldProgress,
                    'new_value' => (string) $data['progress'],
                    'notes' => "Progres capaian diperbarui menjadi {$data['progress']}%",
                ]);
            }

            // General note added
            if (!empty($data['additional_note'])) {
                ExecutiveActionHistory::create([
                    'action_id' => $action->id,
                    'actor_id' => $actor->id,
                    'actor_name' => $actor->name,
                    'event_type' => 'note_added',
                    'notes' => $data['additional_note'],
                ]);
            }

            $action->save();

            // Activity Log
            Activity::create([
                'user_name' => $actor->name,
                'action' => 'memperbarui tindakan eksekutif',
                'target_name' => $action->action_code . ' (' . $action->status . ')',
                'project_name' => $action->project?->name ?? 'Executive Center',
                'avatar_color' => '#FFD83D',
            ]);

            return $action->fresh([
                'assignedUser:id,name,role',
                'creator:id,name,role',
                'project:id,name,code',
                'histories',
            ]);
        });
    }

    /**
     * Cancel an action with mandatory cancellation reason.
     */
    public function cancelAction(ExecutiveAction $action, string $reason, User $actor): ExecutiveAction
    {
        if (empty(trim($reason))) {
            throw ValidationException::withMessages([
                'reason' => ['Alasan pembatalan tindakan wajib disertakan.'],
            ]);
        }

        return DB::transaction(function () use ($action, $reason, $actor) {
            $oldStatus = $action->status;
            $action->status = 'cancelled';
            $action->cancelled_reason = $reason;
            $action->save();

            ExecutiveActionHistory::create([
                'action_id' => $action->id,
                'actor_id' => $actor->id,
                'actor_name' => $actor->name,
                'event_type' => 'cancelled',
                'old_value' => $oldStatus,
                'new_value' => 'cancelled',
                'notes' => 'Tindakan dibatalkan: ' . $reason,
            ]);

            Activity::create([
                'user_name' => $actor->name,
                'action' => 'membatalkan tindakan eksekutif',
                'target_name' => $action->action_code,
                'project_name' => $action->project?->name ?? 'Executive Center',
                'avatar_color' => '#171717',
            ]);

            return $action->fresh(['histories', 'assignedUser']);
        });
    }

    /**
     * Convert an operational action into a project task.
     * Prevents duplicate conversions and follows existing task workflow.
     */
    public function convertToTask(ExecutiveAction $action, array $taskData, User $actor): Task
    {
        if ($action->converted_task_id) {
            throw ValidationException::withMessages([
                'action_id' => ['Tindakan ini sudah pernah dikonversi menjadi tugas proyek (Task #' . $action->converted_task_id . ').'],
            ]);
        }

        $projectId = $taskData['project_id'] ?? $action->project_id;
        if (!$projectId) {
            throw ValidationException::withMessages([
                'project_id' => ['Proyek tujuan wajib ditentukan untuk mengonversi tindakan menjadi tugas operasional.'],
            ]);
        }

        $project = Project::findOrFail($projectId);

        return DB::transaction(function () use ($action, $taskData, $project, $actor) {
            // Map priority to task priority
            $priority = match ($action->priority) {
                'critical' => 'urgent',
                'high' => 'high',
                'low' => 'low',
                default => 'medium',
            };

            $assigneeId = $taskData['assignee_id'] ?? $action->assigned_to ?? $project->pic_id;
            $assignee = User::find($assigneeId);

            $task = Task::create([
                'project_id' => $project->id,
                'milestone_id' => $taskData['milestone_id'] ?? null,
                'title' => $taskData['title'] ?? ('[Tindakan Eksekutif] ' . $action->title),
                'description' => $taskData['description'] ?? ($action->description ?? 'Tugas operasional hasil konversi dari Executive Action ' . $action->action_code),
                'priority' => $taskData['priority'] ?? $priority,
                'status' => 'todo',
                'is_completed' => false,
                'start_date' => Carbon::today()->toDateString(),
                'deadline' => $taskData['deadline'] ?? $action->due_date?->toDateString(),
                'assignee_id' => $assigneeId,
                'assignee_name' => $assignee?->name ?? 'Team Member',
                'created_by' => $actor->id,
            ]);

            // Update action with reference to converted task
            $action->converted_task_id = $task->id;
            if ($action->status === 'pending') {
                $action->status = 'in_progress';
            }
            $action->save();

            // Log history
            ExecutiveActionHistory::create([
                'action_id' => $action->id,
                'actor_id' => $actor->id,
                'actor_name' => $actor->name,
                'event_type' => 'converted_to_task',
                'new_value' => (string) $task->id,
                'notes' => "Dikonversi menjadi tugas operasional pada proyek {$project->name} (Task #{$task->id})",
            ]);

            Activity::create([
                'user_name' => $actor->name,
                'action' => 'mengonversi tindakan eksekutif ke tugas proyek',
                'target_name' => $task->title,
                'project_name' => $project->name,
                'avatar_color' => '#10B981',
            ]);

            return $task->fresh(['project', 'assignee']);
        });
    }

    /**
     * Create action directly from Business Intelligence insight.
     */
    public function createFromInsight(array $data, User $actor): ExecutiveAction
    {
        $payload = [
            'title' => $data['title'] ?? 'Tindak Lanjut Anomali Bisnis',
            'description' => $data['summary'] ?? ($data['recommendation'] ?? null),
            'source_type' => 'business_intelligence',
            'source_id' => $data['source_id'] ?? ($data['id'] ?? null),
            'source_title' => $data['source_title'] ?? ($data['title'] ?? null),
            'priority' => in_array($data['priority'] ?? '', ['critical', 'high', 'medium', 'low']) ? $data['priority'] : 'high',
            'assigned_to' => $data['assigned_to'] ?? null,
            'due_date' => $data['due_date'] ?? Carbon::now()->addDays(7)->toDateString(),
            'project_id' => $data['project_id'] ?? null,
            'strategic_risk_id' => $data['strategic_risk_id'] ?? null,
            'strategic_initiative_id' => $data['strategic_initiative_id'] ?? null,
        ];

        return $this->createAction($payload, $actor);
    }

    /**
     * Generate unique deterministic action code ACT-YYYYMM-XXXX
     */
    protected function generateActionCode(): string
    {
        $prefix = 'ACT-' . Carbon::now()->format('Ym') . '-';
        $latest = ExecutiveAction::where('action_code', 'like', $prefix . '%')
            ->orderBy('id', 'desc')
            ->value('action_code');

        if ($latest) {
            $seq = (int) substr($latest, strrpos($latest, '-') + 1);
            $seq++;
        } else {
            $seq = 1;
        }

        return $prefix . str_pad($seq, 4, '0', STR_PAD_LEFT);
    }
}