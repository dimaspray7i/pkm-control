import { useState, useEffect } from 'react'
import api from '../services/api'
import { Users, Mail, Phone, CheckCircle2, Clock, AlertTriangle, Loader2, RotateCcw, Briefcase } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const ROLE_CONFIG = {
  admin:           { label: 'Super Admin',     bg: 'bg-[#FF2F92] text-white', color: 'bg-[#FF2F92] text-white' },
  pimpinan:        { label: 'Pimpinan',        bg: 'bg-[#171717] text-white', color: 'bg-[#171717] text-white' },
  project_manager: { label: 'Project Manager', bg: 'bg-[#B8A0F0] text-[#171717]', color: 'bg-[#B8A0F0] text-[#171717]' },
  member:          { label: 'Member',          bg: 'bg-[#FFD83D] text-[#171717]', color: 'bg-[#FFD83D] text-[#171717]' },
}

export default function Team() {
  const [team, setTeam]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetchTeam = async () => {
    try {
      setLoading(true)
      const res = await api.get('/team')
      setTeam(res.data.team || [])
      setError(null)
    } catch {
      setError('Gagal memuat daftar anggota tim dari backend.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTeam() }, [])

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <Loader2 size={32} className="animate-spin text-[#FF2F92]" />
      <p className="font-display text-lg uppercase tracking-wider text-[#171717]">MEMUAT DIREKTORI ANGGOTA TIM...</p>
    </div>
  )

  if (error) return (
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
        title="ANGGOTA TIM"
        subtitle="Daftar personil, distribusi tugas operasional, dan beban kerja tim PT Potensi Karya Mandiri."
        tag="SUMBER DAYA MANUSIA"
        actions={
          <div className="bg-white px-3 py-1.5 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center gap-2">
            <Users size={15} className="text-[#FF2F92]" />
            <span className="font-black text-xs uppercase">{team.length} Anggota Terdaftar</span>
          </div>
        }
      />

      {/* Grid of Team Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {team.map((m) => {
          const cfg = ROLE_CONFIG[m.role] || ROLE_CONFIG.member
          const stats = m.stats || { total_tasks: 0, completed_tasks: 0, pending_tasks: 0, overdue_tasks: 0, completion_rate: 100 }

          return (
            <div 
              key={m.id} 
              className="bg-white p-4 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#171717] transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header row: Avatar + Name + Role */}
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-full ${cfg.color} border border-[#171717] flex items-center justify-center font-display text-lg shrink-0 shadow-[1px_1px_0px_#171717]`}>
                    {m.name.charAt(0)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-base uppercase text-[#171717] truncate leading-tight">
                      {m.name}
                    </h3>
                    <span className={`inline-block px-2 py-0.5 border border-[#171717] rounded-sm text-[9px] font-black uppercase mt-1 ${cfg.bg}`}>
                      {cfg.label}
                    </span>
                  </div>
                </div>

                {/* Contact info */}
                <div className="mt-3.5 space-y-1 text-xs font-semibold text-[#171717]/80">
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail size={12} className="shrink-0 text-[#171717]/50" /> {m.email}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Phone size={12} className="shrink-0 text-[#171717]/50" /> {m.phone || '—'}
                  </p>
                </div>
              </div>

              {/* Workload / Task Distribution Box */}
              <div className="mt-4 pt-3 border-t border-[#171717]/15">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-[#171717]/70 mb-1.5">
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
                <div className="mt-2.5 flex items-center justify-between text-[9px] font-bold">
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
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
