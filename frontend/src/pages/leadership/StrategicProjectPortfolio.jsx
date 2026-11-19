import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import {
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
  Search,
  Filter,
  ArrowUpDown,
  X,
  ShieldAlert,
  ShieldCheck,
  ListFilter,
  CheckSquare,
  AlertOctagon,
  TrendingUp,
  LayoutGrid,
  Table as TableIcon
} from 'lucide-react'
import PageLoading from '../../components/ui/PageLoading'

const STATUS_THEME = {
  on_track:  { label: 'Tepat Waktu', bg: 'bg-[#10B981]', text: 'text-white', border: 'border-[#171717]', dot: '#10B981' },
  at_risk:   { label: 'Berisiko',    bg: 'bg-[#FFD83D]', text: 'text-[#171717]', border: 'border-[#171717]', dot: '#FBBF24' },
  delayed:   { label: 'Terlambat',   bg: 'bg-[#FF2F92]', text: 'text-white', border: 'border-[#171717]', dot: '#FF2F92' },
  completed: { label: 'Selesai',     bg: 'bg-[#B8A0F0]', text: 'text-[#171717]', border: 'border-[#171717]', dot: '#B8A0F0' },
}

const RISK_THEME = {
  high:     { label: 'Risiko Tinggi',   bg: 'bg-[#FF2F92]/20', border: 'border-[#FF2F92]', text: 'text-[#FF2F92]' },
  medium:   { label: 'Risiko Sedang',   bg: 'bg-[#FFD83D]/30', border: 'border-[#D97706]', text: 'text-[#B45309]' },
  low:      { label: 'Risiko Rendah',   bg: 'bg-[#10B981]/20', border: 'border-[#10B981]', text: 'text-[#047857]' },
  none:     { label: 'Tanpa Risiko',    bg: 'bg-[#EAE4D8]',    border: 'border-[#171717]', text: 'text-[#171717]' },
}

export default function StrategicProjectPortfolio() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all')
  const [riskFilter, setRiskFilter] = useState('all')
  const [pmFilter, setPmFilter] = useState('all')
  const [sortBy, setSortBy] = useState('progress_desc') // 'progress_desc', 'progress_asc', 'deadline_asc', 'variance_asc', 'risk_desc'
  const [viewMode, setViewMode] = useState('table') // 'table' | 'cards'
  const [selectedMilestoneProject, setSelectedMilestoneProject] = useState('all')
  const [selectedScorecardPm, setSelectedScorecardPm] = useState(null)

  // Strategic Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailProjectId, setDetailProjectId] = useState(null)
  const [detailData, setDetailData] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(null)

  const abortControllerRef = useRef(null)

  const fetchPortfolioData = async (isManualRefresh = false) => {
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

      const res = await api.get('/leadership/portfolio', {
        signal: controller.signal,
      })

      if (res.data && res.data.success) {
        setData(res.data)
        if (res.data.pm_scorecards && res.data.pm_scorecards.length > 0 && !selectedScorecardPm) {
          setSelectedScorecardPm(res.data.pm_scorecards[0].pm_id)
        }
      } else {
        throw new Error(res.data?.message || 'Gagal memuat data portofolio.')
      }
    } catch (err) {
      if (controller.signal.aborted) return
      console.error('Leadership Portfolio fetch error:', err)
      setError(
        err.response?.data?.message ||
        err.message ||
        'Terjadi kendala saat menghubungkan ke server portofolio. Silakan coba lagi.'
      )
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }

  const openProjectDetail = async (projectId) => {
    setDetailProjectId(projectId)
    setDetailModalOpen(true)
    setDetailLoading(true)
    setDetailError(null)

    try {
      const res = await api.get(`/leadership/portfolio/${projectId}`)
      if (res.data && res.data.success) {
        setDetailData(res.data)
      } else {
        throw new Error(res.data?.message || 'Gagal memuat detail proyek.')
      }
    } catch (err) {
      console.error('Project Detail Insight fetch error:', err)
      setDetailError(
        err.response?.data?.message ||
        err.message ||
        'Gagal mengambil rincian data strategis proyek.'
      )
    } finally {
      setDetailLoading(false)
    }
  }

  const closeProjectDetail = () => {
    setDetailModalOpen(false)
    setDetailProjectId(null)
    setDetailData(null)
    setDetailError(null)
  }

  useEffect(() => {
    fetchPortfolioData()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Update status filter if query param changes
  useEffect(() => {
    const qStatus = searchParams.get('status')
    if (qStatus && ['all', 'on_track', 'at_risk', 'delayed', 'completed', 'active'].includes(qStatus)) {
      setStatusFilter(qStatus)
    }
  }, [searchParams])

  // Filtered & Sorted Projects
  const filteredProjects = useMemo(() => {
    if (!data || !data.projects) return []

    let list = [...data.projects]

    // Status filter
    if (statusFilter === 'active') {
      list = list.filter(p => p.status !== 'completed')
    } else if (statusFilter !== 'all') {
      list = list.filter(p => p.status === statusFilter)
    }

    // Risk filter
    if (riskFilter !== 'all') {
      list = list.filter(p => p.risk_level === riskFilter)
    }

    // PM filter
    if (pmFilter !== 'all') {
      list = list.filter(p => p.pic?.id === Number(pmFilter))
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q) ||
        p.client?.toLowerCase().includes(q) ||
        p.pic?.name?.toLowerCase().includes(q)
      )
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'progress_desc') {
        return (b.actual_progress || 0) - (a.actual_progress || 0)
      }
      if (sortBy === 'progress_asc') {
        return (a.actual_progress || 0) - (b.actual_progress || 0)
      }
      if (sortBy === 'deadline_asc') {
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return new Date(a.deadline) - new Date(b.deadline)
      }
      if (sortBy === 'variance_asc') {
        // Most lagging first (negative variance first)
        const vA = a.has_target ? a.variance : 999
        const vB = b.has_target ? b.variance : 999
        return vA - vB
      }
      if (sortBy === 'risk_desc') {
        const riskWeight = { high: 3, medium: 2, low: 1, none: 0 }
        return (riskWeight[b.risk_level] || 0) - (riskWeight[a.risk_level] || 0)
      }
      return 0
    })

    return list
  }, [data, statusFilter, riskFilter, pmFilter, searchQuery, sortBy])

  // Filtered Milestones for Timeline
  const filteredMilestones = useMemo(() => {
    if (!data || !data.milestone_timeline) return []
    if (selectedMilestoneProject === 'all') {
      return data.milestone_timeline
    }
    return data.milestone_timeline.filter(m => m.project_id === Number(selectedMilestoneProject))
  }, [data, selectedMilestoneProject])

  // Active PM Scorecard
  const activePmCard = useMemo(() => {
    if (!data || !data.pm_scorecards) return null
    if (!selectedScorecardPm && data.pm_scorecards.length > 0) {
      return data.pm_scorecards[0]
    }
    return data.pm_scorecards.find(pm => pm.pm_id === Number(selectedScorecardPm)) || data.pm_scorecards[0]
  }, [data, selectedScorecardPm])

  // Extract unique PMs for filter
  const pmOptions = useMemo(() => {
    if (!data || !data.projects) return []
    const map = new Map()
    data.projects.forEach(p => {
      if (p.pic && p.pic.id) {
        map.set(p.pic.id, p.pic.name)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [data])

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="relative">
          <Loader2 className="w-12 h-12 text-[#FF2F92] animate-spin" />
          <FolderKanban className="w-6 h-6 text-[#171717] absolute inset-0 m-auto" />
        </div>
        <div className="text-center">
          <h3 className="font-mono font-bold text-lg text-[#171717]">MEMUAT STRATEGIC PORTFOLIO...</h3>
          <p className="text-xs text-[#171717]/60 font-mono mt-1">Mengagregasi data proyek, milestone, target, dan performa tim.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="bg-[#FF2F92]/10 border-2 border-[#171717] shadow-[6px_6px_0px_#171717] p-6 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-[#FF2F92] mx-auto" />
          <h2 className="font-mono font-black text-xl text-[#171717]">GAGAL MEMUAT DATA STRATEGIS</h2>
          <p className="font-mono text-sm text-[#171717]/80 max-w-xl mx-auto">{error}</p>
          <button
            onClick={() => fetchPortfolioData(true)}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#FFD83D] border-2 border-[#171717] font-mono font-bold text-sm shadow-[3px_3px_0px_#171717] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#171717] transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Coba Lagi
          </button>
        </div>
      </div>
    )
  }

  if (!data) return <PageLoading mode="page" text="Memuat Portofolio Strategis..." subtext="Mengagregasi analisis target vs realisasi dan perhatian strategis portofolio proyek." />

  const {
    portfolio_overview = {},
    target_vs_actual_analysis = {},
    strategic_attention = []
  } = data || {}

  return (
    <div className="space-y-6 md:space-y-8 pb-12">
      {/* =========================================================================
          1. EXECUTIVE HEADER & ACTIONS
         ========================================================================= */}
      <div className="bg-[#F5F1E9] border-2 border-[#171717] shadow-[6px_6px_0px_#171717] p-5 md:p-7 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 bg-[#FF2F92] text-white border-2 border-[#171717] font-mono font-black text-xs tracking-wider uppercase shadow-[2px_2px_0px_#171717]">
                PIMPINAN &middot; PORTOFOLIO STRATEGIS
              </span>
              <span className="text-xs font-mono text-[#171717]/60 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {data.meta?.as_of_date} &bull; {data.meta?.as_of_time}
              </span>
            </div>
            <h1 className="font-mono font-black text-2xl md:text-3xl lg:text-4xl text-[#171717] tracking-tight">
              PORTOFOLIO STRATEGIS PROYEK
            </h1>
            <p className="text-xs md:text-sm font-mono text-[#171717]/70 max-w-2xl">
              Pusat kendali dan audit menyeluruh seluruh portofolio proyek PT Potensi Karya Mandiri. Berorientasi pada evaluasi target, mitigasi risiko, dan pengambilan keputusan eksekutif.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => fetchPortfolioData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#EAE4D8] border-2 border-[#171717] font-mono font-bold text-xs shadow-[3px_3px_0px_#171717] hover:bg-[#FFD83D] active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50"
              title="Perbarui data portofolio dari database"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Sinkronisasi...' : 'Refresh'}
            </button>
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#B8A0F0] border-2 border-[#171717] font-mono font-bold text-xs text-[#171717] shadow-[3px_3px_0px_#171717] hover:bg-[#B8A0F0]/80 active:translate-x-[1px] active:translate-y-[1px] transition-all"
            >
              <Layers className="w-3.5 h-3.5" />
              Command Center
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. PORTFOLIO STATUS SNAPSHOT (6 Interactive Status Cards)
         ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono font-black text-xs md:text-sm tracking-wider uppercase text-[#171717] flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-[#FF2F92]" />
            Portfolio Status Overview
          </h2>
          <span className="text-[11px] font-mono text-[#171717]/60">
            Klik kartu untuk memfilter daftar di bawah
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total Projects */}
          <button
            onClick={() => {
              setStatusFilter('all')
              setSearchParams({})
            }}
            className={`p-4 border-2 border-[#171717] text-left transition-all ${
              statusFilter === 'all'
                ? 'bg-[#171717] text-white shadow-[4px_4px_0px_#FF2F92] translate-x-[-1px] translate-y-[-1px]'
                : 'bg-white shadow-[3px_3px_0px_#171717] hover:bg-[#F5F1E9]'
            }`}
          >
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-70">
              Total Proyek
            </div>
            <div className="text-2xl md:text-3xl font-mono font-black mt-1">
              {portfolio_overview?.total_projects || 0}
            </div>
            <div className="text-[10px] font-mono opacity-80 mt-1 flex items-center justify-between">
              <span>Semua Portofolio</span>
              {statusFilter === 'all' && <CheckCircle2 className="w-3 h-3 text-[#FFD83D]" />}
            </div>
          </button>

          {/* Active Projects */}
          <button
            onClick={() => {
              setStatusFilter('active')
              setSearchParams({ status: 'active' })
            }}
            className={`p-4 border-2 border-[#171717] text-left transition-all ${
              statusFilter === 'active'
                ? 'bg-[#171717] text-white shadow-[4px_4px_0px_#3B82F6] translate-x-[-1px] translate-y-[-1px]'
                : 'bg-white shadow-[3px_3px_0px_#171717] hover:bg-[#F5F1E9]'
            }`}
          >
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-70">
              Proyek Aktif
            </div>
            <div className="text-2xl md:text-3xl font-mono font-black text-[#2563EB] dark:text-[#60A5FA] mt-1">
              {portfolio_overview?.active_projects || 0}
            </div>
            <div className="text-[10px] font-mono opacity-80 mt-1 flex items-center justify-between">
              <span>Sedang Berjalan</span>
              {statusFilter === 'active' && <CheckCircle2 className="w-3 h-3 text-[#3B82F6]" />}
            </div>
          </button>

          {/* On Track Projects */}
          <button
            onClick={() => {
              setStatusFilter('on_track')
              setSearchParams({ status: 'on_track' })
            }}
            className={`p-4 border-2 border-[#171717] text-left transition-all ${
              statusFilter === 'on_track'
                ? 'bg-[#171717] text-white shadow-[4px_4px_0px_#10B981] translate-x-[-1px] translate-y-[-1px]'
                : 'bg-white shadow-[3px_3px_0px_#171717] hover:bg-[#F5F1E9]'
            }`}
          >
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-70">
              Tepat Waktu
            </div>
            <div className="text-2xl md:text-3xl font-mono font-black text-[#10B981] mt-1">
              {portfolio_overview?.on_track_projects || 0}
            </div>
            <div className="text-[10px] font-mono opacity-80 mt-1 flex items-center justify-between">
              <span>Sesuai Jadwal</span>
              {statusFilter === 'on_track' && <CheckCircle2 className="w-3 h-3 text-[#10B981]" />}
            </div>
          </button>

          {/* At Risk Projects */}
          <button
            onClick={() => {
              setStatusFilter('at_risk')
              setSearchParams({ status: 'at_risk' })
            }}
            className={`p-4 border-2 border-[#171717] text-left transition-all ${
              statusFilter === 'at_risk'
                ? 'bg-[#171717] text-white shadow-[4px_4px_0px_#FFD83D] translate-x-[-1px] translate-y-[-1px]'
                : 'bg-white shadow-[3px_3px_0px_#171717] hover:bg-[#F5F1E9]'
            }`}
          >
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-70">
              At Risk
            </div>
            <div className="text-2xl md:text-3xl font-mono font-black text-[#D97706] mt-1">
              {portfolio_overview?.at_risk_projects || 0}
            </div>
            <div className="text-[10px] font-mono opacity-80 mt-1 flex items-center justify-between">
              <span>Perlu Pantauan</span>
              {statusFilter === 'at_risk' && <CheckCircle2 className="w-3 h-3 text-[#FFD83D]" />}
            </div>
          </button>

          {/* Delayed Projects */}
          <button
            onClick={() => {
              setStatusFilter('delayed')
              setSearchParams({ status: 'delayed' })
            }}
            className={`p-4 border-2 border-[#171717] text-left transition-all ${
              statusFilter === 'delayed'
                ? 'bg-[#171717] text-white shadow-[4px_4px_0px_#FF2F92] translate-x-[-1px] translate-y-[-1px]'
                : 'bg-white shadow-[3px_3px_0px_#171717] hover:bg-[#F5F1E9]'
            }`}
          >
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-70">
              Delayed
            </div>
            <div className="text-2xl md:text-3xl font-mono font-black text-[#FF2F92] mt-1">
              {portfolio_overview?.delayed_projects || 0}
            </div>
            <div className="text-[10px] font-mono opacity-80 mt-1 flex items-center justify-between">
              <span>Terlambat</span>
              {statusFilter === 'delayed' && <CheckCircle2 className="w-3 h-3 text-[#FF2F92]" />}
            </div>
          </button>

          {/* Completed Projects */}
          <button
            onClick={() => {
              setStatusFilter('completed')
              setSearchParams({ status: 'completed' })
            }}
            className={`p-4 border-2 border-[#171717] text-left transition-all ${
              statusFilter === 'completed'
                ? 'bg-[#171717] text-white shadow-[4px_4px_0px_#B8A0F0] translate-x-[-1px] translate-y-[-1px]'
                : 'bg-white shadow-[3px_3px_0px_#171717] hover:bg-[#F5F1E9]'
            }`}
          >
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-70">
              Completed
            </div>
            <div className="text-2xl md:text-3xl font-mono font-black text-[#7C3AED] mt-1">
              {portfolio_overview?.completed_projects || 0}
            </div>
            <div className="text-[10px] font-mono opacity-80 mt-1 flex items-center justify-between">
              <span>Arsip Selesai</span>
              {statusFilter === 'completed' && <CheckCircle2 className="w-3 h-3 text-[#B8A0F0]" />}
            </div>
          </button>
        </div>
      </div>

      {/* =========================================================================
          3. TARGET VS ACTUAL AGGREGATE ANALYSIS PANEL
         ========================================================================= */}
      <div className="bg-white border-2 border-[#171717] shadow-[6px_6px_0px_#171717] p-5 md:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b-2 border-[#171717] pb-4">
          <div>
            <h2 className="font-mono font-black text-base md:text-lg text-[#171717] flex items-center gap-2">
              <Target className="w-5 h-5 text-[#FF2F92]" />
              TARGET VS ACTUAL PROGRESS ANALYSIS
            </h2>
            <p className="text-xs font-mono text-[#171717]/70 mt-0.5">
              Evaluasi ketercapaian target agregat perusahaan: Variance = Actual Progress &minus; Target Progress.
            </p>
          </div>
          <div className="text-xs font-mono px-3 py-1 bg-[#EAE4D8] border border-[#171717] self-start md:self-auto">
            {target_vs_actual_analysis?.period_context}
          </div>
        </div>

        {target_vs_actual_analysis?.has_target_data ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            {/* Visual Bars Column */}
            <div className="lg:col-span-7 space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-mono font-bold text-[#171717]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-[#10B981] border border-[#171717] inline-block"></span>
                    Rata-rata Progress Aktual
                  </span>
                  <span className="text-sm font-black text-[#10B981]">
                    {target_vs_actual_analysis.average_actual_progress}%
                  </span>
                </div>
                <div className="w-full bg-[#EAE4D8] border-2 border-[#171717] h-5 relative overflow-hidden">
                  <div
                    className="h-full bg-[#10B981] transition-all duration-500"
                    style={{ width: `${Math.min(100, target_vs_actual_analysis.average_actual_progress || 0)}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-mono font-bold text-[#171717]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-[#FFD83D] border border-[#171717] inline-block"></span>
                    Rata-rata Target Baseline
                  </span>
                  <span className="text-sm font-black text-[#B45309]">
                    {target_vs_actual_analysis.average_target_progress}%
                  </span>
                </div>
                <div className="w-full bg-[#EAE4D8] border-2 border-[#171717] h-5 relative overflow-hidden">
                  <div
                    className="h-full bg-[#FFD83D] transition-all duration-500"
                    style={{ width: `${Math.min(100, target_vs_actual_analysis.average_target_progress || 0)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Aggregated Stat Cards Column */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-3">
              {/* Variance Card */}
              <div className="p-3.5 bg-[#F5F1E9] border-2 border-[#171717] shadow-[2px_2px_0px_#171717]">
                <div className="text-[10px] font-mono font-bold uppercase text-[#171717]/60">
                  Variansi Portofolio
                </div>
                <div className={`text-xl font-mono font-black mt-1 ${
                  (target_vs_actual_analysis.portfolio_variance || 0) >= 0 ? 'text-[#10B981]' : 'text-[#FF2F92]'
                }`}>
                  {(target_vs_actual_analysis.portfolio_variance || 0) > 0 ? '+' : ''}
                  {target_vs_actual_analysis.portfolio_variance}%
                </div>
                <div className="text-[10px] font-mono font-semibold mt-1">
                  {(target_vs_actual_analysis.portfolio_variance || 0) > 0 ? (
                    <span className="text-[#10B981]">Di Atas Target</span>
                  ) : (target_vs_actual_analysis.portfolio_variance || 0) === 0 ? (
                    <span className="text-[#3B82F6]">Sesuai Target</span>
                  ) : (
                    <span className="text-[#FF2F92]">Tertinggal Target</span>
                  )}
                </div>
              </div>

              {/* Achievement Rate */}
              <div className="p-3.5 bg-[#F5F1E9] border-2 border-[#171717] shadow-[2px_2px_0px_#171717]">
                <div className="text-[10px] font-mono font-bold uppercase text-[#171717]/60">
                  Target Achievement
                </div>
                <div className="text-xl font-mono font-black mt-1 text-[#171717]">
                  {target_vs_actual_analysis.portfolio_achievement_rate || 0}%
                </div>
                <div className="text-[10px] font-mono text-[#171717]/70 mt-1">
                  Rasio Aktual / Target
                </div>
              </div>

              {/* Ahead vs Behind summary */}
              <div className="col-span-2 p-3 bg-[#EAE4D8] border border-[#171717] text-xs font-mono flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                  {target_vs_actual_analysis.projects_ahead_count} Di Atas Target
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#3B82F6]"></span>
                  {target_vs_actual_analysis.projects_on_track_count} Tepat Target
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#FF2F92]"></span>
                  {target_vs_actual_analysis.projects_behind_count} Tertinggal
                </span>
                {target_vs_actual_analysis.projects_no_target_count > 0 && (
                  <span className="flex items-center gap-1.5 text-[#171717]/60">
                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                    {target_vs_actual_analysis.projects_no_target_count} Tanpa Target
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-[#F5F1E9] border border-[#171717] text-center font-mono text-xs text-[#171717]/70">
            Belum ada target progress yang ditetapkan pada proyek-proyek aktif. Tetapkan target baseline untuk mengaktifkan analisis komparatif ini.
          </div>
        )}
      </div>

      {/* =========================================================================
          4. STRATEGIC ATTENTION BOARD (Executive Intervention Alerts)
         ========================================================================= */}
      {strategic_attention && strategic_attention.length > 0 && (
        <div className="bg-white border-2 border-[#171717] shadow-[6px_6px_0px_#171717] p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b-2 border-[#171717] pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#FF2F92]" />
              <h2 className="font-mono font-black text-base text-[#171717] uppercase tracking-wide">
                Strategic Attention &middot; Butuh Perhatian Pimpinan ({strategic_attention.length})
              </h2>
            </div>
            <span className="text-[11px] font-mono text-[#171717]/60">
              Diprioritaskan berdasarkan status delayed, blocker lapangan, & deviasi target
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {strategic_attention.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#F5F1E9] border-2 border-[#171717] shadow-[3px_3px_0px_#171717] p-4 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-black text-xs text-[#171717] bg-[#EAE4D8] px-2 py-0.5 border border-[#171717]">
                      {item.project_code}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase border border-[#171717] ${
                      item.severity === 'kritis'
                        ? 'bg-[#FF2F92] text-white'
                        : item.severity === 'tinggi'
                        ? 'bg-[#FFD83D] text-[#171717]'
                        : 'bg-[#B8A0F0] text-[#171717]'
                    }`}>
                      Perhatian {item.severity}
                    </span>
                  </div>

                  <h3 className="font-mono font-bold text-sm text-[#171717] line-clamp-1">
                    {item.project_name}
                  </h3>
                  <div className="text-[11px] font-mono text-[#171717]/70">
                    PM: <span className="font-semibold text-[#171717]">{item.pm_name}</span>
                  </div>

                  {/* Fact box */}
                  <div className="p-2.5 bg-white border border-[#171717] text-xs font-mono space-y-1">
                    <div className="text-[10px] font-black uppercase text-[#FF2F92] flex items-center gap-1">
                      <AlertOctagon className="w-3 h-3" /> Fakta Aktual Database:
                    </div>
                    <p className="text-[11px] text-[#171717]/90 leading-relaxed">
                      {item.factual_data}
                    </p>
                  </div>

                  {/* Recommendation box */}
                  <div className="p-2.5 bg-[#FFD83D]/20 border border-[#171717] text-xs font-mono space-y-1">
                    <div className="text-[10px] font-black uppercase text-[#B45309] flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Rekomendasi Tindak Lanjut:
                    </div>
                    <p className="text-[11px] text-[#171717]/90 leading-relaxed">
                      {item.recommendation}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => openProjectDetail(item.project_id)}
                  className="w-full mt-2 inline-flex items-center justify-center gap-1.5 py-1.5 bg-white hover:bg-[#FFD83D] border border-[#171717] font-mono font-bold text-xs shadow-[2px_2px_0px_#171717] transition-all"
                >
                  Inspeksi Detail Proyek
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          5. PROJECT PORTFOLIO LIST & EXPLORER
         ========================================================================= */}
      <div className="bg-white border-2 border-[#171717] shadow-[6px_6px_0px_#171717] p-5 md:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 border-[#171717] pb-4">
          <div>
            <h2 className="font-mono font-black text-base md:text-lg text-[#171717] flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-[#FF2F92]" />
              PROJECT PORTFOLIO DIRECTORY ({filteredProjects.length})
            </h2>
            <p className="text-xs font-mono text-[#171717]/70 mt-0.5">
              Daftar seluruh proyek dengan analisis progress, deviasi target, jadwal milestone, dan level risiko.
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center border-2 border-[#171717] bg-[#EAE4D8] p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 font-mono text-xs flex items-center gap-1 transition-all ${
                  viewMode === 'table' ? 'bg-[#171717] text-white' : 'text-[#171717] hover:bg-white/50'
                }`}
                title="Tampilan Tabel"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tabel</span>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 font-mono text-xs flex items-center gap-1 transition-all ${
                  viewMode === 'cards' ? 'bg-[#171717] text-white' : 'text-[#171717] hover:bg-white/50'
                }`}
                title="Tampilan Kartu"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kartu</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-[#F5F1E9] p-3.5 border-2 border-[#171717]">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#171717]/60 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari proyek / klien / PM..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#171717] font-mono text-xs text-[#171717] placeholder:text-[#171717]/50 focus:outline-hidden focus:ring-1 focus:ring-[#FF2F92]"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setSearchParams(e.target.value === 'all' ? {} : { status: e.target.value })
              }}
              className="w-full px-3 py-1.5 bg-white border border-[#171717] font-mono text-xs text-[#171717] focus:outline-hidden"
            >
              <option value="all">Semua Status Proyek</option>
              <option value="active">Proyek Aktif (Belum Selesai)</option>
              <option value="on_track">Tepat Waktu</option>
              <option value="at_risk">Berisiko</option>
              <option value="delayed">Terlambat</option>
              <option value="completed">Selesai</option>
            </select>
          </div>

          {/* Risk Filter */}
          <div>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-[#171717] font-mono text-xs text-[#171717] focus:outline-hidden"
            >
              <option value="all">Semua Level Risiko</option>
              <option value="high">Risiko Tinggi</option>
              <option value="medium">Risiko Sedang</option>
              <option value="low">Risiko Rendah</option>
            </select>
          </div>

          {/* PM Filter */}
          <div>
            <select
              value={pmFilter}
              onChange={(e) => setPmFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-[#171717] font-mono text-xs text-[#171717] focus:outline-hidden"
            >
              <option value="all">Semua Project Manager</option>
              {pmOptions.map(pm => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-[#171717] font-mono text-xs text-[#171717] focus:outline-hidden"
            >
              <option value="progress_desc">Progres Tertinggi</option>
              <option value="progress_asc">Progres Terendah</option>
              <option value="variance_asc">Tertinggal Target (Paling Rendah)</option>
              <option value="deadline_asc">Deadline Terdekat</option>
              <option value="risk_desc">Tingkat Risiko Tertinggi</option>
            </select>
          </div>
        </div>

        {/* List Content */}
        {filteredProjects.length === 0 ? (
          <div className="p-10 border-2 border-dashed border-[#171717] text-center space-y-2 bg-[#F5F1E9]">
            <FolderKanban className="w-10 h-10 text-[#171717]/40 mx-auto" />
            <h3 className="font-mono font-bold text-sm text-[#171717]">TIDAK ADA PROYEK DITEMUKAN</h3>
            <p className="text-xs font-mono text-[#171717]/60">
              Tidak ada data proyek yang sesuai dengan kriteria pencarian dan filter yang aktif.
            </p>
            <button
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
                setRiskFilter('all')
                setPmFilter('all')
                setSearchParams({})
              }}
              className="mt-2 px-3 py-1 bg-white border border-[#171717] font-mono text-xs hover:bg-[#FFD83D]"
            >
              Reset Semua Filter
            </button>
          </div>
        ) : viewMode === 'table' ? (
          /* TABLE VIEW */
          <div className="overflow-x-auto border-2 border-[#171717]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#171717] text-white font-mono text-xs uppercase tracking-wider">
                  <th className="p-3 border-r border-[#333]">Kode & Proyek</th>
                  <th className="p-3 border-r border-[#333]">Project Manager</th>
                  <th className="p-3 border-r border-[#333] text-center">Status & Risiko</th>
                  <th className="p-3 border-r border-[#333] min-w-[180px]">Progres vs Target</th>
                  <th className="p-3 border-r border-[#333]">Deadline & Milestone</th>
                  <th className="p-3 border-r border-[#333] text-center">Indikator</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#171717] font-mono text-xs bg-white">
                {filteredProjects.map((p) => {
                  const sTheme = STATUS_THEME[p.status] || STATUS_THEME.on_track
                  const rTheme = RISK_THEME[p.risk_level] || RISK_THEME.low

                  return (
                    <tr key={p.id} className="hover:bg-[#F5F1E9] transition-colors">
                      {/* Code & Name */}
                      <td className="p-3 border-r border-[#171717]">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-[11px] px-1.5 py-0.5 bg-[#EAE4D8] border border-[#171717]">
                            {p.code}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-[#171717]/60 px-1 border border-[#171717]/30">
                            {p.category}
                          </span>
                        </div>
                        <div className="font-bold text-sm text-[#171717] mt-1 line-clamp-1">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-[#171717]/70">
                          Klien: <span className="font-medium">{p.client}</span>
                        </div>
                      </td>

                      {/* PM */}
                      <td className="p-3 border-r border-[#171717]">
                        <div className="font-bold text-[#171717]">
                          {p.pic?.name || 'Belum Ditugaskan'}
                        </div>
                        <div className="text-[11px] text-[#171717]/60">
                          {p.pic?.email || '-'}
                        </div>
                      </td>

                      {/* Status & Risk */}
                      <td className="p-3 border-r border-[#171717] text-center space-y-1">
                        <div>
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-black uppercase border ${sTheme.border} ${sTheme.bg} ${sTheme.text}`}>
                            {sTheme.label}
                          </span>
                        </div>
                        <div>
                          <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase border ${rTheme.border} ${rTheme.bg} ${rTheme.text}`}>
                            {rTheme.label}
                          </span>
                        </div>
                      </td>

                      {/* Progress vs Target */}
                      <td className="p-3 border-r border-[#171717]">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span>Aktual: <span className="font-black text-[#171717]">{p.actual_progress}%</span></span>
                          {p.has_target ? (
                            <span>Target: <span className="text-[#171717]/80">{p.target_progress}%</span></span>
                          ) : (
                            <span className="text-[10px] text-[#171717]/50 font-normal">Belum ada target</span>
                          )}
                        </div>

                        <div className="w-full bg-[#EAE4D8] border border-[#171717] h-2.5 mt-1 relative overflow-hidden">
                          <div
                            className="h-full bg-[#10B981]"
                            style={{ width: `${Math.min(100, p.actual_progress || 0)}%` }}
                          ></div>
                          {p.has_target && (
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-[#171717] z-10"
                              style={{ left: `${Math.min(100, p.target_progress)}%` }}
                              title={`Target: ${p.target_progress}%`}
                            ></div>
                          )}
                        </div>

                        {/* Variance badge */}
                        <div className="mt-1 flex items-center justify-between text-[10px]">
                          {p.has_target ? (
                            <span className={`font-bold ${
                              p.variance > 0 ? 'text-[#10B981]' : p.variance === 0 ? 'text-[#3B82F6]' : 'text-[#FF2F92]'
                            }`}>
                              Variance: {p.variance > 0 ? `+${p.variance}%` : `${p.variance}%`}
                            </span>
                          ) : (
                            <span className="text-[#171717]/50">Variance: N/A</span>
                          )}

                          <span className="text-[10px] text-[#171717]/60">
                            {p.tasks_summary.completed}/{p.tasks_summary.total} Tugas
                          </span>
                        </div>
                      </td>

                      {/* Deadline & Next Milestone */}
                      <td className="p-3 border-r border-[#171717]">
                        <div className="text-[11px]">
                          <span className="text-[#171717]/60">Deadline: </span>
                          <span className="font-bold text-[#171717]">{p.deadline || '-'}</span>
                        </div>
                        {p.next_milestone ? (
                          <div className="mt-1 text-[10px] text-[#171717]/80">
                            <span className="font-bold">Next:</span> {p.next_milestone.title}
                            {p.next_milestone.is_overdue && (
                              <span className="ml-1 text-[#FF2F92] font-black uppercase text-[9px]">[Overdue]</span>
                            )}
                          </div>
                        ) : (
                          <div className="mt-1 text-[10px] text-[#171717]/50">Tidak ada milestone aktif</div>
                        )}
                      </td>

                      {/* Blockers & Alerts */}
                      <td className="p-3 border-r border-[#171717] text-center">
                        <div className="flex flex-col items-center gap-1">
                          {p.active_blockers_count > 0 && (
                            <span className="px-1.5 py-0.5 bg-[#FF2F92] text-white text-[9px] font-black border border-[#171717] flex items-center gap-1">
                              <AlertOctagon className="w-2.5 h-2.5" />
                              {p.active_blockers_count} Blocker
                            </span>
                          )}
                          {p.tasks_summary.overdue > 0 && (
                            <span className="px-1.5 py-0.5 bg-[#FFD83D] text-[#171717] text-[9px] font-bold border border-[#171717]">
                              {p.tasks_summary.overdue} Task Overdue
                            </span>
                          )}
                          {p.active_blockers_count === 0 && p.tasks_summary.overdue === 0 && (
                            <span className="text-[10px] text-[#10B981] font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Bersih
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="p-3 text-center">
                        <button
                          onClick={() => openProjectDetail(p.id)}
                          className="px-2.5 py-1 bg-white hover:bg-[#FFD83D] border border-[#171717] font-mono font-bold text-[11px] shadow-[2px_2px_0px_#171717] active:translate-x-[1px] active:translate-y-[1px] transition-all whitespace-nowrap"
                        >
                          Detail Strategis
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* CARD VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((p) => {
              const sTheme = STATUS_THEME[p.status] || STATUS_THEME.on_track
              const rTheme = RISK_THEME[p.risk_level] || RISK_THEME.low

              return (
                <div
                  key={p.id}
                  className="bg-[#F5F1E9] border-2 border-[#171717] shadow-[4px_4px_0px_#171717] p-4 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-[#EAE4D8] border border-[#171717] font-mono font-black text-xs">
                          {p.code}
                        </span>
                        <span className="text-[9px] uppercase font-bold text-[#171717]/60 border border-[#171717]/30 px-1">
                          {p.category}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-mono font-black uppercase border ${sTheme.border} ${sTheme.bg} ${sTheme.text}`}>
                        {sTheme.label}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-mono font-bold text-base text-[#171717] line-clamp-1">
                        {p.name}
                      </h3>
                      <div className="text-xs font-mono text-[#171717]/70">
                        Klien: <span className="font-semibold">{p.client}</span>
                      </div>
                    </div>

                    <div className="text-xs font-mono flex items-center justify-between bg-white p-2 border border-[#171717]">
                      <div>
                        <div className="text-[9px] text-[#171717]/60 uppercase">Project Manager</div>
                        <div className="font-bold text-[#171717]">{p.pic?.name || 'Belum Ditugaskan'}</div>
                      </div>
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase border ${rTheme.border} ${rTheme.bg} ${rTheme.text}`}>
                        {rTheme.label}
                      </span>
                    </div>

                    {/* Progress Bar & Variance */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-mono font-bold">
                        <span>Aktual: {p.actual_progress}%</span>
                        {p.has_target ? (
                          <span>Target: {p.target_progress}%</span>
                        ) : (
                          <span className="text-[10px] text-[#171717]/50 font-normal">Belum ada target</span>
                        )}
                      </div>
                      <div className="w-full bg-[#EAE4D8] border border-[#171717] h-3 relative overflow-hidden">
                        <div
                          className="h-full bg-[#10B981]"
                          style={{ width: `${Math.min(100, p.actual_progress || 0)}%` }}
                        ></div>
                        {p.has_target && (
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-[#171717] z-10"
                            style={{ left: `${Math.min(100, p.target_progress)}%` }}
                          ></div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono">
                        {p.has_target ? (
                          <span className={`font-bold ${
                            p.variance > 0 ? 'text-[#10B981]' : p.variance === 0 ? 'text-[#3B82F6]' : 'text-[#FF2F92]'
                          }`}>
                            Variance: {p.variance > 0 ? `+${p.variance}%` : `${p.variance}%`}
                          </span>
                        ) : (
                          <span className="text-[#171717]/50">Variance: N/A</span>
                        )}
                        <span className="text-[#171717]/70">
                          {p.tasks_summary.completed}/{p.tasks_summary.total} Tugas
                        </span>
                      </div>
                    </div>

                    {/* Next Milestone & Deadline */}
                    <div className="text-xs font-mono space-y-1 pt-1 border-t border-[#171717]/20">
                      <div className="flex justify-between">
                        <span className="text-[#171717]/60">Deadline:</span>
                        <span className="font-bold text-[#171717]">{p.deadline || '-'}</span>
                      </div>
                      {p.next_milestone && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#171717]/60">Next Milestone:</span>
                          <span className={`font-bold line-clamp-1 max-w-[150px] ${p.next_milestone.is_overdue ? 'text-[#FF2F92]' : 'text-[#171717]'}`}>
                            {p.next_milestone.title}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Blockers tag */}
                    {p.active_blockers_count > 0 && (
                      <div className="p-1.5 bg-[#FF2F92]/10 border border-[#FF2F92] text-[10px] font-mono font-bold text-[#FF2F92] flex items-center gap-1">
                        <AlertOctagon className="w-3 h-3" />
                        Terdapat {p.active_blockers_count} kendala aktif di lapangan
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => openProjectDetail(p.id)}
                    className="w-full py-2 bg-white hover:bg-[#FFD83D] border border-[#171717] font-mono font-bold text-xs shadow-[2px_2px_0px_#171717] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center justify-center gap-1.5"
                  >
                    Detail Strategis
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          6. MILESTONE TIMELINE VISUALIZER (Portfolio Wide / Per Project)
         ========================================================================= */}
      <div className="bg-white border-2 border-[#171717] shadow-[6px_6px_0px_#171717] p-5 md:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b-2 border-[#171717] pb-4">
          <div>
            <h2 className="font-mono font-black text-base md:text-lg text-[#171717] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#FF2F92]" />
              MILESTONE & SPRINT TIMELINE ({filteredMilestones.length})
            </h2>
            <p className="text-xs font-mono text-[#171717]/70 mt-0.5">
              Visualisasi jadwal fase pengerjaan seluruh portofolio.
            </p>
          </div>

          {/* Project selector for milestones */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#171717] whitespace-nowrap">Filter Proyek:</span>
            <select
              value={selectedMilestoneProject}
              onChange={(e) => setSelectedMilestoneProject(e.target.value)}
              className="px-3 py-1.5 bg-[#F5F1E9] border border-[#171717] font-mono text-xs text-[#171717] focus:outline-hidden"
            >
              <option value="all">Semua Proyek Portofolio</option>
              {data.projects?.map(p => (
                <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Milestone Timeline List */}
        {filteredMilestones.length === 0 ? (
          <div className="p-8 border border-dashed border-[#171717] text-center font-mono text-xs text-[#171717]/60 bg-[#F5F1E9]">
            Tidak ada milestone yang terdaftar pada proyek ini.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMilestones.map((ms) => {
              const isOverdue = ms.timeline_category === 'overdue'
              const isCompleted = ms.timeline_category === 'completed'
              const isOnTrack = ms.timeline_category === 'on_track'

              return (
                <div
                  key={ms.id}
                  className={`p-3.5 border-2 border-[#171717] shadow-[2px_2px_0px_#171717] flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    isOverdue
                      ? 'bg-[#FF2F92]/10 border-[#FF2F92]'
                      : isCompleted
                      ? 'bg-[#B8A0F0]/15'
                      : 'bg-[#F5F1E9]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-1.5 py-0.2 bg-[#EAE4D8] border border-[#171717] font-mono font-bold text-[10px]">
                        {ms.project_code}
                      </span>
                      <span className="text-[10px] font-mono font-medium text-[#171717]/70">
                        {ms.project_name}
                      </span>
                      <span className={`px-2 py-0.2 text-[9px] font-mono font-black uppercase border border-[#171717] ${
                        isCompleted
                          ? 'bg-[#10B981] text-white'
                          : isOverdue
                          ? 'bg-[#FF2F92] text-white'
                          : isOnTrack
                          ? 'bg-[#3B82F6] text-white'
                          : 'bg-[#FFD83D] text-[#171717]'
                      }`}>
                        {ms.timeline_category.toUpperCase()}
                      </span>
                    </div>

                    <h4 className="font-mono font-bold text-sm text-[#171717]">
                      Fase {ms.phase_order}: {ms.title}
                    </h4>
                    {ms.description && (
                      <p className="text-xs font-mono text-[#171717]/70 line-clamp-1">
                        {ms.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 self-end md:self-auto font-mono text-xs">
                    <div className="text-right">
                      <div className="text-[10px] text-[#171717]/60">Target Selesai</div>
                      <div className={`font-bold ${isOverdue ? 'text-[#FF2F92]' : 'text-[#171717]'}`}>
                        {ms.due_date || 'Belum Ditentukan'}
                      </div>
                    </div>

                    <div className="w-24">
                      <div className="flex justify-between text-[10px] font-bold mb-1">
                        <span>Progres</span>
                        <span>{ms.progress}%</span>
                      </div>
                      <div className="w-full bg-[#EAE4D8] border border-[#171717] h-2">
                        <div
                          className={`h-full ${isCompleted ? 'bg-[#10B981]' : isOverdue ? 'bg-[#FF2F92]' : 'bg-[#3B82F6]'}`}
                          style={{ width: `${Math.min(100, ms.progress || 0)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          7. PM LEADERSHIP SCORECARD (Authentic Single PM / Team Performance)
         ========================================================================= */}
      {data.pm_scorecards && data.pm_scorecards.length > 0 && (
        <div className="bg-white border-2 border-[#171717] shadow-[6px_6px_0px_#171717] p-5 md:p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b-2 border-[#171717] pb-4">
            <div>
              <h2 className="font-mono font-black text-base md:text-lg text-[#171717] flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#FF2F92]" />
                PM LEADERSHIP & OPERATIONAL SCORECARD
              </h2>
              <p className="text-xs font-mono text-[#171717]/70 mt-0.5">
                Evaluasi performa pengerjaan Project Manager berdasarkan metrik aktual database.
              </p>
            </div>

            {/* PM Tabs if multiple PMs exist */}
            {data.pm_scorecards.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {data.pm_scorecards.map(pm => (
                  <button
                    key={pm.pm_id}
                    onClick={() => setSelectedScorecardPm(pm.pm_id)}
                    className={`px-3 py-1 font-mono text-xs border border-[#171717] font-bold transition-all ${
                      activePmCard?.pm_id === pm.pm_id
                        ? 'bg-[#171717] text-white shadow-[2px_2px_0px_#FFD83D]'
                        : 'bg-[#EAE4D8] text-[#171717] hover:bg-white'
                    }`}
                  >
                    {pm.pm_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {activePmCard ? (
            <div className="space-y-4">
              {/* PM Identity Banner */}
              <div className="p-4 bg-[#F5F1E9] border-2 border-[#171717] flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-mono uppercase font-bold text-[#FF2F92]">Project Manager Penanggung Jawab</div>
                  <h3 className="font-mono font-black text-lg text-[#171717]">{activePmCard.pm_name}</h3>
                  <div className="text-xs font-mono text-[#171717]/60">{activePmCard.pm_email}</div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="px-3 py-1.5 bg-white border border-[#171717] text-center font-mono">
                    <div className="text-[9px] uppercase font-bold text-[#171717]/60">Total Proyek</div>
                    <div className="text-base font-black text-[#171717]">{activePmCard.total_projects}</div>
                  </div>
                  <div className="px-3 py-1.5 bg-white border border-[#171717] text-center font-mono">
                    <div className="text-[9px] uppercase font-bold text-[#171717]/60">Rata-rata Progres</div>
                    <div className="text-base font-black text-[#10B981]">{activePmCard.average_progress}%</div>
                  </div>
                  <div className="px-3 py-1.5 bg-white border border-[#171717] text-center font-mono">
                    <div className="text-[9px] uppercase font-bold text-[#171717]/60">Laporan Terbit</div>
                    <div className="text-base font-black text-[#7C3AED]">{activePmCard.weekly_reports_count}</div>
                  </div>
                </div>
              </div>

              {/* Scorecard Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
                {/* On Track Ratio */}
                <div className="p-3 bg-[#EAE4D8] border border-[#171717]">
                  <div className="text-[10px] uppercase font-bold text-[#171717]/60">Proyek Tepat Waktu</div>
                  <div className="text-xl font-black text-[#10B981] mt-1">
                    {activePmCard.on_track_projects} <span className="text-xs text-[#171717]/60 font-normal">/ {activePmCard.total_projects}</span>
                  </div>
                </div>

                {/* Delayed Projects */}
                <div className="p-3 bg-[#EAE4D8] border border-[#171717]">
                  <div className="text-[10px] uppercase font-bold text-[#171717]/60">Proyek Terlambat</div>
                  <div className="text-xl font-black text-[#FF2F92] mt-1">
                    {activePmCard.delayed_projects}
                  </div>
                </div>

                {/* Task Completion Rate */}
                <div className="p-3 bg-[#EAE4D8] border border-[#171717]">
                  <div className="text-[10px] uppercase font-bold text-[#171717]/60">Task Completion Rate</div>
                  <div className="text-xl font-black text-[#171717] mt-1">
                    {activePmCard.task_completion_rate}%
                  </div>
                  <div className="text-[9px] text-[#171717]/60 mt-0.5">
                    {activePmCard.completed_tasks} dari {activePmCard.total_tasks} tugas
                  </div>
                </div>

                {/* Overdue Tasks */}
                <div className="p-3 bg-[#EAE4D8] border border-[#171717]">
                  <div className="text-[10px] uppercase font-bold text-[#171717]/60">Tugas Overdue</div>
                  <div className={`text-xl font-black mt-1 ${activePmCard.task_overdue > 0 ? 'text-[#FF2F92]' : 'text-[#10B981]'}`}>
                    {activePmCard.task_overdue}
                  </div>
                </div>

                {/* Milestone Completion Rate */}
                <div className="p-3 bg-[#EAE4D8] border border-[#171717]">
                  <div className="text-[10px] uppercase font-bold text-[#171717]/60">Milestone Selesai</div>
                  <div className="text-xl font-black text-[#171717] mt-1">
                    {activePmCard.milestone_completion_rate}%
                  </div>
                  <div className="text-[9px] text-[#171717]/60 mt-0.5">
                    {activePmCard.completed_milestones} dari {activePmCard.total_milestones} milestone
                  </div>
                </div>

                {/* Active Blockers */}
                <div className="p-3 bg-[#EAE4D8] border border-[#171717]">
                  <div className="text-[10px] uppercase font-bold text-[#171717]/60">Blocker Aktif Tim</div>
                  <div className={`text-xl font-black mt-1 ${activePmCard.active_blockers_count > 0 ? 'text-[#FF2F92]' : 'text-[#10B981]'}`}>
                    {activePmCard.active_blockers_count}
                  </div>
                </div>

                {/* Latest Report Published */}
                <div className="p-3 bg-[#EAE4D8] border border-[#171717] col-span-2">
                  <div className="text-[10px] uppercase font-bold text-[#171717]/60">Laporan Mingguan Terakhir</div>
                  <div className="text-sm font-black text-[#171717] mt-1">
                    {activePmCard.latest_report_date || 'Belum ada laporan terbit'}
                  </div>
                  <div className="text-[9px] text-[#171717]/60 mt-0.5">
                    {activePmCard.weekly_reports_count > 0
                      ? 'Rutin menerbitkan laporan periodik ke pimpinan'
                      : 'Perlu diingatkan untuk menerbitkan laporan mingguan'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-[#F5F1E9] border border-[#171717] text-center font-mono text-xs text-[#171717]/60">
              Data belum mencukupi untuk evaluasi kinerja Project Manager.
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          8. STRATEGIC PROJECT DETAIL MODAL / DRAWER
         ========================================================================= */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-[#171717]/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#F5F1E9] border-2 border-[#171717] shadow-[8px_8px_0px_#171717] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="bg-[#171717] text-white p-4 flex items-center justify-between border-b-2 border-[#171717]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 bg-[#FF2F92] text-white font-mono font-black text-xs border border-white/20">
                  DETAIL STRATEGIS
                </span>
                <span className="font-mono text-xs text-white/70">
                  {detailData?.project ? `[${detailData.project.code}] ${detailData.project.name}` : 'Memuat data...'}
                </span>
              </div>
              <button
                onClick={closeProjectDetail}
                className="p-1 hover:bg-white/20 transition-colors text-white"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 md:p-6 overflow-y-auto space-y-6">
              {detailLoading ? (
                <div className="py-12 text-center space-y-3 font-mono">
                  <Loader2 className="w-8 h-8 text-[#FF2F92] animate-spin mx-auto" />
                  <p className="text-xs text-[#171717]/70">Memuat rincian strategis proyek...</p>
                </div>
              ) : detailError ? (
                <div className="p-4 bg-[#FF2F92]/10 border border-[#FF2F92] text-center font-mono text-xs text-[#FF2F92]">
                  {detailError}
                </div>
              ) : detailData?.project ? (
                <div className="space-y-6">
                  {/* Summary Header */}
                  <div className="bg-white border-2 border-[#171717] p-4 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#171717]/20 pb-3">
                      <div>
                        <div className="text-[10px] font-mono uppercase font-bold text-[#171717]/60">
                          Klien: {detailData.project.client} &bull; Kategori: {detailData.project.category}
                        </div>
                        <h3 className="font-mono font-black text-xl text-[#171717]">
                          {detailData.project.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 text-xs font-mono font-black uppercase border border-[#171717] ${
                          STATUS_THEME[detailData.project.status]?.bg || 'bg-[#10B981]'
                        } ${STATUS_THEME[detailData.project.status]?.text || 'text-white'}`}>
                          {STATUS_THEME[detailData.project.status]?.label || detailData.project.status}
                        </span>
                        <span className={`px-2.5 py-1 text-xs font-mono font-bold uppercase border border-[#171717] ${
                          RISK_THEME[detailData.project.risk_level]?.bg || 'bg-[#EAE4D8]'
                        } ${RISK_THEME[detailData.project.risk_level]?.text || 'text-[#171717]'}`}>
                          {RISK_THEME[detailData.project.risk_level]?.label || detailData.project.risk_level}
                        </span>
                      </div>
                    </div>

                    {/* Key Stats Bar */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
                      <div className="p-2.5 bg-[#F5F1E9] border border-[#171717]">
                        <div className="text-[10px] text-[#171717]/60 uppercase">Progress Aktual</div>
                        <div className="text-lg font-black text-[#10B981] mt-0.5">{detailData.project.actual_progress}%</div>
                      </div>
                      <div className="p-2.5 bg-[#F5F1E9] border border-[#171717]">
                        <div className="text-[10px] text-[#171717]/60 uppercase">Target Baseline</div>
                        <div className="text-lg font-black text-[#171717] mt-0.5">
                          {detailData.project.has_target ? `${detailData.project.target_progress}%` : 'Belum Ada'}
                        </div>
                      </div>
                      <div className="p-2.5 bg-[#F5F1E9] border border-[#171717]">
                        <div className="text-[10px] text-[#171717]/60 uppercase">Variansi Target</div>
                        <div className={`text-lg font-black mt-0.5 ${
                          detailData.project.has_target && detailData.project.variance < 0 ? 'text-[#FF2F92]' : 'text-[#10B981]'
                        }`}>
                          {detailData.project.has_target
                            ? (detailData.project.variance > 0 ? `+${detailData.project.variance}%` : `${detailData.project.variance}%`)
                            : 'N/A'}
                        </div>
                      </div>
                      <div className="p-2.5 bg-[#F5F1E9] border border-[#171717]">
                        <div className="text-[10px] text-[#171717]/60 uppercase">Project Manager</div>
                        <div className="font-bold text-[#171717] mt-0.5 truncate">{detailData.project.pic?.name}</div>
                      </div>
                    </div>
                  </div>

                  {/* Active Blockers Section */}
                  {detailData.active_blockers && detailData.active_blockers.length > 0 && (
                    <div className="bg-[#FF2F92]/10 border-2 border-[#FF2F92] p-4 space-y-2">
                      <div className="font-mono font-black text-xs text-[#FF2F92] flex items-center gap-1.5 uppercase">
                        <AlertOctagon className="w-4 h-4" />
                        Kendala Lapangan Aktif (Blockers):
                      </div>
                      <div className="space-y-2">
                        {detailData.active_blockers.map((blk, bIdx) => (
                          <div key={bIdx} className="bg-white p-3 border border-[#171717] font-mono text-xs space-y-1">
                            <div className="flex justify-between font-bold text-[#171717]">
                              <span>Tugas: {blk.task_title}</span>
                              <span className="text-[10px] text-[#171717]/60">Pelapor: {blk.reported_by}</span>
                            </div>
                            <p className="text-[#FF2F92] font-semibold">{blk.blocker}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Overdue Tasks */}
                  {detailData.tasks_summary?.overdue_list && detailData.tasks_summary.overdue_list.length > 0 && (
                    <div className="bg-[#FFD83D]/20 border-2 border-[#171717] p-4 space-y-2">
                      <div className="font-mono font-black text-xs text-[#B45309] flex items-center gap-1.5 uppercase">
                        <Clock className="w-4 h-4" />
                        Tugas Melewati Batas Waktu ({detailData.tasks_summary.overdue_list.length}):
                      </div>
                      <div className="space-y-1.5 font-mono text-xs">
                        {detailData.tasks_summary.overdue_list.map((ot, otIdx) => (
                          <div key={otIdx} className="p-2 bg-white border border-[#171717] flex justify-between items-center">
                            <div>
                              <span className="font-bold text-[#171717]">{ot.title}</span>
                              <span className="text-[10px] text-[#171717]/60 ml-2">Assignee: {ot.assignee_name}</span>
                            </div>
                            <span className="px-2 py-0.5 bg-[#FF2F92] text-white text-[10px] font-bold">
                              Lewat {ot.days_overdue} hari
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Milestones List */}
                  <div className="space-y-2">
                    <h4 className="font-mono font-black text-xs uppercase text-[#171717] flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-[#FF2F92]" />
                      Fase & Milestone Proyek ({detailData.milestones?.length || 0}):
                    </h4>
                    {detailData.milestones && detailData.milestones.length > 0 ? (
                      <div className="space-y-2 font-mono text-xs">
                        {detailData.milestones.map((ms) => (
                          <div key={ms.id} className="p-3 bg-white border border-[#171717] flex items-center justify-between">
                            <div>
                              <div className="font-bold text-[#171717]">Fase {ms.phase_order}: {ms.title}</div>
                              <div className="text-[10px] text-[#171717]/60">Target: {ms.due_date || 'N/A'}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 text-[10px] font-black uppercase border border-[#171717] ${
                                ms.status === 'completed' ? 'bg-[#10B981] text-white' : 'bg-[#FFD83D] text-[#171717]'
                              }`}>
                                {ms.status}
                              </span>
                              <span className="font-black text-[#171717]">{ms.progress}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-white border border-[#171717] font-mono text-xs text-[#171717]/60 text-center">
                        Belum ada milestone yang dibuat untuk proyek ini.
                      </div>
                    )}
                  </div>

                  {/* Published Reports Archive */}
                  <div className="space-y-2">
                    <h4 className="font-mono font-black text-xs uppercase text-[#171717] flex items-center gap-1.5">
                      <FileBarChart className="w-4 h-4 text-[#FF2F92]" />
                      Arsip Laporan Mingguan Terbit ({detailData.reports?.length || 0}):
                    </h4>
                    {detailData.reports && detailData.reports.length > 0 ? (
                      <div className="space-y-2.5 font-mono text-xs">
                        {detailData.reports.map((rep) => (
                          <div key={rep.id} className="p-3.5 bg-white border border-[#171717] space-y-2">
                            <div className="flex justify-between items-center border-b border-[#171717]/10 pb-1.5">
                              <span className="font-black text-[#171717]">{rep.report_number || 'Laporan Mingguan'}</span>
                              <span className="text-[10px] text-[#171717]/60">
                                Periode: {rep.period_start} s/d {rep.period_end}
                              </span>
                            </div>
                            {rep.executive_summary && (
                              <p className="text-[11px] text-[#171717]/90 leading-relaxed">
                                <span className="font-bold">Ringkasan:</span> {rep.executive_summary}
                              </p>
                            )}
                            {rep.challenges && (
                              <p className="text-[11px] text-[#FF2F92] leading-relaxed">
                                <span className="font-bold">Kendala:</span> {rep.challenges}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-white border border-[#171717] font-mono text-xs text-[#171717]/60 text-center">
                        Belum ada laporan perkembangan mingguan yang diterbitkan untuk proyek ini.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="bg-[#EAE4D8] border-t-2 border-[#171717] p-3 flex justify-end">
              <button
                onClick={closeProjectDetail}
                className="px-5 py-1.5 bg-[#171717] text-white font-mono font-bold text-xs shadow-[2px_2px_0px_#FFD83D] hover:bg-black transition-all"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
