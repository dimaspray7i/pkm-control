<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AiAnalystService;
use Carbon\Carbon;
use Illuminate\Http\Request;

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
                'message' => 'Pertanyaan atau prompt analisis wajib diisi minimal 2 karakter.',
            ], 422);
        }

        $category = $validated['category'] ?? 'general';
        $history = $validated['history'] ?? [];
        $pageContext = $validated['page_context'] ?? null;
        $user = $request->user();

        $result = $this->aiService->ask(
            $prompt,
            $category,
            is_array($history) ? $history : [],
            $pageContext,
            $user
        );
        
        // Backward-compatible fields
        $result['answer'] = $result['reply'] ?? '';
        $result['timestamp'] = $result['timestamp'] ?? Carbon::now()->format('H:i, d M Y');

        return response()->json($result);
    }

    /**
     * Get system context snapshot for AI Analyst overview.
     */
    public function context()
    {
        $context = $this->aiService->getSystemContext();
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
            'engine_status' => $hasKey ? 'Gemini API Terkonfigurasi' : 'Rule-Based Engine Aktif',
            'context' => $context,
        ]);
    }
}
