import { Link } from 'react-router-dom'
import { Home, ArrowLeft, AlertTriangle } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F5F1E9] flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center space-y-6">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FFD83D] border-2 border-[#171717] shadow-[3px_3px_0px_#171717]">
          <AlertTriangle size={14} className="text-[#171717]" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[#171717]">
            KESALAHAN NAVIGASI
          </span>
        </div>

        {/* 404 Display */}
        <div className="relative select-none">
          <div className="text-[140px] sm:text-[180px] font-black text-[#171717] leading-none tracking-tighter">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-2 bg-[#FF2F92] border-y-2 border-[#171717] mt-6" />
          </div>
        </div>

        {/* Message Box */}
        <div className="bg-white border-[3px] border-[#171717] shadow-[6px_6px_0px_#171717] p-6 space-y-3 text-left">
          <h1 className="font-mono font-black text-xl sm:text-2xl text-[#171717] uppercase tracking-tight">
            Halaman Tidak Ditemukan
          </h1>
          <p className="font-mono text-xs sm:text-sm text-[#171717]/70 leading-relaxed">
            Halaman yang Anda cari tidak tersedia atau telah dipindahkan.
            Pastikan URL yang dimasukkan sudah benar, atau gunakan navigasi
            di bawah untuk kembali ke halaman yang sesuai.
          </p>
          <div className="pt-1 font-mono text-[10px] text-[#171717]/50 bg-[#F5F1E9] px-3 py-2 border border-[#171717]/20 rounded">
            Kode Error: <strong className="text-[#FF2F92]">404 — Tidak Ditemukan</strong>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#FF2F92] text-white border-2 border-[#171717] shadow-[4px_4px_0px_#171717] font-mono font-black text-xs uppercase tracking-wide hover:bg-[#e0267d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0px_#171717] transition-all"
          >
            <Home size={15} />
            Kembali ke Beranda
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white text-[#171717] border-2 border-[#171717] shadow-[4px_4px_0px_#171717] font-mono font-bold text-xs uppercase tracking-wide hover:bg-[#F5F1E9] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0px_#171717] transition-all cursor-pointer"
          >
            <ArrowLeft size={15} />
            Halaman Sebelumnya
          </button>
        </div>

        {/* Footer stamp */}
        <p className="font-mono text-[9px] text-[#171717]/40 uppercase tracking-widest">
          PKM Control Center &mdash; PT Potensi Karya Mandiri
        </p>
      </div>
    </div>
  )
}
