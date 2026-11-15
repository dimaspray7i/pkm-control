<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExecutiveAiConversation;
use App\Services\ExecutiveBusinessContextService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class LeadershipAIController extends Controller
{
    protected ExecutiveBusinessContextService $aiService;

    public function __construct(ExecutiveBusinessContextService $aiService)
    {
        $this->aiService = $aiService;
    }

    /**
     * Authorize executive roles (admin and pimpinan only).
     */
    protected function authorizeExecutive(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'pimpinan'], true)) {
            abort(403, 'Akses terbatas untuk Pimpinan dan Super Admin.');
        }
        return $user;
    }

    /**
     * GET /api/leadership/ai/context
     * Retrieve executive business context snapshot and engine status.
     */
    public function context(Request $request)
    {
        $this->authorizeExecutive($request);
        $period = $request->get('period', 'all_time');

        $context = $this->aiService->buildExecutiveContext($period);
        $apiKey = env('GEMINI_API_KEY') ?: env('AI_API_KEY');
        $model = env('AI_MODEL', 'gemini-3.8-flash');
        $isConfigured = !empty($apiKey);

        return response()->json([
            'success' => true,
            'provider' => 'Google Gemini API',
            'model' => $model,
            'is_configured' => $isConfigured,
            'mode' => $isConfigured ? "Google Gemini LLM ({$model})" : "Deterministic Rule-Based Engine (Database Real-Time)",
            'context' => $context,
        ]);
    }

    /**
     * GET /api/leadership/ai/insights
     * Retrieve precomputed executive priority insights.
     */
    public function insights(Request $request)
    {
        $this->authorizeExecutive($request);
        $period = $request->get('period', 'all_time');

        $insights = $this->aiService->getExecutiveInsights($period);

        return response()->json([
            'success' => true,
            'total' => count($insights),
            'insights' => $insights,
        ]);
    }

    /**
     * POST /api/leadership/ai/chat
     * Executive Strategic Advisor Chat with Gemini / Rule-Based Fallback.
     */
    public function chat(Request $request)
    {
        $user = $this->authorizeExecutive($request);

        $validated = $request->validate([
            'prompt' => ['required', 'string', 'min:2', 'max:1000'],
            'period' => ['nullable', 'string', 'max:30'],
            'conversation_id' => ['nullable', 'integer'],
            'history' => ['nullable', 'array', 'max:20'],
        ], [
            'prompt.required' => 'Pertanyaan atau prompt analisis wajib diisi.',
            'prompt.min' => 'Pertanyaan minimal 2 karakter.',
            'prompt.max' => 'Pertanyaan maksimal 1000 karakter.',
        ]);

        $prompt = trim($validated['prompt']);
        $period = $validated['period'] ?? 'all_time';
        $history = $validated['history'] ?? [];
        $conversationId = $validated['conversation_id'] ?? null;

        $conversation = null;
        if ($conversationId) {
            $conversation = ExecutiveAiConversation::where('id', $conversationId)
                ->where('user_id', $user->id)
                ->first();
            if ($conversation && empty($history) && is_array($conversation->messages)) {
                $history = $conversation->messages;
            }
        }

        // Process through Executive Advisor Service
        $result = $this->aiService->askExecutiveAdvisor($prompt, $history, $period, $user);

        // Record into conversation if requested or exists
        if ($conversation) {
            $currentMessages = is_array($conversation->messages) ? $conversation->messages : [];
            $currentMessages[] = [
                'role' => 'user',
                'content' => $prompt,
                'timestamp' => Carbon::now()->toIso8601String(),
            ];
            $currentMessages[] = [
                'role' => 'assistant',
                'content' => $result['reply'] ?? '',
                'mode' => $result['mode'] ?? 'AI',
                'data_sources' => $result['data_sources'] ?? [],
                'timestamp' => Carbon::now()->toIso8601String(),
            ];

            // Auto-update title if default
            if ($conversation->title === 'Analisis Eksekutif Baru' || empty($conversation->title)) {
                $conversation->title = substr($prompt, 0, 40) . (strlen($prompt) > 40 ? '...' : '');
            }

            $conversation->messages = $currentMessages;
            $conversation->period = $period;
            $conversation->save();

            $result['conversation_id'] = $conversation->id;
            $result['conversation_title'] = $conversation->title;
        }

        return response()->json($result);
    }

    /**
     * POST /api/leadership/ai/analyze-project/{id}
     * Deep-Dive Root Cause Analysis for a specific project.
     */
    public function analyzeProject(Request $request, $id)
    {
        $this->authorizeExecutive($request);

        try {
            $rca = $this->aiService->analyzeProjectRootCause((int)$id);
            return response()->json([
                'success' => true,
                'rca' => $rca,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 404);
        }
    }

    /**
     * GET /api/leadership/ai/conversations
     * List saved conversations belonging to the authenticated user.
     */
    public function conversationsIndex(Request $request)
    {
        $user = $this->authorizeExecutive($request);

        $conversations = ExecutiveAiConversation::where('user_id', $user->id)
            ->orderBy('updated_at', 'desc')
            ->select('id', 'user_id', 'title', 'period', 'created_at', 'updated_at')
            ->get();

        return response()->json([
            'success' => true,
            'conversations' => $conversations,
        ]);
    }

    /**
     * POST /api/leadership/ai/conversations
     * Create a new conversation session for the user.
     */
    public function conversationsStore(Request $request)
    {
        $user = $this->authorizeExecutive($request);

        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:100'],
            'period' => ['nullable', 'string', 'max:30'],
        ]);

        $conversation = ExecutiveAiConversation::create([
            'user_id' => $user->id,
            'title' => $validated['title'] ?? 'Analisis Eksekutif Baru',
            'period' => $validated['period'] ?? 'all_time',
            'messages' => [],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Sesi percakapan eksekutif baru berhasil dibuat.',
            'conversation' => $conversation,
        ], 201);
    }

    /**
     * GET /api/leadership/ai/conversations/{id}
     * Get single conversation with full message log.
     */
    public function conversationsShow(Request $request, $id)
    {
        $user = $this->authorizeExecutive($request);

        $conversation = ExecutiveAiConversation::find($id);

        if (!$conversation) {
            return response()->json(['message' => 'Percakapan tidak ditemukan.'], 404);
        }

        // Strict Ownership Enforcement: Prevent cross-user data leakage
        if ($conversation->user_id !== $user->id) {
            return response()->json(['message' => 'Anda tidak memiliki hak akses ke percakapan ini.'], 403);
        }

        return response()->json([
            'success' => true,
            'conversation' => $conversation,
        ]);
    }

    /**
     * DELETE /api/leadership/ai/conversations/{id}
     * Delete user's conversation session.
     */
    public function conversationsDestroy(Request $request, $id)
    {
        $user = $this->authorizeExecutive($request);

        $conversation = ExecutiveAiConversation::find($id);

        if (!$conversation) {
            return response()->json(['message' => 'Percakapan tidak ditemukan.'], 404);
        }

        // Strict Ownership Enforcement
        if ($conversation->user_id !== $user->id) {
            return response()->json(['message' => 'Anda tidak memiliki hak akses untuk menghapus percakapan ini.'], 403);
        }

        $conversation->delete();

        return response()->json([
            'success' => true,
            'message' => 'Sesi percakapan eksekutif berhasil dihapus.',
        ]);
    }
}
