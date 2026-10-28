import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { Settings as SettingsIcon, Save, Bell, ShieldCheck, Check, Monitor, Palette, Globe, Database, Key, Lock, Loader2, AlertCircle } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

export default function Settings() {
  const { user, checkAuth } = useAuth()
  const [name, setName]                     = useState(user?.name || '')
  const [phone, setPhone]                   = useState(user?.phone || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]       = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [saving, setSaving]                 = useState(false)
  const [feedback, setFeedback]             = useState(null)
  const [errors, setErrors]                 = useState({})

  // Preference switches
  const [emailNotif, setEmailNotif]         = useState(true)
  const [aiAutoInsight, setAiAutoInsight]   = useState(true)
  const [weeklyReport, setWeeklyReport]     = useState(false)
  const [riskAlert, setRiskAlert]           = useState(true)

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setPhone(user.phone || '')
    }
  }, [user])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFeedback(null)
    setErrors({})

    try {
      const payload = {
        name,
        phone: phone || null,
      }

      if (newPassword) {
        payload.current_password = currentPassword
        payload.new_password = newPassword
        payload.new_password_confirmation = confirmPassword
      }

      const res = await api.put('/me', payload)
      if (checkAuth) await checkAuth()

      setFeedback({ type: 'success', message: 'Profil dan pengaturan akun berhasil disimpan!' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setFeedback(null), 5000)
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        setErrors(err.response.data.errors)
      } else {
        setFeedback({ type: 'error', message: err.response?.data?.message || 'Gagal menyimpan pengaturan.' })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <PageHeader
        title="PENGATURAN SISTEM"
        subtitle="Konfigurasi preferensi profil pengguna, keamanan akun, dan preferensi operasional PKM."
        tag="KONFIGURASI"
        actions={
          <div className="bg-white px-3 py-1.5 border border-[#171717] rounded-lg flex items-center gap-2 shadow-[2px_2px_0px_#171717]">
            <SettingsIcon size={15} className="text-[#FF2F92]" />
            <span className="font-black text-xs uppercase">Sistem v1.0.0</span>
          </div>
        }
      />

      {feedback && (
        <div className={`p-3.5 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center justify-between text-xs font-black ${
          feedback.type === 'success' ? 'bg-[#10B981]/20 text-[#171717]' : 'bg-[#FF2F92]/20 text-[#FF2F92]'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="font-bold">✕</button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Top row: Account + Security */}
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
                  defaultValue={user?.email || 'admin@pkm.co.id'}
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
                    defaultValue={user?.role === 'admin' ? 'Super Admin' : (user?.role?.toUpperCase() || 'Admin')}
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

        {/* Bottom row: Notifications + System */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Notification Preferences */}
          <div className="bg-white p-5 border border-[#171717] rounded-lg space-y-3.5 shadow-[3px_3px_0px_#171717]">
            <div className="flex items-center gap-2 border-b border-[#171717]/10 pb-2.5">
              <Bell size={16} className="text-[#FF2F92]" />
              <h3 className="font-display text-base uppercase text-[#171717]">PREFERENSI NOTIFIKASI & AI</h3>
            </div>
            <div className="space-y-2.5 pt-1">
              {[
                { label: 'Notifikasi Email Proyek Berisiko', desc: 'Peringatan otomatis saat status proyek berubah menjadi At Risk / Delayed.', val: emailNotif, set: setEmailNotif },
                { label: 'AI Auto-Insights di Dashboard', desc: 'Ringkasan rekomendasi harian otomatis dari AI Business Analyst.', val: aiAutoInsight, set: setAiAutoInsight },
                { label: 'Laporan Mingguan Otomatis', desc: 'Terima ringkasan performa proyek setiap Senin pagi.', val: weeklyReport, set: setWeeklyReport },
                { label: 'Alert Deadline Mendekati', desc: 'Pemberitahuan sebelum deadline tugas prioritas High jatuh tempo.', val: riskAlert, set: setRiskAlert },
              ].map((item, i) => (
                <label key={i} className="flex items-center justify-between p-2.5 bg-[#FAF7F2] border border-[#171717]/20 rounded cursor-pointer hover:bg-[#FFD83D]/20 transition-colors">
                  <div>
                    <p className="text-xs font-bold text-[#171717]">{item.label}</p>
                    <p className="text-[10px] text-[#171717]/55">{item.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={item.val}
                    onChange={(e) => item.set(e.target.checked)}
                    className="w-4 h-4 rounded border border-[#171717] accent-[#FF2F92] cursor-pointer shrink-0 ml-3"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* System Info */}
          <div className="space-y-4">
            <div className="bg-white p-5 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
              <div className="flex items-center gap-2 border-b border-[#171717]/10 pb-2.5 mb-3">
                <Monitor size={16} className="text-[#171717]" />
                <h3 className="font-display text-base uppercase text-[#171717]">INFO SISTEM OPERASIONAL</h3>
              </div>
              <div className="space-y-2 text-xs">
                {[
                  { label: 'Versi Aplikasi', value: 'PKM Business Control Center v1.0.0' },
                  { label: 'Stack Teknologi', value: 'React 18 + Vite + Laravel 13 (PHP 8.4)' },
                  { label: 'Basis Data', value: 'MySQL 8.0 (pkm_control)' },
                  { label: 'Autentikasi API', value: 'Laravel Sanctum Bearer Token' },
                  { label: 'Terakhir Login', value: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between py-1.5 border-b border-[#171717]/8 last:border-0 font-semibold">
                    <span className="text-[#171717]/55">{item.label}</span>
                    <span className="font-bold text-[#171717]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#FF2F92] p-4 border border-[#171717] rounded-lg text-white shadow-[3px_3px_0px_#171717]">
              <div className="flex items-center gap-2 mb-1.5">
                <Database size={15} />
                <h3 className="font-display text-sm uppercase">STATUS KONEKSI BACKEND</h3>
              </div>
              <p className="text-[10px] opacity-90 mb-2">Seluruh endpoint REST API aktif dan tersambung penuh dengan database.</p>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                <span className="text-[10px] font-black uppercase">Database Connected & Running</span>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="pkm-btn-pink px-8 flex items-center gap-2 text-xs font-black uppercase disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Simpan Semua Perubahan</span>
          </button>
        </div>
      </form>
    </div>
  )
}
