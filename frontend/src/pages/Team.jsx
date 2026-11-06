import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  Users, Mail, Phone, CheckCircle2, Circle, Clock, AlertTriangle,
  Loader2, RotateCcw, Briefcase, Search, ArrowUpDown,
  X, ExternalLink, CheckSquare, FolderKanban,
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
  const [searchParams] = useSearchParams()
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

  // Escape key handler to close detail modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedMemberId) {
        handleCloseDetail()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedMemberId])

  // Open detail if requested by URL query param (e.g. from Global Search)
  useEffect(() => {
    const memberId = searchParams.get('member_id')
    if (memberId) {
      handleOpenDetail(Number(memberId))
    }
  }, [searchParams])

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

  const hasActiveFilters = Boolean(
    search.trim() ||
    roleFilter !== 'all' ||
    statusFilter !== 'all' ||
    sortBy !== 'name' ||
    sortOrder !== 'asc'
  )

  const handleResetFilters = () => {
    setSearch('')
    setRoleFilter('all')
    setStatusFilter('all')
    setSortBy('name')
    setSortOrder('asc')
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
      <button onClick={fetchTeam} className="px-3.5 py-1.5 bg-[#171717] text-white font-bold text-xs uppercase flex items-center gap-1.5 rounded cursor-pointer min-h-[36px]">
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
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <button
                onClick={() => navigate('/users')}
                className="px-3 py-1.5 bg-white border border-[#171717] rounded-lg font-bold text-xs uppercase text-[#171717] flex items-center gap-1.5 shadow-[2px_2px_0px_#171717] hover:bg-neutral-50 transition-all cursor-pointer min-h-[36px]"
                title="Buka Pengelolaan Akun di modul Users"
              >
                <Shield size={13} className="text-[#FF2F92]" />
                Kelola Akun di Users
              </button>
            )}
            <div className="bg-white px-3 py-1.5 border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center gap-2 min-h-[36px]">
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
            desc: 'Sedang dikerjakan tim',
            bg: 'bg-[#FFFBEB] text-[#171717]',
            icon: <Clock size={16} className="text-[#FBBF24]" />
          },
          {
            label: 'Tugas Belum Selesai',
            value: summary.pending_tasks,
            desc: 'Backlog & in-progress',
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
            <p className="font-display text-2xl sm:text-3xl leading-none">{card.value}</p>
            <p className="text-[9px] font-semibold opacity-70 mt-1 truncate">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 sm:p-3.5 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#171717]/40" />
          <input
            type="text"
            placeholder="Cari nama, email, atau telepon personel..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-2 bg-[#FAF7F2] border border-[#171717] rounded-md text-xs font-semibold focus:outline-none focus:border-[#FF2F92] min-h-[38px]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#171717]/50 hover:text-[#FF2F92] cursor-pointer p-0.5"
              title="Hapus pencarian"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter & Sorting Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-[#171717] rounded-md text-xs font-bold focus:outline-none focus:border-[#FF2F92] cursor-pointer min-h-[38px]"
            title="Filter berdasarkan Role"
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
            className="px-2.5 py-1.5 bg-white border border-[#171717] rounded-md text-xs font-bold focus:outline-none focus:border-[#FF2F92] cursor-pointer min-h-[38px]"
            title="Filter berdasarkan Status"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-[#171717] rounded-md text-xs font-bold focus:outline-none focus:border-[#FF2F92] cursor-pointer min-h-[38px]"
            title="Urutkan berdasarkan"
          >
            <option value="name">Urut Nama</option>
            <option value="tasks_count">Jumlah Tugas</option>
            <option value="projects_count">Jumlah Proyek</option>
            <option value="completion_rate">Tingkat Tuntas</option>
          </select>

          {/* Sort Order Toggle */}
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="px-2.5 py-1.5 bg-[#FAF7F2] border border-[#171717] rounded-md hover:bg-neutral-100 transition-colors cursor-pointer min-h-[38px] flex items-center justify-center gap-1 text-xs font-bold"
            title={`Arah Urutan: ${sortOrder === 'asc' ? 'Menaik (A-Z)' : 'Menurun (Z-A)'}`}
          >
            <ArrowUpDown size={14} className={sortOrder === 'desc' ? 'rotate-180 text-[#FF2F92]' : ''} />
            <span className="text-[10px] uppercase font-black">{sortOrder.toUpperCase()}</span>
          </button>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="px-2.5 py-1.5 bg-[#FF2F92]/10 text-[#FF2F92] border border-[#FF2F92] rounded-md text-xs font-bold uppercase hover:bg-[#FF2F92] hover:text-white transition-colors cursor-pointer min-h-[38px] flex items-center gap-1"
              title="Reset seluruh filter dan pencarian"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid of Team Cards */}
      {team.length === 0 ? (
        <div className="p-8 sm:p-12 bg-white border border-[#171717] rounded-lg text-center shadow-[3px_3px_0px_#171717] space-y-3">
          <Users size={36} className="mx-auto text-[#171717]/30" />
          <h3 className="font-display text-lg uppercase text-[#171717]">Tidak Ada Personel Ditemukan</h3>
          <p className="text-xs text-[#171717]/60 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'Tidak ada personel yang sesuai dengan kriteria pencarian dan filter aktif saat ini.'
              : 'Belum ada data personel yang terdaftar di dalam sistem.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-[#171717] text-white rounded-md text-xs font-black uppercase hover:bg-neutral-800 transition-colors cursor-pointer min-h-[36px] inline-flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              <span>Reset Pencarian & Filter</span>
            </button>
          )}
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
                className={`bg-white p-4 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#171717] transition-all flex flex-col justify-between h-full ${
                  isInactive ? 'opacity-75 bg-neutral-50/60' : ''
                }`}
              >
                <div>
                  {/* Header row: Avatar + Name + Role + Status badge */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={`w-11 h-11 rounded-full ${cfg.color} border border-[#171717] flex items-center justify-center font-display text-lg shrink-0 shadow-[1px_1px_0px_#171717]`}>
                        {m.name.charAt(0)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-base uppercase text-[#171717] truncate leading-snug" title={m.name}>
                          {m.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`inline-block px-2 py-0.5 border border-[#171717] rounded-sm text-[9px] font-black uppercase ${cfg.bg}`}>
                            {cfg.label}
                          </span>
                          <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded border border-[#171717]/30 ${
                            m.is_active ? 'bg-[#10B981] text-white' : 'bg-neutral-300 text-[#171717]'
                          }`}>
                            {m.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact info */}
                  <div className="mt-3 space-y-1.5 text-xs font-semibold text-[#171717]/80">
                    <p className="flex items-center gap-2 truncate" title={m.email}>
                      <Mail size={13} className="shrink-0 text-[#171717]/50" />
                      <span className="truncate">{m.email}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone size={13} className="shrink-0 text-[#171717]/50" />
                      <span>{m.phone || '—'}</span>
                    </p>
                  </div>

                  {/* Project responsibilities badge */}
                  <div className="mt-2.5 flex items-center justify-between text-[10px] font-bold text-[#171717]/70 bg-[#FAF7F2] px-2.5 py-1.5 rounded border border-[#171717]/15">
                    <span className="flex items-center gap-1.5">
                      <FolderKanban size={12} className="text-[#FF2F92]" /> Proyek PIC:
                    </span>
                    <strong className="text-[#171717]">{m.projects_count ?? 0} Proyek</strong>
                  </div>
                </div>

                {/* Workload / Task Distribution Box */}
                <div className="mt-3.5 pt-3 border-t border-[#171717]/15 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-[#171717]/75">
                    <span className="flex items-center gap-1.5">
                      <Briefcase size={12} className="text-[#FF2F92]" /> Beban Tugas
                    </span>
                    <span>{stats.completed_tasks} / {stats.total_tasks} Selesai</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-neutral-100 h-2.5 rounded-full overflow-hidden border border-[#171717]/20">
                    <div
                      className="h-full bg-[#10B981] transition-all duration-500"
                      style={{ width: `${stats.completion_rate}%` }}
                    />
                  </div>

                  {/* Task Metrics Badges */}
                  <div className="flex items-center justify-between text-[9.5px] font-bold">
                    <span className="text-[#10B981]">
                      {stats.completion_rate}% Tuntas
                    </span>
                    <span className="text-[#171717]/70">
                      {stats.pending_tasks} Pending
                    </span>
                    {stats.overdue_tasks > 0 ? (
                      <span className="text-[#FF2F92] font-black flex items-center gap-0.5">
                        <AlertTriangle size={10} />
                        {stats.overdue_tasks} Overdue
                      </span>
                    ) : (
                      <span className="text-neutral-400 font-semibold">0 Overdue</span>
                    )}
                  </div>

                  {/* Action Button: Detail Drilldown */}
                  <button
                    onClick={() => handleOpenDetail(m.id)}
                    className="w-full mt-2 py-2 bg-[#FAF7F2] hover:bg-[#171717] hover:text-white border border-[#171717] rounded-md text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-[1px_1px_0px_#171717] min-h-[38px]"
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
        <div
          className="fixed inset-0 z-50 bg-[#171717]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !loadingDetail) handleCloseDetail()
          }}
        >
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#171717] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-between">
              {loadingDetail || !memberDetail ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-[#FF2F92]" />
                  <p className="font-display text-sm uppercase text-[#171717]">Memuat profil personel...</p>
                </div>
              ) : (
                <div className="flex items-start gap-3 min-w-0 flex-1 pr-2">
                  <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full ${ROLE_CONFIG[memberDetail.user.role]?.color || 'bg-[#171717] text-white'} border border-[#171717] flex items-center justify-center font-display text-xl shrink-0 shadow-[2px_2px_0px_#171717]`}>
                    {memberDetail.user.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg sm:text-xl uppercase tracking-tight text-[#171717] leading-tight truncate">
                      {memberDetail.user.name}
                    </h3>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
                      <span className={`px-2 py-0.5 border border-[#171717] rounded-sm text-[9px] font-black uppercase ${ROLE_CONFIG[memberDetail.user.role]?.bg || 'bg-neutral-200'}`}>
                        {ROLE_CONFIG[memberDetail.user.role]?.label || memberDetail.user.role}
                      </span>
                      <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded border border-[#171717]/30 ${
                        memberDetail.user.is_active ? 'bg-[#10B981] text-white' : 'bg-neutral-300 text-[#171717]'
                      }`}>
                        {memberDetail.user.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                      <span className="text-[10px] text-[#171717]/60">· Bergabung: {formatDate(memberDetail.user.created_at)}</span>
                    </div>
                  </div>
                </div>
              )}
              <button
                onClick={handleCloseDetail}
                className="p-1.5 hover:bg-[#FFD83D] border border-[#171717] rounded-md text-[#171717] cursor-pointer transition-colors shrink-0"
                title="Tutup Modal (Esc)"
              >
                <X size={16} />
              </button>
            </div>

            {loadingDetail || !memberDetail ? (
              <div className="p-12 text-center flex-1 flex flex-col items-center justify-center">
                <Loader2 size={32} className="animate-spin text-[#FF2F92] mb-3" />
                <p className="text-xs font-bold text-[#171717]/70">Mengambil data pekerjaan & proyek...</p>
              </div>
            ) : (
              <>
                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-0">
                  {/* Contact strip & Performance Summary Mini Tiles */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-[#FAF7F2] p-3 rounded-lg border border-[#171717]/20 text-center">
                    <div className="p-1.5 bg-white rounded border border-[#171717]/10">
                      <span className="text-[8px] font-bold text-[#171717]/60 uppercase block">Proyek PIC</span>
                      <span className="font-display text-base text-[#171717]">{memberDetail.stats.total_projects}</span>
                    </div>
                    <div className="p-1.5 bg-white rounded border border-[#171717]/10">
                      <span className="text-[8px] font-bold text-[#171717]/60 uppercase block">Total Tugas</span>
                      <span className="font-display text-base text-[#171717]">{memberDetail.stats.total_tasks}</span>
                    </div>
                    <div className="p-1.5 bg-white rounded border border-[#171717]/10">
                      <span className="text-[8px] font-bold text-[#10B981] uppercase block">Tuntas</span>
                      <span className="font-display text-base text-[#10B981]">{memberDetail.stats.completed_tasks}</span>
                    </div>
                    <div className="p-1.5 bg-white rounded border border-[#171717]/10">
                      <span className="text-[8px] font-bold text-[#B45309] uppercase block">Pending</span>
                      <span className="font-display text-base text-[#B45309]">{memberDetail.stats.pending_tasks}</span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 p-1.5 bg-white rounded border border-[#171717]/10">
                      <span className="text-[8px] font-bold text-[#FF2F92] uppercase block">Penyelesaian</span>
                      <span className="font-display text-base text-[#FF2F92]">{memberDetail.stats.completion_rate}%</span>
                    </div>
                  </div>

                  {/* Tab Navigation */}
                  <div className="flex border-b-1.5 border-[#171717]/20 gap-2 shrink-0">
                    <button
                      onClick={() => setDetailTab('tasks')}
                      className={`px-3 py-2 text-xs font-black uppercase transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
                        detailTab === 'tasks'
                          ? 'border-[#FF2F92] text-[#FF2F92]'
                          : 'border-transparent text-[#171717]/60 hover:text-[#171717]'
                      }`}
                    >
                      <CheckSquare size={13} />
                      <span>Daftar Tugas</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${detailTab === 'tasks' ? 'bg-[#FF2F92] text-white' : 'bg-neutral-200 text-[#171717]'}`}>
                        {memberDetail.tasks.length}
                      </span>
                    </button>

                    <button
                      onClick={() => setDetailTab('projects')}
                      className={`px-3 py-2 text-xs font-black uppercase transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
                        detailTab === 'projects'
                          ? 'border-[#FF2F92] text-[#FF2F92]'
                          : 'border-transparent text-[#171717]/60 hover:text-[#171717]'
                      }`}
                    >
                      <FolderKanban size={13} />
                      <span>Proyek PIC</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${detailTab === 'projects' ? 'bg-[#FF2F92] text-white' : 'bg-neutral-200 text-[#171717]'}`}>
                        {memberDetail.projects.length}
                      </span>
                    </button>
                  </div>

                  {/* Tab Content: Tasks */}
                  {detailTab === 'tasks' && (
                    <div className="space-y-2.5">
                      {/* Status filter for tasks */}
                      {memberDetail.tasks.length > 0 && (
                        <div className="flex items-center gap-1.5 pb-1 flex-wrap">
                          <span className="text-[10px] font-black uppercase text-[#171717]/60 mr-1">Filter:</span>
                          {[
                            { id: 'all', label: 'Semua', count: memberDetail.tasks.length },
                            { id: 'pending', label: 'Pending', count: memberDetail.tasks.filter(t => !(t.is_completed || t.status === 'completed')).length },
                            { id: 'completed', label: 'Selesai', count: memberDetail.tasks.filter(t => t.is_completed || t.status === 'completed').length },
                          ].map((st) => (
                            <button
                              key={st.id}
                              onClick={() => setTaskStatusFilter(st.id)}
                              className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                                taskStatusFilter === st.id
                                  ? 'bg-[#171717] text-white shadow-[1px_1px_0px_#FF2F92]'
                                  : 'bg-white text-[#171717] border border-[#171717]/25 hover:border-[#171717]'
                              }`}
                            >
                              <span>{st.label}</span>
                              <span className={`text-[8.5px] px-1 py-0.2 rounded ${taskStatusFilter === st.id ? 'bg-[#FF2F92] text-white' : 'bg-neutral-100 text-[#171717]'}`}>
                                {st.count}
                              </span>
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
                            <div className="p-8 text-center bg-[#FAF7F2] border border-[#171717]/15 rounded-lg space-y-1.5">
                              <CheckSquare size={24} className="mx-auto text-[#171717]/30" />
                              <p className="text-xs font-bold text-[#171717]/70">
                                {taskStatusFilter === 'all'
                                  ? 'Personel ini belum memiliki tugas yang ditugaskan.'
                                  : 'Tidak ada tugas yang sesuai dengan filter.'}
                              </p>
                            </div>
                          )
                        }

                        return (
                          <div className="space-y-2">
                            {filteredTasks.map((t) => {
                              const isDone = t.is_completed || t.status === 'completed'
                              const isOverdue = !isDone && t.deadline && new Date(t.deadline) < new Date()
                              const priorityBg =
                                t.priority === 'high' ? 'bg-[#FF2F92] text-white' :
                                t.priority === 'medium' ? 'bg-[#FFD83D] text-[#171717]' :
                                'bg-[#B8A0F0] text-[#171717]'

                              return (
                                <div
                                  key={t.id}
                                  className={`p-3 bg-white border border-[#171717] rounded-lg flex items-center justify-between gap-3 shadow-[2px_2px_0px_#171717] ${
                                    isDone ? 'opacity-80 bg-neutral-50' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    {isDone ? (
                                      <CheckCircle2 size={16} className="text-[#10B981] shrink-0" />
                                    ) : (
                                      <Circle size={16} className="text-[#171717]/40 shrink-0" />
                                    )}

                                    <div className="min-w-0 flex-1">
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
                                    <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded border border-[#171717]/30 ${priorityBg}`}>
                                      {t.priority}
                                    </span>
                                    <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded border border-[#171717]/30 ${
                                      isDone ? 'bg-[#10B981] text-white' : 'bg-neutral-100 text-[#171717]'
                                    }`}>
                                      {t.status}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {/* Tab Content: Projects */}
                  {detailTab === 'projects' && (
                    <div className="space-y-2">
                      {memberDetail.projects.length === 0 ? (
                        <div className="p-8 text-center bg-[#FAF7F2] border border-[#171717]/15 rounded-lg space-y-1.5">
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
                                  <Link
                                    to={`/projects/${proj.id}`}
                                    className="hover:text-[#FF2F92] hover:underline inline-flex items-center gap-1 group"
                                    title="Buka Detail Proyek"
                                  >
                                    <span>{proj.name}</span>
                                    <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#FF2F92]" />
                                  </Link>
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
                              <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden border border-[#171717]/15">
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
                </div>

                {/* Modal Footer */}
                <div className="px-4 sm:px-5 py-3 border-t-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-[#171717]/65 font-semibold truncate hidden sm:block">
                    Kontak: {memberDetail.user.email} {memberDetail.user.phone ? `· ${memberDetail.user.phone}` : ''}
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseDetail}
                    className="w-full sm:w-auto px-5 py-2 bg-[#171717] text-white rounded-md text-xs font-black uppercase hover:bg-neutral-800 transition-colors cursor-pointer min-h-[36px]"
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
