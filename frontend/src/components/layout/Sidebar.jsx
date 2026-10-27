import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { 
  LayoutDashboard, 
  FolderKanban, 
  CheckSquare, 
  Terminal, 
  Sparkles, 
  Users, 
  FileBarChart, 
  ShieldCheck, 
  Settings,
  ChevronsLeft,
  ChevronsRight,
  X,
  Building2
} from 'lucide-react'

const MENU_SECTIONS = [
  {
    category: 'UTAMA',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: null },
    ]
  },
  {
    category: 'MANAJEMEN PROYEK',
    items: [
      { path: '/projects', label: 'Proyek Bisnis', icon: FolderKanban, roles: null },
      { path: '/tasks', label: 'Daftar Tugas', icon: CheckSquare, roles: null },
      { path: '/development', label: 'Sprint Tracker', icon: Terminal, roles: null },
    ]
  },
  {
    category: 'ANALITIK & AI',
    items: [
      { path: '/ai-analyst', label: 'AI Business Analyst', icon: Sparkles, roles: ['admin', 'pimpinan', 'project_manager'], badge: 'AI' },
      { path: '/reports', label: 'Laporan & Metrik', icon: FileBarChart, roles: ['admin', 'pimpinan', 'project_manager'] },
    ]
  },
  {
    category: 'TIM & PENGATURAN',
    items: [
      { path: '/team', label: 'Anggota Tim', icon: Users, roles: null },
      { path: '/users', label: 'Kelola Pengguna', icon: ShieldCheck, roles: ['admin'] },
      { path: '/settings', label: 'Pengaturan Sistem', icon: Settings, roles: null },
    ]
  }
]

export default function Sidebar({ mobileOpen = false, setMobileOpen }) {
  const location = useLocation()
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const role = user?.role || 'member'

  const handleLinkClick = () => {
    if (setMobileOpen) setMobileOpen(false)
  }

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen && setMobileOpen(false)}
          className="fixed inset-0 bg-[#171717]/60 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`shrink-0 transition-all duration-200 flex flex-col justify-between select-none z-50 ${
          mobileOpen 
            ? 'fixed inset-y-0 left-0 w-64 shadow-2xl bg-[#F5F1E9] flex' 
            : 'hidden lg:flex'
        } ${
          collapsed ? 'lg:w-[72px]' : 'lg:w-[240px]'
        }`}
        style={{ 
          borderRight: '1.5px solid #171717',
          backgroundColor: '#F5F1E9',
          minHeight: '100vh'
        }}
      >
        {/* Top Header Logo */}
        <div className="flex flex-col">
          <div className="px-4 py-4 flex items-center justify-between border-b-1.5 border-[#171717] bg-white">
            {(!collapsed || mobileOpen) ? (
              <div className="flex items-center justify-between w-full">
                <Link to="/" className="flex items-center gap-2 text-decoration-none">
                  <div className="flex items-baseline">
                    <span className="font-display text-3xl tracking-tight leading-none text-[#171717]">
                      PKM
                    </span>
                    <span className="w-2.5 h-2.5 bg-[#FF2F92] ml-1 mb-0.5 border border-[#171717] inline-block"></span>
                  </div>
                  <div className="h-5 w-[1px] bg-[#171717]/25"></div>
                  <p className="text-[8.5px] font-black tracking-[0.18em] text-[#171717] uppercase leading-tight">
                    CONTROL<br />CENTER
                  </p>
                </Link>

                {/* Mobile Close Button */}
                {mobileOpen && (
                  <button 
                    onClick={() => setMobileOpen(false)}
                    className="p-1 text-[#171717] hover:bg-[#FFD83D] border border-[#171717] rounded lg:hidden cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ) : (
              <Link to="/" className="mx-auto flex items-baseline">
                <span className="font-display text-2xl text-[#171717]">PKM</span>
                <span className="w-2 h-2 bg-[#FF2F92] ml-0.5 border border-[#171717] inline-block"></span>
              </Link>
            )}
          </div>

          {/* Navigation Sections */}
          <nav className="p-3 overflow-y-auto max-h-[calc(100vh-140px)] space-y-4">
            {MENU_SECTIONS.map((sec, idx) => {
              const visibleItems = sec.items.filter(item => !item.roles || item.roles.includes(role))
              if (visibleItems.length === 0) return null

              return (
                <div key={idx} className="space-y-1">
                  {(!collapsed || mobileOpen) && (
                    <p className="px-2 text-[9px] font-black tracking-widest text-[#171717]/50 uppercase mb-1.5">
                      {sec.category}
                    </p>
                  )}
                  
                  <ul className="space-y-1">
                    {visibleItems.map((item) => {
                      const Icon = item.icon
                      const isActive = location.pathname === item.path
                      
                      return (
                        <li key={item.path}>
                          <Link
                            to={item.path}
                            onClick={handleLinkClick}
                            title={(collapsed && !mobileOpen) ? item.label : undefined}
                            className={`flex items-center gap-2.5 px-3 py-2 font-bold text-xs uppercase tracking-wider transition-all rounded-lg overflow-hidden ${
                              isActive 
                                ? 'bg-[#FF2F92] text-white border-1.5 border-[#171717] shadow-[2px_2px_0px_#171717] translate-x-0.5' 
                                : 'text-[#171717] hover:bg-white hover:border-1.5 hover:border-[#171717] hover:shadow-[2px_2px_0px_#171717] border-1.5 border-transparent'
                            }`}
                          >
                            <Icon size={16} strokeWidth={2.4} className="shrink-0" />
                            {(!collapsed || mobileOpen) && (
                              <span className="truncate flex-1 text-[11px] font-bold tracking-wide">
                                {item.label}
                              </span>
                            )}
                            {(!collapsed || mobileOpen) && item.badge && (
                              <span className="px-1.5 py-0.2 text-[8px] font-black bg-[#FFD83D] text-[#171717] border border-[#171717] rounded-sm shrink-0">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="p-3 border-t-1.5 border-[#171717] bg-white">
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
              className="hidden lg:flex p-1.5 bg-[#F5F1E9] border border-[#171717] hover:bg-[#FFD83D] transition-all cursor-pointer rounded-md shadow-[1px_1px_0px_#171717]"
              title={collapsed ? "Perluas menu" : "Ciutkan menu"}
            >
              {collapsed ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
