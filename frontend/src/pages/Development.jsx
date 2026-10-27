import { useState, useEffect } from 'react'
import api from '../services/api'
import { Globe, Laptop, Smartphone, Clock, TrendingUp, Loader2, RotateCcw, Terminal, CheckCircle2, Circle, AlertCircle, Calendar, Users, BarChart3 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

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

// Phase definitions for each project
const getPhases = (progress) => {
  const p = progress || 0
  return [
    {
      num: 1, name: 'Desain & Prototype', desc: 'Wireframe, UI mockup, arsitektur sistem',
      status: p >= 30 ? 'selesai' : p > 0 ? 'in_progress' : 'pending',
      pct: Math.min(100, Math.round(p * 1.5)),
    },
    {
      num: 2, name: 'Core Development', desc: 'Implementasi fitur utama & integrasi API',
      status: p >= 65 ? 'selesai' : p >= 25 ? 'in_progress' : 'pending',
      pct: p >= 65 ? 100 : p >= 25 ? Math.round((p - 25) * 2) : 0,
    },
    {
      num: 3, name: 'QA & Testing', desc: 'Unit test, integration test, UAT',
      status: p >= 85 ? 'selesai' : p >= 60 ? 'in_progress' : 'pending',
      pct: p >= 85 ? 100 : p >= 60 ? Math.round((p - 60) * 4) : 0,
    },
    {
      num: 4, name: 'Deployment', desc: 'Staging → Production, monitoring',
      status: p >= 98 ? 'selesai' : p >= 85 ? 'in_progress' : 'pending',
      pct: p >= 98 ? 100 : p >= 85 ? Math.round((p - 85) * 7) : 0,
    },
  ]
}

const PhaseStatusIcon = ({ status }) => {
  if (status === 'selesai')    return <CheckCircle2 size={14} className="text-[#10B981]" />
  if (status === 'in_progress') return <AlertCircle size={14} className="text-[#FFD83D]" />
  return <Circle size={14} className="text-[#171717]/30" />
}

export default function Development() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [activeId, setActiveId] = useState(null)

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const res = await api.get('/projects')
      const all = res.data.projects || []
      setProjects(all)
      if (all.length > 0) setActiveId(all[0].id)
      setError(null)
    } catch {
      setError('Gagal memuat data dari server backend.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProjects() }, [])

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
      <button onClick={fetchProjects} className="px-3.5 py-1.5 bg-[#171717] text-white font-bold text-xs uppercase flex items-center gap-1.5 rounded cursor-pointer">
        <RotateCcw size={13} /> Coba Lagi
      </button>
    </div>
  )

  const activeProjects = projects.filter(p => p.status !== 'completed')
  const selected = projects.find(p => p.id === activeId) || projects[0]
  const status = selected ? (STATUS_CONFIG[selected.status] || STATUS_CONFIG.on_track) : STATUS_CONFIG.on_track
  const phases = selected ? getPhases(selected.progress) : []

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
      {/* Header */}
      <PageHeader
        title="SPRINT TRACKER"
        subtitle="Pelacakan progres teknis, sprint pengembangan, dan milestone per proyek."
        tag="PENGEMBANGAN SISTEM"
        actions={
          <div className="bg-white px-3 py-1.5 border border-[#171717] rounded-lg flex items-center gap-2"
               style={{ boxShadow: '2px 2px 0px #171717' }}>
            <Terminal size={15} className="text-[#FF2F92]" />
            <span className="font-black text-xs uppercase">{activeProjects.length} Proyek Aktif</span>
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
          <div key={i} className={`p-3.5 border border-[#171717] rounded-lg ${s.bg}`}
               style={{ boxShadow: '2px 2px 0px #171717' }}>
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
              onClick={() => setActiveId(p.id)}
              className={`px-3 py-1.5 rounded-md border text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0 ${
                isActive
                  ? 'bg-[#171717] text-white border-[#171717]'
                  : 'bg-white text-[#171717] border-[#171717]/30 hover:border-[#171717]'
              }`}
              style={isActive ? { boxShadow: '2px 2px 0px #FF2F92' } : {}}
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
            <div className="bg-white p-5 border border-[#171717] rounded-lg space-y-4"
                 style={{ boxShadow: '3px 3px 0px #171717' }}>
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
                  <span className="text-[10px] uppercase text-[#171717]/60">Total Progres Pengembangan</span>
                  <span className="font-display text-xl" style={{ color: status.accent }}>{selected.progress}%</span>
                </div>
                <div className="w-full bg-neutral-100 h-4 rounded-full overflow-hidden border border-[#171717]/20">
                  <div
                    className={`h-full ${status.bar} transition-all duration-700`}
                    style={{ width: `${selected.progress}%` }}
                  />
                </div>
              </div>

              {/* Development Phases */}
              <div>
                <h3 className="font-display text-sm uppercase text-[#171717] mb-3 flex items-center gap-2">
                  <BarChart3 size={15} className="text-[#FF2F92]" />
                  TAHAPAN SPRINT & DEPLOYMENT
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {phases.map((ph) => (
                    <div key={ph.num} className={`p-3 border rounded-lg transition-all ${
                      ph.status === 'selesai' ? 'bg-[#ECFDF5] border-[#10B981]/40' :
                      ph.status === 'in_progress' ? 'bg-[#FFFBEB] border-[#FFD83D]/60' :
                      'bg-[#FAF7F2] border-[#171717]/15'
                    }`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[9px] font-black uppercase text-[#171717]/60">Phase {ph.num}</p>
                        <PhaseStatusIcon status={ph.status} />
                      </div>
                      <p className="font-bold text-xs text-[#171717] leading-tight">{ph.name}</p>
                      <p className="text-[9px] text-[#171717]/50 mt-0.5 leading-snug">{ph.desc}</p>
                      {ph.status !== 'pending' && (
                        <div className="mt-2">
                          <div className="flex justify-between text-[9px] font-black mb-0.5">
                            <span>{ph.status === 'selesai' ? 'Selesai' : 'Progres'}</span>
                            <span>{ph.pct}%</span>
                          </div>
                          <div className="w-full bg-neutral-200 h-1 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                ph.status === 'selesai' ? 'bg-[#10B981]' : 'bg-[#FFD83D]'
                              }`}
                              style={{ width: `${ph.pct}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {ph.status === 'pending' && (
                        <span className="inline-block mt-2 px-1.5 py-0.5 bg-neutral-200 text-[#171717]/50 text-[8px] font-black uppercase rounded-sm">Pending</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* All Projects Mini Overview */}
            <div className="bg-white border border-[#171717] rounded-lg overflow-hidden"
                 style={{ boxShadow: '3px 3px 0px #171717' }}>
              <div className="px-4 py-3 bg-[#FAF7F2] border-b border-[#171717]/10">
                <h3 className="font-display text-sm uppercase text-[#171717]">RINGKASAN SEMUA PROYEK</h3>
              </div>
              <div className="divide-y divide-[#171717]/8">
                {projects.slice(0, 6).map((p) => {
                  const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.on_track
                  return (
                    <div key={p.id}
                         className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-[#FAF7F2] transition-colors ${p.id === selected?.id ? 'bg-[#FFF0F8]' : ''}`}
                         onClick={() => setActiveId(p.id)}>
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
            <div className="bg-white p-4 border border-[#171717] rounded-lg space-y-3"
                 style={{ boxShadow: '3px 3px 0px #171717' }}>
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
                  { label: 'Target Selesai', value: selected.deadline
                    ? new Date(selected.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                    : '—' },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between py-1.5 border-b border-[#171717]/8 last:border-0">
                    <span className="text-[#171717]/55">{item.label}:</span>
                    <span className="font-bold text-right max-w-[55%] text-[11px]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Phase Card */}
            <div className="bg-[#FFD83D] p-4 border border-[#171717] rounded-lg"
                 style={{ boxShadow: '3px 3px 0px #171717' }}>
              <h3 className="font-display text-sm uppercase text-[#171717] mb-2 flex items-center gap-1.5">
                <TrendingUp size={14} />
                FASE AKTIF
              </h3>
              {(() => {
                const activePhase = phases.find(ph => ph.status === 'in_progress') || phases[phases.filter(ph => ph.status === 'selesai').length]
                if (!activePhase) return <p className="text-xs font-bold text-[#171717]/70">Semua fase selesai.</p>
                return (
                  <>
                    <p className="font-black text-sm text-[#171717]">Phase {activePhase.num}: {activePhase.name}</p>
                    <p className="text-[10px] text-[#171717]/60 mt-0.5">{activePhase.desc}</p>
                    <div className="mt-3 w-full bg-[#171717]/15 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-[#171717] rounded-full transition-all" style={{ width: `${activePhase.pct}%` }} />
                    </div>
                    <p className="text-[10px] font-black mt-1 text-right">{activePhase.pct}% selesai</p>
                  </>
                )
              })()}
            </div>

            {/* Status Breakdown */}
            <div className="bg-white p-4 border border-[#171717] rounded-lg"
                 style={{ boxShadow: '3px 3px 0px #171717' }}>
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
        <div className="p-8 bg-white border border-[#171717] rounded-lg text-center"
             style={{ boxShadow: '3px 3px 0px #171717' }}>
          <p className="text-xs font-bold text-[#171717]/60">Belum ada data proyek. Tambahkan proyek terlebih dahulu.</p>
        </div>
      )}
    </div>
  )
}
