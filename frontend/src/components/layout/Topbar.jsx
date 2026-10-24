import { Bell, Search, User } from 'lucide-react'

export default function Topbar() {
  return (
    <header 
      className="bg-white px-6 py-4 flex items-center justify-between"
      style={{ 
        borderBottom: '3px solid var(--color-ink)',
        boxShadow: '4px 4px 0px var(--color-ink)'
      }}
    >
      {/* Search */}
      <div className="flex-1 max-w-2xl">
        <div 
          className="flex items-center gap-2 bg-cream px-4 py-3"
          style={{ border: '3px solid var(--color-ink)' }}
        >
          <Search size={18} strokeWidth={2.5} />
          <input
            type="text"
            placeholder="Search projects, tasks..."
            className="bg-transparent outline-none text-sm font-medium placeholder:text-ink/50 flex-1"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 ml-6">
        <button 
          className="bg-yellow font-bold flex items-center justify-center transition-all duration-150"
          style={{ 
            border: '3px solid var(--color-ink)',
            boxShadow: '4px 4px 0px var(--color-ink)',
            width: '48px',
            height: '48px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-pink)'
            e.currentTarget.style.color = 'var(--color-white)'
            e.currentTarget.style.transform = 'translate(-2px, -2px)'
            e.currentTarget.style.boxShadow = '6px 6px 0px var(--color-ink)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-yellow)'
            e.currentTarget.style.color = 'var(--color-ink)'
            e.currentTarget.style.transform = 'translate(0, 0)'
            e.currentTarget.style.boxShadow = '4px 4px 0px var(--color-ink)'
          }}
        >
          <Bell size={20} strokeWidth={2.5} />
        </button>
        
        <button 
          className="bg-pink text-white font-bold text-sm uppercase flex items-center gap-2 transition-all duration-150"
          style={{ 
            border: '3px solid var(--color-ink)',
            boxShadow: '4px 4px 0px var(--color-ink)',
            padding: '12px 20px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-ink)'
            e.currentTarget.style.transform = 'translate(-2px, -2px)'
            e.currentTarget.style.boxShadow = '6px 6px 0px var(--color-ink)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-pink)'
            e.currentTarget.style.transform = 'translate(0, 0)'
            e.currentTarget.style.boxShadow = '4px 4px 0px var(--color-ink)'
          }}
        >
          <User size={20} strokeWidth={2.5} />
          <span>Admin</span>
        </button>
      </div>
    </header>
  )
}