import { useState, useEffect } from 'react'
import api from '../services/api'
import {
  FolderKanban, CheckCircle2, AlertTriangle, Clock, FileBarChart,
  TrendingUp, Loader2, RotateCcw, Activity
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell
} from 'recharts'
import PageHeader from '../components/ui/PageHeader'

export default function Reports() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await api.get('/dashboard')
      setData(res.data)
      setError(null)
    } catch {
      setError('Gagal memuat data laporan dari server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <Loader2 size={32} className="animate-spin text-[#FF2F92]" />
      <p className="font-display text-lg uppercase tracking-wider text-[#171717]">MEMUAT LAPORAN BISNIS...</p>
    </div>
  )

  if (error) return (
    <div className="p-6 bg-[#FFD83D] border border-[#171717] rounded-md shadow-[4px_4px_0px_#171717] max-w-md my-8">
      <h2 className="font-display text-xl uppercase mb-2">Gagal Memuat</h2>
      <p className="text-xs font-semibold mb-3">{error}</p>
      <button onClick={fetchData} className="px-3.5 py-1.5 bg-[#171717] text-white font-bold text-xs uppercase flex items-center gap-1.5 rounded cursor-pointer">
        <RotateCcw size={13} /> Coba Lagi
      </button>
    </div>
  )

  const kpi        = data?.kpi || {}
  const trend      = data?.trend_data || []
  const donut      = data?.donut_data || []
  const projects   = data?.latest_projects || []
  const riskProjs  = data?.risk_projects || []

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <PageHeader
        title="LAPORAN & ANALITIK"
        subtitle="Laporan agregat performa proyek bisnis, penyelesaian tugas, dan distribusi risiko kuartal."
        tag="LAPORAN EKSEKUTIF"
        actions={
          <div className="bg-white px-3 py-1.5 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center gap-2">
            <FileBarChart size={15} className="text-[#FF2F92]" />
            <span className="font-black text-xs uppercase">Bulan Berjalan</span>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-[#FF2F92] text-white border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
          <p className="text-[9px] font-black uppercase text-white/80">Proyek Aktif</p>
          <p className="font-display text-3xl leading-none mt-1">{kpi.active_projects?.value || 12}</p>
          <p className="text-[9px] font-bold text-white/90 mt-1">{kpi.active_projects?.change}</p>
        </div>

        <div className="p-3.5 bg-[#FFD83D] text-[#171717] border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
          <p className="text-[9px] font-black uppercase text-[#171717]/80">Proyek Selesai</p>
          <p className="font-display text-3xl leading-none mt-1">{kpi.completed_projects?.value || 8}</p>
          <p className="text-[9px] font-bold text-[#171717]/80 mt-1">{kpi.completed_projects?.change}</p>
        </div>

        <div className="p-3.5 bg-[#B8A0F0] text-[#171717] border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
          <p className="text-[9px] font-black uppercase text-[#171717]/80">Berisiko Terlambat</p>
          <p className="font-display text-3xl leading-none mt-1">{kpi.at_risk_projects?.value || 3}</p>
          <p className="text-[9px] font-bold text-[#171717]/80 mt-1">{kpi.at_risk_projects?.change}</p>
        </div>

        <div className="p-3.5 bg-white text-[#171717] border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
          <p className="text-[9px] font-black uppercase text-[#171717]/60">Total Progres</p>
          <p className="font-display text-3xl leading-none mt-1 text-[#FF2F92]">{kpi.total_progress || 68}%</p>
          <p className="text-[9px] font-bold text-[#171717]/60 mt-1">Target Kuartal: 80%</p>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Trend Bar Chart (8 cols) */}
        <div className="lg:col-span-8 bg-white p-4 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
          <h3 className="font-display text-sm uppercase text-[#171717] border-b border-[#171717]/10 pb-2 mb-3">
            TREN PROGRES MINGGUAN (ON TRACK VS AT RISK)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#eeeeee" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fontWeight: 700, fill: '#171717' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fontWeight: 700, fill: '#171717' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#171717', 
                    borderRadius: '4px', 
                    color: '#fff', 
                    fontSize: '11px',
                    fontWeight: 'bold' 
                  }} 
                />
                <Bar dataKey="on_track" fill="#10B981" isAnimationActive={false} radius={[3, 3, 0, 0]} name="On Track" />
                <Bar dataKey="at_risk" fill="#FFD83D" isAnimationActive={false} radius={[3, 3, 0, 0]} name="At Risk" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Pie (4 cols) */}
        <div className="lg:col-span-4 bg-white p-4 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col justify-between">
          <h3 className="font-display text-sm uppercase text-[#171717] border-b border-[#171717]/10 pb-2 mb-2">
            DISTRIBUSI STATUS
          </h3>
          <div className="h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donut}
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="#171717"
                  strokeWidth={1.5}
                  isAnimationActive={false}
                >
                  {donut.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || (index === 0 ? '#10B981' : index === 1 ? '#FFD83D' : '#FF2F92')} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 pt-2 border-t border-[#171717]/10 text-xs font-bold">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span> On Track</span>
              <span>8 Proyek</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#FFD83D]"></span> At Risk</span>
              <span>3 Proyek</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#FF2F92]"></span> Delayed</span>
              <span>1 Proyek</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
