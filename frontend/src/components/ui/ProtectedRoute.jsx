import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Loader2 } from 'lucide-react'

export default function ProtectedRoute({ children, allowedRoles = null }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-cream)' }}
      >
        <div className="text-center">
          <Loader2 size={48} className="animate-spin mx-auto mb-4" style={{ color: 'var(--color-pink)' }} />
          <p className="font-bold uppercase tracking-widest">Memuat...</p>
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
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: 'var(--color-cream)' }}
      >
        <div 
          className="bg-yellow p-8 max-w-md w-full"
          style={{
            border: '3px solid var(--color-ink)',
            boxShadow: '6px 6px 0px var(--color-ink)',
          }}
        >
          <h1 className="font-display text-3xl mb-4">Akses Ditolak.</h1>
          <p className="font-semibold">
            Anda tidak memiliki izin untuk mengakses halaman ini.
          </p>
          <p className="text-sm mt-2 font-mono">
            Role Anda: <strong>{user.role}</strong>
          </p>
        </div>
      </div>
    )
  }

  return children
}