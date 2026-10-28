import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Loader2, ShieldAlert, ArrowLeft } from 'lucide-react'

export default function ProtectedRoute({ children, allowedRoles = null }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center bg-[#F5F1E9]"
      >
        <div className="text-center">
          <Loader2 size={48} className="animate-spin mx-auto mb-4 text-[#FF2F92]" />
          <p className="font-bold uppercase tracking-widest text-[#171717]">Memuat Sesi...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 bg-[#F5F1E9]"
      >
        <div 
          className="bg-[#FFD83D] p-8 max-w-md w-full border-3 border-[#171717] shadow-[6px_6px_0px_#171717]"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-[#FF2F92] text-white flex items-center justify-center border-2 border-[#171717] shadow-[2px_2px_0px_#171717]">
              <ShieldAlert size={24} />
            </div>
            <h1 className="font-display font-black text-2xl uppercase tracking-wider text-[#171717]">Akses Ditolak</h1>
          </div>
          <p className="font-semibold text-[#171717]">
            Anda tidak memiliki izin untuk mengakses halaman ini.
          </p>
          <div className="text-xs mt-3 font-mono bg-white p-2 border-2 border-[#171717]">
            Role Aktif: <strong className="uppercase">{user.role}</strong>
          </div>
          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-[#171717] font-black text-xs uppercase tracking-wider border-2 border-[#171717] shadow-[3px_3px_0px_#171717] hover:bg-[#F5F1E9] active:translate-x-0.5 active:translate-y-0.5"
            >
              <ArrowLeft size={16} />
              Kembali ke Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return children
}
