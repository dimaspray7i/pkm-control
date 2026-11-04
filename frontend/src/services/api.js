
import axios from 'axios'

export const getValidToken = () => {
  try {
    const token = localStorage.getItem('auth_token')
    if (!token) return null

    const trimmed = typeof token === 'string' ? token.trim() : ''

    if (
      !trimmed ||
      trimmed === 'undefined' ||
      trimmed === 'null' ||
      trimmed === '[object Object]'
    ) {
      localStorage.removeItem('auth_token')
      return null
    }

    return trimmed
  } catch {
    return null
  }
}

// Otomatis memilih API berdasarkan lingkungan aplikasi
const API_BASE_URL = import.meta.env.DEV
  ? 'http://127.0.0.1:8000/api'
  : '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 10000,
})

// Menambahkan token ke setiap request
api.interceptors.request.use((config) => {
  const token = getValidToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  } else {
    delete config.headers.Authorization
  }

  return config
})

// Mencegah redirect loop
let isRedirecting = false

// Error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      axios.isCancel(error) ||
      error.name === 'CanceledError' ||
      error.code === 'ERR_CANCELED'
    ) {
      return Promise.reject(error)
    }

    if (error.response && error.response.status === 401) {
      const isAuthEndpoint =
        error.config?.url?.includes('/login') ||
        error.config?.url?.includes('/register')

      if (!isAuthEndpoint) {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user')

        if (
          typeof window !== 'undefined' &&
          window.location.pathname !== '/login' &&
          !isRedirecting
        ) {
          isRedirecting = true
          window.location.href = '/login'
        }
      }
    } else if (error.response && error.response.status === 403) {
      console.warn(
        'Akses Ditolak (HTTP 403): Pengguna tidak memiliki izin:',
        error.config?.url
      )
    } else if (error.code === 'ECONNABORTED') {
      console.warn(
        'Request Timeout (10000ms):',
        error.config?.url
      )
    }

    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export default api