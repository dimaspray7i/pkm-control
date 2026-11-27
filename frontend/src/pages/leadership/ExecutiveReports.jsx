import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import {
  FileBarChart, CheckCircle2, Clock, AlertTriangle, Search, Filter,
  RotateCcw, Loader2, Eye, Printer, X, TrendingUp, AlertCircle,
  Briefcase, Lock, ChevronRight, Plus, Calendar, ShieldAlert,
  ArrowRight, Users, CheckSquare, Sparkles, Building2, Download,
  ExternalLink, FileText, Check, ListChecks, HelpCircle
} from 'lucide-react'
import PageLoading from '../../components/ui/PageLoading'
import PageHeader from '../../components/ui/PageHeader'

const formatDateIndo = (d) => {
  if (!d) return 'â€”'
  const s = String(d).includes('T') ? String(d).split('T')[0] : String(d)
  const parts = s.split('-')
  if (parts.length < 3) return s
  return new Date(+parts[0], +parts[1] - 1, +parts[2]).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const REPORT_TYPE_LABELS = {
  daily: 'Harian',
  weekly: 'Mingguan',
  monthly: 'Bulanan',
  quarterly: 'Kuartalan',
  custom: 'Kustom',
}

const STATUS_BADGES = {
  draft: {
    label: 'DRAFT',
    bg: 'bg-[#FFF8E1]',
    text: 'text-[#B45309]',
    border: 'border-[#F59E0B]',
  },
  published: {
    label: 'RESMI / PUBLISHED',
    bg: 'bg-[#ECFDF5]',
    text: 'text-[#065F46]',
    border: 'border-[#10B981]',
  },
}

const DECISION_STATUS_BADGES = {
  draft: { label: 'Draf', bg: 'bg-gray-100 text-gray-700 border-gray-300' },
  approved: { label: 'Disetujui', bg: 'bg-blue-100 text-blue-700 border-blue-300' },
  in_progress: { label: 'Sedang Berjalan', bg: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  completed: { label: 'Selesai', bg: 'bg-green-100 text-green-700 border-green-300' },
  cancelled: { label: 'Dibatalkan', bg: 'bg-red-100 text-red-700 border-red-300' },
}

export default function ExecutiveReports() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('reports') // 'reports' | 'decisions'

  // Reports state
  const [reports, setReports] = useState([])
  const [reportsSummary, setReportsSummary] = useState(null)
  const [reportsLoading, setReportsLoading] = useState(true)
  const [reportsError, setReportsError] = useState(null)

  // Report filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [searchReport, setSearchReport] = useState('')

  // Decisions follow-up state
  const [decisions, setDecisions] = useState([])
  const [decisionSummary, setDecisionSummary] = useState(null)
  const [decisionsLoading, setDecisionsLoading] = useState(true)
  const [decisionsError, setDecisionsError] = useState(null)

  // Decision filters
  const [decisionStatusFilter, setDecisionStatusFilter] = useState('all')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [searchDecision, setSearchDecision] = useState('')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedReport, setSelectedReport] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [publishLoading, setPublishLoading] = useState(false)

  // Create Form State
  const [createForm, setCreateForm] = useState({
    title: '',
    report_type: 'monthly',
    period_start: '',
    period_end: '',
    executive_summary: '',
    strategic_recommendations: '',
    management_attention: '',
  })
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createError, setCreateError] = useState(null)

  // AI Narrative Assist State
  const [aiGenerating, setAiGenerating] = useState(false)

  // Fetch Reports
  const fetchReports = useCallback(async () => {
    setReportsLoading(true)
    setReportsError(null)
    try {
      const params = {}
      if (statusFilter !== 'all') params.status = statusFilter
      if (typeFilter !== 'all') params.report_type = typeFilter
      if (searchReport) params.search = searchReport

      const res = await api.get('/leadership/executive-reports', { params })
      setReports(res.data.reports || [])
      setReportsSummary(res.data.summary || null)
    } catch (err) {
      setReportsError(err.response?.data?.message || 'Gagal memuat daftar laporan eksekutif.')
    } finally {
      setReportsLoading(false)
    }
  }, [statusFilter, typeFilter, searchReport])

  // Fetch Decisions
  const fetchDecisions = useCallback(async () => {
    setDecisionsLoading(true)
    setDecisionsError(null)
    try {
      const params = {}
      if (decisionStatusFilter !== 'all') params.status = decisionStatusFilter
      if (overdueOnly) params.overdue = 'true'
      if (searchDecision) params.search = searchDecision

      const res = await api.get('/leadership/decision-followup', { params })
      setDecisions(res.data.decisions || [])
      setDecisionSummary(res.data.summary || null)
    } catch (err) {
      setDecisionsError(err.response?.data?.message || 'Gagal memuat data tindak lanjut keputusan.')
    } finally {
      setDecisionsLoading(false)
    }
  }, [decisionStatusFilter, overdueOnly, searchDecision])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  useEffect(() => {
    if (activeTab === 'decisions') {
      fetchDecisions()
    }
  }, [activeTab, fetchDecisions])

  // Auto-fill dates based on report_type
  const handleTypeChange = (type) => {
    const today = new Date()
    let start = new Date()
    let end = new Date()

    if (type === 'daily') {
      start = today
      end = today
    } else if (type === 'weekly') {
      const day = today.getDay()
      const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Monday
      start = new Date(today.setDate(diff))
      end = new Date(start)
      end.setDate(start.getDate() + 6)
    } else if (type === 'monthly') {
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    } else if (type === 'quarterly') {
      const quarter = Math.floor(today.getMonth() / 3)
      start = new Date(today.getFullYear(), quarter * 3, 1)
      end = new Date(today.getFullYear(), (quarter + 1) * 3, 0)
    }

    const toYMD = (d) => d.toISOString().split('T')[0]

    setCreateForm(prev => ({
      ...prev,
      report_type: type,
      period_start: toYMD(start),
      period_end: toYMD(end),
      title: prev.title || `Laporan Eksekutif ${REPORT_TYPE_LABELS[type]} â€” ${start.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`
    }))
  }

  // Handle Create Report
  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    setCreateSubmitting(true)
    setCreateError(null)

    try {
      const res = await api.post('/leadership/executive-reports', createForm)
      setShowCreateModal(false)
      fetchReports()
      // Open created report directly
      if (res.data?.report) {
        setSelectedReport(res.data.report)
      }
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Gagal membuat laporan eksekutif.')
    } finally {
      setCreateSubmitting(false)
    }
  }

  // Handle Publish Report
  const handlePublish = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menerbitkan laporan ini secara resmi? Setelah diterbitkan, snapshot data akan terkunci permanen dan tidak dapat diubah lagi.')) {
      return
    }
    setPublishLoading(true)
    try {
      const res = await api.post(`/leadership/executive-reports/${id}/publish`)
      setSelectedReport(res.data.report)
      fetchReports()
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menerbitkan laporan.')
    } finally {
      setPublishLoading(false)
    }
  }

  // AI Assist to Draft Executive Summary
  const handleAiAssist = async () => {
    setAiGenerating(true)
    try {
      const prompt = `Sebagai Chief Business Intelligence Analyst, tolong buatkan ringkasan eksekutif dan rekomendasi strategis manajemen singkat (2 paragraf profesional) untuk laporan eksekutif periode ${createForm.period_start} s/d ${createForm.period_end} berdasarkan data riil terkini perusahaan.`
      const res = await api.post('/leadership/ai/chat', { prompt })
      if (res.data?.reply) {
        setCreateForm(prev => ({
          ...prev,
          executive_summary: prev.executive_summary ? `${prev.executive_summary}\n\n${res.data.reply}` : res.data.reply
        }))
      }
    } catch {
      alert('Gagal mendapatkan asistensi AI. Silakan tulis narasi secara manual.')
    } finally {
      setAiGenerating(false)
    }
  }

  // Open Detail
  const handleOpenDetail = async (id) => {
    setDetailLoading(true)
    try {
      const res = await api.get(`/leadership/executive-reports/${id}`)
      setSelectedReport(res.data.report)
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal memuat detail laporan.')
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="w-full bg-[#F5F1E9] p-4 md:p-8 space-y-6">

      {/* HEADER SECTION */}
      <PageHeader
        title="EXECUTIVE REPORTS & DECISIONS"
        subtitle="Pusat dokumentasi laporan berkala perusahaan, arsip snapshot historis, dan pelacakan tindak lanjut keputusan strategis."
        tag="LAPORAN EKSEKUTIF"
        badge="PT Potensi Karya Mandiri"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                handleTypeChange('monthly')
                setShowCreateModal(true)
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FFD83D] text-[#171717] font-black border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] hover:bg-[#f5cd2f] active:translate-x-[1px] active:translate-y-[1px] transition-all text-xs uppercase cursor-pointer min-h-[40px]"
            >
              <Plus size={15} /> Buat Laporan Baru
            </button>
            <button
              onClick={() => {
                if (activeTab === 'reports') fetchReports()
                else fetchDecisions()
              }}
              className="p-2.5 bg-white text-[#171717] border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] hover:bg-[#F5F1E9] transition-all cursor-pointer min-h-[40px]"
              title="Segarkan Data"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        }
      />

      {/* TAB NAVIGATION */}
      <div className="flex border-b-[3px] border-[#171717] gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-6 py-3 font-black text-sm uppercase transition-all border-t-[3px] border-x-[3px] border-[#171717] -mb-[3px] ${
            activeTab === 'reports'
              ? 'bg-white shadow-[4px_-2px_0px_#171717] text-[#171717]'
              : 'bg-[#EAE4D8] text-[#666] hover:bg-white/80'
          }`}
        >
          <FileBarChart size={18} />
          <span>Executive Reports Hub</span>
          {reportsSummary && (
            <span className="ml-1 px-2 py-0.5 text-xs bg-[#171717] text-white rounded-full">
              {reportsSummary.total_reports}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('decisions')}
          className={`flex items-center gap-2 px-6 py-3 font-black text-sm uppercase transition-all border-t-[3px] border-x-[3px] border-[#171717] -mb-[3px] ${
            activeTab === 'decisions'
              ? 'bg-white shadow-[4px_-2px_0px_#171717] text-[#171717]'
              : 'bg-[#EAE4D8] text-[#666] hover:bg-white/80'
          }`}
        >
          <ListChecks size={18} />
          <span>Decision Follow-up & Action Tracker</span>
          {decisionSummary && decisionSummary.overdue_count > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs bg-red-600 text-white rounded-full font-black animate-pulse">
              {decisionSummary.overdue_count} Overdue
            </span>
          )}
        </button>
      </div>

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* TAB 1: EXECUTIVE REPORTS HUB */}
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {activeTab === 'reports' && (
        <div className="space-y-6">

          {/* STATS OVERVIEW CARDS */}
          {reportsSummary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <div className="border-[3px] border-[#171717] bg-white shadow-[4px_4px_0px_#171717] p-4">
                <div className="text-xs font-bold uppercase text-[#666] mb-1">Total Laporan</div>
                <div className="text-3xl font-black text-[#171717]">{reportsSummary.total_reports}</div>
                <div className="text-xs text-[#555] font-semibold mt-1">Riwayat dokumentasi eksekutif</div>
              </div>

              <div className="border-[3px] border-[#171717] bg-[#ECFDF5] shadow-[4px_4px_0px_#171717] p-4">
                <div className="text-xs font-bold uppercase text-[#065F46] mb-1">Laporan Resmi (Published)</div>
                <div className="text-3xl font-black text-[#065F46]">{reportsSummary.published_reports}</div>
                <div className="text-xs text-[#065F46] font-semibold mt-1">Snapshot terkunci & arsip permanen</div>
              </div>

              <div className="border-[3px] border-[#171717] bg-[#FFF8E1] shadow-[4px_4px_0px_#171717] p-4">
                <div className="text-xs font-bold uppercase text-[#B45309] mb-1">Draft Dalam Review</div>
                <div className="text-3xl font-black text-[#B45309]">{reportsSummary.draft_reports}</div>
                <div className="text-xs text-[#B45309] font-semibold mt-1">Dapat diperbarui sebelum terbit</div>
              </div>

              <div className="border-[3px] border-[#171717] bg-[#EFF6FF] shadow-[4px_4px_0px_#171717] p-4">
                <div className="text-xs font-bold uppercase text-[#1D4ED8] mb-1">Keputusan Terkait</div>
                <div className="text-3xl font-black text-[#1D4ED8]">{reportsSummary.active_decisions}</div>
                <div className="text-xs text-red-600 font-bold mt-1">
                  {reportsSummary.overdue_decisions} keputusan melewati batas waktu
                </div>
              </div>
            </div>
          )}

          {/* FILTER BAR */}
          <div className="border-[3px] border-[#171717] bg-white shadow-[4px_4px_0px_#171717] p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-2 w-full md:w-auto flex-1">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3 top-3 text-[#888]" />
                <input
                  type="text"
                  placeholder="Cari judul, nomor laporan, atau kata kunci..."
                  value={searchReport}
                  onChange={(e) => setSearchReport(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border-[2px] border-[#171717] text-xs font-bold focus:outline-none focus:bg-[#FFFDE7]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border-[2px] border-[#171717] px-3 py-2 text-xs font-bold bg-[#F5F1E9] focus:outline-none"
              >
                <option value="all">Semua Tipe Periode</option>
                <option value="monthly">Bulanan</option>
                <option value="quarterly">Kuartalan</option>
                <option value="weekly">Mingguan</option>
                <option value="daily">Harian</option>
                <option value="custom">Kustom</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border-[2px] border-[#171717] px-3 py-2 text-xs font-bold bg-[#F5F1E9] focus:outline-none"
              >
                <option value="all">Semua Status</option>
                <option value="published">Resmi (Published)</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          {/* REPORTS LIST TABLE / CARDS */}
          {reportsLoading ? (
            <PageLoading
              mode="component"
              text="Memuat riwayat laporan eksekutif..."
              subtext="Mengambil snapshot arsip laporan dari database."
              className="border-[3px] border-[#171717] bg-white shadow-[4px_4px_0px_#171717] my-4"
            />
          ) : reportsError ? (
            <div className="border-[3px] border-[#171717] bg-red-50 p-6 text-center text-red-700 font-bold">
              {reportsError}
            </div>
          ) : reports.length === 0 ? (
            <div className="border-[3px] border-[#171717] bg-white p-12 text-center space-y-3">
              <FileBarChart size={48} className="mx-auto text-[#AAA]" />
              <div className="text-base font-black uppercase text-[#171717]">Belum Ada Laporan Eksekutif</div>
              <p className="text-xs text-[#666] max-w-md mx-auto">
                Buat laporan baru untuk mengarsipkan snapshot performa bisnis, portofolio proyek, risiko, dan keputusan manajemen pada periode tertentu.
              </p>
              <button
                onClick={() => {
                  handleTypeChange('monthly')
                  setShowCreateModal(true)
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFD83D] border-[2px] border-[#171717] font-black text-xs uppercase shadow-[2px_2px_0px_#171717]"
              >
                <Plus size={14} /> Buat Laporan Pertama
              </button>
            </div>
          ) : (
            <div className="border-[3px] border-[#171717] bg-white shadow-[6px_6px_0px_#171717] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#171717] text-white uppercase text-[11px] font-black tracking-wider">
                    <tr>
                      <th className="py-3 px-4">No. Laporan</th>
                      <th className="py-3 px-4">Judul & Periode</th>
                      <th className="py-3 px-4">Tipe</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Dibuat Oleh</th>
                      <th className="py-3 px-4 text-center">Snapshot CHI</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-[2px] divide-[#171717]">
                    {reports.map((r) => {
                      const chiScore = r.snapshot_data?.company_health?.chi_score
                      const chiCategory = r.snapshot_data?.company_health?.chi_category
                      const badge = STATUS_BADGES[r.status] || STATUS_BADGES.draft

                      return (
                        <tr key={r.id} className="hover:bg-[#FFFDE7] transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-[#171717]">
                            {r.report_number}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-black text-sm text-[#171717]">{r.title}</div>
                            <div className="text-[11px] text-[#666] font-semibold mt-0.5">
                              {formatDateIndo(r.period_start)} s/d {formatDateIndo(r.period_end)}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 font-bold uppercase text-[10px] bg-[#EAE4D8] text-[#171717] border border-[#171717]">
                              {REPORT_TYPE_LABELS[r.report_type] || r.report_type}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 font-black uppercase text-[10px] border ${badge.bg} ${badge.text} ${badge.border}`}>
                              {badge.label}
                            </span>
                            {r.published_at && (
                              <div className="text-[10px] text-[#888] mt-0.5">
                                Terbit: {formatDateIndo(r.published_at)}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#444]">
                            {r.generated_by_user?.name || r.generated_by?.name || 'Pimpinan'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {chiScore !== undefined ? (
                              <span className={`px-2 py-1 font-black text-xs rounded border ${
                                chiScore >= 75 ? 'bg-green-100 text-green-800 border-green-300' :
                                chiScore >= 50 ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                'bg-red-100 text-red-800 border-red-300'
                              }`}>
                                {chiScore}/100 {chiCategory ? `(${chiCategory})` : ''}
                              </span>
                            ) : (
                              <span className="text-[#888] font-bold">â€”</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleOpenDetail(r.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border-[2px] border-[#171717] font-black text-xs uppercase shadow-[2px_2px_0px_#171717] hover:bg-[#B8A0F0] transition-colors"
                            >
                              <Eye size={14} /> Detail
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* TAB 2: STRATEGIC DECISION FOLLOW-UP & ACTION TRACKER */}
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {activeTab === 'decisions' && (
        <div className="space-y-6">

          {/* DECISION SUMMARY BANNER */}
          {decisionSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="border-[3px] border-[#171717] bg-white shadow-[4px_4px_0px_#171717] p-3 text-center">
                <div className="text-[11px] font-bold uppercase text-[#666]">Total Keputusan</div>
                <div className="text-2xl font-black text-[#171717]">{decisionSummary.total_decisions}</div>
              </div>
              <div className="border-[3px] border-[#171717] bg-[#ECFDF5] shadow-[4px_4px_0px_#171717] p-3 text-center">
                <div className="text-[11px] font-bold uppercase text-[#065F46]">Completed</div>
                <div className="text-2xl font-black text-[#065F46]">{decisionSummary.completed_count}</div>
              </div>
              <div className="border-[3px] border-[#171717] bg-[#FEF3C7] shadow-[4px_4px_0px_#171717] p-3 text-center">
                <div className="text-[11px] font-bold uppercase text-[#B45309]">In Progress</div>
                <div className="text-2xl font-black text-[#B45309]">{decisionSummary.in_progress_count}</div>
              </div>
              <div className="border-[3px] border-[#171717] bg-[#EFF6FF] shadow-[4px_4px_0px_#171717] p-3 text-center">
                <div className="text-[11px] font-bold uppercase text-[#1E40AF]">Approved</div>
                <div className="text-2xl font-black text-[#1E40AF]">{decisionSummary.approved_count}</div>
              </div>
              <div className="border-[3px] border-[#171717] bg-red-100 shadow-[4px_4px_0px_#171717] p-3 text-center">
                <div className="text-[11px] font-black uppercase text-red-700">ðŸš¨ Overdue</div>
                <div className="text-2xl font-black text-red-700">{decisionSummary.overdue_count}</div>
              </div>
              <div className="border-[3px] border-[#171717] bg-[#F3E8FF] shadow-[4px_4px_0px_#171717] p-3 text-center">
                <div className="text-[11px] font-bold uppercase text-[#6B21A8]">Resolution Rate</div>
                <div className="text-2xl font-black text-[#6B21A8]">{decisionSummary.resolution_rate}%</div>
              </div>
            </div>
          )}

          {/* OVERDUE ACTION ALERT */}
          {decisionSummary && decisionSummary.overdue_count > 0 && (
            <div className="border-[3px] border-red-700 bg-red-50 shadow-[4px_4px_0px_#991B1B] p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertTriangle size={24} className="text-red-700 flex-shrink-0" />
                <div>
                  <div className="font-black text-sm text-red-900 uppercase">
                    Perhatian Manajemen: Terdapat {decisionSummary.overdue_count} Keputusan Eksekutif yang Melewati Batas Waktu
                  </div>
                  <div className="text-xs text-red-800 font-semibold mt-0.5">
                    Keputusan yang disahkan membutuhkan intervensi segera atau evaluasi ulang bersama PIC penanggung jawab.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOverdueOnly(prev => !prev)}
                className="px-3 py-1.5 bg-red-700 text-white font-black text-xs uppercase border border-[#171717] shadow-[2px_2px_0px_#171717] flex-shrink-0"
              >
                {overdueOnly ? 'Tampilkan Semua' : 'Filter Overdue Saja'}
              </button>
            </div>
          )}

          {/* DECISION FILTER BAR */}
          <div className="border-[3px] border-[#171717] bg-white shadow-[4px_4px_0px_#171717] p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full max-w-md">
              <Search size={16} className="absolute left-3 top-3 text-[#888]" />
              <input
                type="text"
                placeholder="Cari keputusan, PIC, deskripsi, atau nomor..."
                value={searchDecision}
                onChange={(e) => setSearchDecision(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border-[2px] border-[#171717] text-xs font-bold focus:outline-none focus:bg-[#FFFDE7]"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
              <select
                value={decisionStatusFilter}
                onChange={(e) => setDecisionStatusFilter(e.target.value)}
                className="border-[2px] border-[#171717] px-3 py-2 text-xs font-bold bg-[#F5F1E9] focus:outline-none"
              >
                <option value="all">Semua Status</option>
                <option value="approved">Approved</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="draft">Draft</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <button
                onClick={() => setOverdueOnly(prev => !prev)}
                className={`px-3 py-2 text-xs font-black uppercase border-[2px] border-[#171717] transition-all ${
                  overdueOnly
                    ? 'bg-red-600 text-white shadow-[2px_2px_0px_#171717]'
                    : 'bg-white text-[#171717] hover:bg-[#F5F1E9]'
                }`}
              >
                Overdue Saja
              </button>

              <Link
                to="/risk-center"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#B8A0F0] text-[#171717] font-black text-xs uppercase border-[2px] border-[#171717] shadow-[2px_2px_0px_#171717] hover:bg-[#a688ed]"
              >
                <span>Kelola di Risk Center</span> <ExternalLink size={14} />
              </Link>
            </div>
          </div>

          {/* DECISION ACTION TRACKER TABLE */}
          {decisionsLoading ? (
            <PageLoading
              mode="component"
              text="Memuat data tindak lanjut keputusan..."
              subtext="Mengambil riwayat keputusan pimpinan dan status implementasi."
              className="border-[3px] border-[#171717] bg-white shadow-[4px_4px_0px_#171717] my-4"
            />
          ) : decisionsError ? (
            <div className="border-[3px] border-[#171717] bg-red-50 p-6 text-center text-red-700 font-bold">
              {decisionsError}
            </div>
          ) : decisions.length === 0 ? (
            <div className="border-[3px] border-[#171717] bg-white p-12 text-center space-y-2">
              <ListChecks size={48} className="mx-auto text-[#AAA]" />
              <div className="text-base font-black uppercase text-[#171717]">Tidak Ada Keputusan Ditemukan</div>
              <p className="text-xs text-[#666]">Tidak ada data keputusan yang cocok dengan kriteria filter saat ini.</p>
            </div>
          ) : (
            <div className="border-[3px] border-[#171717] bg-white shadow-[6px_6px_0px_#171717] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#171717] text-white uppercase text-[11px] font-black tracking-wider">
                    <tr>
                      <th className="py-3 px-4">No. Keputusan</th>
                      <th className="py-3 px-4">Judul & Kategori</th>
                      <th className="py-3 px-4">PIC / Pelaksana</th>
                      <th className="py-3 px-4">Tenggat Waktu</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Hasil Tindak Lanjut</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-[2px] divide-[#171717]">
                    {decisions.map((d) => {
                      const badge = DECISION_STATUS_BADGES[d.status] || DECISION_STATUS_BADGES.draft

                      return (
                        <tr
                          key={d.id}
                          className={`hover:bg-[#FFFDE7] transition-colors ${
                            d.is_overdue ? 'bg-red-50/60' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-[#171717]">
                            {d.decision_number}
                            {d.priority === 'critical' && (
                              <span className="block mt-1 px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-black uppercase w-max">
                                CRITICAL
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-black text-sm text-[#171717]">{d.title}</div>
                            <div className="text-[11px] text-[#666] font-semibold mt-0.5">
                              Kategori: {d.category} {d.project ? `Â· Proyek: ${d.project.name}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#171717]">{d.pic?.name || 'â€” Belum Ditugaskan â€”'}</div>
                            {d.pic?.role && (
                              <div className="text-[10px] text-[#777] font-semibold uppercase">{d.pic.role}</div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className={`font-bold ${d.is_overdue ? 'text-red-700' : 'text-[#171717]'}`}>
                              {formatDateIndo(d.due_date)}
                            </div>
                            {d.is_overdue && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[9px] font-black uppercase bg-red-600 text-white">
                                Terlambat {Math.abs(d.days_remaining)} Hari
                              </span>
                            )}
                            {d.is_approaching && !d.is_overdue && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[9px] font-black uppercase bg-yellow-500 text-white">
                                Sisa {d.days_remaining} Hari
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 font-bold uppercase text-[10px] border rounded ${badge.bg}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            {d.implementation_result ? (
                              <div className="text-xs text-[#333] font-semibold line-clamp-2">
                                {d.implementation_result}
                              </div>
                            ) : (
                              <span className="text-[#999] italic">Belum ada catatan hasil</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              to="/risk-center"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-[#171717] font-bold text-xs uppercase shadow-[1px_1px_0px_#171717] hover:bg-[#F5F1E9]"
                            >
                              <span>Update</span> <ChevronRight size={12} />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* MODAL: BUAT LAPORAN EKSEKUTIF BARU */}
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#F5F1E9] border-[3px] border-[#171717] shadow-[8px_8px_0px_#171717] w-full max-w-2xl max-h-[90vh] overflow-y-auto my-auto">
            <div className="bg-[#171717] text-white px-5 py-4 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <FileBarChart size={18} className="text-[#FFD83D]" />
                <h3 className="font-black text-sm uppercase tracking-wide">Buat Laporan Eksekutif Baru</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-white/20 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 bg-red-100 border-2 border-red-500 text-red-800 text-xs font-bold">
                  {createError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                    Jenis Periode *
                  </label>
                  <select
                    value={createForm.report_type}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="w-full border-[2px] border-[#171717] px-3 py-2 text-xs font-bold bg-white focus:outline-none"
                    required
                  >
                    <option value="monthly">Bulanan</option>
                    <option value="quarterly">Kuartalan</option>
                    <option value="weekly">Mingguan</option>
                    <option value="daily">Harian</option>
                    <option value="custom">Kustom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                    Tanggal Mulai *
                  </label>
                  <input
                    type="date"
                    value={createForm.period_start}
                    onChange={(e) => setCreateForm({ ...createForm, period_start: e.target.value })}
                    className="w-full border-[2px] border-[#171717] px-3 py-2 text-xs font-bold bg-white focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                    Tanggal Akhir *
                  </label>
                  <input
                    type="date"
                    value={createForm.period_end}
                    onChange={(e) => setCreateForm({ ...createForm, period_end: e.target.value })}
                    className="w-full border-[2px] border-[#171717] px-3 py-2 text-xs font-bold bg-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                  Judul Laporan Eksekutif *
                </label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="Contoh: Laporan Kinerja Bisnis & Portofolio â€” November 2026"
                  className="w-full border-[2px] border-[#171717] px-3 py-2 text-xs font-bold bg-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-black uppercase text-[#171717]">
                    Executive Summary / Ringkasan Narasi
                  </label>
                  <button
                    type="button"
                    onClick={handleAiAssist}
                    disabled={aiGenerating}
                    className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-1 bg-[#B8A0F0] text-[#171717] border border-[#171717] shadow-[1px_1px_0px_#171717] hover:bg-[#a589ea] disabled:opacity-50"
                  >
                    {aiGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    <span>Bantu Tulis via AI Advisor</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={createForm.executive_summary}
                  onChange={(e) => setCreateForm({ ...createForm, executive_summary: e.target.value })}
                  placeholder="Ringkasan eksekutif performa perusahaan, deliverable penting, dan kondisi finansial/operasional..."
                  className="w-full border-[2px] border-[#171717] px-3 py-2 text-xs font-medium bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                  Rekomendasi Strategis Manajemen
                </label>
                <textarea
                  rows={2}
                  value={createForm.strategic_recommendations}
                  onChange={(e) => setCreateForm({ ...createForm, strategic_recommendations: e.target.value })}
                  placeholder="Arahan strategis tindak lanjut untuk para PM dan tim operasional..."
                  className="w-full border-[2px] border-[#171717] px-3 py-2 text-xs font-medium bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                  Management Attention Required (Kritis)
                </label>
                <textarea
                  rows={2}
                  value={createForm.management_attention}
                  onChange={(e) => setCreateForm({ ...createForm, management_attention: e.target.value })}
                  placeholder="Isu krusial yang membutuhkan perhatian pimpinan segera..."
                  className="w-full border-[2px] border-[#171717] px-3 py-2 text-xs font-medium bg-white focus:outline-none"
                />
              </div>

              <div className="bg-[#FFFDE7] border-[2px] border-[#171717] p-3 text-xs text-[#555] font-semibold">
                â„¹ï¸ Sistem akan mengumpulkan snapshot data operasional secara otomatis saat draft dibuat (CHI, Proyek, Risiko, Blocker, Keputusan).
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t-[2px] border-[#171717]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border-[2px] border-[#171717] font-black text-xs uppercase bg-white hover:bg-[#EAE4D8]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-5 py-2 border-[2px] border-[#171717] font-black text-xs uppercase bg-[#FFD83D] shadow-[3px_3px_0px_#171717] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#171717] transition-all disabled:opacity-50"
                >
                  {createSubmitting ? 'Memproses...' : 'Simpan Draft Laporan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* MODAL: DETAIL & PRINT-READY VIEW LAPORAN EKSEKUTIF */}
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 md:p-4 overflow-y-auto print:p-0 print:bg-white">
          <div className="bg-white border-[3px] border-[#171717] shadow-[8px_8px_0px_#171717] w-full max-w-4xl max-h-[92vh] overflow-y-auto my-auto print:border-none print:shadow-none print:max-h-full print:m-0">

            {/* MODAL HEADER TOOLBAR (Hidden when printing) */}
            <div className="bg-[#171717] text-white px-5 py-3 flex items-center justify-between sticky top-0 z-20 print:hidden">
              <div className="flex items-center gap-2">
                <FileBarChart size={18} className="text-[#FFD83D]" />
                <span className="font-black text-sm uppercase">Dokumen Laporan Eksekutif Resmi</span>
                <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded ${
                  selectedReport.status === 'published' ? 'bg-green-600 text-white' : 'bg-yellow-500 text-black'
                }`}>
                  {selectedReport.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-[#171717] font-black text-xs uppercase border border-[#171717] hover:bg-[#FFD83D]"
                  title="Cetak Laporan / Simpan PDF"
                >
                  <Printer size={14} /> Cetak / PDF
                </button>
                {selectedReport.status === 'draft' && (
                  <button
                    onClick={() => handlePublish(selectedReport.id)}
                    disabled={publishLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#10B981] text-white font-black text-xs uppercase border border-[#171717] hover:bg-[#059669] disabled:opacity-50"
                  >
                    <Check size={14} /> {publishLoading ? 'Memproses...' : 'Terbitkan Laporan'}
                  </button>
                )}
                <button
                  onClick={() => setSelectedReport(null)}
                  className="p-1 hover:bg-white/20 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* PRINTABLE REPORT DOCUMENT BODY */}
            <div className="p-6 md:p-10 space-y-8 bg-white print:p-8">

              {/* KOP SURAT RESMI */}
              <div className="border-b-[4px] border-[#171717] pb-4 flex items-center justify-between">
                <div>
                  <div className="text-xl md:text-2xl font-black text-[#171717] tracking-tight">
                    PT POTENSI KARYA MANDIRI
                  </div>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#555]">
                    Executive Management & Business Control Center
                  </div>
                  <div className="text-[11px] text-[#777] mt-0.5">
                    Gedung PKM Center, Jakarta Â· Dokumen Pengawasan dan Evaluasi Manajemen
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-[#171717]">
                    No: {selectedReport.report_number}
                  </div>
                  <div className="text-[11px] font-semibold text-[#666]">
                    Periode: {formatDateIndo(selectedReport.period_start)} s/d {formatDateIndo(selectedReport.period_end)}
                  </div>
                  <div className="text-[10px] font-bold uppercase mt-1 px-2 py-0.5 inline-block bg-[#F5F1E9] border border-[#171717]">
                    Tipe: {REPORT_TYPE_LABELS[selectedReport.report_type] || selectedReport.report_type}
                  </div>
                </div>
              </div>

              {/* REPORT TITLE BANNER */}
              <div className="bg-[#F5F1E9] border-[3px] border-[#171717] p-4 text-center">
                <h2 className="text-lg md:text-xl font-black text-[#171717] uppercase tracking-wide">
                  {selectedReport.title}
                </h2>
                <div className="text-xs font-semibold text-[#555] mt-1">
                  Status Dokumen: {selectedReport.status === 'published' ? 'ARSIP RESMI DITERBITKAN' : 'DRAFT LAPORAN (DALAM PENINJAUAN)'} Â· Disusun oleh: {selectedReport.generated_by_user?.name || selectedReport.generated_by?.name || 'Pimpinan'}
                </div>
              </div>

              {/* 1. EXECUTIVE SUMMARY */}
              {selectedReport.executive_summary && (
                <div className="space-y-2">
                  <h3 className="text-sm font-black uppercase text-[#171717] border-b-2 border-[#171717] pb-1">
                    1. Executive Summary & Catatan Operasional
                  </h3>
                  <div className="text-xs text-[#333] leading-relaxed whitespace-pre-line p-3 bg-white border border-[#DDD]">
                    {selectedReport.executive_summary}
                  </div>
                </div>
              )}

              {/* 2. CORPORATE HEALTH INDEX (CHI) SNAPSHOT */}
              {selectedReport.snapshot_data?.company_health && (
                <div className="space-y-3">
                  <h3 className="text-sm font-black uppercase text-[#171717] border-b-2 border-[#171717] pb-1">
                    2. Ringkasan Kesehatan Korporat (Corporate Health Index)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="border-[2px] border-[#171717] p-3 text-center bg-[#F9F9F9]">
                      <div className="text-[10px] font-bold uppercase text-[#666]">CHI Score</div>
                      <div className="text-2xl font-black text-[#171717]">
                        {selectedReport.snapshot_data.company_health.chi_score}/100
                      </div>
                      <div className="text-[10px] font-bold text-green-700">
                        {selectedReport.snapshot_data.company_health.chi_category}
                      </div>
                    </div>
                    <div className="border-[2px] border-[#171717] p-3 text-center bg-[#F9F9F9]">
                      <div className="text-[10px] font-bold uppercase text-[#666]">Total Proyek</div>
                      <div className="text-2xl font-black text-[#171717]">
                        {selectedReport.snapshot_data.company_health.total_projects}
                      </div>
                      <div className="text-[10px] text-[#555]">
                        {selectedReport.snapshot_data.company_health.on_track_count} Tepat Waktu
                      </div>
                    </div>
                    <div className="border-[2px] border-[#171717] p-3 text-center bg-[#F9F9F9]">
                      <div className="text-[10px] font-bold uppercase text-[#666]">Proyek Terlambat</div>
                      <div className="text-2xl font-black text-red-700">
                        {selectedReport.snapshot_data.company_health.delayed_count}
                      </div>
                      <div className="text-[10px] text-red-600 font-semibold">Memerlukan Atensi</div>
                    </div>
                    <div className="border-[2px] border-[#171717] p-3 text-center bg-[#F9F9F9]">
                      <div className="text-[10px] font-bold uppercase text-[#666]">Rata-rata Progres</div>
                      <div className="text-2xl font-black text-[#171717]">
                        {selectedReport.snapshot_data.company_health.avg_progress}%
                      </div>
                      <div className="text-[10px] text-[#555]">Baseline Sesuai Jadwal</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. STRATEGIC PROJECT PORTFOLIO TABLE */}
              {selectedReport.snapshot_data?.projects && selectedReport.snapshot_data.projects.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-black uppercase text-[#171717] border-b-2 border-[#171717] pb-1">
                    3. Portofolio Proyek Strategis
                  </h3>
                  <table className="w-full text-left text-xs border border-[#171717]">
                    <thead className="bg-[#F5F1E9] uppercase text-[10px] font-black border-b border-[#171717]">
                      <tr>
                        <th className="p-2">Kode</th>
                        <th className="p-2">Nama Proyek</th>
                        <th className="p-2">PIC</th>
                        <th className="p-2">Status</th>
                        <th className="p-2 text-right">Progres / Target</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DDD]">
                      {selectedReport.snapshot_data.projects.map((p, idx) => (
                        <tr key={idx}>
                          <td className="p-2 font-mono font-bold">{p.code}</td>
                          <td className="p-2 font-bold">{p.name}</td>
                          <td className="p-2">{p.pic}</td>
                          <td className="p-2">
                            <span className="uppercase font-bold text-[10px]">{p.status}</span>
                          </td>
                          <td className="p-2 text-right font-black">
                            {p.progress}% / {p.target_progress}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 4. STRATEGIC RISKS & BLOCKERS */}
              {selectedReport.snapshot_data?.risks?.top_active_risks && (
                <div className="space-y-2">
                  <h3 className="text-sm font-black uppercase text-[#171717] border-b-2 border-[#171717] pb-1">
                    4. Risiko Strategis & Hambatan Operasional Utama
                  </h3>
                  <div className="space-y-1.5">
                    {selectedReport.snapshot_data.risks.top_active_risks.map((r, idx) => (
                      <div key={idx} className="p-2.5 border border-[#171717] bg-[#FFF8E1] text-xs flex items-start gap-2">
                        <AlertTriangle size={14} className="text-red-700 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-black text-[#171717]">{r.code}: {r.title}</span> ({r.level})
                          <div className="text-[11px] text-[#555] mt-0.5">Mitigasi: {r.mitigation || 'Belum dirumuskan'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. STRATEGIC RECOMMENDATIONS & ATTENTION */}
              {(selectedReport.strategic_recommendations || selectedReport.management_attention) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedReport.strategic_recommendations && (
                    <div className="border-[2px] border-[#171717] p-3.5 bg-[#EFF6FF]">
                      <div className="text-xs font-black uppercase text-[#1E40AF] mb-1">
                        5. Rekomendasi Tindakan Manajemen
                      </div>
                      <div className="text-xs text-[#333] whitespace-pre-line leading-relaxed">
                        {selectedReport.strategic_recommendations}
                      </div>
                    </div>
                  )}

                  {selectedReport.management_attention && (
                    <div className="border-[2px] border-[#171717] p-3.5 bg-red-50">
                      <div className="text-xs font-black uppercase text-red-800 mb-1">
                        6. Poin Kritis Memerlukan Atensi Segera
                      </div>
                      <div className="text-xs text-red-900 whitespace-pre-line leading-relaxed">
                        {selectedReport.management_attention}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TANDA TANGAN / PENGESAHAN DOKUMEN */}
              <div className="border-t-[2px] border-[#171717] pt-6 grid grid-cols-2 text-center text-xs">
                <div>
                  <div className="text-[11px] text-[#666] mb-12">Disusun Oleh:</div>
                  <div className="font-black uppercase text-[#171717]">
                    {selectedReport.generated_by_user?.name || selectedReport.generated_by?.name || 'Administrator'}
                  </div>
                  <div className="text-[10px] text-[#777]">Business Intelligence & Control</div>
                </div>

                <div>
                  <div className="text-[11px] text-[#666] mb-12">Disahkan Oleh (Pimpinan):</div>
                  <div className="font-black uppercase text-[#171717]">
                    {selectedReport.published_by_user?.name || selectedReport.published_by?.name || '(Belum Diterbitkan)'}
                  </div>
                  <div className="text-[10px] text-[#777]">
                    {selectedReport.published_at ? `Tanggal Terbit: ${formatDateIndo(selectedReport.published_at)}` : 'Status: Draft'}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  )
}
