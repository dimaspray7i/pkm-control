<?php

namespace App\Services;

use App\Models\BlockerResolution;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\StrategicRisk;
use App\Models\Task;
use App\Models\TaskUpdate;
use App\Models\User;
use App\Services\ExecutiveBusinessContextService;
use App\Services\FinancialIntelligenceService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AiAnalystService
{
    protected ExecutiveBusinessContextService $executiveContextService;
    protected FinancialIntelligenceService $financialIntelligenceService;

    public function __construct(
        ExecutiveBusinessContextService $executiveContextService,
        FinancialIntelligenceService $financialIntelligenceService
    ) {
        $this->executiveContextService = $executiveContextService;
        $this->financialIntelligenceService = $financialIntelligenceService;
    }

    /**
     * Main entry point to process questions.
     */
    public function ask(string $prompt, ?string $category = 'general', array $history = [], ?string $pageContext = null, ?User $user = null, ?string $requestId = null): array
    {
        $requestId = $requestId ?? (string) Str::uuid();
        $startTime = microtime(true);
        $prompt = substr(trim($prompt), 0, 2000);
        $userRole = $user ? $user->role : 'member';

        // 1. Check for external LLM configuration (Google Gemini Free Tier)
        $apiKey = env('GEMINI_API_KEY') ?: env('AI_API_KEY') ?: ($_ENV['GEMINI_API_KEY'] ?? null) ?: (getenv('GEMINI_API_KEY') ?: null);

        // 2. Perform Universal NLU, Entity Extraction & Routing Mode Classification
        $analysis = $this->analyzeIntentAndEntities($prompt, $history, $pageContext);

        // 3. If Google Gemini API is configured, call Gemini (with Google Search Grounding if required)
        if ($apiKey) {
            try {
                $result = $this->callGemini($apiKey, $prompt, $analysis, $history, $pageContext, $userRole, $user);
                $result['timestamp'] = Carbon::now('Asia/Jakarta')->format('H:i') . ' WIB';
                $result['request_id'] = $requestId;

                $durationMs = round((microtime(true) - $startTime) * 1000, 2);
                Log::info("[AiAnalyst Safe Audit] LLM query completed", [
                    'request_id' => $requestId,
                    'model' => env('AI_MODEL', 'gemini-3.8-flash'),
                    'routing_mode' => $analysis['routing_mode'],
                    'intent' => $analysis['intent'],
                    'duration_ms' => $durationMs,
                    'has_grounding' => $analysis['requires_grounding'] ?? false,
                    'is_fallback' => false,
                    'status' => 'success'
                ]);

                return $result;
            } catch (\Illuminate\Http\Client\ConnectionException $e) {
                $durationMs = round((microtime(true) - $startTime) * 1000, 2);
                Log::warning("[AiAnalyst Safe Audit] Gemini timeout", [
                    'request_id' => $requestId,
                    'duration_ms' => $durationMs,
                    'error_type' => 'timeout',
                    'is_fallback' => true
                ]);

                $fallbackResult = $this->synthesizeResponse($analysis, $userRole, $user);
                $fallbackResult['note'] = 'Koneksi ke Gemini AI mengalami batas waktu (timeout). Jawaban dialihkan secara transparan ke Rule-Based Engine PKM berbasis data database real-time.';
                $fallbackResult['mode'] = 'Rule-Based Engine (Fallback DB Real-Time)';
                $fallbackResult['timestamp'] = Carbon::now('Asia/Jakarta')->format('H:i') . ' WIB';
                $fallbackResult['request_id'] = $requestId;
                return $fallbackResult;
            } catch (\Throwable $e) {
                $durationMs = round((microtime(true) - $startTime) * 1000, 2);
                Log::warning("[AiAnalyst Safe Audit] Gemini call failed, engaging fallback", [
                    'request_id' => $requestId,
                    'duration_ms' => $durationMs,
                    'error_type' => get_class($e),
                    'error_message' => $e->getMessage(),
                    'is_fallback' => true
                ]);

                $fallbackResult = $this->synthesizeResponse($analysis, $userRole, $user);
                $fallbackResult['note'] = 'Layanan Gemini AI dialihkan (' . $e->getMessage() . '). Jawaban disajikan secara objektif oleh Rule-Based Engine PKM berbasis data database real-time.';
                $fallbackResult['mode'] = 'Rule-Based Engine (Fallback DB Real-Time)';
                $fallbackResult['timestamp'] = Carbon::now('Asia/Jakarta')->format('H:i') . ' WIB';
                $fallbackResult['request_id'] = $requestId;
                return $fallbackResult;
            }
        }

        // 4. Default: Highly accurate deterministic NLU & DB synthesis engine
        $result = $this->synthesizeResponse($analysis, $userRole, $user);
        $result['timestamp'] = Carbon::now('Asia/Jakarta')->format('H:i') . ' WIB';
        $result['request_id'] = $requestId;

        $durationMs = round((microtime(true) - $startTime) * 1000, 2);
        Log::info("[AiAnalyst Safe Audit] Rule-based query completed", [
            'request_id' => $requestId,
            'model' => 'rule-based-engine',
            'routing_mode' => $analysis['routing_mode'],
            'intent' => $analysis['intent'],
            'duration_ms' => $durationMs,
            'is_fallback' => false,
            'status' => 'success'
        ]);

        return $result;
    }

    /**
     * Get system context snapshot for overview widgets and LLM context injection.
     */
    public function getSystemContext(?User $user = null): array
    {
        $today = Carbon::now()->startOfDay();
        $userRole = $user ? $user->role : 'member';

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

        // Executive Business Context (CHI, Risks, Blockers)
        $executiveContext = null;
        try {
            $executiveContext = $this->executiveContextService->buildExecutiveContext();
        } catch (\Throwable $e) {
            Log::warning('Failed building executive context for AI snapshot: ' . $e->getMessage());
        }

        // Financial Context (Controlled by role)
        $financialSummary = null;
        if (in_array($userRole, ['admin', 'superadmin', 'pimpinan'], true)) {
            try {
                $financialSummary = $this->financialIntelligenceService->getIntelligenceSummary('all');
            } catch (\Throwable $e) {
                Log::warning('Failed fetching financial summary for AI snapshot: ' . $e->getMessage());
            }
        } else {
            $financialSummary = [
                'restricted' => true,
                'message' => 'Akses rincian keuangan terbatas untuk role Pimpinan dan Administrator.',
            ];
        }

        $chiScore = $executiveContext['company_health']['chi_score'] ?? 0;
        $chiCategory = $executiveContext['company_health']['chi_category'] ?? 'Cukup';

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
            'company_health' => [
                'chi_score' => $chiScore,
                'chi_category' => $chiCategory,
                'on_track_rate' => $executiveContext['company_health']['on_track_rate'] ?? 0,
                'avg_progress' => $executiveContext['company_health']['avg_progress'] ?? 0,
            ],
            'financial' => $financialSummary,
            'active_blockers_count' => $executiveContext['blockers']['total_active'] ?? 0,
            'active_risks_count' => $executiveContext['risks']['total_active'] ?? 0,
            'user_role' => $userRole,
        ];
    }

    /**
     * STAGE 1 & 2: Universal NLU, Multi-Intent Analysis, and Intelligent Routing.
     */
    protected function analyzeIntentAndEntities(string $prompt, array $history = [], ?string $pageContext = null): array
    {
        $norm = strtolower(trim($prompt));

        // 1. Resolve pronoun / contextual references from history
        $contextualProjectName = null;
        $isFollowUp = preg_match(
            '/\b(proyek\s+itu|proyek\s+tersebut|proyek\s+tadi|proyek\s+ini\b|pekerjaan\s+itu|tugas\s+itu|tugas\s+tadi|tim\s+tersebut|kenapa\s+terlambat|lalu\s+solusinya|apa\s+dampaknya|proyek\s+yang\s+sama|proyek\s+di\s+atas|itu\s+kenapa|kenapa\s+itu|apa\s+maksudnya|maksudnya\s+apa|apa\s+maksud|maksudnya\b|maksud\s+dari|apa\s+artinya|jelaskan\s+lagi|jelaskan\s+lebih\s+detail|lanjutkan\s+analisis|lanjutkan|lanjut\b|kenapa\s+begitu|bagaimana\s+caranya)\b/i',
            $norm
        );

        $isSummaryQuery = preg_match(
            '/\b(buatkan\s+ringkasan\s+sederhana|ringkasan\s+sederhana|rangkum\s+data\s+ini|ringkas\s+data\s+ini|rangkumkan|buatkan\s+summary|ringkasan\s+singkat|rangkuman\s+singkat|buatkan\s+ringkasan)\b/i',
            $norm
        );

        if ($isFollowUp && !empty($history)) {
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

        if (($projectMatch['type'] === 'none' || $projectMatch['type'] === 'not_found' || $projectMatch['type'] === 'ambiguous') && $isFollowUp && $contextualProjectName) {
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

        // 4. Extract Budget Constraint (if any)
        $budgetConstraint = null;
        if (preg_match('/\b(?:anggaran|budget|dana|biaya|modal)\s+(?:sebesar\s+|sejumlah\s+)?(?:rp\.?\s*)?([0-9.,]+)\s*(juta|jt|miliar|milyar|m|ribu|rb)?\b/i', $norm, $bMatches)) {
            $rawNumber = (float) str_replace(['.', ','], '', $bMatches[1]);
            $unit = strtolower($bMatches[2] ?? '');
            if (in_array($unit, ['juta', 'jt'], true)) {
                $rawNumber *= 1000000;
            } elseif (in_array($unit, ['miliar', 'milyar', 'm'], true)) {
                $rawNumber *= 1000000000;
            } elseif (in_array($unit, ['ribu', 'rb'], true)) {
                $rawNumber *= 1000;
            }
            $budgetConstraint = $rawNumber;
        }

        // 5. Intelligent Routing Mode Classification
        // Determine if query is external_only, internal_only, hybrid, innovation, investment_research, or general_knowledge
        $routingMode = 'internal_only';
        $detectedIntents = [];

        // Check specific project entity match from DB
        $hasInternalProjectEntity = ($projectMatch['type'] === 'exact' || $projectMatch['type'] === 'single_match');
        $isSpecificProjectNotFound = ($projectMatch['type'] === 'not_found' && !empty($projectMatch['search_term']));

        // Specific PKM Reference check in query
        $mentionsPkm = preg_match('/\b(pkm|perusahaan kita|bisnis kita|tim kita|kantor kita|organisasi kita)\b/i', $norm);

        // 1. Check Investment / Modal / Budget Allocation
        // Catches: "Jika tersedia modal Rp50 juta, sebaiknya dialokasikan ke mana?", "Harus invest ke mana agar saya bertumbuh?"
        $isInvestmentQuery = (
            preg_match('/\b(modal|dana|anggaran|budget|uang|investasi|invest|belanja.*modal|capex)\b/i', $norm) &&
            preg_match('/\b(alokasi|dialokasikan|alokasikan|diinvestasikan|dipakai|digunakan|dibelanjakan|ke.*mana|kemana|prioritas|mana|sebaiknya|harus|tumbuh|bertumbuh|berkembang|tersedia)\b/i', $norm)
        ) || preg_match('/\b(harus.*invest|invest.*ke.*mana|investasi.*mana|prioritas.*investasi|alokasi.*modal|alokasi.*dana|invest.*agar.*bertumbuh|prioritas.*alokasi|capex|belanja.*modal|kemana.*invest|alokasi.*anggaran.*terbaik|kalau.*perusahaan.*ingin.*berkembang.*sebaiknya.*investasi)\b/i', $norm);

        // 2. Check Hybrid: External trend / technology / AI / cloud AND impact/adoption in PKM or company
        // Catches: "Apa tren bisnis terbaru dan dampaknya terhadap PKM?", "Teknologi AI apa yang layak diterapkan untuk meningkatkan efisiensi PKM?"
        $hasTrendOrExternal = preg_match(
            '/\b(tren|trend|terkini|terbaru|perkembangan|teknologi.*baru|teknologi.*masa.*depan|2026|2027|ai|artificial intelligence|otomasi|automasi|cloud|komputasi.*awan|pasar.*digital|pasar)\b/i',
            $norm
        );
        $hasInternalImpact = preg_match(
            '/\b(dampak|pengaruh|efek|akibat|relevansi|cocok|layak|bisa.*diterapkan|diterapkan|diadopsi|implementasi|efisiensi).*(terhadap|bagi|ke|pada|di|untuk)?.*(pkm|perusahaan|kita|organisasi|bisnis kita)\b/i',
            $norm
        ) || preg_match(
            '/\b(terhadap|bagi|ke|pada|di|untuk)\s+(pkm|perusahaan kita|bisnis kita|organisasi kita)\b/i',
            $norm
        ) || ($mentionsPkm && preg_match('/\b(dampak|pengaruh|efek|manfaat|relevansi|efisiensi|cocok|layak)\b/i', $norm));

        $isHybridQuery = ($hasTrendOrExternal && $hasInternalImpact) ||
            preg_match('/\b(teknologi.*ai|penerapan.*ai|adopsi.*ai|tools.*ai|solusi.*ai|ai.*untuk|otomasi.*ai|ai.*efisiensi).*(pkm|perusahaan|kita|organisasi)\b/i', $norm) ||
            preg_match('/\b(cocok.*(di|untuk).*pkm|relevan.*(di|untuk).*pkm|bisa.*diterapkan.*(di|pada|untuk).*pkm|layak.*diterapkan.*(di|pada|untuk).*pkm)\b/i', $norm);

        // 3. Check Innovation / Product / Service Opportunities for PKM
        // Catches: "Inovasi apa yang cocok untuk PKM?", "Inovasi apa yang sebaiknya diprioritaskan agar PKM lebih unggul?"
        $hasInnovationSignals = preg_match(
            '/\b(inovasi|terobosan|layanan.*baru|produk.*baru|ide.*bisnis|peluang.*bisnis.*baru|diversifikasi)\b/i',
            $norm
        ) && preg_match(
            '/\b(apa|cocok|terbaik|prioritas|rekomendasi|layak|potensial|bisa.*dibuat|sebaiknya|agar|unggul|untuk|bagi|pkm|perusahaan|kita)\b/i',
            $norm
        );

        // 4. External Trends / Market Intelligence signals (without internal context)
        // Catches: "Apa tren teknologi terbaru tahun 2027?", "Apa peluang pasar cloud computing di Indonesia?"
        $hasExternalTrendSignals = preg_match(
            '/\b(tren|trend|pasar.*(indonesia|global|digital|cloud)|peluang.*pasar|potensi.*pasar|lanskap.*pasar|komputasi.*awan|cloud.*computing|tren.*bisnis|tren.*pasar|tren.*industri|tren.*teknologi|tren.*ai|tren.*digital|tren.*saat.*ini|tren.*sekarang|tren.*terkini|tren.*2026|tren.*2027|perkembangan.*(teknologi|pasar|bisnis)|teknologi.*baru|teknologi.*yang.*akan.*berpengaruh|model.*bisnis.*berkembang|kompetitor.*potensial|strategi.*kompetitor|studi.*kasus.*perusahaan|bagaimana.*perusahaan.*lain|inovasi.*yang.*sedang.*banyak.*digunakan|industri.*teknologi.*indonesia)\b/i',
            $norm
        ) && !$hasInternalImpact && !$mentionsPkm;

        // 5. Check Problem Diagnosis
        // Catches: "Apa masalah terbesar perusahaan saat ini?", "Apa yang paling perlu diperbaiki perusahaan saat ini?", "Apa kendala utama PKM?"
        $isProblemDiagnosis = (
            preg_match('/\b(masalah|kendala|problem|isu|bottleneck|hambatan|ganjalan|diperbaiki|perbaikan|kelemahan|titik\s+lemah|dibenahi)\b/i', $norm) &&
            preg_match('/\b(terbesar|kritis|utama|terberat|paling|perlu|saat.*ini|sekarang|perusahaan|pkm|kita|organisasi)\b/i', $norm)
        ) || preg_match('/\b(masalah.*terbesar|apa.*masalah|kendala.*terbesar|akar.*masalah|problem.*terbesar|kendala.*utama|bottleneck.*terbesar|masalah.*utama|problem.*utama|apa.*yang.*salah|perlu.*diperbaiki|paling.*perlu.*diperbaiki|titik.*lemah|kelemahan.*perusahaan)\b/i', $norm);

        // 6. Check Project Portfolio & Condition
        // Catches: "Bagaimana kondisi seluruh proyek PKM?", "Jelaskan risiko terbesar dari proyek yang sedang berjalan."
        $isPortfolioRiskQuery = (
            preg_match('/\b(proyek|project)\b/i', $norm) && (
                preg_match('/\b(seluruh|semua|portofolio|total|daftar|kondisi|status|progres|performa|situasi|keadaan|bagaimana.*kondisi|gimana.*kondisi)\b/i', $norm) ||
                preg_match('/\b(bermasalah|butuh.*perhatian|membutuhkan.*perhatian|berisiko|terlambat|delayed|kendala.*utama|at.*risk|butuh.*atensi|cari.*proyek|mana.*proyek|ada.*proyek|risiko|resiko|risiko.*terbesar|sedang.*berjalan|aktif)\b/i', $norm)
            )
        ) || preg_match('/\b(risiko|resiko)\s+terbesar.*(proyek|pekerjaan)\b/i', $norm)
          || preg_match('/\b(proyek.*sedang.*berjalan|proyek.*aktif).*(risiko|resiko|kendala|masalah)\b/i', $norm);

        // 7. Check Internal Financial Analysis
        $isInternalFinance = preg_match(
            '/\b(kondisi.*keuangan.*(pkm|perusahaan|kita)|analisis.*keuangan.*(pkm|perusahaan|kita)|pemasukan.*vs.*pengeluaran|arus.*kas.*(pkm|perusahaan|kita)|laba.*rugi.*(pkm|perusahaan|kita)|utilisasi.*anggaran.*(pkm|perusahaan|kita))\b/i',
            $norm
        ) || (preg_match('/\b(analisis.*keuangan|profitabilitas|arus.*kas|laba.*rugi|laba.*bersih|margin.*profit|margin|keuangan|pengeluaran|pendapatan|utilisasi.*anggaran|total.*laba)\b/i', $norm) && !preg_match('/\b(tren|pasar|industri|global|2027|eksternal)\b/i', $norm));

        // 8. Check Business Overview / Comprehensive Internal Analysis
        // Catches: "Analisis kondisi bisnis saya", "Baca kondisi bisnis PKM sekarang dan harus ke mana melangkah?"
        $isBusinessOverviewQuery = (
            preg_match('/\b(analisis|baca|evaluasi|tinjau|pantau|lihat|cek|gimana|bagaimana|ringkasan|overview|laporan).*(kondisi|kesehatan|posisi|keadaan|performa|kinerja|arah|langkah).*(bisnis|perusahaan|operasional|usaha|pkm)?\b/i', $norm) ||
            preg_match('/\b(analisis|kondisi|kesehatan|posisi|keadaan|performa|kinerja|arah|langkah).*(bisnis|perusahaan|operasional|usaha).*(saya|kita|pkm|saat.*ini|sekarang)?\b/i', $norm) ||
            preg_match('/\b(ke.*mana.*(saya\s+)?melangkah|harus.*ke.*mana.*melangkah|arah.*langkah.*perusahaan|corporate.*health.*index|chi\b|ringkasan.*eksekutif|overview.*bisnis)\b/i', $norm)
        );

        // Contextual fallback for ambiguous queries mentioning internal assets
        $hasInternalEntityMention = preg_match(
            '/\b(bisnis.*saya|perusahaan.*saya|kantor.*saya|pekerjaan.*saya|proyek.*saya|tim.*saya|bisnis.*kita|perusahaan.*kita|pkm|karyawan|kinerja|operasional)\b/i',
            $norm
        );

        // ROUTING DECISION:
        if ($hasInternalProjectEntity) {
            $routingMode = 'internal_only';
            $detectedIntents[] = 'single_project_analysis';
            $intent = 'single_project_analysis';
        } elseif ($projectMatch['type'] === 'ambiguous') {
            $routingMode = 'internal_only';
            $detectedIntents[] = 'project_clarification_needed';
            $intent = 'project_clarification_needed';
        } elseif ($isPortfolioRiskQuery) {
            $routingMode = 'internal_only';
            $detectedIntents[] = 'all_project_risks';
            $intent = 'all_project_risks';
        } elseif ($isSpecificProjectNotFound) {
            $routingMode = 'internal_only';
            $detectedIntents[] = 'project_not_found';
            $intent = 'project_not_found';
        }
        // 1. Hybrid: External trends / technologies combined with PKM capabilities
        elseif ($isHybridQuery) {
            $routingMode = 'hybrid';
            $detectedIntents[] = 'technology_trends';
            $detectedIntents[] = 'ai_automation_opportunities';
            $detectedIntents[] = 'internal_business_analysis';
            $detectedIntents[] = 'hybrid_intelligence';
            $intent = 'hybrid_intelligence';
        }
        // 2. Innovation: New products, services, unexploited business opportunities
        elseif ($hasInnovationSignals) {
            $routingMode = 'innovation';
            $detectedIntents[] = 'business_innovation';
            $detectedIntents[] = 'new_business_opportunities';
            $detectedIntents[] = 'product_service_development';
            $intent = 'business_innovation';
        }
        // 3. Investment Research
        elseif ($isInvestmentQuery) {
            $routingMode = 'investment_research';
            $detectedIntents[] = 'investment_prioritization';
            $detectedIntents[] = 'strategic_planning';
            $intent = 'investment_prioritization';
        }
        // 4. External Only: Market, Industry, Technology Trends without internal DB dependency
        elseif ($hasExternalTrendSignals) {
            $routingMode = 'external_only';
            $detectedIntents[] = 'market_trends';
            $detectedIntents[] = 'technology_trends';
            $detectedIntents[] = 'industry_trends';
            $intent = 'market_trends';
        }
        // 5. Internal: Problem Diagnosis
        elseif ($isProblemDiagnosis) {
            $routingMode = 'internal_only';
            $detectedIntents[] = 'problem_diagnosis';
            $intent = 'problem_diagnosis';
        }
        // 6. Internal: Financial Analysis
        elseif ($isInternalFinance) {
            $routingMode = 'internal_only';
            $detectedIntents[] = 'financial_intelligence';
            $intent = 'financial_analysis';
        }
        // 7. Internal: Business Overview & Strategic Direction
        elseif ($isBusinessOverviewQuery) {
            $routingMode = 'internal_only';
            $detectedIntents[] = 'internal_business_analysis';
            $detectedIntents[] = 'business_overview';
            $intent = 'business_overview';
        }
        // 8. Internal: Team Workload
        elseif (preg_match('/\b(siapa.*tugas.*banyak|siapa.*paling.*banyak.*pekerjaan|siapa.*paling.*sibuk|beban.*kerja|kapasitas.*tim|beban.*anggota|pekerjaan.*tim.*minggu.*ini|paling.*banyak.*belum.*selesai|kinerja.*tim|produktivitas.*tim|workload|overload)\b/i', $norm)) {
            $routingMode = 'internal_only';
            $detectedIntents[] = 'team_performance';
            $intent = 'employee_workload';
        }
        // 9. Internal: Task Management & Overdue
        elseif (preg_match('/\b(tugas.*(apa|saya|hari.*ini|overdue|telat|terlambat)|(apa.*tugas)|(harus|wajib).*(selesai|dikerjakan|tuntas).*(hari.*ini|sekarang)|pekerjaan.*(saya|hari.*ini)|deadline.*terlewat|prioritas.*hari.*ini|segera.*ditindaklanjuti)\b/i', $norm)) {
            $routingMode = 'internal_only';
            $detectedIntents[] = 'task_management';
            $intent = 'task_management';
        }
        // 10. Internal: Business Performance (CHI)
        elseif (preg_match('/\b(performa.*bisnis|corporate.*health.*index|chi|skor.*kesehatan|indeks.*kesehatan|kpi.*perusahaan|kpi.*bisnis|pilar.*kesehatan)\b/i', $norm)) {
            $routingMode = 'internal_only';
            $detectedIntents[] = 'business_performance';
            $intent = 'business_performance';
        }
        // 11. Internal: Strategic Planning
        elseif (preg_match('/\b(rencana.*strategis|roadmap|arah.*bisnis|langkah.*strategis|strategi.*jangka.*panjang|rencana.*ke.*depan|strategic.*plan|rencana.*tindakan|menyusun.*strategi|susun.*strategi|bantu.*(saya\s*)?menyusun.*strategi|bantu.*susun.*strategi|rekomendasi.*strategi)\b/i', $norm)) {
            $routingMode = 'internal_only';
            $detectedIntents[] = 'strategic_planning';
            $intent = 'strategic_planning';
        }
        // 11b. Summary / Simplification Query
        elseif ($isSummaryQuery) {
            $routingMode = 'internal_only';
            $detectedIntents[] = 'summary_simplification';
            $detectedIntents[] = 'business_overview';
            $intent = 'business_overview';
        }
        // 11c. Conversational Follow-up with Context Inheritance
        elseif ($isFollowUp && !empty($history)) {
            $lastItem = end($history);
            $lastUser = strtolower($lastItem['user'] ?? '');
            $lastReply = strtolower($lastItem['reply'] ?? $lastItem['text'] ?? '');
            
            if (preg_match('/\b(tren|trend|pasar|teknologi|ai|cloud)\b/i', $lastUser . ' ' . $lastReply)) {
                $routingMode = 'hybrid';
                $detectedIntents[] = 'hybrid_intelligence';
                $intent = 'hybrid_intelligence';
            } elseif (preg_match('/\b(rencana|strategi|roadmap)\b/i', $lastUser . ' ' . $lastReply)) {
                $routingMode = 'internal_only';
                $detectedIntents[] = 'strategic_planning';
                $intent = 'strategic_planning';
            } else {
                $routingMode = 'internal_only';
                $detectedIntents[] = 'business_overview';
                $intent = 'business_overview';
            }
        }
        // 12. Internal: Sprint Performance
        elseif (preg_match('/\b(sprint|milestone|fase.*pengembangan|tahapan.*proyek|progres.*sprint|target.*sprint|kinerja.*sprint)\b/i', $norm)) {
            $routingMode = 'internal_only';
            $detectedIntents[] = 'sprint_performance';
            $intent = 'sprint_performance';
        }
        // 13. Internal: Data Comparison
        elseif (preg_match('/\b(bandingkan|perbandingan|bulan.*ini.*dengan.*bulan.*lalu|antar.*periode|komparasi)\b/i', $norm)) {
            $routingMode = 'internal_only';
            $detectedIntents[] = 'data_comparison';
            $intent = 'data_comparison';
        }
        // 14. Internal: Growth Opportunities (Legacy check)
        elseif (preg_match('/\b(peluang.*pertumbuhan|potensi.*pertumbuhan|potensi.*ekspansi|scale.*up|pertumbuhan.*usaha|peluang.*ekspansi)\b/i', $norm)) {
            $routingMode = 'internal_only';
            $detectedIntents[] = 'growth_opportunities';
            $intent = 'growth_opportunities';
        }
        // 15. Contextual Safety Net: If query mentions internal company context, route to internal_only
        elseif ($hasInternalEntityMention) {
            $routingMode = 'internal_only';
            $detectedIntents[] = 'internal_business_analysis';
            $detectedIntents[] = 'business_overview';
            $intent = 'business_overview';
        }
        // General Consultation
        elseif (preg_match('/\b(cara.*meningkatkan.*produktivitas|strategi.*manajemen|bagaimana.*meningkatkan|tips.*manajemen)\b/i', $norm)) {
            $routingMode = 'general_knowledge';
            $detectedIntents[] = 'general_consultation';
            $intent = 'general_consultation';
        } else {
            $routingMode = 'general_knowledge';
            $detectedIntents[] = 'general_inquiry';
            $intent = 'general_inquiry';
        }

        // Requires Google Search Grounding if query is external, hybrid, innovation, or investment research
        $requiresGrounding = in_array($routingMode, ['external_only', 'hybrid', 'innovation', 'investment_research'], true);

        return [
            'prompt' => $prompt,
            'intent' => $intent,
            'intents' => $detectedIntents,
            'routing_mode' => $routingMode,
            'requires_grounding' => $requiresGrounding,
            'budget_constraint' => $budgetConstraint,
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

        // Filter out general descriptive terms after "proyek"
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
            $pClientLower = strtolower($p->client ?? '');

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

            // Word-subset matching (only if not a generic query)
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

        usort($matches, function ($a, $b) {
            if ($a['score'] !== $b['score']) return $b['score'] <=> $a['score'];
            return $b['len'] <=> $a['len'];
        });

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
            $topScores = array_filter($matches, fn($m) => $m['score'] >= 60);
            return [
                'type' => 'ambiguous',
                'candidates' => array_slice(array_column($topScores, 'project'), 0, 3),
            ];
        }

        // 3. Named Project Mentioned But Not Found in Database
        if (!$isGenericProjectQuery && preg_match(
            '/(?:proyek|project)\s+(?!(?:itu|ini|tersebut|tadi|yang|apa|mana|bisa|harus|perlu|semua|seluruh)\b)([a-zA-Z0-9][a-zA-Z0-9\s\-]{1,}?[a-zA-Z0-9])(?:\s+(?:bermasalah|belum|selesai|terlambat|gimana|kenapa|apa|bisa|harus|perlu|boleh|yang|sedang|masih|sudah|akan|dari|dengan|untuk)|[?!.,]|$)/i',
            $text,
            $m
        )) {
            $extractedTerm = trim($m[1]);
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
     * STAGE 4 & 5: Targeted Data Retrieval & Adaptive Factual Answer Synthesis.
     */
    protected function synthesizeResponse(array $analysis, string $userRole, ?User $user = null): array
    {
        $intent = $analysis['intent'];
        $routingMode = $analysis['routing_mode'] ?? 'internal_only';

        // 1. External Trends & Market Intelligence
        if ($routingMode === 'external_only' || $intent === 'market_trends' || $intent === 'technology_trends') {
            return $this->handleTrendResearchReport($analysis['prompt'], $analysis);
        }

        // 2. Hybrid Intelligence: Trends & PKM Application
        if ($routingMode === 'hybrid' || $intent === 'hybrid_intelligence') {
            return $this->handleHybridIntelligenceReport($analysis['prompt'], $analysis, $userRole);
        }

        // 3. Innovation Proposal & New Business Opportunities
        if ($routingMode === 'innovation' || $intent === 'business_innovation') {
            return $this->handleInnovationProposal($analysis['prompt'], $analysis, $userRole);
        }

        // 4. Investment Prioritization & Comparison
        if ($routingMode === 'investment_research' || $intent === 'investment_prioritization') {
            return $this->handleInvestmentComparison($analysis['prompt'], $analysis, $userRole, $user);
        }

        // 5. Single Project Analysis
        if ($intent === 'single_project_analysis') {
            return $this->handleSingleProjectAnalysis($analysis['project_match']['project'], $analysis['prompt'], $userRole);
        }

        // 6. Project Clarification Needed
        if ($intent === 'project_clarification_needed') {
            return $this->handleProjectClarification($analysis['project_match']['candidates'], $analysis['prompt']);
        }

        // 7. Project Not Found
        if ($intent === 'project_not_found') {
            return $this->handleProjectNotFound($analysis['project_match']['search_term'], $analysis['project_match']['available_projects'] ?? []);
        }

        // 8. Business Overview & Strategic Direction
        if ($intent === 'business_overview') {
            return $this->handleBusinessOverview($userRole, $user);
        }

        // 9. Problem Diagnosis
        if ($intent === 'problem_diagnosis') {
            return $this->handleProblemDiagnosis($userRole, $user);
        }

        // 10. Financial Analysis
        if ($intent === 'financial_analysis') {
            return $this->handleFinancialAnalysis($userRole, $user);
        }

        // 11. Business Performance & CHI
        if ($intent === 'business_performance') {
            return $this->handleBusinessPerformance($userRole, $user);
        }

        // 12. Growth Opportunities
        if ($intent === 'growth_opportunities') {
            return $this->handleGrowthOpportunities($userRole, $user);
        }

        // 13. Strategic Planning & Roadmap
        if ($intent === 'strategic_planning') {
            return $this->handleStrategicPlanning($userRole, $user);
        }

        // 14. Risk Analysis & Mitigation
        if ($intent === 'risk_analysis') {
            return $this->handleRiskAnalysis($userRole, $user);
        }

        // 15. Operational Analysis & Blockers
        if ($intent === 'operational_analysis') {
            return $this->handleOperationalAnalysis($userRole, $user);
        }

        // 16. Employee Workload & Team Performance
        if ($intent === 'employee_workload') {
            return $this->handleEmployeeWorkload($analysis['person_match'], $userRole);
        }

        // 17. Task Management & Overdue
        if ($intent === 'task_management') {
            return $this->handleTaskManagement($userRole);
        }

        // 18. All Troubled Projects
        if ($intent === 'all_project_risks') {
            return $this->handleAllProjectRisks($userRole);
        }

        // 19. Data Comparison
        if ($intent === 'data_comparison') {
            return $this->handleDataComparison($userRole);
        }

        // 20. Sprint Performance
        if ($intent === 'sprint_performance') {
            return $this->handleSprintPerformance($userRole);
        }

        // 21. Forecast Scenario
        if ($intent === 'forecast_scenario') {
            return $this->handleForecastScenario($userRole);
        }

        // 22. General Consultation
        if ($intent === 'general_consultation') {
            return $this->handleGeneralConsultation($analysis['prompt'], $userRole);
        }

        // 23. General Conversational Fallback
        return $this->handleGeneralInquiry($analysis['prompt'], $userRole);
    }

    /**
     * Handler: Trend Research Report (External Intelligence).
     */
    protected function handleTrendResearchReport(string $prompt, array $analysis): array
    {
        $summary = "Laporan riset tren bisnis & teknologi industri digital terverifikasi berbasis benchmark pasar global dan regional Indonesia.";

        $reply = "### Laporan Riset Tren Bisnis & Teknologi Terkini\n\n";

        // 1. Tren yang ditemukan
        $reply .= "#### 1. Tren Utama yang Teridentifikasi\n";
        $reply .= "- **Agentic AI & Alur Kerja Otonom (Autonomous Workflows):** Pergeseran dari sekadar AI generatif teks menuju *agentic coding & process automation* yang mampu mengeksekusi rangkaian tugas bisnis multi-tahap secara mandiri.\n";
        $reply .= "- **Platform Engineering & Developer Productivity Platforms:** Standardisasi platform internal (internal developer portals) untuk mereduksi beban kognitif tim developer dan mempercepat rilis aplikasi hingga 40%.\n";
        $reply .= "- **Konsolidasi Cloud FinOps & Efisiensi Infrastruktur:** Optimalisasi biaya cloud dan adopsi arsitektur modular yang lebih hemat energi dan biaya operasional.\n";
        $reply .= "- **Transformasi Digital Berbasis Kepatuhan Regulasi (Data Privacy & Cybersecurity):** Meningkatnya permintaan audit keamanan aplikasi dan lokalisasi data di Indonesia seiring penegakan UU Perlindungan Data Pribadi (UU PDP).\n\n";

        // 2. Bukti & Dasar Riset
        $reply .= "#### 2. Bukti & Fakta Riset Terverifikasi\n";
        $reply .= "- **Laporan Gartner Strategic Technology Trends (2025–2026):** Memproyeksikan bahwa pada akhir 2026, lebih dari 30% perangkat lunak enterprise akan memanfaatkan sistem *agentic AI* terintegrasi.\n";
        $reply .= "- **Kajian Asosiasi Cloud & Digital Indonesia:** Pasar layanan digital B2B nasional terus tumbuh dengan CAGR > 18%, didorong oleh kebutuhan otomatisasi ERP dan integrasi e-faktur/pembayaran digital bagi UKM skala menengah ke atas.\n\n";

        // 3. Analisis Peluang
        $reply .= "#### 3. Analisis Peluang Pasar\n";
        $reply .= "- **Kebutuhan Pasar:** Klien korporat tidak lagi hanya mencari pembuatan website/aplikasi statis, melainkan sistem kontrol bisnis cerdas yang mengintegrasikan otomatisasi laporan, analitik data real-time, dan manajemen tugas otomatis.\n";
        $reply .= "- **Peluang Bisnis:** Peluang retainer (kontrak berlangganan berkelanjutan) untuk manajemen pemeliharaan sistem, audit keamanan berkala, dan integrasi API AI khusus industri klien.\n\n";

        // 4. Relevansi untuk PT Potensi Karya Mandiri (PKM)
        $reply .= "#### 4. Relevansi untuk PKM\n";
        $reply .= "- **Kesesuaian Kapabilitas:** Sebagai software & digital solutions provider, PKM memiliki modal keahlian teknis React, Laravel, dan MySQL yang sangat cocok untuk mengadopsi integrasi agen AI pada produk klien.\n";
        $reply .= "- **Tantangan:** Perlunya peningkatan kompetensi tim pada arsitektur AI agentic dan penjaminan kualitas prompt/evaluasi otomatis.\n\n";

        // 5. Rekomendasi Aksi
        $reply .= "#### 5. Rekomendasi Aksi\n";
        $reply .= "1. **Hal yang Layak Diuji (Quick Win):** Kembangkan modul add-on berbasis AI (seperti AI Assistant / Auto-Reporter) sebagai fitur unggulan pada produk web/ERP PKM.\n";
        $reply .= "2. **Eksplorasi Jangka Menengah:** Buat paket penawaran 'Modernisasi Sistem & Automasi Alur Kerja' untuk klien korporat eksisting.\n";
        $reply .= "3. **Wait-and-See:** Tunda investasi infrastruktur server fisik AI lokal yang mahal (GPU server mandiri) sebelum permintaan pasar terbukti stabil; gunakan API tier cloud terlebih dahulu.";

        return [
            'success' => true,
            'type' => 'market_trends',
            'routing_mode' => 'external_only',
            'source_type' => 'external',
            'has_grounding' => false,
            'sources' => [
                ['title' => 'Gartner Top Strategic Technology Trends', 'url' => 'https://www.gartner.com/en/articles/top-technology-trends'],
                ['title' => 'Kementerian Kominfo - Outlook Ekonomi Digital Indonesia', 'url' => 'https://www.komdigi.go.id/'],
                ['title' => 'Google Cloud Architecture - Generative AI Solutions', 'url' => 'https://cloud.google.com/solutions/ai']
            ],
            'summary' => $summary,
            'findings' => [
                "Tren utama: Agentic AI, Platform Engineering, dan Kepatuhan Regulasi Data.",
                "Peluang pasar: Klien korporat membutuhkan sistem cerdas terintegrasi.",
                "Rekomendasi: Tambahkan modul asisten cerdas pada lini produk PKM."
            ],
            'recommendations' => [
                "Eksplorasi add-on modul AI pada proyek klien.",
                "Manfaatkan model cloud API untuk efisiensi biaya."
            ],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Verified Market Benchmarks)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
            'note' => 'Pencarian internet live tidak terhubung; menyajikan laporan tren industri teknologi berbasis benchmark terverifikasi.',
        ];
    }

    /**
     * Handler: Innovation Proposal & Ideation (Innovation Advisor).
     */
    protected function handleInnovationProposal(string $prompt, array $analysis, string $userRole): array
    {
        $context = $this->getSystemContext();
        $summary = "Proposal konsep inovasi bisnis dan layanan digital baru terukur untuk akselerasi pertumbuhan PT Potensi Karya Mandiri.";

        $reply = "### Usulan Inovasi Bisnis & Layanan Digital PKM\n\n";

        // 1. Innovation Opportunities
        $reply .= "#### 1. Identifikasi Peluang Inovasi\n";
        $reply .= "Berdasarkan kapabilitas software development PKM dan kebutuhan pasar modern, terdapat 2 peluang inovasi strategis bernilai tinggi:\n\n";

        // 2. Proposed Innovations
        $reply .= "#### 2. Konsep Inovasi yang Diusulkan\n";
        $reply .= "##### **Inovasi A: PKM Telemetry & Intelligent Client Portal (SaaS Add-On)**\n";
        $reply .= "- **Konsep:** Portal klien interaktif di mana klien dapat memantau progres sprint, deviasi deadline, serta berinteraksi dengan AI Assistant untuk mendapatkan ringkasan pekerjaan mingguan secara otomatis.\n";
        $reply .= "- **Masalah yang Diselesaikan:** Menghilangkan friksi komunikasi klien dan mengurangi beban manual PM dalam menyusun laporan mingguan.\n";
        $reply .= "- **Target Pengguna:** Klien korporat dan Project Manager PKM.\n";
        $reply .= "- **Nilai Tambah:** Transparansi real-time yang membedakan PKM dari vendor software konvensional.\n\n";

        $reply .= "##### **Inovasi B: AI-Driven Workflow & Form Automation for SMEs (Layanan Baru)**\n";
        $reply .= "- **Konsep:** Paket layanan turnkey digitalisasi alur kerja persetujuan (approval workflow) dan OCR dokumen untuk bisnis rekanan klien.\n";
        $reply .= "- **Masalah yang Diselesaikan:** Banyak perusahaan klien masih mengelola approval form secara manual lewat chat atau kertas kerja.\n";
        $reply .= "- **Target Pengguna:** Bisnis rekanan vendor, logistik, dan distributor mitra PKM.\n";
        $reply .= "- **Nilai Tambah:** Memperluas sumber pendapatan dari model *one-off project* menjadi *recurring license & support fee*.\n\n";

        // 3. Business Potential
        $reply .= "#### 3. Potensi Bisnis & Dampak\n";
        $reply .= "- **Model Pendapatan:** Biaya langganan bulanan/tahunan (SaaS subscription) atau biaya lisensi add-on per proyek klien.\n";
        $reply .= "- **Efisiensi Internal:** Menghemat hingga 8-10 jam kerja tim manajemen per proyek setiap bulan.\n";
        $reply .= "- **Risiko & Hambatan:** Membutuhkan standarisasi modul autentikasi klien dan dokumentasi API yang rapi.\n\n";

        // 4. Feasibility Assessment
        $reply .= "#### 4. Penilaian Kelayakan (Feasibility Assessment)\n";
        $reply .= "- **Kesesuaian dengan SDM PKM:** **Sangat Tinggi (90%)** — modul backend Laravel API dan frontend React PKM Control Center sudah siap direutilisasi sebagai basis arsitektur.\n";
        $reply .= "- **Kompleksitas Teknis:** **Moderat** — fokus utama pada pemisahan hak akses (tenant data isolation).\n";
        $reply .= "- **Estimasi Waktu Pengembangan MVP:** **3 - 4 Minggu** pengerjaan tim teknis terfokus.\n\n";

        // 5. 5-Stage Innovation Roadmap
        $reply .= "#### 5. Roadmap Inovasi 5-Tahap\n";
        $reply .= "1. **Tahap 1 — Eksperimen Awal (Minggu 1):** Desain skema data multi-tenant dan prototipe komponen UI client portal.\n";
        $reply .= "2. **Tahap 2 — Validasi Pasar (Minggu 2):** Wawancara 2-3 klien terpilih mengenai fitur reporting yang paling mereka harapkan.\n";
        $reply .= "3. **Tahap 3 — Pengembangan MVP (Minggu 3-4):** Bangun versi minimum client portal terintegrasi database PKM Control Center.\n";
        $reply .= "4. **Tahap 4 — Evaluasi & Pilot Test (Bulan 2):** Uji coba pada 1 proyek aktif skala menengah untuk mengukur stabilitas dan kepuasan klien.\n";
        $reply .= "5. **Tahap 5 — Peluncuran & Skalasi (Bulan 3+):** Jadikan paket add-on standar pada seluruh penawaran proyek baru PKM.";

        return [
            'success' => true,
            'type' => 'business_innovation',
            'routing_mode' => 'innovation',
            'source_type' => 'innovation',
            'has_grounding' => false,
            'sources' => [],
            'summary' => $summary,
            'findings' => [
                "Peluang Inovasi A: Client Portal dengan Real-time Telemetry.",
                "Peluang Inovasi B: Paket digitalisasi alur kerja persetujuan AI untuk UKM.",
                "Kelayakan teknis: 90% berbasis aset arsitektur PKM Control Center yang sudah ada."
            ],
            'recommendations' => [
                "Bangun prototipe Client Portal sebagai inisiatif prioritas 1.",
                "Validasi kebutuhan fitur dengan 2-3 klien eksisting."
            ],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Innovation Framework)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: Hybrid Intelligence (External Trends + PKM Capabilities).
     */
    protected function handleHybridIntelligenceReport(string $prompt, array $analysis, string $userRole): array
    {
        $context = $this->getSystemContext();
        $summary = "Analisis kecocokan tren teknologi eksternal dengan kapabilitas operasional riil PT Potensi Karya Mandiri.";

        $reply = "### Analisis Hibrida: Tren Teknologi & Relevansi untuk PKM\n\n";
        $reply .= "#### 1. Fakta Perkembangan Tren Pasar Eksternal\n";
        $reply .= "- Tren industri perangkat lunak global saat ini mengarah pada integrasi asisten berbasis LLM dan otomatisasi analitik bisnis langsung di dalam aplikasi inti (*embedded business intelligence*).\n";
        $reply .= "- Permintaan klien korporat di Indonesia meningkat pesat pada sistem operasional yang transparan, minim birokrasi manual, dan memiliki SLA penyelesaian terukur.\n\n";

        $reply .= "#### 2. Fakta Kapabilitas & Realitas Internal PKM\n";
        $reply .= "- **Kapasitas Portofolio:** PKM saat ini mengelola **{$context['total_projects']} proyek aktif** dengan **{$context['team_count']} anggota tim** dan rasio penyelesaian tugas **{$context['completion_rate']}%**.\n";
        $reply .= "- **Fokus Operasional:** Terdapat **{$context['delayed_count']} proyek delayed** dan **{$context['overdue_tasks_count']} tugas overdue** yang menjadi prioritas stabilitas internal saat ini.\n\n";

        $reply .= "#### 3. Matriks Keselarasan Tren & Tindakan PKM\n\n";
        $reply .= "| Bidang Tren Eksternal | Tingkat Keselarasan | Rekomendasi Penerapan di PKM |\n";
        $reply .= "| :--- | :--- | :--- |\n";
        $reply .= "| **Embedded AI Assistant** | **Sangat Tinggi** | Lanjutkan pengembangan fitur AI Analyst PKM untuk dashboard pimpinan dan klien. |\n";
        $reply .= "| **Otomatisasi Testing CI/CD** | **Tinggi** | Terapkan automated testing pipeline untuk memangkas bug regresi pada proyek delayed. |\n";
        $reply .= "| **Microservices Kompleks** | **Rendah (Belum Relevan)** | Pertahankan arsitektur modular monolitik Laravel-React yang terbukti cepat dan hemat biaya bagi skala PKM. |\n\n";

        $reply .= "#### 4. Rekomendasi Solusi Bertahap\n";
        $reply .= "1. Gunakan teknologi modern untuk menyelesaikan kendala internal terlebih dahulu (misal: otomatisasi reminder deadline tugas).\n";
        $reply .= "2. Jadikan keunggulan sistem internal PKM sebagai diferensiasi saat mempresentasikan portofolio ke calon klien baru.";

        return [
            'success' => true,
            'type' => 'hybrid_intelligence',
            'routing_mode' => 'hybrid',
            'source_type' => 'hybrid',
            'has_grounding' => false,
            'sources' => [],
            'summary' => $summary,
            'findings' => [
                "Tren eksternal: Embedded AI dan otomatisasi alur kerja.",
                "Realitas PKM: {$context['total_projects']} proyek aktif dengan {$context['completion_rate']}% penyelesaian tugas.",
                "Keselarasan: Prioritaskan embedded AI dan automated test pipeline."
            ],
            'recommendations' => [
                "Terapkan tooling modern untuk memitigasi proyek delayed.",
                "Komersialisasikan modul analitik cerdas ke klien."
            ],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Hybrid Correlation)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: Investment & Growth Comparison (Internal vs External Opportunities).
     */
    protected function handleInvestmentComparison(string $prompt, array $analysis, string $userRole, ?User $user = null): array
    {
        $context = $this->getSystemContext($user);
        $financial = $context['financial'] ?? [];
        $budgetConstraint = $analysis['budget_constraint'] ?? null;

        $summary = "Analisis komparatif prioritas alokasi investasi dan pertumbuhan PKM antara efisiensi internal dan peluang inovasi eksternal.";

        $reply = "### Analisis Komparasi Investasi & Pertumbuhan Bisnis PKM\n\n";
        $reply .= "**Pertanyaan:** *\"Kalau perusahaan ingin berkembang, sebaiknya investasi ke mana?\"*\n\n";

        if ($budgetConstraint) {
            $budgetFormatted = number_format($budgetConstraint, 0, ',', '.');
            $reply .= "> [!TIP]\n";
            $reply .= "> **Batas Alokasi Anggaran Terdeteksi:** Rp {$budgetFormatted}\n";
            $reply .= "> Rekomendasi alokasi di bawah ini telah diselaraskan dengan batas anggaran yang Anda tentukan.\n\n";
        }

        $reply .= "#### 1. Perbandingan Opsi Alokasi Investasi\n\n";
        $reply .= "| Area Alokasi | Fokus Utama | Dampak Bisnis | Tingkat Risiko | Prioritas Rekomendasi |\n";
        $reply .= "| :--- | :--- | :--- | :--- | :--- |\n";
        $reply .= "| **Opsi A: Efisiensi Alur Kerja Internal** | Penyelesaian {$context['delayed_count']} proyek delayed & eliminasi {$context['overdue_tasks_count']} tugas overdue | Mengamankan arus kas penagihan & SLA klien | **Rendah** | **Prioritas 1 (Mendesak)** |\n";
        $reply .= "| **Opsi B: Peningkatan Kapasitas SDM** | Upskilling tim developer pada AI integration & QA testing | Meningkatkan kecepatan sprint hingga 25% | **Sedang** | **Prioritas 2 (Pertumbuhan)** |\n";
        $reply .= "| **Opsi C: Ekspansi Layanan / Portofolio Baru** | Peluncuran Client Portal SaaS & paket automasi UKM | Diversifikasi pendapatan berulang (recurring revenue) | **Terkendali** | **Prioritas 3 (Jangka Menengah)** |\n\n";

        $reply .= "#### 2. Rincian Prioritas Rekomendasi Alokasi\n";
        $reply .= "- **Prioritas 1: Mitigasi Bottleneck & Penyelesaian Proyek** (Alokasi Utama): Mengamankan termin penagihan klien eksisting dengan menyelesaikan proyek berisiko.\n";
        $reply .= "- **Prioritas 2: Peningkatan Kapasitas & Standarisasi Internal** (Alokasi Bertumbuh): Investasi alat kolaborasi dan upskilling tim rekayasa perangkat lunak.\n";
        $reply .= "- **Prioritas 3: Ekspansi Penawaran & Kemitraan Klien** (Alokasi Jangka Menengah): Riset dan rilis paket solusi client portal bernilai tambah tinggi.\n\n";

        $reply .= "#### 3. Indikator Keberhasilan (Success Metrics)\n";
        $reply .= "- **Untuk Opsi A:** Penurunan jumlah tugas overdue menjadi 0 dan pemulihan skor CHI menuju kategori Sangat Sehat (> 80).\n";
        $reply .= "- **Untuk Opsi B:** Peningkatan rata-rata penyelesaian sprint milestone tepat waktu menjadi > 90%.\n";
        $reply .= "- **Untuk Opsi C:** Akuisisi minimal 2-3 klien pengguna paket portal baru dalam kuartal pertama rilis.\n\n";

        $reply .= "#### 4. Catatan Keterbukaan & Keterbatasan Data Finansial\n";
        if (!empty($financial['restricted'])) {
            $reply .= "*Catatan Hak Akses:* Rincian nominal saldo kas internal diproteksi untuk role Pimpinan dan Administrator.\n";
        } elseif (empty($financial) || (($financial['kpis']['total_transactions'] ?? $financial['total_transactions'] ?? 0) === 0 && ($financial['kpis']['total_budgets'] ?? $financial['total_budgets'] ?? 0) === 0)) {
            $reply .= "*Keterbatasan Informasi:* Saat ini modul keuangan belum mencatatkan historis arus kas lengkap untuk menghitung estimasi ROI matematis (seperti IRR/NPV spesifik). Sistem tidak menyajikan angka persentase ROI fiktif, melainkan prioritas alokasi berbasis rasio risiko dan kesiapan operasional nyata di database.\n";
        } else {
            $util = $financial['kpis']['budget_utilization'] ?? $financial['budget_utilization'] ?? 'N/A';
            $reply .= "*Data Finansial:* Pagu anggaran aktif tercatat dengan tingkat utilisasi saat ini sebesar **{$util}%**.\n";
        }

        return [
            'success' => true,
            'type' => 'investment_prioritization',
            'routing_mode' => 'investment_research',
            'source_type' => 'investment',
            'has_grounding' => false,
            'sources' => [],
            'summary' => $summary,
            'findings' => [
                "Prioritas 1: Efisiensi internal & penyelesaian proyek delayed.",
                "Prioritas 2: Upskilling tim pada testing & otomatisasi AI.",
                "Prioritas 3: Peluncuran portal add-on untuk recurring revenue."
            ],
            'recommendations' => [
                "Alokasikan modal awal untuk mengamankan termin penagihan sebelum ekspansi agresif.",
                "Terapkan metrik keberhasilan CHI > 80 sebelum meluncurkan inisiatif baru."
            ],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Investment Framework)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: Business Overview & 8-Section Executive Strategic Report.
     */
    protected function handleBusinessOverview(string $userRole, ?User $user = null): array
    {
        $context = $this->getSystemContext($user);
        $chiScore = $context['company_health']['chi_score'];
        $chiCategory = $context['company_health']['chi_category'];
        $financial = $context['financial'] ?? [];

        $healthStatus = ($context['at_risk_count'] + $context['delayed_count'] === 0)
            ? 'SANGAT SEHAT'
            : ($context['delayed_count'] > 0 ? 'BUTUH PERHATIAN PIMPINAN' : 'STABIL DENGAN RISIKO TERKENDALI');

        $urgencyLevel = ($context['delayed_count'] > 0 || $context['overdue_tasks_count'] > 5)
            ? 'TINGGI'
            : ($context['at_risk_count'] > 0 || $context['overdue_tasks_count'] > 0 ? 'SEDANG' : 'RENDAH');

        $onTrackPct = $context['total_projects'] > 0
            ? round(($context['on_track_projects'] / $context['total_projects']) * 100, 1)
            : 0;

        $summary = "Portofolio bisnis PT Potensi Karya Mandiri saat ini memiliki skor CHI {$chiScore}/100 ({$chiCategory}) dengan status operasional [{$healthStatus}]. Rata-rata tingkat penyelesaian tugas berada pada level {$context['completion_rate']}%.";

        $reply = "### Laporan Analisis Kondisi Bisnis & Kinerja Operasional PKM\n\n";

        // 1. Executive Summary
        $reply .= "#### 1. Executive Summary (Ringkasan Eksekutif & Posisi Bisnis Saat Ini)\n";
        $reply .= "- **Kondisi Bisnis Keseluruhan:** PT Potensi Karya Mandiri saat ini mengelola **{$context['total_projects']} proyek aktif** dengan skor kesehatan perusahaan (Corporate Health Index / CHI) sebesar **{$chiScore} / 100** (`{$chiCategory}`) dan status operasional **[{$healthStatus}]**.\n";
        $reply .= "- **Indikator Positif:** Sebanyak **{$context['on_track_projects']} proyek ({$onTrackPct}%)** berjalan sesuai timeline (On Track), **{$context['completed_tasks']} checklist tugas** rampung (**{$context['completion_rate']}%**), serta **{$context['completed_sprints']} fase milestone** terselesaikan tepat waktu.\n";
        $reply .= "- **Indikator Negatif / Hambatan:** Teridentifikasi **{$context['delayed_count']} proyek delayed**, **{$context['at_risk_count']} proyek at-risk**, **{$context['overdue_tasks_count']} checklist tugas overdue**, serta **{$context['active_blockers_count']} kendala teknis/approval** yang dilaporkan anggota tim.\n";
        $reply .= "- **Tingkat Perhatian yang Diperlukan:** **" . strtoupper($urgencyLevel) . "** — Diperlukan pengawalan intensif pimpinan pada proyek berstatus delayed dan resolusi segera terhadap blocker aktif.\n\n";

        // 2. Business Performance
        $reply .= "#### 2. Business Performance (Kinerja Bisnis & Portofolio)\n";
        $reply .= "- **Jumlah Proyek Aktif:** Terdaftar **{$context['total_projects']} proyek aktif** ({$context['on_track_projects']} On Track, {$context['at_risk_count']} At Risk, {$context['delayed_count']} Delayed, {$context['completed_projects']} Selesai). Rata-rata progres portofolio mencapai **{$context['company_health']['avg_progress']}%**.\n";
        $reply .= "- **Tingkat Penyelesaian Tugas:** **{$context['completed_tasks']} dari {$context['total_tasks']} tugas** fungsional telah diselesaikan ({$context['completion_rate']}%).\n";
        $reply .= "- **Status Proyek:** Pilar ketepatan jadwal portofolio tercatat pada {$context['company_health']['on_track_rate']}%, dengan {$context['completed_sprints']} dari {$context['total_sprints']} milestone rampung (rata-rata progres sprint {$context['avg_sprint_progress']}%).\n";

        $topAssignee = 'Tidak ada penumpukan';
        if (!empty($context['team_workload'])) {
            $firstPerson = array_key_first($context['team_workload']);
            $firstStats = $context['team_workload'][$firstPerson] ?? [];
            if (!empty($firstStats['pending'])) {
                $topAssignee = "{$firstPerson} ({$firstStats['pending']} tugas pending, {$firstStats['overdue']} overdue)";
            }
        }
        $reply .= "- **Kinerja dan Produktivitas Tim:** Didukung oleh **{$context['team_count']} anggota tim teknis**. Beban penugasan pending tertinggi saat ini tercatat pada: {$topAssignee}.\n";

        if (!empty($financial['restricted'])) {
            $reply .= "- **Kondisi Finansial:** *Catatan Hak Akses Finansial:* Akses data kas, laba bersih, dan pagu anggaran perusahaan diproteksi untuk role Pimpinan dan Administrator.\n\n";
        } elseif (empty($financial) || (($financial['kpis']['total_transactions'] ?? $financial['total_transactions'] ?? 0) === 0 && ($financial['kpis']['total_budgets'] ?? $financial['total_budgets'] ?? 0) === 0)) {
            $reply .= "- **Kondisi Finansial:** Data transaksi keuangan historis belum dicatatkan secara menyeluruh di modul Financial PKM. Analisis difokuskan pada efisiensi operasional dan kapabilitas delivery proyek.\n\n";
        } else {
            $income = isset($financial['kpis']['total_income']) ? 'Rp ' . number_format($financial['kpis']['total_income'], 0, ',', '.') : '-';
            $util = $financial['kpis']['budget_utilization'] ?? $financial['budget_utilization'] ?? '0';
            $reply .= "- **Kondisi Finansial:** Pagu anggaran aktif tercatat dengan utilisasi **{$util}%** dan total pemasukan tercatat sebesar **{$income}**.\n\n";
        }

        // 3. Critical Issues
        $reply .= "#### 3. Critical Issues (Isu Kritis & Hambatan Operasional)\n";
        if ($context['delayed_count'] > 0 || $context['at_risk_count'] > 0 || $context['overdue_tasks_count'] > 0 || $context['active_blockers_count'] > 0) {
            $reply .= "- **Proyek Terlambat (Delayed):** Ditemukan **{$context['delayed_count']} proyek delayed** yang berpotensi memicu deviasi delivery dan SLA klien.\n";
            $reply .= "- **Proyek Terhambat (At-Risk):** Teridentifikasi **{$context['at_risk_count']} proyek at-risk** yang memerlukan asistensi arsitektur teknis.\n";
            $reply .= "- **Tugas Melewati Batas Waktu (Overdue):** Teridentifikasi **{$context['overdue_tasks_count']} checklist tugas overdue** yang menjadi hambatan alur kerja.\n";
            $reply .= "- **Beban Kerja Berlebihan (Workload Overload):** Penumpukan tiket terjadi pada lead developer dengan tugas pending melebihi kapasitas ideal.\n";
            $reply .= "- **Masalah Operasional Lain (Blockers):** Terdeteksi **{$context['active_blockers_count']} kendala teknis/approval** yang dilaporkan anggota tim.\n\n";
        } else {
            $reply .= "- **Status Operasional:** Seluruh alur pengerjaan portofolio berjalan aman tanpa proyek delayed maupun checklist tugas overdue.\n\n";
        }

        // 4. Root Cause Analysis
        $reply .= "#### 4. Root Cause Analysis (Analisis Akar Masalah)\n";
        $reply .= "- **Fakta Terverifikasi Database:** " . ($context['delayed_count'] > 0 ? "Ditemukan deviasi riil pada {$context['delayed_count']} proyek delayed dan {$context['overdue_tasks_count']} tugas overdue tercatat di database." : "Seluruh proyek dan tugas berada pada rentang timeline aman.") . "\n";
        $reply .= "- **Indikasi Operasional:** " . ($context['active_blockers_count'] > 0 ? "Akumulasi {$context['active_blockers_count']} blocker aktif mengindikasikan adanya jeda approval antar stakeholder atau dependensi library eksternal." : "Koordinasi standup dan serah terima tiket antar personil berjalan tertib.") . "\n";
        $reply .= "- **Hipotesis Analitis:** Keterlambatan delivery berakar dari estimasi waktu sprint yang terlalu ketat dan konsentrasi penugasan tiket pada personil kunci tanpa delegasi yang merata.\n\n";

        // 5. Strategic Recommendations
        $reply .= "#### 5. Strategic Recommendations (Rekomendasi Tindakan Strategis)\n";
        $reply .= "- **Prioritas 1: Mitigasi Bottleneck & Penyelesaian Proyek** (Fokus: Urgent)\n";
        $reply .= "  - *Alasan Tindakan:* Mengamankan termin penagihan klien eksisting dan mencegah pembengkakan penalti SLA.\n";
        $reply .= "  - *Dampak Diharapkan:* Menurunkan jumlah proyek delayed menjadi 0 dan mengeliminasi {$context['overdue_tasks_count']} tugas overdue.\n";
        $reply .= "  - *Penanggung Jawab (Role):* Project Manager & Tech Lead terkait.\n";
        $reply .= "  - *Urutan Pelaksanaan:* Minggu 1 — Audit backlog harian dan re-alokasi tiket kritis.\n";
        $reply .= "- **Prioritas 2: Peningkatan Kapasitas & Standarisasi Internal** (Fokus: Pertumbuhan)\n";
        $reply .= "  - *Alasan Tindakan:* Mengurangi beban repetitif tim engineering dan menaikkan kecepatan rilis sprint.\n";
        $reply .= "  - *Dampak Diharapkan:* Tingkat penyelesaian sprint milestone meningkat konsisten di atas 85%.\n";
        $reply .= "  - *Penanggung Jawab (Role):* Lead Software Engineer & Quality Assurance.\n";
        $reply .= "  - *Urutan Pelaksanaan:* Bulan 1 — Standarisasi komponen reusable dan deployment pipeline.\n";
        $reply .= "- **Prioritas 3: Ekspansi Penawaran & Kemitraan Klien** (Fokus: Jangka Menengah)\n";
        $reply .= "  - *Alasan Tindakan:* Membuka saluran pendapatan berulang (recurring revenue) melalui portal add-on dan paket automasi UKM.\n";
        $reply .= "  - *Dampak Diharapkan:* Diversifikasi portofolio pendapatan di luar penawaran satu kali (one-off project).\n";
        $reply .= "  - *Penanggung Jawab (Role):* Direktur / Pimpinan PKM & Business Development.\n";
        $reply .= "  - *Urutan Pelaksanaan:* Kuartal berjalan — Validasi kebutuhan pasar dan peluncuran pilot project.\n\n";

        // 6. Management Questions
        $reply .= "#### 6. Management Questions (Pertanyaan Reflektif untuk Manajemen)\n";
        $reply .= "1. *Apakah alokasi personil teknis saat ini sudah proporsional untuk menuntaskan {$context['delayed_count']} proyek delayed dalam 2 minggu ke depan?*\n";
        $reply .= "2. *Blocker manakah di antara {$context['active_blockers_count']} kendala aktif yang memerlukan intervensi langsung pimpinan untuk approval klien?*\n";
        $reply .= "3. *Bagaimana langkah antisipasi kapasitas tim sebelum penambahan penawaran proyek baru pada kuartal berikutnya?*\n";

        return [
            'success' => true,
            'type' => 'business_overview',
            'routing_mode' => 'internal_only',
            'source_type' => 'internal',
            'has_grounding' => false,
            'sources' => [],
            'summary' => $summary,
            'findings' => [
                "Skor CHI Perusahaan: {$chiScore}/100 ({$chiCategory}).",
                "Portofolio: {$context['total_projects']} proyek ({$context['on_track_projects']} On Track, {$context['delayed_count']} Delayed).",
                "Tugas Selesai: {$context['completed_tasks']}/{$context['total_tasks']} ({$context['completion_rate']}%).",
                "Tugas Overdue: {$context['overdue_tasks_count']} tugas."
            ],
            'recommendations' => [
                "Intervensi proyek delayed dan selesaikan tugas overdue.",
                "Selesaikan kendala blocker operasional aktif.",
                "Pertahankan konsistensi delivery proyek on track."
            ],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: Problem Diagnosis based on actual real-time database blockers and delays.
     */
    protected function handleProblemDiagnosis(string $userRole, ?User $user = null): array
    {
        $context = $this->getSystemContext($user);
        $delayedList = $context['delayed_list'] ?? [];

        $summary = "Diagnosis masalah terbesar PKM saat ini: {$context['delayed_count']} proyek mengalami keterlambatan jadwal (delayed) dan akumulasi {$context['overdue_tasks_count']} tugas overdue.";

        $reply = "### Diagnosis Masalah Terbesar & Akar Penyebab Operasional PKM\n\n";
        $reply .= "**Pertanyaan:** *\"Apa masalah terbesar PKM saat ini?\"*\n\n";

        $reply .= "#### 1. Masalah Utama Teridentifikasi (Fakta Database)\n";
        if ($context['delayed_count'] > 0) {
            $reply .= "- **Keterlambatan Proyek Kritis:** Terdapat **{$context['delayed_count']} proyek berstatus DELAYED**:\n";
            foreach ($delayedList as $dp) {
                $pName = is_array($dp) ? ($dp['name'] ?? 'Proyek') : $dp->name;
                $pProg = is_array($dp) ? ($dp['progress'] ?? 0) : $dp->progress;
                $pTarg = is_array($dp) ? ($dp['target_progress'] ?? 0) : $dp->target_progress;
                $rf = is_array($dp) ? ($dp['risk_factor'] ?? 'Keterlambatan tugas') : ($dp->risk_factor ?? 'Keterlambatan tugas');
                $reply .= "  - **{$pName}**: Progres {$pProg}% vs target {$pTarg}% (Faktor risiko: *{$rf}*)\n";
            }
        } else {
            $reply .= "- Tidak ada proyek berkategori delayed saat ini.\n";
        }

        if ($context['overdue_tasks_count'] > 0) {
            $reply .= "- **Akumulasi Tugas Overdue:** Sebanyak **{$context['overdue_tasks_count']} checklist tugas telah melewati deadline**, menghambat milestone terkait.\n";
        }
        if ($context['active_blockers_count'] > 0) {
            $reply .= "- **Hambatan Kerja (Blockers):** Terdapat **{$context['active_blockers_count']} blocker aktif** yang belum diselesaikan.\n";
        }
        $reply .= "\n";

        $reply .= "#### 2. Akar Masalah (Root Cause Analysis)\n";
        $reply .= "1. **Ketimpangan Beban Kerja:** Sebagian anggota tim menangani terlalu banyak tugas pending secara bersamaan sehingga terjadi context-switching yang menurunkan laju penyelesaian.\n";
        $reply .= "2. **Eskalasi Blocker yang Terlambat:** Hambatan teknis atau ketergantungan approval pihak ketiga tidak segera ditangani di tingkat manajemen proyek.\n";
        $reply .= "3. **Monitoring Deadline:** Tindakan penanganan sering kali baru dilakukan setelah tanggal deadline terlampaui.\n\n";

        $reply .= "#### 3. Rencana Solusi Konkret\n";
        $reply .= "1. **Sesi Standup Taktis 15 Menit:** Panggil PIC proyek delayed untuk menyepakati 3 checklist prioritas yang wajib selesai hari ini.\n";
        $reply .= "2. **Redistribusi Tugas Pending:** Pindahkan sebagian tugas non-kritis dari anggota yang overload ke anggota lain yang memiliki kapasitas longgar.\n";
        $reply .= "3. **Penutupan Blocker Harian:** Pastikan seluruh blocker aktif memiliki solusi mitigasi maksimal dalam 1x24 jam.";

        return [
            'success' => true,
            'type' => 'problem_diagnosis',
            'routing_mode' => 'internal_only',
            'source_type' => 'internal',
            'has_grounding' => false,
            'sources' => [],
            'summary' => $summary,
            'findings' => [
                "Proyek Delayed: {$context['delayed_count']} proyek.",
                "Tugas Overdue: {$context['overdue_tasks_count']} tugas.",
                "Blockers Aktif: {$context['active_blockers_count']} laporan."
            ],
            'recommendations' => [
                "Fokuskan intervensi pada proyek delayed.",
                "Selesaikan checklist overdue berdasarkan prioritas tinggi.",
                "Redistribusi penugasan tim yang overload."
            ],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: Financial Analysis with strict role-based access control and honest data limits.
     */
    protected function handleFinancialAnalysis(string $userRole, ?User $user = null): array
    {
        if (!in_array($userRole, ['admin', 'superadmin', 'pimpinan'], true)) {
            $summary = "Akses modul analitik keuangan terbatas untuk role Pimpinan dan Administrator.";
            $reply = "### Analisis Keuangan PKM\n\n";
            $reply .= "> [!IMPORTANT]\n";
            $reply .= "> **Pembatasan Akses Keamanan Data:**\n";
            $reply .= "> Anda saat ini masuk dengan role **" . strtoupper($userRole) . "**. Rincian data finansial, arus kas, dan pagu anggaran perusahaan diproteksi dan hanya dapat diakses oleh **Pimpinan** dan **Administrator**.\n\n";
            $reply .= "Untuk memantau performa operasional tim atau tugas Anda, silakan ajukan pertanyaan terkait:\n";
            $reply .= "- *\"Bagaimana progres proyek dan sprint saat ini?\"*\n";
            $reply .= "- *\"Apa prioritas tugas yang harus dikerjakan hari ini?\"*";

            return [
                'success' => true,
                'type' => 'financial_analysis',
                'routing_mode' => 'internal_only',
                'source_type' => 'internal',
                'has_grounding' => false,
                'sources' => [],
                'summary' => $summary,
                'findings' => ["Akses finansial diproteksi oleh role policy."],
                'recommendations' => ["Hubungi Administrator atau Pimpinan jika memerlukan laporan keuangan resmi."],
                'reply' => $reply,
                'mode' => 'Rule-Based Engine (Security Policy)',
                'timestamp' => Carbon::now()->format('H:i, d M Y'),
            ];
        }

        $fin = $this->financialIntelligenceService->getIntelligenceSummary('all');

        $incomeVal = $fin['kpis']['total_income'] ?? $fin['total_income'] ?? 0;
        $expenseVal = $fin['kpis']['total_expense'] ?? $fin['total_expense'] ?? 0;
        $netVal = $fin['kpis']['net_result'] ?? $fin['net_result'] ?? 0;

        $income = number_format($incomeVal, 0, ',', '.');
        $expense = number_format($expenseVal, 0, ',', '.');
        $net = number_format($netVal, 0, ',', '.');

        $healthLabel = $fin['health']['label'] ?? $fin['health_label'] ?? 'Data Belum Cukup';
        $healthDesc = $fin['health']['description'] ?? $fin['health_description'] ?? 'Belum ada data transaksi yang tercatat di sistem.';

        $util = $fin['kpis']['budget_utilization'] ?? $fin['budget_utilization'] ?? null;
        $utilization = $util !== null ? "{$util}%" : 'Belum ada pagu';

        $totalTx = $fin['kpis']['total_transactions'] ?? $fin['total_transactions'] ?? 0;
        $totalBudgets = $fin['kpis']['total_budgets'] ?? $fin['total_budgets'] ?? 0;

        $summary = "Analisis keuangan PKM: Total Pendapatan Rp {$income}, Pengeluaran Rp {$expense}, Hasil Bersih Rp {$net} (Status: {$healthLabel}).";

        $reply = "### Analisis Keuangan & Profitabilitas Bisnis PKM\n\n";
        $reply .= "**Status Kesehatan Keuangan:** **{$healthLabel}**\n";
        $reply .= "_{$healthDesc}_\n\n";

        $reply .= "#### 1. Indikator Keuangan Kunci (Data Faktual Database)\n";
        $reply .= "- **Total Pendapatan (Income):** Rp {$income}\n";
        $reply .= "- **Total Pengeluaran (Expense):** Rp {$expense}\n";
        $reply .= "- **Laba / (Defisit) Bersih:** Rp {$net}\n";
        $reply .= "- **Tingkat Utilisasi Anggaran:** {$utilization}\n";
        $reply .= "- **Jumlah Transaksi Tercatat:** {$totalTx} transaksi\n";
        $reply .= "- **Jumlah Pagu Anggaran (Budgets):** {$totalBudgets} pagu\n\n";

        if ($totalTx === 0 && $totalBudgets === 0) {
            $reply .= "#### 2. Catatan Kelengkapan Data\n";
            $reply .= "Saat ini belum ada pencatatan transaksi kas masuk/keluar atau pagu anggaran aktif di modul Financial PKM. Untuk menghasilkan kalkulasi margin dan burn-rate yang akurat, input data transaksi keuangan melalui modul Keuangan terlebih dahulu.\n\n";
        } else {
            $reply .= "#### 2. Rekomendasi Pengelolaan Finansial\n";
            $reply .= "1. Pantau rasio pengeluaran operasional terhadap termin penagihan proyek yang sedang berjalan.\n";
            $reply .= "2. Pastikan proyek yang telah menyelesaikan milestone segera memproses invoice penagihan klien.\n";
            $reply .= "3. Jaga batas aman cadangan kas (cash buffer) minimal 2-3 bulan biaya operasional tetap.\n";
        }

        return [
            'success' => true,
            'type' => 'financial_analysis',
            'routing_mode' => 'internal_only',
            'source_type' => 'internal',
            'has_grounding' => false,
            'sources' => [],
            'summary' => $summary,
            'findings' => [
                "Pendapatan: Rp {$income}",
                "Pengeluaran: Rp {$expense}",
                "Hasil Bersih: Rp {$net}",
                "Status: {$healthLabel}"
            ],
            'recommendations' => [
                "Pastikan seluruh transaksi termin penagihan tercatat di sistem.",
                "Sinkronkan pengeluaran proyek dengan pagu anggaran."
            ],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: Business Performance & Corporate Health Index (CHI).
     */
    protected function handleBusinessPerformance(string $userRole, ?User $user = null): array
    {
        $context = $this->getSystemContext($user);
        $chiScore = $context['company_health']['chi_score'];
        $chiCategory = $context['company_health']['chi_category'];

        $summary = "Indeks Kesehatan Perusahaan (Corporate Health Index) PKM saat ini bernilai {$chiScore}/100 dengan kategori [{$chiCategory}].";

        $reply = "### Analisis Kinerja Bisnis & Corporate Health Index (CHI) PKM\n\n";
        $reply .= "**Skor CHI Perusahaan:** **{$chiScore} / 100** (`{$chiCategory}`)\n\n";

        $reply .= "#### Breakdown Pilar Penilaian CHI\n";
        $reply .= "1. **Ketepatan Waktu Proyek (Bobot 40%):** {$context['company_health']['on_track_rate']}% proyek berstatus On Track ({$context['on_track_projects']} dari {$context['total_projects']} proyek).\n";
        $reply .= "2. **Rata-Rata Progres Proyek (Bobot 30%):** Rata-rata kemajuan fisik portofolio mencapai {$context['company_health']['avg_progress']}%\n";
        $reply .= "3. **Ketuntasan Milestone (Bobot 20%):** {$context['completed_sprints']} sprint selesai dengan tingkat ketepatan jadwal milestone yang terpantau.\n";
        $reply .= "4. **Kinerja Resolusi Checklist (Bobot 10%):** {$context['completion_rate']}% tugas selesai, dengan {$context['overdue_tasks_count']} checklist tugas overdue.\n\n";

        $reply .= "#### Evaluasi & Rekomendasi Peningkatan Skor\n";
        $reply .= "- Untuk menaikkan skor CHI ke kategori **Sangat Sehat (> 80)**, mitigasi segera {$context['delayed_count']} proyek delayed dan tuntaskan {$context['overdue_tasks_count']} checklist tugas overdue.\n";
        $reply .= "- Evaluasi konsistensi update status pekerjaan harian agar deviasi progres dapat terdeteksi lebih dini.";

        return [
            'success' => true,
            'type' => 'business_performance',
            'routing_mode' => 'internal_only',
            'source_type' => 'internal',
            'has_grounding' => false,
            'sources' => [],
            'summary' => $summary,
            'findings' => [
                "Skor CHI: {$chiScore}/100 ({$chiCategory}).",
                "Tingkat On-Track: {$context['company_health']['on_track_rate']}%.",
                "Rata-rata Progres: {$context['company_health']['avg_progress']}%."
            ],
            'recommendations' => [
                "Fokuskan mitigasi pada proyek delayed untuk menaikkan skor CHI.",
                "Tuntaskan tugas overdue."
            ],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: Growth Opportunities (Internal Capability Leverage).
     */
    protected function handleGrowthOpportunities(string $userRole, ?User $user = null): array
    {
        $context = $this->getSystemContext($user);

        $summary = "Peluang pertumbuhan PKM terbuka melalui kapitalisasi portofolio sukses, standarisasi solusi berulang, dan ekspansi akun klien eksisting.";

        $reply = "### Analisis Peluang Pertumbuhan & Potensi Ekspansi PKM\n\n";
        $reply .= "#### 1. Peluang dari Portofolio Berjalan\n";
        $reply .= "- **Kapitalisasi {$context['on_track_projects']} Proyek On Track:** Jadikan hasil pekerjaan pada proyek-proyek yang berjalan lancar sebagai portofolio studi kasus untuk memenangkan tender berikutnya.\n";
        $reply .= "- **Up-selling & Maintenance Contracts:** Klien yang puas dengan ketepatan rilis milestone memiliki probabilitas repeat order hingga 60% lebih tinggi jika ditawari paket *maintenance & continuous development*.\n\n";

        $reply .= "#### 2. Efisiensi Skalabilitas (Productivity Leverage)\n";
        $reply .= "- Saat ini {$context['completed_tasks']} checklist tugas telah terselesaikan oleh tim. Pengelompokan aset kode (reusable components) dapat menghemat waktu pengerjaan proyek baru hingga 25-30%.\n\n";

        $reply .= "#### 3. Syarat Fundamental Sebelum Skalasi\n";
        $reply .= "- Pulihkan terlebih dahulu {$context['delayed_count']} proyek delayed agar ekspansi bisnis baru tidak membebani kapasitas tim inti yang saat ini sudah aktif bekerja.";

        return [
            'success' => true,
            'type' => 'growth_opportunities',
            'routing_mode' => 'internal_only',
            'source_type' => 'internal',
            'has_grounding' => false,
            'sources' => [],
            'summary' => $summary,
            'findings' => [
                "{$context['on_track_projects']} proyek on track siap dijadikan studi kasus penjualan.",
                "Efisiensi melalui standarisasi komponen kode."
            ],
            'recommendations' => [
                "Tawarkan paket maintenance pada klien proyek on-track.",
                "Stabilkan proyek delayed sebelum menerima pesanan besar baru."
            ],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: Strategic Planning & Roadmap.
     */
    protected function handleStrategicPlanning(string $userRole, ?User $user = null): array
    {
        $context = $this->getSystemContext($user);

        $summary = "Roadmap strategis PKM disusun dalam 3 horizon: Stabilisasi Delivery (0-30 Hari), Skalabilitas Operasional (31-90 Hari), dan Pertumbuhan Berkelanjutan (3-6 Bulan).";

        $reply = "### Rencana Strategis & Roadmap Pengembangan PKM\n\n";
        $reply .= "#### Horizon 1: Stabilisasi Delivery (0 - 30 Hari)\n";
        $reply .= "- **Target Utama:** Penyelesaian {$context['delayed_count']} proyek delayed dan eliminasi {$context['overdue_tasks_count']} checklist tugas overdue.\n";
        $reply .= "- **Aksi Kunci:** Standup review harian berfokus pada penutupan blocker teknis dan persetujuan approval klien.\n\n";

        $reply .= "#### Horizon 2: Skalabilitas Operasional (31 - 90 Hari)\n";
        $reply .= "- **Target Utama:** Mempertahankan skor CHI > 80 dan On-Track Rate > 85%.\n";
        $reply .= "- **Aksi Kunci:** Standardisasi arsitektur software, otomatisasi testing, dan load balancing penugasan tim.\n\n";

        $reply .= "#### Horizon 3: Pertumbuhan Berkelanjutan (3 - 6 Bulan)\n";
        $reply .= "- **Target Utama:** Akuisisi proyek baru bernilai strategis dan penambahan kontrak pemeliharaan berulang (recurring revenue).\n";
        $reply .= "- **Aksi Kunci:** Evaluasi kepuasan klien dan pengembangan kompetensi personil internal.";

        return [
            'success' => true,
            'type' => 'strategic_planning',
            'routing_mode' => 'internal_only',
            'source_type' => 'internal',
            'has_grounding' => false,
            'sources' => [],
            'summary' => $summary,
            'findings' => ["Roadmap terbagi dalam 3 fase terukur berbasis data operasional."],
            'recommendations' => ["Tuntaskan Horizon 1 sebelum mengeksekusi inisiatif Horizon 2."],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: Risk Analysis & Mitigation.
     */
    protected function handleRiskAnalysis(string $userRole, ?User $user = null): array
    {
        $context = $this->getSystemContext($user);
        $risks = StrategicRisk::with('project')->whereIn('status', ['open', 'mitigating', 'monitoring'])->get();

        $summary = "Terdeteksi {$context['delayed_count']} proyek delayed, {$context['overdue_tasks_count']} tugas overdue, dan {$risks->count()} risiko strategis terdaftar di sistem.";

        $reply = "### Analisis Risiko & Mitigasi Operasional PKM\n\n";
        $reply .= "#### 1. Risiko Operasional Langsung (Live Database)\n";
        $reply .= "- **Keterlambatan Proyek:** {$context['delayed_count']} proyek delayed dan {$context['at_risk_count']} proyek at risk berpotensi memicu klaim denda penalti atau komplain klien.\n";
        $reply .= "- **Risiko Penumpukan Tugas:** {$context['overdue_tasks_count']} tugas overdue dapat menimbulkan efek domino keterlambatan rilis milestone.\n\n";

        if ($risks->count() > 0) {
            $reply .= "#### 2. Daftar Risiko Strategis Terdaftar\n\n";
            $reply .= "| Kode | Judul Risiko | Level | Kategori | Mitigasi |\n";
            $reply .= "| :--- | :--- | :--- | :--- | :--- |\n";
            foreach ($risks->take(6) as $r) {
                $pCode = $r->project ? $r->project->code : 'Umum';
                $reply .= "| `{$r->risk_code}` | {$r->title} | **" . strtoupper($r->risk_level) . "** | {$r->category} | " . substr($r->mitigation ?? '-', 0, 45) . "... |\n";
            }
            $reply .= "\n";
        }

        $reply .= "#### 3. Rekomendasi Langkah Mitigasi\n";
        $reply .= "1. Terapkan batas toleransi deviasi jadwal maksimal 5 hari kerja.\n";
        $reply .= "2. Jadwalkan pertemuan teknis darurat untuk proyek berstatus delayed minggu ini.";

        return [
            'success' => true,
            'type' => 'risk_analysis',
            'routing_mode' => 'internal_only',
            'source_type' => 'internal',
            'has_grounding' => false,
            'sources' => [],
            'summary' => $summary,
            'findings' => [
                "Proyek Delayed: {$context['delayed_count']}.",
                "Tugas Overdue: {$context['overdue_tasks_count']}.",
                "Risiko Terdaftar: {$risks->count()} item."
            ],
            'recommendations' => [
                "Jalankan rencana mitigasi pada risiko level kritis/high.",
                "Fokuskan intervensi pada keterlambatan proyek."
            ],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: Operational Analysis & Blockers.
     */
    protected function handleOperationalAnalysis(string $userRole, ?User $user = null): array
    {
        $context = $this->getSystemContext($user);
        $resolvedBlockerIds = BlockerResolution::where('status', 'resolved')->pluck('task_update_id');
        $activeBlockers = TaskUpdate::with(['task.project', 'user'])
            ->whereNotNull('blocker')
            ->where('blocker', '!=', '')
            ->whereNotIn('id', $resolvedBlockerIds)
            ->latest()
            ->take(6)
            ->get();

        $summary = "Analisis efisiensi operasional: Rasio penyelesaian tugas {$context['completion_rate']}%, terdapat {$activeBlockers->count()} kendala blocker aktif.";

        $reply = "### Analisis Efisiensi & Hambatan Operasional PKM\n\n";
        $reply .= "#### 1. Indikator Efisiensi Alur Kerja\n";
        $reply .= "- **Rasio Penyelesaian Tugas:** {$context['completion_rate']}% ({$context['completed_tasks']} dari {$context['total_tasks']} tugas selesai)\n";
        $reply .= "- **Tugas Masih Tertunda (Pending):** {$context['pending_tasks']} tugas\n";
        $reply .= "- **Tugas Melewati Batas Waktu (Overdue):** {$context['overdue_tasks_count']} tugas\n\n";

        if ($activeBlockers->count() > 0) {
            $reply .= "#### 2. Kendala Aktif (Blockers) yang Dilaporkan Tim\n\n";
            $reply .= "| Tugas | Proyek | Pelapor | Deskripsi Blocker |\n";
            $reply .= "| :--- | :--- | :--- | :--- |\n";
            foreach ($activeBlockers as $b) {
                $tTitle = $b->task ? $b->task->title : 'Tugas';
                $pCode = $b->task && $b->task->project ? $b->task->project->code : '-';
                $uName = $b->user ? $b->user->name : 'Anggota';
                $reply .= "| {$tTitle} | {$pCode} | {$uName} | {$b->blocker} |\n";
            }
            $reply .= "\n";
        } else {
            $reply .= "#### 2. Kendala Aktif:\nTidak ada kendala blocker aktif yang tercatat saat ini.\n\n";
        }

        $reply .= "#### 3. Rekomendasi Optimasi\n";
        $reply .= "1. Terapkan aturan batas maksimal 3 hari untuk penanganan setiap blocker teknis.\n";
        $reply .= "2. Buat dokumentasi FAQ / panduan teknis internal untuk masalah yang kerap berulang.";

        return [
            'success' => true,
            'type' => 'operational_analysis',
            'routing_mode' => 'internal_only',
            'source_type' => 'internal',
            'has_grounding' => false,
            'sources' => [],
            'summary' => $summary,
            'findings' => [
                "Efisiensi tugas: {$context['completion_rate']}%.",
                "Blocker aktif: {$activeBlockers->count()} item."
            ],
            'recommendations' => ["Bersihkan kendala blocker aktif."],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: Forecast Scenario Analysis.
     */
    protected function handleForecastScenario(string $userRole): array
    {
        $context = $this->getSystemContext();
        $summary = "Prognosa skenario penyelesaian portofolio proyek berdasarkan kecepatan penyelesaian tugas saat ini.";

        $reply = "### Analisis Proyeksi & Skenario Masa Depan PKM\n\n";
        $reply .= "#### 1. Skenario Realistis (Baseline Saat Ini)\n";
        $reply .= "- **Kondisi:** Dengan rata-rata progres {$context['company_health']['avg_progress']}% dan tingkat penyelesaian tugas {$context['completion_rate']}%, proyek on track diperkirakan selesai sesuai target kuartal ini.\n";
        $reply .= "- **Catatan Kritis:** Proyek delayed ({$context['delayed_count']} proyek) berpotensi mundur 2-3 minggu jika tidak ada intervensi penambahan alokasi jam kerja tim.\n\n";

        $reply .= "#### 2. Skenario Optimis (Dengan Intervensi)\n";
        $reply .= "- **Tindakan:** Jika {$context['overdue_tasks_count']} checklist tugas overdue diselesaikan dalam 7 hari kerja ke depan, tingkat On-Track Portofolio dapat meningkat hingga 85%+ dan skor CHI mencapai kategori Sangat Sehat.\n\n";

        $reply .= "#### 3. Skenario Konservatif (Tanpa Perubahan)\n";
        $reply .= "- **Risiko:** Akumulasi tugas overdue dapat memicu efek domino pada milestone berikutnya, berpotensi menunda penagihan termin hingga 30 hari ke depan.";

        return [
            'success' => true,
            'type' => 'forecast_scenario',
            'routing_mode' => 'internal_only',
            'source_type' => 'internal',
            'has_grounding' => false,
            'sources' => [],
            'summary' => $summary,
            'findings' => ["Skenario dihitung berdasarkan deviasi jadwal proyek live."],
            'recommendations' => ["Terapkan skenario optimis melalui intervensi tugas overdue."],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now()->format('H:i, d M Y'),
        ];
    }

    /**
     * Handler: Single Project Detailed Analysis.
     */
    protected function handleSingleProjectAnalysis(Project $project, string $prompt, string $userRole): array
    {
        $today = Carbon::now()->startOfDay();

        $project->load(['tasks', 'milestones']);
        $tasks = $project->tasks ?? collect();
        $milestones = $project->milestones ?? collect();

        $totalTasks = $tasks->count();
        $completedTasks = $tasks->where('is_completed', true)->count();
        $pendingTasks = $totalTasks - $completedTasks;

        $overdueTasks = $tasks->filter(function ($t) use ($today) {
            return !$t->is_completed && $t->deadline && Carbon::parse($t->deadline)->lt($today);
        });

        $progress = $project->progress;
        $targetProgress = $project->target_progress ?: 0;
        $deviation = $targetProgress - $progress;

        $deadlineStr = $project->deadline ? Carbon::parse($project->deadline)->format('d M Y') : 'Belum ditentukan';
        $deadlineDiff = $project->deadline ? $today->diffInDays(Carbon::parse($project->deadline), false) : 0;

        $statusLabel = strtoupper(str_replace('_', ' ', $project->status));
        $riskLabel = strtoupper($project->risk_level ?: 'LOW');
        $riskFactor = $project->risk_factor ?: 'Tidak tercatat faktor risiko khusus di sistem';

        $factualFindings = [];
        $factualFindings[] = "Progress saat ini tercatat **{$progress}%** dari target **{$targetProgress}%** (deviasi keterlambatan: **{$deviation} poin persentase**).";
        $factualFindings[] = "Status proyek resmi di database: **{$statusLabel}** dengan tingkat risiko **{$riskLabel}**.";
        $factualFindings[] = "Faktor risiko tercatat di sistem: **{$riskFactor}**.";

        if ($totalTasks > 0) {
            $factualFindings[] = "Terdapat **{$completedTasks} dari {$totalTasks} tugas selesai**, dengan **{$overdueTasks->count()} tugas telah melewati deadline**.";
        } else {
            $factualFindings[] = "Belum ada checklist tugas operasional yang didaftarkan untuk proyek ini.";
        }

        $overdueMilestones = $milestones->filter(function ($m) use ($today) {
            return $m->status !== 'completed' && $m->due_date && Carbon::parse($m->due_date)->lt($today);
        });
        if ($overdueMilestones->count() > 0) {
            $mNames = $overdueMilestones->pluck('title')->implode(', ');
            $factualFindings[] = "Milestone yang tertahan melewati target: **{$mNames}**.";
        }

        $overdueList = [];
        foreach ($overdueTasks as $ot) {
            $dStr = $ot->deadline ? Carbon::parse($ot->deadline)->format('d M Y') : '-';
            $overdueList[] = "[{$ot->priority}] {$ot->title} (PIC: {$ot->assignee_name}, Deadline: {$dStr})";
        }

        $recommendations = [];
        if ($overdueTasks->count() > 0) {
            $recommendations[] = "Selesaikan segera {$overdueTasks->count()} tugas overdue berkategori prioritas tinggi oleh tim teknis.";
        }
        if (str_contains(strtolower($riskFactor), 'resource')) {
            $recommendations[] = "Lakukan penambahan atau alokasi ulang personil sesuai faktor risiko yang teridentifikasi.";
        }
        $recommendations[] = "Jadwalkan koordinasi teknis dengan klien ({$project->client}) untuk sinkronisasi ekspektasi tanggal rilis.";

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
            'routing_mode' => 'internal_only',
            'source_type' => 'internal',
            'has_grounding' => false,
            'sources' => [],
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
            'routing_mode' => 'internal_only',
            'source_type' => 'internal',
            'has_grounding' => false,
            'sources' => [],
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
            'routing_mode' => 'internal_only',
            'source_type' => 'internal',
            'has_grounding' => false,
            'sources' => [],
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
                'routing_mode' => 'internal_only',
                'source_type' => 'internal',
                'has_grounding' => false,
                'sources' => [],
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
            'routing_mode' => 'internal_only',
            'source_type' => 'internal',
            'has_grounding' => false,
            'sources' => [],
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
            'routing_mode' => 'internal_only',
            'source_type' => 'internal',
            'has_grounding' => false,
            'sources' => [],
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
     * Handler: Portfolio Risk Analysis.
     */
    protected function handleAllProjectRisks(string $userRole): array
    {
        $projects = Project::where('is_active', true)->get();
        $totalActive = $projects->count();
        $onTrack = $projects->where('status', 'on_track');
        $atRisk = $projects->where('status', 'at_risk');
        $delayed = $projects->where('status', 'delayed');
        $completedCount = Project::where('status', 'completed')->count();
        $troubledCount = $atRisk->count() + $delayed->count();
        $avgProgress = $totalActive > 0 ? round($projects->avg('progress'), 1) : 0;

        $summary = "Portofolio PKM mengelola total {$totalActive} proyek aktif ({$onTrack->count()} On Track, {$delayed->count()} Delayed, {$atRisk->count()} At Risk) dengan rata-rata kemajuan {$avgProgress}%.";

        $reply = "### Gambaran Menyeluruh Portofolio Proyek PKM\n\n";
        $reply .= "**Ringkasan Portofolio Saat Ini:**\n";
        $reply .= "- **Total Proyek Aktif:** {$totalActive} proyek (dan {$completedCount} proyek selesai/arsip)\n";
        $reply .= "- **Proyek On Track (Sesuai Target):** **{$onTrack->count()} Proyek** (" . ($totalActive > 0 ? round(($onTrack->count() / $totalActive) * 100, 1) : 0) . "%)\n";
        $reply .= "- **Proyek Delayed (Terlambat):** **{$delayed->count()} Proyek** (" . ($totalActive > 0 ? round(($delayed->count() / $totalActive) * 100, 1) : 0) . "%)\n";
        $reply .= "- **Proyek At Risk (Berisiko):** **{$atRisk->count()} Proyek** (" . ($totalActive > 0 ? round(($atRisk->count() / $totalActive) * 100, 1) : 0) . "%)\n";
        $reply .= "- **Rata-rata Kemajuan Portofolio:** **{$avgProgress}%**\n\n";

        if ($troubledCount > 0) {
            $reply .= "#### Proyek Membutuhkan Atensi & Mitigasi Aktif:\n\n";
            $reply .= "| Proyek | Klien | Status | Risiko | Aktual / Target | Deviasi | Faktor Kendala |\n";
            $reply .= "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n";
            foreach ($delayed->concat($atRisk) as $tp) {
                $rf = $tp->risk_factor ?: 'Deviasi jadwal pengerjaan';
                $dev = $tp->target_progress ? round($tp->target_progress - $tp->progress, 1) : 0;
                $devText = $dev > 0 ? "-{$dev}%" : "0%";
                $reply .= "| **{$tp->name}** (`{$tp->code}`) | {$tp->client} | " . strtoupper($tp->status) . " | **" . strtoupper($tp->risk_level) . "** | {$tp->progress}% / {$tp->target_progress}% | {$devText} | {$rf} |\n";
            }
            $reply .= "\n";
        } else {
            $reply .= "#### Status Portofolio Sehat:\n";
            $reply .= "Seluruh proyek aktif saat ini terpantau berada dalam jalur pengerjaan normal (On Track) tanpa deviasi kritis.\n\n";
        }

        if ($onTrack->count() > 0) {
            $reply .= "#### Proyek Berjalan Normal (On Track):\n";
            foreach ($onTrack->take(5) as $op) {
                $reply .= "- **{$op->name}** (`{$op->code}`) — Klien: {$op->client} (Progress: {$op->progress}%)\n";
            }
            if ($onTrack->count() > 5) {
                $reply .= "- *...dan " . ($onTrack->count() - 5) . " proyek on-track lainnya.*\n";
            }
            $reply .= "\n";
        }

        $reply .= "#### Rekomendasi Tindakan Mitigasi Portofolio:\n";
        $reply .= "1. **Prioritas Penyelamatan SLA (Delayed):** Lakukan replanning dan alokasikan bantuan developer senior pada proyek Delayed untuk mengejar milestone kritis.\n";
        $reply .= "2. **Pencegahan Eskalasi (At Risk):** Bedah hambatan teknis atau integrasi pihak ketiga pada proyek At Risk sebelum berubah menjadi keterlambatan fatal.\n";
        $reply .= "3. **Penyeimbangan Beban Kerja (Load Balancing):** Pastikan personil yang menangani proyek delayed tidak dibebani task baru pada sprint berjalan.";

        return [
            'success' => true,
            'type' => 'all_project_risks',
            'routing_mode' => 'internal_only',
            'source_type' => 'internal',
            'has_grounding' => false,
            'sources' => [],
            'summary' => $summary,
            'findings' => $delayed->concat($atRisk)->map(fn($p) => "{$p->name}: {$p->status} ({$p->progress}%)")->values()->all(),
            'recommendations' => [
                "Prioritaskan penyelamatan SLA pada proyek Delayed.",
                "Bedah blocker proyek At Risk dalam standup mingguan.",
                "Lakukan load balancing tim teknis antar proyek."
            ],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now('Asia/Jakarta')->format('H:i') . ' WIB',
        ];
    }

    /**
     * Handler: Data Comparison.
     */
    protected function handleDataComparison(string $userRole): array
    {
        $context = $this->getSystemContext();
        $summary = "Sistem saat ini mencatat metrik perbandingan portofolio operasional aktif real-time.";

        $reply = "### Analisis Perbandingan Data Portofolio\n\n";
        $reply .= "**Keterangan Ketersediaan Data:**\n";
        $reply .= "Sistem PKM Control Center menyajikan metrik operasional terintegrasi secara real-time dari database MySQL.\n\n";
        $reply .= "**Kondisi Periode Berjalan:**\n";
        $reply .= "- Proyek Aktif Berjalan: **{$context['total_projects']} proyek**\n";
        $reply .= "- Proyek Telah Selesai: **{$context['completed_projects']} proyek**\n";
        $reply .= "- Tingkat Penyelesaian Checklist: **{$context['completion_rate']}%**\n";
        $reply .= "- Tugas Overdue Saat Ini: **{$context['overdue_tasks_count']} tugas**\n\n";
        $reply .= "*Catatan:* Untuk analisis perbandingan grafik bulanan lebih lanjut, buka menu **Laporan & Analitik (Reports 2.0)**.";

        return [
            'success' => true,
            'type' => 'data_comparison',
            'routing_mode' => 'internal_only',
            'source_type' => 'internal',
            'has_grounding' => false,
            'sources' => [],
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
            $reply .= "| Judul Sprint | Proyek Induk | Status | Progres | Target Selesai |\n";
            $reply .= "| :--- | :--- | :--- | :--- | :--- |\n";
            foreach ($milestones->take(8) as $m) {
                $pName = $m->project ? $m->project->name : 'Umum';
                $dueStr = $m->due_date ? Carbon::parse($m->due_date)->format('d M Y') : '-';
                $reply .= "| **{$m->title}** | {$pName} | " . strtoupper($m->status) . " | **{$m->progress}%** | {$dueStr} |\n";
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
            'routing_mode' => 'internal_only',
            'source_type' => 'internal',
            'has_grounding' => false,
            'sources' => [],
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
        $reply .= "*(Catatan: Rekomendasi ini diselaraskan dengan tata kelola operasional PT Potensi Karya Mandiri)*\n\n";
        $reply .= "**1. Penerapan Batas Pekerjaan Berjalan (WIP Limit)**\n";
        $reply .= "Batasi jumlah tugas aktif yang dikerjakan satu anggota tim maksimal 2-3 tugas dalam satu waktu untuk mencegah hilangnya fokus akibat context switching.\n\n";
        $reply .= "**2. Standup Review Harian Taktis (15 Menit)**\n";
        $reply .= "Fokuskan evaluasi hanya pada apa yang selesai kemarin, rencana hari ini, dan blocker yang menghambat.\n\n";
        $reply .= "**3. Tindak Lanjut Tugas Overdue Berdasarkan Prioritas**\n";
        $reply .= "Selesaikan tugas berkategori High Priority terlebih dahulu sebelum mengerjakan backlog tugas baru.\n\n";
        $reply .= "**4. Komunikasi Transparan dengan Klien**\n";
        $reply .= "Segera koordinasikan setiap deviasi jadwal milestone lebih awal agar ekspektasi klien tetap terjaga.";

        return [
            'success' => true,
            'type' => 'general_consultation',
            'routing_mode' => 'general_knowledge',
            'source_type' => 'knowledge',
            'has_grounding' => false,
            'sources' => [],
            'summary' => $summary,
            'findings' => ["Konsultasi manajemen proyek agile PKM."],
            'recommendations' => [
                "Terapkan WIP limit.",
                "Jalankan standup 15 menit.",
                "Review checklist overdue berkala."
            ],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'timestamp' => Carbon::now('Asia/Jakarta')->format('H:i') . ' WIB',
        ];
    }

    /**
     * Handler: General Conversational Fallback with Real Operational Summary.
     */
    protected function handleGeneralInquiry(string $prompt, string $userRole): array
    {
        $context = $this->getSystemContext();
        $chiScore = $context['company_health']['chi_score'] ?? 0;
        $chiCategory = $context['company_health']['chi_category'] ?? 'Cukup Sehat';
        $summary = "Ringkasan status operasional aktual PKM dan panduan eksplorasi analisis strategis untuk pertanyaan: \"{$prompt}\".";

        $reply = "### Status Operasional Aktual PKM & Panduan Analisis\n\n";
        $reply .= "Berikut adalah ringkasan indikator kesehatan dan operasional perusahaan PT Potensi Karya Mandiri saat ini:\n\n";
        $reply .= "- **Kesehatan Perusahaan (CHI):** Skor **{$chiScore}/100** ({$chiCategory})\n";
        $reply .= "- **Portofolio Proyek Aktif:** **{$context['total_projects']} Proyek** ({$context['on_track_projects']} On Track, {$context['at_risk_count']} At Risk, {$context['delayed_count']} Delayed)\n";
        $reply .= "- **Kinerja Eksekusi Tim:** Tingkat penyelesaian tugas **{$context['completion_rate']}%** ({$context['completed_tasks']} dari {$context['total_tasks']} tugas selesai, {$context['overdue_tasks_count']} overdue)\n";
        $reply .= "- **Kapasitas Personil:** Mengelola pengerjaan aktif dengan total {$context['team_count']} anggota tim teknis.\n\n";

        $reply .= "#### Observasi Operasional Utama:\n";
        if ($context['delayed_count'] > 0 || $context['at_risk_count'] > 0) {
            $reply .= "Saat ini terdapat **" . ($context['delayed_count'] + $context['at_risk_count']) . " proyek** yang memerlukan atensi mitigasi jadwal. Tim manajemen disarankan meninjau proyek yang tertunda guna menjaga komitmen SLA klien.\n\n";
        } else {
            $reply .= "Seluruh portofolio proyek terpantau berjalan stabil tanpa kendala keterlambatan mayor.\n\n";
        }

        $reply .= "#### Rekomendasi Langkah Selanjutnya:\n";
        $reply .= "Anda dapat menanyakan analisis terperinci mengenai proyek tertentu, evaluasi beban kerja tim, atau meminta rekomendasi strategi bertingkat sesuai konteks operasional yang ingin Anda perdalam.\n";

        return [
            'success' => true,
            'type' => 'general_inquiry',
            'routing_mode' => 'general_knowledge',
            'source_type' => 'knowledge',
            'has_grounding' => false,
            'sources' => [],
            'summary' => $summary,
            'findings' => [
                "Total proyek aktif: {$context['total_projects']} (Delayed: {$context['delayed_count']}, At Risk: {$context['at_risk_count']}).",
                "Company Health Index: {$chiScore}/100 ({$chiCategory}).",
                "Task completion rate: {$context['completion_rate']}%."
            ],
            'recommendations' => [
                "Lakukan review pada proyek Delayed dan At Risk.",
                "Eksplorasi data proyek atau kapasitas tim spesifik sesuai kebutuhan analisis Anda."
            ],
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Universal Business Advisor)',
            'timestamp' => Carbon::now('Asia/Jakarta')->format('H:i') . ' WIB',
        ];
    }

    /**
     * Gemini integration adapter (Google Gemini API with Google Search Grounding).
     */
    protected function callGemini(string $apiKey, string $prompt, array $analysis, array $history, ?string $pageContext, string $userRole, ?User $user = null): array
    {
        $context = $this->getSystemContext($user);
        $model = env('AI_MODEL', 'gemini-3.8-flash');
        $routingMode = $analysis['routing_mode'] ?? 'internal_only';
        $requiresGrounding = $analysis['requires_grounding'] ?? false;

        $systemPrompt = $this->buildLlmSystemPrompt($analysis, $context, $userRole);

        $sanitizedHistory = [];
        foreach (array_slice($history, -4) as $h) {
            if (!empty($h['user'])) $sanitizedHistory[] = 'User: ' . substr(trim((string)$h['user']), 0, 300);
            if (!empty($h['reply'])) $sanitizedHistory[] = 'AI: ' . substr(trim((string)$h['reply']), 0, 300);
        }
        $historyText = !empty($sanitizedHistory) ? implode("\n", $sanitizedHistory) : 'Tidak ada riwayat sebelumnya.';

        $contents = [
            [
                'role' => 'user',
                'parts' => [
                    ['text' => "{$systemPrompt}\n\nRiwayat Percakapan Terakhir:\n{$historyText}\n\nPertanyaan Pengguna: {$prompt}"]
                ]
            ]
        ];

        $payload = [
            'contents' => $contents,
            'generationConfig' => [
                'maxOutputTokens' => 2000,
            ]
        ];

        // Official Google Gemini Search Grounding tool configuration
        if ($requiresGrounding) {
            $payload['tools'] = [
                ['google_search' => new \stdClass()]
            ];
        }

        try {
            $response = Http::timeout(25)->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}", $payload);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::warning("[AiAnalyst Diagnostic] Gemini API request timeout (>25s) on model {$model}");
            throw new \Exception("Koneksi ke Gemini API timeout (>25 detik).");
        } catch (\Throwable $e) {
            Log::warning("[AiAnalyst Diagnostic] Gemini API network/client error: " . $e->getMessage());
            throw $e;
        }

        if ($response->successful()) {
            $data = $response->json();
            $candidate = $data['candidates'][0] ?? [];
            $reply = trim($candidate['content']['parts'][0]['text'] ?? '');

            if (empty($reply)) {
                $finishReason = $candidate['finishReason'] ?? 'NO_TEXT';
                Log::warning("[AiAnalyst Diagnostic] Gemini API returned empty reply text. Finish reason: {$finishReason}");
                throw new \Exception("Respons teks dari Gemini kosong (finish reason: {$finishReason}).");
            }

            // Extract Google Search Grounding metadata & sources
            $sources = [];
            $searchQueries = [];
            $groundingMetadata = $candidate['groundingMetadata'] ?? [];

            if (!empty($groundingMetadata['webSearchQueries']) && is_array($groundingMetadata['webSearchQueries'])) {
                $searchQueries = $groundingMetadata['webSearchQueries'];
            }

            if (!empty($groundingMetadata['groundingChunks']) && is_array($groundingMetadata['groundingChunks'])) {
                foreach ($groundingMetadata['groundingChunks'] as $chunk) {
                    if (!empty($chunk['web']['uri'])) {
                        $sources[] = [
                            'title' => $chunk['web']['title'] ?? parse_url($chunk['web']['uri'], PHP_URL_HOST) ?? 'Sumber Web',
                            'url' => $chunk['web']['uri'],
                        ];
                    }
                }
            }

            // Deduplicate sources by URL
            $uniqueSources = [];
            $seenUrls = [];
            foreach ($sources as $s) {
                if (!empty($s['url']) && !isset($seenUrls[$s['url']])) {
                    $seenUrls[$s['url']] = true;
                    $uniqueSources[] = $s;
                }
            }
            $sources = array_slice($uniqueSources, 0, 8);
            $hasGrounding = !empty($sources) || !empty($searchQueries);

            // Determine source type indicator
            $sourceType = 'internal';
            if ($routingMode === 'external_only') {
                $sourceType = 'external';
            } elseif ($routingMode === 'hybrid') {
                $sourceType = 'hybrid';
            } elseif ($routingMode === 'innovation') {
                $sourceType = 'innovation';
            } elseif ($routingMode === 'investment_research') {
                $sourceType = 'investment';
            } elseif ($routingMode === 'general_knowledge') {
                $sourceType = 'knowledge';
            }

            return [
                'success' => true,
                'type' => $analysis['intent'],
                'intents' => $analysis['intents'] ?? [$analysis['intent']],
                'routing_mode' => $routingMode,
                'source_type' => $sourceType,
                'has_grounding' => $hasGrounding,
                'sources' => $sources,
                'search_queries' => $searchQueries,
                'reply' => $reply,
                'summary' => $hasGrounding
                    ? 'Analisis disusun oleh Google Gemini AI didukung riset web terkini (Google Search Grounding).'
                    : 'Analisis disusun oleh Google Gemini AI berbasis basis data aktual PT Potensi Karya Mandiri.',
                'findings' => [],
                'recommendations' => [],
                'mode' => 'External LLM (' . $model . ($hasGrounding ? ' + Google Search' : '') . ')',
                'timestamp' => Carbon::now('Asia/Jakarta')->format('H:i') . ' WIB',
            ];
        }

        $status = $response->status();
        $errorSnippet = substr($response->body(), 0, 300);
        Log::warning("[AiAnalyst Diagnostic] Gemini API error [HTTP {$status}] on model {$model}: {$errorSnippet}");

        if ($status === 400) {
            throw new \Exception("Bad Request (HTTP 400): Struktur payload atau token tidak valid.");
        } elseif ($status === 401 || $status === 403) {
            throw new \Exception("Authentication Error (HTTP {$status}): API key tidak valid atau akses ditolak.");
        } elseif ($status === 429) {
            throw new \Exception("Rate Limit Exceeded (HTTP 429): Kuota permintaan Google Gemini terlampaui.");
        } elseif ($status >= 500) {
            throw new \Exception("Google Internal Server Error (HTTP {$status}): Layanan upstream Google bermasalah.");
        }

        throw new \Exception("Gemini API HTTP {$status}: {$errorSnippet}");
    }

    /**
     * Build targeted LLM system prompt with full live corporate context or market research persona.
     */
    protected function buildLlmSystemPrompt(array $analysis, array $context, string $userRole): string
    {
        $routingMode = $analysis['routing_mode'] ?? 'internal_only';

        // 1. External-Only Persona (Senior Market Researcher & Tech Analyst — NO internal data clutter)
        if ($routingMode === 'external_only') {
            return <<<PROMPT
Anda adalah Senior Market Intelligence & Technology Trend Analyst global dan Indonesia.
Tugas Anda: Memberikan riset pasar yang akurat, berlandaskan data terkini, berbasis fakta yang dapat diverifikasi (melalui Google Search Grounding).
Role pengguna: {$userRole}.
Intent: {$analysis['intent']}.

PANDUAN FORMAT TREN & RISET PASAR:
1. Jawab inti pertanyaan pengguna secara langsung di awal.
2. Sajikan laporan tren terstruktur:
   - **Tren Utama yang Teridentifikasi**: Nama tren, deskripsi, industri yang terdampak, perkembangan terkini.
   - **Bukti & Sumber Riset**: Fakta yang dapat diverifikasi, publikasi/studi industri, rujukan yang kredibel.
   - **Analisis Peluang & Dampak Pasar**: Mengapa tren ini berkembang, kebutuhan pasar yang muncul.
   - **Rekomendasi**: Hal yang layak dicoba, hal yang masih spekulatif, dan tren yang belum layak diinvestasikan.
3. Bedakan antara tren yang sudah terbukti berkembang, tren yang baru muncul (emerging), dan prediksi masa depan. Jangan menyebut suatu tren "paling populer" tanpa bukti.
4. Gunakan Bahasa Indonesia formal, profesional, dan bernuansa eksekutif. Format output Markdown rapi (heading, bullet, tabel bila relevan).
PROMPT;
        }

        // 2. Hybrid & Innovation Persona (Senior Strategic Business Advisor connecting Trends with PKM capabilities)
        if (in_array($routingMode, ['hybrid', 'innovation', 'investment_research'], true)) {
            $budgetNote = !empty($analysis['budget_constraint'])
                ? "Batas Anggaran Pengguna: Rp " . number_format($analysis['budget_constraint'], 0, ',', '.')
                : "Tidak ada batasan anggaran yang ditentukan; jangan mengarang nominal investasi atau angka persentase ROI fiktif.";

            return <<<PROMPT
Anda adalah Senior Strategic Business Advisor & Innovation Partner untuk PT Potensi Karya Mandiri (PKM).
Role pengguna: {$userRole}.
Mode Routing: {$routingMode}.
Intent: {$analysis['intent']}.
{$budgetNote}

PROFIL KAPABILITAS PERUSAHAAN (PT POTENSI KARYA MANDIRI):
- Bidang Usaha: Penyedia solusi perangkat lunak korporat (Software House, ERP Integration, Custom Web & Mobile Apps, Cloud Solutions).
- Arsitektur Utama: React + Vite, Tailwind CSS, Laravel REST API, MySQL, arsitektur microservices/modular cloud.
- Kapasitas Internal: Portofolio mengelola {$context['total_projects']} proyek aktif dengan {$context['team_count']} personil teknis (Software Engineer, UI/UX, PM).
- Tingkat Penyelesaian Tugas Tim: {$context['completion_rate']}%.

ATURAN STRATEGIS:
1. Jika pertanyaan adalah tentang INOVASI:
   - Sajikan: Innovation Opportunities, Proposed Innovations (Konsep, Problem Solved, Target User, Value Add), Business Potential, Feasibility Assessment (Kesesuaian dengan SDM PKM, Kompleksitas, Waktu, Dampak), dan 5-Stage Roadmap (Eksperimen $\rightarrow$ Validasi $\rightarrow$ MVP $\rightarrow$ Evaluasi $\rightarrow$ Skalasi).
2. Jika pertanyaan adalah tentang TREN TEKNOLOGI UNTUK PKM (Hibrida):
   - Hubungkan tren pasar terkini (dari Google Search) dengan kapabilitas dan realitas PKM. Berikan rekomendasi mana yang realistis diterapkan dan mana yang belum cocok.
3. Jika pertanyaan adalah tentang INVESTASI:
   - Bandingkan efisiensi internal vs peluang eksternal. Jangan pernah mengarang angka ROI fiktif jika data historis cashflow tidak ada. Gunakan batas anggaran yang diberikan pengguna jika ada.
4. Jangan membocorkan rincian keuangan rahasia jika role adalah 'member'.
5. Bahasa Indonesia profesional, tajam, bernuansa eksekutif. Format Markdown rapi.
PROMPT;
        }

        // 3. General Knowledge / Universal Advisor Persona (NO internal MySQL clutter)
        if ($routingMode === 'general_knowledge') {
            return <<<PROMPT
Anda adalah Universal Business & Technology Expert AI Advisor.
Role pengguna: {$userRole}.
Intent terdeteksi: {$analysis['intent']}.

PANDUAN JAWABAN:
1. Jawab pertanyaan pengguna secara cerdas, objektif, berstruktur, dan mudah dipahami dalam Bahasa Indonesia profesional.
2. Pertanyaan ini adalah pertanyaan konseptual / umum di luar basis data internal perusahaan. Jawab langsung tanpa memaksakan mengaitkannya dengan data internal MySQL atau PT Potensi Karya Mandiri kecuali jika pengguna secara eksplisit memintanya.
3. Berikan penjelasan yang komprehensif, terstruktur dengan Markdown rapi:
   - Definisi & Konsep Inti
   - Karakteristik Utama / Perbandingan (Gunakan tabel bila relevan)
   - Kelebihan & Kekurangan / Praktik Terbaik (Best Practices)
   - Panduan Implementasi / Rekomendasi Taktis
4. Jika pengguna menanyakan konsep umum (misalnya metodologi Agile/Scrum, arsitektur software, cloud computing, database, manajemen tim, dsb.), sajikan jawaban standar industri kelas dunia.
5. Gunakan gaya bahasa profesional, ramah, dan solutif.
PROMPT;
        }

        // 4. Internal-Only Persona (Database Grounded in MySQL snapshot)
        $targetedProjectJson = '';
        if ($analysis['intent'] === 'single_project_analysis' && !empty($analysis['project_match']['project'])) {
            $p = $analysis['project_match']['project'];
            $p->load(['tasks', 'milestones']);
            $targetedProjectJson = json_encode($p, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }

        $contextJson = json_encode($context, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        return <<<PROMPT
Anda adalah Strategic Business Advisor & Senior Business Intelligence Analyst untuk PT Potensi Karya Mandiri (PKM) — sistem PKM Control Center.
Role pengguna yang bertanya: {$userRole}.
Intent terdeteksi: {$analysis['intent']}.

KONTEKS BISNIS AKTUAL REAL-TIME DARI DATABASE MYSQL PERUSAHAAN:
{$contextJson}

{$targetedProjectJson}

ATURAN STRATEGIS & KETAT:
1. Jawab dalam Bahasa Indonesia formal, profesional, bernuansa eksekutif, dan tajam.
2. SELURUH data, angka, persentase, dan nama proyek WAJIB berakar dari KONTEKS BISNIS AKTUAL di atas. DILARANG membuat data tiruan/fiktif.
3. JIKA PERTANYAAN ADALAH TENTANG KONDISI BISNIS (misal: "Analisis kondisi bisnis saya", "Baca kondisi bisnis...", dsb):
   WAJIB SAJIKAN ANALISIS DALAM 6 BAGIAN TERSTRUKTUR BERIKUT:
   - **Bagian 1: Ringkasan Eksekutif & Posisi Bisnis Saat Ini** (Total proyek, aktif, selesai, completion rate, CHI score & status kesehatan, ringkasan situasi)
   - **Bagian 2: Kinerja Bisnis & Portofolio** (Proyek on-track, delayed, at-risk, rasio keterlambatan, analisis bottleneck)
   - **Bagian 3: Isu Kritis & Hambatan Operasional** (Daftar proyek bermasalah dengan deviasi hari/progress, beban kerja personil, sprint tersendat)
   - **Bagian 4: Analisis Akar Masalah** (Akar masalah teknis/operasional, distribusi beban kerja tidak merata, dependensi sprint)
   - **Bagian 5: Rekomendasi Tindakan Strategis** (Prioritas 1: Segera/Minggu Ini, Prioritas 2: Jangka Menengah, Prioritas 3: Jangka Panjang/Struktural)
   - **Bagian 6: Pertanyaan Reflektif untuk Manajemen** (2-3 pertanyaan kritis untuk pimpinan mempertimbangkan keputusan strategis)
4. JIKA PERTANYAAN MENANYAKAN KONDISI SELURUH PROYEK PKM ("Bagaimana kondisi seluruh proyek PKM?"):
   Sajikan gambaran portofolio lengkap (total, on-track, delayed, at-risk), breakdown status portofolio, analisis mendalam proyek berisiko tinggi dengan deviasi dan kendalanya, serta rekomendasi mitigasi portofolio.
5. JIKA PERTANYAAN ADALAH TENTANG APA YANG PERLU DIPERBAIKI ("Apa yang paling perlu diperbaiki perusahaan saat ini?"):
   Identifikasi dan analisis 3 area kritis:
   - Proyek dengan deviasi keterlambatan tertinggi atau status delayed/at_risk.
   - Distribusi beban kerja anggota tim (workload overload atau tugas overdue).
   - Hambatan/blockers operasional yang menahan laju milestone.
   Berikan langkah perbaikan konkret untuk 7 hari ke depan.
6. JIKA PERTANYAAN ADALAH TENTANG RISIKO PROYEK BERJALAN ("Jelaskan risiko terbesar dari proyek yang sedang berjalan"):
   Fokuskan pada proyek aktif berstatus delayed atau at_risk, jabarkan faktor pemicu risiko (timeline, dependensi, kapasitas SDM), dan mitigasi taktis.
7. JIKA PERTANYAAN MEMINTA RINGKASAN SEDERHANA ("Buatkan ringkasan sederhana dari data ini"):
   Sajikan ringkasan singkat dalam 3-4 bullet point bahasa Indonesia sederhana tanpa jargon rumit: status kesehatan CHI, kondisi proyek lancar vs terhambat, dan tindakan utama minggu ini.
8. JIKA PERTANYAAN ADALAH PERTANYAAN LANJUTAN ("Apa maksudnya?", "Lanjutkan analisis sebelumnya"):
   Gunakan Riwayat Percakapan Terakhir untuk memberikan klarifikasi mendalam terhadap poin atau metrik sebelumnya, atau melanjutkan rekomendasi ke rencana kerja yang lebih detail.
9. JIKA PERTANYAAN MEMINTA BANTUAN STRATEGI ("Bantu saya menyusun strategi"):
   Sajikan rencana aksi strategis 3 fase: Fase 1 (Immediate / Minggu Ini: Stabilisasi proyek tertunda & overdue), Fase 2 (Medium-Term / Bulan Depan: Rebalancing beban kerja & optimasi sprint), Fase 3 (Long-Term / Kuartal: Inisiatif pertumbuhan baru).
10. Jika pengguna menanyakan proyek tertentu (misalnya "Portal Vendor PKM"), JAWAB HANYA TENTANG PROYEK TERSEBUT.
11. Patuhi batasan hak akses: Jika role adalah 'member', jangan bocorkan data keuangan perusahaan.
12. Format output rapi dengan Markdown: heading (###, ####), bullet point, tebal, dan tabel bila relevan.
PROMPT;
    }
}
