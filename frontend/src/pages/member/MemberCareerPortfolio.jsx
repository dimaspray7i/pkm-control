import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import {
  Award,
  Briefcase,
  CheckCircle2,
  Clock,
  Calendar,
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Send,
  AlertCircle,
  X,
  RefreshCw,
  Layers,
  ArrowRight,
  TrendingUp,
  Inbox,
  CheckSquare,
  AlertTriangle,
  FileText,
  User,
  FolderKanban,
  Eye,
  EyeOff,
  Star,
  ShieldCheck,
  RotateCcw,
  BookOpen,
  GraduationCap,
  Sliders,
  ChevronRight
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import PageLoading from '../../components/ui/PageLoading'

// Konfigurasi Kategori Pencapaian
const ACHIEVEMENT_CATEGORIES = {
  project_achievement: { label: 'Project Achievement', bg: 'bg-[#FFD83D] text-[#171717]' },
  technical_achievement: { label: 'Technical Achievement', bg: 'bg-[#B8A0F0] text-[#171717]' },
  process_improvement: { label: 'Process Improvement', bg: 'bg-[#5CE1E6] text-[#171717]' },
  team_contribution: { label: 'Team Contribution', bg: 'bg-[#FF8A50] text-[#171717]' },
  learning_achievement: { label: 'Learning Achievement', bg: 'bg-[#00E599] text-[#171717]' },
  innovation: { label: 'Innovation', bg: 'bg-[#FF2F92] text-white' },
  other_achievement: { label: 'Other Achievement', bg: 'bg-[#EAE4D8] text-[#171717]' },
}

// Konfigurasi Status Verifikasi
const VERIFICATION_STATUS_CONFIG = {
  draft: {
    label: 'Draft',
    badge: 'bg-[#EAE4D8] text-[#171717] border-[#171717]',
    desc: 'Belum diajukan untuk verifikasi.',
    icon: FileText
  },
  pending_verification: {
    label: 'Menunggu Verifikasi',
    badge: 'bg-[#FFD83D] text-[#171717] border-[#171717]',
    desc: 'Sedang ditinjau oleh Project Manager / Admin.',
    icon: Clock
  },
  verified: {
    label: 'Terverifikasi',
    badge: 'bg-[#00E599] text-[#171717] border-[#171717]',
    desc: 'Telah disetujui dan divalidasi resmi.',
    icon: ShieldCheck
  },
  revision_requested: {
    label: 'Perlu Revisi',
    badge: 'bg-[#FF2F92] text-white border-[#171717]',
    desc: 'PM meminta perbaikan data atau bukti tambahan.',
    icon: RotateCcw
  },
}

export default function MemberCareerPortfolio() {
  const { user } = useAuth()

  // State Tab Navigasi
  const [activeTab, setActiveTab] = useState('overview') // 'overview', 'achievements', 'projects', 'competencies', 'history', 'presentation'

  // State Data
  const [overview, setOverview] = useState(null)
  const [achievements, setAchievements] = useState([])
  const [contributions, setContributions] = useState([])
  const [competencies, setCompetencies] = useState(null)
  const [presentation, setPresentation] = useState(null)

  // State Loading & Refresh
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [toastMsg, setToastMsg] = useState(null)

  // Filter & Search Pencapaian
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [sortBy, setSortBy] = useState('date_desc')

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [submitModalOpen, setSubmitModalOpen] = useState(false)

  // Selected Item for Actions
  const [selectedAchievement, setSelectedAchievement] = useState(null)
  const [isEditing, setIsEditing] = useState(false)

  // Forms
  const [achievementForm, setAchievementForm] = useState({
    title: '',
    category: 'project_achievement',
    description: '',
    achievement_date: new Date().toISOString().split('T')[0],
    project_id: '',
    skill_id: '',
    result_impact: '',
    evidence_url: '',
    evidence_notes: '',
    is_featured: false,
    is_visible: true,
  })

  const [profileForm, setProfileForm] = useState({
    headline: '',
    summary_bio: '',
    is_public_within_team: false,
  })

  const [submitNotes, setSubmitNotes] = useState('')

  // Show Toast Message Helper
  const showToast = (message, type = 'success') => {
    setToastMsg({ text: message, type })
    setTimeout(() => setToastMsg(null), 4000)
  }

  // Fetch Overview Data
  const fetchOverview = useCallback(async () => {
    try {
      const res = await api.get('/member/portfolio/overview')
      setOverview(res.data)
      if (res.data.profile) {
        setProfileForm({
          headline: res.data.profile.headline || '',
          summary_bio: res.data.profile.summary_bio || '',
          is_public_within_team: Boolean(res.data.profile.is_public_within_team),
        })
      }
    } catch (err) {
      console.error('Error fetching portfolio overview:', err)
      setError('Gagal memuat ringkasan portofolio.')
    }
  }, [])

  // Fetch Achievements Data
  const fetchAchievements = useCallback(async () => {
    try {
      const params = {}
      if (filterCategory) params.category = filterCategory
      if (filterStatus) params.verification_status = filterStatus
      if (searchKeyword) params.search = searchKeyword
      if (sortBy) params.sort_by = sortBy

      const res = await api.get('/member/portfolio/achievements', { params })
      setAchievements(res.data.achievements || [])
    } catch (err) {
      console.error('Error fetching achievements:', err)
    }
  }, [filterCategory, filterStatus, searchKeyword, sortBy])

  // Fetch Project Contributions Data
  const fetchContributions = useCallback(async () => {
    try {
      const res = await api.get('/member/portfolio/project-contributions')
      setContributions(res.data.contributions || [])
    } catch (err) {
      console.error('Error fetching contributions:', err)
    }
  }, [])

  // Fetch Competency Evidence Data
  const fetchCompetencies = useCallback(async () => {
    try {
      const res = await api.get('/member/portfolio/competency-evidence')
      setCompetencies(res.data)
    } catch (err) {
      console.error('Error fetching competency evidence:', err)
    }
  }, [])

  // Fetch Presentation Data
  const fetchPresentation = useCallback(async () => {
    try {
      const res = await api.get('/member/portfolio/presentation')
      setPresentation(res.data)
    } catch (err) {
      console.error('Error fetching presentation:', err)
    }
  }, [])

  // Initial Load
  const loadAllData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        fetchOverview(),
        fetchAchievements(),
        fetchContributions(),
        fetchCompetencies(),
        fetchPresentation(),
      ])
    } catch (err) {
      setError('Terjadi kendala saat memuat data portofolio.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [fetchOverview, fetchAchievements, fetchContributions, fetchCompetencies, fetchPresentation])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  // Refresh Trigger
  const handleRefresh = async () => {
    setRefreshing(true)
    await loadAllData()
  }

  // Handle Open Create Modal
  const handleOpenCreateModal = () => {
    setIsEditing(false)
    setSelectedAchievement(null)
    setAchievementForm({
      title: '',
      category: 'project_achievement',
      description: '',
      achievement_date: new Date().toISOString().split('T')[0],
      project_id: '',
      skill_id: '',
      result_impact: '',
      evidence_url: '',
      evidence_notes: '',
      is_featured: false,
      is_visible: true,
    })
    setCreateModalOpen(true)
  }

  // Handle Open Edit Modal
  const handleOpenEditModal = (item) => {
    setIsEditing(true)
    setSelectedAchievement(item)
    setAchievementForm({
      title: item.title,
      category: item.category,
      description: item.description,
      achievement_date: item.achievement_date ? item.achievement_date.split('T')[0] : '',
      project_id: item.project_id || '',
      skill_id: item.skill_id || '',
      result_impact: item.result_impact || '',
      evidence_url: item.evidence_url || '',
      evidence_notes: item.evidence_notes || '',
      is_featured: Boolean(item.is_featured),
      is_visible: Boolean(item.is_visible),
    })
    setCreateModalOpen(true)
  }

  // Handle Save / Update Achievement
  const handleSaveAchievement = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...achievementForm,
        project_id: achievementForm.project_id ? parseInt(achievementForm.project_id) : null,
        skill_id: achievementForm.skill_id ? parseInt(achievementForm.skill_id) : null,
      }

      if (isEditing && selectedAchievement) {
        await api.put(`/member/portfolio/achievements/${selectedAchievement.id}`, payload)
        showToast('Pencapaian berhasil diperbarui.')
      } else {
        await api.post('/member/portfolio/achievements', payload)
        showToast('Pencapaian baru berhasil disimpan sebagai draft.')
      }

      setCreateModalOpen(false)
      fetchAchievements()
      fetchOverview()
      fetchPresentation()
    } catch (err) {
      const message = err.response?.data?.message || 'Gagal menyimpan pencapaian.'
      showToast(message, 'error')
    }
  }

  // Handle Delete Achievement
  const handleDeleteAchievement = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pencapaian ini?')) {
      return
    }

    try {
      await api.delete(`/member/portfolio/achievements/${id}`)
      showToast('Pencapaian berhasil dihapus.')
      fetchAchievements()
      fetchOverview()
      fetchPresentation()
    } catch (err) {
      const message = err.response?.data?.message || 'Gagal menghapus pencapaian.'
      showToast(message, 'error')
    }
  }

  // Handle Submit For Verification
  const handleSubmitForVerification = async () => {
    if (!selectedAchievement) return

    try {
      await api.post(`/member/portfolio/achievements/${selectedAchievement.id}/submit`, {
        notes: submitNotes || undefined,
      })
      showToast('Pencapaian berhasil diajukan untuk verifikasi PM.')
      setSubmitModalOpen(false)
      setSubmitNotes('')
      fetchAchievements()
      fetchOverview()
      fetchPresentation()
    } catch (err) {
      const message = err.response?.data?.message || 'Gagal mengajukan verifikasi.'
      showToast(message, 'error')
    }
  }

  // Handle Curate Toggle (Featured / Visible)
  const handleToggleCurate = async (id, field, currentValue) => {
    try {
      await api.patch(`/member/portfolio/achievements/${id}/curate`, {
        [field]: !currentValue,
      })
      showToast('Pengaturan kurasi portofolio berhasil diperbarui.')
      fetchAchievements()
      fetchPresentation()
    } catch (err) {
      showToast('Gagal memperbarui kurasi portofolio.', 'error')
    }
  }

  // Handle Save Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    try {
      await api.put('/member/portfolio/presentation/profile', profileForm)
      showToast('Profil portofolio berhasil diperbarui.')
      setProfileModalOpen(false)
      fetchOverview()
      fetchPresentation()
    } catch (err) {
      showToast('Gagal menyimpan profil portofolio.', 'error')
    }
  }

  // Handle View Detail Modal
  const handleViewDetail = async (item) => {
    try {
      const res = await api.get(`/member/portfolio/achievements/${item.id}`)
      setSelectedAchievement(res.data.achievement)
      setDetailModalOpen(true)
    } catch (err) {
      setSelectedAchievement(item)
      setDetailModalOpen(true)
    }
  }

  if (loading) {
    return <PageLoading message="Memuat Portofolio Karir & Pencapaian..." />
  }

  return (
    <div className="min-h-screen bg-[#F5F1E9] text-[#171717] pb-16 font-sans">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div
            className={`border-3 border-[#171717] px-5 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold flex items-center gap-3 ${
              toastMsg.type === 'error'
                ? 'bg-[#FF2F92] text-white'
                : 'bg-[#00E599] text-[#171717]'
            }`}
          >
            {toastMsg.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            <span>{toastMsg.text}</span>
          </div>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Portofolio Karir & Pencapaian"
        subtitle="Dokumentasi profesional pribadi atas pencapaian kerja, kontribusi proyek, dan bukti kompetensi nyata."
        breadcrumbs={[
          { label: 'Workspace Saya', path: '/tasks' },
          { label: 'Portofolio Karir', path: '/member/portfolio' },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-white border-2 border-[#171717] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FAF7F2] font-bold text-sm flex items-center gap-2 active:translate-x-[1px] active:translate-y-[1px]"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-[#FFD83D] border-2 border-[#171717] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#ffdf59] font-bold text-sm flex items-center gap-2 active:translate-x-[1px] active:translate-y-[1px]"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Pencapaian</span>
            </button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Navigation Tabs (Neobrutalism Tab Bar) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b-3 border-[#171717] scrollbar-thin">
          {[
            { id: 'overview', label: 'Ringkasan Portofolio', icon: Sparkles },
            { id: 'achievements', label: 'Pencapaian Saya', icon: Award, count: achievements.length },
            { id: 'projects', label: 'Kontribusi Proyek', icon: FolderKanban, count: contributions.length },
            { id: 'competencies', label: 'Bukti Kompetensi', icon: GraduationCap },
            { id: 'history', label: 'Riwayat Verifikasi', icon: ShieldCheck },
            { id: 'presentation', label: 'Tampilan Portofolio', icon: Briefcase },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 font-black text-sm whitespace-nowrap border-2 border-[#171717] transition-all flex items-center gap-2 ${
                  isActive
                    ? 'bg-[#171717] text-[#F5F1E9] shadow-[3px_3px_0px_0px_rgba(255,216,61,1)] -translate-y-[2px]'
                    : 'bg-white text-[#171717] hover:bg-[#FAF7F2] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`ml-1 px-2 py-0.5 text-xs font-bold rounded-full ${
                      isActive ? 'bg-[#FFD83D] text-[#171717]' : 'bg-[#EAE4D8] text-[#171717]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab 1: Portfolio Overview */}
        {activeTab === 'overview' && overview && (
          <div className="mt-8 space-y-8">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white border-3 border-[#171717] p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center justify-between text-[#171717]">
                  <span className="text-xs font-black uppercase tracking-wider text-neutral-600">Total Prestasi</span>
                  <Award className="w-5 h-5 text-[#FF2F92]" />
                </div>
                <div className="text-3xl font-black mt-2">{overview.metrics?.total_achievements || 0}</div>
                <div className="text-xs font-semibold text-neutral-600 mt-1">Pencapaian pribadi</div>
              </div>

              <div className="bg-[#00E599]/20 border-3 border-[#171717] p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center justify-between text-[#171717]">
                  <span className="text-xs font-black uppercase tracking-wider text-neutral-700">Terverifikasi</span>
                  <ShieldCheck className="w-5 h-5 text-[#00A86B]" />
                </div>
                <div className="text-3xl font-black mt-2 text-[#00A86B]">{overview.metrics?.verified_achievements || 0}</div>
                <div className="text-xs font-semibold text-neutral-600 mt-1">Divalidasi PM/Admin</div>
              </div>

              <div className="bg-[#FFD83D]/20 border-3 border-[#171717] p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center justify-between text-[#171717]">
                  <span className="text-xs font-black uppercase tracking-wider text-neutral-700">Dalam Antrean</span>
                  <Clock className="w-5 h-5 text-[#D97706]" />
                </div>
                <div className="text-3xl font-black mt-2 text-[#D97706]">{overview.metrics?.pending_verification || 0}</div>
                <div className="text-xs font-semibold text-neutral-600 mt-1">Menunggu review</div>
              </div>

              <div className="bg-white border-3 border-[#171717] p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center justify-between text-[#171717]">
                  <span className="text-xs font-black uppercase tracking-wider text-neutral-600">Proyek Kerja</span>
                  <FolderKanban className="w-5 h-5 text-[#5CE1E6]" />
                </div>
                <div className="text-3xl font-black mt-2">{overview.metrics?.total_projects_contributed || 0}</div>
                <div className="text-xs font-semibold text-neutral-600 mt-1">Tugas dikontribusikan</div>
              </div>

              <div className="bg-white border-3 border-[#171717] p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center justify-between text-[#171717]">
                  <span className="text-xs font-black uppercase tracking-wider text-neutral-600">Skill Berbukti</span>
                  <GraduationCap className="w-5 h-5 text-[#B8A0F0]" />
                </div>
                <div className="text-3xl font-black mt-2">{overview.metrics?.skills_with_evidence || 0}</div>
                <div className="text-xs font-semibold text-neutral-600 mt-1">Memiliki bukti/URL</div>
              </div>

              <div className="bg-white border-3 border-[#171717] p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center justify-between text-[#171717]">
                  <span className="text-xs font-black uppercase tracking-wider text-neutral-600">Jam Belajar</span>
                  <BookOpen className="w-5 h-5 text-[#FF8A50]" />
                </div>
                <div className="text-3xl font-black mt-2">{overview.metrics?.learning_hours || 0}h</div>
                <div className="text-xs font-semibold text-neutral-600 mt-1">Aktual dari M-D</div>
              </div>
            </div>

            {/* Profile Spotlight Banner */}
            <div className="bg-white border-3 border-[#171717] p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-[#FFD83D] border-3 border-[#171717] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center font-black text-2xl text-[#171717]">
                    {user?.name?.charAt(0) || 'M'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-[#171717]">{user?.name}</h3>
                      <span className="px-2.5 py-0.5 bg-[#171717] text-white text-xs font-bold border border-[#171717]">
                        Anggota Tim PKM
                      </span>
                    </div>
                    <p className="text-sm font-bold text-neutral-700 mt-0.5">
                      {overview.profile?.headline || 'Profesional PT Potensi Karya Mandiri'}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {overview.profile?.summary_bio || 'Belum ada ringkasan bio profesional. Klik "Atur Tampilan" untuk menambahkan ringkasan bio karir Anda.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setProfileModalOpen(true)}
                    className="px-4 py-2 bg-white border-2 border-[#171717] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FAF7F2] font-bold text-sm flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Ubah Profil</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('presentation')}
                    className="px-4 py-2 bg-[#FF2F92] text-white border-2 border-[#171717] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#e0267d] font-bold text-sm flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Lihat Portofolio</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Dua Kolom: Pencapaian Terbaru & Kontribusi Terbaru */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Kolom Kiri: Pencapaian Terbaru */}
              <div className="bg-white border-3 border-[#171717] p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center justify-between pb-4 border-b-2 border-[#171717]">
                  <div className="flex items-center gap-2 font-black text-lg">
                    <Award className="w-5 h-5 text-[#FF2F92]" />
                    <span>Pencapaian Terbaru</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('achievements')}
                    className="text-xs font-bold text-neutral-700 hover:text-black flex items-center gap-1"
                  >
                    <span>Lihat Semua</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  {overview.recent_achievements?.length > 0 ? (
                    overview.recent_achievements.map((item) => {
                      const catConfig = ACHIEVEMENT_CATEGORIES[item.category] || ACHIEVEMENT_CATEGORIES.other_achievement
                      const statusConfig = VERIFICATION_STATUS_CONFIG[item.verification_status] || VERIFICATION_STATUS_CONFIG.draft
                      return (
                        <div
                          key={item.id}
                          className="p-4 border-2 border-[#171717] bg-[#FAF7F2] hover:bg-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 text-xs font-bold border border-[#171717] ${catConfig.bg}`}>
                                {catConfig.label}
                              </span>
                              <span className={`px-2 py-0.5 text-xs font-bold border ${statusConfig.badge}`}>
                                {statusConfig.label}
                              </span>
                            </div>
                            <h4 className="font-black text-base mt-2 text-[#171717]">{item.title}</h4>
                            <p className="text-xs text-neutral-600 line-clamp-2 mt-1">{item.description}</p>
                          </div>
                          <div className="mt-3 pt-2 border-t border-neutral-300 flex items-center justify-between text-xs text-neutral-500">
                            <span>{item.achievement_date}</span>
                            {item.project && <span className="font-bold text-[#171717]">{item.project.name}</span>}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="text-center py-8 text-neutral-500 font-semibold">
                      <Inbox className="w-8 h-8 mx-auto mb-2 text-neutral-400" />
                      Belum ada pencapaian. Tambahkan pencapaian profesional Anda.
                    </div>
                  )}
                </div>
              </div>

              {/* Kolom Kanan: Aktivitas Kontribusi Tugas Terbaru */}
              <div className="bg-white border-3 border-[#171717] p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center justify-between pb-4 border-b-2 border-[#171717]">
                  <div className="flex items-center gap-2 font-black text-lg">
                    <CheckSquare className="w-5 h-5 text-[#00E599]" />
                    <span>Kontribusi Tugas Proyek</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('projects')}
                    className="text-xs font-bold text-neutral-700 hover:text-black flex items-center gap-1"
                  >
                    <span>Lihat Proyek</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {overview.recent_tasks?.length > 0 ? (
                    overview.recent_tasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-3 border-2 border-[#171717] bg-[#FAF7F2] flex items-center justify-between gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#171717] bg-[#FFD83D] px-1.5 py-0.5 border border-[#171717]">
                              {task.project?.code || 'PKM'}
                            </span>
                            <span className="text-xs font-bold text-neutral-600 truncate">{task.project?.name}</span>
                          </div>
                          <p className="font-black text-sm text-[#171717] truncate mt-1">{task.title}</p>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-bold border border-[#171717] ${
                            task.is_completed ? 'bg-[#00E599] text-[#171717]' : 'bg-white text-neutral-700'
                          }`}
                        >
                          {task.is_completed ? 'Selesai' : task.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-neutral-500 font-semibold">
                      <Inbox className="w-8 h-8 mx-auto mb-2 text-neutral-400" />
                      Belum ada penugasan tugas yang tercatat.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: My Achievements (Pencapaian Saya) */}
        {activeTab === 'achievements' && (
          <div className="mt-8 space-y-6">
            {/* Filter & Toolbar */}
            <div className="bg-white border-3 border-[#171717] p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Search */}
                <div className="w-full md:w-72">
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="Cari pencapaian..."
                    className="w-full px-3 py-2 border-2 border-[#171717] font-semibold text-sm focus:outline-none focus:bg-[#FAF7F2]"
                  />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-3 py-2 border-2 border-[#171717] font-bold text-xs bg-white focus:outline-none"
                  >
                    <option value="">Semua Kategori</option>
                    {Object.entries(ACHIEVEMENT_CATEGORIES).map(([key, val]) => (
                      <option key={key} value={key}>
                        {val.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 border-2 border-[#171717] font-bold text-xs bg-white focus:outline-none"
                  >
                    <option value="">Semua Status</option>
                    {Object.entries(VERIFICATION_STATUS_CONFIG).map(([key, val]) => (
                      <option key={key} value={key}>
                        {val.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 border-2 border-[#171717] font-bold text-xs bg-white focus:outline-none"
                  >
                    <option value="date_desc">Tanggal Terbaru</option>
                    <option value="date_asc">Tanggal Terlama</option>
                    <option value="title_asc">Judul (A-Z)</option>
                  </select>

                  <button
                    onClick={handleOpenCreateModal}
                    className="px-4 py-2 bg-[#FFD83D] border-2 border-[#171717] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#ffdf59] font-black text-xs flex items-center gap-1.5 ml-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Grid Kartu Pencapaian */}
            {achievements.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {achievements.map((item) => {
                  const catConfig = ACHIEVEMENT_CATEGORIES[item.category] || ACHIEVEMENT_CATEGORIES.other_achievement
                  const statusConfig = VERIFICATION_STATUS_CONFIG[item.verification_status] || VERIFICATION_STATUS_CONFIG.draft
                  const canEdit = ['draft', 'revision_requested'].includes(item.verification_status)
                  const canSubmit = ['draft', 'revision_requested'].includes(item.verification_status)

                  return (
                    <div
                      key={item.id}
                      className="bg-white border-3 border-[#171717] p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
                    >
                      <div>
                        {/* Header Badges */}
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                          <span className={`px-2.5 py-0.5 text-xs font-bold border border-[#171717] ${catConfig.bg}`}>
                            {catConfig.label}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-bold border ${statusConfig.badge}`}>
                            {statusConfig.label}
                          </span>
                        </div>

                        {/* Judul & Tanggal */}
                        <h3 className="font-black text-lg text-[#171717] line-clamp-2 leading-snug">{item.title}</h3>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 mt-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{item.achievement_date}</span>
                        </div>

                        {/* Deskripsi */}
                        <p className="text-xs text-neutral-700 mt-2.5 line-clamp-3 leading-relaxed">
                          {item.description}
                        </p>

                        {/* Hasil / Dampak Pekerjaan */}
                        {item.result_impact && (
                          <div className="mt-3 p-2.5 bg-[#FAF7F2] border-2 border-dashed border-[#171717] text-xs">
                            <span className="font-black text-neutral-800">Dampak/Hasil:</span> {item.result_impact}
                          </div>
                        )}

                        {/* Proyek & Skill Tags */}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.project && (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-[#EAE4D8] border border-[#171717] flex items-center gap-1">
                              <FolderKanban className="w-3 h-3" />
                              <span className="truncate max-w-[150px]">{item.project.name}</span>
                            </span>
                          )}
                          {item.skill && (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-[#B8A0F0]/30 border border-[#171717] flex items-center gap-1">
                              <GraduationCap className="w-3 h-3" />
                              <span>{item.skill.name}</span>
                            </span>
                          )}
                        </div>

                        {/* Link Bukti */}
                        {item.evidence_url && (
                          <a
                            href={item.evidence_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline mt-2.5"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Buka Bukti Portofolio</span>
                          </a>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-5 pt-4 border-t-2 border-[#171717] flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleViewDetail(item)}
                          className="px-3 py-1.5 bg-[#FAF7F2] border-2 border-[#171717] text-xs font-bold hover:bg-white active:translate-x-[1px]"
                        >
                          Detail
                        </button>

                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="p-1.5 bg-white border-2 border-[#171717] text-neutral-800 hover:bg-[#FAF7F2] active:translate-x-[1px]"
                              title="Edit Pencapaian"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => handleDeleteAchievement(item.id)}
                              className="p-1.5 bg-white border-2 border-[#171717] text-[#FF2F92] hover:bg-[#FAF7F2] active:translate-x-[1px]"
                              title="Hapus Pencapaian"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canSubmit && (
                            <button
                              onClick={() => {
                                setSelectedAchievement(item)
                                setSubmitNotes('')
                                setSubmitModalOpen(true)
                              }}
                              className="px-3 py-1.5 bg-[#00E599] border-2 border-[#171717] text-xs font-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:bg-[#10B981] active:translate-x-[1px]"
                            >
                              Ajukan Verifikasi
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="bg-white border-3 border-[#171717] p-12 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <Award className="w-12 h-12 mx-auto mb-3 text-neutral-400" />
                <h4 className="text-lg font-black text-[#171717]">Tidak Ada Pencapaian Ditemukan</h4>
                <p className="text-sm text-neutral-600 mt-1 max-w-md mx-auto">
                  Belum ada data pencapaian dengan filter yang dipilih. Silakan ubah filter atau tambahkan pencapaian profesional baru.
                </p>
                <button
                  onClick={handleOpenCreateModal}
                  className="mt-4 px-5 py-2.5 bg-[#FFD83D] border-2 border-[#171717] font-black text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#ffdf59]"
                >
                  Tambah Pencapaian Sekarang
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Project Contributions (Kontribusi Proyek) */}
        {activeTab === 'projects' && (
          <div className="mt-8 space-y-6">
            <div className="bg-white border-3 border-[#171717] p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-black text-lg text-[#171717]">Portofolio Kontribusi Proyek Nyata</h3>
              <p className="text-xs text-neutral-600 mt-1">
                Data divalidasi dari tugas-tugas penugasan aktual Anda. Menampilkan status proyek, beban tugas terselesaikan, dan prestasi terkait.
              </p>
            </div>

            {contributions.length > 0 ? (
              <div className="space-y-6">
                {contributions.map((item) => (
                  <div
                    key={item.project_id}
                    className="bg-white border-3 border-[#171717] p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b-2 border-[#171717] gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-[#FFD83D] border-2 border-[#171717] font-black text-xs text-[#171717]">
                            {item.project_code}
                          </span>
                          <span className="text-xs font-bold text-neutral-600">Klien: {item.client}</span>
                          <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-400 text-xs font-bold">
                            {item.status}
                          </span>
                        </div>
                        <h4 className="font-black text-xl text-[#171717] mt-1.5">{item.project_name}</h4>
                        <div className="flex items-center gap-4 text-xs text-neutral-600 mt-1">
                          <span>PM: <strong>{item.pic_name}</strong></span>
                          <span>Peran: <strong>{item.is_pic ? 'Project In Charge' : 'Spesialis / Kontributor'}</strong></span>
                          {item.contribution_period?.start && (
                            <span>Periode: <strong>{item.contribution_period.start} s/d {item.contribution_period.end || 'Sekarang'}</strong></span>
                          )}
                        </div>
                      </div>

                      {/* Progres Tugas Karyawan */}
                      <div className="md:text-right min-w-[200px]">
                        <div className="text-xs font-bold text-neutral-700">Tugas Anda Diselesaikan</div>
                        <div className="text-2xl font-black text-[#171717] mt-0.5">
                          {item.completed_tasks_count} / {item.total_tasks_assigned}
                          <span className="text-sm font-bold text-neutral-500 ml-1.5">({item.completion_rate}%)</span>
                        </div>
                        <div className="w-full bg-[#EAE4D8] border border-[#171717] h-2.5 mt-1.5 overflow-hidden">
                          <div
                            className="bg-[#00E599] h-full"
                            style={{ width: `${item.completion_rate}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Sub-Section: Daftar Tugas */}
                    <div className="mt-5">
                      <h5 className="font-black text-sm text-[#171717] mb-3 flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4 text-[#00E599]" />
                        <span>Tugas yang Dikerjakan</span>
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {item.tasks?.map((t) => (
                          <div
                            key={t.id}
                            className="p-3 border-2 border-[#171717] bg-[#FAF7F2] text-xs flex items-center justify-between"
                          >
                            <span className="font-bold text-[#171717] truncate max-w-[220px]">{t.title}</span>
                            <span
                              className={`px-2 py-0.5 font-bold border border-[#171717] text-[11px] ${
                                t.is_completed ? 'bg-[#00E599] text-[#171717]' : 'bg-white text-neutral-700'
                              }`}
                            >
                              {t.is_completed ? 'Selesai' : t.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sub-Section: Pencapaian Terkait */}
                    {item.achievements?.length > 0 && (
                      <div className="mt-5 pt-4 border-t-2 border-dashed border-[#171717]">
                        <h5 className="font-black text-sm text-[#171717] mb-3 flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-[#FF2F92]" />
                          <span>Pencapaian Terkait Proyek Ini</span>
                        </h5>
                        <div className="flex flex-wrap gap-2">
                          {item.achievements.map((ach) => (
                            <span
                              key={ach.id}
                              className="px-3 py-1 bg-[#FAF7F2] border-2 border-[#171717] font-bold text-xs flex items-center gap-1.5"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-[#00A86B]" />
                              <span>{ach.title}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border-3 border-[#171717] p-12 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <FolderKanban className="w-12 h-12 mx-auto mb-3 text-neutral-400" />
                <h4 className="text-lg font-black text-[#171717]">Belum Ada Riwayat Proyek</h4>
                <p className="text-sm text-neutral-600 mt-1 max-w-md mx-auto">
                  Anda belum memiliki tugas yang ditugaskan dalam proyek aktif PKM.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Competency Evidence (Bukti Kompetensi & M-D) */}
        {activeTab === 'competencies' && (
          <div className="mt-8 space-y-6">
            <div className="bg-white border-3 border-[#171717] p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-lg text-[#171717]">Integrasi Bukti Kompetensi Nyata (Tahap M-D)</h3>
                <p className="text-xs text-neutral-600 mt-1">
                  Menghubungkan keahlian pribadi dengan hasil kerja nyata, sertifikat pelatihan, dan pencapaian terverifikasi.
                </p>
              </div>
              <a
                href="/member/learning"
                className="px-3.5 py-2 bg-[#FAF7F2] hover:bg-[#B8A0F0] border-2 border-[#171717] rounded-lg text-xs font-black uppercase tracking-wider text-[#171717] flex items-center gap-1.5 shadow-[2px_2px_0px_#171717] cursor-pointer transition-all shrink-0"
              >
                <GraduationCap className="w-4 h-4" />
                <span>Pengembangan Diri</span>
              </a>
            </div>

            {/* Grid Kompetensi */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {competencies?.competency_evidence?.length > 0 ? (
                competencies.competency_evidence.map((skill) => (
                  <div
                    key={skill.skill_id}
                    className="bg-white border-3 border-[#171717] p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 bg-[#B8A0F0] border border-[#171717] font-bold text-xs text-[#171717]">
                          {skill.category}
                        </span>
                        <span className="text-xs font-bold text-neutral-600">
                          Level {skill.current_level}/5 ({skill.level_label})
                        </span>
                      </div>
                      <h4 className="font-black text-lg text-[#171717] mt-2">{skill.name}</h4>

                      {/* Bar Level */}
                      <div className="flex items-center gap-1.5 mt-2">
                        {[1, 2, 3, 4, 5].map((lvl) => (
                          <div
                            key={lvl}
                            className={`h-2.5 flex-1 border border-[#171717] ${
                              lvl <= skill.current_level ? 'bg-[#FFD83D]' : 'bg-[#EAE4D8]'
                            }`}
                          />
                        ))}
                      </div>

                      {/* Bukti Langsung */}
                      {skill.evidence_notes && (
                        <p className="text-xs text-neutral-700 mt-3 p-2 bg-[#FAF7F2] border border-neutral-300">
                          <strong>Catatan Bukti:</strong> {skill.evidence_notes}
                        </p>
                      )}

                      {skill.evidence_url && (
                        <a
                          href={skill.evidence_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline mt-2"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Tautan Bukti Sertifikat / Portofolio</span>
                        </a>
                      )}

                      {/* Prestasi Terverifikasi yang Terhubung */}
                      {skill.verified_achievements?.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-neutral-200">
                          <div className="text-xs font-bold text-neutral-700 mb-2">Prestasi Terverifikasi Terkait:</div>
                          <div className="space-y-1.5">
                            {skill.verified_achievements.map((a) => (
                              <div
                                key={a.id}
                                className="text-xs p-1.5 bg-[#00E599]/20 border border-[#171717] font-semibold flex items-center gap-1.5"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-[#00A86B]" />
                                <span>{a.title}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t-2 border-[#171717] flex items-center justify-between text-xs text-neutral-600">
                      <span>Total Prestasi: <strong>{skill.total_achievements_count}</strong></span>
                      <span>Sesi Pelatihan: <strong>{skill.completed_activities_count}</strong></span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 bg-white border-3 border-[#171717] p-8 text-center">
                  <GraduationCap className="w-10 h-10 mx-auto text-neutral-400 mb-2" />
                  <p className="text-sm font-bold text-neutral-600">Belum ada kompetensi terdaftar di modul M-D.</p>
                </div>
              )}
            </div>

            {/* Sertifikat Pembelajaran */}
            {competencies?.learning_certificates?.length > 0 && (
              <div className="bg-white border-3 border-[#171717] p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                <h4 className="font-black text-base text-[#171717] mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#FF8A50]" />
                  <span>Sertifikat Pembelajaran & Pelatihan</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {competencies.learning_certificates.map((cert) => (
                    <div
                      key={cert.id}
                      className="p-3 border-2 border-[#171717] bg-[#FAF7F2] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-black text-[#171717]">{cert.title}</div>
                        <div className="text-neutral-500 text-[11px] mt-0.5">
                          {cert.activity_date} • {cert.duration_minutes ? `${cert.duration_minutes} Menit` : 'Pelatihan'}
                        </div>
                      </div>
                      <a
                        href={cert.evidence_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-white border border-[#171717] font-bold text-xs hover:bg-[#FFD83D] flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Sertifikat</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Verification History (Riwayat Verifikasi) */}
        {activeTab === 'history' && (
          <div className="mt-8 space-y-6">
            <div className="bg-white border-3 border-[#171717] p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-black text-lg text-[#171717]">Riwayat Verifikasi & Audit Trail</h3>
              <p className="text-xs text-neutral-600 mt-1">
                Seluruh catatan verifikasi dari Project Manager dan Administrator tersimpan permanen dan transparan.
              </p>
            </div>

            <div className="bg-white border-3 border-[#171717] p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
              {achievements.filter((a) => a.verification_status !== 'draft').length > 0 ? (
                <div className="space-y-4">
                  {achievements
                    .filter((a) => a.verification_status !== 'draft')
                    .map((item) => {
                      const statusConfig = VERIFICATION_STATUS_CONFIG[item.verification_status] || VERIFICATION_STATUS_CONFIG.draft
                      return (
                        <div
                          key={item.id}
                          className="p-4 border-2 border-[#171717] bg-[#FAF7F2] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-300 gap-2">
                            <div>
                              <span className={`px-2 py-0.5 text-xs font-bold border ${statusConfig.badge}`}>
                                {statusConfig.label}
                              </span>
                              <h4 className="font-black text-base text-[#171717] mt-1.5">{item.title}</h4>
                            </div>
                            <button
                              onClick={() => handleViewDetail(item)}
                              className="px-3 py-1.5 bg-white border border-[#171717] text-xs font-bold hover:bg-[#FAF7F2]"
                            >
                              Lihat Audit Trail
                            </button>
                          </div>

                          <div className="mt-3 text-xs text-neutral-700 flex flex-wrap gap-4">
                            <span>Status: <strong>{statusConfig.desc}</strong></span>
                            {item.verifier && (
                              <span>Verifikator: <strong>{item.verifier.name}</strong> ({item.verifier.role})</span>
                            )}
                            {item.latest_verification?.notes && (
                              <div className="w-full mt-1 p-2 bg-white border border-neutral-300 italic">
                                "{item.latest_verification.notes}"
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                </div>
              ) : (
                <div className="text-center py-10 text-neutral-500 font-semibold">
                  <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-neutral-400" />
                  Belum ada pencapaian yang diajukan ke antrean verifikasi.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 6: Portfolio Presentation (Tampilan Portofolio Siap Saji) */}
        {activeTab === 'presentation' && presentation && (
          <div className="mt-8 space-y-6">
            {/* Header Kontrol Kurasi */}
            <div className="bg-white border-3 border-[#171717] p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-lg text-[#171717]">Tampilan Portofolio Profesional</h3>
                  <span className="px-2 py-0.5 bg-[#171717] text-white text-xs font-bold">
                    {presentation.profile?.is_public_within_team ? 'Terbuka Untuk Tim' : 'Privat Pribadi'}
                  </span>
                </div>
                <p className="text-xs text-neutral-600 mt-1">
                  Atur item unggulan (Featured) dan visibilitas pencapaian untuk tampilan portofolio kerja Anda.
                </p>
              </div>

              <button
                onClick={() => setProfileModalOpen(true)}
                className="px-4 py-2 bg-[#FFD83D] border-2 border-[#171717] font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#ffdf59]"
              >
                Ubah Headline & Bio
              </button>
            </div>

            {/* Resume / Portfolio Presentation Canvas */}
            <div className="bg-white border-3 border-[#171717] p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-8">
              {/* Header Portofolio */}
              <div className="pb-6 border-b-3 border-[#171717] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-3xl font-black text-[#171717]">{presentation.profile?.name}</h2>
                  <p className="text-base font-bold text-[#FF2F92] mt-1">{presentation.profile?.headline}</p>
                  <p className="text-xs text-neutral-600 mt-1">
                    {presentation.profile?.email} {presentation.profile?.phone ? `• ${presentation.profile.phone}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Perusahaan</div>
                  <div className="font-black text-sm text-[#171717]">PT Potensi Karya Mandiri</div>
                  <div className="text-xs text-neutral-500 mt-0.5">Bergabung: {presentation.profile?.member_since || '-'}</div>
                </div>
              </div>

              {/* Bio Singkat */}
              {presentation.profile?.summary_bio && (
                <div>
                  <h4 className="font-black text-sm uppercase tracking-wider text-neutral-600 mb-2">Ringkasan Profesional</h4>
                  <p className="text-sm text-neutral-800 leading-relaxed bg-[#FAF7F2] p-4 border-2 border-[#171717]">
                    {presentation.profile.summary_bio}
                  </p>
                </div>
              )}

              {/* Pencapaian Unggulan (Curated) */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-black text-base uppercase tracking-wider text-[#171717] flex items-center gap-2">
                    <Star className="w-5 h-5 text-[#FFD83D] fill-current" />
                    <span>Pencapaian Profesional Terkurasi</span>
                  </h4>
                  <span className="text-xs font-bold text-neutral-500">
                    {presentation.stats?.total_achievements || 0} item ditampilkan
                  </span>
                </div>

                <div className="space-y-4">
                  {presentation.achievements?.length > 0 ? (
                    presentation.achievements.map((ach) => (
                      <div
                        key={ach.id}
                        className={`p-5 border-2 border-[#171717] ${
                          ach.is_featured ? 'bg-[#FFD83D]/10 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' : 'bg-[#FAF7F2]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {ach.is_featured && (
                                <span className="px-2 py-0.5 bg-[#FFD83D] border border-[#171717] text-[11px] font-black flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-current" />
                                  <span>UNGGULAN</span>
                                </span>
                              )}
                              <span className="px-2 py-0.5 bg-white border border-[#171717] text-[11px] font-bold">
                                {ach.category}
                              </span>
                              {ach.verification_status === 'verified' && (
                                <span className="px-2 py-0.5 bg-[#00E599] border border-[#171717] text-[11px] font-black flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>VERIFIED</span>
                                </span>
                              )}
                            </div>

                            <h5 className="font-black text-lg text-[#171717] mt-2">{ach.title}</h5>
                            <p className="text-xs text-neutral-700 mt-1.5 leading-relaxed">{ach.description}</p>

                            {ach.result_impact && (
                              <p className="text-xs font-bold text-[#171717] mt-2">
                                <strong>Hasil/Dampak:</strong> {ach.result_impact}
                              </p>
                            )}

                            {ach.evidence_url && (
                              <a
                                href={ach.evidence_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline mt-2"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Tautan Bukti Hasil Kerja</span>
                              </a>
                            )}
                          </div>

                          {/* Quick Toggle Controls */}
                          <div className="flex flex-col gap-1.5 items-end">
                            <button
                              onClick={() => handleToggleCurate(ach.id, 'is_featured', ach.is_featured)}
                              className={`p-1.5 border border-[#171717] text-xs font-bold flex items-center gap-1 ${
                                ach.is_featured ? 'bg-[#FFD83D]' : 'bg-white'
                              }`}
                              title={ach.is_featured ? 'Hapus dari Unggulan' : 'Jadikan Unggulan'}
                            >
                              <Star className={`w-3.5 h-3.5 ${ach.is_featured ? 'fill-current' : ''}`} />
                            </button>
                            <button
                              onClick={() => handleToggleCurate(ach.id, 'is_visible', ach.is_visible)}
                              className="p-1.5 border border-[#171717] text-xs font-bold bg-white"
                              title="Sembunyikan dari Tampilan"
                            >
                              <EyeOff className="w-3.5 h-3.5 text-neutral-600" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-neutral-500 font-semibold border-2 border-dashed border-[#171717]">
                      Belum ada pencapaian yang diatur untuk ditampilkan.
                    </div>
                  )}
                </div>
              </div>

              {/* Highlight Proyek */}
              <div>
                <h4 className="font-black text-base uppercase tracking-wider text-[#171717] mb-3 flex items-center gap-2">
                  <FolderKanban className="w-5 h-5 text-[#5CE1E6]" />
                  <span>Pengalaman & Proyek Kunci</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {presentation.project_highlights?.map((p) => (
                    <div key={p.id} className="p-4 border-2 border-[#171717] bg-[#FAF7F2]">
                      <div className="font-black text-sm text-[#171717]">{p.name}</div>
                      <div className="text-xs text-neutral-600 mt-1">
                        Klien: {p.client} • Status: {p.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: Tambah / Edit Pencapaian */}
      {/* ========================================================================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-4 border-[#171717] p-6 max-w-2xl w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] my-8">
            <div className="flex items-center justify-between pb-4 border-b-2 border-[#171717]">
              <h3 className="font-black text-xl text-[#171717]">
                {isEditing ? 'Ubah Pencapaian' : 'Tambah Pencapaian Baru'}
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 hover:bg-[#FAF7F2] border border-[#171717]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAchievement} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                  Judul Pencapaian <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={achievementForm.title}
                  onChange={(e) => setAchievementForm({ ...achievementForm, title: e.target.value })}
                  placeholder="Misal: Optimasi Waktu Loading Database 40%"
                  className="w-full px-3 py-2 border-2 border-[#171717] font-bold text-sm focus:outline-none focus:bg-[#FAF7F2]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                    Kategori <span className="text-red-600">*</span>
                  </label>
                  <select
                    required
                    value={achievementForm.category}
                    onChange={(e) => setAchievementForm({ ...achievementForm, category: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-[#171717] font-bold text-sm bg-white focus:outline-none"
                  >
                    {Object.entries(ACHIEVEMENT_CATEGORIES).map(([key, val]) => (
                      <option key={key} value={key}>
                        {val.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                    Tanggal Pencapaian <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={achievementForm.achievement_date}
                    onChange={(e) => setAchievementForm({ ...achievementForm, achievement_date: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-[#171717] font-bold text-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* Kaitan Proyek & Kompetensi */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                    Terkait Proyek (Opsional)
                  </label>
                  <select
                    value={achievementForm.project_id}
                    onChange={(e) => setAchievementForm({ ...achievementForm, project_id: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-[#171717] font-bold text-sm bg-white focus:outline-none"
                  >
                    <option value="">Tidak Terkait Proyek Langsung</option>
                    {contributions.map((c) => (
                      <option key={c.project_id} value={c.project_id}>
                        {c.project_code} - {c.project_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                    Terkait Kompetensi (Opsional)
                  </label>
                  <select
                    value={achievementForm.skill_id}
                    onChange={(e) => setAchievementForm({ ...achievementForm, skill_id: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-[#171717] font-bold text-sm bg-white focus:outline-none"
                  >
                    <option value="">Tidak Terkait Kompetensi Langsung</option>
                    {competencies?.competency_evidence?.map((s) => (
                      <option key={s.skill_id} value={s.skill_id}>
                        {s.name} ({s.category})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                  Deskripsi Kontribusi <span className="text-red-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={achievementForm.description}
                  onChange={(e) => setAchievementForm({ ...achievementForm, description: e.target.value })}
                  placeholder="Jelaskan peran Anda, apa yang Anda lakukan, dan solusi yang Anda ciptakan..."
                  className="w-full px-3 py-2 border-2 border-[#171717] font-medium text-sm focus:outline-none focus:bg-[#FAF7F2]"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                  Hasil / Dampak Pekerjaan
                </label>
                <input
                  type="text"
                  value={achievementForm.result_impact}
                  onChange={(e) => setAchievementForm({ ...achievementForm, result_impact: e.target.value })}
                  placeholder="Misal: Penurunan bug sebesar 30%, penghematan waktu rilis 2 hari"
                  className="w-full px-3 py-2 border-2 border-[#171717] font-bold text-sm focus:outline-none focus:bg-[#FAF7F2]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                    URL Bukti Pendukung (Opsional)
                  </label>
                  <input
                    type="url"
                    value={achievementForm.evidence_url}
                    onChange={(e) => setAchievementForm({ ...achievementForm, evidence_url: e.target.value })}
                    placeholder="https://github.com/... atau tautan dokumen"
                    className="w-full px-3 py-2 border-2 border-[#171717] font-bold text-sm focus:outline-none focus:bg-[#FAF7F2]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                    Catatan Bukti Tambahan
                  </label>
                  <input
                    type="text"
                    value={achievementForm.evidence_notes}
                    onChange={(e) => setAchievementForm({ ...achievementForm, evidence_notes: e.target.value })}
                    placeholder="Nomor sertifikat atau catatan verifikasi"
                    className="w-full px-3 py-2 border-2 border-[#171717] font-bold text-sm focus:outline-none focus:bg-[#FAF7F2]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={achievementForm.is_featured}
                    onChange={(e) => setAchievementForm({ ...achievementForm, is_featured: e.target.checked })}
                    className="w-4 h-4 border-2 border-[#171717]"
                  />
                  <span className="text-xs font-bold text-[#171717]">Jadikan Unggulan (Featured)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={achievementForm.is_visible}
                    onChange={(e) => setAchievementForm({ ...achievementForm, is_visible: e.target.checked })}
                    className="w-4 h-4 border-2 border-[#171717]"
                  />
                  <span className="text-xs font-bold text-[#171717]">Tampilkan di Portofolio</span>
                </label>
              </div>

              <div className="pt-4 border-t-2 border-[#171717] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 bg-white border-2 border-[#171717] font-bold text-sm hover:bg-[#FAF7F2]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FFD83D] border-2 border-[#171717] font-black text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#ffdf59]"
                >
                  {isEditing ? 'Perbarui Pencapaian' : 'Simpan Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Pengajuan Verifikasi */}
      {/* ========================================================================= */}
      {submitModalOpen && selectedAchievement && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-[#171717] p-6 max-w-lg w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="font-black text-xl text-[#171717]">Ajukan Verifikasi Pencapaian</h3>
            <p className="text-xs text-neutral-600 mt-1">
              Pencapaian "<strong>{selectedAchievement.title}</strong>" akan dikirimkan kepada Project Manager terkait untuk divalidasi.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                Catatan Pengajuan (Opsional)
              </label>
              <textarea
                rows={3}
                value={submitNotes}
                onChange={(e) => setSubmitNotes(e.target.value)}
                placeholder="Tambahkan catatan atau penjelasan singkat untuk PM..."
                className="w-full px-3 py-2 border-2 border-[#171717] font-medium text-sm focus:outline-none"
              />
            </div>

            <div className="mt-5 pt-4 border-t-2 border-[#171717] flex items-center justify-end gap-3">
              <button
                onClick={() => setSubmitModalOpen(false)}
                className="px-4 py-2 bg-white border-2 border-[#171717] font-bold text-sm"
              >
                Batal
              </button>
              <button
                onClick={handleSubmitForVerification}
                className="px-5 py-2 bg-[#00E599] border-2 border-[#171717] font-black text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#10B981]"
              >
                Kirim Pengajuan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Ubah Headline & Bio Profil */}
      {/* ========================================================================= */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-[#171717] p-6 max-w-lg w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#171717]">
              <h3 className="font-black text-xl text-[#171717]">Ubah Profil Portofolio</h3>
              <button
                onClick={() => setProfileModalOpen(false)}
                className="p-1 hover:bg-[#FAF7F2] border border-[#171717]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                  Headline Profesional
                </label>
                <input
                  type="text"
                  value={profileForm.headline}
                  onChange={(e) => setProfileForm({ ...profileForm, headline: e.target.value })}
                  placeholder="Misal: Senior Backend Engineer & Cloud Specialist"
                  className="w-full px-3 py-2 border-2 border-[#171717] font-bold text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-[#171717] mb-1">
                  Ringkasan Karir / Bio Profesional
                </label>
                <textarea
                  rows={4}
                  value={profileForm.summary_bio}
                  onChange={(e) => setProfileForm({ ...profileForm, summary_bio: e.target.value })}
                  placeholder="Tuliskan pengalaman kunci, keahlian utama, dan fokus profesional Anda..."
                  className="w-full px-3 py-2 border-2 border-[#171717] font-medium text-sm focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profileForm.is_public_within_team}
                    onChange={(e) => setProfileForm({ ...profileForm, is_public_within_team: e.target.checked })}
                    className="w-4 h-4 border-2 border-[#171717]"
                  />
                  <span className="text-xs font-bold text-[#171717]">
                    Izinkan portofolio dilihat oleh rekan tim PKM (Private by default jika tidak dicentang)
                  </span>
                </label>
              </div>

              <div className="pt-4 border-t-2 border-[#171717] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="px-4 py-2 bg-white border-2 border-[#171717] font-bold text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FFD83D] border-2 border-[#171717] font-black text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#ffdf59]"
                >
                  Simpan Profil
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Detail Pencapaian & Audit Trail */}
      {/* ========================================================================= */}
      {detailModalOpen && selectedAchievement && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-4 border-[#171717] p-6 max-w-xl w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] my-8">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#171717]">
              <div>
                <span className="px-2 py-0.5 bg-[#FFD83D] border border-[#171717] text-[11px] font-black">
                  {selectedAchievement.category}
                </span>
                <h3 className="font-black text-xl text-[#171717] mt-1">{selectedAchievement.title}</h3>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-1 hover:bg-[#FAF7F2] border border-[#171717]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <span className="font-black text-neutral-500 uppercase">Deskripsi:</span>
                <p className="mt-1 text-neutral-800 leading-relaxed bg-[#FAF7F2] p-3 border border-neutral-300">
                  {selectedAchievement.description}
                </p>
              </div>

              {selectedAchievement.result_impact && (
                <div>
                  <span className="font-black text-neutral-500 uppercase">Hasil / Dampak:</span>
                  <p className="mt-1 text-neutral-800 font-bold bg-[#FAF7F2] p-2.5 border border-neutral-300">
                    {selectedAchievement.result_impact}
                  </p>
                </div>
              )}

              {selectedAchievement.evidence_url && (
                <div>
                  <span className="font-black text-neutral-500 uppercase">Bukti Portofolio:</span>
                  <div className="mt-1">
                    <a
                      href={selectedAchievement.evidence_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-blue-700 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{selectedAchievement.evidence_url}</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Riwayat Verifikasi */}
              <div className="pt-3 border-t-2 border-[#171717]">
                <h4 className="font-black text-sm text-[#171717] mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#00A86B]" />
                  <span>Riwayat Audit Verifikasi</span>
                </h4>
                {selectedAchievement.verifications?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedAchievement.verifications.map((v) => (
                      <div key={v.id} className="p-2.5 border border-[#171717] bg-[#FAF7F2]">
                        <div className="flex items-center justify-between font-bold">
                          <span className="uppercase text-[11px] text-[#FF2F92]">{v.action}</span>
                          <span className="text-neutral-500 text-[10px]">{v.created_at?.split('T')[0]}</span>
                        </div>
                        <div className="text-neutral-700 mt-1">
                          Peninjau: <strong>{v.reviewer?.name || 'Reviewer'}</strong>
                        </div>
                        {v.notes && (
                          <div className="mt-1 p-1.5 bg-white border border-neutral-300 italic text-[11px]">
                            "{v.notes}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-neutral-500 italic">Belum ada catatan riwayat audit.</p>
                )}
              </div>
            </div>

            <div className="mt-6 pt-3 border-t-2 border-[#171717] flex justify-end">
              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 bg-white border-2 border-[#171717] font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
