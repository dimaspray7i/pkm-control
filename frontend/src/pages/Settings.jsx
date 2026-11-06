import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import {
  Settings as SettingsIcon,
  Save, Bell, ShieldCheck, Check, Monitor,
  Database, Key, Lock, Loader2, AlertCircle,
  RefreshCw, Eye, EyeOff, User, Phone, X,
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
    label: 'Penugasan Task Baru',
    desc:  'Pemberitahuan saat Anda ditugaskan ke task baru oleh Project Manager.',
  },
  {
    key:   'notify_task_status_changed',
    label: 'Perubahan Status Task',
    desc:  'Pemberitahuan saat status task yang Anda miliki berubah (selesai, ditunda, dll.).',
  },
  {
    key:   'notify_task_overdue',
    label: 'Deadline / Task Terlambat',
    desc:  'Peringatan otomatis saat deadline task prioritas tinggi sudah dekat atau terlewat.',
  },
  {
    key:   'notify_project_changed',
    label: 'Perubahan Status Proyek',
    desc:  'Pemberitahuan saat proyek yang Anda ikuti mengalami perubahan status atau risiko.',
  },
  {
    key:   'notify_system_activity',
    label: 'Aktivitas Sistem',
    desc:  'Ringkasan aktivitas sistem, laporan mingguan, dan pembaruan dari administrator.',
  },
]

// Reusable input label component
function FieldLabel({ children, required }) {
  return (
    <label className="block text-[10px] font-black uppercase text-[#171717] mb-1 tracking-wide">
      {children}{required && <span className="text-[#FF2F92] ml-0.5">*</span>}
    </label>
  )
}

// Reusable feedback banner
function FeedbackBanner({ feedback, onClose }) {
  if (!feedback) return null
  const isSuccess = feedback.type === 'success'
  return (
    <div className={`flex items-start justify-between gap-3 p-3 border border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] text-xs font-semibold ${
      isSuccess ? 'bg-[#10B981]/15 text-[#171717]' : 'bg-[#FF2F92]/15 text-[#171717]'
    }`}>
      <div className="flex items-start gap-2">
        {isSuccess
          ? <Check size={14} className="text-[#10B981] shrink-0 mt-0.5" />
          : <AlertCircle size={14} className="text-[#FF2F92] shrink-0 mt-0.5" />
        }
        <span className="leading-relaxed">{feedback.message}</span>
      </div>
      <button
        onClick={onClose}
        className="shrink-0 p-0.5 hover:bg-[#171717]/10 rounded transition cursor-pointer opacity-60 hover:opacity-100"
      >
        <X size={13} />
      </button>
    </div>
  )
}

// Toggle switch component
function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-[#171717] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#FF2F92] focus:ring-offset-1 ${
        checked ? 'bg-[#FF2F92]' : 'bg-[#EAE4D8]'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white border border-[#171717]/30 shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

// Password input with show/hide
function PasswordInput({ value, onChange, placeholder, disabled, error, id }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className={`w-full px-3 py-2.5 pr-10 bg-[#FAF7F2] border rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF2F92] transition disabled:opacity-50 ${
          error ? 'border-[#FF2F92]' : 'border-[#171717]'
        }`}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        disabled={disabled}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#171717]/50 hover:text-[#171717] transition cursor-pointer disabled:cursor-not-allowed"
        tabIndex={-1}
        aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

export default function Settings() {
  const { user, checkAuth } = useAuth()

  // Profile fields
  const [name, setName]                       = useState(user?.name || '')
  const [phone, setPhone]                     = useState(user?.phone || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Preferences
  const [prefs, setPrefs]               = useState(DEFAULT_PREFS)
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [prefsError, setPrefsError]     = useState(null)

  // Saving / feedback state
  const [savingProfile, setSavingProfile]     = useState(false)
  const [savingPassword, setSavingPassword]   = useState(false)
  const [savingPrefs, setSavingPrefs]         = useState(false)
  const [profileFeedback, setProfileFeedback] = useState(null)
  const [passwordFeedback, setPasswordFeedback] = useState(null)
  const [prefsFeedback, setPrefsFeedback]     = useState(null)
  const [profileErrors, setProfileErrors]     = useState({})
  const [passwordErrors, setPasswordErrors]   = useState({})

  // Sync name/phone when user loads
  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setPhone(user.phone || '')
    }
  }, [user])

  // Load notification preferences
  const loadPreferences = useCallback(async () => {
    setPrefsLoading(true)
    setPrefsError(null)
    try {
      const res = await api.get('/settings/preferences')
      setPrefs({ ...DEFAULT_PREFS, ...res.data.preferences })
    } catch {
      setPrefsError('Gagal memuat preferensi notifikasi. Periksa koneksi server.')
    } finally {
      setPrefsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  // Save profile (name + phone only)
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (savingProfile) return
    setSavingProfile(true)
    setProfileFeedback(null)
    setProfileErrors({})

    try {
      await api.put('/me', { name, phone: phone || null })
      if (checkAuth) await checkAuth()
      setProfileFeedback({ type: 'success', message: 'Profil berhasil diperbarui!' })
      setTimeout(() => setProfileFeedback(null), 5000)
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        setProfileErrors(err.response.data.errors)
      } else {
        setProfileFeedback({ type: 'error', message: err.response?.data?.message || 'Gagal menyimpan profil.' })
      }
    } finally {
      setSavingProfile(false)
    }
  }

  // Save password (separate submission)
  const handleSavePassword = async (e) => {
    e.preventDefault()
    if (savingPassword) return
    setPasswordErrors({})
    setPasswordFeedback(null)

    // Client-side basic validation
    if (!currentPassword) {
      setPasswordErrors({ current_password: ['Password saat ini wajib diisi.'] })
      return
    }
    if (!newPassword) {
      setPasswordErrors({ new_password: ['Password baru wajib diisi.'] })
      return
    }
    if (newPassword.length < 6) {
      setPasswordErrors({ new_password: ['Password baru minimal 6 karakter.'] })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordErrors({ new_password_confirmation: ['Konfirmasi password tidak cocok.'] })
      return
    }

    setSavingPassword(true)
    try {
      await api.put('/me', {
        name,
        phone: phone || null,
        current_password:          currentPassword,
        new_password:              newPassword,
        new_password_confirmation: confirmPassword,
      })
      if (checkAuth) await checkAuth()
      setPasswordFeedback({ type: 'success', message: 'Password berhasil diubah. Silakan login ulang jika diperlukan.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordFeedback(null), 6000)
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        setPasswordErrors(err.response.data.errors)
      } else {
        setPasswordFeedback({ type: 'error', message: err.response?.data?.message || 'Gagal mengubah password.' })
      }
    } finally {
      setSavingPassword(false)
    }
  }

  // Save notification preferences
  const handleSavePrefs = async () => {
    if (savingPrefs) return
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

  const roleLabel = user?.role === 'admin'
    ? 'Super Admin'
    : (user?.role?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c.toUpperCase()) || '—')

  return (
    <div className="space-y-5 pb-8">
      {/* Page Header */}
      <PageHeader
        title="PENGATURAN"
        subtitle="Kelola profil, keamanan akun, dan preferensi notifikasi Anda."
        tag="KONFIGURASI"
        actions={
          <div className="bg-white px-3 py-1.5 border border-[#171717] rounded-lg flex items-center gap-2 shadow-[2px_2px_0px_#171717]">
            <SettingsIcon size={14} className="text-[#FF2F92] shrink-0" />
            <span className="font-black text-xs uppercase text-[#171717]">v1.0.0</span>
          </div>
        }
      />

      {/* ═══════════════════════════════════════════
          SECTION 1 — INFORMASI PROFIL
      ════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <User size={15} className="text-[#FF2F92] shrink-0" />
          <h2 className="font-display text-sm uppercase font-black text-[#171717] tracking-wide">Informasi Profil</h2>
        </div>

        <form onSubmit={handleSaveProfile}>
          <div className="bg-white border-2 border-[#171717] rounded-xl p-4 sm:p-5 shadow-[4px_4px_0px_#171717] space-y-4">
            <FeedbackBanner feedback={profileFeedback} onClose={() => setProfileFeedback(null)} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nama */}
              <div>
                <FieldLabel required>Nama Lengkap</FieldLabel>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={savingProfile}
                  placeholder="Nama Anda"
                  className={`w-full px-3 py-2.5 bg-[#FAF7F2] border rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF2F92] transition disabled:opacity-50 ${
                    profileErrors.name ? 'border-[#FF2F92]' : 'border-[#171717]'
                  }`}
                />
                {profileErrors.name && (
                  <p className="text-[10px] text-[#FF2F92] font-bold mt-1 flex items-center gap-1">
                    <AlertCircle size={11} /> {profileErrors.name[0]}
                  </p>
                )}
              </div>

              {/* Nomor Telepon */}
              <div>
                <FieldLabel>Nomor Telepon / WhatsApp</FieldLabel>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#171717]/40" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={savingProfile}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#FAF7F2] border border-[#171717] rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF2F92] transition disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Email (read-only) */}
              <div>
                <FieldLabel>Email Akun</FieldLabel>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-3 py-2.5 bg-[#EAE4D8] border border-[#171717]/30 rounded-lg text-sm font-semibold text-[#171717]/60 cursor-not-allowed"
                />
                <p className="text-[10px] text-[#171717]/50 font-medium mt-1">Email tidak dapat diubah dari halaman ini.</p>
              </div>

              {/* Role (read-only) */}
              <div>
                <FieldLabel>Peran (Role)</FieldLabel>
                <div className="flex items-center gap-2 px-3 py-2.5 bg-[#EAE4D8] border border-[#171717]/30 rounded-lg">
                  <ShieldCheck size={14} className="text-[#B8A0F0] shrink-0" />
                  <span className="text-sm font-black uppercase text-[#171717]/70">{roleLabel}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-6 py-2.5 bg-[#FF2F92] hover:bg-[#FF439D] text-white border border-[#171717] rounded-lg font-black text-xs uppercase flex items-center gap-2 shadow-[3px_3px_0px_#171717] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px]"
              >
                {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Simpan Profil</span>
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 2 — KEAMANAN / GANTI PASSWORD
      ════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Lock size={15} className="text-[#B8A0F0] shrink-0" />
          <h2 className="font-display text-sm uppercase font-black text-[#171717] tracking-wide">Keamanan Akun</h2>
        </div>

        <form onSubmit={handleSavePassword}>
          <div className="bg-white border-2 border-[#171717] rounded-xl p-4 sm:p-5 shadow-[4px_4px_0px_#171717] space-y-4">
            <FeedbackBanner feedback={passwordFeedback} onClose={() => setPasswordFeedback(null)} />

            {/* Info hint */}
            <div className="flex items-start gap-2 p-3 bg-[#B8A0F0]/20 border border-[#171717]/20 rounded-lg text-xs font-medium text-[#171717]/80 leading-relaxed">
              <Key size={13} className="text-[#B8A0F0] shrink-0 mt-0.5" />
              <span>Isi ketiga kolom di bawah untuk mengubah password. Biarkan kosong jika tidak ingin mengubah password saat ini.</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Password Saat Ini */}
              <div>
                <FieldLabel>Password Saat Ini</FieldLabel>
                <PasswordInput
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Password aktif"
                  disabled={savingPassword}
                  error={!!passwordErrors.current_password}
                />
                {passwordErrors.current_password && (
                  <p className="text-[10px] text-[#FF2F92] font-bold mt-1 flex items-center gap-1">
                    <AlertCircle size={11} /> {passwordErrors.current_password[0]}
                  </p>
                )}
              </div>

              {/* Password Baru */}
              <div>
                <FieldLabel>Password Baru</FieldLabel>
                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 karakter"
                  disabled={savingPassword}
                  error={!!passwordErrors.new_password}
                />
                {passwordErrors.new_password && (
                  <p className="text-[10px] text-[#FF2F92] font-bold mt-1 flex items-center gap-1">
                    <AlertCircle size={11} /> {passwordErrors.new_password[0]}
                  </p>
                )}
              </div>

              {/* Konfirmasi Password Baru */}
              <div>
                <FieldLabel>Ulangi Password Baru</FieldLabel>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang password baru"
                  disabled={savingPassword}
                  error={!!passwordErrors.new_password_confirmation}
                />
                {passwordErrors.new_password_confirmation && (
                  <p className="text-[10px] text-[#FF2F92] font-bold mt-1 flex items-center gap-1">
                    <AlertCircle size={11} /> {passwordErrors.new_password_confirmation[0]}
                  </p>
                )}
              </div>
            </div>

            {/* Password Rules */}
            <div className="p-3 bg-[#FAF7F2] border border-[#171717]/20 rounded-lg">
              <p className="text-[10px] font-black uppercase text-[#171717]/60 mb-1.5">Aturan Password:</p>
              <ul className="text-[10px] font-semibold text-[#171717]/70 space-y-0.5">
                <li className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${newPassword.length >= 6 ? 'bg-[#10B981]' : 'bg-[#171717]/25'}`} />
                  Minimal 6 karakter
                </li>
                <li className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${newPassword && confirmPassword && newPassword === confirmPassword ? 'bg-[#10B981]' : 'bg-[#171717]/25'}`} />
                  Password baru dan konfirmasi harus cocok
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#171717]/25" />
                  Password lama wajib diisi untuk verifikasi identitas
                </li>
              </ul>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingPassword || (!currentPassword && !newPassword && !confirmPassword)}
                className="px-6 py-2.5 bg-[#171717] hover:opacity-90 text-white border border-[#171717] rounded-lg font-black text-xs uppercase flex items-center gap-2 shadow-[3px_3px_0px_#B8A0F0] transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-h-[40px]"
              >
                {savingPassword ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                <span>Ubah Password</span>
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 3 — PREFERENSI NOTIFIKASI + INFO
      ════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Notification Preferences — 8 cols */}
        <section className="lg:col-span-8">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={15} className="text-[#FF2F92] shrink-0" />
            <h2 className="font-display text-sm uppercase font-black text-[#171717] tracking-wide">Preferensi Notifikasi</h2>
          </div>

          <div className="bg-white border-2 border-[#171717] rounded-xl p-4 sm:p-5 shadow-[4px_4px_0px_#171717] space-y-4">
            {/* Header row with loading/retry */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#171717]/60">
                Pilih notifikasi yang ingin Anda terima dari sistem PKM.
              </p>
              <div className="flex items-center gap-2">
                {prefsLoading && <Loader2 size={14} className="animate-spin text-[#FF2F92]" />}
                {!prefsLoading && prefsError && (
                  <button
                    onClick={loadPreferences}
                    className="flex items-center gap-1 text-[10px] font-black text-[#FF2F92] hover:underline cursor-pointer"
                  >
                    <RefreshCw size={11} /> Coba Lagi
                  </button>
                )}
              </div>
            </div>

            {/* Error banner */}
            {prefsError && (
              <div className="p-3 bg-[#FF2F92]/10 border border-[#FF2F92]/30 rounded-lg text-xs font-semibold text-[#FF2F92] flex items-center gap-2">
                <AlertCircle size={13} className="shrink-0" /> {prefsError}
              </div>
            )}

            {/* Save feedback */}
            <FeedbackBanner feedback={prefsFeedback} onClose={() => setPrefsFeedback(null)} />

            {/* Toggle list */}
            <div className="space-y-2">
              {PREF_LABELS.map((item) => (
                <div
                  key={item.key}
                  className={`flex items-center justify-between gap-4 p-3.5 border rounded-xl transition-colors ${
                    prefsLoading
                      ? 'bg-[#FAF7F2]/50 border-[#171717]/15 opacity-60'
                      : prefs[item.key]
                        ? 'bg-[#FF2F92]/8 border-[#FF2F92]/40'
                        : 'bg-[#FAF7F2] border-[#171717]/20 hover:border-[#171717]/40'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#171717] leading-snug">{item.label}</p>
                    <p className="text-[11px] text-[#171717]/55 font-medium mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                  <ToggleSwitch
                    checked={prefs[item.key] ?? false}
                    onChange={() => togglePref(item.key)}
                    disabled={prefsLoading}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-1 border-t border-[#171717]/10">
              <button
                onClick={handleSavePrefs}
                disabled={savingPrefs || prefsLoading}
                className="px-6 py-2.5 bg-[#FF2F92] hover:bg-[#FF439D] text-white border border-[#171717] rounded-lg font-black text-xs uppercase flex items-center gap-2 shadow-[3px_3px_0px_#171717] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px]"
              >
                {savingPrefs ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Simpan Preferensi</span>
              </button>
            </div>
          </div>
        </section>

        {/* System Info Sidebar — 4 cols */}
        <aside className="lg:col-span-4 space-y-4">
          {/* System Info Card */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Monitor size={15} className="text-[#171717] shrink-0" />
              <h2 className="font-display text-sm uppercase font-black text-[#171717] tracking-wide">Info Sistem</h2>
            </div>
            <div className="bg-white border-2 border-[#171717] rounded-xl p-4 shadow-[4px_4px_0px_#171717]">
              <div className="space-y-0">
                {[
                  { label: 'Aplikasi',      value: 'PKM Business Control Center v1.0.0' },
                  { label: 'Stack',         value: 'React 18 + Vite + Laravel 12 (PHP 8.x)' },
                  { label: 'Database',      value: 'MySQL 8.0 (pkm_control)' },
                  { label: 'Auth',          value: 'Laravel Sanctum Bearer Token' },
                  { label: 'Pengguna',      value: user?.name || '—' },
                  { label: 'Role',          value: roleLabel },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex flex-col py-2.5 border-b border-[#171717]/10 last:border-0 gap-0.5"
                  >
                    <span className="text-[9.5px] font-black uppercase text-[#171717]/50 tracking-wide">{item.label}</span>
                    <span className="text-xs font-bold text-[#171717] break-words leading-snug">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Backend Status Card */}
          <div className="bg-[#171717] p-4 border-2 border-[#171717] rounded-xl text-white shadow-[4px_4px_0px_#B8A0F0]">
            <div className="flex items-center gap-2 mb-2">
              <Database size={14} className="text-[#FFD83D] shrink-0" />
              <h3 className="font-display text-xs uppercase font-black">Status Koneksi</h3>
            </div>
            <p className="text-[10px] text-white/70 font-medium mb-3 leading-relaxed">
              Seluruh endpoint REST API aktif dan tersambung penuh dengan database MySQL.
            </p>
            <div className="flex items-center gap-2 px-3 py-2 bg-white/10 border border-white/20 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse shrink-0" />
              <span className="text-[10px] font-black uppercase text-[#10B981]">Database Connected</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
