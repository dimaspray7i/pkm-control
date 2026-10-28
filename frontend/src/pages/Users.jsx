import { useState, useEffect } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { ShieldCheck, Mail, Phone, UserCheck, Shield, Users as UsersIcon, Key, AlertCircle, Plus, Edit3, Trash2, X, Check, Loader2, RotateCcw, Search } from 'lucide-react'
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

  // Modals state
  const [isAddOpen, setIsAddOpen]       = useState(false)
  const [isEditOpen, setIsEditOpen]     = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [submitting, setSubmitting]     = useState(false)
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

  const filteredUsers = users.filter(u => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.phone || '').toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

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
      <button onClick={fetchUsers} className="px-3.5 py-1.5 bg-[#171717] text-white font-bold text-xs uppercase flex items-center gap-1.5 rounded cursor-pointer">
        <RotateCcw size={13} /> Coba Lagi
      </button>
    </div>
  )

  return (
    <div className="space-y-4 pb-6">
      {/* Feedback Banner */}
      {feedback && (
        <div className="p-3 bg-[#10B981]/20 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center justify-between">
          <p className="text-xs font-black text-[#171717]">{feedback.message}</p>
          <button onClick={() => setFeedback(null)} className="text-[#171717] font-bold text-xs">✕</button>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="MANAJEMEN PENGGUNA"
        subtitle="Kelola akun, role, dan hak akses tim PKM Business Control Center secara real-time."
        tag="ADMINISTRASI SISTEM"
        actions={
          <div className="flex items-center gap-2">
            <div className="bg-[#FF2F92] text-white px-3 py-1.5 border border-[#171717] rounded-lg flex items-center gap-1.5 shadow-[2px_2px_0px_#171717]">
              <ShieldCheck size={14} />
              <span className="font-black text-xs uppercase">{isAdmin ? 'Akses Super Admin' : 'Mode Terbaca'}</span>
            </div>
            {isAdmin && (
              <button
                onClick={openAddModal}
                className="pkm-btn-pink flex items-center gap-1.5 text-xs font-black uppercase"
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
          { label: 'Anggota / Member', value: users.filter(u => u.role === 'member').length, bg: 'bg-[#FFD83D] text-[#171717]', icon: <Key size={16} /> },
        ].map((c, i) => (
          <div key={i} className={`p-3.5 border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] ${c.bg}`}>
            <div className="flex items-center justify-between mb-1.5 opacity-70">
              {c.icon}
              <span className="text-[9px] font-black uppercase tracking-wider">{c.label}</span>
            </div>
            <p className="font-display text-3xl leading-none">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#171717]/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, email, nomor HP pengguna..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#FAF7F2] border border-[#171717]/40 rounded text-xs font-semibold text-[#171717] placeholder:text-[#171717]/40 focus:outline-none focus:border-[#FF2F92]"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
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
              className={`px-2.5 py-1 text-[10.5px] font-black uppercase rounded border transition-all cursor-pointer ${
                roleFilter === r.id
                  ? 'bg-[#171717] text-white border-[#171717]'
                  : 'bg-white text-[#171717] border-[#171717]/30 hover:border-[#171717]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Two Column: Table + Role Permissions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* User Table (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-[#171717] rounded-lg overflow-hidden shadow-[3px_3px_0px_#171717]">
          <div className="p-3.5 border-b border-[#171717]/15 bg-[#FAF7F2] flex items-center justify-between">
            <h3 className="font-display text-sm uppercase text-[#171717]">DAFTAR PENGGUNA TERDAFTAR (DATABASE MYSQL)</h3>
            <span className="text-[10px] font-bold text-[#171717]/60">{filteredUsers.length} dari {users.length} Akun</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-100 text-[10px] font-black uppercase tracking-wider text-[#171717] border-b border-[#171717]/15">
                <tr>
                  <th className="py-2.5 px-4">Nama & Email</th>
                  <th className="py-2.5 px-4">Peran (Role)</th>
                  <th className="py-2.5 px-4 hidden sm:table-cell">Nomor HP</th>
                  <th className="py-2.5 px-4">Status</th>
                  {isAdmin && <th className="py-2.5 px-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#171717]/10 font-semibold text-[#171717]">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 5 : 4} className="py-8 text-center text-xs text-[#171717]/50 font-bold">
                      Tidak ditemukan pengguna yang cocok dengan kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const roleConfig = ROLE_LABELS[u.role] || ROLE_LABELS.member
                    const isSelf = u.id === currentUser?.id
                    return (
                      <tr key={u.id} className={`hover:bg-[#FAF7F2] transition-colors ${isSelf ? 'bg-[#FFF0F8]' : ''}`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${isSelf ? 'bg-[#FF2F92] text-white' : 'bg-[#171717] text-white'}`}>
                              {u.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-[#171717] leading-tight flex items-center gap-1">
                                {u.name}
                                {isSelf && <span className="text-[8px] font-black px-1 py-px bg-[#FFD83D] border border-[#171717] rounded-sm">SAYA</span>}
                              </p>
                              <p className="text-[10px] text-[#171717]/50 mt-0.5">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-sm border border-[#171717] ${roleConfig.bg}`}>
                            {roleConfig.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 hidden sm:table-cell text-[#171717]/70 font-mono text-[11px]">
                          {u.phone || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-sm border ${
                            u.is_active
                              ? 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40'
                              : 'bg-neutral-200 text-neutral-600 border-neutral-300'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-[#10B981]' : 'bg-neutral-400'}`}></span>
                            {u.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEditModal(u)}
                                className="p-1 hover:bg-[#FFD83D] border border-transparent hover:border-[#171717] rounded text-[#171717] transition-all cursor-pointer"
                                title="Edit Pengguna"
                              >
                                <Edit3 size={13} />
                              </button>
                              {!isSelf && (
                                <button
                                  onClick={() => openDeleteModal(u)}
                                  className="p-1 hover:bg-[#FF2F92] hover:text-white border border-transparent hover:border-[#171717] rounded text-[#171717] transition-all cursor-pointer"
                                  title="Hapus Pengguna"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Role Matrix (4 cols) */}
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
        <div className="fixed inset-0 z-50 bg-[#171717]/60 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-[#171717] rounded-lg shadow-[6px_6px_0px_#171717] w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b-1.5 border-[#171717] pb-3">
              <div>
                <h3 className="font-display text-xl uppercase tracking-wider text-[#171717]">Tambah Pengguna Baru</h3>
                <p className="text-[11px] font-semibold text-[#171717]/60">Daftarkan akun tim baru ke sistem PKM</p>
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
                <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Misal: Rahmat Hidayat"
                  className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                />
                {formErrors.name && <p className="text-[10px] text-[#FF2F92] font-bold mt-0.5">{formErrors.name[0]}</p>}
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">Alamat Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="rahmat@pkm.co.id"
                  className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                />
                {formErrors.email && <p className="text-[10px] text-[#FF2F92] font-bold mt-0.5">{formErrors.email[0]}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">Peran (Role) *</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                  >
                    <option value="member">Member</option>
                    <option value="project_manager">Project Manager</option>
                    <option value="pimpinan">Pimpinan</option>
                    <option value="admin">Super Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">Nomor HP</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">Kata Sandi (Password) *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                />
                {formErrors.password && <p className="text-[10px] text-[#FF2F92] font-bold mt-0.5">{formErrors.password[0]}</p>}
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
                  Simpan Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Pengguna */}
      {isEditOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-[#171717]/60 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-[#171717] rounded-lg shadow-[6px_6px_0px_#171717] w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b-1.5 border-[#171717] pb-3">
              <div>
                <h3 className="font-display text-xl uppercase tracking-wider text-[#171717]">Edit Pengguna</h3>
                <p className="text-[11px] font-semibold text-[#171717]/60">Perbarui profil akun {selectedUser.name}</p>
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
                <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">Alamat Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                />
                {formErrors.email && <p className="text-[10px] text-[#FF2F92] font-bold mt-0.5">{formErrors.email[0]}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">Peran (Role) *</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                  >
                    <option value="member">Member</option>
                    <option value="project_manager">Project Manager</option>
                    <option value="pimpinan">Pimpinan</option>
                    <option value="admin">Super Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">Nomor HP</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-[#171717] mb-1">Kata Sandi Baru (Kosongkan jika tidak diubah)</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Isi hanya jika ingin ganti password"
                  className="w-full px-3 py-2 bg-white border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="user_active"
                  checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  className="accent-[#FF2F92] w-4 h-4 cursor-pointer"
                />
                <label htmlFor="user_active" className="text-xs font-black text-[#171717] cursor-pointer">
                  Akun Aktif (Dapat Login ke Sistem)
                </label>
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

      {/* MODAL: Hapus Pengguna */}
      {isDeleteOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-[#171717]/60 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-[#171717] rounded-lg shadow-[6px_6px_0px_#171717] w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FF2F92]/20 border border-[#FF2F92] flex items-center justify-center shrink-0">
                <AlertCircle size={20} className="text-[#FF2F92]" />
              </div>
              <div>
                <h3 className="font-display text-xl uppercase tracking-wider text-[#171717]">Hapus Pengguna?</h3>
                <p className="text-[11px] font-semibold text-[#171717]/60">Tindakan ini menghapus akses akun dari sistem.</p>
              </div>
            </div>

            <div className="p-3 bg-white border border-[#171717] rounded text-xs">
              <p className="font-black text-[#171717]">{selectedUser.name}</p>
              <p className="text-[10px] text-[#171717]/60 mt-0.5">{selectedUser.email} · Role: {selectedUser.role}</p>
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
