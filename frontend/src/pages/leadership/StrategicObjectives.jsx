import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import {
  Target, CheckCircle2, Clock, AlertTriangle, Search, Filter,
  RotateCcw, Loader2, Eye, X, TrendingUp, AlertCircle,
  Briefcase, Plus, Calendar, ShieldAlert, ArrowRight,
  Sparkles, Building2, ExternalLink, FileText, Check,
  ListChecks, ChevronRight, Layers, Users, Zap, Flag,
  ArrowUpRight, BarChart3, Edit3, Trash2, Link as LinkIcon
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

const CATEGORIES = [
  'Revenue & Business Growth',
  'Operational Excellence',
  'Project Delivery',
  'Customer Satisfaction',
  'Team & Organization',
  'Digital Transformation',
]

const STATUS_CONFIG = {
  draft: { label: 'Draf', bg: 'bg-gray-100 text-gray-700 border-gray-300' },
  active: { label: 'Aktif', bg: 'bg-blue-100 text-blue-700 border-blue-300' },
  at_risk: { label: 'Berisiko', bg: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  achieved: { label: 'Tercapai', bg: 'bg-green-100 text-green-700 border-green-300' },
  not_achieved: { label: 'Tidak Tercapai', bg: 'bg-red-100 text-red-700 border-red-300' },
  archived: { label: 'Diarsipkan', bg: 'bg-zinc-200 text-zinc-700 border-zinc-400' },
}

const KR_STATUS_CONFIG = {
  on_track: { label: 'Tepat Waktu', bg: 'bg-green-100 text-green-700 border-green-300' },
  behind: { label: 'Tertinggal', bg: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  at_risk: { label: 'Berisiko', bg: 'bg-red-100 text-red-700 border-red-300' },
  achieved: { label: 'Tercapai', bg: 'bg-emerald-100 text-emerald-800 border-emerald-400' },
}

const METRIC_TYPE_LABELS = {
  numeric_increase: 'Peningkatan Angka (Target â†‘)',
  numeric_decrease: 'Penurunan Angka (Target â†“)',
  boolean: 'Status Tercapai / Belum (Ya/Tidak)',
  milestone_based: 'Penyelesaian Milestone',
}

export default function StrategicObjectives() {
  const { user } = useAuth()
  const isLeaderOrAdmin = user && ['admin', 'pimpinan'].includes(user.role)

  // Data states
  const [summary, setSummary] = useState(null)
  const [objectives, setObjectives] = useState([])
  const [projectsList, setProjectsList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedObjective, setSelectedObjective] = useState(null)
  const [showAddKrModal, setShowAddKrModal] = useState(false)
  const [showCheckinModal, setShowCheckinModal] = useState(false)
  const [selectedKr, setSelectedKr] = useState(null)
  const [showLinkProjectModal, setShowLinkProjectModal] = useState(false)

  // Form states
  const [objForm, setObjForm] = useState({
    title: '',
    description: '',
    category: 'Project Delivery',
    period_start: new Date().toISOString().split('T')[0],
    period_end: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0],
    priority: 'high',
    status: 'active',
  })
  const [formSubmitting, setFormSubmitting] = useState(false)

  // KR Form state
  const [krForm, setKrForm] = useState({
    title: '',
    description: '',
    metric_type: 'numeric_increase',
    unit: '%',
    baseline_value: 0,
    target_value: 100,
    current_value: 0,
    weight: 1.0,
    deadline: '',
  })

  // Checkin Form state
  const [checkinForm, setCheckinForm] = useState({
    new_value: '',
    notes: '',
    evidence_reference: '',
    status: 'on_track',
  })

  // Link Project Form state
  const [linkProjectForm, setLinkProjectForm] = useState({
    project_id: '',
    contribution_notes: '',
  })

  // AI Assist State
  const [aiAnalysis, setAiAnalysis] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Fetch OKR Overview & List
  const fetchOkrData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [overviewRes, listRes, projRes] = await Promise.all([
        api.get('/leadership/okr/overview'),
        api.get('/leadership/okr/objectives', {
          params: {
            status: statusFilter !== 'all' ? statusFilter : undefined,
            category: categoryFilter !== 'all' ? categoryFilter : undefined,
            search: searchQuery || undefined,
          }
        }),
        api.get('/projects').catch(() => ({ data: { projects: [] } }))
      ])

      setSummary(overviewRes.data.summary || null)
      setObjectives(listRes.data.objectives || [])
      setProjectsList(projRes.data.projects || projRes.data.data || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat data sasaran strategis.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, categoryFilter, searchQuery])

  useEffect(() => {
    fetchOkrData()
  }, [fetchOkrData])

  // Handle Create Objective
  const handleCreateObjective = async (e) => {
    e.preventDefault()
    setFormSubmitting(true)
    try {
      await api.post('/leadership/okr/objectives', objForm)
      setShowCreateModal(false)
      setObjForm({
        title: '',
        description: '',
        category: 'Project Delivery',
        period_start: new Date().toISOString().split('T')[0],
        period_end: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0],
        priority: 'high',
        status: 'active',
      })
      fetchOkrData()
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal membuat sasaran strategis.')
    } finally {
      setFormSubmitting(false)
    }
  }

  // Handle Add Key Result
  const handleAddKr = async (e) => {
    e.preventDefault()
    if (!selectedObjective) return
    setFormSubmitting(true)
    try {
      await api.post(`/leadership/okr/objectives/${selectedObjective.id}/key-results`, krForm)
      setShowAddKrModal(false)
      setKrForm({
        title: '',
        description: '',
        metric_type: 'numeric_increase',
        unit: '%',
        baseline_value: 0,
        target_value: 100,
        current_value: 0,
        weight: 1.0,
        deadline: '',
      })
      // Refresh selected objective
      const res = await api.get(`/leadership/okr/objectives/${selectedObjective.id}`)
      setSelectedObjective(res.data.objective)
      fetchOkrData()
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menambahkan Key Result.')
    } finally {
      setFormSubmitting(false)
    }
  }

  // Handle Check-in Key Result
  const handleCheckinSubmit = async (e) => {
    e.preventDefault()
    if (!selectedKr) return
    setFormSubmitting(true)
    try {
      await api.post(`/leadership/okr/key-results/${selectedKr.id}/checkin`, checkinForm)
      setShowCheckinModal(false)
      setCheckinForm({ new_value: '', notes: '', evidence_reference: '', status: 'on_track' })
      if (selectedObjective) {
        const res = await api.get(`/leadership/okr/objectives/${selectedObjective.id}`)
        setSelectedObjective(res.data.objective)
      }
      fetchOkrData()
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mencatat check-in progres.')
    } finally {
      setFormSubmitting(false)
    }
  }

  // Handle Link Project
  const handleLinkProjectSubmit = async (e) => {
    e.preventDefault()
    if (!selectedObjective || !linkProjectForm.project_id) return
    setFormSubmitting(true)
    try {
      await api.post(`/leadership/okr/objectives/${selectedObjective.id}/projects`, linkProjectForm)
      setShowLinkProjectModal(false)
      setLinkProjectForm({ project_id: '', contribution_notes: '' })
      const res = await api.get(`/leadership/okr/objectives/${selectedObjective.id}`)
      setSelectedObjective(res.data.objective)
      fetchOkrData()
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghubungkan proyek.')
    } finally {
      setFormSubmitting(false)
    }
  }

  // Handle Unlink Project
  const handleUnlinkProject = async (projectId) => {
    if (!selectedObjective) return
    if (!window.confirm('Lepaskan hubungan proyek ini dari sasaran strategis?')) return
    try {
      await api.delete(`/leadership/okr/objectives/${selectedObjective.id}/projects/${projectId}`)
      const res = await api.get(`/leadership/okr/objectives/${selectedObjective.id}`)
      setSelectedObjective(res.data.objective)
      fetchOkrData()
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal melepaskan proyek.')
    }
  }

  // AI Strategic Review Assistance
  const handleRequestAiReview = async (objective) => {
    setAiLoading(true)
    setAiAnalysis(null)
    try {
      const prompt = `Sebagai Executive Business Advisor PT Potensi Karya Mandiri, tolong berikan evaluasi strategis ringkas untuk Objective: "${objective.title}" (Kategori: ${objective.category}, Capaian saat ini: ${objective.aggregated_progress}%). Berikan analisis faktor pendorong/penghambat, keselarasan proyek pendukung, dan 3 rekomendasi tindakan taktis bagi pimpinan.`
      const res = await api.post('/leadership/ai/chat', { prompt })
      setAiAnalysis(res.data.reply || 'Tidak ada analisis yang dihasilkan.')
    } catch {
      setAiAnalysis('Maaf, layanan AI Advisor sedang tidak dapat dihubungi.')
    } finally {
      setAiLoading(false)
    }
  }

  if (loading && objectives.length === 0) {
    return <PageLoading mode="page" text="Memuat Strategic Objectives & OKR..." subtext="Mengagregasi capaian sasaran strategis dan Key Results perusahaan." />
  }

  return (
    <div className="w-full bg-[#F5F1E9] p-4 md:p-8 space-y-6">

      {/* HEADER SECTION */}
      <PageHeader
        title="STRATEGIC OBJECTIVES & OKR"
        subtitle="Pusat penetapan sasaran strategis, Key Results terukur, keselarasan portofolio proyek, dan evaluasi ketercapaian target perusahaan."
        tag="SASARAN STRATEGIS"
        badge="PT Potensi Karya Mandiri"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {isLeaderOrAdmin && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FFD83D] text-[#171717] font-black border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] hover:bg-[#f5cd2f] active:translate-x-[1px] active:translate-y-[1px] transition-all text-xs uppercase cursor-pointer min-h-[40px]"
              >
                <Plus size={15} /> Buat Sasaran
              </button>
            )}
            <button
              onClick={fetchOkrData}
              className="p-2.5 bg-white text-[#171717] border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] hover:bg-[#F5F1E9] transition-all cursor-pointer min-h-[40px]"
              title="Segarkan Data"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        }
      />

      {/* STRATEGIC OVERVIEW CARDS */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="border-[3px] border-[#171717] bg-white shadow-[4px_4px_0px_#171717] p-3 text-center">
            <div className="text-[11px] font-bold uppercase text-[#666]">Total Objective</div>
            <div className="text-2xl font-black text-[#171717]">{summary.total_objectives}</div>
            <div className="text-[10px] text-[#888] font-semibold">{summary.active_count} Aktif Berjalan</div>
          </div>

          <div className="border-[3px] border-[#171717] bg-[#EFF6FF] shadow-[4px_4px_0px_#171717] p-3 text-center">
            <div className="text-[11px] font-bold uppercase text-[#1D4ED8]">Rata-rata Capaian</div>
            <div className="text-2xl font-black text-[#1D4ED8]">{summary.avg_progress}%</div>
            <div className="text-[10px] text-[#1D4ED8] font-semibold">Agregasi Tertimbang</div>
          </div>

          <div className="border-[3px] border-[#171717] bg-[#ECFDF5] shadow-[4px_4px_0px_#171717] p-3 text-center">
            <div className="text-[11px] font-bold uppercase text-[#065F46]">Achieved</div>
            <div className="text-2xl font-black text-[#065F46]">{summary.achieved_count}</div>
            <div className="text-[10px] text-[#065F46] font-semibold">100% Target Tercapai</div>
          </div>

          <div className="border-[3px] border-[#171717] bg-[#FFF8E1] shadow-[4px_4px_0px_#171717] p-3 text-center">
            <div className="text-[11px] font-bold uppercase text-[#B45309]">At Risk / Tertinggal</div>
            <div className="text-2xl font-black text-[#B45309]">{summary.at_risk_count}</div>
            <div className="text-[10px] text-[#B45309] font-semibold">Perlu Intervensi</div>
          </div>

          <div className="border-[3px] border-[#171717] bg-white shadow-[4px_4px_0px_#171717] p-3 text-center">
            <div className="text-[11px] font-bold uppercase text-[#666]">Total Key Results</div>
            <div className="text-2xl font-black text-[#171717]">{summary.total_key_results}</div>
            <div className="text-[10px] text-green-700 font-semibold">{summary.krs_on_track} Tepat Waktu</div>
          </div>

          <div className="border-[3px] border-[#171717] bg-[#FDF2F8] shadow-[4px_4px_0px_#171717] p-3 text-center">
            <div className="text-[11px] font-bold uppercase text-[#BE185D]">Tanpa Proyek</div>
            <div className="text-2xl font-black text-[#BE185D]">{summary.objectives_without_projects}</div>
            <div className="text-[10px] text-[#BE185D] font-semibold">Belum Selaras Proyek</div>
          </div>
        </div>
      )}

      {/* FILTER AND SEARCH BAR */}
      <div className="border-[3px] border-[#171717] bg-white shadow-[4px_4px_0px_#171717] p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full max-w-md">
          <Search size={16} className="absolute left-3 top-3 text-[#888]" />
          <input
            type="text"
            placeholder="Cari sasaran strategis, kategori, atau deskripsi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border-[2px] border-[#171717] text-xs font-bold focus:outline-none focus:bg-[#FFFDE7]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border-[2px] border-[#171717] px-3 py-2 text-xs font-bold bg-[#F5F1E9] focus:outline-none"
          >
            <option value="all">Semua Kategori</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border-[2px] border-[#171717] px-3 py-2 text-xs font-bold bg-[#F5F1E9] focus:outline-none"
          >
            <option value="all">Semua Status</option>
            <option value="active">Active</option>
            <option value="at_risk">At Risk</option>
            <option value="achieved">Achieved</option>
            <option value="draft">Draft</option>
            <option value="not_achieved">Not Achieved</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* OBJECTIVES LIST */}
      {loading ? (
        <div className="border-[3px] border-[#171717] bg-white p-12 text-center">
          <Loader2 size={32} className="animate-spin mx-auto text-[#B8A0F0] mb-3" />
          <div className="text-sm font-bold text-[#555]">Memuat sasaran strategis perusahaan...</div>
        </div>
      ) : error ? (
        <div className="border-[3px] border-[#171717] bg-red-50 p-6 text-center text-red-700 font-bold">
          {error}
        </div>
      ) : objectives.length === 0 ? (
        <div className="border-[3px] border-[#171717] bg-white p-12 text-center space-y-3">
          <Target size={48} className="mx-auto text-[#AAA]" />
          <div className="text-base font-black uppercase text-[#171717]">Belum Ada Sasaran Strategis Ditemukan</div>
          <p className="text-xs text-[#666] max-w-md mx-auto">
            Rumuskan sasaran jangka menengah dan panjang perusahaan dengan mendefinisikan Objective beserta Key Results terukur.
          </p>
          {isLeaderOrAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFD83D] border-[2px] border-[#171717] font-black text-xs uppercase shadow-[2px_2px_0px_#171717]"
            >
              <Plus size={14} /> Buat Objective Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {objectives.map((obj) => {
            const statusBadge = STATUS_CONFIG[obj.status] || STATUS_CONFIG.draft
            const progress = obj.aggregated_progress || 0

            return (
              <div
                key={obj.id}
                className="border-[3px] border-[#171717] bg-white shadow-[6px_6px_0px_#171717] p-5 space-y-4 hover:border-[#171717] transition-all"
              >
                {/* TOP META ROW */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b-2 border-[#E5E5E5] pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 font-black uppercase text-[10px] bg-[#EAE4D8] border border-[#171717]">
                      {obj.category}
                    </span>
                    <span className={`px-2 py-0.5 font-bold uppercase text-[10px] border rounded ${statusBadge.bg}`}>
                      {statusBadge.label}
                    </span>
                    {obj.priority === 'critical' && (
                      <span className="px-2 py-0.5 font-black uppercase text-[10px] bg-red-600 text-white">
                        CRITICAL PRIORITY
                      </span>
                    )}
                  </div>

                  <div className="text-xs font-semibold text-[#666] flex items-center gap-3">
                    <span>Target: {formatDateIndo(obj.period_start)} â€“ {formatDateIndo(obj.period_end)}</span>
                    <span>Sponsor: <strong className="text-[#171717]">{obj.owner?.name || 'Direksi PKM'}</strong></span>
                  </div>
                </div>

                {/* TITLE & PROGRESS BAR ROW */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
                  <div className="lg:col-span-3 space-y-1">
                    <h3 className="text-lg font-black text-[#171717] uppercase tracking-tight">
                      {obj.title}
                    </h3>
                    {obj.description && (
                      <p className="text-xs text-[#555] line-clamp-2">{obj.description}</p>
                    )}
                  </div>

                  <div className="border-[2px] border-[#171717] bg-[#F5F1E9] p-3 text-center">
                    <div className="flex items-center justify-between text-xs font-black mb-1">
                      <span>Capaian OKR</span>
                      <span className="text-sm font-black">{progress}%</span>
                    </div>
                    <div className="w-full bg-white border border-[#171717] h-3.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          progress >= 80 ? 'bg-green-600' : progress >= 40 ? 'bg-[#FFD83D]' : 'bg-red-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* KEY RESULTS SUMMARY LIST */}
                <div className="bg-[#FAF9F5] border-2 border-[#171717] p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-black uppercase text-[#171717] border-b border-[#DDD] pb-1.5">
                    <span className="flex items-center gap-1.5">
                      <ListChecks size={14} /> Key Results Terukur ({obj.key_results?.length || 0})
                    </span>
                    <span className="text-[11px] text-[#666]">
                      {obj.projects?.length || 0} Proyek Pendukung
                    </span>
                  </div>

                  {obj.key_results && obj.key_results.length > 0 ? (
                    <div className="space-y-1.5">
                      {obj.key_results.map((kr) => (
                        <div
                          key={kr.id}
                          className="flex flex-col md:flex-row md:items-center justify-between text-xs bg-white p-2 border border-[#E5E5E5] gap-2"
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <span className="w-2 h-2 rounded-full bg-[#171717]" />
                            <span className="font-bold text-[#171717]">{kr.title}</span>
                            <span className="text-[10px] text-[#777] font-mono">({kr.unit || 'unit'})</span>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-[11px] font-semibold text-[#555]">
                              Aktual: <strong className="text-[#171717]">{kr.current_value}</strong> / Target: {kr.target_value}
                            </div>
                            <span className="font-black text-xs px-2 py-0.5 bg-[#F5F1E9] border border-[#171717]">
                              {kr.progress}%
                            </span>
                            {isLeaderOrAdmin && (
                              <button
                                onClick={() => {
                                  setSelectedKr(kr)
                                  setCheckinForm({
                                    new_value: kr.current_value,
                                    notes: '',
                                    evidence_reference: '',
                                    status: kr.status || 'on_track',
                                  })
                                  setShowCheckinModal(true)
                                }}
                                className="px-2 py-1 bg-[#B8A0F0] text-[#171717] font-black text-[10px] uppercase border border-[#171717] hover:bg-[#a688ee]"
                              >
                                Check-in
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-[#888] italic py-1">
                      Belum ada Key Result yang didefinisikan untuk sasaran ini.
                    </div>
                  )}

                  {/* ALIGNED PROJECTS BADGES */}
                  {obj.projects && obj.projects.length > 0 && (
                    <div className="pt-2 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-black uppercase text-[#666]">Proyek Selaras:</span>
                      {obj.projects.map((p) => (
                        <span
                          key={p.id}
                          className="px-2 py-0.5 text-[10px] font-bold bg-white text-[#171717] border border-[#171717] shadow-[1px_1px_0px_#171717]"
                        >
                          {p.code} ({p.progress}%)
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* ACTION BUTTONS ROW */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRequestAiReview(obj)}
                      disabled={aiLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#B8A0F0] text-[#171717] font-black text-xs uppercase border border-[#171717] shadow-[2px_2px_0px_#171717] hover:bg-[#a688ee] disabled:opacity-50"
                    >
                      <Sparkles size={13} /> Review via AI
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedObjective(obj)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white text-[#171717] font-black text-xs uppercase border-[2px] border-[#171717] shadow-[2px_2px_0px_#171717] hover:bg-[#FFD83D]"
                    >
                      <Eye size={14} /> Detail & Kelola
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* MODAL: DETAIL & PENGELOLAAN OBJECTIVE */}
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {selectedObjective && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 md:p-4 overflow-y-auto">
          <div className="bg-white border-[3px] border-[#171717] shadow-[8px_8px_0px_#171717] w-full max-w-4xl max-h-[92vh] overflow-y-auto my-auto p-6 md:p-8 space-y-6">

            {/* MODAL HEADER */}
            <div className="border-b-[3px] border-[#171717] pb-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-[#B8A0F0] border border-[#171717]">
                    {selectedObjective.category}
                  </span>
                  <span className="text-xs font-mono font-bold text-[#666]">
                    Status: {selectedObjective.status}
                  </span>
                </div>
                <h2 className="text-xl font-black text-[#171717] uppercase tracking-tight">
                  {selectedObjective.title}
                </h2>
              </div>
              <button
                onClick={() => {
                  setSelectedObjective(null)
                  setAiAnalysis(null)
                }}
                className="p-1 hover:bg-[#F5F1E9] border border-[#171717]"
              >
                <X size={18} />
              </button>
            </div>

            {/* AI REVIEW PANEL (If triggered) */}
            {aiAnalysis && (
              <div className="border-[2px] border-[#171717] bg-[#F3E8FF] p-4 space-y-2">
                <div className="flex items-center gap-2 font-black text-xs uppercase text-[#6B21A8]">
                  <Sparkles size={16} /> Analisis Strategis AI Executive Advisor
                </div>
                <div className="text-xs text-[#222] whitespace-pre-line leading-relaxed">
                  {aiAnalysis}
                </div>
              </div>
            )}

            {/* KEY RESULTS SECTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b-2 border-[#171717] pb-1.5">
                <h3 className="font-black text-sm uppercase text-[#171717]">
                  Key Results & Indikator Kinerja ({selectedObjective.key_results?.length || 0})
                </h3>
                {isLeaderOrAdmin && (
                  <button
                    onClick={() => setShowAddKrModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FFD83D] text-[#171717] font-black text-xs uppercase border border-[#171717] shadow-[2px_2px_0px_#171717]"
                  >
                    <Plus size={13} /> Tambah Key Result
                  </button>
                )}
              </div>

              {selectedObjective.key_results && selectedObjective.key_results.length > 0 ? (
                <div className="space-y-3">
                  {selectedObjective.key_results.map((kr) => (
                    <div key={kr.id} className="border-2 border-[#171717] p-3.5 bg-[#FAF9F5] space-y-2">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-1">
                        <div>
                          <div className="font-black text-sm text-[#171717]">{kr.title}</div>
                          <div className="text-[11px] text-[#666]">
                            Metrik: {METRIC_TYPE_LABELS[kr.metric_type] || kr.metric_type} Â· Bobot: {kr.weight}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm px-2.5 py-1 bg-white border border-[#171717]">
                            Capaian: {kr.progress}%
                          </span>
                          {isLeaderOrAdmin && (
                            <button
                              onClick={() => {
                                setSelectedKr(kr)
                                setCheckinForm({
                                  new_value: kr.current_value,
                                  notes: '',
                                  evidence_reference: '',
                                  status: kr.status || 'on_track',
                                })
                                setShowCheckinModal(true)
                              }}
                              className="px-2.5 py-1 bg-[#B8A0F0] text-[#171717] font-black text-xs uppercase border border-[#171717] shadow-[1px_1px_0px_#171717]"
                            >
                              Check-in Progres
                            </button>
                          )}
                        </div>
                      </div>

                      {/* PROGRESS BAR */}
                      <div className="w-full bg-white border border-[#171717] h-2.5 overflow-hidden">
                        <div className="bg-[#171717] h-full" style={{ width: `${kr.progress}%` }} />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#555] pt-1">
                        <span>Baseline: {kr.baseline_value} {kr.unit}</span>
                        <span>Realisasi Terkini: <strong>{kr.current_value} {kr.unit}</strong></span>
                        <span>Target: {kr.target_value} {kr.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[#888] italic p-4 bg-[#F9F9F9] text-center border border-[#DDD]">
                  Belum ada Key Result terukur. Tambahkan Key Result untuk memantau kemajuan sasaran ini.
                </div>
              )}
            </div>

            {/* ALIGNED PROJECTS SECTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b-2 border-[#171717] pb-1.5">
                <h3 className="font-black text-sm uppercase text-[#171717]">
                  Portofolio Proyek Selaras ({selectedObjective.projects?.length || 0})
                </h3>
                {isLeaderOrAdmin && (
                  <button
                    onClick={() => setShowLinkProjectModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-[#171717] font-black text-xs uppercase border border-[#171717] shadow-[2px_2px_0px_#171717] hover:bg-[#F5F1E9]"
                  >
                    <LinkIcon size={13} /> Hubungkan Proyek
                  </button>
                )}
              </div>

              {selectedObjective.projects && selectedObjective.projects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedObjective.projects.map((p) => (
                    <div key={p.id} className="border-2 border-[#171717] p-3 bg-white flex items-center justify-between">
                      <div>
                        <div className="font-mono font-bold text-xs">{p.code}</div>
                        <div className="font-bold text-sm text-[#171717]">{p.name}</div>
                        <div className="text-[11px] text-[#666]">Status: {p.status} Â· Progres: {p.progress}%</div>
                      </div>
                      {isLeaderOrAdmin && (
                        <button
                          onClick={() => handleUnlinkProject(p.id)}
                          className="p-1 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-400"
                          title="Lepaskan hubungan proyek"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[#888] italic p-4 bg-[#F9F9F9] text-center border border-[#DDD]">
                  Sasaran ini belum dihubungkan dengan proyek pendukung manapun.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* MODAL: BUAT OBJECTIVE BARU */}
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#F5F1E9] border-[3px] border-[#171717] shadow-[8px_8px_0px_#171717] w-full max-w-xl max-h-[90vh] overflow-y-auto my-auto p-6 space-y-4">
            <div className="border-b-2 border-[#171717] pb-2 flex items-center justify-between">
              <h3 className="font-black text-sm uppercase text-[#171717]">Buat Strategic Objective Baru</h3>
              <button onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateObjective} className="space-y-3 text-xs">
              <div>
                <label className="block font-black uppercase mb-1">Judul Sasaran Strategis *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Mengoptimalkan Efisiensi Pengiriman dan Mutu Layanan Klien"
                  value={objForm.title}
                  onChange={(e) => setObjForm({ ...objForm, title: e.target.value })}
                  className="w-full border-2 border-[#171717] p-2 font-bold bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-black uppercase mb-1">Kategori Strategis *</label>
                <select
                  value={objForm.category}
                  onChange={(e) => setObjForm({ ...objForm, category: e.target.value })}
                  className="w-full border-2 border-[#171717] p-2 font-bold bg-white focus:outline-none"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block font-black uppercase mb-1">Deskripsi / Latar Belakang</label>
                <textarea
                  rows={2}
                  placeholder="Penjelasan sasaran dan hasil strategis yang diharapkan..."
                  value={objForm.description}
                  onChange={(e) => setObjForm({ ...objForm, description: e.target.value })}
                  className="w-full border-2 border-[#171717] p-2 font-medium bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase mb-1">Tanggal Mulai *</label>
                  <input
                    type="date"
                    required
                    value={objForm.period_start}
                    onChange={(e) => setObjForm({ ...objForm, period_start: e.target.value })}
                    className="w-full border-2 border-[#171717] p-2 font-bold bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase mb-1">Target Selesai *</label>
                  <input
                    type="date"
                    required
                    value={objForm.period_end}
                    onChange={(e) => setObjForm({ ...objForm, period_end: e.target.value })}
                    className="w-full border-2 border-[#171717] p-2 font-bold bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase mb-1">Prioritas *</label>
                  <select
                    value={objForm.priority}
                    onChange={(e) => setObjForm({ ...objForm, priority: e.target.value })}
                    className="w-full border-2 border-[#171717] p-2 font-bold bg-white focus:outline-none"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block font-black uppercase mb-1">Status Awal *</label>
                  <select
                    value={objForm.status}
                    onChange={(e) => setObjForm({ ...objForm, status: e.target.value })}
                    className="w-full border-2 border-[#171717] p-2 font-bold bg-white focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t-2 border-[#171717]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border-2 border-[#171717] font-bold uppercase bg-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 border-2 border-[#171717] font-black uppercase bg-[#FFD83D] shadow-[2px_2px_0px_#171717] disabled:opacity-50"
                >
                  {formSubmitting ? 'Menyimpan...' : 'Simpan Objective'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* MODAL: TAMBAH KEY RESULT */}
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showAddKrModal && selectedObjective && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#F5F1E9] border-[3px] border-[#171717] shadow-[8px_8px_0px_#171717] w-full max-w-lg max-h-[90vh] overflow-y-auto my-auto p-6 space-y-4">
            <div className="border-b-2 border-[#171717] pb-2 flex items-center justify-between">
              <h3 className="font-black text-sm uppercase text-[#171717]">Tambah Key Result Baru</h3>
              <button onClick={() => setShowAddKrModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleAddKr} className="space-y-3 text-xs">
              <div>
                <label className="block font-black uppercase mb-1">Nama Key Result *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Meningkatkan on-time delivery rate menjadi 90%"
                  value={krForm.title}
                  onChange={(e) => setKrForm({ ...krForm, title: e.target.value })}
                  className="w-full border-2 border-[#171717] p-2 font-bold bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-black uppercase mb-1">Jenis Metrik *</label>
                <select
                  value={krForm.metric_type}
                  onChange={(e) => setKrForm({ ...krForm, metric_type: e.target.value })}
                  className="w-full border-2 border-[#171717] p-2 font-bold bg-white focus:outline-none"
                >
                  <option value="numeric_increase">Peningkatan Angka (Target â†‘)</option>
                  <option value="numeric_decrease">Penurunan Angka (Target â†“)</option>
                  <option value="boolean">Status Ya/Tidak (Tercapai / Belum)</option>
                  <option value="milestone_based">Penyelesaian Milestone</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-black uppercase mb-1">Baseline</label>
                  <input
                    type="number"
                    step="any"
                    value={krForm.baseline_value}
                    onChange={(e) => setKrForm({ ...krForm, baseline_value: e.target.value })}
                    className="w-full border-2 border-[#171717] p-2 font-bold bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase mb-1">Target *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={krForm.target_value}
                    onChange={(e) => setKrForm({ ...krForm, target_value: e.target.value })}
                    className="w-full border-2 border-[#171717] p-2 font-bold bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase mb-1">Satuan</label>
                  <input
                    type="text"
                    placeholder="%, hari, skor"
                    value={krForm.unit}
                    onChange={(e) => setKrForm({ ...krForm, unit: e.target.value })}
                    className="w-full border-2 border-[#171717] p-2 font-bold bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase mb-1">Bobot Kontribusi</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={krForm.weight}
                    onChange={(e) => setKrForm({ ...krForm, weight: e.target.value })}
                    className="w-full border-2 border-[#171717] p-2 font-bold bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase mb-1">Batas Waktu (Deadline)</label>
                  <input
                    type="date"
                    value={krForm.deadline}
                    onChange={(e) => setKrForm({ ...krForm, deadline: e.target.value })}
                    className="w-full border-2 border-[#171717] p-2 font-bold bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t-2 border-[#171717]">
                <button
                  type="button"
                  onClick={() => setShowAddKrModal(false)}
                  className="px-4 py-2 border-2 border-[#171717] font-bold uppercase bg-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 border-2 border-[#171717] font-black uppercase bg-[#FFD83D] shadow-[2px_2px_0px_#171717] disabled:opacity-50"
                >
                  {formSubmitting ? 'Menyimpan...' : 'Tambah Key Result'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* MODAL: CHECK-IN KEY RESULT */}
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showCheckinModal && selectedKr && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#F5F1E9] border-[3px] border-[#171717] shadow-[8px_8px_0px_#171717] w-full max-w-md max-h-[90vh] overflow-y-auto my-auto p-6 space-y-4">
            <div className="border-b-2 border-[#171717] pb-2 flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm uppercase text-[#171717]">Check-in Progres Key Result</h3>
                <div className="text-[11px] text-[#666] font-semibold">{selectedKr.title}</div>
              </div>
              <button onClick={() => setShowCheckinModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleCheckinSubmit} className="space-y-3 text-xs">
              <div className="p-3 bg-white border border-[#171717]">
                <div className="flex justify-between text-[#555] font-semibold mb-1">
                  <span>Nilai Sebelumnya: <strong>{selectedKr.current_value} {selectedKr.unit}</strong></span>
                  <span>Target: <strong>{selectedKr.target_value} {selectedKr.unit}</strong></span>
                </div>
              </div>

              <div>
                <label className="block font-black uppercase mb-1">Nilai Realisasi Terkini (New Value) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder={`Masukkan nilai dalam ${selectedKr.unit || 'angka'}`}
                  value={checkinForm.new_value}
                  onChange={(e) => setCheckinForm({ ...checkinForm, new_value: e.target.value })}
                  className="w-full border-2 border-[#171717] p-2.5 font-black text-sm bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-black uppercase mb-1">Catatan Kemajuan / Kendala Lapangan</label>
                <textarea
                  rows={2}
                  placeholder="Penjelasan perubahan angka atau deliverable yang telah selesai..."
                  value={checkinForm.notes}
                  onChange={(e) => setCheckinForm({ ...checkinForm, notes: e.target.value })}
                  className="w-full border-2 border-[#171717] p-2 font-medium bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-black uppercase mb-1">Referensi Bukti Dokumen (URL/File)</label>
                <input
                  type="text"
                  placeholder="https://docs.pkm.co.id/... atau nomor tiket deliverable"
                  value={checkinForm.evidence_reference}
                  onChange={(e) => setCheckinForm({ ...checkinForm, evidence_reference: e.target.value })}
                  className="w-full border-2 border-[#171717] p-2 font-bold bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t-2 border-[#171717]">
                <button
                  type="button"
                  onClick={() => setShowCheckinModal(false)}
                  className="px-4 py-2 border-2 border-[#171717] font-bold uppercase bg-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 border-2 border-[#171717] font-black uppercase bg-[#B8A0F0] text-[#171717] shadow-[2px_2px_0px_#171717] disabled:opacity-50"
                >
                  {formSubmitting ? 'Menyimpan...' : 'Catat Check-in'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* MODAL: HUBUNGKAN PROYEK PENDUKUNG */}
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showLinkProjectModal && selectedObjective && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#F5F1E9] border-[3px] border-[#171717] shadow-[8px_8px_0px_#171717] w-full max-w-md max-h-[90vh] overflow-y-auto my-auto p-6 space-y-4">
            <div className="border-b-2 border-[#171717] pb-2 flex items-center justify-between">
              <h3 className="font-black text-sm uppercase text-[#171717]">Hubungkan Proyek Pendukung</h3>
              <button onClick={() => setShowLinkProjectModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleLinkProjectSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-black uppercase mb-1">Pilih Proyek Operasional *</label>
                <select
                  required
                  value={linkProjectForm.project_id}
                  onChange={(e) => setLinkProjectForm({ ...linkProjectForm, project_id: e.target.value })}
                  className="w-full border-2 border-[#171717] p-2 font-bold bg-white focus:outline-none"
                >
                  <option value="">â€” Pilih Proyek â€”</option>
                  {projectsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} â€” {p.name} ({p.progress}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-black uppercase mb-1">Catatan Kontribusi Proyek</label>
                <textarea
                  rows={2}
                  placeholder="Bagaimana proyek ini mendukung pencapaian sasaran strategis terkait..."
                  value={linkProjectForm.contribution_notes}
                  onChange={(e) => setLinkProjectForm({ ...linkProjectForm, contribution_notes: e.target.value })}
                  className="w-full border-2 border-[#171717] p-2 font-medium bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t-2 border-[#171717]">
                <button
                  type="button"
                  onClick={() => setShowLinkProjectModal(false)}
                  className="px-4 py-2 border-2 border-[#171717] font-bold uppercase bg-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || !linkProjectForm.project_id}
                  className="px-5 py-2 border-2 border-[#171717] font-black uppercase bg-[#FFD83D] shadow-[2px_2px_0px_#171717] disabled:opacity-50"
                >
                  {formSubmitting ? 'Menyimpan...' : 'Hubungkan Proyek'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
