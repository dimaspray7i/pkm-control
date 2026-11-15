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
  Target
} from 'lucide-react'
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
import PageHeader from '../../components/ui/PageHeader'

const STATUS_THEME = {
  on_track:  { label: 'On Track',  bg: 'bg-[#10B981]', text: 'text-white', border: 'border-[#171717]', dot: '#10B981' },
  at_risk:   { label: 'At Risk',   bg: 'bg-[#FFD83D]', text: 'text-[#171717]', border: 'border-[#171717]', dot: '#FBBF24' },
  delayed:   { label: 'Delayed',   bg: 'bg-[#FF2F92]', text: 'text-white', border: 'border-[#171717]', dot: '#FF2F92' },
  completed: { label: 'Completed', bg: 'bg-[#B8A0F0]', text: 'text-[#171717]', border: 'border-[#171717]', dot: '#B8A0F0' },
}

export default function ExecutiveCommandCenter() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [showFormulaInfo, setShowFormulaInfo] = useState(false)

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

      const res = await api.get('/leadership/command-center', {
        signal: controller.signal,
      })

      if (res.data && res.data.success) {
        setData(res.data)
        setError(null)
      } else {
        throw new Error(res.data?.message || 'Gagal memuat data eksekutif.')
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
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#FFD83D] border-2 border-[#171717] shadow-[4px_4px_0px_#171717] flex items-center justify-center mb-4 animate-bounce">
          <ShieldCheck size={32} className="text-[#171717]" />
        </div>
        <h2 className="font-display text-xl sm:text-2xl text-[#171717] uppercase tracking-wide">
          Memuat Executive Command Center...
        </h2>
        <p className="text-xs sm:text-sm font-semibold text-[#171717]/60 max-w-md mt-1">
          Menghitung Company Health Index, status portofolio proyek, dan atensi strategis dari basis data riil.
        </p>
        <Loader2 size={24} className="animate-spin text-[#FF2F92] mt-4" />
      </div>
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

  const chi = data?.company_health_index || {}
  const portfolio = data?.portfolio_snapshot || {}
  const progressAnalysis = data?.progress_analysis || {}
  const radar = data?.attention_radar || []
  const reviewBacklog = data?.review_backlog || {}
  const feed = data?.executive_feed || []
  const trend = data?.historical_trend || {}

  // CHI Dial Angle Calculation (0 - 100 maps to 0% - 100%)
  const chiScore = typeof chi.score === 'number' ? chi.score : 0

  return (
    <div className="space-y-6 pb-12">
      {/* =========================================================================
          A. EXECUTIVE HEADER
      ========================================================================= */}
      <div className="bg-white border-2 border-[#171717] rounded-xl p-4 sm:p-6 shadow-[3px_3px_0px_#171717] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-[#FFD83D]/20 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider bg-[#171717] text-white rounded">
                EXECUTIVE SUITE
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-[#10B981]">
                <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block animate-pulse" />
                Live Database Active
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-[#171717] tracking-tight leading-none uppercase">
              {getGreeting()}, {user?.name || 'Pimpinan'}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-[#171717]/70 mt-1">
              Pusat komando dan evaluasi performa bisnis operasional PT Potensi Karya Mandiri.
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
          B. COMPANY HEALTH INDEX (CHI) & PORTFOLIO SNAPSHOT (2 COLUMN GRID)
      ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* B1. Company Health Index Card */}
        <div className="lg:col-span-5 bg-white border-2 border-[#171717] rounded-xl p-5 sm:p-6 shadow-[3px_3px_0px_#171717] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#171717]/15">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#FF2F92]" />
                <h2 className="font-display text-sm sm:text-base uppercase tracking-wide text-[#171717]">
                  Company Health Index
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowFormulaInfo(!showFormulaInfo)}
                className="text-xs text-[#171717]/60 hover:text-[#171717] p-1 rounded hover:bg-[#F5F1E9] transition-colors"
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
                  Dihitung 100% dari data database aktual: proyek on-track, ketepatan jadwal tugas, pencapaian target progres, dan mitigasi proyek berisiko tinggi.
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

            {/* S_project */}
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

            {/* S_schedule */}
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

            {/* S_delivery */}
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

            {/* S_risk */}
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

        {/* B2. Portfolio Status Snapshot Cards */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white border-2 border-[#171717] rounded-xl p-5 sm:p-6 shadow-[3px_3px_0px_#171717] flex-1">
            <div className="flex items-center justify-between pb-3 border-b border-[#171717]/15 mb-4">
              <div className="flex items-center gap-2">
                <FolderKanban size={18} className="text-[#FF2F92]" />
                <h2 className="font-display text-sm sm:text-base uppercase tracking-wide text-[#171717]">
                  Portfolio Status Snapshot
                </h2>
              </div>
              <span className="text-[10.5px] font-bold text-[#171717]/60 uppercase">
                {portfolio.total_projects || 0} Total Proyek Terdaftar
              </span>
            </div>

            {/* 6 Metric Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Total Proyek */}
              <div
                onClick={() => navigate('/projects')}
                className="bg-[#F5F1E9] p-3.5 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] hover:bg-[#FFD83D]/30 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between text-[#171717]/60 group-hover:text-[#171717]">
                  <span className="text-[10px] font-black uppercase tracking-wider">Total Proyek</span>
                  <ExternalLink size={12} />
                </div>
                <p className="font-display text-3xl text-[#171717] mt-1.5 leading-none">
                  {portfolio.total_projects || 0}
                </p>
                <p className="text-[10px] font-semibold text-[#171717]/60 mt-1">Seluruh portofolio</p>
              </div>

              {/* Proyek Aktif */}
              <div
                onClick={() => navigate('/projects')}
                className="bg-white p-3.5 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] hover:bg-[#FFD83D]/30 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between text-[#171717]/60 group-hover:text-[#171717]">
                  <span className="text-[10px] font-black uppercase tracking-wider">Proyek Aktif</span>
                  <ExternalLink size={12} />
                </div>
                <p className="font-display text-3xl text-[#171717] mt-1.5 leading-none">
                  {portfolio.active_projects || 0}
                </p>
                <p className="text-[10px] font-semibold text-[#171717]/60 mt-1">Dalam pengerjaan</p>
              </div>

              {/* On Track */}
              <div
                onClick={() => navigate('/projects?status=on_track')}
                className="bg-[#10B981]/15 p-3.5 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] hover:bg-[#10B981]/25 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between text-[#10B981] font-bold">
                  <span className="text-[10px] font-black uppercase tracking-wider">On Track</span>
                  <ExternalLink size={12} />
                </div>
                <p className="font-display text-3xl text-[#171717] mt-1.5 leading-none">
                  {portfolio.on_track || 0}
                </p>
                <p className="text-[10px] font-semibold text-[#10B981] mt-1 font-mono">Sesuai rencana</p>
              </div>

              {/* At Risk */}
              <div
                onClick={() => navigate('/projects?status=at_risk')}
                className="bg-[#FFD83D]/25 p-3.5 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] hover:bg-[#FFD83D]/40 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between text-[#B45309] font-bold">
                  <span className="text-[10px] font-black uppercase tracking-wider">At Risk</span>
                  <ExternalLink size={12} />
                </div>
                <p className="font-display text-3xl text-[#171717] mt-1.5 leading-none">
                  {portfolio.at_risk || 0}
                </p>
                <p className="text-[10px] font-semibold text-[#B45309] mt-1">Perlu supervisi</p>
              </div>

              {/* Delayed */}
              <div
                onClick={() => navigate('/projects?status=delayed')}
                className="bg-[#FF2F92]/15 p-3.5 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] hover:bg-[#FF2F92]/25 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between text-[#FF2F92] font-bold">
                  <span className="text-[10px] font-black uppercase tracking-wider">Delayed</span>
                  <ExternalLink size={12} />
                </div>
                <p className="font-display text-3xl text-[#FF2F92] mt-1.5 leading-none">
                  {portfolio.delayed || 0}
                </p>
                <p className="text-[10px] font-semibold text-[#FF2F92] mt-1">Kritis / Terlambat</p>
              </div>

              {/* Completed */}
              <div
                onClick={() => navigate('/projects?status=completed')}
                className="bg-[#B8A0F0]/20 p-3.5 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] hover:bg-[#B8A0F0]/35 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between text-[#6D28D9] font-bold">
                  <span className="text-[10px] font-black uppercase tracking-wider">Completed</span>
                  <ExternalLink size={12} />
                </div>
                <p className="font-display text-3xl text-[#171717] mt-1.5 leading-none">
                  {portfolio.completed || 0}
                </p>
                <p className="text-[10px] font-semibold text-[#6D28D9] mt-1">{portfolio.completion_rate}% tuntas</p>
              </div>
            </div>
          </div>

          {/* C. Target vs Actual Progress Analysis */}
          <div className="bg-white border-2 border-[#171717] rounded-xl p-5 shadow-[3px_3px_0px_#171717]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-[#FF2F92]" />
                <h3 className="font-display text-xs sm:text-sm uppercase tracking-wide text-[#171717]">
                  Target vs Actual Progress (Portofolio Aktif)
                </h3>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded border border-[#171717] ${
                progressAnalysis.variance < 0 ? 'bg-[#FF2F92] text-white' : 'bg-[#10B981] text-white'
              }`}>
                Deviasi {progressAnalysis.variance > 0 ? `+${progressAnalysis.variance}` : progressAnalysis.variance}%
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-[#171717]">
                      <span>Rata-Rata Target Progress</span>
                      <span className="font-mono">{progressAnalysis.avg_target}%</span>
                    </div>
                    <div className="w-full bg-[#EAE4D8] h-3 rounded border border-[#171717] overflow-hidden mt-1 p-0.5">
                      <div className="bg-[#171717] h-full rounded" style={{ width: `${Math.min(100, progressAnalysis.avg_target)}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-[#171717]">
                      <span>Rata-Rata Aktual Progress</span>
                      <span className="font-mono">{progressAnalysis.avg_actual}%</span>
                    </div>
                    <div className="w-full bg-[#EAE4D8] h-3 rounded border border-[#171717] overflow-hidden mt-1 p-0.5">
                      <div className="bg-[#10B981] h-full rounded" style={{ width: `${Math.min(100, progressAnalysis.avg_actual)}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-[#F5F1E9] border border-[#171717] rounded-lg text-xs space-y-1">
                <p className="font-bold text-[#171717]">Kondisi Distribusi Progres:</p>
                <p className="text-[11.5px] text-[#171717]/80">
                  <span className="font-bold text-[#FF2F92]">{progressAnalysis.projects_below_target}</span> proyek berada di bawah target progres yang ditentukan.
                </p>
                <p className="text-[11.5px] text-[#171717]/80">
                  <span className="font-bold text-[#10B981]">{progressAnalysis.projects_on_target}</span> proyek berjalan sesuai atau melampaui target.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          D. ATTENTION RADAR (PROJECTS NEEDING IMMEDIATE LEADERSHIP ATTENTION)
      ========================================================================= */}
      <div className="bg-white border-2 border-[#171717] rounded-xl p-5 sm:p-6 shadow-[3px_3px_0px_#171717]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#171717]/15 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-[#FF2F92]" />
            <div>
              <h2 className="font-display text-sm sm:text-base uppercase tracking-wide text-[#171717]">
                Attention Radar — Proyek Membutuhkan Perhatian
              </h2>
              <p className="text-[11px] font-semibold text-[#171717]/60">
                Proyek aktif yang ditandai karena status delayed, deviasi progres negatif, risiko tinggi, atau blocker aktif.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 bg-[#FF2F92]/10 text-[#FF2F92] border border-[#FF2F92] rounded self-start sm:self-auto">
            {radar.length} Proyek Terdeteksi
          </span>
        </div>

        {radar.length === 0 ? (
          <div className="p-8 text-center bg-[#F5F1E9] border border-[#171717]/30 rounded-lg">
            <CheckCircle2 size={32} className="text-[#10B981] mx-auto mb-2" />
            <p className="font-display text-sm uppercase text-[#171717]">Seluruh Proyek Berjalan Aman</p>
            <p className="text-xs text-[#171717]/60 mt-0.5">Tidak ada proyek aktif dengan indikator keterlambatan kritis atau risiko tinggi hari ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {radar.map((proj) => {
              const statusCfg = STATUS_THEME[proj.status] || STATUS_THEME.on_track

              return (
                <div
                  key={proj.id}
                  onClick={() => navigate(`/projects/${proj.id}`)}
                  className="bg-[#F5F1E9] border-1.5 border-[#171717] rounded-lg p-4 shadow-[2px_2px_0px_#171717] hover:bg-white cursor-pointer transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Header item */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="text-[9.5px] font-mono font-bold text-[#171717]/60 uppercase">{proj.code}</span>
                        <h4 className="font-bold text-sm text-[#171717] group-hover:text-[#FF2F92] transition-colors leading-snug line-clamp-1">
                          {proj.name}
                        </h4>
                        <p className="text-[10.5px] text-[#171717]/60 font-semibold truncate">Klien: {proj.client}</p>
                      </div>

                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border border-[#171717] shrink-0 ${statusCfg.bg} ${statusCfg.text}`}>
                        {statusCfg.label}
                      </span>
                    </div>

                    {/* Progress Bar & Deviation */}
                    <div className="my-3 space-y-1">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span>Progress: {proj.progress}%</span>
                        <span className={proj.deviation < 0 ? 'text-[#FF2F92]' : 'text-[#10B981]'}>
                          Target: {proj.target_progress}% ({proj.deviation > 0 ? `+${proj.deviation}` : proj.deviation}%)
                        </span>
                      </div>
                      <div className="w-full bg-white h-2 rounded-full border border-[#171717] overflow-hidden">
                        <div className="h-full bg-[#171717]" style={{ width: `${proj.progress}%` }} />
                      </div>
                    </div>

                    {/* Flag Reasons */}
                    <div className="space-y-1 my-2">
                      {proj.flag_reasons?.map((reason, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[#FF2F92]">
                          <AlertCircle size={12} className="shrink-0" />
                          <span className="truncate">{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer item: PM & Deadline */}
                  <div className="mt-3 pt-2.5 border-t border-[#171717]/15 flex items-center justify-between text-[10.5px] text-[#171717]/70 font-semibold">
                    <span className="truncate">PIC: {proj.pic_name}</span>
                    <span className="flex items-center gap-1 text-[#171717] font-bold shrink-0">
                      Detail <ArrowRight size={11} />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          E. TASK REVIEW BACKLOG & RECENT EXECUTIVE FEED (2 COLUMN GRID)
      ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* E1. Task Review Backlog */}
        <div className="lg:col-span-6 bg-white border-2 border-[#171717] rounded-xl p-5 sm:p-6 shadow-[3px_3px_0px_#171717] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#171717]/15 mb-3">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-[#FFD83D]" />
                <div>
                  <h2 className="font-display text-sm sm:text-base uppercase tracking-wide text-[#171717]">
                    Task Review Backlog
                  </h2>
                  <p className="text-[10.5px] font-semibold text-[#171717]/60">
                    Antrean review teknis Project Manager (Approval Operasional PM)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 bg-[#FFD83D] text-[#171717] text-[10px] font-black rounded border border-[#171717]">
                  {reviewBacklog.total_in_review || 0} Antrean
                </span>
                {reviewBacklog.overdue_count > 0 && (
                  <span className="px-2 py-0.5 bg-[#FF2F92] text-white text-[10px] font-black rounded border border-[#171717]">
                    {reviewBacklog.overdue_count} &gt; 3 Hari
                  </span>
                )}
              </div>
            </div>

            <p className="text-[11px] text-[#171717]/70 bg-[#F5F1E9] p-2.5 rounded-lg border border-[#171717]/30 mb-3">
              <span className="font-bold">Catatan Otoritas:</span> Tahap ini memantau kelancaran approval teknis oleh PM agar pekerjaan tim tidak tertahan. Pimpinan dapat menegur PM jika antrean menumpuk lebih dari 3 hari.
            </p>

            {/* List Tasks in Review */}
            {!reviewBacklog.items || reviewBacklog.items.length === 0 ? (
              <div className="p-6 text-center text-xs font-semibold text-[#171717]/60 bg-[#F5F1E9] rounded-lg border border-[#171717]/20">
                Tidak ada tugas yang sedang menunggu review PM saat ini.
              </div>
            ) : (
              <div className="space-y-2.5">
                {reviewBacklog.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-[#F5F1E9] border border-[#171717] rounded-lg flex items-start justify-between gap-3 hover:bg-white transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9.5px] font-mono font-bold text-[#171717]/60">{item.project_code}</span>
                        <span className="text-[10px] text-[#171717]/40">•</span>
                        <span className="text-[10px] font-semibold text-[#171717]/70 truncate">{item.project_name}</span>
                      </div>
                      <p className="font-bold text-xs text-[#171717] mt-0.5 truncate">{item.title}</p>
                      <p className="text-[10px] text-[#171717]/60 mt-0.5">
                        Diajukan oleh: <span className="font-semibold text-[#171717]">{item.assignee_name}</span> • PM Reviewer: <span className="font-semibold text-[#171717]">{item.pm_name}</span>
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-[9.5px] font-black px-2 py-0.5 rounded border border-[#171717] ${
                        item.is_overdue ? 'bg-[#FF2F92] text-white' : 'bg-white text-[#171717]'
                      }`}>
                        {item.waiting_days} hari
                      </span>
                      <p className="text-[9px] text-[#171717]/50 mt-1">{item.submitted_at}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* E2. Recent Executive Feed */}
        <div className="lg:col-span-6 bg-white border-2 border-[#171717] rounded-xl p-5 sm:p-6 shadow-[3px_3px_0px_#171717] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#171717]/15 mb-3">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-[#FF2F92]" />
                <h2 className="font-display text-sm sm:text-base uppercase tracking-wide text-[#171717]">
                  Recent Executive Feed
                </h2>
              </div>
              <span className="text-[10.5px] font-bold text-[#171717]/60 uppercase">
                Aktivitas Strategis Riil
              </span>
            </div>

            {feed.length === 0 ? (
              <div className="p-6 text-center text-xs font-semibold text-[#171717]/60 bg-[#F5F1E9] rounded-lg border border-[#171717]/20">
                Belum ada catatan aktivitas baru di sistem.
              </div>
            ) : (
              <div className="space-y-2.5">
                {feed.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-[#F5F1E9] border border-[#171717] rounded-lg hover:bg-white transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded border border-[#171717] ${item.badge?.bg || 'bg-[#FFD83D]'} ${item.badge?.text || 'text-[#171717]'}`}>
                        {item.badge?.label || 'Aktivitas'}
                      </span>
                      <span className="text-[10px] font-semibold text-[#171717]/50">{item.time_ago}</span>
                    </div>
                    <p className="font-bold text-xs text-[#171717] leading-snug">{item.title}</p>
                    <p className="text-[10.5px] text-[#171717]/70 mt-0.5 line-clamp-2">{item.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          F. HISTORICAL TREND (AUTHENTIC WEEKLY REPORT SNAPSHOTS)
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
    </div>
  )
}
