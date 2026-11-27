import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import {
  Sparkles, Send, Loader2, RefreshCw, ChevronDown,
  Plus, Trash2, MessageSquare, Brain, AlertTriangle,
  ShieldAlert, CheckCircle2, Copy,
  X, Activity, Building2, Target, Zap,
  Info, ChevronUp, DollarSign, TrendingUp
} from 'lucide-react'
import PageLoading from '../../components/ui/PageLoading'
import PageHeader from '../../components/ui/PageHeader'

function MarkdownContent({ text }) {
  const lines = (text || '').split('\n')
  const rendered = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('### ')) {
      rendered.push(<h3 key={i} className="text-base font-black text-[#171717] mt-4 mb-2 uppercase tracking-wide">{line.replace('### ', '')}</h3>)
    } else if (line.startsWith('## ')) {
      rendered.push(<h2 key={i} className="text-lg font-black text-[#171717] mt-4 mb-2">{line.replace('## ', '')}</h2>)
    } else if (line.startsWith('> ')) {
      rendered.push(<blockquote key={i} className="border-l-4 border-[#FFD83D] bg-[#FFFBEA] px-4 py-2 my-2 text-sm font-semibold text-[#171717]">{parseInline(line.replace('> ', ''))}</blockquote>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const items = []
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(<li key={i} className="mb-1">{parseInline(lines[i].replace(/^[-*] /, ''))}</li>)
        i++
      }
      rendered.push(<ul key={`ul-${i}`} className="list-disc list-inside space-y-1 my-2 text-sm text-[#333]">{items}</ul>)
      continue
    } else if (/^\d+\. /.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(<li key={i} className="mb-1">{parseInline(lines[i].replace(/^\d+\. /, ''))}</li>)
        i++
      }
      rendered.push(<ol key={`ol-${i}`} className="list-decimal list-inside space-y-1 my-2 text-sm text-[#333]">{items}</ol>)
      continue
    } else if (line === '') {
      rendered.push(<div key={i} className="h-2" />)
    } else {
      rendered.push(<p key={i} className="text-sm text-[#333] leading-relaxed my-1">{parseInline(line)}</p>)
    }
    i++
  }
  return <div className="space-y-1">{rendered}</div>
}

function parseInline(text) {
  const parts = []
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g
  let last = 0, match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const m = match[0]
    if (m.startsWith('`')) parts.push(<code key={match.index} className="bg-[#171717] text-[#FFD83D] px-1 rounded text-xs font-mono">{m.slice(1, -1)}</code>)
    else if (m.startsWith('**')) parts.push(<strong key={match.index} className="font-black text-[#171717]">{m.slice(2, -2)}</strong>)
    else if (m.startsWith('*')) parts.push(<em key={match.index} className="italic">{m.slice(1, -1)}</em>)
    last = match.index + m.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

const PERIODS = [
  { value: 'all_time', label: 'Semua Waktu' },
  { value: 'this_month', label: 'Bulan Ini' },
  { value: 'this_week', label: 'Minggu Ini' },
  { value: 'today', label: 'Hari Ini' },
]

const SUGGESTED_PROMPTS = [
  { label: 'Kondisi Bisnis', prompt: 'Bagaimana kondisi kesehatan bisnis PKM hari ini?', icon: Building2 },
  { label: 'Kondisi Finansial', prompt: 'Bagaimana kondisi keuangan dan realisasi anggaran perusahaan saat ini?', icon: DollarSign },
  { label: 'Proyek Bermasalah', prompt: 'Proyek mana yang terlambat dan membutuhkan intervensi segera?', icon: AlertTriangle },
  { label: 'Risiko Utama', prompt: 'Apa risiko terbesar yang mengancam perusahaan saat ini?', icon: ShieldAlert },
  { label: 'Beban Kerja Tim', prompt: 'Bagaimana kondisi beban kerja dan kapasitas anggota tim?', icon: Activity },
  { label: 'Deviasi Anggaran', prompt: 'Apakah terdapat penyimpangan atau kelebihan pagu anggaran pada pos belanja?', icon: TrendingUp },
  { label: 'Blocker Aktif', prompt: 'Kendala operasional apa saja yang sedang menghambat tim?', icon: Zap },
  { label: 'Rekomendasi Prioritas', prompt: 'Apa 3 tindakan paling kritis yang harus diambil minggu ini?', icon: Target },
]

function PriorityBadge({ priority }) {
  const cfg = {
    critical: 'bg-red-100 text-red-700 border-red-300',
    high: 'bg-orange-100 text-orange-700 border-orange-300',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    low: 'bg-green-100 text-green-700 border-green-300',
  }
  return <span className={`px-2 py-0.5 rounded border text-xs font-black uppercase ${cfg[priority] || cfg.medium}`}>{priority}</span>
}

function StatCard({ label, value, sub, color = '#171717', bg = '#F5F1E9', icon: Icon }) {
  return (
    <div className="border-[3px] border-[#171717] shadow-[4px_4px_0px_#171717] p-4 flex flex-col gap-1" style={{ background: bg }}>
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={16} className="opacity-60" />}
        <span className="text-xs font-bold uppercase tracking-wider text-[#555]">{label}</span>
      </div>
      <div className="text-3xl font-black" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-[#666] font-semibold">{sub}</div>}
    </div>
  )
}

function ChatMessage({ msg, onCopy }) {
  const isUser = msg.role === 'user'
  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[75%] border-[2px] border-[#171717] shadow-[3px_3px_0px_#171717] bg-[#171717] text-white px-4 py-3 text-sm font-semibold">
          {msg.content}
        </div>
      </div>
    )
  }
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[90%] w-full">
        <div className="border-[2px] border-[#171717] shadow-[4px_4px_0px_#B8A0F0] bg-white px-5 py-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E5E5E5]">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-[#B8A0F0]" />
              <span className="text-xs font-black text-[#B8A0F0] uppercase tracking-wide">AI Executive Advisor</span>
            </div>
            <div className="flex items-center gap-2">
              {msg.mode && (
                <span className={`px-2 py-0.5 text-[10px] font-black uppercase border ${
                  msg.mode.includes('Gemini') ? 'bg-[#E8F4FD] text-[#1565C0] border-[#1565C0]' : 'bg-[#F3F0FF] text-[#6B46C1] border-[#6B46C1]'
                }`}>
                  {msg.mode.includes('Gemini') ? '🤖 Gemini LLM' : '⚙️ Rule-Based'}
                </span>
              )}
              <button onClick={() => onCopy(msg.content)} className="p-1 hover:bg-[#F5F1E9] rounded transition-colors" title="Salin jawaban">
                <Copy size={12} className="text-[#999]" />
              </button>
            </div>
          </div>
          <MarkdownContent text={msg.content} />
          {msg.timestamp && (
            <div className="mt-3 text-[10px] text-[#999] font-mono">
              {new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InsightCard({ insight, onAskAbout }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border-[2px] border-[#171717] shadow-[3px_3px_0px_#171717] bg-white mb-3 overflow-hidden">
      <div className="flex items-start gap-3 p-4 cursor-pointer hover:bg-[#FAFAFA]" onClick={() => setExpanded(e => !e)}>
        <PriorityBadge priority={insight.priority} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black text-[#B8A0F0] uppercase mb-1">{insight.category}</div>
          <div className="text-sm font-bold text-[#171717] leading-tight">{insight.title}</div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-[#999] flex-shrink-0 mt-1" /> : <ChevronDown size={16} className="text-[#999] flex-shrink-0 mt-1" />}
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-[#E5E5E5]">
          <p className="text-sm text-[#444] mt-3 mb-2">{insight.summary}</p>
          <div className="bg-[#F5F1E9] border border-[#DDD] p-3 mb-3">
            <div className="text-xs font-black text-[#666] uppercase mb-1">Bukti Data</div>
            <div className="text-xs text-[#444]">{insight.factual_evidence}</div>
          </div>
          <div className="bg-[#FFF8E1] border border-[#FFD83D] p-3 mb-3">
            <div className="text-xs font-black text-[#666] uppercase mb-1">Dampak Bisnis</div>
            <div className="text-xs text-[#444]">{insight.business_impact}</div>
          </div>
          <div className="text-xs text-[#666] mb-3"><span className="font-black">Rekomendasi: </span>{insight.recommended_action}</div>
          <button
            onClick={() => onAskAbout(insight.title)}
            className="text-xs font-black px-3 py-1.5 bg-[#B8A0F0] text-white border-[2px] border-[#171717] shadow-[2px_2px_0px_#171717] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#171717] transition-all"
          >
            Tanyakan ke AI Advisor →
          </button>
        </div>
      )}
    </div>
  )
}

function RCAModal({ project, onClose, onRCAResult }) {
  const [loading, setLoading] = useState(false)
  const [rca, setRca] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!project) return
    setLoading(true)
    setError(null)
    api.post(`/leadership/ai/analyze-project/${project.id}`)
      .then(res => { setRca(res.data.rca); if (onRCAResult) onRCAResult(res.data.rca) })
      .catch(e => setError(e.response?.data?.message || 'Gagal menganalisis proyek.'))
      .finally(() => setLoading(false))
  }, [project?.id])

  if (!project) return null

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#F5F1E9] border-[3px] border-[#171717] shadow-[8px_8px_0px_#171717] w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#171717] text-white px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-black text-[#FFD83D] uppercase tracking-wide mb-1">Root Cause Analysis</div>
            <div className="font-black text-sm">{project.name} ({project.code})</div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded transition-colors"><X size={18} /></button>
        </div>
        <div className="p-5">
          {loading && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <Loader2 size={24} className="animate-spin text-[#B8A0F0]" />
              <span className="text-sm font-bold text-[#555]">Menganalisis proyek secara mendalam…</span>
            </div>
          )}
          {error && <div className="bg-red-50 border-2 border-red-300 p-4 text-red-700 text-sm font-semibold">{error}</div>}
          {rca && !loading && (
            <div className="space-y-5">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-[#B8A0F0] mb-3">Metrik Aktual Proyek</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Total Tugas', val: rca.factual_metrics.total_tasks },
                    { label: 'Selesai', val: rca.factual_metrics.completed_tasks },
                    { label: 'Overdue', val: rca.factual_metrics.overdue_tasks_count },
                    { label: 'In Review', val: rca.factual_metrics.in_review_tasks_count },
                    { label: 'Milestone OD', val: rca.factual_metrics.overdue_milestones_count },
                    { label: 'Blocker Aktif', val: rca.factual_metrics.active_blockers_count },
                  ].map(m => (
                    <div key={m.label} className="border-[2px] border-[#171717] bg-white p-2 text-center">
                      <div className="text-xl font-black text-[#171717]">{m.val}</div>
                      <div className="text-[10px] font-bold text-[#666] uppercase">{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-[#FF2F92] mb-3">Gejala Teridentifikasi</div>
                <ul className="space-y-2">
                  {rca.symptoms.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-[#333]">
                      <span className="text-[#FF2F92] font-black flex-shrink-0">●</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-[#FFD83D] mb-3">Hipotesis Penyebab</div>
                <div className="space-y-3">
                  {rca.hypotheses.map((h, i) => (
                    <div key={i} className="border-[2px] border-[#FFD83D] bg-[#FFFBEA] p-3">
                      <div className="font-black text-sm text-[#171717] mb-1">{h.hypothesis}</div>
                      <div className="text-xs text-[#555] mb-1"><span className="font-bold">Confidence:</span> {h.confidence}</div>
                      {h.evidence && <div className="text-xs text-[#666] italic">"{h.evidence}"</div>}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-[#B8A0F0] mb-3">Rekomendasi Tindakan</div>
                <div className="space-y-3">
                  {rca.recommendations.map((r, i) => (
                    <div key={i} className="border-[2px] border-[#171717] bg-white p-3 flex gap-3">
                      <div className="w-6 h-6 bg-[#171717] text-white text-xs font-black flex items-center justify-center flex-shrink-0">{i + 1}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-black text-sm text-[#171717]">{r.action}</span>
                          <PriorityBadge priority={r.priority?.toLowerCase()} />
                        </div>
                        <div className="text-xs text-[#555]">{r.detail}</div>
                        <div className="text-xs font-bold text-[#B8A0F0] mt-1">PIC: {r.owner}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-xs text-[#999] font-mono">
                Confidence: {rca.analysis_confidence} · Analyzed: {new Date(rca.analyzed_at).toLocaleString('id-ID')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AIExecutiveAdvisor() {
  const { user } = useAuth()
  const [healthData, setHealthData] = useState(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [insights, setInsights] = useState([])
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [insightFilter, setInsightFilter] = useState('all')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [period, setPeriod] = useState('all_time')
  const chatEndRef = useRef(null)
  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [convLoading, setConvLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true)
  const [showMobileInsights, setShowMobileInsights] = useState(false)
  const [rcaProject, setRcaProject] = useState(null)
  const [projects, setProjects] = useState([])

  const loadContext = useCallback((p = period) => {
    setHealthLoading(true)
    api.get('/leadership/ai/context', { params: { period: p } })
      .then(res => setHealthData(res.data))
      .catch(() => {})
      .finally(() => setHealthLoading(false))
  }, [period])

  const loadInsights = useCallback((p = period) => {
    setInsightsLoading(true)
    api.get('/leadership/ai/insights', { params: { period: p } })
      .then(res => setInsights(res.data.insights || []))
      .catch(() => {})
      .finally(() => setInsightsLoading(false))
  }, [period])

  const loadConversations = () => {
    setConvLoading(true)
    api.get('/leadership/ai/conversations')
      .then(res => setConversations(res.data.conversations || []))
      .catch(() => {})
      .finally(() => setConvLoading(false))
  }

  const loadProjects = () => {
    api.get('/projects')
      .then(res => setProjects(res.data.data || res.data.projects || []))
      .catch(() => {})
  }

  useEffect(() => { loadContext(); loadInsights(); loadConversations(); loadProjects() }, [])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, chatLoading])

  const handlePeriodChange = (p) => { setPeriod(p); loadContext(p); loadInsights(p) }

  const sendMessage = async (promptText = input) => {
    const text = promptText.trim()
    if (!text || chatLoading) return
    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: new Date().toISOString() }])
    setInput('')
    setChatLoading(true)
    try {
      const payload = { prompt: text, period }
      if (activeConvId) payload.conversation_id = activeConvId
      const res = await api.post('/leadership/ai/chat', payload)
      const d = res.data
      setMessages(prev => [...prev, { role: 'assistant', content: d.reply || '', mode: d.mode, data_sources: d.data_sources, timestamp: new Date().toISOString() }])
      if (d.conversation_id && activeConvId === d.conversation_id) loadConversations()
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Maaf, terjadi kesalahan. Silakan coba lagi.', mode: 'Error', timestamp: new Date().toISOString() }])
    } finally {
      setChatLoading(false)
    }
  }

  const createConversation = async () => {
    try {
      const res = await api.post('/leadership/ai/conversations', { title: 'Analisis Eksekutif Baru', period })
      const conv = res.data.conversation
      setConversations(prev => [conv, ...prev])
      setActiveConvId(conv.id)
      setMessages([])
    } catch {}
  }

  const openConversation = async (conv) => {
    setActiveConvId(conv.id)
    try {
      const res = await api.get(`/leadership/ai/conversations/${conv.id}`)
      const msgs = res.data.conversation?.messages || []
      setMessages(msgs.map(m => ({ role: m.role, content: m.content, mode: m.mode, timestamp: m.timestamp })))
    } catch {}
  }

  const deleteConversation = async (id, e) => {
    e.stopPropagation()
    try {
      await api.delete(`/leadership/ai/conversations/${id}`)
      setConversations(prev => prev.filter(c => c.id !== id))
      if (activeConvId === id) { setActiveConvId(null); setMessages([]) }
    } catch {}
  }

  const clearChat = () => { setActiveConvId(null); setMessages([]) }
  const copyText = (text) => { navigator.clipboard.writeText(text).catch(() => {}) }
  const askAboutInsight = (title) => sendMessage(`Jelaskan lebih detail mengenai insight berikut dan rekomendasi tindakannya: ${title}`)

  const insightCategories = ['all', ...new Set(insights.map(i => i.category))]
  const filteredInsights = insightFilter === 'all' ? insights : insights.filter(i => i.category === insightFilter)
  const ch = healthData?.context?.company_health
  const risks = healthData?.context?.risks
  const blockers = healthData?.context?.blockers
  const chiColor = ch ? (ch.chi_score >= 75 ? '#16A34A' : ch.chi_score >= 50 ? '#D97706' : '#DC2626') : '#171717'

  return (
    <div className="w-full bg-[#F5F1E9] flex flex-col flex-1 min-h-0">
      <PageHeader
        title="AI EXECUTIVE ADVISOR"
        subtitle="Penasihat strategis eksekutif berbasis AI dan analisis data bisnis PT Potensi Karya Mandiri."
        tag="PENASIHAT AI"
        badge="C-LEVEL INTELLIGENCE"
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            <select
              value={period}
              onChange={e => handlePeriodChange(e.target.value)}
              className="bg-white text-[#171717] text-xs font-bold px-3 py-2 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] focus:outline-none focus:border-[#B8A0F0] cursor-pointer min-h-[38px]"
            >
              {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <button
              onClick={() => { loadContext(); loadInsights() }}
              className="p-2 bg-white text-[#171717] border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] hover:bg-[#F5F1E9] transition-colors cursor-pointer min-h-[38px] flex items-center justify-center"
              title="Segarkan Analisis"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        }
      />

      <div className="px-3.5 sm:px-6 py-3 sm:py-4 border-b-[3px] border-[#171717] bg-[#FAFAF8]">
        {healthLoading ? (
          <PageLoading mode="component" text="Memuat data kondisi bisnis..." subtext="Mengagregasi Corporate Health Index, risiko, dan deviasi proyek." transparent />
        ) : ch ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
            <StatCard label="Corporate Health Index" value={`${ch.chi_score}/100`} sub={ch.chi_category} color={chiColor} bg={ch.chi_score >= 75 ? '#F0FDF4' : ch.chi_score >= 50 ? '#FFFBEB' : '#FEF2F2'} icon={Activity} />
            <StatCard label="Proyek Terlambat" value={ch.delayed_count} sub={`dari ${ch.total_projects} total proyek`} color={ch.delayed_count > 0 ? '#DC2626' : '#16A34A'} bg={ch.delayed_count > 0 ? '#FEF2F2' : '#F0FDF4'} icon={AlertTriangle} />
            <StatCard label="Risiko Aktif" value={risks?.total_active ?? '—'} sub={`${risks?.critical_count ?? 0} kritis, ${risks?.high_count ?? 0} tinggi`} color={risks?.critical_count > 0 ? '#DC2626' : '#171717'} bg={risks?.critical_count > 0 ? '#FEF2F2' : '#F5F1E9'} icon={ShieldAlert} />
            <StatCard label="Blocker Lapangan" value={blockers?.total_active ?? '—'} sub={`${blockers?.critical_aged_count ?? 0} tertahan lama`} color={blockers?.total_active > 0 ? '#D97706' : '#16A34A'} bg={blockers?.total_active > 0 ? '#FFFBEB' : '#F0FDF4'} icon={Zap} />
          </div>
        ) : (
          <div className="text-sm text-[#999]">Data tidak tersedia.</div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-[#171717]/50 backdrop-blur-xs z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
            <div className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-2xl bg-[#F5F1E9] border-r-[3px] border-[#171717] flex flex-col overflow-hidden lg:static lg:z-auto lg:w-56 lg:shadow-none shrink-0">
              <div className="p-3 border-b-[2px] border-[#171717] flex items-center justify-between">
                <span className="text-xs font-black uppercase text-[#555]">Percakapan</span>
                <div className="flex items-center gap-1">
                  <button onClick={createConversation} className="p-1.5 bg-[#171717] text-white hover:bg-[#333] transition-colors" title="Percakapan Baru"><Plus size={12} /></button>
                  <button onClick={() => setSidebarOpen(false)} className="p-1.5 hover:bg-[#DDD] transition-colors" title="Tutup Menu"><X size={12} /></button>
                </div>
              </div>
              <button onClick={() => { clearChat(); if (window.innerWidth < 1024) setSidebarOpen(false) }} className={`flex items-center gap-2 px-3 py-2.5 text-xs font-bold border-b border-[#E5E5E5] hover:bg-[#EEE] transition-colors ${!activeConvId ? 'bg-[#FFD83D] border-l-4 border-l-[#171717]' : ''}`}>
                <MessageSquare size={12} />Obrolan Baru (Tanpa Simpan)
              </button>
              <div className="flex-1 overflow-y-auto">
                {convLoading ? (
                  <div className="p-3 text-xs text-[#999] flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Memuat…</div>
                ) : conversations.length === 0 ? (
                  <div className="p-3 text-xs text-[#999]">Belum ada percakapan tersimpan.</div>
                ) : (
                  conversations.map(conv => (
                    <div key={conv.id} onClick={() => { openConversation(conv); if (window.innerWidth < 1024) setSidebarOpen(false) }} className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-[#E5E5E5] hover:bg-[#EEE] transition-colors group ${activeConvId === conv.id ? 'bg-[#E8E0FF] border-l-4 border-l-[#B8A0F0]' : ''}`}>
                      <MessageSquare size={11} className="text-[#999] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-[#333] truncate">{conv.title}</div>
                        <div className="text-[10px] text-[#999]">{conv.period}</div>
                      </div>
                      <button onClick={(e) => deleteConversation(conv.id, e)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all">
                        <Trash2 size={10} className="text-red-500" />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t-[2px] border-[#171717] p-3">
                <div className="text-xs font-black uppercase text-[#555] mb-2">Root Cause Analysis</div>
                <select onChange={e => { const proj = projects.find(p => String(p.id) === e.target.value); if (proj) setRcaProject(proj); e.target.value = '' }} className="w-full text-xs border-[2px] border-[#171717] bg-white px-2 py-1.5 font-bold focus:outline-none" defaultValue="">
                  <option value="">Pilih Proyek…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                </select>
              </div>
            </div>
          </>
        )}

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b-[2px] border-[#171717] bg-[#FAFAF8] shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 border-[2px] border-[#171717] bg-white hover:bg-[#F5F1E9] transition-colors rounded shrink-0 cursor-pointer"
                title={sidebarOpen ? "Tutup Riwayat Percakapan" : "Buka Riwayat Percakapan"}
              >
                <MessageSquare size={14} />
              </button>
              <div className="flex items-center gap-1.5 min-w-0">
                <Brain size={14} className="text-[#B8A0F0] shrink-0" />
                <span className="text-xs font-black text-[#555] uppercase truncate">
                  {activeConvId ? conversations.find(c => c.id === activeConvId)?.title || 'Percakapan Aktif' : 'Obrolan Langsung'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setShowMobileInsights(!showMobileInsights)}
                className="xl:hidden text-xs font-bold px-2 py-1 border-[2px] border-[#171717] bg-[#FFD83D] hover:bg-[#ffe26e] transition-colors flex items-center gap-1 shrink-0 rounded cursor-pointer"
                title="Lihat Priority Insights"
              >
                <Sparkles size={12} />
                <span className="hidden sm:inline">Insights</span>
                {insights.length > 0 && (
                  <span className="bg-[#FF2F92] text-white text-[9px] font-black px-1.5 rounded-full">{insights.length}</span>
                )}
              </button>
              {activeConvId && (
                <button onClick={createConversation} className="text-xs font-bold px-2 py-1 border-[2px] border-[#171717] bg-white hover:bg-[#F5F1E9] transition-colors flex items-center gap-1 rounded cursor-pointer">
                  <Plus size={11} /> <span className="hidden sm:inline">Baru</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 && !chatLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
                <Brain size={48} className="text-[#B8A0F0] mb-4 opacity-60" />
                <div className="text-lg font-black text-[#171717] mb-2">AI Executive Advisor</div>
                <p className="text-sm text-[#666] mb-6">Tanyakan apa saja terkait kondisi perusahaan, performa proyek, risiko bisnis, atau strategi operasional.</p>
                <div className="grid grid-cols-2 gap-2 w-full">
                  {SUGGESTED_PROMPTS.map((s, i) => (
                    <button key={i} onClick={() => sendMessage(s.prompt)} className="flex items-center gap-2 px-3 py-2.5 border-[2px] border-[#171717] bg-white shadow-[2px_2px_0px_#171717] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#171717] transition-all text-left">
                      <s.icon size={14} className="text-[#B8A0F0] flex-shrink-0" />
                      <span className="text-xs font-bold text-[#333]">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, idx) => <ChatMessage key={idx} msg={msg} onCopy={copyText} />)}
            {chatLoading && (
              <div className="flex justify-start mb-4">
                <div className="border-[2px] border-[#B8A0F0] bg-white px-5 py-4 flex items-center gap-3 shadow-[3px_3px_0px_#B8A0F0]">
                  <Loader2 size={16} className="animate-spin text-[#B8A0F0]" />
                  <span className="text-sm font-bold text-[#555]">AI Advisor sedang menganalisis…</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="flex-shrink-0 border-t-[3px] border-[#171717] bg-[#F5F1E9] p-4">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Tanyakan kondisi bisnis, risiko, atau rekomendasi strategis…"
                rows={2}
                className="flex-1 border-[2px] border-[#171717] bg-white px-4 py-3 text-sm font-semibold resize-none focus:outline-none focus:border-[#B8A0F0] placeholder:text-[#AAA] placeholder:font-normal"
              />
              <button onClick={() => sendMessage()} disabled={!input.trim() || chatLoading} className="px-4 bg-[#B8A0F0] text-white border-[2px] border-[#171717] shadow-[3px_3px_0px_#171717] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#171717] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[3px_3px_0px_#171717] flex items-center justify-center">
                {chatLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Info size={11} className="text-[#999]" />
              <span className="text-[10px] text-[#999]">AI menggunakan data aktual database PKM. Rekomendasi bersifat pendukung keputusan, bukan eksekusi otomatis.</span>
            </div>
          </div>
        </div>

        {/* Priority Insights Sidebar: Desktop Fixed, Mobile/Tablet Drawer */}
        {showMobileInsights && (
          <div
            className="fixed inset-0 bg-[#171717]/50 backdrop-blur-xs z-40 xl:hidden"
            onClick={() => setShowMobileInsights(false)}
            aria-hidden="true"
          />
        )}
        <div className={`border-l-[3px] border-[#171717] bg-[#F5F1E9] flex-col overflow-hidden shrink-0 ${
          showMobileInsights
            ? 'fixed inset-y-0 right-0 z-50 w-80 max-w-[90vw] shadow-2xl flex'
            : 'hidden xl:flex w-72'
        }`}>
          <div className="p-3 border-b-[2px] border-[#171717] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-[#FFD83D]" />
              <span className="text-xs font-black uppercase text-[#171717]">Priority Insights</span>
              {insights.length > 0 && <span className="text-[10px] font-black bg-[#FF2F92] text-white px-1.5 py-0.5 rounded">{insights.length}</span>}
            </div>
            {showMobileInsights && (
              <button
                onClick={() => setShowMobileInsights(false)}
                className="xl:hidden p-1 hover:bg-[#171717]/10 rounded cursor-pointer transition-colors"
                title="Tutup Insights"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="px-3 py-2 border-b border-[#E5E5E5] overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              {insightCategories.map(cat => (
                <button key={cat} onClick={() => setInsightFilter(cat)} className={`px-2 py-1 text-[10px] font-black uppercase border transition-colors whitespace-nowrap cursor-pointer ${insightFilter === cat ? 'bg-[#171717] text-white border-[#171717]' : 'bg-white text-[#555] border-[#DDD] hover:border-[#171717]'}`}>
                  {cat === 'all' ? 'Semua' : cat}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {insightsLoading ? (
              <div className="flex items-center gap-2 py-4 text-xs text-[#999]"><Loader2 size={14} className="animate-spin" /> Menganalisis…</div>
            ) : filteredInsights.length === 0 ? (
              <div className="text-xs text-[#999] py-4 text-center">
                <CheckCircle2 size={24} className="mx-auto mb-2 text-green-400" />
                Tidak ada insight kritis terdeteksi.
              </div>
            ) : (
              filteredInsights.map(insight => <InsightCard key={insight.id} insight={insight} onAskAbout={askAboutInsight} />)
            )}
          </div>
          {healthData && (
            <div className="border-t-[2px] border-[#171717] p-3">
              <div className="text-[10px] font-black uppercase text-[#999] mb-1">AI Engine</div>
              <div className={`text-[11px] font-bold ${healthData.is_configured ? 'text-[#1565C0]' : 'text-[#6B46C1]'}`}>
                {healthData.is_configured ? `🤖 ${healthData.model}` : '⚙️ Rule-Based Engine'}
              </div>
              <div className="text-[10px] text-[#AAA] mt-1">{healthData.context?.as_of_date} {healthData.context?.as_of_time}</div>
            </div>
          )}
        </div>
      </div>

      {rcaProject && (
        <RCAModal
          project={rcaProject}
          onClose={() => setRcaProject(null)}
          onRCAResult={rca => {
            const summary = `Root Cause Analysis selesai untuk proyek **${rca.project.name}** (${rca.project.code}). Progress: ${rca.project.progress}% vs target ${rca.project.target_progress}% (deviasi ${rca.project.deviation}%). Ditemukan ${rca.symptoms.length} gejala dan ${rca.hypotheses.length} hipotesis penyebab.`
            setMessages(prev => [...prev, { role: 'assistant', content: summary, mode: 'Root Cause Analysis Engine', timestamp: new Date().toISOString() }])
          }}
        />
      )}
    </div>
  )
}