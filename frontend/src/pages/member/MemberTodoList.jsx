import { useState, useEffect, useMemo } from 'react'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import {
  CheckSquare,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Loader2,
  Calendar,
  Folder,
  Flag,
  X,
  Eye,
  Check,
  AlertCircle,
  ListTodo,
  ChevronRight,
  ArrowUpDown,
  Sparkles,
  Info,
  Send,
  History,
  Download,
  Paperclip,
  FileText,
  ShieldCheck,
  Lock,
  CheckCheck,
  ThumbsUp,
  MessageSquareWarning,
  RefreshCw
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', bg: 'bg-[#FF2F92] text-white border-[#171717]', sortWeight: 4 },
  high:   { label: 'High',   bg: 'bg-[#FF5722] text-white border-[#171717]', sortWeight: 3 },
  medium: { label: 'Medium', bg: 'bg-[#FFD83D] text-[#171717] border-[#171717]', sortWeight: 2 },
  low:    { label: 'Low',    bg: 'bg-[#B8A0F0] text-[#171717] border-[#171717]', sortWeight: 1 },
}

const STATUS_CONFIG = {
  todo:        { label: 'To-do',       bg: 'bg-[#FAF7F2] text-[#171717] border-[#171717]' },
  pending:     { label: 'To-do',       bg: 'bg-[#FAF7F2] text-[#171717] border-[#171717]' },
  in_progress: { label: 'In Progress', bg: 'bg-[#FFD83D] text-[#171717] border-[#171717]' },
  in_review:   { label: 'In Review',   bg: 'bg-[#B8A0F0] text-[#171717] border-[#171717]' },
  completed:   { label: 'Done',        bg: 'bg-[#10B981] text-white border-[#171717]' },
  done:        { label: 'Done',        bg: 'bg-[#10B981] text-white border-[#171717]' },
}

export default function MemberTodoList() {
  const { user } = useAuth()

  const [tasks, setTasks] = useState([])
  const [summary, setSummary] = useState({
    total: 0,
    todo: 0,
    in_progress: 0,
    in_review: 0,
    done: 0,
    overdue: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sortBy, setSortBy] = useState('default') // 'default' | 'deadline' | 'priority' | 'progress'

  // Modals & Feedback
  const [selectedTask, setSelectedTask] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [togglingChecklistId, setTogglingChecklistId] = useState(null)

  // Progress Update & Work Report state (PM-G)
  const [modalTab, setModalTab] = useState('overview') // 'overview' | 'report' | 'history'
  const [taskUpdates, setTaskUpdates] = useState([])
  const [loadingUpdates, setLoadingUpdates] = useState(false)
  const [workDescription, setWorkDescription] = useState('')
  const [blocker, setBlocker] = useState('')
  const [nextPlan, setNextPlan] = useState('')
  const [attachmentFile, setAttachmentFile] = useState(null)
  const [submittingReport, setSubmittingReport] = useState(false)

  // Approval Workflow State (PM-H)
  const [taskReviews, setTaskReviews] = useState([])
  const [showSubmitReviewModal, setShowSubmitReviewModal] = useState(false)
  const [submissionNotes, setSubmissionNotes] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  const showNotification = (type, message) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 3500)
  }

  // Fetch Member's tasks and summary from backend
  const fetchTasks = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get('/tasks')
      const taskList = res.data.tasks || []
      setTasks(taskList)

      if (res.data.summary) {
        setSummary(res.data.summary)
      } else {
        const todayStr = new Date().toISOString().split('T')[0]
        setSummary({
          total: taskList.length,
          todo: taskList.filter(t => !t.is_completed && (t.status === 'pending' || t.status === 'todo')).length,
          in_progress: taskList.filter(t => !t.is_completed && t.status === 'in_progress').length,
          in_review: taskList.filter(t => !t.is_completed && t.status === 'in_review').length,
          done: taskList.filter(t => t.is_completed || t.status === 'completed' || t.status === 'done').length,
          overdue: taskList.filter(t => !t.is_completed && t.deadline && t.deadline < todayStr).length,
        })
      }
    } catch (err) {
      console.error('Failed to load member tasks:', err)
      setError('Gagal memuat daftar pekerjaan pribadi Anda dari server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showDetailModal) {
        setShowDetailModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showDetailModal])

  // Reset Filters
  const handleResetFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setPriorityFilter('all')
    setSortBy('default')
  }

  // Filter & Sort tasks
  const filteredTasks = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]

    const filtered = tasks.filter((t) => {
      const searchLower = search.toLowerCase()
      const matchSearch =
        !search ||
        t.title.toLowerCase().includes(searchLower) ||
        (t.description || '').toLowerCase().includes(searchLower) ||
        (t.project?.name || '').toLowerCase().includes(searchLower) ||
        (t.project?.code || '').toLowerCase().includes(searchLower)

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

    // Sorting
    return filtered.sort((a, b) => {
      const aOverdue = !a.is_completed && a.deadline && a.deadline < todayStr ? 1 : 0
      const bOverdue = !b.is_completed && b.deadline && b.deadline < todayStr ? 1 : 0

      if (sortBy === 'default') {
        // 1. Overdue first
        if (aOverdue !== bOverdue) return bOverdue - aOverdue
        // 2. Uncompleted first
        if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1
        // 3. Nearest deadline
        if (a.deadline && b.deadline) {
          if (a.deadline !== b.deadline) return a.deadline.localeCompare(b.deadline)
        } else if (a.deadline) return -1
        else if (b.deadline) return 1
        // 4. Highest priority
        const aPrio = PRIORITY_CONFIG[a.priority]?.sortWeight || 0
        const bPrio = PRIORITY_CONFIG[b.priority]?.sortWeight || 0
        return bPrio - aPrio
      }

      if (sortBy === 'deadline') {
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return a.deadline.localeCompare(b.deadline)
      }

      if (sortBy === 'priority') {
        const aPrio = PRIORITY_CONFIG[a.priority]?.sortWeight || 0
        const bPrio = PRIORITY_CONFIG[b.priority]?.sortWeight || 0
        return bPrio - aPrio
      }

      if (sortBy === 'progress') {
        return (b.checklist_progress || 0) - (a.checklist_progress || 0)
      }

      return 0
    })
  }, [tasks, search, statusFilter, priorityFilter, sortBy])

  // Open Detail Modal & fetch latest detail + progress updates (PM-G) + reviews (PM-H)
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

      if (taskRes.status === 'fulfilled' && taskRes.value?.data?.task) {
        setSelectedTask(taskRes.value.data.task)
      }
      if (updatesRes.status === 'fulfilled' && updatesRes.value?.data?.updates) {
        setTaskUpdates(updatesRes.value.data.updates)
      }
      if (reviewsRes.status === 'fulfilled' && reviewsRes.value?.data?.reviews) {
        setTaskReviews(reviewsRes.value.data.reviews)
      }
    } catch {
      // Keep existing object if error
    } finally {
      setLoadingUpdates(false)
    }
  }

  // Submit Task for Review (PM-H)
  const handleSubmitReview = async (e) => {
    if (e) e.preventDefault()
    if (!selectedTask) return

    setSubmittingReview(true)
    try {
      const res = await api.post(`/tasks/${selectedTask.id}/submit-review`, {
        notes: submissionNotes.trim() || undefined,
      })

      const updatedTask = res.data.task
      const newReview = res.data.review

      // Update state in modal
      setSelectedTask(prev => ({
        ...prev,
        ...updatedTask,
      }))
      setTaskReviews(prev => [newReview, ...prev])

      // Update state in main tasks list
      setTasks(prev => prev.map(t => (t.id === selectedTask.id ? { ...t, ...updatedTask } : t)))

      // Refresh tasks and summary from backend
      fetchTasks()

      setShowSubmitReviewModal(false)
      setSubmissionNotes('')
      showNotification('success', 'Penyelesaian tugas berhasil diajukan! Menunggu review Project Manager.')
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Gagal mengajukan review tugas.')
    } finally {
      setSubmittingReview(false)
    }
  }

  // Submit Progress Update & Work Report (PM-G)
  const handleSubmitReport = async (e) => {
    if (e) e.preventDefault()
    if (!workDescription.trim()) {
      showNotification('error', 'Deskripsi pekerjaan wajib diisi.')
      return
    }

    if (!selectedTask) return

    setSubmittingReport(true)
    try {
      const formData = new FormData()
      formData.append('work_description', workDescription.trim())
      if (blocker.trim()) formData.append('blocker', blocker.trim())
      if (nextPlan.trim()) formData.append('next_plan', nextPlan.trim())
      if (attachmentFile) formData.append('attachment', attachmentFile)

      const res = await api.post(`/tasks/${selectedTask.id}/updates`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const newUpdate = res.data.update
      setTaskUpdates(prev => [newUpdate, ...prev])
      setWorkDescription('')
      setBlocker('')
      setNextPlan('')
      setAttachmentFile(null)

      // Reset file input if present in DOM
      const fileInput = document.getElementById('member-report-attachment')
      if (fileInput) fileInput.value = ''

      showNotification('success', 'Progress update berhasil dicatat ke histori!')
      setModalTab('history')
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Gagal mencatat progress update.'
      showNotification('error', errorMsg)
    } finally {
      setSubmittingReport(false)
    }
  }

  // Download attachment securely (PM-G)
  const handleDownloadAttachment = async (updateId, fileName) => {
    try {
      const res = await api.get(`/task-updates/${updateId}/download`, {
        responseType: 'blob',
      })
      const blob = new Blob([res.data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', fileName || 'lampiran')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Gagal mengunduh lampiran. Periksa hak akses Anda.')
    }
  }

  // Toggle checklist item
  const handleToggleChecklist = async (checklistId) => {
    if (togglingChecklistId) return

    if (selectedTask?.status === 'in_review') {
      showNotification('error', 'Checklist terkunci selama tugas dalam proses review oleh Project Manager.')
      return
    }
    if (selectedTask?.status === 'done' || selectedTask?.status === 'completed' || selectedTask?.is_completed) {
      showNotification('error', 'Checklist terkunci karena tugas telah disetujui selesai (Done).')
      return
    }

    setTogglingChecklistId(checklistId)

    try {
      const res = await api.post(`/checklists/${checklistId}/toggle`)
      const updatedChk = res.data.checklist
      const updatedStats = res.data.stats

      // Update state in modal
      setSelectedTask(prev => {
        if (!prev) return null
        const updatedChecklists = (prev.checklists || []).map(c => c.id === checklistId ? updatedChk : c)
        return {
          ...prev,
          checklists: updatedChecklists,
          checklist_total: updatedStats.total,
          checklist_completed: updatedStats.completed,
          checklist_progress: updatedStats.progress,
        }
      })

      // Update state in main tasks list
      setTasks(prev => prev.map(t => {
        if (t.id === selectedTask?.id) {
          const updatedChecklists = (t.checklists || []).map(c => c.id === checklistId ? updatedChk : c)
          return {
            ...t,
            checklists: updatedChecklists,
            checklist_total: updatedStats.total,
            checklist_completed: updatedStats.completed,
            checklist_progress: updatedStats.progress,
          }
        }
        return t
      }))

      showNotification('success', updatedChk.is_completed ? 'Checklist selesai dicentang!' : 'Checklist dibatalkan.')
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Gagal memperbarui status checklist.')
    } finally {
      setTogglingChecklistId(null)
    }
  }

  const displayName = user?.name || 'Karyawan'
  const currentDate = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const todayStr = new Date().toISOString().split('T')[0]

  if (loading && tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[45vh] gap-3">
        <Loader2 size={32} className="animate-spin text-[#FF2F92]" />
        <p className="font-display text-lg uppercase tracking-wider text-[#171717]">
          MEMUAT DAFTAR TUGAS ANDA...
        </p>
      </div>
    )
  }

  if (error && tasks.length === 0) {
    return (
      <div className="p-6 bg-[#FFD83D] border-1.5 border-[#171717] rounded-lg shadow-[4px_4px_0px_#171717] max-w-md my-8">
        <h2 className="font-display text-xl uppercase mb-2">Gagal Memuat</h2>
        <p className="text-xs font-semibold mb-3">{error}</p>
        <button
          onClick={fetchTasks}
          className="px-3.5 py-1.5 bg-[#171717] text-white font-bold text-xs uppercase flex items-center gap-1.5 rounded cursor-pointer"
        >
          <RotateCcw size={13} /> Coba Lagi
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-8">
      {/* ================= 1. HEADER ================= */}
      <PageHeader
        title={`HALO, ${displayName.toUpperCase()}`}
        subtitle="Berikut adalah seluruh daftar tugas dan tanggung jawab pekerjaan pribadi Anda."
        tag="MEMBER WORKSPACE"
        actions={
          <div className="bg-white px-3.5 py-2 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center gap-2">
            <Calendar size={15} className="text-[#FF2F92]" />
            <span className="text-xs font-black uppercase text-[#171717]">{currentDate}</span>
          </div>
        }
      />

      {/* ================= 2. FEEDBACK NOTIFICATION ================= */}
      {feedback && (
        <div
          className={`p-3.5 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex items-center justify-between text-xs font-bold transition-all ${
            feedback.type === 'success' ? 'bg-[#ECFDF5] text-[#065F46]' : 'bg-[#FFD83D] text-[#171717]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 pr-2">
            {feedback.type === 'success' ? (
              <Check size={16} strokeWidth={3} className="text-[#10B981] shrink-0" />
            ) : (
              <AlertCircle size={16} strokeWidth={3} className="text-[#FF2F92] shrink-0" />
            )}
            <span className="break-words">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-[#171717]/10 rounded cursor-pointer shrink-0"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ================= 3. PERSONAL TASK SUMMARY (6 METRICS) ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {[
          { id: 'all',        label: 'Total Tugas',     value: summary.total,       bg: 'bg-white',       accent: 'text-[#171717]' },
          { id: 'todo',       label: 'To-do',           value: summary.todo,        bg: 'bg-[#FAF7F2]',   accent: 'text-[#171717]' },
          { id: 'in_progress',label: 'In Progress',     value: summary.in_progress, bg: 'bg-[#FFD83D]/30',accent: 'text-[#171717]' },
          { id: 'in_review',  label: 'In Review',       value: summary.in_review,   bg: 'bg-[#B8A0F0]/30',accent: 'text-[#171717]' },
          { id: 'done',       label: 'Selesai (Done)',  value: summary.done,        bg: 'bg-[#ECFDF5]',   accent: 'text-[#065F46]' },
          { id: 'overdue',    label: 'Terlewat Deadline',value: summary.overdue,    bg: summary.overdue > 0 ? 'bg-[#FF2F92]' : 'bg-white', accent: summary.overdue > 0 ? 'text-white' : 'text-[#FF2F92]' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setStatusFilter(item.id)}
            className={`p-3 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] text-left transition-all cursor-pointer hover:-translate-y-0.5 ${item.bg}`}
          >
            <span className={`text-[9.5px] font-black uppercase tracking-wider block leading-tight ${item.accent}`}>
              {item.label}
            </span>
            <p className={`font-display text-2xl mt-1 leading-none ${item.accent}`}>
              {item.value}
            </p>
          </button>
        ))}
      </div>

      {/* ================= 4. TOOLBAR & FILTER ================= */}
      <div className="bg-white p-3.5 sm:p-4 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] space-y-3">
        {/* Search & Sort Row */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#171717]/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama tugas atau proyek..."
              className="w-full pl-9 pr-8 py-2 bg-[#FAF7F2] border border-[#171717]/40 rounded-lg text-xs font-semibold text-[#171717] placeholder:text-[#171717]/40 focus:outline-none focus:border-[#FF2F92] min-h-[38px]"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#171717]/40 hover:text-[#171717] p-1 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sorters & Reset */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-[#FAF7F2] px-2.5 py-1.5 border border-[#171717]/40 rounded-lg text-xs font-bold text-[#171717] min-h-[38px]">
              <ArrowUpDown size={13} className="text-[#171717]/60" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent focus:outline-none text-[11px] font-black uppercase cursor-pointer"
              >
                <option value="default">Urutan: Prioritas & Deadline</option>
                <option value="deadline">Deadline Terdekat</option>
                <option value="priority">Prioritas Tertinggi</option>
                <option value="progress">Progres Checklist Tertinggi</option>
              </select>
            </div>

            {(search || statusFilter !== 'all' || priorityFilter !== 'all' || sortBy !== 'default') && (
              <button
                onClick={handleResetFilters}
                className="px-3 py-1.5 text-[11px] font-bold text-[#FF2F92] hover:bg-pink-50 border border-[#FF2F92]/40 rounded-md transition-colors cursor-pointer min-h-[38px] flex items-center gap-1"
              >
                <RotateCcw size={12} />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Badges */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#171717]/10">
          {[
            { id: 'all',        label: 'Semua Status' },
            { id: 'todo',       label: 'To-do' },
            { id: 'in_progress',label: 'In Progress' },
            { id: 'in_review',  label: 'In Review' },
            { id: 'done',       label: 'Selesai (Done)' },
            { id: 'overdue',    label: 'Overdue Saja' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1 text-[10.5px] font-black uppercase rounded-md border transition-all cursor-pointer min-h-[30px] ${
                statusFilter === f.id
                  ? 'bg-[#171717] text-white border-[#171717] shadow-[1px_1px_0px_#171717]'
                  : 'bg-[#FAF7F2] text-[#171717] border-[#171717]/30 hover:border-[#171717]'
              }`}
            >
              {f.label}
            </button>
          ))}

          {/* Priority filter pills */}
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[9.5px] font-black uppercase text-[#171717]/50 mr-1">Prioritas:</span>
            {['all', 'urgent', 'high', 'medium', 'low'].map(p => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-2 py-0.5 text-[9.5px] font-black uppercase rounded border transition-all cursor-pointer ${
                  priorityFilter === p
                    ? 'bg-[#171717] text-white border-[#171717]'
                    : 'bg-white text-[#171717] border-[#171717]/30 hover:border-[#171717]'
                }`}
              >
                {p === 'all' ? 'All' : p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ================= 5. TO-DO LIST CARDS ================= */}
      {filteredTasks.length === 0 ? (
        <div className="p-8 sm:p-12 bg-white border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] text-center space-y-3">
          <CheckSquare size={36} className="mx-auto text-[#171717]/40" />
          <h3 className="font-display text-xl uppercase text-[#171717]">
            {tasks.length === 0 ? 'Belum Ada Tugas' : 'Tidak Ada Tugas Sesuai Filter'}
          </h3>
          <p className="text-xs font-semibold text-[#171717]/65 max-w-sm mx-auto leading-relaxed">
            {tasks.length === 0
              ? 'Anda belum memiliki tugas yang ditugaskan saat ini. Hubungi Project Manager untuk mendapatkan pembagian pekerjaan.'
              : 'Tidak ditemukan tugas yang cocok dengan kata kunci atau filter status yang dipilih.'}
          </p>
          {tasks.length > 0 && (
            <button
              onClick={handleResetFilters}
              className="pkm-btn-outline inline-flex items-center gap-1.5 cursor-pointer text-xs mt-2"
            >
              <RotateCcw size={13} />
              <span>Reset Seluruh Filter</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredTasks.map((task) => {
            const isOverdue = !task.is_completed && task.deadline && task.deadline < todayStr
            const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
            const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo

            // Calculate nearing deadline (<= 2 days)
            const daysLeft = task.deadline
              ? Math.ceil((new Date(task.deadline) - new Date(todayStr)) / (1000 * 60 * 60 * 24))
              : null
            const isNearDeadline = !task.is_completed && !isOverdue && daysLeft !== null && daysLeft >= 0 && daysLeft <= 2

            return (
              <div
                key={task.id}
                className={`bg-white p-4 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_#171717] transition-all flex flex-col justify-between space-y-3.5 ${
                  isOverdue ? 'border-l-4 border-l-[#FF2F92]' : ''
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-[#FAF7F2] border border-[#171717] rounded">
                        {task.project?.code || 'PRJ'}
                      </span>
                      {task.milestone && (
                        <span className="text-[9px] font-bold text-[#171717]/60 truncate max-w-[130px]" title={task.milestone.title}>
                          • {task.milestone.title}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded border ${priorityCfg.bg}`}>
                        {priorityCfg.label}
                      </span>
                      <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded border ${statusCfg.bg}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3
                    onClick={() => handleOpenDetail(task)}
                    className="font-display text-base uppercase text-[#171717] hover:text-[#FF2F92] cursor-pointer leading-tight mb-1"
                    title={task.title}
                  >
                    {task.title}
                  </h3>
                  <p className="text-xs text-[#171717]/70 line-clamp-2 leading-relaxed">
                    {task.description || 'Tidak ada deskripsi detail tambahan.'}
                  </p>
                </div>

                {/* Progress Bar & Ratio */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#171717]/60 text-[10.5px]">Checklist</span>
                    <span className="font-mono text-[#171717]">
                      {task.checklist_completed || 0}/{task.checklist_total || 0} ({task.checklist_progress || 0}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#EAE4D8] h-2.5 rounded-full overflow-hidden border border-[#171717]/25">
                    <div
                      className="h-full bg-[#10B981] transition-all duration-300"
                      style={{ width: `${task.checklist_progress || 0}%` }}
                    />
                  </div>
                </div>

                {/* Card Footer: Deadline + Button */}
                <div className="pt-2.5 border-t border-[#171717]/15 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className={isOverdue ? 'text-[#FF2F92]' : 'text-[#171717]/60'} />
                    <span className={`text-xs font-bold ${isOverdue ? 'text-[#FF2F92] font-black' : 'text-[#171717]'}`}>
                      {task.deadline ? new Date(task.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'Tidak ada target'}
                    </span>
                    {isOverdue && (
                      <span className="text-[8.5px] font-black uppercase px-1.5 py-0.5 bg-[#FF2F92] text-white rounded">
                        Terlewat
                      </span>
                    )}
                    {isNearDeadline && (
                      <span className="text-[8.5px] font-black uppercase px-1.5 py-0.5 bg-[#FFD83D] text-[#171717] rounded border border-[#171717]">
                        {daysLeft === 0 ? 'Hari Ini' : `${daysLeft} Hari Lagi`}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleOpenDetail(task)}
                    className="px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#FFD83D] active:bg-[#FF2F92] active:text-white text-[#171717] border border-[#171717] rounded-md text-[11px] font-black uppercase flex items-center gap-1 cursor-pointer transition-all shadow-[1px_1px_0px_#171717] min-h-[32px]"
                  >
                    <Eye size={12} />
                    <span>Detail & Checklist</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ================= 6. MODAL TASK DETAIL & PROGRESS UPDATE (PM-G) ================= */}
      {showDetailModal && selectedTask && (
        <div
          className="fixed inset-0 bg-[#171717]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submittingReport) setShowDetailModal(false)
          }}
        >
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#171717] w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-white border border-[#171717] rounded shrink-0">
                  {selectedTask.project?.code || 'PRJ'}
                </span>
                <h3 className="font-display text-base uppercase tracking-tight text-[#171717] truncate">
                  DETAIL TUGAS ANDA
                </h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                disabled={submittingReport}
                className="p-1.5 hover:bg-[#FFD83D] border border-[#171717] rounded-md cursor-pointer transition-colors disabled:opacity-50"
                title="Tutup (Esc)"
              >
                <X size={15} />
              </button>
            </div>

            {/* Sub-tab Navigation (PM-G + PM-H) */}
            <div className="flex items-center gap-1.5 px-4 sm:px-5 py-2 bg-[#FAF7F2] border-b border-[#171717]/20 shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setModalTab('overview')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-black uppercase transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  modalTab === 'overview'
                    ? 'bg-[#171717] text-white shadow-[2px_2px_0px_#FF2F92]'
                    : 'bg-white text-[#171717] border border-[#171717]/30 hover:border-[#171717]'
                }`}
              >
                <ListTodo size={13} />
                <span>Detail & Checklist</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('report')}
                disabled={selectedTask?.status === 'in_review' || selectedTask?.status === 'done' || selectedTask?.status === 'completed' || selectedTask?.is_completed}
                className={`px-3 py-1.5 rounded-md text-[11px] font-black uppercase transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  modalTab === 'report'
                    ? 'bg-[#171717] text-white shadow-[2px_2px_0px_#FFD83D]'
                    : 'bg-white text-[#171717] border border-[#171717]/30 hover:border-[#171717]'
                }`}
              >
                <Send size={13} />
                <span>Lapor Progres</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('history')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-black uppercase transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  modalTab === 'history'
                    ? 'bg-[#171717] text-white shadow-[2px_2px_0px_#B8A0F0]'
                    : 'bg-white text-[#171717] border border-[#171717]/30 hover:border-[#171717]'
                }`}
              >
                <History size={13} />
                <span>Riwayat Progres</span>
                {taskUpdates.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-[#FF2F92] text-white text-[9px] rounded-full font-black">
                    {taskUpdates.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setModalTab('approval')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-black uppercase transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  modalTab === 'approval'
                    ? 'bg-[#171717] text-white shadow-[2px_2px_0px_#B8A0F0]'
                    : 'bg-white text-[#171717] border border-[#171717]/30 hover:border-[#171717]'
                }`}
              >
                <ShieldCheck size={13} />
                <span>Riwayat Approval</span>
                {taskReviews.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-[#7C3AED] text-white text-[9px] rounded-full font-black">
                    {taskReviews.length}
                  </span>
                )}
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-0">
              {/* Task Title & Badges always visible */}
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${STATUS_CONFIG[selectedTask.status]?.bg || 'bg-neutral-200'}`}>
                    {STATUS_CONFIG[selectedTask.status]?.label || selectedTask.status}
                  </span>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${PRIORITY_CONFIG[selectedTask.priority]?.bg || 'bg-neutral-200'}`}>
                    Prioritas {PRIORITY_CONFIG[selectedTask.priority]?.label || selectedTask.priority}
                  </span>
                  {selectedTask.milestone && (
                    <span className="text-[9px] font-bold text-[#171717]/70 bg-white border border-[#171717]/30 px-2 py-0.5 rounded">
                      {selectedTask.milestone.title}
                    </span>
                  )}
                </div>

                <h2 className="font-display text-xl uppercase text-[#171717] leading-tight">
                  {selectedTask.title}
                </h2>
              </div>

              {/* TAB 1: OVERVIEW & CHECKLIST */}
              {modalTab === 'overview' && (
                <div className="space-y-4">
                  {selectedTask.description && (
                    <div className="p-3 bg-[#FAF7F2] rounded-md border border-[#171717]/15">
                      <span className="text-[9.5px] font-black uppercase text-[#171717]/60 block mb-1">
                        Deskripsi & Instruksi:
                      </span>
                      <p className="text-xs text-[#171717] leading-relaxed whitespace-pre-line font-medium">
                        {selectedTask.description}
                      </p>
                    </div>
                  )}

                  {/* Information Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-semibold">
                    <div className="p-2.5 bg-[#FAF7F2] rounded border border-[#171717]/15">
                      <span className="text-[9px] uppercase font-black text-[#171717]/60 block mb-0.5">Nama Proyek</span>
                      <p className="truncate font-bold text-[#171717]">{selectedTask.project?.name || '—'}</p>
                    </div>
                    <div className="p-2.5 bg-[#FAF7F2] rounded border border-[#171717]/15">
                      <span className="text-[9px] uppercase font-black text-[#171717]/60 block mb-0.5">Project Manager (PIC)</span>
                      <p className="truncate font-bold text-[#171717]">{selectedTask.project?.pic?.name || 'Project Manager'}</p>
                    </div>
                    <div className="p-2.5 bg-[#FAF7F2] rounded border border-[#171717]/15">
                      <span className="text-[9px] uppercase font-black text-[#171717]/60 block mb-0.5">Batas Waktu (Due Date)</span>
                      <p className="truncate font-bold text-[#171717]">
                        {selectedTask.deadline ? new Date(selectedTask.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar Summary */}
                  <div className="p-3.5 bg-white border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] space-y-2">
                    <div className="flex items-center justify-between text-xs font-black">
                      <span className="text-[10px] uppercase text-[#171717]/70">Capaian Progres Checklist</span>
                      <span className="font-display text-sm text-[#171717]">
                        {selectedTask.checklist_completed || 0} / {selectedTask.checklist_total || 0} Selesai ({selectedTask.checklist_progress || 0}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#EAE4D8] h-3 rounded-full overflow-hidden border border-[#171717]/30">
                      <div
                        className="h-full bg-[#10B981] transition-all duration-300"
                        style={{ width: `${selectedTask.checklist_progress || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Interactive Checklist Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase text-[#171717] flex items-center gap-1.5">
                        <ListTodo size={14} className="text-[#FF2F92]" />
                        <span>Checklist Pekerjaan Anda</span>
                      </h4>
                      <span className="text-[9.5px] font-bold text-[#171717]/60">
                        Centang item yang sudah Anda selesaikan
                      </span>
                    </div>

                    {(!selectedTask.checklists || selectedTask.checklists.length === 0) ? (
                      <p className="text-xs text-[#171717]/60 italic p-3 bg-[#FAF7F2] rounded text-center">
                        Tidak ada checklist yang ditetapkan pada tugas ini.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {(() => {
                          const isLocked = selectedTask.status === 'in_review' || selectedTask.status === 'done' || selectedTask.status === 'completed' || selectedTask.is_completed
                          return selectedTask.checklists.map((chk, index) => (
                            <div
                              key={chk.id || index}
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
                                    ? 'bg-neutral-200 border-[#171717]/40 text-[#171717]/50'
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
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isLocked && !chk.is_completed && (
                                  <span className="text-[8.5px] font-bold text-[#171717]/50 flex items-center gap-0.5">
                                    <Lock size={9} /> Terkunci
                                  </span>
                                )}
                                {chk.is_completed && (
                                  <span className="text-[9px] font-black uppercase text-[#10B981]">
                                    ✓ Tuntas
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        })()}
                      </div>
                    )}
                  </div>

                  {/* PM-H: Status Banner & Approval Actions */}
                  {/* In Review: Locked, awaiting PM decision */}
                  {selectedTask.status === 'in_review' && (
                    <div className="p-3.5 bg-[#B8A0F0]/20 border border-[#7C3AED] rounded-lg space-y-2">
                      <p className="font-black uppercase text-[#7C3AED] flex items-center gap-1.5 text-xs">
                        <Lock size={13} />
                        <span>Menunggu Review Project Manager</span>
                      </p>
                      <p className="text-[10.5px] text-[#171717]/75 leading-relaxed">
                        Pengajuan penyelesaian Anda telah diterima. Checklist dikunci sementara hingga Project Manager mengambil keputusan. Anda akan diinformasikan hasilnya.
                      </p>
                      {/* Show revision notes from latest revision_requested if any */}
                      {taskReviews.find(r => r.action === 'revision_requested') && (
                        <div className="p-2.5 bg-white rounded border border-[#FFD83D] text-xs space-y-1 mt-1">
                          <span className="text-[9.5px] font-black uppercase text-[#171717] flex items-center gap-1">
                            <AlertTriangle size={11} className="text-[#FF2F92]" />
                            <span>Catatan Revisi Terakhir dari PM:</span>
                          </span>
                          <p className="text-[#171717]/80 leading-relaxed italic">
                            {taskReviews.find(r => r.action === 'revision_requested')?.notes || '(Tidak ada catatan)'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Done: Task completed */}
                  {(selectedTask.status === 'done' || selectedTask.status === 'completed' || selectedTask.is_completed) && selectedTask.status !== 'in_review' && (
                    <div className="p-3.5 bg-[#ECFDF5] border border-[#10B981] rounded-lg space-y-1">
                      <p className="font-black uppercase text-[#065F46] flex items-center gap-1.5 text-xs">
                        <CheckCheck size={14} />
                        <span>Tugas Selesai & Disetujui!</span>
                      </p>
                      <p className="text-[10.5px] text-[#171717]/75 leading-relaxed">
                        Project Manager telah menyetujui penyelesaian tugas ini. Pekerjaan Anda sudah tercatat sebagai Done.
                      </p>
                    </div>
                  )}

                  {/* Show revision notes from last revision_requested (when status is in_progress after revision) */}
                  {selectedTask.status === 'in_progress' && taskReviews.some(r => r.action === 'revision_requested') && (
                    <div className="p-3 bg-[#FFF9E6] border border-[#FFD83D] rounded-lg text-xs space-y-1.5">
                      <p className="font-black uppercase text-[#171717] flex items-center gap-1">
                        <AlertTriangle size={12} className="text-[#FF2F92]" />
                        <span>Tugas Memerlukan Revisi</span>
                      </p>
                      <p className="text-[#171717]/80 leading-relaxed italic">
                        {taskReviews.find(r => r.action === 'revision_requested')?.notes || 'PM meminta perubahan pada tugas ini. Perbaiki sesuai instruksi.'}
                      </p>
                    </div>
                  )}

                  {/* Checklist 100% — Show Submit for Review CTA */}
                  {selectedTask.checklist_progress === 100 &&
                    selectedTask.status !== 'in_review' &&
                    selectedTask.status !== 'done' &&
                    selectedTask.status !== 'completed' &&
                    !selectedTask.is_completed && (
                    <div className="p-3.5 bg-[#ECFDF5] border border-[#10B981] rounded-lg text-xs space-y-3">
                      <div>
                        <p className="font-display uppercase text-[#065F46] flex items-center gap-1.5 mb-1">
                          <CheckCircle2 size={15} />
                          <span>Checklist 100% Selesai!</span>
                        </p>
                        <p className="text-[#065F46]/85 text-[11px] leading-relaxed">
                          Seluruh checklist telah dituntaskan. Ajukan penyelesaian tugas untuk direview oleh Project Manager.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSubmitReviewModal(true)}
                        className="w-full px-4 py-2.5 bg-[#10B981] hover:bg-[#059669] text-white border border-[#171717] rounded-lg font-black uppercase text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[2px_2px_0px_#171717] transition-all"
                      >
                        <ShieldCheck size={14} />
                        <span>Ajukan Penyelesaian Tugas</span>
                      </button>
                    </div>
                  )}

                  {/* Default info banner if checklist < 100% and not in special status */}
                  {selectedTask.checklist_progress < 100 &&
                    selectedTask.status !== 'in_review' &&
                    selectedTask.status !== 'done' &&
                    selectedTask.status !== 'completed' &&
                    !selectedTask.is_completed && (
                    <div className="p-3 bg-[#FFF0F8] border border-[#FF2F92]/40 rounded-lg text-[10.5px] text-[#171717] space-y-1">
                      <p className="font-black uppercase text-[#FF2F92] flex items-center gap-1">
                        <Info size={13} />
                        <span>Aturan Persetujuan Status Done</span>
                      </p>
                      <p className="text-[#171717]/75 leading-relaxed">
                        Penyelesaian checklist secara bertahap menghitung progres pekerjaan Anda. Status tugas akan disetujui (Done) oleh Project Manager setelah seluruh checklist selesai dan Anda mengajukan review.
                      </p>
                    </div>
                  )}

                  {/* Quick CTA to Report Tab — only if not locked */}
                  {selectedTask.status !== 'in_review' &&
                    selectedTask.status !== 'done' &&
                    selectedTask.status !== 'completed' &&
                    !selectedTask.is_completed && (
                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-[#171717]/15">
                      <span className="text-[11px] text-[#171717]/70 font-semibold">
                        Ada progres pekerjaan yang ingin dicatat?
                      </span>
                      <button
                        type="button"
                        onClick={() => setModalTab('report')}
                        className="px-3 py-1.5 bg-[#FF2F92] hover:bg-[#FF2F92]/90 text-white border border-[#171717] rounded text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#171717]"
                      >
                        <Send size={12} />
                        <span>Buat Laporan Progres</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: PROGRESS UPDATE & WORK REPORT (PM-G) */}
              {modalTab === 'report' && (
                <div className="space-y-4">
                  {/* Informative Banner */}
                  <div className="p-3 bg-[#FFF9E6] border border-[#FFD83D] rounded-lg text-xs space-y-1">
                    <p className="font-display uppercase text-[#171717] flex items-center gap-1.5">
                      <Sparkles size={14} className="text-[#FF2F92]" />
                      <span>Pencatatan Progres Pekerjaan</span>
                    </p>
                    <p className="text-[#171717]/80 text-[11px] leading-relaxed">
                      Laporan ini akan disimpan sebagai riwayat perkembangan resmi yang dapat ditinjau oleh Project Manager. Snapshot checklist selesai dan persentase progres akan disimpan otomatis dari kondisi aktual saat ini.
                    </p>
                  </div>

                  {/* Auto-captured Progress Snapshot Card */}
                  <div className="p-3 bg-white border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] uppercase font-black text-[#171717]/70">Snapshot Capaian Otomatis</span>
                      <span className="font-display text-xs text-[#065F46] bg-[#ECFDF5] border border-[#10B981] px-2 py-0.5 rounded">
                        {selectedTask.checklist_completed || 0} / {selectedTask.checklist_total || 0} Checklist Selesai ({selectedTask.checklist_progress || 0}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#EAE4D8] h-2.5 rounded-full overflow-hidden border border-[#171717]/30">
                      <div
                        className="h-full bg-[#10B981] transition-all duration-300"
                        style={{ width: `${selectedTask.checklist_progress || 0}%` }}
                      />
                    </div>
                    <p className="text-[9.5px] text-[#171717]/60 italic">
                      * Persentase diambil otomatis dari sistem, Anda tidak perlu mengisi angka progres secara manual.
                    </p>
                  </div>

                  {/* Report Form */}
                  <form onSubmit={handleSubmitReport} className="space-y-3.5">
                    {/* Deskripsi Pekerjaan (Wajib) */}
                    <div>
                      <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                        Deskripsi Pekerjaan <span className="text-[#FF2F92]">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={workDescription}
                        onChange={(e) => setWorkDescription(e.target.value)}
                        placeholder="Contoh: Menyelesaikan integrasi API login, penanganan validasi form, dan styling UI..."
                        className="pkm-input w-full text-xs font-medium"
                        required
                        disabled={submittingReport}
                      />
                      <span className="text-[9.5px] text-[#171717]/60 mt-0.5 block">
                        Jelaskan secara spesifik apa yang telah Anda tuntaskan pada tahapan ini.
                      </span>
                    </div>

                    {/* Blocker / Kendala (Opsional) */}
                    <div>
                      <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                        Kendala / Blocker <span className="text-[10px] font-normal text-[#171717]/60 normal-case">(Opsional)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={blocker}
                        onChange={(e) => setBlocker(e.target.value)}
                        placeholder="Contoh: Server staging sempat mengalami delay respons; membutuhkan review konfigurasi CORS..."
                        className="pkm-input w-full text-xs font-medium"
                        disabled={submittingReport}
                      />
                    </div>

                    {/* Rencana Berikutnya (Opsional) */}
                    <div>
                      <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                        Rencana Kerja Berikutnya <span className="text-[10px] font-normal text-[#171717]/60 normal-case">(Opsional)</span>
                      </label>
                      <input
                        type="text"
                        value={nextPlan}
                        onChange={(e) => setNextPlan(e.target.value)}
                        placeholder="Contoh: Melanjutkan pembuatan automated unit test dan integrasi auth guard..."
                        className="pkm-input w-full text-xs font-medium"
                        disabled={submittingReport}
                      />
                    </div>

                    {/* Lampiran Dokumen (Opsional) */}
                    <div>
                      <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                        Lampiran Dokumen / Screenshot <span className="text-[10px] font-normal text-[#171717]/60 normal-case">(Opsional, PDF/DOC/XLS/Gambar/ZIP, maks 10MB)</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          id="member-report-attachment"
                          onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                          className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded file:border file:border-[#171717] file:text-xs file:font-bold file:bg-[#FAF7F2] file:hover:bg-[#FFD83D] file:cursor-pointer"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
                          disabled={submittingReport}
                        />
                        {attachmentFile && (
                          <button
                            type="button"
                            onClick={() => {
                              setAttachmentFile(null)
                              const el = document.getElementById('member-report-attachment')
                              if (el) el.value = ''
                            }}
                            className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            title="Hapus file"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      {attachmentFile && (
                        <p className="text-[10px] font-bold text-[#10B981] mt-1 flex items-center gap-1">
                          <Check size={11} /> File terpilih: {attachmentFile.name} ({(attachmentFile.size / 1024).toFixed(1)} KB)
                        </p>
                      )}
                    </div>

                    {/* Submit Actions */}
                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#171717]/15">
                      <button
                        type="button"
                        onClick={() => setModalTab('overview')}
                        className="pkm-btn-outline cursor-pointer text-xs"
                        disabled={submittingReport}
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={submittingReport || !workDescription.trim()}
                        className="px-4 py-2 bg-[#FF2F92] hover:bg-[#FF2F92]/90 disabled:opacity-50 text-white font-black uppercase text-xs rounded border border-[#171717] shadow-[2px_2px_0px_#171717] flex items-center gap-2 cursor-pointer transition-all"
                      >
                        {submittingReport ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Menyimpan...</span>
                          </>
                        ) : (
                          <>
                            <Send size={13} />
                            <span>Simpan Progress Update</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 3: PROGRESS HISTORY (PM-G) */}
              {modalTab === 'history' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <h4 className="text-xs font-black uppercase text-[#171717] flex items-center gap-1.5">
                      <History size={14} className="text-[#FF2F92]" />
                      <span>Riwayat Perkembangan Pekerjaan</span>
                    </h4>
                    <span className="text-[10px] text-[#171717]/60 font-bold">
                      {taskUpdates.length} Laporan Tercatat
                    </span>
                  </div>

                  {loadingUpdates ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-[#171717]/70">
                      <Loader2 size={18} className="animate-spin text-[#FF2F92]" />
                      <span>Memuat riwayat perkembangan...</span>
                    </div>
                  ) : taskUpdates.length === 0 ? (
                    <div className="p-6 bg-[#FAF7F2] rounded-lg border border-[#171717]/20 text-center space-y-2">
                      <History size={24} className="mx-auto text-[#171717]/40" />
                      <p className="text-xs font-bold text-[#171717]">
                        Belum ada riwayat perkembangan pada tugas ini.
                      </p>
                      <p className="text-[11px] text-[#171717]/60 max-w-sm mx-auto">
                        Gunakan tab &quot;Lapor Progres&quot; untuk mencatat perkembangan pekerjaan yang telah Anda selesaikan.
                      </p>
                      <button
                        type="button"
                        onClick={() => setModalTab('report')}
                        className="mt-2 px-3 py-1.5 bg-white hover:bg-[#FFD83D] text-[#171717] border border-[#171717] rounded text-xs font-bold uppercase shadow-[1px_1px_0px_#171717] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send size={12} />
                        <span>Mulai Buat Laporan</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {taskUpdates.map((upd, idx) => (
                        <div
                          key={upd.id || idx}
                          className="p-3.5 bg-white border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] space-y-2.5 transition-all"
                        >
                          {/* Card Header: Author, Date, Snapshot */}
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#B8A0F0] border border-[#171717] text-[#171717] text-[10px] font-black flex items-center justify-center shrink-0">
                                {upd.user?.name ? upd.user.name.charAt(0).toUpperCase() : 'M'}
                              </div>
                              <div>
                                <span className="text-xs font-bold text-[#171717]">
                                  {upd.user?.name || 'Member'}
                                </span>
                                <span className="text-[9.5px] text-[#171717]/60 block">
                                  {upd.created_at
                                    ? new Date(upd.created_at).toLocaleString('id-ID', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      }) + ' WIB'
                                    : '—'}
                                </span>
                              </div>
                            </div>

                            <span className="text-[9.5px] font-black uppercase px-2 py-0.5 rounded border border-[#10B981] bg-[#ECFDF5] text-[#065F46] shrink-0">
                              Snapshot: {upd.completed_checklists || 0}/{upd.total_checklists || 0} Checklist ({upd.progress_snapshot || 0}%)
                            </span>
                          </div>

                          {/* Work Description */}
                          <div className="p-2.5 bg-[#FAF7F2] rounded border border-[#171717]/15 text-xs text-[#171717] leading-relaxed whitespace-pre-wrap font-medium">
                            {upd.work_description}
                          </div>

                          {/* Blocker if any */}
                          {upd.blocker && (
                            <div className="p-2.5 bg-[#FFF0F8] border border-[#FF2F92]/40 rounded text-xs space-y-0.5">
                              <span className="text-[9.5px] font-black uppercase text-[#FF2F92] flex items-center gap-1">
                                <AlertTriangle size={11} />
                                <span>Kendala / Blocker:</span>
                              </span>
                              <p className="text-[#171717]/85 text-[11px] leading-relaxed">
                                {upd.blocker}
                              </p>
                            </div>
                          )}

                          {/* Next Plan if any */}
                          {upd.next_plan && (
                            <div className="p-2.5 bg-[#F0FDF4] border border-[#10B981]/40 rounded text-xs space-y-0.5">
                              <span className="text-[9.5px] font-black uppercase text-[#065F46] flex items-center gap-1">
                                <CheckCircle2 size={11} />
                                <span>Rencana Kerja Berikutnya:</span>
                              </span>
                              <p className="text-[#171717]/85 text-[11px] leading-relaxed">
                                {upd.next_plan}
                              </p>
                            </div>
                          )}

                          {/* Attachment if any */}
                          {upd.has_attachment && (
                            <div className="pt-1 flex items-center justify-between border-t border-[#171717]/10">
                              <button
                                type="button"
                                onClick={() => handleDownloadAttachment(upd.id, upd.attachment_name)}
                                className="px-2.5 py-1 bg-white hover:bg-[#FFD83D] active:bg-[#FF2F92] active:text-white border border-[#171717] rounded text-[11px] font-bold text-[#171717] flex items-center gap-1.5 cursor-pointer shadow-[1px_1px_0px_#171717] transition-all"
                              >
                                <Download size={11} />
                                <span className="truncate max-w-[200px]">{upd.attachment_name || 'Unduh Lampiran'}</span>
                              </button>
                              <span className="text-[9px] text-[#171717]/50 font-bold uppercase">
                                Dokumen Privat
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: APPROVAL HISTORY (PM-H) */}
              {modalTab === 'approval' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <h4 className="text-xs font-black uppercase text-[#171717] flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-[#7C3AED]" />
                      <span>Riwayat Persetujuan Tugas</span>
                    </h4>
                    <span className="text-[10px] text-[#171717]/60 font-bold">
                      {taskReviews.length} Catatan
                    </span>
                  </div>

                  {loadingUpdates ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-[#171717]/70">
                      <Loader2 size={18} className="animate-spin text-[#7C3AED]" />
                      <span>Memuat riwayat persetujuan...</span>
                    </div>
                  ) : taskReviews.length === 0 ? (
                    <div className="p-6 bg-[#FAF7F2] rounded-lg border border-[#171717]/20 text-center space-y-2">
                      <ShieldCheck size={24} className="mx-auto text-[#171717]/30" />
                      <p className="text-xs font-bold text-[#171717]">
                        Belum ada riwayat persetujuan pada tugas ini.
                      </p>
                      <p className="text-[11px] text-[#171717]/60 max-w-sm mx-auto">
                        Setelah seluruh checklist selesai 100%, Anda dapat mengajukan penyelesaian tugas untuk direview oleh Project Manager.
                      </p>
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
                                <div className="w-6 h-6 rounded-full bg-[#B8A0F0] border border-[#171717] text-[#171717] text-[10px] font-black flex items-center justify-center shrink-0">
                                  {rev.user?.name ? rev.user.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-[#171717]">{rev.user?.name || 'User'}</span>
                                  <span className="text-[9.5px] text-[#171717]/60 block">
                                    {rev.created_at
                                      ? new Date(rev.created_at).toLocaleString('id-ID', {
                                          day: 'numeric',
                                          month: 'short',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        }) + ' WIB'
                                      : '—'}
                                  </span>
                                </div>
                              </div>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border flex items-center gap-1 shrink-0 ${cfg.badge}`}>
                                {cfg.icon}
                                <span>{cfg.label}</span>
                              </span>
                            </div>

                            {rev.notes && (
                              <div className="p-2.5 bg-white/70 rounded border border-[#171717]/15 text-xs text-[#171717] leading-relaxed whitespace-pre-wrap font-medium">
                                <span className="text-[9.5px] font-black uppercase text-[#171717]/60 block mb-0.5">
                                  Catatan / Alasan:
                                </span>
                                {rev.notes}
                              </div>
                            )}

                            <div className="text-[9.5px] text-[#171717]/50 font-bold uppercase flex items-center gap-1.5">
                              <span>Review Cycle #{rev.review_cycle}</span>
                              {rev.from_status && rev.to_status && (
                                <span>• {rev.from_status} → {rev.to_status}</span>
                              )}
                            </div>
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
              <button
                onClick={() => setShowDetailModal(false)}
                disabled={submittingReport || submittingReview}
                className="pkm-btn-outline cursor-pointer text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PM-H: SUBMIT FOR REVIEW CONFIRMATION MODAL ================= */}
      {showSubmitReviewModal && selectedTask && (
        <div
          className="fixed inset-0 bg-[#171717]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[60] animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submittingReview) setShowSubmitReviewModal(false)
          }}
        >
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#10B981] w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#ECFDF5] border border-[#10B981] flex items-center justify-center shrink-0">
                <ShieldCheck size={18} className="text-[#10B981]" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="font-display text-lg uppercase text-[#171717]">AJUKAN REVIEW TUGAS</h3>
                <p className="text-[10px] text-[#171717]/60 font-bold uppercase">Konfirmasi Penyelesaian Tugas</p>
              </div>
            </div>

            <p className="text-xs text-[#171717]/80 leading-relaxed">
              Anda akan mengajukan penyelesaian tugas <strong>&quot;{selectedTask.title}&quot;</strong> untuk ditinjau oleh Project Manager.
            </p>

            <div className="p-3 bg-[#FAF7F2] rounded-lg border border-[#171717]/20 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#171717]">Checklist Selesai:</span>
                <span className="font-black text-[#10B981]">{selectedTask.checklist_completed}/{selectedTask.checklist_total} (100%)</span>
              </div>
              <p className="text-[10.5px] text-[#171717]/60 leading-tight">
                * Setelah diajukan, status berubah menjadi <strong>In Review</strong> dan checklist terkunci hingga PM memberikan keputusan.
              </p>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                Catatan Pengajuan <span className="text-[10px] font-normal text-[#171717]/60 normal-case">(Opsional)</span>
              </label>
              <textarea
                rows={2}
                value={submissionNotes}
                onChange={(e) => setSubmissionNotes(e.target.value)}
                placeholder="Tambahkan catatan khusus untuk PM jika diperlukan..."
                className="pkm-input w-full text-xs font-medium"
                disabled={submittingReview}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#171717]/15">
              <button
                type="button"
                onClick={() => setShowSubmitReviewModal(false)}
                disabled={submittingReview}
                className="pkm-btn-outline cursor-pointer text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmitReview}
                disabled={submittingReview}
                className="px-4 py-2 bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-white font-black uppercase text-xs rounded border border-[#171717] shadow-[2px_2px_0px_#171717] flex items-center gap-2 cursor-pointer transition-all"
              >
                {submittingReview ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Mengajukan...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={13} />
                    <span>Ya, Ajukan Penyelesaian</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
