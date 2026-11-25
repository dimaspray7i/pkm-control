import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  Sparkles, Send, Loader2, TrendingUp, AlertTriangle, CheckCircle2,
  RotateCcw, Folder, ClipboardList, Clock, Brain, Cpu, MessageSquarePlus,
  Trash2, StopCircle, RefreshCw, AlertCircle, ArrowUpRight, ShieldAlert,
  Users, BarChart3, ChevronRight, CheckSquare, X, ArrowLeft, Globe,
  ExternalLink, Compass, Search, Lightbulb, Zap
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import MarkdownRenderer from '../components/ui/MarkdownRenderer'

const QUICK_PROMPTS = [
  'Apa tren bisnis & teknologi yang sedang berkembang saat ini?',
  'Inovasi apa yang sebaiknya diprioritaskan agar PKM lebih unggul?',
  'Teknologi AI apa yang layak diterapkan untuk meningkatkan efisiensi PKM?',
  'Apa peluang layanan digital baru yang bisa dimasuki PKM di 2027?',
  'Baca kondisi bisnis PKM sekarang dan harus ke mana melangkah?',
  'Harus invest ke mana agar perusahaan bertumbuh?',
  'Apa masalah terbesar PKM saat ini dan bagaimana solusinya?',
  'Bagaimana analisis kesehatan keuangan dan profitabilitas saat ini?',
  'Siapa anggota tim yang punya beban kerja paling banyak?',
  'Coba cek proyek yang lagi bermasalah.',
]

const getWibTimestamp = (date = new Date()) => {
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' WIB'
}

const getDomainBadgeLabel = (type) => {
  if (!type || type === 'general_inquiry' || type === 'general_knowledge' || type === 'general_consultation') {
    return null
  }
  const mapping = {
    business_overview: 'Analisis Bisnis',
    problem_diagnosis: 'Diagnosis Masalah',
    all_project_risks: 'Portofolio Proyek',
    single_project_analysis: 'Analisis Proyek',
    project_clarification_needed: 'Klarifikasi Proyek',
    project_not_found: 'Proyek Tidak Ditemukan',
    employee_workload: 'Beban Kerja Tim',
    task_management: 'Manajemen Tugas',
    financial_analysis: 'Analisis Keuangan',
    business_performance: 'Kinerja Bisnis (CHI)',
    growth_opportunities: 'Peluang Pertumbuhan',
    strategic_planning: 'Perencanaan Strategis',
    risk_analysis: 'Manajemen Risiko',
    operational_analysis: 'Operasional & Blocker',
    market_trends: 'Riset Tren Bisnis',
    technology_trends: 'Tren Teknologi',
    hybrid_intelligence: 'Analisis Hibrida',
    business_innovation: 'Inovasi Bisnis',
    investment_prioritization: 'Komparasi Investasi',
    data_comparison: 'Perbandingan Data',
    sprint_performance: 'Performa Sprint',
    forecast_scenario: 'Skenario Forecast',
  }
  return mapping[type] || type.replace(/_/g, ' ')
}

export default function AIAnalyst() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [engineInfo, setEngineInfo] = useState({ mode: 'Memeriksa Engine...', is_llm_active: false })
  const [contextData, setContextData] = useState(null)
  const [confirmNewChat, setConfirmNewChat] = useState(false)
  const [lastFailedPrompt, setLastFailedPrompt] = useState(null)

  const abortControllerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const chatContainerRef = useRef(null)

  const [history, setHistory] = useState(() => {
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

  useEffect(() => {
    if (location.state?.initialPrompt) {
      handleSend(location.state.initialPrompt)
    }
  }, [location.state])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [history, loading])

  const handleSend = async (customPrompt) => {
    const text = (customPrompt || input).trim()
    if (!text || loading) return

    setLastFailedPrompt(null)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const timeStr = getWibTimestamp()

    const userMsg = {
      id: Date.now(),
      type: 'user',
      text,
      timestamp: timeStr
    }
    setHistory(prev => [...prev, userMsg])
    setLoading(true)

    abortControllerRef.current = new AbortController()

    try {
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
        responseType: res.data.type || res.data.routing_mode || 'general_inquiry',
        findings: res.data.findings || [],
        recommendations: res.data.recommendations || [],
        dataPoints: res.data.data_points || [],
        mode: res.data.mode || engineInfo.mode,
        sourceType: res.data.source_type,
        routingMode: res.data.routing_mode,
        hasGrounding: res.data.has_grounding,
        sources: res.data.sources || [],
        searchQueries: res.data.search_queries || [],
        suggestedActions: res.data.suggested_actions || [],
        note: res.data.note,
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
            answer: 'Generasi jawaban dihentikan.',
            isSystemNote: true,
            timestamp: timeStr
          }
        ])
      } else {
        const status = err.response?.status
        let errorMsg = 'Maaf, terjadi gangguan saat memproses permintaan. Silakan coba lagi.'
        if (status === 429) {
          errorMsg = 'Permintaan terlalu banyak. Mohon tunggu beberapa saat sebelum mencoba lagi.'
        } else if (status >= 500) {
          errorMsg = 'Server sedang mengalami gangguan. Tim teknis telah diberitahu. Silakan coba beberapa menit lagi.'
        } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
          errorMsg = 'Koneksi ke server habis waktu. Periksa koneksi internet Anda dan coba lagi.'
        }
        setLastFailedPrompt(text)
        setHistory(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            type: 'ai',
            isError: true,
            answer: errorMsg,
            timestamp: timeStr
          }
        ])
      }
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const handleRetry = () => {
    if (lastFailedPrompt) {
      handleSend(lastFailedPrompt)
    }
  }

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
        timestamp: getWibTimestamp()
      }
    ])
    setConfirmNewChat(false)
    setLastFailedPrompt(null)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextareaChange = (e) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  const renderSourceBadge = (msg) => {
    if (msg.isError || msg.isSystemNote) return null

    if (msg.hasGrounding || msg.sourceType === 'external' || msg.sourceType === 'external_grounded') {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 bg-[#0EA5E9] text-white rounded-md uppercase font-black shadow-[1px_1px_0px_#171717]">
          <Globe size={10} /> Riset Eksternal (Google Search)
        </span>
      )
    }
    if (msg.sourceType === 'hybrid' || msg.sourceType === 'hybrid_grounded' || msg.routingMode === 'hybrid') {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 bg-[#8B5CF6] text-white rounded-md uppercase font-black shadow-[1px_1px_0px_#171717]">
          <Zap size={10} /> Analisis Hibrida
        </span>
      )
    }
    if (msg.sourceType === 'innovation' || msg.sourceType === 'innovation_grounded' || msg.routingMode === 'innovation') {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 bg-[#F59E0B] text-white rounded-md uppercase font-black shadow-[1px_1px_0px_#171717]">
          <Lightbulb size={10} /> Usulan Inovasi
        </span>
      )
    }
    if (msg.sourceType === 'investment' || msg.routingMode === 'investment_research') {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 bg-[#059669] text-white rounded-md uppercase font-black shadow-[1px_1px_0px_#171717]">
          <TrendingUp size={10} /> Riset Alokasi Modal
        </span>
      )
    }
    if (msg.sourceType === 'internal' || msg.sourceType === 'internal_database' || msg.routingMode === 'internal_only') {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 bg-[#10B981] text-white rounded-md uppercase font-black shadow-[1px_1px_0px_#171717]">
          <Cpu size={10} /> Basis Data MySQL Real-Time
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 bg-[#475569] text-white rounded-md uppercase font-black shadow-[1px_1px_0px_#171717]">
        <Brain size={10} /> Basis Pengetahuan AI
      </span>
    )
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Page Header */}
      <PageHeader
        title="ANALIS BISNIS AI"
        subtitle="Analisis bisnis cerdas berbasis data proyek real-time PT Potensi Karya Mandiri."
        tag="ANALITIK CERDAS PKM"
        badge="DIDUKUNG AI"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {location.state?.fromReports && (
              <button
                onClick={() => navigate('/reports')}
                className="px-3 py-1.5 bg-[#FFD83D] hover:bg-[#ffe26e] border border-[#171717] rounded-lg text-xs font-black uppercase text-[#171717] flex items-center gap-1.5 shadow-[2px_2px_0px_#171717] transition cursor-pointer"
                title="Kembali ke Halaman Laporan"
              >
                <ArrowLeft size={14} />
                <span>Kembali ke Laporan</span>
              </button>
            )}
            <button
              onClick={() => setConfirmNewChat(true)}
              className="px-3 py-1.5 bg-white hover:bg-[#FAF7F2] border border-[#171717] rounded-lg text-xs font-black uppercase text-[#171717] flex items-center gap-1.5 shadow-[2px_2px_0px_#171717] transition cursor-pointer"
            >
              <MessageSquarePlus size={14} className="text-[#FF2F92]" />
              <span className="hidden sm:inline">Percakapan Baru</span>
              <span className="sm:hidden">Baru</span>
            </button>
            <div className="bg-white px-3 py-1.5 border border-[#171717] rounded-lg flex items-center gap-2 shadow-[2px_2px_0px_#171717]">
              <Cpu size={14} className="text-[#FF2F92] shrink-0" />
              <span className="font-black text-[10px] sm:text-xs uppercase text-[#171717] truncate max-w-[140px] sm:max-w-none">{engineInfo.mode}</span>
            </div>
          </div>
        }
      />

      {/* Confirm New Chat Modal */}
      {confirmNewChat && (
        <div
          className="fixed inset-0 bg-[#171717]/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmNewChat(false) }}
        >
          <div className="bg-[#FAF7F2] border-2 border-[#171717] rounded-xl p-5 max-w-sm w-full shadow-[6px_6px_0px_#171717] space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-[#171717]">
                <AlertCircle size={20} className="text-[#FF2F92] shrink-0" />
                <h3 className="font-display text-sm uppercase font-black">Mulai Percakapan Baru?</h3>
              </div>
              <button
                onClick={() => setConfirmNewChat(false)}
                className="p-1 hover:bg-[#171717]/10 rounded transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-[#171717]/80 font-medium leading-relaxed">
              Riwayat percakapan sesi saat ini akan dibersihkan dan AI akan memulai analisis dari awal.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#171717]/20">
              <button
                onClick={() => setConfirmNewChat(false)}
                className="px-4 py-2 bg-white border border-[#171717] rounded-lg font-bold text-xs uppercase text-[#171717] shadow-[2px_2px_0px_#171717] cursor-pointer hover:bg-[#FAF7F2] transition min-h-[36px]"
              >
                Batal
              </button>
              <button
                onClick={handleResetChat}
                className="px-4 py-2 bg-[#FF2F92] text-white border border-[#171717] rounded-lg font-bold text-xs uppercase shadow-[2px_2px_0px_#171717] cursor-pointer hover:bg-[#FF439D] transition min-h-[36px]"
              >
                Ya, Bersihkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Prompts */}
      <div className="bg-white p-3 border border-[#171717] rounded-xl shadow-[3px_3px_0px_#171717]">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[#171717]/60 tracking-wider mb-2.5">
          <Sparkles size={12} className="text-[#FF2F92]" />
          <span>Rekomendasi Pertanyaan Bisnis</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {QUICK_PROMPTS.map((promptText, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(promptText)}
              disabled={loading}
              className="shrink-0 text-left px-3 py-2 bg-[#FAF7F2] hover:bg-[#FFD83D]/40 active:scale-95 border border-[#171717] rounded-lg text-xs font-bold text-[#171717] transition shadow-[1px_1px_0px_#171717] cursor-pointer disabled:opacity-50 min-h-[36px] whitespace-nowrap"
            >
              {promptText}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Chat Column */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          {/* Message Thread */}
          <div
            ref={chatContainerRef}
            className="bg-white border-2 border-[#171717] rounded-xl shadow-[4px_4px_0px_#171717] overflow-y-auto"
            style={{ height: '520px' }}
          >
            <div className="p-4 sm:p-5 space-y-5">
              {history.map((msg, idx) => {
                if (msg.type === 'user') {
                  return (
                    <div key={msg.id || idx} className="flex justify-end">
                      <div className="max-w-[80%] sm:max-w-[75%] space-y-1">
                        <div className="p-3.5 bg-[#171717] text-white rounded-2xl rounded-tr-sm font-semibold text-sm leading-relaxed shadow-[3px_3px_0px_#FF2F92]">
                          {msg.text}
                        </div>
                        <p className="text-[9.5px] font-bold text-[#171717]/50 text-right pr-1">
                          {msg.timestamp}
                        </p>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={msg.id || idx} className="flex justify-start">
                    <div className="max-w-[90%] sm:max-w-[85%] space-y-1.5">
                      {/* AI Bubble */}
                      <div className={`rounded-2xl rounded-tl-sm border-2 border-[#171717] shadow-[3px_3px_0px_#171717] overflow-hidden ${
                        msg.isError
                          ? 'bg-[#FFF8E6]'
                          : msg.isSystemNote
                            ? 'bg-[#FAF7F2]'
                            : 'bg-[#F2EDFD]'
                      }`}>
                        {/* Bubble Header */}
                        <div className={`flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[#171717]/15 ${
                          msg.isError ? 'bg-[#FFD83D]/30' : msg.isSystemNote ? 'bg-[#EAE4D8]/50' : 'bg-[#B8A0F0]/20'
                        }`}>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              {msg.isError
                                ? <AlertTriangle size={13} className="text-[#EF4444]" />
                                : msg.isSystemNote
                                  ? <CheckCircle2 size={13} className="text-[#171717]/50" />
                                  : <Sparkles size={13} className="text-[#FF2F92]" />
                              }
                              <span className="font-black text-[10px] uppercase tracking-wide text-[#171717]">
                                {msg.isError ? 'Terjadi Kendala' : msg.isSystemNote ? 'Sistem' : 'AI Business Analyst PKM'}
                              </span>
                            </div>

                            {!msg.isError && !msg.isSystemNote && (
                              <>
                                <span className="text-[#171717]/30 text-xs font-bold select-none">|</span>
                                {renderSourceBadge(msg)}
                                {(() => {
                                  const domainLabel = getDomainBadgeLabel(msg.responseType)
                                  if (!domainLabel) return null
                                  return (
                                    <span className="inline-flex items-center text-[9px] px-2 py-0.5 bg-[#171717] text-white rounded-md uppercase font-black tracking-wide shadow-[1px_1px_0px_#171717]">
                                      {domainLabel}
                                    </span>
                                  )
                                })()}
                              </>
                            )}
                          </div>
                          {msg.timestamp && (
                            <span className="text-[9.5px] text-[#171717]/60 font-bold tracking-tight">{msg.timestamp}</span>
                          )}
                        </div>

                        {/* Bubble Content */}
                        <div className="p-3.5 space-y-3">
                          {/* Alert / Offline Note */}
                          {msg.note && (
                            <div className="p-2.5 bg-[#FFFBEB] border border-[#F59E0B] rounded-lg text-xs font-semibold text-[#B45309] flex items-start gap-2 shadow-[2px_2px_0px_#171717]">
                              <AlertTriangle size={14} className="shrink-0 mt-0.5 text-[#F59E0B]" />
                              <span>{msg.note}</span>
                            </div>
                          )}

                          {/* Search Queries */}
                          {msg.searchQueries && msg.searchQueries.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white/70 border border-[#171717]/20 rounded-lg text-[10px] font-bold text-[#171717]/80">
                              <Search size={11} className="text-[#0EA5E9] shrink-0" />
                              <span className="font-black text-[9px] uppercase tracking-wider text-[#171717]/60">Query Riset Web:</span>
                              {msg.searchQueries.map((q, qi) => (
                                <span key={qi} className="px-2 py-0.5 bg-[#FAF7F2] border border-[#171717]/30 rounded-md font-mono text-[9px] text-[#171717]">
                                  "{q}"
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Summary Card */}
                          {msg.summary && (
                            <div className="p-2.5 bg-white border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717]">
                              <p className="text-[9.5px] font-black uppercase text-[#FF2F92] mb-1">Ringkasan Kondisi:</p>
                              <p className="text-xs font-bold text-[#171717] leading-relaxed">{msg.summary}</p>
                            </div>
                          )}

                          {/* Main Answer */}
                          <MarkdownRenderer content={msg.answer} className="text-sm" />

                          {/* Findings */}
                          {msg.findings && msg.findings.length > 0 && (
                            <div className="pt-2.5 border-t border-[#171717]/15 space-y-1.5">
                              <p className="text-[10px] font-black uppercase tracking-wider text-[#171717]/70">
                                Temuan &amp; Poin Evaluasi Kunci:
                              </p>
                              <div className="space-y-1">
                                {msg.findings.map((f, fi) => (
                                  <div key={fi} className="text-xs text-[#171717] flex items-start gap-1.5 bg-white/80 p-2 rounded-lg border border-[#171717]/20">
                                    <span className="text-[#FF2F92] font-black shrink-0 mt-0.5">•</span>
                                    <span className="font-semibold leading-relaxed">{f}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Recommendations */}
                          {msg.recommendations && msg.recommendations.length > 0 && (
                            <div className="pt-2.5 border-t border-[#171717]/15 space-y-1.5">
                              <p className="text-[10px] font-black uppercase tracking-wider text-[#10B981] flex items-center gap-1">
                                <CheckSquare size={12} /> Rekomendasi Tindakan Strategis:
                              </p>
                              <div className="space-y-1">
                                {msg.recommendations.map((r, ri) => (
                                  <div key={ri} className="text-xs text-[#171717] flex items-start gap-1.5 bg-[#FAF7F2] p-2 rounded-lg border border-[#171717]/20 font-medium">
                                    <span className="text-[#10B981] font-black shrink-0">✓</span>
                                    <span className="leading-relaxed">{r}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Grounded Sources */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="pt-2.5 border-t border-[#171717]/15 space-y-2">
                              <p className="text-[10px] font-black uppercase tracking-wider text-[#0EA5E9] flex items-center gap-1">
                                <Globe size={12} /> Sumber Riset &amp; Referensi Eksternal:
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {msg.sources.map((src, si) => (
                                  <a
                                    key={si}
                                    href={src.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-[#FAF7F2] border border-[#171717] rounded-lg text-[10px] font-bold text-[#171717] shadow-[1px_1px_0px_#171717] transition hover:translate-y-[-1px] group cursor-pointer max-w-full"
                                    title={src.title || src.url}
                                  >
                                    <span className="truncate max-w-[220px] sm:max-w-[280px]">{src.title || src.url}</span>
                                    <ExternalLink size={11} className="shrink-0 text-[#0EA5E9] group-hover:text-[#FF2F92]" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Suggested Actions */}
                          {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                            <div className="pt-2.5 border-t border-[#171717]/15 space-y-1.5">
                              <p className="text-[10px] font-black uppercase tracking-wider text-[#FF2F92] flex items-center gap-1">
                                <Compass size={12} /> Eksplorasi Langkah Lanjutan:
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {msg.suggestedActions.map((action, aiIdx) => (
                                  <button
                                    key={aiIdx}
                                    onClick={() => handleSend(action)}
                                    className="text-left px-2.5 py-1 bg-white hover:bg-[#FFD83D]/40 border border-[#171717] rounded-lg text-[10px] font-bold text-[#171717] shadow-[1px_1px_0px_#171717] transition cursor-pointer"
                                  >
                                    → {action}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Error retry */}
                          {msg.isError && (
                            <div className="pt-2 border-t border-[#171717]/15">
                              <button
                                onClick={handleRetry}
                                className="px-3 py-1.5 bg-[#171717] text-white rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_#FF2F92] cursor-pointer hover:opacity-90 transition min-h-[36px]"
                              >
                                <RefreshCw size={13} /> Coba Lagi
                              </button>
                            </div>
                          )}

                          {/* Engine mode note */}
                          {!msg.isError && !msg.isSystemNote && msg.mode && (
                            <p className="text-[9px] text-[#171717]/40 font-semibold pt-1 border-t border-[#171717]/10">
                              via {msg.mode}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Loading Indicator */}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2.5 px-4 py-3 bg-white border-2 border-[#171717] rounded-2xl rounded-tl-sm shadow-[3px_3px_0px_#171717]">
                    <Loader2 size={15} className="animate-spin text-[#FF2F92] shrink-0" />
                    <div>
                      <p className="text-xs font-black uppercase text-[#171717]">AI Sedang Berpikir…</p>
                      <p className="text-[10px] text-[#171717]/60 font-semibold">Mengaudit data operasional PKM</p>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="bg-white border-2 border-[#171717] rounded-xl p-3 sm:p-4 shadow-[4px_4px_0px_#171717]">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ketik pertanyaan bisnis Anda… (Enter kirim, Shift+Enter baris baru)"
                  rows={2}
                  disabled={loading}
                  className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#171717] rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF2F92] resize-none disabled:opacity-50 leading-relaxed placeholder:text-[#171717]/40 placeholder:font-normal"
                />
                {input && !loading && (
                  <button
                    onClick={() => {
                      setInput('')
                      if (textareaRef.current) {
                        textareaRef.current.style.height = 'auto'
                        textareaRef.current.focus()
                      }
                    }}
                    className="absolute right-2 top-2.5 p-1 hover:bg-[#171717]/10 rounded-md transition cursor-pointer text-[#171717]/50 hover:text-[#171717]"
                    title="Hapus teks"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {loading ? (
                <button
                  onClick={handleStop}
                  className="shrink-0 px-4 py-2.5 bg-[#EF4444] hover:bg-[#DC2626] text-white border border-[#171717] rounded-lg font-black text-xs uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_#171717] transition cursor-pointer min-h-[44px]"
                >
                  <StopCircle size={15} />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  className="shrink-0 px-4 py-2.5 bg-[#FF2F92] hover:bg-[#FF439D] text-white border border-[#171717] rounded-lg font-black text-xs uppercase flex items-center gap-1.5 shadow-[3px_3px_0px_#171717] transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
                >
                  <Send size={15} />
                  <span>Kirim</span>
                </button>
              )}
            </div>
            <p className="text-[10px] text-[#171717]/40 font-semibold mt-1.5 pl-0.5">
              <kbd className="px-1 py-0.5 bg-[#FAF7F2] border border-[#171717]/20 rounded text-[9px]">Enter</kbd> kirim &nbsp;·&nbsp;
              <kbd className="px-1 py-0.5 bg-[#FAF7F2] border border-[#171717]/20 rounded text-[9px]">Shift+Enter</kbd> baris baru
            </p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          {/* Snapshot Metrics */}
          <div className="bg-white border-2 border-[#171717] rounded-xl p-4 shadow-[4px_4px_0px_#171717] space-y-3">
            <div className="flex items-center gap-2 border-b border-[#171717]/20 pb-2.5">
              <BarChart3 size={15} className="text-[#FF2F92] shrink-0" />
              <h3 className="font-display text-xs uppercase font-black text-[#171717]">Snapshot Data PKM</h3>
            </div>

            {contextData ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-[#FAF7F2] border border-[#171717] rounded-lg">
                    <p className="text-[9px] font-black uppercase text-[#171717]/60">Proyek Aktif</p>
                    <p className="font-display text-2xl text-[#171717] mt-0.5">{contextData.total_projects}</p>
                  </div>
                  <div className="p-2.5 bg-[#FFD83D]/30 border border-[#171717] rounded-lg">
                    <p className="text-[9px] font-black uppercase text-[#171717]/60">Penyelesaian</p>
                    <p className="font-display text-2xl text-[#171717] mt-0.5">{contextData.completion_rate}%</p>
                  </div>
                </div>

                <div className="p-2.5 bg-[#FAF7F2] border border-[#171717] rounded-lg flex items-center justify-between text-xs font-bold">
                  <span className="text-[#171717]/70">Sprint Berjalan</span>
                  <span className="font-display text-sm text-[#3B82F6]">
                    {contextData.in_progress_sprints ?? 0} dari {contextData.total_sprints ?? 0} Sprint
                  </span>
                </div>

                <div className="p-2.5 bg-[#FF2F92]/10 border border-[#171717] rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-[#171717]">
                    <span className="flex items-center gap-1 text-[#EF4444]">
                      <AlertTriangle size={12} /> Berisiko / Delay
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
              <div className="py-6 text-center">
                <Loader2 size={18} className="animate-spin text-[#FF2F92] mx-auto mb-2" />
                <p className="text-xs text-[#171717]/60 font-semibold">Memuat data konteks…</p>
              </div>
            )}
          </div>

          {/* At-Risk Projects */}
          <div className="bg-white border-2 border-[#171717] rounded-xl p-4 shadow-[4px_4px_0px_#171717] space-y-3">
            <div className="flex items-center gap-1.5 border-b border-[#171717]/20 pb-2.5">
              <ShieldAlert size={14} className="text-[#EF4444] shrink-0" />
              <h3 className="font-display text-xs uppercase font-black text-[#171717]">Proyek Perlu Atensi</h3>
            </div>

            {contextData && (contextData.at_risk_list?.length > 0 || contextData.delayed_list?.length > 0) ? (
              <div className="space-y-2">
                {[...contextData.at_risk_list, ...contextData.delayed_list].slice(0, 4).map((p, pIdx) => (
                  <div
                    key={pIdx}
                    onClick={() => handleSend(`Jelaskan kenapa proyek ${p.name} bermasalah dan apa rekomendasinya?`)}
                    className="p-2.5 bg-[#FAF7F2] hover:bg-[#FFD83D]/30 border border-[#171717] rounded-lg text-xs transition cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-2 font-bold text-[#171717]">
                      <span className="truncate">{p.name}</span>
                      <span className="shrink-0 text-[9px] px-1.5 py-0.5 bg-[#EF4444] text-white rounded-md font-black uppercase">
                        {p.risk_level || 'At Risk'}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#171717]/60 mt-1">
                      Progress: {p.progress}% · Klien: {p.client}
                    </p>
                  </div>
                ))}
              </div>
            ) : contextData ? (
              <div className="py-4 text-center">
                <CheckCircle2 size={18} className="text-[#10B981] mx-auto mb-1.5" />
                <p className="text-xs text-[#171717]/60 font-medium">Tidak ada proyek berisiko tinggi saat ini.</p>
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-xs text-[#171717]/40 font-medium">Memuat data…</p>
              </div>
            )}
          </div>

          {/* AI Transparency Note */}
          <div className="p-3.5 bg-[#B8A0F0]/20 border border-[#171717] rounded-xl space-y-2">
            <p className="font-black text-[#171717] uppercase text-[10px] flex items-center gap-1.5">
              <Brain size={12} className="text-[#FF2F92]" /> Transparansi Engine AI PKM
            </p>
            <p className="text-[11px] text-[#171717]/80 font-medium leading-relaxed">
              Analisis ini dihitung secara objektif menggunakan aturan analitik bisnis (<em>Rule-Based Engine</em>) yang terhubung langsung ke basis data MySQL operasional real-time. Tidak ada angka atau proyek yang direkayasa secara fiktif.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
