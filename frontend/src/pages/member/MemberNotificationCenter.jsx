import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import {
  Bell,
  BellRing,
  CheckCheck,
  CheckCircle2,
  CheckSquare,
  AlertTriangle,
  AlertCircle,
  Clock,
  RotateCcw,
  Trash2,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  Folder,
  User,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Inbox,
  Sparkles,
  ArrowRight,
  ListTodo,
  GraduationCap,
  Award
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import PageLoading from '../../components/ui/PageLoading'

// Konfigurasi Type Notifikasi
const NOTIFICATION_TYPE_CONFIG = {
  task_assigned: {
    label: 'Tugas Baru',
    icon: CheckSquare,
    badgeBg: 'bg-[#3B82F6] text-white border-[#171717]',
    cardBorder: 'border-l-4 border-l-[#3B82F6]',
    category: 'task'
  },
  review_approved: {
    label: 'Disetujui PM',
    icon: CheckCircle2,
    badgeBg: 'bg-[#10B981] text-white border-[#171717]',
    cardBorder: 'border-l-4 border-l-[#10B981]',
    category: 'approval'
  },
  review_revision: {
    label: 'Perlu Revisi PM',
    icon: AlertTriangle,
    badgeBg: 'bg-[#FF5722] text-white border-[#171717]',
    cardBorder: 'border-l-4 border-l-[#FF5722]',
    category: 'revision'
  },
  task_reopened: {
    label: 'Tugas Dibuka Kembali',
    icon: RotateCcw,
    badgeBg: 'bg-[#B8A0F0] text-[#171717] border-[#171717]',
    cardBorder: 'border-l-4 border-l-[#B8A0F0]',
    category: 'task'
  },
  deadline_approaching: {
    label: 'Mendekati Deadline',
    icon: Clock,
    badgeBg: 'bg-[#FFD83D] text-[#171717] border-[#171717]',
    cardBorder: 'border-l-4 border-l-[#FFD83D]',
    category: 'deadline'
  },
  deadline_today: {
    label: 'Deadline Hari Ini',
    icon: AlertCircle,
    badgeBg: 'bg-[#FF2F92] text-white border-[#171717]',
    cardBorder: 'border-l-4 border-l-[#FF2F92]',
    category: 'deadline'
  },
  deadline_overdue: {
    label: 'Tugas Terlambat',
    icon: ShieldAlert,
    badgeBg: 'bg-[#DC2626] text-white border-[#171717]',
    cardBorder: 'border-l-4 border-l-[#DC2626]',
    category: 'deadline'
  },
  development_feedback: {
    label: 'Umpan Balik PM',
    icon: GraduationCap,
    badgeBg: 'bg-[#B8A0F0] text-[#171717] border-[#171717]',
    cardBorder: 'border-l-4 border-l-[#B8A0F0]',
    category: 'development'
  },
  portfolio_submission: {
    label: 'Pengajuan Portofolio',
    icon: Award,
    badgeBg: 'bg-[#FFD83D] text-[#171717] border-[#171717]',
    cardBorder: 'border-l-4 border-l-[#FFD83D]',
    category: 'portfolio'
  },
  portfolio_verified: {
    label: 'Portofolio Terverifikasi',
    icon: Award,
    badgeBg: 'bg-[#10B981] text-white border-[#171717]',
    cardBorder: 'border-l-4 border-l-[#10B981]',
    category: 'portfolio'
  },
  portfolio_revision: {
    label: 'Revisi Portofolio',
    icon: AlertTriangle,
    badgeBg: 'bg-[#FF5722] text-white border-[#171717]',
    cardBorder: 'border-l-4 border-l-[#FF5722]',
    category: 'portfolio'
  }
}

// Konfigurasi Status Tugas
const TASK_STATUS_CONFIG = {
  todo: { label: 'Daftar Tugas', bg: 'bg-[#FAF7F2] text-[#171717]' },
  pending: { label: 'Daftar Tugas', bg: 'bg-[#FAF7F2] text-[#171717]' },
  in_progress: { label: 'Sedang Berjalan', bg: 'bg-[#FFD83D] text-[#171717]' },
  in_review: { label: 'Menunggu Review PM', bg: 'bg-[#B8A0F0] text-[#171717]' },
  completed: { label: 'Selesai', bg: 'bg-[#10B981] text-white' },
  done: { label: 'Selesai', bg: 'bg-[#10B981] text-white' }
}

export default function MemberNotificationCenter() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // State Notifikasi & Summary
  const [notifications, setNotifications] = useState([])
  const [summary, setSummary] = useState({
    total: 0,
    unread: 0,
    task_notifications: 0,
    approval_revision: 0,
    deadline_reminders: 0
  })
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 25,
    total: 0
  })

  // State UI & Filter
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [feedback, setFeedback] = useState(null)

  // Filter toolbar
  const [categoryFilter, setCategoryFilter] = useState('all') // 'all', 'unread', 'task', 'deadline', 'approval', 'revision'
  const [readFilter, setReadFilter] = useState('all') // 'all', 'unread', 'read'
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // State Detail Modal Tugas
  const [selectedTask, setSelectedTask] = useState(null)
  const [taskModalLoading, setTaskModalLoading] = useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)

  // Jam lokal Asia/Jakarta
  const [currentTime, setCurrentTime] = useState(() => {
    return new Date().toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  })

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch Notifikasi dari Backend
  const fetchNotifications = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const params = {
        page: currentPage,
        per_page: 25
      }

      if (categoryFilter !== 'all' && categoryFilter !== 'unread') {
        params.category = categoryFilter
      }
      if (categoryFilter === 'unread' || readFilter === 'unread') {
        params.unread_only = 1
      } else if (readFilter === 'read') {
        params.read_only = 1
      }

      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }

      // Jalankan request data dan summary secara paralel
      const [notifRes, summaryRes] = await Promise.all([
        api.get('/member/notifications', { params }),
        api.get('/member/notifications/summary')
      ])

      setNotifications(notifRes.data.notifications || [])
      setPagination(notifRes.data.pagination || {
        current_page: 1,
        last_page: 1,
        per_page: 25,
        total: 0
      })
      if (summaryRes.data) {
        setSummary(summaryRes.data)
      }

      // Trigger event untuk update badge Sidebar
      window.dispatchEvent(new CustomEvent('notification-updated', {
        detail: { unread: summaryRes.data?.unread || 0 }
      }))
    } catch (err) {
      console.error('Error fetching notifications:', err)
      setError(err.response?.data?.message || 'Gagal memuat daftar notifikasi Anda.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [currentPage, categoryFilter, readFilter, searchQuery])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Reset page saat filter berubah
  const handleCategoryChange = (cat) => {
    setCategoryFilter(cat)
    setCurrentPage(1)
  }

  // Tandai Satu Notifikasi Dibaca/Belum Dibaca
  const handleToggleRead = async (notif, e) => {
    e?.stopPropagation()
    const targetAction = notif.is_read ? 'unread' : 'read'
    try {
      if (notif.is_read) {
        await api.patch(`/member/notifications/${notif.id}/unread`)
      } else {
        await api.patch(`/member/notifications/${notif.id}/read`)
      }

      // Update state lokal
      setNotifications(prev =>
        prev.map(item =>
          item.id === notif.id
            ? { ...item, is_read: !item.is_read, read_at: !item.is_read ? new Date().toISOString() : null }
            : item
        )
      )
      setSummary(prev => ({
        ...prev,
        unread: targetAction === 'read' ? Math.max(0, prev.unread - 1) : prev.unread + 1
      }))

      // Broadcast update
      window.dispatchEvent(new CustomEvent('notification-updated'))
    } catch (err) {
      console.error('Failed to toggle notification read status:', err)
      setFeedback({ type: 'error', message: 'Gagal memperbarui status notifikasi.' })
      setTimeout(() => setFeedback(null), 3000)
    }
  }

  // Tandai Semua Dibaca
  const handleMarkAllAsRead = async () => {
    if (summary.unread === 0) return
    try {
      await api.post('/member/notifications/read-all')
      setNotifications(prev =>
        prev.map(item => ({ ...item, is_read: true, read_at: new Date().toISOString() }))
      )
      setSummary(prev => ({ ...prev, unread: 0 }))
      setFeedback({ type: 'success', message: 'Semua notifikasi berhasil ditandai telah dibaca.' })
      setTimeout(() => setFeedback(null), 3000)

      window.dispatchEvent(new CustomEvent('notification-updated', { detail: { unread: 0 } }))
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
      setFeedback({ type: 'error', message: 'Gagal menandai semua notifikasi dibaca.' })
      setTimeout(() => setFeedback(null), 3000)
    }
  }

  // Hapus Notifikasi
  const handleDeleteNotification = async (id, e) => {
    e?.stopPropagation()
    try {
      await api.delete(`/member/notifications/${id}`)
      const deletedItem = notifications.find(n => n.id === id)
      setNotifications(prev => prev.filter(item => item.id !== id))
      setSummary(prev => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
        unread: deletedItem && !deletedItem.is_read ? Math.max(0, prev.unread - 1) : prev.unread
      }))
      setFeedback({ type: 'success', message: 'Notifikasi berhasil dihapus.' })
      setTimeout(() => setFeedback(null), 3000)

      window.dispatchEvent(new CustomEvent('notification-updated'))
    } catch (err) {
      console.error('Failed to delete notification:', err)
      setFeedback({ type: 'error', message: 'Gagal menghapus notifikasi.' })
      setTimeout(() => setFeedback(null), 3000)
    }
  }

  // Buka Detail Tugas
  const handleOpenTaskDetail = async (taskId, notifId, e) => {
    e?.stopPropagation()
    if (!taskId) return

    // Tandai dibaca jika belum dibaca
    const notif = notifications.find(n => n.id === notifId)
    if (notif && !notif.is_read) {
      handleToggleRead(notif)
    }

    setTaskModalOpen(true)
    setTaskModalLoading(true)
    try {
      const res = await api.get(`/tasks/${taskId}`)
      if (res.data?.task) {
        setSelectedTask(res.data.task)
      } else {
        setSelectedTask(null)
      }
    } catch (err) {
      console.error('Failed to fetch task detail:', err)
      setFeedback({ type: 'error', message: 'Tugas tidak ditemukan atau telah dihapus.' })
      setTimeout(() => setFeedback(null), 3000)
      setTaskModalOpen(false)
    } finally {
      setTaskModalLoading(false)
    }
  }

  // Pengelompokan Kronologis
  const groupedNotifications = useMemo(() => {
    const groups = {
      'Hari Ini': [],
      'Kemarin': [],
      'Minggu Ini': [],
      'Sebelumnya': []
    }

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
    const yesterdayDate = new Date()
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterdayStr = yesterdayDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    notifications.forEach(notif => {
      const date = notif.created_at ? new Date(notif.created_at) : null
      if (!date || isNaN(date.getTime())) {
        groups['Sebelumnya'].push(notif)
        return
      }

      const itemDateStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      if (itemDateStr === todayStr) {
        groups['Hari Ini'].push(notif)
      } else if (itemDateStr === yesterdayStr) {
        groups['Kemarin'].push(notif)
      } else if (date >= sevenDaysAgo) {
        groups['Minggu Ini'].push(notif)
      } else {
        groups['Sebelumnya'].push(notif)
      }
    })

    return groups
  }, [notifications])

  // Hitung format waktu relatif ramah pengguna
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '-'
    const now = new Date()
    const d = new Date(dateStr)
    const diffSec = Math.floor((now - d) / 1000)
    if (diffSec < 60) return 'Baru saja'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin} menit yang lalu`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours} jam yang lalu`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'Kemarin'
    if (diffDays < 7) return `${diffDays} hari yang lalu`
    return d.toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  // Jika sedang initial loading
  if (loading && !refreshing && notifications.length === 0) {
    return (
      <div className="min-h-screen bg-[#F5F1E9] p-4 sm:p-6 lg:p-8">
        <PageLoading message="Memuat Pusat Notifikasi Personal..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F1E9] text-[#171717] p-3 sm:p-5 lg:p-7 space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 right-4 z-50 px-4 py-3 border-2 border-[#171717] rounded-xl shadow-[4px_4px_0px_#171717] flex items-center gap-3 transition-all ${
            feedback.type === 'error'
              ? 'bg-[#FF2F92] text-white'
              : 'bg-[#10B981] text-white'
          }`}
        >
          {feedback.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span className="text-xs sm:text-sm font-black">{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-black/20 rounded-lg cursor-pointer"
            aria-label="Tutup pesan notifikasi"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header Utama Halaman */}
      <PageHeader
        title="PUSAT NOTIFIKASI"
        tag="MEMBER NOTIFICATION"
        subtitle="Pusat komunikasi dan pemberitahuan aktivitas penugasan, persetujuan review, dan pengingat deadline pribadi Anda."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Indikator Jam Asia/Jakarta */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717] text-xs font-mono font-bold">
              <Clock size={15} className="text-[#171717]" />
              <span>{currentTime} WIB</span>
            </div>

            {/* Tombol Sinkronisasi / Refresh */}
            <button
              onClick={() => fetchNotifications(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-[#FFD83D] active:translate-x-0.5 active:translate-y-0.5 border-2 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717] text-xs font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-60 min-h-[44px]"
              title="Sinkronisasi pengingat deadline & muat ulang data"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Sinkronisasi</span>
            </button>

            {/* Tombol Tandai Semua Dibaca */}
            <button
              onClick={handleMarkAllAsRead}
              disabled={summary.unread === 0}
              className={`flex items-center gap-2 px-4 py-2.5 border-2 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717] text-xs font-black uppercase tracking-wider transition-all cursor-pointer min-h-[44px] ${
                summary.unread > 0
                  ? 'bg-[#FF2F92] text-white hover:bg-[#E02680] active:translate-x-0.5 active:translate-y-0.5'
                  : 'bg-white/60 text-[#171717]/40 border-[#171717]/40 cursor-not-allowed shadow-none'
              }`}
              title="Tandai semua notifikasi sebagai telah dibaca"
            >
              <CheckCheck size={16} />
              <span>Tandai Semua Dibaca</span>
            </button>
          </div>
        }
      />

      {/* Banner Error jika ada */}
      {error && (
        <div className="bg-[#FF2F92] text-white border-2 border-[#171717] p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={22} className="shrink-0" />
            <p className="text-xs sm:text-sm font-bold">{error}</p>
          </div>
          <button
            onClick={() => fetchNotifications(true)}
            className="px-3 py-1.5 bg-white text-[#171717] border border-[#171717] rounded-lg font-black text-xs hover:bg-[#FFD83D] cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* 5 KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* 1. Total Notifikasi */}
        <div className="bg-white border-2 border-[#171717] p-3.5 sm:p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#171717]/60 mb-2">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">TOTAL NOTIFIKASI</span>
            <div className="p-1.5 bg-[#FAF7F2] border border-[#171717] rounded-lg">
              <Bell size={16} className="text-[#171717]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#171717]">{summary.total}</div>
            <p className="text-[10px] text-[#171717]/60 font-bold mt-0.5">Semua riwayat personal</p>
          </div>
        </div>

        {/* 2. Belum Dibaca */}
        <div
          onClick={() => handleCategoryChange('unread')}
          className={`border-2 border-[#171717] p-3.5 sm:p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between cursor-pointer transition-all hover:translate-x-0.5 hover:-translate-y-0.5 ${
            summary.unread > 0 ? 'bg-[#FFD83D]' : 'bg-white'
          }`}
          title="Klik untuk memfilter notifikasi belum dibaca"
        >
          <div className="flex items-center justify-between text-[#171717] mb-2">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">BELUM DIBACA</span>
            <div className="p-1.5 bg-white border border-[#171717] rounded-lg">
              <BellRing size={16} className={summary.unread > 0 ? 'text-[#FF2F92] animate-bounce' : 'text-[#171717]'} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#171717]">
              {summary.unread}
            </div>
            <p className="text-[10px] text-[#171717]/70 font-bold mt-0.5">
              {summary.unread > 0 ? 'Perlu perhatian segera' : 'Semua sudah dibaca'}
            </p>
          </div>
        </div>

        {/* 3. Notifikasi Tugas */}
        <div
          onClick={() => handleCategoryChange('task')}
          className="bg-white hover:bg-[#FAF7F2] border-2 border-[#171717] p-3.5 sm:p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between cursor-pointer transition-all hover:translate-x-0.5 hover:-translate-y-0.5"
          title="Klik untuk memfilter tugas baru & dibuka kembali"
        >
          <div className="flex items-center justify-between text-[#171717]/60 mb-2">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">TUGAS & REOPEN</span>
            <div className="p-1.5 bg-[#FAF7F2] border border-[#171717] rounded-lg">
              <CheckSquare size={16} className="text-[#3B82F6]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#171717]">{summary.task_notifications}</div>
            <p className="text-[10px] text-[#171717]/60 font-bold mt-0.5">Penugasan dari PM</p>
          </div>
        </div>

        {/* 4. Persetujuan & Revisi */}
        <div
          onClick={() => handleCategoryChange('approval')}
          className="bg-white hover:bg-[#FAF7F2] border-2 border-[#171717] p-3.5 sm:p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between cursor-pointer transition-all hover:translate-x-0.5 hover:-translate-y-0.5"
          title="Klik untuk memfilter persetujuan & revisi PM"
        >
          <div className="flex items-center justify-between text-[#171717]/60 mb-2">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">REVIEW PM</span>
            <div className="p-1.5 bg-[#FAF7F2] border border-[#171717] rounded-lg">
              <CheckCircle2 size={16} className="text-[#10B981]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#171717]">{summary.approval_revision}</div>
            <p className="text-[10px] text-[#171717]/60 font-bold mt-0.5">Persetujuan & Revisi</p>
          </div>
        </div>

        {/* 5. Pengingat Deadline */}
        <div
          onClick={() => handleCategoryChange('deadline')}
          className="col-span-2 sm:col-span-1 bg-white hover:bg-[#FAF7F2] border-2 border-[#171717] p-3.5 sm:p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between cursor-pointer transition-all hover:translate-x-0.5 hover:-translate-y-0.5"
          title="Klik untuk memfilter pengingat deadline"
        >
          <div className="flex items-center justify-between text-[#171717]/60 mb-2">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">DEADLINE</span>
            <div className="p-1.5 bg-[#FAF7F2] border border-[#171717] rounded-lg">
              <Clock size={16} className="text-[#FF5722]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#171717]">{summary.deadline_reminders}</div>
            <p className="text-[10px] text-[#171717]/60 font-bold mt-0.5">Batas waktu personal</p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar & Search Bar */}
      <div className="bg-white border-2 border-[#171717] p-3.5 sm:p-4 rounded-xl shadow-[3px_3px_0px_#171717] space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'unread', label: 'Belum Dibaca', count: summary.unread },
              { id: 'task', label: 'Tugas' },
              { id: 'approval', label: 'Persetujuan' },
              { id: 'revision', label: 'Revisi' },
              { id: 'deadline', label: 'Deadline' },
              { id: 'development', label: 'Pengembangan' },
              { id: 'portfolio', label: 'Portofolio' }
            ].map(tab => {
              const active = categoryFilter === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleCategoryChange(tab.id)}
                  className={`px-3 py-2 border-2 border-[#171717] rounded-xl text-xs font-black uppercase tracking-wider shrink-0 transition-all cursor-pointer min-h-[40px] flex items-center gap-1.5 ${
                    active
                      ? 'bg-[#171717] text-white shadow-[2px_2px_0px_#171717]'
                      : 'bg-[#FAF7F2] text-[#171717] hover:bg-white shadow-[1px_1px_0px_#171717]'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="px-1.5 py-0.2 text-[9px] font-mono bg-[#FF2F92] text-white rounded-full">
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Search Bar & Read Filter Dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#171717]/50"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Cari notifikasi, proyek, PM..."
                className="w-full pl-9 pr-8 py-2 bg-[#FAF7F2] border-2 border-[#171717] rounded-xl text-xs font-bold text-[#171717] placeholder:text-[#171717]/40 focus:outline-none focus:bg-white focus:shadow-[2px_2px_0px_#171717] min-h-[40px]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#171717]/50 hover:text-[#171717] cursor-pointer"
                  aria-label="Hapus kata kunci pencarian"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Selector Status Dibaca */}
            <select
              value={readFilter}
              onChange={(e) => {
                setReadFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="px-3 py-2 bg-[#FAF7F2] border-2 border-[#171717] rounded-xl text-xs font-bold text-[#171717] focus:outline-none focus:bg-white focus:shadow-[2px_2px_0px_#171717] min-h-[40px] cursor-pointer"
              aria-label="Filter status dibaca"
            >
              <option value="all">Status: Semua</option>
              <option value="unread">Hanya Belum Dibaca</option>
              <option value="read">Hanya Sudah Dibaca</option>
            </select>
          </div>
        </div>
      </div>

      {/* Konten Utama: Daftar Notifikasi Terkelompok */}
      <div className="space-y-6">
        {notifications.length === 0 ? (
          /* Empty State */
          <div className="bg-white border-2 border-[#171717] p-8 sm:p-12 rounded-xl shadow-[4px_4px_0px_#171717] text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-[#FAF7F2] border-2 border-[#171717] rounded-2xl shadow-[3px_3px_0px_#171717] flex items-center justify-center">
              <Inbox size={32} className="text-[#171717]" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="font-display text-lg sm:text-xl text-[#171717]">
                Tidak Ada Notifikasi
              </h3>
              <p className="text-xs sm:text-sm text-[#171717]/70 font-medium">
                {searchQuery || categoryFilter !== 'all' || readFilter !== 'all'
                  ? 'Tidak ada notifikasi yang sesuai dengan kriteria filter atau pencarian Anda.'
                  : 'Anda belum memiliki pemberitahuan baru saat ini. Semua tugas dan review terkini akan otomatis muncul di sini.'}
              </p>
            </div>
            {(searchQuery || categoryFilter !== 'all' || readFilter !== 'all') && (
              <button
                onClick={() => {
                  setCategoryFilter('all')
                  setReadFilter('all')
                  setSearchQuery('')
                  setCurrentPage(1)
                }}
                className="px-4 py-2 bg-[#FFD83D] border-2 border-[#171717] rounded-xl text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#171717] hover:bg-[#FFE066] cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>
        ) : (
          /* Feed Grup Kronologis */
          Object.entries(groupedNotifications).map(([groupTitle, items]) => {
            if (items.length === 0) return null

            return (
              <div key={groupTitle} className="space-y-3">
                {/* Judul Grup */}
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-[#171717] text-white border-2 border-[#171717] rounded-lg text-[10px] font-black uppercase tracking-widest shadow-[1px_1px_0px_#171717]">
                    {groupTitle}
                  </span>
                  <span className="text-xs font-bold text-[#171717]/60 font-mono">
                    ({items.length} pemberitahuan)
                  </span>
                  <div className="flex-1 h-[1.5px] bg-[#171717]/15"></div>
                </div>

                {/* List Notifikasi */}
                <div className="space-y-2.5">
                  {items.map(notif => {
                    const cfg = NOTIFICATION_TYPE_CONFIG[notif.type] || {
                      label: notif.type,
                      icon: Bell,
                      badgeBg: 'bg-[#FAF7F2] text-[#171717] border-[#171717]',
                      cardBorder: 'border-l-4 border-l-[#171717]'
                    }
                    const Icon = cfg.icon
                    const isUnread = !notif.is_read

                    const isClickable = Boolean(
                      notif.task_id ||
                      notif.type === 'development_feedback' ||
                      notif.type?.startsWith('portfolio_')
                    )

                    const handleCardClick = () => {
                      if (notif.task_id) {
                        handleOpenTaskDetail(notif.task_id, notif.id)
                      } else if (notif.type === 'development_feedback') {
                        if (!notif.is_read) handleToggleRead(notif)
                        navigate('/member/learning')
                      } else if (notif.type?.startsWith('portfolio_')) {
                        if (!notif.is_read) handleToggleRead(notif)
                        navigate('/member/portfolio')
                      }
                    }

                    return (
                      <div
                        key={notif.id}
                        onClick={handleCardClick}
                        className={`group relative bg-white border-2 border-[#171717] rounded-xl p-3.5 sm:p-4.5 shadow-[3px_3px_0px_#171717] transition-all hover:shadow-[4px_4px_0px_#171717] hover:translate-x-0.5 hover:-translate-y-0.5 ${
                          cfg.cardBorder
                        } ${isUnread ? 'bg-[#FFFDF7]' : 'bg-white opacity-95'} ${
                          isClickable ? 'cursor-pointer' : ''
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          {/* Sisi Kiri: Badge + Konten Pesan */}
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* Titik Unread Indicator */}
                            {isUnread && (
                              <div
                                className="w-2.5 h-2.5 rounded-full bg-[#FF2F92] border border-[#171717] mt-1.5 shrink-0 animate-pulse"
                                title="Belum dibaca"
                              />
                            )}

                            <div className="space-y-1.5 flex-1 min-w-0">
                              {/* Header Card: Tipe Notifikasi & Proyek */}
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border ${cfg.badgeBg}`}>
                                  <Icon size={12} strokeWidth={2.5} />
                                  <span>{cfg.label}</span>
                                </span>

                                {notif.project && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-[#FAF7F2] text-[#171717] border border-[#171717] rounded truncate max-w-[200px]">
                                    <Folder size={11} className="shrink-0" />
                                    <span className="truncate">{notif.project.name}</span>
                                  </span>
                                )}

                                {notif.actor && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-[#FAF7F2] text-[#171717] border border-[#171717] rounded">
                                    <User size={11} className="shrink-0" />
                                    <span>{notif.actor.name}</span>
                                  </span>
                                )}
                              </div>

                              {/* Judul Notifikasi */}
                              <h4 className={`text-sm sm:text-base text-[#171717] leading-snug ${
                                isUnread ? 'font-black' : 'font-bold'
                              }`}>
                                {notif.title}
                              </h4>

                              {/* Isi Pesan Notifikasi */}
                              <p className="text-xs sm:text-sm text-[#171717]/85 font-medium leading-relaxed whitespace-pre-line">
                                {notif.message}
                              </p>

                              {/* Task Title jika ada */}
                              {notif.task && (
                                <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-[#FAF7F2] border border-[#171717]/30 rounded-lg text-xs font-bold text-[#171717] mt-1 max-w-full truncate">
                                  <ListTodo size={13} className="text-[#171717]/60 shrink-0" />
                                  <span className="truncate">Tugas: {notif.task.title}</span>
                                  {notif.task.deadline && (
                                    <span className="text-[10px] text-[#171717]/60 font-mono shrink-0">
                                      Due: {new Date(notif.task.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Sisi Kanan: Timestamp & Action Buttons */}
                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#171717]/10">
                            {/* Waktu relatif */}
                            <div className="text-right">
                              <span className="text-[11px] font-bold text-[#171717]/60 block font-mono">
                                {formatTimeAgo(notif.created_at)}
                              </span>
                              <span className="text-[9.5px] text-[#171717]/40 block font-mono hidden sm:block">
                                {notif.created_at ? new Date(notif.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB' : ''}
                              </span>
                            </div>

                            {/* Tombol Aksi */}
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {/* Tombol Buka Tugas */}
                              {notif.task_id && (
                                <button
                                  onClick={(e) => handleOpenTaskDetail(notif.task_id, notif.id, e)}
                                  className="px-2.5 py-1.5 bg-[#FAF7F2] hover:bg-[#FFD83D] text-[#171717] border border-[#171717] rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-[1px_1px_0px_#171717] cursor-pointer transition-all min-h-[34px]"
                                  title="Buka detail tugas ini"
                                >
                                  <ExternalLink size={13} />
                                  <span className="hidden sm:inline">Tugas</span>
                                </button>
                              )}

                              {/* Tombol Buka Pengembangan Diri */}
                              {notif.type === 'development_feedback' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (!notif.is_read) handleToggleRead(notif, e)
                                    navigate('/member/learning')
                                  }}
                                  className="px-2.5 py-1.5 bg-[#FAF7F2] hover:bg-[#B8A0F0] text-[#171717] border border-[#171717] rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-[1px_1px_0px_#171717] cursor-pointer transition-all min-h-[34px]"
                                  title="Buka Pengembangan Diri"
                                >
                                  <GraduationCap size={13} />
                                  <span className="hidden sm:inline">Lihat</span>
                                </button>
                              )}

                              {/* Tombol Buka Portofolio */}
                              {(notif.type === 'portfolio_submission' || notif.type === 'portfolio_verified' || notif.type === 'portfolio_revision') && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (!notif.is_read) handleToggleRead(notif, e)
                                    navigate('/member/portfolio')
                                  }}
                                  className="px-2.5 py-1.5 bg-[#FAF7F2] hover:bg-[#10B981] hover:text-white text-[#171717] border border-[#171717] rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-[1px_1px_0px_#171717] cursor-pointer transition-all min-h-[34px]"
                                  title="Buka Portofolio"
                                >
                                  <Award size={13} />
                                  <span className="hidden sm:inline">Portofolio</span>
                                </button>
                              )}

                              {/* Toggle Read/Unread */}
                              <button
                                onClick={(e) => handleToggleRead(notif, e)}
                                className="p-1.5 hover:bg-[#FAF7F2] border border-[#171717] rounded-lg text-[#171717] shadow-[1px_1px_0px_#171717] cursor-pointer transition-all min-h-[34px] min-w-[34px] flex items-center justify-center"
                                title={notif.is_read ? 'Tandai belum dibaca' : 'Tandai telah dibaca'}
                                aria-label={notif.is_read ? 'Tandai belum dibaca' : 'Tandai telah dibaca'}
                              >
                                {notif.is_read ? (
                                  <Bell size={14} className="text-[#171717]/50" />
                                ) : (
                                  <CheckCheck size={14} className="text-[#10B981]" />
                                )}
                              </button>

                              {/* Hapus Notifikasi */}
                              <button
                                onClick={(e) => handleDeleteNotification(notif.id, e)}
                                className="p-1.5 hover:bg-[#FF2F92] hover:text-white border border-[#171717] rounded-lg text-[#171717] shadow-[1px_1px_0px_#171717] cursor-pointer transition-all min-h-[34px] min-w-[34px] flex items-center justify-center"
                                title="Hapus notifikasi ini"
                                aria-label="Hapus notifikasi ini"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Kontrol Pagination jika lebih dari 1 halaman */}
      {pagination.last_page > 1 && (
        <div className="bg-white border-2 border-[#171717] p-3 rounded-xl shadow-[3px_3px_0px_#171717] flex items-center justify-between">
          <div className="text-xs font-bold text-[#171717]/70">
            Halaman <span className="font-mono font-black text-[#171717]">{pagination.current_page}</span> dari{' '}
            <span className="font-mono font-black text-[#171717]">{pagination.last_page}</span> ({pagination.total} total)
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={pagination.current_page <= 1}
              className="px-3 py-1.5 bg-[#FAF7F2] hover:bg-white disabled:opacity-40 border-2 border-[#171717] rounded-lg text-xs font-black shadow-[1px_1px_0px_#171717] flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
              <span>Sebelumnya</span>
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(pagination.last_page, p + 1))}
              disabled={pagination.current_page >= pagination.last_page}
              className="px-3 py-1.5 bg-[#FAF7F2] hover:bg-white disabled:opacity-40 border-2 border-[#171717] rounded-lg text-xs font-black shadow-[1px_1px_0px_#171717] flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
            >
              <span>Selanjutnya</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* MODAL DETAIL TUGAS CEPAT */}
      {taskModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs"
          onClick={() => setTaskModalOpen(false)}
        >
          <div
            className="bg-[#F5F1E9] border-2 border-[#171717] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-[6px_6px_0px_#171717]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-white border-b-2 border-[#171717] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#FFD83D] border-2 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717]">
                  <ListTodo size={20} className="text-[#171717]" />
                </div>
                <div>
                  <h3 className="font-display text-lg sm:text-xl text-[#171717]">
                    Detail Tugas Terkait
                  </h3>
                  <p className="text-xs text-[#171717]/60 font-bold">
                    Informasi lengkap instruksi PM dan checklist pekerjaan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTaskModalOpen(false)}
                className="p-2 hover:bg-[#FF2F92] hover:text-white border-2 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717] cursor-pointer transition-colors"
                aria-label="Tutup modal detail tugas"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {taskModalLoading ? (
                <div className="py-12">
                  <PageLoading message="Mengambil rincian tugas..." />
                </div>
              ) : selectedTask ? (
                <div className="space-y-4">
                  {/* Status & Priority Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Badge */}
                    <span className={`px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg border-2 border-[#171717] shadow-[1px_1px_0px_#171717] ${
                      TASK_STATUS_CONFIG[selectedTask.status]?.bg || 'bg-white text-[#171717]'
                    }`}>
                      Status: {TASK_STATUS_CONFIG[selectedTask.status]?.label || selectedTask.status}
                    </span>

                    {/* Priority Badge */}
                    <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg border-2 border-[#171717] shadow-[1px_1px_0px_#171717] bg-[#FFD83D] text-[#171717]">
                      Prioritas: {selectedTask.priority}
                    </span>

                    {/* Project */}
                    {selectedTask.project && (
                      <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg border-2 border-[#171717] shadow-[1px_1px_0px_#171717] bg-white text-[#171717] flex items-center gap-1">
                        <Folder size={12} />
                        <span>{selectedTask.project.name}</span>
                      </span>
                    )}

                    {/* Deadline */}
                    {selectedTask.deadline && (
                      <span className="px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border-2 border-[#171717] shadow-[1px_1px_0px_#171717] bg-white text-[#171717] flex items-center gap-1">
                        <Calendar size={12} />
                        <span>Deadline: {new Date(selectedTask.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </span>
                    )}
                  </div>

                  {/* Judul Tugas */}
                  <div className="bg-white border-2 border-[#171717] p-4 rounded-xl shadow-[3px_3px_0px_#171717] space-y-2">
                    <h2 className="text-base sm:text-lg font-black text-[#171717]">
                      {selectedTask.title}
                    </h2>
                    {selectedTask.description && (
                      <p className="text-xs sm:text-sm text-[#171717]/80 whitespace-pre-line leading-relaxed font-medium">
                        {selectedTask.description}
                      </p>
                    )}
                  </div>

                  {/* Review Notes jika ada */}
                  {selectedTask.review_notes && (
                    <div className="bg-[#FFFDF7] border-2 border-[#FF5722] p-4 rounded-xl shadow-[3px_3px_0px_#171717] space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-black text-[#FF5722] uppercase tracking-wider">
                        <AlertTriangle size={15} />
                        <span>Catatan Review PM:</span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-[#171717] whitespace-pre-line">
                        {selectedTask.review_notes}
                      </p>
                    </div>
                  )}

                  {/* Checklist Items */}
                  <div className="bg-white border-2 border-[#171717] p-4 rounded-xl shadow-[3px_3px_0px_#171717] space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-[#171717]">
                        Checklist Pekerjaan ({selectedTask.checklists?.filter(c => c.is_completed).length || 0} / {selectedTask.checklists?.length || 0})
                      </h4>
                      {selectedTask.progress !== undefined && (
                        <span className="font-mono text-xs font-black text-[#171717]">
                          {selectedTask.progress}%
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {selectedTask.checklists && selectedTask.checklists.length > 0 ? (
                        selectedTask.checklists.map((chk) => (
                          <div
                            key={chk.id}
                            className={`p-2.5 border-1.5 border-[#171717] rounded-lg flex items-center gap-2 text-xs font-bold ${
                              chk.is_completed
                                ? 'bg-[#10B981]/15 text-[#171717] line-through'
                                : 'bg-[#FAF7F2] text-[#171717]'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border border-[#171717] flex items-center justify-center shrink-0 ${
                              chk.is_completed ? 'bg-[#10B981] text-white' : 'bg-white'
                            }`}>
                              {chk.is_completed && <CheckSquare size={12} />}
                            </div>
                            <span className="flex-1">{chk.title}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-[#171717]/60 italic">Tidak ada item checklist pada tugas ini.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs font-bold text-[#171717]/60">
                  Data tugas tidak dapat dimuat.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t-2 border-[#171717] flex items-center justify-between shrink-0">
              <button
                onClick={() => setTaskModalOpen(false)}
                className="px-4 py-2 bg-[#FAF7F2] hover:bg-white border-2 border-[#171717] rounded-xl text-xs font-black shadow-[2px_2px_0px_#171717] cursor-pointer"
              >
                Tutup
              </button>

              <button
                onClick={() => {
                  setTaskModalOpen(false)
                  navigate('/tasks')
                }}
                className="px-4 py-2 bg-[#FFD83D] hover:bg-[#FFE066] border-2 border-[#171717] rounded-xl text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#171717] flex items-center gap-1.5 cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
              >
                <span>Buka di Workspace</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
