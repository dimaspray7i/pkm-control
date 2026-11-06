import { useState, useEffect } from 'react'
import api from '../services/api'
import {
  Globe, Laptop, Smartphone, Clock, TrendingUp, Loader2, RotateCcw,
  Terminal, CheckCircle2, Circle, AlertCircle, Calendar, Users,
  BarChart3, Edit3, Plus, X, Check, Trash2, ListTodo, AlertTriangle
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../contexts/AuthContext'

const STATUS_CONFIG = {
  on_track:  { label: 'On Track',  bg: 'bg-[#10B981] text-white',       bar: 'bg-[#10B981]', accent: '#10B981' },
  at_risk:   { label: 'At Risk',   bg: 'bg-[#FFD83D] text-[#171717]',   bar: 'bg-[#FBBF24]', accent: '#FBBF24' },
  delayed:   { label: 'Delayed',   bg: 'bg-[#FF2F92] text-white',       bar: 'bg-[#FF2F92]', accent: '#FF2F92' },
  completed: { label: 'Completed', bg: 'bg-[#B8A0F0] text-[#171717]',   bar: 'bg-[#B8A0F0]', accent: '#B8A0F0' },
}

const CategoryIcon = ({ cat, size = 14 }) => {
  if (cat === 'mobile') return <Smartphone size={size} />
  if (cat === 'system') return <Laptop size={size} />
  return <Globe size={size} />
}

const PhaseStatusIcon = ({ status }) => {
  if (status === 'completed')   return <CheckCircle2 size={15} className="text-[#10B981]" />
  if (status === 'in_progress') return <AlertCircle size={15} className="text-[#FFD83D]" />
  return <Circle size={15} className="text-[#171717]/30" />
}

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
  const parts = clean.split('-')
  if (parts.length === 3) {
    const d = new Date(parts[0], parts[1] - 1, parts[2])
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  return dateStr
}

export default function Development() {
  const { user } = useAuth()
  const canManage = user?.role === 'admin' || user?.role === 'project_manager'

  const [projects, setProjects]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [activeId, setActiveId]       = useState(null)

  // Real milestones from DB
  const [milestones, setMilestones]   = useState([])
  const [loadingMilestones, setLoadingMilestones] = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [feedback, setFeedback]       = useState(null)

  // Modals state
  const [isCreatingSprint, setIsCreatingSprint] = useState(false)
  const [editingMilestone, setEditingMilestone]   = useState(null)
  const [deletingMilestone, setDeletingMilestone] = useState(null)
  const [viewingSprintTasks, setViewingSprintTasks] = useState(null)
  const [modalError, setModalError]   = useState(null)

  // Handle Escape key to close any open modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isCreatingSprint) setIsCreatingSprint(false)
        if (editingMilestone) setEditingMilestone(null)
        if (deletingMilestone) setDeletingMilestone(null)
        if (viewingSprintTasks) setViewingSprintTasks(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isCreatingSprint, editingMilestone, deletingMilestone, viewingSprintTasks])

  // Create Milestone Form
  const [createForm, setCreateForm] = useState({
    title: '',
    project_id: '',
    description: '',
    start_date: '',
    due_date: '',
    status: 'pending',
  })

  // Edit Milestone Form
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    start_date: '',
    due_date: '',
    progress: 0,
    status: 'in_progress',
  })

  const fetchProjects = async (keepActiveId = false) => {
    try {
      setLoading(true)
      const res = await api.get('/projects')
      const all = res.data.projects || []
      setProjects(all)
      if (all.length > 0) {
        const targetId = keepActiveId && activeId ? activeId : all[0].id
        setActiveId(targetId)
        fetchMilestones(targetId)
      }
      setError(null)
    } catch {
      setError('Gagal memuat data dari server backend.')
    } finally {
      setLoading(false)
    }
  }

  const fetchMilestones = async (projectId) => {
    if (!projectId) return
    try {
      setLoadingMilestones(true)
      const res = await api.get(`/projects/${projectId}/milestones`)
      const list = res.data.data || []
      setMilestones(list)

      // Update viewingSprintTasks if currently open
      if (viewingSprintTasks) {
        const updatedSprint = list.find(m => m.id === viewingSprintTasks.id)
        if (updatedSprint) setViewingSprintTasks(updatedSprint)
      }

      if (res.data.project) {
        setProjects(prev => prev.map(p => p.id === projectId ? {
          ...p,
          progress: res.data.project.progress,
          status: res.data.project.status
        } : p))
      }
    } catch {
      console.error('Failed to load milestones')
    } finally {
      setLoadingMilestones(false)
    }
  }

  useEffect(() => { fetchProjects() }, [])

  const handleSelectProject = (projectId) => {
    setActiveId(projectId)
    fetchMilestones(projectId)
  }

  // Open Create Sprint Modal
  const openCreateModal = () => {
    setModalError(null)
    setCreateForm({
      title: '',
      project_id: activeId || (projects[0]?.id || ''),
      description: '',
      start_date: new Date().toISOString().split('T')[0],
      due_date: '',
      status: 'pending',
    })
    setIsCreatingSprint(true)
  }

  // Submit Create Sprint
  const handleCreateSprint = async (e) => {
    e.preventDefault()
    setModalError(null)

    if (!createForm.title.trim()) {
      setModalError('Nama Sprint wajib diisi.')
      return
    }

    if (!createForm.project_id) {
      setModalError('Proyek induk wajib dipilih.')
      return
    }

    if (createForm.start_date && createForm.due_date && createForm.due_date < createForm.start_date) {
      setModalError('Tanggal selesai tidak boleh lebih awal daripada tanggal mulai.')
      return
    }

    setSubmitting(true)
    try {
      const res = await api.post(`/projects/${createForm.project_id}/milestones`, {
        title: createForm.title.trim(),
        description: createForm.description.trim() || null,
        start_date: createForm.start_date || null,
        due_date: createForm.due_date || null,
        status: createForm.status,
      })

      const targetProjectId = parseInt(createForm.project_id)
      setIsCreatingSprint(false)
      setActiveId(targetProjectId)
      await fetchMilestones(targetProjectId)

      // Refresh all projects
      const resProj = await api.get('/projects')
      setProjects(resProj.data.projects || [])

      setFeedback({ type: 'success', message: `Sprint "${res.data.data.title}" berhasil dibuat!` })
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      setModalError(err.response?.data?.message || 'Gagal membuat sprint baru.')
    } finally {
      setSubmitting(false)
    }
  }

  // Open Edit Sprint Modal
  const openEditModal = (ms) => {
    setModalError(null)
    setEditingMilestone(ms)
    setEditForm({
      title: ms.title,
      description: ms.description || '',
      start_date: ms.start_date ? ms.start_date.split('T')[0] : '',
      due_date: ms.due_date ? ms.due_date.split('T')[0] : '',
      progress: ms.progress ?? 0,
      status: ms.status || 'in_progress',
    })
  }

  // Submit Edit Sprint
  const handleUpdateMilestone = async (e) => {
    e.preventDefault()
    if (!editingMilestone) return
    setModalError(null)

    if (editForm.start_date && editForm.due_date && editForm.due_date < editForm.start_date) {
      setModalError('Tanggal selesai tidak boleh lebih awal daripada tanggal mulai.')
      return
    }

    setSubmitting(true)
    try {
      await api.put(`/milestones/${editingMilestone.id}`, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        start_date: editForm.start_date || null,
        due_date: editForm.due_date || null,
        progress: parseInt(editForm.progress),
        status: editForm.status,
      })

      // Refresh sprint list & projects
      await fetchMilestones(activeId)
      const resProj = await api.get('/projects')
      setProjects(resProj.data.projects || [])

      setEditingMilestone(null)
      setFeedback({ type: 'success', message: 'Sprint berhasil diperbarui & progres proyek disinkronkan!' })
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      setModalError(err.response?.data?.message || 'Gagal memperbarui sprint.')
    } finally {
      setSubmitting(false)
    }
  }

  // Submit Delete Sprint
  const handleDeleteMilestone = async () => {
    if (!deletingMilestone) return
    setSubmitting(true)
    try {
      await api.delete(`/milestones/${deletingMilestone.id}`)

      // Update state without full page reload
      setMilestones(prev => prev.filter(m => m.id !== deletingMilestone.id))
      if (viewingSprintTasks?.id === deletingMilestone.id) {
        setViewingSprintTasks(null)
      }

      // Refresh project progress
      const resProj = await api.get('/projects')
      setProjects(resProj.data.projects || [])

      setDeletingMilestone(null)
      setFeedback({ type: 'success', message: 'Sprint berhasil dihapus. Seluruh tugas terkait tetap tersimpan dengan aman di proyek.' })
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus sprint.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <Loader2 size={32} className="animate-spin text-[#FF2F92]" />
      <p className="font-display text-lg uppercase tracking-wider text-[#171717]">MEMUAT DATA TRACKER...</p>
    </div>
  )

  if (error) return (
    <div className="p-6 bg-[#FFD83D] border border-[#171717] rounded-md shadow-[4px_4px_0px_#171717] max-w-md my-8">
      <h2 className="font-display text-xl uppercase mb-2">Gagal Memuat</h2>
      <p className="text-xs font-semibold mb-3">{error}</p>
      <button onClick={() => fetchProjects()} className="px-3.5 py-1.5 bg-[#171717] text-white font-bold text-xs uppercase flex items-center gap-1.5 rounded cursor-pointer">
        <RotateCcw size={13} /> Coba Lagi
      </button>
    </div>
  )

  const activeProjects = projects.filter(p => p.status !== 'completed')
  const selected = projects.find(p => p.id === activeId) || projects[0]
  const status = selected ? (STATUS_CONFIG[selected.status] || STATUS_CONFIG.on_track) : STATUS_CONFIG.on_track

  // Summary stats
  const stats = {
    total: projects.length,
    on_track: projects.filter(p => p.status === 'on_track').length,
    at_risk: projects.filter(p => p.status === 'at_risk').length,
    completed: projects.filter(p => p.status === 'completed').length,
    avgProgress: projects.length > 0 ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length) : 0,
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Feedback Banner */}
      {feedback && (
        <div className="p-3 bg-[#10B981]/20 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center justify-between">
          <p className="text-xs font-black text-[#171717]">{feedback.message}</p>
          <button onClick={() => setFeedback(null)} className="text-[#171717] font-bold text-xs cursor-pointer">✕</button>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="SPRINT TRACKER"
        subtitle="Pelacakan progres teknis, sprint pengembangan, dan milestone real-time per proyek."
        tag="PENGEMBANGAN SISTEM"
        actions={
          <div className="flex items-center gap-2">
            {canManage && (
              <button
                onClick={openCreateModal}
                className="px-3.5 py-1.5 bg-[#FF2F92] text-white border-1.5 border-[#171717] rounded-lg font-black text-xs uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_#171717] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#171717] transition-all cursor-pointer"
              >
                <Plus size={14} /> Buat Sprint Baru
              </button>
            )}
            <div className="bg-white px-3 py-1.5 border border-[#171717] rounded-lg flex items-center gap-2 shadow-[2px_2px_0px_#171717]">
              <Terminal size={15} className="text-[#FF2F92]" />
              <span className="font-black text-xs uppercase">{activeProjects.length} Proyek Aktif</span>
            </div>
          </div>
        }
      />

      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Proyek', value: stats.total, bg: 'bg-white', icon: <BarChart3 size={16} /> },
          { label: 'On Track', value: stats.on_track, bg: 'bg-[#10B981] text-white', icon: <CheckCircle2 size={16} /> },
          { label: 'At Risk', value: stats.at_risk, bg: 'bg-[#FFD83D] text-[#171717]', icon: <AlertCircle size={16} /> },
          { label: 'Avg Progress', value: `${stats.avgProgress}%`, bg: 'bg-[#FF2F92] text-white', icon: <TrendingUp size={16} /> },
        ].map((s, i) => (
          <div key={i} className={`p-3.5 border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] ${s.bg}`}>
            <div className="flex items-center justify-between mb-1.5 opacity-70">
              {s.icon}
              <span className="text-[9px] font-black uppercase tracking-wider">{s.label}</span>
            </div>
            <p className="font-display text-3xl leading-none">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Project Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {projects.map((p) => {
          const isActive = p.id === (selected?.id)
          const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.on_track
          return (
            <button
              key={p.id}
              onClick={() => handleSelectProject(p.id)}
              className={`px-3 py-1.5 rounded-md border text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0 min-h-[36px] ${
                isActive
                  ? 'bg-[#171717] text-white border-[#171717] shadow-[2px_2px_0px_#FF2F92]'
                  : 'bg-white text-[#171717] border-[#171717]/30 hover:border-[#171717]'
              }`}
            >
              <CategoryIcon cat={p.category} size={12} />
              <span>{p.name}</span>
              <span className={`text-[8px] font-black px-1 py-px rounded-sm ${st.bg}`}>
                {p.progress}%
              </span>
            </button>
          )
        })}
      </div>

      {/* Main Content Grid */}
      {selected ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Main Detail (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Project Overview Card */}
            <div className="bg-white p-5 border border-[#171717] rounded-lg space-y-4 shadow-[3px_3px_0px_#171717]">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#171717]/10 pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-[#171717]/60 tracking-wider">
                    {selected.code} · KLIEN: {selected.client}
                  </span>
                  <h2 className="font-display text-2xl uppercase tracking-tight text-[#171717] mt-0.5">
                    {selected.name}
                  </h2>
                </div>
                <span className={`text-[9px] font-black uppercase px-2.5 py-1 border border-[#171717] rounded-sm ${status.bg}`}>
                  {status.label}
                </span>
              </div>

              {/* Progress */}
              <div>
                <div className="flex items-center justify-between text-xs font-black mb-2">
                  <span className="text-[10px] uppercase text-[#171717]/60">Total Progres Pengerjaan Proyek (Kalkulasi Otomatis dari Milestone)</span>
                  <span className="font-display text-xl" style={{ color: status.accent }}>{selected.progress}%</span>
                </div>
                <div className="w-full bg-neutral-100 h-4 rounded-full overflow-hidden border border-[#171717]/20">
                  <div
                    className={`h-full ${status.bar} transition-all duration-700`}
                    style={{ width: `${selected.progress}%` }}
                  />
                </div>
              </div>

              {/* Development Phases (Real Milestones from MySQL) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-sm uppercase text-[#171717] flex items-center gap-2">
                    <BarChart3 size={15} className="text-[#FF2F92]" />
                    TAHAPAN SPRINT & MILESTONE (DATABASE REAL-TIME)
                  </h3>
                  <div className="flex items-center gap-2">
                    {canManage && (
                      <button
                        onClick={openCreateModal}
                        className="text-[11px] font-black text-[#FF2F92] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={13} /> Tambah Fase
                      </button>
                    )}
                    {loadingMilestones && <Loader2 size={14} className="animate-spin text-[#FF2F92]" />}
                  </div>
                </div>

                {milestones.length === 0 ? (
                  <div className="p-6 bg-[#FAF7F2] border-1.5 border-dashed border-[#171717]/30 rounded-lg text-center space-y-2">
                    <ListTodo size={24} className="mx-auto text-[#171717]/40" />
                    <p className="text-xs font-bold text-[#171717]/70">Belum ada Sprint atau Milestone untuk proyek ini.</p>
                    {canManage && (
                      <button
                        onClick={openCreateModal}
                        className="px-3 py-1 bg-[#171717] text-white rounded text-[11px] font-bold uppercase cursor-pointer"
                      >
                        + Buat Sprint Pertama
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {milestones.map((ms) => {
                      const isDone = ms.progress >= 100 || ms.status === 'completed'
                      const isInProgress = ms.status === 'in_progress'
                      return (
                        <div key={ms.id} className={`p-3.5 border border-[#171717] rounded-lg transition-all flex flex-col justify-between ${
                          isDone ? 'bg-[#ECFDF5]' :
                          isInProgress ? 'bg-[#FFFBEB]' :
                          'bg-[#FAF7F2]'
                        }`}>
                          <div>
                            {/* Card Top: Phase, Project & Actions */}
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[9px] font-black uppercase text-[#171717]/60">
                                Fase {ms.phase_order} · {ms.project?.name || selected.name}
                              </span>
                              <div className="flex items-center gap-1">
                                <PhaseStatusIcon status={ms.status} />
                                {canManage && (
                                  <>
                                    <button
                                      onClick={() => openEditModal(ms)}
                                      className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center hover:bg-[#FFD83D] rounded border border-transparent hover:border-[#171717] text-[#171717] transition-all cursor-pointer"
                                      title="Edit Sprint"
                                    >
                                      <Edit3 size={13} />
                                    </button>
                                    <button
                                      onClick={() => setDeletingMilestone(ms)}
                                      className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center hover:bg-[#FF2F92] hover:text-white rounded border border-transparent hover:border-[#171717] text-[#171717]/70 transition-all cursor-pointer"
                                      title="Hapus Sprint"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            <p className="font-bold text-xs text-[#171717] leading-tight break-words line-clamp-2" title={ms.title}>{ms.title}</p>
                            <p className="text-[10px] text-[#171717]/60 mt-1 leading-snug line-clamp-2">
                              {ms.description || 'Tidak ada deskripsi lingkup pekerjaan.'}
                            </p>

                            {/* Timeline Dates */}
                            <div className="mt-2 text-[9px] text-[#171717]/70 flex items-center justify-between bg-white/60 px-2 py-1 rounded border border-[#171717]/10">
                              <span className="font-semibold">Mulai: {formatDate(ms.start_date)}</span>
                              <span className="font-semibold">Selesai: {formatDate(ms.due_date)}</span>
                            </div>

                            {/* Connected Tasks Badge & Interactive Drawer Trigger */}
                            <div className="mt-2 flex items-center justify-between text-[9px] font-bold text-[#171717]/70 bg-white/70 px-2 py-1 rounded border border-[#171717]/10">
                              <span>Tugas: <strong className="text-[#171717]">{ms.completed_tasks ?? 0} / {ms.total_tasks ?? 0} Selesai</strong></span>
                              <button
                                onClick={() => setViewingSprintTasks(ms)}
                                className="text-[9.5px] font-black text-[#FF2F92] hover:underline flex items-center gap-1 cursor-pointer py-1 px-1.5 hover:bg-[#FF2F92]/10 rounded transition-colors"
                              >
                                <ListTodo size={12} /> Lihat Tugas
                              </button>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-2.5">
                            <div className="flex justify-between text-[10px] font-black mb-1">
                              <span className="uppercase text-[9px] text-[#171717]/60">
                                Status: <span className="font-bold text-[#171717]">{ms.status}</span>
                              </span>
                              <span>{ms.progress}%</span>
                            </div>
                            <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden border border-[#171717]/10">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  isDone ? 'bg-[#10B981]' : isInProgress ? 'bg-[#FFD83D]' : 'bg-[#FF2F92]'
                                }`}
                                style={{ width: `${ms.progress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* All Projects Mini Overview */}
            <div className="bg-white border border-[#171717] rounded-lg overflow-hidden shadow-[3px_3px_0px_#171717]">
              <div className="px-4 py-3 bg-[#FAF7F2] border-b border-[#171717]/10">
                <h3 className="font-display text-sm uppercase text-[#171717]">RINGKASAN SELURUH PROYEK</h3>
              </div>
              <div className="divide-y divide-[#171717]/8">
                {projects.slice(0, 6).map((p) => {
                  const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.on_track
                  return (
                    <div key={p.id}
                         className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-[#FAF7F2] transition-colors ${p.id === selected?.id ? 'bg-[#FFF0F8]' : ''}`}
                         onClick={() => handleSelectProject(p.id)}>
                      <div className="p-1.5 bg-[#FAF7F2] border border-[#171717]/20 rounded">
                        <CategoryIcon cat={p.category} size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs text-[#171717] truncate">{p.name}</p>
                        <p className="text-[10px] text-[#171717]/50">{p.code} · {p.client}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-16 bg-neutral-100 h-1.5 rounded-full overflow-hidden border border-[#171717]/10">
                          <div className={`h-full ${st.bar}`} style={{ width: `${p.progress}%` }} />
                        </div>
                        <span className="text-[10px] font-black w-8 text-right">{p.progress}%</span>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 border border-[#171717] rounded-sm ${st.bg}`}>
                          {st.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right: Side Info (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Project Detail Card */}
            <div className="bg-white p-4 border border-[#171717] rounded-lg space-y-3 shadow-[3px_3px_0px_#171717]">
              <h3 className="font-display text-sm uppercase text-[#171717] border-b border-[#171717]/10 pb-2 flex items-center gap-2">
                <Calendar size={14} className="text-[#FF2F92]" />
                DETAIL PROYEK
              </h3>
              <div className="space-y-2 text-xs font-semibold text-[#171717]/80">
                {[
                  { label: 'Kode', value: selected.code },
                  { label: 'Kategori', value: selected.category?.toUpperCase() },
                  { label: 'Status', value: status.label },
                  { label: 'Klien', value: selected.client },
                  { label: 'Target Selesai', value: formatDate(selected.deadline) },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between py-1.5 border-b border-[#171717]/8 last:border-0">
                    <span className="text-[#171717]/55">{item.label}:</span>
                    <span className="font-bold text-right max-w-[55%] text-[11px]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Milestone Card */}
            <div className="bg-[#FFD83D] p-4 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
              <h3 className="font-display text-sm uppercase text-[#171717] mb-2 flex items-center gap-1.5">
                <TrendingUp size={14} />
                FASE SEDANG BERJALAN
              </h3>
              {(() => {
                const activeMs = milestones.find(m => m.status === 'in_progress') || milestones.find(m => m.progress < 100)
                if (!activeMs) return <p className="text-xs font-bold text-[#171717]/70">Semua milestone telah tuntas diselesaikan!</p>
                return (
                  <>
                    <p className="font-black text-sm text-[#171717]">Fase {activeMs.phase_order}: {activeMs.title}</p>
                    <p className="text-[10px] text-[#171717]/60 mt-0.5">{activeMs.description || '-'}</p>
                    <div className="mt-3 w-full bg-[#171717]/15 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-[#171717] rounded-full transition-all" style={{ width: `${activeMs.progress}%` }} />
                    </div>
                    <p className="text-[10px] font-black mt-1 text-right">{activeMs.progress}% selesai</p>
                  </>
                )
              })()}
            </div>

            {/* Status Breakdown */}
            <div className="bg-white p-4 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
              <h3 className="font-display text-sm uppercase text-[#171717] mb-3 flex items-center gap-2">
                <Users size={14} className="text-[#B8A0F0]" />
                STATUS SELURUH PROYEK
              </h3>
              <div className="space-y-2">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                  const count = projects.filter(p => p.status === key).length
                  const pct = projects.length > 0 ? Math.round(count / projects.length * 100) : 0
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-[10px] font-black mb-0.5">
                        <span>{cfg.label}</span>
                        <span>{count} proyek</span>
                      </div>
                      <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden border border-[#171717]/10">
                        <div className={`h-full ${cfg.bar} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 bg-white border border-[#171717] rounded-lg text-center shadow-[3px_3px_0px_#171717]">
          <p className="text-xs font-bold text-[#171717]/60">Belum ada data proyek. Tambahkan proyek terlebih dahulu.</p>
        </div>
      )}

      {/* MODAL: Buat Sprint Baru */}
      {isCreatingSprint && (
        <div
          className="fixed inset-0 z-50 bg-[#171717]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setIsCreatingSprint(false)
          }}
        >
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#171717] w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#FF2F92] border border-[#171717]"></span>
                <div>
                  <h3 className="font-display text-lg uppercase tracking-tight text-[#171717]">Buat Sprint Baru</h3>
                  <p className="text-[10.5px] font-semibold text-[#171717]/60">Tambahkan tahapan pengembangan teknis ke proyek</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreatingSprint(false)}
                className="p-1.5 hover:bg-[#FFD83D] border border-[#171717] rounded-md cursor-pointer transition-colors"
                title="Tutup Modal"
                disabled={submitting}
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="create-sprint-form" onSubmit={handleCreateSprint} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 min-h-0">
              {modalError && (
                <div className="p-2.5 bg-[#FF2F92]/10 border border-[#FF2F92] rounded-md text-xs font-bold text-[#FF2F92] flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">Nama Sprint / Milestone <span className="text-[#FF2F92]">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Sprint 1 - Otentikasi & Basis Data"
                  value={createForm.title}
                  onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full pkm-input"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">Proyek Induk <span className="text-[#FF2F92]">*</span></label>
                <select
                  required
                  value={createForm.project_id}
                  onChange={e => setCreateForm({ ...createForm, project_id: e.target.value })}
                  className="w-full pkm-input cursor-pointer"
                >
                  <option value="">-- Pilih Proyek Induk --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">Deskripsi Scope / Sasaran</label>
                <textarea
                  rows={2}
                  placeholder="Ringkasan deliverable atau target fase..."
                  value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full pkm-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={createForm.start_date}
                    onChange={e => setCreateForm({ ...createForm, start_date: e.target.value })}
                    className="w-full pkm-input"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">Tanggal Selesai (Target)</label>
                  <input
                    type="date"
                    value={createForm.due_date}
                    onChange={e => setCreateForm({ ...createForm, due_date: e.target.value })}
                    className="w-full pkm-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">Status Awal</label>
                <select
                  value={createForm.status}
                  onChange={e => setCreateForm({ ...createForm, status: e.target.value })}
                  className="w-full pkm-input cursor-pointer"
                >
                  <option value="pending">Pending (Belum Berjalan)</option>
                  <option value="in_progress">In Progress (Sedang Dikerjakan)</option>
                  <option value="completed">Completed (Tuntas)</option>
                </select>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="px-4 sm:px-5 py-3 border-t-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsCreatingSprint(false)}
                className="pkm-btn-outline min-h-[38px] px-4 cursor-pointer"
                disabled={submitting}
              >
                Batal
              </button>
              <button
                type="submit"
                form="create-sprint-form"
                disabled={submitting}
                className="pkm-btn-pink min-h-[38px] px-4 flex items-center gap-1.5 text-xs font-black uppercase disabled:opacity-50 cursor-pointer"
              >
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} strokeWidth={3} />}
                <span>Simpan Sprint</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Sprint */}
      {editingMilestone && (
        <div
          className="fixed inset-0 z-50 bg-[#171717]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setEditingMilestone(null)
          }}
        >
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#171717] w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#FFD83D] border border-[#171717]"></span>
                <div>
                  <h3 className="font-display text-lg uppercase tracking-tight text-[#171717]">Perbarui Sprint</h3>
                  <p className="text-[10.5px] font-semibold text-[#171717]/60">Fase {editingMilestone.phase_order} — {editingMilestone.project?.name || selected?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingMilestone(null)}
                className="p-1.5 hover:bg-[#FFD83D] border border-[#171717] rounded-md cursor-pointer transition-colors"
                title="Tutup Modal"
                disabled={submitting}
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="edit-sprint-form" onSubmit={handleUpdateMilestone} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 min-h-0">
              {modalError && (
                <div className="p-2.5 bg-[#FF2F92]/10 border border-[#FF2F92] rounded-md text-xs font-bold text-[#FF2F92] flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">Judul Fase / Sprint <span className="text-[#FF2F92]">*</span></label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full pkm-input"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">Deskripsi Scope Pekerjaan</label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full pkm-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={editForm.start_date}
                    onChange={e => setEditForm({ ...editForm, start_date: e.target.value })}
                    className="w-full pkm-input"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">Target Selesai</label>
                  <input
                    type="date"
                    value={editForm.due_date}
                    onChange={e => setEditForm({ ...editForm, due_date: e.target.value })}
                    className="w-full pkm-input"
                  />
                </div>
              </div>

              {/* Progress Slider */}
              <div className="p-3 bg-[#FAF7F2] border border-[#171717]/20 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10.5px] font-black uppercase text-[#171717]">Progres Selesai (%) <span className="text-[#FF2F92]">*</span></label>
                  <span className="font-mono font-black text-sm text-[#FF2F92]">{editForm.progress}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={editForm.progress}
                  onChange={e => {
                    const p = parseInt(e.target.value)
                    setEditForm({
                      ...editForm,
                      progress: p,
                      status: p >= 100 ? 'completed' : p > 0 ? 'in_progress' : 'pending'
                    })
                  }}
                  className="w-full accent-[#FF2F92] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-bold text-[#171717]/60">
                  <button type="button" onClick={() => setEditForm({ ...editForm, progress: 0, status: 'pending' })} className="hover:text-[#FF2F92] cursor-pointer">0%</button>
                  <button type="button" onClick={() => setEditForm({ ...editForm, progress: 50, status: 'in_progress' })} className="hover:text-[#FF2F92] cursor-pointer">50%</button>
                  <button type="button" onClick={() => setEditForm({ ...editForm, progress: 100, status: 'completed' })} className="hover:text-[#FF2F92] cursor-pointer">100%</button>
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">Status Pengerjaan</label>
                <select
                  value={editForm.status}
                  onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full pkm-input cursor-pointer"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="px-4 sm:px-5 py-3 border-t-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingMilestone(null)}
                className="pkm-btn-outline min-h-[38px] px-4 cursor-pointer"
                disabled={submitting}
              >
                Batal
              </button>
              <button
                type="submit"
                form="edit-sprint-form"
                disabled={submitting}
                className="pkm-btn-pink min-h-[38px] px-4 flex items-center gap-1.5 text-xs font-black uppercase disabled:opacity-50 cursor-pointer"
              >
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Konfirmasi Hapus Sprint */}
      {deletingMilestone && (
        <div
          className="fixed inset-0 z-50 bg-[#171717]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setDeletingMilestone(null)
          }}
        >
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#171717] w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-4 sm:px-5 py-3.5 border-b-1.5 border-[#171717] bg-[#FAF7F2] flex items-center gap-2.5 text-[#FF2F92]">
              <AlertTriangle size={20} strokeWidth={2.5} />
              <h3 className="font-display text-lg uppercase tracking-tight text-[#171717]">Konfirmasi Hapus Sprint</h3>
            </div>

            <div className="p-4 sm:p-5 space-y-3 text-xs font-semibold text-[#171717]/85">
              <p className="font-bold text-[#171717]">
                Apakah Anda yakin ingin menghapus sprint <u>{deletingMilestone.title}</u>?
              </p>
              <div className="p-3 bg-[#FAF7F2] border border-[#171717]/25 rounded-md text-[11px] text-[#171717] space-y-1">
                <p className="font-black text-[#171717]">ℹ️ Catatan Integritas Tugas:</p>
                <p className="text-[#171717]/70 leading-relaxed">
                  Tugas yang terhubung (<strong>{deletingMilestone.total_tasks ?? 0} tugas</strong>) <u>TIDAK AKAN DIHAPUS</u>, melainkan tetap tersimpan di dalam proyek induknya dan dapat dipindahkan ke sprint lain kapan saja.
                </p>
              </div>
            </div>

            <div className="px-4 sm:px-5 py-3 border-t-1.5 border-[#171717] bg-[#FAF7F2] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingMilestone(null)}
                className="pkm-btn-outline min-h-[38px] px-4 cursor-pointer"
                disabled={submitting}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeleteMilestone}
                className="px-4 py-2 min-h-[38px] bg-[#FF2F92] text-white border border-[#171717] rounded-md text-xs font-black uppercase hover:bg-[#e0267f] disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-[2px_2px_0px_#171717]"
              >
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>Ya, Hapus Sprint</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Daftar Tugas Terkait Sprint */}
      {viewingSprintTasks && (
        <div
          className="fixed inset-0 z-50 bg-[#171717]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingSprintTasks(null)
          }}
        >
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#171717] w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b-1.5 border-[#171717] bg-[#FAF7F2] flex items-center justify-between shrink-0">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] font-black uppercase text-[#171717]/60 tracking-wider block leading-tight">
                  Fase {viewingSprintTasks.phase_order} · {viewingSprintTasks.project?.name || selected?.name}
                </span>
                <h3 className="font-display text-lg uppercase tracking-tight text-[#171717] truncate mt-0.5">
                  {viewingSprintTasks.title}
                </h3>
              </div>
              <button
                onClick={() => setViewingSprintTasks(null)}
                className="p-1.5 hover:bg-[#FFD83D] border border-[#171717] rounded-md cursor-pointer transition-colors shrink-0"
                title="Tutup Modal"
              >
                <X size={15} />
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-2 bg-[#FAF7F2] p-2.5 mx-4 sm:mx-5 mt-4 rounded-lg border border-[#171717]/20 text-center shrink-0 shadow-[1px_1px_0px_#171717]">
              <div>
                <span className="text-[9px] font-bold text-[#171717]/60 uppercase block">Total Tugas</span>
                <span className="font-display text-lg leading-tight">{viewingSprintTasks.total_tasks ?? 0}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-[#10B981] uppercase block">Selesai</span>
                <span className="font-display text-lg text-[#10B981] leading-tight">{viewingSprintTasks.completed_tasks ?? 0}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-[#FF2F92] uppercase block">Progres</span>
                <span className="font-display text-lg text-[#FF2F92] leading-tight">{viewingSprintTasks.progress ?? 0}%</span>
              </div>
            </div>

            {/* Tasks List Body */}
            <div className="flex-1 overflow-y-auto space-y-2 p-4 sm:p-5 min-h-0">
              {(!viewingSprintTasks.tasks || viewingSprintTasks.tasks.length === 0) ? (
                <div className="p-8 text-center bg-[#FAF7F2] border border-[#171717]/15 rounded-lg space-y-2">
                  <ListTodo size={28} className="mx-auto text-[#171717]/30" />
                  <p className="text-xs font-bold text-[#171717]/70">Belum ada tugas yang dihubungkan ke sprint ini.</p>
                  <p className="text-[11px] text-[#171717]/50">
                    Buka modul <strong>Task Management</strong> untuk menambahkan atau menghubungkan tugas ke fase ini.
                  </p>
                </div>
              ) : (
                viewingSprintTasks.tasks.map((task) => {
                  const isDone = task.is_completed || task.status === 'completed'
                  const priorityBg =
                    task.priority === 'high' ? 'bg-[#FF2F92] text-white' :
                    task.priority === 'medium' ? 'bg-[#FFD83D] text-[#171717]' :
                    'bg-[#B8A0F0] text-[#171717]'

                  return (
                    <div
                      key={task.id}
                      className={`p-3 bg-white border border-[#171717] rounded-lg flex items-center justify-between gap-3 shadow-[2px_2px_0px_#171717] ${
                        isDone ? 'opacity-80 bg-[#FAF7F2]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {isDone ? (
                          <CheckCircle2 size={16} className="text-[#10B981] shrink-0" />
                        ) : (
                          <Circle size={16} className="text-[#171717]/40 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className={`font-bold text-xs text-[#171717] truncate break-words ${isDone ? 'line-through text-[#171717]/60' : ''}`} title={task.title}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#171717]/60 flex-wrap">
                            <span>PIC: <strong>{task.assignee?.name || task.assignee_name || 'Belum Ditugaskan'}</strong></span>
                            <span>·</span>
                            <span>Deadline: <strong>{formatDate(task.deadline)}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded border border-[#171717]/30 ${priorityBg}`}>
                          {task.priority}
                        </span>
                        <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded border border-[#171717]/30 ${
                          isDone ? 'bg-[#10B981] text-white' : 'bg-neutral-100 text-[#171717]'
                        }`}>
                          {task.status}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-5 py-3 border-t-1.5 border-[#171717] bg-[#FAF7F2] flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setViewingSprintTasks(null)}
                className="px-4 py-1.5 bg-[#171717] text-white rounded-md text-xs font-black uppercase hover:bg-neutral-800 cursor-pointer min-h-[36px]"
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
