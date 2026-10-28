import { useState, useEffect } from 'react'
import api from '../services/api'
import {
  FolderKanban, CheckCircle2, AlertTriangle, Clock, FileBarChart,
  TrendingUp, Loader2, RotateCcw, Activity, Download, FileSpreadsheet
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell
} from 'recharts'
import PageHeader from '../components/ui/PageHeader'

export default function Reports() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [exporting, setExporting] = useState(false)

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

  const handleExportCSV = async () => {
    try {
      setExporting(true)
      const [resProj, resTasks] = await Promise.all([
        api.get('/projects'),
        api.get('/tasks'),
      ])

      const projects = resProj.data.projects || []
      const tasks = resTasks.data.tasks || []

      // Generate CSV content
      let csv = '=== LAPORAN PROYEK PKM BUSINESS CONTROL CENTER ===\r\n'
      csv += 'Kode,Nama Proyek,Klien,Kategori,Progres (%),Target (%),Status,Tingkat Risiko,Faktor Risiko,Deadline\r\n'
      projects.forEach(p => {
        csv += `"${p.code}","${p.name}","${p.client}","${p.category}","${p.progress}","${p.target_progress}","${p.status}","${p.risk_level}","${p.risk_factor || '-'}","${p.deadline || '-'}"\r\n`
      })

      csv += '\r\n=== DAFTAR TUGAS OPERASIONAL ===\r\n'
      csv += 'ID,Proyek,Judul Tugas,PIC,Prioritas,Status,Selesai,Deadline\r\n'
      tasks.forEach(t => {
        csv += `"${t.id}","${t.project?.name || '-'}","${t.title}","${t.assignee_name || '-'}","${t.priority}","${t.status}","${t.is_completed ? 'Ya' : 'Tidak'}","${t.deadline || '-'}"\r\n`
      })

      // Download trigger
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Laporan_PKM_Control_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch {
      alert('Gagal mengekspor laporan CSV.')
    } finally {
      setExporting(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <Loader2 size={32} className="animate-spin text-[#FF2F92]" />
      <p className="font-display text-lg uppercase tracking-wider text-[#171717]">MEMUAT LAPORAN BISNIS DARI DATABASE...</p>
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
    <div className="space-y-4 pb-6">
      {/* Header */}
      <PageHeader
        title="LAPORAN & ANALITIK"
        subtitle="Laporan agregat performa proyek bisnis, penyelesaian tugas, dan distribusi risiko operasional."
        tag="LAPORAN EKSEKUTIF"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="pkm-btn-pink flex items-center gap-1.5 text-xs font-black uppercase disabled:opacity-50"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Ekspor CSV
            </button>
            <div className="bg-white px-3 py-1.5 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center gap-2">
              <FileBarChart size={15} className="text-[#FF2F92]" />
              <span className="font-black text-xs uppercase">Bulan Berjalan</span>
            </div>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-[#FF2F92] text-white border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
          <p className="text-[9px] font-black uppercase text-white/80">Proyek Aktif</p>
          <p className="font-display text-3xl leading-none mt-1">{kpi.active_projects?.value ?? 0}</p>
          <p className="text-[9px] font-bold text-white/90 mt-1">{kpi.active_projects?.change}</p>
        </div>

        <div className="p-3.5 bg-[#FFD83D] text-[#171717] border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
          <p className="text-[9px] font-black uppercase text-[#171717]/80">Proyek Selesai</p>
          <p className="font-display text-3xl leading-none mt-1">{kpi.completed_projects?.value ?? 0}</p>
          <p className="text-[9px] font-bold text-[#171717]/80 mt-1">{kpi.completed_projects?.change}</p>
        </div>

        <div className="p-3.5 bg-[#B8A0F0] text-[#171717] border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
          <p className="text-[9px] font-black uppercase text-[#171717]/80">Berisiko Terlambat</p>
          <p className="font-display text-3xl leading-none mt-1">{kpi.at_risk_projects?.value ?? 0}</p>
          <p className="text-[9px] font-bold text-[#171717]/80 mt-1">{kpi.at_risk_projects?.change}</p>
        </div>

        <div className="p-3.5 bg-white text-[#171717] border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
          <p className="text-[9px] font-black uppercase text-[#171717]/60">Total Progres</p>
          <p className="font-display text-3xl leading-none mt-1 text-[#FF2F92]">{kpi.total_progress ?? 0}%</p>
          <p className="text-[9px] font-bold text-[#171717]/60 mt-1">Rata-rata Portofolio</p>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Trend Bar Chart (8 cols) */}
        <div className="lg:col-span-8 bg-white p-4 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717]">
          <h3 className="font-display text-sm uppercase text-[#171717] border-b border-[#171717]/10 pb-2 mb-3">
            TREN PROGRES OPERASIONAL (ON TRACK VS AT RISK)
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
            DISTRIBUSI STATUS PROYEK
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
            {donut.map((d, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></span>
                  {d.name}
                </span>
                <span>{d.value} Proyek</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
