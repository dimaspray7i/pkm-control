<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AiAnalystService;
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
        $prompt = $request->input('prompt') ?: $request->input('question');

        if (empty($prompt) || strlen(trim($prompt)) < 3) {
            return response()->json([
                'success' => false,
                'message' => 'Pertanyaan atau prompt analisis wajib diisi minimal 3 karakter.',
            ], 422);
        }

        $result = $this->aiService->ask($prompt, $request->input('category', 'general'));
        
        // Add answer alias and recommendations for frontend compatibility
        $result['answer'] = $result['reply'] ?? '';
        $result['timestamp'] = now()->format('H:i, d M Y');

        return response()->json($result);
    }

    /**
     * Get system context snapshot for AI Analyst overview.
     */
    public function context()
    {
        $context = $this->aiService->getSystemContext();
        $apiKey = env('GEMINI_API_KEY') ?: env('AI_API_KEY') ?: env('OPENAI_API_KEY');
        $model = env('AI_MODEL', env('OPENAI_API_KEY') ? 'gpt-4o-mini' : 'gemini-1.5-flash');

        return response()->json([
            'success' => true,
            'mode' => $apiKey ? "LLM Eksternal ({$model})" : "Rule-Based Engine (Database Real-Time)",
            'is_llm_active' => !empty($apiKey),
            'context' => $context,
        ]);
    }
}
