import { useState, useEffect } from 'react'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import PageLoading from '../../components/ui/PageLoading'
import PageHeader from '../../components/ui/PageHeader'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Calendar,
  AlertCircle,
  Plus,
  RotateCcw,
  Building2,
  FolderKanban,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Filter
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts'

export default function FinancialPerformance() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [period, setPeriod] = useState('all')

  // Modals for Admin
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [showTxModal, setShowTxModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form states
  const [budgetForm, setBudgetForm] = useState({
    label: '',
    fiscal_year: new Date().getFullYear(),
    fiscal_period: 'annual',
    period_code: '',
    start_date: '',
    end_date: '',
    revenue_target: '',
    expense_budget: '',
    notes: ''
  })

  const [txForm, setTxForm] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    type: 'expense',
    category: 'Operasional',
    description: '',
    amount: '',
    reference_number: '',
    notes: ''
  })

  // Budgets & Transactions pagination data
  const [budgets, setBudgets] = useState([])
  const [transactions, setTransactions] = useState([])
  const [activeTab, setActiveTab] = useState('overview') // overview, budgets, transactions

  const fetchDashboard = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get(`/financial/dashboard?period=${period}`)
      setData(res.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat data keuangan.')
    } finally {
      setLoading(false)
    }
  }

  const fetchBudgets = async () => {
    try {
      const res = await api.get('/financial/budgets')
      setBudgets(res.data?.data || [])
    } catch (err) {
      console.error(err)
    }
  }

  const fetchTransactions = async () => {
    try {
      const res = await api.get('/financial/transactions')
      setTransactions(res.data?.data || [])
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchDashboard()
    fetchBudgets()
    fetchTransactions()
  }, [period])

  const handleCreateBudget = async (e) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      await api.post('/financial/budgets', budgetForm)
      setShowBudgetModal(false)
      setBudgetForm({
        label: '',
        fiscal_year: new Date().getFullYear(),
        fiscal_period: 'annual',
        period_code: '',
        start_date: '',
        end_date: '',
        revenue_target: '',
        expense_budget: '',
        notes: ''
      })
      fetchDashboard()
      fetchBudgets()
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal membuat anggaran.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateTx = async (e) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      await api.post('/financial/transactions', txForm)
      setShowTxModal(false)
      setTxForm({
        transaction_date: new Date().toISOString().split('T')[0],
        type: 'expense',
        category: 'Operasional',
        description: '',
        amount: '',
        reference_number: '',
        notes: ''
      })
      fetchDashboard()
      fetchTransactions()
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mencatat transaksi.')
    } finally {
      setSubmitting(false)
    }
  }

  const formatIDR = (val) => {
    if (val === null || val === undefined) return 'Rp 0'
    return 'Rp ' + Number(val).toLocaleString('id-ID')
  }

  if (loading && !data) {
    return <PageLoading mode="page" text="Memuat Kondisi Keuangan & Anggaran..." subtext="Mengagregasi realisasi transaksi dan deviasi anggaran perusahaan." />
  }

  if (error && !data) {
    return (
      <div className="p-6 bg-[#FF2F92]/10 border-2 border-[#171717] shadow-[6px_6px_0px_#171717] text-center max-w-xl mx-auto my-12">
        <AlertCircle className="w-12 h-12 text-[#FF2F92] mx-auto mb-3" />
        <h2 className="font-display text-xl uppercase mb-2">Gagal Memuat Data Finansial</h2>
        <p className="text-sm font-semibold mb-4">{error}</p>
        <button
          onClick={fetchDashboard}
          className="px-4 py-2 bg-[#FFD83D] text-[#171717] font-bold border-2 border-[#171717] shadow-[2px_2px_0px_#171717] inline-flex items-center gap-2 cursor-pointer"
        >
          <RotateCcw size={16} /> Muat Ulang
        </button>
      </div>
    )
  }

  const summary = data?.summary || {}
  const hasData = data?.has_data

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <PageHeader
        title="Kinerja Keuangan & Anggaran"
        subtitle="Pemantauan pendapatan, pengeluaran riil, dan pengendalian deviasi anggaran perusahaan."
        tag="FINANCIAL CONTROL"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <>
                <button
                  onClick={() => setShowBudgetModal(true)}
                  className="px-3.5 py-2 bg-[#B8A0F0] text-[#171717] font-black text-xs uppercase tracking-wider border-2 border-[#171717] shadow-[3px_3px_0px_#171717] hover:bg-[#a688ed] flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={16} /> Anggaran Baru
                </button>
                <button
                  onClick={() => setShowTxModal(true)}
                  className="px-3.5 py-2 bg-[#FFD83D] text-[#171717] font-black text-xs uppercase tracking-wider border-2 border-[#171717] shadow-[3px_3px_0px_#171717] hover:bg-[#f5cd2f] flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={16} /> Catat Transaksi
                </button>
              </>
            )}
            <button
              onClick={fetchDashboard}
              className="p-2 bg-white text-[#171717] border-2 border-[#171717] shadow-[3px_3px_0px_#171717] hover:bg-[#F5F1E9] cursor-pointer"
              title="Segarkan data"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        }
      />

      {/* Data completeness reminder banner if empty or partial */}
      {!hasData && (
        <div className="p-4 bg-[#FFD83D]/40 border-2 border-[#171717] shadow-[4px_4px_0px_#171717] flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#171717] shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm font-semibold">
            <span className="font-black uppercase">Data Transaksi Belum Dicatat:</span> Sistem mendeteksi belum ada transaksi keuangan aktual. Angka realisasi ditampilkan dari data tercatat murni tanpa rekayasa.
            {isAdmin ? ' Anda dapat mulai mencatat transaksi melalui tombol "Catat Transaksi".' : ' Menunggu pencatatan dari Administrator Sistem.'}
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Income */}
        <div className="p-5 bg-white border-2 border-[#171717] shadow-[4px_4px_0px_#171717] space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#171717]/70">
            <span>Total Pendapatan</span>
            <span className="p-1 bg-[#10B981]/20 text-[#047857] border border-[#10B981] rounded">
              <ArrowUpRight size={14} />
            </span>
          </div>
          <div className="font-display text-2xl lg:text-3xl text-[#10B981]">
            {formatIDR(summary.total_income)}
          </div>
          <div className="text-[11px] font-semibold text-[#171717]/60">
            Target: {formatIDR(summary.revenue_target)}
          </div>
        </div>

        {/* Total Expense */}
        <div className="p-5 bg-white border-2 border-[#171717] shadow-[4px_4px_0px_#171717] space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#171717]/70">
            <span>Total Pengeluaran</span>
            <span className="p-1 bg-[#FF2F92]/20 text-[#FF2F92] border border-[#FF2F92] rounded">
              <ArrowDownRight size={14} />
            </span>
          </div>
          <div className="font-display text-2xl lg:text-3xl text-[#FF2F92]">
            {formatIDR(summary.total_expense)}
          </div>
          <div className="text-[11px] font-semibold text-[#171717]/60">
            Anggaran: {formatIDR(summary.expense_budget)}
          </div>
        </div>

        {/* Net Result */}
        <div className="p-5 bg-white border-2 border-[#171717] shadow-[4px_4px_0px_#171717] space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#171717]/70">
            <span>Hasil Bersih (Net)</span>
            <DollarSign size={16} className="text-[#171717]/70" />
          </div>
          <div className={`font-display text-2xl lg:text-3xl ${summary.net_result >= 0 ? 'text-[#171717]' : 'text-[#FF2F92]'}`}>
            {formatIDR(summary.net_result)}
          </div>
          <div className="text-[11px] font-semibold text-[#171717]/60">
            {summary.net_result >= 0 ? 'Surplus Operasional' : 'Defisit Anggaran'}
          </div>
        </div>

        {/* Budget Variance */}
        <div className="p-5 bg-[#FFD83D] border-2 border-[#171717] shadow-[4px_4px_0px_#171717] space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#171717]">
            <span>Utilisasi Anggaran</span>
            <PieChart size={16} />
          </div>
          <div className="font-display text-2xl lg:text-3xl text-[#171717]">
            {summary.budget_utilization !== null ? `${summary.budget_utilization}%` : 'Belum Ada'}
          </div>
          <div className="text-[11px] font-bold text-[#171717]/80 uppercase">
            Status: {summary.variance_status === 'under_budget' ? 'Di Bawah Anggaran' : summary.variance_status === 'on_budget' ? 'Tepat Anggaran' : summary.variance_status === 'over_budget' ? 'Melebihi Anggaran' : 'Belum Ditentukan'}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b-2 border-[#171717] gap-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 font-bold text-xs uppercase tracking-wider border-2 border-b-0 border-[#171717] cursor-pointer transition-all ${
            activeTab === 'overview'
              ? 'bg-[#FFD83D] shadow-[2px_-2px_0px_#171717]'
              : 'bg-white hover:bg-[#F5F1E9]'
          }`}
        >
          Ikhtisar & Grafik
        </button>
        <button
          onClick={() => setActiveTab('budgets')}
          className={`px-4 py-2 font-bold text-xs uppercase tracking-wider border-2 border-b-0 border-[#171717] cursor-pointer transition-all ${
            activeTab === 'budgets'
              ? 'bg-[#FFD83D] shadow-[2px_-2px_0px_#171717]'
              : 'bg-white hover:bg-[#F5F1E9]'
          }`}
        >
          Daftar Anggaran ({budgets.length})
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 font-bold text-xs uppercase tracking-wider border-2 border-b-0 border-[#171717] cursor-pointer transition-all ${
            activeTab === 'transactions'
              ? 'bg-[#FFD83D] shadow-[2px_-2px_0px_#171717]'
              : 'bg-white hover:bg-[#F5F1E9]'
          }`}
        >
          Riwayat Transaksi ({transactions.length})
        </button>
      </div>

      {/* Tab 1: Overview & Charts */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Trend Chart */}
          <div className="p-5 bg-white border-2 border-[#171717] shadow-[4px_4px_0px_#171717] space-y-4">
            <h3 className="font-display text-lg uppercase tracking-wide text-[#171717]">
              Tren Pendapatan & Pengeluaran Riil
            </h3>
            {data?.trend?.length > 0 ? (
              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis dataKey="period" stroke="#171717" fontSize={11} />
                    <YAxis stroke="#171717" fontSize={11} tickFormatter={(v) => `${v / 1000000}M`} />
                    <Tooltip
                      formatter={(val) => formatIDR(val)}
                      contentStyle={{ backgroundColor: '#F5F1E9', border: '2px solid #171717', borderRadius: '4px' }}
                    />
                    <Legend />
                    <Bar dataKey="income" name="Pemasukan" fill="#10B981" />
                    <Bar dataKey="expense" name="Pengeluaran" fill="#FF2F92" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-12 text-center text-xs font-semibold text-[#171717]/60">
                Belum ada data transaksi bulanan yang cukup untuk menampilkan grafik tren.
              </div>
            )}
          </div>

          {/* Project & Initiative Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Project */}
            <div className="p-5 bg-white border-2 border-[#171717] shadow-[4px_4px_0px_#171717] space-y-3">
              <div className="flex items-center gap-2">
                <FolderKanban size={18} className="text-[#FF2F92]" />
                <h3 className="font-display text-base uppercase tracking-wide text-[#171717]">
                  Pengeluaran per Proyek
                </h3>
              </div>
              {data?.by_project?.length > 0 ? (
                <div className="divide-y divide-[#171717]/10 text-xs">
                  {data.by_project.map((p) => (
                    <div key={p.project_id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#171717]">{p.project_name}</div>
                        <div className="text-[10px] text-[#171717]/60">{p.project_code}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[#FF2F92]">{formatIDR(p.expense)}</div>
                        <div className="text-[10px] text-[#10B981]">{formatIDR(p.income)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-[#171717]/60">
                  Belum ada transaksi yang dialokasikan ke proyek spesifik.
                </div>
              )}
            </div>

            {/* By Initiative */}
            <div className="p-5 bg-white border-2 border-[#171717] shadow-[4px_4px_0px_#171717] space-y-3">
              <div className="flex items-center gap-2">
                <Compass size={18} className="text-[#B8A0F0]" />
                <h3 className="font-display text-base uppercase tracking-wide text-[#171717]">
                  Alokasi Inisiatif Strategis
                </h3>
              </div>
              {data?.by_initiative?.length > 0 ? (
                <div className="divide-y divide-[#171717]/10 text-xs">
                  {data.by_initiative.map((i) => (
                    <div key={i.initiative_id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#171717]">{i.initiative_title}</div>
                        <div className="text-[10px] text-[#171717]/60">{i.initiative_code}</div>
                      </div>
                      <div className="font-bold text-[#FF2F92]">{formatIDR(i.expense)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-[#171717]/60">
                  Belum ada transaksi terkait inisiatif strategis.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Budgets */}
      {activeTab === 'budgets' && (
        <div className="bg-white border-2 border-[#171717] shadow-[4px_4px_0px_#171717] overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#EAE4D8] border-b-2 border-[#171717] uppercase font-bold text-[#171717]">
              <tr>
                <th className="p-3">Label Periode</th>
                <th className="p-3">Tahun</th>
                <th className="p-3">Jangka Waktu</th>
                <th className="p-3">Target Pendapatan</th>
                <th className="p-3">Anggaran Biaya</th>
                <th className="p-3">Realisasi Biaya</th>
                <th className="p-3">Sisa Anggaran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#171717]/10">
              {budgets.length > 0 ? (
                budgets.map((b) => {
                  const remaining = b.expense_budget - b.total_expense
                  return (
                    <tr key={b.id} className="hover:bg-[#F5F1E9]">
                      <td className="p-3 font-bold text-[#171717]">{b.label}</td>
                      <td className="p-3">{b.fiscal_year}</td>
                      <td className="p-3 text-[11px] text-[#171717]/70">
                        {b.start_date} s/d {b.end_date}
                      </td>
                      <td className="p-3 text-[#10B981] font-bold">{formatIDR(b.revenue_target)}</td>
                      <td className="p-3 text-[#FF2F92] font-bold">{formatIDR(b.expense_budget)}</td>
                      <td className="p-3 font-semibold">{formatIDR(b.total_expense)}</td>
                      <td className={`p-3 font-bold ${remaining >= 0 ? 'text-[#10B981]' : 'text-[#FF2F92]'}`}>
                        {formatIDR(remaining)}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-xs text-[#171717]/60">
                    Belum ada anggaran yang terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Transactions */}
      {activeTab === 'transactions' && (
        <div className="bg-white border-2 border-[#171717] shadow-[4px_4px_0px_#171717] overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#EAE4D8] border-b-2 border-[#171717] uppercase font-bold text-[#171717]">
              <tr>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Tipe</th>
                <th className="p-3">Kategori</th>
                <th className="p-3">Deskripsi</th>
                <th className="p-3">Nominal</th>
                <th className="p-3">Pencatat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#171717]/10">
              {transactions.length > 0 ? (
                transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-[#F5F1E9]">
                    <td className="p-3 whitespace-nowrap">{t.transaction_date}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase border border-[#171717] rounded ${
                        t.type === 'income' ? 'bg-[#10B981]/20 text-[#047857]' : 'bg-[#FF2F92]/20 text-[#FF2F92]'
                      }`}>
                        {t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                      </span>
                    </td>
                    <td className="p-3 font-bold">{t.category}</td>
                    <td className="p-3 text-[#171717]/80">{t.description}</td>
                    <td className={`p-3 font-display text-sm ${t.type === 'income' ? 'text-[#10B981]' : 'text-[#FF2F92]'}`}>
                      {formatIDR(t.amount)}
                    </td>
                    <td className="p-3 text-[11px] text-[#171717]/60">{t.recorder?.name || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-xs text-[#171717]/60">
                    Belum ada riwayat transaksi yang tercatat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Create Budget (Admin Only) */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 bg-[#171717]/50 flex items-center justify-center p-4">
          <div className="bg-[#F5F1E9] border-3 border-[#171717] shadow-[6px_6px_0px_#171717] max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-display text-lg uppercase">Buat Anggaran Periode Baru</h3>
            <form onSubmit={handleCreateBudget} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Label Anggaran</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Anggaran Tahunan 2026"
                  className="w-full p-2 bg-white border-2 border-[#171717]"
                  value={budgetForm.label}
                  onChange={(e) => setBudgetForm({ ...budgetForm, label: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Tahun Fiskal</label>
                  <input
                    type="number"
                    required
                    className="w-full p-2 bg-white border-2 border-[#171717]"
                    value={budgetForm.fiscal_year}
                    onChange={(e) => setBudgetForm({ ...budgetForm, fiscal_year: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Periode</label>
                  <select
                    className="w-full p-2 bg-white border-2 border-[#171717]"
                    value={budgetForm.fiscal_period}
                    onChange={(e) => setBudgetForm({ ...budgetForm, fiscal_period: e.target.value })}
                  >
                    <option value="annual">Tahunan</option>
                    <option value="quarterly">Kuartal</option>
                    <option value="monthly">Bulanan</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    required
                    className="w-full p-2 bg-white border-2 border-[#171717]"
                    value={budgetForm.start_date}
                    onChange={(e) => setBudgetForm({ ...budgetForm, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Tanggal Selesai</label>
                  <input
                    type="date"
                    required
                    className="w-full p-2 bg-white border-2 border-[#171717]"
                    value={budgetForm.end_date}
                    onChange={(e) => setBudgetForm({ ...budgetForm, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Target Pendapatan (IDR)</label>
                <input
                  type="number"
                  min="0"
                  required
                  className="w-full p-2 bg-white border-2 border-[#171717]"
                  value={budgetForm.revenue_target}
                  onChange={(e) => setBudgetForm({ ...budgetForm, revenue_target: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Pagu Anggaran Biaya (IDR)</label>
                <input
                  type="number"
                  min="0"
                  required
                  className="w-full p-2 bg-white border-2 border-[#171717]"
                  value={budgetForm.expense_budget}
                  onChange={(e) => setBudgetForm({ ...budgetForm, expense_budget: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBudgetModal(false)}
                  className="px-3 py-1.5 bg-white border-2 border-[#171717] font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-[#FFD83D] border-2 border-[#171717] font-bold"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Anggaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Transaction (Admin Only) */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 bg-[#171717]/50 flex items-center justify-center p-4">
          <div className="bg-[#F5F1E9] border-3 border-[#171717] shadow-[6px_6px_0px_#171717] max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-display text-lg uppercase">Catat Transaksi Keuangan</h3>
            <form onSubmit={handleCreateTx} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    className="w-full p-2 bg-white border-2 border-[#171717]"
                    value={txForm.transaction_date}
                    onChange={(e) => setTxForm({ ...txForm, transaction_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Tipe</label>
                  <select
                    className="w-full p-2 bg-white border-2 border-[#171717]"
                    value={txForm.type}
                    onChange={(e) => setTxForm({ ...txForm, type: e.target.value })}
                  >
                    <option value="expense">Pengeluaran</option>
                    <option value="income">Pemasukan</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Kategori</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Operasional, Gaji, Server, Jasa"
                  className="w-full p-2 bg-white border-2 border-[#171717]"
                  value={txForm.category}
                  onChange={(e) => setTxForm({ ...txForm, category: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Deskripsi</label>
                <input
                  type="text"
                  required
                  placeholder="Keterangan transaksi"
                  className="w-full p-2 bg-white border-2 border-[#171717]"
                  value={txForm.description}
                  onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Nominal (IDR)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  className="w-full p-2 bg-white border-2 border-[#171717]"
                  value={txForm.amount}
                  onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTxModal(false)}
                  className="px-3 py-1.5 bg-white border-2 border-[#171717] font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-[#FFD83D] border-2 border-[#171717] font-bold"
                >
                  {submitting ? 'Menyimpan...' : 'Catat Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
