import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Settings as SettingsIcon, Save, Bell, ShieldCheck, Check, Monitor, Palette, Globe, Database, Key, Lock } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

export default function Settings() {
  const { user } = useAuth()
  const [name, setName] = useState(user?.name || 'Budi Santoso')
  const [saved, setSaved] = useState(false)
  const [emailNotif, setEmailNotif] = useState(true)
  const [aiAutoInsight, setAiAutoInsight] = useState(true)
  const [weeklyReport, setWeeklyReport] = useState(false)
  const [riskAlert, setRiskAlert] = useState(true)

  const handleSave = (e) => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <PageHeader
        title="PENGATURAN SISTEM"
        subtitle="Konfigurasi preferensi profil pengguna, notifikasi risiko, dan integrasi AI PKM."
        tag="KONFIGURASI"
        actions={
          <div className="bg-white px-3 py-1.5 border border-[#171717] rounded-lg flex items-center gap-2"
               style={{ boxShadow: '2px 2px 0px #171717' }}>
            <SettingsIcon size={15} className="text-[#FF2F92]" />
            <span className="font-black text-xs uppercase">Sistem v1.0.0</span>
          </div>
        }
      />

      {saved && (
        <div className="p-3 bg-[#FFD83D] border border-[#171717] rounded-md font-bold text-xs flex items-center gap-2"
             style={{ boxShadow: '2px 2px 0px #171717' }}>
          <Check size={16} strokeWidth={3} className="text-[#171717]" />
          <span>Pengaturan dan profil berhasil diperbarui!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Top row: Account + Security */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Account Info Card */}
          <div className="bg-white p-5 border border-[#171717] rounded-lg space-y-4"
               style={{ boxShadow: '3px 3px 0px #171717' }}>
            <div className="flex items-center gap-2 border-b border-[#171717]/10 pb-2.5">
              <ShieldCheck size={16} className="text-[#FF2F92]" />
              <h3 className="font-display text-base uppercase text-[#171717]">INFORMASI AKUN</h3>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Nama Lengkap</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full pkm-input" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Alamat Email (Akun)</label>
                <input type="email" defaultValue={user?.email || 'admin@pkm.co.id'} disabled
                  className="w-full pkm-input bg-neutral-100 opacity-70 cursor-not-allowed" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Peran (Role)</label>
                  <input type="text" defaultValue={user?.role === 'admin' ? 'Super Admin' : (user?.role || 'Admin')} disabled
                    className="w-full pkm-input bg-neutral-100 opacity-70 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Instansi</label>
                  <input type="text" defaultValue="PT Potensi Karya Mandiri" disabled
                    className="w-full pkm-input bg-neutral-100 opacity-70 cursor-not-allowed" />
                </div>
              </div>
            </div>
          </div>

          {/* Security Card */}
          <div className="bg-white p-5 border border-[#171717] rounded-lg space-y-4"
               style={{ boxShadow: '3px 3px 0px #171717' }}>
            <div className="flex items-center gap-2 border-b border-[#171717]/10 pb-2.5">
              <Lock size={16} className="text-[#B8A0F0]" />
              <h3 className="font-display text-base uppercase text-[#171717]">KEAMANAN AKUN</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Password Baru</label>
                <input type="password" placeholder="••••••••••••" className="w-full pkm-input" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-[#171717] mb-1">Konfirmasi Password</label>
                <input type="password" placeholder="••••••••••••" className="w-full pkm-input" />
              </div>
              <div className="p-2.5 bg-[#EBE5FB] border border-[#171717]/20 rounded text-[10px] font-semibold text-[#171717]/70">
                <Key size={11} className="inline mr-1 text-[#B8A0F0]" />
                Kosongkan jika tidak ingin mengubah password. Minimal 8 karakter.
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row: Notifications + System */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Notification Preferences */}
          <div className="bg-white p-5 border border-[#171717] rounded-lg space-y-3.5"
               style={{ boxShadow: '3px 3px 0px #171717' }}>
            <div className="flex items-center gap-2 border-b border-[#171717]/10 pb-2.5">
              <Bell size={16} className="text-[#FF2F92]" />
              <h3 className="font-display text-base uppercase text-[#171717]">PREFERENSI NOTIFIKASI & AI</h3>
            </div>
            <div className="space-y-2.5 pt-1">
              {[
                { label: 'Notifikasi Email Proyek Berisiko', desc: 'Kirim email peringatan otomatis saat proyek masuk status At Risk.', val: emailNotif, set: setEmailNotif },
                { label: 'AI Auto-Insights di Dashboard', desc: 'Tampilkan ringkasan rekomendasi harian otomatis dari AI Business Analyst.', val: aiAutoInsight, set: setAiAutoInsight },
                { label: 'Laporan Mingguan Otomatis', desc: 'Terima ringkasan performa proyek setiap Senin pagi via email.', val: weeklyReport, set: setWeeklyReport },
                { label: 'Alert Deadline Mendekati', desc: 'Notifikasi H-3 sebelum deadline proyek atau tugas prioritas HIGH.', val: riskAlert, set: setRiskAlert },
              ].map((item, i) => (
                <label key={i} className="flex items-center justify-between p-2.5 bg-[#FAF7F2] border border-[#171717]/20 rounded cursor-pointer hover:bg-[#FFD83D]/20 transition-colors">
                  <div>
                    <p className="text-xs font-bold text-[#171717]">{item.label}</p>
                    <p className="text-[10px] text-[#171717]/55">{item.desc}</p>
                  </div>
                  <input type="checkbox" checked={item.val} onChange={(e) => item.set(e.target.checked)}
                    className="w-4 h-4 rounded border border-[#171717] accent-[#FF2F92] cursor-pointer shrink-0 ml-3" />
                </label>
              ))}
            </div>
          </div>

          {/* System Info */}
          <div className="space-y-4">
            <div className="bg-white p-5 border border-[#171717] rounded-lg"
                 style={{ boxShadow: '3px 3px 0px #171717' }}>
              <div className="flex items-center gap-2 border-b border-[#171717]/10 pb-2.5 mb-3">
                <Monitor size={16} className="text-[#171717]" />
                <h3 className="font-display text-base uppercase text-[#171717]">INFO SISTEM</h3>
              </div>
              <div className="space-y-2 text-xs">
                {[
                  { label: 'Versi Aplikasi', value: 'v1.0.0' },
                  { label: 'Framework', value: 'React 18 + Laravel 11' },
                  { label: 'Database', value: 'MySQL 8.0' },
                  { label: 'Auth', value: 'Laravel Sanctum' },
                  { label: 'Terakhir Login', value: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between py-1.5 border-b border-[#171717]/8 last:border-0 font-semibold">
                    <span className="text-[#171717]/55">{item.label}</span>
                    <span className="font-bold text-[#171717]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#FF2F92] p-4 border border-[#171717] rounded-lg text-white"
                 style={{ boxShadow: '3px 3px 0px #171717' }}>
              <div className="flex items-center gap-2 mb-1.5">
                <Database size={15} />
                <h3 className="font-display text-sm uppercase">STATUS BACKEND</h3>
              </div>
              <p className="text-[10px] opacity-80 mb-2">Semua layanan berjalan normal. Backend terhubung ke database.</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                <span className="text-[10px] font-black">API ONLINE — Port 8000</span>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button type="submit" className="pkm-btn-pink px-8">
            <Save size={14} />
            <span>Simpan Semua Perubahan</span>
          </button>
        </div>
      </form>
    </div>
  )
}
