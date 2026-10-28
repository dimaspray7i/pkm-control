import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { Check, Clock, AlertTriangle, Search, Loader2, RotateCcw, CheckSquare, Filter, Plus, Calendar, Edit3, Trash2, X } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../contexts/AuthContext'

const PRIORITY_CONFIG = {
  high:   { label: 'High',   bg: 'bg-[#FF2F92] text-white border-[#171717]' },
  medium: { label: 'Medium', bg: 'bg-[#FFD83D] text-[#171717] border-[#171717]' },
  low:    { label: 'Low',    bg: 'bg-[#B8A0F0] text-[#171717] border-[#171717]' },
}

export default function Tasks() {
  const { user } = useAuth()
  const canManage = user?.role === 'admin' || user?.role === 'project_manager'

  const [tasks, setTasks]         = useState([])
  const [projects, setProjects]   = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [searchParams] = useSearchParams()
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [search, setSearch]       = useState(searchParams.get('search') || '')
  const [filter, setFilter]       = useState(searchParams.get('filter') || 'all') // all | high | medium | low | completed | overdue
  const [projectFilter, setProjectFilter] = useState(searchParams.get('project_id') || 'all')
  const [toggling, setToggling]   = useState(null)

  useEffect(() => {
    const q = searchParams.get('search')
    const f = searchParams.get('filter')
    const p = searchParams.get('project_id')
    if (q !== null) setSearch(q)
    if (f !== null) setFilter(f)
    if (p !== null) setProjectFilter(p)
  }, [searchParams])

  // Modals state
  const [isAddOpen, setIsAddOpen]       = useState(false)
  const [isEditOpen, setIsEditOpen]     = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [submitting, setSubmitting]     = useState(false)
  const [formErrors, setFormErrors]     = useState({})
  const [feedback, setFeedback]         = useState(null)

  // Form fields
  const [formData, setFormData] = useState({
    title: '',
    project_id: '',
    priority: 'medium',
    status: 'pending',
    deadline: '',
    assignee_name: '',
  })

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const [resTasks, resProjects, resTeam] = await Promise.all([
        api.get('/tasks'),
        api.get('/projects'),
        api.get('/team').catch(() => ({ data: { team: [] } })),
      ])
      setTasks(resTasks.data.tasks || [])
      setProjects(resProjects.data.projects || [])
      setTeamMembers(resTeam.data.team || [])
      setError(null)
    } catch {
      setError('Gagal memuat tugas dari server backend.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTasks() }, [])

  const handleToggle = async (taskId) => {
    setToggling(taskId)
    try {
      const res = await api.post(`/tasks/${taskId}/toggle`)
      const updated = res.data.task
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, is_completed: updated.is_completed, status: updated.status } : t
      ))
    } catch {
      alert('Gagal memperbarui status tugas.')
    } finally {
      setToggling(null)
    }
  }

  const openAddModal = () => {
    setFormData({
      title: '',
      project_id: projects.length > 0 ? String(projects[0].id) : '',
      priority: 'medium',
      status: 'pending',
      deadline: '',
      assignee_name: teamMembers.length > 0 ? teamMembers[0].name : (user?.name || ''),
    })
    setFormErrors({})
    setIsAddOpen(true)
  }

  const openEditModal = (task) => {
    setSelectedTask(task)
    setFormData({
      title: task.title,
      project_id: String(task.project_id),
      priority: task.priority || 'medium',
      status: task.status || (task.is_completed ? 'completed' : 'pending'),
      deadline: task.deadline ? task.deadline.split('T')[0] : '',
      assignee_name: task.assignee_name || '',
    })
    setFormErrors({})
    setIsEditOpen(true)
  }

  const openDeleteModal = (task) => {
    setSelectedTask(task)
    setIsDeleteOpen(false)
    setTimeout(() => setIsDeleteOpen(true), 10)
  }

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setFormErrors({})

    try {
      const payload = {
        title: formData.title,
        project_id: parseInt(formData.project_id),
        priority: formData.priority,
        status: formData.status,
        deadline: formData.deadline || null,
        assignee_name: formData.assignee_name || null,
        is_completed: formData.status === 'completed',
      }
      const res = await api.post('/tasks', payload)
      setTasks(prev => [res.data.task, ...prev])
      setIsAddOpen(false)
      setFeedback({ type: 'success', message: 'Tugas baru berhasil ditambahkan ke database!' })
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        setFormErrors(err.response.data.errors)
      } else {
        setFormErrors({ general: [err.response?.data?.message || 'Gagal menyimpan tugas baru.'] })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateSubmit = async (e) => {
    e.preventDefault()
    if (!selectedTask) return
    setSubmitting(true)
    setFormErrors({})

    try {
      const payload = {
        title: formData.title,
        project_id: parseInt(formData.project_id),
        priority: formData.priority,
        status: formData.status,
        deadline: formData.deadline || null,
        assignee_name: formData.assignee_name || null,
        is_completed: formData.status === 'completed',
      }
      const res = await api.put(`/tasks/${selectedTask.id}`, payload)
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? res.data.task : t))
      setIsEditOpen(false)
      setFeedback({ type: 'success', message: 'Data tugas berhasil diperbarui!' })
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        setFormErrors(err.response.data.errors)
      } else {
        setFormErrors({ general: [err.response?.data?.message || 'Gagal memperbarui tugas.'] })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteSubmit = async () => {
    if (!selectedTask) return
    setSubmitting(true)

    try {
      await api.delete(`/tasks/${selectedTask.id}`)
      setTasks(prev => prev.filter(t => t.id !== selectedTask.id))
      setIsDeleteOpen(false)
      setFeedback({ type: 'success', message: `Tugas "${selectedTask.title}" berhasil dihapus dari sistem.` })
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus tugas.')
    } finally {
      setSubmitting(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  const filtered = tasks.filter(t => {
    const matchSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.assignee_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.project?.name || '').toLowerCase().includes(search.toLowerCase())
    
    const matchProject = projectFilter === 'all' || String(t.project_id) === String(projectFilter)

    const matchFilter =
      filter === 'all'       ? true :
      filter === 'completed' ? t.is_completed :
      filter === 'overdue'   ? (!t.is_completed && t.deadline && t.deadline < today) :
      t.priority === filter && !t.is_completed

    return matchSearch && matchProject && matchFilter
  })

  const counts = {
    all:       tasks.length,
    high:      tasks.filter(t => t.priority === 'high' && !t.is_completed).length,
    medium:    tasks.filter(t => t.priority === 'medium' && !t.is_completed).length,
    low:       tasks.filter(t => t.priority === 'low' && !t.is_completed).length,
    completed: tasks.filter(t => t.is_completed).length,
    overdue:   tasks.filter(t => !t.is_completed && t.deadline && t.deadline < today).length,
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <Loader2 size={32} className="animate-spin text-[#FF2F92]" />
      <p className="font-display text-lg uppercase tracking-wider text-[#171717]">MEMUAT DAFTAR TUGAS DARI DATABASE...</p>
    </div>
  )

  if (error) return (
    <div className="p-6 bg-[#FFD83D] border border-[#171717] rounded-md shadow-[4px_4px_0px_#171717] max-w-md my-8">
      <h2 className="font-display text-xl uppercase mb-2">Gagal Memuat</h2>
      <p className="text-xs font-semibold mb-3">{error}</p>
      <button onClick={fetchTasks} className="px-3.5 py-1.5 bg-[#171717] text-white font-bold text-xs uppercase flex items-center gap-1.5 rounded cursor-pointer">
        <RotateCcw size={13} /> Coba Lagi
      </button>
    </div>
  )

  return (
    <div className="space-y-4 pb-4">
      {/* Feedback Banner */}
      {feedback && (
        <div className="p-3 bg-[#10B981]/20 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center justify-between">
          <p className="text-xs font-black text-[#171717]">{feedback.message}</p>
          <button onClick={() => setFeedback(null)} className="text-[#171717] font-bold text-xs">✕</button>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="MANAJEMEN TUGAS"
        subtitle="Daftar tugas operasional, target penyelesaian, dan delegasi tim PKM."
        tag="TUGAS TIM"
        actions={
          <div className="flex items-center gap-2">
            <div className="bg-white px-3 py-1.5 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center gap-2">
              <CheckSquare size={15} className="text-[#FF2F92]" />
              <span className="font-black text-xs uppercase">{counts.completed} / {counts.all} Selesai</span>
            </div>
            {canManage && (
              <button
                onClick={openAddModal}
                className="pkm-btn-pink flex items-center gap-1.5 text-xs font-black uppercase"
              >
                <Plus size={15} /> Tambah Tugas
              </button>
            )}
          </div>
        }
      />

      {/* Filter and Search Toolbar */}
      <div className="bg-white p-3 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search & Project Dropdown */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#171717]/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari tugas, PIC, atau nama proyek..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#FAF7F2] border border-[#171717]/40 rounded text-xs font-semibold text-[#171717] placeholder:text-[#171717]/40 focus:outline-none focus:border-[#FF2F92]"
            />
          </div>

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FAF7F2] border border-[#171717]/40 rounded text-xs font-semibold text-[#171717] focus:outline-none focus:border-[#FF2F92]"
          >
            <option value="all">Semua Proyek ({projects.length})</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
            ))}
          </select>
        </div>

        {/* Priority Filter Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all',       label: 'Semua',     count: counts.all },
            { id: 'high',      label: 'High',      count: counts.high },
            { id: 'medium',    label: 'Medium',    count: counts.medium },
            { id: 'low',       label: 'Low',       count: counts.low },
            { id: 'overdue',   label: 'Overdue',   count: counts.overdue },
            { id: 'completed', label: 'Selesai',   count: counts.completed },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`px-2.5 py-1 text-[10.5px] font-black uppercase rounded border transition-all cursor-pointer ${
                filter === item.id
                  ? 'bg-[#171717] text-white border-[#171717] shadow-[1px_1px_0px_#171717]'
                  : 'bg-white text-[#171717] border-[#171717]/30 hover:border-[#171717]'
              }`}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      {filtered.length === 0 ? (
        <div className="p-8 bg-white border border-[#171717] rounded-lg text-center space-y-2">
          <CheckSquare size={32} className="mx-auto text-[#171717]/40" />
          <h3 className="font-display text-lg uppercase text-[#171717]">Tidak Ada Tugas</h3>
          <p className="text-xs text-[#171717]/60 max-w-sm mx-auto">
            Tidak ditemukan tugas dengan filter atau kata kunci yang dipilih.
          </p>
          <button
            onClick={() => { setSearch(''); setFilter('all'); setProjectFilter('all') }}
            className="pkm-btn-outline mt-2"
          >
            Reset Filter
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => {
            const isOverdue = !task.is_completed && task.deadline && task.deadline < today
            const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium

            return (
              <div
                key={task.id}
                className={`p-3.5 bg-white border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center justify-between gap-3 transition-all ${
                  task.is_completed ? 'opacity-65 bg-[#FAF7F2]' : 'hover:-translate-x-0.5 hover:shadow-[3px_3px_0px_#171717]'
                }`}
              >
                {/* Left: Checkbox + Title + Project */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    onClick={() => handleToggle(task.id)}
                    disabled={toggling === task.id}
                    className={`w-5 h-5 rounded border border-[#171717] flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                      task.is_completed ? 'bg-[#10B981] text-white' : 'bg-white hover:bg-[#FFD83D]'
                    }`}
                    title={task.is_completed ? "Tandai belum selesai" : "Tandai selesai"}
                  >
                    {task.is_completed && <Check size={13} strokeWidth={3} />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-black text-[#171717] truncate leading-tight ${
                      task.is_completed ? 'line-through text-[#171717]/50' : ''
                    }`}>
                      {task.title}
                    </p>
                    <p className="text-[10px] font-semibold text-[#171717]/60 truncate mt-0.5">
                      Proyek: <span className="font-bold text-[#171717]/80">{task.project?.name || 'PKM Project'}</span> · PIC: <span className="font-bold text-[#171717]/80">{task.assignee_name || 'Tim PKM'}</span>
                    </p>
                  </div>
                </div>

                {/* Right: Deadline + Priority Badge + Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {task.deadline && (
                    <div className={`flex items-center gap-1 text-[10px] font-bold ${
                      isOverdue ? 'text-[#FF2F92]' : 'text-[#171717]/65'
                    }`}>
                      <Calendar size={12} />
                      <span>{new Date(task.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                      {isOverdue && <span className="text-[8px] font-black uppercase text-[#FF2F92]">(Lewat)</span>}
                    </div>
                  )}

                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-sm border ${priority.bg}`}>
                    {priority.label}
                  </span>

                  {canManage && (
                    <div className="flex items-center gap-1 ml-1 border-l border-[#171717]/20 pl-2">
                      <button
                        onClick={() => openEditModal(task)}
                        className="p-1 hover:bg-[#FFD83D] border border-transparent hover:border-[#171717] rounded text-[#171717] transition-all cursor-pointer"
                        title="Edit Tugas"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => openDeleteModal(task)}
                        className="p-1 hover:bg-[#FF2F92] hover:text-white border border-transparent hover:border-[#171717] rounded text-[#171717] transition-all cursor-pointer"
                        title="Hapus Tugas"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL: Tambah Tugas */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-[#171717]/60 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-[#171717] rounded-lg shadow-[6px_6px_0px_#171717] w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b-1.5 border-[#171717] pb-3">
              <div>
                <h3 className="font-display text-xl uppercase tracking-wider text-[#171717]">Tambah Tugas Baru</h3>
                <p className="text-[11px] font-semibold text-[#171717]/60">Tambahkan pekerjaan operasional ke dalam database proyek</p>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="text-[#171717] hover:text-[#FF2F92]">
                <X size={20} />
              </button>
            </div>

            {formErrors.general && (
              <div className="p-2.5 bg-[#FF2F92]/20 border border-[#FF2F92] rounded text-xs font-bold text-[#FF2F92]">
                {formErrors.general[0]}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">Judul Tugas *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Misal: Implementasi OAuth Google Login"
                  className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                />
                {formErrors.title && <p className="text-[10px] text-[#FF2F92] font-bold mt-0.5">{formErrors.title[0]}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">Proyek Terkait *</label>
                  <select
                    required
                    value={formData.project_id}
                    onChange={e => setFormData({ ...formData, project_id: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                  >
                    <option value="">-- Pilih Proyek --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                    ))}
                  </select>
                  {formErrors.project_id && <p className="text-[10px] text-[#FF2F92] font-bold mt-0.5">{formErrors.project_id[0]}</p>}
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">Prioritas</label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                  >
                    <option value="high">High (Mendesak)</option>
                    <option value="medium">Medium (Standar)</option>
                    <option value="low">Low (Rendah)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">PIC / Pelaksana</label>
                  <input
                    type="text"
                    value={formData.assignee_name}
                    onChange={e => setFormData({ ...formData, assignee_name: e.target.value })}
                    placeholder="Nama PIC (misal: Budi Santoso)"
                    className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">Batas Waktu (Deadline)</label>
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">Status Pengerjaan</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                >
                  <option value="pending">Pending (Belum Dikerjakan)</option>
                  <option value="in_progress">In Progress (Sedang Berjalan)</option>
                  <option value="completed">Completed (Tuntas)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#171717]/20">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-3 py-1.5 bg-white border border-[#171717] rounded text-xs font-black uppercase text-[#171717] hover:bg-neutral-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="pkm-btn-pink flex items-center gap-1.5 text-xs font-black uppercase disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Simpan Tugas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Tugas */}
      {isEditOpen && selectedTask && (
        <div className="fixed inset-0 z-50 bg-[#171717]/60 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-[#171717] rounded-lg shadow-[6px_6px_0px_#171717] w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b-1.5 border-[#171717] pb-3">
              <div>
                <h3 className="font-display text-xl uppercase tracking-wider text-[#171717]">Edit Data Tugas</h3>
                <p className="text-[11px] font-semibold text-[#171717]/60">Perbarui rincian tugas ID #{selectedTask.id}</p>
              </div>
              <button onClick={() => setIsEditOpen(false)} className="text-[#171717] hover:text-[#FF2F92]">
                <X size={20} />
              </button>
            </div>

            {formErrors.general && (
              <div className="p-2.5 bg-[#FF2F92]/20 border border-[#FF2F92] rounded text-xs font-bold text-[#FF2F92]">
                {formErrors.general[0]}
              </div>
            )}

            <form onSubmit={handleUpdateSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">Judul Tugas *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">Proyek Terkait</label>
                  <select
                    value={formData.project_id}
                    onChange={e => setFormData({ ...formData, project_id: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">Prioritas</label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                  >
                    <option value="high">High (Mendesak)</option>
                    <option value="medium">Medium (Standar)</option>
                    <option value="low">Low (Rendah)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">PIC / Pelaksana</label>
                  <input
                    type="text"
                    value={formData.assignee_name}
                    onChange={e => setFormData({ ...formData, assignee_name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">Batas Waktu (Deadline)</label>
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">Status Pengerjaan</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                >
                  <option value="pending">Pending (Belum Dikerjakan)</option>
                  <option value="in_progress">In Progress (Sedang Berjalan)</option>
                  <option value="completed">Completed (Tuntas)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#171717]/20">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-3 py-1.5 bg-white border border-[#171717] rounded text-xs font-black uppercase text-[#171717] hover:bg-neutral-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="pkm-btn-pink flex items-center gap-1.5 text-xs font-black uppercase disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Hapus Tugas */}
      {isDeleteOpen && selectedTask && (
        <div className="fixed inset-0 z-50 bg-[#171717]/60 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-[#171717] rounded-lg shadow-[6px_6px_0px_#171717] w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FF2F92]/20 border border-[#FF2F92] flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-[#FF2F92]" />
              </div>
              <div>
                <h3 className="font-display text-xl uppercase tracking-wider text-[#171717]">Hapus Tugas?</h3>
                <p className="text-[11px] font-semibold text-[#171717]/60">Tindakan ini permanen dan menghapus catatan tugas.</p>
              </div>
            </div>

            <div className="p-3 bg-white border border-[#171717] rounded text-xs">
              <p className="font-black text-[#171717]">{selectedTask.title}</p>
              <p className="text-[10px] text-[#171717]/60 mt-1">
                Proyek: {selectedTask.project?.name || '-'} · PIC: {selectedTask.assignee_name || '-'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#171717]/20">
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                className="px-3 py-1.5 bg-white border border-[#171717] rounded text-xs font-black uppercase text-[#171717] hover:bg-neutral-100"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteSubmit}
                disabled={submitting}
                className="px-4 py-1.5 bg-[#FF2F92] text-white border border-[#171717] rounded shadow-[2px_2px_0px_#171717] text-xs font-black uppercase flex items-center gap-1.5 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
