import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, FolderKanban, CheckSquare, Code2, Bot, Users, FileText } from 'lucide-react'

const menuItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/projects', label: 'Projects', icon: FolderKanban },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare },
  { path: '/development', label: 'Development', icon: Code2 },
  { path: '/ai-analyst', label: 'AI Analyst', icon: Bot },
  { path: '/users', label: 'Users', icon: Users },
  { path: '/reports', label: 'Reports', icon: FileText },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside 
      className="w-64 bg-cream flex flex-col shrink-0"
      style={{ 
        borderRight: '3px solid var(--color-ink)',
        height: '100vh',
        position: 'sticky',
        top: 0
      }}
    >
      {/* Logo */}
      <div 
        className="p-6"
        style={{ borderBottom: '3px solid var(--color-ink)' }}
      >
        <h1 className="font-display text-3xl text-ink leading-none">
          PT Potensi Karya Mandiri<span className="text-pink">.</span>
        </h1>
        <p className="text-xs font-bold mt-2 uppercase tracking-widest text-ink/70">
          Control Center
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="flex flex-col gap-3">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className="flex items-center gap-3 px-4 py-3 font-bold text-sm uppercase tracking-wide transition-all duration-150"
                  style={{
                    border: '3px solid var(--color-ink)',
                    backgroundColor: isActive ? 'var(--color-pink)' : 'var(--color-white)',
                    color: isActive ? 'var(--color-white)' : 'var(--color-ink)',
                    boxShadow: isActive ? '4px 4px 0px var(--color-ink)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'var(--color-yellow)'
                      e.currentTarget.style.boxShadow = '4px 4px 0px var(--color-ink)'
                      e.currentTarget.style.transform = 'translate(-2px, -2px)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'var(--color-white)'
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.transform = 'translate(0, 0)'
                    }
                  }}
                >
                  <Icon size={20} strokeWidth={2.5} />
                  <span>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div 
        className="p-4 bg-yellow"
        style={{ borderTop: '3px solid var(--color-ink)' }}
      >
        <p className="text-xs font-bold uppercase leading-tight">
          PT Potensi Karya Mandiri
        </p>
        <p className="text-xs mt-1 font-semibold">
          v1.0.0
        </p>
      </div>
    </aside>
  )
}