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
  Info
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

  // Open Detail Modal & fetch latest detail
  const handleOpenDetail = async (task) => {
    setSelectedTask(task)
    setShowDetailModal(true)
    try {
      const res = await api.get(`/tasks/${task.id}`)
      setSelectedTask(res.data.task)
    } catch {
      // Keep existing object if error
    }
  }

  // Toggle checklist item
  const handleToggleChecklist = async (checklistId) => {
    if (togglingChecklistId) return
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

      {/* ================= 6. MODAL TASK DETAIL & INTERACTIVE CHECKLIST ================= */}
      {showDetailModal && selectedTask && (
        <div
          className="fixed inset-0 bg-[#171717]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDetailModal(false)
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
                className="p-1.5 hover:bg-[#FFD83D] border border-[#171717] rounded-md cursor-pointer transition-colors"
                title="Tutup (Esc)"
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-0">
              {/* Task Title & Badges */}
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

                {selectedTask.description && (
                  <div className="mt-2.5 p-3 bg-[#FAF7F2] rounded-md border border-[#171717]/15">
                    <span className="text-[9.5px] font-black uppercase text-[#171717]/60 block mb-1">
                      Deskripsi & Instruksi:
                    </span>
                    <p className="text-xs text-[#171717] leading-relaxed whitespace-pre-line font-medium">
                      {selectedTask.description}
                    </p>
                  </div>
                )}
              </div>

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
                    {selectedTask.checklists.map((chk, index) => (
                      <div
                        key={chk.id || index}
                        onClick={() => handleToggleChecklist(chk.id)}
                        className={`p-3 rounded-lg border-1.5 transition-all cursor-pointer flex items-center justify-between gap-3 min-h-[44px] ${
                          chk.is_completed
                            ? 'bg-[#ECFDF5] border-[#10B981] text-[#065F46] shadow-[1px_1px_0px_#10B981]'
                            : 'bg-[#FAF7F2] border-[#171717]/30 hover:border-[#FF2F92] text-[#171717] hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-5 h-5 rounded border-1.5 flex items-center justify-center shrink-0 transition-colors ${
                            chk.is_completed
                              ? 'bg-[#10B981] border-[#10B981] text-white'
                              : 'bg-white border-[#171717]'
                          }`}>
                            {togglingChecklistId === chk.id ? (
                              <Loader2 size={11} className="animate-spin text-[#171717]" />
                            ) : chk.is_completed ? (
                              <Check size={13} strokeWidth={3} />
                            ) : null}
                          </div>
                          <span className={`text-xs font-bold leading-snug ${chk.is_completed ? 'line-through opacity-75' : ''}`}>
                            {chk.title}
                          </span>
                        </div>
                        {chk.is_completed && (
                          <span className="text-[9px] font-black uppercase text-[#10B981] shrink-0">
                            ✓ Tuntas
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Informative Rule & Status Banner */}
              {selectedTask.checklist_progress === 100 ? (
                <div className="p-3.5 bg-[#ECFDF5] border border-[#10B981] rounded-lg text-xs space-y-1">
                  <p className="font-display uppercase text-[#065F46] flex items-center gap-1.5">
                    <CheckCircle2 size={15} />
                    <span>Checklist 100% Selesai!</span>
                  </p>
                  <p className="text-[#065F46]/85 text-[11px] leading-relaxed">
                    Seluruh item checklist telah Anda tuntaskan. Status tugas saat ini menunggu tahapan review dan persetujuan akhir dari Project Manager.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-[#FFF0F8] border border-[#FF2F92]/40 rounded-lg text-[10.5px] text-[#171717] space-y-1">
                  <p className="font-black uppercase text-[#FF2F92] flex items-center gap-1">
                    <Info size={13} />
                    <span>Aturan Persetujuan Status Done</span>
                  </p>
                  <p className="text-[#171717]/75 leading-relaxed">
                    Penyelesaian checklist secara bertahap menghitung progres pekerjaan Anda. Status tugas akan disetujui (Done) oleh Project Manager setelah pekerjaan ditinjau.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-5 py-3 border-t-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
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
