import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import {
  Compass,
  Plus,
  Search,
  Filter,
  Users,
  Target,
  FolderKanban,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Loader2,
  Trash2,
  Edit3,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  AlertOctagon,
  Layers,
  Calendar,
  X,
  UserPlus,
  Briefcase,
  PieChart,
  ShieldCheck,
  Building2,
  Sparkles
} from 'lucide-react'

const PRIORITY_BADGES = {
  critical: { label: 'Kritis', bg: 'bg-[#FF2F92]', text: 'text-white', border: 'border-[#171717]' },
  high:     { label: 'Tinggi', bg: 'bg-[#FFD83D]', text: 'text-[#171717]', border: 'border-[#171717]' },
  medium:   { label: 'Sedang', bg: 'bg-[#B8A0F0]', text: 'text-[#171717]', border: 'border-[#171717]' },
  low:      { label: 'Rendah', bg: 'bg-[#EAE4D8]', text: 'text-[#171717]', border: 'border-[#171717]' },
}

const STATUS_BADGES = {
  planned:   { label: 'Direncanakan', bg: 'bg-[#EAE4D8]', text: 'text-[#171717]' },
  active:    { label: 'Aktif Berjalan', bg: 'bg-[#10B981]', text: 'text-white' },
  on_hold:   { label: 'Ditunda', bg: 'bg-[#FFD83D]', text: 'text-[#171717]' },
  completed: { label: 'Selesai', bg: 'bg-[#7C3AED]', text: 'text-white' },
  draft:     { label: 'Konsep', bg: 'bg-white', text: 'text-[#171717]' },
  cancelled: { label: 'Dibatalkan', bg: 'bg-[#FF2F92]', text: 'text-white' },
}

const CATEGORY_OPTIONS = [
  'Operational Expansion',
  'Tech Innovation',
  'Process Improvement',
  'Market Penetration',
  'Quality & Compliance'
]

export default function StrategicInitiatives() {
  const navigate = useNavigate()

  // Main Data States
  const [overview, setOverview] = useState(null)
  const [initiatives, setInitiatives] = useState([])
  const [capacityData, setCapacityData] = useState([])
  const [objectivesList, setObjectivesList] = useState([])
  const [projectsList, setProjectsList] = useState([])
  const [usersList, setUsersList] = useState([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  // Active View Tab
  const [activeTab, setActiveTab] = useState('initiatives') // 'initiatives' | 'capacity' | 'alignment'

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingInitiative, setEditingInitiative] = useState(null)
  const [selectedInitiative, setSelectedInitiative] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showAllocateModal, setShowAllocateModal] = useState(false)
  const [showLinkProjectModal, setShowLinkProjectModal] = useState(false)

  // Form States - Initiative
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    objective_id: '',
    lead_id: '',
    category: 'Operational Expansion',
    priority: 'high',
    status: 'planned',
    start_date: '',
    target_date: '',
    progress: 0,
    allocated_budget: 0,
    spent_budget: 0,
    strategic_rationale: '',
  })
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Form States - Resource Allocation
  const [allocForm, setAllocForm] = useState({
    user_id: '',
    role_in_initiative: 'Specialist',
    allocation_percentage: 50,
    start_date: '',
    end_date: '',
    notes: '',
  })

  // Form States - Link Project
  const [linkProjectForm, setLinkProjectForm] = useState({
    project_id: '',
    impact_description: '',
  })

  const formatRupiah = (num) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(num || 0)
  }

  // Fetch all initiative data
  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const [overviewRes, listRes, capacityRes, okrRes, projRes, usersRes] = await Promise.all([
        api.get('/leadership/initiatives/overview'),
        api.get('/leadership/initiatives', {
          params: {
            status: statusFilter !== 'all' ? statusFilter : undefined,
            category: categoryFilter !== 'all' ? categoryFilter : undefined,
            priority: priorityFilter !== 'all' ? priorityFilter : undefined,
            search: searchQuery || undefined,
          }
        }),
        api.get('/leadership/initiatives/resource-capacity').catch(() => ({ data: { capacity: [] } })),
        api.get('/leadership/okr/objectives').catch(() => ({ data: { objectives: [] } })),
        api.get('/projects').catch(() => ({ data: { projects: [] } })),
        api.get('/team').catch(() => ({ data: { team: [] } })),
      ])

      if (overviewRes.data?.success) setOverview(overviewRes.data.overview)
      if (listRes.data?.success) setInitiatives(listRes.data.initiatives || [])
      if (capacityRes.data?.success) setCapacityData(capacityRes.data.capacity || [])
      if (okrRes.data?.objectives) setObjectivesList(okrRes.data.objectives || [])
      if (projRes.data?.projects) setProjectsList(projRes.data.projects || [])
      if (usersRes.data?.team) setUsersList(usersRes.data.team || [])
    } catch (err) {
      console.error('Fetch Strategic Initiatives Error:', err)
      setError(err.response?.data?.message || 'Gagal mengambil data inisiatif strategis.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [statusFilter, categoryFilter, priorityFilter])

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingInitiative(null)
    setFormData({
      title: '',
      description: '',
      objective_id: '',
      lead_id: '',
      category: 'Operational Expansion',
      priority: 'high',
      status: 'planned',
      start_date: '',
      target_date: '',
      progress: 0,
      allocated_budget: 0,
      spent_budget: 0,
      strategic_rationale: '',
    })
    setShowCreateModal(true)
  }

  // Open Edit Modal
  const handleOpenEdit = (init) => {
    setEditingInitiative(init)
    setFormData({
      title: init.title || '',
      description: init.description || '',
      objective_id: init.objective_id || '',
      lead_id: init.lead_id || '',
      category: init.category || 'Operational Expansion',
      priority: init.priority || 'high',
      status: init.status || 'planned',
      start_date: init.start_date ? init.start_date.split('T')[0] : '',
      target_date: init.target_date ? init.target_date.split('T')[0] : '',
      progress: init.progress || 0,
      allocated_budget: init.allocated_budget || 0,
      spent_budget: init.spent_budget || 0,
      strategic_rationale: init.strategic_rationale || '',
    })
    setShowCreateModal(true)
  }

  // Save Initiative (Create / Update)
  const handleSubmitInitiative = async (e) => {
    e.preventDefault()
    setFormSubmitting(true)

    try {
      if (editingInitiative) {
        await api.put(`/leadership/initiatives/${editingInitiative.id}`, formData)
      } else {
        await api.post('/leadership/initiatives', formData)
      }
      setShowCreateModal(false)
      fetchData(true)
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menyimpan inisiatif.')
    } finally {
      setFormSubmitting(false)
    }
  }

  // Delete Initiative
  const handleDeleteInitiative = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus inisiatif strategis ini?')) return

    try {
      await api.delete(`/leadership/initiatives/${id}`)
      if (selectedInitiative?.id === id) {
        setShowDetailModal(false)
        setSelectedInitiative(null)
      }
      fetchData(true)
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus inisiatif.')
    }
  }

  // Open Detail Modal
  const handleOpenDetail = async (init) => {
    try {
      const res = await api.get(`/leadership/initiatives/${init.id}`)
      if (res.data?.success) {
        setSelectedInitiative(res.data.initiative)
        setShowDetailModal(true)
      }
    } catch {
      setSelectedInitiative(init)
      setShowDetailModal(true)
    }
  }

  // Add / Update Resource Allocation
  const handleSubmitAllocation = async (e) => {
    e.preventDefault()
    if (!selectedInitiative || !allocForm.user_id) return
    setFormSubmitting(true)

    try {
      await api.post(`/leadership/initiatives/${selectedInitiative.id}/resources`, allocForm)
      setShowAllocateModal(false)
      setAllocForm({
        user_id: '',
        role_in_initiative: 'Specialist',
        allocation_percentage: 50,
        start_date: '',
        end_date: '',
        notes: '',
      })
      // Refresh detail
      const res = await api.get(`/leadership/initiatives/${selectedInitiative.id}`)
      if (res.data?.success) setSelectedInitiative(res.data.initiative)
      fetchData(true)
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengalokasikan sumber daya.')
    } finally {
      setFormSubmitting(false)
    }
  }

  // Remove Resource Allocation
  const handleRemoveAllocation = async (userId) => {
    if (!selectedInitiative) return
    if (!window.confirm('Hapus alokasi anggota tim ini dari inisiatif?')) return

    try {
      await api.delete(`/leadership/initiatives/${selectedInitiative.id}/resources/${userId}`)
      const res = await api.get(`/leadership/initiatives/${selectedInitiative.id}`)
      if (res.data?.success) setSelectedInitiative(res.data.initiative)
      fetchData(true)
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus alokasi.')
    }
  }

  // Link Project Submit
  const handleLinkProjectSubmit = async (e) => {
    e.preventDefault()
    if (!selectedInitiative || !linkProjectForm.project_id) return
    setFormSubmitting(true)

    try {
      await api.post(`/leadership/initiatives/${selectedInitiative.id}/projects`, linkProjectForm)
      setShowLinkProjectModal(false)
      setLinkProjectForm({ project_id: '', impact_description: '' })
      const res = await api.get(`/leadership/initiatives/${selectedInitiative.id}`)
      if (res.data?.success) setSelectedInitiative(res.data.initiative)
      fetchData(true)
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghubungkan proyek.')
    } finally {
      setFormSubmitting(false)
    }
  }

  // Unlink Project
  const handleUnlinkProject = async (projectId) => {
    if (!selectedInitiative) return
    if (!window.confirm('Lepaskan hubungan proyek ini dari inisiatif strategis?')) return

    try {
      await api.delete(`/leadership/initiatives/${selectedInitiative.id}/projects/${projectId}`)
      const res = await api.get(`/leadership/initiatives/${selectedInitiative.id}`)
      if (res.data?.success) setSelectedInitiative(res.data.initiative)
      fetchData(true)
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal melepaskan proyek.')
    }
  }

  // Filtered initiatives list for live search
  const filteredInitiatives = useMemo(() => {
    if (!searchQuery.trim()) return initiatives
    const q = searchQuery.toLowerCase().trim()
    return initiatives.filter(init =>
      init.title?.toLowerCase().includes(q) ||
      init.code?.toLowerCase().includes(q) ||
      init.description?.toLowerCase().includes(q)
    )
  }, [initiatives, searchQuery])

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="relative">
          <Loader2 className="w-12 h-12 text-[#FF2F92] animate-spin" />
          <Compass className="w-6 h-6 text-[#171717] absolute inset-0 m-auto" />
        </div>
        <div className="text-center font-mono">
          <h3 className="font-bold text-lg text-[#171717]">MEMUAT STRATEGIC INITIATIVES...</h3>
          <p className="text-xs text-[#171717]/60 mt-1">Mengagregasi alokasi sumber daya, kapasitas tim, dan anggaran inisiatif.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-12 font-mono">
      {/* =========================================================================
          1. EXECUTIVE HEADER
         ========================================================================= */}
      <div className="bg-[#F5F1E9] border-2 border-[#171717] shadow-[6px_6px_0px_#171717] p-5 md:p-7 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 bg-[#FF2F92] text-white border-2 border-[#171717] font-black text-xs tracking-wider uppercase shadow-[2px_2px_0px_#171717]">
                PIMPINAN &middot; INISIATIF STRATEGIS
              </span>
              <span className="text-xs text-[#171717]/60 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Periode Berjalan &bull; PT Potensi Karya Mandiri
              </span>
            </div>
            <h1 className="font-black text-2xl md:text-3xl lg:text-4xl text-[#171717] tracking-tight">
              STRATEGIC INITIATIVES &amp; RESOURCE ALLOCATION
            </h1>
            <p className="text-xs md:text-sm text-[#171717]/70 max-w-2xl">
              Pusat orkestrasi inisiatif transformasi bisnis, pemantauan utilisasi kapasitas sumber daya manusia, dan evaluasi realisasi anggaran strategis.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#EAE4D8] border-2 border-[#171717] font-bold text-xs shadow-[3px_3px_0px_#171717] hover:bg-[#FFD83D] active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Menyinkronkan...' : 'Segarkan Data'}
            </button>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFD83D] text-[#171717] border-2 border-[#171717] font-bold text-xs shadow-[3px_3px_0px_#171717] hover:bg-[#FFD83D]/90 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Inisiatif Baru
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. KPI SUMMARY METRIC CARDS
         ========================================================================= */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Total Initiatives */}
          <div className="p-4 bg-white border-2 border-[#171717] shadow-[3px_3px_0px_#171717]">
            <div className="text-[10px] font-bold uppercase text-[#171717]/60">Total Inisiatif</div>
            <div className="text-2xl md:text-3xl font-black mt-1 text-[#171717]">
              {overview.total_initiatives}
            </div>
            <div className="text-[10px] text-[#171717]/60 mt-1">
              {overview.active_initiatives} Aktif &bull; {overview.planned_initiatives} Rencana
            </div>
          </div>

          {/* Average Progress */}
          <div className="p-4 bg-white border-2 border-[#171717] shadow-[3px_3px_0px_#171717]">
            <div className="text-[10px] font-bold uppercase text-[#171717]/60">Rata-rata Capaian</div>
            <div className="text-2xl md:text-3xl font-black mt-1 text-[#10B981]">
              {overview.average_progress}%
            </div>
            <div className="w-full bg-[#EAE4D8] h-1.5 mt-2 border border-[#171717]">
              <div
                className="bg-[#10B981] h-full"
                style={{ width: `${Math.min(100, overview.average_progress || 0)}%` }}
              ></div>
            </div>
          </div>

          {/* Allocated Budget */}
          <div className="p-4 bg-white border-2 border-[#171717] shadow-[3px_3px_0px_#171717]">
            <div className="text-[10px] font-bold uppercase text-[#171717]/60">Total Anggaran</div>
            <div className="text-base md:text-lg font-black mt-1 text-[#171717] truncate" title={formatRupiah(overview.total_allocated_budget)}>
              {formatRupiah(overview.total_allocated_budget)}
            </div>
            <div className="text-[10px] text-[#171717]/60 mt-1">
              Realisasi: {formatRupiah(overview.total_spent_budget)}
            </div>
          </div>

          {/* Budget Utilization Rate */}
          <div className="p-4 bg-white border-2 border-[#171717] shadow-[3px_3px_0px_#171717]">
            <div className="text-[10px] font-bold uppercase text-[#171717]/60">Serapan Anggaran</div>
            <div className={`text-2xl md:text-3xl font-black mt-1 ${
              overview.budget_utilization_rate > 100 ? 'text-[#FF2F92]' : 'text-[#3B82F6]'
            }`}>
              {overview.budget_utilization_rate}%
            </div>
            <div className="text-[10px] text-[#171717]/60 mt-1">
              {overview.budget_utilization_rate > 100 ? 'Over Budget' : 'Sesuai Alokasi'}
            </div>
          </div>

          {/* Allocated Staff */}
          <div className="p-4 bg-white border-2 border-[#171717] shadow-[3px_3px_0px_#171717]">
            <div className="text-[10px] font-bold uppercase text-[#171717]/60">SDM Terlibat</div>
            <div className="text-2xl md:text-3xl font-black mt-1 text-[#7C3AED]">
              {overview.total_allocated_staff}
            </div>
            <div className="text-[10px] text-[#171717]/60 mt-1">
              {overview.overloaded_staff_count > 0 ? (
                <span className="text-[#FF2F92] font-bold">{overview.overloaded_staff_count} Staf Overload</span>
              ) : (
                <span className="text-[#10B981]">Beban Optimal</span>
              )}
            </div>
          </div>

          {/* OKR & Project Alignment */}
          <div className="p-4 bg-white border-2 border-[#171717] shadow-[3px_3px_0px_#171717]">
            <div className="text-[10px] font-bold uppercase text-[#171717]/60">Keselarasan</div>
            <div className="text-xl md:text-2xl font-black mt-1 text-[#171717]">
              {overview.linked_objectives_count} OKR
            </div>
            <div className="text-[10px] text-[#171717]/60 mt-1">
              &bull; {overview.linked_projects_count} Proyek Terkait
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. TAB NAVIGATION
         ========================================================================= */}
      <div className="flex items-center gap-2 border-b-2 border-[#171717] pb-0">
        <button
          onClick={() => setActiveTab('initiatives')}
          className={`px-4 py-2 font-bold text-xs tracking-wider uppercase border-t-2 border-x-2 border-[#171717] transition-all cursor-pointer ${
            activeTab === 'initiatives'
              ? 'bg-[#171717] text-white shadow-[2px_-2px_0px_#FFD83D]'
              : 'bg-white text-[#171717] hover:bg-[#F5F1E9]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            Daftar Inisiatif ({filteredInitiatives.length})
          </div>
        </button>

        <button
          onClick={() => setActiveTab('capacity')}
          className={`px-4 py-2 font-bold text-xs tracking-wider uppercase border-t-2 border-x-2 border-[#171717] transition-all cursor-pointer ${
            activeTab === 'capacity'
              ? 'bg-[#171717] text-white shadow-[2px_-2px_0px_#FFD83D]'
              : 'bg-white text-[#171717] hover:bg-[#F5F1E9]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Kapasitas &amp; Alokasi SDM ({capacityData.length})
          </div>
        </button>
      </div>

      {/* =========================================================================
          4. TAB 1: INITIATIVES DIRECTORY
         ========================================================================= */}
      {activeTab === 'initiatives' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-3.5 border-2 border-[#171717] shadow-[3px_3px_0px_#171717]">
            <div className="relative">
              <Search className="w-4 h-4 text-[#171717]/60 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari inisiatif / kode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-[#F5F1E9] border border-[#171717] text-xs text-[#171717] placeholder:text-[#171717]/50 focus:outline-hidden"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-[#F5F1E9] border border-[#171717] text-xs text-[#171717] focus:outline-hidden"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif Berjalan</option>
              <option value="planned">Direncanakan</option>
              <option value="on_hold">Ditunda</option>
              <option value="completed">Selesai</option>
              <option value="draft">Konsep</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 bg-[#F5F1E9] border border-[#171717] text-xs text-[#171717] focus:outline-hidden"
            >
              <option value="all">Semua Kategori</option>
              {CATEGORY_OPTIONS.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 bg-[#F5F1E9] border border-[#171717] text-xs text-[#171717] focus:outline-hidden"
            >
              <option value="all">Semua Prioritas</option>
              <option value="critical">Kritis</option>
              <option value="high">Tinggi</option>
              <option value="medium">Sedang</option>
              <option value="low">Rendah</option>
            </select>
          </div>

          {/* Initiatives Cards Grid */}
          {filteredInitiatives.length === 0 ? (
            <div className="p-10 bg-white border-2 border-dashed border-[#171717] text-center space-y-2">
              <Compass className="w-10 h-10 text-[#171717]/40 mx-auto" />
              <h3 className="font-bold text-sm text-[#171717]">TIDAK ADA INISIATIF DITEMUKAN</h3>
              <p className="text-xs text-[#171717]/60 max-w-md mx-auto">
                Belum ada inisiatif strategis yang sesuai dengan kriteria filter aktif.
              </p>
              <button
                onClick={handleOpenCreate}
                className="mt-2 px-4 py-1.5 bg-[#FFD83D] border border-[#171717] font-bold text-xs"
              >
                + Tambah Inisiatif Pertama
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInitiatives.map((init) => {
                const pBadge = PRIORITY_BADGES[init.priority] || PRIORITY_BADGES.high
                const sBadge = STATUS_BADGES[init.status] || STATUS_BADGES.planned
                const budgetPct = init.allocated_budget > 0
                  ? Math.round((init.spent_budget / init.allocated_budget) * 100)
                  : 0

                return (
                  <div
                    key={init.id}
                    className="bg-white border-2 border-[#171717] shadow-[4px_4px_0px_#171717] p-5 flex flex-col justify-between space-y-4 hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
                  >
                    <div className="space-y-3">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="px-2 py-0.5 bg-[#EAE4D8] border border-[#171717] font-black text-xs">
                          {init.code}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 text-[10px] font-black uppercase border ${pBadge.border} ${pBadge.bg} ${pBadge.text}`}>
                            {pBadge.label}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] font-black uppercase border border-[#171717] ${sBadge.bg} ${sBadge.text}`}>
                            {sBadge.label}
                          </span>
                        </div>
                      </div>

                      {/* Title & Category */}
                      <div>
                        <div className="text-[10px] text-[#171717]/60 uppercase font-bold">{init.category}</div>
                        <h3 className="font-black text-base text-[#171717] mt-0.5 line-clamp-2">
                          {init.title}
                        </h3>
                        {init.description && (
                          <p className="text-xs text-[#171717]/70 mt-1 line-clamp-2 leading-relaxed">
                            {init.description}
                          </p>
                        )}
                      </div>

                      {/* Lead PIC & Target Date */}
                      <div className="p-2.5 bg-[#F5F1E9] border border-[#171717] text-xs space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[#171717]/60 text-[10px] uppercase">Penanggung Jawab:</span>
                          <span className="font-bold text-[#171717]">{init.lead?.name || 'Belum Ditentukan'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#171717]/60 text-[10px] uppercase">Target Selesai:</span>
                          <span className="font-bold text-[#171717]">{init.target_date || '-'}</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span>Progress Capaian</span>
                          <span className="text-[#10B981]">{init.progress}%</span>
                        </div>
                        <div className="w-full bg-[#EAE4D8] border border-[#171717] h-2.5">
                          <div
                            className="bg-[#10B981] h-full"
                            style={{ width: `${Math.min(100, init.progress || 0)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Budget Indicator */}
                      <div className="space-y-1 pt-1 border-t border-[#171717]/20 text-xs">
                        <div className="flex justify-between">
                          <span className="text-[#171717]/60">Anggaran:</span>
                          <span className="font-bold">{formatRupiah(init.allocated_budget)}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#171717]/60">Realisasi:</span>
                          <span className={budgetPct > 100 ? 'text-[#FF2F92] font-black' : 'text-[#3B82F6] font-bold'}>
                            {formatRupiah(init.spent_budget)} ({budgetPct}%)
                          </span>
                        </div>
                      </div>

                      {/* Resources & Projects Count */}
                      <div className="flex items-center justify-between text-[11px] text-[#171717]/70 pt-1">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {init.resource_allocations?.length || 0} SDM Alokasi
                        </span>
                        <span className="flex items-center gap-1">
                          <FolderKanban className="w-3.5 h-3.5" />
                          {init.projects?.length || 0} Proyek Terkait
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-[#171717]/20">
                      <button
                        onClick={() => handleOpenDetail(init)}
                        className="flex-1 py-1.5 bg-[#FFD83D] border border-[#171717] font-bold text-xs shadow-[2px_2px_0px_#171717] hover:bg-[#FFD83D]/80 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        Detail &amp; Alokasi
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(init)}
                        className="p-1.5 bg-white border border-[#171717] hover:bg-[#F5F1E9] text-[#171717] cursor-pointer"
                        title="Edit Inisiatif"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteInitiative(init.id)}
                        className="p-1.5 bg-white border border-[#171717] hover:bg-[#FF2F92] hover:text-white text-[#FF2F92] cursor-pointer"
                        title="Hapus Inisiatif"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          5. TAB 2: RESOURCE CAPACITY & WORKLOAD
         ========================================================================= */}
      {activeTab === 'capacity' && (
        <div className="space-y-4">
          <div className="bg-white border-2 border-[#171717] shadow-[4px_4px_0px_#171717] p-5 space-y-3">
            <h2 className="font-black text-base text-[#171717] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#FF2F92]" />
              MATRIKS KAPASITAS &amp; ALOKASI WAKTU SDM
            </h2>
            <p className="text-xs text-[#171717]/70">
              Evaluasi total persentase kapasitas anggota tim yang dialokasikan lintas inisiatif strategis. Sistem memberikan peringatan visual jika beban melampaui 100%.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {capacityData.map((user) => {
              const isOverloaded = user.total_allocation_percentage > 100
              const isIdeal = user.total_allocation_percentage >= 70 && !isOverloaded
              const isPartial = user.total_allocation_percentage > 0 && user.total_allocation_percentage < 70
              const isFree = user.total_allocation_percentage === 0

              return (
                <div
                  key={user.user_id}
                  className={`bg-white border-2 border-[#171717] shadow-[3px_3px_0px_#171717] p-4 flex flex-col justify-between space-y-3 ${
                    isOverloaded ? 'border-[#FF2F92] bg-[#FF2F92]/5' : ''
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-[#171717]">{user.name}</h4>
                        <div className="text-[11px] text-[#171717]/60">{user.email} &bull; {user.role}</div>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-black uppercase border border-[#171717] ${
                        isOverloaded
                          ? 'bg-[#FF2F92] text-white'
                          : isIdeal
                          ? 'bg-[#10B981] text-white'
                          : isPartial
                          ? 'bg-[#FFD83D] text-[#171717]'
                          : 'bg-[#EAE4D8] text-[#171717]'
                      }`}>
                        {isOverloaded ? 'Overload' : isIdeal ? 'Optimal' : isPartial ? 'Parsial' : 'Tersedia'}
                      </span>
                    </div>

                    {/* Progress Bar Allocation */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span>Total Alokasi Kapasitas:</span>
                        <span className={isOverloaded ? 'text-[#FF2F92] font-black' : 'text-[#171717]'}>
                          {user.total_allocation_percentage}%
                        </span>
                      </div>
                      <div className="w-full bg-[#EAE4D8] border border-[#171717] h-3 relative overflow-hidden">
                        <div
                          className={`h-full ${
                            isOverloaded ? 'bg-[#FF2F92]' : isIdeal ? 'bg-[#10B981]' : 'bg-[#FFD83D]'
                          }`}
                          style={{ width: `${Math.min(100, user.total_allocation_percentage)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Breakdown per Initiative */}
                    <div className="pt-2 border-t border-[#171717]/20 space-y-1.5">
                      <div className="text-[10px] font-bold uppercase text-[#171717]/60">Inisiatif Terkait ({user.initiatives_count}):</div>
                      {user.allocations && user.allocations.length > 0 ? (
                        <div className="space-y-1">
                          {user.allocations.map(al => (
                            <div key={al.id} className="text-xs p-1.5 bg-[#F5F1E9] border border-[#171717] flex justify-between items-center">
                              <span className="font-medium truncate max-w-[170px]" title={al.initiative_title}>
                                [{al.initiative_code}] {al.role_in_initiative}
                              </span>
                              <span className="font-black text-[#171717]">{al.percentage}%</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-[#171717]/50 italic">Belum dialokasikan pada inisiatif manapun.</div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          6. MODAL: CREATE / EDIT INITIATIVE
         ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-[#171717]/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#F5F1E9] border-3 border-[#171717] shadow-[8px_8px_0px_#171717] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden my-auto">
            {/* Header */}
            <div className="p-4 border-b-2 border-[#171717] bg-white flex items-center justify-between">
              <h3 className="font-black text-base text-[#171717] uppercase flex items-center gap-2">
                <Compass className="w-5 h-5 text-[#FF2F92]" />
                {editingInitiative ? 'Ubah Inisiatif Strategis' : 'Inisiatif Strategis Baru'}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-[#FF2F92] hover:text-white border border-[#171717] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmitInitiative} className="p-5 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-[#171717]">Nama Inisiatif *</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Modernisasi Infrastruktur Core Banking & Automation"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-2 bg-white border border-[#171717] text-xs text-[#171717] focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-[#171717]">Deskripsi &amp; Latar Belakang</label>
                <textarea
                  rows={2}
                  placeholder="Uraikan tujuan bisnis dan ruang lingkup inisiatif..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2 bg-white border border-[#171717] text-xs text-[#171717] focus:outline-hidden"
                ></textarea>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#171717]">Kategori Inisiatif *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full p-2 bg-white border border-[#171717] text-xs text-[#171717] focus:outline-hidden"
                  >
                    {CATEGORY_OPTIONS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#171717]">Prioritas *</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full p-2 bg-white border border-[#171717] text-xs text-[#171717] focus:outline-hidden"
                  >
                    <option value="critical">Kritis</option>
                    <option value="high">Tinggi</option>
                    <option value="medium">Sedang</option>
                    <option value="low">Rendah</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#171717]">Status Pelaksanaan *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full p-2 bg-white border border-[#171717] text-xs text-[#171717] focus:outline-hidden"
                  >
                    <option value="planned">Direncanakan</option>
                    <option value="active">Aktif Berjalan</option>
                    <option value="on_hold">Ditunda</option>
                    <option value="completed">Selesai</option>
                    <option value="draft">Konsep</option>
                    <option value="cancelled">Dibatalkan</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#171717]">Penanggung Jawab (Lead)</label>
                  <select
                    value={formData.lead_id}
                    onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })}
                    className="w-full p-2 bg-white border border-[#171717] text-xs text-[#171717] focus:outline-hidden"
                  >
                    <option value="">-- Pilih PIC Lead --</option>
                    {usersList.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-[#171717]">Selaras dengan Sasaran OKR (Opsional)</label>
                <select
                  value={formData.objective_id}
                  onChange={(e) => setFormData({ ...formData, objective_id: e.target.value })}
                  className="w-full p-2 bg-white border border-[#171717] text-xs text-[#171717] focus:outline-hidden"
                >
                  <option value="">-- Tidak Terikat OKR --</option>
                  {objectivesList.map(obj => (
                    <option key={obj.id} value={obj.id}>[{obj.category}] {obj.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#171717]">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full p-2 bg-white border border-[#171717] text-xs text-[#171717] focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#171717]">Target Selesai</label>
                  <input
                    type="date"
                    value={formData.target_date}
                    onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                    className="w-full p-2 bg-white border border-[#171717] text-xs text-[#171717] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#171717]">Progres Capaian (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.progress}
                    onChange={(e) => setFormData({ ...formData, progress: e.target.value })}
                    className="w-full p-2 bg-white border border-[#171717] text-xs text-[#171717] focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#171717]">Anggaran Teralokasi (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000000"
                    value={formData.allocated_budget}
                    onChange={(e) => setFormData({ ...formData, allocated_budget: e.target.value })}
                    className="w-full p-2 bg-white border border-[#171717] text-xs text-[#171717] focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[#171717]">Realisasi Anggaran (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="500000"
                    value={formData.spent_budget}
                    onChange={(e) => setFormData({ ...formData, spent_budget: e.target.value })}
                    className="w-full p-2 bg-white border border-[#171717] text-xs text-[#171717] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-[#171717]">Justifikasi Strategis</label>
                <textarea
                  rows={2}
                  placeholder="Dampak strategis terhadap margin atau target perusahaan..."
                  value={formData.strategic_rationale}
                  onChange={(e) => setFormData({ ...formData, strategic_rationale: e.target.value })}
                  className="w-full p-2 bg-white border border-[#171717] text-xs text-[#171717] focus:outline-hidden"
                ></textarea>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#171717]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-white border border-[#171717] font-bold text-xs hover:bg-[#EAE4D8] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-[#FFD83D] border-2 border-[#171717] font-bold text-xs shadow-[3px_3px_0px_#171717] hover:bg-[#FFD83D]/90 active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 cursor-pointer"
                >
                  {formSubmitting ? 'Menyimpan...' : 'Simpan Inisiatif'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          7. MODAL: DETAIL & RESOURCE / PROJECT MANAGEMENT
         ========================================================================= */}
      {showDetailModal && selectedInitiative && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-[#171717]/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#F5F1E9] border-3 border-[#171717] shadow-[8px_8px_0px_#171717] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden my-auto">
            {/* Header */}
            <div className="p-4 border-b-2 border-[#171717] bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-[#EAE4D8] border border-[#171717] font-black text-xs">
                  {selectedInitiative.code}
                </span>
                <h3 className="font-black text-base text-[#171717] truncate max-w-md">
                  {selectedInitiative.title}
                </h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1 hover:bg-[#FF2F92] hover:text-white border border-[#171717] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5 overflow-y-auto">
              {/* Overview strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-white border border-[#171717]">
                  <div className="text-[10px] uppercase text-[#171717]/60">Status</div>
                  <div className="font-black text-xs uppercase mt-0.5">{selectedInitiative.status}</div>
                </div>
                <div className="p-3 bg-white border border-[#171717]">
                  <div className="text-[10px] uppercase text-[#171717]/60">Prioritas</div>
                  <div className="font-black text-xs uppercase mt-0.5">{selectedInitiative.priority}</div>
                </div>
                <div className="p-3 bg-white border border-[#171717]">
                  <div className="text-[10px] uppercase text-[#171717]/60">Progres</div>
                  <div className="font-black text-sm text-[#10B981] mt-0.5">{selectedInitiative.progress}%</div>
                </div>
                <div className="p-3 bg-white border border-[#171717]">
                  <div className="text-[10px] uppercase text-[#171717]/60">Realisasi Anggaran</div>
                  <div className="font-black text-xs mt-0.5 truncate">{formatRupiah(selectedInitiative.spent_budget)}</div>
                </div>
              </div>

              {/* Linked OKR */}
              {selectedInitiative.objective && (
                <div className="p-3 bg-[#B8A0F0]/15 border border-[#171717] space-y-1">
                  <div className="text-[10px] font-bold uppercase text-[#7C3AED] flex items-center gap-1">
                    <Target className="w-3.5 h-3.5" /> Keselarasan Sasaran Strategis (OKR):
                  </div>
                  <div className="font-bold text-xs text-[#171717]">
                    [{selectedInitiative.objective.category}] {selectedInitiative.objective.title}
                  </div>
                </div>
              )}

              {/* Section A: Assigned Resources */}
              <div className="bg-white border-2 border-[#171717] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-xs uppercase text-[#171717] flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#FF2F92]" />
                    Alokasi Sumber Daya Manusia ({selectedInitiative.resource_allocations?.length || 0})
                  </h4>
                  <button
                    onClick={() => setShowAllocateModal(true)}
                    className="px-3 py-1 bg-[#FFD83D] border border-[#171717] font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Tambah Alokasi SDM
                  </button>
                </div>

                {selectedInitiative.resource_allocations?.length === 0 ? (
                  <div className="p-4 bg-[#F5F1E9] border border-dashed border-[#171717] text-center text-xs text-[#171717]/60">
                    Belum ada anggota tim yang dialokasikan pada inisiatif ini.
                  </div>
                ) : (
                  <div className="divide-y divide-[#171717]/20 border border-[#171717]">
                    {selectedInitiative.resource_allocations?.map((alloc) => (
                      <div key={alloc.id} className="p-3 flex items-center justify-between gap-3 bg-white hover:bg-[#F5F1E9]">
                        <div>
                          <div className="font-bold text-xs text-[#171717]">{alloc.user?.name}</div>
                          <div className="text-[11px] text-[#171717]/60">
                            Peran: <strong className="text-[#171717]">{alloc.role_in_initiative}</strong> &bull; {alloc.user?.email}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 bg-[#FFD83D] border border-[#171717] font-black text-xs">
                            {alloc.allocation_percentage}% Kapasitas
                          </span>
                          <button
                            onClick={() => handleRemoveAllocation(alloc.user_id)}
                            className="p-1 hover:bg-[#FF2F92] hover:text-white border border-[#171717] text-[#FF2F92] cursor-pointer"
                            title="Hapus alokasi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section B: Linked Operational Projects */}
              <div className="bg-white border-2 border-[#171717] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-xs uppercase text-[#171717] flex items-center gap-1.5">
                    <FolderKanban className="w-4 h-4 text-[#FF2F92]" />
                    Proyek Pendukung Lapangan ({selectedInitiative.projects?.length || 0})
                  </h4>
                  <button
                    onClick={() => setShowLinkProjectModal(true)}
                    className="px-3 py-1 bg-[#B8A0F0] border border-[#171717] font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Hubungkan Proyek
                  </button>
                </div>

                {selectedInitiative.projects?.length === 0 ? (
                  <div className="p-4 bg-[#F5F1E9] border border-dashed border-[#171717] text-center text-xs text-[#171717]/60">
                    Belum ada proyek operasional yang dihubungkan dengan inisiatif ini.
                  </div>
                ) : (
                  <div className="divide-y divide-[#171717]/20 border border-[#171717]">
                    {selectedInitiative.projects?.map((proj) => (
                      <div key={proj.id} className="p-3 flex items-center justify-between gap-3 bg-white hover:bg-[#F5F1E9]">
                        <div>
                          <div className="font-bold text-xs text-[#171717]">[{proj.code}] {proj.name}</div>
                          <div className="text-[11px] text-[#171717]/60">
                            Status: <strong className="uppercase">{proj.status}</strong> &bull; Progres: {proj.progress}%
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUnlinkProject(proj.id)}
                            className="p-1 hover:bg-[#FF2F92] hover:text-white border border-[#171717] text-[#FF2F92] cursor-pointer"
                            title="Lepaskan Proyek"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          8. SUB-MODAL: ALLOCATE RESOURCE
         ========================================================================= */}
      {showAllocateModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-[#171717]/70 backdrop-blur-xs">
          <div className="bg-[#F5F1E9] border-3 border-[#171717] shadow-[6px_6px_0px_#171717] w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#171717] pb-2">
              <h4 className="font-black text-sm uppercase text-[#171717]">Alokasikan Anggota Tim</h4>
              <button onClick={() => setShowAllocateModal(false)} className="p-1 border border-[#171717]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAllocation} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase">Pilih Anggota Tim *</label>
                <select
                  required
                  value={allocForm.user_id}
                  onChange={(e) => setAllocForm({ ...allocForm, user_id: e.target.value })}
                  className="w-full p-2 bg-white border border-[#171717] text-xs focus:outline-hidden"
                >
                  <option value="">-- Pilih Anggota Tim --</option>
                  {usersList.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase">Peran dalam Inisiatif *</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Lead Architect, Scrum Master, Senior Dev"
                  value={allocForm.role_in_initiative}
                  onChange={(e) => setAllocForm({ ...allocForm, role_in_initiative: e.target.value })}
                  className="w-full p-2 bg-white border border-[#171717] text-xs focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase">Alokasi Kapasitas Waktu (%) *</label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  step="5"
                  required
                  value={allocForm.allocation_percentage}
                  onChange={(e) => setAllocForm({ ...allocForm, allocation_percentage: e.target.value })}
                  className="w-full p-2 bg-white border border-[#171717] text-xs focus:outline-hidden"
                />
                <p className="text-[10px] text-[#171717]/60">Persentase jam kerja yang didedikasikan untuk inisiatif ini.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#171717]">
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  className="px-3 py-1.5 bg-white border border-[#171717] text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-1.5 bg-[#FFD83D] border-2 border-[#171717] text-xs font-bold shadow-[2px_2px_0px_#171717]"
                >
                  {formSubmitting ? 'Menyimpan...' : 'Alokasikan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          9. SUB-MODAL: LINK PROJECT
         ========================================================================= */}
      {showLinkProjectModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-[#171717]/70 backdrop-blur-xs">
          <div className="bg-[#F5F1E9] border-3 border-[#171717] shadow-[6px_6px_0px_#171717] w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#171717] pb-2">
              <h4 className="font-black text-sm uppercase text-[#171717]">Hubungkan Proyek Operasional</h4>
              <button onClick={() => setShowLinkProjectModal(false)} className="p-1 border border-[#171717]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLinkProjectSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase">Pilih Proyek *</label>
                <select
                  required
                  value={linkProjectForm.project_id}
                  onChange={(e) => setLinkProjectForm({ ...linkProjectForm, project_id: e.target.value })}
                  className="w-full p-2 bg-white border border-[#171717] text-xs focus:outline-hidden"
                >
                  <option value="">-- Pilih Proyek --</option>
                  {projectsList.map(p => (
                    <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase">Deskripsi Kontribusi / Dampak</label>
                <textarea
                  rows={2}
                  placeholder="Catatan peran proyek dalam merealisasikan inisiatif ini..."
                  value={linkProjectForm.impact_description}
                  onChange={(e) => setLinkProjectForm({ ...linkProjectForm, impact_description: e.target.value })}
                  className="w-full p-2 bg-white border border-[#171717] text-xs focus:outline-hidden"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#171717]">
                <button
                  type="button"
                  onClick={() => setShowLinkProjectModal(false)}
                  className="px-3 py-1.5 bg-white border border-[#171717] text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-1.5 bg-[#B8A0F0] border-2 border-[#171717] text-xs font-bold shadow-[2px_2px_0px_#171717]"
                >
                  {formSubmitting ? 'Menghubungkan...' : 'Hubungkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
