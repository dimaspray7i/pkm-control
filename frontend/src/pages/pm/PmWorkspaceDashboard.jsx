import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../services/api'
import {
  Folder,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  Clock,
  Calendar,
  ArrowRight,
  Loader2,
  RotateCcw,
  Plus,
  Users,
  Flag,
  ChevronRight,
  AlertCircle,
  Eye,
  Layers,
  BarChart3
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'

const STATUS_CONFIG = {
  on_track:  { label: 'On Track',  bg: 'bg-[#10B981] text-white',        bar: 'bg-[#10B981]' },
  at_risk:   { label: 'At Risk',   bg: 'bg-[#FFD83D] text-[#171717]',    bar: 'bg-[#FBBF24]' },
  delayed:   { label: 'Delayed',   bg: 'bg-[#FF2F92] text-white',        bar: 'bg-[#FF2F92]' },
  completed: { label: 'Completed', bg: 'bg-[#B8A0F0] text-[#171717]',    bar: 'bg-[#B8A0F0]' },
}

export default function PmWorkspaceDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const abortControllerRef = useRef(null)

  const fetchPmWorkspaceData = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      setLoading(true)
      setError(null)
      const res = await api.get('/pm/workspace', { signal: controller.signal })
      if (!controller.signal.aborted) {
        setData(res.data)
        setError(null)
      }
    } catch (err) {
      if (controller.signal.aborted) return
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return
      console.error('Failed to fetch PM workspace data:', err)
      setError(err.response?.data?.message || 'Gagal memuat ruang kerja Project Manager.')
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    fetchPmWorkspaceData()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 size={32} className="animate-spin text-[#FF2F92]" />
        <p className="font-display text-lg uppercase tracking-wider text-[#171717]">
          MEMUAT WORKSPACE PROJECT MANAGER...
        </p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="p-6 bg-[#FFD83D] border-1.5 border-[#171717] rounded-lg shadow-[4px_4px_0px_#171717] max-w-xl mx-auto my-8">
        <h2 className="font-display text-xl uppercase mb-2">Gagal Memuat Workspace</h2>
        <p className="text-xs font-semibold mb-3">{error}</p>
        <button
          onClick={fetchPmWorkspaceData}
          className="px-3.5 py-1.5 bg-[#171717] text-white font-bold text-xs uppercase flex items-center gap-1.5 rounded cursor-pointer shadow-[2px_2px_0px_#171717]"
        >
          <RotateCcw size={13} /> Coba Lagi
        </button>
      </div>
    )
  }

  const kpi = data?.kpi || {
    total_projects: 0,
    active_projects: 0,
    completed_projects: 0,
    at_risk_projects: 0,
    total_tasks: 0,
    tasks_in_progress: 0,
    overdue_tasks: 0,
    unassigned_tasks: 0,
    pending_tasks: 0,
    avg_progress: 0,
  }

  const myProjects = data?.my_projects || []
  const attentionTasks = data?.attention_tasks || []
  const attentionProjects = data?.attention_projects || []
  const recentActivities = data?.recent_activities || []

  const displayName = user?.name || 'Project Manager'
  const currentDate = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const currentTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'

  return (
    <div className="space-y-5 pb-8">
      {/* ================= 1. HEADER ================= */}
      <PageHeader
        title={`WORKSPACE, ${displayName.toUpperCase()}`}
        subtitle="Kelola proyek Anda, pantau distribusi tugas tim, dan mitigasi kendala operasional secara langsung."
        tag="PROJECT MANAGER"
        actions={
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <div className="bg-white px-3.5 py-2 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center gap-2.5 min-h-[40px]">
              <Calendar size={16} strokeWidth={2.4} className="text-[#FF2F92]" />
              <div className="text-[10.5px] font-black text-[#171717] leading-tight">
                <p>{currentDate}</p>
                <p className="text-[9.5px] text-[#171717]/60 font-semibold">{currentTime}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/projects')}
              className="pkm-btn-pink min-h-[40px] flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#171717] text-xs"
            >
              <Folder size={14} />
              <span>Proyek Saya</span>
            </button>
          </div>
        }
      />

      {/* ================= 2. OPERATIONAL KPI SUMMARY ================= */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-black uppercase tracking-wider text-[#171717]/70">
            METRIK OPERASIONAL PROYEK SAYA
          </h2>
          <span className="text-[10px] font-bold text-[#171717]/60">
            Rata-rata Progres: <strong>{kpi.avg_progress}%</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-3.5">
          {/* KPI 1: Proyek Aktif */}
          <div
            onClick={() => navigate('/projects')}
            className="p-3.5 sm:p-4 bg-white border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col justify-between cursor-pointer hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#171717] transition-all"
            title="Buka daftar Proyek Saya"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#171717]/75">PROYEK AKTIF</span>
              <div className="w-6 h-6 rounded bg-[#FF2F92]/10 border border-[#FF2F92]/40 flex items-center justify-center">
                <Folder size={13} strokeWidth={2.5} className="text-[#FF2F92]" />
              </div>
            </div>
            <div className="my-1.5 flex items-baseline justify-between">
              <p className="font-display text-2xl sm:text-3xl text-[#171717] leading-none">
                {kpi.active_projects}
              </p>
              <span className="text-[10px] font-bold text-[#171717]/60">
                dari {kpi.total_projects} total
              </span>
            </div>
          </div>

          {/* KPI 2: Sedang Dikerjakan */}
          <div
            onClick={() => navigate('/tasks')}
            className="p-3.5 sm:p-4 bg-[#FAF7F2] border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col justify-between cursor-pointer hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#171717] transition-all"
            title="Buka Distribusi Tugas"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#171717]/75">SEDANG DIKERJAKAN</span>
              <div className="w-6 h-6 rounded bg-[#B8A0F0]/20 border border-[#B8A0F0] flex items-center justify-center">
                <Clock size={13} strokeWidth={2.5} className="text-[#171717]" />
              </div>
            </div>
            <div className="my-1.5 flex items-baseline justify-between">
              <p className="font-display text-2xl sm:text-3xl text-[#171717] leading-none">
                {kpi.tasks_in_progress}
              </p>
              <span className="text-[10px] font-bold text-[#171717]/60">
                dari {kpi.total_tasks} tugas
              </span>
            </div>
          </div>

          {/* KPI 3: Tugas Overdue (Warning Hot Pink) */}
          <div
            onClick={() => navigate('/tasks')}
            className={`p-3.5 sm:p-4 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col justify-between cursor-pointer hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#171717] transition-all ${
              kpi.overdue_tasks > 0 ? 'bg-[#FF2F92] text-white' : 'bg-white text-[#171717]'
            }`}
            title="Lihat tugas melewati batas waktu"
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase tracking-wider ${kpi.overdue_tasks > 0 ? 'text-white' : 'text-[#171717]/75'}`}>
                TUGAS TERLAMBAT
              </span>
              <div className={`w-6 h-6 rounded flex items-center justify-center ${kpi.overdue_tasks > 0 ? 'bg-white/20 border border-white/40' : 'bg-[#FF2F92]/10 border border-[#FF2F92]/40'}`}>
                <AlertTriangle size={13} strokeWidth={2.5} className={kpi.overdue_tasks > 0 ? 'text-white' : 'text-[#FF2F92]'} />
              </div>
            </div>
            <div className="my-1.5 flex items-baseline justify-between">
              <p className="font-display text-2xl sm:text-3xl leading-none">
                {kpi.overdue_tasks}
              </p>
              <span className={`text-[10px] font-bold ${kpi.overdue_tasks > 0 ? 'text-white/80' : 'text-[#FF2F92]'}`}>
                {kpi.overdue_tasks > 0 ? 'Perlu tindakan' : 'Aman'}
              </span>
            </div>
          </div>

          {/* KPI 4: Tugas Belum Ada Assignee (Warning Yellow) */}
          <div
            onClick={() => navigate('/tasks')}
            className={`p-3.5 sm:p-4 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col justify-between cursor-pointer hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#171717] transition-all ${
              kpi.unassigned_tasks > 0 ? 'bg-[#FFD83D] text-[#171717]' : 'bg-white text-[#171717]'
            }`}
            title="Tugas yang belum memiliki penanggung jawab"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#171717]/85">
                BELUM DITUGASKAN
              </span>
              <div className="w-6 h-6 rounded bg-[#171717]/10 border border-[#171717]/30 flex items-center justify-center">
                <Users size={13} strokeWidth={2.5} className="text-[#171717]" />
              </div>
            </div>
            <div className="my-1.5 flex items-baseline justify-between">
              <p className="font-display text-2xl sm:text-3xl leading-none text-[#171717]">
                {kpi.unassigned_tasks}
              </p>
              <span className="text-[10px] font-bold text-[#171717]/70">
                {kpi.unassigned_tasks > 0 ? 'Segera distribusikan' : 'Teralokasi'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= 3. ATTENTION PANEL & QUICK ACTIONS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Needs Attention Section */}
        <div className="lg:col-span-2 bg-white p-4 sm:p-5 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] space-y-4">
          <div className="flex items-center justify-between border-b border-[#171717]/15 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-[#FF2F92] text-white flex items-center justify-center">
                <AlertCircle size={14} strokeWidth={3} />
              </div>
              <h3 className="font-display text-base uppercase text-[#171717]">
                PERLU PERHATIAN PM
              </h3>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-[#FAF7F2] border border-[#171717] rounded">
              {attentionTasks.length} TUGAS KRITIS
            </span>
          </div>

          {attentionTasks.length === 0 && attentionProjects.length === 0 ? (
            <div className="p-6 bg-[#ECFDF5] border border-[#10B981] rounded-lg text-center space-y-2">
              <CheckCircle2 size={32} className="mx-auto text-[#10B981]" />
              <p className="font-display text-sm uppercase text-[#065F46]">
                Kondisi Aman — Tidak Ada Tugas Overdue atau Tanpa Assignee
              </p>
              <p className="text-xs text-[#065F46]/80 font-medium">
                Seluruh proyek dan tugas di bawah tanggung jawab Anda berjalan sesuai jadwal.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {attentionTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => navigate('/tasks')}
                  className="p-3 bg-[#FAF7F2] hover:bg-[#FFF0F8] border border-[#171717]/30 hover:border-[#FF2F92] rounded-lg flex items-center justify-between gap-3 cursor-pointer transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-white border border-[#171717] rounded">
                        {task.project_code || 'PROYEK'}
                      </span>
                      {task.is_overdue && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-[#FF2F92] text-white rounded">
                          TERLEWAT DEADLINE
                        </span>
                      )}
                      {task.is_unassigned && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-[#FFD83D] text-[#171717] rounded">
                          BELUM ADA ANGGOTA
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-[#171717] truncate">{task.title}</p>
                    <p className="text-[10px] text-[#171717]/65 mt-0.5">
                      Assignee: <strong>{task.assignee_name || '—'}</strong> • Deadline:{' '}
                      {task.deadline ? new Date(task.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'Tidak ada'}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-[#171717]/40 shrink-0" />
                </div>
              ))}
            </div>
          )}

          {attentionProjects.length > 0 && (
            <div className="pt-2 border-t border-[#171717]/10">
              <p className="text-[10px] font-black uppercase text-[#171717]/60 mb-2">
                PROYEK BERSTATUS AT RISK / DELAYED
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {attentionProjects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="p-2.5 bg-white border border-[#171717] rounded-md flex items-center justify-between cursor-pointer hover:bg-[#FFD83D]/20 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-[#171717] truncate">{p.name}</p>
                      <p className="text-[9.5px] text-[#171717]/60">{p.code} • Progres: {p.progress}%</p>
                    </div>
                    <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded border border-[#171717] shrink-0 ${STATUS_CONFIG[p.status]?.bg || 'bg-neutral-200'}`}>
                      {STATUS_CONFIG[p.status]?.label || p.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Quick Actions & Operational Hub */}
        <div className="bg-[#FAF7F2] p-4 sm:p-5 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#171717]/15">
              <Layers size={16} className="text-[#FF2F92]" />
              <h3 className="font-display text-sm uppercase text-[#171717]">
                PINTASAN OPERASIONAL
              </h3>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/projects')}
                className="w-full p-2.5 bg-white hover:bg-[#FFD83D] border border-[#171717] rounded-md text-left flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Folder size={14} className="text-[#FF2F92]" />
                  <span className="text-xs font-bold text-[#171717]">Kelola Proyek Saya</span>
                </div>
                <ArrowRight size={13} className="text-[#171717]/50 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={() => navigate('/tasks')}
                className="w-full p-2.5 bg-white hover:bg-[#FFD83D] border border-[#171717] rounded-md text-left flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <ClipboardList size={14} className="text-[#10B981]" />
                  <span className="text-xs font-bold text-[#171717]">Distribusi Tugas Anggota</span>
                </div>
                <ArrowRight size={13} className="text-[#171717]/50 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={() => navigate('/development')}
                className="w-full p-2.5 bg-white hover:bg-[#FFD83D] border border-[#171717] rounded-md text-left flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Flag size={14} className="text-[#B8A0F0]" />
                  <span className="text-xs font-bold text-[#171717]">Sprint & Milestones</span>
                </div>
                <ArrowRight size={13} className="text-[#171717]/50 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={() => navigate('/team')}
                className="w-full p-2.5 bg-white hover:bg-[#FFD83D] border border-[#171717] rounded-md text-left flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-[#171717]" />
                  <span className="text-xs font-bold text-[#171717]">Beban Kerja Tim</span>
                </div>
                <ArrowRight size={13} className="text-[#171717]/50 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={() => navigate('/reports')}
                className="w-full p-2.5 bg-white hover:bg-[#FFD83D] border border-[#171717] rounded-md text-left flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <BarChart3 size={14} className="text-[#FF2F92]" />
                  <span className="text-xs font-bold text-[#171717]">Laporan Proyek</span>
                </div>
                <ArrowRight size={13} className="text-[#171717]/50 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Quick Info Box */}
          <div className="p-3 bg-white border border-[#171717] rounded-md text-[11px] space-y-1">
            <p className="font-black uppercase text-[#171717]">Tanggung Jawab PIC</p>
            <p className="text-[#171717]/75 leading-relaxed">
              Sebagai PM, Anda berwenang mengatur tugas, menetapkan prioritas, dan memantau penyelesaian milestone untuk seluruh proyek milik Anda.
            </p>
          </div>
        </div>
      </div>

      {/* ================= 4. MY ACTIVE PROJECTS GRID ================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base uppercase text-[#171717]">
              PROYEK AKTIF SAYA ({myProjects.length})
            </h2>
          </div>
          <button
            onClick={() => navigate('/projects')}
            className="text-xs font-black uppercase text-[#FF2F92] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Buka Semua Proyek</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {myProjects.length === 0 ? (
          <div className="p-8 bg-white border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] text-center space-y-3">
            <Folder size={36} className="mx-auto text-[#171717]/40" />
            <h3 className="font-display text-lg uppercase text-[#171717]">
              Belum Ada Proyek Ditugaskan
            </h3>
            <p className="text-xs text-[#171717]/65 max-w-md mx-auto">
              Anda belum memiliki proyek yang menjadi tanggung jawab Anda saat ini. Hubungi Admin atau buat proyek baru melalui halaman Proyek.
            </p>
            <button
              onClick={() => navigate('/projects')}
              className="pkm-btn-pink inline-flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <Plus size={14} />
              <span>Tambah Proyek Baru</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {myProjects.map((proj) => {
              const status = STATUS_CONFIG[proj.status] || STATUS_CONFIG.on_track

              return (
                <div
                  key={proj.id}
                  className="bg-white p-4 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_#171717] transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <span className="text-[9.5px] font-black uppercase tracking-wider text-[#171717]/60 block">
                          {proj.code}
                        </span>
                        <h4
                          onClick={() => navigate(`/projects/${proj.id}`)}
                          className="font-display text-base uppercase text-[#171717] truncate hover:text-[#FF2F92] cursor-pointer transition-colors"
                          title={proj.name}
                        >
                          {proj.name}
                        </h4>
                      </div>
                      <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 border border-[#171717] rounded shadow-[1px_1px_0px_#171717] shrink-0 ${status.bg}`}>
                        {status.label}
                      </span>
                    </div>

                    {/* Metadata */}
                    <div className="p-2.5 bg-[#FAF7F2] rounded-md border border-[#171717]/15 text-xs font-semibold space-y-1 mb-3">
                      <p className="flex items-center justify-between">
                        <span className="text-[10px] text-[#171717]/60 uppercase">Klien:</span>
                        <strong className="text-[#171717] truncate max-w-[170px]">{proj.client}</strong>
                      </p>
                      <p className="flex items-center justify-between">
                        <span className="text-[10px] text-[#171717]/60 uppercase">Deadline:</span>
                        <span className="text-[#171717] font-bold">
                          {proj.deadline ? new Date(proj.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </span>
                      </p>
                      <p className="flex items-center justify-between">
                        <span className="text-[10px] text-[#171717]/60 uppercase">Tugas:</span>
                        <span className="text-[#171717]">
                          <strong>{proj.tasks_done}</strong> / {proj.tasks_total} selesai
                          {proj.overdue > 0 && (
                            <span className="text-[#FF2F92] font-black ml-1">({proj.overdue} overdue)</span>
                          )}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Progress & Link */}
                  <div className="border-t border-[#171717]/15 pt-2.5 space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between text-xs font-black mb-1">
                        <span className="text-[10px] uppercase text-[#171717]/60">Progres</span>
                        <span className="font-display text-[#171717]">{proj.progress}%</span>
                      </div>
                      <div className="w-full bg-[#EAE4D8] h-2 rounded-full overflow-hidden border border-[#171717]/30">
                        <div
                          className={`h-full ${status.bar} transition-all duration-300`}
                          style={{ width: `${proj.progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => navigate(`/projects/${proj.id}`)}
                        className="px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#FFD83D] text-[#171717] border border-[#171717] rounded text-[11px] font-black uppercase flex items-center gap-1.5 cursor-pointer shadow-[1px_1px_0px_#171717]"
                      >
                        <Eye size={12} />
                        <span>Detail Proyek</span>
                      </button>
                      <button
                        onClick={() => navigate('/tasks')}
                        className="px-2.5 py-1.5 bg-white hover:bg-[#171717] hover:text-white text-[#171717] border border-[#171717] rounded text-[10.5px] font-black uppercase cursor-pointer"
                      >
                        Tugas Tim →
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ================= 5. RECENT ACTIVITIES FEED ================= */}
      {recentActivities.length > 0 && (
        <div className="bg-white p-4 sm:p-5 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
          <h3 className="font-display text-sm uppercase text-[#171717] mb-3 pb-2 border-b border-[#171717]/15">
            AKTIVITAS OPERASIONAL TERAKHIR
          </h3>
          <div className="space-y-2">
            {recentActivities.map((act) => (
              <div
                key={act.id}
                className="flex items-center justify-between gap-3 text-xs p-2 bg-[#FAF7F2] rounded border border-[#171717]/10"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-6 h-6 rounded-full border border-[#171717] flex items-center justify-center font-black text-[10px] text-white shrink-0"
                    style={{ backgroundColor: act.avatar_color }}
                  >
                    {act.user_name ? act.user_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <p className="truncate text-[#171717]">
                    <strong>{act.user_name}</strong>{' '}
                    <span className="text-[#171717]/70">{act.action}</span>{' '}
                    <strong>{act.target_name}</strong>
                    {act.project_name && (
                      <span className="text-[#171717]/60 text-[11px]"> ({act.project_name})</span>
                    )}
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-[#171717]/50 shrink-0">
                  {act.time_ago}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
