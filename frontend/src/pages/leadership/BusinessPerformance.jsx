import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import {
  Activity,
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
  AlertCircle,
  HelpCircle,
  UserCheck,
  Building2,
  FileBarChart,
  Target,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  CheckSquare,
  ShieldCheck,
  AlertOctagon,
  FolderKanban,
  Zap,
  BarChart2,
  Award,
  HelpCircle as QuestionIcon
} from 'lucide-react'
import PageLoading from '../../components/ui/PageLoading'

const KPI_STATUS_THEME = {
  excellent: { label: 'Sangat Baik', bg: 'bg-[#10B981]', text: 'text-white', border: 'border-[#171717]', badge: 'bg-[#10B981]/20 text-[#047857] border-[#10B981]' },
  good:      { label: 'Baik',        bg: 'bg-[#3B82F6]', text: 'text-white', border: 'border-[#171717]', badge: 'bg-[#3B82F6]/20 text-[#1D4ED8] border-[#3B82F6]' },
  fair:      { label: 'Cukup',       bg: 'bg-[#FFD83D]', text: 'text-[#171717]', border: 'border-[#171717]', badge: 'bg-[#FFD83D]/30 text-[#B45309] border-[#D97706]' },
  critical:  { label: 'Kritis',      bg: 'bg-[#FF2F92]', text: 'text-white', border: 'border-[#171717]', badge: 'bg-[#FF2F92]/20 text-[#FF2F92] border-[#FF2F92]' },
  no_target: { label: 'Belum Ada',   bg: 'bg-[#EAE4D8]', text: 'text-[#171717]', border: 'border-[#171717]', badge: 'bg-[#EAE4D8] text-[#171717]/70 border-[#171717]' },
}

const CAPACITY_THEME = {
  ideal:         { label: 'Ideal (1-4 Tugas)',    bg: 'bg-[#10B981]/15 text-[#047857] border-[#10B981]' },
  overloaded:    { label: 'Overload (> 4 Tugas)', bg: 'bg-[#FF2F92]/15 text-[#FF2F92] border-[#FF2F92]' },
  underutilized: { label: 'Idle (0 Tugas)',       bg: 'bg-[#FFD83D]/20 text-[#B45309] border-[#D97706]' },
}

export default function BusinessPerformance() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [period, setPeriod] = useState(searchParams.get('period') || 'all_time')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [showFormulaModal, setShowFormulaModal] = useState(false)

  const abortControllerRef = useRef(null)

  const fetchPerformanceData = async (isManualRefresh = false) => {
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

      const res = await api.get(`/leadership/performance?period=${period}`, {
        signal: controller.signal,
      })

      if (res.data && res.data.success) {
        setData(res.data)
      } else {
        throw new Error(res.data?.message || 'Gagal memuat data KPI bisnis.')
      }
    } catch (err) {
      if (controller.signal.aborted) return
      console.error('Leadership Performance fetch error:', err)
      setError(
        err.response?.data?.message ||
        err.message ||
        'Terjadi kendala saat menghubungkan ke server analisis performa. Silakan coba lagi.'
      )
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod)
    setSearchParams(newPeriod === 'all_time' ? {} : { period: newPeriod })
  }

  useEffect(() => {
    fetchPerformanceData()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [period])

  if (loading) {
    return <PageLoading mode="page" text="Memuat Kinerja Bisnis & KPI..." subtext="Mengagregasi metrik efisiensi proyek, penyelesaian tugas, dan kapasitas tim." />
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="bg-[#FF2F92]/10 border-2 border-[#171717] shadow-[6px_6px_0px_#171717] p-6 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-[#FF2F92] mx-auto" />
          <h2 className="font-body font-black text-xl text-[#171717]">GAGAL MEMUAT DATA KPI</h2>
          <p className="font-body text-sm text-[#171717]/80 max-w-xl mx-auto">{error}</p>
          <button
            onClick={() => fetchPerformanceData(true)}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#FFD83D] border-2 border-[#171717] font-body font-bold text-sm shadow-[3px_3px_0px_#171717] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Coba Lagi
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return <PageLoading mode="page" text="Menyiapkan data kinerja bisnis..." />
  }

  const {
    meta = {},
    performance_overview = {},
    project_delivery = {},
    task_productivity = {},
    milestone_performance = {},
    team_workload = {},
    pm_evaluation = {},
    delivery_trend = [],
    performance_insights = [],
    financial_performance = {}
  } = data || {}

  const formatIDR = (val) => {
    if (val === null || val === undefined) return 'Rp 0'
    return 'Rp ' + Number(val).toLocaleString('id-ID')
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-12">
      {/* =========================================================================
          1. HEADER & PERIOD FILTER
         ========================================================================= */}
      <div className="bg-[#F5F1E9] border-2 border-[#171717] shadow-[6px_6px_0px_#171717] p-5 md:p-7 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 bg-[#FF2F92] text-white border-2 border-[#171717] font-mono font-black text-xs tracking-wider uppercase shadow-[2px_2px_0px_#171717]">
                PIMPINAN &middot; KINERJA BISNIS & KPI
              </span>
              <span className="text-xs font-mono text-[#171717]/60 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {meta?.as_of_date} &bull; {meta?.as_of_time}
              </span>
            </div>
            <h1 className="font-mono font-black text-2xl md:text-3xl lg:text-4xl text-[#171717] tracking-tight">
              KINERJA BISNIS &amp; KPI
            </h1>
            <p className="text-xs md:text-sm font-mono text-[#171717]/70 max-w-2xl">
              Pusat analisis efektivitas operasional, kecepatan pengiriman proyek, produktivitas kerja tim, dan ketepatan pencapaian target PT Potensi Karya Mandiri.
            </p>
          </div>

          {/* Action Bar & Period Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Period Switcher */}
            <div className="flex items-center border-2 border-[#171717] bg-[#EAE4D8] p-0.5 shadow-[2px_2px_0px_#171717]">
              <button
                onClick={() => handlePeriodChange('all_time')}
                className={`px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                  period === 'all_time' ? 'bg-[#171717] text-white shadow-[1px_1px_0px_#FFD83D]' : 'text-[#171717] hover:bg-white/50'
                }`}
              >
                Semua Waktu
              </button>
              <button
                onClick={() => handlePeriodChange('this_month')}
                className={`px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                  period === 'this_month' ? 'bg-[#171717] text-white shadow-[1px_1px_0px_#FFD83D]' : 'text-[#171717] hover:bg-white/50'
                }`}
              >
                Bulan Ini
              </button>
              <button
                onClick={() => handlePeriodChange('last_month')}
                className={`px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                  period === 'last_month' ? 'bg-[#171717] text-white shadow-[1px_1px_0px_#FFD83D]' : 'text-[#171717] hover:bg-white/50'
                }`}
              >
                Bulan Lalu
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchPerformanceData(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#EAE4D8] border-2 border-[#171717] font-mono font-bold text-xs shadow-[3px_3px_0px_#171717] hover:bg-[#FFD83D] active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50"
                title="Sinkronisasi data KPI"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? '...' : 'Muat Ulang'}
              </button>

              <button
                onClick={() => setShowFormulaModal(true)}
                className="inline-flex items-center gap-1 px-3 py-2 bg-white border-2 border-[#171717] font-mono font-bold text-xs shadow-[3px_3px_0px_#171717] hover:bg-[#B8A0F0] active:translate-x-[1px] active:translate-y-[1px] transition-all"
                title="Lihat Metodologi & Rumus KPI"
              >
                <QuestionIcon className="w-3.5 h-3.5 text-[#171717]" />
                <span className="hidden sm:inline">Definisi KPI</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          1B. FINANCIAL PERFORMANCE & BUDGET CONTROL KPI (P-K Integration)
         ========================================================================= */}
      {financial_performance?.kpis && (
        <div className="bg-white border-2 border-[#171717] shadow-[6px_6px_0px_#171717] p-5 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-2 border-[#171717]/10 gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#10B981]" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-mono font-black text-sm md:text-base tracking-wider uppercase text-[#171717]">
                    Kinerja Keuangan & Pengendalian Anggaran (Financial Control)
                  </h2>
                  <span
                    className="px-2 py-0.5 text-[10px] font-mono font-black uppercase border border-[#171717] rounded"
                    style={{
                      backgroundColor: financial_performance.health?.color || '#FFD83D',
                      color: financial_performance.health?.status === 'critical' ? '#FFFFFF' : '#171717'
                    }}
                  >
                    {financial_performance.health?.label}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-[#171717]/60">
                  {financial_performance.health?.description}
                </p>
              </div>
            </div>
            <a
              href="/financial"
              className="text-xs font-mono font-bold text-[#171717] bg-[#FFD83D] px-3 py-1.5 border-2 border-[#171717] shadow-[2px_2px_0px_#171717] hover:bg-[#f5cd2f] inline-flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>Detail Keuangan</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            {/* Target vs Actual Revenue */}
            <div className="p-4 bg-[#F5F1E9] border-2 border-[#171717] shadow-[3px_3px_0px_#171717] space-y-1">
              <span className="text-[10px] font-black uppercase text-[#171717]/60">Realisasi Pendapatan</span>
              <div className="text-xl font-black text-[#10B981]">
                {formatIDR(financial_performance.kpis.total_income)}
              </div>
              <div className="text-[11px] text-[#171717]/70">
                Target: {formatIDR(financial_performance.kpis.revenue_target)} ({financial_performance.kpis.revenue_achievement ?? 0}%)
              </div>
            </div>

            {/* Budget vs Actual Expense */}
            <div className="p-4 bg-[#F5F1E9] border-2 border-[#171717] shadow-[3px_3px_0px_#171717] space-y-1">
              <span className="text-[10px] font-black uppercase text-[#171717]/60">Realisasi Beban / Belanja</span>
              <div className="text-xl font-black text-[#FF2F92]">
                {formatIDR(financial_performance.kpis.total_expense)}
              </div>
              <div className="text-[11px] text-[#171717]/70">
                Pagu: {formatIDR(financial_performance.kpis.expense_budget)} ({financial_performance.kpis.budget_utilization ?? 0}%)
              </div>
            </div>

            {/* Net Operational Result */}
            <div className="p-4 bg-[#F5F1E9] border-2 border-[#171717] shadow-[3px_3px_0px_#171717] space-y-1">
              <span className="text-[10px] font-black uppercase text-[#171717]/60">Hasil Bersih (Net Result)</span>
              <div className={`text-xl font-black ${financial_performance.kpis.net_result >= 0 ? 'text-[#171717]' : 'text-[#FF2F92]'}`}>
                {formatIDR(financial_performance.kpis.net_result)}
              </div>
              <div className="text-[11px] text-[#171717]/70">
                {financial_performance.kpis.net_result >= 0 ? 'Surplus Operasional' : 'Defisit Anggaran'}
              </div>
            </div>

            {/* Variance & Alerts */}
            <div className="p-4 bg-[#FFD83D]/25 border-2 border-[#171717] shadow-[3px_3px_0px_#171717] space-y-1">
              <span className="text-[10px] font-black uppercase text-[#171717]/60">Deviasi & Peringatan</span>
              <div className="text-xl font-black text-[#171717]">
                {financial_performance.kpis.active_alerts ?? 0} Alert Aktif
              </div>
              <div className="text-[11px] text-[#FF2F92] font-bold">
                {financial_performance.kpis.critical_alerts ?? 0} Kritis Membutuhkan Tindakan
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          2. CORE KPI SCORECARDS (6 Strategic Metrics)
         ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono font-black text-xs md:text-sm tracking-wider uppercase text-[#171717] flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#FF2F92]" />
            Core Performance Indicators &middot; Periode: {meta?.period_label}
          </h2>
          <span className="text-[11px] font-mono text-[#171717]/60">
            Dihitung matematis langsung dari database aktual
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* KPI 1: Project Completion Rate */}
          {performance_overview?.project_completion_rate && (
            <div className="bg-white border-2 border-[#171717] shadow-[4px_4px_0px_#171717] p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-black tracking-wider uppercase text-[#171717]/60">
                    KPI 1 &middot; PROJECT DELIVERY
                  </span>
                  <span className={`px-2 py-0.2 text-[9px] font-mono font-black uppercase border ${
                    KPI_STATUS_THEME[performance_overview.project_completion_rate.status]?.badge || 'bg-[#EAE4D8]'
                  }`}>
                    {KPI_STATUS_THEME[performance_overview.project_completion_rate.status]?.label}
                  </span>
                </div>

                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl md:text-4xl font-mono font-black text-[#171717]">
                    {performance_overview.project_completion_rate.current}
                  </span>
                  <span className="text-lg font-mono font-bold text-[#171717]/60">%</span>
                </div>

                <h3 className="font-mono font-bold text-sm text-[#171717] mt-1">
                  Project Completion Rate
                </h3>
                <p className="text-[11px] font-mono text-[#171717]/70 mt-1 leading-relaxed">
                  {performance_overview.project_completion_rate.note}
                </p>
              </div>

              <div className="pt-2 border-t border-[#171717]/10 flex items-center justify-between text-[11px] font-mono text-[#171717]/70">
                <span>Total: {project_delivery?.total_projects} Proyek</span>
                <span className="font-bold text-[#10B981]">{project_delivery?.completed_projects} Selesai</span>
              </div>
            </div>
          )}

          {/* KPI 2: On-Time Delivery Rate */}
          {performance_overview?.on_time_delivery_rate && (
            <div className="bg-white border-2 border-[#171717] shadow-[4px_4px_0px_#171717] p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-black tracking-wider uppercase text-[#171717]/60">
                    KPI 2 &middot; SCHEDULE COMPLIANCE
                  </span>
                  <span className={`px-2 py-0.2 text-[9px] font-mono font-black uppercase border ${
                    KPI_STATUS_THEME[performance_overview.on_time_delivery_rate.status]?.badge || 'bg-[#EAE4D8]'
                  }`}>
                    {KPI_STATUS_THEME[performance_overview.on_time_delivery_rate.status]?.label}
                  </span>
                </div>

                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl md:text-4xl font-mono font-black text-[#10B981]">
                    {performance_overview.on_time_delivery_rate.current}
                  </span>
                  <span className="text-lg font-mono font-bold text-[#171717]/60">%</span>
                </div>

                <h3 className="font-mono font-bold text-sm text-[#171717] mt-1">
                  On-Time Delivery Rate
                </h3>
                <p className="text-[11px] font-mono text-[#171717]/70 mt-1 leading-relaxed">
                  {performance_overview.on_time_delivery_rate.note}
                </p>
              </div>

              <div className="pt-2 border-t border-[#171717]/10 flex items-center justify-between text-[11px] font-mono text-[#171717]/70">
                <span>Overdue: {task_productivity?.overdue_tasks} Tugas</span>
                <span className="font-bold text-[#3B82F6]">{project_delivery?.on_time_completed_count} Proyek Tepat Waktu</span>
              </div>
            </div>
          )}

          {/* KPI 3: Task Completion Rate */}
          {performance_overview?.task_completion_rate && (
            <div className="bg-white border-2 border-[#171717] shadow-[4px_4px_0px_#171717] p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-black tracking-wider uppercase text-[#171717]/60">
                    KPI 3 &middot; OPERATIONAL VELOCITY
                  </span>
                  <span className={`px-2 py-0.2 text-[9px] font-mono font-black uppercase border ${
                    KPI_STATUS_THEME[performance_overview.task_completion_rate.status]?.badge || 'bg-[#EAE4D8]'
                  }`}>
                    {KPI_STATUS_THEME[performance_overview.task_completion_rate.status]?.label}
                  </span>
                </div>

                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl md:text-4xl font-mono font-black text-[#171717]">
                    {performance_overview.task_completion_rate.current}
                  </span>
                  <span className="text-lg font-mono font-bold text-[#171717]/60">%</span>
                </div>

                <h3 className="font-mono font-bold text-sm text-[#171717] mt-1">
                  Task Completion Rate
                </h3>
                <p className="text-[11px] font-mono text-[#171717]/70 mt-1 leading-relaxed">
                  {performance_overview.task_completion_rate.note}
                </p>
              </div>

              <div className="pt-2 border-t border-[#171717]/10 flex items-center justify-between text-[11px] font-mono text-[#171717]/70">
                <span>{task_productivity?.completed_tasks} dari {task_productivity?.total_tasks} Selesai</span>
                <span className="font-bold text-[#FF2F92]">{task_productivity?.in_review_tasks} In Review</span>
              </div>
            </div>
          )}

          {/* KPI 4: Milestone Completion Rate */}
          {performance_overview?.milestone_completion_rate && (
            <div className="bg-white border-2 border-[#171717] shadow-[4px_4px_0px_#171717] p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-black tracking-wider uppercase text-[#171717]/60">
                    KPI 4 &middot; SPRINT READINESS
                  </span>
                  <span className={`px-2 py-0.2 text-[9px] font-mono font-black uppercase border ${
                    KPI_STATUS_THEME[performance_overview.milestone_completion_rate.status]?.badge || 'bg-[#EAE4D8]'
                  }`}>
                    {KPI_STATUS_THEME[performance_overview.milestone_completion_rate.status]?.label}
                  </span>
                </div>

                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl md:text-4xl font-mono font-black text-[#7C3AED]">
                    {performance_overview.milestone_completion_rate.current}
                  </span>
                  <span className="text-lg font-mono font-bold text-[#171717]/60">%</span>
                </div>

                <h3 className="font-mono font-bold text-sm text-[#171717] mt-1">
                  Milestone Completion Rate
                </h3>
                <p className="text-[11px] font-mono text-[#171717]/70 mt-1 leading-relaxed">
                  {performance_overview.milestone_completion_rate.note}
                </p>
              </div>

              <div className="pt-2 border-t border-[#171717]/10 flex items-center justify-between text-[11px] font-mono text-[#171717]/70">
                <span>{milestone_performance?.completed_milestones}/{milestone_performance?.total_milestones} Selesai</span>
                <span className="font-bold text-[#FF2F92]">{milestone_performance?.overdue_milestones} Overdue</span>
              </div>
            </div>
          )}

          {/* KPI 5: Project Target Achievement */}
          {performance_overview?.target_achievement_rate && (
            <div className="bg-white border-2 border-[#171717] shadow-[4px_4px_0px_#171717] p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-black tracking-wider uppercase text-[#171717]/60">
                    KPI 5 &middot; TARGET ACCURACY
                  </span>
                  <span className={`px-2 py-0.2 text-[9px] font-mono font-black uppercase border ${
                    KPI_STATUS_THEME[performance_overview.target_achievement_rate.status]?.badge || 'bg-[#EAE4D8]'
                  }`}>
                    {KPI_STATUS_THEME[performance_overview.target_achievement_rate.status]?.label}
                  </span>
                </div>

                <div className="flex items-baseline gap-2 mt-2">
                  <span className={`text-3xl md:text-4xl font-mono font-black ${
                    performance_overview.target_achievement_rate.current === null ? 'text-[#171717]/40' : 'text-[#B45309]'
                  }`}>
                    {performance_overview.target_achievement_rate.current ?? 'N/A'}
                  </span>
                  {performance_overview.target_achievement_rate.current !== null && (
                    <span className="text-lg font-mono font-bold text-[#171717]/60">%</span>
                  )}
                </div>

                <h3 className="font-mono font-bold text-sm text-[#171717] mt-1">
                  Project Target Achievement
                </h3>
                <p className="text-[11px] font-mono text-[#171717]/70 mt-1 leading-relaxed">
                  {performance_overview.target_achievement_rate.note}
                </p>
              </div>

              <div className="pt-2 border-t border-[#171717]/10 text-[11px] font-mono text-[#171717]/70">
                <span>Rasio rata-rata progres riil terhadap target tersimpan</span>
              </div>
            </div>
          )}

          {/* KPI 6: Team Workload Balance */}
          {performance_overview?.team_workload_balance && (
            <div className="bg-white border-2 border-[#171717] shadow-[4px_4px_0px_#171717] p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-black tracking-wider uppercase text-[#171717]/60">
                    KPI 6 &middot; RESOURCE HEALTH
                  </span>
                  <span className={`px-2 py-0.2 text-[9px] font-mono font-black uppercase border ${
                    KPI_STATUS_THEME[performance_overview.team_workload_balance.status]?.badge || 'bg-[#EAE4D8]'
                  }`}>
                    {KPI_STATUS_THEME[performance_overview.team_workload_balance.status]?.label}
                  </span>
                </div>

                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl md:text-4xl font-mono font-black text-[#2563EB]">
                    {performance_overview.team_workload_balance.current}
                  </span>
                  <span className="text-lg font-mono font-bold text-[#171717]/60">%</span>
                </div>

                <h3 className="font-mono font-bold text-sm text-[#171717] mt-1">
                  Team Workload Balance
                </h3>
                <p className="text-[11px] font-mono text-[#171717]/70 mt-1 leading-relaxed">
                  {performance_overview.team_workload_balance.note}
                </p>
              </div>

              <div className="pt-2 border-t border-[#171717]/10 flex items-center justify-between text-[11px] font-mono text-[#171717]/70">
                <span>{team_workload?.optimal_capacity_count} Kapasitas Ideal</span>
                <span className="font-bold text-[#FFD83D]">{team_workload?.underutilized_count} Idle</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          3. PROJECT DELIVERY PERFORMANCE & TASK PRODUCTIVITY (Side-by-Side)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Delivery Analysis */}
        <div className="bg-white border-2 border-[#171717] shadow-[6px_6px_0px_#171717] p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-[#171717] pb-3">
            <h3 className="font-mono font-black text-sm md:text-base text-[#171717] uppercase flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-[#FF2F92]" />
              Project Delivery Analysis
            </h3>
            <span className="text-[11px] font-mono text-[#171717]/60">Siklus Hidup Proyek</span>
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono">
            <div className="p-3 bg-[#F5F1E9] border border-[#171717]">
              <div className="text-[10px] uppercase font-bold text-[#171717]/60">Total Proyek</div>
              <div className="text-2xl font-black text-[#171717] mt-0.5">{project_delivery?.total_projects}</div>
              <div className="text-[10px] text-[#171717]/60 mt-1">
                {project_delivery?.active_projects} aktif &bull; {project_delivery?.completed_projects} selesai
              </div>
            </div>

            <div className="p-3 bg-[#F5F1E9] border border-[#171717]">
              <div className="text-[10px] uppercase font-bold text-[#171717]/60">Selesai Tepat Waktu</div>
              <div className="text-2xl font-black text-[#10B981] mt-0.5">{project_delivery?.on_time_completed_count}</div>
              <div className="text-[10px] text-[#171717]/60 mt-1">
                Kepatuhan: {project_delivery?.on_time_delivery_rate}%
              </div>
            </div>

            <div className="p-3 bg-[#F5F1E9] border border-[#171717] col-span-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#171717]/70">Rata-rata Durasi Penyelesaian Proyek:</span>
                <span className="font-bold text-sm text-[#171717]">
                  {project_delivery?.average_duration_days !== null ? `${project_delivery?.average_duration_days} Hari` : 'N/A'}
                </span>
              </div>
              <p className="text-[10px] text-[#171717]/50 mt-1">
                Dihitung dari selisih tanggal pembuatan proyek hingga tanggal selesai tuntas.
              </p>
            </div>
          </div>
        </div>

        {/* Task Productivity Matrix */}
        <div className="bg-white border-2 border-[#171717] shadow-[6px_6px_0px_#171717] p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-[#171717] pb-3">
            <h3 className="font-mono font-black text-sm md:text-base text-[#171717] uppercase flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-[#FF2F92]" />
              Task Productivity Matrix
            </h3>
            <span className="text-[11px] font-mono text-[#171717]/60">Operasional Tugas</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 font-mono text-center">
            <div className="p-2.5 bg-[#EAE4D8] border border-[#171717]">
              <div className="text-[9px] uppercase font-bold text-[#171717]/60">Selesai</div>
              <div className="text-xl font-black text-[#10B981] mt-0.5">{task_productivity?.completed_tasks}</div>
            </div>
            <div className="p-2.5 bg-[#EAE4D8] border border-[#171717]">
              <div className="text-[9px] uppercase font-bold text-[#171717]/60">In Progress</div>
              <div className="text-xl font-black text-[#3B82F6] mt-0.5">{task_productivity?.in_progress_tasks}</div>
            </div>
            <div className="p-2.5 bg-[#EAE4D8] border border-[#171717]">
              <div className="text-[9px] uppercase font-bold text-[#171717]/60">In Review</div>
              <div className="text-xl font-black text-[#FFD83D] mt-0.5">{task_productivity?.in_review_tasks}</div>
            </div>
            <div className="p-2.5 bg-[#EAE4D8] border border-[#171717]">
              <div className="text-[9px] uppercase font-bold text-[#171717]/60">Overdue</div>
              <div className="text-xl font-black text-[#FF2F92] mt-0.5">{task_productivity?.overdue_tasks}</div>
            </div>
            <div className="p-2.5 bg-[#EAE4D8] border border-[#171717]">
              <div className="text-[9px] uppercase font-bold text-[#171717]/60">Ada Revisi</div>
              <div className="text-xl font-black text-[#171717] mt-0.5">{task_productivity?.tasks_with_revisions}</div>
            </div>
            <div className="p-2.5 bg-[#EAE4D8] border border-[#171717]">
              <div className="text-[9px] uppercase font-bold text-[#171717]/60">Rata Durasi</div>
              <div className="text-xl font-black text-[#171717] mt-0.5">
                {task_productivity?.average_duration_days !== null ? `${task_productivity?.average_duration_days}h` : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          4. TEAM PRODUCTIVITY & WORKLOAD MATRIX
         ========================================================================= */}
      <div className="bg-white border-2 border-[#171717] shadow-[6px_6px_0px_#171717] p-5 md:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b-2 border-[#171717] pb-4">
          <div>
            <h2 className="font-mono font-black text-base md:text-lg text-[#171717] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#FF2F92]" />
              TEAM WORKLOAD &amp; CAPACITY DISTRIBUTION ({team_workload?.total_active_members} ANGGOTA)
            </h2>
            <p className="text-xs font-mono text-[#171717]/70 mt-0.5">
              Distribusi beban tugas operasional anggota tim untuk menjaga keseimbangan produktivitas tanpa risiko kejenuhan (burnout).
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="px-2.5 py-1 bg-[#10B981]/20 border border-[#10B981] text-[#047857] font-bold">
              {team_workload?.optimal_capacity_count} Ideal
            </span>
            <span className="px-2.5 py-1 bg-[#FFD83D]/30 border border-[#D97706] text-[#B45309] font-bold">
              {team_workload?.underutilized_count} Idle
            </span>
            <span className="px-2.5 py-1 bg-[#FF2F92]/20 border border-[#FF2F92] text-[#FF2F92] font-bold">
              {team_workload?.overloaded_count} Overload
            </span>
          </div>
        </div>

        {/* Workload Table */}
        <div className="overflow-x-auto border-2 border-[#171717]">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-[#171717] text-white uppercase tracking-wider">
                <th className="p-3 border-r border-[#333]">Nama Anggota</th>
                <th className="p-3 border-r border-[#333]">Departemen</th>
                <th className="p-3 border-r border-[#333] text-center">Total Tugas</th>
                <th className="p-3 border-r border-[#333] text-center">Selesai</th>
                <th className="p-3 border-r border-[#333] text-center">Aktif Pengerjaan</th>
                <th className="p-3 border-r border-[#333] text-center">In Review</th>
                <th className="p-3 border-r border-[#333] text-center">Overdue</th>
                <th className="p-3 text-center">Status Kapasitas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#171717] bg-white">
              {team_workload?.members_distribution?.map((m) => {
                const cTheme = CAPACITY_THEME[m.capacity_status] || CAPACITY_THEME.ideal
                return (
                  <tr key={m.member_id} className="hover:bg-[#F5F1E9] transition-colors">
                    <td className="p-3 border-r border-[#171717]">
                      <div className="font-bold text-[#171717]">{m.name}</div>
                      <div className="text-[10px] text-[#171717]/60">{m.email}</div>
                    </td>
                    <td className="p-3 border-r border-[#171717] text-[#171717]/70">
                      {m.department}
                    </td>
                    <td className="p-3 border-r border-[#171717] text-center font-bold">
                      {m.total_tasks}
                    </td>
                    <td className="p-3 border-r border-[#171717] text-center font-bold text-[#10B981]">
                      {m.completed_tasks}
                    </td>
                    <td className="p-3 border-r border-[#171717] text-center font-bold text-[#3B82F6]">
                      {m.active_tasks}
                    </td>
                    <td className="p-3 border-r border-[#171717] text-center font-bold text-[#FFD83D]">
                      {m.in_review_tasks}
                    </td>
                    <td className="p-3 border-r border-[#171717] text-center font-bold text-[#FF2F92]">
                      {m.overdue_tasks}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${cTheme.bg}`}>
                        {cTheme.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          5. PROJECT MANAGER OPERATIONAL EVALUATION (Single PM Model: Siti PM)
         ========================================================================= */}
      {pm_evaluation && (
        <div className="bg-white border-2 border-[#171717] shadow-[6px_6px_0px_#171717] p-5 md:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b-2 border-[#171717] pb-3">
            <h3 className="font-mono font-black text-sm md:text-base text-[#171717] uppercase flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#FF2F92]" />
              Project Manager Managerial Evaluation &middot; {pm_evaluation.pm_name}
            </h3>
            <span className="text-[11px] font-mono text-[#171717]/60">
              Model Tunggal: Evaluasi PM Operasional Utama PKM
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
            <div className="p-3 bg-[#F5F1E9] border border-[#171717]">
              <div className="text-[10px] uppercase font-bold text-[#171717]/60">Proyek Dikelola</div>
              <div className="text-2xl font-black text-[#171717] mt-0.5">{pm_evaluation.total_projects_managed}</div>
              <div className="text-[10px] text-[#171717]/60 mt-1">
                {pm_evaluation.on_track_projects} Tepat Waktu &bull; {pm_evaluation.delayed_projects} Terlambat
              </div>
            </div>

            <div className="p-3 bg-[#F5F1E9] border border-[#171717]">
              <div className="text-[10px] uppercase font-bold text-[#171717]/60">Rata Progres Proyek</div>
              <div className="text-2xl font-black text-[#10B981] mt-0.5">{pm_evaluation.average_project_progress}%</div>
              <div className="text-[10px] text-[#171717]/60 mt-1">
                Agregat proyek aktif
              </div>
            </div>

            <div className="p-3 bg-[#F5F1E9] border border-[#171717]">
              <div className="text-[10px] uppercase font-bold text-[#171717]/60">Laporan Diterbitkan</div>
              <div className="text-2xl font-black text-[#7C3AED] mt-0.5">{pm_evaluation.published_reports_count}</div>
              <div className="text-[10px] text-[#171717]/60 mt-1">
                Laporan Mingguan Terbit
              </div>
            </div>

            <div className="p-3 bg-[#F5F1E9] border border-[#171717]">
              <div className="text-[10px] uppercase font-bold text-[#171717]/60">Laporan Terakhir</div>
              <div className="text-sm font-black text-[#171717] mt-2">
                {pm_evaluation.latest_report_published_at ? new Date(pm_evaluation.latest_report_published_at).toLocaleDateString('id-ID') : 'Belum Ada'}
              </div>
              <div className="text-[10px] text-[#171717]/60 mt-1">
                Kepatuhan periodik
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          6. DELIVERY TREND (From Authentic Weekly Report Snapshots)
         ========================================================================= */}
      <div className="bg-white border-2 border-[#171717] shadow-[6px_6px_0px_#171717] p-5 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b-2 border-[#171717] pb-3">
          <h3 className="font-mono font-black text-sm md:text-base text-[#171717] uppercase flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#FF2F92]" />
            Delivery Trend &amp; Historical Snapshot
          </h3>
          <span className="text-[11px] font-mono text-[#171717]/60">
            Sumber: Snapshot Laporan Mingguan Terbit
          </span>
        </div>

        {delivery_trend?.has_sufficient_data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
            {delivery_trend.points.map((pt, idx) => (
              <div key={idx} className="p-3 bg-[#F5F1E9] border border-[#171717] space-y-1">
                <div className="text-[10px] font-bold text-[#FF2F92]">{pt.report_number}</div>
                <div className="font-bold text-xs text-[#171717]">{pt.period_label}</div>
                <div className="text-[11px] text-[#10B981] font-bold">Progres: {pt.actual_progress}%</div>
                <div className="text-[10px] text-[#171717]/60">
                  {pt.completed_tasks}/{pt.total_tasks} Tugas &bull; {pt.overdue_tasks} Overdue
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 bg-[#F5F1E9] border border-[#171717] text-center space-y-2 font-mono">
            <BarChart2 className="w-8 h-8 text-[#171717]/40 mx-auto" />
            <div className="font-bold text-xs text-[#171717] uppercase">HISTORICAL TREND SEDANG BERAKUMULASI</div>
            <p className="text-xs text-[#171717]/70 max-w-xl mx-auto leading-relaxed">
              {delivery_trend?.note}
            </p>
          </div>
        )}
      </div>

      {/* =========================================================================
          7. PERFORMANCE INSIGHTS & ACTIONABLE RECOMMENDATIONS
         ========================================================================= */}
      {performance_insights && performance_insights.length > 0 && (
        <div className="bg-white border-2 border-[#171717] shadow-[6px_6px_0px_#171717] p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-[#171717] pb-3">
            <h3 className="font-mono font-black text-sm md:text-base text-[#171717] uppercase flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FF2F92]" />
              Strategic Performance Insights &amp; Recommendations ({performance_insights.length})
            </h3>
            <span className="text-[11px] font-mono text-[#171717]/60">
              Analisis Otomatis Berbasis Aturan Bisnis
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {performance_insights.map((ins, idx) => (
              <div
                key={idx}
                className="bg-[#F5F1E9] border-2 border-[#171717] shadow-[3px_3px_0px_#171717] p-4 space-y-3 font-mono"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#171717]/15 pb-2">
                  <span className="font-bold text-xs text-[#171717] uppercase">
                    {ins.category}
                  </span>
                  <span className="text-[10px] text-[#171717]/60">
                    {ins.period}
                  </span>
                </div>

                <div className="p-2.5 bg-white border border-[#171717] text-xs space-y-1">
                  <div className="text-[10px] font-black uppercase text-[#FF2F92] flex items-center gap-1">
                    <AlertOctagon className="w-3 h-3" /> Fakta Database:
                  </div>
                  <p className="text-[11px] text-[#171717]/90 leading-relaxed">
                    {ins.factual_data}
                  </p>
                </div>

                <div className="p-2.5 bg-[#FFD83D]/20 border border-[#171717] text-xs space-y-1">
                  <div className="text-[10px] font-black uppercase text-[#B45309] flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Dampak Kinerja:
                  </div>
                  <p className="text-[11px] text-[#171717]/90 leading-relaxed">
                    {ins.business_impact}
                  </p>
                </div>

                <div className="p-2.5 bg-[#10B981]/15 border border-[#10B981] text-xs space-y-1">
                  <div className="text-[10px] font-black uppercase text-[#047857] flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Rekomendasi Tindak Lanjut:
                  </div>
                  <p className="text-[11px] text-[#171717]/90 leading-relaxed">
                    {ins.recommendation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          8. MODAL DEFINISI & RUMUS KPI
         ========================================================================= */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#171717]/70 backdrop-blur-xs">
          <div className="bg-[#F5F1E9] border-2 border-[#171717] shadow-[8px_8px_0px_#171717] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="bg-[#171717] text-white p-4 flex items-center justify-between border-b-2 border-[#171717]">
              <span className="font-mono font-black text-sm uppercase">Definisi &amp; Metodologi Rumus KPI</span>
              <button
                onClick={() => setShowFormulaModal(false)}
                className="px-2 py-0.5 bg-white text-[#171717] font-mono text-xs font-bold hover:bg-[#FFD83D]"
              >
                Tutup
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 font-mono text-xs text-[#171717]">
              <div className="p-3 bg-white border border-[#171717] space-y-1">
                <div className="font-black text-[#FF2F92] uppercase">1. Project Completion Rate</div>
                <div>Rumus: (Total Proyek Selesai / Total Seluruh Proyek) &times; 100%</div>
                <div className="text-[10px] text-[#171717]/60">Status: status = &apos;completed&apos;.</div>
              </div>

              <div className="p-3 bg-white border border-[#171717] space-y-1">
                <div className="font-black text-[#10B981] uppercase">2. On-Time Delivery Rate</div>
                <div>Rumus: (Item Selesai &le; Deadline / Item Selesai dengan Deadline Valid) &times; 100%</div>
                <div className="text-[10px] text-[#171717]/60">Mengevaluasi kepatuhan deadline proyek dan tugas yang telah diselesaikan.</div>
              </div>

              <div className="p-3 bg-white border border-[#171717] space-y-1">
                <div className="font-black text-[#3B82F6] uppercase">3. Task Completion Rate</div>
                <div>Rumus: (Tugas Selesai / Total Tugas) &times; 100%</div>
                <div className="text-[10px] text-[#171717]/60">Status: is_completed = true atau status in (&apos;completed&apos;, &apos;done&apos;).</div>
              </div>

              <div className="p-3 bg-white border border-[#171717] space-y-1">
                <div className="font-black text-[#7C3AED] uppercase">4. Milestone Completion Rate</div>
                <div>Rumus: (Milestone Selesai / Total Milestone) &times; 100%</div>
                <div className="text-[10px] text-[#171717]/60">Status: status = &apos;completed&apos;.</div>
              </div>

              <div className="p-3 bg-white border border-[#171717] space-y-1">
                <div className="font-black text-[#B45309] uppercase">5. Project Target Achievement</div>
                <div>Rumus: Rata-rata [min(100, (Actual Progress / Target Progress) &times; 100%)]</div>
                <div className="text-[10px] text-[#171717]/60">Hanya dihitung pada proyek dengan target progress tersimpan (&gt; 0). Target NULL dikecualikan.</div>
              </div>

              <div className="p-3 bg-white border border-[#171717] space-y-1">
                <div className="font-black text-[#171717] uppercase">6. Team Workload Balance</div>
                <div>Rumus: (Anggota dengan Kapasitas Ideal 1-4 Tugas / Total Anggota Aktif) &times; 100%</div>
                <div className="text-[10px] text-[#171717]/60">Mencegah terjadinya ketimpangan alokasi pekerjaan di antara anggota tim operasional.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
