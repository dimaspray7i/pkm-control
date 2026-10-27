import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Sparkles, Send, Loader2, TrendingUp, AlertTriangle, CheckCircle2, RotateCcw, Folder, ClipboardList, Clock, Brain } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const SUGGESTED = [
  'Proyek mana yang paling berisiko terlambat?',
  'Berikan rekomendasi prioritas tugas hari ini.',
  'Bagaimana performa tim bulan ini?',
  'Apa saja kendala utama proyek saat ini?',
]

export default function AIAnalyst() {
  const { user } = useAuth()
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([
    {
      type: 'ai',
      answer: "Halo! Saya AI Business Analyst PKM. Saya siap membantu menganalisis status proyek, beban kerja tim, serta memberikan rekomendasi bisnis cerdas berbasis data real-time.",
      recommendations: [
        'Pilih salah satu pertanyaan siap pakai di bawah ini',
        'Atau ajukan pertanyaan spesifik tentang proyek yang sedang berjalan'
      ]
    }
  ])
  const [kpi, setKpi] = useState(null)
  const bottomRef = useRef(null)

  const fetchKpi = async () => {
    try {
      const res = await api.get('/dashboard')
      setKpi(res.data.kpi)
    } catch {}
  }

  useEffect(() => { fetchKpi() }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

  const handleSend = async (question) => {
    const q = (question || input).trim()
    if (!q || loading) return
    setInput('')
    setHistory(prev => [...prev, { type: 'user', text: q }])
    setLoading(true)
    try {
      const res = await api.post('/ai/ask', { question: q })
      setHistory(prev => [...prev, {
        type: 'ai',
        answer: res.data.answer,
        recommendations: res.data.recommendations || [],
        timestamp: res.data.timestamp,
      }])
    } catch {
      setHistory(prev => [...prev, {
        type: 'ai',
        answer: 'Maaf, terjadi kendala saat menghubungkan ke analitik AI PKM. Silakan coba kembali.',
        recommendations: ['Pastikan server backend Laravel berjalan normal.'],
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <PageHeader
        title="AI BUSINESS ANALYST"
        subtitle="Asisten analitik cerdas berbasis data proyek real-time PT Potensi Karya Mandiri."
        tag="INTELLIGENCE ENGINE"
        badge="AI POWERED"
        actions={
          <div className="bg-white px-3 py-1.5 border border-[#171717] rounded-lg flex items-center gap-2"
               style={{ boxShadow: '2px 2px 0px #171717' }}>
            <Sparkles size={15} className="text-[#FF2F92]" />
            <span className="font-black text-xs uppercase text-[#171717]">Engine Active</span>
          </div>
        }
      />

      {/* Suggested Prompt Chips */}
      <div className="bg-white p-3 border border-[#171717] rounded-lg" style={{ boxShadow: '3px 3px 0px #171717' }}>
        <p className="text-[9.5px] font-black uppercase text-[#171717]/60 tracking-wider mb-2">
          PERTANYAAN REKOMENDASI CEPAT:
        </p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSend(s)}
              disabled={loading}
              className="text-left px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#FFD83D]/40 border border-[#171717] rounded-md text-xs font-bold text-[#171717] transition-all cursor-pointer disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Two-column layout: Chat + KPI panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Chat Thread (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div className="bg-white border border-[#171717] rounded-lg p-4 min-h-[440px] max-h-[600px] overflow-y-auto space-y-3.5"
               style={{ boxShadow: '3px 3px 0px #171717' }}>
            {history.map((msg, idx) => {
              if (msg.type === 'user') {
                return (
                  <div key={idx} className="flex justify-end">
                    <div className="p-3 bg-[#171717] text-white rounded-lg max-w-[85%] font-semibold text-xs leading-relaxed"
                         style={{ boxShadow: '2px 2px 0px #FF2F92' }}>
                      {msg.text}
                    </div>
                  </div>
                )
              }
              return (
                <div key={idx} className="space-y-2 max-w-[90%]">
                  <div className="p-3.5 bg-[#EBE5FB] border border-[#171717] rounded-lg"
                       style={{ boxShadow: '2px 2px 0px #171717' }}>
                    <div className="flex items-center gap-1.5 text-[#FF2F92] font-black text-[10px] uppercase mb-1.5">
                      <Sparkles size={13} />
                      <span>Analisis AI PKM</span>
                      {msg.timestamp && (
                        <span className="ml-auto text-[#171717]/40 normal-case font-normal">{msg.timestamp}</span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-[#171717] leading-relaxed whitespace-pre-line">
                      {msg.answer}
                    </p>
                  </div>
                  {msg.recommendations && msg.recommendations.length > 0 && (
                    <div className="p-3 bg-[#FFB3D1]/40 border border-[#171717] rounded-lg"
                         style={{ boxShadow: '2px 2px 0px #171717' }}>
                      <p className="font-black text-[10px] uppercase text-[#171717] mb-1.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF2F92]"></span>
                        Rekomendasi Aksi
                      </p>
                      <ul className="space-y-1 text-[11px] font-semibold text-[#171717]/90">
                        {msg.recommendations.map((rec, rIdx) => (
                          <li key={rIdx} className="flex items-start gap-1.5">
                            <span className="text-[#FF2F92] font-bold">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}
            {loading && (
              <div className="p-3.5 bg-white border border-[#171717] rounded-lg flex items-center gap-2 max-w-sm">
                <Loader2 size={16} className="animate-spin text-[#FF2F92]" />
                <span className="text-xs font-bold text-[#171717]">AI sedang mengolah data proyek...</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend() }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ketik pertanyaan analisis bisnis atau proyek Anda di sini..."
              disabled={loading}
              className="flex-1 pkm-input h-10"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="pkm-btn-pink h-10 px-5 disabled:opacity-50"
            >
              <Send size={14} strokeWidth={2.5} />
              <span>Kirim</span>
            </button>
          </form>
        </div>

        {/* KPI Side Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          {/* AI Context Info */}
          <div className="bg-[#FF2F92] p-4 border border-[#171717] rounded-lg text-white"
               style={{ boxShadow: '3px 3px 0px #171717' }}>
            <div className="flex items-center gap-2 mb-2">
              <Brain size={16} />
              <h3 className="font-display text-sm uppercase">PKM AI ENGINE</h3>
            </div>
            <p className="text-[10px] leading-snug opacity-80">
              AI terhubung ke data proyek, tugas, dan aktivitas tim secara real-time untuk memberikan analisis yang akurat.
            </p>
            <div className="mt-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
              <span className="text-[10px] font-black uppercase">Koneksi Backend Aktif</span>
            </div>
          </div>

          {/* KPI Cards from dashboard */}
          {kpi ? (
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase text-[#171717]/60 tracking-wider">RINGKASAN KPI</p>
              {[
                { label: 'Proyek Aktif', value: kpi.active_projects?.value ?? kpi.active_projects ?? 0, icon: <Folder size={14} />, bg: 'bg-white' },
                { label: 'Proyek Selesai', value: kpi.completed_projects?.value ?? kpi.completed_projects ?? 0, icon: <CheckCircle2 size={14} className="text-[#10B981]" />, bg: 'bg-white' },
                { label: 'Berisiko Terlambat', value: kpi.at_risk_projects?.value ?? kpi.at_risk_projects ?? 0, icon: <AlertTriangle size={14} className="text-[#FF2F92]" />, bg: (kpi.at_risk_projects?.value ?? kpi.at_risk_projects ?? 0) > 0 ? 'bg-[#FFF0F8] border-[#FF2F92]/30' : 'bg-white' },
                { label: 'Tugas Belum Selesai', value: kpi.pending_tasks?.value ?? kpi.pending_tasks ?? 0, icon: <ClipboardList size={14} />, bg: 'bg-white' },
                { label: 'Lewat Deadline', value: kpi.overdue_tasks?.value ?? kpi.overdue_tasks ?? 0, icon: <Clock size={14} className="text-red-500" />, bg: (kpi.overdue_tasks?.value ?? kpi.overdue_tasks ?? 0) > 0 ? 'bg-red-50 border-red-200' : 'bg-white' },
              ].map((item, i) => (
                <div key={i} className={`${item.bg} p-3 border border-[#171717] rounded-lg flex items-center justify-between`}
                     style={{ boxShadow: '2px 2px 0px #171717' }}>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-[#171717]">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  <span className="font-display text-xl leading-none text-[#171717]">{String(item.value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-4 border border-[#171717] rounded-lg text-center">
              <Loader2 size={20} className="animate-spin text-[#FF2F92] mx-auto mb-2" />
              <p className="text-[11px] font-bold text-[#171717]/60">Memuat data KPI...</p>
            </div>
          )}

          {/* Tips */}
          <div className="bg-[#FFD83D] p-3.5 border border-[#171717] rounded-lg"
               style={{ boxShadow: '2px 2px 0px #171717' }}>
            <p className="font-black text-[10px] uppercase text-[#171717] mb-1.5">💡 Tips Penggunaan</p>
            <ul className="space-y-1 text-[10px] font-semibold text-[#171717]/80">
              <li>• Tanyakan tentang proyek spesifik dengan menyebut namanya</li>
              <li>• Minta rekomendasi penugasan tim yang optimal</li>
              <li>• Tanya risiko dan kendala berdasarkan deadline</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
