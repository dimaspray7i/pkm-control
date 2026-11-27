<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AiAnalystService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AiAnalystController extends Controller
{
    protected AiAnalystService $aiService;

    public function __construct(AiAnalystService $aiService)
    {
        $this->aiService = $aiService;
    }

    /**
     * Ask a question or generate business analysis based on live DB context.
     */
    public function ask(Request $request)
    {
        $requestId = (string) Str::uuid();

        $validated = $request->validate([
            'prompt' => 'required_without:question|nullable|string|min:2|max:1000',
            'question' => 'nullable|string|min:2|max:1000',
            'category' => 'nullable|string|max:50',
            'history' => 'nullable|array|max:20',
            'page_context' => 'nullable|string|max:100',
        ]);

        $prompt = $validated['prompt'] ?? $validated['question'] ?? '';

        if (empty(trim($prompt)) || strlen(trim($prompt)) < 2) {
            return response()->json([
                'success' => false,
                'request_id' => $requestId,
                'message' => 'Pertanyaan atau prompt analisis wajib diisi minimal 2 karakter.',
            ], 422);
        }

        $category = $validated['category'] ?? 'general';
        $history = $validated['history'] ?? [];
        $pageContext = $validated['page_context'] ?? null;
        $user = $request->user();

        try {
            $result = $this->aiService->ask(
                $prompt,
                $category,
                is_array($history) ? $history : [],
                $pageContext,
                $user,
                $requestId
            );
            
            // Backward-compatible fields
            $result['request_id'] = $requestId;
            $result['answer'] = $result['reply'] ?? '';
            $result['timestamp'] = $result['timestamp'] ?? (Carbon::now('Asia/Jakarta')->format('H:i') . ' WIB');

            return response()->json($result);
        } catch (\Throwable $e) {
            Log::error("[AiAnalyst] Request {$requestId} failed: " . $e->getMessage(), [
                'request_id' => $requestId,
                'prompt_snippet' => substr($prompt, 0, 100),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'request_id' => $requestId,
                'message' => 'Maaf, terjadi kendala saat memproses analisis: ' . $e->getMessage(),
                'reply' => 'Maaf, terjadi kendala teknis pada engine analitik. Silakan coba beberapa saat lagi.',
                'answer' => 'Maaf, terjadi kendala teknis pada engine analitik. Silakan coba beberapa saat lagi.',
                'timestamp' => Carbon::now('Asia/Jakarta')->format('H:i') . ' WIB',
            ], 500);
        }
    }

    /**
     * Get system context snapshot for AI Analyst overview.
     */
    public function context(Request $request)
    {
        $context = $this->aiService->getSystemContext($request->user());
        $apiKey = env('GEMINI_API_KEY') ?: env('AI_API_KEY');
        $model = env('AI_MODEL', 'gemini-3.8-flash');
        $hasKey = !empty($apiKey);

        return response()->json([
            'success' => true,
            'provider' => 'Google Gemini API (Free Tier)',
            'model' => $model,
            'mode' => $hasKey ? "Google Gemini API ({$model})" : "Rule-Based Engine (Database Real-Time)",
            'is_llm_configured' => $hasKey,
            'is_llm_active' => $hasKey,
            'google_search_grounding_supported' => true,
            'supported_modes' => [
                'external_only',
                'internal_only',
                'hybrid',
                'innovation',
                'investment_research',
                'general_knowledge',
            ],
            'engine_status' => $hasKey ? 'Gemini API Terkonfigurasi' : 'Rule-Based Engine Aktif',
            'context' => $context,
        ]);
    }
}
