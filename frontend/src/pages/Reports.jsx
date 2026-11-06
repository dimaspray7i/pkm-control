import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import {
  FolderKanban, CheckCircle2, AlertTriangle, Clock, FileBarChart,
  TrendingUp, Loader2, RotateCcw, Activity, Download, Printer,
  Sparkles, Filter, Calendar, Users, ShieldAlert, ArrowUpRight,
  Search, ChevronLeft, ChevronRight, CheckSquare, BarChart2,
  PieChart as PieIcon, Layers, Flag, UserCheck, X
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend
} from 'recharts'
import PageHeader from '../components/ui/PageHeader'

const PERIOD_OPTIONS = [
  { value: 'this_month', label: 'Bulan Ini' },
  { value: 'today', label: 'Hari Ini' },
  { value: 'this_week', label: 'Minggu Ini' },
  { value: 'last_month', label: 'Bulan Lalu' },
  { value: 'this_year', label: 'Tahun Ini' },
  { value: 'custom', label: 'Rentang Kustom' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua Status Proyek' },
  { value: 'on_track', label: 'On Track' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'completed', label: 'Completed' },
]

export default function Reports() {
  const navigate = useNavigate()

  // Filter States
  const [period, setPeriod] = useState('this_month')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedPersonnelId, setSelectedPersonnelId] = useState('all')

  const [projectList, setProjectList] = useState([])
  const [personnelList, setPersonnelList] = useState([])

  // Data States
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)

  // Table Search, Sort, & Pagination for Projects
  const [searchTable, setSearchTable] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 5

  // Tab for Detailed Tables (Projects / Sprints)
  const [activeTableTab, setActiveTableTab] = useState('projects')

  // Fetch dropdown lists (projects and team members)
  useEffect(() => {
    api.get('/projects')
      .then(res => setProjectList(res.data.projects || []))
      .catch(() => {})

    api.get('/users')
      .then(res => setPersonnelList(res.data.users || res.data || []))
      .catch(() => {})
  }, [])

  // Fetch Report Data based on all filters
  const fetchReport = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      params.append('period', period)
      if (selectedProjectId && selectedProjectId !== 'all') {
        params.append('project_id', selectedProjectId)
      }
      if (selectedStatus && selectedStatus !== 'all') {
        params.append('status', selectedStatus)
      }
      if (selectedPersonnelId && selectedPersonnelId !== 'all') {
        params.append('personnel_id', selectedPersonnelId)
      }
      if (period === 'custom') {
        if (startDate) params.append('start_date', startDate)
        if (endDate) params.append('end_date', endDate)
      }

      const res = await api.get(`/reports?${params.toString()}`)
      setReportData(res.data)
      setCurrentPage(1)
    } catch {
      setError('Gagal memuat data laporan dari server. Pastikan API berjalan normal.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [period, selectedProjectId, selectedStatus, selectedPersonnelId])

  const handleApplyCustomDates = (e) => {
    e.preventDefault()
    if (period === 'custom') {
      fetchReport()
    }
  }

  // Export CSV with full executive breakdown
  const handleExportCSV = () => {
    if (!reportData) return
    try {
      setExporting(true)
      let csv = `=== LAPORAN BISNIS & ANALITIK PT POTENSI KARYA MANDIRI ===\r\n`
      csv += `Periode: ${reportData.period_label}\r\n`
      csv += `Tanggal Dibuat: ${reportData.generated_at}\r\n\r\n`

      csv += `--- RINGKASAN KPI PROYEK & TUGAS ---\r\n`
      csv += `Total Proyek,Proyek Aktif,Proyek Selesai,Proyek Berisiko,Proyek Delayed,Rata-rata Progres (%),Total Tugas,Tugas Selesai,Dalam Proses,Pending,Tugas Overdue,Tingkat Penyelesaian (%)\r\n`
      const k = reportData.kpi
      csv += `"${k.total_projects}","${k.active_projects}","${k.completed_projects}","${k.at_risk_projects}","${k.delayed_projects}","${k.avg_progress}%","${k.total_tasks}","${k.completed_tasks}","${k.in_progress_tasks || 0}","${k.pending_tasks}","${k.overdue_tasks}","${k.task_completion_rate}%"\r\n\r\n`

      csv += `--- RINGKASAN SPRINT / MILESTONE ---\r\n`
      csv += `Total Sprint,Sprint Selesai,Sprint Berjalan,Rata-rata Progres Sprint (%)\r\n`
      csv += `"${k.total_sprints || 0}","${k.completed_sprints || 0}","${k.in_progress_sprints || 0}","${k.avg_sprint_progress || 0}%"\r\n\r\n`

      csv += `--- DETAIL PROYEK DALAM PERIODE ---\r\n`
      csv += `Kode,Nama Proyek,Klien,Kategori,Status,Tingkat Risiko,Faktor Risiko,Progres (%),Target (%),Deadline,PIC,Total Tugas,Selesai,Pending,Overdue\r\n`
      reportData.projects.forEach(p => {
        csv += `"${p.code}","${p.name}","${p.client}","${p.category}","${p.status}","${p.risk_level}","${p.risk_factor || '-'}","${p.progress}","${p.target_progress}","${p.deadline || '-'}","${p.pic_name || '-'}","${p.total_tasks}","${p.completed_tasks}","${p.pending_tasks}","${p.overdue_tasks}"\r\n`
      })
      csv += `\r\n`

      if (reportData.sprints && reportData.sprints.length > 0) {
        csv += `--- DETAIL SPRINT TRACKER ---\r\n`
        csv += `ID,Judul Sprint,Proyek Induk,Kode Proyek,Status,Progres (%),Tugas Selesai,Total Tugas,Jatuh Tempo\r\n`
        reportData.sprints.forEach(s => {
          csv += `"${s.id}","${s.title}","${s.project_name}","${s.project_code}","${s.status}","${s.progress}%","${s.completed_tasks}","${s.total_tasks}","${s.due_date || '-'}"\r\n`
        })
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Laporan_PKM_${reportData.period}_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch {
      alert('Gagal mengekspor CSV.')
    } finally {
      setExporting(false)
    }
  }

  // Print Report
  const handlePrint = () => {
    window.print()
  }

  // Navigate to AI Analyst with current report context
  const handleExplainWithAI = () => {
    if (!reportData) return
    const k = reportData.kpi
    const prompt = `Tolong berikan analisis eksekutif mendalam mengenai laporan periode ${reportData.period_label}. Terdapat ${k.total_projects} proyek dengan rata-rata progres ${k.avg_progress}%, ${k.at_risk_projects + k.delayed_projects} proyek bermasalah, ${k.overdue_tasks} tugas overdue, dan ${k.total_sprints || 0} sprint dengan progres ${k.avg_sprint_progress || 0}%. Apa rekomendasi prioritas untuk pimpinan?`

    navigate('/ai-analyst', {
      state: {
        initialPrompt: prompt,
        fromReports: true
      }
    })
  }

  const hasActiveFilters = Boolean(
    period !== 'this_month' ||
    selectedProjectId !== 'all' ||
    selectedStatus !== 'all' ||
    selectedPersonnelId !== 'all' ||
    startDate ||
    endDate
  )

  const handleResetFilters = () => {
    setPeriod('this_month')
    setSelectedProjectId('all')
    setSelectedStatus('all')
    setSelectedPersonnelId('all')
    setStartDate('')
    setEndDate('')
  }

  // Filtered & Paginated Table Rows
  const projects = reportData?.projects || []
  const filteredProjects = projects.filter(p => {
    const q = searchTable.toLowerCase()
    return (
      p.name?.toLowerCase().includes(q) ||
      p.code?.toLowerCase().includes(q) ||
      p.client?.toLowerCase().includes(q) ||
      p.status?.toLowerCase().includes(q)
    )
  })
  const totalPages = Math.ceil(filteredProjects.length / pageSize) || 1
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const sprints = reportData?.sprints || []

  if (loading && !reportData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[45vh] gap-3">
        <Loader2 size={36} className="animate-spin text-[#FF2F92]" />
        <p className="font-display text-lg uppercase tracking-wider text-[#171717]">
          MENYUSUN LAPORAN BISNIS DARI DATABASE...
        </p>
      </div>
    )
  }

  if (error && !reportData) {
    return (
      <div className="p-6 bg-[#FFD83D] border-2 border-[#171717] rounded-xl shadow-[4px_4px_0px_#171717] max-w-md my-8">
        <h2 className="font-display text-xl uppercase mb-2">Gagal Memuat Laporan</h2>
        <p className="text-xs font-semibold mb-4">{error}</p>
        <button
          onClick={fetchReport}
          className="px-4 py-2 bg-[#171717] text-white font-bold text-xs uppercase flex items-center gap-2 rounded-lg cursor-pointer min-h-[36px]"
        >
          <RotateCcw size={14} /> Coba Lagi
        </button>
      </div>
    )
  }

  const kpi = reportData?.kpi || {}
  const insights = reportData?.insights || {}
  const trendData = reportData?.trend_data || []
  const statusDist = reportData?.status_distribution || []
  const workloadData = reportData?.workload_data || []

  return (
    <div className="space-y-4 sm:space-y-5 pb-10 print:p-0 print:space-y-4">
      {/* Header with Print & Export Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b-2 border-[#171717] pb-3.5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 bg-[#FF2F92] text-white text-[10px] font-black uppercase rounded-sm shadow-[1px_1px_0px_#171717]">
              REPORTS 2.0
            </span>
            <span className="text-[11px] font-bold text-[#171717]/60">
              Pembaruan: {reportData?.generated_at}
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl text-[#171717] uppercase tracking-tight mt-1">
            LAPORAN & ANALISIS BISNIS
          </h1>
          <p className="text-xs text-[#171717]/70 font-semibold mt-0.5">
            Pusat analitik eksekutif PT Potensi Karya Mandiri berbasis data real-time database MySQL.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            onClick={handleExplainWithAI}
            className="px-3.5 py-2 bg-[#B8A0F0] hover:bg-[#A68AE6] text-[#171717] border border-[#171717] rounded-lg text-xs font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_#171717] transition cursor-pointer min-h-[36px]"
            title="Analisis temuan laporan dengan AI Assistant"
          >
            <Sparkles size={14} className="text-[#171717]" />
            <span>Jelaskan dengan AI</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-white hover:bg-[#FAF7F2] text-[#171717] border border-[#171717] rounded-lg text-xs font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_#171717] transition cursor-pointer min-h-[36px]"
            title="Cetak Laporan ke PDF / Kertas"
          >
            <Printer size={14} />
            <span>Cetak</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="px-3.5 py-2 bg-[#FF2F92] hover:bg-[#E0267D] text-white border border-[#171717] rounded-lg text-xs font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_#171717] transition cursor-pointer disabled:opacity-50 min-h-[36px]"
            title="Ekspor seluruh metrik laporan ke file CSV"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white border-2 border-[#171717] rounded-xl p-3.5 sm:p-4 shadow-[3px_3px_0px_#171717] space-y-3 print:hidden">
        {/* Top: Period Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
            <span className="text-[10.5px] font-black uppercase text-[#171717]/60 flex items-center gap-1 mr-1 shrink-0">
              <Filter size={12} /> Periode:
            </span>
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition border cursor-pointer shrink-0 min-h-[36px] ${
                  period === opt.value
                    ? 'bg-[#171717] text-white border-[#171717] shadow-[2px_2px_0px_#FF2F92]'
                    : 'bg-[#FAF7F2] text-[#171717] border-[#171717]/30 hover:bg-[#FFD83D]/30'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Reset button if any filter is active */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="px-2.5 py-1.5 bg-[#FF2F92]/10 text-[#FF2F92] border border-[#FF2F92] rounded-md text-xs font-bold uppercase hover:bg-[#FF2F92] hover:text-white transition-colors cursor-pointer min-h-[36px] flex items-center gap-1 self-start sm:self-auto shrink-0"
              title="Reset seluruh filter ke default"
            >
              <RotateCcw size={12} />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        {/* Custom Date Form */}
        {period === 'custom' && (
          <form onSubmit={handleApplyCustomDates} className="flex flex-wrap items-center gap-2 p-2.5 bg-[#FAF7F2] border border-[#171717]/20 rounded-lg">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-[#171717]/60">Dari:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-[#171717] rounded-md text-xs font-bold min-h-[36px]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-[#171717]/60">Sampai:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-[#171717] rounded-md text-xs font-bold min-h-[36px]"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-[#171717] text-white rounded-md text-xs font-black uppercase cursor-pointer min-h-[36px]"
            >
              Terapkan Tanggal
            </button>
          </form>
        )}

        {/* Bottom: Proyek, Status, & Personel Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#171717]/10">
          {/* Project Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-[#171717]/60 shrink-0">Proyek:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#FAF7F2] border border-[#171717] rounded-md text-xs font-bold focus:outline-none truncate min-h-[36px] cursor-pointer"
            >
              <option value="all">Semua Proyek Portofolio</option>
              {projectList.map(p => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-[#171717]/60 shrink-0">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#FAF7F2] border border-[#171717] rounded-md text-xs font-bold focus:outline-none min-h-[36px] cursor-pointer"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Personnel Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-[#171717]/60 shrink-0">Personel:</span>
            <select
              value={selectedPersonnelId}
              onChange={(e) => setSelectedPersonnelId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#FAF7F2] border border-[#171717] rounded-md text-xs font-bold focus:outline-none truncate min-h-[36px] cursor-pointer"
            >
              <option value="all">Semua Personel</option>
              {personnelList.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Active Period & Filter Summary Banner */}
      <div className="px-3.5 sm:px-4 py-2.5 bg-[#FAF7F2] border border-[#171717] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between text-xs font-bold text-[#171717] gap-1.5 shadow-[2px_2px_0px_#171717] print:border-neutral-400 print:shadow-none">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar size={14} className="text-[#FF2F92] shrink-0" />
          <span>Laporan Berjalan: <strong className="text-[#FF2F92]">{reportData?.period_label}</strong></span>
          {(selectedStatus !== 'all' || selectedProjectId !== 'all' || selectedPersonnelId !== 'all') && (
            <span className="px-1.5 py-0.5 bg-[#FFD83D] border border-[#171717] rounded text-[9.5px] uppercase font-black">
              Filter Khusus Aktif
            </span>
          )}
        </div>
        <span className="text-[#171717]/60 text-[11px]">Dihitung otomatis real-time dari database MySQL</span>
      </div>

      {/* Primary KPI Cards Grid (4 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
        {/* Active Projects */}
        <div className="p-3.5 bg-[#FF2F92] text-white border-2 border-[#171717] rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between h-full print:shadow-none">
          <div>
            <p className="text-[9.5px] font-black uppercase tracking-wider text-white/80">Proyek Aktif</p>
            <p className="font-display text-3xl leading-none mt-1">{kpi.active_projects ?? 0}</p>
          </div>
          <p className="text-[10px] font-bold text-white/90 mt-2 truncate">Dari total {kpi.total_projects ?? 0} proyek</p>
        </div>

        {/* Completed Projects */}
        <div className="p-3.5 bg-[#FFD83D] text-[#171717] border-2 border-[#171717] rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between h-full print:shadow-none">
          <div>
            <p className="text-[9.5px] font-black uppercase tracking-wider text-[#171717]/80">Proyek Selesai</p>
            <p className="font-display text-3xl leading-none mt-1">{kpi.completed_projects ?? 0}</p>
          </div>
          <p className="text-[10px] font-bold text-[#171717]/80 mt-2">Tuntas 100%</p>
        </div>

        {/* Troubled / At Risk Projects */}
        <div className="p-3.5 bg-[#B8A0F0] text-[#171717] border-2 border-[#171717] rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between h-full print:shadow-none">
          <div>
            <p className="text-[9.5px] font-black uppercase tracking-wider text-[#171717]/80">Berisiko / Terlambat</p>
            <p className="font-display text-3xl leading-none mt-1">{(kpi.at_risk_projects ?? 0) + (kpi.delayed_projects ?? 0)}</p>
          </div>
          <p className="text-[10px] font-bold text-[#171717]/80 mt-2 truncate">
            {kpi.at_risk_projects ?? 0} At Risk · {kpi.delayed_projects ?? 0} Delayed
          </p>
        </div>

        {/* Task Completion & Overdue */}
        <div className="p-3.5 bg-white text-[#171717] border-2 border-[#171717] rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between h-full print:shadow-none">
          <div>
            <p className="text-[9.5px] font-black uppercase tracking-wider text-[#171717]/60">Rata-rata Progres</p>
            <p className="font-display text-3xl leading-none mt-1 text-[#FF2F92]">{kpi.avg_progress ?? 0}%</p>
          </div>
          <p className="text-[10px] font-bold text-[#EF4444] mt-2 truncate">
            {kpi.overdue_tasks ?? 0} tugas terlewati deadline
          </p>
        </div>
      </div>

      {/* Secondary KPI Row: Task & Sprint Performance */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
        {/* Task Performance Overview */}
        <div className="p-3 bg-white border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] space-y-1 flex flex-col justify-between print:shadow-none">
          <div>
            <p className="text-[9px] font-black uppercase text-[#171717]/60">Penyelesaian Tugas</p>
            <p className="font-display text-2xl text-[#10B981]">{kpi.task_completion_rate ?? 0}%</p>
          </div>
          <p className="text-[10px] font-bold text-[#171717]/70 truncate">
            {kpi.completed_tasks ?? 0} dari {kpi.total_tasks ?? 0} tuntas
          </p>
        </div>

        {/* Tasks in Progress & Pending */}
        <div className="p-3 bg-white border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] space-y-1 flex flex-col justify-between print:shadow-none">
          <div>
            <p className="text-[9px] font-black uppercase text-[#171717]/60">Tugas Berjalan / Pending</p>
            <p className="font-display text-2xl text-[#171717]">{(kpi.in_progress_tasks ?? 0) + (kpi.pending_tasks ?? 0)}</p>
          </div>
          <p className="text-[10px] font-bold text-[#171717]/70 truncate">
            {kpi.in_progress_tasks ?? 0} Berjalan · {kpi.pending_tasks ?? 0} Pending
          </p>
        </div>

        {/* Sprint Performance */}
        <div className="p-3 bg-white border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] space-y-1 flex flex-col justify-between print:shadow-none">
          <div>
            <p className="text-[9px] font-black uppercase text-[#171717]/60">Sprint Tracker</p>
            <p className="font-display text-2xl text-[#2563EB]">{kpi.total_sprints ?? 0}</p>
          </div>
          <p className="text-[10px] font-bold text-[#171717]/70 truncate">
            {kpi.completed_sprints ?? 0} Selesai · {kpi.in_progress_sprints ?? 0} Berjalan
          </p>
        </div>

        {/* Active Personnel */}
        <div className="p-3 bg-white border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] space-y-1 flex flex-col justify-between print:shadow-none">
          <div>
            <p className="text-[9px] font-black uppercase text-[#171717]/60">Personel Tim Aktif</p>
            <p className="font-display text-2xl text-[#171717]">{kpi.active_personnel_count ?? 0}</p>
          </div>
          <p className="text-[10px] font-bold text-[#171717]/70 truncate">
            Rata-rata progres sprint {kpi.avg_sprint_progress ?? 0}%
          </p>
        </div>
      </div>

      {/* Narrative Business Insights Section */}
      <div className="bg-[#FAF7F2] border-2 border-[#171717] rounded-xl p-4 sm:p-5 shadow-[4px_4px_0px_#171717] space-y-4 print:shadow-none print:break-inside-avoid">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#171717]/20 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#FF2F92] shrink-0" />
            <h2 className="font-display text-base uppercase text-[#171717]">
              Analisis Insight & Keterangan Laporan Bisnis
            </h2>
          </div>
          <span className="text-[10.5px] font-bold px-2 py-0.5 bg-[#FFD83D] border border-[#171717] rounded shadow-[1px_1px_0px_#171717] self-start sm:self-auto">
            Interpretasi Manajemen Eksekutif
          </span>
        </div>

        {/* Summary sentence */}
        <div className="p-3.5 bg-white border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] print:shadow-none">
          <p className="text-[10px] font-black uppercase text-[#FF2F92] mb-1">Ringkasan Kondisi Eksekutif:</p>
          <p className="text-xs sm:text-sm font-bold text-[#171717] leading-relaxed">
            {insights.summary || 'Ringkasan laporan performa portofolio tersedia berdasarkan data terkini.'}
          </p>
        </div>

        {/* 4 Cards Grid: Findings, Causes, Impacts, Recommendations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Factual Findings */}
          <div className="p-3.5 bg-white border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] space-y-2 print:shadow-none">
            <h3 className="text-xs font-black uppercase text-[#171717] flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-[#10B981] shrink-0" />
              <span>1. Fakta Berdasarkan Database</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-[#171717]/85 font-medium">
              {insights.findings?.length > 0 ? (
                insights.findings.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-[#FF2F92] font-black shrink-0">•</span>
                    <span>{f}</span>
                  </li>
                ))
              ) : (
                <li className="text-[11px] text-[#171717]/60 italic">Tidak ada anomali signifikan tercatat.</li>
              )}
            </ul>
          </div>

          {/* Causes */}
          <div className="p-3.5 bg-white border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] space-y-2 print:shadow-none">
            <h3 className="text-xs font-black uppercase text-[#171717] flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-[#F59E0B] shrink-0" />
              <span>2. Faktor Penyebab Deviasi</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-[#171717]/85 font-medium">
              {insights.causes?.length > 0 ? (
                insights.causes.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-[#F59E0B] font-black shrink-0">•</span>
                    <span>{c}</span>
                  </li>
                ))
              ) : (
                <li className="text-[11px] text-[#171717]/60 italic">Proyek berjalan sesuai dengan linimasa rencana.</li>
              )}
            </ul>
          </div>

          {/* Impacts */}
          <div className="p-3.5 bg-white border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] space-y-2 print:shadow-none">
            <h3 className="text-xs font-black uppercase text-[#171717] flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-[#EF4444] shrink-0" />
              <span>3. Potensi Dampak Bisnis</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-[#171717]/85 font-medium">
              {insights.impacts?.length > 0 ? (
                insights.impacts.map((imp, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-[#EF4444] font-black shrink-0">•</span>
                    <span>{imp}</span>
                  </li>
                ))
              ) : (
                <li className="text-[11px] text-[#171717]/60 italic">Dampak terhadap SLA bisnis dalam batas aman.</li>
              )}
            </ul>
          </div>

          {/* Recommendations */}
          <div className="p-3.5 bg-white border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] space-y-2 print:shadow-none">
            <h3 className="text-xs font-black uppercase text-[#171717] flex items-center gap-1.5">
              <CheckSquare size={14} className="text-[#3B82F6] shrink-0" />
              <span>4. Rekomendasi Tindakan Strategis</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-[#171717]/85 font-medium">
              {insights.recommendations?.length > 0 ? (
                insights.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-[#3B82F6] font-black shrink-0">✓</span>
                    <span>{r}</span>
                  </li>
                ))
              ) : (
                <li className="text-[11px] text-[#171717]/60 italic">Pertahankan ritme monitoring mingguan berkala.</li>
              )}
            </ul>
          </div>
        </div>

        {insights.limitations && (
          <p className="text-[10.5px] text-[#171717]/60 italic pt-1 border-t border-[#171717]/10">
            * {insights.limitations}
          </p>
        )}
      </div>

      {/* Visual Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 print:break-inside-avoid">
        {/* Trend Area Chart (7 cols) */}
        <div className="lg:col-span-7 bg-white border-2 border-[#171717] rounded-xl p-4 shadow-[3px_3px_0px_#171717] print:shadow-none">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-display text-sm uppercase text-[#171717]">Tren Progres Proyek vs Target</h3>
              <p className="text-[10px] text-[#171717]/60 font-semibold">Lintasan progres rata-rata portofolio dalam rentang periode</p>
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 bg-[#FAF7F2] border border-[#171717] rounded">
              Recharts
            </span>
          </div>

          <div className="h-56 w-full mt-3">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF2F92" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#FF2F92" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#171717' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#171717' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#171717',
                      borderColor: '#171717',
                      borderRadius: '6px',
                      color: '#FFF',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}
                  />
                  <Area type="monotone" dataKey="progress" stroke="#FF2F92" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProgress)" name="Progres (%)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#171717]/50 font-bold bg-[#FAF7F2] rounded-lg border border-dashed border-[#171717]/20">
                Tidak ada data tren untuk periode ini
              </div>
            )}
          </div>
        </div>

        {/* Status Distribution (5 cols) */}
        <div className="lg:col-span-5 bg-white border-2 border-[#171717] rounded-xl p-4 shadow-[3px_3px_0px_#171717] flex flex-col justify-between print:shadow-none">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-display text-sm uppercase text-[#171717]">Distribusi Status Portofolio</h3>
                <p className="text-[10px] text-[#171717]/60 font-semibold">Komposisi kesehatan proyek dalam periode</p>
              </div>
              <PieIcon size={16} className="text-[#FF2F92]" />
            </div>

            <div className="h-44 w-full">
              {statusDist.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDist}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={65}
                      innerRadius={35}
                      paddingAngle={3}
                    >
                      {statusDist.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#171717',
                        borderColor: '#171717',
                        borderRadius: '6px',
                        color: '#FFF',
                        fontSize: '11px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-[#171717]/50 font-bold bg-[#FAF7F2] rounded-lg border border-dashed border-[#171717]/20">
                  Tidak ada data status untuk periode ini
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-[#171717]/10 text-[10.5px] font-bold">
            {statusDist.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-[#171717]/70 truncate">{item.name}:</span>
                <span className="font-black text-[#171717]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team Workload Chart (Includes Selesai, Pending, & Overdue) */}
      {workloadData.length > 0 && (
        <div className="bg-white border-2 border-[#171717] rounded-xl p-4 shadow-[3px_3px_0px_#171717] print:shadow-none print:break-inside-avoid">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-display text-sm uppercase text-[#171717]">Beban Kerja Tim Berdasarkan Tugas</h3>
              <p className="text-[10px] text-[#171717]/60 font-semibold">
                Perbandingan jumlah tugas selesai, pending, dan overdue per penanggung jawab
              </p>
            </div>
            <Users size={16} className="text-[#FF2F92]" />
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#171717' }} />
                <YAxis tick={{ fontSize: 10, fill: '#171717' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#171717',
                    borderRadius: '6px',
                    color: '#FFF',
                    fontSize: '11px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                <Bar dataKey="completed" name="Tugas Selesai" fill="#10B981" />
                <Bar dataKey="pending" name="Tugas Pending" fill="#F59E0B" />
                <Bar dataKey="overdue" name="Tugas Overdue" fill="#EF4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Detailed Data Tables (Tabbed: Proyek vs Sprint) */}
      <div className="bg-white border-2 border-[#171717] rounded-xl p-4 shadow-[4px_4px_0px_#171717] space-y-3 print:shadow-none print:break-inside-avoid">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#171717]/15 pb-3">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTableTab('projects')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition border cursor-pointer min-h-[36px] ${
                activeTableTab === 'projects'
                  ? 'bg-[#171717] text-white border-[#171717] shadow-[2px_2px_0px_#FF2F92]'
                  : 'bg-[#FAF7F2] text-[#171717] border-[#171717]/30 hover:bg-[#FFD83D]/30'
              }`}
            >
              Rincian Proyek ({filteredProjects.length})
            </button>
            <button
              onClick={() => setActiveTableTab('sprints')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition border cursor-pointer min-h-[36px] ${
                activeTableTab === 'sprints'
                  ? 'bg-[#171717] text-white border-[#171717] shadow-[2px_2px_0px_#FF2F92]'
                  : 'bg-[#FAF7F2] text-[#171717] border-[#171717]/30 hover:bg-[#FFD83D]/30'
              }`}
            >
              Kinerja Sprint ({sprints.length})
            </button>
          </div>

          {activeTableTab === 'projects' && (
            <div className="relative w-full sm:w-64 print:hidden">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#171717]/40" />
              <input
                type="text"
                value={searchTable}
                onChange={(e) => {
                  setSearchTable(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Cari proyek atau klien..."
                className="w-full pl-8 pr-8 py-1.5 bg-[#FAF7F2] border border-[#171717] rounded-lg text-xs font-semibold focus:outline-none min-h-[36px]"
              />
              {searchTable && (
                <button
                  onClick={() => {
                    setSearchTable('')
                    setCurrentPage(1)
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#171717]/50 hover:text-[#FF2F92] cursor-pointer p-0.5"
                  title="Hapus pencarian tabel"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tab 1: Projects Table & Cards */}
        {activeTableTab === 'projects' && (
          <div>
            {/* Mobile View: Project Cards (< 768px) */}
            <div className="block md:hidden divide-y divide-[#171717]/10">
              {paginatedProjects.length > 0 ? (
                paginatedProjects.map((p) => (
                  <div key={p.id} className="py-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[9.5px] font-mono font-bold text-[#171717]/60 uppercase">
                          {p.code} · Klien: {p.client}
                        </span>
                        <h4 className="font-bold text-xs text-[#171717] truncate leading-tight mt-0.5">
                          {p.name}
                        </h4>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase shrink-0 border border-[#171717]/20 ${
                        p.status === 'completed'
                          ? 'bg-[#10B981]/20 text-[#10B981]'
                          : p.status === 'delayed'
                            ? 'bg-[#EF4444]/20 text-[#EF4444]'
                            : p.status === 'at_risk'
                              ? 'bg-[#F59E0B]/20 text-[#D97706]'
                              : 'bg-[#3B82F6]/20 text-[#2563EB]'
                      }`}>
                        {p.status?.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Progress Bar & Details */}
                    <div>
                      <div className="flex justify-between text-[10px] font-black mb-1">
                        <span className="text-[#171717]/60">PIC: <strong>{p.pic_name || '—'}</strong></span>
                        <span className="text-[#FF2F92]">{p.progress}%</span>
                      </div>
                      <div className="w-full bg-[#FAF7F2] border border-[#171717]/20 rounded-full h-2 overflow-hidden">
                        <div className="bg-[#FF2F92] h-full transition-all" style={{ width: `${p.progress}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-semibold text-[#171717]/70 pt-1">
                      <span>Tugas: <strong>{p.completed_tasks} / {p.total_tasks}</strong></span>
                      <span>
                        {p.overdue_tasks > 0 ? (
                          <strong className="text-[#EF4444]">{p.overdue_tasks} Overdue</strong>
                        ) : (
                          <span className="text-[#10B981]">0 Overdue</span>
                        )}
                      </span>
                      <span>Deadline: <strong>{p.deadline || '—'}</strong></span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-[#171717]/60 font-bold">
                  Tidak ada proyek yang sesuai dengan kriteria filter.
                </div>
              )}
            </div>

            {/* Desktop / Tablet View: Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#171717] bg-[#FAF7F2] font-black uppercase text-[10px] text-[#171717]">
                    <th className="py-2.5 px-3">Kode</th>
                    <th className="py-2.5 px-3">Nama Proyek</th>
                    <th className="py-2.5 px-3">Klien</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-center">Progres</th>
                    <th className="py-2.5 px-3">PIC</th>
                    <th className="py-2.5 px-3">Tugas Selesai / Total</th>
                    <th className="py-2.5 px-3">Overdue</th>
                    <th className="py-2.5 px-3">Deadline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171717]/15 font-medium">
                  {paginatedProjects.length > 0 ? (
                    paginatedProjects.map((p) => (
                      <tr key={p.id} className="hover:bg-[#FAF7F2]/80 transition">
                        <td className="py-2.5 px-3 font-bold font-mono text-[11px]">{p.code}</td>
                        <td className="py-2.5 px-3 font-bold text-[#171717]">{p.name}</td>
                        <td className="py-2.5 px-3 text-[#171717]/80">{p.client}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase ${
                            p.status === 'completed'
                              ? 'bg-[#10B981]/20 text-[#10B981]'
                              : p.status === 'delayed'
                                ? 'bg-[#EF4444]/20 text-[#EF4444]'
                                : p.status === 'at_risk'
                                  ? 'bg-[#F59E0B]/20 text-[#D97706]'
                                  : 'bg-[#3B82F6]/20 text-[#2563EB]'
                          }`}>
                            {p.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-bold text-[#FF2F92]">{p.progress}%</span>
                        </td>
                        <td className="py-2.5 px-3 text-[#171717]/80 font-semibold">{p.pic_name}</td>
                        <td className="py-2.5 px-3 font-mono">
                          {p.completed_tasks} / {p.total_tasks}
                        </td>
                        <td className="py-2.5 px-3">
                          {p.overdue_tasks > 0 ? (
                            <span className="text-[#EF4444] font-black">{p.overdue_tasks} overdue</span>
                          ) : (
                            <span className="text-[#10B981] font-bold">Nihil</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[#171717]/70 font-mono text-[11px]">
                          {p.deadline || '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-xs text-[#171717]/60 font-bold">
                        Tidak ada proyek yang sesuai dengan kriteria filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-[#171717]/15 print:hidden">
                <span className="text-xs font-semibold text-[#171717]/70">
                  Halaman {currentPage} dari {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 bg-[#FAF7F2] border border-[#171717] rounded-md disabled:opacity-40 cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                    title="Halaman Sebelumnya"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 bg-[#FAF7F2] border border-[#171717] rounded-md disabled:opacity-40 cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                    title="Halaman Selanjutnya"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Sprints Table & Cards */}
        {activeTableTab === 'sprints' && (
          <div>
            {/* Mobile View: Sprint Cards (< 768px) */}
            <div className="block md:hidden divide-y divide-[#171717]/10">
              {sprints.length > 0 ? (
                sprints.map((s) => (
                  <div key={s.id} className="py-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[9.5px] font-bold text-[#171717]/60 uppercase">
                          Proyek: {s.project_name} ({s.project_code})
                        </span>
                        <h4 className="font-bold text-xs text-[#171717] truncate leading-tight flex items-center gap-1 mt-0.5">
                          <Flag size={12} className="text-[#FF2F92] shrink-0" />
                          <span>{s.title}</span>
                        </h4>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase shrink-0 border border-[#171717]/20 ${
                        s.status === 'completed'
                          ? 'bg-[#10B981]/20 text-[#10B981]'
                          : s.status === 'in_progress'
                            ? 'bg-[#3B82F6]/20 text-[#2563EB]'
                            : 'bg-neutral-100 text-[#171717]/70'
                      }`}>
                        {s.status?.replace('_', ' ')}
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] font-black mb-1">
                        <span className="text-[#171717]/60">Tugas: <strong>{s.completed_tasks} / {s.total_tasks}</strong></span>
                        <span className="text-[#FF2F92]">{s.progress}%</span>
                      </div>
                      <div className="w-full bg-[#FAF7F2] border border-[#171717]/20 rounded-full h-2 overflow-hidden">
                        <div className="bg-[#FF2F92] h-full transition-all" style={{ width: `${s.progress}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-semibold text-[#171717]/70 pt-1">
                      <span>Mulai: <strong>{s.start_date || '—'}</strong></span>
                      <span>Jatuh Tempo: <strong>{s.due_date || '—'}</strong></span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-[#171717]/60 font-bold">
                  Tidak ada sprint yang terhubung dengan filter saat ini.
                </div>
              )}
            </div>

            {/* Desktop / Tablet View: Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#171717] bg-[#FAF7F2] font-black uppercase text-[10px] text-[#171717]">
                    <th className="py-2.5 px-3">Judul Sprint</th>
                    <th className="py-2.5 px-3">Proyek Induk</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-center">Progres Aktual</th>
                    <th className="py-2.5 px-3">Tugas Selesai / Total</th>
                    <th className="py-2.5 px-3">Tanggal Mulai</th>
                    <th className="py-2.5 px-3">Jatuh Tempo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171717]/15 font-medium">
                  {sprints.length > 0 ? (
                    sprints.map((s) => (
                      <tr key={s.id} className="hover:bg-[#FAF7F2]/80 transition">
                        <td className="py-2.5 px-3 font-bold text-[#171717] flex items-center gap-1.5">
                          <Flag size={13} className="text-[#FF2F92]" />
                          <span>{s.title}</span>
                        </td>
                        <td className="py-2.5 px-3 text-[#171717]/80">
                          <span className="font-bold text-[#171717]">{s.project_name}</span>
                          <span className="text-[10px] text-[#171717]/50 ml-1">({s.project_code})</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase ${
                            s.status === 'completed'
                              ? 'bg-[#10B981]/20 text-[#10B981]'
                              : s.status === 'in_progress'
                                ? 'bg-[#3B82F6]/20 text-[#2563EB]'
                                : 'bg-neutral-100 text-[#171717]/70'
                          }`}>
                            {s.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-[#FAF7F2] border border-[#171717] rounded-full h-2 overflow-hidden">
                              <div className="bg-[#FF2F92] h-full" style={{ width: `${s.progress}%` }} />
                            </div>
                            <span className="font-bold text-[#FF2F92]">{s.progress}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {s.completed_tasks} / {s.total_tasks} tugas
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#171717]/70">
                          {s.start_date || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#171717]/70">
                          {s.due_date || '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-xs text-[#171717]/60 font-bold">
                        Tidak ada sprint yang terhubung dengan filter saat ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
