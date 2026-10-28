import { useState, useRef, useEffect } from 'react'
import { 
  Bell, 
  Search, 
  ChevronDown, 
  LogOut, 
  User, 
  Menu, 
  X, 
  FolderKanban, 
  CheckSquare, 
  Users, 
  Loader2, 
  Check, 
  ArrowRight,
  Sparkles,
  ExternalLink
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

export default function Topbar({ onToggleMobile }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Dropdown states
  const [showMenu, setShowMenu] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const menuRef = useRef(null)
  const notifRef = useRef(null)

  // Search Modal state
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0)
  const searchInputRef = useRef(null)

  // Notifications state
  const [activities, setActivities] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadingNotifs, setLoadingNotifs] = useState(false)

  // Fetch real activities for notification panel
  const fetchNotifications = async () => {
    try {
      setLoadingNotifs(true)
      const res = await api.get('/activities')
      const items = res.data.activities?.data || res.data.activities || []
      setActivities(items.slice(0, 8))

      const lastRead = localStorage.getItem('pkm_last_read_activity')
      if (lastRead) {
        const lastReadDate = new Date(lastRead)
        const unread = items.filter(a => a.created_at && new Date(a.created_at) > lastReadDate)
        setUnreadCount(unread.length)
      } else {
        // No read timestamp → badge menunjukkan jumlah item dari hari ini (jujur)
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todayItems = items.filter(a => a.created_at && new Date(a.created_at) >= todayStart)
        setUnreadCount(todayItems.length)
      }
    } catch {
      console.error('Failed to load notifications')
    } finally {
      setLoadingNotifs(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  const markAllAsRead = () => {
    localStorage.setItem('pkm_last_read_activity', new Date().toISOString())
    setUnreadCount(0)
  }

  // Handle global keyboard shortcuts: Ctrl+K / Cmd+K and Escape
  useEffect(() => {
    function handleKeyDown(e) {
      // Escape closes open modals & menus
      if (e.key === 'Escape') {
        if (isSearchOpen) setIsSearchOpen(false)
        if (showMenu) setShowMenu(false)
        if (showNotif) setShowNotif(false)
        return
      }

      // Ctrl+K / Cmd+K opens search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsSearchOpen(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearchOpen, showMenu, showNotif])

  // Click outside listener for dropdowns
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

  // Focus input when search modal opens
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
      setSearchSelectedIndex(0)
    }
  }, [isSearchOpen])

  // Debounced search query
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults(null)
      setIsSearching(false)
      return
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true)
        const res = await api.get(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
        setSearchResults(res.data)
        setSearchSelectedIndex(0)
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setIsSearching(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Flattened search items for keyboard up/down selection
  const flatSearchItems = []
  if (searchResults) {
    (searchResults.projects || []).forEach(p => flatSearchItems.push({ type: 'project', data: p }))
    (searchResults.tasks || []).forEach(t => flatSearchItems.push({ type: 'task', data: t }))
    (searchResults.team || []).forEach(u => flatSearchItems.push({ type: 'team', data: u }))
  }

  const handleSearchKeyDown = (e) => {
    if (flatSearchItems.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSearchSelectedIndex(prev => (prev + 1) % flatSearchItems.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSearchSelectedIndex(prev => (prev - 1 + flatSearchItems.length) % flatSearchItems.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = flatSearchItems[searchSelectedIndex]
      if (selected) handleSelectSearchResult(selected)
    }
  }

  const handleSelectSearchResult = (item) => {
    setIsSearchOpen(false)
    setSearchQuery('')
    if (item.type === 'project') {
      navigate(`/projects?search=${encodeURIComponent(item.data.name)}`)
    } else if (item.type === 'task') {
      navigate(`/tasks?search=${encodeURIComponent(item.data.title)}`)
    } else if (item.type === 'team') {
      navigate(`/team`)
    }
  }

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
  const displayName = user?.name || 'Budi Santoso'
  const displayRole = ROLE_LABELS[user?.role] || user?.role || 'Team Member'
  
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'PK'

  return (
    <>
      <header 
        className="px-4 sm:px-6 py-3 flex items-center justify-between bg-[#F5F1E9] relative z-30 select-none shrink-0"
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

          {/* Interactive Search Bar Trigger */}
          <div 
            onClick={() => setIsSearchOpen(true)}
            className="flex-1 flex items-center gap-2.5 bg-white px-3.5 py-2 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] hover:border-[#FF2F92] transition-all cursor-pointer"
          >
            <Search size={15} strokeWidth={2.4} className="text-[#171717]/60 shrink-0" />
            <span className="w-full text-xs font-semibold text-[#171717]/50 select-none truncate">
              Cari proyek, tugas, atau anggota tim...
            </span>
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

          {/* Bell Notification Dropdown */}
          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => {
                setShowNotif(!showNotif)
                if (!showNotif && unreadCount > 0) markAllAsRead()
              }}
              className="relative p-2 bg-white border-1.5 border-[#171717] rounded-lg hover:bg-[#FFD83D] shadow-[2px_2px_0px_#171717] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
              title="Pusat Notifikasi"
            >
              <Bell size={16} strokeWidth={2.4} className="text-[#171717]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF2F92] text-white text-[8px] font-black rounded-full flex items-center justify-center border border-[#171717] animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotif && (
              <div className="absolute right-0 mt-2 w-80 bg-white border-2 border-[#171717] rounded-lg shadow-[4px_4px_0px_#171717] p-3.5 z-50">
                <div className="flex items-center justify-between border-b border-[#171717]/15 pb-2 mb-2.5">
                  <span className="text-xs font-black uppercase tracking-wider text-[#171717]">Notifikasi Aktivitas</span>
                  {unreadCount > 0 ? (
                    <button
                      onClick={markAllAsRead}
                      className="text-[9px] font-black px-1.5 py-0.5 bg-[#FFD83D] border border-[#171717] rounded hover:bg-[#ffe26e] cursor-pointer"
                    >
                      Tandai Dibaca
                    </button>
                  ) : (
                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-[#FAF7F2] text-[#171717]/60 border border-[#171717]/30 rounded">
                      Semua Terbaca
                    </span>
                  )}
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {loadingNotifs ? (
                    <div className="py-6 flex flex-col items-center justify-center gap-1.5 text-xs text-[#171717]/60 font-bold">
                      <Loader2 size={16} className="animate-spin text-[#FF2F92]" />
                      <span>Memuat notifikasi...</span>
                    </div>
                  ) : activities.length === 0 ? (
                    <p className="py-6 text-center text-xs text-[#171717]/50 font-bold">
                      Belum ada notifikasi baru.
                    </p>
                  ) : (
                    activities.map((act) => (
                      <div 
                        key={act.id} 
                        className="p-2 bg-[#FAF7F2] border border-[#171717]/30 rounded hover:bg-[#FFF0F8] transition-colors"
                      >
                        <p className="font-bold text-xs text-[#171717] leading-tight">
                          <strong className="text-[#FF2F92]">{act.user_name}</strong> {act.action}
                        </p>
                        <p className="text-[10px] text-[#171717]/60 mt-0.5 flex items-center justify-between">
                          <span className="truncate max-w-[160px] font-semibold">{act.project_name || 'PKM Project'}</span>
                          <span className="shrink-0">{act.created_at ? new Date(act.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Hari ini'}</span>
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-2.5 pt-2 border-t border-[#171717]/10 flex items-center justify-between text-[10px]">
                  <button
                    onClick={() => { setShowNotif(false); navigate('/reports') }}
                    className="text-[#FF2F92] font-black hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Buka Semua Laporan</span>
                    <ArrowRight size={11} />
                  </button>
                  <button
                    onClick={() => setShowNotif(false)}
                    className="text-[#171717]/50 hover:text-[#171717] font-bold cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Menu Pill */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 bg-white border-1.5 border-[#171717] rounded-lg hover:bg-[#FFD83D]/40 shadow-[2px_2px_0px_#171717] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-md bg-[#171717] flex items-center justify-center text-white font-black text-[11px] shrink-0 border border-[#171717]">
                {initials}
              </div>

              <div className="text-left hidden sm:block">
                <p className="text-[11px] font-black text-[#171717] leading-tight truncate max-w-[120px]">{displayName}</p>
                <p className="text-[9px] font-bold text-[#171717]/60 leading-tight uppercase tracking-wide">{displayRole}</p>
              </div>

              <ChevronDown size={14} className="text-[#171717] ml-0.5" />
            </button>

            {/* Profile Dropdown Popover */}
            {showMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white border-2 border-[#171717] rounded-lg shadow-[4px_4px_0px_#171717] p-2 z-50">
                <div className="px-3 py-2 border-b border-[#171717]/15 mb-1.5 bg-[#F5F1E9] rounded-md">
                  <p className="text-xs font-black text-[#171717] truncate">{displayName}</p>
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

      {/* GLOBAL SEARCH MODAL / COMMAND PALETTE (CTRL + K) */}
      {isSearchOpen && (
        <div 
          className="fixed inset-0 z-50 bg-[#171717]/65 backdrop-blur-[2px] flex items-start justify-center pt-16 sm:pt-24 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSearchOpen(false)
          }}
        >
          <div className="bg-[#FAF7F2] border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#171717] w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Search Input Bar */}
            <div className="p-3.5 bg-white border-b-2 border-[#171717] flex items-center gap-3">
              <Search size={18} className="text-[#FF2F92] shrink-0" strokeWidth={2.5} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Cari nama proyek, kode PKM, tugas, atau anggota tim..."
                className="w-full bg-transparent text-sm font-bold text-[#171717] placeholder:text-[#171717]/40 outline-none"
              />
              {isSearching ? (
                <Loader2 size={16} className="animate-spin text-[#FF2F92] shrink-0" />
              ) : searchQuery ? (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-[#171717]/50 hover:text-[#171717] cursor-pointer"
                >
                  <X size={15} />
                </button>
              ) : null}
              <kbd className="text-[10px] font-black uppercase px-2 py-0.5 bg-[#F5F1E9] border border-[#171717] rounded shadow-[1px_1px_0px_#171717] text-[#171717]/70 shrink-0">
                ESC
              </kbd>
            </div>

            {/* Results Body */}
            <div className="max-h-96 overflow-y-auto p-3 space-y-3">
              {!searchQuery.trim() ? (
                <div className="py-8 text-center text-xs font-semibold text-[#171717]/60 space-y-2">
                  <p className="font-display text-sm uppercase text-[#171717]">Pencarian Global PKM Control Center</p>
                  <p>Ketik kata kunci untuk mencari data proyek, tugas operasional, atau personil tim.</p>
                  <div className="flex justify-center gap-2 pt-2">
                    <button 
                      onClick={() => setSearchQuery('website')}
                      className="px-2 py-1 bg-white border border-[#171717] rounded text-[10px] font-black uppercase hover:bg-[#FFD83D]"
                    >
                      Website
                    </button>
                    <button 
                      onClick={() => setSearchQuery('aplikasi')}
                      className="px-2 py-1 bg-white border border-[#171717] rounded text-[10px] font-black uppercase hover:bg-[#FFD83D]"
                    >
                      Aplikasi
                    </button>
                    <button 
                      onClick={() => setSearchQuery('PKM')}
                      className="px-2 py-1 bg-white border border-[#171717] rounded text-[10px] font-black uppercase hover:bg-[#FFD83D]"
                    >
                      PKM
                    </button>
                  </div>
                </div>
              ) : isSearching ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs font-bold text-[#171717]/70">
                  <Loader2 size={24} className="animate-spin text-[#FF2F92]" />
                  <span>Mencari di database MySQL...</span>
                </div>
              ) : searchResults && searchResults.total === 0 ? (
                <div className="py-8 text-center text-xs font-semibold text-[#171717]/60">
                  <p className="font-display text-sm uppercase text-[#171717]">Tidak Ada Hasil</p>
                  <p className="mt-1">Tidak ditemukan data yang cocok dengan "{searchQuery}".</p>
                </div>
              ) : searchResults ? (
                <div className="space-y-3">
                  {/* Proyek Results */}
                  {searchResults.projects && searchResults.projects.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase text-[#171717]/60 tracking-wider mb-1.5 flex items-center gap-1.5">
                        <FolderKanban size={13} className="text-[#FF2F92]" /> Proyek Bisnis ({searchResults.projects.length})
                      </p>
                      <div className="space-y-1">
                        {searchResults.projects.map((p) => {
                          const itemIndex = flatSearchItems.findIndex(it => it.type === 'project' && it.data.id === p.id)
                          const isSelected = itemIndex === searchSelectedIndex

                          return (
                            <div
                              key={p.id}
                              onClick={() => handleSelectSearchResult({ type: 'project', data: p })}
                              className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                                isSelected
                                  ? 'bg-[#FF2F92] text-white border-[#171717] shadow-[2px_2px_0px_#171717]'
                                  : 'bg-white text-[#171717] border-[#171717]/20 hover:border-[#171717] hover:bg-[#FAF7F2]'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-black text-xs truncate leading-tight">{p.name}</p>
                                <p className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-white/80' : 'text-[#171717]/60'}`}>
                                  {p.code} • Klien: {p.client} • Progres: {p.progress}%
                                </p>
                              </div>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                                isSelected ? 'bg-white text-[#171717] border-white' : 'bg-[#FAF7F2] border-[#171717]'
                              }`}>
                                {p.status}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tugas Results */}
                  {searchResults.tasks && searchResults.tasks.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase text-[#171717]/60 tracking-wider mb-1.5 flex items-center gap-1.5">
                        <CheckSquare size={13} className="text-[#B8A0F0]" /> Tugas Operasional ({searchResults.tasks.length})
                      </p>
                      <div className="space-y-1">
                        {searchResults.tasks.map((t) => {
                          const itemIndex = flatSearchItems.findIndex(it => it.type === 'task' && it.data.id === t.id)
                          const isSelected = itemIndex === searchSelectedIndex

                          return (
                            <div
                              key={t.id}
                              onClick={() => handleSelectSearchResult({ type: 'task', data: t })}
                              className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                                isSelected
                                  ? 'bg-[#FF2F92] text-white border-[#171717] shadow-[2px_2px_0px_#171717]'
                                  : 'bg-white text-[#171717] border-[#171717]/20 hover:border-[#171717] hover:bg-[#FAF7F2]'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-black text-xs truncate leading-tight">{t.title}</p>
                                <p className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-white/80' : 'text-[#171717]/60'}`}>
                                  Proyek: {t.project?.name || '-'} • PIC: {t.assignee_name || '-'}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
                                  isSelected ? 'bg-white text-[#171717] border-white' : 'bg-[#FFD83D] text-[#171717] border-[#171717]'
                                }`}>
                                  {t.priority}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tim Results */}
                  {searchResults.team && searchResults.team.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase text-[#171717]/60 tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Users size={13} className="text-[#FFD83D]" /> Anggota Tim ({searchResults.team.length})
                      </p>
                      <div className="space-y-1">
                        {searchResults.team.map((u) => {
                          const itemIndex = flatSearchItems.findIndex(it => it.type === 'team' && it.data.id === u.id)
                          const isSelected = itemIndex === searchSelectedIndex

                          return (
                            <div
                              key={u.id}
                              onClick={() => handleSelectSearchResult({ type: 'team', data: u })}
                              className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                                isSelected
                                  ? 'bg-[#FF2F92] text-white border-[#171717] shadow-[2px_2px_0px_#171717]'
                                  : 'bg-white text-[#171717] border-[#171717]/20 hover:border-[#171717] hover:bg-[#FAF7F2]'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-black text-xs truncate leading-tight">{u.name}</p>
                                <p className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-white/80' : 'text-[#171717]/60'}`}>
                                  {u.email} • {u.phone || 'No Phone'}
                                </p>
                              </div>
                              <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded border ${
                                isSelected ? 'bg-white text-[#171717] border-white' : 'bg-[#B8A0F0] text-[#171717] border-[#171717]'
                              }`}>
                                {u.role}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Footer tips */}
            <div className="px-4 py-2.5 bg-[#FAF7F2] border-t border-[#171717]/15 flex items-center justify-between text-[10px] font-bold text-[#171717]/60">
              <span className="flex items-center gap-2">
                <span>↑↓ Pilih</span>
                <span>↵ Buka</span>
                <span>ESC Tutup</span>
              </span>
              <span>PKM Global Search v1.0</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
