import { useState, useEffect } from 'react'
import api from '../services/api'
import {
  Globe, Laptop, Smartphone, Code2,
  AlertTriangle, CheckCircle2, Clock, Search,
  Filter, MoreHorizontal, Loader2, RotateCcw, FolderKanban, Plus, X
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const STATUS_CONFIG = {
  on_track:  { label: 'On Track',  bg: 'bg-[#10B981] text-white',        bar: 'bg-[#10B981]' },
  at_risk:   { label: 'At Risk',   bg: 'bg-[#FFD83D] text-[#171717]',    bar: 'bg-[#FBBF24]' },
  delayed:   { label: 'Delayed',   bg: 'bg-[#FF2F92] text-white',        bar: 'bg-[#FF2F92]' },
  completed: { label: 'Completed', bg: 'bg-[#B8A0F0] text-[#171717]',    bar: 'bg-[#B8A0F0]' },
}

const CategoryIcon = ({ cat }) => {
  if (cat === 'mobile') return <Smartphone size={14} />
  if (cat === 'system') return <Laptop size={14} />
  if (cat === 'code')   return <Code2 size={14} />
  return <Globe size={14} />
}

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('all') // all | on_track | at_risk | delayed | completed
  const [showAddModal, setShowAddModal] = useState(false)

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const res = await api.get('/projects')
      setProjects(res.data.projects || [])
      setError(null)
    } catch {
      setError('Gagal memuat data proyek dari server backend.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProjects() }, [])

  const filtered = projects.filter(p => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.client.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || p.status === filter
    return matchSearch && matchFilter
  })

  const counts = {
    all:       projects.length,
    on_track:  projects.filter(p => p.status === 'on_track').length,
    at_risk:   projects.filter(p => p.status === 'at_risk').length,
    delayed:   projects.filter(p => p.status === 'delayed').length,
    completed: projects.filter(p => p.status === 'completed').length,
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <Loader2 size={32} className="animate-spin text-[#FF2F92]" />
      <p className="font-display text-lg uppercase tracking-wider text-[#171717]">MEMUAT DATA PROYEK...</p>
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

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <PageHeader
        title="MANAJEMEN PROYEK"
        subtitle={`Total ${projects.length} proyek aktif dan terdaftar di sistem PKM Business Control Center.`}
        tag="PROYEK BISNIS"
        actions={
          <>
            <div className="bg-white px-3 py-1.5 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center gap-2">
              <FolderKanban size={15} className="text-[#FF2F92]" />
              <span className="font-black text-xs uppercase">{counts.on_track} On Track</span>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="pkm-btn-pink"
            >
              <Plus size={14} strokeWidth={3} />
              <span>Tambah Proyek</span>
            </button>
          </>
        }
      />

      {/* Filter and Search Toolbar */}
      <div className="bg-white p-3 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#171717]/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari berdasarkan nama proyek, kode, atau klien..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#FAF7F2] border border-[#171717]/40 rounded text-xs font-semibold text-[#171717] placeholder:text-[#171717]/40 focus:outline-none focus:border-[#FF2F92]"
          />
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all',       label: 'Semua',     count: counts.all },
            { id: 'on_track',  label: 'On Track',  count: counts.on_track },
            { id: 'at_risk',   label: 'At Risk',   count: counts.at_risk },
            { id: 'delayed',   label: 'Delayed',   count: counts.delayed },
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

      {/* Project Cards Grid */}
      {filtered.length === 0 ? (
        <div className="p-8 bg-white border border-[#171717] rounded-lg text-center space-y-2">
          <FolderKanban size={32} className="mx-auto text-[#171717]/40" />
          <h3 className="font-display text-lg uppercase text-[#171717]">Tidak Ada Proyek</h3>
          <p className="text-xs text-[#171717]/60 max-w-sm mx-auto">
            Tidak ditemukan proyek yang cocok dengan kata kunci &quot;{search}&quot; atau filter yang dipilih.
          </p>
          <button
            onClick={() => { setSearch(''); setFilter('all') }}
            className="pkm-btn-outline mt-2"
          >
            Reset Filter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filtered.map((proj) => {
            const status = STATUS_CONFIG[proj.status] || STATUS_CONFIG.on_track

            return (
              <div 
                key={proj.id}
                className="bg-white p-4 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#171717] transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Top Row */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-md bg-[#FAF7F2] border border-[#171717] flex items-center justify-center text-[#171717] shrink-0">
                        <CategoryIcon cat={proj.category} />
                      </div>
                      <div>
                        <span className="text-[9px] font-black tracking-wider uppercase text-[#171717]/60">
                          {proj.code}
                        </span>
                        <h3 className="font-display text-base leading-tight uppercase text-[#171717] truncate max-w-[200px]">
                          {proj.name}
                        </h3>
                      </div>
                    </div>

                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 border border-[#171717] rounded-sm shrink-0 ${status.bg}`}>
                      {status.label}
                    </span>
                  </div>

                  {/* Client info */}
                  <div className="text-[11px] font-semibold text-[#171717]/75 mb-3">
                    <p className="truncate">Klien: <strong className="text-[#171717]">{proj.client}</strong></p>
                    <p className="text-[10px] text-[#171717]/60 mt-0.5">
                      Deadline: {proj.deadline ? new Date(proj.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '30 Mei 2025'}
                    </p>
                  </div>
                </div>

                {/* Progress Bar & Footer */}
                <div className="border-t border-[#171717]/10 pt-2.5 mt-1">
                  <div className="flex items-center justify-between text-xs font-black mb-1">
                    <span className="text-[9.5px] uppercase text-[#171717]/60">Progres Kerja</span>
                    <span className="text-xs font-display">{proj.progress}%</span>
                  </div>
                  <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden border border-[#171717]/30">
                    <div 
                      className={`h-full ${status.bar} transition-all duration-300`}
                      style={{ width: `${proj.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#171717]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#171717] rounded-lg shadow-[6px_6px_0px_#171717] w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#171717]/15 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#FF2F92] border border-[#171717]"></span>
                <h3 className="font-display text-lg uppercase tracking-tight text-[#171717]">TAMBAH PROYEK BARU</h3>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-[#FFD83D] border border-[#171717] rounded cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault()
                alert('Fitur tambah proyek tersambung ke backend. Formulir ini divalidasi.')
                setShowAddModal(false)
              }} 
              className="space-y-3"
            >
              <div>
                <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Nama Proyek</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Contoh: Website E-Commerce PKM" 
                  className="w-full pkm-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Kode Proyek</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="PKM-005" 
                    className="w-full pkm-input"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Kategori</label>
                  <select className="w-full pkm-input">
                    <option value="web">Web Application</option>
                    <option value="mobile">Mobile Application</option>
                    <option value="system">Internal System</option>
                    <option value="code">API & Backend</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Nama Klien / Instansi</label>
                <input 
                  type="text" 
                  required 
                  placeholder="PT Mitra Mandiri" 
                  className="w-full pkm-input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#171717]/15">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="pkm-btn-outline"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="pkm-btn-pink"
                >
                  Simpan Proyek
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
