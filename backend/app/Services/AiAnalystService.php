<?php

namespace App\Services;

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiAnalystService
{
    /**
     * Gather live metrics from database to serve as business context.
     */
    public function getSystemContext(): array
    {
        $projects = Project::where('is_active', true)->get();
        $totalProjects = $projects->count();
        $completedProjects = $projects->where('status', 'completed')->count();
        $atRiskProjects = $projects->where('status', 'at_risk');
        $delayedProjects = $projects->where('status', 'delayed');
        $onTrackProjects = $projects->where('status', 'on_track')->count();

        $tasks = Task::all();
        $totalTasks = $tasks->count();
        $completedTasks = $tasks->where('is_completed', true)->count();
        $pendingTasks = $totalTasks - $completedTasks;
        $overdueTasks = $tasks->filter(function ($t) {
            return !$t->is_completed && $t->deadline && $t->deadline->lt(now()->startOfDay());
        });

        $users = User::where('is_active', true)->get();

        return [
            'total_projects' => $totalProjects,
            'completed_projects' => $completedProjects,
            'on_track_projects' => $onTrackProjects,
            'at_risk_count' => $atRiskProjects->count(),
            'delayed_count' => $delayedProjects->count(),
            'at_risk_list' => $atRiskProjects->map(fn($p) => "{$p->name} ({$p->code}) - Progress: {$p->progress}%, Klien: {$p->client}, Risiko: {$p->risk_level} ({$p->risk_factor})")->values()->all(),
            'delayed_list' => $delayedProjects->map(fn($p) => "{$p->name} ({$p->code}) - Progress: {$p->progress}%, Klien: {$p->client}, Risiko: {$p->risk_level} ({$p->risk_factor})")->values()->all(),
            'total_tasks' => $totalTasks,
            'completed_tasks' => $completedTasks,
            'pending_tasks' => $pendingTasks,
            'overdue_tasks_count' => $overdueTasks->count(),
            'overdue_tasks_list' => $overdueTasks->take(5)->map(fn($t) => "{$t->title} (PIC: {$t->assignee_name}, Deadline: {$t->deadline->format('Y-m-d')})")->values()->all(),
            'team_count' => $users->count(),
            'completion_rate' => $totalTasks > 0 ? round(($completedTasks / $totalTasks) * 100, 1) : 0,
        ];
    }

    /**
     * Process query from user using LLM if configured, or rule-based engine.
     */
    public function ask(string $prompt, ?string $category = 'general'): array
    {
        $context = $this->getSystemContext();
        $apiKey = env('GEMINI_API_KEY') ?: env('AI_API_KEY') ?: env('OPENAI_API_KEY');
        $provider = env('AI_PROVIDER', 'gemini');

        if ($apiKey) {
            try {
                if ($provider === 'openai' || env('OPENAI_API_KEY')) {
                    return $this->callOpenAI($apiKey, $prompt, $context);
                } else {
                    return $this->callGemini($apiKey, $prompt, $context);
                }
            } catch (\Exception $e) {
                Log::error('AI Service Error: ' . $e->getMessage());
                // Fallback to rule-based on network/key error
                $ruleBased = $this->generateRuleBasedAnalysis($prompt, $context);
                $ruleBased['note'] = 'Koneksi ke LLM eksternal bermasalah (' . $e->getMessage() . '). Otomatis dialihkan ke mesin analisis database lokal.';
                return $ruleBased;
            }
        }

        return $this->generateRuleBasedAnalysis($prompt, $context);
    }

    protected function callGemini(string $apiKey, string $prompt, array $context): array
    {
        $systemPrompt = $this->buildSystemPrompt($context);
        $model = env('AI_MODEL', 'gemini-1.5-flash');

        $response = Http::timeout(30)->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}", [
            'contents' => [
                [
                    'role' => 'user',
                    'parts' => [
                        ['text' => "{$systemPrompt}\n\nUser Question: {$prompt}"]
                    ]
                ]
            ],
            'generationConfig' => [
                'temperature' => 0.4,
                'maxOutputTokens' => 1500,
            ]
        ]);

        if ($response->successful()) {
            $data = $response->json();
            $reply = $data['candidates'][0]['content']['parts'][0]['text'] ?? 'Tidak ada jawaban dari AI.';

            return [
                'success' => true,
                'reply' => $reply,
                'mode' => 'External LLM (' . $model . ')',
                'context' => $context,
            ];
        }

        throw new \Exception('Gemini API returned status ' . $response->status());
    }

    protected function callOpenAI(string $apiKey, string $prompt, array $context): array
    {
        $systemPrompt = $this->buildSystemPrompt($context);
        $model = env('AI_MODEL', 'gpt-4o-mini');

        $response = Http::withToken($apiKey)->timeout(30)->post('https://api.openai.com/v1/chat/completions', [
            'model' => $model,
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $prompt],
            ],
            'temperature' => 0.4,
            'max_tokens' => 1500,
        ]);

        if ($response->successful()) {
            $data = $response->json();
            $reply = $data['choices'][0]['message']['content'] ?? 'Tidak ada jawaban dari AI.';

            return [
                'success' => true,
                'reply' => $reply,
                'mode' => 'External LLM (' . $model . ')',
                'context' => $context,
            ];
        }

        throw new \Exception('OpenAI API returned status ' . $response->status());
    }

    protected function generateRuleBasedAnalysis(string $prompt, array $context): array
    {
        $lowPrompt = strtolower($prompt);
        $reply = "";

        if (str_contains($lowPrompt, 'risiko') || str_contains($lowPrompt, 'risk') || str_contains($lowPrompt, 'at_risk') || str_contains($lowPrompt, 'kendala')) {
            $reply = "### Analisis Risiko & Mitigasi Proyek PKM\n\n";
            $reply .= "Berdasarkan audit database terkini:\n";
            $reply .= "- Terdapat **{$context['at_risk_count']} proyek berstatus At Risk** dan **{$context['delayed_count']} proyek Delayed** dari total {$context['total_projects']} proyek aktif.\n\n";
            
            if (!empty($context['at_risk_list'])) {
                $reply .= "**Proyek Berisiko Tinggi/Sedang:**\n";
                foreach ($context['at_risk_list'] as $item) {
                    $reply .= "- {$item}\n";
                }
                $reply .= "\n";
            }

            if (!empty($context['delayed_list'])) {
                $reply .= "**Proyek Mengalami Keterlambatan (Delayed):**\n";
                foreach ($context['delayed_list'] as $item) {
                    $reply .= "- {$item}\n";
                }
                $reply .= "\n";
            }

            $reply .= "**Rekomendasi Tindakan Strategis:**\n";
            $reply .= "1. **Alokasi Ulang Resource:** Re-distribusikan beban kerja tim senior ke proyek yang mengalami blocker teknis.\n";
            $reply .= "2. **Review Scope Klien:** Jadwalkan pertemuan dengan stakeholder klien untuk mengunci ekspektasi milestone berikutnya.\n";
            $reply .= "3. **Follow-up Overdue Tasks:** Terdapat {$context['overdue_tasks_count']} tugas terlewat deadline yang memicu domino delay pada milestone proyek.";

        } elseif (str_contains($lowPrompt, 'tugas') || str_contains($lowPrompt, 'task') || str_contains($lowPrompt, 'overdue') || str_contains($lowPrompt, 'deadline')) {
            $reply = "### Ringkasan Kondisi Tugas & Deadline Tim\n\n";
            $reply .= "- **Total Tugas Terdaftar:** {$context['total_tasks']} tugas\n";
            $reply .= "- **Tugas Selesai:** {$context['completed_tasks']} (" . $context['completion_rate'] . "%)\n";
            $reply .= "- **Tugas Pending:** {$context['pending_tasks']} tugas\n";
            $reply .= "- **Tugas Terlambat (Overdue):** **{$context['overdue_tasks_count']} tugas**\n\n";

            if (!empty($context['overdue_tasks_list'])) {
                $reply .= "**Daftar 5 Tugas Overdue Teratas:**\n";
                foreach ($context['overdue_tasks_list'] as $t) {
                    $reply .= "- {$t}\n";
                }
                $reply .= "\n";
            }

            $reply .= "**Langkah Operasional yang Disarankan:**\n";
            $reply .= "Segera hubungi PIC penanggung jawab tugas overdue di atas untuk menentukan apakah kendala ada di approval, dependency modul lain, atau kapasitas tim.";

        } elseif (str_contains($lowPrompt, 'kinerja') || str_contains($lowPrompt, 'performa') || str_contains($lowPrompt, 'tim') || str_contains($lowPrompt, 'progress')) {
            $reply = "### Laporan Kinerja & Progres Keseluruhan PKM\n\n";
            $reply .= "- **Kesehatan Portfolio Proyek:** {$context['on_track_projects']} On Track, {$context['at_risk_count']} At Risk, {$context['delayed_count']} Delayed dari {$context['total_projects']} total proyek.\n";
            $reply .= "- **Tingkat Penyelesaian Tugas Operasional:** {$context['completion_rate']}%\n";
            $reply .= "- **Jumlah Personil Aktif:** {$context['team_count']} anggota tim terdaftar.\n\n";
            $reply .= "**Evaluasi Manajemen:**\n";
            $reply .= "Efisiensi operasional berada dalam kategori " . ($context['completion_rate'] > 70 ? "BAIK" : "PERLU PERHATIAN") . ". Diperlukan penegakan weekly sprint review agar deviasi progress tidak melebihi 10%.";

        } else {
            $reply = "### Analisis Strategis Bisnis PKM Control Center\n\n";
            $reply .= "Menganalisis pertanyaan: *\"{$prompt}\"*\n\n";
            $reply .= "**Status Operasional Saat Ini:**\n";
            $reply .= "- Portofolio: {$context['total_projects']} proyek aktif ({$context['on_track_projects']} on track, {$context['at_risk_count']} at risk, {$context['delayed_count']} delayed).\n";
            $reply .= "- Tugas Tim: {$context['completed_tasks']} dari {$context['total_tasks']} selesai ({$context['completion_rate']}%). Terdapat {$context['overdue_tasks_count']} tugas overdue.\n\n";
            $reply .= "**Kesimpulan & Arah Kebijakan:**\n";
            $reply .= "Prioritaskan penyelesaian blocker pada proyek berstatus high risk terlebih dahulu untuk menjaga SLA kepada klien PT Potensi Karya Mandiri. Manfaatkan fitur Sprint Tracker untuk memantau progress milestone mingguan secara presisi.";
        }

        return [
            'success' => true,
            'reply' => $reply,
            'mode' => 'Rule-Based Engine (Database Real-Time Context)',
            'context' => $context,
        ];
    }

    protected function buildSystemPrompt(array $context): string
    {
        $contextJson = json_encode($context, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        return <<<PROMPT
Anda adalah AI Business Analyst untuk sistem PKM Control Center — PT Potensi Karya Mandiri.
Anda memiliki akses ke snapshot database operasional real-time berikut:

{$contextJson}

Instruksi:
1. Berikan analisis bisnis yang tajam, profesional, berbasis data nyata di atas, dan berorientasi solusi manajemen proyek.
2. Selalu sebutkan fakta dan angka spesifik dari data konteks di atas (nama proyek, jumlah tugas, tingkat penyelesaian).
3. Format jawaban dengan markdown rapi menggunakan heading, bullet point, dan teks tebal untuk poin penting.
4. Gunakan Bahasa Indonesia formal dan lugas.
PROMPT;
    }
}
