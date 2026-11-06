import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import {
  Folder,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  Clock,
  Calendar,
  Send,
  Sparkles,
  Minus,
  ArrowRight,
  Globe,
  Laptop,
  Smartphone,
  Code2,
  Check,
  Loader2,
  RotateCcw,
  ExternalLink
} from 'lucide-react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts'
import PageHeader from '../components/ui/PageHeader'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // AI chat state
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiHistory, setAiHistory] = useState([])
  const [aiCollapsed, setAiCollapsed] = useState(false)
  const [aiMode, setAiMode] = useState(null) // null | 'Rule-Based Engine' | 'LLM Eksternal'

  const aiChatBottomRef = useRef(null)
  const abortControllerRef = useRef(null)

  // Quick suggestion prompts matching reference
  const SUGGESTION_PROMPTS = [
    "Apa risiko proyek yang sedang berjalan?",
    "Bagaimana progres tim minggu ini?",
    "Proyek mana yang perlu perhatian khusus?",
    "Berikan rekomendasi untuk meningkatkan produktivitas."
  ]

  // Fetch Dashboard data from Backend API
  const fetchDashboardData = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      setLoading(true)
      setError(null)
      const [dashRes, aiCtxRes] = await Promise.allSettled([
        api.get('/dashboard', { signal: controller.signal }),
        api.get('/ai/context', { signal: controller.signal }),
      ])

      if (controller.signal.aborted) return

      if (dashRes.status === 'fulfilled') {
        setData(dashRes.value.data)
        setError(null)
      } else {
        const err = dashRes.reason
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return
        throw err
      }

      if (aiCtxRes.status === 'fulfilled') {
        setAiMode(aiCtxRes.value.data?.mode || null)
      }
    } catch (err) {
      if (controller.signal.aborted) return
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return
      console.error('Failed to fetch dashboard data:', err)
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('Batas waktu request ke server terlampaui (Timeout). Silakan periksa koneksi atau klik Coba Lagi.')
      } else {
        setError(err.response?.data?.message || 'Gagal memuat data dari server backend Laravel.')
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    fetchDashboardData()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Toggle Task Completion (Real interaction with backend)
  const handleToggleTask = async (taskId, e) => {
    if (e) e.stopPropagation()
    try {
      await api.post(`/tasks/${taskId}/toggle`)
      // Refresh dashboard data to update KPI and status
      fetchDashboardData()
    } catch (err) {
      console.error('Error toggling task:', err)
      alert('Gagal memperbarui status tugas.')
    }
  }

  // Handle AI Question submission
  const submitAiQuestion = async (questionText) => {
    if (!questionText.trim() || aiLoading) return

    const question = questionText.trim()
    setAiInput('')
    setAiHistory((prev) => [...prev, { type: 'user', text: question }])
    setAiLoading(true)

    try {
      const res = await api.post('/ai/ask', { prompt: question, question })
      setAiHistory((prev) => [
        ...prev,
        {
          type: 'ai',
          answer: res.data.reply || res.data.answer || 'Analisis selesai.',
          mode: res.data.mode,
          recommendations: res.data.recommendations || []
        }
      ])
    } catch (err) {
      console.error('AI query error:', err)
      setAiHistory((prev) => [
        ...prev,
        {
          type: 'ai',
          answer: 'Maaf, terjadi kendala saat menghubungkan ke analitik AI PKM.',
          recommendations: ['Coba kembali dengan pertanyaan yang lebih spesifik.']
        }
      ])
    } finally {
      setAiLoading(false)
    }
  }

  const handleSendAi = (e) => {
    e.preventDefault()
    submitAiQuestion(aiInput)
  }

  // Auto scroll AI chat
  useEffect(() => {
    if (aiHistory.length > 0) {
      aiChatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [aiHistory])

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 size={32} className="animate-spin text-[#FF2F92]" />
        <p className="font-display text-lg uppercase tracking-wider text-[#171717]">
          MEMUAT DATA DASHBOARD DARI DATABASE...
        </p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="p-6 bg-[#FFD83D] border border-[#171717] rounded-md shadow-[4px_4px_0px_#171717] max-w-xl mx-auto my-8">
        <h2 className="font-display text-xl uppercase mb-2">Gagal Menghubungkan ke Backend</h2>
        <p className="text-xs font-semibold mb-3">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="px-3.5 py-1.5 bg-[#171717] text-white font-bold text-xs uppercase flex items-center gap-1.5 rounded cursor-pointer"
        >
          <RotateCcw size={13} /> Coba Lagi
        </button>
      </div>
    )
  }

  const kpi = data?.kpi || {
    active_projects: { value: 0, change: 'Aktif di sistem' },
    completed_projects: { value: 0, change: 'Proyek tuntas' },
    at_risk_projects: { value: 0, change: 'Kondisi aman' },
    pending_tasks: { value: 0, change: 'Antrean pekerjaan' },
    overdue_tasks: { value: 0, change: 'Nihil keterlambatan' },
    total_progress: 0
  }

  const trendData = data?.trend_data || []
  const donutData = data?.donut_data || [
    { name: 'On Track', value: 0, color: '#10B981' },
    { name: 'At Risk', value: 0, color: '#FBBF24' },
    { name: 'Delayed', value: 0, color: '#FF2F92' }
  ]

  const onTrackVal = donutData.find(d => d.name === 'On Track')?.value || 0
  const atRiskVal = donutData.find(d => d.name === 'At Risk')?.value || 0
  const delayedVal = donutData.find(d => d.name === 'Delayed')?.value || 0
  const totalDonut = onTrackVal + atRiskVal + delayedVal || 1
  const onTrackPct = Math.round((onTrackVal / totalDonut) * 100)
  const atRiskPct = Math.round((atRiskVal / totalDonut) * 100)
  const delayedPct = Math.round((delayedVal / totalDonut) * 100)

  const latestProjects = data?.latest_projects || []
  const priorityTasks = data?.priority_tasks || []
  const recentActivities = data?.recent_activities || []
  const riskProjects = data?.risk_projects || []

  const displayName = user?.name || 'Budi Santoso'
  const currentDate = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const currentTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'

  return (
    <div className="space-y-4 pb-6">
      {/* ================= 1. HEADER WELCOME ================= */}
      <PageHeader
        title={`SELAMAT DATANG, ${displayName.toUpperCase()}`}
        subtitle="Berikut adalah ringkasan performa bisnis, aktivitas tim, dan mitigasi risiko proyek hari ini."
        tag="DASHBOARD UTAMA"
        actions={
          <div
            onClick={() => navigate('/reports')}
            className="bg-white px-3.5 py-2 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center gap-2.5 cursor-pointer hover:bg-[#FFD83D]/30 transition-all"
            title="Buka Laporan & Kalender"
          >
            <Calendar size={16} strokeWidth={2.4} className="text-[#FF2F92]" />
            <div className="text-[10.5px] font-black text-[#171717] leading-tight">
              <p>{currentDate}</p>
              <p className="text-[9.5px] text-[#171717]/60 font-semibold">{currentTime}</p>
            </div>
            <ArrowRight size={13} strokeWidth={2.5} className="text-[#171717]/60 ml-0.5" />
          </div>
        }
      />

      {/* ================= 2. 5 KPI CARDS (D1: RESPONSIVE GRID & D5: COLOR HIERARCHY) ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-6 lg:grid-cols-5 gap-3 sm:gap-3.5">
        {/* Card 1: PROYEK AKTIF (White with Pink Accent - D5) */}
        <div
          onClick={() => navigate('/projects')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/projects')}
          className="col-span-2 sm:col-span-2 lg:col-span-1 p-3.5 sm:p-4 bg-white text-[#171717] border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col justify-between cursor-pointer hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#171717] transition-all"
          title="Klik untuk melihat seluruh Proyek Aktif"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[10.5px] font-black uppercase tracking-wider text-[#171717]/80">PROYEK AKTIF</span>
            <div className="w-6 h-6 rounded bg-[#FF2F92]/10 border border-[#FF2F92]/40 flex items-center justify-center">
              <Folder size={14} strokeWidth={2.4} className="text-[#FF2F92]" />
            </div>
          </div>
          <div className="my-1.5 flex items-baseline justify-between sm:block">
            <p className="font-display text-3xl sm:text-4xl leading-none text-[#171717]">
              {kpi.active_projects.value}
            </p>
            <p className="text-[10.5px] sm:text-[11px] font-bold text-[#FF2F92] flex items-center gap-1 sm:mt-1">
              <span>{kpi.active_projects.change}</span>
              <span className="text-xs">→</span>
            </p>
          </div>
        </div>

        {/* Card 2: PROYEK SELESAI (PKM Yellow) */}
        <div
          onClick={() => navigate('/projects?status=completed')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/projects?status=completed')}
          className="col-span-1 sm:col-span-2 lg:col-span-1 p-3.5 sm:p-4 bg-[#FFD83D] text-[#171717] border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col justify-between cursor-pointer hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#171717] transition-all"
          title="Klik untuk filter Proyek Selesai"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[10.5px] font-black uppercase tracking-wider text-[#171717]">PROYEK SELESAI</span>
            <CheckCircle2 size={16} strokeWidth={2.4} className="text-[#171717]" />
          </div>
          <div className="my-1.5">
            <p className="font-display text-3xl sm:text-4xl leading-none text-[#171717]">
              {kpi.completed_projects.value}
            </p>
            <p className="text-[10.5px] sm:text-[11px] font-bold text-[#171717]/80 flex items-center gap-1 mt-1">
              <span>{kpi.completed_projects.change}</span>
              <span className="text-xs">→</span>
            </p>
          </div>
        </div>

        {/* Card 3: BERISIKO TERLAMBAT (PKM Lavender) */}
        <div
          onClick={() => navigate('/projects?status=at_risk')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/projects?status=at_risk')}
          className="col-span-1 sm:col-span-2 lg:col-span-1 p-3.5 sm:p-4 bg-[#B8A0F0] text-[#171717] border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col justify-between cursor-pointer hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#171717] transition-all"
          title="Klik untuk memitigasi Proyek Berisiko"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[10.5px] font-black uppercase tracking-wider text-[#171717]">BERISIKO TERLAMBAT</span>
            <AlertTriangle size={16} strokeWidth={2.4} className="text-[#171717]" />
          </div>
          <div className="my-1.5">
            <p className="font-display text-3xl sm:text-4xl leading-none text-[#171717]">
              {kpi.at_risk_projects.value}
            </p>
            <p className="text-[10.5px] sm:text-[11px] font-bold text-[#171717]/80 flex items-center gap-1 mt-1">
              <span>{kpi.at_risk_projects.change}</span>
              <span className="text-xs">→</span>
            </p>
          </div>
        </div>

        {/* Card 4: TUGAS BELUM SELESAI (White) */}
        <div
          onClick={() => navigate('/tasks?filter=all')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/tasks?filter=all')}
          className="col-span-1 sm:col-span-3 lg:col-span-1 p-3.5 sm:p-4 bg-white text-[#171717] border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col justify-between cursor-pointer hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#171717] transition-all"
          title="Klik untuk melihat Tugas Belum Selesai"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[10.5px] font-black uppercase tracking-wider text-[#171717]">TUGAS BELUM SELESAI</span>
            <ClipboardList size={16} strokeWidth={2.4} className="text-[#171717]" />
          </div>
          <div className="my-1.5">
            <p className="font-display text-3xl sm:text-4xl leading-none text-[#171717]">
              {kpi.pending_tasks.value}
            </p>
            <p className="text-[10.5px] sm:text-[11px] font-bold text-[#171717]/75 flex items-center gap-1 mt-1">
              <span>{kpi.pending_tasks.change}</span>
              <span className="text-xs">→</span>
            </p>
          </div>
        </div>

        {/* Card 5: LEWAT DEADLINE (PKM Hot Pink - Sole Critical Alert - D5) */}
        <div
          onClick={() => navigate('/tasks?filter=overdue')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/tasks?filter=overdue')}
          className="col-span-1 sm:col-span-3 lg:col-span-1 p-3.5 sm:p-4 bg-[#FF2F92] text-white border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col justify-between cursor-pointer hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#171717] transition-all"
          title="Klik untuk menindaklanjuti Tugas Overdue"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[10.5px] font-black uppercase tracking-wider text-white">LEWAT DEADLINE</span>
            <Clock size={16} strokeWidth={2.4} className="text-white" />
          </div>
          <div className="my-1.5">
            <p className="font-display text-3xl sm:text-4xl leading-none text-white">
              {kpi.overdue_tasks.value}
            </p>
            <p className="text-[10.5px] sm:text-[11px] font-bold text-white/95 flex items-center gap-1 mt-1">
              <span>{kpi.overdue_tasks.change}</span>
              <span className="text-xs">→</span>
            </p>
          </div>
        </div>
      </div>

      {/* ================= 3. MAIN GRID (D4: BALANCED 7:5 OR 8:4 DESKTOP COLUMNS) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

        {/* LEFT COLUMN: CHARTS + 3 MODULAR BOTTOM CARDS */}
        <div className="lg:col-span-7 xl:col-span-8 min-w-0 space-y-4">

          {/* CARD: PROGRES PORTOFOLIO PROYEK (D3: BALANCED PROPORTIONS & LEGIBLE LABELS) */}
          <div className="bg-white p-3.5 sm:p-4 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
            {/* Top row: Title & Legend & Link */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#171717]/10 pb-2.5 mb-3">
              <h3 className="font-display text-sm sm:text-base uppercase tracking-tight text-[#171717]">
                PROGRES PORTOFOLIO PROYEK
              </h3>

              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 text-[10px] sm:text-[10.5px] font-bold">
                <span className="flex items-center gap-1 text-[#171717]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span> On Track {onTrackPct}% ({onTrackVal})
                </span>
                <span className="flex items-center gap-1 text-[#171717]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24]"></span> At Risk {atRiskPct}% ({atRiskVal})
                </span>
                <span className="flex items-center gap-1 text-[#171717]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF2F92]"></span> Delayed {delayedPct}% ({delayedVal})
                </span>
              </div>

              <button
                onClick={() => navigate('/projects')}
                className="text-[10.5px] font-black text-[#FF2F92] hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>Lihat Semua</span>
                <span className="text-xs">→</span>
              </button>
            </div>

            {/* Inner Content: Donut on Left (35%), Line Chart on Right (65%) */}
            <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-4 pt-1">
              {/* Donut Chart with Total Progres */}
              <div className="md:col-span-4 flex flex-col items-center justify-center relative py-2">
                <div className="w-[150px] h-[150px] relative flex items-center justify-center">
                  <PieChart width={150} height={150}>
                    <Pie
                      data={donutData}
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="#171717"
                      strokeWidth={1.5}
                      isAnimationActive={false}
                    >
                      {donutData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color || (index === 0 ? '#10B981' : index === 1 ? '#FFD83D' : '#FF2F92')}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="font-display text-2xl leading-none text-[#171717]">{kpi.total_progress}%</span>
                    <span className="text-[9.5px] font-black uppercase text-[#171717]/70 mt-1">Rata-rata Progres</span>
                  </div>
                </div>
              </div>

              {/* Line Chart: Tren Progress 7 Hari Terakhir */}
              <div className="md:col-span-8 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-[#171717]">
                    Tren Operasional 7 Hari Terakhir
                  </p>
                  <span
                    className="text-[9.5px] font-semibold text-[#171717]/60 bg-[#F5F1E9] border border-[#171717]/20 px-2 py-0.5 rounded"
                    title="Tren dihitung dari snapshot status proyek saat ini, bukan dari data historis yang disimpan per hari."
                  >
                    ⓘ Snapshot Status
                  </span>
                </div>
                <div className="h-36 sm:h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#EAE4D8" />
                      <XAxis dataKey="date" tick={{ fontSize: 9.5, fontWeight: 700, fill: '#171717' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9.5, fontWeight: 700, fill: '#171717' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#171717',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          padding: '6px 10px'
                        }}
                      />
                      <Line type="monotone" dataKey="on_track" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} name="On Track" />
                      <Line type="monotone" dataKey="at_risk" stroke="#FBBF24" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} name="At Risk" />
                      <Line type="monotone" dataKey="delayed" stroke="#FF2F92" strokeWidth={2.5} dot={{ r: 3, fill: '#FF2F92' }} isAnimationActive={false} name="Delayed" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* ROW: 3 MODULAR COLUMNS (D2: EQUALIZED STRETCH GRID, ZERO HANGING) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-stretch">

            {/* Col 1: Proyek Terbaru */}
            <div className="bg-white p-3.5 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between border-b border-[#171717]/10 pb-2 mb-2.5">
                  <h3 className="font-display text-xs uppercase text-[#171717] tracking-wide">PROYEK TERBARU</h3>
                  <button
                    onClick={() => navigate('/projects')}
                    className="text-[10px] font-bold text-[#171717]/70 hover:text-[#FF2F92] cursor-pointer"
                  >
                    Lihat Semua →
                  </button>
                </div>

                {latestProjects.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-[11px] font-bold text-[#171717]/50">Belum ada proyek aktif.</p>
                    <button onClick={() => navigate('/projects')} className="mt-2 text-[10px] font-black text-[#FF2F92] hover:underline">+ Buat Proyek Baru</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {latestProjects.slice(0, 4).map((proj) => {
                      const statusColor =
                        proj.status === 'on_track' ? 'bg-[#10B981] text-white' :
                        proj.status === 'at_risk' ? 'bg-[#FFD83D] text-[#171717]' :
                        proj.status === 'completed' ? 'bg-[#B8A0F0] text-[#171717]' :
                        'bg-[#FF2F92] text-white'

                      const statusLabel =
                        proj.status === 'on_track' ? 'On Track' :
                        proj.status === 'at_risk' ? 'At Risk' :
                        proj.status === 'completed' ? 'Selesai' : 'Delayed'

                      const IconComp =
                        proj.category === 'mobile' ? Smartphone :
                        proj.category === 'system' ? Laptop :
                        proj.category === 'code' ? Code2 : Globe

                      return (
                        <div
                          key={proj.id}
                          onClick={() => navigate(`/projects/${proj.id}`)}
                          className="p-2 border border-neutral-200 rounded-md bg-[#FAF7F2] hover:bg-[#FFF0F8] hover:border-[#FF2F92]/50 cursor-pointer transition-all"
                          title={proj.name}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <div className="w-5 h-5 bg-white border border-[#171717] rounded flex items-center justify-center text-[#171717] shrink-0">
                                <IconComp size={12} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold text-[#171717] leading-tight truncate" title={proj.name}>{proj.name}</p>
                                <p className="text-[9.5px] font-semibold text-[#171717]/60 truncate">{proj.code} • {proj.client}</p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <div className="flex-1 bg-neutral-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${proj.status === 'on_track' ? 'bg-[#10B981]' : proj.status === 'at_risk' ? 'bg-[#FBBF24]' : proj.status === 'completed' ? 'bg-[#B8A0F0]' : 'bg-[#FF2F92]'}`}
                                style={{ width: `${proj.progress ?? 0}%` }}
                              ></div>
                            </div>
                            <span className="text-[9px] font-black shrink-0">{proj.progress ?? 0}%</span>
                            <span className={`text-[8.5px] font-black px-1.5 py-0.2 border border-[#171717] rounded-sm shrink-0 ${statusColor}`}>
                              {statusLabel}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Col 2: Tugas Prioritas */}
            <div className="bg-white p-3.5 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between border-b border-[#171717]/10 pb-2 mb-2.5">
                  <h3 className="font-display text-xs uppercase text-[#171717] tracking-wide">TUGAS PRIORITAS</h3>
                  <button
                    onClick={() => navigate('/tasks')}
                    className="text-[10px] font-bold text-[#171717]/70 hover:text-[#FF2F92] cursor-pointer"
                  >
                    Lihat Semua →
                  </button>
                </div>

                {priorityTasks.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-[11px] font-bold text-[#171717]/50">Tidak ada tugas tertunda.</p>
                    <button onClick={() => navigate('/tasks')} className="mt-2 text-[10px] font-black text-[#FF2F92] hover:underline">Kelola Tugas</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {priorityTasks.slice(0, 5).map((task) => {
                      const priorityBadge =
                        task.priority === 'high' ? 'bg-[#FF2F92] text-white' :
                        task.priority === 'medium' ? 'bg-[#FFD83D] text-[#171717]' :
                        'bg-[#B8A0F0] text-[#171717]'

                      return (
                        <div
                          key={task.id}
                          className={`p-2 border border-neutral-200 rounded-md transition-all ${
                            task.is_completed ? 'bg-neutral-100 opacity-60' : 'bg-white hover:bg-[#FAF7F2]'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <button
                              onClick={(e) => handleToggleTask(task.id, e)}
                              className={`w-4 h-4 border border-[#171717] rounded flex items-center justify-center shrink-0 cursor-pointer mt-0.5 ${
                                task.is_completed ? 'bg-[#10B981] text-white' : 'bg-white hover:bg-[#FFD83D]'
                              }`}
                              title={task.is_completed ? "Tandai belum selesai" : "Tandai selesai"}
                            >
                              {task.is_completed && <Check size={11} strokeWidth={3} />}
                            </button>

                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => navigate(`/tasks?search=${encodeURIComponent(task.title)}`)}
                              title={task.title}
                            >
                              <p className={`text-[11px] font-bold text-[#171717] truncate leading-tight ${task.is_completed ? 'line-through text-[#171717]/40' : ''}`}>
                                {task.title}
                              </p>
                              <p className="text-[9.5px] font-semibold text-[#171717]/60 truncate">
                                {task.project?.name || 'PKM'} • {task.assignee_name || 'Belum Ditugaskan'}
                              </p>
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 border border-[#171717] rounded-sm ${priorityBadge}`}>
                                {task.priority}
                              </span>
                              {task.deadline && (
                                <span className="text-[8.5px] font-bold text-[#171717]/60">
                                  {new Date(task.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Col 3: Aktivitas Terbaru */}
            <div className="bg-white p-3.5 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between border-b border-[#171717]/10 pb-2 mb-2.5">
                  <h3 className="font-display text-xs uppercase text-[#171717] tracking-wide">AKTIVITAS TERBARU</h3>
                  <button
                    onClick={() => navigate('/reports')}
                    className="text-[10px] font-bold text-[#171717]/70 hover:text-[#FF2F92] cursor-pointer"
                  >
                    Lihat Semua →
                  </button>
                </div>

                {recentActivities.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-[11px] font-bold text-[#171717]/50">Belum ada aktivitas tercatat hari ini.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentActivities.slice(0, 5).map((act, index) => {
                      const avatarPalette = [
                        'bg-[#B8A0F0] text-[#171717]',
                        'bg-[#FFD83D] text-[#171717]',
                        'bg-[#FF2F92] text-white',
                        'bg-[#10B981] text-white',
                        'bg-[#FFB3D1] text-[#171717]'
                      ]
                      const avatarBg = avatarPalette[index % avatarPalette.length]
                      const initial = (act.user_name || '?').charAt(0).toUpperCase()

                      return (
                        <div key={act.id} className="flex items-start gap-2">
                          <div className={`w-5 h-5 rounded-full ${avatarBg} border border-[#171717] flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5`}>
                            {initial}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-[10.5px] text-[#171717] leading-tight">
                              <strong className="font-bold">{act.user_name || 'Sistem'}</strong>{' '}
                              <span className="text-[#171717]/75 line-clamp-1">{act.action}</span>
                            </p>
                            <p className="text-[9px] font-semibold text-[#171717]/50 mt-0.5 truncate">
                              {act.project_name ? `${act.project_name} • ` : ''}{act.time_ago || 'Baru saja'}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: AI BUSINESS ANALYST & RISIKO PROYEK (D4: BALANCED COMPOSITION) */}
        <div className="lg:col-span-5 xl:col-span-4 min-w-0 space-y-4" id="ai-panel">

          {/* CARD 1: AI BUSINESS ANALYST */}
          <div className="bg-white p-3.5 sm:p-4 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#171717]/10 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-[#FF2F92] text-white flex items-center justify-center font-black text-[10px] border border-[#171717]">
                  AI
                </span>
                <h3 className="font-display text-sm uppercase tracking-tight text-[#171717]">
                  AI BUSINESS ANALYST
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => navigate('/ai-analyst')}
                  className="text-[10px] font-black text-[#FF2F92] hover:underline flex items-center gap-1 cursor-pointer mr-1"
                  title="Buka halaman penuh AI Analyst"
                >
                  <span>Penuh</span>
                  <ExternalLink size={11} />
                </button>
                <button
                  onClick={() => setAiCollapsed(!aiCollapsed)}
                  className="p-1 text-[#171717]/60 hover:text-[#171717] hover:bg-[#F5F1E9] rounded cursor-pointer"
                  title={aiCollapsed ? "Buka panel AI" : "Ciutkan panel AI"}
                >
                  <Minus size={15} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {!aiCollapsed && (
              <>
                {/* Intro Greeting + AI Mode Badge */}
                <div className="p-3 bg-[#EBE5FB] border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] mb-3">
                  <p className="text-[11px] font-medium text-[#171717] leading-relaxed">
                    <strong>Halo! Saya AI Business Analyst PKM.</strong> Saya terhubung langsung ke basis data real-time untuk mengevaluasi risiko, beban kerja tim, dan target deadline.
                  </p>
                  {aiMode && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-white border border-[#171717] rounded text-[#171717]">
                        Mode:
                      </span>
                      <span className="text-[9.5px] font-bold text-[#171717]/75 truncate">{aiMode}</span>
                    </div>
                  )}
                </div>

                {/* Suggestion Chips Section */}
                <div className="mb-3">
                  <p className="text-[10px] font-black uppercase text-[#171717]/70 tracking-wider mb-2">
                    Pertanyaan yang bisa kamu coba:
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {SUGGESTION_PROMPTS.map((promptText, idx) => (
                      <button
                        key={idx}
                        onClick={() => submitAiQuestion(promptText)}
                        disabled={aiLoading}
                        className="text-left px-3 py-2 bg-white hover:bg-[#FFD83D]/40 border border-[#171717] rounded-md text-[10.5px] font-semibold text-[#171717] transition-colors cursor-pointer disabled:opacity-50 shadow-[1px_1px_0px_#171717]"
                      >
                        {promptText}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conversation Flow Area (if messages exist) */}
                {aiHistory.length > 0 && (
                  <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1 text-xs mb-3 border-t border-[#171717]/10 pt-2.5">
                    {aiHistory.map((msg, idx) => {
                      if (msg.type === 'user') {
                        return (
                          <div key={idx} className="flex justify-end">
                            <div className="p-2.5 bg-[#FAF7F2] border border-[#171717] rounded-md shadow-[1px_1px_0px_#171717] max-w-[92%] font-semibold text-[10.5px] text-[#171717] leading-snug">
                              {msg.text}
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div key={idx} className="space-y-1.5">
                          <div className="p-2.5 bg-white border border-[#171717] rounded-md shadow-[1px_1px_0px_#171717]">
                            <div className="flex items-center justify-between text-[#FF2F92] font-black text-[9.5px] uppercase mb-1">
                              <span className="flex items-center gap-1">
                                <Sparkles size={12} />
                                <span>Analisis PKM AI</span>
                              </span>
                              {msg.mode && (
                                <span className="text-[8.5px] px-1 py-0.2 bg-[#FAF7F2] border border-[#171717]/30 text-[#171717] rounded">
                                  {msg.mode}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-medium text-[#171717] leading-relaxed whitespace-pre-line">
                              {msg.answer}
                            </div>
                          </div>

                          {msg.recommendations && msg.recommendations.length > 0 && (
                            <div className="p-2.5 bg-[#FFB3D1]/40 border border-[#171717] rounded-md shadow-[1px_1px_0px_#171717]">
                              <p className="font-black text-[9.5px] uppercase text-[#171717] mb-1 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#FF2F92]"></span>
                                Rekomendasi
                              </p>
                              <ul className="space-y-0.5 text-[9px] font-bold text-[#171717]/90">
                                {msg.recommendations.map((rec, rIdx) => (
                                  <li key={rIdx} className="flex items-start gap-1">
                                    <span className="text-[#FF2F92]">•</span>
                                    <span>{rec}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {aiLoading && (
                      <div className="p-2.5 bg-white border border-[#171717] rounded flex items-center gap-2 text-[#171717]">
                        <Loader2 size={14} className="animate-spin text-[#FF2F92]" />
                        <span className="text-[10px] font-bold">AI sedang menganalisis data proyek...</span>
                      </div>
                    )}

                    <div ref={aiChatBottomRef}></div>
                  </div>
                )}

                {/* AI Input Form */}
                <form onSubmit={handleSendAi} className="mt-1 pt-2.5 border-t border-[#171717]/10">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      placeholder="Tulis pertanyaan tentang proyek, tugas, atau analisis..."
                      disabled={aiLoading}
                      className="w-full pl-3 pr-9 py-2 bg-white border border-[#171717] rounded-md text-xs font-semibold text-[#171717] placeholder:text-[#171717]/40 focus:outline-none focus:ring-1 focus:ring-[#FF2F92]"
                    />
                    <button
                      type="submit"
                      disabled={aiLoading || !aiInput.trim()}
                      className="absolute right-1.5 p-1.5 bg-[#FF2F92] text-white rounded border border-[#171717] hover:bg-[#e0267e] disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <Send size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* CARD 2: RISIKO PROYEK */}
          <div className="bg-white p-3.5 sm:p-4 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
            <div className="flex items-center justify-between border-b border-[#171717]/10 pb-2.5 mb-3">
              <h3 className="font-display text-sm uppercase tracking-tight text-[#171717]">
                RISIKO PROYEK
              </h3>
              <button
                onClick={() => navigate('/projects?status=at_risk')}
                className="text-[10.5px] font-black text-[#FF2F92] hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <span>Lihat Semua</span>
                <span className="text-xs">→</span>
              </button>
            </div>

            <div className="space-y-2">
              {riskProjects.length === 0 ? (
                <div className="p-4 text-center text-xs font-bold text-[#171717]/60 bg-[#FAF7F2] border border-neutral-200 rounded-md">
                  Tidak ada proyek berisiko saat ini. Seluruh jadwal berjalan aman.
                </div>
              ) : (
                riskProjects.map((proj) => {
                  const badgeColor =
                    proj.risk_level === 'high' ? 'bg-[#FF2F92] text-white' :
                    proj.risk_level === 'medium' ? 'bg-[#FFD83D] text-[#171717]' :
                    'bg-[#B8A0F0] text-[#171717]'

                  const IconAlert = proj.risk_level === 'low' ? CheckCircle2 : AlertTriangle

                  return (
                    <div
                      key={proj.id}
                      onClick={() => navigate(`/projects/${proj.id}`)}
                      className="p-2.5 border border-neutral-200 rounded-md bg-[#FAF7F2] hover:bg-[#FFF0F8] hover:border-[#FF2F92]/50 flex items-center justify-between gap-2.5 cursor-pointer transition-all"
                      title="Buka detail proyek"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-6 h-6 rounded-full ${badgeColor} border border-[#171717] flex items-center justify-center shrink-0`}>
                          <IconAlert size={12} strokeWidth={2.5} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11.5px] font-bold text-[#171717] leading-tight truncate">{proj.name}</p>
                          <p className="text-[9.5px] font-semibold text-[#171717]/60 truncate">
                            Deadline {proj.deadline ? new Date(proj.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </p>
                        </div>
                      </div>

                      <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 border border-[#171717] rounded-sm shrink-0 ${badgeColor}`}>
                        {proj.risk_level === 'high' ? 'High' : proj.risk_level === 'medium' ? 'Medium' : 'Low'}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
