import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import {
  ShieldCheck,
  TrendingUp,
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Loader2,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Calendar,
  Layers,
  Sparkles,
  Info,
  Activity,
  AlertCircle,
  HelpCircle,
  UserCheck,
  Building2,
  FileBarChart,
  Target,
  DollarSign,
  PieChart as PieIcon,
  Brain,
  Compass,
  Users,
  Zap,
  Award,
  Briefcase,
  ShieldAlert,
  ListChecks,
  Flame,
  ArrowUpRight,
  Database,
  Filter,
  Check,
  X
} from 'lucide-react'
import PageLoading from '../../components/ui/PageLoading'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from 'recharts'

const STATUS_THEME = {
  on_track:  { label: 'Tepat Waktu', bg: 'bg-[#10B981]', text: 'text-white', border: 'border-[#171717]', dot: '#10B981' },
  at_risk:   { label: 'Berisiko',    bg: 'bg-[#FFD83D]', text: 'text-[#171717]', border: 'border-[#171717]', dot: '#FBBF24' },
  delayed:   { label: 'Terlambat',   bg: 'bg-[#FF2F92]', text: 'text-white', border: 'border-[#171717]', dot: '#FF2F92' },
  completed: { label: 'Selesai',     bg: 'bg-[#B8A0F0]', text: 'text-[#171717]', border: 'border-[#171717]', dot: '#B8A0F0' },
}

export default function ExecutiveCommandCenter() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [biData, setBiData] = useState(null)
  const [actionSummary, setActionSummary] = useState(null)
  const [actionLoadingId, setActionLoadingId] = useState(null)
  const [actionCreatedSuccess, setActionCreatedSuccess] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [showFormulaInfo, setShowFormulaInfo] = useState(false)
  const [showDataSourceModal, setShowDataSourceModal] = useState(false)
  const [triageFilter, setTriageFilter] = useState('all')

  const abortControllerRef = useRef(null)

  const fetchData = async (isManualRefresh = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      if (isManualRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const [res, biRes, actRes] = await Promise.allSettled([
        api.get('/leadership/command-center', { signal: controller.signal }),
        api.get('/leadership/intelligence', { signal: controller.signal }),
        api.get('/leadership/actions/summary', { signal: controller.signal }),
      ])

      if (res.status === 'fulfilled' && res.value.data && res.value.data.success) {
        setData(res.value.data)
        setError(null)
      } else if (res.status === 'rejected') {
        throw new Error(res.reason?.response?.data?.message || res.reason?.message || 'Gagal memuat data eksekutif.')
      }

      if (biRes.status === 'fulfilled' && biRes.value.data && biRes.value.data.success) {
        setBiData(biRes.value.data)
      }

      if (actRes.status === 'fulfilled' && actRes.value.data && actRes.value.data.success) {
        setActionSummary(actRes.value.data.summary)
      }
    } catch (err) {
      if (controller.signal.aborted) return
      console.error('Leadership Command Center fetch error:', err)
      setError(
        err.response?.data?.message ||
        err.message ||
        'Terjadi kendala saat menghubungkan ke server eksekutif. Silakan coba lagi.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleCreateActionFromInsight = async (insight) => {
    try {
      setActionLoadingId(insight.id)
      const payload = {
        title: insight.title,
        summary: insight.summary,
        recommendation: insight.recommendation,
        source_id: String(insight.id),
        source_title: `BI Insight: ${insight.title}`,
        priority: insight.priority === 'critical' ? 'critical' : (insight.priority === 'high' ? 'high' : 'medium'),
        project_id: insight.project_id || null,
      }
      const res = await api.post('/leadership/actions/from-insight', payload)
      if (res.data?.success) {
        setActionCreatedSuccess({
          sourceId: String(insight.id),
          id: res.data.action?.id,
          code: res.data.action?.action_code,
          title: res.data.action?.title,
        })
        const sumRes = await api.get('/leadership/actions/summary')
        if (sumRes.data?.success) {
          setActionSummary(sumRes.data.summary)
        }
      }
    } catch (err) {
      console.error('Error creating action from insight:', err)
      alert(err.response?.data?.message || 'Gagal menerbitkan tindakan dari insight.')
    } finally {
      setActionLoadingId(null)
    }
  }

  useEffect(() => {
    fetchData()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Sapaan waktu hari
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 11) return 'Selamat Pagi'
    if (hour < 15) return 'Selamat Siang'
    if (hour < 18) return 'Selamat Sore'
    return 'Selamat Malam'
  }

  if (loading && !data) {
    return (
      <PageLoading
        mode="page"
        text="Memuat Executive Command Center 2.0..."
        subtext="Mengonsolidasi Company Health Index, sasaran strategis OKR, inisiatif, keuangan riil, risiko, dan pusat tindakan."
      />
    )
  }

  if (error && !data) {
    return (
      <div className="p-6 sm:p-8 bg-white border-2 border-[#171717] rounded-xl shadow-[4px_4px_0px_#171717] max-w-xl mx-auto my-12 text-center">
        <div className="w-12 h-12 rounded-full bg-[#FF2F92]/20 border border-[#FF2F92] flex items-center justify-center mx-auto mb-3 text-[#FF2F92]">
          <AlertTriangle size={24} />
        </div>
        <h3 className="font-display text-lg uppercase text-[#171717]">Koneksi Eksekutif Terputus</h3>
        <p className="text-xs sm:text-sm text-[#171717]/70 mt-1 mb-4">{error}</p>
        <button
          onClick={() => fetchData(false)}
          className="px-5 py-2.5 bg-[#171717] text-white font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_#171717] flex items-center gap-2 mx-auto cursor-pointer hover:bg-neutral-800 transition-colors"
        >
          <RotateCcw size={14} /> Coba Muat Ulang
        </button>
      </div>
    )
  }

  // Destructure real unified data
  const chi = data?.company_health_index || {}
  const portfolio = data?.portfolio_snapshot || {}
  const progressAnalysis = data?.progress_analysis || {}
  const radar = data?.attention_radar || []
  const reviewBacklog = data?.review_backlog || {}
  const feed = data?.executive_feed || []
  const trend = data?.historical_trend || {}
  const finSummary = data?.financial_summary || {}
  const finHealth = data?.financial_health || {}
  const strategicOkr = data?.strategic_okr || {}
  const strategicInitiatives = data?.strategic_initiatives || {}
  const riskDecision = data?.risk_decision_center || {}
  const execActions = data?.executive_actions || {}
  const priorityTriage = data?.priority_triage || []
  const aiInsights = data?.ai_insights || []
  const forecastGlance = data?.forecast_glance || {}
  const dataSources = data?.meta?.data_sources || {}

  const formatIDR = (val) => {
    if (val === null || val === undefined) return 'Rp 0'
    return 'Rp ' + Number(val).toLocaleString('id-ID')
  }

  const chiScore = typeof chi.score === 'number' ? chi.score : 0

  // Filter priority triage
  const filteredTriage = triageFilter === 'all'
    ? priorityTriage
    : priorityTriage.filter(item => item.category === triageFilter)

  const triageCounts = {
    all: priorityTriage.length,
    decision_needed: priorityTriage.filter(i => i.category === 'decision_needed').length,
    critical_risk: priorityTriage.filter(i => i.category === 'critical_risk').length,
    overdue_action: priorityTriage.filter(i => i.category === 'overdue_action').length,
    budget_alert: priorityTriage.filter(i => i.category === 'budget_alert').length,
    lagging_target: priorityTriage.filter(i => i.category === 'lagging_target').length,
    stalled_initiative: priorityTriage.filter(i => i.category === 'stalled_initiative').length,
  }

  return (
    <div className="space-y-6 pb-12">
      {/* =========================================================================
          A. EXECUTIVE HEADER & DATA FRESHNESS TRANSPARENCY
      ========================================================================= */}
      <div className="bg-white border-2 border-[#171717] rounded-xl p-4 sm:p-6 shadow-[3px_3px_0px_#171717] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-44 h-44 bg-[#FFD83D]/20 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider bg-[#171717] text-white rounded">
                EXECUTIVE COMMAND CENTER 2.0
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-[#10B981]">
                <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block animate-pulse" />
                Live Database Active
              </span>
              <button
                type="button"
                onClick={() => setShowDataSourceModal(true)}
                className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[#F5F1E9] hover:bg-[#FFD83D] text-[#171717] border border-[#171717] rounded flex items-center gap-1 cursor-pointer transition-colors"
                title="Lihat transparansi sumber data live"
              >
                <Database size={11} /> 7 Modul Terkoneksi
              </button>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-[#171717] tracking-tight leading-none uppercase">
              {getGreeting()}, {user?.name || 'Pimpinan'}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-[#171717]/70 mt-1">
              Pusat komando strategis dan pengambilan keputusan holistik PT Potensi Karya Mandiri.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3.5 py-2 bg-[#F5F1E9] border border-[#171717] rounded-lg text-right">
              <p className="text-[10px] font-bold uppercase text-[#171717]/60 leading-none">Pembaruan Terakhir</p>
              <p className="text-xs font-black text-[#171717] mt-0.5">
                {data?.meta?.as_of_time || 'Baru saja'} • {data?.meta?.as_of_date || ''}
              </p>
            </div>

            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="px-4 py-2.5 bg-[#FFD83D] hover:bg-[#e6c335] active:translate-y-0.5 text-[#171717] font-black text-xs uppercase border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              title="Perbarui data real-time"
            >
              <RotateCcw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Memperbarui...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          B. EXECUTIVE BUSINESS OVERVIEW (CHI 2.0 & 8 STRATEGIC DIMENSIONS)
      ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* B1. Company Health Index (CHI 2.0) Card */}
        <div className="lg:col-span-5 bg-white border-2 border-[#171717] rounded-xl p-5 sm:p-6 shadow-[3px_3px_0px_#171717] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#171717]/15">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#FF2F92]" />
                <h2 className="font-display text-sm sm:text-base uppercase tracking-wide text-[#171717]">
                  Company Health Index 2.0
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowFormulaInfo(!showFormulaInfo)}
                className="text-xs text-[#171717]/60 hover:text-[#171717] p-1 rounded hover:bg-[#F5F1E9] transition-colors cursor-pointer"
                title="Penjelasan Formula CHI"
              >
                <HelpCircle size={16} />
              </button>
            </div>

            {/* Formula Popover */}
            {showFormulaInfo && (
              <div className="mt-3 p-3 bg-[#F5F1E9] border border-[#171717] rounded-lg text-xs space-y-1.5 animate-in fade-in">
                <p className="font-bold text-[#171717]">Formula Standar CHI (Tahap P-A):</p>
                <code className="block bg-white p-1.5 border border-[#171717]/30 rounded font-mono text-[10.5px]">
                  CHI = (0.35 × S_proj) + (0.25 × S_sched) + (0.25 × S_deliv) + (0.15 × S_risk)
                </code>
                <p className="text-[11px] text-[#171717]/70">
                  Dihitung 100% dari data database aktual: rasio proyek on-track, ketepatan jadwal tugas, pencapaian target progres, dan mitigasi proyek berisiko.
                </p>
              </div>
            )}

            {/* Score Display Visual */}
            <div className="mt-5 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-5xl sm:text-6xl text-[#171717] leading-none">
                    {chiScore}
                  </span>
                  <span className="text-lg font-bold text-[#171717]/40">/100</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="px-2.5 py-0.5 rounded text-xs font-black uppercase border border-[#171717]"
                    style={{ backgroundColor: chi.badge?.color || '#FFD83D', color: chi.badge?.text === 'text-white' ? '#FFFFFF' : '#171717' }}
                  >
                    Kategori {chi.category || '—'}
                  </span>
                </div>
              </div>

              {/* Mini Visual Gauge Bar */}
              <div className="w-32 sm:w-40 flex flex-col items-end gap-1">
                <div className="w-full bg-[#EAE4D8] h-4 rounded-full border border-[#171717] overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${chiScore}%`,
                      backgroundColor: chi.badge?.color || '#FFD83D',
                    }}
                  />
                </div>
                <div className="w-full flex justify-between text-[9.5px] font-bold text-[#171717]/60 px-0.5">
                  <span>0 Kritis</span>
                  <span>60</span>
                  <span>90 Prima</span>
                </div>
              </div>
            </div>

            <p className="text-xs font-semibold text-[#171717]/80 mt-3 leading-relaxed">
              {chi.description || 'Indeks agregat performa operasional perusahaan.'}
            </p>
          </div>

          {/* CHI 4 Component Breakdown */}
          <div className="mt-5 pt-4 border-t border-[#171717]/15 space-y-2.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#171717]/60">
              Rincian 4 Komponen Perhitungan:
            </p>

            <div>
              <div className="flex justify-between text-[11px] font-bold text-[#171717]">
                <span>Status Proyek (Bobot 35%)</span>
                <span>{chi.components?.project?.score ?? 0}%</span>
              </div>
              <div className="w-full bg-[#EAE4D8] h-1.5 rounded-full overflow-hidden mt-1">
                <div className="bg-[#10B981] h-full" style={{ width: `${chi.components?.project?.score ?? 0}%` }} />
              </div>
              <p className="text-[10px] text-[#171717]/60 mt-0.5">{chi.components?.project?.metric}</p>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-bold text-[#171717]">
                <span>Ketepatan Jadwal Tugas (Bobot 25%)</span>
                <span>{chi.components?.schedule?.score ?? 0}%</span>
              </div>
              <div className="w-full bg-[#EAE4D8] h-1.5 rounded-full overflow-hidden mt-1">
                <div className="bg-[#3B82F6] h-full" style={{ width: `${chi.components?.schedule?.score ?? 0}%` }} />
              </div>
              <p className="text-[10px] text-[#171717]/60 mt-0.5">{chi.components?.schedule?.metric}</p>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-bold text-[#171717]">
                <span>Pencapaian Target Progres (Bobot 25%)</span>
                <span>{chi.components?.delivery?.score ?? 0}%</span>
              </div>
              <div className="w-full bg-[#EAE4D8] h-1.5 rounded-full overflow-hidden mt-1">
                <div className="bg-[#FFD83D] h-full" style={{ width: `${chi.components?.delivery?.score ?? 0}%` }} />
              </div>
              <p className="text-[10px] text-[#171717]/60 mt-0.5">{chi.components?.delivery?.metric}</p>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-bold text-[#171717]">
                <span>Pengendalian Risiko (Bobot 15%)</span>
                <span>{chi.components?.risk?.score ?? 0}%</span>
              </div>
              <div className="w-full bg-[#EAE4D8] h-1.5 rounded-full overflow-hidden mt-1">
                <div className="bg-[#FF2F92] h-full" style={{ width: `${chi.components?.risk?.score ?? 0}%` }} />
              </div>
              <p className="text-[10px] text-[#171717]/60 mt-0.5">{chi.components?.risk?.metric}</p>
            </div>
          </div>
        </div>

        {/* B2. 8 Strategic Performance Dimensions Grid */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2">
            <h3 className="font-display text-sm uppercase text-[#171717] tracking-wider flex items-center gap-2">
              <Layers size={16} className="text-[#FF2F92]" />
              8 Dimensi Kondisi Bisnis Terpadu
            </h3>
            <span className="text-[10.5px] font-bold text-[#10B981] flex items-center gap-1">
              <CheckCircle2 size={13} /> Sinkronisasi P-B s/d P-M
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* 1. Finansial */}
            <div
              onClick={() => navigate('/financial')}
              className="p-3.5 bg-white border-1.5 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717] hover:bg-[#FFD83D]/20 cursor-pointer transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-[#171717]/60 group-hover:text-[#171717]">
                  <span className="text-[9.5px] font-black uppercase">Finansial</span>
                  <ArrowUpRight size={13} />
                </div>
                <p className="font-display text-xl text-[#171717] mt-1 leading-none">
                  {finHealth.label || 'Stabil'}
                </p>
                <p className="text-[10px] font-semibold text-[#171717]/60 mt-1 truncate">
                  Net: {formatIDR(forecastGlance.net_cashflow)}
                </p>
              </div>
              <span className="text-[9px] font-bold text-[#10B981] mt-2 block font-mono">
                Runway: {forecastGlance.cashflow_runway_months || 12} bln
              </span>
            </div>

            {/* 2. Sasaran OKR */}
            <div
              onClick={() => navigate('/leadership/okr')}
              className="p-3.5 bg-white border-1.5 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717] hover:bg-[#FFD83D]/20 cursor-pointer transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-[#171717]/60 group-hover:text-[#171717]">
                  <span className="text-[9.5px] font-black uppercase">Sasaran OKR</span>
                  <ArrowUpRight size={13} />
                </div>
                <p className="font-display text-xl text-[#171717] mt-1 leading-none">
                  {strategicOkr.avg_progress ?? 0}%
                </p>
                <p className="text-[10px] font-semibold text-[#171717]/60 mt-1 truncate">
                  {strategicOkr.active_count ?? 0} Aktif | {strategicOkr.at_risk_count ?? 0} At Risk
                </p>
              </div>
              <span className="text-[9px] font-bold text-[#3B82F6] mt-2 block font-mono">
                {strategicOkr.total_key_results ?? 0} Key Results
              </span>
            </div>

            {/* 3. Portofolio Proyek */}
            <div
              onClick={() => navigate('/leadership/portfolio')}
              className="p-3.5 bg-white border-1.5 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717] hover:bg-[#FFD83D]/20 cursor-pointer transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-[#171717]/60 group-hover:text-[#171717]">
                  <span className="text-[9.5px] font-black uppercase">Portofolio</span>
                  <ArrowUpRight size={13} />
                </div>
                <p className="font-display text-xl text-[#171717] mt-1 leading-none">
                  {portfolio.active_projects || 0} Proyek
                </p>
                <p className="text-[10px] font-semibold text-[#10B981] mt-1 truncate">
                  {portfolio.on_track || 0} On-Track
                </p>
              </div>
              <span className={`text-[9px] font-bold mt-2 block font-mono ${(portfolio.delayed || 0) > 0 ? 'text-[#FF2F92]' : 'text-[#171717]/60'}`}>
                {portfolio.delayed || 0} Terlambat
              </span>
            </div>

            {/* 4. Inisiatif Strategis */}
            <div
              onClick={() => navigate('/leadership/initiatives')}
              className="p-3.5 bg-white border-1.5 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717] hover:bg-[#FFD83D]/20 cursor-pointer transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-[#171717]/60 group-hover:text-[#171717]">
                  <span className="text-[9.5px] font-black uppercase">Inisiatif</span>
                  <ArrowUpRight size={13} />
                </div>
                <p className="font-display text-xl text-[#171717] mt-1 leading-none">
                  {strategicInitiatives.active ?? 0} Aktif
                </p>
                <p className="text-[10px] font-semibold text-[#171717]/60 mt-1 truncate">
                  Progres: {strategicInitiatives.avg_progress ?? 0}%
                </p>
              </div>
              <span className="text-[9px] font-bold text-[#6D28D9] mt-2 block font-mono">
                Pagu: {formatIDR(strategicInitiatives.allocated_budget)}
              </span>
            </div>

            {/* 5. Risiko Bisnis */}
            <div
              onClick={() => navigate('/leadership/risks')}
              className="p-3.5 bg-white border-1.5 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717] hover:bg-[#FFD83D]/20 cursor-pointer transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-[#171717]/60 group-hover:text-[#171717]">
                  <span className="text-[9.5px] font-black uppercase">Profil Risiko</span>
                  <ArrowUpRight size={13} />
                </div>
                <p className={`font-display text-xl mt-1 leading-none ${(riskDecision.critical_risks || 0) > 0 ? 'text-[#FF2F92]' : 'text-[#171717]'}`}>
                  {riskDecision.total_active_risks ?? 0} Aktif
                </p>
                <p className="text-[10px] font-semibold text-[#FF2F92] mt-1 truncate">
                  {riskDecision.critical_risks ?? 0} Kritis | {riskDecision.high_risks ?? 0} Tinggi
                </p>
              </div>
              <span className="text-[9px] font-bold text-[#171717]/60 mt-2 block font-mono">
                {riskDecision.overdue_risks ?? 0} Overdue mitigasi
              </span>
            </div>

            {/* 6. Tindakan Eksekutif */}
            <div
              onClick={() => navigate('/executive-actions')}
              className="p-3.5 bg-white border-1.5 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717] hover:bg-[#FFD83D]/20 cursor-pointer transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-[#171717]/60 group-hover:text-[#171717]">
                  <span className="text-[9.5px] font-black uppercase">Action Center</span>
                  <ArrowUpRight size={13} />
                </div>
                <p className="font-display text-xl text-[#171717] mt-1 leading-none">
                  {execActions.active ?? 0} Tindakan
                </p>
                <p className="text-[10px] font-semibold text-[#FF2F92] mt-1 truncate">
                  {execActions.critical ?? 0} Kritis | {execActions.overdue ?? 0} Lewat
                </p>
              </div>
              <span className="text-[9px] font-bold text-[#10B981] mt-2 block font-mono">
                {execActions.completed ?? 0} Selesai
              </span>
            </div>

            {/* 7. Kapasitas & Tim */}
            <div
              onClick={() => navigate('/pm/workspace')}
              className="p-3.5 bg-white border-1.5 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717] hover:bg-[#FFD83D]/20 cursor-pointer transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-[#171717]/60 group-hover:text-[#171717]">
                  <span className="text-[9.5px] font-black uppercase">Kapasitas Tim</span>
                  <ArrowUpRight size={13} />
                </div>
                <p className="font-display text-xl text-[#171717] mt-1 leading-none">
                  {biData?.team_workload_intelligence?.overloaded_members_count ?? 0} Overload
                </p>
                <p className="text-[10px] font-semibold text-[#171717]/60 mt-1 truncate">
                  {reviewBacklog.total_in_review || 0} Review Antrean
                </p>
              </div>
              <span className="text-[9px] font-bold text-[#171717]/60 mt-2 block font-mono">
                {chi.components?.schedule?.score ?? 0}% On-time tasks
              </span>
            </div>

            {/* 8. Pertumbuhan & Klien */}
            <div
              onClick={() => navigate('/reports')}
              className="p-3.5 bg-white border-1.5 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717] hover:bg-[#FFD83D]/20 cursor-pointer transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-[#171717]/60 group-hover:text-[#171717]">
                  <span className="text-[9.5px] font-black uppercase">Pertumbuhan</span>
                  <ArrowUpRight size={13} />
                </div>
                <p className="font-display text-xl text-[#171717] mt-1 leading-none">
                  {forecastGlance.active_clients_count ?? 0} Klien
                </p>
                <p className="text-[10px] font-semibold text-[#171717]/60 mt-1 truncate">
                  Velocity: {forecastGlance.portfolio_velocity_status || 'Optimal'}
                </p>
              </div>
              <span className="text-[9px] font-bold text-[#10B981] mt-2 block font-mono">
                {portfolio.completed || 0} Delivered
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          C. PRIORITY & ATTENTION CENTER (HAL YANG MEMBUTUHKAN TINDAKAN PIMPINAN)
      ========================================================================= */}
      <div className="bg-white border-2 border-[#171717] rounded-xl p-5 sm:p-6 shadow-[3px_3px_0px_#171717]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#171717]/15 mb-4 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#FF2F92] text-white border border-[#171717] flex items-center justify-center shrink-0">
              <Flame size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-sm sm:text-base uppercase tracking-wide text-[#171717]">
                  Priority &amp; Attention Center
                </h2>
                <span className="px-2 py-0.5 text-[9.5px] font-black uppercase bg-[#FF2F92] text-white rounded">
                  {priorityTriage.length} Isu Terdeteksi
                </span>
              </div>
              <p className="text-[11px] font-semibold text-[#171717]/60">
                Pusat atensi eksekutif: keputusan tertunda, risiko kritis, deviasi anggaran, dan sasaran yang terhambat.
              </p>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-thin">
          <button
            onClick={() => setTriageFilter('all')}
            className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg border border-[#171717] shrink-0 cursor-pointer transition-all ${
              triageFilter === 'all'
                ? 'bg-[#171717] text-white shadow-[2px_2px_0px_#FFD83D]'
                : 'bg-[#F5F1E9] text-[#171717] hover:bg-white'
            }`}
          >
            Semua ({triageCounts.all})
          </button>
          <button
            onClick={() => setTriageFilter('decision_needed')}
            className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg border border-[#171717] shrink-0 cursor-pointer transition-all ${
              triageFilter === 'decision_needed'
                ? 'bg-[#171717] text-white shadow-[2px_2px_0px_#FFD83D]'
                : 'bg-[#F5F1E9] text-[#171717] hover:bg-white'
            }`}
          >
            Perlu Keputusan ({triageCounts.decision_needed})
          </button>
          <button
            onClick={() => setTriageFilter('critical_risk')}
            className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg border border-[#171717] shrink-0 cursor-pointer transition-all ${
              triageFilter === 'critical_risk'
                ? 'bg-[#171717] text-white shadow-[2px_2px_0px_#FFD83D]'
                : 'bg-[#F5F1E9] text-[#171717] hover:bg-white'
            }`}
          >
            Risiko Kritis ({triageCounts.critical_risk})
          </button>
          <button
            onClick={() => setTriageFilter('overdue_action')}
            className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg border border-[#171717] shrink-0 cursor-pointer transition-all ${
              triageFilter === 'overdue_action'
                ? 'bg-[#171717] text-white shadow-[2px_2px_0px_#FFD83D]'
                : 'bg-[#F5F1E9] text-[#171717] hover:bg-white'
            }`}
          >
            Tindakan Terlambat ({triageCounts.overdue_action})
          </button>
          <button
            onClick={() => setTriageFilter('budget_alert')}
            className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg border border-[#171717] shrink-0 cursor-pointer transition-all ${
              triageFilter === 'budget_alert'
                ? 'bg-[#171717] text-white shadow-[2px_2px_0px_#FFD83D]'
                : 'bg-[#F5F1E9] text-[#171717] hover:bg-white'
            }`}
          >
            Anomali Anggaran ({triageCounts.budget_alert})
          </button>
          <button
            onClick={() => setTriageFilter('lagging_target')}
            className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg border border-[#171717] shrink-0 cursor-pointer transition-all ${
              triageFilter === 'lagging_target'
                ? 'bg-[#171717] text-white shadow-[2px_2px_0px_#FFD83D]'
                : 'bg-[#F5F1E9] text-[#171717] hover:bg-white'
            }`}
          >
            Target Tertinggal ({triageCounts.lagging_target})
          </button>
        </div>

        {/* Triage Items List */}
        {filteredTriage.length === 0 ? (
          <div className="p-8 text-center bg-[#F5F1E9] border border-[#171717]/30 rounded-lg">
            <CheckCircle2 size={32} className="text-[#10B981] mx-auto mb-2" />
            <p className="font-display text-sm uppercase text-[#171717]">
              Tidak Ada Masalah Prioritas Pada Kategori Ini
            </p>
            <p className="text-xs text-[#171717]/60 mt-0.5">
              Seluruh metrik dan alur operasional pada filter ini berada dalam toleransi normal.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTriage.map((item) => {
              const severityBg =
                item.severity === 'critical'
                  ? 'bg-[#FF2F92] text-white'
                  : item.severity === 'high'
                  ? 'bg-[#FFD83D] text-[#171717]'
                  : 'bg-[#B8A0F0] text-[#171717]'

              return (
                <div
                  key={item.id}
                  className="p-4 bg-[#F5F1E9] border-1.5 border-[#171717] rounded-xl hover:bg-white transition-all space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border border-[#171717] ${severityBg}`}>
                        {item.severity === 'critical' ? 'Kritis' : item.severity === 'high' ? 'Tinggi' : 'Peringatan'}
                      </span>
                      <span className="text-[9.5px] font-bold uppercase px-2 py-0.5 rounded bg-white border border-[#171717]/40 text-[#171717]">
                        {item.category_label}
                      </span>
                      <span className="text-[9.5px] font-bold text-[#171717]/60">
                        Sumber: {item.source_module}
                      </span>
                    </div>

                    <div className="text-[11px] font-bold text-[#171717]/70">
                      Penanggung Jawab: <span className="text-[#171717] font-black">{item.target_name}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-[#171717]">
                      {item.title}
                    </h4>
                    <p className="text-xs font-semibold text-[#171717]/80 mt-0.5">
                      {item.reason}
                    </p>
                  </div>

                  <div className="pt-1 flex items-center justify-end">
                    <button
                      onClick={() => navigate(item.deep_link)}
                      className="px-3.5 py-1.5 bg-[#FFD83D] hover:bg-[#f7cc24] active:translate-y-0.5 border border-[#171717] rounded shadow-[2px_2px_0px_#171717] text-xs font-black text-[#171717] flex items-center gap-1.5 cursor-pointer transition-transform"
                    >
                      <span>{item.action_label}</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          D. STRATEGIC PERFORMANCE INTEGRATION (HUBUNGAN LINTAS MODUL)
      ========================================================================= */}
      <div className="bg-white border-2 border-[#171717] rounded-xl p-5 sm:p-6 shadow-[3px_3px_0px_#171717]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#171717]/15 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <Compass size={18} className="text-[#3B82F6]" />
            <div>
              <h2 className="font-display text-sm sm:text-base uppercase tracking-wide text-[#171717]">
                Integrasi Performa Strategis Lintas Modul
              </h2>
              <p className="text-[11px] font-semibold text-[#171717]/60">
                Pimpinan dapat meninjau keterhubungan antara sasaran strategis, proyek deliverable, anggaran, dan mitigasi risiko.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Matrix 1: OKR & Proyek */}
          <div className="p-4 bg-[#F5F1E9] border-1.5 border-[#171717] rounded-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase text-[#171717]/60">1. Target vs Proyek</span>
                <Target size={15} className="text-[#3B82F6]" />
              </div>
              <h4 className="font-display text-sm uppercase text-[#171717]">
                Sasaran &amp; Realisasi Proyek
              </h4>
              <p className="text-xs font-semibold text-[#171717]/70 mt-1 leading-relaxed">
                {strategicOkr.active_count ?? 0} sasaran aktif diselaraskan dengan proyek portofolio berjalan.
              </p>
              <div className="my-3 space-y-1">
                <div className="flex justify-between text-[11px] font-bold">
                  <span>Pencapaian OKR:</span>
                  <span className="font-mono">{strategicOkr.avg_progress ?? 0}%</span>
                </div>
                <div className="w-full bg-white h-2 rounded-full border border-[#171717] overflow-hidden">
                  <div className="bg-[#3B82F6] h-full" style={{ width: `${strategicOkr.avg_progress ?? 0}%` }} />
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/leadership/okr')}
              className="text-xs font-bold text-[#171717] underline hover:text-[#3B82F6] inline-flex items-center gap-1 cursor-pointer"
            >
              Kelola OKR Strategis &rarr;
            </button>
          </div>

          {/* Matrix 2: Anggaran vs Realisasi Riil */}
          <div className="p-4 bg-[#F5F1E9] border-1.5 border-[#171717] rounded-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase text-[#171717]/60">2. Anggaran vs Realisasi</span>
                <DollarSign size={15} className="text-[#10B981]" />
              </div>
              <h4 className="font-display text-sm uppercase text-[#171717]">
                Pagu vs Arus Kas Transaksi
              </h4>
              <p className="text-xs font-semibold text-[#171717]/70 mt-1 leading-relaxed">
                Utilisasi anggaran operasional {finSummary.budget_utilization ?? 0}% dengan status {finSummary.variance_status || 'On Track'}.
              </p>
              <div className="my-3 space-y-1">
                <div className="flex justify-between text-[11px] font-bold">
                  <span>Realisasi Pengeluaran:</span>
                  <span className="font-mono">{formatIDR(finSummary.total_expense)}</span>
                </div>
                <div className="w-full bg-white h-2 rounded-full border border-[#171717] overflow-hidden">
                  <div className="bg-[#10B981] h-full" style={{ width: `${Math.min(100, finSummary.budget_utilization || 0)}%` }} />
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/financial')}
              className="text-xs font-bold text-[#171717] underline hover:text-[#10B981] inline-flex items-center gap-1 cursor-pointer"
            >
              Kelola Keuangan &rarr;
            </button>
          </div>

          {/* Matrix 3: Inisiatif & Kapasitas Tim */}
          <div className="p-4 bg-[#F5F1E9] border-1.5 border-[#171717] rounded-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase text-[#171717]/60">3. Inisiatif &amp; Kapasitas</span>
                <Briefcase size={15} className="text-[#6D28D9]" />
              </div>
              <h4 className="font-display text-sm uppercase text-[#171717]">
                Inisiatif &amp; Alokasi Personil
              </h4>
              <p className="text-xs font-semibold text-[#171717]/70 mt-1 leading-relaxed">
                {strategicInitiatives.active ?? 0} inisiatif aktif menggerakkan strategi jangka menengah PT PKM.
              </p>
              <div className="my-3 space-y-1">
                <div className="flex justify-between text-[11px] font-bold">
                  <span>Progres Rata-Rata:</span>
                  <span className="font-mono">{strategicInitiatives.avg_progress ?? 0}%</span>
                </div>
                <div className="w-full bg-white h-2 rounded-full border border-[#171717] overflow-hidden">
                  <div className="bg-[#6D28D9] h-full" style={{ width: `${strategicInitiatives.avg_progress ?? 0}%` }} />
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/leadership/initiatives')}
              className="text-xs font-bold text-[#171717] underline hover:text-[#6D28D9] inline-flex items-center gap-1 cursor-pointer"
            >
              Kelola Inisiatif &rarr;
            </button>
          </div>

          {/* Matrix 4: Risiko & Keputusan */}
          <div className="p-4 bg-[#F5F1E9] border-1.5 border-[#171717] rounded-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase text-[#171717]/60">4. Risiko &amp; Keputusan</span>
                <ShieldAlert size={15} className="text-[#FF2F92]" />
              </div>
              <h4 className="font-display text-sm uppercase text-[#171717]">
                Mitigasi Risiko &amp; Keputusan
              </h4>
              <p className="text-xs font-semibold text-[#171717]/70 mt-1 leading-relaxed">
                {riskDecision.total_decisions ?? 0} keputusan formal mengawal mitigasi risiko strategis.
              </p>
              <div className="my-3 space-y-1">
                <div className="flex justify-between text-[11px] font-bold">
                  <span>Keputusan Menunggu:</span>
                  <span className="font-mono text-[#FF2F92]">{riskDecision.pending_decisions ?? 0} pending</span>
                </div>
                <div className="w-full bg-white h-2 rounded-full border border-[#171717] overflow-hidden">
                  <div className="bg-[#FF2F92] h-full" style={{ width: `${Math.min(100, (riskDecision.pending_decisions || 0) * 20)}%` }} />
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/leadership/risks')}
              className="text-xs font-bold text-[#171717] underline hover:text-[#FF2F92] inline-flex items-center gap-1 cursor-pointer"
            >
              Buka Risk &amp; Decision Center &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          E. EXECUTIVE ACTION CENTER & KEPUTUSAN PIMPINAN (P-M & P-E DUAL PANEL)
      ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* E1. Keputusan Pimpinan Sedang Berjalan */}
        <div className="lg:col-span-6 bg-white border-2 border-[#171717] rounded-xl p-5 sm:p-6 shadow-[3px_3px_0px_#171717] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#171717]/15 mb-3">
              <div className="flex items-center gap-2">
                <Award size={18} className="text-[#FFD83D]" />
                <div>
                  <h3 className="font-display text-sm sm:text-base uppercase tracking-wide text-[#171717]">
                    Keputusan Pimpinan Sedang Berjalan
                  </h3>
                  <p className="text-[10.5px] font-semibold text-[#171717]/60">
                    Otorisasi strategis dan pelacakan implementasi keputusan Pimpinan.
                  </p>
                </div>
              </div>

              <span className="px-2 py-0.5 bg-[#FFD83D] text-[#171717] text-[10px] font-black rounded border border-[#171717]">
                {riskDecision.pending_decisions || 0} Aktif
              </span>
            </div>

            {!riskDecision.recent_decisions || riskDecision.recent_decisions.length === 0 ? (
              <div className="p-6 text-center bg-[#F5F1E9] border border-[#171717]/20 rounded-lg">
                <CheckCircle2 size={24} className="text-[#10B981] mx-auto mb-1" />
                <p className="text-xs font-bold uppercase text-[#171717]">Tidak Ada Keputusan Tertunda</p>
                <p className="text-[11px] text-[#171717]/60">Seluruh arahan pimpinan telah selesai diimplementasikan.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {riskDecision.recent_decisions.map((dec) => (
                  <div
                    key={dec.id}
                    onClick={() => navigate('/leadership/risks')}
                    className="p-3 bg-[#F5F1E9] border border-[#171717] rounded-lg hover:bg-white cursor-pointer transition-all space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-[10px] text-[#171717]/70">{dec.decision_number}</span>
                      <div className="flex items-center gap-1.5">
                        {dec.is_overdue && (
                          <span className="px-1.5 py-0.2 text-[9px] font-black bg-[#FF2F92] text-white rounded">
                            LEWAT TENGGAT
                          </span>
                        )}
                        <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase bg-white border border-[#171717]/30 rounded">
                          {dec.status}
                        </span>
                      </div>
                    </div>
                    <h5 className="font-bold text-xs text-[#171717] line-clamp-1">{dec.title}</h5>
                    <div className="flex items-center justify-between text-[10.5px] text-[#171717]/60">
                      <span>PIC: {dec.pic_name}</span>
                      <span>Tenggat: {dec.due_date || '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#171717]/15 mt-3">
            <button
              onClick={() => navigate('/leadership/risks')}
              className="text-xs font-bold text-[#171717] hover:underline flex items-center gap-1 cursor-pointer"
            >
              Lihat Seluruh Keputusan di Risk &amp; Decision Center &rarr;
            </button>
          </div>
        </div>

        {/* E2. Pusat Tindakan Eksekutif (P-M) */}
        <div className="lg:col-span-6 bg-white border-2 border-[#171717] rounded-xl p-5 sm:p-6 shadow-[3px_3px_0px_#171717] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#171717]/15 mb-3">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-[#FF2F92] fill-[#FF2F92]" />
                <div>
                  <h3 className="font-display text-sm sm:text-base uppercase tracking-wide text-[#171717]">
                    Tindakan Eksekutif Terkini (P-M)
                  </h3>
                  <p className="text-[10.5px] font-semibold text-[#171717]/60">
                    Eksekusi langsung dari temuan anomali bisnis ke PIC operasional.
                  </p>
                </div>
              </div>

              <span className="px-2 py-0.5 bg-[#FF2F92] text-white text-[10px] font-black rounded border border-[#171717]">
                {execActions.active ?? 0} Aktif
              </span>
            </div>

            {!execActions.recent_actions || execActions.recent_actions.length === 0 ? (
              <div className="p-6 text-center bg-[#F5F1E9] border border-[#171717]/20 rounded-lg">
                <CheckCircle2 size={24} className="text-[#10B981] mx-auto mb-1" />
                <p className="text-xs font-bold uppercase text-[#171717]">Tidak Ada Tindakan Aktif</p>
                <p className="text-[11px] text-[#171717]/60">Semua tindakan eksekutif telah tuntas diselesaikan.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {execActions.recent_actions.map((act) => (
                  <div
                    key={act.id}
                    onClick={() => navigate('/executive-actions')}
                    className="p-3 bg-[#F5F1E9] border border-[#171717] rounded-lg hover:bg-white cursor-pointer transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-[10px] text-[#171717]/70">{act.action_code}</span>
                      <div className="flex items-center gap-1.5">
                        {act.priority === 'critical' && (
                          <span className="px-1.5 py-0.2 text-[9px] font-black bg-[#FF2F92] text-white rounded">
                            KRITIS
                          </span>
                        )}
                        {act.is_overdue && (
                          <span className="px-1.5 py-0.2 text-[9px] font-black bg-[#FFD83D] text-[#171717] rounded">
                            OVERDUE
                          </span>
                        )}
                        <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase bg-white border border-[#171717]/30 rounded">
                          {act.status}
                        </span>
                      </div>
                    </div>
                    <h5 className="font-bold text-xs text-[#171717] line-clamp-1">{act.title}</h5>
                    <div className="w-full bg-white h-1.5 rounded-full border border-[#171717]/30 overflow-hidden">
                      <div className="bg-[#10B981] h-full" style={{ width: `${act.progress}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[10.5px] text-[#171717]/60">
                      <span>PIC: {act.assigned_to_name}</span>
                      <span>Progres: {act.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#171717]/15 mt-3 flex items-center justify-between">
            <button
              onClick={() => navigate('/executive-actions')}
              className="text-xs font-bold text-[#171717] hover:underline flex items-center gap-1 cursor-pointer"
            >
              Buka Action Center Lengkap &rarr;
            </button>
            <span className="text-[10px] font-bold text-[#10B981]">
              {execActions.completed ?? 0} Selesai Terevaluasi
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          F. AI EXECUTIVE INSIGHT (P-F INTEGRATION - 100% REAL DETERMINISTIC CONTEXT)
      ========================================================================= */}
      <div className="bg-white border-2 border-[#171717] rounded-xl p-5 sm:p-6 shadow-[3px_3px_0px_#171717]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#171717]/15 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FFD83D] border-1.5 border-[#171717] flex items-center justify-center text-[#171717]">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="font-display text-sm sm:text-base uppercase tracking-wide text-[#171717]">
                AI Executive Strategic Insight
              </h2>
              <p className="text-[11px] font-semibold text-[#171717]/60">
                Temuan penting, potensi masalah, dan rekomendasi keputusan dari agregasi data bisnis aktual.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/leadership/ai-advisor')}
            className="px-3 py-1.5 bg-[#FFD83D] hover:bg-[#ffc800] text-[#171717] border border-[#171717] rounded shadow-[2px_2px_0px_#171717] text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Brain size={14} />
            <span>Buka AI Executive Advisor</span>
          </button>
        </div>

        {aiInsights.length === 0 ? (
          <div className="p-6 bg-[#F5F1E9] border border-[#171717]/30 rounded-lg text-center">
            <Info size={24} className="text-[#3B82F6] mx-auto mb-1" />
            <p className="text-xs font-bold uppercase text-[#171717]">Wawasan Strategis Sedang Berjalan</p>
            <p className="text-xs text-[#171717]/60 mt-0.5">
              Data bisnis aktual sedang dianalisis oleh Executive Advisor.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aiInsights.slice(0, 3).map((ins) => (
              <div
                key={ins.id}
                className="p-4 bg-[#F5F1E9] border-1.5 border-[#171717] rounded-xl flex flex-col justify-between space-y-2 hover:bg-white transition-all"
              >
                <div>
                  <div className="flex items-center justify-between text-[9px] font-black uppercase mb-1">
                    <span className="px-2 py-0.5 bg-white border border-[#171717]/30 rounded text-[#171717]">
                      {ins.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded border border-[#171717] ${
                      ins.priority === 'critical' ? 'bg-[#FF2F92] text-white' : 'bg-[#FFD83D] text-[#171717]'
                    }`}>
                      {ins.priority}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs sm:text-sm text-[#171717] leading-snug">
                    {ins.title}
                  </h4>
                  <p className="text-xs font-semibold text-[#171717]/70 mt-1 line-clamp-3 leading-relaxed">
                    {ins.summary}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#171717]/10 text-[11px] text-[#171717]">
                  <p className="font-bold text-[10px] text-[#171717]/60 uppercase">Rekomendasi:</p>
                  <p className="font-semibold text-[#171717] line-clamp-2">{ins.recommended_action}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =========================================================================
          G. BUSINESS INTELLIGENCE LINTAS MODUL (P-L INTEGRATION)
      ========================================================================= */}
      <div className="bg-white border-2 border-[#171717] rounded-xl p-5 sm:p-6 shadow-[3px_3px_0px_#171717]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#171717]/15 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FFD83D] border-1.5 border-[#171717] flex items-center justify-center text-[#171717]">
              <Brain size={18} />
            </div>
            <div>
              <h2 className="font-display text-sm sm:text-base uppercase tracking-wide text-[#171717]">
                Business Intelligence Lintas Modul
              </h2>
              <p className="text-[11px] font-semibold text-[#171717]/60">
                Korelasi performa proyek, transaksi keuangan riil, kapasitas tim, dan target sasaran strategis.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black px-2.5 py-1 bg-[#171717] text-white rounded">
              {biData?.cross_module_insights?.total_insights ?? 0} Anomali &amp; Rekomendasi
            </span>
            {(biData?.cross_module_insights?.critical_count ?? 0) > 0 && (
              <span className="text-[10px] font-black px-2 py-0.5 bg-[#FF2F92] text-white rounded border border-[#171717]">
                {biData.cross_module_insights.critical_count} Kritis
              </span>
            )}
          </div>
        </div>

        {/* Intelligence Cross-Module Overview Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className="p-3 bg-[#F5F1E9] border border-[#171717] rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={15} className="text-[#171717]" />
              <span className="text-[10.5px] font-black uppercase text-[#171717]/70">Proyek &amp; Biaya Riil</span>
            </div>
            <p className="font-display text-lg text-[#171717]">
              {biData?.project_finance_correlation?.total_tracked_projects ?? 0} Proyek
            </p>
            <p className="text-[10px] font-semibold text-[#171717]/60 mt-0.5">
              Realisasi pengeluaran riil terlacak via transaksi
            </p>
          </div>

          <div className="p-3 bg-[#F5F1E9] border border-[#171717] rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Users size={15} className="text-[#FF2F92]" />
              <span className="text-[10.5px] font-black uppercase text-[#171717]/70">Kapasitas &amp; Bottleneck Tim</span>
            </div>
            <p className="font-display text-lg text-[#171717]">
              {biData?.team_workload_intelligence?.overloaded_members_count ?? 0} Personil Overload
            </p>
            <p className="text-[10px] font-semibold text-[#171717]/60 mt-0.5">
              Dari {biData?.team_workload_intelligence?.total_members ?? 0} total anggota tim aktif
            </p>
          </div>

          <div className="p-3 bg-[#F5F1E9] border border-[#171717] rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Compass size={15} className="text-[#10B981]" />
              <span className="text-[10.5px] font-black uppercase text-[#171717]/70">Keselarasan Strategis</span>
            </div>
            <p className="font-display text-lg text-[#171717]">
              {biData?.strategic_alignment?.aligned_objectives_count ?? 0} / {biData?.strategic_alignment?.total_objectives ?? 0} Objective
            </p>
            <p className="text-[10px] font-semibold text-[#171717]/60 mt-0.5">
              Telah diselaraskan dengan inisiatif strategis
            </p>
          </div>
        </div>

        {/* Actionable Insights List */}
        {!biData?.cross_module_insights?.insights || biData.cross_module_insights.insights.length === 0 ? (
          <div className="p-6 text-center bg-[#F5F1E9] border border-[#171717]/30 rounded-lg">
            <CheckCircle2 size={32} className="text-[#10B981] mx-auto mb-2" />
            <p className="font-display text-sm uppercase text-[#171717]">Tidak Ada Penyimpangan Kritis Lintas Modul</p>
            <p className="text-xs text-[#171717]/60 mt-0.5">
              Seluruh metrik proyek, beban kerja tim, transaksi keuangan, dan sasaran strategis berada dalam batas toleransi normal.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {biData.cross_module_insights.insights.map((insight) => {
              const priorityBg =
                insight.priority === 'critical'
                  ? 'bg-[#FF2F92] text-white'
                  : insight.priority === 'high'
                  ? 'bg-[#FFD83D] text-[#171717]'
                  : 'bg-[#B8A0F0] text-[#171717]'

              return (
                <div
                  key={insight.id}
                  className="p-4 bg-[#F5F1E9] border-1.5 border-[#171717] rounded-lg hover:bg-white transition-all space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border border-[#171717] ${priorityBg}`}>
                        {insight.priority}
                      </span>
                      <span className="text-[9.5px] font-bold uppercase px-2 py-0.5 rounded bg-white border border-[#171717]/40 text-[#171717]">
                        Modul: {insight.source_module}
                      </span>
                      <h4 className="font-bold text-xs sm:text-sm text-[#171717]">
                        {insight.title}
                      </h4>
                    </div>

                    {insight.metric_value !== undefined && insight.metric_value !== null && (
                      <div className="px-2.5 py-1 bg-white border border-[#171717] rounded text-right shrink-0">
                        <span className="text-[9.5px] font-bold text-[#171717]/60 uppercase mr-1.5">
                          {insight.metric_label}:
                        </span>
                        <span className="font-mono font-black text-xs text-[#FF2F92]">
                          {insight.metric_value}
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs font-semibold text-[#171717]/80 leading-relaxed">
                    {insight.summary}
                  </p>

                  <div className="p-2.5 bg-white border-l-3 border-l-[#171717] border border-[#171717]/20 rounded-r-md text-[11px] text-[#171717] font-medium flex items-start gap-2">
                    <Sparkles size={14} className="text-[#FFD83D] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black uppercase tracking-wider text-[10px] text-[#171717]/70 block">
                        Rekomendasi Tindakan:
                      </span>
                      <span className="text-[#171717] font-semibold">{insight.recommendation}</span>
                    </div>
                  </div>

                  {/* Insight-to-Action Action Trigger */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-[#171717]/10">
                    {actionCreatedSuccess?.sourceId === String(insight.id) ? (
                      <div className="flex items-center gap-2 text-xs font-bold text-[#10B981]">
                        <CheckCircle2 size={15} />
                        <span>Tindakan diterbitkan ({actionCreatedSuccess.code})</span>
                        <button
                          onClick={() => navigate('/executive-actions')}
                          className="underline hover:text-[#171717] font-black cursor-pointer text-[11px]"
                        >
                          Buka Detail &rarr;
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-[#171717]/50 font-medium">
                        Dapat langsung didelegasikan ke PIC / PM dengan tenggat terukur
                      </span>
                    )}

                    <button
                      type="button"
                      disabled={actionLoadingId === insight.id}
                      onClick={() => handleCreateActionFromInsight(insight)}
                      className="px-3 py-1.5 bg-[#FFD83D] hover:bg-[#ffc800] active:translate-y-0.5 border border-[#171717] rounded shadow-[2px_2px_0px_#171717] text-xs font-black text-[#171717] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all sm:ml-auto"
                      title="Terbitkan tindakan eksekutif dari anomali/rekomendasi ini"
                    >
                      {actionLoadingId === insight.id ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Menerbitkan...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={13} className="fill-[#171717]" />
                          <span>Tindak Lanjuti Menjadi Action</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          H. HISTORICAL TREND (SNAPSHOT LAPORAN MINGGUAN OTENTIK)
      ========================================================================= */}
      <div className="bg-white border-2 border-[#171717] rounded-xl p-5 sm:p-6 shadow-[3px_3px_0px_#171717]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#171717]/15 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-[#10B981]" />
            <div>
              <h2 className="font-display text-sm sm:text-base uppercase tracking-wide text-[#171717]">
                Historical Trend Portofolio
              </h2>
              <p className="text-[11px] font-semibold text-[#171717]/60">
                Dihitung dari snapshot laporan mingguan terbitan resmi Project Manager (Tanpa Data Sintetis).
              </p>
            </div>
          </div>

          <span className="text-[10px] font-bold px-2.5 py-1 bg-[#171717] text-white rounded self-start sm:self-auto">
            {trend.available_periods_count || 0} Periode Tersedia
          </span>
        </div>

        {trend.has_sufficient_data && trend.periods?.length > 1 ? (
          <div className="space-y-4">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend.periods} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#171717" strokeOpacity={0.1} />
                  <XAxis dataKey="period_label" stroke="#171717" fontSize={11} fontWeight={600} />
                  <YAxis stroke="#171717" fontSize={11} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1.5px solid #171717',
                      borderRadius: '6px',
                      boxShadow: '3px 3px 0px #171717',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  />
                  <Bar dataKey="avg_portfolio_progress" name="Rata-Rata Progres (%)" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-[#171717]/70 text-center font-semibold">{trend.message}</p>
          </div>
        ) : (
          <div className="p-6 bg-[#F5F1E9] border border-[#171717]/30 rounded-lg text-center space-y-2">
            <Info size={24} className="text-[#FFD83D] mx-auto" />
            <p className="font-bold text-xs uppercase text-[#171717]">Akumulasi Tren Historis Sedang Berjalan</p>
            <p className="text-xs text-[#171717]/70 max-w-lg mx-auto">
              {trend.message || 'Data historis multi-periode akan tersaji secara otomatis seiring diterbitkannya laporan mingguan baru oleh Project Manager.'}
            </p>
            <div className="pt-2">
              <button
                onClick={() => navigate('/reports')}
                className="px-3.5 py-1.5 bg-white border border-[#171717] rounded shadow-[2px_2px_0px_#171717] text-xs font-bold text-[#171717] hover:bg-[#FFD83D]/40 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <FileBarChart size={13} /> Lihat Arsip Laporan Mingguan
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          DATA FRESHNESS & SOURCE TRANSPARENCY MODAL
      ========================================================================= */}
      {showDataSourceModal && (
        <div className="fixed inset-0 z-50 bg-[#171717]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#171717] max-w-lg w-full p-6 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#171717]/15">
              <div className="flex items-center gap-2">
                <Database size={20} className="text-[#FF2F92]" />
                <h3 className="font-display text-base uppercase text-[#171717]">
                  Transparansi Sumber Data Live
                </h3>
              </div>
              <button
                onClick={() => setShowDataSourceModal(false)}
                className="w-7 h-7 rounded bg-[#F5F1E9] border border-[#171717] flex items-center justify-center hover:bg-[#FF2F92] hover:text-white cursor-pointer transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-xs font-semibold text-[#171717]/70 leading-relaxed">
              Executive Command Center 2.0 tersambung secara otomatis ke 7 modul strategis dan operasional tanpa manipulasi atau data sintetis:
            </p>

            <div className="space-y-2 text-xs font-semibold">
              <div className="p-2.5 bg-[#F5F1E9] border border-[#171717] rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#171717]">Proyek &amp; Tugas:</span>
                  <p className="text-[10.5px] text-[#171717]/60">Tabel `projects`, `tasks`, `milestones`</p>
                </div>
                <span className="px-2 py-0.5 bg-[#10B981] text-white text-[9.5px] font-black rounded">Aktif</span>
              </div>

              <div className="p-2.5 bg-[#F5F1E9] border border-[#171717] rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#171717]">Keuangan Riil:</span>
                  <p className="text-[10.5px] text-[#171717]/60">Tabel `financial_transactions`, `financial_budgets`</p>
                </div>
                <span className="px-2 py-0.5 bg-[#10B981] text-white text-[9.5px] font-black rounded">Aktif</span>
              </div>

              <div className="p-2.5 bg-[#F5F1E9] border border-[#171717] rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#171717]">Sasaran Strategis OKR:</span>
                  <p className="text-[10.5px] text-[#171717]/60">Tabel `strategic_objectives`, `strategic_key_results`</p>
                </div>
                <span className="px-2 py-0.5 bg-[#10B981] text-white text-[9.5px] font-black rounded">Aktif</span>
              </div>

              <div className="p-2.5 bg-[#F5F1E9] border border-[#171717] rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#171717]">Inisiatif Strategis:</span>
                  <p className="text-[10.5px] text-[#171717]/60">Tabel `strategic_initiatives`, `resource_allocations`</p>
                </div>
                <span className="px-2 py-0.5 bg-[#10B981] text-white text-[9.5px] font-black rounded">Aktif</span>
              </div>

              <div className="p-2.5 bg-[#F5F1E9] border border-[#171717] rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#171717]">Risiko &amp; Keputusan:</span>
                  <p className="text-[10.5px] text-[#171717]/60">Tabel `strategic_risks`, `executive_decisions`</p>
                </div>
                <span className="px-2 py-0.5 bg-[#10B981] text-white text-[9.5px] font-black rounded">Aktif</span>
              </div>

              <div className="p-2.5 bg-[#F5F1E9] border border-[#171717] rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#171717]">Tindakan Eksekutif:</span>
                  <p className="text-[10.5px] text-[#171717]/60">Tabel `executive_actions`, `action_histories`</p>
                </div>
                <span className="px-2 py-0.5 bg-[#10B981] text-white text-[9.5px] font-black rounded">Aktif</span>
              </div>

              <div className="p-2.5 bg-[#F5F1E9] border border-[#171717] rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#171717]">AI Advisor Context:</span>
                  <p className="text-[10.5px] text-[#171717]/60">Deterministic Rule Engine &amp; DB Metrics</p>
                </div>
                <span className="px-2 py-0.5 bg-[#10B981] text-white text-[9.5px] font-black rounded">Aktif</span>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowDataSourceModal(false)}
                className="px-4 py-2 bg-[#171717] text-white font-bold text-xs uppercase rounded shadow-[2px_2px_0px_#171717] cursor-pointer"
              >
                Tutup Informasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
