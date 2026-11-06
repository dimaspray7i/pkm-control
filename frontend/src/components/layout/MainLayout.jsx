import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import GlobalAiAssistant from '../ai/GlobalAiAssistant'

export default function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F5F1E9] font-body selection:bg-[#FF2F92]/20">
      {/* Sidebar with Desktop Sticky & Mobile Drawer support */}
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Topbar sticky header */}
        <Topbar onToggleMobile={() => setMobileOpen(!mobileOpen)} />

        {/* Main scrollable body with standardized container constraint */}
        <main className="flex-1 overflow-y-auto min-h-0 px-3.5 sm:px-6 py-4 md:py-6">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>

        {/* Dashboard Bottom Footer Bar */}
        <footer className="shrink-0 border-t border-[#171717] bg-[#F5F1E9] px-3.5 sm:px-6 py-2 flex items-center justify-between text-xs font-bold text-[#171717] select-none z-20">
          {/* Left: Starburst badge & Slogan */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-3.5 h-3.5 text-[#FF2F92] shrink-0">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12,0 15,7 22,2 17,9 24,12 17,15 22,22 15,17 12,24 9,17 2,22 7,15 0,12 7,9 2,2 9,7" />
              </svg>
            </div>
            <p className="font-black text-[10px] sm:text-[10.5px] uppercase tracking-wide truncate">
              PKM<span className="text-[#FF2F92]">.</span> BUILD TODAY, GROW TOMORROW.
            </p>
          </div>

          {/* Right: Diagonal Color Stripes & Star */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
            <div className="flex items-center h-3.5 overflow-hidden">
              <div className="w-4 sm:w-5 h-full bg-[#FF2F92] -skew-x-12 border-l border-[#171717]"></div>
              <div className="w-2.5 sm:w-3 h-full bg-[#171717] -skew-x-12"></div>
              <div className="w-4 sm:w-5 h-full bg-[#B8A0F0] -skew-x-12"></div>
              <div className="w-5 sm:w-6 h-full bg-stripes-black -skew-x-12 border-r border-[#171717]"></div>
              <div className="w-3.5 sm:w-4 h-full bg-[#FFD83D] -skew-x-12"></div>
            </div>

            {/* 4-pointed yellow star */}
            <div className="w-3.5 h-3.5 text-[#FFD83D] hidden sm:block">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12,0 15,9 24,12 15,15 12,24 9,15 0,12 9,9" />
              </svg>
            </div>
          </div>
        </footer>
      </div>

      {/* Global AI Assistant Floating Trigger */}
      <GlobalAiAssistant />
    </div>
  )
}