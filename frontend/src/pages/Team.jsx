import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  Users, Mail, Phone, CheckCircle2, Circle, Clock, AlertTriangle,
  Loader2, RotateCcw, Briefcase, Search, Filter, ArrowUpDown,
  X, ExternalLink, Calendar, CheckSquare, Layers, FolderKanban,
  UserCheck, Shield
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const ROLE_CONFIG = {
  admin:           { label: 'Super Admin',     bg: 'bg-[#FF2F92] text-white', color: 'bg-[#FF2F92] text-white' },
  pimpinan:        { label: 'Pimpinan',        bg: 'bg-[#171717] text-white', color: 'bg-[#171717] text-white' },
  project_manager: { label: 'Project Manager', bg: 'bg-[#B8A0F0] text-[#171717]', color: 'bg-[#B8A0F0] text-[#171717]' },
  member:          { label: 'Member',          bg: 'bg-[#FFD83D] text-[#171717]', color: 'bg-[#FFD83D] text-[#171717]' },
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

export default function Team() {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const isAdmin = currentUser?.role === 'admin'

  const [team, setTeam]           = useState([])
  const [summary, setSummary]     = useState({
    total_members: 0,
    active_members: 0,
    total_tasks: 0,
    in_progress_tasks: 0,
    pending_tasks: 0,
    overdue_tasks: 0,
  })
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  // Filters & Search
  const [search, setSearch]       = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy]       = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')

  // Detail Modal
  const [selectedMemberId, setSelectedMemberId] = useState(null)
  const [memberDetail, setMemberDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailTab, setDetailTab] = useState('tasks') // 'tasks' or 'projects'
  const [taskStatusFilter, setTaskStatusFilter] = useState('all') // 'all', 'completed', 'pending'

  const fetchTeam = async () => {
    try {
      setLoading(true)
      const params = {}
      if (search.trim()) params.search = search.trim()
      if (roleFilter !== 'all') params.role = roleFilter
      if (statusFilter !== 'all') params.status = statusFilter
      params.sort = sortBy
      params.order = sortOrder

      const res = await api.get('/team', { params })
      setTeam(res.data.team || [])
      if (res.data.summary) {
        setSummary(res.data.summary)
      }
      setError(null)
    } catch {
      setError('Gagal memuat daftar anggota tim dari backend.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchTeam()
    }, 250)
    return () => clearTimeout(timeout)
  }, [search, roleFilter, statusFilter, sortBy, sortOrder])

  // Open member detail modal
  const handleOpenDetail = async (memberId) => {
    setSelectedMemberId(memberId)
    setLoadingDetail(true)
    setMemberDetail(null)
    setDetailTab('tasks')
    setTaskStatusFilter('all')

    try {
      const res = await api.get(`/team/${memberId}`)
      setMemberDetail(res.data)
    } catch {
      alert('Gagal memuat detail personel.')
      setSelectedMemberId(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleCloseDetail = () => {
    setSelectedMemberId(null)
    setMemberDetail(null)
  }

  if (loading && team.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <Loader2 size={32} className="animate-spin text-[#FF2F92]" />
      <p className="font-display text-lg uppercase tracking-wider text-[#171717]">MEMUAT DIREKTORI ANGGOTA TIM...</p>
    </div>
  )

  if (error && team.length === 0) return (
    <div className="p-6 bg-[#FFD83D] border border-[#171717] rounded-md shadow-[4px_4px_0px_#171717] max-w-md my-8">
      <h2 className="font-display text-xl uppercase mb-2">Gagal Memuat</h2>
      <p className="text-xs font-semibold mb-3">{error}</p>
      <button onClick={fetchTeam} className="px-3.5 py-1.5 bg-[#171717] text-white font-bold text-xs uppercase flex items-center gap-1.5 rounded cursor-pointer">
        <RotateCcw size={13} /> Coba Lagi
      </button>
    </div>
  )

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <PageHeader
        title="ANGGOTA TIM & BEBAN KERJA"
        subtitle="Direktori personil, distribusi tugas operasional, dan pemantauan beban kerja tim PT Potensi Karya Mandiri."
        tag="SUMBER DAYA MANUSIA"
        actions={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => navigate('/users')}
                className="px-3 py-1.5 bg-white border border-[#171717] rounded-lg font-bold text-xs uppercase text-[#171717] flex items-center gap-1.5 shadow-[2px_2px_0px_#171717] hover:bg-neutral-50 transition-all cursor-pointer"
                title="Buka Pengelolaan Akun di modul Users"
              >
                <Shield size={13} className="text-[#FF2F92]" />
                Kelola Akun di Users
              </button>
            )}
            <div className="bg-white px-3 py-1.5 border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center gap-2">
              <Users size={15} className="text-[#FF2F92]" />
              <span className="font-black text-xs uppercase">{summary.total_members} Anggota Terdaftar</span>
            </div>
          </div>
        }
      />

      {/* Workload Summary Cards (Pemantauan Beban Kerja) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Anggota Aktif',
            value: `${summary.active_members} / ${summary.total_members}`,
            desc: 'Personel berstatus aktif',
            bg: 'bg-white',
            icon: <UserCheck size={16} className="text-[#10B981]" />
          },
          {
            label: 'Tugas Berjalan',
            value: summary.in_progress_tasks,
            desc: 'Sedang dikerjakan oleh tim',
            bg: 'bg-[#FFFBEB] text-[#171717]',
            icon: <Clock size={16} className="text-[#FBBF24]" />
          },
          {
            label: 'Tugas Belum Selesai',
            value: summary.pending_tasks,
            desc: 'Total backlog & in-progress',
            bg: 'bg-white',
            icon: <Briefcase size={16} className="text-[#B8A0F0]" />
          },
          {
            label: 'Tugas Terlambat',
            value: summary.overdue_tasks,
            desc: 'Melewati tenggat waktu',
            bg: summary.overdue_tasks > 0 ? 'bg-[#FF2F92] text-white' : 'bg-white',
            icon: <AlertTriangle size={16} className={summary.overdue_tasks > 0 ? 'text-white' : 'text-[#FF2F92]'} />
          },
        ].map((card, i) => (
          <div key={i} className={`p-3.5 border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] ${card.bg}`}>
            <div className="flex items-center justify-between mb-1.5 opacity-80">
              {card.icon}
              <span className="text-[9px] font-black uppercase tracking-wider">{card.label}</span>
            </div>
            <p className="font-display text-2xl leading-none">{card.value}</p>
            <p className="text-[9px] font-semibold opacity-70 mt-1">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#171717]/40" />
          <input
            type="text"
            placeholder="Cari nama, email, atau telepon personel..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#FAF7F2] border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-[#171717] rounded text-xs font-bold focus:outline-none focus:border-[#FF2F92] cursor-pointer"
          >
            <option value="all">Semua Role</option>
            <option value="admin">Super Admin</option>
            <option value="pimpinan">Pimpinan</option>
            <option value="project_manager">Project Manager</option>
            <option value="member">Member</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-[#171717] rounded text-xs font-bold focus:outline-none focus:border-[#FF2F92] cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-[#171717] rounded text-xs font-bold focus:outline-none focus:border-[#FF2F92] cursor-pointer"
          >
            <option value="name">Urut Nama</option>
            <option value="tasks_count">Jumlah Tugas</option>
            <option value="projects_count">Jumlah Proyek</option>
            <option value="completion_rate">Tingkat Tuntas</option>
          </select>

          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 bg-[#FAF7F2] border border-[#171717] rounded hover:bg-neutral-100 transition-colors cursor-pointer"
            title={`Arah Urutan: ${sortOrder === 'asc' ? 'Menaik (A-Z)' : 'Menurun (Z-A)'}`}
          >
            <ArrowUpDown size={14} className={sortOrder === 'desc' ? 'rotate-180 text-[#FF2F92]' : ''} />
          </button>
        </div>
      </div>

      {/* Grid of Team Cards */}
      {team.length === 0 ? (
        <div className="p-8 bg-white border border-[#171717] rounded-lg text-center shadow-[3px_3px_0px_#171717] space-y-2">
          <Users size={32} className="mx-auto text-[#171717]/30" />
          <h3 className="font-display text-base uppercase text-[#171717]">Tidak Ada Personel Ditemukan</h3>
          <p className="text-xs text-[#171717]/60">Sesuaikan kata kunci pencarian atau filter untuk menemukan anggota tim.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {team.map((m) => {
            const cfg = ROLE_CONFIG[m.role] || ROLE_CONFIG.member
            const stats = m.stats || { total_tasks: 0, completed_tasks: 0, pending_tasks: 0, overdue_tasks: 0, completion_rate: 0 }
            const isInactive = !m.is_active

            return (
              <div 
                key={m.id} 
                className={`bg-white p-4 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#171717] transition-all flex flex-col justify-between ${
                  isInactive ? 'opacity-70 bg-neutral-50' : ''
                }`}
              >
                <div>
                  {/* Header row: Avatar + Name + Role + Status badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-full ${cfg.color} border border-[#171717] flex items-center justify-center font-display text-lg shrink-0 shadow-[1px_1px_0px_#171717]`}>
                        {m.name.charAt(0)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-base uppercase text-[#171717] truncate leading-tight">
                          {m.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`inline-block px-2 py-0.5 border border-[#171717] rounded-sm text-[9px] font-black uppercase ${cfg.bg}`}>
                            {cfg.label}
                          </span>
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-[#171717]/30 ${
                            m.is_active ? 'bg-[#10B981] text-white' : 'bg-neutral-300 text-[#171717]'
                          }`}>
                            {m.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact info */}
                  <div className="mt-3 space-y-1 text-xs font-semibold text-[#171717]/80">
                    <p className="flex items-center gap-1.5 truncate">
                      <Mail size={12} className="shrink-0 text-[#171717]/50" /> {m.email}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Phone size={12} className="shrink-0 text-[#171717]/50" /> {m.phone || '—'}
                    </p>
                  </div>

                  {/* Project responsibilities badge */}
                  <div className="mt-2.5 flex items-center justify-between text-[10px] font-bold text-[#171717]/70 bg-[#FAF7F2] px-2.5 py-1 rounded border border-[#171717]/15">
                    <span className="flex items-center gap-1">
                      <FolderKanban size={11} className="text-[#FF2F92]" /> Proyek PIC:
                    </span>
                    <strong className="text-[#171717]">{m.projects_count ?? 0} Proyek</strong>
                  </div>
                </div>

                {/* Workload / Task Distribution Box */}
                <div className="mt-3.5 pt-3 border-t border-[#171717]/15 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-[#171717]/70">
                    <span className="flex items-center gap-1">
                      <Briefcase size={11} className="text-[#FF2F92]" /> Beban Tugas
                    </span>
                    <span>{stats.completed_tasks} / {stats.total_tasks} Selesai</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden border border-[#171717]/15">
                    <div 
                      className="h-full bg-[#10B981] transition-all duration-500"
                      style={{ width: `${stats.completion_rate}%` }}
                    />
                  </div>

                  {/* Task Metrics Badges */}
                  <div className="flex items-center justify-between text-[9px] font-bold">
                    <span className="text-[#10B981]">
                      {stats.completion_rate}% Tuntas
                    </span>
                    <span className="text-[#171717]/60">
                      {stats.pending_tasks} Pending
                    </span>
                    {stats.overdue_tasks > 0 && (
                      <span className="text-[#FF2F92] font-black">
                        {stats.overdue_tasks} Overdue
                      </span>
                    )}
                  </div>

                  {/* Action Button: Detail Drilldown */}
                  <button
                    onClick={() => handleOpenDetail(m.id)}
                    className="w-full mt-2 py-1.5 bg-[#FAF7F2] hover:bg-[#171717] hover:text-white border border-[#171717] rounded text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-[1px_1px_0px_#171717]"
                  >
                    <span>Lihat Detail & Aktivitas</span>
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL: DETAIL PERSONEL */}
      {selectedMemberId && (
        <div className="fixed inset-0 z-50 bg-[#171717]/60 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-[#171717] rounded-lg shadow-[6px_6px_0px_#171717] w-full max-w-2xl max-h-[90vh] flex flex-col p-5 space-y-4">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b-1.5 border-[#171717] pb-3 shrink-0">
              {loadingDetail || !memberDetail ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-[#FF2F92]" />
                  <p className="font-display text-sm uppercase">Memuat profil personel...</p>
                </div>
              ) : (
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-12 h-12 rounded-full ${ROLE_CONFIG[memberDetail.user.role]?.color || 'bg-[#171717] text-white'} border border-[#171717] flex items-center justify-center font-display text-xl shrink-0 shadow-[2px_2px_0px_#171717]`}>
                    {memberDetail.user.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-display text-xl uppercase tracking-wider text-[#171717] leading-tight">
                      {memberDetail.user.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`px-2 py-0.5 border border-[#171717] rounded-sm text-[9px] font-black uppercase ${ROLE_CONFIG[memberDetail.user.role]?.bg || 'bg-neutral-200'}`}>
                        {ROLE_CONFIG[memberDetail.user.role]?.label || memberDetail.user.role}
                      </span>
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-[#171717]/30 ${
                        memberDetail.user.is_active ? 'bg-[#10B981] text-white' : 'bg-neutral-300 text-[#171717]'
                      }`}>
                        {memberDetail.user.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                      <span className="text-[10px] text-[#171717]/60">· Bergabung: {formatDate(memberDetail.user.created_at)}</span>
                    </div>
                  </div>
                </div>
              )}
              <button onClick={handleCloseDetail} className="text-[#171717] hover:text-[#FF2F92] cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {loadingDetail || !memberDetail ? (
              <div className="p-12 text-center">
                <Loader2 size={28} className="animate-spin text-[#FF2F92] mx-auto mb-2" />
                <p className="text-xs font-bold text-[#171717]/60">Mengambil data pekerjaan & proyek...</p>
              </div>
            ) : (
              <>
                {/* Contact strip & Performance Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-white p-2.5 rounded border border-[#171717]/20 text-center shrink-0">
                  <div>
                    <span className="text-[8px] font-bold text-[#171717]/60 uppercase block">Proyek PIC</span>
                    <span className="font-display text-base">{memberDetail.stats.total_projects}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-[#171717]/60 uppercase block">Total Tugas</span>
                    <span className="font-display text-base">{memberDetail.stats.total_tasks}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-[#10B981] uppercase block">Tuntas</span>
                    <span className="font-display text-base text-[#10B981]">{memberDetail.stats.completed_tasks}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-[#FBBF24] uppercase block">Pending</span>
                    <span className="font-display text-base text-[#B45309]">{memberDetail.stats.pending_tasks}</span>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[8px] font-bold text-[#FF2F92] uppercase block">Penyelesaian</span>
                    <span className="font-display text-base text-[#FF2F92]">{memberDetail.stats.completion_rate}%</span>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-[#171717]/20 shrink-0 gap-2">
                  <button
                    onClick={() => setDetailTab('tasks')}
                    className={`px-3 py-1.5 text-xs font-black uppercase transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
                      detailTab === 'tasks'
                        ? 'border-[#FF2F92] text-[#FF2F92]'
                        : 'border-transparent text-[#171717]/60 hover:text-[#171717]'
                    }`}
                  >
                    <CheckSquare size={13} />
                    <span>Daftar Tugas ({memberDetail.tasks.length})</span>
                  </button>

                  <button
                    onClick={() => setDetailTab('projects')}
                    className={`px-3 py-1.5 text-xs font-black uppercase transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
                      detailTab === 'projects'
                        ? 'border-[#FF2F92] text-[#FF2F92]'
                        : 'border-transparent text-[#171717]/60 hover:text-[#171717]'
                    }`}
                  >
                    <FolderKanban size={13} />
                    <span>Proyek yang Ditangani ({memberDetail.projects.length})</span>
                  </button>
                </div>

                {/* Tab Content: Tasks */}
                {detailTab === 'tasks' && (
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[180px]">
                    {/* Status filter for tasks */}
                    {memberDetail.tasks.length > 0 && (
                      <div className="flex items-center gap-1.5 pb-1">
                        <span className="text-[10px] font-black uppercase text-[#171717]/60 mr-1">Filter:</span>
                        {['all', 'pending', 'completed'].map((st) => (
                          <button
                            key={st}
                            onClick={() => setTaskStatusFilter(st)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                              taskStatusFilter === st
                                ? 'bg-[#171717] text-white'
                                : 'bg-white text-[#171717] border border-[#171717]/20 hover:border-[#171717]'
                            }`}
                          >
                            {st === 'all' ? 'Semua' : st === 'completed' ? 'Selesai' : 'Pending'}
                          </button>
                        ))}
                      </div>
                    )}

                    {(() => {
                      const filteredTasks = memberDetail.tasks.filter((t) => {
                        const isDone = t.is_completed || t.status === 'completed'
                        if (taskStatusFilter === 'completed') return isDone
                        if (taskStatusFilter === 'pending') return !isDone
                        return true
                      })

                      if (filteredTasks.length === 0) {
                        return (
                          <div className="p-8 text-center bg-white border border-[#171717]/15 rounded-lg space-y-1">
                            <CheckSquare size={24} className="mx-auto text-[#171717]/30" />
                            <p className="text-xs font-bold text-[#171717]/70">
                              {taskStatusFilter === 'all'
                                ? 'Personel ini belum memiliki tugas yang ditugaskan.'
                                : 'Tidak ada tugas yang sesuai dengan filter.'}
                            </p>
                          </div>
                        )
                      }

                      return filteredTasks.map((t) => {
                        const isDone = t.is_completed || t.status === 'completed'
                        const isOverdue = !isDone && t.deadline && new Date(t.deadline) < new Date()
                        const priorityBg =
                          t.priority === 'high' ? 'bg-[#FF2F92] text-white' :
                          t.priority === 'medium' ? 'bg-[#FFD83D] text-[#171717]' :
                          'bg-[#10B981] text-white'

                        return (
                          <div
                            key={t.id}
                            className={`p-3 bg-white border border-[#171717] rounded-lg flex items-center justify-between gap-3 shadow-[2px_2px_0px_#171717] ${
                              isDone ? 'opacity-80 bg-neutral-50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {isDone ? (
                                <CheckCircle2 size={16} className="text-[#10B981] shrink-0" />
                              ) : (
                                <Circle size={16} className="text-[#171717]/40 shrink-0" />
                              )}

                              <div className="min-w-0">
                                <p className={`font-bold text-xs text-[#171717] truncate ${isDone ? 'line-through text-[#171717]/60' : ''}`}>
                                  {t.title}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#171717]/60 flex-wrap">
                                  <span>Proyek: <strong>{t.project?.name || '—'}</strong></span>
                                  {t.milestone && (
                                    <>
                                      <span>·</span>
                                      <span className="text-[#FF2F92] font-semibold">Sprint: {t.milestone.title}</span>
                                    </>
                                  )}
                                  <span>·</span>
                                  <span className={isOverdue ? 'text-[#FF2F92] font-bold' : ''}>
                                    Deadline: {formatDate(t.deadline)} {isOverdue && '(Terlambat)'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-[#171717]/30 ${priorityBg}`}>
                                {t.priority}
                              </span>
                              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-[#171717]/30 ${
                                isDone ? 'bg-[#10B981] text-white' : 'bg-neutral-100 text-[#171717]'
                              }`}>
                                {t.status}
                              </span>
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}

                {/* Tab Content: Projects */}
                {detailTab === 'projects' && (
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[180px]">
                    {memberDetail.projects.length === 0 ? (
                      <div className="p-8 text-center bg-white border border-[#171717]/15 rounded-lg space-y-1">
                        <FolderKanban size={24} className="mx-auto text-[#171717]/30" />
                        <p className="text-xs font-bold text-[#171717]/70">Personel ini belum ditunjuk sebagai PIC proyek manapun.</p>
                      </div>
                    ) : (
                      memberDetail.projects.map((proj) => (
                        <div
                          key={proj.id}
                          className="p-3 bg-white border border-[#171717] rounded-lg space-y-2 shadow-[2px_2px_0px_#171717]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[9px] font-black uppercase text-[#171717]/60">
                                {proj.code} · Klien: {proj.client}
                              </span>
                              <h4 className="font-bold text-xs text-[#171717] leading-tight">
                                {proj.name}
                              </h4>
                            </div>
                            <span className="px-2 py-0.5 bg-[#FFD83D] border border-[#171717] rounded text-[9px] font-black uppercase">
                              {proj.role_in_project || 'PIC Proyek'}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div>
                            <div className="flex justify-between text-[10px] font-black mb-1">
                              <span className="uppercase text-[#171717]/60">Progres Proyek:</span>
                              <span>{proj.progress}%</span>
                            </div>
                            <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden border border-[#171717]/15">
                              <div
                                className="h-full bg-[#FF2F92] transition-all"
                                style={{ width: `${proj.progress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="pt-2 border-t border-[#171717]/20 flex justify-between items-center shrink-0">
                  <div className="text-[11px] text-[#171717]/60 font-semibold">
                    Kontak: {memberDetail.user.email} · {memberDetail.user.phone || '—'}
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseDetail}
                    className="px-4 py-1.5 bg-[#171717] text-white rounded text-xs font-black uppercase hover:bg-neutral-800 cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
