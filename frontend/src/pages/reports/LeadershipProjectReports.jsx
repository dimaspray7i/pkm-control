import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import {
  FileBarChart,
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  RotateCcw,
  Loader2,
  Eye,
  Printer,
  X,
  TrendingUp,
  AlertCircle,
  Briefcase,
  Lock,
  ChevronRight
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'

const formatDateIndo = (d) => {
  if (!d) return '—'
  const s = d.includes('T') ? d.split('T')[0] : d
  const [y, m, day] = s.split('-')
  return new Date(+y, +m - 1, +day).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const formatPeriodRange = (start, end) => {
  if (!start || !end) return '—'
  return `${formatDateIndo(start)} – ${formatDateIndo(end)}`
}

export default function LeadershipProjectReports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 })

  // Filters
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [projects, setProjects] = useState([])

  // Modal detail
  const [selectedReport, setSelectedReport] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Fetch Projects for filter
  useEffect(() => {
    api.get('/projects')
      .then(res => setProjects(res.data.projects || res.data || []))
      .catch(() => {})
  }, [])

  // Fetch Published Reports
  const fetchReports = useCallback(async (page = 1) => {
    setLoading(true)
    setError(null)
    try {
      const params = { page, per_page: 12, status: 'published' }
      if (search) params.search = search
      if (projectFilter !== 'all') params.project_id = projectFilter
      if (startDateFilter) params.period_start = startDateFilter
      if (endDateFilter) params.period_end = endDateFilter

      const res = await api.get('/project-reports', { params })
      setReports(res.data.data || [])
      setPagination({
        current_page: res.data.current_page || 1,
        last_page: res.data.last_page || 1,
        total: res.data.total || 0,
      })
    } catch (e) {
      setError('Gagal memuat laporan proyek pimpinan.')
    } finally {
      setLoading(false)
    }
  }, [search, projectFilter, startDateFilter, endDateFilter])

  useEffect(() => {
    fetchReports(1)
  }, [fetchReports])

  const handleOpenDetail = async (id) => {
    setDetailLoading(true)
    try {
      const res = await api.get(`/project-reports/${id}`)
      setSelectedReport(res.data.report)
    } catch (e) {
      alert('Gagal memuat isi laporan.')
    } finally {
      setDetailLoading(false)
    }
  }

  const resetFilters = () => {
    setSearch('')
    setProjectFilter('all')
    setStartDateFilter('')
    setEndDateFilter('')
  }

  // Strategic stats from loaded reports
  const totalReports = pagination.total
  const totalOverdueTasks = reports.reduce((acc, r) => acc + (r.snapshot_data?.project?.overdue_tasks || 0), 0)
  const reportsWithChallenges = reports.filter(r => Boolean(r.challenges || r.risks)).length

  return (
    <div className="space-y-6">
      {/* Strategic KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border-1.5 border-[#171717] shadow-[3px_3px_0px_#171717] rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-[#10B981] text-white flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="text-2xl font-black text-[#171717]">{totalReports}</div>
            <div className="text-[11px] font-black uppercase text-[#171717]/60">Laporan Diterbitkan</div>
          </div>
        </div>

        <div className="bg-white border-1.5 border-[#171717] shadow-[3px_3px_0px_#171717] rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-[#FF2F92] text-white flex items-center justify-center shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="text-2xl font-black text-[#171717]">{totalOverdueTasks}</div>
            <div className="text-[11px] font-black uppercase text-[#171717]/60">Tugas Overdue Terdeteksi</div>
          </div>
        </div>

        <div className="bg-white border-1.5 border-[#171717] shadow-[3px_3px_0px_#171717] rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-[#FFD83D] text-[#171717] flex items-center justify-center shrink-0">
            <AlertCircle size={20} />
          </div>
          <div>
            <div className="text-2xl font-black text-[#171717]">{reportsWithChallenges}</div>
            <div className="text-[11px] font-black uppercase text-[#171717]/60">Laporan Dengan Kendala/Risiko</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border-1.5 border-[#171717] shadow-[3px_3px_0px_#171717] rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#171717]/50" />
            <input
              type="text"
              placeholder="Cari laporan / proyek / rangkuman..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border-1.5 border-[#171717] rounded-md text-xs bg-[#F5F1E9] text-[#171717] placeholder:text-[#171717]/40 focus:outline-none"
            />
          </div>

          {/* Project filter */}
          <select
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            className="border-1.5 border-[#171717] rounded-md text-xs py-1.5 px-3 bg-[#F5F1E9] text-[#171717] focus:outline-none cursor-pointer"
          >
            <option value="all">Semua Proyek</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>
            ))}
          </select>

          {/* Date Range */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={startDateFilter}
              onChange={e => setStartDateFilter(e.target.value)}
              className="border-1.5 border-[#171717] rounded-md text-xs py-1 px-2 bg-[#F5F1E9] text-[#171717] focus:outline-none"
              title="Dari Tanggal"
            />
            <span className="text-xs font-black text-[#171717]">–</span>
            <input
              type="date"
              value={endDateFilter}
              onChange={e => setEndDateFilter(e.target.value)}
              className="border-1.5 border-[#171717] rounded-md text-xs py-1 px-2 bg-[#F5F1E9] text-[#171717] focus:outline-none"
              title="Sampai Tanggal"
            />
          </div>

          {/* Reset */}
          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 border-1.5 border-[#171717] rounded-md text-xs font-black uppercase hover:bg-[#FFD83D] transition-colors cursor-pointer"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border-1.5 border-[#171717]/20 rounded-lg h-52 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white border-1.5 border-[#FF2F92] rounded-lg p-6 text-center">
          <AlertTriangle size={28} className="text-[#FF2F92] mx-auto mb-2" />
          <p className="font-black text-[#171717]">{error}</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white border-1.5 border-[#171717] shadow-[3px_3px_0px_#171717] rounded-lg p-12 text-center space-y-2">
          <FileBarChart size={40} className="text-[#171717]/30 mx-auto" />
          <h4 className="font-black text-sm uppercase text-[#171717]">Belum Ada Laporan Diterbitkan</h4>
          <p className="text-xs text-[#171717]/60">
            Laporan mingguan yang telah disahkan dan diterbitkan oleh Project Manager akan muncul di sini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map(report => {
            const snap = report.snapshot_data || {}
            const proj = snap.project || report.project || {}
            const hasOverdue = (proj.overdue_tasks || 0) > 0
            const hasIssues = Boolean(report.challenges || report.risks)

            return (
              <div
                key={report.id}
                className="bg-white border-1.5 border-[#171717] shadow-[3px_3px_0px_#171717] rounded-lg overflow-hidden flex flex-col hover:shadow-[5px_5px_0px_#171717] transition-all"
              >
                <div className="px-4 py-2.5 bg-[#171717] text-white flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-black text-[#FFD83D]">
                    {report.report_number || `RPT-#${report.id}`}
                  </span>
                  <span className="text-[10px] text-white/70">
                    PM: <span className="font-bold text-white">{report.creator?.name || '—'}</span>
                  </span>
                </div>

                <div className="p-4 flex-1 space-y-3">
                  <div>
                    <div className="text-[11px] font-bold text-[#171717]/50 uppercase">
                      {proj.code ? `[${proj.code}] ` : ''}{proj.name}
                    </div>
                    <div className="font-black text-sm text-[#171717]">
                      Periode: {formatPeriodRange(report.period_start, report.period_end)}
                    </div>
                  </div>

                  <div className="bg-[#FAF7F2] p-2.5 rounded border border-[#171717]/15 space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[#171717]/60">Progres Aktual:</span>
                      <span className="font-black text-[#10B981]">{proj.progress ?? 0}%</span>
                    </div>
                    <div className="w-full bg-[#171717]/10 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#10B981] rounded-full"
                        style={{ width: `${Math.min(100, proj.progress ?? 0)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#171717]/50 pt-0.5">
                      <span>✓ {proj.completed_tasks ?? 0}/{proj.total_tasks ?? 0} Selesai</span>
                      {hasOverdue && <span className="text-[#FF2F92] font-black">⚠ {proj.overdue_tasks} Overdue</span>}
                    </div>
                  </div>

                  {report.executive_summary && (
                    <p className="text-xs text-[#171717]/80 line-clamp-2 italic">
                      "{report.executive_summary}"
                    </p>
                  )}

                  {hasIssues && (
                    <div className="text-[10px] text-[#9A3412] bg-[#FFFBEB] p-1.5 rounded border border-[#FFD83D] flex items-center gap-1 font-bold">
                      <AlertTriangle size={12} className="shrink-0" />
                      Ada catatan kendala / risiko yang dilaporkan
                    </div>
                  )}
                </div>

                <div className="px-4 py-2.5 bg-[#F5F1E9] border-t-1.5 border-[#171717] flex items-center justify-between">
                  <span className="text-[10px] text-[#171717]/50">
                    Diterbitkan: {formatDateIndo(report.published_at)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenDetail(report.id)}
                    className="px-3 py-1 bg-[#171717] text-white rounded text-xs font-black uppercase hover:bg-neutral-800 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Eye size={12} />
                    Baca Laporan
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Read-Only Leadership Detail Modal */}
      {(selectedReport || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#171717]/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border-2 border-[#171717] shadow-[8px_8px_0px_#171717] rounded-lg w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
            {detailLoading ? (
              <div className="p-12 text-center">
                <Loader2 size={32} className="animate-spin text-[#171717] mx-auto mb-2" />
                <p className="text-xs font-black uppercase text-[#171717]">Memuat Laporan...</p>
              </div>
            ) : selectedReport ? (
              <>
                <div className="print:hidden px-5 py-3 bg-[#171717] text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black bg-[#FFD83D] text-[#171717] px-2 py-0.5 rounded">
                      {selectedReport.report_number || `RPT-#${selectedReport.id}`}
                    </span>
                    <span className="text-xs text-white/70">
                      Disusun oleh: <span className="font-bold text-white">{selectedReport.creator?.name || '—'}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-3 py-1 bg-white text-[#171717] rounded text-xs font-black uppercase hover:bg-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer size={13} />
                      Cetak Laporan
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedReport(null)}
                      className="p-1 hover:bg-white/10 rounded cursor-pointer transition-colors ml-2"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-[#171717] bg-white">
                  {/* Header */}
                  <div className="border-b-2 border-[#171717] pb-4 flex justify-between items-start">
                    <div>
                      <div className="text-[10px] font-black tracking-widest text-[#171717]/60 uppercase">
                        PT POTENSI KARYA MANDIRI — EXECUTIVE MONITORING
                      </div>
                      <h2 className="text-xl font-black uppercase text-[#171717] mt-0.5">
                        LAPORAN PERKEMBANGAN PROYEK MINGGUAN
                      </h2>
                      <div className="text-xs font-bold text-[#171717]/70 mt-1">
                        {selectedReport.project?.name} ({selectedReport.project?.code || '—'})
                      </div>
                    </div>
                    <div className="text-right text-xs font-mono space-y-0.5">
                      <div className="font-black">{selectedReport.report_number}</div>
                      <div>Periode: {formatPeriodRange(selectedReport.period_start, selectedReport.period_end)}</div>
                      <div>Diterbitkan: {formatDateIndo(selectedReport.published_at)}</div>
                    </div>
                  </div>

                  {/* Executive summary */}
                  <div className="bg-[#FAF7F2] border-1.5 border-[#171717] rounded p-4 space-y-1">
                    <div className="text-[11px] font-black uppercase text-[#171717]/60">EXECUTIVE SUMMARY</div>
                    <p className="text-xs leading-relaxed text-[#171717] font-medium">
                      {selectedReport.executive_summary}
                    </p>
                  </div>

                  {/* KPI quick view */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="border-1.5 border-[#171717] rounded p-3">
                      <div className="text-2xl font-black text-[#10B981]">{selectedReport.snapshot_data?.project?.progress ?? 0}%</div>
                      <div className="text-[10px] font-black uppercase text-[#171717]/50">Progres Aktual</div>
                    </div>
                    <div className="border-1.5 border-[#171717] rounded p-3">
                      <div className="text-2xl font-black text-[#171717]">
                        {selectedReport.snapshot_data?.project?.completed_tasks ?? 0}/{selectedReport.snapshot_data?.project?.total_tasks ?? 0}
                      </div>
                      <div className="text-[10px] font-black uppercase text-[#171717]/50">Tugas Selesai</div>
                    </div>
                    <div className="border-1.5 border-[#171717] rounded p-3">
                      <div className="text-2xl font-black text-[#FF2F92]">{selectedReport.snapshot_data?.project?.overdue_tasks ?? 0}</div>
                      <div className="text-[10px] font-black uppercase text-[#171717]/50">Tugas Terlambat</div>
                    </div>
                    <div className="border-1.5 border-[#171717] rounded p-3">
                      <div className="text-2xl font-black text-[#B8A0F0]">{selectedReport.snapshot_data?.project?.in_review_tasks ?? 0}</div>
                      <div className="text-[10px] font-black uppercase text-[#171717]/50">In Review</div>
                    </div>
                  </div>

                  {/* Narratives */}
                  <div className="space-y-3 pt-2 text-xs">
                    {selectedReport.completed_work && (
                      <div>
                        <div className="font-black uppercase text-[#171717] mb-1">Pekerjaan Selesai</div>
                        <div className="p-3 bg-[#FAF7F2] rounded border border-[#171717]/20 whitespace-pre-wrap">
                          {selectedReport.completed_work}
                        </div>
                      </div>
                    )}

                    {selectedReport.challenges && (
                      <div>
                        <div className="font-black uppercase text-[#9A3412] mb-1 flex items-center gap-1">
                          <AlertTriangle size={12} />
                          Kendala Operasional
                        </div>
                        <div className="p-3 bg-[#FFFBEB] rounded border border-[#FFD83D] whitespace-pre-wrap">
                          {selectedReport.challenges}
                        </div>
                      </div>
                    )}

                    {selectedReport.risks && (
                      <div>
                        <div className="font-black uppercase text-[#9B1251] mb-1">Risiko & Perhatian Khusus</div>
                        <div className="p-3 bg-[#FFF0F5] rounded border border-[#FF2F92] whitespace-pre-wrap">
                          {selectedReport.risks}
                        </div>
                      </div>
                    )}

                    {selectedReport.next_week_plan && (
                      <div>
                        <div className="font-black uppercase text-[#171717] mb-1">Rencana Minggu Depan</div>
                        <div className="p-3 bg-[#FAF7F2] rounded border border-[#171717]/20 whitespace-pre-wrap">
                          {selectedReport.next_week_plan}
                        </div>
                      </div>
                    )}

                    {selectedReport.support_required && (
                      <div>
                        <div className="font-black uppercase text-[#4338CA] mb-1">Dukungan Diperlukan dari Pimpinan</div>
                        <div className="p-3 bg-[#EEF2FF] rounded border border-[#B8A0F0] whitespace-pre-wrap">
                          {selectedReport.support_required}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
