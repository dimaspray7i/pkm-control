import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import {
  Users,
  CheckSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Search,
  RotateCcw,
  Loader2,
  X,
  Calendar,
  Folder,
  Flag,
  ChevronRight,
  History,
  ShieldCheck,
  Eye,
  BarChart2,
  List,
  Info,
  Zap,
  AlertCircle,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import PageHeader from '../../components/ui/PageHeader'

// ─── Design constants ─────────────────────────────────────────────────────────
const CREAM  = '#F5F1E9'
const INK    = '#171717'
const PINK   = '#FF2F92'
const YELLOW = '#FFD83D'
const PURPLE = '#B8A0F0'

const WORKLOAD_CONFIG = {
  Light:      { bg: 'bg-[#ECFDF5]', text: 'text-[#065F46]', border: 'border-[#10B981]', dot: '#10B981' },
  Moderate:   { bg: 'bg-[#FFFBEB]', text: 'text-[#92400E]', border: 'border-[#FFD83D]', dot: '#FFD83D' },
  High:       { bg: 'bg-[#FFF7ED]', text: 'text-[#9A3412]', border: 'border-[#FF5722]', dot: '#FF5722' },
  Overloaded: { bg: 'bg-[#FFF0F5]', text: 'text-[#9B1251]', border: 'border-[#FF2F92]', dot: '#FF2F92' },
}

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', bg: 'bg-[#FF2F92] text-white' },
  high:   { label: 'High',   bg: 'bg-[#FF5722] text-white' },
  medium: { label: 'Medium', bg: 'bg-[#FFD83D] text-[#171717]' },
  low:    { label: 'Low',    bg: 'bg-[#B8A0F0] text-[#171717]' },
}

const STATUS_CONFIG = {
  todo:        { label: 'To-do',       bg: 'bg-[#F5F1E9] text-[#171717] border-[#171717]' },
  pending:     { label: 'To-do',       bg: 'bg-[#F5F1E9] text-[#171717] border-[#171717]' },
  in_progress: { label: 'In Progress', bg: 'bg-[#FFD83D] text-[#171717] border-[#171717]' },
  in_review:   { label: 'In Review',   bg: 'bg-[#B8A0F0] text-[#171717] border-[#171717]' },
  completed:   { label: 'Done',        bg: 'bg-[#10B981] text-white border-[#171717]' },
  done:        { label: 'Done',        bg: 'bg-[#10B981] text-white border-[#171717]' },
}

const PIE_COLORS = [YELLOW, PINK, PURPLE, '#10B981']

const INSIGHT_STYLES = {
  warning: { bg: 'bg-[#FFFBEB]', border: 'border-[#FFD83D]', icon: <AlertTriangle size={15} className="text-[#92400E] shrink-0 mt-0.5" /> },
  danger:  { bg: 'bg-[#FFF0F5]', border: 'border-[#FF2F92]',  icon: <AlertCircle size={15} className="text-[#9B1251] shrink-0 mt-0.5" /> },
  info:    { bg: 'bg-[#EEF2FF]', border: 'border-[#B8A0F0]',  icon: <Info size={15} className="text-[#4338CA] shrink-0 mt-0.5" /> },
  success: { bg: 'bg-[#ECFDF5]', border: 'border-[#10B981]',  icon: <Zap size={15} className="text-[#065F46] shrink-0 mt-0.5" /> },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (d) => {
  if (!d) return '—'
  const s = d.includes('T') ? d.split('T')[0] : d
  const [y, m, day] = s.split('-')
  return new Date(+y, +m - 1, +day).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

const isOverdue = (deadline) => {
  if (!deadline) return false
  const d = deadline.includes('T') ? deadline.split('T')[0] : deadline
  return d < new Date().toISOString().slice(0, 10)
}

function KpiCard({ icon, label, value, sub, accent }) {
  return (
    <div className={`bg-white border-1.5 border-[#171717] shadow-[3px_3px_0px_#171717] rounded-lg p-4 flex flex-col gap-1`}>
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center ${accent || 'bg-[#FFD83D]'}`}>
          {icon}
        </div>
        <span className="text-[11px] font-black uppercase text-[#171717]/60 tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-black text-[#171717] leading-tight">{value ?? '—'}</div>
      {sub && <div className="text-[11px] text-[#171717]/55 font-semibold">{sub}</div>}
    </div>
  )
}

function WorkloadBadge({ level }) {
  const cfg = WORKLOAD_CONFIG[level] || WORKLOAD_CONFIG.Light
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black uppercase border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: cfg.dot }} />
      {level}
    </span>
  )
}

function ProgressBar({ value }) {
  const pct = Math.min(100, Math.max(0, value || 0))
  const color = pct === 100 ? '#10B981' : pct >= 75 ? '#B8A0F0' : pct >= 40 ? '#FFD83D' : '#FF5722'
  return (
    <div className="w-full bg-[#171717]/10 rounded-full h-1.5 overflow-hidden">
      <div className="h-1.5 rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PmTeamWorkload() {
  // Summary KPIs
  const [summary, setSummary]           = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  // Member list
  const [members, setMembers]           = useState([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [membersError, setMembersError]   = useState(null)

  // Distribution charts
  const [distribution, setDistribution]   = useState(null)
  const [distLoading, setDistLoading]     = useState(true)

  // Filters
  const [search, setSearch]               = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [deadlineFilter, setDeadlineFilter] = useState('all')
  const [workloadFilter, setWorkloadFilter] = useState('all')
  const [statusFilter, setStatusFilter]   = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  // View toggle: cards | table
  const [viewMode, setViewMode]           = useState('cards')

  // Chart tab
  const [chartTab, setChartTab]           = useState('workload')

  // Member detail
  const [selectedMember, setSelectedMember] = useState(null)
  const [detailLoading, setDetailLoading]   = useState(false)
  const [detailError, setDetailError]       = useState(null)
  const [detailTab, setDetailTab]           = useState('overview')

  // Projects list (for filter dropdown)
  const [projects, setProjects]           = useState([])

  // ── Fetch Summary ──────────────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const res = await api.get('/workload/summary')
      setSummary(res.data)
    } catch (e) {
      console.error('workload/summary', e)
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  // ── Fetch Members ──────────────────────────────────────────────────────────
  const fetchMembers = useCallback(async () => {
    setMembersLoading(true)
    setMembersError(null)
    try {
      const params = {}
      if (search)                            params.search        = search
      if (projectFilter !== 'all')           params.project_id    = projectFilter
      if (deadlineFilter !== 'all')          params.deadline_group = deadlineFilter
      if (workloadFilter !== 'all')          params.workload_level = workloadFilter
      const res = await api.get('/workload/members', { params })
      setMembers(res.data.members || [])

      // Build projects list from member data for filter dropdown (deduplicated)
      if (projects.length === 0) {
        const allProjects = []
        const seen = new Set()
        for (const m of res.data.members || []) {
          for (const p of m.projects || []) {
            if (!seen.has(p.id)) { seen.add(p.id); allProjects.push(p) }
          }
        }
        setProjects(allProjects)
      }
    } catch (e) {
      setMembersError('Gagal memuat data workload.')
    } finally {
      setMembersLoading(false)
    }
  }, [search, projectFilter, deadlineFilter, workloadFilter]) // eslint-disable-line

  // ── Fetch Distribution ─────────────────────────────────────────────────────
  const fetchDistribution = useCallback(async () => {
    setDistLoading(true)
    try {
      const res = await api.get('/workload/distribution')
      setDistribution(res.data)
    } catch (e) {
      console.error('workload/distribution', e)
    } finally {
      setDistLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary()
    fetchDistribution()
  }, [fetchSummary, fetchDistribution])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  // ── Member Detail ──────────────────────────────────────────────────────────
  const openMemberDetail = async (memberId) => {
    setSelectedMember(null)
    setDetailLoading(true)
    setDetailError(null)
    setDetailTab('overview')
    try {
      const params = {}
      if (statusFilter !== 'all')   params.status   = statusFilter
      if (priorityFilter !== 'all') params.priority  = priorityFilter
      const res = await api.get(`/workload/members/${memberId}`, { params })
      setSelectedMember(res.data)
    } catch (e) {
      setDetailError('Gagal memuat detail member.')
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setSelectedMember(null)
    setDetailError(null)
  }

  const resetFilters = () => {
    setSearch('')
    setProjectFilter('all')
    setDeadlineFilter('all')
    setWorkloadFilter('all')
    setStatusFilter('all')
    setPriorityFilter('all')
  }

  // ── Derived chart data ─────────────────────────────────────────────────────
  const memberWorkloadChart = (distribution?.member_workload || [])
    .slice(0, 10)
    .map(m => ({ name: m.member_name.split(' ')[0], active: m.active, overdue: m.overdue }))

  const statusPieData = (distribution?.status_dist || []).filter(d => d.count > 0)

  // ── Filtered member list (client-side status/priority) ────────────────────
  const filteredMembers = members.filter(m => {
    if (statusFilter !== 'all' || priorityFilter !== 'all') {
      // These filters only apply in member detail view; member-list keeps all
      return true
    }
    return true
  })

  return (
    <div className="min-h-screen bg-[#F5F1E9]">
      <PageHeader
        tag="PM WORKSPACE"
        title="Team Workload"
        subtitle="Pantau distribusi pekerjaan dan kapasitas anggota tim Anda"
      />

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── KPI Summary Row ─────────────────────────────────────────────── */}
        {summaryLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white border-1.5 border-[#171717]/20 rounded-lg h-24 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard
              icon={<Users size={16} className="text-[#171717]" />}
              label="Members Aktif"
              value={summary?.total_active_members ?? 0}
              accent="bg-[#FFD83D]"
            />
            <KpiCard
              icon={<CheckSquare size={16} className="text-[#171717]" />}
              label="Tugas Aktif"
              value={summary?.total_active_tasks ?? 0}
              accent="bg-[#B8A0F0]"
            />
            <KpiCard
              icon={<Clock size={16} className="text-white" />}
              label="Menunggu Review"
              value={summary?.total_in_review ?? 0}
              accent="bg-[#171717]"
            />
            <KpiCard
              icon={<AlertTriangle size={16} className="text-white" />}
              label="Terlambat"
              value={summary?.total_overdue ?? 0}
              accent="bg-[#FF5722]"
            />
            <KpiCard
              icon={<CheckCircle2 size={16} className="text-white" />}
              label="Selesai"
              value={summary?.total_done ?? 0}
              accent="bg-[#10B981]"
            />
            <KpiCard
              icon={<TrendingUp size={16} className="text-white" />}
              label="Beban Tertinggi"
              value={summary?.highest_workload_member?.name?.split(' ')[0] ?? '—'}
              sub={summary?.highest_workload_member
                ? `${summary.highest_workload_member.task_count} tugas · ${summary.highest_workload_member.level}`
                : undefined}
              accent="bg-[#FF2F92]"
            />
          </div>
        )}

        {/* ── Insight Banner ───────────────────────────────────────────────── */}
        {!distLoading && distribution?.insights?.length > 0 && (
          <div className="space-y-2">
            {distribution.insights.map((ins, i) => {
              const style = INSIGHT_STYLES[ins.type] || INSIGHT_STYLES.info
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border-1.5 ${style.bg} ${style.border}`}
                >
                  {style.icon}
                  <p className="text-[13px] font-semibold text-[#171717] leading-snug">{ins.message}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Filter Toolbar ───────────────────────────────────────────────── */}
        <div className="bg-white border-1.5 border-[#171717] shadow-[3px_3px_0px_#171717] rounded-lg p-4">
          <div className="flex flex-wrap gap-2 items-end">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#171717]/50" />
              <input
                type="text"
                placeholder="Cari nama member..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border-1.5 border-[#171717] rounded-md text-sm bg-[#F5F1E9] text-[#171717] placeholder:text-[#171717]/40 focus:outline-none focus:ring-2 focus:ring-[#FFD83D]"
              />
            </div>

            {/* Project filter */}
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              className="border-1.5 border-[#171717] rounded-md text-sm py-2 px-3 bg-[#F5F1E9] text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#FFD83D]"
            >
              <option value="all">Semua Proyek</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Deadline group filter */}
            <select
              value={deadlineFilter}
              onChange={e => setDeadlineFilter(e.target.value)}
              className="border-1.5 border-[#171717] rounded-md text-sm py-2 px-3 bg-[#F5F1E9] text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#FFD83D]"
            >
              <option value="all">Semua Deadline</option>
              <option value="overdue">Terlambat</option>
              <option value="due_today">Hari Ini</option>
              <option value="due_soon">7 Hari ke Depan</option>
              <option value="no_deadline">Tanpa Deadline</option>
            </select>

            {/* Workload level */}
            <select
              value={workloadFilter}
              onChange={e => setWorkloadFilter(e.target.value)}
              className="border-1.5 border-[#171717] rounded-md text-sm py-2 px-3 bg-[#F5F1E9] text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#FFD83D]"
            >
              <option value="all">Semua Level</option>
              <option value="Light">Light (0–2)</option>
              <option value="Moderate">Moderate (3–5)</option>
              <option value="High">High (6–8)</option>
              <option value="Overloaded">Overloaded (9+)</option>
            </select>

            {/* Reset */}
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-3 py-2 border-1.5 border-[#171717] rounded-md text-sm font-black uppercase hover:bg-[#FFD83D] transition-colors cursor-pointer"
            >
              <RotateCcw size={13} />
              Reset
            </button>

            {/* View toggle */}
            <div className="flex border-1.5 border-[#171717] rounded-md overflow-hidden ml-auto">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-3 py-2 text-sm transition-colors cursor-pointer ${viewMode === 'cards' ? 'bg-[#FFD83D] font-black' : 'hover:bg-[#F5F1E9]'}`}
                title="Tampilan Kartu"
              >
                <BarChart2 size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 text-sm transition-colors border-l-1.5 border-[#171717] cursor-pointer ${viewMode === 'table' ? 'bg-[#FFD83D] font-black' : 'hover:bg-[#F5F1E9]'}`}
                title="Tampilan Tabel"
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Member List ───────────────────────────────────────────────────── */}
        {membersLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white border-1.5 border-[#171717]/20 rounded-lg h-44 animate-pulse" />
            ))}
          </div>
        ) : membersError ? (
          <div className="bg-white border-1.5 border-[#FF2F92] rounded-lg p-6 text-center">
            <AlertTriangle size={28} className="text-[#FF2F92] mx-auto mb-2" />
            <p className="font-black text-[#171717]">{membersError}</p>
            <button onClick={fetchMembers} className="mt-3 px-4 py-2 bg-[#171717] text-white rounded-md text-sm font-black uppercase cursor-pointer">
              Coba Lagi
            </button>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="bg-white border-1.5 border-[#171717] rounded-lg p-10 text-center">
            <Users size={40} className="text-[#171717]/30 mx-auto mb-3" />
            <p className="font-black text-[#171717] text-lg">Tidak ada member ditemukan</p>
            <p className="text-sm text-[#171717]/55 mt-1">Coba ubah filter atau tambah tugas pada member.</p>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredMembers.map(member => (
              <MemberCard
                key={member.id}
                member={member}
                onView={() => openMemberDetail(member.id)}
              />
            ))}
          </div>
        ) : (
          <MemberTable members={filteredMembers} onView={openMemberDetail} />
        )}

        {/* ── Distribution Charts ───────────────────────────────────────────── */}
        <div className="bg-white border-1.5 border-[#171717] shadow-[3px_3px_0px_#171717] rounded-lg overflow-hidden">
          <div className="border-b-1.5 border-[#171717] flex">
            {[
              { key: 'workload', label: 'Distribusi Beban Kerja' },
              { key: 'overdue',  label: 'Tugas Terlambat' },
              { key: 'status',   label: 'Status Distribusi' },
              { key: 'priority', label: 'Distribusi Prioritas' },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setChartTab(tab.key)}
                className={`px-4 py-3 text-xs font-black uppercase border-r-1.5 border-[#171717] transition-colors cursor-pointer ${
                  chartTab === tab.key ? 'bg-[#FFD83D]' : 'hover:bg-[#F5F1E9]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4" style={{ minHeight: 280 }}>
            {distLoading ? (
              <div className="h-56 flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-[#171717]/40" />
              </div>
            ) : chartTab === 'workload' ? (
              <WorkloadBarChart data={memberWorkloadChart} />
            ) : chartTab === 'overdue' ? (
              <OverdueBarChart data={memberWorkloadChart} />
            ) : chartTab === 'status' ? (
              <StatusPieChart data={statusPieData} />
            ) : (
              <PriorityBarChart data={distribution?.priority_dist || []} />
            )}
          </div>
        </div>

      </div>

      {/* ── Member Detail Overlay ─────────────────────────────────────────── */}
      {(detailLoading || selectedMember || detailError) && (
        <MemberDetailOverlay
          loading={detailLoading}
          error={detailError}
          data={selectedMember}
          tab={detailTab}
          onTabChange={setDetailTab}
          onClose={closeDetail}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          priorityFilter={priorityFilter}
          onPriorityFilter={setPriorityFilter}
          onReload={() => selectedMember && openMemberDetail(selectedMember.member.id)}
        />
      )}
    </div>
  )
}

// ─── Member Card ──────────────────────────────────────────────────────────────
function MemberCard({ member, onView }) {
  const cfg = WORKLOAD_CONFIG[member.workload_level] || WORKLOAD_CONFIG.Light
  const od  = member.overdue_tasks > 0

  return (
    <div className={`bg-white border-1.5 border-[#171717] shadow-[3px_3px_0px_#171717] rounded-lg overflow-hidden hover:shadow-[5px_5px_0px_#171717] transition-all`}>
      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between border-b-1.5 border-[#171717] ${cfg.bg}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#171717] text-white flex items-center justify-center text-xs font-black shrink-0">
            {member.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-black text-[#171717] text-sm truncate">{member.name}</div>
            {member.position && <div className="text-[11px] text-[#171717]/55 truncate">{member.position}</div>}
          </div>
        </div>
        <WorkloadBadge level={member.workload_level} />
      </div>

      {/* Stats */}
      <div className="px-4 py-3 grid grid-cols-4 gap-2 border-b-1.5 border-[#171717]/15">
        {[
          { label: 'Aktif',    value: member.active_tasks,    color: 'text-[#171717]' },
          { label: 'Review',   value: member.in_review_tasks, color: 'text-[#B8A0F0]' },
          { label: 'Terlambat',value: member.overdue_tasks,   color: od ? 'text-[#FF2F92]' : 'text-[#171717]/40' },
          { label: 'Selesai',  value: member.done_tasks,      color: 'text-[#10B981]' },
        ].map(s => (
          <div key={s.label} className="text-center">
            <div className={`text-lg font-black ${s.color}`}>{s.value}</div>
            <div className="text-[10px] font-semibold text-[#171717]/50 uppercase">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="px-4 py-2.5 border-b-1.5 border-[#171717]/15">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[11px] font-black uppercase text-[#171717]/50">Avg Progress</span>
          <span className="text-[11px] font-black text-[#171717]">{member.avg_progress}%</span>
        </div>
        <ProgressBar value={member.avg_progress} />
      </div>

      {/* Deadline + Projects */}
      <div className="px-4 py-3 space-y-1.5">
        {member.nearest_deadline && (
          <div className={`flex items-center gap-1.5 text-[11px] ${isOverdue(member.nearest_deadline) ? 'text-[#FF2F92] font-black' : 'text-[#171717]/60 font-semibold'}`}>
            <Calendar size={12} className="shrink-0" />
            {isOverdue(member.nearest_deadline) ? '⚠ ' : ''}Deadline: {formatDate(member.nearest_deadline)}
          </div>
        )}
        {member.projects?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {member.projects.slice(0, 3).map(p => (
              <span key={p.id} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-[#F5F1E9] border border-[#171717]/30 rounded text-[#171717]/70 font-semibold">
                <Folder size={9} />
                {p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name}
              </span>
            ))}
            {member.projects.length > 3 && (
              <span className="text-[10px] text-[#171717]/40 font-semibold self-center">+{member.projects.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Action */}
      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={onView}
          className="w-full py-2 bg-[#171717] text-white rounded-md text-xs font-black uppercase hover:bg-neutral-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Eye size={13} />
          Lihat Detail
        </button>
      </div>
    </div>
  )
}

// ─── Member Table ─────────────────────────────────────────────────────────────
function MemberTable({ members, onView }) {
  return (
    <div className="bg-white border-1.5 border-[#171717] shadow-[3px_3px_0px_#171717] rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#171717] text-white">
              {['Member', 'Level', 'Aktif', 'Review', 'Terlambat', 'Selesai', 'Avg %', 'Deadline Terdekat', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={m.id} className={`border-b border-[#171717]/10 hover:bg-[#F5F1E9] transition-colors ${i % 2 === 0 ? '' : 'bg-[#FAF7F2]'}`}>
                <td className="px-4 py-3">
                  <div className="font-black text-[#171717] text-sm">{m.name}</div>
                  {m.position && <div className="text-[11px] text-[#171717]/50">{m.position}</div>}
                </td>
                <td className="px-4 py-3"><WorkloadBadge level={m.workload_level} /></td>
                <td className="px-4 py-3 font-black text-[#171717]">{m.active_tasks}</td>
                <td className="px-4 py-3 font-black text-[#B8A0F0]">{m.in_review_tasks}</td>
                <td className={`px-4 py-3 font-black ${m.overdue_tasks > 0 ? 'text-[#FF2F92]' : 'text-[#171717]/40'}`}>{m.overdue_tasks}</td>
                <td className="px-4 py-3 font-black text-[#10B981]">{m.done_tasks}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ProgressBar value={m.avg_progress} />
                    <span className="text-[11px] font-black text-[#171717] w-8 shrink-0">{m.avg_progress}%</span>
                  </div>
                </td>
                <td className={`px-4 py-3 text-[12px] font-semibold whitespace-nowrap ${m.nearest_deadline && isOverdue(m.nearest_deadline) ? 'text-[#FF2F92] font-black' : 'text-[#171717]/60'}`}>
                  {m.nearest_deadline ? formatDate(m.nearest_deadline) : '—'}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onView(m.id)}
                    className="px-3 py-1.5 bg-[#171717] text-white rounded text-[11px] font-black uppercase hover:bg-neutral-800 cursor-pointer transition-colors"
                  >
                    Detail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Member Detail Overlay ────────────────────────────────────────────────────
function MemberDetailOverlay({ loading, error, data, tab, onTabChange, onClose, statusFilter, onStatusFilter, priorityFilter, onPriorityFilter, onReload }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[#171717]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-white border-l-1.5 border-[#171717] flex flex-col h-full shadow-[-4px_0_12px_rgba(0,0,0,0.15)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b-1.5 border-[#171717] bg-[#171717] text-white shrink-0">
          <div className="flex items-center gap-3">
            {data?.member ? (
              <>
                <div className="w-9 h-9 rounded-full bg-[#FFD83D] text-[#171717] flex items-center justify-center text-sm font-black shrink-0">
                  {data.member.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-black text-sm">{data.member.name}</div>
                  {data.member.position && <div className="text-[11px] text-white/60">{data.member.position}</div>}
                </div>
              </>
            ) : (
              <span className="font-black text-sm">Detail Member</span>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-white/10 rounded cursor-pointer transition-colors">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 size={32} className="animate-spin text-[#171717]/40 mx-auto mb-2" />
              <p className="text-sm text-[#171717]/50 font-semibold">Memuat data member…</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <AlertTriangle size={32} className="text-[#FF2F92] mx-auto mb-2" />
              <p className="font-black text-[#171717]">{error}</p>
              <button onClick={onReload} className="mt-3 px-4 py-2 bg-[#171717] text-white rounded-md text-sm font-black uppercase cursor-pointer">
                Coba Lagi
              </button>
            </div>
          </div>
        ) : data ? (
          <>
            {/* Tabs */}
            <div className="flex border-b-1.5 border-[#171717] shrink-0 overflow-x-auto">
              {[
                { key: 'overview',  label: 'Overview',          icon: <BarChart2 size={13} /> },
                { key: 'tasks',     label: 'Daftar Tugas',      icon: <CheckSquare size={13} /> },
                { key: 'progress',  label: 'Riwayat Progress',  icon: <History size={13} /> },
                { key: 'approval',  label: 'Riwayat Approval',  icon: <ShieldCheck size={13} /> },
              ].map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onTabChange(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-[11px] font-black uppercase whitespace-nowrap border-r border-[#171717]/15 transition-colors cursor-pointer ${
                    tab === t.key ? 'bg-[#FFD83D] text-[#171717]' : 'hover:bg-[#F5F1E9]'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {tab === 'overview' && <DetailOverview summary={data.summary} member={data.member} />}
              {tab === 'tasks' && (
                <DetailTasks
                  tasks={data.tasks}
                  statusFilter={statusFilter}
                  onStatusFilter={onStatusFilter}
                  priorityFilter={priorityFilter}
                  onPriorityFilter={onPriorityFilter}
                />
              )}
              {tab === 'progress' && <DetailProgressHistory items={data.progress_history} />}
              {tab === 'approval' && <DetailApprovalHistory items={data.approval_history} />}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

// ─── Detail: Overview ─────────────────────────────────────────────────────────
function DetailOverview({ summary, member }) {
  if (!summary) return null
  return (
    <div className="p-5 space-y-5">
      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Tugas',    value: summary.total_tasks,  color: 'text-[#171717]', accent: 'bg-[#F5F1E9]' },
          { label: 'Tugas Aktif',   value: summary.active_tasks,  color: 'text-[#171717]', accent: 'bg-[#B8A0F0]/20' },
          { label: 'Menunggu Review',value: summary.in_review,    color: 'text-[#B8A0F0]', accent: 'bg-[#B8A0F0]/20' },
          { label: 'Terlambat',     value: summary.overdue,      color: summary.overdue > 0 ? 'text-[#FF2F92]' : 'text-[#171717]/40', accent: summary.overdue > 0 ? 'bg-[#FFF0F5]' : 'bg-[#F5F1E9]' },
          { label: 'Selesai',       value: summary.done,         color: 'text-[#10B981]', accent: 'bg-[#ECFDF5]' },
        ].map(s => (
          <div key={s.label} className={`${s.accent} border-1.5 border-[#171717]/15 rounded-lg p-3`}>
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[11px] font-black uppercase text-[#171717]/50 mt-0.5">{s.label}</div>
          </div>
        ))}
        <div className="bg-[#FFD83D]/30 border-1.5 border-[#171717]/15 rounded-lg p-3">
          <div className="text-2xl font-black text-[#171717]">{summary.avg_progress}%</div>
          <div className="text-[11px] font-black uppercase text-[#171717]/50 mt-0.5">Avg Progress</div>
          <ProgressBar value={summary.avg_progress} />
        </div>
      </div>

      {/* Workload level */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-black text-[#171717]/60 uppercase">Level Beban Kerja:</span>
        <WorkloadBadge level={summary.workload_level} />
      </div>

      {/* Member contact */}
      <div className="bg-[#F5F1E9] border-1.5 border-[#171717]/20 rounded-lg p-4 space-y-1.5">
        <div className="text-[11px] font-black uppercase text-[#171717]/50 mb-2">Kontak</div>
        <div className="text-sm text-[#171717] font-semibold">{member.email}</div>
        {member.phone && <div className="text-sm text-[#171717]/60 font-semibold">{member.phone}</div>}
        {member.department && <div className="text-sm text-[#171717]/60 font-semibold">{member.department}</div>}
      </div>
    </div>
  )
}

// ─── Detail: Task List ────────────────────────────────────────────────────────
function DetailTasks({ tasks, statusFilter, onStatusFilter, priorityFilter, onPriorityFilter }) {
  const filtered = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    return true
  })

  return (
    <div className="p-5 space-y-3">
      {/* Mini filters */}
      <div className="flex gap-2 flex-wrap">
        <select
          value={statusFilter}
          onChange={e => onStatusFilter(e.target.value)}
          className="border-1.5 border-[#171717] rounded text-xs py-1.5 px-2 bg-[#F5F1E9] text-[#171717] focus:outline-none cursor-pointer"
        >
          <option value="all">Semua Status</option>
          <option value="todo">To-do</option>
          <option value="in_progress">In Progress</option>
          <option value="in_review">In Review</option>
          <option value="done">Done</option>
          <option value="completed">Completed</option>
        </select>
        <select
          value={priorityFilter}
          onChange={e => onPriorityFilter(e.target.value)}
          className="border-1.5 border-[#171717] rounded text-xs py-1.5 px-2 bg-[#F5F1E9] text-[#171717] focus:outline-none cursor-pointer"
        >
          <option value="all">Semua Prioritas</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-center text-[#171717]/40 py-8">Tidak ada tugas ditemukan.</p>
      ) : (
        filtered.map(task => {
          const statusCfg   = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo
          const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.low

          return (
            <div
              key={task.id}
              className={`bg-white border-1.5 rounded-lg p-3.5 space-y-2 ${task.is_overdue ? 'border-[#FF2F92]' : 'border-[#171717]/20'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-black text-[#171717] leading-snug">{task.title}</span>
                <div className="flex gap-1 shrink-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-black uppercase ${priorityCfg.bg}`}>{priorityCfg.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-black uppercase ${statusCfg.bg}`}>{statusCfg.label}</span>
                </div>
              </div>

              {task.project && (
                <div className="flex items-center gap-1 text-[11px] text-[#171717]/50 font-semibold">
                  <Folder size={11} />
                  {task.project.name}
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex justify-between text-[10px] font-black text-[#171717]/50 mb-1">
                    <span>Progress Checklist</span>
                    <span>{task.completed_checklists}/{task.total_checklists}</span>
                  </div>
                  <ProgressBar value={task.checklist_progress} />
                </div>
                <div className={`text-[11px] font-black whitespace-nowrap ${task.is_overdue ? 'text-[#FF2F92]' : 'text-[#171717]/50'}`}>
                  <Calendar size={10} className="inline mr-1" />
                  {formatDate(task.deadline)}
                  {task.is_overdue && ' ⚠'}
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── Detail: Progress History ─────────────────────────────────────────────────
function DetailProgressHistory({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="p-8 text-center text-[#171717]/40">
        <History size={32} className="mx-auto mb-2" />
        <p className="text-sm font-semibold">Belum ada laporan progres.</p>
      </div>
    )
  }
  return (
    <div className="p-5 space-y-3">
      {items.map(item => (
        <div key={item.id} className="bg-[#F5F1E9] border-1.5 border-[#171717]/20 rounded-lg p-3.5 space-y-2">
          <div className="flex justify-between items-start gap-2">
            <span className="text-xs font-black text-[#171717] truncate">{item.task_title}</span>
            <span className="text-[10px] text-[#171717]/50 font-semibold whitespace-nowrap shrink-0">
              {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <p className="text-sm text-[#171717] leading-snug">{item.description}</p>
          {item.progress != null && (
            <div className="flex items-center gap-2">
              <ProgressBar value={item.progress} />
              <span className="text-[11px] font-black text-[#171717] w-8 shrink-0">{item.progress}%</span>
            </div>
          )}
          {item.blocker && (
            <div className="text-[11px] text-[#FF5722] font-semibold">⚠ Kendala: {item.blocker}</div>
          )}
          {item.next_plan && (
            <div className="text-[11px] text-[#171717]/60 font-semibold">→ {item.next_plan}</div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Detail: Approval History ─────────────────────────────────────────────────
function DetailApprovalHistory({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="p-8 text-center text-[#171717]/40">
        <ShieldCheck size={32} className="mx-auto mb-2" />
        <p className="text-sm font-semibold">Belum ada riwayat approval.</p>
      </div>
    )
  }

  const ACTION_STYLES = {
    submitted: { bg: 'bg-[#EEF2FF] text-[#4338CA]', label: 'Diajukan' },
    approved:  { bg: 'bg-[#ECFDF5] text-[#065F46]', label: 'Disetujui' },
    rejected:  { bg: 'bg-[#FFF0F5] text-[#9B1251]', label: 'Ditolak' },
    reopened:  { bg: 'bg-[#FFFBEB] text-[#92400E]', label: 'Dibuka Ulang' },
  }

  return (
    <div className="p-5 space-y-3">
      {items.map(item => {
        const style = ACTION_STYLES[item.action] || ACTION_STYLES.submitted
        return (
          <div key={item.id} className="bg-[#F5F1E9] border-1.5 border-[#171717]/20 rounded-lg p-3.5 space-y-2">
            <div className="flex justify-between items-start gap-2">
              <span className="text-xs font-black text-[#171717] truncate">{item.task_title}</span>
              <span className="text-[10px] text-[#171717]/50 font-semibold whitespace-nowrap shrink-0">
                {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${style.bg}`}>{style.label}</span>
              {item.reviewer && (
                <span className="text-[11px] text-[#171717]/55 font-semibold">oleh {item.reviewer}</span>
              )}
            </div>
            {item.notes && (
              <p className="text-sm text-[#171717] leading-snug italic">"{item.notes}"</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Charts ───────────────────────────────────────────────────────────────────
function WorkloadBarChart({ data }) {
  if (!data?.length) return <EmptyChart />
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#171717" strokeOpacity={0.1} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#171717' }} />
        <YAxis tick={{ fontSize: 11, fill: '#171717' }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ border: '1.5px solid #171717', borderRadius: 8, background: '#FFF', fontSize: 12, fontWeight: 700 }}
        />
        <Bar dataKey="active" name="Tugas Aktif" fill={PURPLE} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function OverdueBarChart({ data }) {
  if (!data?.length) return <EmptyChart />
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#171717" strokeOpacity={0.1} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#171717' }} />
        <YAxis tick={{ fontSize: 11, fill: '#171717' }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ border: '1.5px solid #171717', borderRadius: 8, background: '#FFF', fontSize: 12, fontWeight: 700 }}
        />
        <Bar dataKey="overdue" name="Tugas Terlambat" fill={PINK} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function StatusPieChart({ data }) {
  if (!data?.length) return <EmptyChart />
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#171717" strokeWidth={1.5} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ border: '1.5px solid #171717', borderRadius: 8, background: '#FFF', fontSize: 12, fontWeight: 700 }} />
        <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function PriorityBarChart({ data }) {
  if (!data?.length) return <EmptyChart />
  const colors = { Low: PURPLE, Medium: YELLOW, High: '#FF5722', Urgent: PINK }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#171717" strokeOpacity={0.1} />
        <XAxis dataKey="priority" tick={{ fontSize: 11, fontWeight: 700, fill: '#171717' }} />
        <YAxis tick={{ fontSize: 11, fill: '#171717' }} allowDecimals={false} />
        <Tooltip contentStyle={{ border: '1.5px solid #171717', borderRadius: 8, background: '#FFF', fontSize: 12, fontWeight: 700 }} />
        <Bar dataKey="count" name="Jumlah Tugas" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={colors[entry.priority] || PURPLE} stroke="#171717" strokeWidth={1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function EmptyChart() {
  return (
    <div className="h-56 flex items-center justify-center text-[#171717]/30">
      <div className="text-center">
        <BarChart2 size={36} className="mx-auto mb-2" />
        <p className="text-sm font-semibold">Belum ada data</p>
      </div>
    </div>
  )
}
