import { createContext, useContext, useState, useEffect } from 'react'
import api, { getValidToken } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Sesi hanya valid jika terdapat token otentikasi yang sah di localStorage
    const token = getValidToken()
    if (!token) {
      localStorage.removeItem('user')
      return null
    }
    try {
      const saved = localStorage.getItem('user')
      if (!saved || saved === 'undefined' || saved === 'null') return null
      return JSON.parse(saved)
    } catch {
      return null
    }
  })
  
  const [loading, setLoading] = useState(() => {
    const token = getValidToken()
    const saved = localStorage.getItem('user')
    const hasValidSavedUser = Boolean(saved && saved !== 'undefined' && saved !== 'null')
    return Boolean(token && !hasValidSavedUser)
  })

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = getValidToken()
    if (!token) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const response = await api.get('/me')
      const userData = response.data?.user
      if (userData) {
        setUser(userData)
        localStorage.setItem('user', JSON.stringify(userData))
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      // HANYA hapus sesi jika server secara eksplisit mengembalikan 401 Unauthorized
      // Timeout jaringan, server sibuk, atau 500 tidak boleh menghapus token pengguna!
      if (error.response?.status === 401) {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user')
        setUser(null)
      }
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    const response = await api.post('/login', { email, password })
    const { user, token } = response.data
    
    if (!token || typeof token !== 'string' || token === 'undefined' || token === 'null' || !token.trim()) {
      throw new Error('Server tidak mengembalikan token autentikasi yang valid.')
    }

    const cleanToken = token.trim()
    localStorage.setItem('auth_token', cleanToken)
    if (user) {
      localStorage.setItem('user', JSON.stringify(user))
      setUser(user)
    }
    
    return user
  }

  const logout = async () => {
    try {
      const token = getValidToken()
      if (token) {
        await api.post('/logout')
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')
      setUser(null)
    }
  }

  const hasRole = (role) => {
    return user?.role === role
  }

  const hasAnyRole = (roles) => {
    return Boolean(roles?.includes(user?.role))
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole, hasAnyRole, checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
