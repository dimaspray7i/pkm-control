import { useState, useEffect, useMemo } from 'react'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import {
  CheckSquare, Search, Clock, AlertTriangle, CheckCircle2, RotateCcw,
  Loader2, Calendar, Folder, Flag, X, Eye, Check, AlertCircle,
  ListTodo, ArrowUpDown, Sparkles, Info, Send, History, Download,
  ShieldCheck, Lock, CheckCheck, ThumbsUp, MessageSquareWarning,
  RefreshCw, BarChart3, User, Bell, FileText, TrendingUp, Award,
  ClipboardList, ChevronRight, Activity, BookOpen, Settings, Edit3
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import PageLoading from '../../components/ui/PageLoading'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// ——————————————————————————————————————————
//  Config
// ——————————————————————————————————————————
const PRIORITY_CONFIG = {
  urgent: { label: 'Mendesak', bg: 'bg-[#FF2F92] text-white border-[#171717]', sortWeight: 4 },
  high:   { label: 'Tinggi',   bg: 'bg-[#FF5722] text-white border-[#171717]', sortWeight: 3 },
  medium: { label: 'Sedang',   bg: 'bg-[#FFD83D] text-[#171717] border-[#171717]', sortWeight: 2 },
  low:    { label: 'Rendah',   bg: 'bg-[#B8A0F0] text-[#171717] border-[#171717]', sortWeight: 1 },
}

const STATUS_CONFIG = {
  todo:        { label: 'Daftar Tugas',      bg: 'bg-[#FAF7F2] text-[#171717] border-[#171717]' },
  pending:     { label: 'Daftar Tugas',      bg: 'bg-[#FAF7F2] text-[#171717] border-[#171717]' },
  in_progress: { label: 'Sedang Berjalan',   bg: 'bg-[#FFD83D] text-[#171717] border-[#171717]' },
  in_review:   { label: 'Menunggu Review',   bg: 'bg-[#B8A0F0] text-[#171717] border-[#171717]' },
  completed:   { label: 'Selesai',           bg: 'bg-[#10B981] text-white border-[#171717]' },
  done:        { label: 'Selesai',           bg: 'bg-[#10B981] text-white border-[#171717]' },
}

const TABS = [
  { id: 'overview',   label: 'Ringkasan',       icon: BarChart3 },
  { id: 'tasks',      label: 'Tugas & Checklist', icon: CheckSquare },
  { id: 'reports',    label: 'Laporan Kerja',   icon: FileText },
  { id: 'history',    label: 'Riwayat Selesai', icon: Award },
  { id: 'profile',    label: 'Profil Saya',     icon: User },
]

// ——————————————————————————————————————————
//  Utilities
// ——————————————————————————————————————————
function FeedbackBanner({ feedback, onClose }) {
  if (!feedback) return null
  return (
    <div className={`p-3.5 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex items-center justify-between text-xs font-bold ${
      feedback.type === 'success' ? 'bg-[#ECFDF5] text-[#065F46]' : 'bg-[#FFD83D] text-[#171717]'
    }`}>
      <div className="flex items-center gap-2 min-w-0 pr-2">
        {feedback.type === 'success'
          ? <Check size={16} strokeWidth={3} className="text-[#10B981] shrink-0" />
          : <AlertCircle size={16} strokeWidth={3} className="text-[#FF2F92] shrink-0" />}
        <span className="break-words">{feedback.message}</span>
      </div>
      <button onClick={onClose} className="p-1 hover:bg-[#171717]/10 rounded cursor-pointer shrink-0"><X size={15} /></button>
    </div>
  )
}

// ——————————————————————————————————————————
//  Main Component
// ——————————————————————————————————————————
export default function MemberWorkspace() {
  const { user } = useAuth()

  // Global state
  const [activeTab, setActiveTab]     = useState('overview')
  const [feedback, setFeedback]       = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)

  // Workspace data (from /api/member/workspace)
  const [wsData, setWsData]           = useState(null)

  // Task list (from /api/tasks — for the Tasks tab)
  const [tasks, setTasks]             = useState([])
  const [tasksLoaded, setTasksLoaded] = useState(false)

  // Task detail / modal state
  const [selectedTask, setSelectedTask]           = useState(null)
  const [showDetailModal, setShowDetailModal]     = useState(false)
  const [modalTab, setModalTab]                   = useState('overview')
  const [taskUpdates, setTaskUpdates]             = useState([])
  const [taskReviews, setTaskReviews]             = useState([])
  const [loadingUpdates, setLoadingUpdates]       = useState(false)
  const [togglingChecklistId, setTogglingChecklistId] = useState(null)

  // Report form state (PM-G)
  const [workDescription, setWorkDescription] = useState('')
  const [blocker, setBlocker]                 = useState('')
  const [nextPlan, setNextPlan]               = useState('')
  const [attachmentFile, setAttachmentFile]   = useState(null)
  const [submittingReport, setSubmittingReport] = useState(false)

  // Review submission state (PM-H)
  const [showSubmitReviewModal, setShowSubmitReviewModal] = useState(false)
  const [submissionNotes, setSubmissionNotes]             = useState('')
  const [submittingReview, setSubmittingReview]           = useState(false)

  // Task filters (Tasks tab)
  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sortBy, setSortBy]               = useState('default')

  // Profile edit state
  const [profileName, setProfileName]           = useState(user?.name || '')
  const [profilePhone, setProfilePhone]         = useState(user?.phone || '')
  const [currentPassword, setCurrentPassword]   = useState('')
  const [newPassword, setNewPassword]           = useState('')
  const [confirmPassword, setConfirmPassword]   = useState('')
  const [savingProfile, setSavingProfile]       = useState(false)

  const showNotification = (type, message) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  // ——————————————————————————————————————————
  //  Fetchers
  // ——————————————————————————————————————————
  const fetchWorkspace = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get('/member/workspace')
      setWsData(res.data)
    } catch (err) {
      console.error('Failed to load member workspace:', err)
      setError('Gagal memuat Workspace Anda. Periksa koneksi dan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  const fetchTasks = async () => {
    try {
      const res = await api.get('/tasks')
      setTasks(res.data.tasks || [])
      setTasksLoaded(true)
    } catch (err) {
      console.error('Failed to load tasks:', err)
    }
  }

  useEffect(() => {
    fetchWorkspace()
  }, [])

  // Load tasks lazily when switching to Tasks tab
  useEffect(() => {
    if (activeTab === 'tasks' && !tasksLoaded) {
      fetchTasks()
    }
  }, [activeTab])

  // Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showDetailModal) setShowDetailModal(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showDetailModal])

  // ——————————————————————————————————————————
  //  Filtered Tasks (Tasks tab)
  // ——————————————————————————————————————————
  const todayStr = new Date().toISOString().split('T')[0]

  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter((t) => {
      const q = search.toLowerCase()
      const matchSearch = !search ||
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.project?.name || '').toLowerCase().includes(q)

      const matchStatus =
        statusFilter === 'all' ? true :
        statusFilter === 'todo' ? (!t.is_completed && (t.status === 'pending' || t.status === 'todo')) :
        statusFilter === 'in_progress' ? (!t.is_completed && t.status === 'in_progress') :
        statusFilter === 'in_review' ? (!t.is_completed && t.status === 'in_review') :
        statusFilter === 'done' ? (t.is_completed || t.status === 'completed' || t.status === 'done') :
        statusFilter === 'overdue' ? (!t.is_completed && t.deadline && t.deadline < todayStr) : true

      const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter
      return matchSearch && matchStatus && matchPriority
    })

    return filtered.sort((a, b) => {
      const aOv = !a.is_completed && a.deadline && a.deadline < todayStr ? 1 : 0
      const bOv = !b.is_completed && b.deadline && b.deadline < todayStr ? 1 : 0
      if (sortBy === 'default') {
        if (aOv !== bOv) return bOv - aOv
        if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1
        if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline)
        if (a.deadline) return -1
        if (b.deadline) return 1
        return (PRIORITY_CONFIG[b.priority]?.sortWeight || 0) - (PRIORITY_CONFIG[a.priority]?.sortWeight || 0)
      }
      if (sortBy === 'deadline') {
        if (!a.deadline) return 1; if (!b.deadline) return -1
        return a.deadline.localeCompare(b.deadline)
      }
      if (sortBy === 'priority') {
        return (PRIORITY_CONFIG[b.priority]?.sortWeight || 0) - (PRIORITY_CONFIG[a.priority]?.sortWeight || 0)
      }
      if (sortBy === 'progress') return (b.checklist_progress || 0) - (a.checklist_progress || 0)
      return 0
    })
  }, [tasks, search, statusFilter, priorityFilter, sortBy, todayStr])

  // ——————————————————————————————————————————
  //  Task Detail Modal
  // ——————————————————————————————————————————
  const handleOpenDetail = async (task) => {
    setSelectedTask(task)
    setShowDetailModal(true)
    setModalTab('overview')
    setWorkDescription('')
    setBlocker('')
    setNextPlan('')
    setAttachmentFile(null)
    setTaskUpdates([])
    setTaskReviews([])
    setLoadingUpdates(true)
    try {
      const [taskRes, updatesRes, reviewsRes] = await Promise.allSettled([
        api.get(`/tasks/${task.id}`),
        api.get(`/tasks/${task.id}/updates`),
        api.get(`/tasks/${task.id}/reviews`),
      ])
      if (taskRes.status === 'fulfilled' && taskRes.value?.data?.task) setSelectedTask(taskRes.value.data.task)
      if (updatesRes.status === 'fulfilled') setTaskUpdates(updatesRes.value?.data?.updates || [])
      if (reviewsRes.status === 'fulfilled') setTaskReviews(reviewsRes.value?.data?.reviews || [])
    } catch {}
    finally { setLoadingUpdates(false) }
  }

  // Toggle checklist
  const handleToggleChecklist = async (checklistId) => {
    if (togglingChecklistId) return
    if (selectedTask?.status === 'in_review') {
      showNotification('error', 'Checklist terkunci selama tugas dalam proses review PM.'); return
    }
    if (selectedTask?.is_completed || ['completed','done'].includes(selectedTask?.status)) {
      showNotification('error', 'Checklist terkunci — tugas sudah disetujui selesai.'); return
    }
    setTogglingChecklistId(checklistId)
    try {
      const res = await api.post(`/checklists/${checklistId}/toggle`)
      const updatedChk   = res.data.checklist
      const updatedStats = res.data.stats
      setSelectedTask(prev => {
        if (!prev) return null
        const cls = (prev.checklists || []).map(c => c.id === checklistId ? updatedChk : c)
        return { ...prev, checklists: cls, checklist_total: updatedStats.total, checklist_completed: updatedStats.completed, checklist_progress: updatedStats.progress }
      })
      setTasks(prev => prev.map(t => {
        if (t.id !== selectedTask?.id) return t
        const cls = (t.checklists || []).map(c => c.id === checklistId ? updatedChk : c)
        return { ...t, checklists: cls, checklist_total: updatedStats.total, checklist_completed: updatedStats.completed, checklist_progress: updatedStats.progress }
      }))
      showNotification('success', updatedChk.is_completed ? 'Checklist selesai!' : 'Checklist dibatalkan.')
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Gagal memperbarui checklist.')
    } finally {
      setTogglingChecklistId(null)
    }
  }

  // Submit progress report (PM-G)
  const handleSubmitReport = async (e) => {
    if (e) e.preventDefault()
    if (!workDescription.trim()) { showNotification('error', 'Deskripsi pekerjaan wajib diisi.'); return }
    if (!selectedTask) return
    setSubmittingReport(true)
    try {
      const fd = new FormData()
      fd.append('work_description', workDescription.trim())
      if (blocker.trim()) fd.append('blocker', blocker.trim())
      if (nextPlan.trim()) fd.append('next_plan', nextPlan.trim())
      if (attachmentFile) fd.append('attachment', attachmentFile)
      const res = await api.post(`/tasks/${selectedTask.id}/updates`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setTaskUpdates(prev => [res.data.update, ...prev])
      setWorkDescription(''); setBlocker(''); setNextPlan(''); setAttachmentFile(null)
      const fi = document.getElementById('ws-report-attachment')
      if (fi) fi.value = ''
      showNotification('success', 'Progress update berhasil dicatat!')
      setModalTab('history')
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Gagal mencatat progress update.')
    } finally {
      setSubmittingReport(false)
    }
  }

  // Submit review (PM-H)
  const handleSubmitReview = async () => {
    if (!selectedTask) return
    setSubmittingReview(true)
    try {
      const res = await api.post(`/tasks/${selectedTask.id}/submit-review`, { notes: submissionNotes.trim() || undefined })
      const updatedTask = res.data.task
      setSelectedTask(prev => ({ ...prev, ...updatedTask }))
      setTaskReviews(prev => [res.data.review, ...prev])
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, ...updatedTask } : t))
      fetchWorkspace()
      setShowSubmitReviewModal(false)
      setSubmissionNotes('')
      showNotification('success', 'Penyelesaian tugas berhasil diajukan! Menunggu review Project Manager.')
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Gagal mengajukan review tugas.')
    } finally {
      setSubmittingReview(false)
    }
  }

  // Download attachment
  const handleDownloadAttachment = async (updateId, fileName) => {
    try {
      const res = await api.get(`/task-updates/${updateId}/download`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url; a.setAttribute('download', fileName || 'lampiran')
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Gagal mengunduh lampiran.')
    }
  }

  // Update profile
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (newPassword && newPassword !== confirmPassword) {
      showNotification('error', 'Konfirmasi password baru tidak cocok.'); return
    }
    setSavingProfile(true)
    try {
      const payload = { name: profileName, phone: profilePhone }
      if (newPassword) {
        payload.current_password = currentPassword
        payload.new_password     = newPassword
        payload.new_password_confirmation = confirmPassword
      }
      await api.put('/me', payload)
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      showNotification('success', 'Profil berhasil diperbarui!')
    } catch (err) {
      const msg = err.response?.data?.errors?.current_password?.[0] || err.response?.data?.message || 'Gagal memperbarui profil.'
      showNotification('error', msg)
    } finally {
      setSavingProfile(false)
    }
  }

  // ——————————————————————————————————————————
  //  Loading / Error State
  // ——————————————————————————————————————————
  const displayName = user?.name || 'Karyawan'
  const currentDate = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  if (loading) return <PageLoading mode="page" text="Memuat Workspace Anda..." subtext="Menyiapkan ringkasan tugas, progres, dan aktivitas kerja pribadi Anda." />

  if (error) {
    return (
      <div className="p-6 bg-[#FFD83D] border-1.5 border-[#171717] rounded-lg shadow-[4px_4px_0px_#171717] max-w-md my-8">
        <h2 className="font-display text-xl uppercase mb-2">Gagal Memuat</h2>
        <p className="text-xs font-semibold mb-3">{error}</p>
        <button onClick={fetchWorkspace} className="px-3.5 py-1.5 bg-[#171717] text-white font-bold text-xs uppercase flex items-center gap-1.5 rounded cursor-pointer">
          <RotateCcw size={13} /> Coba Lagi
        </button>
      </div>
    )
  }

  const summary  = wsData?.summary || {}
  const progress = wsData?.personal_progress || {}

  return (
    <div className="space-y-4 pb-10">
      {/* ===== HEADER ===== */}
      <PageHeader
        title={`HALO, ${displayName.toUpperCase()}`}
        subtitle="Workspace pribadi Anda — pantau tugas, progres, laporan, dan riwayat pekerjaan dalam satu tempat."
        tag="WORKSPACE SAYA"
        actions={
          <div className="bg-white px-3.5 py-2 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center gap-2">
            <Calendar size={15} className="text-[#FF2F92]" />
            <span className="text-xs font-black uppercase text-[#171717]">{currentDate}</span>
          </div>
        }
      />

      {/* ===== FEEDBACK ===== */}
      <FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} />

      {/* ===== KPI SUMMARY (always visible) ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {[
          { id: 'all',         label: 'Total Tugas',    value: summary.total      || 0, bg: 'bg-white', accent: 'text-[#171717]' },
          { id: 'todo',        label: 'Antrean',        value: summary.todo       || 0, bg: 'bg-[#FAF7F2]', accent: 'text-[#171717]' },
          { id: 'in_progress', label: 'Dikerjakan',     value: summary.in_progress|| 0, bg: 'bg-[#FFD83D]/30', accent: 'text-[#171717]' },
          { id: 'in_review',   label: 'Menunggu PM',    value: summary.in_review  || 0, bg: 'bg-[#B8A0F0]/30', accent: 'text-[#171717]' },
          { id: 'done',        label: 'Selesai',        value: summary.done       || 0, bg: 'bg-[#ECFDF5]', accent: 'text-[#065F46]' },
          { id: 'overdue',     label: 'Terlambat',      value: summary.overdue    || 0,
            bg: (summary.overdue || 0) > 0 ? 'bg-[#FF2F92]' : 'bg-white',
            accent: (summary.overdue || 0) > 0 ? 'text-white' : 'text-[#FF2F92]' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => { setStatusFilter(item.id); setActiveTab('tasks') }}
            className={`p-3 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] text-left transition-all cursor-pointer hover:-translate-y-0.5 ${item.bg}`}
          >
            <span className={`text-[9.5px] font-black uppercase tracking-wider block leading-tight ${item.accent}`}>{item.label}</span>
            <p className={`font-display text-2xl mt-1 leading-none ${item.accent}`}>{item.value}</p>
          </button>
        ))}
      </div>

      {/* ===== TAB NAV ===== */}
      <div className="flex gap-1.5 flex-wrap border-b-1.5 border-[#171717]/15 pb-1">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 text-[11px] font-black uppercase rounded-t-md border-1.5 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#171717] text-white border-[#171717] shadow-[2px_2px_0px_#FF2F92]'
                  : 'bg-white text-[#171717] border-[#171717]/20 hover:border-[#171717] hover:bg-[#FAF7F2]'
              }`}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
              {tab.id === 'in_review' && (summary.in_review || 0) > 0 && (
                <span className="px-1.5 py-0.5 bg-[#B8A0F0] text-[#171717] text-[8px] rounded-full font-black">{summary.in_review}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ===== TAB 1: OVERVIEW DASHBOARD ===== */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Priority spotlight — urgent / high tasks */}
          {(wsData?.priority_tasks || []).filter(t => t.priority === 'urgent' || t.priority === 'high').length > 0 && (
            <div className="bg-white border-1.5 border-[#171717] rounded-xl shadow-[4px_4px_0px_#171717] p-4">
              <h3 className="font-display text-sm uppercase text-[#171717] flex items-center gap-2 mb-3">
                <Flag size={15} className="text-[#FF2F92]" />
                Prioritas Kerja Saat Ini
              </h3>
              <div className="space-y-2.5">
                {(wsData?.priority_tasks || []).filter(t => t.priority === 'urgent' || t.priority === 'high').slice(0, 5).map(task => {
                  const priCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
                  const isOv   = task.is_overdue
                  return (
                    <div
                      key={task.id}
                      className={`p-3.5 border-1.5 border-[#171717] rounded-lg flex items-start justify-between gap-3 cursor-pointer hover:-translate-y-0.5 transition-all ${
                        isOv ? 'bg-[#FFF0F8] border-l-4 border-l-[#FF2F92]' : 'bg-[#FAF7F2]'
                      }`}
                      onClick={() => { setActiveTab('tasks'); if (!tasksLoaded) fetchTasks() }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded border ${priCfg.bg}`}>{priCfg.label}</span>
                          {task.project && <span className="text-[8.5px] font-bold text-[#171717]/60">{task.project.code}</span>}
                          {isOv && <span className="text-[8.5px] font-black uppercase px-1.5 py-0.5 bg-[#FF2F92] text-white rounded">Terlambat</span>}
                          {task.revision_notes && <span className="text-[8.5px] font-black uppercase px-1.5 py-0.5 bg-[#FFD83D] text-[#171717] rounded border border-[#171717]">Butuh Revisi</span>}
                        </div>
                        <p className="font-bold text-xs text-[#171717] truncate">{task.title}</p>
                        {task.revision_notes && (
                          <p className="text-[10.5px] text-[#FF5722] italic mt-0.5 line-clamp-1">↩ PM: {task.revision_notes}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[9.5px] font-bold text-[#171717]/60 flex items-center gap-1 justify-end">
                          <Clock size={10} />
                          {task.deadline ? new Date(task.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'No deadline'}
                        </p>
                        <p className="text-[9.5px] font-black text-[#10B981] mt-0.5">{task.checklist_progress}%</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              {(wsData?.priority_tasks || []).length > 5 && (
                <button onClick={() => setActiveTab('tasks')} className="mt-3 text-xs font-bold text-[#FF2F92] hover:underline flex items-center gap-1 cursor-pointer">
                  <ChevronRight size={13} /> Lihat semua tugas
                </button>
              )}
            </div>
          )}

          {/* Progress & Productivity section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Personal Progress Stats */}
            <div className="bg-white border-1.5 border-[#171717] rounded-xl shadow-[4px_4px_0px_#171717] p-4 space-y-3">
              <h3 className="font-display text-sm uppercase text-[#171717] flex items-center gap-2">
                <TrendingUp size={15} className="text-[#10B981]" /> Progres Personal
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-[#ECFDF5] border border-[#10B981] rounded-lg text-center">
                  <p className="font-display text-2xl text-[#065F46]">{progress.completion_rate || 0}%</p>
                  <p className="text-[9px] font-black uppercase text-[#065F46]/70 mt-0.5">Completion Rate</p>
                </div>
                <div className="p-3 bg-[#B8A0F0]/20 border border-[#B8A0F0] rounded-lg text-center">
                  <p className="font-display text-2xl text-[#171717]">{progress.checklist_rate || 0}%</p>
                  <p className="text-[9px] font-black uppercase text-[#171717]/60 mt-0.5">Checklist Rate</p>
                </div>
              </div>
              <div className="p-3 bg-[#FAF7F2] border border-[#171717]/20 rounded-lg text-xs space-y-1.5">
                <div className="flex justify-between font-semibold">
                  <span className="text-[#171717]/70">Tugas Selesai</span>
                  <span className="font-black text-[#171717]">{progress.completed_tasks || 0} / {progress.total_tasks || 0}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-[#171717]/70">Checklist Selesai</span>
                  <span className="font-black text-[#171717]">{progress.completed_checklists || 0} / {progress.total_checklists || 0}</span>
                </div>
              </div>
            </div>

            {/* Weekly Productivity Chart */}
            <div className="bg-white border-1.5 border-[#171717] rounded-xl shadow-[4px_4px_0px_#171717] p-4 space-y-3">
              <h3 className="font-display text-sm uppercase text-[#171717] flex items-center gap-2">
                <Activity size={15} className="text-[#FF2F92]" /> Aktivitas 7 Hari Terakhir
              </h3>
              {(progress.weekly_trend || []).length > 0 ? (
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={progress.weekly_trend} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 9, fontWeight: 700 }} />
                    <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, border: '1.5px solid #171717', borderRadius: 6 }}
                      formatter={(v) => [v, 'Progress Update']}
                    />
                    <Bar dataKey="updates" radius={[3,3,0,0]}>
                      {(progress.weekly_trend || []).map((_, i) => (
                        <Cell key={i} fill={i === 6 ? '#FF2F92' : '#B8A0F0'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[120px] flex items-center justify-center text-xs text-[#171717]/50 font-semibold">
                  Belum ada aktivitas minggu ini
                </div>
              )}
              <p className="text-[9.5px] text-[#171717]/50 italic">Jumlah laporan progres yang dicatat per hari</p>
            </div>
          </div>

          {/* PM Notifications & Recent Activities */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* PM Notifications */}
            <div className="bg-white border-1.5 border-[#171717] rounded-xl shadow-[4px_4px_0px_#171717] p-4 space-y-3">
              <h3 className="font-display text-sm uppercase text-[#171717] flex items-center gap-2">
                <Bell size={15} className="text-[#FFD83D]" /> Notifikasi dari PM
              </h3>
              {(wsData?.pm_notifications || []).length === 0 ? (
                <p className="text-xs text-[#171717]/50 font-semibold italic p-3 bg-[#FAF7F2] rounded">Tidak ada notifikasi baru dari Project Manager.</p>
              ) : (
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {(wsData?.pm_notifications || []).map((notif, idx) => (
                    <div key={notif.id || idx} className={`p-3 rounded-lg border text-xs space-y-1 ${notif.type === 'approved' ? 'bg-[#ECFDF5] border-[#10B981]' : 'bg-[#FFF9E6] border-[#FFD83D]'}`}>
                      <div className="flex items-center gap-1.5">
                        {notif.type === 'approved'
                          ? <ThumbsUp size={12} className="text-[#10B981] shrink-0" />
                          : <MessageSquareWarning size={12} className="text-[#FF5722] shrink-0" />}
                        <span className="font-black text-[#171717]">{notif.user_name}</span>
                        <span className="text-[#171717]/70">{notif.action}</span>
                      </div>
                      <p className="font-bold text-[#171717] truncate">"{notif.target_name}"</p>
                      {notif.notes && <p className="text-[#171717]/80 italic text-[10.5px] leading-relaxed line-clamp-2">{notif.notes}</p>}
                      <p className="text-[9px] font-bold text-[#171717]/50">{notif.time_ago}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Activities */}
            <div className="bg-white border-1.5 border-[#171717] rounded-xl shadow-[4px_4px_0px_#171717] p-4 space-y-3">
              <h3 className="font-display text-sm uppercase text-[#171717] flex items-center gap-2">
                <Activity size={15} className="text-[#B8A0F0]" /> Aktivitas Terkini Saya
              </h3>
              {(wsData?.recent_activities || []).length === 0 ? (
                <p className="text-xs text-[#171717]/50 font-semibold italic p-3 bg-[#FAF7F2] rounded">Belum ada aktivitas terkini.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {(wsData?.recent_activities || []).map((act, idx) => (
                    <div key={act.id || idx} className="flex items-start gap-2.5 p-2.5 bg-[#FAF7F2] rounded-lg border border-[#171717]/10">
                      <div className="w-7 h-7 rounded-full border border-[#171717] flex items-center justify-center shrink-0 text-[10px] font-black" style={{ backgroundColor: act.avatar_color || '#B8A0F0' }}>
                        {(act.user_name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#171717] leading-tight">
                          <span className="font-bold">{act.action}</span> <span className="font-black">"{act.target_name}"</span>
                        </p>
                        <p className="text-[9.5px] text-[#171717]/50 font-bold mt-0.5">{act.time_ago}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB 2: TASKS & CHECKLIST ===== */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="bg-white p-3.5 sm:p-4 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#171717]/50" />
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Cari nama tugas atau proyek..."
                  className="w-full pl-9 pr-8 py-2 bg-[#FAF7F2] border border-[#171717]/40 rounded-lg text-xs font-semibold text-[#171717] placeholder:text-[#171717]/40 focus:outline-none focus:border-[#FF2F92] min-h-[38px]"
                />
                {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#171717]/40 hover:text-[#171717] p-1 cursor-pointer"><X size={14} /></button>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-[#FAF7F2] px-2.5 py-1.5 border border-[#171717]/40 rounded-lg text-xs font-bold text-[#171717] min-h-[38px]">
                  <ArrowUpDown size={13} className="text-[#171717]/60" />
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-transparent focus:outline-none text-[11px] font-black uppercase cursor-pointer">
                    <option value="default">Prioritas & Deadline</option>
                    <option value="deadline">Deadline Terdekat</option>
                    <option value="priority">Prioritas Tertinggi</option>
                    <option value="progress">Progress Tertinggi</option>
                  </select>
                </div>
                {(search || statusFilter !== 'all' || priorityFilter !== 'all' || sortBy !== 'default') && (
                  <button onClick={() => { setSearch(''); setStatusFilter('all'); setPriorityFilter('all'); setSortBy('default') }} className="px-3 py-1.5 text-[11px] font-bold text-[#FF2F92] hover:bg-pink-50 border border-[#FF2F92]/40 rounded-md cursor-pointer min-h-[38px] flex items-center gap-1">
                    <RotateCcw size={12} /> Reset
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#171717]/10">
              {[
                { id: 'all', label: 'Semua' },
                { id: 'todo', label: 'Antrean' },
                { id: 'in_progress', label: 'Dikerjakan' },
                { id: 'in_review', label: 'Menunggu Review' },
                { id: 'done', label: 'Selesai' },
                { id: 'overdue', label: 'Terlambat' },
              ].map(f => (
                <button key={f.id} onClick={() => setStatusFilter(f.id)}
                  className={`px-3 py-1 text-[10.5px] font-black uppercase rounded-md border transition-all cursor-pointer min-h-[30px] ${
                    statusFilter === f.id
                      ? 'bg-[#171717] text-white border-[#171717] shadow-[1px_1px_0px_#171717]'
                      : 'bg-[#FAF7F2] text-[#171717] border-[#171717]/30 hover:border-[#171717]'
                  }`}>{f.label}</button>
              ))}
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-[9.5px] font-black uppercase text-[#171717]/50 mr-1">Prioritas:</span>
                {['all', 'urgent', 'high', 'medium', 'low'].map(p => (
                  <button key={p} onClick={() => setPriorityFilter(p)}
                    className={`px-2 py-0.5 text-[9.5px] font-black uppercase rounded border cursor-pointer ${
                      priorityFilter === p
                        ? 'bg-[#171717] text-white border-[#171717]'
                        : 'bg-white text-[#171717] border-[#171717]/30 hover:border-[#171717]'
                    }`}>{p === 'all' ? 'All' : p}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Task cards or loader */}
          {!tasksLoaded ? (
            <div className="flex items-center justify-center py-12 gap-2 text-xs text-[#171717]/60 font-semibold">
              <Loader2 size={18} className="animate-spin text-[#FF2F92]" />
              <span>Memuat daftar tugas...</span>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-8 sm:p-12 bg-white border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] text-center space-y-3">
              <CheckSquare size={36} className="mx-auto text-[#171717]/40" />
              <h3 className="font-display text-xl uppercase text-[#171717]">{tasks.length === 0 ? 'Belum Ada Tugas' : 'Tidak Ada Tugas Sesuai Filter'}</h3>
              <p className="text-xs font-semibold text-[#171717]/65 max-w-sm mx-auto leading-relaxed">
                {tasks.length === 0 ? 'Anda belum memiliki tugas yang ditugaskan. Hubungi PM.' : 'Tidak ditemukan tugas yang cocok dengan filter.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredTasks.map(task => {
                const isOv = !task.is_completed && task.deadline && task.deadline < todayStr
                const priCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
                const stCfg  = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo
                const daysLeft = task.deadline ? Math.ceil((new Date(task.deadline) - new Date(todayStr)) / 86400000) : null
                const isNear = !task.is_completed && !isOv && daysLeft !== null && daysLeft >= 0 && daysLeft <= 2
                return (
                  <div key={task.id} className={`bg-white p-4 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_#171717] transition-all flex flex-col justify-between space-y-3.5 ${isOv ? 'border-l-4 border-l-[#FF2F92]' : ''}`}>
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-[#FAF7F2] border border-[#171717] rounded">{task.project?.code || 'PRJ'}</span>
                          {task.milestone && <span className="text-[9px] font-bold text-[#171717]/60 truncate max-w-[130px]">• {task.milestone.title}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded border ${priCfg.bg}`}>{priCfg.label}</span>
                          <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded border ${stCfg.bg}`}>{stCfg.label}</span>
                        </div>
                      </div>
                      <h3 onClick={() => handleOpenDetail(task)} className="font-display text-base uppercase text-[#171717] hover:text-[#FF2F92] cursor-pointer leading-tight mb-1">{task.title}</h3>
                      <p className="text-xs text-[#171717]/70 line-clamp-2 leading-relaxed">{task.description || 'Tidak ada instruksi tambahan.'}</p>
                    </div>
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-[#171717]/60 text-[10.5px]">Checklist</span>
                        <span className="font-mono text-[#171717]">{task.checklist_completed || 0}/{task.checklist_total || 0} ({task.checklist_progress || 0}%)</span>
                      </div>
                      <div className="w-full bg-[#EAE4D8] h-2.5 rounded-full overflow-hidden border border-[#171717]/25">
                        <div className="h-full bg-[#10B981] transition-all duration-300" style={{ width: `${task.checklist_progress || 0}%` }} />
                      </div>
                    </div>
                    <div className="pt-2.5 border-t border-[#171717]/15 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} className={isOv ? 'text-[#FF2F92]' : 'text-[#171717]/60'} />
                        <span className={`text-xs font-bold ${isOv ? 'text-[#FF2F92] font-black' : 'text-[#171717]'}`}>
                          {task.deadline ? new Date(task.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'Tidak ada target'}
                        </span>
                        {isOv && <span className="text-[8.5px] font-black uppercase px-1.5 py-0.5 bg-[#FF2F92] text-white rounded">Terlewat</span>}
                        {isNear && <span className="text-[8.5px] font-black uppercase px-1.5 py-0.5 bg-[#FFD83D] text-[#171717] rounded border border-[#171717]">{daysLeft === 0 ? 'Hari Ini' : `${daysLeft} Hari`}</span>}
                      </div>
                      <button onClick={() => handleOpenDetail(task)} className="px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#FFD83D] text-[#171717] border border-[#171717] rounded-md text-[11px] font-black uppercase flex items-center gap-1 cursor-pointer transition-all shadow-[1px_1px_0px_#171717] min-h-[32px]">
                        <Eye size={12} /> Detail
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== TAB 3: LAPORAN PROGRES KERJA ===== */}
      {activeTab === 'reports' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm uppercase text-[#171717] flex items-center gap-2">
              <FileText size={15} className="text-[#FF2F92]" /> Laporan Progres Kerja Saya
            </h3>
            <span className="text-[10px] font-bold text-[#171717]/60">{(wsData?.all_updates || []).length} laporan tercatat</span>
          </div>
          {(wsData?.all_updates || []).length === 0 ? (
            <div className="p-8 bg-white border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] text-center space-y-3">
              <FileText size={32} className="mx-auto text-[#171717]/30" />
              <h4 className="font-display text-lg uppercase text-[#171717]">Belum Ada Laporan</h4>
              <p className="text-xs font-semibold text-[#171717]/65 max-w-sm mx-auto">Buka tugas di tab <strong>Tugas & Checklist</strong>, lalu gunakan form "Lapor Progres" untuk mencatat perkembangan pekerjaan Anda.</p>
              <button onClick={() => setActiveTab('tasks')} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#FF2F92] text-white font-black uppercase text-xs rounded border border-[#171717] shadow-[2px_2px_0px_#171717] cursor-pointer">
                <CheckSquare size={12} /> Buka Daftar Tugas
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {(wsData?.all_updates || []).map((upd, idx) => (
                <div key={upd.id || idx} className="bg-white p-4 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] space-y-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-[#FAF7F2] border border-[#171717] rounded">{upd.project_code || 'PRJ'}</span>
                        <span className="text-[9px] font-bold text-[#171717]/60">{upd.project_name}</span>
                      </div>
                      <p className="font-bold text-xs text-[#171717]">"{upd.task_title}"</p>
                      <p className="text-[9.5px] text-[#171717]/50 font-bold mt-0.5">{upd.time_ago} • {upd.created_at ? new Date(upd.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</p>
                    </div>
                    <span className="text-[9.5px] font-black uppercase px-2 py-0.5 rounded border border-[#10B981] bg-[#ECFDF5] text-[#065F46] shrink-0">
                      {upd.completed_checklists}/{upd.total_checklists} ({upd.progress_snapshot}%)
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#FAF7F2] rounded border border-[#171717]/15 text-xs text-[#171717] leading-relaxed whitespace-pre-wrap font-medium">{upd.work_description}</div>
                  {upd.blocker && (
                    <div className="p-2.5 bg-[#FFF0F8] border border-[#FF2F92]/40 rounded text-xs">
                      <span className="text-[9.5px] font-black uppercase text-[#FF2F92] flex items-center gap-1 mb-0.5"><AlertTriangle size={10} /> Kendala:</span>
                      <p className="text-[#171717]/80">{upd.blocker}</p>
                    </div>
                  )}
                  {upd.next_plan && (
                    <div className="p-2.5 bg-[#F0FDF4] border border-[#10B981]/40 rounded text-xs">
                      <span className="text-[9.5px] font-black uppercase text-[#065F46] flex items-center gap-1 mb-0.5"><CheckCircle2 size={10} /> Rencana Berikutnya:</span>
                      <p className="text-[#171717]/80">{upd.next_plan}</p>
                    </div>
                  )}
                  {upd.has_attachment && (
                    <div className="flex items-center justify-between pt-1 border-t border-[#171717]/10">
                      <button onClick={() => handleDownloadAttachment(upd.attachment_id, upd.attachment_name)} className="px-2.5 py-1 bg-white hover:bg-[#FFD83D] border border-[#171717] rounded text-[11px] font-bold text-[#171717] flex items-center gap-1.5 cursor-pointer shadow-[1px_1px_0px_#171717]">
                        <Download size={11} /> <span className="truncate max-w-[200px]">{upd.attachment_name || 'Unduh Lampiran'}</span>
                      </button>
                      <span className="text-[9px] text-[#171717]/50 font-bold uppercase flex items-center gap-1"><Lock size={9} /> Dokumen Privat</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== TAB 4: RIWAYAT PEKERJAAN SELESAI ===== */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm uppercase text-[#171717] flex items-center gap-2">
              <Award size={15} className="text-[#FFD83D]" /> Riwayat Pekerjaan Selesai
            </h3>
            <span className="text-[10px] font-bold text-[#171717]/60">{(wsData?.completed_history || []).length} tugas selesai</span>
          </div>
          {(wsData?.completed_history || []).length === 0 ? (
            <div className="p-8 bg-white border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] text-center space-y-3">
              <Award size={32} className="mx-auto text-[#171717]/30" />
              <h4 className="font-display text-lg uppercase text-[#171717]">Belum Ada Pekerjaan Selesai</h4>
              <p className="text-xs font-semibold text-[#171717]/65 max-w-sm mx-auto">Riwayat tugas yang telah disetujui PM (Done) akan muncul di sini sebagai arsip pencapaian Anda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(wsData?.completed_history || []).map((task, idx) => (
                <div key={task.id || idx} className="bg-white p-4 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {task.project && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-[#FAF7F2] border border-[#171717] rounded">{task.project.code}</span>}
                        <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded border ${PRIORITY_CONFIG[task.priority]?.bg || 'bg-white border-[#171717]'}`}>{PRIORITY_CONFIG[task.priority]?.label || task.priority}</span>
                        {task.revision_count > 0 && <span className="text-[8.5px] font-bold text-[#171717]/60">{task.revision_count}x revisi</span>}
                      </div>
                      <h4 className="font-bold text-sm text-[#171717] leading-tight">{task.title}</h4>
                      <p className="text-[9.5px] text-[#171717]/50 font-bold mt-0.5">Selesai {task.completed_at_ago}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="inline-flex items-center gap-1 text-[9.5px] font-black uppercase px-2 py-0.5 rounded border bg-[#ECFDF5] border-[#10B981] text-[#065F46]">
                        <CheckCheck size={11} /> Done
                      </span>
                    </div>
                  </div>
                  {task.approved_by && (
                    <div className="p-3 bg-[#ECFDF5] border border-[#10B981] rounded-lg text-xs space-y-1">
                      <p className="font-black uppercase text-[#065F46] flex items-center gap-1.5">
                        <ThumbsUp size={12} /> Disetujui oleh {task.approved_by}
                        {task.approval_date && <span className="font-normal text-[#065F46]/70 ml-auto">{new Date(task.approval_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                      </p>
                      {task.approval_notes && <p className="text-[#065F46]/80 italic leading-relaxed">{task.approval_notes}</p>}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[9.5px] text-[#171717]/60 font-bold">
                    <span>Proyek: {task.project?.name || '—'}</span>
                    <span>Deadline: {task.deadline ? new Date(task.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== TAB 5: PROFIL & AKUN SAYA ===== */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Profile card */}
          <div className="bg-white border-1.5 border-[#171717] rounded-xl shadow-[4px_4px_0px_#171717] p-5 space-y-4">
            <h3 className="font-display text-sm uppercase text-[#171717] flex items-center gap-2">
              <User size={15} className="text-[#B8A0F0]" /> Informasi Akun
            </h3>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#B8A0F0] border-2 border-[#171717] flex items-center justify-center text-xl font-black text-[#171717] shadow-[2px_2px_0px_#171717] shrink-0">
                {(user?.name || 'M').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-display text-lg uppercase text-[#171717]">{user?.name || '—'}</p>
                <p className="text-xs text-[#171717]/60 font-bold">{user?.email}</p>
                <span className="inline-block mt-1 text-[9px] font-black uppercase px-2 py-0.5 bg-[#B8A0F0] text-[#171717] rounded border border-[#171717]">Anggota Tim</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { label: 'No. Telepon', value: user?.phone || '—' },
                { label: 'Status', value: user?.is_active ? 'Aktif' : 'Nonaktif' },
                { label: 'Tugas Selesai', value: summary.done || 0 },
                { label: 'Completion Rate', value: `${progress.completion_rate || 0}%` },
              ].map((item, i) => (
                <div key={i} className="p-2.5 bg-[#FAF7F2] rounded border border-[#171717]/15">
                  <span className="text-[9px] font-black uppercase text-[#171717]/60 block mb-0.5">{item.label}</span>
                  <span className="font-bold text-[#171717]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Edit form */}
          <div className="bg-white border-1.5 border-[#171717] rounded-xl shadow-[4px_4px_0px_#171717] p-5">
            <h3 className="font-display text-sm uppercase text-[#171717] flex items-center gap-2 mb-4">
              <Edit3 size={15} className="text-[#FF2F92]" /> Perbarui Profil
            </h3>
            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div>
                <label className="block text-xs font-black uppercase text-[#171717] mb-1">Nama Lengkap <span className="text-[#FF2F92]">*</span></label>
                <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} required className="pkm-input w-full text-xs font-medium" disabled={savingProfile} />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-[#171717] mb-1">No. Telepon</label>
                <input type="text" value={profilePhone} onChange={e => setProfilePhone(e.target.value)} placeholder="Contoh: 0812-3456-7890" className="pkm-input w-full text-xs font-medium" disabled={savingProfile} />
              </div>
              <div className="pt-1 border-t border-[#171717]/15 space-y-3">
                <p className="text-[9.5px] font-black uppercase text-[#171717]/60">Ubah Password (Opsional)</p>
                <div>
                  <label className="block text-xs font-black uppercase text-[#171717] mb-1">Password Saat Ini</label>
                  <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Masukkan password saat ini..." className="pkm-input w-full text-xs font-medium" disabled={savingProfile} />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-[#171717] mb-1">Password Baru (min. 6 karakter)</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Password baru..." className="pkm-input w-full text-xs font-medium" disabled={savingProfile} />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-[#171717] mb-1">Konfirmasi Password Baru</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Ketik ulang password baru..." className="pkm-input w-full text-xs font-medium" disabled={savingProfile} />
                </div>
              </div>
              <div className="pt-3 border-t border-[#171717]/15 flex justify-end">
                <button type="submit" disabled={savingProfile || !profileName.trim()} className="px-5 py-2.5 bg-[#FF2F92] hover:bg-[#e0267d] disabled:opacity-50 text-white font-black uppercase text-xs rounded border border-[#171717] shadow-[2px_2px_0px_#171717] flex items-center gap-2 cursor-pointer transition-all">
                  {savingProfile ? <><Loader2 size={13} className="animate-spin" /> Menyimpan...</> : <><Check size={13} /> Simpan Perubahan</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== TASK DETAIL MODAL ===== */}
      {showDetailModal && selectedTask && (
        <div className="fixed inset-0 bg-[#171717]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150" onClick={e => { if (e.target === e.currentTarget && !submittingReport) setShowDetailModal(false) }}>
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#171717] w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-white border border-[#171717] rounded shrink-0">{selectedTask.project?.code || 'PRJ'}</span>
                <h3 className="font-display text-base uppercase tracking-tight text-[#171717] truncate">DETAIL TUGAS ANDA</h3>
              </div>
              <button onClick={() => setShowDetailModal(false)} disabled={submittingReport} className="p-1.5 hover:bg-[#FFD83D] border border-[#171717] rounded-md cursor-pointer transition-colors disabled:opacity-50"><X size={15} /></button>
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex items-center gap-1.5 px-4 sm:px-5 py-2 bg-[#FAF7F2] border-b border-[#171717]/20 shrink-0 overflow-x-auto">
              {[
                { id: 'overview', label: 'Detail & Checklist', icon: ListTodo, shadow: '#FF2F92' },
                { id: 'report',   label: 'Lapor Progres',      icon: Send,     shadow: '#FFD83D', disabled: selectedTask.status === 'in_review' || selectedTask.status === 'done' || selectedTask.status === 'completed' || selectedTask.is_completed },
                { id: 'history',  label: 'Riwayat',            icon: History,  shadow: '#B8A0F0', badge: taskUpdates.length },
                { id: 'approval', label: 'Approval',           icon: ShieldCheck, shadow: '#B8A0F0', badge: taskReviews.length },
              ].map(tab => {
                const Icon = tab.icon
                return (
                  <button key={tab.id} type="button" onClick={() => setModalTab(tab.id)} disabled={tab.disabled}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-black uppercase transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      modalTab === tab.id
                        ? `bg-[#171717] text-white shadow-[2px_2px_0px_${tab.shadow}]`
                        : 'bg-white text-[#171717] border border-[#171717]/30 hover:border-[#171717]'
                    }`}>
                    <Icon size={13} /> <span>{tab.label}</span>
                    {tab.badge > 0 && <span className="px-1.5 py-0.2 bg-[#FF2F92] text-white text-[9px] rounded-full font-black">{tab.badge}</span>}
                  </button>
                )
              })}
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-0">
              {/* Task title + badges — always visible */}
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${STATUS_CONFIG[selectedTask.status]?.bg || 'bg-neutral-200'}`}>{STATUS_CONFIG[selectedTask.status]?.label || selectedTask.status}</span>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${PRIORITY_CONFIG[selectedTask.priority]?.bg || 'bg-neutral-200'}`}>Prioritas {PRIORITY_CONFIG[selectedTask.priority]?.label || selectedTask.priority}</span>
                </div>
                <h2 className="font-display text-xl uppercase text-[#171717] leading-tight">{selectedTask.title}</h2>
              </div>

              {/* TAB: OVERVIEW */}
              {modalTab === 'overview' && (
                <div className="space-y-4">
                  {selectedTask.description && (
                    <div className="p-3 bg-[#FAF7F2] rounded-md border border-[#171717]/15">
                      <span className="text-[9.5px] font-black uppercase text-[#171717]/60 block mb-1">Instruksi dari PM:</span>
                      <p className="text-xs text-[#171717] leading-relaxed whitespace-pre-line font-medium">{selectedTask.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-semibold">
                    <div className="p-2.5 bg-[#FAF7F2] rounded border border-[#171717]/15"><span className="text-[9px] uppercase font-black text-[#171717]/60 block mb-0.5">Proyek</span><p className="truncate font-bold text-[#171717]">{selectedTask.project?.name || '—'}</p></div>
                    <div className="p-2.5 bg-[#FAF7F2] rounded border border-[#171717]/15"><span className="text-[9px] uppercase font-black text-[#171717]/60 block mb-0.5">Deadline</span><p className="truncate font-bold text-[#171717]">{selectedTask.deadline ? new Date(selectedTask.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p></div>
                    <div className="p-2.5 bg-[#FAF7F2] rounded border border-[#171717]/15"><span className="text-[9px] uppercase font-black text-[#171717]/60 block mb-0.5">Sprint</span><p className="truncate font-bold text-[#171717]">{selectedTask.milestone?.title || '—'}</p></div>
                  </div>
                  {/* Progress bar */}
                  <div className="p-3.5 bg-white border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] space-y-2">
                    <div className="flex items-center justify-between text-xs font-black">
                      <span className="text-[10px] uppercase text-[#171717]/70">Capaian Checklist</span>
                      <span className="font-display text-sm text-[#171717]">{selectedTask.checklist_completed || 0}/{selectedTask.checklist_total || 0} ({selectedTask.checklist_progress || 0}%)</span>
                    </div>
                    <div className="w-full bg-[#EAE4D8] h-3 rounded-full overflow-hidden border border-[#171717]/30">
                      <div className="h-full bg-[#10B981] transition-all duration-300" style={{ width: `${selectedTask.checklist_progress || 0}%` }} />
                    </div>
                  </div>
                  {/* Checklists */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase text-[#171717] flex items-center gap-1.5"><ListTodo size={14} className="text-[#FF2F92]" /> Checklist Pekerjaan</h4>
                    {(!selectedTask.checklists || selectedTask.checklists.length === 0) ? (
                      <p className="text-xs text-[#171717]/60 italic p-3 bg-[#FAF7F2] rounded text-center">Tidak ada checklist pada tugas ini.</p>
                    ) : (
                      <div className="space-y-2">
                        {(() => {
                          const isLocked = selectedTask.status === 'in_review' || selectedTask.status === 'done' || selectedTask.status === 'completed' || selectedTask.is_completed
                          return selectedTask.checklists.map((chk, i) => (
                            <div key={chk.id || i} onClick={() => handleToggleChecklist(chk.id)}
                              className={`p-3 rounded-lg border-1.5 transition-all flex items-center justify-between gap-3 min-h-[44px] ${isLocked ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'} ${
                                chk.is_completed ? 'bg-[#ECFDF5] border-[#10B981] text-[#065F46] shadow-[1px_1px_0px_#10B981]'
                                  : isLocked ? 'bg-[#FAF7F2] border-[#171717]/20 text-[#171717]/70'
                                  : 'bg-[#FAF7F2] border-[#171717]/30 hover:border-[#FF2F92] text-[#171717] hover:bg-white'
                              }`}>
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-5 h-5 rounded border-1.5 flex items-center justify-center shrink-0 transition-colors ${
                                  chk.is_completed ? 'bg-[#10B981] border-[#10B981] text-white'
                                    : isLocked ? 'bg-neutral-200 border-[#171717]/40'
                                    : 'bg-white border-[#171717]'
                                }`}>
                                  {togglingChecklistId === chk.id ? <Loader2 size={11} className="animate-spin text-[#171717]" /> : chk.is_completed ? <Check size={13} strokeWidth={3} /> : isLocked ? <Lock size={10} /> : null}
                                </div>
                                <span className={`text-xs font-bold leading-snug ${chk.is_completed ? 'line-through opacity-75' : ''}`}>{chk.title}</span>
                              </div>
                              {chk.is_completed && <span className="text-[9px] font-black uppercase text-[#10B981] shrink-0">✓ Tuntas</span>}
                              {isLocked && !chk.is_completed && <span className="text-[8.5px] font-bold text-[#171717]/50 flex items-center gap-0.5 shrink-0"><Lock size={9} /> Terkunci</span>}
                            </div>
                          ))
                        })()}
                      </div>
                    )}
                  </div>
                  {/* Status banners */}
                  {selectedTask.status === 'in_review' && (
                    <div className="p-3.5 bg-[#B8A0F0]/20 border border-[#7C3AED] rounded-lg space-y-2">
                      <p className="font-black uppercase text-[#7C3AED] flex items-center gap-1.5 text-xs"><Lock size={13} /> Menunggu Review Project Manager</p>
                      <p className="text-[10.5px] text-[#171717]/75 leading-relaxed">Pengajuan penyelesaian Anda telah diterima. Checklist terkunci hingga PM memberikan keputusan.</p>
                      {taskReviews.find(r => r.action === 'revision_requested') && (
                        <div className="p-2.5 bg-white rounded border border-[#FFD83D] text-xs space-y-1 mt-1">
                          <span className="text-[9.5px] font-black uppercase text-[#171717] flex items-center gap-1"><AlertTriangle size={11} className="text-[#FF2F92]" /> Catatan Revisi Terakhir dari PM:</span>
                          <p className="text-[#171717]/80 leading-relaxed italic">{taskReviews.find(r => r.action === 'revision_requested')?.notes || '(Tidak ada catatan)'}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {(selectedTask.status === 'done' || selectedTask.status === 'completed' || selectedTask.is_completed) && selectedTask.status !== 'in_review' && (
                    <div className="p-3.5 bg-[#ECFDF5] border border-[#10B981] rounded-lg space-y-1">
                      <p className="font-black uppercase text-[#065F46] flex items-center gap-1.5 text-xs"><CheckCheck size={14} /> Tugas Selesai & Disetujui!</p>
                      <p className="text-[10.5px] text-[#171717]/75 leading-relaxed">Project Manager telah menyetujui penyelesaian tugas ini.</p>
                    </div>
                  )}
                  {selectedTask.status === 'in_progress' && taskReviews.some(r => r.action === 'revision_requested') && (
                    <div className="p-3 bg-[#FFF9E6] border border-[#FFD83D] rounded-lg text-xs space-y-1.5">
                      <p className="font-black uppercase text-[#171717] flex items-center gap-1"><AlertTriangle size={12} className="text-[#FF2F92]" /> Tugas Memerlukan Revisi</p>
                      <p className="text-[#171717]/80 leading-relaxed italic">{taskReviews.find(r => r.action === 'revision_requested')?.notes || 'PM meminta perubahan pada tugas ini.'}</p>
                    </div>
                  )}
                  {selectedTask.checklist_progress === 100 && selectedTask.status !== 'in_review' && !['done','completed'].includes(selectedTask.status) && !selectedTask.is_completed && (
                    <div className="p-3.5 bg-[#ECFDF5] border border-[#10B981] rounded-lg text-xs space-y-3">
                      <p className="font-display uppercase text-[#065F46] flex items-center gap-1.5"><CheckCircle2 size={15} /> Checklist 100% Selesai!</p>
                      <p className="text-[#065F46]/85 text-[11px] leading-relaxed">Seluruh checklist telah dituntaskan. Ajukan untuk direview oleh Project Manager.</p>
                      <button type="button" onClick={() => setShowSubmitReviewModal(true)} className="w-full px-4 py-2.5 bg-[#10B981] hover:bg-[#059669] text-white border border-[#171717] rounded-lg font-black uppercase text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[2px_2px_0px_#171717]">
                        <ShieldCheck size={14} /> Ajukan Penyelesaian Tugas
                      </button>
                    </div>
                  )}
                  {selectedTask.checklist_progress < 100 && !['in_review','done','completed'].includes(selectedTask.status) && !selectedTask.is_completed && (
                    <div className="p-3 bg-[#FFF0F8] border border-[#FF2F92]/40 rounded-lg text-[10.5px] text-[#171717] space-y-1">
                      <p className="font-black uppercase text-[#FF2F92] flex items-center gap-1"><Info size={13} /> Aturan Persetujuan Done</p>
                      <p className="text-[#171717]/75 leading-relaxed">Selesaikan seluruh checklist (100%) terlebih dahulu sebelum dapat mengajukan review ke Project Manager.</p>
                    </div>
                  )}
                  {!['in_review','done','completed'].includes(selectedTask.status) && !selectedTask.is_completed && (
                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-[#171717]/15">
                      <span className="text-[11px] text-[#171717]/70 font-semibold">Ada progres yang ingin dicatat?</span>
                      <button type="button" onClick={() => setModalTab('report')} className="px-3 py-1.5 bg-[#FF2F92] hover:bg-[#FF2F92]/90 text-white border border-[#171717] rounded text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#171717]">
                        <Send size={12} /> Buat Laporan
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: REPORT (PM-G) */}
              {modalTab === 'report' && (
                <div className="space-y-4">
                  <div className="p-3 bg-[#FFF9E6] border border-[#FFD83D] rounded-lg text-xs space-y-1">
                    <p className="font-display uppercase text-[#171717] flex items-center gap-1.5"><Sparkles size={14} className="text-[#FF2F92]" /> Pencatatan Progres Pekerjaan</p>
                    <p className="text-[#171717]/80 text-[11px] leading-relaxed">Laporan ini disimpan sebagai riwayat resmi. Snapshot checklist diambil otomatis dari kondisi aktual saat ini.</p>
                  </div>
                  <div className="p-3 bg-white border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] uppercase font-black text-[#171717]/70">Snapshot Capaian</span>
                      <span className="font-display text-xs text-[#065F46] bg-[#ECFDF5] border border-[#10B981] px-2 py-0.5 rounded">{selectedTask.checklist_completed || 0}/{selectedTask.checklist_total || 0} ({selectedTask.checklist_progress || 0}%)</span>
                    </div>
                    <div className="w-full bg-[#EAE4D8] h-2.5 rounded-full overflow-hidden border border-[#171717]/30">
                      <div className="h-full bg-[#10B981] transition-all duration-300" style={{ width: `${selectedTask.checklist_progress || 0}%` }} />
                    </div>
                  </div>
                  <form onSubmit={handleSubmitReport} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-black uppercase text-[#171717] mb-1">Deskripsi Pekerjaan <span className="text-[#FF2F92]">*</span></label>
                      <textarea rows={3} value={workDescription} onChange={e => setWorkDescription(e.target.value)} placeholder="Jelaskan secara spesifik apa yang telah Anda selesaikan..." className="pkm-input w-full text-xs font-medium" required disabled={submittingReport} />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-[#171717] mb-1">Kendala / Blocker <span className="text-[10px] font-normal text-[#171717]/60 normal-case">(Opsional)</span></label>
                      <textarea rows={2} value={blocker} onChange={e => setBlocker(e.target.value)} placeholder="Kendala yang dihadapi..." className="pkm-input w-full text-xs font-medium" disabled={submittingReport} />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-[#171717] mb-1">Rencana Kerja Berikutnya <span className="text-[10px] font-normal text-[#171717]/60 normal-case">(Opsional)</span></label>
                      <input type="text" value={nextPlan} onChange={e => setNextPlan(e.target.value)} placeholder="Rencana langkah selanjutnya..." className="pkm-input w-full text-xs font-medium" disabled={submittingReport} />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-[#171717] mb-1">Lampiran <span className="text-[10px] font-normal text-[#171717]/60 normal-case">(PDF/DOC/XLS/Gambar/ZIP, maks 10MB)</span></label>
                      <input type="file" id="ws-report-attachment" onChange={e => setAttachmentFile(e.target.files?.[0] || null)} className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded file:border file:border-[#171717] file:text-xs file:font-bold file:bg-[#FAF7F2] file:hover:bg-[#FFD83D] file:cursor-pointer" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip" disabled={submittingReport} />
                      {attachmentFile && <p className="text-[10px] font-bold text-[#10B981] mt-1 flex items-center gap-1"><Check size={11} /> {attachmentFile.name}</p>}
                    </div>
                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#171717]/15">
                      <button type="button" onClick={() => setModalTab('overview')} className="pkm-btn-outline cursor-pointer text-xs" disabled={submittingReport}>Batal</button>
                      <button type="submit" disabled={submittingReport || !workDescription.trim()} className="px-4 py-2 bg-[#FF2F92] hover:bg-[#FF2F92]/90 disabled:opacity-50 text-white font-black uppercase text-xs rounded border border-[#171717] shadow-[2px_2px_0px_#171717] flex items-center gap-2 cursor-pointer">
                        {submittingReport ? <><Loader2 size={13} className="animate-spin" /> Menyimpan...</> : <><Send size={13} /> Simpan Progress Update</>}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB: HISTORY (PM-G) */}
              {modalTab === 'history' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <h4 className="text-xs font-black uppercase text-[#171717] flex items-center gap-1.5"><History size={14} className="text-[#FF2F92]" /> Riwayat Perkembangan</h4>
                    <span className="text-[10px] text-[#171717]/60 font-bold">{taskUpdates.length} Laporan</span>
                  </div>
                  {loadingUpdates ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-[#171717]/70"><Loader2 size={18} className="animate-spin text-[#FF2F92]" /><span>Memuat riwayat...</span></div>
                  ) : taskUpdates.length === 0 ? (
                    <div className="p-6 bg-[#FAF7F2] rounded-lg border border-[#171717]/20 text-center space-y-2">
                      <History size={24} className="mx-auto text-[#171717]/40" />
                      <p className="text-xs font-bold text-[#171717]">Belum ada riwayat pada tugas ini.</p>
                      <button type="button" onClick={() => setModalTab('report')} className="mt-2 px-3 py-1.5 bg-white hover:bg-[#FFD83D] text-[#171717] border border-[#171717] rounded text-xs font-bold uppercase shadow-[1px_1px_0px_#171717] inline-flex items-center gap-1.5 cursor-pointer"><Send size={12} /> Buat Laporan</button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {taskUpdates.map((upd, idx) => (
                        <div key={upd.id || idx} className="p-3.5 bg-white border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] space-y-2.5">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#B8A0F0] border border-[#171717] text-[#171717] text-[10px] font-black flex items-center justify-center shrink-0">{(upd.user?.name || 'M').charAt(0).toUpperCase()}</div>
                              <div>
                                <span className="text-xs font-bold text-[#171717]">{upd.user?.name || 'Member'}</span>
                                <span className="text-[9.5px] text-[#171717]/60 block">{upd.created_at ? new Date(upd.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB' : '—'}</span>
                              </div>
                            </div>
                            <span className="text-[9.5px] font-black uppercase px-2 py-0.5 rounded border border-[#10B981] bg-[#ECFDF5] text-[#065F46] shrink-0">Snapshot: {upd.completed_checklists || 0}/{upd.total_checklists || 0} ({upd.progress_snapshot || 0}%)</span>
                          </div>
                          <div className="p-2.5 bg-[#FAF7F2] rounded border border-[#171717]/15 text-xs text-[#171717] leading-relaxed whitespace-pre-wrap font-medium">{upd.work_description}</div>
                          {upd.blocker && <div className="p-2.5 bg-[#FFF0F8] border border-[#FF2F92]/40 rounded text-xs"><span className="text-[9.5px] font-black uppercase text-[#FF2F92] flex items-center gap-1 mb-0.5"><AlertTriangle size={11} /> Kendala:</span><p className="text-[#171717]/85 text-[11px]">{upd.blocker}</p></div>}
                          {upd.next_plan && <div className="p-2.5 bg-[#F0FDF4] border border-[#10B981]/40 rounded text-xs"><span className="text-[9.5px] font-black uppercase text-[#065F46] flex items-center gap-1 mb-0.5"><CheckCircle2 size={11} /> Rencana:</span><p className="text-[#171717]/85 text-[11px]">{upd.next_plan}</p></div>}
                          {upd.has_attachment && <div className="pt-1 flex items-center justify-between border-t border-[#171717]/10"><button type="button" onClick={() => handleDownloadAttachment(upd.id, upd.attachment_name)} className="px-2.5 py-1 bg-white hover:bg-[#FFD83D] border border-[#171717] rounded text-[11px] font-bold text-[#171717] flex items-center gap-1.5 cursor-pointer shadow-[1px_1px_0px_#171717]"><Download size={11} /><span className="truncate max-w-[200px]">{upd.attachment_name || 'Unduh Lampiran'}</span></button><span className="text-[9px] text-[#171717]/50 font-bold uppercase">Dokumen Privat</span></div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: APPROVAL (PM-H) */}
              {modalTab === 'approval' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <h4 className="text-xs font-black uppercase text-[#171717] flex items-center gap-1.5"><ShieldCheck size={14} className="text-[#7C3AED]" /> Riwayat Persetujuan</h4>
                    <span className="text-[10px] text-[#171717]/60 font-bold">{taskReviews.length} Catatan</span>
                  </div>
                  {loadingUpdates ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-[#171717]/70"><Loader2 size={18} className="animate-spin text-[#7C3AED]" /><span>Memuat riwayat...</span></div>
                  ) : taskReviews.length === 0 ? (
                    <div className="p-6 bg-[#FAF7F2] rounded-lg border border-[#171717]/20 text-center space-y-2">
                      <ShieldCheck size={24} className="mx-auto text-[#171717]/30" />
                      <p className="text-xs font-bold text-[#171717]">Belum ada riwayat persetujuan.</p>
                      <p className="text-[11px] text-[#171717]/60 max-w-sm mx-auto">Ajukan penyelesaian tugas setelah checklist 100% selesai untuk direview PM.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {taskReviews.map((rev, idx) => {
                        const ACTION_CONFIG = {
                          submitted:          { label: 'Diajukan ke PM',   bg: 'bg-[#B8A0F0]/20 border-[#7C3AED]', badge: 'bg-[#B8A0F0] text-[#171717]', icon: <ShieldCheck size={12} /> },
                          approved:           { label: 'Disetujui (Done)', bg: 'bg-[#ECFDF5] border-[#10B981]',    badge: 'bg-[#10B981] text-white',      icon: <ThumbsUp size={12} /> },
                          revision_requested: { label: 'Diminta Revisi',   bg: 'bg-[#FFF9E6] border-[#FFD83D]',    badge: 'bg-[#FFD83D] text-[#171717]',  icon: <MessageSquareWarning size={12} /> },
                          reopened:           { label: 'Dibuka Kembali',   bg: 'bg-[#FAF7F2] border-[#171717]',    badge: 'bg-[#171717] text-white',      icon: <RefreshCw size={12} /> },
                        }
                        const cfg = ACTION_CONFIG[rev.action] || { label: rev.action, bg: 'bg-white border-[#171717]/20', badge: 'bg-[#171717] text-white', icon: null }
                        return (
                          <div key={rev.id || idx} className={`p-3.5 rounded-lg border ${cfg.bg} space-y-2`}>
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-[#B8A0F0] border border-[#171717] text-[#171717] text-[10px] font-black flex items-center justify-center shrink-0">{(rev.user?.name || 'U').charAt(0).toUpperCase()}</div>
                                <div>
                                  <span className="text-xs font-bold text-[#171717]">{rev.user?.name || 'User'}</span>
                                  <span className="text-[9.5px] text-[#171717]/60 block">{rev.created_at ? new Date(rev.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB' : '—'}</span>
                                </div>
                              </div>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border flex items-center gap-1 shrink-0 ${cfg.badge}`}>{cfg.icon}<span>{cfg.label}</span></span>
                            </div>
                            {rev.notes && <div className="p-2.5 bg-white/70 rounded border border-[#171717]/15 text-xs text-[#171717] leading-relaxed whitespace-pre-wrap font-medium"><span className="text-[9.5px] font-black uppercase text-[#171717]/60 block mb-0.5">Catatan:</span>{rev.notes}</div>}
                            <div className="text-[9.5px] text-[#171717]/50 font-bold uppercase flex items-center gap-1.5"><span>Cycle #{rev.review_cycle}</span>{rev.from_status && rev.to_status && <span>• {rev.from_status} → {rev.to_status}</span>}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-5 py-3 border-t-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-end">
              <button onClick={() => setShowDetailModal(false)} disabled={submittingReport || submittingReview} className="pkm-btn-outline cursor-pointer text-xs">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== SUBMIT REVIEW CONFIRMATION MODAL (PM-H) ===== */}
      {showSubmitReviewModal && selectedTask && (
        <div className="fixed inset-0 bg-[#171717]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[60] animate-in fade-in duration-150" onClick={e => { if (e.target === e.currentTarget && !submittingReview) setShowSubmitReviewModal(false) }}>
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#10B981] w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#ECFDF5] border border-[#10B981] flex items-center justify-center shrink-0"><ShieldCheck size={18} className="text-[#10B981]" strokeWidth={2.5} /></div>
              <div>
                <h3 className="font-display text-lg uppercase text-[#171717]">AJUKAN REVIEW TUGAS</h3>
                <p className="text-[10px] text-[#171717]/60 font-bold uppercase">Konfirmasi Penyelesaian Tugas</p>
              </div>
            </div>
            <p className="text-xs text-[#171717]/80 leading-relaxed">Anda akan mengajukan penyelesaian tugas <strong>"{selectedTask.title}"</strong> untuk ditinjau PM.</p>
            <div className="p-3 bg-[#FAF7F2] rounded-lg border border-[#171717]/20 text-xs space-y-1">
              <div className="flex items-center justify-between"><span className="font-bold text-[#171717]">Checklist Selesai:</span><span className="font-black text-[#10B981]">{selectedTask.checklist_completed}/{selectedTask.checklist_total} (100%)</span></div>
              <p className="text-[10.5px] text-[#171717]/60 leading-tight">* Setelah diajukan, status menjadi <strong>In Review</strong> dan checklist terkunci.</p>
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-[#171717] mb-1">Catatan Pengajuan <span className="text-[10px] font-normal text-[#171717]/60 normal-case">(Opsional)</span></label>
              <textarea rows={2} value={submissionNotes} onChange={e => setSubmissionNotes(e.target.value)} placeholder="Tambahkan catatan khusus untuk PM..." className="pkm-input w-full text-xs font-medium" disabled={submittingReview} />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#171717]/15">
              <button type="button" onClick={() => setShowSubmitReviewModal(false)} disabled={submittingReview} className="pkm-btn-outline cursor-pointer text-xs">Batal</button>
              <button type="button" onClick={handleSubmitReview} disabled={submittingReview} className="px-4 py-2 bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-white font-black uppercase text-xs rounded border border-[#171717] shadow-[2px_2px_0px_#171717] flex items-center gap-2 cursor-pointer">
                {submittingReview ? <><Loader2 size={13} className="animate-spin" /> Mengajukan...</> : <><ShieldCheck size={13} /> Ya, Ajukan Penyelesaian</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
