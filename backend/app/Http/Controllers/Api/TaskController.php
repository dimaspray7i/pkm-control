<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskChecklist;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TaskController extends Controller
{
    /**
     * Tampilkan ringkasan metrik tugas (Task Distribution Summary).
     */
    public function summary(Request $request)
    {
        $user = $request->user();
        $baseQuery = Task::query();

        // Scoping otorisasi: PM hanya menghitung tugas proyek miliknya
        if ($user && $user->role === 'project_manager') {
            $baseQuery->whereHas('project', function ($pq) use ($user) {
                $pq->where('pic_id', $user->id);
            });
        }

        $today = Carbon::now()->toDateString();
        $summary = [
            'total' => (clone $baseQuery)->count(),
            'todo' => (clone $baseQuery)->whereIn('status', ['pending', 'todo'])->where('is_completed', false)->count(),
            'in_progress' => (clone $baseQuery)->where('status', 'in_progress')->where('is_completed', false)->count(),
            'in_review' => (clone $baseQuery)->where('status', 'in_review')->where('is_completed', false)->count(),
            'done' => (clone $baseQuery)->where(function ($q) {
                $q->where('status', 'completed')->orWhere('is_completed', true);
            })->count(),
            'overdue' => (clone $baseQuery)->where('is_completed', false)->whereNotNull('deadline')->where('deadline', '<', $today)->count(),
            'unassigned' => (clone $baseQuery)->where('is_completed', false)->whereNull('assignee_id')->count(),
        ];

        return response()->json([
            'summary' => $summary,
        ]);
    }

    /**
     * Tampilkan daftar tugas operasional dengan filter, relasi proyek, dan progres checklist.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Task::with([
            'project:id,code,name,client,status,pic_id',
            'milestone:id,project_id,title,phase_order,status',
            'assignee:id,name,email,role',
            'creator:id,name,email',
            'checklists'
        ]);

        // Scoping otorisasi: Project Manager hanya melihat tugas pada proyek miliknya
        if ($user && $user->role === 'project_manager') {
            $query->whereHas('project', function ($pq) use ($user) {
                $pq->where('pic_id', $user->id);
            });
        }

        // Filter berdasarkan proyek
        if ($request->filled('project_id') && $request->project_id !== 'all') {
            $query->where('project_id', $request->project_id);
        }

        // Filter berdasarkan milestone / sprint
        if ($request->filled('milestone_id') && $request->milestone_id !== 'all') {
            $query->where('milestone_id', $request->milestone_id);
        }

        // Filter berdasarkan Member / Assignee
        if ($request->filled('assignee_id') && $request->assignee_id !== 'all') {
            if ($request->assignee_id === 'unassigned') {
                $query->whereNull('assignee_id');
            } else {
                $query->where('assignee_id', $request->assignee_id);
            }
        }

        // Filter prioritas
        if ($request->filled('priority') && $request->priority !== 'all') {
            $query->where('priority', $request->priority);
        }

        // Filter status selesai
        if ($request->has('is_completed') && $request->is_completed !== 'all') {
            $isComp = filter_var($request->is_completed, FILTER_VALIDATE_BOOLEAN);
            $query->where('is_completed', $isComp);
        }

        // Filter status operasional
        if ($request->filled('status') && $request->status !== 'all') {
            if ($request->status === 'todo') {
                $query->whereIn('status', ['todo', 'pending'])->where('is_completed', false);
            } elseif ($request->status === 'done' || $request->status === 'completed') {
                $query->where(function ($q) {
                    $q->where('status', 'completed')->orWhere('is_completed', true);
                });
            } else {
                $query->where('status', $request->status);
            }
        }

        $today = Carbon::now()->toDateString();

        // Filter overdue (terlewat deadline)
        if ($request->boolean('overdue') || $request->filter === 'overdue') {
            $query->where('is_completed', false)
                  ->whereNotNull('deadline')
                  ->where('deadline', '<', $today);
        }

        // Filter deadline rentang waktu
        if ($request->filled('deadline_filter')) {
            if ($request->deadline_filter === 'today') {
                $query->whereDate('deadline', $today);
            } elseif ($request->deadline_filter === 'this_week') {
                $endOfWeek = Carbon::now()->endOfWeek()->toDateString();
                $query->whereBetween('deadline', [$today, $endOfWeek]);
            } elseif ($request->deadline_filter === 'overdue') {
                $query->where('is_completed', false)
                      ->whereNotNull('deadline')
                      ->where('deadline', '<', $today);
            }
        }

        // Pencarian (judul, nama PIC, nama proyek)
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('assignee_name', 'like', "%{$search}%")
                  ->orWhereHas('project', function ($pq) use ($search) {
                      $pq->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%");
                  })
                  ->orWhereHas('milestone', function ($mq) use ($search) {
                      $mq->where('title', 'like', "%{$search}%");
                  });
            });
        }

        // Sorting: belum selesai terlebih dahulu, prioritas urgent -> high -> medium -> low, deadline terdekat
        $driver = \Illuminate\Support\Facades\DB::connection()->getDriverName();
        $priorityOrder = $driver === 'mysql'
            ? "FIELD(priority, 'urgent', 'high', 'medium', 'low')"
            : "CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END";

        $tasks = $query->orderBy('is_completed', 'asc')
                       ->orderByRaw($priorityOrder)
                       ->orderByRaw("CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline ASC")
                       ->orderBy('created_at', 'desc')
                       ->get();

        // Map checklist summary metrics untuk setiap task
        $tasks->transform(function ($task) {
            $checklists = $task->checklists;
            $chkTotal = $checklists->count();
            $chkCompleted = $chkTotal > 0 ? $checklists->where('is_completed', true)->count() : 0;
            $chkProgress = $chkTotal > 0 ? (int) round(($chkCompleted / $chkTotal) * 100) : 0;

            $task->checklist_total = $chkTotal;
            $task->checklist_completed = $chkCompleted;
            $task->checklist_progress = $chkProgress;
            return $task;
        });

        // Hitung ringkasan status operasional
        $baseQuery = Task::query();
        if ($user && $user->role === 'project_manager') {
            $baseQuery->whereHas('project', function ($pq) use ($user) {
                $pq->where('pic_id', $user->id);
            });
        }

        $summary = [
            'total' => (clone $baseQuery)->count(),
            'todo' => (clone $baseQuery)->whereIn('status', ['pending', 'todo'])->where('is_completed', false)->count(),
            'in_progress' => (clone $baseQuery)->where('status', 'in_progress')->where('is_completed', false)->count(),
            'in_review' => (clone $baseQuery)->where('status', 'in_review')->where('is_completed', false)->count(),
            'done' => (clone $baseQuery)->where(function ($q) {
                $q->where('status', 'completed')->orWhere('is_completed', true);
            })->count(),
            'overdue' => (clone $baseQuery)->where('is_completed', false)->whereNotNull('deadline')->where('deadline', '<', $today)->count(),
            'unassigned' => (clone $baseQuery)->where('is_completed', false)->whereNull('assignee_id')->count(),
        ];

        return response()->json([
            'tasks' => $tasks,
            'total' => $tasks->count(),
            'summary' => $summary,
        ]);
    }

    /**
     * Buat tugas baru di database dengan validasi PM dan checklist wajib.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        // Otorisasi role: hanya admin dan project_manager yang dapat menambah tugas
        if (!$user || !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'message' => 'Hanya Super Admin dan Project Manager yang memiliki izin menambah tugas.',
            ], 403);
        }

        // PERIKSA OTORISASI PROYEK TERLEBIH DAHULU: jika project_id milik PM lain, return 403 Forbidden
        if ($request->filled('project_id') && $user->role === 'project_manager') {
            $project = Project::find($request->project_id);
            if ($project && (int) $project->pic_id !== (int) $user->id) {
                return response()->json([
                    'message' => 'Anda hanya dapat menambahkan tugas pada proyek yang Anda pimpin.',
                ], 403);
            }
        }

        $isPm = $user->role === 'project_manager';

        // Validasi struktur input
        $rules = [
            'project_id' => ['required', 'exists:projects,id'],
            'milestone_id' => ['nullable', 'exists:milestones,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => [$isPm ? 'required' : 'nullable', 'string'],
            'priority' => ['required', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'status' => ['nullable', Rule::in(['pending', 'todo', 'in_progress', 'in_review', 'completed'])],
            'deadline' => [$isPm ? 'required' : 'nullable', 'date'],
            'start_date' => ['nullable', 'date'],
            'assignee_id' => [$isPm ? 'required' : 'nullable', 'exists:users,id'],
            'assignee_name' => ['nullable', 'string', 'max:255'],
            'is_completed' => ['nullable', 'boolean'],
            'checklists' => [$isPm ? 'required' : 'nullable', 'array', $isPm ? 'min:1' : 'min:0'],
            'checklists.*.title' => ['sometimes', 'required', 'string', 'max:255'],
        ];

        $messages = [
            'project_id.required' => 'Proyek wajib dipilih.',
            'project_id.exists' => 'Proyek yang dipilih tidak valid.',
            'milestone_id.exists' => 'Sprint/Milestone yang dipilih tidak valid.',
            'title.required' => 'Judul tugas wajib diisi.',
            'description.required' => 'Deskripsi tugas wajib diisi.',
            'priority.required' => 'Prioritas tugas wajib dipilih.',
            'priority.in' => 'Prioritas harus low, medium, high, atau urgent.',
            'deadline.required' => 'Batas waktu (due date) tugas wajib ditentukan.',
            'assignee_id.required' => 'Penanggung jawab (Member) wajib dipilih.',
            'assignee_id.exists' => 'Personel PIC yang dipilih tidak terdaftar di sistem.',
            'checklists.required' => 'Minimal satu item checklist wajib dibuat sebelum tugas disimpan.',
            'checklists.min' => 'Minimal satu item checklist wajib dibuat sebelum tugas disimpan.',
            'checklists.*.title.required' => 'Judul item checklist tidak boleh kosong.',
        ];

        $validated = $request->validate($rules, $messages);

        // Validasi checklist: pastikan minimal ada 1 checklist dengan judul tidak kosong untuk PM
        if ($isPm) {
            $validChecklists = array_filter($validated['checklists'] ?? [], function ($item) {
                $t = is_array($item) ? ($item['title'] ?? '') : (string) $item;
                return trim($t) !== '';
            });

            if (empty($validChecklists)) {
                return response()->json([
                    'message' => 'Minimal satu item checklist wajib dibuat sebelum tugas disimpan.',
                    'errors' => [
                        'checklists' => ['Minimal satu item checklist wajib dibuat sebelum tugas disimpan.'],
                    ],
                ], 422);
            }
        }

        // Validasi lintas relasi: jika milestone_id disediakan, harus berasal dari project_id yang sama
        if (!empty($validated['milestone_id'])) {
            $ms = \App\Models\Milestone::find($validated['milestone_id']);
            if (!$ms || (int) $ms->project_id !== (int) $validated['project_id']) {
                return response()->json([
                    'message' => 'Sprint/Milestone yang dipilih tidak sesuai dengan proyek yang ditentukan.',
                    'errors' => [
                        'milestone_id' => ['Sprint/Milestone harus berasal dari proyek yang sama.'],
                    ],
                ], 422);
            }
        }

        // Validasi Assignee: PM tidak boleh menugaskan admin atau pimpinan sebagai member pelaksana
        $candidateUser = null;
        if (!empty($validated['assignee_id'])) {
            $candidateUser = User::find($validated['assignee_id']);
        } elseif (!empty($validated['assignee_name'])) {
            $candidateUser = User::where('name', trim($validated['assignee_name']))->first();
        }

        if ($candidateUser) {
            if (in_array($candidateUser->role, ['admin', 'pimpinan'])) {
                return response()->json([
                    'message' => 'Admin atau Pimpinan tidak dapat ditugaskan sebagai pelaksana tugas proyek.',
                    'errors' => [
                        'assignee_id' => ['Pengguna dengan role admin atau pimpinan tidak dapat ditugaskan sebagai pelaksana tugas.'],
                    ],
                ], 422);
            }
            if ($isPm && $candidateUser->role !== 'member') {
                return response()->json([
                    'message' => 'Tugas hanya dapat dibagikan kepada pengguna dengan role Member.',
                    'errors' => [
                        'assignee_id' => ['Penanggung jawab tugas harus memiliki role member.'],
                    ],
                ], 422);
            }
        }

        $task = DB::transaction(function () use ($validated, $user) {
            $isCompleted = !empty($validated['is_completed']) || in_array($validated['status'] ?? '', ['completed', 'done']);
            $status = $isCompleted ? 'completed' : ($validated['status'] ?? 'pending');

            $assigneeId = $validated['assignee_id'] ?? null;
            $assigneeName = $validated['assignee_name'] ?? null;
            if (!empty($assigneeId) && empty($assigneeName)) {
                $u = User::find($assigneeId);
                if ($u) $assigneeName = $u->name;
            } elseif (empty($assigneeId) && !empty($assigneeName)) {
                $u = User::where('name', trim($assigneeName))->first();
                if ($u) $assigneeId = $u->id;
            }

            $t = Task::create([
                'project_id' => $validated['project_id'],
                'milestone_id' => $validated['milestone_id'] ?? null,
                'title' => trim($validated['title']),
                'description' => isset($validated['description']) ? trim($validated['description']) : null,
                'priority' => $validated['priority'],
                'status' => $status,
                'is_completed' => $isCompleted,
                'start_date' => $validated['start_date'] ?? null,
                'deadline' => $validated['deadline'] ?? null,
                'assignee_id' => $assigneeId,
                'assignee_name' => !empty($assigneeName) ? trim($assigneeName) : null,
                'created_by' => $user ? $user->id : null,
            ]);

            // Buat checklist awal
            if (!empty($validated['checklists'])) {
                $pos = 1;
                foreach ($validated['checklists'] as $chk) {
                    $chkTitle = is_array($chk) ? ($chk['title'] ?? '') : (string) $chk;
                    if (trim($chkTitle) !== '') {
                        TaskChecklist::create([
                            'task_id' => $t->id,
                            'title' => trim($chkTitle),
                            'is_completed' => false,
                            'position' => $pos++,
                        ]);
                    }
                }
            }

            $t->load(['project', 'milestone', 'assignee', 'creator', 'checklists']);

            Activity::create([
                'user_name' => $user ? $user->name : 'Sistem PKM',
                'action' => 'mendistribusikan tugas baru "' . $t->title . '"',
                'target_name' => $t->title,
                'project_name' => $t->project ? $t->project->name : null,
                'avatar_color' => 'yellow',
            ]);

            return $t;
        });

        $chkStats = $task->getChecklistStats();
        $task->checklist_total = $chkStats['total'];
        $task->checklist_completed = $chkStats['completed'];
        $task->checklist_progress = $chkStats['progress'];

        return response()->json([
            'message' => 'Tugas baru berhasil ditambahkan dan didistribusikan.',
            'task' => $task,
        ], 201);
    }

    /**
     * Tampilkan detail tugas tunggal beserta relasi dan checklist.
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        $task = Task::with([
            'project:id,code,name,client,status,pic_id',
            'milestone:id,project_id,title,phase_order,status',
            'assignee:id,name,email,role',
            'creator:id,name,email',
            'checklists.completedBy:id,name'
        ])->findOrFail($id);

        // Scoping otorisasi: PM hanya boleh melihat tugas pada proyek miliknya atau yang ditugaskan kepadanya
        if ($user && $user->role === 'project_manager') {
            $isPic = $task->project && (int) $task->project->pic_id === (int) $user->id;
            $isAssignee = (int) $task->assignee_id === (int) $user->id;
            if (!$isPic && !$isAssignee) {
                return response()->json([
                    'message' => 'Anda tidak memiliki hak akses untuk melihat tugas ini.',
                ], 403);
            }
        }

        $chkStats = $task->getChecklistStats();
        $task->checklist_total = $chkStats['total'];
        $task->checklist_completed = $chkStats['completed'];
        $task->checklist_progress = $chkStats['progress'];

        return response()->json([
            'task' => $task,
        ]);
    }

    /**
     * Perbarui data tugas yang sudah ada beserta checklist.
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();

        // Otorisasi role: hanya admin dan project_manager yang dapat mengubah tugas
        if (!$user || !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'message' => 'Hanya Super Admin dan Project Manager yang memiliki izin mengubah tugas.',
            ], 403);
        }

        $task = Task::with('project')->findOrFail($id);

        // Otorisasi tugas: PM hanya boleh mengubah task pada proyek yang dipimpinnya
        if ($user->role === 'project_manager' && (int) $task->project->pic_id !== (int) $user->id) {
            return response()->json([
                'message' => 'Anda hanya dapat mengubah tugas pada proyek yang Anda pimpin.',
            ], 403);
        }

        $validated = $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'milestone_id' => ['nullable', 'exists:milestones,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'priority' => ['required', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'status' => ['nullable', Rule::in(['pending', 'todo', 'in_progress', 'in_review', 'completed'])],
            'deadline' => ['nullable', 'date'],
            'start_date' => ['nullable', 'date'],
            'assignee_id' => ['nullable', 'exists:users,id'],
            'assignee_name' => ['nullable', 'string', 'max:255'],
            'is_completed' => ['nullable', 'boolean'],
            'checklists' => ['nullable', 'array'],
        ], [
            'project_id.required' => 'Proyek wajib dipilih.',
            'project_id.exists' => 'Proyek yang dipilih tidak valid.',
            'milestone_id.exists' => 'Sprint/Milestone yang dipilih tidak valid.',
            'title.required' => 'Judul tugas wajib diisi.',
            'priority.required' => 'Prioritas tugas wajib dipilih.',
            'assignee_id.exists' => 'Personel PIC yang dipilih tidak terdaftar di sistem.',
        ]);

        // Validasi lintas relasi: jika milestone_id disediakan, harus berasal dari project_id yang sama
        if (!empty($validated['milestone_id'])) {
            $ms = \App\Models\Milestone::find($validated['milestone_id']);
            if (!$ms || (int) $ms->project_id !== (int) $validated['project_id']) {
                return response()->json([
                    'message' => 'Sprint/Milestone yang dipilih tidak sesuai dengan proyek yang ditentukan.',
                    'errors' => [
                        'milestone_id' => ['Sprint/Milestone harus berasal dari proyek yang sama.'],
                    ],
                ], 422);
            }
        }

        // Validasi pemindahan proyek: PM tidak boleh memindahkan task ke proyek milik PM lain
        if ((int) $validated['project_id'] !== (int) $task->project_id) {
            $targetProject = Project::find($validated['project_id']);
            if ($user->role === 'project_manager' && (!$targetProject || (int) $targetProject->pic_id !== (int) $user->id)) {
                return response()->json([
                    'message' => 'Anda tidak diizinkan memindahkan tugas ke proyek milik Project Manager lain.',
                ], 403);
            }
        }

        // Validasi Assignee: PM tidak boleh menugaskan admin atau pimpinan sebagai member pelaksana
        if ($user->role === 'project_manager') {
            $candidateUser = null;
            if (!empty($validated['assignee_id'])) {
                $candidateUser = User::find($validated['assignee_id']);
            } elseif (!empty($validated['assignee_name'])) {
                $candidateUser = User::where('name', trim($validated['assignee_name']))->first();
            }

            if ($candidateUser && in_array($candidateUser->role, ['admin', 'pimpinan'])) {
                return response()->json([
                    'message' => 'Admin atau Pimpinan tidak dapat ditugaskan sebagai pelaksana tugas proyek.',
                    'errors' => [
                        'assignee_id' => ['Pengguna dengan role admin atau pimpinan tidak dapat ditugaskan sebagai pelaksana tugas.'],
                    ],
                ], 422);
            }
        }

        $task = DB::transaction(function () use ($task, $validated, $user, $request) {
            $isCompleted = isset($validated['is_completed'])
                ? (bool) $validated['is_completed']
                : in_array($validated['status'] ?? '', ['completed', 'done']);

            $status = isset($validated['status'])
                ? $validated['status']
                : ($isCompleted ? 'completed' : 'pending');

            // Resolusi nama dan ID PIC
            $assigneeId = array_key_exists('assignee_id', $validated) ? $validated['assignee_id'] : $task->assignee_id;
            if (array_key_exists('assignee_id', $validated)) {
                if (!empty($assigneeId)) {
                    $u = User::find($assigneeId);
                    $assigneeName = $u ? $u->name : ($validated['assignee_name'] ?? null);
                } else {
                    $assigneeName = null;
                }
            } else {
                $assigneeName = array_key_exists('assignee_name', $validated) ? trim($validated['assignee_name']) : $task->assignee_name;
            }

            $updateData = [
                'project_id' => $validated['project_id'],
                'milestone_id' => array_key_exists('milestone_id', $validated) ? $validated['milestone_id'] : $task->milestone_id,
                'title' => trim($validated['title']),
                'priority' => $validated['priority'],
                'status' => $status,
                'is_completed' => $isCompleted,
                'deadline' => $validated['deadline'] ?? $task->deadline,
                'assignee_id' => $assigneeId,
                'assignee_name' => $assigneeName,
            ];

            if (array_key_exists('description', $validated)) {
                $updateData['description'] = $validated['description'] ? trim($validated['description']) : null;
            }
            if (array_key_exists('start_date', $validated)) {
                $updateData['start_date'] = $validated['start_date'];
            }

            $task->update($updateData);

            // Sinkronisasi checklist jika dikirim dalam request update
            if ($request->has('checklists') && is_array($request->checklists)) {
                $keptIds = [];
                foreach ($request->checklists as $idx => $chkData) {
                    $chkTitle = is_array($chkData) ? ($chkData['title'] ?? '') : (string) $chkData;
                    if (trim($chkTitle) === '') continue;

                    $chkId = is_array($chkData) && !empty($chkData['id']) ? $chkData['id'] : null;
                    if ($chkId) {
                        $existing = TaskChecklist::where('task_id', $task->id)->find($chkId);
                        if ($existing) {
                            $existing->update([
                                'title' => trim($chkTitle),
                                'position' => $idx + 1,
                            ]);
                            $keptIds[] = $existing->id;
                            continue;
                        }
                    }

                    $newChk = TaskChecklist::create([
                        'task_id' => $task->id,
                        'title' => trim($chkTitle),
                        'is_completed' => false,
                        'position' => $idx + 1,
                    ]);
                    $keptIds[] = $newChk->id;
                }

                // Hapus checklist yang dihilangkan
                TaskChecklist::where('task_id', $task->id)
                    ->whereNotIn('id', $keptIds)
                    ->delete();
            }

            $task->load(['project', 'milestone', 'assignee', 'creator', 'checklists']);

            Activity::create([
                'user_name' => $user ? $user->name : 'Sistem PKM',
                'action' => 'memperbarui tugas "' . $task->title . '"',
                'target_name' => $task->title,
                'project_name' => $task->project ? $task->project->name : null,
                'avatar_color' => 'yellow',
            ]);

            return $task;
        });

        $chkStats = $task->getChecklistStats();
        $task->checklist_total = $chkStats['total'];
        $task->checklist_completed = $chkStats['completed'];
        $task->checklist_progress = $chkStats['progress'];

        return response()->json([
            'message' => 'Tugas berhasil diperbarui.',
            'task' => $task,
        ]);
    }

    /**
     * Quick Assign: Membagikan atau mengganti Member penanggung jawab secara instan.
     */
    public function assign(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'message' => 'Hanya Super Admin dan Project Manager yang memiliki izin menugaskan pekerjaan.',
            ], 403);
        }

        $task = Task::with('project')->findOrFail($id);

        if ($user->role === 'project_manager' && (int) $task->project->pic_id !== (int) $user->id) {
            return response()->json([
                'message' => 'Anda hanya dapat menugaskan pekerjaan pada proyek yang Anda pimpin.',
            ], 403);
        }

        $validated = $request->validate([
            'assignee_id' => ['required', 'exists:users,id'],
        ], [
            'assignee_id.required' => 'Penanggung jawab (Member) wajib dipilih.',
            'assignee_id.exists' => 'Member yang dipilih tidak terdaftar di sistem.',
        ]);

        $candidate = User::findOrFail($validated['assignee_id']);

        if (in_array($candidate->role, ['admin', 'pimpinan'])) {
            return response()->json([
                'message' => 'Admin atau Pimpinan tidak dapat ditugaskan sebagai pelaksana tugas proyek.',
                'errors' => [
                    'assignee_id' => ['Pengguna dengan role admin atau pimpinan tidak dapat ditugaskan sebagai pelaksana tugas.'],
                ],
            ], 422);
        }

        if ($user->role === 'project_manager' && $candidate->role !== 'member') {
            return response()->json([
                'message' => 'Tugas hanya dapat dibagikan kepada pengguna dengan role Member.',
                'errors' => [
                    'assignee_id' => ['Penanggung jawab tugas harus memiliki role member.'],
                ],
            ], 422);
        }

        $task->assignee_id = $candidate->id;
        $task->assignee_name = $candidate->name;
        $task->save();

        Activity::create([
            'user_name' => $user ? $user->name : 'Sistem PKM',
            'action' => 'menugaskan "' . $task->title . '" kepada ' . $candidate->name,
            'target_name' => $task->title,
            'project_name' => $task->project ? $task->project->name : null,
            'avatar_color' => 'yellow',
        ]);

        $task->load(['project', 'milestone', 'assignee', 'creator', 'checklists']);
        $chkStats = $task->getChecklistStats();
        $task->checklist_total = $chkStats['total'];
        $task->checklist_completed = $chkStats['completed'];
        $task->checklist_progress = $chkStats['progress'];

        return response()->json([
            'message' => 'Penanggung jawab tugas berhasil diperbarui.',
            'task' => $task,
        ]);
    }

    /**
     * Hapus tugas dari database.
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();

        // Otorisasi role: hanya admin dan project_manager yang dapat menghapus tugas
        if (!$user || !in_array($user->role, ['admin', 'project_manager'])) {
            return response()->json([
                'message' => 'Hanya Super Admin dan Project Manager yang memiliki izin menghapus tugas.',
            ], 403);
        }

        $task = Task::with('project')->findOrFail($id);

        // Otorisasi tugas: PM hanya boleh menghapus task pada proyek yang dipimpinnya
        if ($user->role === 'project_manager' && (int) $task->project->pic_id !== (int) $user->id) {
            return response()->json([
                'message' => 'Anda hanya dapat menghapus tugas pada proyek yang Anda pimpin.',
            ], 403);
        }
        $taskTitle = $task->title;
        $projectName = $task->project ? $task->project->name : null;

        DB::transaction(function () use ($task, $user, $taskTitle, $projectName) {
            $task->delete();

            Activity::create([
                'user_name' => $user ? $user->name : 'Sistem PKM',
                'action' => 'menghapus tugas "' . $taskTitle . '"',
                'target_name' => $taskTitle,
                'project_name' => $projectName,
                'avatar_color' => 'purple',
            ]);
        });

        return response()->json([
            'message' => 'Tugas berhasil dihapus.',
        ]);
    }

    /**
     * Toggle status penyelesaian tugas (checked / unchecked).
     */
    public function toggle(Request $request, $id)
    {
        $user = $request->user();

        // RBAC: Pimpinan hanya memiliki akses pemantauan (view-only)
        if ($user && $user->role === 'pimpinan') {
            return response()->json([
                'message' => 'Pimpinan hanya memiliki hak akses pemantauan (view-only).',
            ], 403);
        }

        $task = Task::with('project')->findOrFail($id);

        // Otorisasi PM: PM hanya boleh memperbarui status tugas pada proyek yang dipimpinnya atau ditugaskan kepadanya
        if ($user && $user->role === 'project_manager') {
            $isPic = $task->project && (int) $task->project->pic_id === (int) $user->id;
            $isAssignee = (int) $task->assignee_id === (int) $user->id;
            if (!$isPic && !$isAssignee) {
                return response()->json([
                    'message' => 'Anda hanya dapat memperbarui status tugas pada proyek yang Anda pimpin.',
                ], 403);
            }
        }

        // RBAC: Member (karyawan) hanya dapat mengubah status tugas yang ditugaskan kepadanya
        if ($user && $user->role === 'member' && !empty($task->assignee_name)) {
            $userLower = strtolower(trim($user->name));
            $assigneeLower = strtolower(trim($task->assignee_name));
            if (strpos($userLower, $assigneeLower) === false && strpos($assigneeLower, $userLower) === false) {
                return response()->json([
                    'message' => 'Anda hanya berhak memperbarui status tugas yang ditugaskan kepada Anda (' . $task->assignee_name . ').',
                ], 403);
            }
        }

        $task->is_completed = !$task->is_completed;
        $task->status = $task->is_completed ? 'completed' : 'pending';
        $task->save();

        Activity::create([
            'user_name' => $user ? $user->name : 'Sistem PKM',
            'action' => $task->is_completed ? 'menyelesaikan tugas "' . $task->title . '"' : 'membuka kembali tugas "' . $task->title . '"',
            'target_name' => $task->title,
            'project_name' => $task->project ? $task->project->name : null,
            'avatar_color' => 'yellow',
        ]);

        $projectProgress = $task->project ? $task->project->calculateActualProgress() : 0;

        return response()->json([
            'message' => 'Status tugas berhasil diperbarui.',
            'task' => $task,
            'project_progress' => $projectProgress,
        ]);
    }
}
