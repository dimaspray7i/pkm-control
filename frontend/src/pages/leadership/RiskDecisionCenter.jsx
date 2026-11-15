import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Loader2,
  Filter,
  Search,
  Plus,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Calendar,
  Layers,
  Sparkles,
  Info,
  AlertCircle,
  FileText,
  UserCheck,
  Building2,
  FileBarChart,
  Target,
  Users,
  CheckSquare,
  ShieldCheck,
  AlertOctagon,
  FolderKanban,
  Zap,
  Flame,
  Scale,
  History,
  X,
  Check,
  Ban,
  TrendingDown,
  ArrowUpRight
} from 'lucide-react'

// Severity Themes
const SEVERITY_CONFIG = {
  critical: {
    label: 'Kritis',
    bg: 'bg-[#FF2F92]',
    text: 'text-white',
    border: 'border-[#171717]',
    badge: 'bg-[#FF2F92] text-white border-[#171717]',
    badgeLight: 'bg-[#FF2F92]/15 text-[#FF2F92] border-[#FF2F92]'
  },
  high: {
    label: 'Tinggi',
    bg: 'bg-[#FF8A00]',
    text: 'text-white',
    border: 'border-[#171717]',
    badge: 'bg-[#FF8A00] text-white border-[#171717]',
    badgeLight: 'bg-[#FF8A00]/15 text-[#C2410C] border-[#FF8A00]'
  },
  medium: {
    label: 'Sedang',
    bg: 'bg-[#FFD83D]',
    text: 'text-[#171717]',
    border: 'border-[#171717]',
    badge: 'bg-[#FFD83D] text-[#171717] border-[#171717]',
    badgeLight: 'bg-[#FFD83D]/25 text-[#B45309] border-[#D97706]'
  },
  low: {
    label: 'Rendah',
    bg: 'bg-[#10B981]',
    text: 'text-white',
    border: 'border-[#171717]',
    badge: 'bg-[#10B981] text-white border-[#171717]',
    badgeLight: 'bg-[#10B981]/15 text-[#047857] border-[#10B981]'
  }
}

// Decision Status Theme
const DECISION_STATUS_THEME = {
  draft:       { label: 'Draft',       badge: 'bg-[#EAE4D8] text-[#171717] border-[#171717]' },
  approved:    { label: 'Disetujui',   badge: 'bg-[#B8A0F0] text-[#171717] border-[#171717]' },
  in_progress: { label: 'Dikerjakan',  badge: 'bg-[#3B82F6] text-white border-[#171717]' },
  completed:   { label: 'Selesai',     badge: 'bg-[#10B981] text-white border-[#171717]' },
  cancelled:   { label: 'Dibatalkan',  badge: 'bg-[#737373] text-white border-[#171717]' },
}

// Blocker Status Theme
const BLOCKER_STATUS_THEME = {
  new:          { label: 'Baru Masuk',   badge: 'bg-[#FF2F92] text-white border-[#171717]' },
  acknowledged: { label: 'Ditinjau',     badge: 'bg-[#FFD83D] text-[#171717] border-[#171717]' },
  in_progress:  { label: 'Penanganan',   badge: 'bg-[#B8A0F0] text-[#171717] border-[#171717]' },
  resolved:     { label: 'Tuntas',       badge: 'bg-[#10B981] text-white border-[#171717]' },
}

const CATEGORIES = [
  { id: 'technical', label: 'Teknis & Arsitektur' },
  { id: 'financial', label: 'Finansial & Budget' },
  { id: 'operational', label: 'Operasional' },
  { id: 'resource', label: 'SDM & Kapasitas' },
  { id: 'timeline', label: 'Jadwal & Deadline' },
  { id: 'external', label: 'Pihak Ketiga / Vendor' },
  { id: 'compliance', label: 'Kepatuhan & Legal' },
]

export default function RiskDecisionCenter() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const currentTab = searchParams.get('tab') || 'register'

  // Loading states
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [successToast, setSuccessToast] = useState(null)

  // Master Data
  const [overview, setOverview] = useState(null)
  const [risks, setRisks] = useState([])
  const [decisions, setDecisions] = useState([])
  const [blockers, setBlockers] = useState([])
  const [automaticDetections, setAutomaticDetections] = useState([])
  const [escalations, setEscalations] = useState([])
  const [escalationsSummary, setEscalationsSummary] = useState(null)
  const [projectsList, setProjectsList] = useState([])
  const [usersList, setUsersList] = useState([])

  // Filters for Risk Register
  const [riskFilterSeverity, setRiskFilterSeverity] = useState('all')
  const [riskFilterStatus, setRiskFilterStatus] = useState('active')
  const [riskFilterCategory, setRiskFilterCategory] = useState('all')
  const [riskSearchQuery, setRiskSearchQuery] = useState('')

  // Filters for Decisions
  const [decFilterStatus, setDecFilterStatus] = useState('all')
  const [decFilterPriority, setDecFilterPriority] = useState('all')
  const [decSearchQuery, setDecSearchQuery] = useState('')

  // Filters for Blockers
  const [blockerFilterStatus, setBlockerFilterStatus] = useState('all')

  // Modals state
  const [showCreateRiskModal, setShowCreateRiskModal] = useState(false)
  const [showRiskDetailModal, setShowRiskDetailModal] = useState(false)
  const [selectedRisk, setSelectedRisk] = useState(null)

  const [showCreateDecisionModal, setShowCreateDecisionModal] = useState(false)
  const [showDecisionDetailModal, setShowDecisionDetailModal] = useState(false)
  const [selectedDecision, setSelectedDecision] = useState(null)

  const [showBlockerModal, setShowBlockerModal] = useState(false)
  const [selectedBlocker, setSelectedBlocker] = useState(null)

  // Form states - Create Risk
  const [riskForm, setRiskForm] = useState({
    title: '',
    category: 'technical',
    project_id: '',
    likelihood: 3,
    impact: 3,
    description: '',
    mitigation: '',
    owner_id: '',
    identified_date: new Date().toISOString().split('T')[0],
    target_resolution_date: '',
  })

  // Form states - Create Decision
  const [decisionForm, setDecisionForm] = useState({
    title: '',
    category: 'operational',
    priority: 'high',
    project_id: '',
    risk_id: '',
    underlying_problem: '',
    description: '',
    rationale: '',
    decision_date: new Date().toISOString().split('T')[0],
    status: 'draft',
    pic_id: '',
    due_date: '',
  })

  // Form states - Update Risk Status
  const [riskStatusUpdate, setRiskStatusUpdate] = useState({
    status: 'open',
    resolution_notes: '',
  })

  // Form states - Update Decision Status
  const [decisionStatusUpdate, setDecisionStatusUpdate] = useState({
    status: 'draft',
    pic_id: '',
    due_date: '',
    implementation_result: '',
    cancellation_reason: '',
    audit_notes: '',
  })

  // Form states - Update Blocker
  const [blockerStatusUpdate, setBlockerStatusUpdate] = useState({
    status: 'acknowledged',
    resolution_notes: '',
  })

  // Fetch initial data
  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setErrorMessage(null)

    try {
      const [
        overviewRes,
        risksRes,
        decisionsRes,
        blockersRes,
        autoRes,
        escalationsRes,
        projRes,
        usersRes
      ] = await Promise.all([
        api.get('/leadership/risk-overview'),
        api.get('/leadership/risks'),
        api.get('/leadership/decisions'),
        api.get('/leadership/blockers'),
        api.get('/leadership/automatic-risks'),
        api.get('/leadership/escalations'),
        api.get('/projects?per_page=100').catch(() => ({ data: { projects: { data: [] } } })),
        api.get('/users?per_page=100').catch(() => ({ data: { users: { data: [] } } })),
      ])

      setOverview(overviewRes.data)
      setRisks(risksRes.data.risks || risksRes.data.data || [])
      setDecisions(decisionsRes.data.decisions || decisionsRes.data.data || [])
      setBlockers(blockersRes.data.blockers || blockersRes.data.data || [])
      setAutomaticDetections(autoRes.data.detections || autoRes.data.data || [])
      setEscalations(escalationsRes.data.escalations || [])
      setEscalationsSummary(escalationsRes.data.summary || null)

      // Normalize project list
      const pList = projRes.data?.projects?.data || projRes.data?.projects || projRes.data || []
      setProjectsList(Array.isArray(pList) ? pList : [])

      // Normalize user list
      const uList = usersRes.data?.users?.data || usersRes.data?.users || usersRes.data || []
      setUsersList(Array.isArray(uList) ? uList : [])
    } catch (err) {
      console.error('Error loading risk and decision data:', err)
      setErrorMessage(err.response?.data?.message || 'Gagal memuat data Risk & Decision Center.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Show Toast Helper
  const triggerToast = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(null), 4000)
  }

  const handleTabChange = (newTab) => {
    setSearchParams({ tab: newTab })
  }

  // Calculated Matrix Score live preview for Risk Form
  const liveRiskScore = useMemo(() => {
    const l = parseInt(riskForm.likelihood, 10) || 1
    const i = parseInt(riskForm.impact, 10) || 1
    const s = l * i
    let lvl = 'low'
    if (s >= 17) lvl = 'critical'
    else if (s >= 10) lvl = 'high'
    else if (s >= 5) lvl = 'medium'
    return { score: s, level: lvl }
  }, [riskForm.likelihood, riskForm.impact])

  // Filtered Risks
  const filteredRisks = useMemo(() => {
    return risks.filter((r) => {
      if (riskFilterSeverity !== 'all' && r.risk_level !== riskFilterSeverity) return false
      if (riskFilterStatus === 'active') {
        if (!['open', 'mitigating', 'monitoring'].includes(r.status)) return false
      } else if (riskFilterStatus !== 'all' && r.status !== riskFilterStatus) {
        return false
      }
      if (riskFilterCategory !== 'all' && r.category !== riskFilterCategory) return false
      if (riskSearchQuery.trim()) {
        const q = riskSearchQuery.toLowerCase()
        const code = (r.risk_code || '').toLowerCase()
        const title = (r.title || '').toLowerCase()
        const proj = (r.project?.name || '').toLowerCase()
        if (!code.includes(q) && !title.includes(q) && !proj.includes(q)) return false
      }
      return true
    })
  }, [risks, riskFilterSeverity, riskFilterStatus, riskFilterCategory, riskSearchQuery])

  // Filtered Decisions
  const filteredDecisions = useMemo(() => {
    return decisions.filter((d) => {
      if (decFilterStatus !== 'all' && d.status !== decFilterStatus) return false
      if (decFilterPriority !== 'all' && d.priority !== decFilterPriority) return false
      if (decSearchQuery.trim()) {
        const q = decSearchQuery.toLowerCase()
        const num = (d.decision_number || '').toLowerCase()
        const title = (d.title || '').toLowerCase()
        const desc = (d.description || '').toLowerCase()
        if (!num.includes(q) && !title.includes(q) && !desc.includes(q)) return false
      }
      return true
    })
  }, [decisions, decFilterStatus, decFilterPriority, decSearchQuery])

  // Filtered Blockers
  const filteredBlockers = useMemo(() => {
    return blockers.filter((b) => {
      if (blockerFilterStatus !== 'all' && b.status !== blockerFilterStatus) return false
      return true
    })
  }, [blockers, blockerFilterStatus])

  // SUBMIT HANDLERS
  // 1. Create Risk
  const handleCreateRisk = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/leadership/risks', riskForm)
      triggerToast('Risiko strategis berhasil dicatat ke Risk Register.')
      setShowCreateRiskModal(false)
      setRiskForm({
        title: '',
        category: 'technical',
        project_id: '',
        likelihood: 3,
        impact: 3,
        description: '',
        mitigation: '',
        owner_id: '',
        identified_date: new Date().toISOString().split('T')[0],
        target_resolution_date: '',
      })
      fetchData(true)
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menyimpan risiko baru.')
    } finally {
      setSubmitting(false)
    }
  }

  // 2. Update Risk Status
  const handleUpdateRiskStatus = async (e) => {
    e.preventDefault()
    if (!selectedRisk) return
    if (riskStatusUpdate.status === 'resolved' && !riskStatusUpdate.resolution_notes?.trim()) {
      alert('Penutupan risiko (status resolved) mewajibkan pengisian catatan penyelesaian.')
      return
    }

    setSubmitting(true)
    try {
      await api.put(`/leadership/risks/${selectedRisk.id}`, riskStatusUpdate)
      triggerToast('Status risiko berhasil diperbarui.')
      setShowRiskDetailModal(false)
      fetchData(true)
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal memperbarui status risiko.')
    } finally {
      setSubmitting(false)
    }
  }

  // 3. Create Decision
  const handleCreateDecision = async (e) => {
    e.preventDefault()
    if (['approved', 'in_progress'].includes(decisionForm.status)) {
      if (!decisionForm.pic_id || !decisionForm.due_date) {
        alert('Keputusan yang disetujui / dikerjakan wajib menentukan PIC penanggung jawab dan tenggat waktu.')
        return
      }
    }

    setSubmitting(true)
    try {
      await api.post('/leadership/decisions', decisionForm)
      triggerToast('Keputusan eksekutif berhasil dicatat.')
      setShowCreateDecisionModal(false)
      setDecisionForm({
        title: '',
        category: 'operational',
        priority: 'high',
        project_id: '',
        risk_id: '',
        underlying_problem: '',
        description: '',
        rationale: '',
        decision_date: new Date().toISOString().split('T')[0],
        status: 'draft',
        pic_id: '',
        due_date: '',
      })
      fetchData(true)
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menyimpan keputusan eksekutif.')
    } finally {
      setSubmitting(false)
    }
  }

  // 4. Update Decision Status
  const handleUpdateDecisionStatus = async (e) => {
    e.preventDefault()
    if (!selectedDecision) return

    if (['approved', 'in_progress'].includes(decisionStatusUpdate.status)) {
      if (!decisionStatusUpdate.pic_id || !decisionStatusUpdate.due_date) {
        alert('Keputusan yang disetujui atau dikerjakan wajib memiliki PIC penanggung jawab dan tenggat waktu.')
        return
      }
    }

    if (decisionStatusUpdate.status === 'completed' && !decisionStatusUpdate.implementation_result?.trim()) {
      alert('Penyelesaian keputusan wajib mencantumkan hasil implementasi actual.')
      return
    }

    if (decisionStatusUpdate.status === 'cancelled' && !decisionStatusUpdate.cancellation_reason?.trim()) {
      alert('Pembatalan keputusan wajib mencantumkan alasan pembatalan.')
      return
    }

    setSubmitting(true)
    try {
      await api.put(`/leadership/decisions/${selectedDecision.id}`, decisionStatusUpdate)
      triggerToast('Status keputusan eksekutif dan audit trail berhasil diperbarui.')
      setShowDecisionDetailModal(false)
      fetchData(true)
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal memperbarui status keputusan.')
    } finally {
      setSubmitting(false)
    }
  }

  // 5. Update Blocker Status
  const handleUpdateBlockerStatus = async (e) => {
    e.preventDefault()
    if (!selectedBlocker) return

    setSubmitting(true)
    try {
      await api.put(`/leadership/blockers/${selectedBlocker.id}/status`, blockerStatusUpdate)
      triggerToast('Status penanganan kendala blocker berhasil diperbarui.')
      setShowBlockerModal(false)
      fetchData(true)
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal memperbarui status blocker.')
    } finally {
      setSubmitting(false)
    }
  }

  // Open Decision detail and prefill
  const openDecisionDetail = async (decision) => {
    try {
      const res = await api.get(`/leadership/decisions/${decision.id}`)
      const dec = res.data.decision || res.data.data
      setSelectedDecision(dec)
      setDecisionStatusUpdate({
        status: dec.status || 'draft',
        pic_id: dec.pic_id || '',
        due_date: dec.due_date ? dec.due_date.split('T')[0] : '',
        implementation_result: dec.implementation_result || '',
        cancellation_reason: dec.cancellation_reason || '',
        audit_notes: '',
      })
      setShowDecisionDetailModal(true)
    } catch (err) {
      alert('Gagal mengambil detail keputusan eksekutif.')
    }
  }

  // Open Risk detail and prefill
  const openRiskDetail = async (risk) => {
    try {
      const res = await api.get(`/leadership/risks/${risk.id}`)
      const r = res.data.risk || res.data.data
      setSelectedRisk(r)
      setRiskStatusUpdate({
        status: r.status || 'open',
        resolution_notes: r.resolution_notes || '',
      })
      setShowRiskDetailModal(true)
    } catch (err) {
      alert('Gagal mengambil detail risiko.')
    }
  }

  // Convert Anomaly to Risk
  const handleConvertAnomalyToRisk = (detection) => {
    setRiskForm({
      title: `${detection.risk_type}: ${detection.project_code || 'Sistem'}`,
      category: 'operational',
      project_id: detection.project_id || '',
      likelihood: detection.severity === 'critical' ? 5 : 4,
      impact: detection.severity === 'critical' ? 5 : 4,
      description: `${detection.factual_evidence}\n\nDampak Bisnis: ${detection.business_impact}`,
      mitigation: detection.recommendation,
      owner_id: '',
      identified_date: new Date().toISOString().split('T')[0],
      target_resolution_date: '',
    })
    setShowCreateRiskModal(true)
  }

  // Convert Anomaly to Decision
  const handleConvertAnomalyToDecision = (detection) => {
    setDecisionForm({
      title: `Intervensi: ${detection.risk_type} (${detection.project_code || 'General'})`,
      category: 'operational',
      priority: detection.severity === 'critical' ? 'critical' : 'high',
      project_id: detection.project_id || '',
      risk_id: '',
      underlying_problem: detection.factual_evidence,
      description: `Rekomendasi Eksekutif: ${detection.recommendation}`,
      rationale: detection.business_impact,
      decision_date: new Date().toISOString().split('T')[0],
      status: 'draft',
      pic_id: '',
      due_date: '',
    })
    setShowCreateDecisionModal(true)
  }

  return (
    <div className="min-h-screen bg-[#F5F1E9] p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 bg-[#10B981] text-white px-5 py-3 border-[3px] border-[#171717] shadow-[6px_6px_0px_#171717] animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-bold text-sm tracking-wide">{successToast}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-[#FFFFFF] border-[3px] border-[#171717] p-5 sm:p-6 shadow-[6px_6px_0px_#171717]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-[#FF2F92] text-white text-xs font-black px-2.5 py-1 border-[2px] border-[#171717] tracking-wider uppercase">
                C-Level Executive Hub
              </span>
              <span className="bg-[#FFD83D] text-[#171717] text-xs font-bold px-2.5 py-1 border-[2px] border-[#171717]">
                PT Potensi Karya Mandiri
              </span>
              {overview?.meta?.as_of_time && (
                <span className="text-xs font-mono text-[#737373]">
                  As of: {overview.meta.as_of_time}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#171717] tracking-tight uppercase flex items-center gap-2">
              <ShieldAlert className="w-8 h-8 text-[#FF2F92]" />
              Risk & Decision Center
            </h1>
            <p className="text-sm text-[#525252] max-w-3xl leading-relaxed">
              Pusat komando terpadu pimpinan untuk mengidentifikasi ancaman proyek, menindaklanjuti kendala lapangan, serta mencatat keputusan strategis berbasis data aktual.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing || loading}
              className="flex items-center gap-2 bg-[#EAE4D8] hover:bg-[#DCD5C6] text-[#171717] px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-[2px] border-[#171717] shadow-[3px_3px_0px_#171717] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
            >
              <RotateCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Memperbarui...' : 'Sinkronisasi'}</span>
            </button>

            <button
              onClick={() => setShowCreateRiskModal(true)}
              className="flex items-center gap-2 bg-[#FFD83D] hover:bg-[#FACC15] text-[#171717] px-4 py-2.5 font-black text-xs uppercase tracking-wider border-[2px] border-[#171717] shadow-[3px_3px_0px_#171717] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Risiko Baru</span>
            </button>

            <button
              onClick={() => setShowCreateDecisionModal(true)}
              className="flex items-center gap-2 bg-[#FF2F92] hover:bg-[#E61E7E] text-white px-4 py-2.5 font-black text-xs uppercase tracking-wider border-[2px] border-[#171717] shadow-[3px_3px_0px_#171717] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              <Scale className="w-4 h-4" />
              <span>Buat Keputusan</span>
            </button>
          </div>
        </div>
      </div>

      {/* METRICS OVERVIEW (8 EXECUTIVE CARDS) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
        {/* 1. Total Active Risks */}
        <div className="bg-[#FFFFFF] border-[2px] border-[#171717] p-3.5 shadow-[4px_4px_0px_#171717]">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#737373] block truncate">
            Risiko Aktif
          </span>
          <div className="text-2xl font-black text-[#171717] mt-1">
            {loading ? '...' : (overview?.risks_summary?.total_active ?? 0)}
          </div>
          <span className="text-[10px] font-semibold text-[#171717]/70 block mt-0.5">
            Open & Mitigation
          </span>
        </div>

        {/* 2. Critical Risks */}
        <div className="bg-[#FF2F92]/10 border-[2px] border-[#FF2F92] p-3.5 shadow-[4px_4px_0px_#171717]">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#FF2F92] block truncate">
            Kritis (17-25)
          </span>
          <div className="text-2xl font-black text-[#FF2F92] mt-1">
            {loading ? '...' : (overview?.risks_summary?.critical ?? 0)}
          </div>
          <span className="text-[10px] font-bold text-[#FF2F92] block mt-0.5">
            Intervensi Utama
          </span>
        </div>

        {/* 3. High Risks */}
        <div className="bg-[#FF8A00]/10 border-[2px] border-[#FF8A00] p-3.5 shadow-[4px_4px_0px_#171717]">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#C2410C] block truncate">
            Tinggi (10-16)
          </span>
          <div className="text-2xl font-black text-[#C2410C] mt-1">
            {loading ? '...' : (overview?.risks_summary?.high ?? 0)}
          </div>
          <span className="text-[10px] font-semibold text-[#C2410C] block mt-0.5">
            Perlu Monitor
          </span>
        </div>

        {/* 4. Medium Risks */}
        <div className="bg-[#FFD83D]/15 border-[2px] border-[#D97706] p-3.5 shadow-[4px_4px_0px_#171717]">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#B45309] block truncate">
            Sedang (5-9)
          </span>
          <div className="text-2xl font-black text-[#B45309] mt-1">
            {loading ? '...' : (overview?.risks_summary?.medium ?? 0)}
          </div>
          <span className="text-[10px] font-semibold text-[#B45309] block mt-0.5">
            Rutin Tim
          </span>
        </div>

        {/* 5. Low Risks */}
        <div className="bg-[#10B981]/10 border-[2px] border-[#10B981] p-3.5 shadow-[4px_4px_0px_#171717]">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#047857] block truncate">
            Rendah (1-4)
          </span>
          <div className="text-2xl font-black text-[#047857] mt-1">
            {loading ? '...' : (overview?.risks_summary?.low ?? 0)}
          </div>
          <span className="text-[10px] font-semibold text-[#047857] block mt-0.5">
            Terkontrol
          </span>
        </div>

        {/* 6. Resolved Risks */}
        <div className="bg-[#FFFFFF] border-[2px] border-[#171717] p-3.5 shadow-[4px_4px_0px_#171717]">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#737373] block truncate">
            Terselesaikan
          </span>
          <div className="text-2xl font-black text-[#10B981] mt-1">
            {loading ? '...' : (overview?.risks_summary?.resolved ?? 0)}
          </div>
          <span className="text-[10px] font-semibold text-[#737373] block mt-0.5">
            Mitigasi Tuntas
          </span>
        </div>

        {/* 7. Overdue Follow-ups */}
        <div className="bg-[#FFFFFF] border-[2px] border-[#171717] p-3.5 shadow-[4px_4px_0px_#171717]">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#EF4444] block truncate">
            Tenggat Lewat
          </span>
          <div className="text-2xl font-black text-[#EF4444] mt-1">
            {loading ? '...' : ((overview?.risks_summary?.overdue ?? 0) + (overview?.decisions_summary?.overdue ?? 0))}
          </div>
          <span className="text-[10px] font-semibold text-[#EF4444] block mt-0.5">
            Risiko & Keputusan
          </span>
        </div>

        {/* 8. Active Blockers */}
        <div className="bg-[#B8A0F0]/15 border-[2px] border-[#6D28D9] p-3.5 shadow-[4px_4px_0px_#171717]">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#6D28D9] block truncate">
            Blocker Aktif
          </span>
          <div className="text-2xl font-black text-[#6D28D9] mt-1">
            {loading ? '...' : (overview?.blockers_summary?.total_active ?? 0)}
          </div>
          <span className="text-[10px] font-semibold text-[#6D28D9] block mt-0.5">
            Dari Laporan Tugas
          </span>
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div className="flex border-b-[3px] border-[#171717] gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => handleTabChange('register')}
          className={`flex items-center gap-2 px-5 py-3 font-black text-xs sm:text-sm uppercase tracking-wider border-t-[3px] border-x-[3px] border-[#171717] transition-all whitespace-nowrap ${
            currentTab === 'register'
              ? 'bg-[#FFD83D] text-[#171717] shadow-[4px_0px_0px_#171717] -mb-[3px] z-10'
              : 'bg-[#FFFFFF] text-[#525252] hover:bg-[#EAE4D8]'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>1. Risk Register</span>
          <span className="ml-1 px-2 py-0.5 text-xs bg-[#171717] text-white rounded-full">
            {risks.length}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('decisions')}
          className={`flex items-center gap-2 px-5 py-3 font-black text-xs sm:text-sm uppercase tracking-wider border-t-[3px] border-x-[3px] border-[#171717] transition-all whitespace-nowrap ${
            currentTab === 'decisions'
              ? 'bg-[#B8A0F0] text-[#171717] shadow-[4px_0px_0px_#171717] -mb-[3px] z-10'
              : 'bg-[#FFFFFF] text-[#525252] hover:bg-[#EAE4D8]'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>2. Executive Decisions</span>
          <span className="ml-1 px-2 py-0.5 text-xs bg-[#171717] text-white rounded-full">
            {decisions.length}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('blockers')}
          className={`flex items-center gap-2 px-5 py-3 font-black text-xs sm:text-sm uppercase tracking-wider border-t-[3px] border-x-[3px] border-[#171717] transition-all whitespace-nowrap ${
            currentTab === 'blockers'
              ? 'bg-[#FFFFFF] text-[#171717] border-b-[3px] border-b-transparent shadow-[4px_0px_0px_#171717] -mb-[3px] z-10 font-bold'
              : 'bg-[#FFFFFF] text-[#525252] hover:bg-[#EAE4D8]'
          }`}
        >
          <AlertOctagon className="w-4 h-4 text-[#FF2F92]" />
          <span>3. Blocker Monitoring</span>
          <span className="ml-1 px-2 py-0.5 text-xs bg-[#FF2F92] text-white rounded-full font-mono">
            {blockers.filter(b => b.status !== 'resolved').length}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('detections')}
          className={`flex items-center gap-2 px-5 py-3 font-black text-xs sm:text-sm uppercase tracking-wider border-t-[3px] border-x-[3px] border-[#171717] transition-all whitespace-nowrap ${
            currentTab === 'detections'
              ? 'bg-[#FFD83D] text-[#171717] shadow-[4px_0px_0px_#171717] -mb-[3px] z-10'
              : 'bg-[#FFFFFF] text-[#525252] hover:bg-[#EAE4D8]'
          }`}
        >
          <Zap className="w-4 h-4 text-[#FF8A00]" />
          <span>4. Automatic Detections</span>
          <span className="ml-1 px-2 py-0.5 text-xs bg-[#FF8A00] text-white rounded-full">
            {automaticDetections.length}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('escalations')}
          className={`flex items-center gap-2 px-5 py-3 font-black text-xs sm:text-sm uppercase tracking-wider border-t-[3px] border-x-[3px] border-[#171717] transition-all whitespace-nowrap ${
            currentTab === 'escalations'
              ? 'bg-[#FF2F92] text-white shadow-[4px_0px_0px_#171717] -mb-[3px] z-10'
              : 'bg-[#FFFFFF] text-[#525252] hover:bg-[#EAE4D8]'
          }`}
        >
          <Flame className="w-4 h-4 animate-pulse" />
          <span>5. Escalation Center</span>
          <span className="ml-1 px-2 py-0.5 text-xs bg-[#171717] text-white rounded-full">
            {escalations.length}
          </span>
        </button>
      </div>

      {/* TAB 1: RISK REGISTER */}
      {currentTab === 'register' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-[#FFFFFF] border-[3px] border-[#171717] p-4 shadow-[4px_4px_0px_#171717] flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari kode risiko, judul, atau nama proyek..."
                  value={riskSearchQuery}
                  onChange={(e) => setRiskSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#F5F1E9] border-[2px] border-[#171717] text-xs font-semibold focus:outline-none focus:bg-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={riskFilterSeverity}
                onChange={(e) => setRiskFilterSeverity(e.target.value)}
                className="px-3 py-2 bg-[#F5F1E9] border-[2px] border-[#171717] text-xs font-bold focus:outline-none"
              >
                <option value="all">Semua Level Dampak</option>
                <option value="critical">Kritis (Score 17-25)</option>
                <option value="high">Tinggi (Score 10-16)</option>
                <option value="medium">Sedang (Score 5-9)</option>
                <option value="low">Rendah (Score 1-4)</option>
              </select>

              <select
                value={riskFilterStatus}
                onChange={(e) => setRiskFilterStatus(e.target.value)}
                className="px-3 py-2 bg-[#F5F1E9] border-[2px] border-[#171717] text-xs font-bold focus:outline-none"
              >
                <option value="active">Status: Aktif (Open/Mitigasi)</option>
                <option value="all">Status: Semua</option>
                <option value="open">Open</option>
                <option value="mitigating">Mitigating</option>
                <option value="monitoring">Monitoring</option>
                <option value="resolved">Resolved</option>
                <option value="accepted">Accepted</option>
              </select>

              <select
                value={riskFilterCategory}
                onChange={(e) => setRiskFilterCategory(e.target.value)}
                className="px-3 py-2 bg-[#F5F1E9] border-[2px] border-[#171717] text-xs font-bold focus:outline-none"
              >
                <option value="all">Semua Kategori</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Risks Table / Card list */}
          {filteredRisks.length === 0 ? (
            <div className="bg-[#FFFFFF] border-[3px] border-[#171717] p-12 text-center shadow-[4px_4px_0px_#171717]">
              <ShieldCheck className="w-12 h-12 text-[#10B981] mx-auto mb-3" />
              <h3 className="text-lg font-black text-[#171717]">Tidak Ada Risiko Ditemukan</h3>
              <p className="text-sm text-[#737373] mt-1 max-w-md mx-auto">
                Kriteria filter saat ini tidak menemukan catatan risiko strategis. Anda dapat mencatat risiko baru atau mengatur ulang filter.
              </p>
            </div>
          ) : (
            <div className="bg-[#FFFFFF] border-[3px] border-[#171717] shadow-[6px_6px_0px_#171717] overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#EAE4D8] border-b-[2px] border-[#171717]">
                    <th className="p-3 font-black text-[#171717] uppercase tracking-wider">Kode & Judul Risiko</th>
                    <th className="p-3 font-black text-[#171717] uppercase tracking-wider">Proyek & Kategori</th>
                    <th className="p-3 font-black text-[#171717] uppercase tracking-wider text-center">L × I</th>
                    <th className="p-3 font-black text-[#171717] uppercase tracking-wider text-center">Score</th>
                    <th className="p-3 font-black text-[#171717] uppercase tracking-wider text-center">Severity</th>
                    <th className="p-3 font-black text-[#171717] uppercase tracking-wider">Owner / PIC</th>
                    <th className="p-3 font-black text-[#171717] uppercase tracking-wider">Tenggat</th>
                    <th className="p-3 font-black text-[#171717] uppercase tracking-wider text-center">Status</th>
                    <th className="p-3 font-black text-[#171717] uppercase tracking-wider text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y-[2px] divide-[#171717]">
                  {filteredRisks.map((r) => {
                    const sev = SEVERITY_CONFIG[r.risk_level] || SEVERITY_CONFIG.low
                    return (
                      <tr key={r.id} className="hover:bg-[#F5F1E9]/80 transition-colors">
                        <td className="p-3 font-medium">
                          <span className="font-mono font-black text-[#737373] block text-[11px]">
                            {r.risk_code}
                          </span>
                          <span className="font-bold text-[#171717] text-sm block">
                            {r.title}
                          </span>
                          {r.description && (
                            <span className="text-[11px] text-[#525252] line-clamp-1 block mt-0.5">
                              {r.description}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-[#171717] block">
                            {r.project?.name || 'Seluruh Portofolio'}
                          </span>
                          <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-bold bg-[#EAE4D8] border border-[#171717]">
                            {r.category}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono font-bold">
                          {r.likelihood} × {r.impact}
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-black text-base px-2 py-1 bg-[#171717] text-white">
                            {r.risk_score}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-1 text-[10px] font-black uppercase border tracking-wider ${sev.badge}`}>
                            {sev.label}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-[#171717] block">
                            {r.owner?.name || r.owner_name || 'Belum Ditunjuk'}
                          </span>
                          <span className="text-[10px] text-[#737373]">
                            Identified: {r.identified_date}
                          </span>
                        </td>
                        <td className="p-3 font-mono">
                          {r.target_resolution_date ? (
                            <span className={r.target_resolution_date < new Date().toISOString().split('T')[0] && r.status !== 'resolved' ? 'text-[#EF4444] font-bold' : 'text-[#171717]'}>
                              {r.target_resolution_date}
                            </span>
                          ) : (
                            <span className="text-[#737373] italic">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 text-[10px] font-black uppercase border border-[#171717] bg-[#FFFFFF]">
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => openRiskDetail(r)}
                            className="bg-[#171717] hover:bg-[#333333] text-white px-3 py-1.5 font-bold text-[11px] uppercase tracking-wider border border-[#171717] active:translate-x-[1px] active:translate-y-[1px]"
                          >
                            Detail & Tindak
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EXECUTIVE DECISIONS */}
      {currentTab === 'decisions' && (
        <div className="space-y-4">
          {/* Decisions Filter */}
          <div className="bg-[#FFFFFF] border-[3px] border-[#171717] p-4 shadow-[4px_4px_0px_#171717] flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nomor keputusan, judul, atau uraian..."
                  value={decSearchQuery}
                  onChange={(e) => setDecSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#F5F1E9] border-[2px] border-[#171717] text-xs font-semibold focus:outline-none focus:bg-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={decFilterStatus}
                onChange={(e) => setDecFilterStatus(e.target.value)}
                className="px-3 py-2 bg-[#F5F1E9] border-[2px] border-[#171717] text-xs font-bold focus:outline-none"
              >
                <option value="all">Semua Status Keputusan</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                value={decFilterPriority}
                onChange={(e) => setDecFilterPriority(e.target.value)}
                className="px-3 py-2 bg-[#F5F1E9] border-[2px] border-[#171717] text-xs font-bold focus:outline-none"
              >
                <option value="all">Semua Prioritas</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Decisions Grid */}
          {filteredDecisions.length === 0 ? (
            <div className="bg-[#FFFFFF] border-[3px] border-[#171717] p-12 text-center shadow-[4px_4px_0px_#171717]">
              <Scale className="w-12 h-12 text-[#737373] mx-auto mb-3" />
              <h3 className="text-lg font-black text-[#171717]">Belum Ada Keputusan Eksekutif</h3>
              <p className="text-sm text-[#737373] mt-1 max-w-md mx-auto">
                Gunakan tombol "Buat Keputusan" untuk meresmikan langkah intervensi strategis dan menetapkan PIC pelaksana.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDecisions.map((d) => {
                const statusMeta = DECISION_STATUS_THEME[d.status] || DECISION_STATUS_THEME.draft
                const isOverdue = ['approved', 'in_progress'].includes(d.status) && d.due_date && d.due_date < new Date().toISOString().split('T')[0]

                return (
                  <div
                    key={d.id}
                    className="bg-[#FFFFFF] border-[3px] border-[#171717] p-5 shadow-[5px_5px_0px_#171717] flex flex-col justify-between space-y-4 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[7px_7px_0px_#171717] transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-black text-xs text-[#737373] bg-[#EAE4D8] px-2 py-0.5 border border-[#171717]">
                          {d.decision_number}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 text-[10px] font-black uppercase border ${statusMeta.badge}`}>
                            {statusMeta.label}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase border border-[#171717] bg-[#FFD83D]">
                            {d.priority}
                          </span>
                        </div>
                      </div>

                      <h3 className="font-black text-base text-[#171717] line-clamp-2">
                        {d.title}
                      </h3>

                      <p className="text-xs text-[#525252] line-clamp-3">
                        {d.description}
                      </p>

                      {d.project && (
                        <div className="flex items-center gap-1.5 text-xs text-[#171717] font-semibold pt-1">
                          <FolderKanban className="w-3.5 h-3.5 text-[#FF2F92]" />
                          <span className="truncate">{d.project.name}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 pt-3 border-t-[2px] border-[#171717]/10">
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-[#737373] block text-[10px] font-bold uppercase">PIC Eksekusi</span>
                          <span className="font-bold text-[#171717] truncate block">
                            {d.pic?.name || d.pic_name || 'Belum Ditunjuk'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#737373] block text-[10px] font-bold uppercase">Tenggat Waktu</span>
                          <span className={`font-mono font-bold block ${isOverdue ? 'text-[#EF4444]' : 'text-[#171717]'}`}>
                            {d.due_date || '-'} {isOverdue && '(TERLEWAT)'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => openDecisionDetail(d)}
                        className="w-full flex items-center justify-center gap-2 bg-[#EAE4D8] hover:bg-[#DCD5C6] text-[#171717] py-2 font-black text-xs uppercase tracking-wider border-[2px] border-[#171717] active:translate-x-[1px] active:translate-y-[1px]"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Detail & Audit Trail</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: BLOCKER MONITORING */}
      {currentTab === 'blockers' && (
        <div className="space-y-4">
          <div className="bg-[#FFFFFF] border-[3px] border-[#171717] p-4 shadow-[4px_4px_0px_#171717] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-base text-[#171717] flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-[#FF2F92]" />
                Pemantauan Kendala Lapangan (Blocker Stream)
              </h2>
              <p className="text-xs text-[#737373]">
                Ditarik langsung dari pelaporan harian anggota tim secara append-only. Pimpinan dapat memperbarui status penanganan tanpa merusak riwayat pelapor.
              </p>
            </div>

            <select
              value={blockerFilterStatus}
              onChange={(e) => setBlockerFilterStatus(e.target.value)}
              className="px-3 py-2 bg-[#F5F1E9] border-[2px] border-[#171717] text-xs font-bold focus:outline-none"
            >
              <option value="all">Semua Status Penanganan</option>
              <option value="new">Baru Masuk</option>
              <option value="acknowledged">Ditinjau</option>
              <option value="in_progress">Dalam Penanganan</option>
              <option value="resolved">Tuntas / Selesai</option>
            </select>
          </div>

          {filteredBlockers.length === 0 ? (
            <div className="bg-[#FFFFFF] border-[3px] border-[#171717] p-12 text-center shadow-[4px_4px_0px_#171717]">
              <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto mb-3" />
              <h3 className="text-lg font-black text-[#171717]">Tidak Ada Kendala Lapangan Aktif</h3>
              <p className="text-sm text-[#737373] mt-1 max-w-md mx-auto">
                Seluruh blocker anggota tim telah terselesaikan atau belum ada pelaporan kendala baru.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBlockers.map((b) => {
                const bTheme = BLOCKER_STATUS_THEME[b.status] || BLOCKER_STATUS_THEME.new
                const isAged = b.days_open >= 2 && b.status !== 'resolved'

                return (
                  <div
                    key={b.id}
                    className={`bg-[#FFFFFF] border-[3px] border-[#171717] p-4 sm:p-5 shadow-[4px_4px_0px_#171717] flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isAged ? 'border-l-[8px] border-l-[#FF2F92]' : ''
                    }`}
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 text-[10px] font-black uppercase border ${bTheme.badge}`}>
                          {bTheme.label}
                        </span>
                        <span className="font-mono text-xs font-bold bg-[#EAE4D8] px-2 py-0.5 border border-[#171717]">
                          {b.project_code || 'PKM-000'}
                        </span>
                        <span className="text-xs font-semibold text-[#737373]">
                          Tugas: <strong className="text-[#171717]">{b.task_title}</strong>
                        </span>
                        {isAged && (
                          <span className="px-2 py-0.5 text-[10px] font-black bg-[#EF4444] text-white border border-[#171717] animate-pulse">
                            TERTAHAN {b.days_open} HARI
                          </span>
                        )}
                      </div>

                      <div className="bg-[#F5F1E9] border-[2px] border-[#171717] p-3 text-xs text-[#171717]">
                        <span className="font-black text-[#FF2F92] block mb-1">KENDALA DILAPORKAN:</span>
                        <p className="font-medium italic">"{b.blocker}"</p>
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-[#737373] flex-wrap">
                        <span>Pelapor: <strong className="text-[#171717]">{b.reported_by_name}</strong></span>
                        <span>Waktu Lapor: <strong className="text-[#171717]">{b.reported_at ? b.reported_at.split('T')[0] : '-'}</strong></span>
                        {b.acknowledged_by && (
                          <span>Ditangani Oleh: <strong className="text-[#171717]">{b.acknowledged_by}</strong></span>
                        )}
                      </div>

                      {b.resolution_notes && (
                        <div className="text-xs text-[#047857] bg-[#10B981]/10 border border-[#10B981] p-2 mt-1">
                          <strong>Catatan Penyelesaian:</strong> {b.resolution_notes}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={() => {
                          setSelectedBlocker(b)
                          setBlockerStatusUpdate({
                            status: b.status || 'acknowledged',
                            resolution_notes: b.resolution_notes || '',
                          })
                          setShowBlockerModal(true)
                        }}
                        className="bg-[#FFD83D] hover:bg-[#FACC15] text-[#171717] px-4 py-2 font-black text-xs uppercase tracking-wider border-[2px] border-[#171717] shadow-[2px_2px_0px_#171717] active:translate-x-[1px] active:translate-y-[1px]"
                      >
                        Tindak Lanjuti Blocker
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AUTOMATIC DETECTIONS */}
      {currentTab === 'detections' && (
        <div className="space-y-4">
          <div className="bg-[#FFFFFF] border-[3px] border-[#171717] p-4 shadow-[4px_4px_0px_#171717]">
            <h2 className="font-black text-base text-[#171717] flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#FF8A00]" />
              Automatic Risk Detection Engine
            </h2>
            <p className="text-xs text-[#737373] mt-0.5">
              Deteksi anomali operasional otomatis berbasis rule-based heuristics: proyek berstatus delayed, deviasi negatif target &le; -20%, kendala lapangan tertahan, dan milestone terlambat.
            </p>
          </div>

          {automaticDetections.length === 0 ? (
            <div className="bg-[#FFFFFF] border-[3px] border-[#171717] p-12 text-center shadow-[4px_4px_0px_#171717]">
              <Sparkles className="w-12 h-12 text-[#10B981] mx-auto mb-3" />
              <h3 className="text-lg font-black text-[#171717]">Tidak Ada Anomali Signifikan</h3>
              <p className="text-sm text-[#737373] mt-1 max-w-md mx-auto">
                Mesin deteksi tidak menemukan deviasi di atas ambang batas kritis pada portofolio saat ini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {automaticDetections.map((det, idx) => {
                const sev = SEVERITY_CONFIG[det.severity] || SEVERITY_CONFIG.medium

                return (
                  <div
                    key={det.fingerprint || idx}
                    className="bg-[#FFFFFF] border-[3px] border-[#171717] p-5 shadow-[5px_5px_0px_#171717] flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-black uppercase border ${sev.badge}`}>
                          {sev.label}
                        </span>
                        <span className="font-mono text-[10px] text-[#737373] bg-[#EAE4D8] px-2 py-0.5 border border-[#171717]">
                          {det.fingerprint}
                        </span>
                      </div>

                      <h3 className="font-black text-base text-[#171717]">
                        {det.risk_type}
                      </h3>

                      <div className="text-xs font-semibold text-[#FF2F92] flex items-center gap-1.5">
                        <FolderKanban className="w-3.5 h-3.5" />
                        <span>{det.project_name} ({det.project_code})</span>
                      </div>

                      <div className="space-y-2 text-xs pt-1">
                        <div className="bg-[#F5F1E9] p-2.5 border-[2px] border-[#171717]">
                          <strong className="text-[#171717] block mb-0.5">Bukti Data Faktual:</strong>
                          <p className="text-[#525252] font-mono text-[11px]">{det.factual_evidence}</p>
                        </div>

                        <div className="bg-[#FFD83D]/15 p-2.5 border-[2px] border-[#171717]">
                          <strong className="text-[#B45309] block mb-0.5">Dampak Bisnis:</strong>
                          <p className="text-[#171717]">{det.business_impact}</p>
                        </div>

                        <div className="bg-[#B8A0F0]/20 p-2.5 border-[2px] border-[#171717]">
                          <strong className="text-[#6D28D9] block mb-0.5">Rekomendasi Eksekutif:</strong>
                          <p className="text-[#171717]">{det.recommendation}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t-[2px] border-[#171717]/10">
                      <button
                        onClick={() => handleConvertAnomalyToRisk(det)}
                        className="flex-1 bg-[#FFD83D] hover:bg-[#FACC15] text-[#171717] py-2 font-black text-xs uppercase tracking-wider border-[2px] border-[#171717] active:translate-x-[1px] active:translate-y-[1px]"
                      >
                        + Catat ke Risk Register
                      </button>
                      <button
                        onClick={() => handleConvertAnomalyToDecision(det)}
                        className="flex-1 bg-[#FF2F92] hover:bg-[#E61E7E] text-white py-2 font-black text-xs uppercase tracking-wider border-[2px] border-[#171717] active:translate-x-[1px] active:translate-y-[1px]"
                      >
                        + Buat Keputusan
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ESCALATION CENTER */}
      {currentTab === 'escalations' && (
        <div className="space-y-4">
          <div className="bg-[#FF2F92] text-white border-[3px] border-[#171717] p-5 shadow-[6px_6px_0px_#171717]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="bg-[#171717] text-white text-[10px] font-black px-2 py-0.5 uppercase tracking-wider border border-white">
                  URGENT C-LEVEL INTERVENTION
                </span>
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                  <Flame className="w-6 h-6" />
                  Executive Escalation Center
                </h2>
                <p className="text-xs text-white/90 max-w-2xl">
                  Daftar masalah prioritas tinggi yang membutuhkan keputusan pimpinan secara langsung guna mengeliminasi hambatan proyek.
                </p>
              </div>

              {escalationsSummary && (
                <div className="flex items-center gap-2 bg-[#171717] text-white p-3 border-2 border-white text-xs font-mono">
                  <div>
                    <span className="text-white/60 text-[10px] block">TOTAL ESKALASI</span>
                    <span className="text-xl font-black text-[#FFD83D]">{escalationsSummary.total_escalations}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {escalations.length === 0 ? (
            <div className="bg-[#FFFFFF] border-[3px] border-[#171717] p-12 text-center shadow-[4px_4px_0px_#171717]">
              <ShieldCheck className="w-12 h-12 text-[#10B981] mx-auto mb-3" />
              <h3 className="text-lg font-black text-[#171717]">Tidak Ada Eskalasi Kritis</h3>
              <p className="text-sm text-[#737373] mt-1 max-w-md mx-auto">
                Seluruh proyek berjalan tanpa kendala kritis atau tenggat keputusan yang terlewati.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {escalations.map((esc) => {
                const isCrit = esc.urgency === 'critical'

                return (
                  <div
                    key={esc.id}
                    className={`bg-[#FFFFFF] border-[3px] border-[#171717] p-5 shadow-[5px_5px_0px_#171717] flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isCrit ? 'border-l-[10px] border-l-[#FF2F92]' : 'border-l-[10px] border-l-[#FF8A00]'
                    }`}
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 text-[10px] font-black uppercase border ${
                          isCrit ? 'bg-[#FF2F92] text-white' : 'bg-[#FF8A00] text-white'
                        } border-[#171717]`}>
                          URGENCY: {esc.urgency}
                        </span>
                        <span className="font-mono text-xs font-bold bg-[#EAE4D8] px-2 py-0.5 border border-[#171717]">
                          {esc.source_type?.toUpperCase()}
                        </span>
                        {esc.project_code && (
                          <span className="font-bold text-xs text-[#171717]">
                            {esc.project_name} ({esc.project_code})
                          </span>
                        )}
                      </div>

                      <h3 className="font-black text-base text-[#171717]">
                        {esc.issue}
                      </h3>

                      <div className="bg-[#F5F1E9] p-3 border-[2px] border-[#171717] text-xs font-mono space-y-1">
                        <div><strong>Fakta:</strong> {esc.data_evidence}</div>
                        <div><strong>Dampak:</strong> {esc.impact}</div>
                      </div>

                      <div className="text-xs text-[#6D28D9] font-semibold bg-[#B8A0F0]/20 p-2.5 border border-[#6D28D9]">
                        <strong>Rekomendasi Tindakan:</strong> {esc.action_recommendation}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <button
                        onClick={() => {
                          setDecisionForm({
                            title: `Resolusi: ${esc.issue}`,
                            category: 'operational',
                            priority: 'critical',
                            project_id: '',
                            risk_id: '',
                            underlying_problem: esc.data_evidence,
                            description: esc.action_recommendation,
                            rationale: esc.impact,
                            decision_date: new Date().toISOString().split('T')[0],
                            status: 'draft',
                            pic_id: '',
                            due_date: '',
                          })
                          setShowCreateDecisionModal(true)
                        }}
                        className="bg-[#FF2F92] hover:bg-[#E61E7E] text-white py-2 px-3 font-black text-xs uppercase tracking-wider border-[2px] border-[#171717] shadow-[2px_2px_0px_#171717] active:translate-x-[1px] active:translate-y-[1px] text-center"
                      >
                        Intervensi Keputusan
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: CREATE STRATEGIC RISK                               */}
      {/* ============================================================ */}
      {showCreateRiskModal && (
        <div className="fixed inset-0 z-50 bg-[#171717]/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] border-[4px] border-[#171717] max-w-2xl w-full p-6 shadow-[8px_8px_0px_#171717] space-y-4 my-8">
            <div className="flex items-center justify-between border-b-[3px] border-[#171717] pb-3">
              <h2 className="text-lg font-black text-[#171717] uppercase flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-[#FF2F92]" />
                Catat Risiko Baru ke Risk Register
              </h2>
              <button
                onClick={() => setShowCreateRiskModal(false)}
                className="p-1 hover:bg-[#EAE4D8] border border-[#171717]"
              >
                <X className="w-5 h-5 text-[#171717]" />
              </button>
            </div>

            <form onSubmit={handleCreateRisk} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-[#171717] uppercase">Judul Risiko *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Keterlambatan Integrasi Payment Gateway API"
                  value={riskForm.title}
                  onChange={(e) => setRiskForm({ ...riskForm, title: e.target.value })}
                  className="w-full p-2.5 bg-[#F5F1E9] border-[2px] border-[#171717] font-semibold focus:outline-none focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#171717] uppercase">Kategori *</label>
                  <select
                    value={riskForm.category}
                    onChange={(e) => setRiskForm({ ...riskForm, category: e.target.value })}
                    className="w-full p-2.5 bg-[#F5F1E9] border-[2px] border-[#171717] font-bold focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[#171717] uppercase">Proyek Terkait</label>
                  <select
                    value={riskForm.project_id}
                    onChange={(e) => setRiskForm({ ...riskForm, project_id: e.target.value })}
                    className="w-full p-2.5 bg-[#F5F1E9] border-[2px] border-[#171717] font-semibold focus:outline-none"
                  >
                    <option value="">-- Seluruh Portofolio / Umum --</option>
                    {projectsList.map((p) => (
                      <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Likelihood & Impact 1-5 with Live Score */}
              <div className="bg-[#EAE4D8] border-[2px] border-[#171717] p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs uppercase text-[#171717]">Perhitungan Matriks Risiko</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs">Score: {liveRiskScore.score}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase border ${
                      SEVERITY_CONFIG[liveRiskScore.level].badge
                    }`}>
                      {SEVERITY_CONFIG[liveRiskScore.level].label}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#171717] mb-1">
                      Kemungkinan (Likelihood: 1 - 5)
                    </label>
                    <select
                      value={riskForm.likelihood}
                      onChange={(e) => setRiskForm({ ...riskForm, likelihood: parseInt(e.target.value, 10) })}
                      className="w-full p-2 bg-[#FFFFFF] border-[2px] border-[#171717] font-bold"
                    >
                      <option value={1}>1 - Sangat Jarang</option>
                      <option value={2}>2 - Jarang</option>
                      <option value={3}>3 - Mungkin</option>
                      <option value={4}>4 - Sering</option>
                      <option value={5}>5 - Hampir Pasti</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#171717] mb-1">
                      Dampak (Impact: 1 - 5)
                    </label>
                    <select
                      value={riskForm.impact}
                      onChange={(e) => setRiskForm({ ...riskForm, impact: parseInt(e.target.value, 10) })}
                      className="w-full p-2 bg-[#FFFFFF] border-[2px] border-[#171717] font-bold"
                    >
                      <option value={1}>1 - Sangat Ringan</option>
                      <option value={2}>2 - Ringan</option>
                      <option value={3}>3 - Sedang</option>
                      <option value={4}>4 - Berat</option>
                      <option value={5}>5 - Kritis / Fatal</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#171717] uppercase">Uraian Risiko</label>
                <textarea
                  rows={3}
                  placeholder="Jelaskan kondisi dan akar potensi masalah..."
                  value={riskForm.description}
                  onChange={(e) => setRiskForm({ ...riskForm, description: e.target.value })}
                  className="w-full p-2.5 bg-[#F5F1E9] border-[2px] border-[#171717] font-medium focus:outline-none focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#171717] uppercase">Rencana Mitigasi</label>
                <textarea
                  rows={2}
                  placeholder="Langkah antisipatif atau opsi cadangan..."
                  value={riskForm.mitigation}
                  onChange={(e) => setRiskForm({ ...riskForm, mitigation: e.target.value })}
                  className="w-full p-2.5 bg-[#F5F1E9] border-[2px] border-[#171717] font-medium focus:outline-none focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#171717] uppercase">PIC / Risk Owner</label>
                  <select
                    value={riskForm.owner_id}
                    onChange={(e) => setRiskForm({ ...riskForm, owner_id: e.target.value })}
                    className="w-full p-2 bg-[#F5F1E9] border-[2px] border-[#171717] font-semibold focus:outline-none"
                  >
                    <option value="">-- Pilih PIC --</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[#171717] uppercase">Tgl Identifikasi *</label>
                  <input
                    type="date"
                    required
                    value={riskForm.identified_date}
                    onChange={(e) => setRiskForm({ ...riskForm, identified_date: e.target.value })}
                    className="w-full p-2 bg-[#F5F1E9] border-[2px] border-[#171717] font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[#171717] uppercase">Target Penyelesaian</label>
                  <input
                    type="date"
                    value={riskForm.target_resolution_date}
                    onChange={(e) => setRiskForm({ ...riskForm, target_resolution_date: e.target.value })}
                    className="w-full p-2 bg-[#F5F1E9] border-[2px] border-[#171717] font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t-[2px] border-[#171717]">
                <button
                  type="button"
                  onClick={() => setShowCreateRiskModal(false)}
                  className="px-4 py-2 border-[2px] border-[#171717] font-bold text-xs uppercase hover:bg-[#EAE4D8]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#FF2F92] hover:bg-[#E61E7E] text-white px-5 py-2 font-black text-xs uppercase tracking-wider border-[2px] border-[#171717] shadow-[3px_3px_0px_#171717] active:translate-x-[1px] active:translate-y-[1px]"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Risiko'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: RISK DETAIL & RESOLUTION                            */}
      {/* ============================================================ */}
      {showRiskDetailModal && selectedRisk && (
        <div className="fixed inset-0 z-50 bg-[#171717]/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] border-[4px] border-[#171717] max-w-2xl w-full p-6 shadow-[8px_8px_0px_#171717] space-y-4 my-8 text-xs">
            <div className="flex items-center justify-between border-b-[3px] border-[#171717] pb-3">
              <div>
                <span className="font-mono font-bold text-[#737373]">{selectedRisk.risk_code}</span>
                <h2 className="text-lg font-black text-[#171717] uppercase">{selectedRisk.title}</h2>
              </div>
              <button
                onClick={() => setShowRiskDetailModal(false)}
                className="p-1 hover:bg-[#EAE4D8] border border-[#171717]"
              >
                <X className="w-5 h-5 text-[#171717]" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#F5F1E9] p-3 border-[2px] border-[#171717]">
              <div>
                <span className="text-[#737373] text-[10px] font-bold uppercase block">Kategori</span>
                <span className="font-bold text-[#171717]">{selectedRisk.category}</span>
              </div>
              <div>
                <span className="text-[#737373] text-[10px] font-bold uppercase block">Nilai Risiko</span>
                <span className="font-black text-[#171717]">{selectedRisk.likelihood} × {selectedRisk.impact} = {selectedRisk.risk_score}</span>
              </div>
              <div>
                <span className="text-[#737373] text-[10px] font-bold uppercase block">Tingkat Severity</span>
                <span className={`px-2 py-0.5 text-[10px] font-black uppercase border ${
                  SEVERITY_CONFIG[selectedRisk.risk_level]?.badge || 'bg-gray-200'
                }`}>
                  {selectedRisk.risk_level}
                </span>
              </div>
              <div>
                <span className="text-[#737373] text-[10px] font-bold uppercase block">Status Saat Ini</span>
                <span className="font-bold uppercase text-[#171717]">{selectedRisk.status}</span>
              </div>
            </div>

            {selectedRisk.description && (
              <div className="space-y-1">
                <span className="font-bold uppercase text-[#171717]">Deskripsi Risiko:</span>
                <p className="p-2.5 bg-[#F5F1E9] border border-[#171717] font-medium leading-relaxed">
                  {selectedRisk.description}
                </p>
              </div>
            )}

            {selectedRisk.mitigation && (
              <div className="space-y-1">
                <span className="font-bold uppercase text-[#171717]">Rencana Mitigasi:</span>
                <p className="p-2.5 bg-[#FFD83D]/15 border border-[#171717] font-medium leading-relaxed">
                  {selectedRisk.mitigation}
                </p>
              </div>
            )}

            {/* Update Status Form */}
            <form onSubmit={handleUpdateRiskStatus} className="border-t-[2px] border-[#171717] pt-4 space-y-3">
              <span className="font-black text-sm uppercase text-[#171717] block">Pembaruan Status Penanganan</span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#171717] uppercase">Ubah Status</label>
                  <select
                    value={riskStatusUpdate.status}
                    onChange={(e) => setRiskStatusUpdate({ ...riskStatusUpdate, status: e.target.value })}
                    className="w-full p-2 bg-[#F5F1E9] border-[2px] border-[#171717] font-bold"
                  >
                    <option value="open">Open (Terbuka)</option>
                    <option value="mitigating">Mitigating (Dalam Tindakan)</option>
                    <option value="monitoring">Monitoring (Dipantau)</option>
                    <option value="resolved">Resolved (Tuntas)</option>
                    <option value="accepted">Accepted (Diterima / Toleransi)</option>
                  </select>
                </div>
              </div>

              {riskStatusUpdate.status === 'resolved' && (
                <div className="space-y-1 bg-[#10B981]/10 p-3 border-[2px] border-[#10B981]">
                  <label className="font-bold text-[#047857] uppercase">
                    Catatan Penyelesaian (Wajib Saat Resolved) *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Jelaskan bagaimana risiko ini berhasil dimitigasi atau diselesaikan..."
                    value={riskStatusUpdate.resolution_notes}
                    onChange={(e) => setRiskStatusUpdate({ ...riskStatusUpdate, resolution_notes: e.target.value })}
                    className="w-full p-2 bg-white border border-[#10B981] font-medium"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRiskDetailModal(false)}
                  className="px-4 py-2 border-[2px] border-[#171717] font-bold uppercase hover:bg-[#EAE4D8]"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#171717] hover:bg-[#333333] text-white px-5 py-2 font-black uppercase tracking-wider border-[2px] border-[#171717] shadow-[3px_3px_0px_#171717] active:translate-x-[1px] active:translate-y-[1px]"
                >
                  {submitting ? 'Memperbarui...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: CREATE EXECUTIVE DECISION                           */}
      {/* ============================================================ */}
      {showCreateDecisionModal && (
        <div className="fixed inset-0 z-50 bg-[#171717]/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] border-[4px] border-[#171717] max-w-2xl w-full p-6 shadow-[8px_8px_0px_#171717] space-y-4 my-8 text-xs">
            <div className="flex items-center justify-between border-b-[3px] border-[#171717] pb-3">
              <h2 className="text-lg font-black text-[#171717] uppercase flex items-center gap-2">
                <Scale className="w-6 h-6 text-[#B8A0F0]" />
                Buat Keputusan Eksekutif Baru
              </h2>
              <button
                onClick={() => setShowCreateDecisionModal(false)}
                className="p-1 hover:bg-[#EAE4D8] border border-[#171717]"
              >
                <X className="w-5 h-5 text-[#171717]" />
              </button>
            </div>

            <form onSubmit={handleCreateDecision} className="space-y-3">
              <div className="space-y-1">
                <label className="font-bold text-[#171717] uppercase">Judul Keputusan *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pengadaan Server Tambahan untuk Mempercepat Pemulihan DB"
                  value={decisionForm.title}
                  onChange={(e) => setDecisionForm({ ...decisionForm, title: e.target.value })}
                  className="w-full p-2.5 bg-[#F5F1E9] border-[2px] border-[#171717] font-semibold focus:outline-none focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#171717] uppercase">Kategori *</label>
                  <select
                    value={decisionForm.category}
                    onChange={(e) => setDecisionForm({ ...decisionForm, category: e.target.value })}
                    className="w-full p-2 bg-[#F5F1E9] border-[2px] border-[#171717] font-bold"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[#171717] uppercase">Prioritas *</label>
                  <select
                    value={decisionForm.priority}
                    onChange={(e) => setDecisionForm({ ...decisionForm, priority: e.target.value })}
                    className="w-full p-2 bg-[#F5F1E9] border-[2px] border-[#171717] font-bold"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[#171717] uppercase">Proyek Terkait</label>
                  <select
                    value={decisionForm.project_id}
                    onChange={(e) => setDecisionForm({ ...decisionForm, project_id: e.target.value })}
                    className="w-full p-2 bg-[#F5F1E9] border-[2px] border-[#171717] font-semibold"
                  >
                    <option value="">-- Umum / Organisasi --</option>
                    {projectsList.map((p) => (
                      <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#171717] uppercase">Uraian Keputusan *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Instruksi dan langkah definitif yang diputuskan..."
                  value={decisionForm.description}
                  onChange={(e) => setDecisionForm({ ...decisionForm, description: e.target.value })}
                  className="w-full p-2.5 bg-[#F5F1E9] border-[2px] border-[#171717] font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#171717] uppercase">Latar Belakang / Masalah</label>
                  <textarea
                    rows={2}
                    placeholder="Mengapa keputusan ini harus diambil..."
                    value={decisionForm.underlying_problem}
                    onChange={(e) => setDecisionForm({ ...decisionForm, underlying_problem: e.target.value })}
                    className="w-full p-2 bg-[#F5F1E9] border-[2px] border-[#171717] font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[#171717] uppercase">Dampak yang Diharapkan</label>
                  <textarea
                    rows={2}
                    placeholder="Ekspektasi hasil nyata dari keputusan ini..."
                    value={decisionForm.rationale}
                    onChange={(e) => setDecisionForm({ ...decisionForm, rationale: e.target.value })}
                    className="w-full p-2 bg-[#F5F1E9] border-[2px] border-[#171717] font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#EAE4D8] p-3 border-[2px] border-[#171717]">
                <div className="space-y-1">
                  <label className="font-bold text-[#171717] uppercase">Status Awal *</label>
                  <select
                    value={decisionForm.status}
                    onChange={(e) => setDecisionForm({ ...decisionForm, status: e.target.value })}
                    className="w-full p-2 bg-[#FFFFFF] border-[2px] border-[#171717] font-bold"
                  >
                    <option value="draft">Draft (Draf Awal)</option>
                    <option value="approved">Approved (Langsung Setujui)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[#171717] uppercase">
                    PIC Penanggung Jawab {['approved', 'in_progress'].includes(decisionForm.status) && '*'}
                  </label>
                  <select
                    value={decisionForm.pic_id}
                    onChange={(e) => setDecisionForm({ ...decisionForm, pic_id: e.target.value })}
                    className="w-full p-2 bg-[#FFFFFF] border-[2px] border-[#171717] font-semibold"
                  >
                    <option value="">-- Pilih PIC --</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[#171717] uppercase">
                    Tenggat Selesai {['approved', 'in_progress'].includes(decisionForm.status) && '*'}
                  </label>
                  <input
                    type="date"
                    value={decisionForm.due_date}
                    onChange={(e) => setDecisionForm({ ...decisionForm, due_date: e.target.value })}
                    className="w-full p-2 bg-[#FFFFFF] border-[2px] border-[#171717] font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t-[2px] border-[#171717]">
                <button
                  type="button"
                  onClick={() => setShowCreateDecisionModal(false)}
                  className="px-4 py-2 border-[2px] border-[#171717] font-bold uppercase hover:bg-[#EAE4D8]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#B8A0F0] hover:bg-[#9B80DF] text-[#171717] px-5 py-2 font-black uppercase tracking-wider border-[2px] border-[#171717] shadow-[3px_3px_0px_#171717] active:translate-x-[1px] active:translate-y-[1px]"
                >
                  {submitting ? 'Menyimpan...' : 'Rilis Keputusan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: DECISION DETAIL & AUDIT TRAIL                       */}
      {/* ============================================================ */}
      {showDecisionDetailModal && selectedDecision && (
        <div className="fixed inset-0 z-50 bg-[#171717]/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] border-[4px] border-[#171717] max-w-3xl w-full p-6 shadow-[8px_8px_0px_#171717] space-y-4 my-8 text-xs">
            <div className="flex items-center justify-between border-b-[3px] border-[#171717] pb-3">
              <div>
                <span className="font-mono font-bold text-[#737373]">{selectedDecision.decision_number}</span>
                <h2 className="text-lg font-black text-[#171717] uppercase">{selectedDecision.title}</h2>
              </div>
              <button
                onClick={() => setShowDecisionDetailModal(false)}
                className="p-1 hover:bg-[#EAE4D8] border border-[#171717]"
              >
                <X className="w-5 h-5 text-[#171717]" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#F5F1E9] p-3 border-[2px] border-[#171717]">
              <div>
                <span className="text-[#737373] text-[10px] font-bold uppercase block">Kategori</span>
                <span className="font-bold text-[#171717]">{selectedDecision.category}</span>
              </div>
              <div>
                <span className="text-[#737373] text-[10px] font-bold uppercase block">Prioritas</span>
                <span className="font-black uppercase text-[#171717]">{selectedDecision.priority}</span>
              </div>
              <div>
                <span className="text-[#737373] text-[10px] font-bold uppercase block">Status</span>
                <span className="font-black uppercase text-[#171717]">{selectedDecision.status}</span>
              </div>
              <div>
                <span className="text-[#737373] text-[10px] font-bold uppercase block">Dibuat Oleh</span>
                <span className="font-bold text-[#171717]">{selectedDecision.creator?.name || 'Pimpinan'}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="font-bold uppercase text-[#171717]">Isi Keputusan:</span>
              <p className="p-3 bg-[#F5F1E9] border border-[#171717] font-medium leading-relaxed">
                {selectedDecision.description}
              </p>
            </div>

            {selectedDecision.implementation_result && (
              <div className="space-y-1">
                <span className="font-bold uppercase text-[#047857]">Hasil Implementasi Nyata:</span>
                <p className="p-2.5 bg-[#10B981]/15 border border-[#10B981] font-semibold text-[#047857]">
                  {selectedDecision.implementation_result}
                </p>
              </div>
            )}

            {/* AUDIT TRAIL LOG */}
            <div className="space-y-2">
              <span className="font-black uppercase text-[#171717] flex items-center gap-1.5">
                <History className="w-4 h-4 text-[#FF2F92]" />
                Audit Trail & Jejak Perubahan
              </span>
              <div className="bg-[#F5F1E9] border-[2px] border-[#171717] p-3 max-h-40 overflow-y-auto space-y-2">
                {selectedDecision.audits && selectedDecision.audits.length > 0 ? (
                  selectedDecision.audits.map((a, idx) => (
                    <div key={a.id || idx} className="border-b border-[#171717]/10 pb-2 text-[11px] last:border-b-0">
                      <div className="flex items-center justify-between font-mono text-[10px] text-[#737373]">
                        <span>{a.user_name || a.user?.name} &bull; {a.action?.toUpperCase()}</span>
                        <span>{a.created_at ? a.created_at.replace('T', ' ').substring(0, 19) : ''}</span>
                      </div>
                      <p className="font-semibold text-[#171717] mt-0.5">{a.notes}</p>
                      {a.changes && (
                        <div className="mt-1 text-[10px] bg-white p-1 border font-mono">
                          {Object.entries(a.changes).map(([k, v]) => (
                            <div key={k}>
                              <strong>{k}:</strong> {typeof v === 'object' ? `${v.from || 'null'} → ${v.to || 'null'}` : JSON.stringify(v)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <span className="text-[#737373] italic">Belum ada riwayat perubahan.</span>
                )}
              </div>
            </div>

            {/* UPDATE DECISION STATUS */}
            <form onSubmit={handleUpdateDecisionStatus} className="border-t-[2px] border-[#171717] pt-3 space-y-3">
              <span className="font-black text-xs uppercase text-[#171717] block">Perbarui Status Keputusan</span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-[#171717] uppercase block mb-1">Status Baru</label>
                  <select
                    value={decisionStatusUpdate.status}
                    onChange={(e) => setDecisionStatusUpdate({ ...decisionStatusUpdate, status: e.target.value })}
                    className="w-full p-2 bg-[#F5F1E9] border-[2px] border-[#171717] font-bold"
                  >
                    <option value="draft">Draft</option>
                    <option value="approved">Approved (Disetujui)</option>
                    <option value="in_progress">In Progress (Sedang Dikerjakan)</option>
                    <option value="completed">Completed (Selesai Tuntas)</option>
                    <option value="cancelled">Cancelled (Dibatalkan)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[#171717] uppercase block mb-1">PIC Pelaksana</label>
                  <select
                    value={decisionStatusUpdate.pic_id}
                    onChange={(e) => setDecisionStatusUpdate({ ...decisionStatusUpdate, pic_id: e.target.value })}
                    className="w-full p-2 bg-[#F5F1E9] border-[2px] border-[#171717] font-semibold"
                  >
                    <option value="">-- Pilih PIC --</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[#171717] uppercase block mb-1">Tenggat Selesai</label>
                  <input
                    type="date"
                    value={decisionStatusUpdate.due_date}
                    onChange={(e) => setDecisionStatusUpdate({ ...decisionStatusUpdate, due_date: e.target.value })}
                    className="w-full p-2 bg-[#F5F1E9] border-[2px] border-[#171717] font-mono font-bold"
                  />
                </div>
              </div>

              {decisionStatusUpdate.status === 'completed' && (
                <div className="bg-[#10B981]/15 p-3 border-[2px] border-[#10B981] space-y-1">
                  <label className="font-bold text-[#047857] uppercase">Hasil Implementasi (Wajib Saat Selesai) *</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Laporkan hasil aktual eksekusi keputusan..."
                    value={decisionStatusUpdate.implementation_result}
                    onChange={(e) => setDecisionStatusUpdate({ ...decisionStatusUpdate, implementation_result: e.target.value })}
                    className="w-full p-2 bg-white border border-[#10B981]"
                  />
                </div>
              )}

              {decisionStatusUpdate.status === 'cancelled' && (
                <div className="bg-[#EF4444]/15 p-3 border-[2px] border-[#EF4444] space-y-1">
                  <label className="font-bold text-[#EF4444] uppercase">Alasan Pembatalan (Wajib Saat Batal) *</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Alasan keputusan ini dibatalkan..."
                    value={decisionStatusUpdate.cancellation_reason}
                    onChange={(e) => setDecisionStatusUpdate({ ...decisionStatusUpdate, cancellation_reason: e.target.value })}
                    className="w-full p-2 bg-white border border-[#EF4444]"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-[#737373] uppercase">Catatan Audit Tambahan</label>
                <input
                  type="text"
                  placeholder="Keterangan singkat perubahan (tercatat di audit trail)..."
                  value={decisionStatusUpdate.audit_notes}
                  onChange={(e) => setDecisionStatusUpdate({ ...decisionStatusUpdate, audit_notes: e.target.value })}
                  className="w-full p-2 bg-[#F5F1E9] border border-[#171717]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDecisionDetailModal(false)}
                  className="px-4 py-2 border-[2px] border-[#171717] font-bold uppercase hover:bg-[#EAE4D8]"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#171717] hover:bg-[#333333] text-white px-5 py-2 font-black uppercase tracking-wider border-[2px] border-[#171717] shadow-[3px_3px_0px_#171717] active:translate-x-[1px] active:translate-y-[1px]"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan & Rekam Audit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 5: UPDATE BLOCKER STATUS                               */}
      {/* ============================================================ */}
      {showBlockerModal && selectedBlocker && (
        <div className="fixed inset-0 z-50 bg-[#171717]/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] border-[4px] border-[#171717] max-w-lg w-full p-6 shadow-[8px_8px_0px_#171717] space-y-4 my-8 text-xs">
            <div className="flex items-center justify-between border-b-[3px] border-[#171717] pb-3">
              <h2 className="text-base font-black text-[#171717] uppercase flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-[#FF2F92]" />
                Tindak Lanjut Blocker Lapangan
              </h2>
              <button
                onClick={() => setShowBlockerModal(false)}
                className="p-1 hover:bg-[#EAE4D8] border border-[#171717]"
              >
                <X className="w-5 h-5 text-[#171717]" />
              </button>
            </div>

            <div className="bg-[#F5F1E9] border-[2px] border-[#171717] p-3 space-y-2">
              <span className="font-bold text-[#737373] block">Tugas: {selectedBlocker.task_title}</span>
              <p className="font-medium italic text-[#171717]">"{selectedBlocker.blocker}"</p>
              <div className="text-[11px] text-[#737373] pt-1 border-t border-[#171717]/10">
                Dilaporkan oleh <strong>{selectedBlocker.reported_by_name}</strong> ({selectedBlocker.days_open} hari lalu)
              </div>
            </div>

            <form onSubmit={handleUpdateBlockerStatus} className="space-y-3">
              <div className="space-y-1">
                <label className="font-bold text-[#171717] uppercase">Status Penanganan</label>
                <select
                  value={blockerStatusUpdate.status}
                  onChange={(e) => setBlockerStatusUpdate({ ...blockerStatusUpdate, status: e.target.value })}
                  className="w-full p-2.5 bg-[#F5F1E9] border-[2px] border-[#171717] font-bold"
                >
                  <option value="new">Baru Masuk (New)</option>
                  <option value="acknowledged">Ditinjau Pimpinan (Acknowledged)</option>
                  <option value="in_progress">Dalam Penanganan / Koordinasi (In Progress)</option>
                  <option value="resolved">Tuntas / Selesai (Resolved)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#171717] uppercase">Catatan Resolusi / Arahan Pimpinan</label>
                <textarea
                  rows={3}
                  placeholder="Instruksi penyelesaian atau catatan koordinasi..."
                  value={blockerStatusUpdate.resolution_notes}
                  onChange={(e) => setBlockerStatusUpdate({ ...blockerStatusUpdate, resolution_notes: e.target.value })}
                  className="w-full p-2.5 bg-[#F5F1E9] border-[2px] border-[#171717] font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBlockerModal(false)}
                  className="px-4 py-2 border-[2px] border-[#171717] font-bold uppercase hover:bg-[#EAE4D8]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#10B981] hover:bg-[#059669] text-white px-5 py-2 font-black uppercase tracking-wider border-[2px] border-[#171717] shadow-[3px_3px_0px_#171717] active:translate-x-[1px] active:translate-y-[1px]"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Penanganan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
