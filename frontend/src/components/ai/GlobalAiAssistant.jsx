import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sparkles, X, Send, Bot, Maximize2, Loader2, ArrowRight, ChevronDown, CheckCircle2, AlertTriangle } from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import MarkdownRenderer from '../ui/MarkdownRenderer'

export default function GlobalAiAssistant() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Floating button position & drag state
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('pkm_ai_floating_pos')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Ensure within window bounds
        const x = Math.min(Math.max(16, parsed.x), window.innerWidth - 70)
        const y = Math.min(Math.max(16, parsed.y), window.innerHeight - 70)
        return { x, y }
      }
    } catch {}
    // Default: bottom-right
    return {
      x: typeof window !== 'undefined' ? window.innerWidth - 80 : 1200,
      y: typeof window !== 'undefined' ? window.innerHeight - 80 : 700,
    }
  })

  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      id: 'init',
      sender: 'ai',
      text: 'Halo! Saya Global AI Assistant PKM. Tanyakan kondisi proyek, prioritas tugas, atau analisis laporan.',
      time: 'Baru saja'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [engineMode, setEngineMode] = useState('Rule-Based Engine')

  // Dragging refs
  const dragRef = useRef(null)
  const isDragging = useRef(false)
  const dragStartPos = useRef({ x: 0, y: 0 })
  const startBtnPos = useRef({ x: 0, y: 0 })
  const movedDistance = useRef(0)
  const messagesEndRef = useRef(null)

  // Fetch engine mode on mount
  useEffect(() => {
    api.get('/ai/context')
      .then(res => {
        if (res.data?.mode) setEngineMode(res.data.mode)
      })
      .catch(() => {})
  }, [])

  // Adjust position when viewport resizes or orientation changes
  useEffect(() => {
    const handleViewportResize = () => {
      setPosition(prev => ({
        x: Math.min(Math.max(16, prev.x), window.innerWidth - 70),
        y: Math.min(Math.max(16, prev.y), window.innerHeight - 70),
      }))
    }
    window.addEventListener('resize', handleViewportResize)
    window.addEventListener('orientationchange', handleViewportResize)
    return () => {
      window.removeEventListener('resize', handleViewportResize)
      window.removeEventListener('orientationchange', handleViewportResize)
    }
  }, [])

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, loading])

  // Context-aware page prompts
  const getContextSuggestions = () => {
    const path = location.pathname
    if (path.includes('/reports')) {
      return [
        'Jelaskan ringkasan laporan periode ini',
        'Apa penyebab utama tugas overdue?',
        'Rekomendasi tindakan pimpinan'
      ]
    }
    if (path.includes('/projects')) {
      return [
        'Proyek mana yang paling berisiko terlambat?',
        'Status progres seluruh portofolio',
        'Kendala utama proyek saat ini'
      ]
    }
    if (path.includes('/tasks')) {
      return [
        'Apa yang harus dikerjakan tim hari ini?',
        'Daftar tugas overdue paling mendesak',
        'Siapa anggota tim dengan beban terbanyak?'
      ]
    }
    return [
      'Kondisi bisnis kita saat ini gimana?',
      'Coba cek proyek yang bermasalah',
      'Rekomendasi prioritas hari ini'
    ]
  }

  // Handle Drag Events
  const handlePointerDown = (e) => {
    isDragging.current = true
    movedDistance.current = 0
    dragStartPos.current = { x: e.clientX, y: e.clientY }
    startBtnPos.current = { ...position }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e) => {
    if (!isDragging.current) return
    const dx = e.clientX - dragStartPos.current.x
    const dy = e.clientY - dragStartPos.current.y
    movedDistance.current = Math.hypot(dx, dy)

    const newX = Math.min(Math.max(16, startBtnPos.current.x + dx), window.innerWidth - 68)
    const newY = Math.min(Math.max(16, startBtnPos.current.y + dy), window.innerHeight - 68)

    setPosition({ x: newX, y: newY })
  }

  const handlePointerUp = (e) => {
    if (!isDragging.current) return
    isDragging.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}

    // Save position if dragged
    if (movedDistance.current > 5) {
      localStorage.setItem('pkm_ai_floating_pos', JSON.stringify(position))
    } else {
      // Toggle modal on pure click
      setIsOpen(prev => !prev)
    }
  }

  // Handle Sending Message
  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || input).trim()
    if (!text || loading) return

    const now = new Date()
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    const newMsg = { id: Date.now(), sender: 'user', text, time: timeStr }
    setMessages(prev => [...prev, newMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await api.post('/ai/ask', {
        prompt: text,
        page_context: location.pathname.replace('/', '') || 'dashboard',
        history: messages.slice(-4).map(m => ({
          user: m.sender === 'user' ? m.text : undefined,
          reply: m.sender === 'ai' ? m.text : undefined
        }))
      })

      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: res.data.reply || res.data.answer || 'Analisis selesai.',
          summary: res.data.summary,
          findings: res.data.findings || [],
          recommendations: res.data.recommendations || [],
          time: res.data.timestamp || timeStr,
          mode: res.data.mode
        }
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: 'Maaf, terjadi gangguan saat menghubungi analitik AI PKM.',
          time: timeStr
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  // Transfer context to full AI Analyst page
  const handleOpenFullAnalyst = () => {
    setIsOpen(false)
    navigate('/ai-analyst', {
      state: {
        fromGlobal: true,
        history: messages.map(m => ({
          type: m.sender,
          text: m.sender === 'user' ? m.text : undefined,
          answer: m.sender === 'ai' ? m.text : undefined,
          findings: m.findings,
          recommendations: m.recommendations,
          timestamp: m.time
        }))
      }
    })
  }

  // If user role is not allowed full AI Analyst, they still have quick assistant but button clarifies
  const canAccessFullAnalyst = user && ['admin', 'pimpinan', 'project_manager'].includes(user.role)

  // Sembunyikan floating assistant khusus ketika berada di Dashboard utama (karena sudah ada panel AI terdedikasi)
  if (location.pathname === '/' || location.pathname === '/dashboard') {
    return null
  }

  return (
    <>
      {/* Draggable Floating Button */}
      <div
        ref={dragRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          touchAction: 'none'
        }}
        className="z-40 group cursor-grab active:cursor-grabbing select-none"
        title="Geser untuk pindah posisi, Klik untuk buka PKM AI Assistant"
      >
        <div className="relative">
          {/* Main Round Neo-Brutalist Pill */}
          <div className="w-14 h-14 bg-[#FF2F92] hover:bg-[#FF439D] active:scale-95 text-white border-2 border-[#171717] rounded-full flex items-center justify-center shadow-[4px_4px_0px_#171717] transition-transform">
            <Sparkles size={24} className="text-white animate-pulse" />
          </div>

          {/* Online status indicator dot */}
          <span className="absolute top-0 right-0 w-4 h-4 bg-[#10B981] border-2 border-[#171717] rounded-full" />
        </div>
      </div>

      {/* Floating Chat Modal Panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            right: position.x > window.innerWidth / 2 ? Math.max(16, window.innerWidth - position.x - 20) : 'auto',
            left: position.x <= window.innerWidth / 2 ? Math.max(16, position.x) : 'auto',
            bottom: Math.max(16, window.innerHeight - position.y + 10) > window.innerHeight - 560
              ? 20
              : Math.max(16, window.innerHeight - position.y + 10)
          }}
          className="z-40 w-[380px] max-w-[92vw] h-[520px] max-h-[85vh] bg-[#F5F1E9] border-2 border-[#171717] rounded-xl shadow-[6px_6px_0px_#171717] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Modal Header */}
          <div className="bg-[#171717] text-white px-4 py-3 flex items-center justify-between border-b-2 border-[#171717]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#FF2F92] text-white rounded flex items-center justify-center font-bold text-xs border border-white/20">
                AI
              </div>
              <div>
                <h3 className="font-display text-sm tracking-wide leading-none text-white uppercase">
                  PKM AI ASSISTANT
                </h3>
                <p className="text-[10px] text-white/70 font-sans mt-0.5 truncate max-w-[190px]">
                  {engineMode}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {canAccessFullAnalyst && (
                <button
                  onClick={handleOpenFullAnalyst}
                  title="Buka AI Analyst Lengkap"
                  className="p-1 hover:bg-white/20 text-white rounded transition cursor-pointer"
                >
                  <Maximize2 size={15} />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                title="Tutup"
                className="p-1 hover:bg-white/20 text-white rounded transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Context Notice & Quick Suggestions */}
          <div className="bg-[#FAF7F2] border-b border-[#171717]/20 p-2.5">
            <p className="text-[9.5px] font-black uppercase text-[#171717]/60 tracking-wider mb-1.5 flex items-center gap-1">
              <Sparkles size={11} className="text-[#FF2F92]" /> REKOMENDASI HALAMAN INI:
            </p>
            <div className="flex flex-wrap gap-1">
              {getContextSuggestions().map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(s)}
                  disabled={loading}
                  className="text-left text-[10.5px] font-bold px-2 py-1 bg-white hover:bg-[#FFD83D]/40 border border-[#171717] rounded shadow-[1px_1px_0px_#171717] text-[#171717] transition cursor-pointer disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Stream */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#F5F1E9]">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] p-2.5 rounded-lg text-xs leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-[#171717] text-white shadow-[2px_2px_0px_#FF2F92]'
                      : 'bg-white text-[#171717] border border-[#171717] shadow-[2px_2px_0px_#171717]'
                  }`}
                >
                  {m.sender === 'ai' && (
                    <div className="flex items-center justify-between text-[9px] font-bold text-[#FF2F92] uppercase mb-1">
                      <span>PKM Intelligence</span>
                      {m.time && <span className="text-[#171717]/40 font-normal">{m.time}</span>}
                    </div>
                  )}

                  {m.sender === 'ai' ? (
                    <MarkdownRenderer content={m.text} />
                  ) : (
                    <div className="whitespace-pre-line font-medium text-[11.5px]">
                      {m.text}
                    </div>
                  )}

                  {/* Structured findings in quick bubble */}
                  {m.findings && m.findings.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[#171717]/10 space-y-1">
                      <p className="text-[9px] font-bold uppercase text-[#171717]/70">Poin Analisis:</p>
                      {m.findings.slice(0, 3).map((f, fi) => (
                        <div key={fi} className="text-[10.5px] text-[#171717] flex items-start gap-1">
                          <span className="text-[#FF2F92] font-black">•</span>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {m.sender === 'user' && m.time && (
                  <span className="text-[9px] text-[#171717]/50 mt-0.5 px-1 font-semibold">
                    {m.time}
                  </span>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 p-2 bg-white/70 border border-[#171717] rounded-lg max-w-[200px] shadow-[2px_2px_0px_#171717]">
                <Loader2 size={14} className="animate-spin text-[#FF2F92]" />
                <span className="text-[11px] font-bold text-[#171717]">Menganalisis data...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Modal Footer: Full Analyst Link & Input */}
          <div className="p-2.5 bg-white border-t-2 border-[#171717] space-y-2">
            {canAccessFullAnalyst && (
              <button
                onClick={handleOpenFullAnalyst}
                className="w-full py-1 px-2 bg-[#B8A0F0] hover:bg-[#A68AE6] text-[#171717] border border-[#171717] rounded text-[11px] font-black uppercase flex items-center justify-center gap-1 shadow-[2px_2px_0px_#171717] transition cursor-pointer"
              >
                <span>Buka AI Analyst Penuh</span>
                <ArrowRight size={13} />
              </button>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendMessage()
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tanyakan apa saja..."
                disabled={loading}
                className="flex-1 px-2.5 py-1.5 bg-[#FAF7F2] border border-[#171717] rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#FF2F92] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="p-1.5 bg-[#FF2F92] hover:bg-[#FF439D] text-white border border-[#171717] rounded shadow-[2px_2px_0px_#171717] transition cursor-pointer disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
