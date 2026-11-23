import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import {
  CalendarDays,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Filter,
  Search,
  RotateCcw,
  Eye,
  Flag,
  ArrowRight,
  Folder,
  Layers,
  Sparkles,
  X,
  Check,
  Lock,
  Loader2,
  ListTodo,
  TrendingUp,
  Award,
  AlertCircle,
  HelpCircle,
  LayoutGrid,
  List,
  CalendarRange
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

// Konfigurasi Prioritas (Neobrutalism Design)
const PRIORITY_CONFIG = {
  urgent: { label: 'Mendesak', bg: 'bg-[#FF2F92] text-white border-[#171717]', sortWeight: 4, dot: '#FF2F92' },
  high:   { label: 'Tinggi',   bg: 'bg-[#FF5722] text-white border-[#171717]', sortWeight: 3, dot: '#FF5722' },
  medium: { label: 'Sedang',   bg: 'bg-[#FFD83D] text-[#171717] border-[#171717]', sortWeight: 2, dot: '#FBBF24' },
  low:    { label: 'Rendah',   bg: 'bg-[#B8A0F0] text-[#171717] border-[#171717]', sortWeight: 1, dot: '#B8A0F0' },
}

// Konfigurasi Status
const STATUS_CONFIG = {
  todo:        { label: 'Daftar Tugas',    bg: 'bg-[#FAF7F2] text-[#171717] border-[#171717]' },
  pending:     { label: 'Daftar Tugas',    bg: 'bg-[#FAF7F2] text-[#171717] border-[#171717]' },
  in_progress: { label: 'Sedang Berjalan', bg: 'bg-[#FFD83D] text-[#171717] border-[#171717]' },
  in_review:   { label: 'Menunggu PM',     bg: 'bg-[#B8A0F0] text-[#171717] border-[#171717]' },
  completed:   { label: 'Selesai',         bg: 'bg-[#10B981] text-white border-[#171717]' },
  done:        { label: 'Selesai',         bg: 'bg-[#10B981] text-white border-[#171717]' },
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

export default function MemberWorkCalendar() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // State Utama Kalender
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  // Tanggal navigasi aktif (Tahun & Bulan saat ini di Indonesia)
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [viewMode, setViewMode] = useState('month') // 'month' | 'week' | 'agenda'

  // Filter & Pencarian
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'overdue', 'due_today', 'upcoming', 'completed', 'in_progress', 'in_review'
  const [priorityFilter, setPriorityFilter] = useState('all') // 'all', 'urgent', 'high', 'medium', 'low'
  const [searchQuery, setSearchQuery] = useState('')

  // State Detail Modal Tugas
  const [selectedTask, setSelectedTask] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [togglingChecklistId, setTogglingChecklistId] = useState(null)
  const [feedback, setFeedback] = useState(null)

  // Fetch data kalender dari backend
  const fetchCalendarData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      // Hitung batas bulan untuk query range jika diperlukan
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      const params = {}
      if (priorityFilter !== 'all') params.priority = priorityFilter
      if (statusFilter !== 'all') params.status = statusFilter
      if (searchQuery.trim()) params.search = searchQuery.trim()

      const res = await api.get('/member/calendar', { params })
      setData(res.data)
    } catch (err) {
      console.error('Error fetching calendar data:', err)
      setError(err.response?.data?.message || 'Gagal memuat kalender kerja pribadi Anda.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchCalendarData()
  }, [priorityFilter, statusFilter, searchQuery])

  // Navigasi Bulan / Minggu
  const handlePrev = () => {
    if (viewMode === 'week') {
      const d = new Date(currentDate)
      d.setDate(d.getDate() - 7)
      setCurrentDate(d)
    } else {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
      setCurrentDate(d)
    }
  }

  const handleNext = () => {
    if (viewMode === 'week') {
      const d = new Date(currentDate)
      d.setDate(d.getDate() + 7)
      setCurrentDate(d)
    } else {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
      setCurrentDate(d)
    }
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  // Buka detail tugas
  const handleOpenTaskDetail = async (task) => {
    setSelectedTask(task)
    setModalLoading(true)
    try {
      const res = await api.get(`/tasks/${task.id}`)
      if (res.data?.task) {
        setSelectedTask(res.data.task)
      }
    } catch (err) {
      console.error('Failed to load task detail:', err)
    } finally {
      setModalLoading(false)
    }
  }

  // Toggle checklist langsung dari kalender
  const handleToggleChecklist = async (checklistId) => {
    if (togglingChecklistId || !selectedTask) return
    if (selectedTask.status === 'in_review') {
      setFeedback({ type: 'error', message: 'Checklist terkunci selama dalam review PM.' })
      setTimeout(() => setFeedback(null), 3000)
      return
    }
    if (selectedTask.is_completed || ['completed', 'done'].includes(selectedTask.status)) {
      setFeedback({ type: 'error', message: 'Tugas sudah disetujui selesai oleh PM.' })
      setTimeout(() => setFeedback(null), 3000)
      return
    }

    setTogglingChecklistId(checklistId)
    try {
      const res = await api.post(`/checklists/${checklistId}/toggle`)
      const updatedChk = res.data.checklist
      const updatedStats = res.data.stats

      setSelectedTask(prev => {
        if (!prev) return null
        const cls = (prev.checklists || []).map(c => c.id === checklistId ? updatedChk : c)
        return {
          ...prev,
          checklists: cls,
          checklist_total: updatedStats.total,
          checklist_completed: updatedStats.completed,
          checklist_progress: updatedStats.progress,
        }
      })

      fetchCalendarData()
      setFeedback({ type: 'success', message: updatedChk.is_completed ? 'Checklist diselesaikan!' : 'Checklist dibatalkan.' })
      setTimeout(() => setFeedback(null), 3000)
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Gagal mengubah checklist.' })
      setTimeout(() => setFeedback(null), 3000)
    } finally {
      setTogglingChecklistId(null)
    }
  }

  // Tanggal hari ini dalam format YYYY-MM-DD lokal
  const todayStr = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }, [])

  // Pemetaan Tugas per Tanggal Deadline
  const tasksByDate = useMemo(() => {
    const map = new Map()
    if (!data?.tasks) return map

    data.tasks.forEach(task => {
      if (task.deadline) {
        const d = task.deadline.split('T')[0]
        if (!map.has(d)) map.set(d, [])
        map.get(d).push(task)
      }
    })
    return map
  }, [data?.tasks])

  // Perhitungan Hari dalam Kalender Bulanan (Senin - Minggu)
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDayIndex = new Date(year, month, 1).getDay() // 0 = Minggu
    // Konversi ke format Senin = 0, Minggu = 6
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1

    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const days = []

    // Hari dari bulan sebelumnya
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i
      const prevDate = new Date(year, month - 1, d)
      const dateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      })
    }

    // Hari dalam bulan berjalan
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      })
    }

    // Hari dari bulan berikutnya untuk melengkapi kelipatan 7
    const remaining = 7 - (days.length % 7)
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const nextDate = new Date(year, month + 1, d)
        const dateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        days.push({
          dayNumber: d,
          dateStr,
          isCurrentMonth: false,
          isToday: dateStr === todayStr,
        })
      }
    }

    return days
  }, [currentDate, todayStr])

  // Perhitungan 7 Hari untuk Mode Mingguan
  const weekDays = useMemo(() => {
    const d = new Date(currentDate)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Senin
    const monday = new Date(d.setDate(diff))

    const days = []
    for (let i = 0; i < 7; i++) {
      const cur = new Date(monday)
      cur.setDate(monday.getDate() + i)
      const dateStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
      days.push({
        dayName: DAY_NAMES[i],
        dayNumber: cur.getDate(),
        dateStr,
        isToday: dateStr === todayStr,
        fullDate: cur,
      })
    }
    return days
  }, [currentDate, todayStr])

  // Agenda View: Tugas terurut berdasarkan tanggal terdekat
  const agendaTasks = useMemo(() => {
    if (!data?.tasks) return []
    return [...data.tasks].sort((a, b) => {
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return a.deadline.localeCompare(b.deadline)
    })
  }, [data?.tasks])

  // Data KPI Overview
  const overview = data?.overview || {
    due_today: 0,
    due_this_week: 0,
    near_deadline: 0,
    overdue: 0,
    completed_this_month: 0,
  }

  const upcomingDeadlines = data?.upcoming_deadlines || []
  const dailyDistribution = data?.daily_distribution || []

  // Sapaan dan Tanggal Header
  const activeDateFormatted = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  if (loading && !data) {
    return (
      <PageLoading
        mode="page"
        text="Memuat Kalender Kerja Anda..."
        subtext="Mengagregasi deadline pekerjaan, status checklist, dan jadwal pribadi."
      />
    )
  }

  if (error && !data) {
    return (
      <div className="p-6 bg-white border-1.5 border-[#171717] rounded-xl shadow-[4px_4px_0px_#171717] max-w-lg mx-auto my-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-[#FF2F92]/15 border border-[#FF2F92] flex items-center justify-center mx-auto text-[#FF2F92]">
          <AlertCircle size={24} />
        </div>
        <h3 className="font-display text-xl uppercase text-[#171717]">Gagal Memuat Kalender</h3>
        <p className="text-xs font-semibold text-[#171717]/70 leading-relaxed">{error}</p>
        <button
          onClick={() => fetchCalendarData(true)}
          className="px-5 py-2.5 bg-[#FFD83D] text-[#171717] font-black text-xs uppercase border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center gap-2 mx-auto cursor-pointer"
        >
          <RotateCcw size={14} /> Coba Muat Ulang
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      {/* =========================================================================
          1. PAGE HEADER (Standardized PKM Global Component)
         ========================================================================= */}
      <PageHeader
        title="KALENDER KERJA"
        subtitle="Pantau jadwal, deadline, dan rencana penyelesaian pekerjaan pribadi Anda secara real-time."
        tag="PUSAT JADWAL MEMBER"
        badge={
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block animate-pulse" />
            <span className="text-[10px] font-bold text-[#171717]">Asia/Jakarta (WIB)</span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleToday}
              className="px-3.5 py-2 bg-white hover:bg-[#FAF7F2] text-[#171717] font-bold text-xs uppercase border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center gap-1.5 cursor-pointer min-h-[40px]"
            >
              <CalendarIcon size={14} className="text-[#FF2F92]" />
              <span>Hari Ini</span>
            </button>
            <button
              onClick={() => fetchCalendarData(true)}
              disabled={refreshing}
              className="p-2.5 bg-[#FFD83D] hover:bg-[#f5cd2f] text-[#171717] border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center justify-center cursor-pointer transition-all disabled:opacity-50 min-h-[40px] min-w-[40px]"
              title="Segarkan Data Kalender"
            >
              <RotateCcw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        }
      />

      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-3.5 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex items-center justify-between text-xs font-bold animate-in fade-in ${
          feedback.type === 'success' ? 'bg-[#ECFDF5] text-[#065F46]' : 'bg-[#FFD83D] text-[#171717]'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <Check size={16} strokeWidth={3} className="text-[#10B981]" /> : <AlertTriangle size={16} className="text-[#FF2F92]" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="p-1 hover:bg-[#171717]/10 rounded cursor-pointer"><X size={14} /></button>
        </div>
      )}

      {/* =========================================================================
          2. PERSONAL SCHEDULE OVERVIEW (5 KPI Cards with Reactive Filtering)
         ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* KPI 1: Hari Ini */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'due_today' ? 'all' : 'due_today')}
          className={`p-3.5 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] text-left transition-all cursor-pointer hover:-translate-y-0.5 ${
            statusFilter === 'due_today' ? 'bg-[#FFD83D] ring-2 ring-[#171717]' : 'bg-white'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-black uppercase text-[#171717]/70">
            <span>Deadline Hari Ini</span>
            <CalendarIcon size={14} className="text-[#FF2F92]" />
          </div>
          <p className="font-display text-2xl sm:text-3xl text-[#171717] mt-1 leading-none">{overview.due_today}</p>
          <span className="text-[9.5px] font-bold text-[#171717]/60 block mt-1">Harus selesai hari ini</span>
        </button>

        {/* KPI 2: Minggu Ini */}
        <button
          onClick={() => {
            setViewMode('week')
            setStatusFilter('all')
          }}
          className={`p-3.5 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] text-left transition-all cursor-pointer hover:-translate-y-0.5 ${
            viewMode === 'week' ? 'bg-[#B8A0F0]/30 ring-2 ring-[#171717]' : 'bg-white'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-black uppercase text-[#171717]/70">
            <span>Minggu Ini</span>
            <CalendarRange size={14} className="text-[#7C3AED]" />
          </div>
          <p className="font-display text-2xl sm:text-3xl text-[#171717] mt-1 leading-none">{overview.due_this_week}</p>
          <span className="text-[9.5px] font-bold text-[#171717]/60 block mt-1">Senin s/d Minggu</span>
        </button>

        {/* KPI 3: Mendekati Deadline */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'upcoming' ? 'all' : 'upcoming')}
          className={`p-3.5 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] text-left transition-all cursor-pointer hover:-translate-y-0.5 ${
            statusFilter === 'upcoming' ? 'bg-[#FFD83D]/40 ring-2 ring-[#171717]' : 'bg-white'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-black uppercase text-[#171717]/70">
            <span>Mendekati Deadline</span>
            <Clock size={14} className="text-[#F59E0B]" />
          </div>
          <p className="font-display text-2xl sm:text-3xl text-[#171717] mt-1 leading-none">{overview.near_deadline}</p>
          <span className="text-[9.5px] font-bold text-[#171717]/60 block mt-1">1 - 3 hari mendatang</span>
        </button>

        {/* KPI 4: Terlambat */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
          className={`p-3.5 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] text-left transition-all cursor-pointer hover:-translate-y-0.5 ${
            overview.overdue > 0 ? 'bg-[#FFF0F8] border-l-4 border-l-[#FF2F92]' : 'bg-white'
          } ${statusFilter === 'overdue' ? 'ring-2 ring-[#FF2F92]' : ''}`}
        >
          <div className="flex items-center justify-between text-[10px] font-black uppercase text-[#FF2F92]">
            <span>Tugas Terlambat</span>
            <AlertTriangle size={14} className="text-[#FF2F92]" />
          </div>
          <p className="font-display text-2xl sm:text-3xl text-[#FF2F92] mt-1 leading-none">{overview.overdue}</p>
          <span className="text-[9.5px] font-bold text-[#FF2F92]/80 block mt-1">Perlu mitigasi segera</span>
        </button>

        {/* KPI 5: Selesai Bulan Ini */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
          className={`p-3.5 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] text-left transition-all cursor-pointer hover:-translate-y-0.5 ${
            statusFilter === 'completed' ? 'bg-[#ECFDF5] ring-2 ring-[#10B981]' : 'bg-[#FAF7F2]'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-black uppercase text-[#065F46]">
            <span>Selesai Bulan Ini</span>
            <CheckCircle2 size={14} className="text-[#10B981]" />
          </div>
          <p className="font-display text-2xl sm:text-3xl text-[#065F46] mt-1 leading-none">{overview.completed_this_month}</p>
          <span className="text-[9.5px] font-bold text-[#065F46]/70 block mt-1">Disetujui PM (Done)</span>
        </button>
      </div>

      {/* =========================================================================
          3. MAIN CALENDAR CONTAINER & TOOLBAR
         ========================================================================= */}
      <div className="bg-white border-1.5 border-[#171717] rounded-xl shadow-[4px_4px_0px_#171717] p-4 sm:p-5 space-y-4">
        {/* Navigation & Mode Switcher Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pb-3 border-b border-[#171717]/15">
          {/* Month/Week Navigation */}
          <div className="flex items-center gap-2">
            <div className="flex items-center border-1.5 border-[#171717] rounded-lg overflow-hidden bg-[#FAF7F2] shadow-[2px_2px_0px_#171717]">
              <button
                onClick={handlePrev}
                className="p-2 hover:bg-[#FFD83D] text-[#171717] transition-colors cursor-pointer border-r border-[#171717]"
                title="Sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleNext}
                className="p-2 hover:bg-[#FFD83D] text-[#171717] transition-colors cursor-pointer"
                title="Berikutnya"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <h2 className="font-display text-lg sm:text-xl uppercase text-[#171717] tracking-tight ml-1">
              {viewMode === 'week' ? (
                <span>
                  {weekDays[0].dayNumber} - {weekDays[6].dayNumber} {MONTH_NAMES[weekDays[6].fullDate.getMonth()]} {weekDays[6].fullDate.getFullYear()}
                </span>
              ) : (
                <span>
                  {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
                </span>
              )}
            </h2>
          </div>

          {/* View Mode Switcher (Month, Week, Agenda) */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center border-1.5 border-[#171717] rounded-lg p-0.5 bg-[#FAF7F2] shadow-[2px_2px_0px_#171717]">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 text-xs font-black uppercase rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'month' ? 'bg-[#171717] text-white shadow-[1px_1px_0px_#171717]' : 'text-[#171717] hover:bg-neutral-200'
                }`}
              >
                <LayoutGrid size={13} />
                <span>Bulan</span>
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 text-xs font-black uppercase rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'week' ? 'bg-[#171717] text-white shadow-[1px_1px_0px_#171717]' : 'text-[#171717] hover:bg-neutral-200'
                }`}
              >
                <CalendarRange size={13} />
                <span>Minggu</span>
              </button>
              <button
                onClick={() => setViewMode('agenda')}
                className={`px-3 py-1.5 text-xs font-black uppercase rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'agenda' ? 'bg-[#171717] text-white shadow-[1px_1px_0px_#171717]' : 'text-[#171717] hover:bg-neutral-200'
                }`}
              >
                <List size={13} />
                <span>Agenda</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
          {/* Live Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#171717]/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari tugas, kode proyek, atau instruksi..."
              className="w-full pl-9 pr-8 py-2 bg-[#FAF7F2] border border-[#171717]/40 rounded-lg text-xs font-semibold text-[#171717] placeholder:text-[#171717]/40 focus:outline-none focus:border-[#FF2F92] min-h-[38px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#171717]/40 hover:text-[#171717] p-1 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#FAF7F2] border border-[#171717]/40 rounded-lg px-3 py-2 text-xs font-black uppercase text-[#171717] focus:outline-none focus:border-[#FF2F92] cursor-pointer min-h-[38px]"
            >
              <option value="all">Semua Status</option>
              <option value="due_today">Hari Ini</option>
              <option value="upcoming">Mendatang</option>
              <option value="overdue">Terlambat</option>
              <option value="in_progress">Sedang Berjalan</option>
              <option value="in_review">Menunggu Review PM</option>
              <option value="completed">Selesai (Done)</option>
            </select>

            {/* Priority Dropdown */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-[#FAF7F2] border border-[#171717]/40 rounded-lg px-3 py-2 text-xs font-black uppercase text-[#171717] focus:outline-none focus:border-[#FF2F92] cursor-pointer min-h-[38px]"
            >
              <option value="all">Semua Prioritas</option>
              <option value="urgent">Mendesak</option>
              <option value="high">Tinggi</option>
              <option value="medium">Sedang</option>
              <option value="low">Rendah</option>
            </select>

            {(statusFilter !== 'all' || priorityFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setStatusFilter('all')
                  setPriorityFilter('all')
                  setSearchQuery('')
                }}
                className="px-3 py-2 bg-[#FFF0F8] text-[#FF2F92] border border-[#FF2F92]/40 rounded-lg text-xs font-bold hover:bg-[#FF2F92] hover:text-white transition-all cursor-pointer min-h-[38px] flex items-center gap-1"
              >
                <RotateCcw size={12} /> Reset
              </button>
            )}
          </div>
        </div>

        {/* =========================================================================
            CALENDAR VIEW MODES
           ========================================================================= */}

        {/* 1. MONTHLY VIEW */}
        {viewMode === 'month' && (
          <div className="border border-[#171717] rounded-lg overflow-hidden">
            {/* Header Nama Hari */}
            <div className="grid grid-cols-7 bg-[#171717] text-white text-center text-xs font-black uppercase py-2.5">
              {DAY_NAMES.map((name, i) => (
                <div key={i} className="tracking-wider">{name}</div>
              ))}
            </div>

            {/* Grid Tanggal Kalender */}
            <div className="grid grid-cols-7 bg-[#EAE4D8] gap-[1px]">
              {calendarDays.map((cell, idx) => {
                const dayTasks = tasksByDate.get(cell.dateStr) || []
                const hasOverdue = dayTasks.some(t => t.is_overdue)
                const hasUrgent = dayTasks.some(t => t.priority === 'urgent')

                return (
                  <div
                    key={idx}
                    className={`min-h-[100px] sm:min-h-[120px] p-1.5 sm:p-2 flex flex-col justify-between transition-colors ${
                      cell.isCurrentMonth ? 'bg-white' : 'bg-[#FAF7F2] text-[#171717]/40'
                    } ${cell.isToday ? 'ring-2 ring-[#FF2F92] ring-inset bg-[#FFF9FC]' : ''}`}
                  >
                    {/* Baris Tanggal */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black rounded-full w-6 h-6 flex items-center justify-center ${
                        cell.isToday
                          ? 'bg-[#FF2F92] text-white shadow-[1px_1px_0px_#171717]'
                          : cell.isCurrentMonth ? 'text-[#171717]' : 'text-[#171717]/40'
                      }`}>
                        {cell.dayNumber}
                      </span>

                      {dayTasks.length > 0 && (
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${
                          hasOverdue
                            ? 'bg-[#FF2F92] text-white border-[#171717]'
                            : hasUrgent
                            ? 'bg-[#FFD83D] text-[#171717] border-[#171717]'
                            : 'bg-[#EAE4D8] text-[#171717] border-[#171717]/40'
                        }`}>
                          {dayTasks.length} Tugas
                        </span>
                      )}
                    </div>

                    {/* Daftar Mini Tugas pada Tanggal */}
                    <div className="space-y-1 mt-1.5 overflow-hidden">
                      {dayTasks.slice(0, 3).map(task => {
                        const priCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
                        const isDone = task.is_completed

                        return (
                          <div
                            key={task.id}
                            onClick={() => handleOpenTaskDetail(task)}
                            className={`p-1 rounded border text-[10px] font-bold truncate cursor-pointer transition-all hover:scale-[1.02] ${
                              isDone
                                ? 'bg-[#ECFDF5] text-[#065F46] border-[#10B981] line-through opacity-70'
                                : task.is_overdue
                                ? 'bg-[#FFF0F8] text-[#FF2F92] border-[#FF2F92]'
                                : task.status === 'in_review'
                                ? 'bg-[#B8A0F0]/20 text-[#7C3AED] border-[#B8A0F0]'
                                : 'bg-[#FAF7F2] text-[#171717] border-[#171717]/30 hover:border-[#FF2F92]'
                            }`}
                            title={`${task.title} (${task.project_code || 'PRJ'})`}
                          >
                            <span className="font-black mr-1 text-[8.5px]">[{task.project_code || 'PRJ'}]</span>
                            <span>{task.title}</span>
                          </div>
                        )
                      })}

                      {dayTasks.length > 3 && (
                        <p className="text-[9px] font-black text-[#171717]/60 text-center">
                          +{dayTasks.length - 3} tugas lagi
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 2. WEEKLY VIEW */}
        {viewMode === 'week' && (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2.5">
            {weekDays.map((col, idx) => {
              const dayTasks = tasksByDate.get(col.dateStr) || []

              return (
                <div
                  key={idx}
                  className={`border-1.5 border-[#171717] rounded-lg p-3 flex flex-col justify-between min-h-[300px] ${
                    col.isToday ? 'bg-[#FFF9FC] border-2 border-[#FF2F92] shadow-[3px_3px_0px_#FF2F92]' : 'bg-white shadow-[2px_2px_0px_#171717]'
                  }`}
                >
                  {/* Header Hari */}
                  <div className="pb-2 border-b border-[#171717]/15 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase text-[#171717]/60">{col.dayName}</p>
                      <p className={`font-display text-xl leading-none mt-0.5 ${col.isToday ? 'text-[#FF2F92]' : 'text-[#171717]'}`}>
                        {col.dayNumber}
                      </p>
                    </div>
                    {dayTasks.length > 0 && (
                      <span className="px-1.5 py-0.5 bg-[#FAF7F2] border border-[#171717] rounded text-[9px] font-black">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>

                  {/* Task List Hari Ini */}
                  <div className="space-y-2 mt-2 flex-1 overflow-y-auto max-h-[360px] pr-0.5">
                    {dayTasks.length === 0 ? (
                      <p className="text-[11px] text-[#171717]/40 font-semibold italic text-center py-8">
                        Tidak ada deadline
                      </p>
                    ) : (
                      dayTasks.map(task => {
                        const priCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
                        const isDone = task.is_completed

                        return (
                          <div
                            key={task.id}
                            onClick={() => handleOpenTaskDetail(task)}
                            className={`p-2.5 rounded-lg border-1.5 space-y-1.5 cursor-pointer transition-all hover:-translate-y-0.5 ${
                              isDone
                                ? 'bg-[#ECFDF5] border-[#10B981]'
                                : task.is_overdue
                                ? 'bg-[#FFF0F8] border-[#FF2F92]'
                                : 'bg-[#FAF7F2] border-[#171717] hover:bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[8.5px] font-black uppercase px-1 py-0.2 bg-white border border-[#171717] rounded truncate max-w-[80px]">
                                {task.project_code || 'PRJ'}
                              </span>
                              <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded border ${priCfg.bg}`}>
                                {priCfg.label}
                              </span>
                            </div>

                            <p className={`text-xs font-bold leading-tight ${isDone ? 'line-through text-[#171717]/60' : 'text-[#171717]'}`}>
                              {task.title}
                            </p>

                            <div className="flex items-center justify-between text-[9px] font-semibold text-[#171717]/60 pt-1 border-t border-[#171717]/10">
                              <span>Checklist:</span>
                              <span className="font-bold text-[#10B981]">{task.checklist_progress}%</span>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 3. AGENDA VIEW (Chronological List) */}
        {viewMode === 'agenda' && (
          <div className="space-y-3">
            {agendaTasks.length === 0 ? (
              <div className="p-12 text-center space-y-3 bg-[#FAF7F2] rounded-lg border border-[#171717]/20">
                <CheckSquare size={36} className="mx-auto text-[#171717]/30" />
                <h4 className="font-display text-lg uppercase text-[#171717]">Tidak Ada Pekerjaan Sesuai Filter</h4>
                <p className="text-xs font-semibold text-[#171717]/60 max-w-sm mx-auto">
                  Seluruh tugas Anda sudah selesai atau tidak ada jadwal yang sesuai dengan filter pencarian saat ini.
                </p>
              </div>
            ) : (
              agendaTasks.map(task => {
                const priCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
                const stCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo
                const isDone = task.is_completed

                return (
                  <div
                    key={task.id}
                    onClick={() => handleOpenTaskDetail(task)}
                    className={`p-3.5 sm:p-4 rounded-xl border-1.5 border-[#171717] shadow-[2px_2px_0px_#171717] hover:shadow-[4px_4px_0px_#171717] hover:-translate-y-0.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer ${
                      isDone
                        ? 'bg-[#ECFDF5]'
                        : task.is_overdue
                        ? 'bg-[#FFF0F8] border-l-4 border-l-[#FF2F92]'
                        : 'bg-white'
                    }`}
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-1.5 py-0.5 bg-[#FAF7F2] border border-[#171717] rounded text-[9px] font-black uppercase">
                          {task.project_code || 'PRJ'}
                        </span>
                        <span className="text-[10px] font-bold text-[#171717]/60">
                          {task.project_name}
                        </span>
                        <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded border ${priCfg.bg}`}>
                          {priCfg.label}
                        </span>
                        <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded border ${stCfg.bg}`}>
                          {stCfg.label}
                        </span>
                      </div>

                      <h3 className={`font-bold text-sm sm:text-base leading-snug ${isDone ? 'line-through text-[#171717]/60' : 'text-[#171717]'}`}>
                        {task.title}
                      </h3>

                      {task.description && (
                        <p className="text-xs text-[#171717]/70 line-clamp-1 font-medium">{task.description}</p>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#171717]/10">
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <Clock size={13} className={task.is_overdue ? 'text-[#FF2F92]' : 'text-[#171717]/60'} />
                        <span className={task.is_overdue ? 'text-[#FF2F92] font-black' : 'text-[#171717]'}>
                          {task.deadline ? new Date(task.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Tidak ada target'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-[#10B981] bg-[#ECFDF5] px-2 py-0.5 rounded border border-[#10B981]">
                          Checklist: {task.checklist_completed}/{task.checklist_total} ({task.checklist_progress}%)
                        </span>
                        <span className="text-xs text-[#171717] font-bold flex items-center gap-0.5">
                          <Eye size={13} />
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          4. BOTTOM PANELS (Upcoming Deadlines & Daily Workload Recharts)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Panel 1: Upcoming Deadline Panel (Maks 5 Pekerjaan Terdekat) */}
        <div className="lg:col-span-6 bg-white border-1.5 border-[#171717] rounded-xl shadow-[4px_4px_0px_#171717] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#171717]/15">
            <h3 className="font-display text-sm sm:text-base uppercase text-[#171717] flex items-center gap-2">
              <Clock size={16} className="text-[#FF2F92]" />
              DEADLINE BERIKUTNYA
            </h3>
            <span className="text-[10px] font-bold text-[#171717]/60">5 Prioritas Terdekat</span>
          </div>

          {upcomingDeadlines.length === 0 ? (
            <p className="text-xs text-[#171717]/50 font-semibold italic py-8 text-center bg-[#FAF7F2] rounded-lg">
              Tidak ada deadline mendatang dalam waktu dekat.
            </p>
          ) : (
            <div className="space-y-2.5">
              {upcomingDeadlines.map(item => {
                const priCfg = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.medium

                return (
                  <div
                    key={item.id}
                    onClick={() => handleOpenTaskDetail(item)}
                    className="p-3 bg-[#FAF7F2] hover:bg-white border-1.5 border-[#171717] rounded-lg flex items-center justify-between gap-3 cursor-pointer transition-all hover:-translate-y-0.5 shadow-[1px_1px_0px_#171717]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[8.5px] font-black uppercase px-1.5 py-0.2 bg-white border border-[#171717] rounded">
                          {item.project_code}
                        </span>
                        <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded border ${priCfg.bg}`}>
                          {priCfg.label}
                        </span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.2 rounded ${
                          item.urgency === 'overdue'
                            ? 'bg-[#FF2F92] text-white'
                            : item.urgency === 'today'
                            ? 'bg-[#FFD83D] text-[#171717]'
                            : 'bg-[#B8A0F0] text-[#171717]'
                        }`}>
                          {item.time_label}
                        </span>
                      </div>
                      <p className="font-bold text-xs text-[#171717] truncate">{item.title}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-mono font-bold text-[#171717]/70">
                        {new Date(item.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-[9.5px] font-black text-[#10B981] mt-0.5">
                        {item.checklist_progress}%
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Panel 2: Daily Workload Distribution (Recharts Chart) */}
        <div className="lg:col-span-6 bg-white border-1.5 border-[#171717] rounded-xl shadow-[4px_4px_0px_#171717] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#171717]/15">
            <h3 className="font-display text-sm sm:text-base uppercase text-[#171717] flex items-center gap-2">
              <TrendingUp size={16} className="text-[#10B981]" />
              DISTRIBUSI BEBAN KERJA HARIAN
            </h3>
            <span className="text-[10px] font-bold text-[#171717]/60">Berdasarkan Deadline</span>
          </div>

          {dailyDistribution.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-xs text-[#171717]/50 font-semibold bg-[#FAF7F2] rounded-lg">
              Belum ada data distribusi deadline harian.
            </div>
          ) : (
            <div className="space-y-2">
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={dailyDistribution} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fontWeight: 700 }}
                    tickFormatter={(val) => {
                      const d = new Date(val)
                      return `${d.getDate()}/${d.getMonth() + 1}`
                    }}
                  />
                  <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, border: '1.5px solid #171717', borderRadius: 6, fontWeight: 700 }}
                    labelFormatter={(val) => `Tanggal: ${val}`}
                  />
                  <Bar dataKey="total" name="Total Deadline" fill="#FFD83D" stroke="#171717" strokeWidth={1} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="completed" name="Selesai" fill="#10B981" stroke="#171717" strokeWidth={1} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-[#171717]/70 pt-1">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#FFD83D] border border-[#171717]" /> Total Deadline</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#10B981] border border-[#171717]" /> Selesai</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          5. TASK DETAIL & CHECKLIST MODAL (Reused standard Member experience)
         ========================================================================= */}
      {selectedTask && (
        <div
          className="fixed inset-0 bg-[#171717]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedTask(null) }}
        >
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#171717] w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-white border border-[#171717] rounded shrink-0">
                  {selectedTask.project_code || selectedTask.project?.code || 'PRJ'}
                </span>
                <h3 className="font-display text-base uppercase tracking-tight text-[#171717] truncate">
                  DETAIL TUGAS KALENDER
                </h3>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="p-1.5 hover:bg-[#FFD83D] border border-[#171717] rounded-md cursor-pointer transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                    STATUS_CONFIG[selectedTask.status]?.bg || 'bg-neutral-200'
                  }`}>
                    {STATUS_CONFIG[selectedTask.status]?.label || selectedTask.status}
                  </span>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                    PRIORITY_CONFIG[selectedTask.priority]?.bg || 'bg-neutral-200'
                  }`}>
                    Prioritas {PRIORITY_CONFIG[selectedTask.priority]?.label || selectedTask.priority}
                  </span>
                </div>
                <h2 className="font-display text-xl uppercase text-[#171717] leading-tight">
                  {selectedTask.title}
                </h2>
              </div>

              {selectedTask.description && (
                <div className="p-3 bg-[#FAF7F2] rounded-md border border-[#171717]/15">
                  <span className="text-[9.5px] font-black uppercase text-[#171717]/60 block mb-1">Instruksi PM:</span>
                  <p className="text-xs text-[#171717] leading-relaxed whitespace-pre-line font-medium">
                    {selectedTask.description}
                  </p>
                </div>
              )}

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                <div className="p-2.5 bg-[#FAF7F2] rounded border border-[#171717]/15">
                  <span className="text-[9px] uppercase font-black text-[#171717]/60 block mb-0.5">Proyek</span>
                  <p className="truncate font-bold text-[#171717]">{selectedTask.project_name || selectedTask.project?.name || '—'}</p>
                </div>
                <div className="p-2.5 bg-[#FAF7F2] rounded border border-[#171717]/15">
                  <span className="text-[9px] uppercase font-black text-[#171717]/60 block mb-0.5">Deadline</span>
                  <p className="truncate font-bold text-[#171717]">
                    {selectedTask.deadline ? new Date(selectedTask.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Tidak ada target'}
                  </p>
                </div>
              </div>

              {/* Progress Bar Checklist */}
              <div className="p-3.5 bg-white border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] space-y-2">
                <div className="flex items-center justify-between text-xs font-black">
                  <span className="text-[10px] uppercase text-[#171717]/70">Capaian Checklist</span>
                  <span className="font-display text-sm text-[#171717]">
                    {selectedTask.checklist_completed || 0}/{selectedTask.checklist_total || 0} ({selectedTask.checklist_progress || 0}%)
                  </span>
                </div>
                <div className="w-full bg-[#EAE4D8] h-3 rounded-full overflow-hidden border border-[#171717]/30">
                  <div
                    className="h-full bg-[#10B981] transition-all duration-300"
                    style={{ width: `${selectedTask.checklist_progress || 0}%` }}
                  />
                </div>
              </div>

              {/* Daftar Checklist Interaktif */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-[#171717] flex items-center gap-1.5">
                  <ListTodo size={14} className="text-[#FF2F92]" />
                  Checklist Pekerjaan
                </h4>

                {(!selectedTask.checklists || selectedTask.checklists.length === 0) ? (
                  <p className="text-xs text-[#171717]/60 italic p-3 bg-[#FAF7F2] rounded text-center">
                    Tidak ada butir checklist pada tugas ini.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedTask.checklists.map((chk, i) => {
                      const isLocked = selectedTask.status === 'in_review' || selectedTask.is_completed || ['completed', 'done'].includes(selectedTask.status)

                      return (
                        <div
                          key={chk.id || i}
                          onClick={() => handleToggleChecklist(chk.id)}
                          className={`p-3 rounded-lg border-1.5 transition-all flex items-center justify-between gap-3 min-h-[44px] ${
                            isLocked ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                          } ${
                            chk.is_completed
                              ? 'bg-[#ECFDF5] border-[#10B981] text-[#065F46] shadow-[1px_1px_0px_#10B981]'
                              : isLocked
                              ? 'bg-[#FAF7F2] border-[#171717]/20 text-[#171717]/70'
                              : 'bg-[#FAF7F2] border-[#171717]/30 hover:border-[#FF2F92] text-[#171717] hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-5 h-5 rounded border-1.5 flex items-center justify-center shrink-0 transition-colors ${
                              chk.is_completed
                                ? 'bg-[#10B981] border-[#10B981] text-white'
                                : isLocked
                                ? 'bg-neutral-200 border-[#171717]/40'
                                : 'bg-white border-[#171717]'
                            }`}>
                              {togglingChecklistId === chk.id ? (
                                <Loader2 size={11} className="animate-spin text-[#171717]" />
                              ) : chk.is_completed ? (
                                <Check size={13} strokeWidth={3} />
                              ) : isLocked ? (
                                <Lock size={10} />
                              ) : null}
                            </div>
                            <span className={`text-xs font-bold leading-snug ${chk.is_completed ? 'line-through opacity-75' : ''}`}>
                              {chk.title}
                            </span>
                          </div>

                          {chk.is_completed && (
                            <span className="text-[9px] font-black uppercase text-[#10B981] shrink-0">
                              ✓ Selesai
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-5 py-3 border-t-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-between">
              <button
                onClick={() => {
                  setSelectedTask(null)
                  navigate('/tasks')
                }}
                className="text-xs font-black uppercase text-[#FF2F92] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Buka di Workspace Tugas</span>
                <ArrowRight size={13} />
              </button>

              <button
                onClick={() => setSelectedTask(null)}
                className="pkm-btn-outline cursor-pointer text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
