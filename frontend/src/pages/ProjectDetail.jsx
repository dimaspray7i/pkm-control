import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FolderKanban,
  Globe,
  Smartphone,
  Laptop,
  Code2,
  Pencil,
  Trash2,
  Check,
  Loader2,
  RotateCcw,
  AlertCircle,
  X,
  ClipboardList,
  Milestone as MilestoneIcon,
  Activity as ActivityIcon,
  User,
  ShieldAlert
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const STATUS_CONFIG = {
  on_track:  { label: 'On Track',  bg: 'bg-[#10B981] text-white',     bar: 'bg-[#10B981]' },
  at_risk:   { label: 'At Risk',   bg: 'bg-[#FFD83D] text-[#171717]', bar: 'bg-[#FBBF24]' },
  delayed:   { label: 'Delayed',   bg: 'bg-[#FF2F92] text-white',     bar: 'bg-[#FF2F92]' },
  completed: { label: 'Completed', bg: 'bg-[#B8A0F0] text-[#171717]', bar: 'bg-[#B8A0F0]' },
}

const CategoryIcon = ({ cat }) => {
  if (cat === 'mobile') return <Smartphone size={16} />
  if (cat === 'system') return <Laptop size={16} />
  if (cat === 'code')   return <Code2 size={16} />
  return <Globe size={16} />
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = user?.role === 'admin' || user?.role === 'project_manager'

  const [project, setProject] = useState(null)
  const [activities, setActivities] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notFound, setNotFound] = useState(false)

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    client: '',
    pic_id: '',
    category: 'web',
    status: 'on_track',
    progress: 0,
    target_progress: 0,
    risk_level: 'low',
    risk_factor: '',
    deadline: '',
  })
  const [formErrors, setFormErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Feedback Notification
  const [feedback, setFeedback] = useState(null)

  const showNotification = (type, message) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  const fetchProjectDetail = async () => {
    try {
      setLoading(true)
      setError(null)
      setNotFound(false)
      const [resProj, resTeam] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get('/team').catch(() => ({ data: { team: [] } }))
      ])
      setProject(resProj.data.project)
      setActivities(resProj.data.activities || [])
      setTeamMembers(resTeam.data.team || [])
    } catch (err) {
      if (err.response?.status === 404) {
        setNotFound(true)
      } else {
        setError('Gagal memuat detail proyek dari server backend.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjectDetail()
  }, [id])

  // Open Edit Modal
  const handleOpenEdit = () => {
    if (!project) return
    setFormErrors({})
    setFormData({
      code: project.code || '',
      name: project.name || '',
      client: project.client || '',
      pic_id: project.pic_id ? String(project.pic_id) : '',
      category: project.category || 'web',
      status: project.status || 'on_track',
      progress: project.progress ?? 0,
      target_progress: project.target_progress ?? project.progress ?? 0,
      risk_level: project.risk_level || 'low',
      risk_factor: project.risk_factor || '',
      deadline: project.deadline ? project.deadline.substring(0, 10) : '',
    })
    setShowEditModal(true)
  }

  const [togglingTaskId, setTogglingTaskId] = useState(null)

  const canToggleTask = (task) => {
    if (!user) return false
    if (user.role === 'admin' || user.role === 'project_manager') return true
    if (user.role === 'member') {
      return !!task.assignee_name && !!user.name && task.assignee_name.toLowerCase().trim() === user.name.toLowerCase().trim()
    }
    return false
  }

  // Toggle Task Status Directly from Project Detail
  const handleToggleTask = async (taskId) => {
    if (togglingTaskId) return
    setTogglingTaskId(taskId)
    try {
      const res = await api.post(`/tasks/${taskId}/toggle`)
      const updatedTask = res.data.task
      const newProgress = res.data.project_progress

      setProject(prev => {
        if (!prev) return prev
        const updatedTasks = (prev.tasks || []).map(t => 
          t.id === taskId ? { ...t, is_completed: updatedTask.is_completed } : t
        )
        const completedCount = updatedTasks.filter(t => t.is_completed).length
        return {
          ...prev,
          tasks: updatedTasks,
          progress: typeof newProgress === 'number' ? newProgress : (updatedTasks.length > 0 ? Math.round((completedCount / updatedTasks.length) * 100) : prev.progress),
          completed_tasks_count: completedCount,
          total_tasks_count: updatedTasks.length
        }
      })
      showNotification('success', res.data.message || 'Status tugas berhasil diperbarui!')
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Gagal mengubah status tugas.')
    } finally {
      setTogglingTaskId(null)
    }
  }

  // Submit Edit Project
  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (submitting || !project) return

    setFormErrors({})
    setSubmitting(true)

    try {
      const selectedPic = teamMembers.find(m => String(m.id) === String(formData.pic_id))
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        client: formData.client.trim(),
        pic_id: formData.pic_id ? Number(formData.pic_id) : null,
        pic_name: selectedPic ? selectedPic.name : null,
        category: formData.category,
        status: formData.status,
        target_progress: Number(formData.target_progress || 0),
        risk_level: formData.risk_level,
        risk_factor: formData.risk_factor?.trim() || null,
        deadline: formData.deadline || null,
      }
      const res = await api.put(`/projects/${project.id}`, payload)
      showNotification('success', res.data.message || 'Data proyek berhasil diperbarui!')
      setShowEditModal(false)
      // Update local state without full reload
      setProject(prev => ({
        ...prev,
        ...res.data.project,
        pic: res.data.project.pic || (selectedPic ? { id: selectedPic.id, name: selectedPic.name, email: selectedPic.email, role: selectedPic.role } : null),
        tasks: prev?.tasks || [],
        milestones: prev?.milestones || [],
      }))
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        setFormErrors(err.response.data.errors)
      } else {
        showNotification('error', err.response?.data?.message || 'Gagal memperbarui proyek.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Submit Delete Project
  const handleDeleteSubmit = async () => {
    if (submitting || !project) return

    setSubmitting(true)
    try {
      await api.delete(`/projects/${project.id}`)
      navigate('/projects', { state: { deletedName: project.name } })
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Gagal menghapus proyek.')
      setSubmitting(false)
      setShowDeleteModal(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 size={36} className="animate-spin text-[#FF2F92]" />
        <p className="font-display text-lg uppercase tracking-wider text-[#171717]">
          MEMUAT DETAIL PROYEK DARI DATABASE...
        </p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-[#FFD83D] border-2 border-[#171717] rounded-lg shadow-[6px_6px_0px_#171717] space-y-4 text-center">
        <div className="w-12 h-12 bg-white border-2 border-[#171717] rounded-md flex items-center justify-center mx-auto shadow-[2px_2px_0px_#171717]">
          <ShieldAlert size={28} className="text-[#FF2F92]" />
        </div>
        <h2 className="font-display font-black text-2xl uppercase tracking-tight text-[#171717]">
          Proyek Tidak Ditemukan
        </h2>
        <p className="text-xs font-semibold text-[#171717]/80 max-w-md mx-auto">
          Proyek dengan ID <strong>#{id}</strong> tidak terdaftar dalam database atau telah dihapus dari sistem PKM Business Control Center.
        </p>
        <div className="pt-2">
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-[#171717] font-black text-xs uppercase tracking-wider border-2 border-[#171717] shadow-[3px_3px_0px_#171717] hover:bg-[#F5F1E9] active:translate-x-0.5 active:translate-y-0.5"
          >
            <ArrowLeft size={15} />
            <span>Kembali ke Daftar Proyek</span>
          </Link>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto my-10 p-6 bg-[#FFD83D] border-2 border-[#171717] rounded-lg shadow-[4px_4px_0px_#171717] space-y-3">
        <h2 className="font-display text-xl uppercase text-[#171717]">Gagal Menghubungkan ke Backend</h2>
        <p className="text-xs font-semibold text-[#171717]/85">{error}</p>
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={fetchProjectDetail}
            className="px-3.5 py-1.5 bg-[#171717] text-white font-bold text-xs uppercase flex items-center gap-1.5 rounded cursor-pointer"
          >
            <RotateCcw size={13} /> Coba Lagi
          </button>
          <Link
            to="/projects"
            className="px-3.5 py-1.5 bg-white text-[#171717] font-bold text-xs uppercase border border-[#171717] rounded"
          >
            Kembali
          </Link>
        </div>
      </div>
    )
  }

  const status = STATUS_CONFIG[project?.status] || STATUS_CONFIG.on_track
  const tasks = project?.tasks || []
  const milestones = project?.milestones || []
  const completedTasksCount = tasks.filter(t => t.is_completed).length

  return (
    <div className="space-y-4 pb-6">
      {/* Header with Navigation and Action Buttons */}
      <PageHeader
        title={project.name.toUpperCase()}
        subtitle={`Klien: ${project.client} | Kode: ${project.code}`}
        tag="DETAIL PROYEK"
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/projects"
              className="px-3 py-1.5 bg-white hover:bg-[#FAF7F2] text-[#171717] border-1.5 border-[#171717] rounded-lg text-xs font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_#171717] active:translate-x-0.5 active:translate-y-0.5"
            >
              <ArrowLeft size={14} />
              <span>Daftar Proyek</span>
            </Link>

            {canManage && (
              <>
                <button
                  onClick={handleOpenEdit}
                  className="px-3 py-1.5 bg-[#FFD83D] hover:bg-[#ffe26e] text-[#171717] border-1.5 border-[#171717] rounded-lg text-xs font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_#171717] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                  title="Edit Data Proyek"
                >
                  <Pencil size={13} />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-3 py-1.5 bg-[#FF2F92] hover:bg-[#e0267d] text-white border-1.5 border-[#171717] rounded-lg text-xs font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_#171717] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                  title="Hapus Proyek"
                >
                  <Trash2 size={13} />
                  <span>Hapus</span>
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Feedback Banner */}
      {feedback && (
        <div 
          className={`p-3.5 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex items-center justify-between text-xs font-bold transition-all ${
            feedback.type === 'success' ? 'bg-[#ECFDF5] text-[#065F46]' : 'bg-[#FFD83D] text-[#171717]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <Check size={16} strokeWidth={3} className="text-[#10B981]" />
            ) : (
              <AlertCircle size={16} strokeWidth={3} className="text-[#FF2F92]" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button 
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-[#171717]/10 rounded cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Status Card */}
        <div className="bg-white p-3 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
          <span className="text-[9px] font-black uppercase tracking-wider text-[#171717]/60 block mb-1">
            Status Operasional
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 border border-[#171717] rounded-sm ${status.bg}`}>
              {status.label}
            </span>
          </div>
          <p className="text-[9px] font-bold text-[#171717]/70 mt-2">
            Kategori: <strong className="uppercase">{project.category}</strong>
          </p>
        </div>

        {/* Progress Card */}
        <div className="bg-white p-3 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
          <span className="text-[9px] font-black uppercase tracking-wider text-[#171717]/60 block mb-1">
            Progres Pekerjaan (Auto)
          </span>
          <div className="flex items-baseline justify-between gap-1.5">
            <span className="font-display text-2xl font-black text-[#171717]">{project.progress ?? 0}%</span>
            <span className="text-[10px] font-bold text-[#171717]/60">Target: {project.target_progress ?? project.progress ?? 0}%</span>
          </div>
          <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden border border-[#171717]/30 mt-2">
            <div 
              className={`h-full ${status.bar} transition-all duration-300`}
              style={{ width: `${project.progress ?? 0}%` }}
            ></div>
          </div>
          <p className="text-[9px] font-bold text-[#171717]/70 mt-1.5 flex items-center justify-between">
            <span>Rasio Selesai:</span>
            <span className="font-mono text-[#FF2F92]">{completedTasksCount} dari {tasks.length} tugas</span>
          </p>
        </div>

        {/* Risk Card */}
        <div className="bg-white p-3 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
          <span className="text-[9px] font-black uppercase tracking-wider text-[#171717]/60 block mb-1">
            Tingkat Risiko
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 border border-[#171717] rounded-sm ${
              project.risk_level === 'high' ? 'bg-[#FF2F92] text-white' :
              project.risk_level === 'medium' ? 'bg-[#FFD83D] text-[#171717]' :
              'bg-[#10B981] text-white'
            }`}>
              {project.risk_level || 'Low'}
            </span>
          </div>
          <p className="text-[9px] font-semibold text-[#171717]/70 mt-2 truncate" title={project.risk_factor || 'Tidak ada kendala aktif'}>
            {project.risk_factor || 'Kondisi operasional normal.'}
          </p>
        </div>

        {/* Deadline Card */}
        <div className="bg-white p-3 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
          <span className="text-[9px] font-black uppercase tracking-wider text-[#171717]/60 block mb-1">
            Target Batas Waktu
          </span>
          <p className="font-display text-lg font-black text-[#171717]">
            {project.deadline ? new Date(project.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Tidak Ditentukan'}
          </p>
          <p className="text-[9px] font-bold text-[#171717]/70 mt-1">
            {project.is_active ? 'Status: Proyek Aktif' : 'Status: Proyek Diarsipkan'}
          </p>
        </div>
      </div>

      {/* Main Grid: Left (Tasks & Milestones) / Right (Activities & Info) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (8 cols): Tasks & Milestones */}
        <div className="lg:col-span-8 space-y-4">
          {/* Section: Related Tasks */}
          <div className="bg-white p-4 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
            <div className="flex items-center justify-between border-b border-[#171717]/15 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <ClipboardList size={18} className="text-[#FF2F92]" />
                <h3 className="font-display text-sm uppercase tracking-tight text-[#171717]">
                  Tugas Terkait ({completedTasksCount}/{tasks.length} Selesai)
                </h3>
              </div>
              <Link 
                to={`/tasks?project_id=${project.id}`}
                className="text-[10px] font-black text-[#FF2F92] hover:underline"
              >
                Buka Manajemen Tugas →
              </Link>
            </div>

            {tasks.length === 0 ? (
              <div className="py-8 px-4 text-center bg-[#FAF7F2] border-2 border-dashed border-[#171717]/25 rounded-lg space-y-2">
                <ClipboardList size={28} className="mx-auto text-[#171717]/40" />
                <p className="text-xs font-bold text-[#171717]">Belum ada tugas untuk proyek ini</p>
                <p className="text-[10px] text-[#171717]/60 max-w-sm mx-auto">
                  Progres proyek akan dihitung otomatis (0-100%) setelah tugas dibuat dan diselesaikan oleh tim.
                </p>
                {canManage && (
                  <div className="pt-1">
                    <Link
                      to={`/tasks?project_id=${project.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FF2F92] text-white text-[10px] font-black uppercase rounded border border-[#171717] shadow-[2px_2px_0px_#171717] hover:bg-[#e0267d]"
                    >
                      <span>+ Kelola & Tambah Tugas</span>
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.slice(0, 5).map((task) => {
                  const priorityBadge = 
                    task.priority === 'high' ? 'bg-[#FF2F92] text-white' :
                    task.priority === 'medium' ? 'bg-[#FFD83D] text-[#171717]' :
                    'bg-[#B8A0F0] text-[#171717]'

                  const allowedToToggle = canToggleTask(task)
                  const isCurrentToggling = togglingTaskId === task.id

                  return (
                    <div 
                      key={task.id}
                      className={`p-2.5 border border-neutral-200 rounded-md flex items-center justify-between gap-3 transition-all ${
                        task.is_completed ? 'bg-neutral-100 opacity-65' : 'bg-[#FAF7F2] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => allowedToToggle && handleToggleTask(task.id)}
                          disabled={!allowedToToggle || isCurrentToggling}
                          title={
                            allowedToToggle 
                              ? (task.is_completed ? 'Tandai belum selesai' : 'Tandai selesai') 
                              : 'Hanya PIC tugas atau Admin/PM yang dapat mengubah status'
                          }
                          className={`w-5 h-5 border border-[#171717] rounded flex items-center justify-center shrink-0 transition-transform ${
                            allowedToToggle ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-not-allowed opacity-75'
                          } ${
                            task.is_completed ? 'bg-[#10B981] text-white' : 'bg-white'
                          }`}
                        >
                          {isCurrentToggling ? (
                            <Loader2 size={11} className="animate-spin text-[#171717]" />
                          ) : task.is_completed ? (
                            <Check size={12} strokeWidth={3} />
                          ) : null}
                        </button>

                        <div className="min-w-0">
                          <p className={`text-xs font-bold text-[#171717] leading-tight truncate ${task.is_completed ? 'line-through text-[#171717]/50' : ''}`}>
                            {task.title}
                          </p>
                          <p className="text-[9.5px] font-semibold text-[#171717]/60 mt-0.5">
                            PIC: {task.assignee_name || 'Belum Ditugaskan'} • Deadline: {task.deadline ? new Date(task.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—'}
                          </p>
                        </div>
                      </div>

                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 border border-[#171717] rounded-sm shrink-0 ${priorityBadge}`}>
                        {task.priority}
                      </span>
                    </div>
                  )
                })}

                {tasks.length > 5 && (
                  <div className="pt-2 border-t border-[#171717]/15 flex items-center justify-between text-[11px] mt-2">
                    <span className="text-[#171717]/65 font-bold">
                      Menampilkan 5 dari {tasks.length} tugas
                    </span>
                    <Link 
                      to={`/tasks?project_id=${project.id}`}
                      className="font-black text-[#FF2F92] hover:underline flex items-center gap-1 text-[10.5px]"
                    >
                      <span>Lihat Semua {tasks.length} Tugas →</span>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section: Related Milestones */}
          <div className="bg-white p-4 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
            <div className="flex items-center justify-between border-b border-[#171717]/15 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <MilestoneIcon size={18} className="text-[#FFD83D]" />
                <h3 className="font-display text-sm uppercase tracking-tight text-[#171717]">
                  Fase Milestone ({milestones.length} Tahapan)
                </h3>
              </div>
              <Link
                to="/development"
                className="text-[10px] font-black text-[#FF2F92] hover:underline"
              >
                Development Tracker →
              </Link>
            </div>

            {milestones.length === 0 ? (
              <div className="py-8 px-4 text-center bg-[#FAF7F2] border-2 border-dashed border-[#171717]/25 rounded-lg space-y-2">
                <MilestoneIcon size={28} className="mx-auto text-[#171717]/40" />
                <p className="text-xs font-bold text-[#171717]">Belum ada tahapan milestone</p>
                <p className="text-[10px] text-[#171717]/60 max-w-sm mx-auto">
                  Roadmap dan fase milestone proyek dapat dipantau melalui Development Tracker.
                </p>
                <div className="pt-1">
                  <Link
                    to="/development"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFD83D] text-[#171717] text-[10px] font-black uppercase rounded border border-[#171717] shadow-[2px_2px_0px_#171717] hover:bg-[#ffe26e]"
                  >
                    <span>Buka Development Tracker</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {milestones.slice(0, 5).map((ms) => {
                  const isDone = ms.status === 'completed' || ms.progress === 100
                  return (
                    <div 
                      key={ms.id}
                      className="p-3 border border-neutral-200 rounded-md bg-[#FAF7F2] space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded bg-white border border-[#171717] flex items-center justify-center font-display font-black text-[10px] text-[#171717] shrink-0">
                            {ms.phase_order}
                          </span>
                          <p className="font-black text-xs text-[#171717] truncate leading-tight">
                            {ms.title}
                          </p>
                        </div>
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 border border-[#171717] rounded-sm ${
                          isDone ? 'bg-[#10B981] text-white' : 'bg-[#FFD83D] text-[#171717]'
                        }`}>
                          {ms.status || (isDone ? 'completed' : 'in_progress')}
                        </span>
                      </div>

                      {ms.description && (
                        <p className="text-[10px] text-[#171717]/70 font-semibold pl-7">
                          {ms.description}
                        </p>
                      )}

                      <div className="pl-7 flex items-center gap-3">
                        <div className="flex-1 bg-neutral-200 h-1.5 rounded-full overflow-hidden border border-[#171717]/20">
                          <div 
                            className={`h-full ${isDone ? 'bg-[#10B981]' : 'bg-[#FFD83D]'}`}
                            style={{ width: `${ms.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-[9px] font-black text-[#171717] shrink-0">
                          {ms.progress}%
                        </span>
                      </div>
                    </div>
                  )
                })}

                {milestones.length > 5 && (
                  <div className="pt-2 border-t border-[#171717]/15 flex items-center justify-between text-[11px] mt-2">
                    <span className="text-[#171717]/65 font-bold">
                      Menampilkan 5 dari {milestones.length} tahapan milestone
                    </span>
                    <Link 
                      to="/development"
                      className="font-black text-[#FF2F92] hover:underline flex items-center gap-1 text-[10.5px]"
                    >
                      <span>Buka Development Tracker →</span>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Information & Audit Trail */}
        <div className="lg:col-span-4 space-y-4">
          {/* Project Details Box */}
          <div className="bg-white p-4 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] space-y-3">
            <h3 className="font-display text-xs uppercase tracking-wider text-[#171717] border-b border-[#171717]/15 pb-2">
              Informasi Spesifikasi
            </h3>
            
            <div className="space-y-2 text-xs font-semibold text-[#171717]/80">
              <div className="flex justify-between items-center py-1 border-b border-neutral-100">
                <span className="text-[10px] uppercase text-[#171717]/60">Kode Referensi</span>
                <span className="font-mono font-bold text-[#171717]">{project.code}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-neutral-100">
                <span className="text-[10px] uppercase text-[#171717]/60">Klien Mitra</span>
                <span className="font-bold text-[#171717]">{project.client}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-neutral-100">
                <span className="text-[10px] uppercase text-[#171717]/60">Penanggung Jawab (PIC)</span>
                <span className="font-bold text-[#FF2F92] flex items-center gap-1">
                  <User size={12} className="text-[#171717]" />
                  <span>{project.pic_name || project.pic?.name || 'Belum Ditugaskan'}</span>
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-neutral-100">
                <span className="text-[10px] uppercase text-[#171717]/60">Kategori Sistem</span>
                <span className="font-bold uppercase text-[#171717] flex items-center gap-1">
                  <CategoryIcon cat={project.category} />
                  <span>{project.category}</span>
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-neutral-100">
                <span className="text-[10px] uppercase text-[#171717]/60">Dibuat Pada</span>
                <span className="font-bold text-[#171717]">
                  {project.created_at ? new Date(project.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[10px] uppercase text-[#171717]/60">Terakhir Update</span>
                <span className="font-bold text-[#171717]">
                  {project.updated_at ? new Date(project.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Audit / Recent Activities for this Project */}
          <div className="bg-white p-4 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
            <div className="flex items-center gap-2 border-b border-[#171717]/15 pb-2 mb-3">
              <ActivityIcon size={16} className="text-[#FF2F92]" />
              <h3 className="font-display text-xs uppercase tracking-wider text-[#171717]">
                Log Aktivitas Proyek
              </h3>
            </div>

            {activities.length === 0 ? (
              <p className="py-6 text-center text-xs font-semibold text-[#171717]/50">
                Belum ada catatan aktivitas tercatat untuk proyek ini.
              </p>
            ) : (
              <div className="space-y-2.5">
                {activities.map((act) => (
                  <div key={act.id} className="p-2 bg-[#FAF7F2] border border-[#171717]/20 rounded text-xs">
                    <p className="font-bold text-[#171717] leading-tight">
                      <strong className="text-[#FF2F92]">{act.user_name}</strong> {act.action}
                    </p>
                    <p className="text-[9px] font-semibold text-[#171717]/50 mt-1">
                      {act.created_at ? new Date(act.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Baru saja'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal Component */}
      {showEditModal && (
        <div className="fixed inset-0 bg-[#171717]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#171717] rounded-lg shadow-[6px_6px_0px_#171717] w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#171717]/15 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#FFD83D] border border-[#171717]"></span>
                <h3 className="font-display text-lg uppercase tracking-tight text-[#171717]">
                  EDIT PROYEK — {project.code}
                </h3>
              </div>
              <button 
                onClick={() => setShowEditModal(false)}
                className="p-1 hover:bg-[#FFD83D] border border-[#171717] rounded cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">
                  Nama Proyek <span className="text-[#FF2F92]">*</span>
                </label>
                <input 
                  type="text" 
                  required 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full pkm-input ${formErrors.name ? 'border-[#FF2F92]' : ''}`}
                />
                {formErrors.name && (
                  <p className="text-[10px] font-bold text-[#FF2F92] mt-1">{formErrors.name[0]}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">
                    Kode Proyek <span className="text-[#FF2F92]">*</span>
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className={`w-full pkm-input uppercase ${formErrors.code ? 'border-[#FF2F92]' : ''}`}
                  />
                  {formErrors.code && (
                    <p className="text-[10px] font-bold text-[#FF2F92] mt-1">{formErrors.code[0]}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Kategori</label>
                  <select 
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full pkm-input"
                  >
                    <option value="web">Web Application</option>
                    <option value="mobile">Mobile Application</option>
                    <option value="system">Internal System</option>
                    <option value="code">API & Backend</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">
                    Nama Klien / Instansi <span className="text-[#FF2F92]">*</span>
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={formData.client}
                    onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                    className={`w-full pkm-input ${formErrors.client ? 'border-[#FF2F92]' : ''}`}
                  />
                  {formErrors.client && (
                    <p className="text-[10px] font-bold text-[#FF2F92] mt-1">{formErrors.client[0]}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">
                    Penanggung Jawab (PIC Proyek)
                  </label>
                  <select
                    value={formData.pic_id}
                    onChange={(e) => setFormData({ ...formData, pic_id: e.target.value })}
                    className="w-full pkm-input"
                  >
                    <option value="">Pilih Anggota Tim / PIC...</option>
                    {teamMembers.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Status Proyek</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full pkm-input"
                  >
                    <option value="on_track">On Track</option>
                    <option value="at_risk">At Risk</option>
                    <option value="delayed">Delayed</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Tingkat Risiko</label>
                  <select 
                    value={formData.risk_level}
                    onChange={(e) => setFormData({ ...formData, risk_level: e.target.value })}
                    className="w-full pkm-input"
                  >
                    <option value="none">None</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="p-2.5 bg-[#F5F1E9] border border-[#171717] rounded text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-[#171717]">Progres Aktual (Auto)</span>
                  <span className="font-mono font-black text-sm text-[#FF2F92]">{project.progress ?? 0}%</span>
                </div>
                <p className="text-[10px] text-[#171717]/70">
                  Dihitung otomatis dari tugas yang selesai ({completedTasksCount} dari {tasks.length} tugas).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Target Progres (%)</label>
                  <input 
                    type="number" 
                    min="0"
                    max="100"
                    value={formData.target_progress}
                    onChange={(e) => setFormData({ ...formData, target_progress: e.target.value })}
                    className="w-full pkm-input"
                    placeholder="Contoh: 80"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Target Deadline</label>
                  <input 
                    type="date" 
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full pkm-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Catatan Risiko / Kendala</label>
                <input 
                  type="text" 
                  value={formData.risk_factor}
                  onChange={(e) => setFormData({ ...formData, risk_factor: e.target.value })}
                  placeholder="Contoh: Menunggu review dari klien" 
                  className="w-full pkm-input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#171717]/15">
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)}
                  className="pkm-btn-outline"
                  disabled={submitting}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="pkm-btn-pink flex items-center gap-1.5"
                  disabled={submitting}
                >
                  {submitting && <Loader2 size={13} className="animate-spin" />}
                  <span>{submitting ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-[#171717]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#171717] rounded-lg shadow-[6px_6px_0px_#171717] w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-2 text-[#FF2F92] border-b border-[#171717]/15 pb-2">
              <AlertTriangle size={20} strokeWidth={2.5} />
              <h3 className="font-display text-lg uppercase tracking-tight text-[#171717]">
                KONFIRMASI HAPUS PROYEK
              </h3>
            </div>

            <div className="space-y-2 text-xs font-semibold text-[#171717]/85">
              <p>
                Apakah Anda yakin ingin menghapus proyek <strong className="text-[#171717]">{project.name}</strong> ({project.code})?
              </p>
              <div className="p-3 bg-[#FFD83D]/40 border border-[#171717]/25 rounded text-[11px] text-[#171717] space-y-1">
                <p className="font-black">⚠️ Peringatan Relasi Database:</p>
                <p>
                  Proyek ini memiliki <strong>{tasks.length} tugas</strong> dan <strong>{milestones.length} tahapan milestone</strong> yang akan ikut terhapus secara permanen dari basis data.
                </p>
                <p className="text-[10px] text-[#171717]/75">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#171717]/15">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="pkm-btn-outline"
                disabled={submitting}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-[#FF2F92] hover:bg-[#e0267d] text-white font-black text-xs uppercase rounded border border-[#171717] shadow-[2px_2px_0px_#171717] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submitting && <Loader2 size={13} className="animate-spin" />}
                <span>{submitting ? 'Menghapus...' : 'Ya, Hapus Proyek'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
