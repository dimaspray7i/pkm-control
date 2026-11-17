import React from 'react'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-[#FF2F92]/10 border-3 border-[#171717] shadow-[6px_6px_0px_#171717] p-6 md:p-8 space-y-5 bg-[#F5F1E9]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#FF2F92] text-white flex items-center justify-center border-2 border-[#171717] shadow-[2px_2px_0px_#171717] shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-black uppercase tracking-wider px-2 py-0.5 bg-[#FFD83D] border border-[#171717]">
                  SISTEM PEMULIHAN APLIKASI
                </span>
                <h2 className="font-mono font-black text-xl text-[#171717] mt-1">
                  KENDALA TAMPILAN TERDETEKSI
                </h2>
              </div>
            </div>

            <p className="text-xs md:text-sm font-mono text-[#171717]/80 leading-relaxed">
              Komponen antarmuka mengalami kendala tak terduga saat memuat data. Sistem mencegah halaman menjadi kosong agar aktivitas Anda tetap terlindungi.
            </p>

            {this.state.error && (
              <div className="p-3 bg-white border border-[#171717] font-mono text-xs text-[#FF2F92] overflow-x-auto max-h-32">
                <strong>Detail Teknis:</strong> {this.state.error?.toString()}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFD83D] text-[#171717] font-mono font-bold text-xs uppercase tracking-wider border-2 border-[#171717] shadow-[3px_3px_0px_#171717] hover:bg-[#FFD83D]/90 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Muat Ulang Halaman
              </button>
              <a
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-[#171717] font-mono font-bold text-xs uppercase tracking-wider border-2 border-[#171717] shadow-[3px_3px_0px_#171717] hover:bg-[#F5F1E9] active:translate-x-0.5 active:translate-y-0.5 transition-all text-decoration-none"
              >
                <Home className="w-4 h-4" />
                Kembali ke Beranda
              </a>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
