import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import PageLoading from '../../components/ui/PageLoading'
import {
  Zap,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Search,
  Filter,
  Plus,
  ArrowRight,
  ShieldAlert,
  FolderKanban,
  User,
  Calendar,
  Layers,
  Sparkles,
  Info,
  X,
  Check,
  Building2,
  TrendingUp,
  FileText,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Compass,
  ArrowUpRight,
  Target,
  History,
  Send
} from 'lucide-react'

const PRIORITY_THEME = {
  critical: { label: 'Kritis', badge: 'bg-[#FF2F92] text-white', border: 'border-[#FF2F92]' },
  high:     { label: 'Tinggi', badge: 'bg-[#FFD83D] text-[#171717]', border: 'border-[#FFD83D]' },
  medium:   { label: 'Sedang', badge: 'bg-[#B8A0F0] text-[#171717]', border: 'border-[#B8A0F0]' },
  low:      { label: 'Rendah', badge: 'bg-[#EAE4D8] text-[#171717]', border: 'border-[#171717]/30' },
}

const STATUS_THEME = {
  pending:     { label: 'Pending',     bg: 'bg-white text-[#171717]',       border: 'border-[#171717]' },
  in_progress: { label: 'In Progress', bg: 'bg-[#FFD83D] text-[#171717]',   border: 'border-[#171717]' },
  blocked:     { label: 'Blocked',     bg: 'bg-[#FF2F92] text-white',       border: 'border-[#171717]' },
  completed:   { label: 'Selesai',     bg: 'bg-[#10B981] text-white',       border: 'border-[#171717]' },
  cancelled:   { label: 'Dibatalkan',  bg: 'bg-[#171717]/20 text-[#171717]', border: 'border-[#171717]/40' },
}

const SOURCE_LABELS = {
  business_intelligence: { label: 'Business Intelligence', bg: 'bg-[#FFD83D]/40 text-[#171717]' },
  strategic_risk:        { label: 'Risiko Strategis',      bg: 'bg-[#FF2F92]/20 text-[#FF2F92]' },
  executive_decision:    { label: 'Keputusan Eksekutif',   bg: 'bg-[#B8A0F0]/40 text-[#171717]' },
  financial_alert:       { label: 'Peringatan Finansial',  bg: 'bg-[#FF2F92]/30 text-[#171717]' },
  strategic_initiative:  { label: 'Inisiatif Strategis',   bg: 'bg-[#10B981]/20 text-[#065F46]' },
  manual:                { label: 'Arahan Manual',         bg: 'bg-[#EAE4D8] text-[#171717]' },
}

export default function ExecutiveActionCenter() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [summary, setSummary] = useState(null)
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  // Modals & form state
  const [selectedAction, setSelectedAction] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showConvertModal, setShowConvertModal] = useState(false)

  // Reference lookups for create / convert
  const [usersList, setUsersList] = useState([])
  const [projectsList, setProjectsList] = useState([])

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')

  // Create Form State
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    priority: 'high',
    assigned_to: '',
    due_date: '',
    project_id: '',
    source_type: 'manual',
  })
  const [submittingCreate, setSubmittingCreate] = useState(false)

  // Update Detail Form State
  const [updateStatus, setUpdateStatus] = useState('')
  const [updateProgress, setUpdateProgress] = useState(0)
  const [completionNotes, setCompletionNotes] = useState('')
  const [additionalNote, setAdditionalNote] = useState('')
  const [submittingUpdate, setSubmittingUpdate] = useState(false)

  // Convert Form State
  const [convertProjectId, setConvertProjectId] = useState('')
  const [convertAssigneeId, setConvertAssigneeId] = useState('')
  const [submittingConvert, setSubmittingConvert] = useState(false)

  const abortControllerRef = useRef(null)

  const fetchData = async (isManual = false) => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      if (isManual) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const [summaryRes, actionsRes, usersRes, projectsRes] = await Promise.allSettled([
        api.get('/leadership/actions/summary', { signal: controller.signal }),
        api.get('/leadership/actions', { signal: controller.signal }),
        api.get('/users', { signal: controller.signal }),
        api.get('/projects', { signal: controller.signal }),
      ])

      if (summaryRes.status === 'fulfilled' && summaryRes.value.data?.success) {
        setSummary(summaryRes.value.data.summary)
      }
      if (actionsRes.status === 'fulfilled' && actionsRes.value.data?.success) {
        setActions(actionsRes.value.data.actions || [])
      } else if (actionsRes.status === 'rejected') {
        throw new Error(actionsRes.reason?.response?.data?.message || 'Gagal memuat daftar tindakan.')
      }
      if (usersRes.status === 'fulfilled' && usersRes.value.data?.users) {
        setUsersList(usersRes.value.data.users || [])
      }
      if (projectsRes.status === 'fulfilled' && projectsRes.value.data?.projects) {
        setProjectsList(projectsRes.value.data.projects || [])
      }
    } catch (err) {
      if (controller.signal.aborted) return
      console.error('Error fetching actions:', err)
      setError(err.message || 'Terjadi kesalahan saat memuat data tindakan eksekutif.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [])

  const handleOpenDetail = async (action) => {
    setSelectedAction(action)
    setUpdateStatus(action.status)
    setUpdateProgress(action.progress || 0)
    setCompletionNotes(action.completion_notes || '')
    setAdditionalNote('')
    setShowDetailModal(true)
    setDetailLoading(true)

    try {
      const res = await api.get(`/leadership/actions/${action.id}`)
      if (res.data?.success && res.data.action) {
        setSelectedAction(res.data.action)
        setUpdateStatus(res.data.action.status)
        setUpdateProgress(res.data.action.progress || 0)
        setCompletionNotes(res.data.action.completion_notes || '')
      }
    } catch (err) {
      console.error('Failed to load full action detail:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!createForm.title) return
    setSubmittingCreate(true)

    try {
      const res = await api.post('/leadership/actions', {
        title: createForm.title,
        description: createForm.description || null,
        priority: createForm.priority,
        assigned_to: createForm.assigned_to ? Number(createForm.assigned_to) : null,
        due_date: createForm.due_date || null,
        project_id: createForm.project_id ? Number(createForm.project_id) : null,
        source_type: createForm.source_type,
      })

      if (res.data?.success) {
        setShowCreateModal(false)
        setCreateForm({
          title: '',
          description: '',
          priority: 'high',
          assigned_to: '',
          due_date: '',
          project_id: '',
          source_type: 'manual',
        })
        fetchData(true)
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal membuat tindakan eksekutif.')
    } finally {
      setSubmittingCreate(false)
    }
  }

  const handleUpdateSubmit = async (e) => {
    e.preventDefault()
    if (!selectedAction) return
    setSubmittingUpdate(true)

    try {
      const payload = {
        status: updateStatus,
        progress: updateProgress,
        completion_notes: updateStatus === 'completed' ? completionNotes : undefined,
        additional_note: additionalNote || undefined,
      }

      const res = await api.put(`/leadership/actions/${selectedAction.id}`, payload)
      if (res.data?.success) {
        setShowDetailModal(false)
        fetchData(true)
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal memperbarui tindakan.')
    } finally {
      setSubmittingUpdate(false)
    }
  }

  const handleCancelSubmit = async (e) => {
    e.preventDefault()
    if (!selectedAction || !cancelReason.trim()) return

    try {
      const res = await api.post(`/leadership/actions/${selectedAction.id}/cancel`, {
        reason: cancelReason,
      })
      if (res.data?.success) {
        setShowCancelModal(false)
        setShowDetailModal(false)
        setCancelReason('')
        fetchData(true)
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal membatalkan tindakan.')
    }
  }

  const handleConvertSubmit = async (e) => {
    e.preventDefault()
    if (!selectedAction) return
    setSubmittingConvert(true)

    try {
      const payload = {
        project_id: convertProjectId ? Number(convertProjectId) : selectedAction.project_id,
        assignee_id: convertAssigneeId ? Number(convertAssigneeId) : selectedAction.assigned_to,
      }

      const res = await api.post(`/leadership/actions/${selectedAction.id}/convert-task`, payload)
      if (res.data?.success) {
        setShowConvertModal(false)
        setShowDetailModal(false)
        alert(`Tindakan berhasil dikonversi menjadi tugas proyek #${res.data.task.id}!`)
        fetchData(true)
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengonversi tindakan ke tugas proyek.')
    } finally {
      setSubmittingConvert(false)
    }
  }

  // Filtered actions
  const filteredActions = useMemo(() => {
    return actions.filter((act) => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'overdue') {
          const isOverdue =
            !['completed', 'cancelled'].includes(act.status) &&
            act.due_date &&
            new Date(act.due_date) < new Date()
          if (!isOverdue) return false
        } else if (act.status !== statusFilter) {
          return false
        }
      }

      if (priorityFilter !== 'all' && act.priority !== priorityFilter) {
        return false
      }

      if (sourceFilter !== 'all' && act.source_type !== sourceFilter) {
        return false
      }

      if (search.trim()) {
        const q = search.toLowerCase()
        const matchTitle = act.title?.toLowerCase().includes(q)
        const matchCode = act.action_code?.toLowerCase().includes(q)
        const matchAssignee = act.assigned_user?.name?.toLowerCase().includes(q)
        const matchSource = act.source_title?.toLowerCase().includes(q)
        if (!matchTitle && !matchCode && !matchAssignee && !matchSource) return false
      }

      return true
    })
  }, [actions, statusFilter, priorityFilter, sourceFilter, search])

  // Grouped by Priority for Board Layout
  const criticalActions = useMemo(() => filteredActions.filter((a) => a.priority === 'critical'), [filteredActions])
  const highActions = useMemo(() => filteredActions.filter((a) => a.priority === 'high'), [filteredActions])
  const mediumActions = useMemo(() => filteredActions.filter((a) => a.priority === 'medium'), [filteredActions])
  const lowActions = useMemo(() => filteredActions.filter((a) => a.priority === 'low'), [filteredActions])

  const canManage = ['admin', 'pimpinan'].includes(user?.role)

  if (loading && !summary) {
    return (
      <PageLoading
        mode="page"
        text="Memuat Executive Action Center..."
        subtext="Mengagregasi daftar tindakan prioritas, progres eksekusi, dan riwayat audit."
      />
    )
  }

  return (
    <div className="space-y-6 pb-16">
      {/* =========================================================================
          1. EXECUTIVE HEADER
      ========================================================================= */}
      <div className="bg-white border-2 border-[#171717] rounded-xl p-5 sm:p-6 shadow-[3px_3px_0px_#171717] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-[#FF2F92]/10 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider bg-[#FF2F92] text-white rounded">
                STRATEGIC EXECUTION
              </span>
              <span className="text-[11px] font-bold text-[#171717]/60">
                Insight-to-Action Center &bull; PT Potensi Karya Mandiri
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-[#171717] tracking-tight leading-none uppercase">
              Executive Action Center
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-[#171717]/70 mt-1 max-w-2xl">
              Pusat komando eksekusi tindak lanjut strategis menghubungkan deteksi Business Intelligence menjadi tindakan nyata dengan penanggung jawab, tenggat waktu, dan audit riwayat.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="px-4 py-2.5 bg-[#F5F1E9] hover:bg-[#EAE4D8] border border-[#171717] font-black text-xs uppercase rounded-lg shadow-[2px_2px_0px_#171717] flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <RotateCcw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Menyinkronkan...' : 'Segarkan'}</span>
            </button>

            {canManage && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2.5 bg-[#FFD83D] hover:bg-[#e6c335] border-2 border-[#171717] font-black text-xs uppercase rounded-lg shadow-[2px_2px_0px_#171717] flex items-center gap-2 cursor-pointer transition-all"
              >
                <Plus size={15} />
                <span>Buat Tindakan</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. ACTION KPI OVERVIEW STRIP
      ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-white border-2 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717]">
          <span className="text-[10px] font-black uppercase text-[#171717]/60">Total Tindakan</span>
          <p className="font-display text-2xl text-[#171717] mt-1">{summary?.total_actions ?? 0}</p>
          <span className="text-[10px] font-bold text-[#171717]/50">Terdaftar di sistem</span>
        </div>

        <div className="p-4 bg-white border-2 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717]">
          <span className="text-[10px] font-black uppercase text-[#171717]/60">Pending</span>
          <p className="font-display text-2xl text-[#171717] mt-1">{summary?.pending_count ?? 0}</p>
          <span className="text-[10px] font-bold text-[#171717]/50">Menunggu inisiasi</span>
        </div>

        <div className="p-4 bg-white border-2 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717]">
          <span className="text-[10px] font-black uppercase text-[#171717]/60">In Progress</span>
          <p className="font-display text-2xl text-[#D97706] mt-1">{summary?.in_progress_count ?? 0}</p>
          <span className="text-[10px] font-bold text-[#171717]/50">Sedang dikerjakan</span>
        </div>

        <div className="p-4 bg-white border-2 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717]">
          <span className="text-[10px] font-black uppercase text-[#FF2F92]">Terlambat (Overdue)</span>
          <p className="font-display text-2xl text-[#FF2F92] mt-1">{summary?.overdue_count ?? 0}</p>
          <span className="text-[10px] font-bold text-[#FF2F92]/70">Melewati deadline</span>
        </div>

        <div className="p-4 bg-white border-2 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717]">
          <span className="text-[10px] font-black uppercase text-[#10B981]">Selesai (Done)</span>
          <p className="font-display text-2xl text-[#10B981] mt-1">{summary?.completed_count ?? 0}</p>
          <span className="text-[10px] font-bold text-[#10B981]/70">Tuntas terverifikasi</span>
        </div>

        <div className="p-4 bg-[#FF2F92]/10 border-2 border-[#FF2F92] rounded-xl shadow-[2px_2px_0px_#171717]">
          <span className="text-[10px] font-black uppercase text-[#FF2F92]">Prioritas Kritis</span>
          <p className="font-display text-2xl text-[#FF2F92] mt-1">{summary?.critical_priority_count ?? 0}</p>
          <span className="text-[10px] font-bold text-[#FF2F92]/80">Atensi puncak pimpinan</span>
        </div>
      </div>

      {/* =========================================================================
          3. FILTER & SEARCH TOOLBAR
      ========================================================================= */}
      <div className="bg-white border-2 border-[#171717] rounded-xl p-3.5 shadow-[3px_3px_0px_#171717] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#171717]/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor tindakan, judul, atau penanggung jawab..."
              className="w-full pl-9 pr-3 py-2 bg-[#FAF7F2] border border-[#171717]/30 rounded-lg text-xs font-semibold text-[#171717] focus:outline-none focus:border-[#FF2F92]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[#FAF7F2] border border-[#171717]/30 rounded-lg text-xs font-bold text-[#171717] cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="overdue">Overdue (Terlambat)</option>
            <option value="blocked">Blocked</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 bg-[#FAF7F2] border border-[#171717]/30 rounded-lg text-xs font-bold text-[#171717] cursor-pointer"
          >
            <option value="all">Semua Prioritas</option>
            <option value="critical">Kritis</option>
            <option value="high">Tinggi</option>
            <option value="medium">Sedang</option>
            <option value="low">Rendah</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 bg-[#FAF7F2] border border-[#171717]/30 rounded-lg text-xs font-bold text-[#171717] cursor-pointer"
          >
            <option value="all">Semua Sumber Insight</option>
            <option value="business_intelligence">Business Intelligence</option>
            <option value="strategic_risk">Risiko Strategis</option>
            <option value="executive_decision">Keputusan Eksekutif</option>
            <option value="financial_alert">Peringatan Finansial</option>
            <option value="strategic_initiative">Inisiatif Strategis</option>
            <option value="manual">Arahan Manual</option>
          </select>
        </div>
      </div>

      {/* =========================================================================
          4. ACTION PRIORITY BOARD (CRITICAL, HIGH, MEDIUM, LOW)
      ========================================================================= */}
      {filteredActions.length === 0 ? (
        <div className="p-12 text-center bg-white border-2 border-[#171717] rounded-xl shadow-[3px_3px_0px_#171717] space-y-3">
          <CheckCircle2 size={40} className="text-[#10B981] mx-auto" />
          <h3 className="font-display text-lg uppercase text-[#171717]">Tidak Ada Tindakan Terdeteksi</h3>
          <p className="text-xs text-[#171717]/60 max-w-md mx-auto">
            Tidak ditemukan tindakan dengan parameter filter yang dipilih, atau belum ada arahan tindak lanjut yang diterbitkan.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Column: Critical */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 bg-[#FF2F92] text-white border-2 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717]">
              <div className="flex items-center gap-1.5 font-display text-xs uppercase tracking-wider">
                <AlertCircle size={15} />
                <span>Kritis ({criticalActions.length})</span>
              </div>
            </div>
            <div className="space-y-3">
              {criticalActions.map((action) => (
                <ActionCard key={action.id} action={action} onClick={() => handleOpenDetail(action)} />
              ))}
              {criticalActions.length === 0 && (
                <p className="text-[11px] text-[#171717]/40 font-semibold p-4 text-center bg-white border border-[#171717]/20 rounded-lg">
                  Nol tindakan kritis aktif.
                </p>
              )}
            </div>
          </div>

          {/* Column: High */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 bg-[#FFD83D] text-[#171717] border-2 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717]">
              <div className="flex items-center gap-1.5 font-display text-xs uppercase tracking-wider">
                <AlertTriangle size={15} />
                <span>Tinggi ({highActions.length})</span>
              </div>
            </div>
            <div className="space-y-3">
              {highActions.map((action) => (
                <ActionCard key={action.id} action={action} onClick={() => handleOpenDetail(action)} />
              ))}
              {highActions.length === 0 && (
                <p className="text-[11px] text-[#171717]/40 font-semibold p-4 text-center bg-white border border-[#171717]/20 rounded-lg">
                  Nol tindakan prioritas tinggi.
                </p>
              )}
            </div>
          </div>

          {/* Column: Medium */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 bg-[#B8A0F0] text-[#171717] border-2 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717]">
              <div className="flex items-center gap-1.5 font-display text-xs uppercase tracking-wider">
                <Clock size={15} />
                <span>Sedang ({mediumActions.length})</span>
              </div>
            </div>
            <div className="space-y-3">
              {mediumActions.map((action) => (
                <ActionCard key={action.id} action={action} onClick={() => handleOpenDetail(action)} />
              ))}
              {mediumActions.length === 0 && (
                <p className="text-[11px] text-[#171717]/40 font-semibold p-4 text-center bg-white border border-[#171717]/20 rounded-lg">
                  Nol tindakan prioritas sedang.
                </p>
              )}
            </div>
          </div>

          {/* Column: Low */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 bg-[#EAE4D8] text-[#171717] border-2 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717]">
              <div className="flex items-center gap-1.5 font-display text-xs uppercase tracking-wider">
                <CheckCircle2 size={15} />
                <span>Rendah ({lowActions.length})</span>
              </div>
            </div>
            <div className="space-y-3">
              {lowActions.map((action) => (
                <ActionCard key={action.id} action={action} onClick={() => handleOpenDetail(action)} />
              ))}
              {lowActions.length === 0 && (
                <p className="text-[11px] text-[#171717]/40 font-semibold p-4 text-center bg-white border border-[#171717]/20 rounded-lg">
                  Nol tindakan prioritas rendah.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          5. ACTION DETAIL MODAL
      ========================================================================= */}
      {showDetailModal && selectedAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#171717]/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border-3 border-[#171717] rounded-xl shadow-[8px_8px_0px_#171717] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden my-8">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b-2 border-[#171717] bg-[#F5F1E9] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#171717]/60">
                    {selectedAction.action_code}
                  </span>
                  <span className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded border border-[#171717] ${PRIORITY_THEME[selectedAction.priority]?.badge}`}>
                    {PRIORITY_THEME[selectedAction.priority]?.label}
                  </span>
                  <span className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded border border-[#171717] ${STATUS_THEME[selectedAction.status]?.bg}`}>
                    {STATUS_THEME[selectedAction.status]?.label}
                  </span>
                </div>
                <h3 className="font-display text-lg uppercase text-[#171717] mt-1">
                  {selectedAction.title}
                </h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1.5 hover:bg-white rounded-md border border-[#171717] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {detailLoading ? (
                <PageLoading mode="component" text="Memuat riwayat dan relasi tindakan..." transparent />
              ) : (
                <>
                  {/* Source Insight Callout */}
                  <div className="p-3.5 bg-[#FAF7F2] border-1.5 border-[#171717] rounded-lg space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#171717]/60">
                        Sumber Asal Tindakan
                      </span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${SOURCE_LABELS[selectedAction.source_type]?.bg || 'bg-neutral-200'}`}>
                        {SOURCE_LABELS[selectedAction.source_type]?.label || selectedAction.source_type}
                      </span>
                    </div>
                    {selectedAction.source_title && (
                      <p className="text-xs font-bold text-[#171717]">{selectedAction.source_title}</p>
                    )}
                    {selectedAction.description && (
                      <p className="text-xs text-[#171717]/80 leading-relaxed">{selectedAction.description}</p>
                    )}
                  </div>

                  {/* Operational Conversion Status */}
                  {selectedAction.converted_task ? (
                    <div className="p-3 bg-[#ECFDF5] border border-[#10B981] rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-[#10B981]" />
                        <div>
                          <p className="text-xs font-bold text-[#065F46]">
                            Telah dikonversi ke Tugas Operasional #{selectedAction.converted_task.id}
                          </p>
                          <p className="text-[10px] text-[#065F46]/70">
                            {selectedAction.converted_task.title} &bull; Status: {selectedAction.converted_task.status}
                          </p>
                        </div>
                      </div>
                      <Link
                        to="/tasks"
                        className="px-2.5 py-1 bg-white border border-[#171717] rounded text-[10px] font-bold text-[#171717] hover:bg-[#FFD83D] flex items-center gap-1"
                      >
                        Buka Tugas <ArrowRight size={11} />
                      </Link>
                    </div>
                  ) : canManage || user?.role === 'project_manager' ? (
                    <div className="p-3 bg-[#FFD83D]/20 border border-[#171717]/40 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#171717]">Belum Diturunkan Menjadi Tugas PM</p>
                        <p className="text-[10.5px] text-[#171717]/70">
                          Konversikan tindakan ini ke workflow tugas proyek untuk dieksekusi tim.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setConvertProjectId(selectedAction.project_id || '')
                          setConvertAssigneeId(selectedAction.assigned_to || '')
                          setShowConvertModal(true)
                        }}
                        className="px-3 py-1.5 bg-[#FFD83D] hover:bg-[#e6c335] text-[#171717] font-black text-xs uppercase border border-[#171717] rounded shadow-[2px_2px_0px_#171717] cursor-pointer"
                      >
                        Konversi ke Tugas
                      </button>
                    </div>
                  ) : null}

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-[#F5F1E9] border border-[#171717]/20 rounded-lg">
                      <span className="text-[10px] font-bold text-[#171717]/60 block uppercase">Penanggung Jawab</span>
                      <p className="font-bold text-[#171717] mt-0.5">
                        {selectedAction.assigned_user?.name || 'Belum Ditugaskan'}
                      </p>
                      <span className="text-[10px] text-[#171717]/50">{selectedAction.assigned_user?.role || '—'}</span>
                    </div>

                    <div className="p-2.5 bg-[#F5F1E9] border border-[#171717]/20 rounded-lg">
                      <span className="text-[10px] font-bold text-[#171717]/60 block uppercase">Tenggat Waktu</span>
                      <p className="font-bold text-[#171717] mt-0.5">
                        {selectedAction.due_date || 'Tanpa Batas Waktu'}
                      </p>
                      {selectedAction.due_date && new Date(selectedAction.due_date) < new Date() && selectedAction.status !== 'completed' && (
                        <span className="text-[9.5px] font-black text-[#FF2F92] uppercase">Status: Overdue</span>
                      )}
                    </div>
                  </div>

                  {/* Update Status Form */}
                  <form onSubmit={handleUpdateSubmit} className="space-y-3 pt-2 border-t border-[#171717]/15">
                    <h4 className="font-display text-xs uppercase text-[#171717] tracking-wider">
                      Pembaruan Status &amp; Progres
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10.5px] font-bold uppercase text-[#171717]/70 block mb-1">
                          Status Tindakan
                        </label>
                        <select
                          value={updateStatus}
                          onChange={(e) => setUpdateStatus(e.target.value)}
                          className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#171717]/40 rounded-lg text-xs font-bold text-[#171717]"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="blocked">Blocked</option>
                          <option value="completed">Completed (Selesai)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10.5px] font-bold uppercase text-[#171717]/70 block mb-1">
                          Capaian Progres: {updateProgress}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={updateProgress}
                          onChange={(e) => setUpdateProgress(Number(e.target.value))}
                          className="w-full accent-[#FF2F92] cursor-pointer mt-2"
                        />
                      </div>
                    </div>

                    {updateStatus === 'completed' && (
                      <div>
                        <label className="text-[10.5px] font-bold uppercase text-[#171717]/70 block mb-1">
                          Catatan Penyelesaian &amp; Hasil Evaluasi
                        </label>
                        <textarea
                          rows="2"
                          value={completionNotes}
                          onChange={(e) => setCompletionNotes(e.target.value)}
                          placeholder="Jelaskan bukti atau hasil akhir tindakan..."
                          className="w-full p-2.5 bg-[#FAF7F2] border border-[#171717]/40 rounded-lg text-xs font-semibold text-[#171717]"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-[10.5px] font-bold uppercase text-[#171717]/70 block mb-1">
                        Catatan Histori Tambahan (Opsional)
                      </label>
                      <input
                        type="text"
                        value={additionalNote}
                        onChange={(e) => setAdditionalNote(e.target.value)}
                        placeholder="Contoh: Telah berkoordinasi dengan PM terkait alokasi server..."
                        className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#171717]/40 rounded-lg text-xs font-semibold text-[#171717]"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      {canManage && selectedAction.status !== 'cancelled' ? (
                        <button
                          type="button"
                          onClick={() => setShowCancelModal(true)}
                          className="px-3 py-1.5 bg-[#FF2F92]/10 hover:bg-[#FF2F92] text-[#FF2F92] hover:text-white font-bold text-xs uppercase border border-[#FF2F92] rounded cursor-pointer transition-colors"
                        >
                          Batalkan Tindakan
                        </button>
                      ) : <div />}

                      <button
                        type="submit"
                        disabled={submittingUpdate}
                        className="px-4 py-2 bg-[#171717] text-white font-bold text-xs uppercase rounded-lg shadow-[2px_2px_0px_#171717] hover:bg-neutral-800 cursor-pointer disabled:opacity-50"
                      >
                        {submittingUpdate ? 'Menyimpan...' : 'Simpan Pembaruan'}
                      </button>
                    </div>
                  </form>

                  {/* Audit Trail / Riwayat Perubahan */}
                  <div className="pt-3 border-t border-[#171717]/15 space-y-2.5">
                    <div className="flex items-center gap-1.5">
                      <History size={14} className="text-[#FF2F92]" />
                      <h4 className="font-display text-xs uppercase text-[#171717] tracking-wider">
                        Riwayat Perubahan &amp; Audit Trail
                      </h4>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {selectedAction.histories?.map((h) => (
                        <div key={h.id} className="p-2.5 bg-[#F5F1E9] border border-[#171717]/20 rounded-md text-[11px]">
                          <div className="flex items-center justify-between text-[#171717]/60 font-semibold mb-0.5">
                            <span>{h.actor_name || 'Sistem'} &bull; <strong className="uppercase text-[#171717]">{h.event_type}</strong></span>
                            <span>{new Date(h.created_at).toLocaleString('id-ID')}</span>
                          </div>
                          {h.notes && <p className="font-semibold text-[#171717]">{h.notes}</p>}
                        </div>
                      ))}
                      {(!selectedAction.histories || selectedAction.histories.length === 0) && (
                        <p className="text-[11px] text-[#171717]/40 font-semibold">Belum ada riwayat tercatat.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          6. CREATE ACTION MODAL
      ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#171717]/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border-3 border-[#171717] rounded-xl shadow-[8px_8px_0px_#171717] max-w-lg w-full p-5 sm:p-6 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#171717]">
              <h3 className="font-display text-base uppercase text-[#171717]">
                Buat Tindakan Eksekutif Baru
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-[#F5F1E9] rounded cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold uppercase text-[#171717] block mb-1">Judul Tindakan *</label>
                <input
                  type="text"
                  required
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="Contoh: Audit Realisasi Anggaran Sprint 3"
                  className="w-full p-2.5 bg-[#FAF7F2] border border-[#171717]/40 rounded-lg text-xs font-semibold text-[#171717]"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-[#171717] block mb-1">Deskripsi / Arahan</label>
                <textarea
                  rows="3"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Jelaskan instruksi tindak lanjut dan sasaran capaian..."
                  className="w-full p-2.5 bg-[#FAF7F2] border border-[#171717]/40 rounded-lg text-xs font-semibold text-[#171717]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase text-[#171717] block mb-1">Prioritas</label>
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF7F2] border border-[#171717]/40 rounded-lg text-xs font-bold text-[#171717]"
                  >
                    <option value="critical">Kritis (Atensi Tertinggi)</option>
                    <option value="high">Tinggi</option>
                    <option value="medium">Sedang</option>
                    <option value="low">Rendah</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-[#171717] block mb-1">Tenggat Waktu</label>
                  <input
                    type="date"
                    value={createForm.due_date}
                    onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
                    className="w-full p-2 bg-[#FAF7F2] border border-[#171717]/40 rounded-lg text-xs font-semibold text-[#171717]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase text-[#171717] block mb-1">Penanggung Jawab</label>
                  <select
                    value={createForm.assigned_to}
                    onChange={(e) => setCreateForm({ ...createForm, assigned_to: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF7F2] border border-[#171717]/40 rounded-lg text-xs font-bold text-[#171717]"
                  >
                    <option value="">Pilih Personil...</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-[#171717] block mb-1">Proyek Terkait</label>
                  <select
                    value={createForm.project_id}
                    onChange={(e) => setCreateForm({ ...createForm, project_id: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF7F2] border border-[#171717]/40 rounded-lg text-xs font-bold text-[#171717]"
                  >
                    <option value="">Tanpa Proyek Khusus</option>
                    {projectsList.map((p) => (
                      <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#171717]/15">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-[#171717] rounded-lg text-xs font-bold uppercase cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate}
                  className="px-5 py-2 bg-[#FFD83D] hover:bg-[#e6c335] text-[#171717] font-black text-xs uppercase border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] cursor-pointer disabled:opacity-50"
                >
                  {submittingCreate ? 'Menyimpan...' : 'Terbitkan Tindakan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          7. CANCEL ACTION MODAL
      ========================================================================= */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#171717]/70 backdrop-blur-xs">
          <div className="bg-white border-3 border-[#171717] rounded-xl shadow-[8px_8px_0px_#171717] max-w-md w-full p-5 space-y-3">
            <h3 className="font-display text-sm uppercase text-[#FF2F92] flex items-center gap-2">
              <AlertTriangle size={18} /> Batalkan Tindakan Eksekutif
            </h3>
            <p className="text-xs text-[#171717]/70">
              Sesuai aturan bisnis, pembatalan tindakan wajib menyertakan alasan resmi yang akan diabadikan ke dalam audit trail.
            </p>
            <textarea
              rows="3"
              required
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Tuliskan alasan pembatalan..."
              className="w-full p-2.5 bg-[#FAF7F2] border border-[#171717]/40 rounded-lg text-xs font-semibold text-[#171717]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-3.5 py-1.5 border border-[#171717] rounded text-xs font-bold uppercase cursor-pointer"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleCancelSubmit}
                disabled={!cancelReason.trim()}
                className="px-4 py-1.5 bg-[#FF2F92] text-white font-black text-xs uppercase rounded border border-[#171717] shadow-[2px_2px_0px_#171717] cursor-pointer disabled:opacity-50"
              >
                Konfirmasi Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          8. CONVERT TO TASK MODAL
      ========================================================================= */}
      {showConvertModal && selectedAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#171717]/70 backdrop-blur-xs">
          <div className="bg-white border-3 border-[#171717] rounded-xl shadow-[8px_8px_0px_#171717] max-w-md w-full p-5 space-y-4">
            <h3 className="font-display text-sm uppercase text-[#171717] flex items-center gap-2">
              <Send size={16} className="text-[#10B981]" /> Konversi Tindakan Menjadi Tugas PM
            </h3>
            <p className="text-xs text-[#171717]/70 leading-relaxed">
              Tindakan eksekutif ini akan diturunkan menjadi tugas operasional resmi pada proyek tujuan, dengan workflow checklist dan approval PM.
            </p>

            <form onSubmit={handleConvertSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase text-[#171717] block mb-1">Proyek Tujuan *</label>
                <select
                  required
                  value={convertProjectId}
                  onChange={(e) => setConvertProjectId(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF7F2] border border-[#171717]/40 rounded-lg text-xs font-bold text-[#171717]"
                >
                  <option value="">Pilih Proyek...</option>
                  {projectsList.map((p) => (
                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-[#171717] block mb-1">Penanggung Jawab Tugas</label>
                <select
                  value={convertAssigneeId}
                  onChange={(e) => setConvertAssigneeId(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF7F2] border border-[#171717]/40 rounded-lg text-xs font-bold text-[#171717]"
                >
                  <option value="">Gunakan PIC Proyek / Assignee Tindakan</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConvertModal(false)}
                  className="px-3.5 py-1.5 border border-[#171717] rounded text-xs font-bold uppercase cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingConvert}
                  className="px-4 py-1.5 bg-[#10B981] text-white font-black text-xs uppercase rounded border border-[#171717] shadow-[2px_2px_0px_#171717] cursor-pointer disabled:opacity-50"
                >
                  {submittingConvert ? 'Memproses...' : 'Konversi Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function ActionCard({ action, onClick }) {
  const priorityCfg = PRIORITY_THEME[action.priority] || PRIORITY_THEME.medium
  const statusCfg = STATUS_THEME[action.status] || STATUS_THEME.pending

  const isOverdue =
    !['completed', 'cancelled'].includes(action.status) &&
    action.due_date &&
    new Date(action.due_date) < new Date()

  return (
    <div
      onClick={onClick}
      className="p-3.5 bg-white border-2 border-[#171717] rounded-xl shadow-[3px_3px_0px_#171717] hover:bg-[#FAF7F2] cursor-pointer transition-all space-y-2.5 group"
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="font-mono text-[10px] font-bold text-[#171717]/60">
          {action.action_code}
        </span>
        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border border-[#171717] ${statusCfg.bg}`}>
          {statusCfg.label}
        </span>
      </div>

      <h4 className="font-bold text-xs sm:text-sm text-[#171717] group-hover:text-[#FF2F92] transition-colors line-clamp-2 leading-snug">
        {action.title}
      </h4>

      {action.source_title && (
        <p className="text-[10px] font-semibold text-[#171717]/60 line-clamp-1">
          Asal: {action.source_title}
        </p>
      )}

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-bold text-[#171717]/70">
          <span>Progres</span>
          <span>{action.progress}%</span>
        </div>
        <div className="w-full bg-[#EAE4D8] h-1.5 rounded-full overflow-hidden border border-[#171717]/30">
          <div
            className={`h-full ${action.status === 'completed' ? 'bg-[#10B981]' : 'bg-[#171717]'}`}
            style={{ width: `${action.progress}%` }}
          />
        </div>
      </div>

      {/* Footer Info: Assignee & Deadline */}
      <div className="pt-2 border-t border-[#171717]/10 flex items-center justify-between text-[10px] text-[#171717]/70 font-semibold">
        <span className="truncate max-w-[120px]">
          {action.assigned_user?.name || 'Belum Ditugaskan'}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {isOverdue && (
            <span className="text-[8.5px] font-black px-1.5 py-0.5 bg-[#FF2F92] text-white rounded">
              OVERDUE
            </span>
          )}
          <span className="font-mono">{action.due_date || '—'}</span>
        </div>
      </div>
    </div>
  )
}