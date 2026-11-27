import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import {
  GraduationCap,
  Target,
  BookOpen,
  Award,
  CheckCircle2,
  Clock,
  Calendar,
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  X,
  RefreshCw,
  Layers,
  ArrowRight,
  TrendingUp,
  Inbox,
  CheckSquare,
  Pause,
  AlertTriangle,
  FileText,
  User,
  Folder
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import PageLoading from '../../components/ui/PageLoading'

// Konfigurasi Kategori Skill
const SKILL_CATEGORIES = [
  'Technical Skills',
  'Communication',
  'Leadership',
  'Project Management',
  'Analytical Skills',
  'Operational Skills',
  'Other Skills',
]

// Level Kemampuan (Self-Assessment)
const LEVEL_CONFIG = {
  1: { label: 'Beginner', desc: 'Baru mempelajari dasar' },
  2: { label: 'Basic', desc: 'Memahami dasar & tugas sederhana' },
  3: { label: 'Intermediate', desc: 'Bekerja mandiri pekerjaan umum' },
  4: { label: 'Advanced', desc: 'Menangani pekerjaan kompleks' },
  5: { label: 'Expert', desc: 'Penguasaan mendalam & rujukan tim' },
}

// Konfigurasi Status Goal
const GOAL_STATUS_CONFIG = {
  planned: { label: 'Direncanakan', bg: 'bg-[#FAF7F2] text-[#171717] border-[#171717]' },
  in_progress: { label: 'Sedang Berjalan', bg: 'bg-[#FFD83D] text-[#171717] border-[#171717]' },
  completed: { label: 'Tercapai', bg: 'bg-[#10B981] text-white border-[#171717]' },
  paused: { label: 'Ditunda', bg: 'bg-[#B8A0F0] text-[#171717] border-[#171717]' },
  cancelled: { label: 'Dibatalkan', bg: 'bg-[#FF2F92] text-white border-[#171717]' },
}

// Konfigurasi Jenis Aktivitas
const ACTIVITY_TYPES = {
  self_learning: 'Belajar Mandiri',
  online_course: 'Kursus Online',
  offline_training: 'Pelatihan Offline',
  workshop: 'Workshop / Seminar',
  mentoring: 'Mentoring / Coaching',
  reading_research: 'Membaca & Riset',
  practice_experiment: 'Praktik & Eksperimen',
  other: 'Lainnya',
}

export default function MemberLearningCenter() {
  const { user } = useAuth()

  // State Data
  const [activeTab, setActiveTab] = useState('overview') // 'overview', 'skills', 'goals', 'activities', 'feedback'
  const [overview, setOverview] = useState(null)
  const [skills, setSkills] = useState([])
  const [goals, setGoals] = useState([])
  const [activities, setActivities] = useState([])
  const [feedbacks, setFeedbacks] = useState([])

  // State UI
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [feedbackMsg, setFeedbackMsg] = useState(null)

  // State Modals
  const [skillModalOpen, setSkillModalOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState(null)
  const [skillForm, setSkillForm] = useState({
    name: '',
    category: 'Technical Skills',
    description: '',
    current_level: 1,
    target_level: 3,
    experience_notes: '',
    evidence_url: '',
    evidence_notes: '',
  })

  const [goalModalOpen, setGoalModalOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [goalForm, setGoalForm] = useState({
    title: '',
    skill_id: '',
    description: '',
    current_level: 1,
    target_level: 3,
    reason: '',
    target_date: '',
    priority: 'medium',
    status: 'planned',
    notes: '',
  })

  const [milestoneModalGoal, setMilestoneModalGoal] = useState(null)
  const [milestoneForm, setMilestoneForm] = useState({
    title: '',
    description: '',
    target_date: '',
    notes: '',
  })

  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState(null)
  const [activityForm, setActivityForm] = useState({
    title: '',
    activity_type: 'self_learning',
    description: '',
    activity_date: new Date().toISOString().split('T')[0],
    duration_minutes: '',
    learning_source: '',
    learning_notes: '',
    evidence_url: '',
    skill_id: '',
    goal_id: '',
    status: 'completed',
  })

  // Jam lokal Asia/Jakarta
  const [currentTime, setCurrentTime] = useState(() => {
    return new Date().toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  })

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch Seluruh Data Modul
  const fetchAllData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const [overviewRes, skillsRes, goalsRes, activitiesRes, feedbackRes] = await Promise.all([
        api.get('/member/learning/overview'),
        api.get('/member/learning/skills'),
        api.get('/member/learning/goals'),
        api.get('/member/learning/activities'),
        api.get('/member/learning/feedback'),
      ])

      setOverview(overviewRes.data)
      setSkills(skillsRes.data.skills || [])
      setGoals(goalsRes.data.goals || [])
      setActivities(activitiesRes.data.activities || [])
      setFeedbacks(feedbackRes.data.feedbacks || [])
    } catch (err) {
      console.error('Error fetching learning data:', err)
      setError(err.response?.data?.message || 'Gagal memuat data pengembangan diri.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  // Toast Helper
  const showToast = (type, message) => {
    setFeedbackMsg({ type, message })
    setTimeout(() => setFeedbackMsg(null), 3500)
  }

  // =========================================================================
  // HANDLERS: SKILLS
  // =========================================================================
  const handleOpenSkillModal = (skill = null) => {
    if (skill) {
      setEditingSkill(skill)
      setSkillForm({
        name: skill.name,
        category: skill.category,
        description: skill.description || '',
        current_level: skill.current_level,
        target_level: skill.target_level,
        experience_notes: skill.experience_notes || '',
        evidence_url: skill.evidence_url || '',
        evidence_notes: skill.evidence_notes || '',
      })
    } else {
      setEditingSkill(null)
      setSkillForm({
        name: '',
        category: 'Technical Skills',
        description: '',
        current_level: 1,
        target_level: 3,
        experience_notes: '',
        evidence_url: '',
        evidence_notes: '',
      })
    }
    setSkillModalOpen(true)
  }

  const handleSaveSkill = async (e) => {
    e.preventDefault()
    try {
      if (editingSkill) {
        await api.put(`/member/learning/skills/${editingSkill.id}`, skillForm)
        showToast('success', 'Kompetensi berhasil diperbarui.')
      } else {
        await api.post('/member/learning/skills', skillForm)
        showToast('success', 'Kompetensi baru berhasil dicatat.')
      }
      setSkillModalOpen(false)
      fetchAllData(true)
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Gagal menyimpan kompetensi.')
    }
  }

  const handleDeleteSkill = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus kompetensi ini?')) return
    try {
      await api.delete(`/member/learning/skills/${id}`)
      showToast('success', 'Kompetensi berhasil dihapus.')
      fetchAllData(true)
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Gagal menghapus kompetensi.')
    }
  }

  // =========================================================================
  // HANDLERS: GOALS
  // =========================================================================
  const handleOpenGoalModal = (goal = null) => {
    if (goal) {
      setEditingGoal(goal)
      setGoalForm({
        title: goal.title,
        skill_id: goal.skill_id || '',
        description: goal.description || '',
        current_level: goal.current_level || 1,
        target_level: goal.target_level || 3,
        reason: goal.reason || '',
        target_date: goal.target_date || '',
        priority: goal.priority || 'medium',
        status: goal.status || 'planned',
        notes: goal.notes || '',
      })
    } else {
      setEditingGoal(null)
      setGoalForm({
        title: '',
        skill_id: '',
        description: '',
        current_level: 1,
        target_level: 3,
        reason: '',
        target_date: '',
        priority: 'medium',
        status: 'planned',
        notes: '',
      })
    }
    setGoalModalOpen(true)
  }

  const handleSaveGoal = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...goalForm,
        skill_id: goalForm.skill_id ? Number(goalForm.skill_id) : null,
      }
      if (editingGoal) {
        await api.put(`/member/learning/goals/${editingGoal.id}`, payload)
        showToast('success', 'Target pengembangan berhasil diperbarui.')
      } else {
        await api.post('/member/learning/goals', payload)
        showToast('success', 'Target pengembangan baru berhasil dibuat.')
      }
      setGoalModalOpen(false)
      fetchAllData(true)
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Gagal menyimpan target pengembangan.')
    }
  }

  const handleDeleteGoal = async (id) => {
    if (!window.confirm('Hapus target pengembangan ini beserta seluruh milestone terkait?')) return
    try {
      await api.delete(`/member/learning/goals/${id}`)
      showToast('success', 'Target pengembangan berhasil dihapus.')
      fetchAllData(true)
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Gagal menghapus target.')
    }
  }

  // =========================================================================
  // HANDLERS: MILESTONES
  // =========================================================================
  const handleAddMilestone = async (e) => {
    e.preventDefault()
    if (!milestoneModalGoal || !milestoneForm.title.trim()) return
    try {
      await api.post(`/member/learning/goals/${milestoneModalGoal.id}/milestones`, milestoneForm)
      showToast('success', 'Milestone berhasil ditambahkan ke target.')
      setMilestoneForm({ title: '', description: '', target_date: '', notes: '' })
      setMilestoneModalGoal(null)
      fetchAllData(true)
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Gagal menambahkan milestone.')
    }
  }

  const handleToggleMilestone = async (milestone) => {
    try {
      await api.put(`/member/learning/milestones/${milestone.id}`, {
        is_completed: !milestone.is_completed,
      })
      fetchAllData(true)
    } catch (err) {
      showToast('error', 'Gagal memperbarui status milestone.')
    }
  }

  const handleDeleteMilestone = async (milestoneId) => {
    if (!window.confirm('Hapus milestone ini?')) return
    try {
      await api.delete(`/member/learning/milestones/${milestoneId}`)
      showToast('success', 'Milestone berhasil dihapus.')
      fetchAllData(true)
    } catch (err) {
      showToast('error', 'Gagal menghapus milestone.')
    }
  }

  // =========================================================================
  // HANDLERS: ACTIVITIES
  // =========================================================================
  const handleOpenActivityModal = (act = null) => {
    if (act) {
      setEditingActivity(act)
      setActivityForm({
        title: act.title,
        activity_type: act.activity_type,
        description: act.description || '',
        activity_date: act.activity_date,
        duration_minutes: act.duration_minutes || '',
        learning_source: act.learning_source || '',
        learning_notes: act.learning_notes || '',
        evidence_url: act.evidence_url || '',
        skill_id: act.skill_id || '',
        goal_id: act.goal_id || '',
        status: act.status || 'completed',
      })
    } else {
      setEditingActivity(null)
      setActivityForm({
        title: '',
        activity_type: 'self_learning',
        description: '',
        activity_date: new Date().toISOString().split('T')[0],
        duration_minutes: '',
        learning_source: '',
        learning_notes: '',
        evidence_url: '',
        skill_id: '',
        goal_id: '',
        status: 'completed',
      })
    }
    setActivityModalOpen(true)
  }

  const handleSaveActivity = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...activityForm,
        duration_minutes: activityForm.duration_minutes ? Number(activityForm.duration_minutes) : null,
        skill_id: activityForm.skill_id ? Number(activityForm.skill_id) : null,
        goal_id: activityForm.goal_id ? Number(activityForm.goal_id) : null,
      }
      if (editingActivity) {
        await api.put(`/member/learning/activities/${editingActivity.id}`, payload)
        showToast('success', 'Aktivitas belajar berhasil diperbarui.')
      } else {
        await api.post('/member/learning/activities', payload)
        showToast('success', 'Aktivitas belajar berhasil dicatat.')
      }
      setActivityModalOpen(false)
      fetchAllData(true)
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Gagal menyimpan aktivitas.')
    }
  }

  const handleDeleteActivity = async (id) => {
    if (!window.confirm('Hapus rekaman aktivitas pembelajaran ini?')) return
    try {
      await api.delete(`/member/learning/activities/${id}`)
      showToast('success', 'Aktivitas berhasil dihapus.')
      fetchAllData(true)
    } catch (err) {
      showToast('error', 'Gagal menghapus aktivitas.')
    }
  }

  if (loading && !refreshing && !overview) {
    return (
      <div className="w-full bg-[#F5F1E9] p-4 sm:p-6 lg:p-8">
        <PageLoading message="Memuat Pusat Pengembangan Diri & Pembelajaran..." />
      </div>
    )
  }

  const summary = overview?.summary || {
    total_skills: 0,
    active_goals: 0,
    completed_goals: 0,
    total_activities: 0,
    learning_hours: 0,
    upcoming_deadline_goals: 0,
    overall_progress: 0,
  }

  return (
    <div className="w-full bg-[#F5F1E9] text-[#171717] p-3 sm:p-5 lg:p-7 space-y-6">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 right-4 z-50 px-4 py-3 border-2 border-[#171717] rounded-xl shadow-[4px_4px_0px_#171717] flex items-center gap-3 transition-all ${
            feedbackMsg.type === 'error' ? 'bg-[#FF2F92] text-white' : 'bg-[#10B981] text-white'
          }`}
        >
          {feedbackMsg.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span className="text-xs sm:text-sm font-black">{feedbackMsg.message}</span>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="p-1 hover:bg-black/20 rounded-lg cursor-pointer"
            aria-label="Tutup notifikasi"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header Utama Halaman */}
      <PageHeader
        title="PENGEMBANGAN DIRI"
        tag="LEARNING & DEVELOPMENT"
        subtitle="Pusat pengelolaan kompetensi personal, rencana pembelajaran profesional, dan riwayat bimbingan PM."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717] text-xs font-mono font-bold">
              <Clock size={15} className="text-[#171717]" />
              <span>{currentTime} WIB</span>
            </div>

            <button
              onClick={() => fetchAllData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-[#FFD83D] active:translate-x-0.5 active:translate-y-0.5 border-2 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717] text-xs font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-60 min-h-[44px]"
              title="Segarkan data pembelajaran"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Segarkan</span>
            </button>
          </div>
        }
      />

      {/* Banner Error jika ada */}
      {error && (
        <div className="bg-[#FF2F92] text-white border-2 border-[#171717] p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={22} className="shrink-0" />
            <p className="text-xs sm:text-sm font-bold">{error}</p>
          </div>
          <button
            onClick={() => fetchAllData(true)}
            className="px-3 py-1.5 bg-white text-[#171717] border border-[#171717] rounded-lg font-black text-xs hover:bg-[#FFD83D] cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* 6 KPI Cards Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Kompetensi */}
        <div className="bg-white border-2 border-[#171717] p-3.5 sm:p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#171717]/60 mb-2">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">KOMPETENSI</span>
            <div className="p-1.5 bg-[#FAF7F2] border border-[#171717] rounded-lg">
              <Award size={15} className="text-[#171717]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#171717]">
              {summary.total_skills}
            </div>
            <p className="text-[10px] text-[#171717]/60 font-bold mt-0.5">Keahlian tercatat</p>
          </div>
        </div>

        {/* Target Aktif */}
        <div className="bg-white border-2 border-[#171717] p-3.5 sm:p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#171717]/60 mb-2">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">TARGET AKTIF</span>
            <div className="p-1.5 bg-[#FFD83D]/30 border border-[#171717] rounded-lg">
              <Target size={15} className="text-[#171717]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#171717]">
              {summary.active_goals}
            </div>
            <p className="text-[10px] text-[#171717]/60 font-bold mt-0.5">Sedang diperjuangkan</p>
          </div>
        </div>

        {/* Target Tercapai */}
        <div className="bg-white border-2 border-[#171717] p-3.5 sm:p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#171717]/60 mb-2">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">TARGET TERCAPAI</span>
            <div className="p-1.5 bg-[#10B981]/20 border border-[#171717] rounded-lg">
              <CheckCircle2 size={15} className="text-[#10B981]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#171717]">
              {summary.completed_goals}
            </div>
            <p className="text-[10px] text-[#171717]/60 font-bold mt-0.5">Sasaran tuntas</p>
          </div>
        </div>

        {/* Aktivitas Belajar */}
        <div className="bg-white border-2 border-[#171717] p-3.5 sm:p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#171717]/60 mb-2">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">AKTIVITAS BELAJAR</span>
            <div className="p-1.5 bg-[#FAF7F2] border border-[#171717] rounded-lg">
              <BookOpen size={15} className="text-[#3B82F6]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#171717]">
              {summary.total_activities}
            </div>
            <p className="text-[10px] text-[#171717]/60 font-bold mt-0.5">Sesi diselesaikan</p>
          </div>
        </div>

        {/* Jam Belajar */}
        <div className="bg-white border-2 border-[#171717] p-3.5 sm:p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#171717]/60 mb-2">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">JAM BELAJAR</span>
            <div className="p-1.5 bg-[#FAF7F2] border border-[#171717] rounded-lg">
              <Clock size={15} className="text-[#FF5722]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#171717]">
              {summary.learning_hours} <span className="text-xs font-bold font-sans">Jam</span>
            </div>
            <p className="text-[10px] text-[#171717]/60 font-bold mt-0.5">
              {summary.total_duration_minutes} menit tercatat
            </p>
          </div>
        </div>

        {/* Rata-Rata Progres */}
        <div className="bg-white border-2 border-[#171717] p-3.5 sm:p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#171717]/60 mb-2">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">PROGRES TARGET</span>
            <div className="p-1.5 bg-[#B8A0F0]/30 border border-[#171717] rounded-lg">
              <TrendingUp size={15} className="text-[#171717]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#171717]">
              {summary.overall_progress}%
            </div>
            <p className="text-[10px] text-[#171717]/60 font-bold mt-0.5">Rata-rata target aktif</p>
          </div>
        </div>
      </div>

      {/* Navigasi Tab Fitur Utama */}
      <div className="bg-white border-2 border-[#171717] p-2 rounded-xl shadow-[3px_3px_0px_#171717]">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {[
            { id: 'overview', label: 'Ikhtisar & Roadmap', icon: Layers },
            { id: 'skills', label: 'Kompetensi Saya', icon: Award, count: skills.length },
            { id: 'goals', label: 'Target Pengembangan', icon: Target, count: goals.length },
            { id: 'activities', label: 'Aktivitas Belajar', icon: BookOpen, count: activities.length },
            { id: 'feedback', label: 'Arahan & Feedback PM', icon: MessageSquare, count: feedbacks.length },
          ].map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 min-h-[44px] ${
                  active
                    ? 'bg-[#171717] text-white shadow-[2px_2px_0px_#171717]'
                    : 'bg-[#FAF7F2] text-[#171717] hover:bg-white shadow-[1px_1px_0px_#171717]'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`px-1.5 py-0.2 text-[9px] font-mono rounded-full ${
                    active ? 'bg-[#FF2F92] text-white' : 'bg-[#171717]/10 text-[#171717]'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}

          {/* Quick Nav to Portofolio Saya (M-E) */}
          <a
            href="/member/portfolio"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 min-h-[44px] bg-[#FAF7F2] text-[#171717] hover:bg-[#00E599]/30 border-2 border-[#171717] shadow-[1px_1px_0px_#171717] ml-auto"
            title="Buka Portofolio Profesional Saya"
          >
            <Award size={16} className="text-[#00A86B]" />
            <span>Portofolio Saya</span>
          </a>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: IKHTISAR & ROADMAP                                             */}
      {/* ===================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Notice Self-Assessment */}
          <div className="p-3.5 bg-[#FFFDF7] border-2 border-[#171717] rounded-xl shadow-[3px_3px_0px_#171717] flex items-start gap-3">
            <Sparkles size={18} className="text-[#FFD83D] shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <p className="font-black text-[#171717]">Pemberitahuan Self-Assessment</p>
              <p className="text-[#171717]/80 font-medium">
                Tingkat kompetensi yang Anda tentukan merupakan penilaian mandiri (self-assessment) untuk memandu rencana pengembangan profesional Anda, bukan evaluasi formal resmi dari manajemen perusahaan.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Roadmap Target Aktif (2 Kolom) */}
            <div className="lg:col-span-2 bg-white border-2 border-[#171717] p-4 sm:p-5 rounded-xl shadow-[4px_4px_0px_#171717] space-y-4">
              <div className="flex items-center justify-between border-b-2 border-[#171717]/10 pb-3">
                <div>
                  <h3 className="font-display text-base sm:text-lg text-[#171717] flex items-center gap-2">
                    <Target size={18} className="text-[#FF2F92]" />
                    <span>Roadmap Target Aktif</span>
                  </h3>
                  <p className="text-xs text-[#171717]/60 font-bold">
                    Target pengembangan kompetensi yang sedang berjalan
                  </p>
                </div>
                <button
                  onClick={() => handleOpenGoalModal()}
                  className="px-3 py-1.5 bg-[#FFD83D] hover:bg-[#FFE066] border-2 border-[#171717] rounded-xl text-xs font-black uppercase tracking-wider shadow-[1px_1px_0px_#171717] flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Tambah Target</span>
                </button>
              </div>

              {overview?.active_goals?.length === 0 ? (
                <div className="py-10 text-center space-y-3 bg-[#FAF7F2] border-1.5 border-[#171717]/20 rounded-xl p-4">
                  <Inbox size={32} className="mx-auto text-[#171717]/40" />
                  <p className="text-xs font-bold text-[#171717]/70">
                    Belum ada target pengembangan aktif. Mulai tentukan sasaran peningkatan keahlian Anda.
                  </p>
                  <button
                    onClick={() => handleOpenGoalModal()}
                    className="px-4 py-2 bg-[#171717] text-white border-2 border-[#171717] rounded-xl text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#171717] cursor-pointer"
                  >
                    Buat Target Pertama
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {overview?.active_goals?.map(g => (
                    <div
                      key={g.id}
                      className="p-3.5 bg-[#FAF7F2] hover:bg-white border-2 border-[#171717] rounded-xl shadow-[2px_2px_0px_#171717] space-y-2.5 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider rounded border ${
                              GOAL_STATUS_CONFIG[g.status]?.bg || 'bg-white'
                            }`}>
                              {GOAL_STATUS_CONFIG[g.status]?.label || g.status}
                            </span>
                            {g.skill && (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-white text-[#171717] border border-[#171717] rounded">
                                {g.skill.name}
                              </span>
                            )}
                            <span className="text-[10px] font-mono font-bold bg-[#FFD83D] px-2 py-0.5 border border-[#171717] rounded">
                              Prioritas: {g.priority}
                            </span>
                          </div>
                          <h4 className="text-sm font-black text-[#171717]">{g.title}</h4>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono text-base font-black text-[#171717] block">
                            {g.progress}%
                          </span>
                          {g.target_date && (
                            <span className="text-[10px] font-mono font-bold text-[#171717]/60 block">
                              Target: {g.target_date}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-2.5 bg-white border border-[#171717] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#10B981] transition-all"
                          style={{ width: `${g.progress}%` }}
                        />
                      </div>

                      {/* Milestones count */}
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#171717]/70 pt-1">
                        <span>
                          {g.milestones?.filter(m => m.is_completed).length || 0} dari {g.milestones?.length || 0} milestone selesai
                        </span>
                        <button
                          onClick={() => setMilestoneModalGoal(g)}
                          className="text-xs font-black underline hover:text-[#FF2F92] cursor-pointer"
                        >
                          + Tambah Milestone
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Kolom Kanan: Kompetensi & Feedback Terkini (1 Kolom) */}
            <div className="space-y-6">
              {/* Kompetensi yang Sedang Dikembangkan */}
              <div className="bg-white border-2 border-[#171717] p-4 rounded-xl shadow-[4px_4px_0px_#171717] space-y-3">
                <h3 className="font-display text-base text-[#171717] border-b-2 border-[#171717]/10 pb-2">
                  Fokus Kompetensi
                </h3>
                {overview?.developing_skills?.length === 0 ? (
                  <p className="text-xs font-bold text-[#171717]/60 italic py-2">
                    Belum ada kompetensi yang terhubung ke target aktif.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {overview?.developing_skills?.map(s => (
                      <div
                        key={s.id}
                        className="p-2.5 bg-[#FAF7F2] border-1.5 border-[#171717] rounded-xl flex items-center justify-between text-xs font-bold"
                      >
                        <div>
                          <p className="font-black text-[#171717]">{s.name}</p>
                          <span className="text-[10px] text-[#171717]/60">{s.category}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-white border border-[#171717] rounded">
                            L{s.current_level} â†’ L{s.target_level}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Catatan Feedback PM */}
              <div className="bg-white border-2 border-[#171717] p-4 rounded-xl shadow-[4px_4px_0px_#171717] space-y-3">
                <h3 className="font-display text-base text-[#171717] border-b-2 border-[#171717]/10 pb-2">
                  Arahan PM Terbaru
                </h3>
                {overview?.recent_feedbacks?.length === 0 ? (
                  <p className="text-xs font-bold text-[#171717]/60 italic py-2">
                    Belum ada catatan feedback pengembangan dari Project Manager.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {overview?.recent_feedbacks?.map(f => (
                      <div
                        key={f.id}
                        className="p-3 bg-[#FFFDF7] border-1.5 border-[#171717] rounded-xl space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold text-[#171717]/60">
                          <span className="font-black text-[#171717]">{f.reviewer?.name}</span>
                          <span>{new Date(f.created_at).toLocaleDateString('id-ID')}</span>
                        </div>
                        <p className="text-[#171717] font-medium leading-relaxed italic">
                          "{f.feedback}"
                        </p>
                        {f.action_recommendations && (
                          <div className="p-2 bg-white border border-[#171717]/20 rounded text-[11px] font-bold text-[#171717]">
                            <span className="text-[#FF5722] font-black">Saran:</span> {f.action_recommendations}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: KOMPETENSI SAYA (SKILLS)                                       */}
      {/* ===================================================================== */}
      {activeTab === 'skills' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border-2 border-[#171717] p-4 rounded-xl shadow-[3px_3px_0px_#171717]">
            <div>
              <h3 className="font-display text-base sm:text-lg text-[#171717]">
                Daftar Kompetensi Personal
              </h3>
              <p className="text-xs text-[#171717]/60 font-bold">
                Kemampuan dan keahlian yang Anda miliki serta target tingkat penguasaan
              </p>
            </div>
            <button
              onClick={() => handleOpenSkillModal()}
              className="px-4 py-2 bg-[#FFD83D] hover:bg-[#FFE066] active:translate-x-0.5 active:translate-y-0.5 border-2 border-[#171717] rounded-xl text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#171717] flex items-center gap-1.5 cursor-pointer min-h-[44px]"
            >
              <Plus size={16} />
              <span>Tambah Kompetensi</span>
            </button>
          </div>

          {skills.length === 0 ? (
            <div className="bg-white border-2 border-[#171717] p-8 sm:p-12 rounded-xl shadow-[4px_4px_0px_#171717] text-center space-y-3">
              <Award size={36} className="mx-auto text-[#171717]/40" />
              <h4 className="font-display text-base sm:text-lg text-[#171717]">
                Belum Ada Kompetensi Tercatat
              </h4>
              <p className="text-xs sm:text-sm text-[#171717]/70 font-medium max-w-md mx-auto">
                Catat keahlian teknis, komunikasi, maupun manajemen yang Anda miliki untuk memetakan pertumbuhan karir Anda.
              </p>
              <button
                onClick={() => handleOpenSkillModal()}
                className="px-4 py-2 bg-[#171717] text-white border-2 border-[#171717] rounded-xl text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#171717] cursor-pointer"
              >
                Catat Kompetensi Sekarang
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {skills.map(skill => (
                <div
                  key={skill.id}
                  className="bg-white border-2 border-[#171717] p-4 rounded-xl shadow-[3px_3px_0px_#171717] space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider bg-[#FAF7F2] text-[#171717] border border-[#171717] rounded truncate">
                        {skill.category}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenSkillModal(skill)}
                          className="p-1.5 hover:bg-[#FFD83D] border border-[#171717] rounded-lg cursor-pointer"
                          title="Edit kompetensi"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteSkill(skill.id)}
                          className="p-1.5 hover:bg-[#FF2F92] hover:text-white border border-[#171717] rounded-lg cursor-pointer"
                          title="Hapus kompetensi"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-base font-black text-[#171717]">{skill.name}</h4>
                    {skill.description && (
                      <p className="text-xs text-[#171717]/80 font-medium leading-relaxed">
                        {skill.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[#171717]/10">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>Tingkat Saat Ini:</span>
                      <span className="font-mono font-black px-2 py-0.5 bg-[#FFD83D] border border-[#171717] rounded">
                        Level {skill.current_level} ({LEVEL_CONFIG[skill.current_level]?.label})
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>Target Level:</span>
                      <span className="font-mono font-black px-2 py-0.5 bg-[#FAF7F2] border border-[#171717] rounded">
                        Level {skill.target_level} ({LEVEL_CONFIG[skill.target_level]?.label})
                      </span>
                    </div>

                    {skill.experience_notes && (
                      <p className="text-[11px] text-[#171717]/70 italic bg-[#FAF7F2] p-2 border border-[#171717]/20 rounded">
                        {skill.experience_notes}
                      </p>
                    )}

                    {skill.evidence_url && (
                      <a
                        href={skill.evidence_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3B82F6] hover:underline"
                      >
                        <ExternalLink size={12} />
                        <span>Bukti / Portofolio Terkait</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: TARGET PENGEMBANGAN (GOALS)                                    */}
      {/* ===================================================================== */}
      {activeTab === 'goals' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border-2 border-[#171717] p-4 rounded-xl shadow-[3px_3px_0px_#171717]">
            <div>
              <h3 className="font-display text-base sm:text-lg text-[#171717]">
                Target Pengembangan Diri
              </h3>
              <p className="text-xs text-[#171717]/60 font-bold">
                Sasaran peningkatan keahlian terstruktur dengan milestone dan pelacakan progres
              </p>
            </div>
            <button
              onClick={() => handleOpenGoalModal()}
              className="px-4 py-2 bg-[#FFD83D] hover:bg-[#FFE066] active:translate-x-0.5 active:translate-y-0.5 border-2 border-[#171717] rounded-xl text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#171717] flex items-center gap-1.5 cursor-pointer min-h-[44px]"
            >
              <Plus size={16} />
              <span>Buat Target Baru</span>
            </button>
          </div>

          {goals.length === 0 ? (
            <div className="bg-white border-2 border-[#171717] p-8 sm:p-12 rounded-xl shadow-[4px_4px_0px_#171717] text-center space-y-3">
              <Target size={36} className="mx-auto text-[#171717]/40" />
              <h4 className="font-display text-base sm:text-lg text-[#171717]">
                Belum Ada Target Pengembangan
              </h4>
              <p className="text-xs sm:text-sm text-[#171717]/70 font-medium max-w-md mx-auto">
                Tentukan sasaran belajar yang ingin Anda raih untuk meningkatkan kemampuan teknis maupun non-teknis Anda.
              </p>
              <button
                onClick={() => handleOpenGoalModal()}
                className="px-4 py-2 bg-[#171717] text-white border-2 border-[#171717] rounded-xl text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#171717] cursor-pointer"
              >
                Buat Target Sekarang
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map(goal => (
                <div
                  key={goal.id}
                  className="bg-white border-2 border-[#171717] p-4 sm:p-5 rounded-xl shadow-[3px_3px_0px_#171717] space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider rounded border ${
                          GOAL_STATUS_CONFIG[goal.status]?.bg || 'bg-white'
                        }`}>
                          {GOAL_STATUS_CONFIG[goal.status]?.label || goal.status}
                        </span>
                        {goal.skill && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-[#FAF7F2] text-[#171717] border border-[#171717] rounded">
                            {goal.skill.name}
                          </span>
                        )}
                        <span className="text-[10px] font-mono font-bold bg-[#FFD83D] px-2 py-0.5 border border-[#171717] rounded">
                          Prioritas: {goal.priority}
                        </span>
                        {goal.target_date && (
                          <span className="text-[10px] font-mono font-bold bg-[#FAF7F2] text-[#171717]/70 px-2 py-0.5 border border-[#171717] rounded flex items-center gap-1">
                            <Calendar size={11} />
                            <span>Target: {goal.target_date}</span>
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-black text-[#171717]">{goal.title}</h4>
                      {goal.description && (
                        <p className="text-xs text-[#171717]/80 font-medium leading-relaxed">
                          {goal.description}
                        </p>
                      )}
                      {goal.reason && (
                        <p className="text-[11px] text-[#171717]/70 font-bold">
                          <span className="text-[#FF5722]">Alasan:</span> {goal.reason}
                        </p>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
                      <div className="text-right">
                        <span className="font-mono text-2xl font-black text-[#171717] block">
                          {goal.progress}%
                        </span>
                        <span className="text-[10px] font-bold text-[#171717]/60">Progres Capaian</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setMilestoneModalGoal(goal)}
                          className="px-2.5 py-1.5 bg-[#FAF7F2] hover:bg-[#FFD83D] border border-[#171717] rounded-lg text-xs font-black shadow-[1px_1px_0px_#171717] cursor-pointer"
                          title="Tambah milestone"
                        >
                          + Milestone
                        </button>
                        <button
                          onClick={() => handleOpenGoalModal(goal)}
                          className="p-1.5 hover:bg-[#FFD83D] border border-[#171717] rounded-lg cursor-pointer"
                          title="Edit target"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteGoal(goal.id)}
                          className="p-1.5 hover:bg-[#FF2F92] hover:text-white border border-[#171717] rounded-lg cursor-pointer"
                          title="Hapus target"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-3 bg-[#FAF7F2] border-1.5 border-[#171717] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#10B981] transition-all"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>

                  {/* Milestones List */}
                  {goal.milestones && goal.milestones.length > 0 && (
                    <div className="pt-2 border-t border-[#171717]/10 space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#171717]/60 block">
                        MILESTONES ({goal.milestones.filter(m => m.is_completed).length} / {goal.milestones.length})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {goal.milestones.map(m => (
                          <div
                            key={m.id}
                            className={`p-2.5 border-1.5 border-[#171717] rounded-lg flex items-center justify-between text-xs font-bold gap-2 ${
                              m.is_completed ? 'bg-[#10B981]/15 line-through text-[#171717]/80' : 'bg-[#FAF7F2]'
                            }`}
                          >
                            <div
                              onClick={() => handleToggleMilestone(m)}
                              className="flex items-center gap-2 flex-1 cursor-pointer select-none"
                            >
                              <div className={`w-4 h-4 rounded border border-[#171717] flex items-center justify-center shrink-0 ${
                                m.is_completed ? 'bg-[#10B981] text-white' : 'bg-white'
                              }`}>
                                {m.is_completed && <CheckSquare size={12} />}
                              </div>
                              <span className="truncate">{m.title}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteMilestone(m.id)}
                              className="p-1 hover:text-[#FF2F92] cursor-pointer shrink-0"
                              title="Hapus milestone"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: AKTIVITAS BELAJAR (ACTIVITIES)                                 */}
      {/* ===================================================================== */}
      {activeTab === 'activities' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border-2 border-[#171717] p-4 rounded-xl shadow-[3px_3px_0px_#171717]">
            <div>
              <h3 className="font-display text-base sm:text-lg text-[#171717]">
                Log Aktivitas Pembelajaran
              </h3>
              <p className="text-xs text-[#171717]/60 font-bold">
                Catatan sesi belajar mandiri, kursus, workshop, dan praktik yang Anda lakukan
              </p>
            </div>
            <button
              onClick={() => handleOpenActivityModal()}
              className="px-4 py-2 bg-[#FFD83D] hover:bg-[#FFE066] active:translate-x-0.5 active:translate-y-0.5 border-2 border-[#171717] rounded-xl text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#171717] flex items-center gap-1.5 cursor-pointer min-h-[44px]"
            >
              <Plus size={16} />
              <span>Catat Aktivitas Belajar</span>
            </button>
          </div>

          {activities.length === 0 ? (
            <div className="bg-white border-2 border-[#171717] p-8 sm:p-12 rounded-xl shadow-[4px_4px_0px_#171717] text-center space-y-3">
              <BookOpen size={36} className="mx-auto text-[#171717]/40" />
              <h4 className="font-display text-base sm:text-lg text-[#171717]">
                Belum Ada Aktivitas Tercatat
              </h4>
              <p className="text-xs sm:text-sm text-[#171717]/70 font-medium max-w-md mx-auto">
                Dokumentasikan waktu belajar dan hasil riset Anda untuk memantau konsistensi peningkatan keahlian.
              </p>
              <button
                onClick={() => handleOpenActivityModal()}
                className="px-4 py-2 bg-[#171717] text-white border-2 border-[#171717] rounded-xl text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#171717] cursor-pointer"
              >
                Catat Aktivitas Pertama
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map(act => (
                <div
                  key={act.id}
                  className="bg-white border-2 border-[#171717] p-4 rounded-xl shadow-[3px_3px_0px_#171717] flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider bg-[#3B82F6] text-white border border-[#171717] rounded">
                        {ACTIVITY_TYPES[act.activity_type] || act.activity_type}
                      </span>
                      {act.skill && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-[#FAF7F2] text-[#171717] border border-[#171717] rounded">
                          {act.skill.name}
                        </span>
                      )}
                      {act.goal && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-[#FAF7F2] text-[#171717] border border-[#171717] rounded">
                          Target: {act.goal.title}
                        </span>
                      )}
                      <span className="text-[10px] font-mono font-bold bg-[#FAF7F2] text-[#171717]/60 px-2 py-0.5 border border-[#171717] rounded">
                        {act.activity_date}
                      </span>
                    </div>

                    <h4 className="text-base font-black text-[#171717]">{act.title}</h4>
                    {act.description && (
                      <p className="text-xs text-[#171717]/80 font-medium">{act.description}</p>
                    )}
                    {act.learning_notes && (
                      <div className="p-2.5 bg-[#FAF7F2] border border-[#171717]/20 rounded-lg text-xs text-[#171717]">
                        <span className="font-black text-[#171717] block mb-0.5">Catatan Hasil Belajar:</span>
                        <p className="font-medium whitespace-pre-line">{act.learning_notes}</p>
                      </div>
                    )}

                    {act.evidence_url && (
                      <a
                        href={act.evidence_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3B82F6] hover:underline pt-1"
                      >
                        <ExternalLink size={12} />
                        <span>Tautan Bukti / Sumber Materi</span>
                      </a>
                    )}
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
                    {act.duration_minutes && (
                      <span className="text-sm font-mono font-black px-2.5 py-1 bg-[#FFD83D] border border-[#171717] rounded-lg">
                        {act.duration_minutes} Menit
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenActivityModal(act)}
                        className="p-1.5 hover:bg-[#FFD83D] border border-[#171717] rounded-lg cursor-pointer"
                        title="Edit aktivitas"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteActivity(act.id)}
                        className="p-1.5 hover:bg-[#FF2F92] hover:text-white border border-[#171717] rounded-lg cursor-pointer"
                        title="Hapus aktivitas"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: PM FEEDBACK & DEVELOPMENT HISTORY                              */}
      {/* ===================================================================== */}
      {activeTab === 'feedback' && (
        <div className="space-y-4">
          <div className="bg-white border-2 border-[#171717] p-4 rounded-xl shadow-[3px_3px_0px_#171717]">
            <h3 className="font-display text-base sm:text-lg text-[#171717]">
              Arahan & Masukan dari Project Manager
            </h3>
            <p className="text-xs text-[#171717]/60 font-bold">
              Bimbingan profesional dan rekomendasi pengembangan dari Project Manager
            </p>
          </div>

          {feedbacks.length === 0 ? (
            <div className="bg-white border-2 border-[#171717] p-8 sm:p-12 rounded-xl shadow-[4px_4px_0px_#171717] text-center space-y-3">
              <MessageSquare size={36} className="mx-auto text-[#171717]/40" />
              <h4 className="font-display text-base sm:text-lg text-[#171717]">
                Belum Ada Catatan Bimbingan PM
              </h4>
              <p className="text-xs sm:text-sm text-[#171717]/70 font-medium max-w-md mx-auto">
                Project Manager akan memberikan masukan dan rekomendasi belajar saat meninjau hasil pekerjaan proyek Anda.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {feedbacks.map(fb => (
                <div
                  key={fb.id}
                  className="bg-white border-2 border-[#171717] p-4 sm:p-5 rounded-xl shadow-[3px_3px_0px_#171717] space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-[#171717]/10 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-[#FFD83D] border border-[#171717] rounded-lg">
                        <User size={14} className="text-[#171717]" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-[#171717] block">
                          {fb.reviewer?.name || 'Project Manager'}
                        </span>
                        <span className="text-[10px] font-bold text-[#171717]/60 uppercase">
                          {fb.reviewer?.role || 'PM'}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#171717]/60">
                      {new Date(fb.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <p className="text-[#171717] font-medium leading-relaxed whitespace-pre-line">
                      {fb.feedback}
                    </p>

                    {fb.action_recommendations && (
                      <div className="p-3 bg-[#FAF7F2] border-1.5 border-[#171717] rounded-xl space-y-1">
                        <span className="text-[11px] font-black uppercase text-[#FF5722] block">
                          Rekomendasi Tindak Lanjut:
                        </span>
                        <p className="text-xs text-[#171717] font-bold">
                          {fb.action_recommendations}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: TAMBAH / EDIT SKILL                                            */}
      {/* ===================================================================== */}
      {skillModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setSkillModalOpen(false)}
        >
          <div
            className="bg-[#F5F1E9] border-2 border-[#171717] rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-[6px_6px_0px_#171717] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-[#171717]/10 pb-3">
              <h3 className="font-display text-lg text-[#171717]">
                {editingSkill ? 'Perbarui Kompetensi' : 'Tambah Kompetensi Baru'}
              </h3>
              <button
                onClick={() => setSkillModalOpen(false)}
                className="p-1 hover:bg-[#FF2F92] hover:text-white border border-[#171717] rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSkill} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-[#171717]">
                  Nama Kompetensi *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: React Frontend Architecture"
                  value={skillForm.name}
                  onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold focus:outline-none focus:shadow-[2px_2px_0px_#171717]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-[#171717]">
                  Kategori *
                </label>
                <select
                  value={skillForm.category}
                  onChange={(e) => setSkillForm({ ...skillForm, category: e.target.value })}
                  className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold focus:outline-none focus:shadow-[2px_2px_0px_#171717] cursor-pointer"
                >
                  {SKILL_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-[#171717]">
                    Tingkat Saat Ini *
                  </label>
                  <select
                    value={skillForm.current_level}
                    onChange={(e) => setSkillForm({ ...skillForm, current_level: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5].map(lvl => (
                      <option key={lvl} value={lvl}>
                        Level {lvl} â€” {LEVEL_CONFIG[lvl].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-[#171717]">
                    Target Tingkat *
                  </label>
                  <select
                    value={skillForm.target_level}
                    onChange={(e) => setSkillForm({ ...skillForm, target_level: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5].map(lvl => (
                      <option key={lvl} value={lvl}>
                        Level {lvl} â€” {LEVEL_CONFIG[lvl].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-[#171717]">
                  Deskripsi Singkat
                </label>
                <textarea
                  rows={2}
                  placeholder="Penjelasan keahlian dan lingkup penguasaan..."
                  value={skillForm.description}
                  onChange={(e) => setSkillForm({ ...skillForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold focus:outline-none focus:shadow-[2px_2px_0px_#171717]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-[#171717]">
                  Catatan Pengalaman Terkait
                </label>
                <textarea
                  rows={2}
                  placeholder="Pengalaman nyata dalam menangani proyek..."
                  value={skillForm.experience_notes}
                  onChange={(e) => setSkillForm({ ...skillForm, experience_notes: e.target.value })}
                  className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold focus:outline-none focus:shadow-[2px_2px_0px_#171717]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-[#171717]">
                  Tautan Bukti / Portofolio (URL Opsional)
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/..."
                  value={skillForm.evidence_url}
                  onChange={(e) => setSkillForm({ ...skillForm, evidence_url: e.target.value })}
                  className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold focus:outline-none focus:shadow-[2px_2px_0px_#171717]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#171717]/10">
                <button
                  type="button"
                  onClick={() => setSkillModalOpen(false)}
                  className="px-4 py-2 bg-[#FAF7F2] hover:bg-white border-2 border-[#171717] rounded-xl text-xs font-black cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FFD83D] hover:bg-[#FFE066] border-2 border-[#171717] rounded-xl text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#171717] cursor-pointer"
                >
                  Simpan Kompetensi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: TAMBAH / EDIT GOAL                                             */}
      {/* ===================================================================== */}
      {goalModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setGoalModalOpen(false)}
        >
          <div
            className="bg-[#F5F1E9] border-2 border-[#171717] rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-[6px_6px_0px_#171717] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-[#171717]/10 pb-3">
              <h3 className="font-display text-lg text-[#171717]">
                {editingGoal ? 'Perbarui Target Pengembangan' : 'Target Pengembangan Baru'}
              </h3>
              <button
                onClick={() => setGoalModalOpen(false)}
                className="p-1 hover:bg-[#FF2F92] hover:text-white border border-[#171717] rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-[#171717]">
                  Judul Target *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Menguasai Optimasi Database PostgreSQL"
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold focus:outline-none focus:shadow-[2px_2px_0px_#171717]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-[#171717]">
                  Hubungkan dengan Kompetensi (Opsional)
                </label>
                <select
                  value={goalForm.skill_id}
                  onChange={(e) => setGoalForm({ ...goalForm, skill_id: e.target.value })}
                  className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold cursor-pointer"
                >
                  <option value="">-- Pilih Kompetensi Terkait --</option>
                  {skills.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-[#171717]">
                    Prioritas *
                  </label>
                  <select
                    value={goalForm.priority}
                    onChange={(e) => setGoalForm({ ...goalForm, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold cursor-pointer"
                  >
                    <option value="urgent">Mendesak (Urgent)</option>
                    <option value="high">Tinggi (High)</option>
                    <option value="medium">Sedang (Medium)</option>
                    <option value="low">Rendah (Low)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-[#171717]">
                    Target Tanggal Penyelesaian
                  </label>
                  <input
                    type="date"
                    value={goalForm.target_date}
                    onChange={(e) => setGoalForm({ ...goalForm, target_date: e.target.value })}
                    className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold cursor-pointer"
                  />
                </div>
              </div>

              {editingGoal && (
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-[#171717]">
                    Status Target
                  </label>
                  <select
                    value={goalForm.status}
                    onChange={(e) => setGoalForm({ ...goalForm, status: e.target.value })}
                    className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold cursor-pointer"
                  >
                    <option value="planned">Direncanakan (Planned)</option>
                    <option value="in_progress">Sedang Berjalan (In Progress)</option>
                    <option value="completed">Tercapai Selesai (Completed)</option>
                    <option value="paused">Ditunda Sementara (Paused)</option>
                    <option value="cancelled">Dibatalkan (Cancelled)</option>
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-[#171717]">
                  Deskripsi Target
                </label>
                <textarea
                  rows={2}
                  placeholder="Rincian target yang ingin dicapai..."
                  value={goalForm.description}
                  onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold focus:outline-none focus:shadow-[2px_2px_0px_#171717]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-[#171717]">
                  Alasan Pengembangan
                </label>
                <textarea
                  rows={2}
                  placeholder="Mengapa target ini penting bagi pertumbuhan kerja Anda..."
                  value={goalForm.reason}
                  onChange={(e) => setGoalForm({ ...goalForm, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold focus:outline-none focus:shadow-[2px_2px_0px_#171717]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#171717]/10">
                <button
                  type="button"
                  onClick={() => setGoalModalOpen(false)}
                  className="px-4 py-2 bg-[#FAF7F2] hover:bg-white border-2 border-[#171717] rounded-xl text-xs font-black cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FFD83D] hover:bg-[#FFE066] border-2 border-[#171717] rounded-xl text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#171717] cursor-pointer"
                >
                  Simpan Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: TAMBAH MILESTONE KE GOAL                                       */}
      {/* ===================================================================== */}
      {milestoneModalGoal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setMilestoneModalGoal(null)}
        >
          <div
            className="bg-[#F5F1E9] border-2 border-[#171717] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-[6px_6px_0px_#171717]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-[#171717]/10 pb-3">
              <div>
                <h3 className="font-display text-base text-[#171717]">
                  Tambah Milestone Target
                </h3>
                <p className="text-[11px] text-[#171717]/60 font-bold truncate max-w-[280px]">
                  {milestoneModalGoal.title}
                </p>
              </div>
              <button
                onClick={() => setMilestoneModalGoal(null)}
                className="p-1 hover:bg-[#FF2F92] hover:text-white border border-[#171717] rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddMilestone} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-[#171717]">
                  Judul Milestone *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Menyelesaikan materi bab 1"
                  value={milestoneForm.title}
                  onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-[#171717]">
                  Target Tanggal (Opsional)
                </label>
                <input
                  type="date"
                  value={milestoneForm.target_date}
                  onChange={(e) => setMilestoneForm({ ...milestoneForm, target_date: e.target.value })}
                  className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMilestoneModalGoal(null)}
                  className="px-4 py-2 bg-[#FAF7F2] hover:bg-white border-2 border-[#171717] rounded-xl text-xs font-black cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FFD83D] hover:bg-[#FFE066] border-2 border-[#171717] rounded-xl text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#171717] cursor-pointer"
                >
                  Simpan Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: TAMBAH / EDIT AKTIVITAS                                        */}
      {/* ===================================================================== */}
      {activityModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setActivityModalOpen(false)}
        >
          <div
            className="bg-[#F5F1E9] border-2 border-[#171717] rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-[6px_6px_0px_#171717] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-[#171717]/10 pb-3">
              <h3 className="font-display text-lg text-[#171717]">
                {editingActivity ? 'Perbarui Aktivitas Belajar' : 'Catat Aktivitas Belajar'}
              </h3>
              <button
                onClick={() => setActivityModalOpen(false)}
                className="p-1 hover:bg-[#FF2F92] hover:text-white border border-[#171717] rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveActivity} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-[#171717]">
                  Judul Aktivitas *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Mengikuti Webinar Sistem Terdistribusi"
                  value={activityForm.title}
                  onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold focus:outline-none focus:shadow-[2px_2px_0px_#171717]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-[#171717]">
                    Jenis Aktivitas *
                  </label>
                  <select
                    value={activityForm.activity_type}
                    onChange={(e) => setActivityForm({ ...activityForm, activity_type: e.target.value })}
                    className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold cursor-pointer"
                  >
                    {Object.entries(ACTIVITY_TYPES).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-[#171717]">
                    Tanggal Pelaksanaan *
                  </label>
                  <input
                    type="date"
                    required
                    value={activityForm.activity_date}
                    onChange={(e) => setActivityForm({ ...activityForm, activity_date: e.target.value })}
                    className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-[#171717]">
                    Durasi (Menit, Opsional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Contoh: 60"
                    value={activityForm.duration_minutes}
                    onChange={(e) => setActivityForm({ ...activityForm, duration_minutes: e.target.value })}
                    className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-[#171717]">
                    Sumber Materi (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Coursera / YouTube"
                    value={activityForm.learning_source}
                    onChange={(e) => setActivityForm({ ...activityForm, learning_source: e.target.value })}
                    className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-[#171717]">
                    Hubungkan Kompetensi
                  </label>
                  <select
                    value={activityForm.skill_id}
                    onChange={(e) => setActivityForm({ ...activityForm, skill_id: e.target.value })}
                    className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold cursor-pointer"
                  >
                    <option value="">-- Tidak ada --</option>
                    {skills.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-[#171717]">
                    Hubungkan Target
                  </label>
                  <select
                    value={activityForm.goal_id}
                    onChange={(e) => setActivityForm({ ...activityForm, goal_id: e.target.value })}
                    className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold cursor-pointer"
                  >
                    <option value="">-- Tidak ada --</option>
                    {goals.map(g => (
                      <option key={g.id} value={g.id}>{g.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-[#171717]">
                  Catatan Ringkasan Hasil Belajar
                </label>
                <textarea
                  rows={2}
                  placeholder="Apa wawasan baru atau intisari materi yang Anda peroleh..."
                  value={activityForm.learning_notes}
                  onChange={(e) => setActivityForm({ ...activityForm, learning_notes: e.target.value })}
                  className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-[#171717]">
                  Tautan Bukti Pembelajaran (URL Opsional)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={activityForm.evidence_url}
                  onChange={(e) => setActivityForm({ ...activityForm, evidence_url: e.target.value })}
                  className="w-full px-3 py-2 bg-white border-2 border-[#171717] rounded-xl text-xs font-bold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#171717]/10">
                <button
                  type="button"
                  onClick={() => setActivityModalOpen(false)}
                  className="px-4 py-2 bg-[#FAF7F2] hover:bg-white border-2 border-[#171717] rounded-xl text-xs font-black cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FFD83D] hover:bg-[#FFE066] border-2 border-[#171717] rounded-xl text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#171717] cursor-pointer"
                >
                  Simpan Aktivitas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
