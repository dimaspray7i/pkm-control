import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  Sparkles, Send, Loader2, TrendingUp, AlertTriangle, CheckCircle2,
  RotateCcw, Folder, ClipboardList, Clock, Brain, Cpu, MessageSquarePlus,
  Trash2, StopCircle, RefreshCw, AlertCircle, ArrowUpRight, ShieldAlert,
  Users, BarChart3, ChevronRight, CheckSquare
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import MarkdownRenderer from '../components/ui/MarkdownRenderer'

const QUICK_PROMPTS = [
  'Coba cek proyek yang lagi bermasalah.',
  'Bagaimana progres sprint dan milestone saat ini?',
  'Apa yang harus dikerjakan tim hari ini?',
  'Siapa anggota tim yang punya beban kerja paling banyak?',
  'Menurut kamu kondisi bisnis kita sekarang gimana?',
  'Ada tugas yang sudah telat?',
]

export default function AIAnalyst() {
  const { user } = useAuth()
  const location = useLocation()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [engineInfo, setEngineInfo] = useState({ mode: 'Memeriksa Engine...', is_llm_active: false })
  const [contextData, setContextData] = useState(null)
  const [confirmNewChat, setConfirmNewChat] = useState(false)
  const [lastFailedPrompt, setLastFailedPrompt] = useState(null)
  
  // Abort controller reference for cancelling generation
  const abortControllerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  // Initialize conversation history
  const [history, setHistory] = useState(() => {
    // Check if coming from Global AI Assistant or Reports
    if (location.state?.fromGlobal && location.state?.history?.length > 0) {
      return location.state.history
    }
    return [
      {
        id: 'initial',
        type: 'ai',
        answer: "Halo! Saya AI Business Analyst PKM. Saya terhubung langsung ke basis data operasional real-time PT Potensi Karya Mandiri.\n\nAnda dapat menanyakan hal-hal terkait portofolio proyek, prioritas tugas, beban kerja tim, atau meminta rekomendasi mitigasi risiko dengan bahasa sehari-hari.",
        mode: 'Rule-Based Engine (Database Real-Time)',
        recommendations: [
          'Tanyakan proyek yang bermasalah atau mengalami deviasi jadwal',
          'Minta rekomendasi prioritas tugas untuk tim hari ini',
          'Analisis beban kerja dan kapasitas personil internal'
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]
  })

  // Fetch engine context & metrics
  const fetchContext = async () => {
    try {
      const res = await api.get('/ai/context')
      if (res.data) {
        setEngineInfo({
          mode: res.data.mode || 'Rule-Based Engine (Database Real-Time)',
          is_llm_active: res.data.is_llm_active || false,
        })
        setContextData(res.data.context)
      }
    } catch {}
  }

  useEffect(() => {
    fetchContext()
  }, [])

  // Check if incoming location state requested an immediate prompt (e.g. from Reports "Jelaskan dengan AI")
  useEffect(() => {
    if (location.state?.initialPrompt) {
      handleSend(location.state.initialPrompt)
    }
  }, [location.state])

  // Scroll smoothly to bottom on message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

  // Send message handler with AbortController
  const handleSend = async (customPrompt) => {
    const text = (customPrompt || input).trim()
    if (!text || loading) return

    setLastFailedPrompt(null)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const now = new Date()
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    // Add user message
    const userMsg = {
      id: Date.now(),
      type: 'user',
      text,
      timestamp: timeStr
    }
    setHistory(prev => [...prev, userMsg])
    setLoading(true)

    // Prepare abort controller
    abortControllerRef.current = new AbortController()

    try {
      // Build session context
      const chatContext = history.slice(-6).map(h => ({
        user: h.type === 'user' ? h.text : undefined,
        reply: h.type === 'ai' ? (h.answer || h.reply) : undefined,
      }))

      const res = await api.post('/ai/ask', {
        prompt: text,
        history: chatContext,
        page_context: 'ai_analyst'
      }, {
        signal: abortControllerRef.current.signal
      })

      const aiMsg = {
        id: Date.now() + 1,
        type: 'ai',
        answer: res.data.reply || res.data.answer,
        summary: res.data.summary,
        responseType: res.data.type || 'general_inquiry',
        findings: res.data.findings || [],
        recommendations: res.data.recommendations || [],
        dataPoints: res.data.data_points || [],
        mode: res.data.mode || engineInfo.mode,
        timestamp: res.data.timestamp || timeStr,
      }
      setHistory(prev => [...prev, aiMsg])
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        setHistory(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            type: 'ai',
            answer: 'Generasi jawaban dihentikan oleh pengguna.',
            isSystemNote: true,
            timestamp: timeStr
          }
        ])
      } else {
        setLastFailedPrompt(text)
        setHistory(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            type: 'ai',
            isError: true,
            answer: 'Maaf, gagal memproses permintaan ke AI PKM. Silakan periksa koneksi atau klik tombol Coba Lagi.',
            timestamp: timeStr
          }
        ])
      }
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  // Cancel / Stop generation
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  // Retry failed prompt
  const handleRetry = () => {
    if (lastFailedPrompt) {
      handleSend(lastFailedPrompt)
    }
  }

  // Clear chat / New session
  const handleResetChat = () => {
    setHistory([
      {
        id: 'initial_' + Date.now(),
        type: 'ai',
        answer: "Sesi percakapan baru dimulai. Silakan ajukan pertanyaan bisnis atau analisis operasional yang Anda butuhkan.",
        mode: engineInfo.mode,
        recommendations: [
          'Tanyakan proyek yang bermasalah',
          'Minta rekomendasi prioritas tugas hari ini',
          'Cek beban kerja tim'
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ])
    setConfirmNewChat(false)
    setLastFailedPrompt(null)
  }

  // Handle textarea keypress (Enter to submit, Shift+Enter for newline)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize textarea
  const handleTextareaChange = (e) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <PageHeader
        title="AI BUSINESS ANALYST"
        subtitle="Analisis bisnis cerdas berbasis data proyek real-time PT Potensi Karya Mandiri."
        tag="INTELLIGENCE ENGINE"
        badge="AI POWERED"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmNewChat(true)}
              className="px-3 py-1.5 bg-white hover:bg-[#FAF7F2] border border-[#171717] rounded-lg text-xs font-black uppercase text-[#171717] flex items-center gap-1.5 shadow-[2px_2px_0px_#171717] transition cursor-pointer"
            >
              <MessageSquarePlus size={14} className="text-[#FF2F92]" />
              <span>Percakapan Baru</span>
            </button>
            <div className="bg-white px-3 py-1.5 border border-[#171717] rounded-lg flex items-center gap-2 shadow-[2px_2px_0px_#171717]">
              <Cpu size={15} className="text-[#FF2F92]" />
              <span className="font-black text-xs uppercase text-[#171717]">{engineInfo.mode}</span>
            </div>
          </div>
        }
      />

      {/* Confirmation Modal for New Chat */}
      {confirmNewChat && (
        <div className="fixed inset-0 bg-[#171717]/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#F5F1E9] border-2 border-[#171717] rounded-xl p-5 max-w-sm w-full shadow-[6px_6px_0px_#171717] space-y-4">
            <div className="flex items-center gap-2 text-[#171717]">
              <AlertCircle size={20} className="text-[#FF2F92]" />
              <h3 className="font-display text-base uppercase">Mulai Percakapan Baru?</h3>
            </div>
            <p className="text-xs text-[#171717]/80 font-medium">
              Riwayat percakapan sesi saat ini akan dibersihkan dan AI akan memulai analisis dari awal.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#171717]/20">
              <button
                onClick={() => setConfirmNewChat(false)}
                className="px-3 py-1.5 bg-white border border-[#171717] rounded font-bold text-xs uppercase text-[#171717] shadow-[2px_2px_0px_#171717] cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleResetChat}
                className="px-3 py-1.5 bg-[#FF2F92] text-white border border-[#171717] rounded font-bold text-xs uppercase shadow-[2px_2px_0px_#171717] cursor-pointer"
              >
                Ya, Bersihkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Prompts Bar */}
      <div className="bg-white p-3 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[#171717]/60 tracking-wider mb-2">
          <Sparkles size={12} className="text-[#FF2F92]" />
          <span>REKOMENDASI PERTANYAAN BISNIS:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((promptText, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(promptText)}
              disabled={loading}
              className="text-left px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#FFD83D]/40 active:scale-98 border border-[#171717] rounded-md text-xs font-bold text-[#171717] transition shadow-[1px_1px_0px_#171717] cursor-pointer disabled:opacity-50"
            >
              {promptText}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Chat Thread (8 cols) + Real-time Business Context (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Chat Feed Column */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div className="bg-white border-2 border-[#171717] rounded-xl p-4 sm:p-5 min-h-[480px] max-h-[640px] overflow-y-auto space-y-4 shadow-[4px_4px_0px_#171717]">
            {history.map((msg, idx) => {
              // User message bubble
              if (msg.type === 'user') {
                return (
                  <div key={msg.id || idx} className="flex justify-end">
                    <div className="max-w-[85%] space-y-1">
                      <div className="p-3.5 bg-[#171717] text-white rounded-xl font-semibold text-xs leading-relaxed shadow-[3px_3px_0px_#FF2F92]">
                        {msg.text}
                      </div>
                      <p className="text-[9.5px] font-bold text-[#171717]/50 text-right pr-1">
                        {msg.timestamp}
                      </p>
                    </div>
                  </div>
                )
              }

              // AI message bubble with Structured Response Rendering
              return (
                <div key={msg.id || idx} className="space-y-2 max-w-[95%]">
                  <div className={`p-4 rounded-xl border-2 border-[#171717] shadow-[3px_3px_0px_#171717] ${
                    msg.isError
                      ? 'bg-[#FFD83D]/40'
                      : msg.isSystemNote
                        ? 'bg-[#FAF7F2]'
                        : 'bg-[#F2EDFD]'
                  }`}>
                    {/* Message Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#171717]/15 pb-2 mb-3">
                      <div className="flex items-center gap-1.5 text-[#FF2F92] font-black text-[11px] uppercase tracking-wide">
                        <Sparkles size={14} />
                        <span>AI Business Analyst PKM</span>
                        {msg.responseType && (
                          <span className="ml-2 text-[9px] px-2 py-0.5 bg-[#171717] text-white rounded uppercase font-black">
                            {msg.responseType.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[9.5px] text-[#171717]/60 font-semibold">
                        <span>{msg.mode || engineInfo.mode}</span>
                        {msg.timestamp && <span>• {msg.timestamp}</span>}
                      </div>
                    </div>

                    {/* Summary Highlight Card if present */}
                    {msg.summary && (
                      <div className="p-2.5 bg-white border border-[#171717] rounded-lg mb-3 shadow-[2px_2px_0px_#171717]">
                        <p className="text-[10px] font-black uppercase text-[#FF2F92] mb-0.5">Ringkasan Kondisi:</p>
                        <p className="text-xs font-bold text-[#171717]">{msg.summary}</p>
                      </div>
                    )}

                    {/* Main Content (Rendered Markdown) */}
                    <MarkdownRenderer content={msg.answer} />

                    {/* Structured Findings */}
                    {msg.findings && msg.findings.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-[#171717]/15 space-y-1.5">
                        <p className="text-[10px] font-black uppercase tracking-wider text-[#171717]/70">
                          Temuan & Poin Evaluasi Kunci:
                        </p>
                        <div className="space-y-1">
                          {msg.findings.map((f, fi) => (
                            <div key={fi} className="text-xs text-[#171717] flex items-start gap-1.5 bg-white/70 p-2 rounded border border-[#171717]/20">
                              <span className="text-[#FF2F92] font-black shrink-0 mt-0.5">•</span>
                              <span className="font-semibold">{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actionable Recommendations Checklist */}
                    {msg.recommendations && msg.recommendations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[#171717]/15 space-y-1.5">
                        <p className="text-[10px] font-black uppercase tracking-wider text-[#10B981] flex items-center gap-1">
                          <CheckSquare size={12} /> Rekomendasi Tindakan Strategis:
                        </p>
                        <div className="space-y-1">
                          {msg.recommendations.map((r, ri) => (
                            <div key={ri} className="text-xs text-[#171717] flex items-start gap-1.5 bg-[#FAF7F2] p-2 rounded border border-[#171717]/20 font-medium">
                              <span className="text-[#10B981] font-black shrink-0">✓</span>
                              <span>{r}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Retry Button on Error */}
                    {msg.isError && (
                      <div className="mt-3">
                        <button
                          onClick={handleRetry}
                          className="px-3 py-1 bg-[#171717] text-white rounded text-xs font-bold uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_#FF2F92] cursor-pointer"
                        >
                          <RefreshCw size={13} /> Coba Lagi
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Thinking / Loading indicator */}
            {loading && (
              <div className="flex items-center gap-2 p-3 bg-white border-2 border-[#171717] rounded-xl max-w-xs shadow-[3px_3px_0px_#171717]">
                <Loader2 size={16} className="animate-spin text-[#FF2F92]" />
                <div className="space-y-0.5">
                  <p className="text-xs font-black uppercase text-[#171717]">AI Sedang Berpikir...</p>
                  <p className="text-[10px] text-[#171717]/60 font-semibold">Mengaudit data operasional database PKM</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Controls */}
          <div className="bg-white border-2 border-[#171717] rounded-xl p-3 shadow-[4px_4px_0px_#171717]">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ketik pertanyaan bisnis (misal: 'Cek proyek yang bermasalah', 'Ada tugas telat?')..."
                  rows={2}
                  disabled={loading}
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#171717] rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF2F92] resize-none disabled:opacity-50"
                />
                <div className="text-[9.5px] text-[#171717]/50 font-bold px-1 mt-0.5 flex items-center justify-between">
                  <span>Tekan <kbd className="px-1 py-0.5 bg-white border border-[#171717]/30 rounded">Enter</kbd> untuk kirim, <kbd className="px-1 py-0.5 bg-white border border-[#171717]/30 rounded">Shift + Enter</kbd> baris baru</span>
                </div>
              </div>

              {loading ? (
                <button
                  onClick={handleStop}
                  className="px-4 py-2.5 bg-[#EF4444] hover:bg-[#DC2626] text-white border border-[#171717] rounded-lg font-black text-xs uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_#171717] transition cursor-pointer"
                >
                  <StopCircle size={15} />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  className="px-4 py-2.5 bg-[#FF2F92] hover:bg-[#FF439D] text-white border border-[#171717] rounded-lg font-black text-xs uppercase flex items-center gap-1.5 shadow-[3px_3px_0px_#171717] transition cursor-pointer disabled:opacity-50"
                >
                  <Send size={15} />
                  <span>Kirim</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live Business Context Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Quick Metrics Card */}
          <div className="bg-white border-2 border-[#171717] rounded-xl p-4 shadow-[4px_4px_0px_#171717] space-y-3">
            <div className="flex items-center gap-2 border-b border-[#171717]/20 pb-2">
              <BarChart3 size={16} className="text-[#FF2F92]" />
              <h3 className="font-display text-xs uppercase text-[#171717]">Snapshot Data PKM</h3>
            </div>

            {contextData ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-[#F5F1E9] border border-[#171717] rounded-lg">
                    <p className="text-[9px] font-black uppercase text-[#171717]/60">Proyek Aktif</p>
                    <p className="font-display text-xl text-[#171717] mt-0.5">{contextData.total_projects}</p>
                  </div>
                  <div className="p-2 bg-[#FFD83D]/30 border border-[#171717] rounded-lg">
                    <p className="text-[9px] font-black uppercase text-[#171717]/60">Penyelesaian</p>
                    <p className="font-display text-xl text-[#171717] mt-0.5">{contextData.completion_rate}%</p>
                  </div>
                </div>

                <div className="p-2 bg-[#FAF7F2] border border-[#171717] rounded-lg flex items-center justify-between text-xs font-bold">
                  <span className="text-[#171717]/70">Sprint Berjalan</span>
                  <span className="font-display text-sm text-[#3B82F6]">
                    {contextData.in_progress_sprints ?? 0} dari {contextData.total_sprints ?? 0} Sprint
                  </span>
                </div>

                <div className="p-2.5 bg-[#FF2F92]/10 border border-[#171717] rounded-lg space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-[#171717]">
                    <span className="flex items-center gap-1 text-[#EF4444]">
                      <AlertTriangle size={13} /> Berisiko / Delay
                    </span>
                    <span className="font-display text-sm">{contextData.at_risk_count + contextData.delayed_count} Proyek</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold text-[#171717]">
                    <span className="text-[#171717]/70">Tugas Overdue</span>
                    <span className="font-display text-sm text-[#EF4444]">{contextData.overdue_tasks_count} Tugas</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-[#171717]/60 font-semibold">
                Memuat data konteks database...
              </div>
            )}
          </div>

          {/* At-Risk Projects Quick Panel */}
          <div className="bg-white border-2 border-[#171717] rounded-xl p-4 shadow-[4px_4px_0px_#171717] space-y-3">
            <div className="flex items-center justify-between border-b border-[#171717]/20 pb-2">
              <div className="flex items-center gap-1.5">
                <ShieldAlert size={15} className="text-[#EF4444]" />
                <h3 className="font-display text-xs uppercase text-[#171717]">Proyek Perlu Atensi</h3>
              </div>
            </div>

            {contextData && (contextData.at_risk_list?.length > 0 || contextData.delayed_list?.length > 0) ? (
              <div className="space-y-2">
                {[...contextData.at_risk_list, ...contextData.delayed_list].slice(0, 4).map((p, pIdx) => (
                  <div
                    key={pIdx}
                    onClick={() => handleSend(`Jelaskan kenapa proyek ${p.name} bermasalah dan apa rekomendasinya?`)}
                    className="p-2 bg-[#FAF7F2] hover:bg-[#FFD83D]/30 border border-[#171717] rounded-lg text-xs transition cursor-pointer group"
                  >
                    <div className="flex items-center justify-between font-bold text-[#171717]">
                      <span className="truncate max-w-[170px]">{p.name}</span>
                      <span className="text-[9.5px] px-1.5 py-0.5 bg-[#EF4444] text-white rounded font-black uppercase">
                        {p.risk_level || 'At Risk'}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#171717]/60 mt-1">
                      Progress: {p.progress}% • Klien: {p.client}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#171717]/60 font-medium">Tidak ada proyek berisiko tinggi saat ini.</p>
            )}
          </div>

          {/* AI Engine Transparency Note */}
          <div className="p-3 bg-[#B8A0F0]/20 border border-[#171717] rounded-lg space-y-1 text-xs">
            <p className="font-bold text-[#171717] uppercase text-[10px] flex items-center gap-1">
              <Brain size={12} className="text-[#FF2F92]" /> Transparansi Engine AI PKM
            </p>
            <p className="text-[11px] text-[#171717]/80 font-medium leading-relaxed">
              Analisis ini dihitung secara objektif menggunakan aturan analitik bisnis (*Rule-Based Engine*) yang terhubung langsung ke basis data MySQL operasional real-time. Tidak ada angka atau proyek yang direkayasa secara fiktif.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
