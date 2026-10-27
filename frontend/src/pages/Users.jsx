import { useAuth } from '../contexts/AuthContext'
import { ShieldCheck, Mail, Phone, UserCheck, Shield, Users as UsersIcon, Key, AlertCircle } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const ROLE_LABELS = {
  admin:           { label: 'Super Admin',     bg: 'bg-[#FF2F92] text-white', perm: 'Akses penuh ke semua fitur dan data sistem.' },
  pimpinan:        { label: 'Pimpinan',        bg: 'bg-[#171717] text-white', perm: 'Dapat melihat laporan dan dashboard executive.' },
  project_manager: { label: 'Project Manager', bg: 'bg-[#B8A0F0] text-[#171717]', perm: 'Mengelola proyek, tim, dan penugasan tugas.' },
  member:          { label: 'Member',          bg: 'bg-[#FFD83D] text-[#171717]', perm: 'Dapat melihat dan menyelesaikan tugas yang ditugaskan.' },
}

const MOCK_USERS = [
  { id: 1, name: 'Budi Santoso',         email: 'admin@pkm.co.id',    role: 'admin',           phone: '0812-3456-7890', is_active: true,  last_login: '28 Okt 2026, 08:15' },
  { id: 2, name: 'Budi Pimpinan',        email: 'pimpinan@pkm.co.id', role: 'pimpinan',        phone: '0812-3456-7891', is_active: true,  last_login: '27 Okt 2026, 14:30' },
  { id: 3, name: 'Siti Project Manager', email: 'pm@pkm.co.id',       role: 'project_manager', phone: '0812-3456-7892', is_active: true,  last_login: '28 Okt 2026, 09:00' },
  { id: 4, name: 'Andi Member',          email: 'member@pkm.co.id',   role: 'member',          phone: '0812-3456-7893', is_active: true,  last_login: '26 Okt 2026, 16:45' },
]

const ROLE_PERMS = [
  { role: 'Super Admin', color: '#FF2F92', bg: 'bg-[#FFF0F8]', border: 'border-[#FF2F92]/30', perms: ['Manajemen Pengguna & Role', 'Pengaturan Sistem', 'Semua Laporan & Analitik', 'CRUD Proyek & Tugas', 'AI Business Analyst'] },
  { role: 'Pimpinan', color: '#171717', bg: 'bg-[#F5F1E9]', border: 'border-[#171717]/20', perms: ['Dashboard Executive', 'Laporan & Analitik', 'Lihat Semua Proyek'] },
  { role: 'Project Manager', color: '#B8A0F0', bg: 'bg-[#F3F0FD]', border: 'border-[#B8A0F0]/40', perms: ['Manajemen Proyek', 'Manajemen Tugas', 'Sprint Tracker', 'Anggota Tim'] },
  { role: 'Member', color: '#FBBF24', bg: 'bg-[#FFFBEB]', border: 'border-[#FFD83D]/50', perms: ['Lihat Tugas Sendiri', 'Toggle Selesai Tugas'] },
]

export default function Users() {
  const { user: currentUser } = useAuth()

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <PageHeader
        title="MANAJEMEN PENGGUNA"
        subtitle="Kelola hak akses role, otorisasi, dan akun tim PKM Business Control Center."
        tag="ADMINISTRASI SISTEM"
        actions={
          <div className="bg-[#FF2F92] text-white px-3 py-1.5 border border-[#171717] rounded-lg flex items-center gap-1.5"
               style={{ boxShadow: '2px 2px 0px #171717' }}>
            <ShieldCheck size={14} />
            <span className="font-black text-xs uppercase">Admin Only</span>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total User', value: MOCK_USERS.length, bg: 'bg-white', icon: <UsersIcon size={16} /> },
          { label: 'Super Admin', value: MOCK_USERS.filter(u => u.role === 'admin').length, bg: 'bg-[#FF2F92] text-white', icon: <ShieldCheck size={16} /> },
          { label: 'Project Manager', value: MOCK_USERS.filter(u => u.role === 'project_manager').length, bg: 'bg-[#B8A0F0] text-[#171717]', icon: <UserCheck size={16} /> },
          { label: 'Member', value: MOCK_USERS.filter(u => u.role === 'member').length, bg: 'bg-[#FFD83D] text-[#171717]', icon: <Key size={16} /> },
        ].map((c, i) => (
          <div key={i} className={`p-3.5 border border-[#171717] rounded-lg ${c.bg}`}
               style={{ boxShadow: '2px 2px 0px #171717' }}>
            <div className="flex items-center justify-between mb-1.5 opacity-70">
              {c.icon}
              <span className="text-[9px] font-black uppercase tracking-wider">{c.label}</span>
            </div>
            <p className="font-display text-3xl leading-none">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Two Column: Table + Role Permissions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* User Table (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-[#171717] rounded-lg overflow-hidden"
             style={{ boxShadow: '3px 3px 0px #171717' }}>
          <div className="p-3.5 border-b border-[#171717]/15 bg-[#FAF7F2] flex items-center justify-between">
            <h3 className="font-display text-sm uppercase text-[#171717]">DAFTAR PENGGUNA SISTEM</h3>
            <span className="text-[10px] font-bold text-[#171717]/60">{MOCK_USERS.length} Pengguna Terverifikasi</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-100 text-[10px] font-black uppercase tracking-wider text-[#171717] border-b border-[#171717]/15">
                <tr>
                  <th className="py-2.5 px-4">Nama & Email</th>
                  <th className="py-2.5 px-4">Peran (Role)</th>
                  <th className="py-2.5 px-4 hidden sm:table-cell">Nomor HP</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 hidden md:table-cell">Login Terakhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#171717]/10 font-semibold text-[#171717]">
                {MOCK_USERS.map((u) => {
                  const roleConfig = ROLE_LABELS[u.role] || ROLE_LABELS.member
                  const isCurrentUser = u.email === currentUser?.email
                  return (
                    <tr key={u.id} className={`hover:bg-[#FAF7F2] transition-colors ${isCurrentUser ? 'bg-[#FFF0F8]' : ''}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${isCurrentUser ? 'bg-[#FF2F92] text-white' : 'bg-[#171717] text-white'}`}>
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-[#171717] leading-tight flex items-center gap-1">
                              {u.name}
                              {isCurrentUser && <span className="text-[8px] font-black px-1 py-px bg-[#FFD83D] border border-[#171717] rounded-sm">SAYA</span>}
                            </p>
                            <p className="text-[10.5px] text-[#171717]/60 mt-0.5">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 border border-[#171717] rounded-sm ${roleConfig.bg}`}>
                          {roleConfig.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-[#171717]/80 hidden sm:table-cell">{u.phone}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[#10B981]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
                          Aktif
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[10px] text-[#171717]/60 hidden md:table-cell">{u.last_login}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Role Permissions (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white border border-[#171717] rounded-lg overflow-hidden"
               style={{ boxShadow: '3px 3px 0px #171717' }}>
            <div className="px-4 py-3 bg-[#FAF7F2] border-b border-[#171717]/10 flex items-center gap-2">
              <Shield size={14} className="text-[#B8A0F0]" />
              <h3 className="font-display text-sm uppercase text-[#171717]">HAK AKSES PER ROLE</h3>
            </div>
            <div className="p-3 space-y-3">
              {ROLE_PERMS.map((rp, i) => (
                <div key={i} className={`p-3 ${rp.bg} border ${rp.border} rounded-lg`}>
                  <p className="font-black text-[10px] uppercase mb-1.5" style={{ color: rp.color }}>{rp.role}</p>
                  <ul className="space-y-0.5">
                    {rp.perms.map((perm, j) => (
                      <li key={j} className="text-[10px] font-semibold text-[#171717]/70 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full shrink-0" style={{ background: rp.color, opacity: 0.6 }}></span>
                        {perm}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Warning */}
          <div className="bg-[#FFD83D] p-3.5 border border-[#171717] rounded-lg"
               style={{ boxShadow: '2px 2px 0px #171717' }}>
            <p className="font-black text-[10px] uppercase text-[#171717] mb-1 flex items-center gap-1.5">
              <AlertCircle size={12} />
              Catatan Sistem
            </p>
            <p className="text-[10px] font-semibold text-[#171717]/75 leading-snug">
              Manajemen pengguna terintegrasi dengan Laravel Sanctum. Perubahan role memerlukan konfirmasi Super Admin.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
