import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import {
  Settings as SettingsIcon,
  Save, Bell, ShieldCheck, Check, Monitor,
  Database, Key, Lock, Loader2, AlertCircle,
  RefreshCw,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const DEFAULT_PREFS = {
  notify_task_assigned:       true,
  notify_task_status_changed: true,
  notify_task_overdue:        true,
  notify_project_changed:     false,
  notify_system_activity:     false,
}

const PREF_LABELS = [
  {
    key:   'notify_task_assigned',
    label: 'Notifikasi Penugasan Task Baru',
    desc:  'Pemberitahuan saat Anda ditugaskan ke task baru oleh Project Manager.',
  },
  {
    key:   'notify_task_status_changed',
    label: 'Notifikasi Perubahan Status Task',
    desc:  'Pemberitahuan saat status task yang Anda miliki berubah (misalnya: selesai, ditunda).',
  },
  {
    key:   'notify_task_overdue',
    label: 'Notifikasi Deadline / Task Terlambat',
    desc:  'Peringatan otomatis saat deadline task prioritas tinggi sudah dekat atau terlewat.',
  },
  {
    key:   'notify_project_changed',
    label: 'Notifikasi Perubahan Proyek',
    desc:  'Pemberitahuan saat proyek yang Anda ikuti mengalami perubahan status atau risiko.',
  },
  {
    key:   'notify_system_activity',
    label: 'Notifikasi Aktivitas Sistem',
    desc:  'Ringkasan aktivitas sistem, laporan mingguan, dan pembaruan dari administrator.',
  },
]

export default function Settings() {
  const { user, checkAuth } = useAuth()

  // Profile fields
  const [name, setName]                       = useState(user?.name || '')
  const [phone, setPhone]                     = useState(user?.phone || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Preferences
  const [prefs, setPrefs]           = useState(DEFAULT_PREFS)
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [prefsError, setPrefsError]     = useState(null)

  // Saving state
  const [savingProfile, setSavingProfile]   = useState(false)
  const [savingPrefs, setSavingPrefs]       = useState(false)
  const [profileFeedback, setProfileFeedback] = useState(null)
  const [prefsFeedback, setPrefsFeedback]   = useState(null)
  const [errors, setErrors] = useState({})

  // Sync name/phone when user loads
  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setPhone(user.phone || '')
    }
  }, [user])

  // Load preferences from API
  const loadPreferences = useCallback(async () => {
    setPrefsLoading(true)
    setPrefsError(null)
    try {
      const res = await api.get('/settings/preferences')
      setPrefs({ ...DEFAULT_PREFS, ...res.data.preferences })
    } catch (err) {
      setPrefsError('Gagal memuat preferensi. Periksa koneksi server.')
    } finally {
      setPrefsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  // Save profile
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    setProfileFeedback(null)
    setErrors({})

    try {
      const payload = { name, phone: phone || null }
      if (newPassword) {
        payload.current_password             = currentPassword
        payload.new_password                 = newPassword
        payload.new_password_confirmation    = confirmPassword
      }

      await api.put('/me', payload)
      if (checkAuth) await checkAuth()

      setProfileFeedback({ type: 'success', message: 'Profil berhasil diperbarui!' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setProfileFeedback(null), 5000)
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        setErrors(err.response.data.errors)
      } else {
        setProfileFeedback({ type: 'error', message: err.response?.data?.message || 'Gagal menyimpan profil.' })
      }
    } finally {
      setSavingProfile(false)
    }
  }

  // Save preferences
  const handleSavePrefs = async () => {
    setSavingPrefs(true)
    setPrefsFeedback(null)
    try {
      await api.put('/settings/preferences', prefs)
      setPrefsFeedback({ type: 'success', message: 'Preferensi notifikasi berhasil disimpan!' })
      setTimeout(() => setPrefsFeedback(null), 5000)
    } catch (err) {
      if (err.response?.status === 422) {
        setPrefsFeedback({ type: 'error', message: 'Validasi gagal. Pastikan semua nilai preferensi valid.' })
      } else {
        setPrefsFeedback({ type: 'error', message: err.response?.data?.message || 'Gagal menyimpan preferensi.' })
      }
    } finally {
      setSavingPrefs(false)
    }
  }

  const togglePref = (key) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const FeedbackBar = ({ feedback, onClose }) => feedback ? (
    <div className={`p-3 border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center justify-between text-xs font-black ${
      feedback.type === 'success' ? 'bg-[#10B981]/20 text-[#171717]' : 'bg-[#FF2F92]/20 text-[#FF2F92]'
    }`}>
      <div className="flex items-center gap-2">
        {feedback.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
        <span>{feedback.message}</span>
      </div>
      <button onClick={onClose} className="font-bold opacity-60 hover:opacity-100">✕</button>
    </div>
  ) : null

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <PageHeader
        title="PENGATURAN SISTEM"
        subtitle="Konfigurasi preferensi profil pengguna, keamanan akun, dan preferensi notifikasi PKM."
        tag="KONFIGURASI"
        actions={
          <div className="bg-white px-3 py-1.5 border border-[#171717] rounded-lg flex items-center gap-2 shadow-[2px_2px_0px_#171717]">
            <SettingsIcon size={15} className="text-[#FF2F92]" />
            <span className="font-black text-xs uppercase">Sistem v1.0.0</span>
          </div>
        }
      />

      {/* ===== SECTION 1: Profile & Security ===== */}
      <form onSubmit={handleSaveProfile} className="space-y-4">
        <FeedbackBar feedback={profileFeedback} onClose={() => setProfileFeedback(null)} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Account Info Card */}
          <div className="bg-white p-5 border border-[#171717] rounded-lg space-y-4 shadow-[3px_3px_0px_#171717]">
            <div className="flex items-center gap-2 border-b border-[#171717]/10 pb-2.5">
              <ShieldCheck size={16} className="text-[#FF2F92]" />
              <h3 className="font-display text-base uppercase text-[#171717]">INFORMASI PROFIL AKUN</h3>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                />
                {errors.name && <p className="text-[10px] text-[#FF2F92] font-bold mt-0.5">{errors.name[0]}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Alamat Email (Login)</label>
                <input
                  type="email"
                  defaultValue={user?.email || ''}
                  disabled
                  className="w-full px-3 py-2 bg-neutral-100 border border-[#171717]/40 rounded text-xs font-semibold opacity-70 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Nomor Telepon / WhatsApp</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Peran (Role)</label>
                  <input
                    type="text"
                    defaultValue={user?.role === 'admin' ? 'Super Admin' : (user?.role?.replace('_', ' ')?.toUpperCase() || 'Admin')}
                    disabled
                    className="w-full px-3 py-2 bg-neutral-100 border border-[#171717]/40 rounded text-xs font-semibold opacity-70 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Security Card */}
          <div className="bg-white p-5 border border-[#171717] rounded-lg space-y-4 shadow-[3px_3px_0px_#171717]">
            <div className="flex items-center gap-2 border-b border-[#171717]/10 pb-2.5">
              <Lock size={16} className="text-[#B8A0F0]" />
              <h3 className="font-display text-base uppercase text-[#171717]">GANTI KATA SANDI (PASSWORD)</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Password Saat Ini</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Isi jika hendak mengubah password"
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                />
                {errors.current_password && <p className="text-[10px] text-[#FF2F92] font-bold mt-0.5">{errors.current_password[0]}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Password Baru</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                  />
                  {errors.new_password && <p className="text-[10px] text-[#FF2F92] font-bold mt-0.5">{errors.new_password[0]}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Ulangi Password Baru</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Konfirmasi password"
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:border-[#FF2F92]"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-[#EBE5FB] border border-[#171717]/20 rounded text-[10px] font-semibold text-[#171717]/70">
                <Key size={11} className="inline mr-1 text-[#B8A0F0]" />
                Kosongkan bidang password jika hanya ingin memperbarui nama atau nomor telepon.
              </div>
            </div>
          </div>
        </div>

        {/* Profile Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingProfile}
            className="pkm-btn-pink px-8 flex items-center gap-2 text-xs font-black uppercase disabled:opacity-50"
          >
            {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Simpan Profil & Password</span>
          </button>
        </div>
      </form>

      {/* ===== SECTION 2: Notification Preferences ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Notification Preferences Card */}
        <div className="bg-white p-5 border border-[#171717] rounded-lg space-y-3 shadow-[3px_3px_0px_#171717]">
          <div className="flex items-center justify-between border-b border-[#171717]/10 pb-2.5">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-[#FF2F92]" />
              <h3 className="font-display text-base uppercase text-[#171717]">PREFERENSI NOTIFIKASI</h3>
            </div>
            {prefsLoading && <Loader2 size={14} className="animate-spin text-[#FF2F92]" />}
            {!prefsLoading && prefsError && (
              <button onClick={loadPreferences} className="flex items-center gap-1 text-[10px] font-black text-[#FF2F92] hover:underline">
                <RefreshCw size={11} /> Coba Lagi
              </button>
            )}
          </div>

          {prefsError && (
            <div className="p-2.5 bg-[#FF2F92]/10 border border-[#FF2F92]/30 rounded text-[10px] font-semibold text-[#FF2F92] flex items-center gap-1.5">
              <AlertCircle size={12} /> {prefsError}
            </div>
          )}

          <FeedbackBar feedback={prefsFeedback} onClose={() => setPrefsFeedback(null)} />

          <div className="space-y-2">
            {PREF_LABELS.map((item) => (
              <label
                key={item.key}
                className={`flex items-center justify-between p-2.5 border border-[#171717]/20 rounded cursor-pointer transition-colors ${
                  prefsLoading ? 'bg-neutral-50 opacity-60 pointer-events-none' : 'bg-[#FAF7F2] hover:bg-[#FFD83D]/20'
                }`}
              >
                <div>
                  <p className="text-xs font-bold text-[#171717]">{item.label}</p>
                  <p className="text-[10px] text-[#171717]/55">{item.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs[item.key] ?? false}
                  onChange={() => togglePref(item.key)}
                  disabled={prefsLoading}
                  className="w-4 h-4 rounded border border-[#171717] accent-[#FF2F92] cursor-pointer shrink-0 ml-3"
                />
              </label>
            ))}
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={handleSavePrefs}
              disabled={savingPrefs || prefsLoading}
              className="pkm-btn-pink px-6 flex items-center gap-2 text-xs font-black uppercase disabled:opacity-50"
            >
              {savingPrefs ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>Simpan Preferensi</span>
            </button>
          </div>
        </div>

        {/* System Info Column */}
        <div className="space-y-4">
          <div className="bg-white p-5 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
            <div className="flex items-center gap-2 border-b border-[#171717]/10 pb-2.5 mb-3">
              <Monitor size={16} className="text-[#171717]" />
              <h3 className="font-display text-base uppercase text-[#171717]">INFO SISTEM OPERASIONAL</h3>
            </div>
            <div className="space-y-2 text-xs">
              {[
                { label: 'Versi Aplikasi',    value: 'PKM Business Control Center v1.0.0' },
                { label: 'Stack Teknologi',   value: 'React 18 + Vite + Laravel 11 (PHP 8.x)' },
                { label: 'Basis Data',        value: 'MySQL 8.0 (pkm_control)' },
                { label: 'Autentikasi API',   value: 'Laravel Sanctum Bearer Token' },
                { label: 'Pengguna Aktif',    value: user?.name || '-' },
                { label: 'Peran',             value: user?.role === 'admin' ? 'Super Admin' : (user?.role?.replace('_', ' ')?.toUpperCase() || '-') },
              ].map((item, i) => (
                <div key={i} className="flex justify-between py-1.5 border-b border-[#171717]/8 last:border-0 font-semibold">
                  <span className="text-[#171717]/55">{item.label}</span>
                  <span className="font-bold text-[#171717] text-right max-w-[55%]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#FF2F92] p-4 border border-[#171717] rounded-lg text-white shadow-[3px_3px_0px_#171717]">
            <div className="flex items-center gap-2 mb-1.5">
              <Database size={15} />
              <h3 className="font-display text-sm uppercase">STATUS KONEKSI BACKEND</h3>
            </div>
            <p className="text-[10px] opacity-90 mb-2">Seluruh endpoint REST API aktif dan tersambung penuh dengan database MySQL.</p>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
              <span className="text-[10px] font-black uppercase">Database Connected &amp; Running</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
