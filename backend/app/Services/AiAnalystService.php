<?php

namespace App\Services;

use App\Models\Milestone;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiAnalystService
{
    /**
     * Main entry point to process questions.
     */
    public function ask(string $prompt, ?string $category = 'general', array $history = [], ?string $pageContext = null, ?User $user = null): array
    {
        $prompt = substr(trim($prompt), 0, 1000);
        $userRole = $user ? $user->role : 'member';

        // 1. Check for external LLM configuration (Google Gemini Free Tier)
        $apiKey = env('GEMINI_API_KEY') ?: env('AI_API_KEY');

        // 2. Perform Natural Language Understanding (NLU) & Entity Extraction
        $analysis = $this->analyzeIntentAndEntities($prompt, $history, $pageContext);

        // 3. If Google Gemini API is configured, feed targeted context into Gemini LLM
        if ($apiKey) {
            try {
                return $this->callGemini($apiKey, $prompt, $analysis, $history, $pageContext, $userRole);
            } catch (\Illuminate\Http\Client\ConnectionException $e) {
                Log::error('Gemini API Connection Timeout/Error: ' . $e->getMessage());
                $fallbackResult = $this->synthesizeResponse($analysis, $userRole);
                $fallbackResult['note'] = 'Koneksi ke Gemini AI gagal (timeout/network error). Jawaban dialihkan ke Rule-Based Engine PKM berbasis data real-time.';
                return $fallbackResult;
            } catch (\Exception $e) {
                Log::error('Gemini API Error: ' . $e->getMessage());
                // Graceful fallback to internal NLU & DB synthesis engine without fatal error
                $fallbackResult = $this->synthesizeResponse($analysis, $userRole);
                $fallbackResult['note'] = 'Layanan Gemini AI sedang mengalami kendala. Jawaban dialihkan secara otomatis ke Rule-Based Engine PKM berbasis data real-time.';
                return $fallbackResult;
            }
        }

        // 4. Default: Highly accurate deterministic NLU & DB synthesis engine
        return $this->synthesizeResponse($analysis, $userRole);
    }

    /**
     * Get system context snapshot for overview widgets.
     */
    public function getSystemContext(): array
    {
        $today = Carbon::now()->startOfDay();

        $projects = Project::where('is_active', true)->get();
        $totalProjects = $projects->count();
        $completedProjects = $projects->where('status', 'completed')->count();
        $atRiskProjects = $projects->where('status', 'at_risk');
        $delayedProjects = $projects->where('status', 'delayed');
        $onTrackProjects = $projects->where('status', 'on_track')->count();

        $tasks = Task::with('project')->get();
        $totalTasks = $tasks->count();
        $completedTasks = $tasks->where('is_completed', true)->count();
        $pendingTasks = $totalTasks - $completedTasks;
        
        $overdueTasks = $tasks->filter(function ($t) use ($today) {
            return !$t->is_completed && $t->deadline && Carbon::parse($t->deadline)->lt($today);
        });

        $users = User::where('is_active', true)->get();

        $milestones = Milestone::with(['project', 'tasks'])->get();
        $totalMilestones = $milestones->count();
        $completedMilestones = $milestones->where('status', 'completed')->count();
        $inProgressMilestones = $milestones->where('status', 'in_progress')->count();
        $avgMilestoneProgress = $totalMilestones > 0 ? (int) round($milestones->avg('progress')) : 0;

        $workload = [];
        foreach ($tasks as $t) {
            $name = trim($t->assignee_name) ?: 'Belum Ditugaskan';
            if (!isset($workload[$name])) {
                $workload[$name] = ['total' => 0, 'completed' => 0, 'pending' => 0, 'overdue' => 0];
            }
            $workload[$name]['total']++;
            if ($t->is_completed) {
                $workload[$name]['completed']++;
            } else {
                $workload[$name]['pending']++;
                if ($t->deadline && Carbon::parse($t->deadline)->lt($today)) {
                    $workload[$name]['overdue']++;
                }
            }
        }
        uasort($workload, fn($a, $b) => $b['pending'] <=> $a['pending']);

        return [
            'total_projects' => $totalProjects,
            'completed_projects' => $completedProjects,
            'on_track_projects' => $onTrackProjects,
            'at_risk_count' => $atRiskProjects->count(),
            'delayed_count' => $delayedProjects->count(),
            'total_tasks' => $totalTasks,
            'completed_tasks' => $completedTasks,
            'pending_tasks' => $pendingTasks,
            'overdue_tasks_count' => $overdueTasks->count(),
            'team_count' => $users->count(),
            'team_workload' => $workload,
            'completion_rate' => $totalTasks > 0 ? round(($completedTasks / $totalTasks) * 100, 1) : 0,
            'total_sprints' => $totalMilestones,
            'completed_sprints' => $completedMilestones,
            'in_progress_sprints' => $inProgressMilestones,
            'avg_sprint_progress' => $avgMilestoneProgress,
            'at_risk_list' => $atRiskProjects->values()->all(),
            'delayed_list' => $delayedProjects->values()->all(),
            'sprints_list' => $milestones->take(6)->map(fn($m) => [
                'id' => $m->id,
                'title' => $m->title,
                'project' => $m->project ? $m->project->name : 'Umum',
                'status' => $m->status,
                'progress' => (int) $m->progress,
            ])->all(),
        ];
    }

    /**
     * STAGE 1 & 2: Natural Language Understanding, Pronoun Resolution, and Entity Recognition.
     */
    protected function analyzeIntentAndEntities(string $prompt, array $history = [], ?string $pageContext = null): array
    {
        $norm = strtolower(trim($prompt));
        $now = Carbon::now()->startOfDay();

        // 1. Resolve pronoun / contextual references from history
        $contextualProjectName = null;
        // Expanded pronoun patterns — also catches "kenapa proyek itu", "proyek itu bisa", etc.
        $isFollowUp = preg_match(
            '/\b(proyek\s+itu|proyek\s+tersebut|proyek\s+tadi|proyek\s+ini\b|pekerjaan\s+itu|tugas\s+itu|tugas\s+tadi|tim\s+tersebut|kenapa\s+terlambat|lalu\s+solusinya|apa\s+dampaknya|proyek\s+yang\s+sama|proyek\s+di\s+atas|itu\s+kenapa|kenapa\s+itu)\b/i',
            $norm
        );

        if ($isFollowUp && !empty($history)) {
            // Traverse history backward to identify last mentioned project
            for ($i = count($history) - 1; $i >= 0; $i--) {
                $item = $history[$i];
                $pastText = ($item['user'] ?? '') . ' ' . ($item['reply'] ?? '') . ' ' . ($item['text'] ?? '') . ' ' . ($item['answer'] ?? '');
                $matchedPast = $this->extractProjectEntity($pastText);
                if ($matchedPast['type'] === 'exact' || $matchedPast['type'] === 'single_match') {
                    $contextualProjectName = $matchedPast['project']->name;
                    break;
                }
            }
        }

        // 2. Entity Recognition for Projects
        $projectMatch = $this->extractProjectEntity($prompt);

        // If pronoun follow-up AND current prompt did not resolve to a known project, use contextual project
        if (($projectMatch['type'] === 'none' || $projectMatch['type'] === 'not_found' || $projectMatch['type'] === 'ambiguous') && $isFollowUp && $contextualProjectName) {
            // Resolve directly: look up contextual project name as exact search
            $resolved = $this->extractProjectEntity($contextualProjectName);
            if ($resolved['type'] === 'exact' || $resolved['type'] === 'single_match') {
                $projectMatch = $resolved;
                $projectMatch['is_contextual'] = true;
            }
        } elseif ($projectMatch['type'] === 'none' && $contextualProjectName) {
            $projectMatch = $this->extractProjectEntity($contextualProjectName);
            $projectMatch['is_contextual'] = true;
        }

        // 3. Entity Recognition for Persons / Team Members
        $personMatch = $this->extractPersonEntity($prompt);

        // 4. Intent Classification
        $intent = 'general_inquiry';

        // --- Pre-check: Generic portfolio/risk queries (override project entity result) ---
        $isPortfolioRiskQuery = preg_match(
            '/\b(proyek.*bermasalah|proyek.*butuh.*perhatian|proyek.*membutuhkan.*perhatian|proyek.*berisiko|proyek.*terlambat|proyek.*delayed|kendala.*utama.*proyek|proyek.*at.*risk|tampilkan.*proyek.*perhatian|butuh.*atensi|butuh.*perhatian|lihat.*proyek.*bermasalah|cari.*proyek.*bermasalah|mana.*proyek.*bermasalah|ada.*proyek.*bermasalah|semua.*proyek.*bermasalah|proyek.*mana.*bermasalah|proyek.*mana.*terlambat)\b/i',
            $norm
        );

        // Check if user is asking about a specific project
        if ($projectMatch['type'] === 'exact' || $projectMatch['type'] === 'single_match') {
            $intent = 'single_project_analysis';
        } elseif ($projectMatch['type'] === 'ambiguous') {
            $intent = 'project_clarification_needed';
        } elseif ($isPortfolioRiskQuery) {
            // Generic portfolio risk query — even if entity extractor returned not_found, override
            $intent = 'all_project_risks';
        } elseif ($projectMatch['type'] === 'not_found' && !empty($projectMatch['search_term'])) {
            $intent = 'project_not_found';
        }
        // General Questions about Workload / Team
        elseif (preg_match('/\b(siapa.*tugas.*banyak|siapa.*paling.*banyak.*pekerjaan|siapa.*paling.*sibuk|beban.*kerja|kapasitas.*tim|beban.*anggota|pekerjaan.*tim.*minggu.*ini|paling.*banyak.*belum.*selesai)\b/i', $norm)) {
            $intent = 'employee_workload';
        }
        // General Questions about Overdue Tasks & Priorities
        elseif (preg_match('/\b(ada.*tugas.*telat|ada.*pekerjaan.*terlambat|tugas.*overdue|deadline.*terlewat|prioritas.*hari.*ini|harus.*dikerjakan.*hari.*ini|segera.*ditindaklanjuti)\b/i', $norm)) {
            $intent = 'task_management';
        }
        // Overall Business Overview / Executive Evaluation
        elseif (preg_match('/\b(kondisi.*perusahaan|kondisi.*bisnis|ringkasan.*pekerjaan|laporan.*pimpinan|evaluasi.*pimpinan|kesehatan.*bisnis|ringkasan.*kondisi)\b/i', $norm)) {
            $intent = 'business_overview';
        }
        // All troubled projects / Portfolio Risk (broader patterns)
        elseif (preg_match('/\b(proyek.*bermasalah|proyek.*butuh.*perhatian|proyek.*membutuhkan.*perhatian|proyek.*berisiko|proyek.*terlambat|proyek.*delayed|kendala.*utama.*proyek|proyek.*at.*risk|tampilkan.*proyek.*perhatian|butuh.*atensi|butuh.*perhatian)\b/i', $norm)) {
            $intent = 'all_project_risks';
        }
        // Performance Comparison
        elseif (preg_match('/\b(bandingkan|perbandingan|bulan.*ini.*dengan.*bulan.*lalu|antar.*periode)\b/i', $norm)) {
            $intent = 'data_comparison';
        }
        // Sprint / Milestone Performance
        elseif (preg_match('/\b(sprint|milestone|fase.*pengembangan|tahapan.*proyek|progres.*sprint|target.*sprint|kinerja.*sprint)\b/i', $norm)) {
            $intent = 'sprint_performance';
        }
        // General Management Consultation (Productivity / Methodology)
        elseif (preg_match('/\b(cara.*meningkatkan.*produktivitas|strategi.*manajemen|bagaimana.*meningkatkan|tips.*manajemen)\b/i', $norm)) {
            $intent = 'general_consultation';
        }

        return [
            'prompt' => $prompt,
            'intent' => $intent,
            'project_match' => $projectMatch,
            'person_match' => $personMatch,
            'page_context' => $pageContext,
            'is_follow_up' => $isFollowUp,
        ];
    }

    /**
     * Match project entity from prompt against all database projects.
     */
    protected function extractProjectEntity(string $text): array
    {
        $projects = Project::where('is_active', true)->get();
        $textLower = strtolower($text);

        // Filter out general descriptive terms after "proyek" — all patterns that should NOT trigger project lookup
        $isGenericProjectQuery = preg_match(
            '/\bproyek\s+(yang|apa|mana|seluruh|semua|bermasalah|berisiko|terlambat|delayed|at\s*risk|butuh|membutuhkan|kritis|prioritas|apa\s+saja|mana\s+saja|ada\s+yang|harus|perlu|kurang|sedang)\b/i',
            $textLower
        ) || preg_match(
            '/\b(tampilkan|lihat|cari|tunjukkan|list|semua|seluruh|ada\s+berapa|berapa)\s+(proyek|project)\b/i',
            $textLower
        ) || preg_match(
            '/\b(proyek|project)\s+[a-z]+\s+(perhatian|atensi|prioritas|penanganan|tindakan|perbaikan)\b/i',
            $textLower
        );

        // 1. Direct Code Matching (e.g., PKM-004, PKM004)
        foreach ($projects as $p) {
            $codeLower = strtolower($p->code);
            $codeNoDash = str_replace('-', '', $codeLower);
            if (preg_match('/\b' . preg_quote($codeLower, '/') . '\b/i', $textLower) || preg_match('/\b' . preg_quote($codeNoDash, '/') . '\b/i', $textLower)) {
                return ['type' => 'exact', 'project' => $p, 'match_by' => 'code'];
            }
        }

        // 2. Exact or High-Confidence Name Matching
        $matches = [];
        foreach ($projects as $p) {
            $pNameLower = strtolower($p->name);
            $pClientLower = strtolower($p->client);

            // Exact phrase match in text
            if (preg_match('/\b' . preg_quote($pNameLower, '/') . '\b/i', $textLower)) {
                $matches[] = ['project' => $p, 'score' => 100, 'matched' => $p->name, 'len' => strlen($p->name)];
                continue;
            }

            // Client exact match
            if (strlen($pClientLower) > 3 && preg_match('/\b' . preg_quote($pClientLower, '/') . '\b/i', $textLower)) {
                $matches[] = ['project' => $p, 'score' => 95, 'matched' => $p->client, 'len' => strlen($p->client)];
                continue;
            }

            // Word-subset matching (only if not a generic query like "proyek yang...")
            if (!$isGenericProjectQuery) {
                $words = array_filter(explode(' ', $pNameLower), fn($w) => strlen($w) > 1 && !in_array($w, ['pt', 'cv', 'dan', 'yang', 'di']));
                $wordMatches = 0;
                foreach ($words as $w) {
                    if (preg_match('/\b' . preg_quote($w, '/') . '\b/i', $textLower)) {
                        $wordMatches++;
                    }
                }

                if (count($words) > 0 && $wordMatches === count($words)) {
                    $matches[] = ['project' => $p, 'score' => 90, 'matched' => $p->name, 'len' => strlen($p->name)];
                } elseif (count($words) > 1 && $wordMatches >= 2) {
                    $matches[] = ['project' => $p, 'score' => 50 + ($wordMatches * 10), 'matched' => $p->name, 'len' => strlen($p->name)];
                }
            }
        }

        // Sort matches by score descending, then by length descending
        usort($matches, function ($a, $b) {
            if ($a['score'] !== $b['score']) return $b['score'] <=> $a['score'];
            return $b['len'] <=> $a['len'];
        });

        // If top match is 100 (exact full name match), return exact!
        if (!empty($matches) && $matches[0]['score'] === 100) {
            return ['type' => 'exact', 'project' => $matches[0]['project'], 'match_by' => 'name'];
        }

        if (count($matches) === 1 && $matches[0]['score'] >= 70) {
            return ['type' => 'single_match', 'project' => $matches[0]['project'], 'match_by' => 'name'];
        }

        if (count($matches) > 1) {
            if ($matches[0]['score'] >= 90 && $matches[1]['score'] < 80) {
                return ['type' => 'single_match', 'project' => $matches[0]['project'], 'match_by' => 'name'];
            }
            // Ambiguous
            $topScores = array_filter($matches, fn($m) => $m['score'] >= 60);
            return [
                'type' => 'ambiguous',
                'candidates' => array_slice(array_column($topScores, 'project'), 0, 3),
            ];
        }

        // 3. Named Project Mentioned But Not Found in Database
        // Uses negative lookahead to reject pronoun/generic words immediately after "proyek"
        if (!$isGenericProjectQuery && preg_match(
            '/(?:proyek|project)\s+(?!(?:itu|ini|tersebut|tadi|yang|apa|mana|bisa|harus|perlu|semua|seluruh)\b)([a-zA-Z0-9][a-zA-Z0-9\s\-]{1,}?[a-zA-Z0-9])(?:\s+(?:bermasalah|belum|selesai|terlambat|gimana|kenapa|apa|bisa|harus|perlu|boleh|yang|sedang|masih|sudah|akan|dari|dengan|untuk)|[?!.,]|$)/i',
            $text,
            $m
        )) {
            $extractedTerm = trim($m[1]);
            // Double check: reject pure pronouns
            $pronounStopwords = ['itu', 'ini', 'tersebut', 'tadi', 'yang', 'apa', 'mana',
                                 'kritis', 'bermasalah', 'berisiko', 'terlambat', 'delayed',
                                 'bisa', 'boleh', 'harus', 'perlu', 'saja', 'semua', 'seluruh'];
            if (strlen($extractedTerm) >= 3 && !in_array(strtolower($extractedTerm), $pronounStopwords)) {
                return [
                    'type' => 'not_found',
                    'search_term' => $extractedTerm,
                    'available_projects' => $projects->take(4)->all()
                ];
            }
        }

        return ['type' => 'none'];
    }

    /**
     * Match person/assignee entity from prompt.
     */
    protected function extractPersonEntity(string $text): ?string
    {
        $users = User::pluck('name')->all();
        $assignees = Task::whereNotNull('assignee_name')->distinct()->pluck('assignee_name')->all();
        $candidates = array_unique(array_merge($users, $assignees));

        $textLower = strtolower($text);
        foreach ($candidates as $name) {
            if (strlen($name) >= 3 && str_contains($textLower, strtolower($name))) {
                return $name;
            }
        }

        return null;
    }

    /**
     * STAGE 4 & 5: Targeted Data Retrieval & Factual Answer Synthesis.
     */
    protected function synthesizeResponse(array $analysis, string $userRole): array
    {
        $nowStr = Carbon::now()->format('H:i, d M Y');
        $intent = $analysis['intent'];

        // SCENARIO 1: SPECIFIC SINGLE PROJECT ANALYSIS (e.g. Website Klien B)
        if ($intent === 'single_project_analysis') {
            return $this->handleSingleProjectAnalysis($analysis['project_match']['project'], $analysis['prompt'], $userRole);
        }

        // SCENARIO 2: PROJECT CLARIFICATION NEEDED (Ambiguous query)
        if ($intent === 'project_clarification_needed') {
            return $this->handleProjectClarification($analysis['project_match']['candidates'], $analysis['prompt']);
        }

        // SCENARIO 3: SPECIFIC PROJECT NOT FOUND
        if ($intent === 'project_not_found') {
            return $this->handleProjectNotFound($analysis['project_match']['search_term'], $analysis['project_match']['available_projects'] ?? []);
        }

        // SCENARIO 4: EMPLOYEE WORKLOAD & TEAM PERFORMANCE
        if ($intent === 'employee_workload') {
            return $this->handleEmployeeWorkload($analysis['person_match'], $userRole);
        }

        // SCENARIO 5: TASK MANAGEMENT & OVERDUE DEADLINES
        if ($intent === 'task_management') {
            return $this->handleTaskManagement($userRole);
        }

        // SCENARIO 6: ALL PROJECT RISKS (When user explicitly asks for all troubled projects)
        if ($intent === 'all_project_risks') {
            return $this->handleAllProjectRisks($userRole);
        }

        // SCENARIO 7: BUSINESS OVERVIEW & EXECUTIVE REPORT
        if ($intent === 'business_overview') {
            return $this->handleBusinessOverview($userRole);
        }

        // SCENARIO 8: DATA COMPARISON (Between periods)
        if ($intent === 'data_comparison') {
            return $this->handleDataComparison($userRole);
        }

        // SCENARIO 9: SPRINT & MILESTONE PERFORMANCE
        if ($intent === 'sprint_performance') {
            return $this->handleSprintPerformance($userRole);
        }

        // SCENARIO 10: GENERAL CONSULTATION (Productivity / Management advice)
        if ($intent === 'general_consultation') {
            return $this->handleGeneralConsultation($analysis['prompt'], $userRole);
        }

        // SCENARIO 11: GENERAL INQUIRY / CONVERSATIONAL FALLBACK
        return $this->handleGeneralInquiry($analysis['prompt'], $userRole);
    }

    /**
     * Handler: Single Project Detailed Analysis (STRICTLY answers about the specific project only).
     */
    protected function handleSingleProjectAnalysis(Project $project, string $prompt, string $userRole): array
    {
        $today = Carbon::now()->startOfDay();

        // 1. Eager load only this project's tasks & milestones
        $project->load(['tasks', 'milestones']);
        $tasks = $project->tasks ?? collect();
        $milestones = $project->milestones ?? collect();

        $totalTasks = $tasks->count();
        $completedTasks = $tasks->where('is_completed', true)->count();
        $pendingTasks = $totalTasks - $completedTasks;
        
        $overdueTasks = $tasks->filter(function ($t) use ($today) {
            return !$t->is_completed && $t->deadline && Carbon::parse($t->deadline)->lt($today);
        });

        // Calculate progress gap
        $progress = $project->progress;
        $targetProgress = $project->target_progress ?: 0;
        $deviation = $targetProgress - $progress;

        // Deadline status
        $deadlineStr = $project->deadline ? Carbon::parse($project->deadline)->format('d M Y') : 'Belum ditentukan';
        $deadlineDiff = $project->deadline ? $today->diffInDays(Carbon::parse($project->deadline), false) : 0;
        
        $statusLabel = strtoupper(str_replace('_', ' ', $project->status));
        $riskLabel = strtoupper($project->risk_level ?: 'LOW');
        $riskFactor = $project->risk_factor ?: 'Tidak tercatat faktor risiko khusus di sistem';

        // 2. Identify Factual Findings
        $factualFindings = [];
        $factualFindings[] = "Progress saat ini tercatat **{$progress}%** dari target **{$targetProgress}%** (deviasi keterlambatan: **{$deviation} poin persentase**).";
        $factualFindings[] = "Status proyek resmi di database: **{$statusLabel}** dengan tingkat risiko **{$riskLabel}**.";
        $factualFindings[] = "Faktor risiko tercatat di sistem: **{$riskFactor}**.";
        
        if ($totalTasks > 0) {
            $factualFindings[] = "Terdapat **{$completedTasks} dari {$totalTasks} tugas selesai**, dengan **{$overdueTasks->count()} tugas telah melewati deadline**.";
        } else {
            $factualFindings[] = "Belum ada checklist tugas operasional yang didaftarkan untuk proyek ini.";
        }

        // Check milestones
        $overdueMilestones = $milestones->filter(function ($m) use ($today) {
            return $m->status !== 'completed' && $m->due_date && Carbon::parse($m->due_date)->lt($today);
        });
        if ($overdueMilestones->count() > 0) {
            $mNames = $overdueMilestones->pluck('title')->implode(', ');
            $factualFindings[] = "Milestone yang tertahan melewati target: **{$mNames}**.";
        }

        // 3. List Overdue Tasks Specifically
        $overdueList = [];
        foreach ($overdueTasks as $ot) {
            $dStr = $ot->deadline ? Carbon::parse($ot->deadline)->format('d M Y') : '-';
            $overdueList[] = "[{$ot->priority}] {$ot->title} (PIC: {$ot->assignee_name}, Deadline: {$dStr})";
        }

        // 4. Root Causes & Actionable Recommendations
        $recommendations = [];
        if ($overdueTasks->count() > 0) {
            $recommendations[] = "Selesaikan segera {$overdueTasks->count()} tugas overdue berkategori prioritas tinggi oleh tim teknis.";
        }
        if (str_contains(strtolower($riskFactor), 'resource')) {
            $recommendations[] = "Lakukan penambahan atau alokasi ulang personil (resource allocation) sesuai faktor risiko yang teridentifikasi.";
        }
        $recommendations[] = "Jadwalkan koordinasi teknis dengan klien ({$project->client}) untuk sinkronisasi ekspektasi tanggal rilis.";

        // 5. Build Formatted Response
        $reply = "### Analisis Proyek: {$project->name} ({$project->code})\n\n";
        $reply .= "**1. Kondisi Saat Ini (Data Faktual Database)**\n";
        $reply .= "- **Klien:** {$project->client}\n";
        $reply .= "- **Progress Aktual:** {$progress}% (Target: {$targetProgress}% | Deviasi: -{$deviation}%)\n";
        $reply .= "- **Status:** {$statusLabel}\n";
        $reply .= "- **Tingkat Risiko:** {$riskLabel}\n";
        $reply .= "- **Deadline:** {$deadlineStr} " . ($deadlineDiff < 0 ? "(Terlewat " . abs($deadlineDiff) . " hari)" : "({$deadlineDiff} hari tersisa)") . "\n\n";

        $reply .= "**2. Temuan Masalah Faktual**\n";
        foreach ($factualFindings as $f) {
            $reply .= "- {$f}\n";
        }
        if (!empty($overdueList)) {
            $reply .= "\n*Rincian Tugas Terlambat (Overdue):*\n";
            foreach ($overdueList as $ol) {
                $reply .= "  - {$ol}\n";
            }
        }
        $reply .= "\n";

        $reply .= "**3. Penyebab & Analisis Risiko**\n";
        $reply .= "- **Faktor Penyebab Utama:** Berdasarkan catatan database, keterlambatan dipicu oleh: *\"{$riskFactor}\"* serta adanya akumulasi tugas teknis yang tertunda.\n";
        $reply .= "- **Potensi Dampak:** Risiko penalti SLA kepada {$project->client} apabila target penyelesaian {$deadlineStr} tidak segera dimitigasi.\n\n";

        $reply .= "**4. Rekomendasi Tindakan Strategis**\n";
        foreach ($recommendations as $i => $rec) {
            $reply .= ($i + 1) . ". {$rec}\n";
        }
        $reply .= "\n";

        $reply .= "**5. Prioritas Tindakan Pertama**\n";
        $reply .= "Tuntaskan backlog tugas overdue milik PIC bersangkutan hari ini dan pastikan progres milestone fase berjalan dapat terverifikasi sebelum akhir pekan.";

        return [
            'success' => true,
            'type' => 'single_project_analysis',
            'summary' => "Proyek {$project->name} berstatus {$statusLabel} dengan deviasi progres {$deviation}% dan {$overdueTasks->count()} tugas overdue.",
            'findings' => $factualFindings,
            'recommendations' => $recommendations,
            'data_points' => [
                ['label' => 'Proyek', 'value' => $project->name],
                ['label' => 'Kode', 'value' => $project->code],
                ['label' => 'Klien', 'value' => $project->client],
                ['label' => 'Progress / Target', 'value' => "{$progress}% / {$targetProgress}%"],
                ['label' => 'Status / Risiko', 'value' => "{$statusLabel} / {$riskLabel}"],
                ['label' => 'Faktor Risiko', 'value' => $riskFactor],
                ['label' => 'Tugas Overdue', 'value' => $overdueTasks->count() . ' tugas'],
            ],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: Ambiguous Project Clarification.
     */
    protected function handleProjectClarification(array $candidates, string $prompt): array
    {
        $candidateNames = array_map(fn($p) => "{$p->name} ({$p->code})", $candidates);
        $summary = "Ditemukan beberapa proyek dengan nama serupa. Mohon spesifikasikan proyek yang Anda maksud.";

        $reply = "### Klarifikasi Proyek\n\n";
        $reply .= "Pertanyaan Anda merujuk pada beberapa proyek yang terdaftar di database:\n\n";
        foreach ($candidates as $c) {
            $reply .= "- **{$c->name}** (Kode: `{$c->code}` | Klien: {$c->client} | Status: {$c->status})\n";
        }
        $reply .= "\nMohon ketikkan nama atau kode proyek yang spesifik (misal: *\"Jelaskan kondisi proyek {$candidates[0]->name}\"*).";

        return [
            'success' => true,
            'type' => 'project_clarification_needed',
            'summary' => $summary,
            'findings' => $candidateNames,
            'recommendations' => ["Ketik ulang dengan nama lengkap proyek yang ingin dianalisis."],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: Project Not Found in Database.
     */
    protected function handleProjectNotFound(string $searchTerm, array $availableProjects): array
    {
        $summary = "Proyek '{$searchTerm}' tidak ditemukan di database PKM Control Center.";

        $reply = "### Proyek Tidak Ditemukan\n\n";
        $reply .= "Maaf, proyek **\"{$searchTerm}\"** tidak ditemukan di dalam basis data PKM Control Center.\n\n";
        
        if (!empty($availableProjects)) {
            $reply .= "**Berikut beberapa proyek yang saat ini terdaftar:**\n";
            foreach ($availableProjects as $p) {
                $reply .= "- **{$p->name}** (`{$p->code}`) — Status: {$p->status}\n";
            }
            $reply .= "\nSilakan ajukan pertanyaan menggunakan nama proyek yang terdaftar di atas.";
        }

        return [
            'success' => true,
            'type' => 'project_not_found',
            'summary' => $summary,
            'findings' => ["Pencarian '{$searchTerm}' menghasilkan 0 entitas."],
            'recommendations' => ["Periksa ejaan nama proyek atau gunakan kode proyek resmi."],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: Employee Workload Analysis.
     */
    protected function handleEmployeeWorkload(?string $specificPerson, string $userRole): array
    {
        $today = Carbon::now()->startOfDay();
        $tasks = Task::all();

        $workload = [];
        foreach ($tasks as $t) {
            $name = trim($t->assignee_name) ?: 'Belum Ditugaskan';
            if (!isset($workload[$name])) {
                $workload[$name] = ['name' => $name, 'total' => 0, 'completed' => 0, 'pending' => 0, 'overdue' => 0];
            }
            $workload[$name]['total']++;
            if ($t->is_completed) {
                $workload[$name]['completed']++;
            } else {
                $workload[$name]['pending']++;
                if ($t->deadline && Carbon::parse($t->deadline)->lt($today)) {
                    $workload[$name]['overdue']++;
                }
            }
        }

        // Sort by pending tasks descending
        uasort($workload, fn($a, $b) => $b['pending'] <=> $a['pending']);
        $ranked = array_values($workload);

        if ($specificPerson && isset($workload[$specificPerson])) {
            $target = $workload[$specificPerson];
            $summary = "Anggota tim '{$specificPerson}' memiliki total {$target['total']} tugas ({$target['pending']} pending, {$target['overdue']} overdue).";

            $reply = "### Analisis Beban Kerja: {$specificPerson}\n\n";
            $reply .= "**1. Status Tugas Faktual**\n";
            $reply .= "- Total Tugas Terdaftar: **{$target['total']} tugas**\n";
            $reply .= "- Tugas Selesai: **{$target['completed']} tugas**\n";
            $reply .= "- Tugas Masih Pending: **{$target['pending']} tugas**\n";
            $reply .= "- Tugas Overdue (Terlambat): **{$target['overdue']} tugas**\n\n";

            $reply .= "**2. Rekomendasi Manajemen**\n";
            if ($target['overdue'] > 0) {
                $reply .= "1. Segera lakukan review terhadap {$target['overdue']} tugas overdue untuk mengetahui apakah kendala terletak pada teknis atau approval.\n";
            }
            $reply .= "2. Seimbangkan beban jika anggota tim menangani terlalu banyak tugas pending secara bersamaan.\n";

            return [
                'success' => true,
                'type' => 'employee_workload',
                'summary' => $summary,
                'findings' => ["{$specificPerson}: {$target['pending']} pending, {$target['overdue']} overdue"],
                'recommendations' => ["Evaluasi kapasitas anggota terkait."],
                'reply' => $reply,
                'mode' => 'Rule-Based Engine (Database Real-Time Context)',
                'timestamp' => Carbon::now()->format('H:i, d M Y'),
            ];
        }

        $topPerson = !empty($ranked) ? $ranked[0] : null;
        $summary = $topPerson 
            ? "Beban tugas belum selesai tertinggi saat ini diemban oleh '{$topPerson['name']}' dengan {$topPerson['pending']} tugas pending ({$topPerson['overdue']} overdue)."
            : "Belum ada data penugasan operasional di sistem.";

        $reply = "### Analisis Beban Kerja Anggota Tim PKM\n\n";
        $reply .= "**Ringkasan Faktual:**\n{$summary}\n\n";
        $reply .= "**Daftar Distribusi Tugas per Personil:**\n\n";
        $reply .= "| Nama Personil / Tim | Total Tugas | Selesai | Pending (Belum Selesai) | Overdue |\n";
        $reply .= "| :--- | :--- | :--- | :--- | :--- |\n";
        foreach ($ranked as $r) {
            $reply .= "| **{$r['name']}** | {$r['total']} | {$r['completed']} | **{$r['pending']}** | " . ($r['overdue'] > 0 ? "<span style='color:red'>{$r['overdue']}</span>" : "0") . " |\n";
        }
        $reply .= "\n";

        $reply .= "**Rekomendasi Tindakan Pimpinan:**\n";
        $reply .= "1. **Penyeimbangan Beban (Load Balancing):** Alihkan sebagian tugas pending dari personil dengan beban tertinggi ke anggota yang memiliki kapasitas longgar.\n";
        $reply .= "2. **Mitigasi Tugas Overdue:** Prioritaskan penyelesaian tugas overdue yang berpotensi menghambat milestone proyek klien.\n";
        $reply .= "3. **Kelengkapan Penugasan:** Pastikan seluruh tugas memiliki PIC yang jelas dan tidak berstatus 'Belum Ditugaskan'.";

        return [
            'success' => true,
            'type' => 'employee_workload',
            'summary' => $summary,
            'findings' => array_map(fn($r) => "{$r['name']}: {$r['pending']} pending ({$r['overdue']} overdue)", array_slice($ranked, 0, 5)),
            'recommendations' => [
                "Re-alokasikan tugas dari pemegang beban tertinggi.",
                "Selesaikan tugas overdue yang terdaftar."
            ],
            'data_points' => $ranked,
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: Task Management & Overdue Tasks.
     */
    protected function handleTaskManagement(string $userRole): array
    {
        $today = Carbon::now()->startOfDay();
        $tasks = Task::with('project')->get();

        $totalTasks = $tasks->count();
        $completedTasks = $tasks->where('is_completed', true)->count();
        $pendingTasks = $totalTasks - $completedTasks;

        $overdueTasks = $tasks->filter(function ($t) use ($today) {
            return !$t->is_completed && $t->deadline && Carbon::parse($t->deadline)->lt($today);
        })->sortBy('deadline');

        $highPriorityOverdue = $overdueTasks->where('priority', 'high');

        $summary = "Terdapat {$overdueTasks->count()} tugas operasional yang terlambat melewati deadline dari total {$pendingTasks} tugas pending.";

        $reply = "### Laporan Monitoring Tugas & Keterlambatan (Overdue)\n\n";
        $reply .= "**1. Ringkasan Status Pekerjaan**\n";
        $reply .= "- Total Tugas Terdaftar: **{$totalTasks}**\n";
        $reply .= "- Tugas Selesai: **{$completedTasks}** (" . ($totalTasks > 0 ? round(($completedTasks / $totalTasks) * 100, 1) : 0) . "%)\n";
        $reply .= "- Tugas Belum Selesai (Pending): **{$pendingTasks}**\n";
        $reply .= "- **Tugas Terlambat (Overdue):** **{$overdueTasks->count()} tugas** (termasuk {$highPriorityOverdue->count()} High Priority)\n\n";

        if ($overdueTasks->count() > 0) {
            $reply .= "**2. Daftar Tugas yang Harus Segera Ditindaklanjuti:**\n\n";
            $reply .= "| Prioritas | Judul Tugas | Proyek | PIC | Deadline |\n";
            $reply .= "| :--- | :--- | :--- | :--- | :--- |\n";
            foreach ($overdueTasks->take(8) as $ot) {
                $pName = $ot->project ? $ot->project->name : 'Umum';
                $dStr = $ot->deadline ? Carbon::parse($ot->deadline)->format('d M Y') : '-';
                $reply .= "| **" . strtoupper($ot->priority) . "** | {$ot->title} | {$pName} | {$ot->assignee_name} | {$dStr} |\n";
            }
            $reply .= "\n";
        } else {
            $reply .= "**2. Kondisi Tugas:** Seluruh checklist tugas saat ini berada dalam rentang jadwal aman tanpa ada overdue.\n\n";
        }

        $reply .= "**3. Prioritas Tindakan Hari Ini**\n";
        $reply .= "1. Tuntaskan terlebih dahulu tugas bertanda **HIGH PRIORITY** yang melewati deadline untuk mencegah efek domino keterlambatan proyek.\n";
        $reply .= "2. Lakukan follow-up langsung dengan masing-masing PIC yang tertera di atas.\n";
        $reply .= "3. Segera perbarui status tugas di sistem jika pekerjaan sudah diverifikasi selesai di lapangan.";

        return [
            'success' => true,
            'type' => 'task_management',
            'summary' => $summary,
            'findings' => $overdueTasks->take(5)->map(fn($t) => "{$t->title} (PIC: {$t->assignee_name})")->values()->all(),
            'recommendations' => [
                "Prioritaskan 3 tugas high priority overdue hari ini.",
                "Koordinasikan kendala dengan PIC penanggung jawab."
            ],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: Portfolio Risk Analysis (ONLY when asked generally about all troubled projects).
     */
    protected function handleAllProjectRisks(string $userRole): array
    {
        $projects = Project::where('is_active', true)->get();
        $atRisk = $projects->where('status', 'at_risk');
        $delayed = $projects->where('status', 'delayed');
        $troubledCount = $atRisk->count() + $delayed->count();

        $summary = "Ditemukan total {$troubledCount} proyek yang membutuhkan atensi mitigasi aktif ({$atRisk->count()} At Risk, {$delayed->count()} Delayed).";

        $reply = "### Analisis Risiko Portofolio Proyek PKM\n\n";
        $reply .= "**Ringkasan Portofolio:** {$summary}\n\n";

        if ($troubledCount > 0) {
            $reply .= "**Daftar Proyek yang Membutuhkan Perhatian:**\n\n";
            $reply .= "| Proyek | Klien | Status | Tingkat Risiko | Progress vs Target | Faktor Risiko |\n";
            $reply .= "| :--- | :--- | :--- | :--- | :--- | :--- |\n";
            foreach ($delayed->concat($atRisk) as $tp) {
                $rf = $tp->risk_factor ?: 'Deviasi jadwal';
                $reply .= "| **{$tp->name}** (`{$tp->code}`) | {$tp->client} | " . strtoupper($tp->status) . " | **" . strtoupper($tp->risk_level) . "** | {$tp->progress}% / {$tp->target_progress}% | {$rf} |\n";
            }
            $reply .= "\n";
        } else {
            $reply .= "Seluruh proyek saat ini terpantau berada dalam jalur pengerjaan normal (On Track).\n\n";
        }

        $reply .= "**Rekomendasi Tindakan untuk Manajemen:**\n";
        $reply .= "1. Fokuskan mitigasi pada proyek berstatus **DELAYED** terlebih dahulu guna menjaga SLA klien.\n";
        $reply .= "2. Bedah kendala spesifik pada proyek **AT RISK** dalam standup mingguan sebelum eskalasi menjadi keterlambatan kritis.\n";
        $reply .= "3. Evaluasi ketersediaan resource tim teknis pada proyek-proyek di atas.";

        return [
            'success' => true,
            'type' => 'project_risk_portfolio',
            'summary' => $summary,
            'findings' => $delayed->concat($atRisk)->map(fn($p) => "{$p->name}: {$p->status} ({$p->progress}%)")->values()->all(),
            'recommendations' => ["Review proyek Delayed segera.", "Audit beban kerja teknis."],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: Business Overview & Management Report.
     */
    protected function handleBusinessOverview(string $userRole): array
    {
        $context = $this->getSystemContext();
        $health = ($context['at_risk_count'] + $context['delayed_count'] === 0) 
            ? 'SANGAT SEHAT' 
            : ($context['delayed_count'] > 0 ? 'BUTUH PERHATIAN PIMPINAN' : 'STABIL DENGAN RISIKO TERKENDALI');

        $summary = "Kondisi portofolio bisnis PT Potensi Karya Mandiri saat ini berstatus [{$health}]. Rata-rata tingkat penyelesaian tugas berada pada level {$context['completion_rate']}%.";

        $reply = "### Ringkasan Eksekutif & Kondisi Bisnis PKM\n\n";
        $reply .= "**Status Kesehatan Operasional:** **{$health}**\n\n";
        $reply .= "**1. Indikator Kunci Portofolio Bisnis (Data Faktual)**\n";
        $reply .= "- Total Proyek Terdaftar: **{$context['total_projects']} proyek** ({$context['on_track_projects']} On Track, {$context['at_risk_count']} At Risk, {$context['delayed_count']} Delayed, {$context['completed_projects']} Selesai)\n";
        $reply .= "- Rasio Penyelesaian Tugas: **{$context['completed_tasks']} dari {$context['total_tasks']} tugas** rampung (**{$context['completion_rate']}%**)\n";
        $reply .= "- Tugas Tertunda (Pending): **{$context['pending_tasks']} tugas**\n";
        $reply .= "- Tugas Terlewat Deadline: **{$context['overdue_tasks_count']} tugas**\n";
        $reply .= "- Jumlah Personil Aktif: **{$context['team_count']} anggota**\n\n";

        $reply .= "**2. Hal-Hal yang Membutuhkan Evaluasi Pimpinan**\n";
        $reply .= "1. **Mitigasi Proyek Bermasalah:** Terdapat {$context['delayed_count']} proyek delayed dan {$context['at_risk_count']} proyek at risk yang memerlukan peninjauan ulang alokasi sumber daya.\n";
        $reply .= "2. **Penyelesaian Bottleneck Overdue:** {$context['overdue_tasks_count']} checklist tugas overdue berisiko memicu efek domino keterlambatan penagihan termin proyek.\n";
        $reply .= "3. **Penjadwalan Review Mingguan:** Pertahankan sprint review rutin untuk menjaga deviasi progres portofolio di bawah toleransi 10%.\n";
        $reply .= "4. **Kapasitas SDM:** Pantau pemerataan penugasan agar tidak terjadi kejenuhan kerja pada anggota tim kunci.";

        return [
            'success' => true,
            'type' => 'business_overview',
            'summary' => $summary,
            'findings' => [
                "Total Portofolio: {$context['total_projects']} proyek ({$context['on_track_projects']} on track).",
                "Penyelesaian Tugas: {$context['completion_rate']}%.",
                "Tugas Overdue: {$context['overdue_tasks_count']} tugas."
            ],
            'recommendations' => [
                "Review proyek delayed bersama Project Manager.",
                "Prioritaskan checklist tugas overdue."
            ],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: Data Comparison (Truthful about temporal data limits).
     */
    protected function handleDataComparison(string $userRole): array
    {
        $context = $this->getSystemContext();
        $summary = "Sistem saat ini mencatat metrik perbandingan portofolio operasional aktif real-time.";

        $reply = "### Analisis Perbandingan Data Portofolio\n\n";
        $reply .= "**Keterangan Ketersediaan Data:**\n";
        $reply .= "Sistem PKM Control Center saat ini menyajikan metrik operasional terintegrasi secara real-time dari database MySQL.\n\n";
        $reply .= "**Kondisi Periode Berjalan:**\n";
        $reply .= "- Proyek Aktif Berjalan: **{$context['total_projects']} proyek**\n";
        $reply .= "- Proyek Telah Selesai (Arsip): **{$context['completed_projects']} proyek**\n";
        $reply .= "- Tingkat Penyelesaian Checklist: **{$context['completion_rate']}%**\n";
        $reply .= "- Tugas Overdue Saat Ini: **{$context['overdue_tasks_count']} tugas**\n\n";
        $reply .= "*Catatan Objektif:* Untuk melihat grafik perbandingan tren berkala yang lebih spesifik, silakan buka menu **Laporan & Analitik (Reports 2.0)** dan gunakan filter periode (Bulan Ini vs Bulan Lalu).";

        return [
            'success' => true,
            'type' => 'data_comparison',
            'summary' => $summary,
            'findings' => ["Data saat ini merefleksikan snapshot live database."],
            'recommendations' => ["Gunakan fitur filter periode pada modul Reports."],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: Sprint & Milestone Performance Analysis.
     */
    protected function handleSprintPerformance(string $userRole): array
    {
        $milestones = Milestone::with(['project', 'tasks'])->get();
        $totalSprints = $milestones->count();
        $completedSprints = $milestones->where('status', 'completed')->count();
        $inProgressSprints = $milestones->where('status', 'in_progress')->count();
        $pendingSprints = $milestones->whereIn('status', ['pending', 'planned'])->count();
        $avgProgress = $totalSprints > 0 ? (int) round($milestones->avg('progress')) : 0;

        $summary = "Sprint Tracker mencatat {$totalSprints} sprint operasional dengan rata-rata progres {$avgProgress}% ({$completedSprints} tuntas, {$inProgressSprints} aktif berjalan).";

        $reply = "### Analisis Kinerja Sprint & Milestone PKM\n\n";
        $reply .= "**Ringkasan Sprint Portofolio:**\n";
        $reply .= "- Total Sprint: **{$totalSprints} sprint**\n";
        $reply .= "- Sprint Selesai (100%): **{$completedSprints} sprint**\n";
        $reply .= "- Sprint Sedang Berjalan: **{$inProgressSprints} sprint**\n";
        $reply .= "- Sprint Menunggu Dimulai: **{$pendingSprints} sprint**\n";
        $reply .= "- Rata-rata Progres Sprint: **{$avgProgress}%**\n\n";

        if ($totalSprints > 0) {
            $reply .= "**Daftar Sprint yang Sedang Berjalan / Aktif:**\n\n";
            $reply .= "| Judul Sprint | Proyek Induk | Status | Progres | Tugas Selesai / Total | Target Selesai |\n";
            $reply .= "| :--- | :--- | :--- | :--- | :--- | :--- |\n";
            foreach ($milestones->take(8) as $m) {
                $pName = $m->project ? $m->project->name : 'Umum';
                $tCount = $m->tasks ? $m->tasks->count() : 0;
                $cCount = $m->tasks ? $m->tasks->where('is_completed', true)->count() : 0;
                $dueStr = $m->due_date ? Carbon::parse($m->due_date)->format('d M Y') : '-';
                $reply .= "| **{$m->title}** | {$pName} | " . strtoupper($m->status) . " | **{$m->progress}%** | {$cCount} / {$tCount} | {$dueStr} |\n";
            }
            $reply .= "\n";
        }

        $reply .= "**Rekomendasi Tindakan untuk Sprint:**\n";
        $reply .= "1. Tuntaskan checklist tugas pada sprint berstatus **IN PROGRESS** sebelum membuka fase sprint berikutnya.\n";
        $reply .= "2. Pastikan progres milestone tersinkronisasi otomatis dengan checklist tugas di lapangan.\n";
        $reply .= "3. Evaluasi sprint yang memiliki deviasi jadwal terhadap target penyelesaian proyek klien.";

        return [
            'success' => true,
            'type' => 'sprint_performance',
            'summary' => $summary,
            'findings' => [
                "Total Sprint: {$totalSprints} ({$completedSprints} selesai, {$inProgressSprints} berjalan).",
                "Rata-rata progres sprint portofolio: {$avgProgress}%."
            ],
            'recommendations' => [
                "Fokus pada penuntasan sprint in_progress.",
                "Review tanggal target due date sprint."
            ],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: General Consultation (Management / Productivity Advice).
     */
    protected function handleGeneralConsultation(string $prompt, string $userRole): array
    {
        $summary = "Konsultasi strategi manajemen proyek dan peningkatan produktivitas tim.";

        $reply = "### Rekomendasi Manajemen & Peningkatan Produktivitas\n\n";
        $reply .= "*(Catatan: Rekomendasi ini merupakan panduan *best-practice* manajemen operasional yang diselaraskan dengan kebutuhan tim PKM)*\n\n";
        $reply .= "**1. Penerapan Batas Pekerjaan Berjalan (Work In Progress / WIP Limit)**\n";
        $reply .= "Batasi jumlah tugas aktif yang dikerjakan satu anggota tim maksimal 2-3 tugas dalam satu waktu untuk mencegah *context switching* yang menurunkan efisiensi.\n\n";
        $reply .= "**2. Daily Standup Kilat (10-15 Menit)**\n";
        $reply .= "Fokuskan sesi singkat harian hanya pada 3 hal: apa yang diselesaikan kemarin, apa yang dikerjakan hari ini, dan apa kendala/blocker yang dihadapi.\n\n";
        $reply .= "**3. Tindak Lanjut Tugas Overdue Berdasarkan Prioritas**\n";
        $reply .= "Gunakan fitur pemantauan tugas PKM untuk mengidentifikasi tugas kritis sebelum jatuh tempo, bukan setelah batas waktu terlewati.\n\n";
        $reply .= "**4. Transparansi Milestone Bersama Klien**\n";
        $reply .= "Libatkan stakeholder klien dalam setiap penuntasan fase milestone untuk meminimalisir revisi mendadak di akhir masa proyek.";

        return [
            'success' => true,
            'type' => 'general_consultation',
            'summary' => $summary,
            'findings' => ["Konsultasi manajemen proyek berbasis metodologi agile."],
            'recommendations' => [
                "Terapkan WIP limit.",
                "Jalankan standup 15 menit.",
                "Review checklist overdue berkala."
            ],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: General Conversational Fallback.
     */
    protected function handleGeneralInquiry(string $prompt, string $userRole): array
    {
        $context = $this->getSystemContext();
        $summary = "Menjawab pertanyaan: \"{$prompt}\" berdasarkan konteks database PKM.";

        $reply = "### Jawaban Asisten AI PKM\n\n";
        $reply .= "Halo! Mengenai pertanyaan Anda: *\"{$prompt}\"*\n\n";
        $reply .= "Saat ini sistem PKM Control Center mengelola **{$context['total_projects']} proyek aktif** dengan **{$context['completed_tasks']}/{$context['total_tasks']} tugas selesai** ({$context['completion_rate']}%).\n\n";
        $reply .= "Anda dapat menanyakan hal-hal spesifik dengan bahasa bebas sehari-hari, seperti:\n";
        $reply .= "- *\"Jelaskan kondisi proyek Website Klien B\"*\n";
        $reply .= "- *\"Siapa anggota tim yang tugasnya paling banyak?\"*\n";
        $reply .= "- *\"Ada pekerjaan yang terlambat hari ini?\"*\n";
        $reply .= "- *\"Bagaimana kondisi perusahaan sekarang?\"*";

        return [
            'success' => true,
            'type' => 'general_inquiry',
            'summary' => $summary,
            'findings' => [
                "Portofolio aktif: {$context['total_projects']} proyek.",
                "Penyelesaian tugas: {$context['completion_rate']}%."
            ],
            'recommendations' => ["Tanyakan proyek atau personil spesifik."],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Gemini integration adapter (Google Gemini API - Free Tier).
     */
    protected function callGemini(string $apiKey, string $prompt, array $analysis, array $history, ?string $pageContext, string $userRole): array
    {
        $context = $this->getSystemContext();
        $model = env('AI_MODEL', 'gemini-3.8-flash');

        $systemPrompt = $this->buildLlmSystemPrompt($analysis, $context, $userRole);

        $sanitizedHistory = [];
        foreach (array_slice($history, -4) as $h) {
            if (!empty($h['user'])) $sanitizedHistory[] = 'User: ' . substr(trim((string)$h['user']), 0, 300);
            if (!empty($h['reply'])) $sanitizedHistory[] = 'AI: ' . substr(trim((string)$h['reply']), 0, 300);
        }
        $historyText = !empty($sanitizedHistory) ? implode("\n", $sanitizedHistory) : 'Tidak ada riwayat.';

        $contents = [
            [
                'role' => 'user',
                'parts' => [
                    ['text' => "{$systemPrompt}\n\nRiwayat Percakapan Terakhir:\n{$historyText}\n\nPertanyaan Pengguna: {$prompt}"]
                ]
            ]
        ];

        $response = Http::timeout(25)->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}", [
            'contents' => $contents,
            'generationConfig' => [
                'maxOutputTokens' => 2000,
            ]
        ]);

        if ($response->successful()) {
            $data = $response->json();
            $reply = $data['candidates'][0]['content']['parts'][0]['text'] ?? 'Tidak ada jawaban dari AI.';

            return [
                'success' => true,
                'type' => $analysis['intent'],
                'reply' => $reply,
                'summary' => 'Analisis komprehensif berhasil disusun oleh Google Gemini AI.',
                'findings' => [],
                'recommendations' => [],
                'mode' => 'External LLM (' . $model . ')',
                'timestamp' => Carbon::now()->format('H:i, d M Y'),
            ];
        }

        throw new \Exception('Gemini API status: ' . $response->status());
    }

    /**
     * OpenAI integration adapter.
     */
    protected function callOpenAI(string $apiKey, string $prompt, array $analysis, array $history, ?string $pageContext, string $userRole): array
    {
        $context = $this->getSystemContext();
        $model = env('AI_MODEL', 'gpt-4o-mini');

        $systemPrompt = $this->buildLlmSystemPrompt($analysis, $context, $userRole);

        $messages = [
            ['role' => 'system', 'content' => $systemPrompt]
        ];

        foreach (array_slice($history, -4) as $h) {
            if (!empty($h['user'])) $messages[] = ['role' => 'user', 'content' => $h['user']];
            if (!empty($h['reply'])) $messages[] = ['role' => 'assistant', 'content' => $h['reply']];
        }

        $messages[] = ['role' => 'user', 'content' => $prompt];

        $response = Http::withToken($apiKey)->timeout(25)->post('https://api.openai.com/v1/chat/completions', [
            'model' => $model,
            'messages' => $messages,
            'temperature' => 0.3,
            'max_tokens' => 2000,
        ]);

        if ($response->successful()) {
            $data = $response->json();
            $reply = $data['choices'][0]['message']['content'] ?? 'Tidak ada jawaban dari AI.';

            return [
                'success' => true,
                'type' => $analysis['intent'],
                'reply' => $reply,
                'summary' => 'Analisis komprehensif berhasil disusun oleh OpenAI.',
                'findings' => [],
                'recommendations' => [],
                'mode' => 'External LLM (' . $model . ')',
                'timestamp' => Carbon::now()->format('H:i, d M Y'),
            ];
        }

        throw new \Exception('OpenAI API status: ' . $response->status());
    }

    /**
     * Build targeted LLM system prompt.
     */
    protected function buildLlmSystemPrompt(array $analysis, array $context, string $userRole): string
    {
        $targetedProjectJson = '';
        if ($analysis['intent'] === 'single_project_analysis' && !empty($analysis['project_match']['project'])) {
            $p = $analysis['project_match']['project'];
            $p->load(['tasks', 'milestones']);
            $targetedProjectJson = json_encode($p, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }

        return <<<PROMPT
Anda adalah AI Business Analyst untuk sistem PKM Control Center — PT Potensi Karya Mandiri.
Role pengguna: {$userRole}.
Intent terdeteksi: {$analysis['intent']}.

Target Proyek Spesifik:
{$targetedProjectJson}

ATURAN KETAT:
1. Jika pengguna bertanya tentang proyek tertentu (misalnya "Website Klien B"), JAWAB HANYA TENTANG PROYEK TERSEBUT. DILARANG merangkum atau menyebut proyek lain yang tidak ditanyakan!
2. Pisahkan fakta dari estimasi. Jangan mengarang alasan keterlambatan jika tidak tercatat di data.
3. Format output dengan rapi menggunakan Markdown: heading, bold, bullet point, dan nomor.
4. Gunakan Bahasa Indonesia profesional dan lugas.
PROMPT;
    }
}
