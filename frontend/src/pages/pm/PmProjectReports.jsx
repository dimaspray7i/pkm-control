import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import {
  FileBarChart,
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  RotateCcw,
  Loader2,
  Calendar,
  X,
  Eye,
  Edit3,
  Trash2,
  Printer,
  Send,
  AlertCircle,
  TrendingUp,
  Users,
  CheckSquare,
  Lock,
  ChevronRight,
  Sparkles,
  Info,
  ShieldCheck,
  History,
  Briefcase
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

const getDefaultWeekRange = () => {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const toYMD = (dt) => {
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const d = String(dt.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return {
    start: toYMD(monday),
    end: toYMD(sunday),
  }
}

// ─── Sub-Components ───────────────────────────────────────────────────────────
function KpiStat({ icon, label, value, sub, accent }) {
  return (
    <div className="bg-white border-1.5 border-[#171717] shadow-[3px_3px_0px_#171717] rounded-lg p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${accent || 'bg-[#FFD83D]'}`}>
          {icon}
        </div>
        <span className="text-[11px] font-black uppercase text-[#171717]/60 tracking-wide truncate">{label}</span>
      </div>
      <div className="text-2xl font-black text-[#171717] leading-tight">{value ?? '—'}</div>
      {sub && <div className="text-[11px] text-[#171717]/55 font-semibold truncate">{sub}</div>}
    </div>
  )
}

function StatusBadge({ status }) {
  if (status === 'published') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-black uppercase bg-[#ECFDF5] text-[#065F46] border border-[#10B981]">
        <Lock size={10} />
        Diterbitkan
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-black uppercase bg-[#FFFBEB] text-[#92400E] border border-[#FFD83D]">
      <Edit3 size={10} />
      Draft
    </span>
  )
}

// ─── Main Component: PmProjectReports ─────────────────────────────────────────
export default function PmProjectReports() {
  const { user } = useAuth()

  // Overview stats
  const [overview, setOverview] = useState(null)
  const [overviewLoading, setOverviewLoading] = useState(true)

  // Report list
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 })

  // Filters
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')

  // PM projects list for selector
  const [myProjects, setMyProjects] = useState([])

  // Modal / Drawer States
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingReport, setEditingReport] = useState(null) // null for create, object for edit
  const [selectedReportDetail, setSelectedReportDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // ── Fetch Overview ──────────────────────────────────────────────────────────
  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true)
    try {
      const res = await api.get('/project-reports/stats/overview')
      setOverview(res.data)
    } catch (e) {
      console.error('project-reports/stats/overview', e)
    } finally {
      setOverviewLoading(false)
    }
  }, [])

  // ── Fetch PM Projects ───────────────────────────────────────────────────────
  const fetchMyProjects = useCallback(async () => {
    try {
      const res = await api.get('/projects')
      const all = res.data.projects || res.data || []
      // If PM, filter by pic_id or backend already filtered
      const filtered = user?.role === 'project_manager'
        ? all.filter(p => p.pic_id === user.id)
        : all
      setMyProjects(filtered)
    } catch (e) {
      console.error('projects fetch', e)
    }
  }, [user])

  // ── Fetch Reports List ──────────────────────────────────────────────────────
  const fetchReports = useCallback(async (page = 1) => {
    setLoading(true)
    setError(null)
    try {
      const params = { page, per_page: 12 }
      if (search) params.search = search
      if (projectFilter !== 'all') params.project_id = projectFilter
      if (statusFilter !== 'all') params.status = statusFilter
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
      setError('Gagal memuat daftar laporan proyek.')
    } finally {
      setLoading(false)
    }
  }, [search, projectFilter, statusFilter, startDateFilter, endDateFilter])

  useEffect(() => {
    fetchOverview()
    fetchMyProjects()
  }, [fetchOverview, fetchMyProjects])

  useEffect(() => {
    fetchReports(1)
  }, [fetchReports])

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditingReport(null)
    setIsEditorOpen(true)
  }

  const handleOpenEdit = async (report) => {
    if (report.status === 'published') return
    try {
      const res = await api.get(`/project-reports/${report.id}`)
      setEditingReport(res.data.report)
      setIsEditorOpen(true)
    } catch (e) {
      alert('Gagal mengambil draft laporan.')
    }
  }

  const handleOpenDetail = async (reportId) => {
    setDetailLoading(true)
    try {
      const res = await api.get(`/project-reports/${reportId}`)
      setSelectedReportDetail(res.data.report)
    } catch (e) {
      alert('Gagal memuat detail laporan.')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDeleteDraft = async () => {
    if (!deleteConfirmId) return
    setDeleting(true)
    try {
      await api.delete(`/project-reports/${deleteConfirmId}`)
      setDeleteConfirmId(null)
      fetchReports(pagination.current_page)
      fetchOverview()
    } catch (e) {
      alert(e.response?.data?.message || 'Gagal menghapus draft.')
    } finally {
      setDeleting(false)
    }
  }

  const resetFilters = () => {
    setSearch('')
    setProjectFilter('all')
    setStatusFilter('all')
    setStartDateFilter('')
    setEndDateFilter('')
  }

  return (
    <div className="min-h-screen bg-[#F5F1E9]">
      <PageHeader
        tag="PM WORKSPACE"
        title="Project Reports"
        subtitle="Buat, kelola, dan terbitkan laporan kemajuan mingguan proyek kepada pimpinan"
      />

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── KPI Overview Row ─────────────────────────────────────────────── */}
        {overviewLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border-1.5 border-[#171717]/20 rounded-lg h-24 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiStat
              icon={<FileBarChart size={16} className="text-[#171717]" />}
              label="Total Laporan"
              value={overview?.total_reports ?? 0}
              sub={`${overview?.total_projects ?? 0} Proyek Terdaftar`}
              accent="bg-[#FFD83D]"
            />
            <KpiStat
              icon={<Edit3 size={16} className="text-[#171717]" />}
              label="Draft Laporan"
              value={overview?.total_drafts ?? 0}
              sub="Belum Diterbitkan"
              accent="bg-[#B8A0F0]"
            />
            <KpiStat
              icon={<CheckCircle2 size={16} className="text-white" />}
              label="Diterbitkan"
              value={overview?.total_published ?? 0}
              sub="Dapat Diakses Pimpinan"
              accent="bg-[#10B981]"
            />
            <KpiStat
              icon={<AlertTriangle size={16} className="text-white" />}
              label="Belum Dilaporkan"
              value={overview?.projects_unreported_this_week_count ?? 0}
              sub="Minggu Berjalan"
              accent={overview?.projects_unreported_this_week_count > 0 ? 'bg-[#FF2F92]' : 'bg-[#171717]'}
            />
          </div>
        )}

        {/* ── Action & Filter Toolbar ───────────────────────────────────────── */}
        <div className="bg-white border-1.5 border-[#171717] shadow-[3px_3px_0px_#171717] rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenCreate}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#FFD83D] text-[#171717] border-1.5 border-[#171717] shadow-[2px_2px_0px_#171717] rounded-md text-xs font-black uppercase hover:bg-[#ffe169] transition-all cursor-pointer"
              >
                <Plus size={16} />
                Buat Laporan Mingguan
              </button>
            </div>

            <div className="text-xs font-semibold text-[#171717]/60">
              Total {pagination.total} laporan ditemukan
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-[#171717]/10">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#171717]/50" />
              <input
                type="text"
                placeholder="Cari nomor laporan / proyek / rangkuman..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border-1.5 border-[#171717] rounded-md text-xs bg-[#F5F1E9] text-[#171717] placeholder:text-[#171717]/40 focus:outline-none focus:ring-2 focus:ring-[#FFD83D]"
              />
            </div>

            {/* Filter Proyek */}
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              className="border-1.5 border-[#171717] rounded-md text-xs py-1.5 px-3 bg-[#F5F1E9] text-[#171717] focus:outline-none cursor-pointer"
            >
              <option value="all">Semua Proyek</option>
              {myProjects.map(p => (
                <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>
              ))}
            </select>

            {/* Filter Status */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border-1.5 border-[#171717] rounded-md text-xs py-1.5 px-3 bg-[#F5F1E9] text-[#171717] focus:outline-none cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="draft">Draft Saja</option>
              <option value="published">Diterbitkan Saja</option>
            </select>

            {/* Filter Rentang Tanggal */}
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={startDateFilter}
                onChange={e => setStartDateFilter(e.target.value)}
                className="border-1.5 border-[#171717] rounded-md text-xs py-1 px-2 bg-[#F5F1E9] text-[#171717] focus:outline-none"
                title="Periode Awal"
              />
              <span className="text-xs font-black text-[#171717]">–</span>
              <input
                type="date"
                value={endDateFilter}
                onChange={e => setEndDateFilter(e.target.value)}
                className="border-1.5 border-[#171717] rounded-md text-xs py-1 px-2 bg-[#F5F1E9] text-[#171717] focus:outline-none"
                title="Periode Akhir"
              />
            </div>

            {/* Reset */}
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 border-1.5 border-[#171717] rounded-md text-xs font-black uppercase hover:bg-[#FFD83D] transition-colors cursor-pointer"
              title="Reset Filter"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          </div>
        </div>

        {/* ── Reports Grid List ─────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white border-1.5 border-[#171717]/20 rounded-lg h-56 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-white border-1.5 border-[#FF2F92] rounded-lg p-6 text-center">
            <AlertTriangle size={28} className="text-[#FF2F92] mx-auto mb-2" />
            <p className="font-black text-[#171717]">{error}</p>
            <button onClick={() => fetchReports(1)} className="mt-3 px-4 py-2 bg-[#171717] text-white rounded-md text-xs font-black uppercase cursor-pointer">
              Coba Lagi
            </button>
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white border-1.5 border-[#171717] shadow-[3px_3px_0px_#171717] rounded-lg p-12 text-center space-y-3">
            <FileBarChart size={44} className="text-[#171717]/30 mx-auto" />
            <h3 className="font-black text-lg text-[#171717]">Belum Ada Laporan Proyek</h3>
            <p className="text-xs text-[#171717]/60 max-w-md mx-auto">
              Buat laporan perkembangan mingguan pertama untuk mendokumentasikan progres, checklist, dan mitigasi kendala operasional proyek Anda.
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFD83D] text-[#171717] border-1.5 border-[#171717] shadow-[2px_2px_0px_#171717] rounded-md text-xs font-black uppercase hover:bg-[#ffe169] transition-all cursor-pointer"
            >
              <Plus size={14} />
              Mulai Buat Laporan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map(report => {
              const snap = report.snapshot_data || {}
              const proj = snap.project || report.project || {}
              const isDraft = report.status === 'draft'

              return (
                <div
                  key={report.id}
                  className="bg-white border-1.5 border-[#171717] shadow-[3px_3px_0px_#171717] rounded-lg overflow-hidden flex flex-col hover:shadow-[5px_5px_0px_#171717] transition-all"
                >
                  {/* Card Header */}
                  <div className="px-4 py-3 bg-[#F5F1E9] border-b-1.5 border-[#171717] flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black tracking-wide text-[#171717] font-mono bg-white px-2 py-0.5 rounded border border-[#171717]/30">
                      {report.report_number || `RPT-#${report.id}`}
                    </span>
                    <StatusBadge status={report.status} />
                  </div>

                  {/* Card Body */}
                  <div className="p-4 flex-1 space-y-3">
                    <div>
                      <div className="text-[11px] font-bold text-[#171717]/50 uppercase tracking-wide">
                        {proj.code ? `[${proj.code}] ` : ''}{proj.name || 'Proyek Tanpa Nama'}
                      </div>
                      <div className="font-black text-sm text-[#171717] line-clamp-1 mt-0.5">
                        Periode: {formatPeriodRange(report.period_start, report.period_end)}
                      </div>
                    </div>

                    {/* Progress Bar & KPI Quick View */}
                    <div className="bg-[#FAF7F2] border border-[#171717]/15 rounded p-2.5 space-y-1.5">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-bold text-[#171717]/60">Progres Snapshot:</span>
                        <span className="font-black text-[#171717]">{proj.progress ?? 0}%</span>
                      </div>
                      <div className="w-full bg-[#171717]/10 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#10B981] rounded-full transition-all"
                          style={{ width: `${Math.min(100, proj.progress ?? 0)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-[#171717]/50 pt-0.5">
                        <span>Total: {proj.total_tasks ?? 0} Tugas</span>
                        <span className="text-[#10B981] font-bold">✓ {proj.completed_tasks ?? 0} Selesai</span>
                        {proj.overdue_tasks > 0 && (
                          <span className="text-[#FF2F92] font-black">⚠ {proj.overdue_tasks} Overdue</span>
                        )}
                      </div>
                    </div>

                    {/* Executive Summary Preview */}
                    {report.executive_summary ? (
                      <p className="text-xs text-[#171717]/75 line-clamp-2 leading-relaxed italic bg-white p-2 rounded border border-[#171717]/10">
                        "{report.executive_summary}"
                      </p>
                    ) : (
                      <div className="text-[11px] text-[#FF5722] font-semibold bg-[#FFF7ED] p-2 rounded border border-[#FF5722]/30">
                        Belum ada ringkasan eksekutif (wajib diisi sebelum publikasi).
                      </div>
                    )}

                    {/* Publication info */}
                    <div className="text-[10px] text-[#171717]/50 flex items-center justify-between pt-1">
                      <span>Dibuat: {formatDateIndo(report.created_at)}</span>
                      {report.published_at && (
                        <span>Diterbitkan: {formatDateIndo(report.published_at)}</span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="px-4 py-2.5 bg-[#F5F1E9] border-t-1.5 border-[#171717] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenDetail(report.id)}
                      className="flex-1 py-1.5 bg-[#171717] text-white rounded text-xs font-black uppercase hover:bg-neutral-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Eye size={12} />
                      Detail
                    </button>

                    {isDraft && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(report)}
                          className="px-2.5 py-1.5 bg-[#FFD83D] text-[#171717] border border-[#171717] rounded text-xs font-black uppercase hover:bg-[#ffe169] transition-colors cursor-pointer flex items-center gap-1"
                          title="Edit Draft"
                        >
                          <Edit3 size={12} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(report.id)}
                          className="p-1.5 text-[#FF2F92] hover:bg-[#FFF0F5] border border-transparent hover:border-[#FF2F92] rounded transition-colors cursor-pointer"
                          title="Hapus Draft"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Pagination ────────────────────────────────────────────────────── */}
        {pagination.last_page > 1 && (
          <div className="flex justify-center items-center gap-2 pt-4">
            <button
              disabled={pagination.current_page <= 1}
              onClick={() => fetchReports(pagination.current_page - 1)}
              className="px-3 py-1.5 border-1.5 border-[#171717] rounded text-xs font-black uppercase bg-white disabled:opacity-40 cursor-pointer"
            >
              Sebelumnya
            </button>
            <span className="text-xs font-black text-[#171717] px-2">
              Halaman {pagination.current_page} dari {pagination.last_page}
            </span>
            <button
              disabled={pagination.current_page >= pagination.last_page}
              onClick={() => fetchReports(pagination.current_page + 1)}
              className="px-3 py-1.5 border-1.5 border-[#171717] rounded text-xs font-black uppercase bg-white disabled:opacity-40 cursor-pointer"
            >
              Berikutnya
            </button>
          </div>
        )}

      </div>

      {/* ── Create / Edit Report Drawer Modal ───────────────────────────────── */}
      {isEditorOpen && (
        <ReportEditorDrawer
          report={editingReport}
          projects={myProjects}
          onClose={() => setIsEditorOpen(false)}
          onSaved={() => {
            setIsEditorOpen(false)
            fetchReports(1)
            fetchOverview()
          }}
        />
      )}

      {/* ── Full Document Detail & Print Modal ──────────────────────────────── */}
      {(selectedReportDetail || detailLoading) && (
        <ReportDocumentModal
          loading={detailLoading}
          report={selectedReportDetail}
          onClose={() => setSelectedReportDetail(null)}
          onEdit={() => {
            const r = selectedReportDetail
            setSelectedReportDetail(null)
            handleOpenEdit(r)
          }}
          onPublishSuccess={() => {
            fetchReports(pagination.current_page)
            fetchOverview()
            if (selectedReportDetail) handleOpenDetail(selectedReportDetail.id)
          }}
        />
      )}

      {/* ── Delete Draft Confirm Dialog ────────────────────────────────────── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#171717]/50 backdrop-blur-sm">
          <div className="bg-white border-2 border-[#171717] shadow-[6px_6px_0px_#171717] rounded-lg max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-2 text-[#FF2F92]">
              <AlertTriangle size={24} />
              <h4 className="font-black text-sm uppercase text-[#171717]">Hapus Draft Laporan?</h4>
            </div>
            <p className="text-xs text-[#171717]/70 leading-relaxed">
              Draft laporan ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 border border-[#171717] rounded text-xs font-black uppercase hover:bg-[#F5F1E9] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteDraft}
                className="px-4 py-1.5 bg-[#FF2F92] text-white rounded text-xs font-black uppercase hover:bg-red-700 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {deleting && <Loader2 size={12} className="animate-spin" />}
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Report Editor Drawer / Modal ─────────────────────────────────────────────
function ReportEditorDrawer({ report, projects, onClose, onSaved }) {
  const isEdit = Boolean(report?.id)
  const defaultDates = useMemo(() => getDefaultWeekRange(), [])

  // Form states
  const [projectId, setProjectId] = useState(report?.project_id || (projects[0]?.id || ''))
  const [periodStart, setPeriodStart] = useState(report?.period_start || defaultDates.start)
  const [periodEnd, setPeriodEnd] = useState(report?.period_end || defaultDates.end)

  // Narrative states
  const [executiveSummary, setExecutiveSummary] = useState(report?.executive_summary || '')
  const [completedWork, setCompletedWork] = useState(report?.completed_work || '')
  const [challenges, setChallenges] = useState(report?.challenges || '')
  const [risks, setRisks] = useState(report?.risks || '')
  const [nextWeekPlan, setNextWeekPlan] = useState(report?.next_week_plan || '')
  const [supportRequired, setSupportRequired] = useState(report?.support_required || '')

  // Live Snapshot state
  const [liveSnapshot, setLiveSnapshot] = useState(report?.snapshot_data || null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)

  // Fetch Live Snapshot Preview when project or period changes
  const fetchLiveSnapshot = useCallback(async () => {
    if (!projectId) return
    setPreviewLoading(true)
    setErrorMessage(null)
    try {
      const res = await api.get(`/projects/${projectId}/reports/preview`, {
        params: { period_start: periodStart, period_end: periodEnd },
      })
      setLiveSnapshot(res.data.snapshot)
    } catch (e) {
      console.error('preview error', e)
    } finally {
      setPreviewLoading(false)
    }
  }, [projectId, periodStart, periodEnd])

  useEffect(() => {
    if (!isEdit && projectId) {
      fetchLiveSnapshot()
    }
  }, [fetchLiveSnapshot, isEdit, projectId])

  // Save as Draft
  const handleSaveDraft = async () => {
    setSavingDraft(true)
    setErrorMessage(null)
    try {
      const payload = {
        period_start: periodStart,
        period_end: periodEnd,
        executive_summary: executiveSummary,
        completed_work: completedWork,
        challenges: challenges,
        risks: risks,
        next_week_plan: nextWeekPlan,
        support_required: supportRequired,
      }

      if (isEdit) {
        payload.refresh_snapshot = true
        await api.put(`/project-reports/${report.id}`, payload)
      } else {
        await api.post(`/projects/${projectId}/reports`, payload)
      }
      onSaved()
    } catch (e) {
      setErrorMessage(e.response?.data?.message || 'Gagal menyimpan draft laporan.')
    } finally {
      setSavingDraft(false)
    }
  }

  // Publish Directly
  const handlePublish = async () => {
    if (!executiveSummary.trim()) {
      setErrorMessage('Executive Summary wajib diisi sebelum menerbitkan laporan.')
      return
    }

    if (!window.confirm('Terbitkan laporan ini sekarang? Laporan yang telah diterbitkan akan berstatus final dan dapat langsung dibaca oleh pimpinan.')) {
      return
    }

    setPublishing(true)
    setErrorMessage(null)
    try {
      let reportId = report?.id

      // If new, create draft first then publish
      if (!isEdit) {
        const createRes = await api.post(`/projects/${projectId}/reports`, {
          period_start: periodStart,
          period_end: periodEnd,
          executive_summary: executiveSummary,
          completed_work: completedWork,
          challenges: challenges,
          risks: risks,
          next_week_plan: nextWeekPlan,
          support_required: supportRequired,
        })
        reportId = createRes.data.report.id
      }

      await api.post(`/project-reports/${reportId}/publish`, {
        executive_summary: executiveSummary,
        completed_work: completedWork,
        challenges: challenges,
        risks: risks,
        next_week_plan: nextWeekPlan,
        support_required: supportRequired,
      })

      onSaved()
    } catch (e) {
      setErrorMessage(e.response?.data?.message || 'Gagal menerbitkan laporan.')
    } finally {
      setPublishing(false)
    }
  }

  const snapProj = liveSnapshot?.project || {}

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[#171717]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl bg-white border-l-2 border-[#171717] flex flex-col h-full shadow-[-6px_0_20px_rgba(0,0,0,0.15)] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-[#171717] text-white flex items-center justify-between shrink-0">
          <div>
            <div className="font-black text-sm uppercase tracking-wide">
              {isEdit ? `Edit Draft Laporan (${report.report_number || `#${report.id}`})` : 'Buat Laporan Mingguan Baru'}
            </div>
            <div className="text-[11px] text-white/60">
              Snapshot data dihitung otomatis langsung dari database operasional proyek
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-white/10 rounded cursor-pointer transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-[#FFF0F5] border-1.5 border-[#FF2F92] rounded-md text-xs font-bold text-[#FF2F92] flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Step 1: Project & Period */}
          <div className="bg-[#FAF7F2] border-1.5 border-[#171717] rounded-lg p-4 space-y-3">
            <div className="font-black text-xs uppercase text-[#171717] flex items-center gap-1.5">
              <FolderKanban size={14} />
              1. Identitas Proyek & Periode Laporan
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Project select */}
              <div className="md:col-span-1">
                <label className="block text-[11px] font-black uppercase text-[#171717]/60 mb-1">Proyek</label>
                <select
                  disabled={isEdit}
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  className="w-full border-1.5 border-[#171717] rounded py-1.5 px-2 text-xs bg-white text-[#171717] focus:outline-none disabled:bg-gray-100 font-semibold cursor-pointer"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.code ? `[${p.code}] ` : ''}{p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Period start */}
              <div>
                <label className="block text-[11px] font-black uppercase text-[#171717]/60 mb-1">Tanggal Mulai</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={e => setPeriodStart(e.target.value)}
                  className="w-full border-1.5 border-[#171717] rounded py-1.5 px-2 text-xs bg-white text-[#171717] focus:outline-none font-semibold"
                />
              </div>

              {/* Period end */}
              <div>
                <label className="block text-[11px] font-black uppercase text-[#171717]/60 mb-1">Tanggal Akhir</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={e => setPeriodEnd(e.target.value)}
                  className="w-full border-1.5 border-[#171717] rounded py-1.5 px-2 text-xs bg-white text-[#171717] focus:outline-none font-semibold"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={fetchLiveSnapshot}
                disabled={previewLoading}
                className="inline-flex items-center gap-1 text-[11px] font-black uppercase text-[#171717] bg-[#FFD83D] px-2.5 py-1 rounded border border-[#171717] hover:bg-[#ffe169] transition-colors cursor-pointer"
              >
                {previewLoading ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                Muat Ulang Snapshot Aktual
              </button>
            </div>
          </div>

          {/* Step 2: Live Snapshot Summary Card */}
          <div className="bg-white border-1.5 border-[#171717] rounded-lg p-4 space-y-3">
            <div className="font-black text-xs uppercase text-[#171717] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-[#FFD83D]" />
                2. Ringkasan Snapshot Data Aktual
              </span>
              <span className="text-[10px] font-normal text-[#171717]/50 font-mono">
                {liveSnapshot?.captured_at ? `Diambil: ${new Date(liveSnapshot.captured_at).toLocaleTimeString('id-ID')}` : ''}
              </span>
            </div>

            {previewLoading ? (
              <div className="py-6 flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-[#171717]/40" />
              </div>
            ) : liveSnapshot ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="bg-[#FAF7F2] p-2.5 rounded border border-[#171717]/15">
                  <div className="text-xl font-black text-[#10B981]">{snapProj.progress ?? 0}%</div>
                  <div className="text-[10px] font-black uppercase text-[#171717]/50">Progres Proyek</div>
                </div>
                <div className="bg-[#FAF7F2] p-2.5 rounded border border-[#171717]/15">
                  <div className="text-xl font-black text-[#171717]">
                    {snapProj.completed_tasks ?? 0}/{snapProj.total_tasks ?? 0}
                  </div>
                  <div className="text-[10px] font-black uppercase text-[#171717]/50">Tugas Selesai</div>
                </div>
                <div className="bg-[#FAF7F2] p-2.5 rounded border border-[#171717]/15">
                  <div className="text-xl font-black text-[#B8A0F0]">{snapProj.in_review_tasks ?? 0}</div>
                  <div className="text-[10px] font-black uppercase text-[#171717]/50">In Review</div>
                </div>
                <div className="bg-[#FAF7F2] p-2.5 rounded border border-[#171717]/15">
                  <div className={`text-xl font-black ${snapProj.overdue_tasks > 0 ? 'text-[#FF2F92]' : 'text-[#171717]/40'}`}>
                    {snapProj.overdue_tasks ?? 0}
                  </div>
                  <div className="text-[10px] font-black uppercase text-[#171717]/50">Overdue</div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-center text-[#171717]/40 py-2">Pilih proyek untuk melihat snapshot data.</p>
            )}
          </div>

          {/* Step 3: Narrative Form Fields */}
          <div className="bg-white border-1.5 border-[#171717] rounded-lg p-4 space-y-4">
            <div className="font-black text-xs uppercase text-[#171717] flex items-center gap-1.5">
              <Edit3 size={14} />
              3. Narasi & Analisis Laporan (Project Manager)
            </div>

            {/* 1. Executive Summary */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-black uppercase text-[#171717]">
                  Executive Summary <span className="text-[#FF2F92]">* Wajib Diisi</span>
                </label>
                <span className="text-[10px] text-[#171717]/40">{executiveSummary.length} karakter</span>
              </div>
              <textarea
                rows={3}
                value={executiveSummary}
                onChange={e => setExecutiveSummary(e.target.value)}
                placeholder="Rangkum kondisi keseluruhan proyek, pencapaian milestone, dan status waktu pada periode ini..."
                className="w-full border-1.5 border-[#171717] rounded p-2 text-xs bg-[#FAF7F2] text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#FFD83D] leading-relaxed"
              />
            </div>

            {/* 2. Completed Work */}
            <div>
              <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                Completed Work (Pekerjaan Selesai)
              </label>
              <textarea
                rows={2}
                value={completedWork}
                onChange={e => setCompletedWork(e.target.value)}
                placeholder="Daftar pekerjaan penting, fitur yang dirampungkan, atau approval yang telah diselesaikan..."
                className="w-full border-1.5 border-[#171717] rounded p-2 text-xs bg-[#FAF7F2] text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#FFD83D] leading-relaxed"
              />
            </div>

            {/* 3. Challenges & Blockers */}
            <div>
              <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                Challenges & Blockers (Kendala Operasional)
              </label>
              <textarea
                rows={2}
                value={challenges}
                onChange={e => setChallenges(e.target.value)}
                placeholder="Hambatan teknis, ketergantungan pihak ketiga, atau masalah perizinan klien..."
                className="w-full border-1.5 border-[#171717] rounded p-2 text-xs bg-[#FAF7F2] text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#FFD83D] leading-relaxed"
              />
            </div>

            {/* 4. Risks & Attention */}
            <div>
              <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                Risk & Attention (Risiko & Perhatian Khusus)
              </label>
              <textarea
                rows={2}
                value={risks}
                onChange={e => setRisks(e.target.value)}
                placeholder="Potensi pergeseran jadwal, beban tim berlebih, atau konsekuensi jika kendala tidak tertangani..."
                className="w-full border-1.5 border-[#171717] rounded p-2 text-xs bg-[#FAF7F2] text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#FFD83D] leading-relaxed"
              />
            </div>

            {/* 5. Next Week Plan */}
            <div>
              <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                Next Week Plan (Rencana Periode Berikutnya)
              </label>
              <textarea
                rows={2}
                value={nextWeekPlan}
                onChange={e => setNextWeekPlan(e.target.value)}
                placeholder="Target milestone berikutnya, penugasan prioritas, dan jadwal deliverable minggu depan..."
                className="w-full border-1.5 border-[#171717] rounded p-2 text-xs bg-[#FAF7F2] text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#FFD83D] leading-relaxed"
              />
            </div>

            {/* 6. Support Required */}
            <div>
              <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                Support Required (Dukungan Diperlukan dari Pimpinan)
              </label>
              <textarea
                rows={2}
                value={supportRequired}
                onChange={e => setSupportRequired(e.target.value)}
                placeholder="Keputusan strategis, eskalasi klien, atau alokasi sumber daya yang dibutuhkan..."
                className="w-full border-1.5 border-[#171717] rounded p-2 text-xs bg-[#FAF7F2] text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#FFD83D] leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-[#F5F1E9] border-t-2 border-[#171717] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border-1.5 border-[#171717] rounded text-xs font-black uppercase bg-white hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            Batal
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={savingDraft || publishing}
              onClick={handleSaveDraft}
              className="px-4 py-2 bg-white text-[#171717] border-1.5 border-[#171717] shadow-[2px_2px_0px_#171717] rounded text-xs font-black uppercase hover:bg-neutral-100 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {savingDraft && <Loader2 size={13} className="animate-spin" />}
              Simpan Draft
            </button>

            <button
              type="button"
              disabled={savingDraft || publishing}
              onClick={handlePublish}
              className="px-5 py-2 bg-[#10B981] text-white border-1.5 border-[#171717] shadow-[2px_2px_0px_#171717] rounded text-xs font-black uppercase hover:bg-emerald-600 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {publishing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Terbitkan Laporan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Full Report Document Modal (Print Ready) ─────────────────────────────────
function ReportDocumentModal({ loading, report, onClose, onEdit, onPublishSuccess }) {
  const [publishing, setPublishing] = useState(false)

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171717]/40 backdrop-blur-sm">
        <div className="bg-white border-2 border-[#171717] rounded-lg p-8 text-center space-y-2">
          <Loader2 size={32} className="animate-spin text-[#171717] mx-auto" />
          <p className="text-xs font-black text-[#171717] uppercase">Memuat Laporan Proyek...</p>
        </div>
      </div>
    )
  }

  if (!report) return null

  const snap = report.snapshot_data || {}
  const proj = snap.project || report.project || {}
  const taskDist = snap.task_distribution || {}
  const chk = snap.checklist_progress || {}
  const dead = snap.deadlines || {}
  const milest = snap.milestones || {}
  const workload = snap.team_workload || {}
  const isDraft = report.status === 'draft'

  const handlePrint = () => {
    window.print()
  }

  const handlePublishNow = async () => {
    if (!report.executive_summary?.trim()) {
      alert('Executive summary wajib diisi sebelum laporan diterbitkan. Silakan edit draft terlebih dahulu.')
      return
    }

    if (!window.confirm('Terbitkan laporan ini sekarang? Setelah diterbitkan, laporan akan bersifat permanen dan tidak dapat diubah lagi.')) {
      return
    }

    setPublishing(true)
    try {
      await api.post(`/project-reports/${report.id}/publish`)
      onPublishSuccess()
    } catch (e) {
      alert(e.response?.data?.message || 'Gagal menerbitkan laporan.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#171717]/60 backdrop-blur-sm overflow-y-auto">
      {/* Container A4 preview style */}
      <div className="bg-white border-2 border-[#171717] shadow-[8px_8px_0px_#171717] rounded-lg w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">

        {/* Modal Controls Bar (Hidden in Print) */}
        <div className="print:hidden px-5 py-3 bg-[#171717] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-black bg-[#FFD83D] text-[#171717] px-2 py-0.5 rounded">
              {report.report_number || `RPT-#${report.id}`}
            </span>
            <StatusBadge status={report.status} />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1 bg-white text-[#171717] rounded text-xs font-black uppercase hover:bg-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={13} />
              Cetak / Print
            </button>

            {isDraft && (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  className="px-3 py-1 bg-[#FFD83D] text-[#171717] rounded text-xs font-black uppercase hover:bg-[#ffe169] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 size={13} />
                  Edit Draft
                </button>
                <button
                  type="button"
                  disabled={publishing}
                  onClick={handlePublishNow}
                  className="px-3 py-1 bg-[#10B981] text-white rounded text-xs font-black uppercase hover:bg-emerald-600 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {publishing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  Publish
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded cursor-pointer transition-colors ml-2"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div id="printable-report-area" className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-[#171717] bg-white">

          {/* Letterhead Header */}
          <div className="border-b-2 border-[#171717] pb-4 flex flex-wrap justify-between items-start gap-4">
            <div>
              <div className="text-[11px] font-black tracking-widest text-[#171717]/60 uppercase">
                PT POTENSI KARYA MANDIRI — BUSINESS CONTROL CENTER
              </div>
              <h1 className="text-xl sm:text-2xl font-black uppercase text-[#171717] tracking-tight mt-0.5">
                LAPORAN KEMAJUAN MINGGUAN PROYEK
              </h1>
              <div className="text-xs font-bold text-[#171717]/70 mt-1">
                {proj.name} {proj.code ? `(${proj.code})` : ''} · Klien: {proj.client || '—'}
              </div>
            </div>

            <div className="text-right font-mono text-xs space-y-0.5">
              <div className="font-black text-sm text-[#171717]">{report.report_number || `RPT-#${report.id}`}</div>
              <div className="text-[11px] text-[#171717]/70">
                Periode: <span className="font-bold">{formatPeriodRange(report.period_start, report.period_end)}</span>
              </div>
              <div className="text-[11px] text-[#171717]/70">
                PM: <span className="font-bold">{report.creator?.name || proj.pic_name || '—'}</span>
              </div>
              <div className="text-[11px] text-[#171717]/70">
                Status: <span className="font-bold uppercase">{report.status}</span>
              </div>
            </div>
          </div>

          {/* 1. Executive Summary Box */}
          <div className="bg-[#FAF7F2] border-1.5 border-[#171717] rounded-lg p-4 space-y-1.5">
            <div className="text-[11px] font-black uppercase tracking-wider text-[#171717]/60">
              EXECUTIVE SUMMARY
            </div>
            <p className="text-sm text-[#171717] leading-relaxed font-medium">
              {report.executive_summary || <span className="text-[#171717]/40 italic">Tidak ada ringkasan eksekutif.</span>}
            </p>
          </div>

          {/* 2. Key Metrics Snapshot Grid */}
          <div>
            <div className="text-xs font-black uppercase text-[#171717] mb-2 flex items-center gap-1.5">
              <TrendingUp size={14} />
              METRIK & PROGRES AKTUAL PROYEK
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="border-1.5 border-[#171717] rounded-lg p-3 bg-white">
                <div className="text-2xl font-black text-[#10B981]">{proj.progress ?? 0}%</div>
                <div className="text-[10px] font-black uppercase text-[#171717]/60 mt-0.5">Progres Proyek</div>
                <div className="text-[10px] text-[#171717]/50 mt-1">Target: {proj.target_progress ?? 100}%</div>
              </div>

              <div className="border-1.5 border-[#171717] rounded-lg p-3 bg-white">
                <div className="text-2xl font-black text-[#171717]">
                  {proj.completed_tasks ?? 0} <span className="text-xs font-normal text-[#171717]/40">/ {proj.total_tasks ?? 0}</span>
                </div>
                <div className="text-[10px] font-black uppercase text-[#171717]/60 mt-0.5">Tugas Selesai</div>
                <div className="text-[10px] text-[#171717]/50 mt-1">{proj.active_tasks ?? 0} tugas aktif</div>
              </div>

              <div className="border-1.5 border-[#171717] rounded-lg p-3 bg-white">
                <div className="text-2xl font-black text-[#B8A0F0]">{chk.completion_rate ?? 0}%</div>
                <div className="text-[10px] font-black uppercase text-[#171717]/60 mt-0.5">Checklist Rate</div>
                <div className="text-[10px] text-[#171717]/50 mt-1">{chk.completed_checklists ?? 0} dari {chk.total_checklists ?? 0} item</div>
              </div>

              <div className="border-1.5 border-[#171717] rounded-lg p-3 bg-white">
                <div className={`text-2xl font-black ${proj.overdue_tasks > 0 ? 'text-[#FF2F92]' : 'text-[#171717]/40'}`}>
                  {proj.overdue_tasks ?? 0}
                </div>
                <div className="text-[10px] font-black uppercase text-[#171717]/60 mt-0.5">Tugas Terlambat</div>
                <div className="text-[10px] text-[#171717]/50 mt-1">
                  {proj.in_review_tasks ?? 0} menunggu review
                </div>
              </div>
            </div>
          </div>

          {/* 3. Task Distribution & Deadline Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Task Distribution */}
            <div className="border-1.5 border-[#171717] rounded-lg p-3.5 space-y-2">
              <div className="text-xs font-black uppercase text-[#171717] flex items-center justify-between">
                <span>Distribusi Status Tugas</span>
                <span className="text-[10px] font-normal text-[#171717]/50">Total: {proj.total_tasks ?? 0}</span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center text-xs">
                <div className="p-2 bg-[#F5F1E9] rounded">
                  <div className="font-black text-[#171717]">{taskDist.todo ?? 0}</div>
                  <div className="text-[10px] text-[#171717]/60 uppercase">Todo</div>
                </div>
                <div className="p-2 bg-[#FFFBEB] rounded">
                  <div className="font-black text-[#92400E]">{taskDist.in_progress ?? 0}</div>
                  <div className="text-[10px] text-[#92400E]/70 uppercase">In Progress</div>
                </div>
                <div className="p-2 bg-[#EEF2FF] rounded">
                  <div className="font-black text-[#4338CA]">{taskDist.in_review ?? 0}</div>
                  <div className="text-[10px] text-[#4338CA]/70 uppercase">Review</div>
                </div>
                <div className="p-2 bg-[#ECFDF5] rounded">
                  <div className="font-black text-[#065F46]">{taskDist.total_done ?? (taskDist.done ?? 0)}</div>
                  <div className="text-[10px] text-[#065F46]/70 uppercase">Done</div>
                </div>
              </div>
            </div>

            {/* Deadline status */}
            <div className="border-1.5 border-[#171717] rounded-lg p-3.5 space-y-2">
              <div className="text-xs font-black uppercase text-[#171717]">Monitoring Deadline Tugas</div>
              <div className="grid grid-cols-4 gap-1 text-center text-xs">
                <div className="p-2 bg-[#FFF0F5] rounded">
                  <div className="font-black text-[#FF2F92]">{dead.overdue ?? 0}</div>
                  <div className="text-[10px] text-[#FF2F92]/70 uppercase">Overdue</div>
                </div>
                <div className="p-2 bg-[#FAF7F2] rounded">
                  <div className="font-black text-[#171717]">{dead.due_today ?? 0}</div>
                  <div className="text-[10px] text-[#171717]/60 uppercase">Hari Ini</div>
                </div>
                <div className="p-2 bg-[#FAF7F2] rounded">
                  <div className="font-black text-[#171717]">{dead.due_soon ?? 0}</div>
                  <div className="text-[10px] text-[#171717]/60 uppercase">&le; 7 Hari</div>
                </div>
                <div className="p-2 bg-[#FAF7F2] rounded">
                  <div className="font-black text-[#171717]">{dead.no_deadline ?? 0}</div>
                  <div className="text-[10px] text-[#171717]/60 uppercase">No Date</div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Milestones / Sprints */}
          {milest.list?.length > 0 && (
            <div>
              <div className="text-xs font-black uppercase text-[#171717] mb-2 flex items-center justify-between">
                <span>Milestone & Target Fase Proyek</span>
                <span className="text-[10px] font-normal text-[#171717]/60">
                  {milest.completed ?? 0} selesai dari {milest.total ?? 0} milestone
                </span>
              </div>
              <div className="border-1.5 border-[#171717] rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-[#171717] text-white">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase">Milestone</th>
                      <th className="px-3 py-2 text-center text-[10px] font-black uppercase">Status</th>
                      <th className="px-3 py-2 text-center text-[10px] font-black uppercase">Progres</th>
                      <th className="px-3 py-2 text-right text-[10px] font-black uppercase">Target Selesai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#171717]/10">
                    {milest.list.map(m => (
                      <tr key={m.id}>
                        <td className="px-3 py-2 font-bold">{m.name || m.title}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            m.status === 'completed' ? 'bg-[#ECFDF5] text-[#065F46]' : 'bg-[#FFFBEB] text-[#92400E]'
                          }`}>
                            {m.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center font-mono font-bold">{m.progress ?? 0}%</td>
                        <td className="px-3 py-2 text-right text-[11px] text-[#171717]/70">
                          {formatDateIndo(m.due_date || m.target_date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. Team Workload Snapshot */}
          {workload.members?.length > 0 && (
            <div>
              <div className="text-xs font-black uppercase text-[#171717] mb-2 flex items-center justify-between">
                <span>Beban Kerja Tim Pada Proyek</span>
                <span className="text-[10px] font-normal text-[#171717]/60">{workload.total_members} Anggota Terlibat</span>
              </div>
              <div className="border-1.5 border-[#171717] rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-[#FAF7F2] text-[#171717] border-b-1.5 border-[#171717]">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase">Member</th>
                      <th className="px-3 py-2 text-center text-[10px] font-black uppercase">Level</th>
                      <th className="px-3 py-2 text-center text-[10px] font-black uppercase">Tugas Aktif</th>
                      <th className="px-3 py-2 text-center text-[10px] font-black uppercase">Overdue</th>
                      <th className="px-3 py-2 text-center text-[10px] font-black uppercase">In Review</th>
                      <th className="px-3 py-2 text-center text-[10px] font-black uppercase">Selesai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#171717]/10">
                    {workload.members.map(m => (
                      <tr key={m.id}>
                        <td className="px-3 py-2">
                          <div className="font-bold">{m.name}</div>
                          {m.position && <div className="text-[10px] text-[#171717]/50">{m.position}</div>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#F5F1E9] border border-[#171717]/20 uppercase">
                            {m.workload_level}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center font-black">{m.active_tasks}</td>
                        <td className={`px-3 py-2 text-center font-black ${m.overdue_tasks > 0 ? 'text-[#FF2F92]' : 'text-[#171717]/40'}`}>
                          {m.overdue_tasks}
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-[#B8A0F0]">{m.in_review_tasks}</td>
                        <td className="px-3 py-2 text-center font-bold text-[#10B981]">{m.done_tasks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. Narrative Sections Grid */}
          <div className="space-y-4 pt-2">
            <div className="border-t-2 border-[#171717] pt-4">
              <div className="text-xs font-black uppercase text-[#171717] mb-1">
                A. PEKERJAAN YANG DISELESAIKAN (COMPLETED WORK)
              </div>
              <div className="text-xs leading-relaxed text-[#171717] bg-[#FAF7F2] p-3 rounded border border-[#171717]/20 whitespace-pre-wrap">
                {report.completed_work || 'Tidak ada catatan pekerjaan selesai khusus pada periode ini.'}
              </div>
            </div>

            <div>
              <div className="text-xs font-black uppercase text-[#171717] mb-1 flex items-center gap-1.5 text-[#9A3412]">
                <AlertTriangle size={13} />
                B. KENDALA & HAMBATAN OPERASIONAL (CHALLENGES & BLOCKERS)
              </div>
              <div className="text-xs leading-relaxed text-[#171717] bg-[#FFFBEB] p-3 rounded border border-[#FFD83D] whitespace-pre-wrap">
                {report.challenges || 'Tidak ada kendala operasional yang dilaporkan.'}
              </div>
            </div>

            <div>
              <div className="text-xs font-black uppercase text-[#171717] mb-1 text-[#9B1251]">
                C. RISIKO & PERHATIAN (RISKS & ATTENTION)
              </div>
              <div className="text-xs leading-relaxed text-[#171717] bg-[#FFF0F5] p-3 rounded border border-[#FF2F92] whitespace-pre-wrap">
                {report.risks || 'Tidak ada profil risiko kritis yang memerlukan eskalasi.'}
              </div>
            </div>

            <div>
              <div className="text-xs font-black uppercase text-[#171717] mb-1">
                D. RENCANA PEKERJAAN MINGGU BERIKUTNYA (NEXT WEEK PLAN)
              </div>
              <div className="text-xs leading-relaxed text-[#171717] bg-[#FAF7F2] p-3 rounded border border-[#171717]/20 whitespace-pre-wrap">
                {report.next_week_plan || 'Target periode berikutnya berjalan sesuai roadmap proyek.'}
              </div>
            </div>

            <div>
              <div className="text-xs font-black uppercase text-[#171717] mb-1 text-[#4338CA]">
                E. DUKUNGAN YANG DIBUTUHKAN DARI PIMPINAN (SUPPORT REQUIRED)
              </div>
              <div className="text-xs leading-relaxed text-[#171717] bg-[#EEF2FF] p-3 rounded border border-[#B8A0F0] whitespace-pre-wrap">
                {report.support_required || 'Tidak ada keputusan atau dukungan khusus yang diperlukan saat ini.'}
              </div>
            </div>
          </div>

          {/* 7. Document Signatures & Metadata */}
          <div className="border-t-2 border-[#171717] pt-6 flex justify-between items-end text-xs">
            <div className="space-y-1">
              <div className="text-[10px] text-[#171717]/50 font-mono">
                Generated by PKM Business Control Center · {new Date().toLocaleDateString('id-ID')}
              </div>
              <div className="text-[10px] text-[#171717]/50 font-mono">
                {report.published_at ? `Published: ${new Date(report.published_at).toLocaleString('id-ID')}` : 'Status: DRAFT'}
              </div>
            </div>

            <div className="text-center w-48 space-y-10">
              <div className="font-black text-[11px] uppercase text-[#171717]/60">Project Manager,</div>
              <div className="border-b border-[#171717] pb-1 font-black text-xs">
                {report.creator?.name || proj.pic_name || 'Project Manager'}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
