import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ListTodo,
  CheckSquare,
  Calendar,
  CalendarDays,
  RotateCcw,
  RefreshCw,
  Filter,
  ArrowRight,
  Info,
  Sparkles,
  X,
  ExternalLink,
  MessageSquare,
  Activity,
  Award,
  CheckCheck,
  Folder,
  User,
  Layers,
  Inbox
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import PageLoading from '../../components/ui/PageLoading'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'

// Opsi Periode Analitik
const PERIOD_OPTIONS = [
  { id: '7d', label: '7 Hari' },
  { id: '30d', label: '30 Hari' },
  { id: 'this_month', label: 'Bulan Ini' },
  { id: '3m', label: '3 Bulan' },
  { id: 'this_year', label: 'Tahun Ini' },
  { id: 'custom', label: 'Kustom' },
]

export default function MemberPerformanceCenter() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // State Data Analitik
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  // Filter Periode
  const [period, setPeriod] = useState('30d')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showCustomModal, setShowCustomModal] = useState(false)

  // Filter Tab Histori Aktivitas
  const [activityTypeFilter, setActivityTypeFilter] = useState('all') // 'all', 'update', 'review', 'approval', 'revision'

  // Waktu Live Asia/Jakarta
  const [currentTime, setCurrentTime] = useState(() => {
    return new Date().toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  })

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch Data Analitik dari Backend
  const fetchPerformanceData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const params = { period }
      if (period === 'custom') {
        if (!customStartDate || !customEndDate) {
          setShowCustomModal(true)
          setLoading(false)
          setRefreshing(false)
          return
        }
        params.start_date = customStartDate
        params.end_date = customEndDate
      }

      const res = await api.get('/member/performance', { params })
      setData(res.data)
    } catch (err) {
      console.error('Error fetching member performance data:', err)
      setError(err.response?.data?.message || 'Gagal memuat data analitik performa personal Anda.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [period, customStartDate, customEndDate])

  useEffect(() => {
    fetchPerformanceData()
  }, [fetchPerformanceData])

  // Terapkan rentang tanggal kustom
  const handleApplyCustomDate = (e) => {
    e.preventDefault()
    if (!customStartDate || !customEndDate) return
    if (customStartDate > customEndDate) {
      setError('Tanggal akhir harus sama dengan atau setelah tanggal awal.')
      return
    }
    setShowCustomModal(false)
    setPeriod('custom')
    fetchPerformanceData()
  }

  // Filter aktivitas lokal
  const filteredActivities = useMemo(() => {
    if (!data?.consistency?.activities) return []
    if (activityTypeFilter === 'all') return data.consistency.activities
    if (activityTypeFilter === 'update') {
      return data.consistency.activities.filter(a => a.type === 'update')
    }
    if (activityTypeFilter === 'review') {
      return data.consistency.activities.filter(a => ['approval', 'revision', 'review'].includes(a.type))
    }
    return data.consistency.activities
  }, [data?.consistency?.activities, activityTypeFilter])

  // Tampilan Loading Awal
  if (loading && !refreshing && !data) {
    return (
      <div className="min-h-screen bg-[#F5F1E9] p-4 sm:p-6 lg:p-8">
        <PageLoading message="Menghitung analitik produktivitas personal Anda..." />
      </div>
    )
  }

  const summary = data?.summary || {
    total_tasks: 0,
    completed_tasks: 0,
    active_tasks: 0,
    in_review_tasks: 0,
    on_time_count: 0,
    late_count: 0,
    without_deadline_count: 0,
    on_time_percentage: 0,
    overdue_active_count: 0,
    completion_rate: 0,
    total_checklists: 0,
    completed_checklists: 0,
    checklist_completion_rate: 0,
  }

  const deadlinePerf = data?.deadline_performance || {}
  const statusDist = data?.status_distribution || []
  const priorityDist = data?.priority_distribution || []
  const trendData = data?.task_completion?.trend || []
  const insights = data?.personal_insights || []

  return (
    <div className="min-h-screen bg-[#F5F1E9] text-[#171717] p-3 sm:p-5 lg:p-7 space-y-6">
      {/* Header Utama Halaman */}
      <PageHeader
        title="PERFORMA SAYA"
        tag="MEMBER PERFORMANCE"
        subtitle="Pusat evaluasi produktivitas, ketepatan waktu, dan konsistensi kerja pribadi Anda berbasis data operasional riil."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Indikator Jam Asia/Jakarta */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717] text-xs font-mono font-bold">
              <Clock size={15} className="text-[#171717]" />
              <span>{currentTime} WIB</span>
            </div>

            {/* Filter Periode Tab */}
            <div className="flex items-center gap-1 bg-white border-2 border-[#171717] p-1 rounded-xl shadow-[2px_2px_0px_#171717] overflow-x-auto scrollbar-none">
              {PERIOD_OPTIONS.map(opt => {
                const active = period === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      if (opt.id === 'custom') {
                        setShowCustomModal(true)
                      } else {
                        setPeriod(opt.id)
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer min-h-[32px] shrink-0 ${
                      active
                        ? 'bg-[#171717] text-white shadow-[1px_1px_0px_#171717]'
                        : 'text-[#171717] hover:bg-[#FAF7F2]'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>

            {/* Tombol Refresh */}
            <button
              onClick={() => fetchPerformanceData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#FFD83D] active:translate-x-0.5 active:translate-y-0.5 border-2 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717] text-xs font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-60 min-h-[44px]"
              title="Segarkan data analitik"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Segarkan</span>
            </button>
          </div>
        }
      />

      {/* Banner Error jika ada */}
      {error && (
        <div className="bg-[#FF2F92] text-white border-2 border-[#171717] p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle size={22} className="shrink-0" />
            <p className="text-xs sm:text-sm font-bold">{error}</p>
          </div>
          <button
            onClick={() => fetchPerformanceData(true)}
            className="px-3 py-1.5 bg-white text-[#171717] border border-[#171717] rounded-lg font-black text-xs hover:bg-[#FFD83D] cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Informasi Rentang Periode Aktif */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-white border-2 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717] text-xs font-bold text-[#171717]">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-[#171717]/60" />
          <span>Periode Analitik:</span>
          <span className="font-mono bg-[#FFD83D] px-2 py-0.5 border border-[#171717] rounded">
            {data?.start_date} s/d {data?.end_date}
          </span>
        </div>
        <div className="text-[11px] text-[#171717]/60">
          Data terisolasi untuk: <span className="font-black text-[#171717]">{data?.meta?.member_name || user?.name}</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. BAGIAN PERFORMANCE OVERVIEW (KPI CARDS)               */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Tugas */}
        <div className="bg-white border-2 border-[#171717] p-3.5 sm:p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#171717]/60 mb-2">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">TOTAL TUGAS</span>
            <div className="p-1.5 bg-[#FAF7F2] border border-[#171717] rounded-lg">
              <ListTodo size={15} className="text-[#171717]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#171717]">
              {summary.total_tasks}
            </div>
            <p className="text-[10px] text-[#171717]/60 font-bold mt-0.5">Penugasan periode ini</p>
          </div>
        </div>

        {/* Tugas Selesai (Done) */}
        <div className="bg-white border-2 border-[#171717] p-3.5 sm:p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#171717]/60 mb-2">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">SELESAI (DONE)</span>
            <div className="p-1.5 bg-[#10B981]/20 border border-[#171717] rounded-lg">
              <CheckCircle2 size={15} className="text-[#10B981]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#171717]">
              {summary.completed_tasks}
            </div>
            <p className="text-[10px] text-[#171717]/60 font-bold mt-0.5">Disetujui selesai oleh PM</p>
          </div>
        </div>

        {/* Sedang Berjalan (Active) */}
        <div className="bg-white border-2 border-[#171717] p-3.5 sm:p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#171717]/60 mb-2">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">SEDANG BERJALAN</span>
            <div className="p-1.5 bg-[#FFD83D]/30 border border-[#171717] rounded-lg">
              <Activity size={15} className="text-[#171717]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#171717]">
              {summary.active_tasks}
            </div>
            <p className="text-[10px] text-[#171717]/60 font-bold mt-0.5">Dalam pengerjaan aktif</p>
          </div>
        </div>

        {/* Menunggu Review PM */}
        <div className="bg-white border-2 border-[#171717] p-3.5 sm:p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#171717]/60 mb-2">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">IN-REVIEW PM</span>
            <div className="p-1.5 bg-[#B8A0F0]/30 border border-[#171717] rounded-lg">
              <Clock size={15} className="text-[#171717]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#171717]">
              {summary.in_review_tasks}
            </div>
            <p className="text-[10px] text-[#171717]/60 font-bold mt-0.5">Menunggu pemeriksaan</p>
          </div>
        </div>

        {/* Ketepatan Waktu (On-Time) */}
        <div className="bg-white border-2 border-[#171717] p-3.5 sm:p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#171717]/60 mb-2">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">ON-TIME RATE</span>
            <div className="p-1.5 bg-[#FFD83D] border border-[#171717] rounded-lg">
              <Award size={15} className="text-[#171717]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#171717]">
              {summary.on_time_percentage}%
            </div>
            <p className="text-[10px] text-[#171717]/60 font-bold mt-0.5">
              {summary.on_time_count} tepat waktu, {summary.late_count} terlambat
            </p>
          </div>
        </div>

        {/* Overdue Aktif */}
        <div className={`border-2 border-[#171717] p-3.5 sm:p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between ${
          summary.overdue_active_count > 0 ? 'bg-[#FF2F92] text-white' : 'bg-white text-[#171717]'
        }`}>
          <div className="flex items-center justify-between mb-2 opacity-80">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">OVERDUE AKTIF</span>
            <div className="p-1.5 bg-black/10 border border-current rounded-lg">
              <ShieldAlert size={15} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono">
              {summary.overdue_active_count}
            </div>
            <p className="text-[10px] font-bold mt-0.5 opacity-80">
              {summary.overdue_active_count > 0 ? 'Melewati batas waktu' : 'Nol tugas terlambat'}
            </p>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. BAGIAN TASK COMPLETION & DEADLINE ANALYTICS          */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grafik Tren Penyelesaian Tugas (2 Kolom) */}
        <div className="lg:col-span-2 bg-white border-2 border-[#171717] p-4 sm:p-5 rounded-xl shadow-[4px_4px_0px_#171717] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-[#171717]/10 pb-3">
            <div>
              <h3 className="font-display text-base sm:text-lg text-[#171717] flex items-center gap-2">
                <TrendingUp size={18} className="text-[#FF2F92]" />
                <span>Tren Penyelesaian Tugas</span>
              </h3>
              <p className="text-xs text-[#171717]/60 font-bold">
                Volume tugas yang diselesaikan sepanjang periode ({data?.task_completion?.aggregation || 'harian'})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-[#10B981] text-white text-xs font-black rounded-lg border border-[#171717] shadow-[1px_1px_0px_#171717]">
                Total Selesai: {summary.completed_tasks}
              </span>
              <span className="px-2.5 py-1 bg-[#FFD83D] text-[#171717] text-xs font-black rounded-lg border border-[#171717] shadow-[1px_1px_0px_#171717]">
                Rate: {summary.completion_rate}%
              </span>
            </div>
          </div>

          {/* Bar Chart Recharts */}
          <div className="h-64 sm:h-72 w-full pt-2">
            {trendData.length > 0 && trendData.some(d => d.completed_count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <XAxis
                    dataKey="label"
                    stroke="#171717"
                    tick={{ fill: '#171717', fontSize: 10, fontWeight: 700 }}
                    angle={-25}
                    textAnchor="end"
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#171717"
                    allowDecimals={false}
                    tick={{ fill: '#171717', fontSize: 10, fontWeight: 700 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '2px solid #171717',
                      borderRadius: '8px',
                      boxShadow: '3px 3px 0px #171717',
                      fontWeight: 800,
                      fontSize: '11px',
                    }}
                    formatter={(val) => [`${val} Tugas Selesai`, 'Volume']}
                    labelFormatter={(label) => `Periode: ${label}`}
                  />
                  <Bar dataKey="completed_count" radius={[4, 4, 0, 0]}>
                    {trendData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.completed_count > 0 ? '#10B981' : '#EAE4D8'}
                        stroke="#171717"
                        strokeWidth={1.5}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 bg-[#FAF7F2] border-1.5 border-[#171717]/20 rounded-xl space-y-2">
                <Inbox size={32} className="text-[#171717]/40" />
                <p className="text-xs font-bold text-[#171717]/60">
                  Belum ada catatan tugas yang selesai pada rentang periode ini.
                </p>
              </div>
            )}
          </div>

          <div className="p-3 bg-[#FAF7F2] border-1.5 border-[#171717] rounded-lg text-[11px] font-bold text-[#171717]/70 flex items-center gap-2">
            <Info size={15} className="shrink-0 text-[#171717]" />
            <span>
              Tingkat penyelesaian (Completion Rate) dihitung dari rasio tugas berstatus selesai terhadap total tugas yang pernah ditugaskan pada periode ini.
            </span>
          </div>
        </div>

        {/* Breakdown Status & Prioritas Tugas (1 Kolom) */}
        <div className="bg-white border-2 border-[#171717] p-4 sm:p-5 rounded-xl shadow-[4px_4px_0px_#171717] space-y-5 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-base sm:text-lg text-[#171717] border-b-2 border-[#171717]/10 pb-2">
              Distribusi Pekerjaan
            </h3>

            {/* Status Breakdown */}
            <div className="mt-4 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#171717]/50 block">
                BERDASARKAN STATUS
              </span>
              <div className="space-y-2">
                {statusDist.map(item => (
                  <div key={item.status} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-[#171717]"
                          style={{ backgroundColor: item.color }}
                        />
                        <span>{item.label}</span>
                      </span>
                      <span className="font-mono">{item.count} ({item.percentage}%)</span>
                    </div>
                    <div className="w-full h-2 bg-[#FAF7F2] border border-[#171717] rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: item.color === '#FAF7F2' ? '#B8A0F0' : item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority Breakdown */}
            <div className="mt-5 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#171717]/50 block">
                BERDASARKAN PRIORITAS
              </span>
              <div className="grid grid-cols-2 gap-2">
                {priorityDist.map(item => (
                  <div
                    key={item.priority}
                    className="p-2 border-1.5 border-[#171717] rounded-lg text-xs font-bold flex items-center justify-between"
                    style={{ backgroundColor: item.color + '20' }}
                  >
                    <span>{item.label}</span>
                    <span className="font-mono font-black">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick link ke Workspace */}
          <button
            onClick={() => navigate('/tasks')}
            className="w-full py-2.5 px-3 bg-[#FFD83D] hover:bg-[#FFE066] active:translate-x-0.5 active:translate-y-0.5 border-2 border-[#171717] rounded-xl text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#171717] flex items-center justify-center gap-2 cursor-pointer transition-all mt-4"
          >
            <span>Buka Workspace Saya</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. DEADLINE & CHECKLIST PRODUCTIVITY                    */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ketepatan Waktu & Deadline */}
        <div className="bg-white border-2 border-[#171717] p-4 sm:p-5 rounded-xl shadow-[4px_4px_0px_#171717] space-y-4">
          <div className="border-b-2 border-[#171717]/10 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base sm:text-lg text-[#171717] flex items-center gap-2">
                <Clock size={18} className="text-[#FF5722]" />
                <span>Analitik Ketepatan Waktu</span>
              </h3>
              <p className="text-xs text-[#171717]/60 font-bold">
                Perbandingan ketepatan penyelesaian terhadap batas waktu
              </p>
            </div>
            <span className="text-xl font-mono font-black text-[#171717]">
              {summary.on_time_percentage}% On-Time
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-[#10B981]/15 border-1.5 border-[#171717] rounded-xl text-center">
              <span className="text-[10px] font-black uppercase text-[#171717]/70 block">Tepat Waktu</span>
              <span className="text-xl font-mono font-black text-[#10B981]">{summary.on_time_count}</span>
            </div>
            <div className="p-3 bg-[#FF5722]/15 border-1.5 border-[#171717] rounded-xl text-center">
              <span className="text-[10px] font-black uppercase text-[#171717]/70 block">Terlambat</span>
              <span className="text-xl font-mono font-black text-[#FF5722]">{summary.late_count}</span>
            </div>
            <div className="p-3 bg-[#FAF7F2] border-1.5 border-[#171717] rounded-xl text-center">
              <span className="text-[10px] font-black uppercase text-[#171717]/70 block">Tanpa Deadline</span>
              <span className="text-xl font-mono font-black text-[#171717]">{summary.without_deadline_count}</span>
            </div>
            <div className="p-3 bg-[#FFD83D]/30 border-1.5 border-[#171717] rounded-xl text-center">
              <span className="text-[10px] font-black uppercase text-[#171717]/70 block">Due Minggu Ini</span>
              <span className="text-xl font-mono font-black text-[#171717]">{deadlinePerf.due_this_week_count || 0}</span>
            </div>
          </div>

          {/* Durasi Penyelesaian */}
          <div className="p-3.5 bg-[#FAF7F2] border-1.5 border-[#171717] rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Rata-Rata Durasi Penyelesaian:</span>
              <span className="font-mono font-black text-sm">
                {deadlinePerf.duration_available ? `${deadlinePerf.average_duration_days} Hari` : 'Belum Tersedia'}
              </span>
            </div>
            <p className="text-[10px] text-[#171717]/60 font-medium">
              {deadlinePerf.duration_note}
            </p>
          </div>
        </div>

        {/* Produktivitas Checklist Pekerjaan */}
        <div className="bg-white border-2 border-[#171717] p-4 sm:p-5 rounded-xl shadow-[4px_4px_0px_#171717] space-y-4">
          <div className="border-b-2 border-[#171717]/10 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base sm:text-lg text-[#171717] flex items-center gap-2">
                <CheckSquare size={18} className="text-[#3B82F6]" />
                <span>Produktivitas Checklist</span>
              </h3>
              <p className="text-xs text-[#171717]/60 font-bold">
                Tingkat pemenuhan sub-tugas operasional
              </p>
            </div>
            <span className="text-xl font-mono font-black text-[#171717]">
              {summary.checklist_completion_rate}% Selesai
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Rasio Pemenuhan Checklist:</span>
              <span className="font-mono font-black">
                {summary.completed_checklists} dari {summary.total_checklists} item
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3.5 bg-[#FAF7F2] border-2 border-[#171717] rounded-full overflow-hidden shadow-[1px_1px_0px_#171717]">
              <div
                className="h-full bg-[#10B981] transition-all"
                style={{ width: `${summary.checklist_completion_rate}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-[#FAF7F2] border-1.5 border-[#171717] rounded-xl text-center">
                <span className="text-[10px] font-black uppercase text-[#171717]/60 block">Checklist Tuntas</span>
                <span className="text-lg font-mono font-black text-[#10B981]">{summary.completed_checklists}</span>
              </div>
              <div className="p-3 bg-[#FAF7F2] border-1.5 border-[#171717] rounded-xl text-center">
                <span className="text-[10px] font-black uppercase text-[#171717]/60 block">Belum Selesai</span>
                <span className="text-lg font-mono font-black text-[#FF5722]">
                  {Math.max(0, summary.total_checklists - summary.completed_checklists)}
                </span>
              </div>
            </div>

            <p className="text-[10px] text-[#171717]/60 font-bold italic pt-1">
              Catatan: Penyelesaian checklist merupakan prasyarat internal sebelum pengajuan review, bukan pengganti persetujuan resmi PM.
            </p>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. BAGIAN WORK CONSISTENCY & ACTIVITY HISTORY           */}
      {/* ======================================================== */}
      <div className="bg-white border-2 border-[#171717] p-4 sm:p-5 rounded-xl shadow-[4px_4px_0px_#171717] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#171717]/10 pb-3">
          <div>
            <h3 className="font-display text-base sm:text-lg text-[#171717] flex items-center gap-2">
              <Calendar size={18} className="text-[#B8A0F0]" />
              <span>Konsistensi & Riwayat Aktivitas Kerja</span>
            </h3>
            <p className="text-xs text-[#171717]/60 font-bold">
              Catatan riil pelaporan progres dan interaksi review tugas Anda
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 bg-[#FAF7F2] border-1.5 border-[#171717] rounded-xl text-xs font-bold">
              Hari Aktif: <span className="font-mono font-black text-[#171717]">{data?.consistency?.active_days_count || 0}</span> Hari
            </div>
            <div className="px-3 py-1.5 bg-[#FAF7F2] border-1.5 border-[#171717] rounded-xl text-xs font-bold">
              Minggu Aktif: <span className="font-mono font-black text-[#171717]">{data?.consistency?.active_weeks_count || 0}</span> Minggu
            </div>
          </div>
        </div>

        {/* Filter Tab Histori */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'Semua Aktivitas' },
            { id: 'update', label: 'Laporan Progres' },
            { id: 'review', label: 'Review & Persetujuan PM' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActivityTypeFilter(tab.id)}
              className={`px-3 py-1.5 border-1.5 border-[#171717] rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all ${
                activityTypeFilter === tab.id
                  ? 'bg-[#171717] text-white shadow-[1px_1px_0px_#171717]'
                  : 'bg-[#FAF7F2] text-[#171717] hover:bg-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Feed List Aktivitas */}
        <div className="space-y-2.5 pt-1">
          {filteredActivities.length === 0 ? (
            <div className="py-8 text-center text-xs font-bold text-[#171717]/60 bg-[#FAF7F2] border border-[#171717]/20 rounded-xl">
              Belum ada rekaman aktivitas yang tercatat pada periode ini.
            </div>
          ) : (
            filteredActivities.map(act => (
              <div
                key={act.id}
                className="p-3 bg-[#FAF7F2] hover:bg-white border-1.5 border-[#171717] rounded-xl transition-all shadow-[1px_1px_0px_#171717] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider rounded border ${
                      act.type === 'update'
                        ? 'bg-[#3B82F6] text-white border-[#171717]'
                        : act.type === 'approval'
                        ? 'bg-[#10B981] text-white border-[#171717]'
                        : 'bg-[#FF5722] text-white border-[#171717]'
                    }`}>
                      {act.title}
                    </span>
                    <span className="text-xs font-bold text-[#171717] truncate max-w-[300px]">
                      {act.task_title}
                    </span>
                    {act.project_name && (
                      <span className="text-[10px] text-[#171717]/60 font-bold truncate max-w-[200px]">
                        • {act.project_name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#171717]/80 font-medium whitespace-pre-line">
                    {act.description}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] font-mono font-bold text-[#171717]/60 block">
                    {act.timestamp ? new Date(act.timestamp).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    }) : '-'}
                  </span>
                  <span className="text-[9px] font-mono text-[#171717]/40 block">
                    {act.timestamp ? new Date(act.timestamp).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    }) + ' WIB' : ''}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. BAGIAN PERSONAL PERFORMANCE INSIGHTS                 */}
      {/* ======================================================== */}
      <div className="bg-white border-2 border-[#171717] p-4 sm:p-5 rounded-xl shadow-[4px_4px_0px_#171717] space-y-4">
        <div className="border-b-2 border-[#171717]/10 pb-3 flex items-center justify-between">
          <div>
            <h3 className="font-display text-base sm:text-lg text-[#171717] flex items-center gap-2">
              <Sparkles size={18} className="text-[#FFD83D]" />
              <span>Insight Kinerja & Catatan Pola Kerja</span>
            </h3>
            <p className="text-xs text-[#171717]/60 font-bold">
              Kesimpulan objektif berdasarkan data operasional aktual Anda
            </p>
          </div>
          <span className="px-2.5 py-1 bg-[#FAF7F2] text-[#171717] border border-[#171717] rounded-lg text-xs font-mono font-bold">
            {insights.length} Catatan
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.length === 0 ? (
            <div className="col-span-2 py-6 text-center text-xs font-bold text-[#171717]/60">
              Belum ada kesimpulan insight untuk periode ini.
            </div>
          ) : (
            insights.map((ins, idx) => (
              <div
                key={idx}
                className={`p-3.5 border-2 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717] space-y-1.5 ${
                  ins.type === 'success'
                    ? 'bg-[#10B981]/10'
                    : ins.type === 'warning'
                    ? 'bg-[#FF5722]/10'
                    : 'bg-[#FAF7F2]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#171717] flex items-center gap-1.5">
                    {ins.type === 'success' ? (
                      <CheckCircle2 size={14} className="text-[#10B981]" />
                    ) : ins.type === 'warning' ? (
                      <AlertTriangle size={14} className="text-[#FF5722]" />
                    ) : (
                      <Info size={14} className="text-[#3B82F6]" />
                    )}
                    <span>{ins.title}</span>
                  </h4>
                  {ins.metric && (
                    <span className="text-[10px] font-mono font-black px-2 py-0.5 bg-white border border-[#171717] rounded">
                      {ins.metric}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#171717]/80 font-medium leading-relaxed">
                  {ins.description}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="p-3 bg-[#FAF7F2] border-1.5 border-[#171717]/30 rounded-lg text-[10px] font-bold text-[#171717]/60">
          {data?.meta?.notice}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL FILTER TANGGAL KUSTOM                              */}
      {/* ======================================================== */}
      {showCustomModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setShowCustomModal(false)}
        >
          <div
            className="bg-[#F5F1E9] border-2 border-[#171717] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-[6px_6px_0px_#171717]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-[#171717]/10 pb-3">
              <h3 className="font-display text-lg text-[#171717]">
                Pilih Rentang Tanggal
              </h3>
              <button
                onClick={() => setShowCustomModal(false)}
                className="p-1 hover:bg-[#FF2F92] hover:text-white border border-[#171717] rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApplyCustomDate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-[#171717]">
                  Tanggal Mulai
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold focus:outline-none focus:shadow-[2px_2px_0px_#171717]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-[#171717]">
                  Tanggal Akhir
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold focus:outline-none focus:shadow-[2px_2px_0px_#171717]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 bg-[#FAF7F2] hover:bg-white border-2 border-[#171717] rounded-xl text-xs font-black shadow-[1px_1px_0px_#171717] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FFD83D] hover:bg-[#FFE066] border-2 border-[#171717] rounded-xl text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#171717] cursor-pointer"
                >
                  Terapkan Filter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
