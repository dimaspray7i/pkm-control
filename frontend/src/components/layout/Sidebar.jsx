import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../services/api'
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Terminal,
  Sparkles,
  Users,
  FileBarChart,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Target,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  X,
  Compass,
  TrendingUp,
  Zap,
  CalendarDays,
  Bell,
  ChartNoAxesCombined,
  GraduationCap
} from 'lucide-react'

// Konfigurasi Navigasi Terpisah Berdasarkan Role (Tahap P-I: Full Indonesian Localization)
const ROLE_NAV_CONFIG = {
  admin: [
    {
      category: 'DASHBOARD UTAMA',
      items: [
        { path: '/', label: 'Pusat Kontrol Utama', icon: LayoutDashboard },
      ]
    },
    {
      category: 'MANAJEMEN OPERASIONAL',
      items: [
        { path: '/projects', label: 'Daftar Proyek', icon: FolderKanban },
        { path: '/tasks', label: 'Manajemen Tugas', icon: CheckSquare },
        { path: '/development', label: 'Pelacak Sprint & Milestone', icon: Terminal },
      ]
    },
    {
      category: 'TIM & PENGGUNA',
      items: [
        { path: '/team', label: 'Manajemen Tim', icon: Users },
        { path: '/users', label: 'Manajemen Pengguna', icon: ShieldCheck },
      ]
    },
    {
      category: 'EKSEKUTIF & ANALITIK',
      items: [
        { path: '/executive-actions', label: 'Pusat Tindakan Eksekutif', icon: Zap },
        { path: '/portfolio', label: 'Portofolio Strategis', icon: FolderKanban },
        { path: '/performance', label: 'Kinerja Bisnis & KPI', icon: Activity },
        { path: '/financial', label: 'Kinerja Keuangan', icon: TrendingUp },
        { path: '/strategic-objectives', label: 'Sasaran Strategis (OKR)', icon: Target },
        { path: '/strategic-initiatives', label: 'Inisiatif & Alokasi Sumber Daya', icon: Compass },
        { path: '/executive-reports', label: 'Laporan Eksekutif', icon: FileBarChart },
        { path: '/reports', label: 'Laporan Operasional', icon: FileBarChart },
        { path: '/ai-advisor', label: 'Penasihat Eksekutif AI', icon: Sparkles, badge: 'AI' },
        { path: '/ai-analyst', label: 'Analis Bisnis AI', icon: Sparkles },
        { path: '/settings', label: 'Pengaturan Sistem', icon: Settings },
      ]
    }
  ],

  pimpinan: [
    {
      category: 'PUSAT KENDALI EKSEKUTIF',
      items: [
        { path: '/', label: 'Pusat Kendali Eksekutif', icon: LayoutDashboard },
        { path: '/executive-actions', label: 'Pusat Tindakan Eksekutif', icon: Zap },
        { path: '/portfolio', label: 'Portofolio Strategis', icon: FolderKanban },
        { path: '/strategic-objectives', label: 'Sasaran Strategis (OKR)', icon: Target },
        { path: '/strategic-initiatives', label: 'Inisiatif & Alokasi Sumber Daya', icon: Compass },
      ]
    },
    {
      category: 'STRATEGI & ANALITIK BISNIS',
      items: [
        { path: '/performance', label: 'Kinerja Bisnis & KPI', icon: Activity },
        { path: '/financial', label: 'Kinerja Keuangan', icon: TrendingUp },
        { path: '/risk-center', label: 'Pusat Risiko & Keputusan', icon: ShieldAlert },
        { path: '/executive-reports', label: 'Laporan Eksekutif', icon: FileBarChart },
        { path: '/reports', label: 'Laporan Operasional', icon: FileBarChart },
        { path: '/ai-advisor', label: 'Penasihat Eksekutif AI', icon: Sparkles, badge: 'AI' },
      ]
    },
    {
      category: 'PENGATURAN',
      items: [
        { path: '/settings', label: 'Pengaturan Sistem', icon: Settings },
      ]
    }
  ],
  project_manager: [
    {
      category: 'RUANG KERJA PM',
      items: [
        { path: '/', label: 'Ruang Kerja Saya', icon: LayoutDashboard },
        { path: '/executive-actions', label: 'Tindakan Eksekutif', icon: Zap },
      ]
    },
    {
      category: 'EKSEKUSI PROYEK',
      items: [
        { path: '/projects', label: 'Proyek Saya', icon: FolderKanban },
        { path: '/tasks', label: 'Distribusi Tugas', icon: CheckSquare },
        { path: '/development', label: 'Sprint & Milestone', icon: Terminal },
      ]
    },
    {
      category: 'TIM & EVALUASI',
      items: [
        { path: '/team', label: 'Beban Kerja Tim', icon: Users },
        { path: '/reports', label: 'Laporan Proyek', icon: FileBarChart },
        { path: '/ai-analyst', label: 'Asisten Proyek AI', icon: Sparkles, badge: 'AI' },
      ]
    },
    {
      category: 'PENGATURAN',
      items: [
        { path: '/settings', label: 'Pengaturan Sistem', icon: Settings },
      ]
    }
  ],
  member: [
    {
      category: 'WORKSPACE SAYA',
      items: [
        { path: '/tasks', label: 'Workspace Saya', icon: LayoutDashboard },
        { path: '/member/calendar', label: 'Kalender Kerja', icon: CalendarDays },
        { path: '/member/notifications', label: 'Notifikasi', icon: Bell, badgeKey: 'unread_notifications' },
        { path: '/member/performance', label: 'Performa Saya', icon: ChartNoAxesCombined },
        { path: '/member/learning', label: 'Pengembangan Diri', icon: GraduationCap },
      ]
    },
    {
      category: 'PENGATURAN',
      items: [
        { path: '/settings', label: 'Pengaturan Akun', icon: Settings },
      ]
    }
  ]
}

const ROLE_DISPLAY_NAMES = {
  admin: 'Administrator Sistem',
  pimpinan: 'Pimpinan Perusahaan',
  project_manager: 'Manajer Proyek',
  member: 'Anggota Tim'
}

export default function Sidebar({ mobileOpen = false, setMobileOpen }) {
  const location = useLocation()
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)

  const role = user?.role || 'member'
  const navSections = ROLE_NAV_CONFIG[role] || ROLE_NAV_CONFIG.member
  const homePath = role === 'member' ? '/tasks' : '/'

  useEffect(() => {
    if (role !== 'member') return

    const loadUnread = async () => {
      try {
        const res = await api.get('/member/notifications/summary')
        if (res.data?.unread !== undefined) {
          setUnreadNotifCount(res.data.unread)
        }
      } catch (e) {
        // silently ignore error on sidebar badge
      }
    }

    loadUnread()

    const handleUpdate = (e) => {
      if (e.detail?.unread !== undefined) {
        setUnreadNotifCount(e.detail.unread)
      } else {
        loadUnread()
      }
    }

    window.addEventListener('notification-updated', handleUpdate)
    return () => window.removeEventListener('notification-updated', handleUpdate)
  }, [role])

  const handleLinkClick = () => {
    if (setMobileOpen) setMobileOpen(false)
  }

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen && setMobileOpen(false)}
          className="fixed inset-0 bg-[#171717]/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container: Fixed/Sticky on Desktop, Drawer on Mobile */}
      <aside
        className={`shrink-0 transition-all duration-200 flex flex-col justify-between select-none z-40 h-screen ${
          mobileOpen
            ? 'fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl bg-[#F5F1E9] flex'
            : 'hidden lg:flex lg:sticky lg:top-0'
        } ${
          collapsed ? 'lg:w-[72px]' : 'lg:w-[240px]'
        }`}
        style={{
          borderRight: '1.5px solid #171717',
          backgroundColor: '#F5F1E9',
        }}
      >
        {/* Top Header Logo */}
        <div className="shrink-0 px-3.5 sm:px-4 py-3.5 sm:py-4 flex items-center justify-between border-b-1.5 border-[#171717] bg-white">
          {(!collapsed || mobileOpen) ? (
            <div className="flex items-center justify-between w-full">
              <Link to={homePath} className="flex items-center gap-2 text-decoration-none" onClick={handleLinkClick}>
                <div className="flex items-baseline">
                  <span className="font-display text-2xl sm:text-3xl tracking-tight leading-none text-[#171717]">
                    PKM
                  </span>
                  <span className="w-2.5 h-2.5 bg-[#FF2F92] ml-1 mb-0.5 border border-[#171717] inline-block"></span>
                </div>
                <div className="h-5 w-[1px] bg-[#171717]/25"></div>
                <p className="text-[8.5px] font-black tracking-[0.18em] text-[#171717] uppercase leading-tight">
                  CONTROL<br />CENTER
                </p>
              </Link>

              {/* Mobile Close Button with Comfortable Touch Target */}
              {mobileOpen && (
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-[#171717] hover:bg-[#FFD83D] active:bg-[#FF2F92] active:text-white border border-[#171717] rounded-md shadow-[1px_1px_0px_#171717] lg:hidden cursor-pointer transition-colors"
                  title="Tutup Menu Navigasi"
                  aria-label="Tutup Menu Navigasi"
                >
                  <X size={18} strokeWidth={2.4} />
                </button>
              )}
            </div>
          ) : (
            <Link to={homePath} className="mx-auto flex items-baseline" onClick={handleLinkClick} title="PKM Control Center">
              <span className="font-display text-2xl text-[#171717]">PKM</span>
              <span className="w-2 h-2 bg-[#FF2F92] ml-0.5 border border-[#171717] inline-block"></span>
            </Link>
          )}
        </div>

        {/* Role Identity Indicator */}
        {(!collapsed || mobileOpen) && (
          <div className="px-3 pt-2.5 pb-1 shrink-0">
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-white/70 border border-[#171717]/40 rounded-md">
              <span className="text-[8.5px] font-black tracking-wider text-[#171717]/60 uppercase">ROLE</span>
              <span className="text-[9px] font-black tracking-wider uppercase px-1.5 py-0.5 bg-[#FFD83D] text-[#171717] border border-[#171717] rounded">
                {ROLE_DISPLAY_NAMES[role] || role}
              </span>
            </div>
          </div>
        )}

        {/* Navigation Sections with Independent Scroll & Touch Targets */}
        <nav className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3.5">
          {navSections.map((sec, idx) => (
            <div key={idx} className="space-y-1">
              {(!collapsed || mobileOpen) && (
                <p className="px-2 text-[9px] font-black tracking-widest text-[#171717]/50 uppercase mb-1">
                  {sec.category}
                </p>
              )}

              <ul className="space-y-1">
                {sec.items.map((item) => {
                  const Icon = item.icon
                  const isActive = item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.path)
                  const isCollapsedDesktop = collapsed && !mobileOpen
                  const badgeValue = item.badgeKey === 'unread_notifications'
                    ? (unreadNotifCount > 0 ? (unreadNotifCount > 99 ? '99+' : unreadNotifCount) : null)
                    : item.badge

                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        onClick={handleLinkClick}
                        title={isCollapsedDesktop ? item.label : undefined}
                        aria-current={isActive ? 'page' : undefined}
                        className={`relative flex items-center min-h-[42px] font-bold text-xs uppercase tracking-wider transition-all rounded-lg overflow-hidden ${
                          isCollapsedDesktop
                            ? 'justify-center px-0 py-2'
                            : 'gap-2.5 px-3 py-2.5'
                        } ${
                          isActive
                            ? 'bg-[#FF2F92] text-white border-1.5 border-[#171717] shadow-[2px_2px_0px_#171717] translate-x-0.5'
                            : 'text-[#171717] hover:bg-white hover:border-1.5 hover:border-[#171717] hover:shadow-[2px_2px_0px_#171717] border-1.5 border-transparent'
                        }`}
                      >
                        <div className="relative">
                          <Icon size={17} strokeWidth={2.4} className="shrink-0" />
                          {isCollapsedDesktop && item.badgeKey === 'unread_notifications' && unreadNotifCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#FF2F92] border border-[#171717] rounded-full" />
                          )}
                        </div>
                        {!isCollapsedDesktop && (
                          <span className="truncate flex-1 text-[11px] font-bold tracking-wide">
                            {item.label}
                          </span>
                        )}
                        {!isCollapsedDesktop && badgeValue && (
                          <span className={`px-1.5 py-0.2 text-[8px] font-black border border-[#171717] rounded-sm shrink-0 ${
                            item.badgeKey === 'unread_notifications'
                              ? 'bg-[#FF2F92] text-white'
                              : 'bg-[#FFD83D] text-[#171717]'
                          }`}>
                            {badgeValue}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="shrink-0 p-3 border-t-1.5 border-[#171717] bg-white">
          <div className="flex items-center justify-between text-xs font-bold text-[#171717]">
            {(!collapsed || mobileOpen) ? (
              <div className="truncate pr-1">
                <p className="font-black text-[10px] uppercase leading-tight text-[#171717] truncate">
                  PT Potensi Karya Mandiri
                </p>
                <p className="text-[9px] font-semibold text-[#171717]/60">
                  Business Control • v1.0
                </p>
              </div>
            ) : (
              <span className="text-[9px] font-black text-[#171717] mx-auto">v1.0</span>
            )}

            {/* Desktop Collapse Toggle */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-1.5 min-w-[32px] min-h-[32px] items-center justify-center bg-[#F5F1E9] border border-[#171717] hover:bg-[#FFD83D] transition-all cursor-pointer rounded-md shadow-[1px_1px_0px_#171717]"
              title={collapsed ? "Perluas menu (Desktop)" : "Ciutkan menu (Desktop)"}
              aria-label={collapsed ? "Perluas menu" : "Ciutkan menu"}
            >
              {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
