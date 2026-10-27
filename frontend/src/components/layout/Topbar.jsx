import { useState, useRef, useEffect } from 'react'
import { Bell, Search, Sun, ChevronDown, LogOut, User, Menu, ShieldAlert, Sparkles } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Topbar({ onToggleMobile }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const menuRef = useRef(null)
  const notifRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false)
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotif(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const ROLE_LABELS = {
    admin:           'Super Admin',
    pimpinan:        'Pimpinan',
    project_manager: 'Project Manager',
    member:          'Team Member',
  }
  const displayName = user?.name || 'Andi Saputra'
  const displayRole = ROLE_LABELS[user?.role] || user?.role || 'Project Manager'
  
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header 
      className="px-4 sm:px-6 py-3 flex items-center justify-between bg-[#F5F1E9] relative z-30 select-none"
      style={{ borderBottom: '1.5px solid #171717' }}
    >
      {/* Left: Mobile Drawer Trigger + Search Bar */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        {/* Hamburger Toggle (Mobile / Tablet only) */}
        <button
          onClick={onToggleMobile}
          className="p-2 bg-white border-1.5 border-[#171717] rounded-lg hover:bg-[#FFD83D] shadow-[2px_2px_0px_#171717] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none lg:hidden cursor-pointer"
          title="Buka Menu"
        >
          <Menu size={18} strokeWidth={2.4} className="text-[#171717]" />
        </button>

        {/* Search Input Box */}
        <div className="flex-1 flex items-center gap-2.5 bg-white px-3.5 py-2 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] focus-within:ring-2 focus-within:ring-[#FF2F92] transition-all">
          <Search size={15} strokeWidth={2.4} className="text-[#171717]/60 shrink-0" />
          <input
            type="text"
            placeholder="Cari proyek, tugas prioritas, atau anggota tim..."
            className="w-full bg-transparent outline-none text-xs font-semibold text-[#171717] placeholder:text-[#171717]/40"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-black text-[#171717]/70 bg-[#F5F1E9] border border-[#171717] rounded shadow-[1px_1px_0px_#171717] whitespace-nowrap shrink-0">
            Ctrl + K
          </kbd>
        </div>
      </div>

      {/* Right Controls: Notifications, Status Badge, User Pill */}
      <div className="flex items-center gap-2 sm:gap-3 ml-3">
        {/* System Active Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#171717] rounded-md shadow-[1px_1px_0px_#171717]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] font-black uppercase tracking-wider text-[#171717]">SISTEM ONLINE</span>
        </div>

        {/* Bell Notification */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotif(!showNotif)}
            className="relative p-2 bg-white border-1.5 border-[#171717] rounded-lg hover:bg-[#FFD83D] shadow-[2px_2px_0px_#171717] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
            title="Pusat Notifikasi"
          >
            <Bell size={16} strokeWidth={2.4} className="text-[#171717]" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF2F92] text-white text-[8px] font-black rounded-full flex items-center justify-center border border-[#171717]">
              3
            </span>
          </button>

          {showNotif && (
            <div className="absolute right-0 mt-2 w-72 bg-white border-1.5 border-[#171717] rounded-lg shadow-[4px_4px_0px_#171717] p-3 z-50">
              <div className="flex items-center justify-between border-b border-[#171717]/15 pb-2 mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#171717]">Notifikasi Sistem</span>
                <span className="text-[9px] font-black px-1.5 py-0.5 bg-[#FFD83D] border border-[#171717] rounded">3 Baru</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2 bg-[#F5F1E9] border border-[#171717]/30 rounded">
                  <p className="font-bold text-[#171717]">Sprint Review Dimulai</p>
                  <p className="text-[10px] text-[#171717]/70">Fase 3 PKM Mobile App siap ditinjau.</p>
                </div>
                <div className="p-2 bg-[#F5F1E9] border border-[#171717]/30 rounded">
                  <p className="font-bold text-[#171717]">Risiko Baru Terdeteksi</p>
                  <p className="text-[10px] text-[#171717]/70">AI menandai 1 proyek membutuhkan perhatian.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Pill Profile */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 bg-white border-1.5 border-[#171717] rounded-lg hover:bg-[#FFD83D]/40 shadow-[2px_2px_0px_#171717] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            <div className="w-7 h-7 rounded-md bg-[#171717] flex items-center justify-center text-white font-black text-[11px] shrink-0 border border-[#171717]">
              {initials}
            </div>

            <div className="text-left hidden sm:block">
              <p className="text-[11px] font-black text-[#171717] leading-tight">{displayName}</p>
              <p className="text-[9px] font-bold text-[#171717]/60 leading-tight uppercase tracking-wide">{displayRole}</p>
            </div>

            <ChevronDown size={14} className="text-[#171717] ml-0.5" />
          </button>

          {/* Profile Dropdown Popover */}
          {showMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-white border-1.5 border-[#171717] rounded-lg shadow-[4px_4px_0px_#171717] p-2 z-50">
              <div className="px-3 py-2 border-b border-[#171717]/15 mb-1.5 bg-[#F5F1E9] rounded-md">
                <p className="text-xs font-black text-[#171717]">{displayName}</p>
                <p className="text-[10px] text-[#171717]/60 truncate font-semibold">{user?.email || 'admin@pkm.co.id'}</p>
                <span className="inline-block mt-1 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider bg-[#FF2F92] text-white rounded">
                  {displayRole}
                </span>
              </div>

              <button
                onClick={() => { setShowMenu(false); navigate('/settings') }}
                className="w-full text-left px-3 py-2 text-xs font-bold text-[#171717] hover:bg-[#FFD83D] rounded-md flex items-center gap-2 cursor-pointer transition-colors"
              >
                <User size={14} />
                <span>Pengaturan Profil</span>
              </button>

              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-xs font-bold text-[#FF2F92] hover:bg-pink-50 rounded-md flex items-center gap-2 cursor-pointer transition-colors mt-1"
              >
                <LogOut size={14} />
                <span>Keluar (Logout)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
