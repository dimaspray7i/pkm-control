import { useState, useEffect } from 'react'
import api from '../services/api'
import { Check, Clock, AlertTriangle, Search, Loader2, RotateCcw, CheckSquare, Filter, Plus, Calendar } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const PRIORITY_CONFIG = {
  high:   { label: 'High',   bg: 'bg-[#FF2F92] text-white border-[#171717]' },
  medium: { label: 'Medium', bg: 'bg-[#FFD83D] text-[#171717] border-[#171717]' },
  low:    { label: 'Low',    bg: 'bg-[#B8A0F0] text-[#171717] border-[#171717]' },
}

export default function Tasks() {
  const [tasks, setTasks]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState('all') // all | high | medium | low | completed | overdue
  const [toggling, setToggling]   = useState(null)

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const res = await api.get('/tasks')
      setTasks(res.data.tasks || [])
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
      await api.post(`/tasks/${taskId}/toggle`)
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, is_completed: !t.is_completed, status: t.is_completed ? 'pending' : 'completed' } : t
      ))
    } catch {
      alert('Gagal memperbarui status tugas.')
    } finally {
      setToggling(null)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  const filtered = tasks.filter(t => {
    const matchSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.assignee_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.project?.name || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all'       ? true :
      filter === 'completed' ? t.is_completed :
      filter === 'overdue'   ? (!t.is_completed && t.deadline && t.deadline < today) :
      t.priority === filter && !t.is_completed
    return matchSearch && matchFilter
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
      <p className="font-display text-lg uppercase tracking-wider text-[#171717]">MEMUAT DAFTAR TUGAS...</p>
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
      {/* Header */}
      <PageHeader
        title="MANAJEMEN TUGAS"
        subtitle="Daftar tugas operasional, target penyelesaian, dan delegasi tim PKM."
        tag="TUGAS TIM"
        actions={
          <div className="bg-white px-3 py-1.5 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center gap-2">
            <CheckSquare size={15} className="text-[#FF2F92]" />
            <span className="font-black text-xs uppercase">{counts.completed} / {counts.all} Selesai</span>
          </div>
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
            placeholder="Cari tugas, PIC, atau nama proyek..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#FAF7F2] border border-[#171717]/40 rounded text-xs font-semibold text-[#171717] placeholder:text-[#171717]/40 focus:outline-none focus:border-[#FF2F92]"
          />
        </div>

        {/* Filter Badges */}
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
            onClick={() => { setSearch(''); setFilter('all') }}
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
                  task.is_completed ? 'opacity-60 bg-[#FAF7F2]' : 'hover:-translate-x-0.5 hover:shadow-[3px_3px_0px_#171717]'
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

                {/* Right: Deadline + Priority Badge */}
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
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
