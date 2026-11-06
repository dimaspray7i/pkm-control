import { useState, useEffect } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  ShieldCheck, Mail, Phone, UserCheck, Shield, Users as UsersIcon,
  Key, AlertCircle, Plus, Edit3, Trash2, X, Check, Loader2,
  RotateCcw, Search, ArrowUpDown, Power
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const ROLE_LABELS = {
  admin:           { label: 'Super Admin',     bg: 'bg-[#FF2F92] text-white', perm: 'Akses penuh ke semua fitur dan data sistem.' },
  pimpinan:        { label: 'Pimpinan',        bg: 'bg-[#171717] text-white', perm: 'Dapat melihat laporan dan dashboard executive.' },
  project_manager: { label: 'Project Manager', bg: 'bg-[#B8A0F0] text-[#171717]', perm: 'Mengelola proyek, tim, dan penugasan tugas.' },
  member:          { label: 'Member',          bg: 'bg-[#FFD83D] text-[#171717]', perm: 'Dapat melihat dan menyelesaikan tugas yang ditugaskan.' },
}

const ROLE_PERMS = [
  { role: 'Super Admin', color: '#FF2F92', bg: 'bg-[#FFF0F8]', border: 'border-[#FF2F92]/30', perms: ['Manajemen Pengguna & Role', 'Pengaturan Sistem', 'Semua Laporan & Analitik', 'CRUD Proyek & Tugas', 'AI Business Analyst'] },
  { role: 'Pimpinan', color: '#171717', bg: 'bg-[#F5F1E9]', border: 'border-[#171717]/20', perms: ['Dashboard Executive', 'Laporan & Analitik', 'Lihat Semua Proyek'] },
  { role: 'Project Manager', color: '#B8A0F0', bg: 'bg-[#F3F0FD]', border: 'border-[#B8A0F0]/40', perms: ['Manajemen Proyek', 'Manajemen Tugas', 'Sprint Tracker', 'Anggota Tim'] },
  { role: 'Member', color: '#FBBF24', bg: 'bg-[#FFFBEB]', border: 'border-[#FFD83D]/50', perms: ['Lihat Tugas Sendiri', 'Toggle Selesai Tugas'] },
]

export default function Users() {
  const { user: currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'

  const [users, setUsers]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [search, setSearch]       = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'active', 'inactive'
  const [sortBy, setSortBy]       = useState('name') // 'name', 'email', 'role', 'status'
  const [sortOrder, setSortOrder] = useState('asc') // 'asc', 'desc'

  // Modals state
  const [isAddOpen, setIsAddOpen]       = useState(false)
  const [isEditOpen, setIsEditOpen]     = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [submitting, setSubmitting]     = useState(false)
  const [togglingId, setTogglingId]     = useState(null)
  const [formErrors, setFormErrors]     = useState({})
  const [feedback, setFeedback]         = useState(null)

  // Form inputs
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'member',
    phone: '',
    password: '',
    is_active: true,
  })

  // Global Escape key listener to close modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) {
        if (isAddOpen) setIsAddOpen(false)
        if (isEditOpen) setIsEditOpen(false)
        if (isDeleteOpen) setIsDeleteOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAddOpen, isEditOpen, isDeleteOpen, submitting])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await api.get('/users')
      setUsers(res.data.users || [])
      setError(null)
    } catch {
      setError('Gagal memuat data pengguna dari backend.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const openAddModal = () => {
    setFormData({
      name: '',
      email: '',
      role: 'member',
      phone: '',
      password: '',
      is_active: true,
    })
    setFormErrors({})
    setIsAddOpen(true)
  }

  const openEditModal = (u) => {
    setSelectedUser(u)
    setFormData({
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone || '',
      password: '',
      is_active: u.is_active,
    })
    setFormErrors({})
    setIsEditOpen(true)
  }

  const openDeleteModal = (u) => {
    setSelectedUser(u)
    setIsDeleteOpen(true)
  }

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setFormErrors({})

    try {
      const res = await api.post('/users', formData)
      setUsers(prev => [...prev, res.data.user])
      setIsAddOpen(false)
      setFeedback({ type: 'success', message: `Pengguna ${res.data.user.name} berhasil ditambahkan.` })
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        setFormErrors(err.response.data.errors)
      } else {
        setFormErrors({ general: [err.response?.data?.message || 'Gagal menyimpan pengguna baru.'] })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateSubmit = async (e) => {
    e.preventDefault()
    if (!selectedUser) return
    setSubmitting(true)
    setFormErrors({})

    try {
      const payload = { ...formData }
      if (!payload.password) delete payload.password

      // Proteksi sisi klien: jika mengedit akun sendiri, pertahankan role dan status aktif
      if (selectedUser.id === currentUser?.id) {
        payload.role = currentUser.role
        payload.is_active = true
      }

      const res = await api.put(`/users/${selectedUser.id}`, payload)
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? res.data.user : u))
      setIsEditOpen(false)
      setFeedback({ type: 'success', message: `Data ${res.data.user.name} berhasil diperbarui.` })
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        setFormErrors(err.response.data.errors)
      } else {
        setFormErrors({ general: [err.response?.data?.message || 'Gagal memperbarui pengguna.'] })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteSubmit = async () => {
    if (!selectedUser) return
    setSubmitting(true)

    try {
      await api.delete(`/users/${selectedUser.id}`)
      setUsers(prev => prev.filter(u => u.id !== selectedUser.id))
      setIsDeleteOpen(false)
      setFeedback({ type: 'success', message: `Pengguna ${selectedUser.name} berhasil dihapus dari sistem.` })
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus pengguna.')
    } finally {
      setSubmitting(false)
    }
  }

  // Quick toggle active / inactive status
  const handleToggleStatus = async (user) => {
    if (!isAdmin) return

    if (user.id === currentUser?.id) {
      setFeedback({ type: 'error', message: 'Anda tidak dapat menonaktifkan akun Anda sendiri saat sedang masuk.' })
      setTimeout(() => setFeedback(null), 4000)
      return
    }

    setTogglingId(user.id)
    try {
      const res = await api.post(`/users/${user.id}/toggle-status`)
      const updatedUser = res.data.user
      setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u))
      setFeedback({
        type: 'success',
        message: `Status ${updatedUser.name} diubah menjadi ${updatedUser.is_active ? 'Aktif' : 'Nonaktif'}.`
      })
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Gagal mengubah status akun.' })
      setTimeout(() => setFeedback(null), 4000)
    } finally {
      setTogglingId(null)
    }
  }

  const filteredUsers = users.filter(u => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.phone || '').toLowerCase().includes(search.toLowerCase())

    const matchRole = roleFilter === 'all' || u.role === roleFilter

    const matchStatus = statusFilter === 'all'
      || (statusFilter === 'active' && u.is_active)
      || (statusFilter === 'inactive' && !u.is_active)

    return matchSearch && matchRole && matchStatus
  })

  // Sorting
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    let aVal = a[sortBy] ?? ''
    let bVal = b[sortBy] ?? ''
    if (sortBy === 'status') {
      aVal = a.is_active ? 1 : 0
      bVal = b.is_active ? 1 : 0
    }
    if (typeof aVal === 'string') {
      const cmp = aVal.localeCompare(bVal)
      return sortOrder === 'asc' ? cmp : -cmp
    }
    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
  })

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

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortOrder('asc')
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <Loader2 size={32} className="animate-spin text-[#FF2F92]" />
      <p className="font-display text-lg uppercase tracking-wider text-[#171717]">MEMUAT DAFTAR PENGGUNA DARI DATABASE...</p>
    </div>
  )

  if (error) return (
    <div className="p-6 bg-[#FFD83D] border border-[#171717] rounded-md shadow-[4px_4px_0px_#171717] max-w-md my-8">
      <h2 className="font-display text-xl uppercase mb-2">Gagal Memuat</h2>
      <p className="text-xs font-semibold mb-3">{error}</p>
      <button onClick={fetchUsers} className="px-3.5 py-1.5 bg-[#171717] text-white font-bold text-xs uppercase flex items-center gap-1.5 rounded cursor-pointer min-h-[36px]">
        <RotateCcw size={13} /> Coba Lagi
      </button>
    </div>
  )

  return (
    <div className="space-y-4 pb-6">
      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-3 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center justify-between ${
          feedback.type === 'error' ? 'bg-[#FF2F92]/20 text-[#FF2F92]' : 'bg-[#10B981]/20 text-[#171717]'
        }`}>
          <p className="text-xs font-black">{feedback.message}</p>
          <button onClick={() => setFeedback(null)} className="text-[#171717] font-bold text-xs cursor-pointer p-1">✕</button>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="MANAJEMEN PENGGUNA"
        subtitle="Kelola akun, role, dan hak akses tim PKM Business Control Center secara real-time."
        tag="ADMINISTRASI SISTEM"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-[#FF2F92] text-white px-3 py-1.5 border border-[#171717] rounded-lg flex items-center gap-1.5 shadow-[2px_2px_0px_#171717] min-h-[36px]">
              <ShieldCheck size={14} />
              <span className="font-black text-xs uppercase">{isAdmin ? 'Akses Super Admin' : 'Mode Terbaca'}</span>
            </div>
            {isAdmin && (
              <button
                onClick={openAddModal}
                className="pkm-btn-pink flex items-center gap-1.5 text-xs font-black uppercase cursor-pointer min-h-[36px]"
              >
                <Plus size={14} /> Tambah Pengguna
              </button>
            )}
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Pengguna', value: users.length, bg: 'bg-white', icon: <UsersIcon size={16} /> },
          { label: 'Super Admin', value: users.filter(u => u.role === 'admin').length, bg: 'bg-[#FF2F92] text-white', icon: <ShieldCheck size={16} /> },
          { label: 'Project Manager', value: users.filter(u => u.role === 'project_manager').length, bg: 'bg-[#B8A0F0] text-[#171717]', icon: <UserCheck size={16} /> },
          { label: 'Akun Aktif', value: `${users.filter(u => u.is_active).length} / ${users.length}`, bg: 'bg-[#10B981] text-white', icon: <Key size={16} /> },
        ].map((c, i) => (
          <div key={i} className={`p-3.5 border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] ${c.bg}`}>
            <div className="flex items-center justify-between mb-1.5 opacity-80">
              {c.icon}
              <span className="text-[9px] font-black uppercase tracking-wider">{c.label}</span>
            </div>
            <p className="font-display text-2xl sm:text-3xl leading-none">{c.value}</p>
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, email, nomor HP pengguna..."
            className="w-full pl-8 pr-8 py-2 bg-[#FAF7F2] border border-[#171717] rounded-md text-xs font-semibold text-[#171717] placeholder:text-[#171717]/40 focus:outline-none focus:border-[#FF2F92] min-h-[38px]"
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

        {/* Role & Status Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter Buttons */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 max-w-full">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'admin', label: 'Admin' },
              { id: 'project_manager', label: 'PM' },
              { id: 'pimpinan', label: 'Pimpinan' },
              { id: 'member', label: 'Member' },
            ].map(r => (
              <button
                key={r.id}
                onClick={() => setRoleFilter(r.id)}
                className={`px-2.5 py-1.5 text-[10px] font-black uppercase rounded-md border transition-all cursor-pointer min-h-[36px] shrink-0 ${
                  roleFilter === r.id
                    ? 'bg-[#171717] text-white border-[#171717] shadow-[1px_1px_0px_#FF2F92]'
                    : 'bg-white text-[#171717] border-[#171717]/30 hover:border-[#171717]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FAF7F2] border border-[#171717] rounded-md text-xs font-bold focus:outline-none focus:border-[#FF2F92] cursor-pointer min-h-[38px]"
            title="Filter berdasarkan Status Akun"
          >
            <option value="all">Semua Status</option>
            <option value="active">Hanya Aktif</option>
            <option value="inactive">Hanya Nonaktif</option>
          </select>

          {/* Sort By Select */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FAF7F2] border border-[#171717] rounded-md text-xs font-bold focus:outline-none focus:border-[#FF2F92] cursor-pointer min-h-[38px]"
            title="Urutkan berdasarkan kolom"
          >
            <option value="name">Urut Nama</option>
            <option value="email">Urut Email</option>
            <option value="role">Urut Role</option>
            <option value="status">Urut Status</option>
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

      {/* Two Column: Table / Cards + Role Permissions Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* User Content (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-[#171717] rounded-lg overflow-hidden shadow-[3px_3px_0px_#171717]">
          <div className="p-3.5 border-b border-[#171717]/15 bg-[#FAF7F2] flex items-center justify-between">
            <h3 className="font-display text-sm uppercase text-[#171717]">DAFTAR PENGGUNA TERDAFTAR</h3>
            <span className="text-[10px] font-bold text-[#171717]/60">{sortedUsers.length} dari {users.length} Akun</span>
          </div>

          {/* Empty State */}
          {sortedUsers.length === 0 ? (
            <div className="p-8 sm:p-12 text-center space-y-2.5">
              <UsersIcon size={32} className="mx-auto text-[#171717]/30" />
              <p className="text-xs text-[#171717]/70 font-bold">
                {hasActiveFilters
                  ? 'Tidak ditemukan pengguna yang cocok dengan kriteria pencarian atau filter aktif.'
                  : 'Belum ada data pengguna yang terdaftar di sistem.'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="px-3.5 py-1.5 bg-[#171717] text-white rounded-md text-xs font-black uppercase hover:bg-neutral-800 transition-colors cursor-pointer min-h-[36px] inline-flex items-center gap-1.5"
                >
                  <RotateCcw size={12} />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile View: Cards (< 640px) */}
              <div className="block sm:hidden divide-y divide-[#171717]/10">
                {sortedUsers.map((u) => {
                  const roleConfig = ROLE_LABELS[u.role] || ROLE_LABELS.member
                  const isSelf = u.id === currentUser?.id
                  const isToggling = togglingId === u.id

                  return (
                    <div key={u.id} className={`p-4 space-y-3 ${isSelf ? 'bg-[#FFF0F8]' : 'bg-white'}`}>
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 border border-[#171717] ${isSelf ? 'bg-[#FF2F92] text-white' : 'bg-[#171717] text-white'}`}>
                            {u.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs text-[#171717] leading-snug flex items-center gap-1 truncate">
                              <span className="truncate">{u.name}</span>
                              {isSelf && <span className="text-[8px] font-black px-1 py-px bg-[#FFD83D] border border-[#171717] rounded-sm shrink-0">SAYA</span>}
                            </p>
                            <p className="text-[10.5px] text-[#171717]/60 truncate mt-0.5">{u.email}</p>
                            {u.phone && <p className="text-[10px] text-[#171717]/50 font-mono mt-0.5">{u.phone}</p>}
                          </div>
                        </div>

                        <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-sm border border-[#171717] shrink-0 ${roleConfig.bg}`}>
                          {roleConfig.label}
                        </span>
                      </div>

                      {/* Status & Actions row */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#171717]/10">
                        <div>
                          {isAdmin && !isSelf ? (
                            <button
                              onClick={() => handleToggleStatus(u)}
                              disabled={isToggling}
                              title={`Klik untuk ubah status menjadi ${u.is_active ? 'Nonaktif' : 'Aktif'}`}
                              className={`inline-flex items-center gap-1.5 text-[9.5px] font-black uppercase px-2.5 py-1 rounded border transition-all cursor-pointer min-h-[30px] ${
                                u.is_active
                                  ? 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40'
                                  : 'bg-neutral-200 text-neutral-600 border-neutral-300'
                              }`}
                            >
                              {isToggling ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <span className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-[#10B981]' : 'bg-neutral-400'}`}></span>
                              )}
                              <span>{u.is_active ? 'Aktif' : 'Nonaktif'}</span>
                            </button>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 text-[9.5px] font-black uppercase px-2.5 py-1 rounded border ${
                              u.is_active
                                ? 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40'
                                : 'bg-neutral-200 text-neutral-600 border-neutral-300'
                            }`} title={isSelf ? 'Akun Anda yang sedang aktif' : undefined}>
                              <span className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-[#10B981]' : 'bg-neutral-400'}`}></span>
                              <span>{u.is_active ? 'Aktif' : 'Nonaktif'}</span>
                            </span>
                          )}
                        </div>

                        {isAdmin && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => openEditModal(u)}
                              className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center bg-white hover:bg-[#FFD83D] border border-[#171717] rounded-md text-[#171717] transition-all cursor-pointer shadow-[1px_1px_0px_#171717]"
                              title="Edit Pengguna"
                            >
                              <Edit3 size={13} />
                            </button>
                            {!isSelf ? (
                              <button
                                onClick={() => openDeleteModal(u)}
                                className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center bg-white hover:bg-[#FF2F92] hover:text-white border border-[#171717] rounded-md text-[#171717] transition-all cursor-pointer shadow-[1px_1px_0px_#171717]"
                                title="Hapus Pengguna"
                              >
                                <Trash2 size={13} />
                              </button>
                            ) : (
                              <span className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center text-[#171717]/30 border border-transparent cursor-not-allowed" title="Akun Anda yang sedang login tidak dapat dihapus">
                                <Trash2 size={13} />
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop / Tablet View: Table (>= 640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-100 text-[10px] font-black uppercase tracking-wider text-[#171717] border-b border-[#171717]/15 select-none">
                    <tr>
                      <th className="py-2.5 px-4 cursor-pointer hover:bg-neutral-200 transition-colors" onClick={() => toggleSort('name')}>
                        <div className="flex items-center gap-1">
                          <span>Nama & Email</span>
                          {sortBy === 'name' && <ArrowUpDown size={11} className={sortOrder === 'desc' ? 'rotate-180 text-[#FF2F92]' : 'text-[#FF2F92]'} />}
                        </div>
                      </th>
                      <th className="py-2.5 px-4 cursor-pointer hover:bg-neutral-200 transition-colors" onClick={() => toggleSort('role')}>
                        <div className="flex items-center gap-1">
                          <span>Peran (Role)</span>
                          {sortBy === 'role' && <ArrowUpDown size={11} className={sortOrder === 'desc' ? 'rotate-180 text-[#FF2F92]' : 'text-[#FF2F92]'} />}
                        </div>
                      </th>
                      <th className="py-2.5 px-4 hidden md:table-cell">Nomor HP</th>
                      <th className="py-2.5 px-4 cursor-pointer hover:bg-neutral-200 transition-colors" onClick={() => toggleSort('status')}>
                        <div className="flex items-center gap-1">
                          <span>Status Akun</span>
                          {sortBy === 'status' && <ArrowUpDown size={11} className={sortOrder === 'desc' ? 'rotate-180 text-[#FF2F92]' : 'text-[#FF2F92]'} />}
                        </div>
                      </th>
                      {isAdmin && <th className="py-2.5 px-4 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#171717]/10 font-semibold text-[#171717]">
                    {sortedUsers.map((u) => {
                      const roleConfig = ROLE_LABELS[u.role] || ROLE_LABELS.member
                      const isSelf = u.id === currentUser?.id
                      const isToggling = togglingId === u.id

                      return (
                        <tr key={u.id} className={`hover:bg-[#FAF7F2] transition-colors ${isSelf ? 'bg-[#FFF0F8]' : ''}`}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 border border-[#171717] ${isSelf ? 'bg-[#FF2F92] text-white' : 'bg-[#171717] text-white'}`}>
                                {u.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-[#171717] leading-tight flex items-center gap-1.5 truncate">
                                  <span>{u.name}</span>
                                  {isSelf && <span className="text-[8px] font-black px-1 py-px bg-[#FFD83D] border border-[#171717] rounded-sm shrink-0">SAYA</span>}
                                </p>
                                <p className="text-[10.5px] text-[#171717]/55 mt-0.5 truncate">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-sm border border-[#171717] ${roleConfig.bg}`}>
                              {roleConfig.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 hidden md:table-cell text-[#171717]/70 font-mono text-[11px]">
                            {u.phone || '—'}
                          </td>
                          <td className="py-3 px-4">
                            {isAdmin && !isSelf ? (
                              <button
                                onClick={() => handleToggleStatus(u)}
                                disabled={isToggling}
                                title={`Klik untuk ubah status menjadi ${u.is_active ? 'Nonaktif' : 'Aktif'}`}
                                className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-sm border transition-all cursor-pointer hover:opacity-85 ${
                                  u.is_active
                                    ? 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40'
                                    : 'bg-neutral-200 text-neutral-600 border-neutral-300'
                                }`}
                              >
                                {isToggling ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-[#10B981]' : 'bg-neutral-400'}`}></span>
                                )}
                                <span>{u.is_active ? 'Aktif' : 'Nonaktif'}</span>
                              </button>
                            ) : (
                              <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-sm border ${
                                u.is_active
                                  ? 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40'
                                  : 'bg-neutral-200 text-neutral-600 border-neutral-300'
                              }`} title={isSelf ? 'Akun Anda yang sedang aktif' : undefined}>
                                <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-[#10B981]' : 'bg-neutral-400'}`}></span>
                                {u.is_active ? 'Aktif' : 'Nonaktif'}
                              </span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => openEditModal(u)}
                                  className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center hover:bg-[#FFD83D] border border-transparent hover:border-[#171717] rounded-md text-[#171717] transition-all cursor-pointer"
                                  title="Edit Pengguna"
                                >
                                  <Edit3 size={13} />
                                </button>
                                {!isSelf ? (
                                  <button
                                    onClick={() => openDeleteModal(u)}
                                    className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center hover:bg-[#FF2F92] hover:text-white border border-transparent hover:border-[#171717] rounded-md text-[#171717] transition-all cursor-pointer"
                                    title="Hapus Pengguna"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                ) : (
                                  <span className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center text-[#171717]/30 cursor-not-allowed" title="Akun Anda yang sedang login tidak dapat dihapus">
                                    <Trash2 size={13} />
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Role Permissions Matrix (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white p-4 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
            <h3 className="font-display text-sm uppercase text-[#171717] border-b border-[#171717]/10 pb-2 mb-3 flex items-center gap-2">
              <Shield size={14} className="text-[#FF2F92]" />
              MATRIKS HAK AKSES ROLE
            </h3>
            <div className="space-y-3">
              {ROLE_PERMS.map((rp, idx) => (
                <div key={idx} className={`p-3 rounded-lg border ${rp.border} ${rp.bg}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: rp.color }} />
                    <p className="font-display text-xs uppercase text-[#171717] tracking-wide">{rp.role}</p>
                  </div>
                  <ul className="space-y-1">
                    {rp.perms.map((p, pIdx) => (
                      <li key={pIdx} className="text-[10px] font-semibold text-[#171717]/80 flex items-center gap-1.5">
                        <span className="text-[#171717]/40 text-[8px]">✓</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Tambah Pengguna */}
      {isAddOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#171717]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setIsAddOpen(false)
          }}
        >
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#171717] w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#FF2F92] border border-[#171717]"></span>
                <div>
                  <h3 className="font-display text-lg uppercase tracking-tight text-[#171717]">Tambah Pengguna Baru</h3>
                  <p className="text-[10.5px] font-semibold text-[#171717]/60">Daftarkan akun tim baru ke sistem PKM</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1.5 hover:bg-[#FFD83D] border border-[#171717] rounded-md text-[#171717] cursor-pointer transition-colors"
                title="Tutup Modal (Esc)"
                disabled={submitting}
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="create-user-form" onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 min-h-0">
              {formErrors.general && (
                <div className="p-2.5 bg-[#FF2F92]/20 border border-[#FF2F92] rounded-md text-xs font-bold text-[#FF2F92] flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{formErrors.general[0]}</span>
                </div>
              )}

              <div>
                <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                  Nama Lengkap <span className="text-[#FF2F92]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Misal: Rahmat Hidayat"
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#171717] rounded-md text-xs font-semibold focus:outline-none focus:border-[#FF2F92] min-h-[38px]"
                />
                {formErrors.name && <p className="text-[10px] text-[#FF2F92] font-bold mt-1">{formErrors.name[0]}</p>}
              </div>

              <div>
                <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                  Alamat Email <span className="text-[#FF2F92]">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="rahmat@pkm.co.id"
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#171717] rounded-md text-xs font-semibold focus:outline-none focus:border-[#FF2F92] min-h-[38px]"
                />
                {formErrors.email && <p className="text-[10px] text-[#FF2F92] font-bold mt-1">{formErrors.email[0]}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                    Peran (Role) <span className="text-[#FF2F92]">*</span>
                  </label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#171717] rounded-md text-xs font-bold focus:outline-none focus:border-[#FF2F92] min-h-[38px] cursor-pointer"
                  >
                    <option value="member">Member</option>
                    <option value="project_manager">Project Manager</option>
                    <option value="pimpinan">Pimpinan</option>
                    <option value="admin">Super Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">Nomor HP</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#171717] rounded-md text-xs font-semibold focus:outline-none focus:border-[#FF2F92] min-h-[38px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                  Kata Sandi (Password) <span className="text-[#FF2F92]">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#171717] rounded-md text-xs font-semibold focus:outline-none focus:border-[#FF2F92] min-h-[38px]"
                />
                {formErrors.password && <p className="text-[10px] text-[#FF2F92] font-bold mt-1">{formErrors.password[0]}</p>}
              </div>
            </form>

            {/* Footer */}
            <div className="px-4 sm:px-5 py-3 border-t-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                disabled={submitting}
                className="px-4 py-2 bg-white border border-[#171717] rounded-md text-xs font-black uppercase text-[#171717] hover:bg-neutral-100 cursor-pointer min-h-[36px]"
              >
                Batal
              </button>
              <button
                type="submit"
                form="create-user-form"
                disabled={submitting}
                className="pkm-btn-pink flex items-center gap-1.5 text-xs font-black uppercase disabled:opacity-50 cursor-pointer min-h-[36px] px-4"
              >
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                <span>Simpan Pengguna</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Pengguna */}
      {isEditOpen && selectedUser && (
        <div
          className="fixed inset-0 z-50 bg-[#171717]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setIsEditOpen(false)
          }}
        >
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#171717] w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#FFD83D] border border-[#171717]"></span>
                <div>
                  <h3 className="font-display text-lg uppercase tracking-tight text-[#171717]">Edit Pengguna</h3>
                  <p className="text-[10.5px] font-semibold text-[#171717]/60 truncate max-w-[240px]">Profil akun: {selectedUser.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="p-1.5 hover:bg-[#FFD83D] border border-[#171717] rounded-md text-[#171717] cursor-pointer transition-colors"
                title="Tutup Modal (Esc)"
                disabled={submitting}
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="edit-user-form" onSubmit={handleUpdateSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 min-h-0">
              {formErrors.general && (
                <div className="p-2.5 bg-[#FF2F92]/20 border border-[#FF2F92] rounded-md text-xs font-bold text-[#FF2F92] flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{formErrors.general[0]}</span>
                </div>
              )}

              <div>
                <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                  Nama Lengkap <span className="text-[#FF2F92]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#171717] rounded-md text-xs font-semibold focus:outline-none focus:border-[#FF2F92] min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                  Alamat Email <span className="text-[#FF2F92]">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#171717] rounded-md text-xs font-semibold focus:outline-none focus:border-[#FF2F92] min-h-[38px]"
                />
                {formErrors.email && <p className="text-[10px] text-[#FF2F92] font-bold mt-1">{formErrors.email[0]}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                    Peran (Role) <span className="text-[#FF2F92]">*</span>
                  </label>
                  <select
                    value={formData.role}
                    disabled={selectedUser.id === currentUser?.id}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className={`w-full px-3 py-2 bg-[#FAF7F2] border border-[#171717] rounded-md text-xs font-bold focus:outline-none focus:border-[#FF2F92] min-h-[38px] ${
                      selectedUser.id === currentUser?.id ? 'opacity-60 cursor-not-allowed bg-neutral-100' : 'cursor-pointer'
                    }`}
                  >
                    <option value="member">Member</option>
                    <option value="project_manager">Project Manager</option>
                    <option value="pimpinan">Pimpinan</option>
                    <option value="admin">Super Admin</option>
                  </select>
                  {selectedUser.id === currentUser?.id && (
                    <p className="text-[9px] text-[#171717]/60 mt-1 font-bold">Role akun sendiri tidak dapat diubah</p>
                  )}
                </div>

                <div>
                  <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">Nomor HP</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#171717] rounded-md text-xs font-semibold focus:outline-none focus:border-[#FF2F92] min-h-[38px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-black uppercase text-[#171717] mb-1">
                  Kata Sandi Baru (Kosongkan jika tidak diubah)
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#171717] rounded-md text-xs font-semibold focus:outline-none focus:border-[#FF2F92] min-h-[38px]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1 bg-[#FAF7F2] p-2.5 rounded-md border border-[#171717]/15">
                <input
                  type="checkbox"
                  id="user_active"
                  checked={formData.is_active}
                  disabled={selectedUser.id === currentUser?.id}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  className={`accent-[#FF2F92] w-4 h-4 ${
                    selectedUser.id === currentUser?.id ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  }`}
                />
                <label
                  htmlFor="user_active"
                  className={`text-xs font-black text-[#171717] ${
                    selectedUser.id === currentUser?.id ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                  }`}
                >
                  Akun Aktif (Dapat Login ke Sistem)
                  {selectedUser.id === currentUser?.id && ' — Akun sendiri tidak dapat dinonaktifkan'}
                </label>
              </div>
            </form>

            {/* Footer */}
            <div className="px-4 sm:px-5 py-3 border-t-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                disabled={submitting}
                className="px-4 py-2 bg-white border border-[#171717] rounded-md text-xs font-black uppercase text-[#171717] hover:bg-neutral-100 cursor-pointer min-h-[36px]"
              >
                Batal
              </button>
              <button
                type="submit"
                form="edit-user-form"
                disabled={submitting}
                className="pkm-btn-pink flex items-center gap-1.5 text-xs font-black uppercase disabled:opacity-50 cursor-pointer min-h-[36px] px-4"
              >
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Hapus Pengguna */}
      {isDeleteOpen && selectedUser && (
        <div
          className="fixed inset-0 z-50 bg-[#171717]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setIsDeleteOpen(false)
          }}
        >
          <div className="bg-white border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#171717] w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#FF2F92] border border-[#171717]"></span>
                <div>
                  <h3 className="font-display text-lg uppercase tracking-tight text-[#171717]">Hapus Pengguna</h3>
                  <p className="text-[10.5px] font-semibold text-[#171717]/60">Konfirmasi penghapusan akses akun</p>
                </div>
              </div>
              <button
                onClick={() => setIsDeleteOpen(false)}
                className="p-1.5 hover:bg-[#FFD83D] border border-[#171717] rounded-md text-[#171717] cursor-pointer transition-colors"
                title="Tutup Modal (Esc)"
                disabled={submitting}
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 min-h-0">
              <div className="p-3 bg-[#FFF0F8] border border-[#FF2F92]/30 rounded-lg text-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-[#FF2F92] shrink-0" />
                  <p className="font-black text-sm text-[#171717]">{selectedUser.name}</p>
                </div>
                <p className="text-[11px] text-[#171717]/70 font-semibold">{selectedUser.email} · Role: {selectedUser.role?.toUpperCase()}</p>
                <p className="text-[10.5px] text-[#171717]/80 pt-1.5 border-t border-[#171717]/10 leading-relaxed">
                  Tindakan ini akan menghapus akses login pengguna dari sistem. Data proyek dan riwayat tugas yang pernah ditangani pengguna tetap aman di database.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-5 py-3 border-t-1.5 border-[#171717] bg-[#FAF7F2] shrink-0 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                disabled={submitting}
                className="px-4 py-2 bg-white border border-[#171717] rounded-md text-xs font-black uppercase text-[#171717] hover:bg-neutral-100 cursor-pointer min-h-[36px]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-[#FF2F92] text-white border border-[#171717] rounded-md shadow-[2px_2px_0px_#171717] text-xs font-black uppercase flex items-center gap-1.5 disabled:opacity-50 cursor-pointer hover:bg-[#E0267D] transition-colors min-h-[36px]"
              >
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>Ya, Hapus Pengguna</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
