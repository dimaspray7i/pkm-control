import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Loader2,
  Calendar,
  User,
  Folder,
  Flag,
  X,
  Edit3,
  Trash2,
  Eye,
  Check,
  AlertCircle,
  Users,
  ChevronRight,
  ListTodo,
  Layers,
  Sparkles,
  History,
  Download,
  FileText,
  ShieldCheck,
  ThumbsUp,
  MessageSquareWarning,
  RefreshCw
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', bg: 'bg-[#FF2F92] text-white border-[#171717]' },
  high:   { label: 'High',   bg: 'bg-[#FF5722] text-white border-[#171717]' },
  medium: { label: 'Medium', bg: 'bg-[#FFD83D] text-[#171717] border-[#171717]' },
  low:    { label: 'Low',    bg: 'bg-[#B8A0F0] text-[#171717] border-[#171717]' },
}

const STATUS_CONFIG = {
  todo:        { label: 'To-do',       bg: 'bg-[#FAF7F2] text-[#171717] border-[#171717]' },
  pending:     { label: 'To-do',       bg: 'bg-[#FAF7F2] text-[#171717] border-[#171717]' },
  in_progress: { label: 'In Progress', bg: 'bg-[#FFD83D] text-[#171717] border-[#171717]' },
  in_review:   { label: 'In Review',   bg: 'bg-[#B8A0F0] text-[#171717] border-[#171717]' },
  completed:   { label: 'Done',        bg: 'bg-[#10B981] text-white border-[#171717]' },
  done:        { label: 'Done',        bg: 'bg-[#10B981] text-white border-[#171717]' },
}

export default function PmTaskDistributionBoard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [tasks, setTasks] = useState([])
  const [summary, setSummary] = useState({
    total: 0,
    todo: 0,
    in_progress: 0,
    in_review: 0,
    done: 0,
    overdue: 0,
    unassigned: 0,
  })
  const [projects, setProjects] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters state
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [projectFilter, setProjectFilter] = useState(searchParams.get('project_id') || 'all')
  const [memberFilter, setMemberFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [deadlineFilter, setDeadlineFilter] = useState('all')

  // Feedback notifications
  const [feedback, setFeedback] = useState(null)

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [quickAssignLoading, setQuickAssignLoading] = useState(null)

  // Progress Updates History State (PM-G)
  const [detailTab, setDetailTab] = useState('overview') // 'overview' | 'history' | 'approval'
  const [taskUpdates, setTaskUpdates] = useState([])
  const [loadingUpdates, setLoadingUpdates] = useState(false)

  // Approval Workflow State (PM-H)
  const [taskReviews, setTaskReviews] = useState([])
  const [pendingReviewCount, setPendingReviewCount] = useState(0)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [showReopenModal, setShowReopenModal] = useState(false)
  const [approveNotes, setApproveNotes] = useState('')
  const [revisionReason, setRevisionReason] = useState('')
  const [reopenReason, setReopenReason] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  // Project Milestones for Form
  const [projectMilestones, setProjectMilestones] = useState([])
  const [loadingMilestones, setLoadingMilestones] = useState(false)

  // Create / Edit Form State
  const initialForm = {
    title: '',
    project_id: '',
    description: '',
    assignee_id: '',
    priority: 'medium',
    status: 'pending',
    start_date: '',
    deadline: '',
    milestone_id: '',
    checklists: [{ id: null, title: '', is_completed: false }],
  }
  const [formData, setFormData] = useState(initialForm)
  const [newChecklistInput, setNewChecklistInput] = useState('')

  const showNotification = (type, message) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  // Load Milestones when project_id changes
  const loadMilestones = async (projId) => {
    if (!projId) {
      setProjectMilestones([])
      return
    }
    try {
      setLoadingMilestones(true)
      const res = await api.get(`/projects/${projId}/milestones`)
      setProjectMilestones(res.data.data || res.data.milestones || [])
    } catch {
      setProjectMilestones([])
    } finally {
      setLoadingMilestones(false)
    }
  }

  // Fetch initial tasks, projects, and members
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [resTasks, resProjects, resUsers] = await Promise.all([
        api.get('/tasks'),
        api.get('/projects'),
        api.get('/users?role=member').catch(() => ({ data: { users: [] } })),
      ])

      const taskList = resTasks.data.tasks || []
      setTasks(taskList)
      if (resTasks.data.summary) {
        setSummary(resTasks.data.summary)
      } else {
        // Fallback summary calculation
        const todayStr = new Date().toISOString().split('T')[0]
        setSummary({
          total: taskList.length,
          todo: taskList.filter(t => !t.is_completed && (t.status === 'pending' || t.status === 'todo')).length,
          in_progress: taskList.filter(t => !t.is_completed && t.status === 'in_progress').length,
          in_review: taskList.filter(t => !t.is_completed && t.status === 'in_review').length,
          done: taskList.filter(t => t.is_completed || t.status === 'completed' || t.status === 'done').length,
          overdue: taskList.filter(t => !t.is_completed && t.deadline && t.deadline < todayStr).length,
          unassigned: taskList.filter(t => !t.is_completed && !t.assignee_id).length,
        })
      }

      setProjects(resProjects.data.projects || [])
      // Filter only members
      const allUsers = resUsers.data.users || []
      const memberList = allUsers.filter(u => u.role === 'member')
      setMembers(memberList)
    } catch (err) {
      console.error('Failed to load task board:', err)
      setError('Gagal memuat papan distribusi tugas dari backend.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    fetchPendingReviewCount()
  }, [])

  // Handle Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showCreateModal) setShowCreateModal(false)
        if (showEditModal) setShowEditModal(false)
        if (showDetailModal) setShowDetailModal(false)
        if (showDeleteModal) setShowDeleteModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showCreateModal, showEditModal, showDetailModal, showDeleteModal])

  // Reset Filters
  const handleResetFilters = () => {
    setSearch('')
    setProjectFilter('all')
    setMemberFilter('all')
    setStatusFilter('all')
    setPriorityFilter('all')
    setDeadlineFilter('all')
  }

  // Filter tasks client-side
  const filteredTasks = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    const endOfWeek = new Date()
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()))
    const endOfWeekStr = endOfWeek.toISOString().split('T')[0]

    return tasks.filter((t) => {
      // Search
      const searchLower = search.toLowerCase()
      const matchSearch =
        !search ||
        t.title.toLowerCase().includes(searchLower) ||
        (t.description || '').toLowerCase().includes(searchLower) ||
        (t.assignee_name || '').toLowerCase().includes(searchLower) ||
        (t.project?.name || '').toLowerCase().includes(searchLower) ||
        (t.project?.code || '').toLowerCase().includes(searchLower)

      // Project filter
      const matchProject = projectFilter === 'all' || String(t.project_id) === String(projectFilter)

      // Member filter
      const matchMember =
        memberFilter === 'all' ? true :
        memberFilter === 'unassigned' ? !t.assignee_id :
        String(t.assignee_id) === String(memberFilter)

      // Status filter
      const matchStatus =
        statusFilter === 'all' ? true :
        statusFilter === 'todo' ? (!t.is_completed && (t.status === 'pending' || t.status === 'todo')) :
        statusFilter === 'in_progress' ? (!t.is_completed && t.status === 'in_progress') :
        statusFilter === 'in_review' ? (!t.is_completed && t.status === 'in_review') :
        statusFilter === 'done' ? (t.is_completed || t.status === 'completed' || t.status === 'done') :
        statusFilter === 'overdue' ? (!t.is_completed && t.deadline && t.deadline < todayStr) :
        statusFilter === 'unassigned' ? (!t.is_completed && !t.assignee_id) : true

      // Priority filter
      const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter

      // Deadline filter
      const matchDeadline =
        deadlineFilter === 'all' ? true :
        deadlineFilter === 'today' ? t.deadline === todayStr :
        deadlineFilter === 'this_week' ? (t.deadline && t.deadline >= todayStr && t.deadline <= endOfWeekStr) :
        deadlineFilter === 'overdue' ? (!t.is_completed && t.deadline && t.deadline < todayStr) : true

      return matchSearch && matchProject && matchMember && matchStatus && matchPriority && matchDeadline
    })
  }, [tasks, search, projectFilter, memberFilter, statusFilter, priorityFilter, deadlineFilter])

  // Open Create Modal
  const handleOpenCreate = () => {
    const defaultProjId = projects.length > 0 ? String(projects[0].id) : ''
    setFormData({
      title: '',
      project_id: defaultProjId,
      description: '',
      assignee_id: members.length > 0 ? String(members[0].id) : '',
      priority: 'medium',
      status: 'pending',
      start_date: '',
      deadline: '',
      milestone_id: '',
      checklists: [
        { id: null, title: 'Analisis dan perencanaan awal', is_completed: false },
        { id: null, title: 'Implementasi pengerjaan teknis', is_completed: false },
      ],
    })
    setNewChecklistInput('')
    setFormErrors({})
    setShowCreateModal(true)
    if (defaultProjId) {
      loadMilestones(defaultProjId)
    }
  }

  // Open Edit Modal
  const handleOpenEdit = (task) => {
    setSelectedTask(task)
    const taskChecklists = task.checklists && task.checklists.length > 0
      ? task.checklists.map(c => ({ id: c.id, title: c.title, is_completed: c.is_completed }))
      : [{ id: null, title: 'Checklist 1', is_completed: false }]

    setFormData({
      title: task.title || '',
      project_id: String(task.project_id),
      description: task.description || '',
      assignee_id: task.assignee_id ? String(task.assignee_id) : '',
      priority: task.priority || 'medium',
      status: task.status || (task.is_completed ? 'completed' : 'pending'),
      start_date: task.start_date ? task.start_date.substring(0, 10) : '',
      deadline: task.deadline ? task.deadline.substring(0, 10) : '',
      milestone_id: task.milestone_id ? String(task.milestone_id) : '',
      checklists: taskChecklists,
    })
    setNewChecklistInput('')
    setFormErrors({})
    setShowEditModal(true)
    loadMilestones(task.project_id)
  }

  // Open Detail Modal & load Progress History (PM-G) + Reviews (PM-H)
  const handleOpenDetail = async (task) => {
    setSelectedTask(task)
    setShowDetailModal(true)
    setDetailTab('overview')
    setTaskUpdates([])
    setTaskReviews([])
    setLoadingUpdates(true)

    try {
      const [detailRes, updatesRes, reviewsRes] = await Promise.allSettled([
        api.get(`/tasks/${task.id}`),
        api.get(`/tasks/${task.id}/updates`),
        api.get(`/tasks/${task.id}/reviews`),
      ])
      if (detailRes.status === 'fulfilled' && detailRes.value?.data?.task) {
        setSelectedTask(detailRes.value.data.task)
      }
      if (updatesRes.status === 'fulfilled' && updatesRes.value?.data?.updates) {
        setTaskUpdates(updatesRes.value.data.updates)
      }
      if (reviewsRes.status === 'fulfilled' && reviewsRes.value?.data?.reviews) {
        setTaskReviews(reviewsRes.value.data.reviews)
      }
    } catch {
      // Keep existing task object if show endpoint fails
    } finally {
      setLoadingUpdates(false)
    }
  }

  // Fetch pending review count on mount (PM-H)
  const fetchPendingReviewCount = async () => {
    try {
      const res = await api.get('/tasks/pending-review')
      setPendingReviewCount(res.data.count ?? res.data.tasks?.length ?? 0)
    } catch {
      // non-critical, ignore
    }
  }

  // Handle Approve (PM-H)
  const handleApprove = async () => {
    if (!selectedTask || submittingReview) return
    setSubmittingReview(true)
    try {
      const res = await api.post(`/tasks/${selectedTask.id}/approve`, {
        notes: approveNotes.trim() || undefined,
      })
      const updatedTask = res.data.task
      const newReview = res.data.review
      setSelectedTask(prev => ({ ...prev, ...updatedTask }))
      setTaskReviews(prev => [newReview, ...prev])
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, ...updatedTask } : t))
      setShowApproveConfirm(false)
      setApproveNotes('')
      fetchData()
      fetchPendingReviewCount()
      showNotification('success', `Tugas "${updatedTask.title}" berhasil disetujui dan ditandai Done!`)
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Gagal menyetujui tugas.')
    } finally {
      setSubmittingReview(false)
    }
  }

  // Handle Request Revision (PM-H)
  const handleRequestRevision = async () => {
    if (!selectedTask || submittingReview || !revisionReason.trim()) return
    setSubmittingReview(true)
    try {
      const res = await api.post(`/tasks/${selectedTask.id}/request-revision`, {
        reason: revisionReason.trim(),
      })
      const updatedTask = res.data.task
      const newReview = res.data.review
      setSelectedTask(prev => ({ ...prev, ...updatedTask }))
      setTaskReviews(prev => [newReview, ...prev])
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, ...updatedTask } : t))
      setShowRevisionModal(false)
      setRevisionReason('')
      fetchData()
      fetchPendingReviewCount()
      showNotification('success', 'Tugas dikembalikan ke Member untuk revisi.')
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Gagal meminta revisi.')
    } finally {
      setSubmittingReview(false)
    }
  }

  // Handle Reopen (PM-H)
  const handleReopen = async () => {
    if (!selectedTask || submittingReview || !reopenReason.trim()) return
    setSubmittingReview(true)
    try {
      const res = await api.post(`/tasks/${selectedTask.id}/reopen`, {
        reason: reopenReason.trim(),
      })
      const updatedTask = res.data.task
      const newReview = res.data.review
      setSelectedTask(prev => ({ ...prev, ...updatedTask }))
      setTaskReviews(prev => [newReview, ...prev])
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, ...updatedTask } : t))
      setShowReopenModal(false)
      setReopenReason('')
      fetchData()
      fetchPendingReviewCount()
      showNotification('success', 'Tugas berhasil dibuka kembali untuk pengerjaan ulang.')
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Gagal membuka kembali tugas.')
    } finally {
      setSubmittingReview(false)
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

  // Open Delete Modal
  const handleOpenDelete = (task) => {
    setSelectedTask(task)
    setShowDeleteModal(true)
  }

  // Checklist Helpers
  const handleAddChecklist = () => {
    if (!newChecklistInput.trim()) return
    setFormData(prev => ({
      ...prev,
      checklists: [...prev.checklists, { id: null, title: newChecklistInput.trim(), is_completed: false }],
    }))
    setNewChecklistInput('')
  }

  const handleRemoveChecklist = (index) => {
    setFormData(prev => ({
      ...prev,
      checklists: prev.checklists.filter((_, idx) => idx !== index),
    }))
  }

  const handleUpdateChecklistTitle = (index, newTitle) => {
    setFormData(prev => ({
      ...prev,
      checklists: prev.checklists.map((c, idx) => idx === index ? { ...c, title: newTitle } : c),
    }))
  }

  // Quick Assign Member directly from Board
  const handleQuickAssign = async (taskId, newAssigneeId) => {
    if (!newAssigneeId) return
    setQuickAssignLoading(taskId)
    try {
      const res = await api.patch(`/tasks/${taskId}/assign`, { assignee_id: Number(newAssigneeId) })
      const updated = res.data.task
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updated } : t))
      showNotification('success', `Tugas "${updated.title}" berhasil ditugaskan ke ${updated.assignee_name}!`)
      // Refresh summary
      fetchData()
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Gagal mengubah penanggung jawab tugas.')
    } finally {
      setQuickAssignLoading(null)
    }
  }

  // Toggle Checklist in Detail Modal
  const handleToggleChecklist = async (checklistId) => {
    if (selectedTask?.status === 'in_review') {
      showNotification('error', 'Checklist terkunci selama tugas dalam proses review.')
      return
    }
    if (selectedTask?.status === 'done' || selectedTask?.status === 'completed' || selectedTask?.is_completed) {
      showNotification('error', 'Checklist terkunci karena tugas telah disetujui selesai (Done). Buka kembali tugas jika ingin mengubah.')
      return
    }

    try {
      const res = await api.post(`/checklists/${checklistId}/toggle`)
      const updatedChk = res.data.checklist
      const updatedStats = res.data.stats

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

      // Update in main tasks list
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
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Gagal memperbarui status checklist.')
    }
  }

  // Submit Create Task
  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return

    // Client-side checklist validation
    const validChecklists = formData.checklists.filter(c => c.title.trim() !== '')
    if (validChecklists.length === 0) {
      setFormErrors({ checklists: ['Minimal satu item checklist wajib dibuat sebelum tugas disimpan.'] })
      return
    }

    setSubmitting(true)
    setFormErrors({})

    try {
      const payload = {
        title: formData.title.trim(),
        project_id: Number(formData.project_id),
        description: formData.description.trim(),
        assignee_id: Number(formData.assignee_id),
        priority: formData.priority,
        status: 'pending',
        start_date: formData.start_date || null,
        deadline: formData.deadline,
        milestone_id: formData.milestone_id ? Number(formData.milestone_id) : null,
        checklists: validChecklists.map((c, idx) => ({ title: c.title.trim(), position: idx + 1 })),
      }

      const res = await api.post('/tasks', payload)
      showNotification('success', res.data.message || 'Tugas baru berhasil didistribusikan ke Member!')
      setShowCreateModal(false)
      fetchData()
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        setFormErrors(err.response.data.errors)
      } else {
        showNotification('error', err.response?.data?.message || 'Gagal menyimpan tugas baru.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Submit Edit Task
  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (submitting || !selectedTask) return

    const validChecklists = formData.checklists.filter(c => c.title.trim() !== '')
    if (validChecklists.length === 0) {
      setFormErrors({ checklists: ['Minimal satu item checklist wajib tersedia pada tugas.'] })
      return
    }

    setSubmitting(true)
    setFormErrors({})

    try {
      const payload = {
        title: formData.title.trim(),
        project_id: Number(formData.project_id),
        description: formData.description.trim(),
        assignee_id: formData.assignee_id ? Number(formData.assignee_id) : null,
        priority: formData.priority,
        status: formData.status,
        start_date: formData.start_date || null,
        deadline: formData.deadline || null,
        milestone_id: formData.milestone_id ? Number(formData.milestone_id) : null,
        checklists: validChecklists.map((c, idx) => ({ id: c.id, title: c.title.trim(), position: idx + 1 })),
      }

      const res = await api.put(`/tasks/${selectedTask.id}`, payload)
      showNotification('success', res.data.message || 'Data tugas berhasil diperbarui!')
      setShowEditModal(false)
      fetchData()
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        setFormErrors(err.response.data.errors)
      } else {
        showNotification('error', err.response?.data?.message || 'Gagal memperbarui tugas.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Submit Delete Task
  const handleDeleteSubmit = async () => {
    if (submitting || !selectedTask) return
    setSubmitting(true)

    try {
      const res = await api.delete(`/tasks/${selectedTask.id}`)
      showNotification('success', res.data.message || 'Tugas berhasil dihapus.')
      setShowDeleteModal(false)
      fetchData()
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Gagal menghapus tugas.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[45vh] gap-3">
        <Loader2 size={32} className="animate-spin text-[#FF2F92]" />
        <p className="font-display text-lg uppercase tracking-wider text-[#171717]">
          MEMUAT TASK DISTRIBUTION BOARD...
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
          onClick={fetchData}
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
        title="TASK DISTRIBUTION BOARD"
        subtitle="Kelola, distribusikan, dan pantau progres pengerjaan tugas proyek kepada Member secara real-time."
        tag="PROJECT MANAGER WORKSPACE"
        actions={
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <button
              onClick={handleOpenCreate}
              className="pkm-btn-pink min-h-[38px] flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#171717]"
            >
              <Plus size={15} strokeWidth={3} />
              <span>Create Task</span>
            </button>
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

      {/* ================= 3. TASK SUMMARY METRICS ================= */}
      {pendingReviewCount > 0 && (
        <div className="p-3 bg-[#B8A0F0]/20 border-1.5 border-[#7C3AED] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#7C3AED] shrink-0" />
            <div>
              <p className="text-xs font-black uppercase text-[#171717]">
                {pendingReviewCount} Tugas Menunggu Review Anda
              </p>
              <p className="text-[10px] text-[#171717]/70 font-semibold">
                Member telah mengajukan penyelesaian tugas. Tinjau dan berikan persetujuan atau minta revisi.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setStatusFilter('in_review')
              setMemberFilter('all')
            }}
            className="px-3 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-black uppercase rounded border border-[#171717] shadow-[2px_2px_0px_#171717] cursor-pointer shrink-0 flex items-center gap-1.5 transition-all"
          >
            <ShieldCheck size={12} />
            <span>Review Sekarang</span>
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {[
          { id: 'all',        label: 'Total Tasks',  value: summary.total,       bg: 'bg-white',       accent: 'text-[#171717]' },
          { id: 'todo',       label: 'To-do',        value: summary.todo,        bg: 'bg-[#FAF7F2]',   accent: 'text-[#171717]' },
          { id: 'in_progress',label: 'In Progress',  value: summary.in_progress, bg: 'bg-[#FFD83D]/30',accent: 'text-[#171717]' },
          { id: 'in_review',  label: 'In Review',    value: summary.in_review,   bg: pendingReviewCount > 0 ? 'bg-[#B8A0F0]' : 'bg-[#B8A0F0]/30', accent: 'text-[#171717]' },
          { id: 'done',       label: 'Done',         value: summary.done,        bg: 'bg-[#ECFDF5]',   accent: 'text-[#065F46]' },
          { id: 'overdue',    label: 'Overdue',      value: summary.overdue,     bg: summary.overdue > 0 ? 'bg-[#FF2F92]' : 'bg-white', accent: summary.overdue > 0 ? 'text-white' : 'text-[#FF2F92]' },
          { id: 'unassigned', label: 'Unassigned',   value: summary.unassigned,  bg: summary.unassigned > 0 ? 'bg-[#FFD83D]' : 'bg-white', accent: 'text-[#171717]' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === 'all') {
                setStatusFilter('all')
                setMemberFilter('all')
              } else if (item.id === 'unassigned') {
                setMemberFilter('unassigned')
                setStatusFilter('all')
              } else {
                setStatusFilter(item.id)
                setMemberFilter('all')
              }
            }}
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

      {/* ================= 4. TOOLBAR & MULTI-FILTER ================= */}
      <div className="bg-white p-3.5 sm:p-4 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] space-y-3">
        {/* Top Row: Search + Project Filter */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#171717]/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama tugas, deskripsi, member, proyek..."
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

          {/* Quick Clear Filter Button */}
          {(search || projectFilter !== 'all' || memberFilter !== 'all' || statusFilter !== 'all' || priorityFilter !== 'all' || deadlineFilter !== 'all') && (
            <button
              onClick={handleResetFilters}
              className="px-3 py-1.5 text-[11px] font-bold text-[#FF2F92] hover:bg-pink-50 border border-[#FF2F92]/40 rounded-md transition-colors cursor-pointer min-h-[36px] flex items-center justify-center gap-1.5 shrink-0"
            >
              <RotateCcw size={12} />
              <span>Reset Seluruh Filter</span>
            </button>
          )}
        </div>

        {/* Bottom Row: Dropdown Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1 border-t border-[#171717]/10">
          {/* Project Filter */}
          <div>
            <label className="block text-[9px] font-black uppercase text-[#171717]/60 mb-0.5">Filter Proyek</label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full p-2 bg-[#FAF7F2] border border-[#171717]/40 rounded text-[11px] font-bold text-[#171717] min-h-[34px]"
            >
              <option value="all">Semua Proyek ({projects.length})</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Member Filter */}
          <div>
            <label className="block text-[9px] font-black uppercase text-[#171717]/60 mb-0.5">Filter Member</label>
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="w-full p-2 bg-[#FAF7F2] border border-[#171717]/40 rounded text-[11px] font-bold text-[#171717] min-h-[34px]"
            >
              <option value="all">Semua Member ({members.length})</option>
              <option value="unassigned">⚠️ Belum Ada Assignee</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[9px] font-black uppercase text-[#171717]/60 mb-0.5">Filter Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2 bg-[#FAF7F2] border border-[#171717]/40 rounded text-[11px] font-bold text-[#171717] min-h-[34px]"
            >
              <option value="all">Semua Status</option>
              <option value="todo">To-do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="done">Done / Completed</option>
              <option value="overdue">Overdue Saja</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-[9px] font-black uppercase text-[#171717]/60 mb-0.5">Filter Prioritas</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full p-2 bg-[#FAF7F2] border border-[#171717]/40 rounded text-[11px] font-bold text-[#171717] min-h-[34px]"
            >
              <option value="all">Semua Prioritas</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Deadline Filter */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[9px] font-black uppercase text-[#171717]/60 mb-0.5">Filter Deadline</label>
            <select
              value={deadlineFilter}
              onChange={(e) => setDeadlineFilter(e.target.value)}
              className="w-full p-2 bg-[#FAF7F2] border border-[#171717]/40 rounded text-[11px] font-bold text-[#171717] min-h-[34px]"
            >
              <option value="all">Semua Deadline</option>
              <option value="today">Deadline Hari Ini</option>
              <option value="this_week">Deadline Minggu Ini</option>
              <option value="overdue">Sudah Terlewat (Overdue)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ================= 5. TASK LIST (TABLE DESKTOP + CARDS MOBILE) ================= */}
      {filteredTasks.length === 0 ? (
        <div className="p-8 sm:p-12 bg-white border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] text-center space-y-3">
          <CheckSquare size={36} className="mx-auto text-[#171717]/40" />
          <h3 className="font-display text-xl uppercase text-[#171717]">Tidak Ada Tugas Ditemukan</h3>
          <p className="text-xs font-semibold text-[#171717]/65 max-w-sm mx-auto leading-relaxed">
            Tidak ditemukan tugas yang cocok dengan filter atau kata kunci yang dipilih.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={handleResetFilters}
              className="pkm-btn-outline inline-flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <RotateCcw size={13} />
              <span>Reset Filter</span>
            </button>
            <button
              onClick={handleOpenCreate}
              className="pkm-btn-pink inline-flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <Plus size={14} strokeWidth={3} />
              <span>Create Task Baru</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Desktop Table View (Hidden on mobile) */}
          <div className="hidden lg:block bg-white border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF7F2] border-b-1.5 border-[#171717] text-[10px] font-black uppercase text-[#171717]">
                    <th className="py-3 px-3.5">Tugas & Proyek</th>
                    <th className="py-3 px-3 w-48">Penanggung Jawab (Member)</th>
                    <th className="py-3 px-2.5 text-center w-24">Prioritas</th>
                    <th className="py-3 px-2.5 text-center w-28">Status</th>
                    <th className="py-3 px-3 text-center w-28">Deadline</th>
                    <th className="py-3 px-3 w-36">Checklist & Progres</th>
                    <th className="py-3 px-3 text-right w-28">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171717]/15">
                  {filteredTasks.map((t) => {
                    const todayStr = new Date().toISOString().split('T')[0]
                    const isOverdue = !t.is_completed && t.deadline && t.deadline < todayStr
                    const priorityCfg = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.medium
                    const statusCfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.todo

                    return (
                      <tr key={t.id} className="hover:bg-[#FFFDF9] transition-colors">
                        {/* Task Title & Project */}
                        <td className="py-3 px-3.5 align-middle">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-[#FAF7F2] border border-[#171717] rounded shrink-0">
                              {t.project?.code || 'PRJ'}
                            </span>
                            <span
                              onClick={() => handleOpenDetail(t)}
                              className="font-bold text-xs text-[#171717] hover:text-[#FF2F92] cursor-pointer truncate max-w-xs"
                              title={t.title}
                            >
                              {t.title}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#171717]/60 mt-0.5 truncate max-w-sm">
                            {t.project?.name} {t.milestone ? `• ${t.milestone.title}` : ''}
                          </p>
                        </td>

                        {/* Quick Assign Dropdown */}
                        <td className="py-3 px-3 align-middle">
                          <div className="flex items-center gap-1.5">
                            <select
                              value={t.assignee_id || ''}
                              onChange={(e) => handleQuickAssign(t.id, e.target.value)}
                              disabled={quickAssignLoading === t.id}
                              className={`w-full p-1.5 bg-white border border-[#171717]/40 rounded text-[11px] font-semibold focus:outline-none focus:border-[#FF2F92] ${
                                !t.assignee_id ? 'text-[#FF2F92] font-black border-[#FF2F92]' : 'text-[#171717]'
                              }`}
                            >
                              <option value="">-- Belum Ditugaskan --</option>
                              {members.map(m => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                            {quickAssignLoading === t.id && (
                              <Loader2 size={13} className="animate-spin text-[#FF2F92] shrink-0" />
                            )}
                          </div>
                        </td>

                        {/* Priority Badge */}
                        <td className="py-3 px-2.5 text-center align-middle">
                          <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded border ${priorityCfg.bg}`}>
                            {priorityCfg.label}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-2.5 text-center align-middle">
                          <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded border ${statusCfg.bg}`}>
                            {statusCfg.label}
                          </span>
                        </td>

                        {/* Deadline */}
                        <td className="py-3 px-3 text-center align-middle">
                          <span className={`text-[10.5px] font-bold ${isOverdue ? 'text-[#FF2F92] font-black' : 'text-[#171717]'}`}>
                            {t.deadline ? new Date(t.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—'}
                          </span>
                          {isOverdue && (
                            <span className="block text-[8px] font-black uppercase text-[#FF2F92]">OVERDUE</span>
                          )}
                        </td>

                        {/* Checklist Progress */}
                        <td className="py-3 px-3 align-middle">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-bold">
                              <span>Checklist</span>
                              <span className="font-mono text-[#171717]">
                                {t.checklist_completed || 0}/{t.checklist_total || 0} ({t.checklist_progress || 0}%)
                              </span>
                            </div>
                            <div className="w-full bg-[#EAE4D8] h-2 rounded-full overflow-hidden border border-[#171717]/20">
                              <div
                                className="h-full bg-[#10B981] transition-all duration-300"
                                style={{ width: `${t.checklist_progress || 0}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-right align-middle">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenDetail(t)}
                              className="p-1.5 hover:bg-[#FAF7F2] border border-[#171717]/30 hover:border-[#171717] rounded text-[#171717] cursor-pointer transition-colors"
                              title="Lihat Detail Tugas & Checklist"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(t)}
                              className="p-1.5 hover:bg-[#FFD83D] border border-[#171717]/30 hover:border-[#171717] rounded text-[#171717] cursor-pointer transition-colors"
                              title="Edit Tugas"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => handleOpenDelete(t)}
                              className="p-1.5 hover:bg-[#FF2F92] hover:text-white border border-[#171717]/30 hover:border-[#171717] rounded text-[#171717] cursor-pointer transition-colors"
                              title="Hapus Tugas"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (Shown on screens < lg) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-3">
            {filteredTasks.map((t) => {
              const todayStr = new Date().toISOString().split('T')[0]
              const isOverdue = !t.is_completed && t.deadline && t.deadline < todayStr
              const priorityCfg = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.medium
              const statusCfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.todo

              return (
                <div
                  key={t.id}
                  className="bg-white p-3.5 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col justify-between space-y-3"
                >
                  <div>
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-[#FAF7F2] border border-[#171717] rounded">
                        {t.project?.code || 'PRJ'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded border ${priorityCfg.bg}`}>
                          {priorityCfg.label}
                        </span>
                        <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded border ${statusCfg.bg}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                    </div>

                    {/* Title */}
                    <h4
                      onClick={() => handleOpenDetail(t)}
                      className="font-display text-sm uppercase text-[#171717] hover:text-[#FF2F92] cursor-pointer leading-tight mb-1"
                    >
                      {t.title}
                    </h4>
                    <p className="text-[10px] text-[#171717]/65 mb-2 truncate">
                      {t.project?.name} {t.milestone ? `• ${t.milestone.title}` : ''}
                    </p>

                    {/* Quick Assign in Card */}
                    <div className="p-2 bg-[#FAF7F2] rounded border border-[#171717]/15 space-y-1.5 mb-2">
                      <label className="block text-[9px] font-black uppercase text-[#171717]/60">
                        Assignee (Member):
                      </label>
                      <select
                        value={t.assignee_id || ''}
                        onChange={(e) => handleQuickAssign(t.id, e.target.value)}
                        disabled={quickAssignLoading === t.id}
                        className={`w-full p-1.5 bg-white border border-[#171717]/40 rounded text-xs font-bold ${
                          !t.assignee_id ? 'text-[#FF2F92] border-[#FF2F92]' : 'text-[#171717]'
                        }`}
                      >
                        <option value="">-- Belum Ditugaskan --</option>
                        {members.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Progress Bar & Ratio */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-black">
                        <span className="text-[#171717]/65">Checklist Progress</span>
                        <span className="text-[#171717]">
                          {t.checklist_completed || 0}/{t.checklist_total || 0} ({t.checklist_progress || 0}%)
                        </span>
                      </div>
                      <div className="w-full bg-[#EAE4D8] h-2 rounded-full overflow-hidden border border-[#171717]/20">
                        <div
                          className="h-full bg-[#10B981] transition-all duration-300"
                          style={{ width: `${t.checklist_progress || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Deadline + Buttons */}
                  <div className="pt-2 border-t border-[#171717]/15 flex items-center justify-between gap-2">
                    <div className="text-[10.5px]">
                      <span className="text-[9px] text-[#171717]/60 uppercase font-bold block">Deadline</span>
                      <span className={`font-bold ${isOverdue ? 'text-[#FF2F92] font-black' : 'text-[#171717]'}`}>
                        {t.deadline ? new Date(t.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenDetail(t)}
                        className="px-2.5 py-1 bg-white hover:bg-[#FAF7F2] border border-[#171717] rounded text-[10.5px] font-black uppercase cursor-pointer"
                      >
                        Detail
                      </button>
                      <button
                        onClick={() => handleOpenEdit(t)}
                        className="px-2 py-1 bg-[#FAF7F2] hover:bg-[#FFD83D] border border-[#171717] rounded text-[10.5px] font-bold cursor-pointer"
                        title="Edit Tugas"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => handleOpenDelete(t)}
                        className="px-2 py-1 bg-[#FAF7F2] hover:bg-[#FF2F92] hover:text-white border border-[#171717] rounded text-[10.5px] font-bold cursor-pointer"
                        title="Hapus Tugas"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ================= 6. MODAL CREATE TASK (FORM DISTRIBUSI TUGAS) ================= */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-[#171717]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setShowCreateModal(false)
          }}
        >
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#171717] w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#FF2F92] border border-[#171717]"></span>
                <h3 className="font-display text-lg uppercase tracking-tight text-[#171717]">
                  DISTRIBUSIKAN TUGAS BARU
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={submitting}
                className="p-1.5 hover:bg-[#FFD83D] border border-[#171717] rounded-md cursor-pointer transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="create-task-form" onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 min-h-0">
              {/* Task Title */}
              <div>
                <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                  Nama Tugas <span className="text-[#FF2F92]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Contoh: Membuat halaman laporan penjualan"
                  className={`w-full pkm-input ${formErrors.title ? 'border-[#FF2F92]' : ''}`}
                />
                {formErrors.title && (
                  <p className="text-[10px] font-bold text-[#FF2F92] mt-1">{formErrors.title[0]}</p>
                )}
              </div>

              {/* Project & Milestone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                    Proyek (Milik Anda) <span className="text-[#FF2F92]">*</span>
                  </label>
                  <select
                    required
                    value={formData.project_id}
                    onChange={(e) => {
                      const newProjId = e.target.value
                      setFormData({ ...formData, project_id: newProjId, milestone_id: '' })
                      loadMilestones(newProjId)
                    }}
                    className="w-full pkm-input"
                  >
                    <option value="">-- Pilih Proyek --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.project_id && (
                    <p className="text-[10px] font-bold text-[#FF2F92] mt-1">{formErrors.project_id[0]}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                    Sprint / Milestone (Opsional)
                  </label>
                  <select
                    value={formData.milestone_id}
                    onChange={(e) => setFormData({ ...formData, milestone_id: e.target.value })}
                    disabled={loadingMilestones || !formData.project_id}
                    className="w-full pkm-input"
                  >
                    <option value="">-- Tanpa Milestone --</option>
                    {projectMilestones.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                  {formErrors.milestone_id && (
                    <p className="text-[10px] font-bold text-[#FF2F92] mt-1">{formErrors.milestone_id[0]}</p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                  Deskripsi Pekerjaan <span className="text-[#FF2F92]">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Jelaskan kebutuhan tugas, acceptance criteria, atau instruksi teknis..."
                  className={`w-full pkm-input ${formErrors.description ? 'border-[#FF2F92]' : ''}`}
                />
                {formErrors.description && (
                  <p className="text-[10px] font-bold text-[#FF2F92] mt-1">{formErrors.description[0]}</p>
                )}
              </div>

              {/* Assignee & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                    Assignee (Member) <span className="text-[#FF2F92]">*</span>
                  </label>
                  <select
                    required
                    value={formData.assignee_id}
                    onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value })}
                    className={`w-full pkm-input ${formErrors.assignee_id ? 'border-[#FF2F92]' : ''}`}
                  >
                    <option value="">-- Pilih Member Pelaksana --</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                  {formErrors.assignee_id && (
                    <p className="text-[10px] font-bold text-[#FF2F92] mt-1">{formErrors.assignee_id[0]}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                    Tingkat Prioritas <span className="text-[#FF2F92]">*</span>
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full pkm-input"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Dates: Start Date & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                    Start Date (Opsional)
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full pkm-input"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                    Due Date (Deadline) <span className="text-[#FF2F92]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className={`w-full pkm-input ${formErrors.deadline ? 'border-[#FF2F92]' : ''}`}
                  />
                  {formErrors.deadline && (
                    <p className="text-[10px] font-bold text-[#FF2F92] mt-1">{formErrors.deadline[0]}</p>
                  )}
                </div>
              </div>

              {/* Checklist Section (Wajib Minimal 1) */}
              <div className="p-3 bg-[#FAF7F2] border border-[#171717]/20 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10.5px] font-black uppercase text-[#171717]">
                    Checklist Tugas ({formData.checklists.length} Item) <span className="text-[#FF2F92]">* Wajib</span>
                  </label>
                  <span className="text-[9px] font-bold text-[#171717]/60">
                    Dasar kalkulasi progres tugas otomatis
                  </span>
                </div>

                {formErrors.checklists && (
                  <p className="text-[10px] font-bold text-[#FF2F92]">{formErrors.checklists[0]}</p>
                )}

                {/* Checklist Items List */}
                <div className="space-y-1.5">
                  {formData.checklists.map((chk, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="w-5 text-[10px] font-bold text-[#171717]/50 text-center">
                        {index + 1}.
                      </span>
                      <input
                        type="text"
                        required
                        value={chk.title}
                        onChange={(e) => handleUpdateChecklistTitle(index, e.target.value)}
                        placeholder={`Langkah checklist ${index + 1}...`}
                        className="flex-1 px-2.5 py-1.5 bg-white border border-[#171717]/30 rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                      />
                      {formData.checklists.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveChecklist(index)}
                          className="p-1 hover:bg-[#FF2F92] hover:text-white rounded border border-transparent hover:border-[#171717] cursor-pointer transition-colors"
                          title="Hapus checklist ini"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Quick Add Checklist Input */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newChecklistInput}
                    onChange={(e) => setNewChecklistInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddChecklist()
                      }
                    }}
                    placeholder="Tambah item checklist lain (tekan Enter)..."
                    className="flex-1 px-2.5 py-1.5 bg-white border border-[#171717]/40 rounded text-xs font-medium focus:outline-none focus:border-[#FF2F92]"
                  />
                  <button
                    type="button"
                    onClick={handleAddChecklist}
                    className="px-3 py-1.5 bg-[#171717] text-white hover:bg-[#FFD83D] hover:text-[#171717] rounded text-xs font-black uppercase cursor-pointer transition-colors"
                  >
                    + Item
                  </button>
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="px-4 sm:px-5 py-3 border-t-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={submitting}
                className="pkm-btn-outline cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                form="create-task-form"
                disabled={submitting}
                className="pkm-btn-pink flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#171717]"
              >
                {submitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <CheckSquare size={14} />
                    <span>Distribusikan Tugas</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 7. MODAL EDIT TASK ================= */}
      {showEditModal && selectedTask && (
        <div
          className="fixed inset-0 bg-[#171717]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setShowEditModal(false)
          }}
        >
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#171717] w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#FFD83D] border border-[#171717]"></span>
                <h3 className="font-display text-lg uppercase tracking-tight text-[#171717]">
                  EDIT DISTRIBUSI TUGAS
                </h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                disabled={submitting}
                className="p-1.5 hover:bg-[#FFD83D] border border-[#171717] rounded-md cursor-pointer transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="edit-task-form" onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 min-h-0">
              <div>
                <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                  Nama Tugas <span className="text-[#FF2F92]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full pkm-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                    Proyek <span className="text-[#FF2F92]">*</span>
                  </label>
                  <select
                    required
                    value={formData.project_id}
                    onChange={(e) => {
                      const newProjId = e.target.value
                      setFormData({ ...formData, project_id: newProjId, milestone_id: '' })
                      loadMilestones(newProjId)
                    }}
                    className="w-full pkm-input"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                    Sprint / Milestone
                  </label>
                  <select
                    value={formData.milestone_id}
                    onChange={(e) => setFormData({ ...formData, milestone_id: e.target.value })}
                    className="w-full pkm-input"
                  >
                    <option value="">-- Tanpa Milestone --</option>
                    {projectMilestones.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                  Deskripsi Pekerjaan
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full pkm-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                    Assignee (Member)
                  </label>
                  <select
                    value={formData.assignee_id}
                    onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value })}
                    className="w-full pkm-input"
                  >
                    <option value="">-- Belum Ditugaskan --</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                    Prioritas
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full pkm-input"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full pkm-input"
                  >
                    <option value="pending">To-do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="in_review">In Review</option>
                    <option value="completed">Done</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full pkm-input"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full pkm-input"
                  />
                </div>
              </div>

              {/* Checklist Sync Section */}
              <div className="p-3 bg-[#FAF7F2] border border-[#171717]/20 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10.5px] font-black uppercase text-[#171717]">
                    Kelola Checklist ({formData.checklists.length} Item)
                  </label>
                  <span className="text-[9px] font-bold text-[#171717]/60">
                    Progres dihitung ulang otomatis
                  </span>
                </div>

                <div className="space-y-1.5">
                  {formData.checklists.map((chk, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="w-5 text-[10px] font-bold text-[#171717]/50 text-center">
                        {index + 1}.
                      </span>
                      <input
                        type="text"
                        required
                        value={chk.title}
                        onChange={(e) => handleUpdateChecklistTitle(index, e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-white border border-[#171717]/30 rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveChecklist(index)}
                        className="p-1 hover:bg-[#FF2F92] hover:text-white rounded border border-transparent hover:border-[#171717] cursor-pointer transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newChecklistInput}
                    onChange={(e) => setNewChecklistInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddChecklist()
                      }
                    }}
                    placeholder="Tambah item checklist baru..."
                    className="flex-1 px-2.5 py-1.5 bg-white border border-[#171717]/40 rounded text-xs font-medium focus:outline-none focus:border-[#FF2F92]"
                  />
                  <button
                    type="button"
                    onClick={handleAddChecklist}
                    className="px-3 py-1.5 bg-[#171717] text-white hover:bg-[#FFD83D] hover:text-[#171717] rounded text-xs font-black uppercase cursor-pointer transition-colors"
                  >
                    + Item
                  </button>
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="px-4 sm:px-5 py-3 border-t-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                disabled={submitting}
                className="pkm-btn-outline cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                form="edit-task-form"
                disabled={submitting}
                className="pkm-btn-pink flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#171717]"
              >
                {submitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <CheckSquare size={14} />
                    <span>Simpan Perubahan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 8. MODAL TASK DETAIL & PROGRESS HISTORY (PM-G) ================= */}
      {showDetailModal && selectedTask && (
        <div
          className="fixed inset-0 bg-[#171717]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDetailModal(false)
          }}
        >
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#171717] w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-white border border-[#171717] rounded">
                  {selectedTask.project?.code || 'PRJ'}
                </span>
                <h3 className="font-display text-base uppercase tracking-tight text-[#171717] truncate max-w-sm">
                  DETAIL TUGAS
                </h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1.5 hover:bg-[#FFD83D] border border-[#171717] rounded-md cursor-pointer transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Sub-tab Navigation (PM-G + PM-H) */}
            <div className="flex items-center gap-1.5 px-4 sm:px-5 py-2 bg-[#FAF7F2] border-b border-[#171717]/20 shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setDetailTab('overview')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-black uppercase transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  detailTab === 'overview'
                    ? 'bg-[#171717] text-white shadow-[2px_2px_0px_#FF2F92]'
                    : 'bg-white text-[#171717] border border-[#171717]/30 hover:border-[#171717]'
                }`}
              >
                <ListTodo size={13} />
                <span>Detail & Checklist</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('history')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-black uppercase transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  detailTab === 'history'
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
                onClick={() => setDetailTab('approval')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-black uppercase transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  detailTab === 'approval'
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
              {/* Task Title & Status Badges */}
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${STATUS_CONFIG[selectedTask.status]?.bg || 'bg-neutral-200'}`}>
                    {STATUS_CONFIG[selectedTask.status]?.label || selectedTask.status}
                  </span>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${PRIORITY_CONFIG[selectedTask.priority]?.bg || 'bg-neutral-200'}`}>
                    Prioritas {PRIORITY_CONFIG[selectedTask.priority]?.label || selectedTask.priority}
                  </span>
                </div>
                <h2 className="font-display text-lg uppercase text-[#171717] leading-tight">
                  {selectedTask.title}
                </h2>
              </div>

              {/* TAB 1: OVERVIEW & CHECKLIST */}
              {detailTab === 'overview' && (
                <div className="space-y-4">
                  {selectedTask.description && (
                    <p className="text-xs text-[#171717]/80 leading-relaxed bg-[#FAF7F2] p-3 rounded border border-[#171717]/15">
                      {selectedTask.description}
                    </p>
                  )}

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-semibold">
                    <div className="p-2.5 bg-[#FAF7F2] rounded border border-[#171717]/15">
                      <span className="text-[9.5px] uppercase font-black text-[#171717]/60 block mb-0.5">Proyek</span>
                      <p className="truncate font-bold text-[#171717]">{selectedTask.project?.name || '—'}</p>
                    </div>
                    <div className="p-2.5 bg-[#FAF7F2] rounded border border-[#171717]/15">
                      <span className="text-[9.5px] uppercase font-black text-[#171717]/60 block mb-0.5">Assignee</span>
                      <p className="truncate font-bold text-[#171717]">{selectedTask.assignee_name || 'Belum Ditugaskan'}</p>
                    </div>
                    <div className="p-2.5 bg-[#FAF7F2] rounded border border-[#171717]/15">
                      <span className="text-[9.5px] uppercase font-black text-[#171717]/60 block mb-0.5">Deadline</span>
                      <p className="truncate font-bold text-[#171717]">
                        {selectedTask.deadline ? new Date(selectedTask.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="p-3.5 bg-white border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] space-y-2">
                    <div className="flex items-center justify-between text-xs font-black">
                      <span className="text-[10px] uppercase text-[#171717]/70">Progres Checklist</span>
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

                  {/* Interactive Checklist Items */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase text-[#171717] flex items-center gap-1.5">
                        <ListTodo size={14} className="text-[#FF2F92]" />
                        <span>Daftar Checklist</span>
                      </h4>
                      <span className="text-[9px] font-bold text-[#171717]/60">
                        Klik kotak untuk toggle status
                      </span>
                    </div>

                    {(!selectedTask.checklists || selectedTask.checklists.length === 0) ? (
                      <p className="text-xs text-[#171717]/60 italic p-3 bg-[#FAF7F2] rounded text-center">
                        Belum ada checklist pada tugas ini.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {selectedTask.checklists.map((chk, index) => (
                          <div
                            key={chk.id || index}
                            onClick={() => handleToggleChecklist(chk.id)}
                            className={`p-2.5 rounded border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                              chk.is_completed
                                ? 'bg-[#ECFDF5] border-[#10B981] text-[#065F46]'
                                : 'bg-[#FAF7F2] border-[#171717]/20 hover:border-[#FF2F92] text-[#171717]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-4.5 h-4.5 rounded border flex items-center justify-center shrink-0 ${
                                chk.is_completed ? 'bg-[#10B981] border-[#10B981] text-white' : 'bg-white border-[#171717]/50'
                              }`}>
                                {chk.is_completed && <Check size={12} strokeWidth={3} />}
                              </div>
                              <span className={`text-xs font-medium leading-tight ${chk.is_completed ? 'line-through opacity-80' : ''}`}>
                                {chk.title}
                              </span>
                            </div>
                            {chk.completed_by && (
                              <span className="text-[9px] text-[#10B981] font-bold shrink-0">
                                ✓ Selesai
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* PM-H: Approval Action Banners */}
                  {selectedTask.status === 'in_review' && (
                    <div className="p-3.5 bg-[#B8A0F0]/20 border border-[#7C3AED] rounded-lg space-y-3">
                      <div>
                        <p className="font-black uppercase text-[#7C3AED] flex items-center gap-1.5 text-xs mb-1">
                          <ShieldCheck size={14} />
                          <span>Menunggu Keputusan Review Anda</span>
                        </p>
                        <p className="text-[10.5px] text-[#171717]/75 leading-relaxed">
                          Member telah mengajukan penyelesaian tugas ini (checklist 100%). Checklist terkunci hingga Anda menyetujui atau meminta revisi.
                        </p>
                        {/* Show submission notes from latest 'submitted' review */}
                        {taskReviews.find(r => r.action === 'submitted') && (
                          <div className="mt-2 p-2.5 bg-white rounded border border-[#7C3AED]/30 text-xs">
                            <span className="text-[9.5px] font-black uppercase text-[#7C3AED] block mb-1">Catatan Pengajuan Member:</span>
                            <p className="text-[#171717]/80 leading-relaxed italic">
                              {taskReviews.find(r => r.action === 'submitted')?.notes || '(Tidak ada catatan tambahan)'}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-[#7C3AED]/20">
                        <button
                          type="button"
                          onClick={() => { setApproveNotes(''); setShowApproveConfirm(true) }}
                          className="px-3.5 py-2 bg-[#10B981] hover:bg-[#059669] text-white border border-[#171717] rounded text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#171717] transition-all"
                        >
                          <ThumbsUp size={12} />
                          <span>Setujui (Approve)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRevisionReason(''); setShowRevisionModal(true) }}
                          className="px-3.5 py-2 bg-[#FFD83D] hover:bg-[#FFC300] text-[#171717] border border-[#171717] rounded text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#171717] transition-all"
                        >
                          <MessageSquareWarning size={12} />
                          <span>Minta Revisi</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {(selectedTask.status === 'done' || selectedTask.status === 'completed' || selectedTask.is_completed) && selectedTask.status !== 'in_review' && (
                    <div className="p-3.5 bg-[#ECFDF5] border border-[#10B981] rounded-lg space-y-3">
                      <div>
                        <p className="font-black uppercase text-[#065F46] flex items-center gap-1.5 text-xs mb-1">
                          <CheckCircle2 size={14} />
                          <span>Tugas Selesai (Done)</span>
                        </p>
                        <p className="text-[10.5px] text-[#171717]/75 leading-relaxed">
                          Tugas ini telah disetujui selesai. Anda dapat membukanya kembali (reopen) jika ada perbaikan yang perlu dikerjakan ulang.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-[#10B981]/30">
                        <button
                          type="button"
                          onClick={() => { setReopenReason(''); setShowReopenModal(true) }}
                          className="px-3.5 py-2 bg-white hover:bg-[#FFD83D] text-[#171717] border border-[#171717] rounded text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#171717] transition-all"
                        >
                          <RefreshCw size={12} />
                          <span>Buka Kembali (Reopen)</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedTask.status !== 'in_review' && selectedTask.status !== 'done' && selectedTask.status !== 'completed' && !selectedTask.is_completed && (
                    <div className="p-3 bg-[#FFF0F8] border border-[#FF2F92]/40 rounded-lg text-[10.5px] text-[#171717] space-y-1">
                      <p className="font-black uppercase text-[#FF2F92] flex items-center gap-1">
                        <AlertCircle size={13} />
                        <span>Aturan Persetujuan Status Done</span>
                      </p>
                      <p className="text-[#171717]/75 leading-relaxed">
                        Penyelesaian checklist 100% tidak otomatis menjadikan status tugas Done. Status Done hanya dapat disetujui setelah proses review oleh Project Manager.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: PROGRESS HISTORY (PM-G) */}
              {detailTab === 'history' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <h4 className="text-xs font-black uppercase text-[#171717] flex items-center gap-1.5">
                      <History size={14} className="text-[#FF2F92]" />
                      <span>Histori Laporan Progres Member</span>
                    </h4>
                    <span className="text-[10px] text-[#171717]/60 font-bold">
                      {taskUpdates.length} Laporan
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
                        Belum ada laporan perkembangan dari Member.
                      </p>
                      <p className="text-[11px] text-[#171717]/60 max-w-sm mx-auto">
                        Setiap perkembangan yang dicatat oleh Member pada tugas ini akan otomatis tampil di sini secara kronologis beserta snapshot progres.
                      </p>
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

              {/* TAB 3: APPROVAL HISTORY (PM-H) */}
              {detailTab === 'approval' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <h4 className="text-xs font-black uppercase text-[#171717] flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-[#7C3AED]" />
                      <span>Riwayat Keputusan Approval</span>
                    </h4>
                    <span className="text-[10px] text-[#171717]/60 font-bold">
                      {taskReviews.length} Catatan
                    </span>
                  </div>

                  {loadingUpdates ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-[#171717]/70">
                      <Loader2 size={18} className="animate-spin text-[#7C3AED]" />
                      <span>Memuat riwayat approval...</span>
                    </div>
                  ) : taskReviews.length === 0 ? (
                    <div className="p-6 bg-[#FAF7F2] rounded-lg border border-[#171717]/20 text-center space-y-2">
                      <ShieldCheck size={24} className="mx-auto text-[#171717]/30" />
                      <p className="text-xs font-bold text-[#171717]">Belum ada riwayat approval pada tugas ini.</p>
                      <p className="text-[11px] text-[#171717]/60 max-w-sm mx-auto">
                        Setelah Member mengajukan penyelesaian tugas, keputusan approval, revisi, atau reopen akan tercatat secara permanen di sini.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {taskReviews.map((rev, idx) => {
                        const ACTION_CONFIG = {
                          submitted:          { label: 'Diajukan Member',    bg: 'bg-[#B8A0F0]/20 border-[#7C3AED]', badge: 'bg-[#B8A0F0] text-[#171717]', icon: <ShieldCheck size={12} /> },
                          approved:           { label: 'Disetujui (Done)',   bg: 'bg-[#ECFDF5] border-[#10B981]',    badge: 'bg-[#10B981] text-white',      icon: <ThumbsUp size={12} /> },
                          revision_requested: { label: 'Diminta Revisi',     bg: 'bg-[#FFF9E6] border-[#FFD83D]',    badge: 'bg-[#FFD83D] text-[#171717]',  icon: <MessageSquareWarning size={12} /> },
                          reopened:           { label: 'Dibuka Kembali',     bg: 'bg-[#FAF7F2] border-[#171717]',    badge: 'bg-[#171717] text-white',      icon: <RefreshCw size={12} /> },
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
            <div className="px-4 sm:px-5 py-3 border-t-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowDetailModal(false)
                  handleOpenEdit(selectedTask)
                }}
                className="px-3 py-1.5 bg-white hover:bg-[#FFD83D] border border-[#171717] rounded text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer shadow-[1px_1px_0px_#171717]"
              >
                <Edit3 size={13} />
                <span>Edit Tugas</span>
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="pkm-btn-outline cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PM-H: APPROVE CONFIRMATION MODAL ================= */}
      {showApproveConfirm && selectedTask && (
        <div
          className="fixed inset-0 bg-[#171717]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[60] animate-in fade-in duration-150"
          onClick={(e) => { if (e.target === e.currentTarget && !submittingReview) setShowApproveConfirm(false) }}
        >
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#10B981] w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#ECFDF5] border border-[#10B981] flex items-center justify-center shrink-0">
                <ThumbsUp size={18} className="text-[#10B981]" strokeWidth={2.5} />
              </div>
              <h3 className="font-display text-lg uppercase text-[#171717]">SETUJUI TUGAS</h3>
            </div>
            <p className="text-xs text-[#171717]/80 leading-relaxed">
              Anda akan menyetujui penyelesaian tugas <strong>&quot;{selectedTask.title}&quot;</strong>. Status akan berubah menjadi <strong>Done</strong>.
            </p>
            <div>
              <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                Catatan Approval <span className="text-[10px] font-normal text-[#171717]/60 normal-case">(Opsional)</span>
              </label>
              <textarea
                rows={2}
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                placeholder="Contoh: Pekerjaan sudah sesuai acceptance criteria..."
                className="pkm-input w-full text-xs font-medium"
                disabled={submittingReview}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#171717]/15">
              <button
                type="button"
                onClick={() => setShowApproveConfirm(false)}
                disabled={submittingReview}
                className="pkm-btn-outline cursor-pointer text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={submittingReview}
                className="px-4 py-2 bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-white font-black uppercase text-xs rounded border border-[#171717] shadow-[2px_2px_0px_#171717] flex items-center gap-2 cursor-pointer transition-all"
              >
                {submittingReview ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Menyetujui...</span>
                  </>
                ) : (
                  <>
                    <ThumbsUp size={13} />
                    <span>Ya, Setujui Tugas</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PM-H: REQUEST REVISION MODAL ================= */}
      {showRevisionModal && selectedTask && (
        <div
          className="fixed inset-0 bg-[#171717]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[60] animate-in fade-in duration-150"
          onClick={(e) => { if (e.target === e.currentTarget && !submittingReview) setShowRevisionModal(false) }}
        >
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#FFD83D] w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#FFF9E6] border border-[#FFD83D] flex items-center justify-center shrink-0">
                <MessageSquareWarning size={18} className="text-[#171717]" strokeWidth={2.5} />
              </div>
              <h3 className="font-display text-lg uppercase text-[#171717]">MINTA REVISI</h3>
            </div>
            <p className="text-xs text-[#171717]/80 leading-relaxed">
              Tugas <strong>&quot;{selectedTask.title}&quot;</strong> akan dikembalikan kepada Member dengan status <strong>In Progress</strong>.
            </p>
            <div>
              <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                Alasan / Instruksi Revisi <span className="text-[#FF2F92]">* Wajib</span>
              </label>
              <textarea
                rows={3}
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                placeholder="Jelaskan secara detail apa yang harus diperbaiki oleh Member..."
                className="pkm-input w-full text-xs font-medium"
                disabled={submittingReview}
              />
              {!revisionReason.trim() && (
                <p className="text-[9.5px] text-[#FF2F92] mt-0.5 font-bold">Alasan revisi wajib diisi sebelum mengirim.</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#171717]/15">
              <button
                type="button"
                onClick={() => setShowRevisionModal(false)}
                disabled={submittingReview}
                className="pkm-btn-outline cursor-pointer text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRequestRevision}
                disabled={submittingReview || !revisionReason.trim()}
                className="px-4 py-2 bg-[#FFD83D] hover:bg-[#FFC300] disabled:opacity-50 text-[#171717] font-black uppercase text-xs rounded border border-[#171717] shadow-[2px_2px_0px_#171717] flex items-center gap-2 cursor-pointer transition-all"
              >
                {submittingReview ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <MessageSquareWarning size={13} />
                    <span>Kirim Permintaan Revisi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PM-H: REOPEN MODAL ================= */}
      {showReopenModal && selectedTask && (
        <div
          className="fixed inset-0 bg-[#171717]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[60] animate-in fade-in duration-150"
          onClick={(e) => { if (e.target === e.currentTarget && !submittingReview) setShowReopenModal(false) }}
        >
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#171717] w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#FAF7F2] border border-[#171717] flex items-center justify-center shrink-0">
                <RefreshCw size={18} className="text-[#171717]" strokeWidth={2.5} />
              </div>
              <h3 className="font-display text-lg uppercase text-[#171717]">BUKA KEMBALI TUGAS</h3>
            </div>
            <p className="text-xs text-[#171717]/80 leading-relaxed">
              Tugas <strong>&quot;{selectedTask.title}&quot;</strong> yang sudah berstatus Done akan dibuka kembali ke status <strong>In Progress</strong>.
            </p>
            <div>
              <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                Alasan Pembukaan Kembali <span className="text-[#FF2F92]">* Wajib</span>
              </label>
              <textarea
                rows={3}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Jelaskan alasan mengapa tugas yang sudah Done ini perlu dibuka kembali..."
                className="pkm-input w-full text-xs font-medium"
                disabled={submittingReview}
              />
              {!reopenReason.trim() && (
                <p className="text-[9.5px] text-[#FF2F92] mt-0.5 font-bold">Alasan pembukaan kembali wajib diisi.</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#171717]/15">
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                disabled={submittingReview}
                className="pkm-btn-outline cursor-pointer text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleReopen}
                disabled={submittingReview || !reopenReason.trim()}
                className="px-4 py-2 bg-[#171717] hover:bg-[#333] disabled:opacity-50 text-white font-black uppercase text-xs rounded border border-[#171717] shadow-[2px_2px_0px_#171717] flex items-center gap-2 cursor-pointer transition-all"
              >
                {submittingReview ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={13} />
                    <span>Ya, Buka Kembali</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 9. MODAL DELETE CONFIRMATION ================= */}
      {showDeleteModal && selectedTask && (
        <div
          className="fixed inset-0 bg-[#171717]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setShowDeleteModal(false)
          }}
        >
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#171717] w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-[#FF2F92]">
              <div className="w-9 h-9 rounded-full bg-[#FF2F92]/10 border border-[#FF2F92] flex items-center justify-center shrink-0">
                <Trash2 size={18} strokeWidth={2.5} />
              </div>
              <h3 className="font-display text-lg uppercase text-[#171717]">HAPUS TUGAS</h3>
            </div>

            <p className="text-xs text-[#171717]/80 leading-relaxed">
              Apakah Anda yakin ingin menghapus tugas <strong>&quot;{selectedTask.title}&quot;</strong> dari proyek <strong>{selectedTask.project?.name}</strong>? Seluruh data checklist tugas ini juga akan terhapus permanen.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#171717]/15">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={submitting}
                className="pkm-btn-outline cursor-pointer text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={submitting}
                className="px-3.5 py-1.5 bg-[#FF2F92] text-white hover:bg-[#e0267e] border border-[#171717] rounded font-bold text-xs uppercase flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#171717]"
              >
                {submitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <span>Ya, Hapus Tugas</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
