
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
  ArrowUpRight,
  FolderKanban,
  Users,
  Sparkles,
  ShieldCheck,
} from 'lucide-react'

const features = [
  {
    icon: FolderKanban,
    title: 'Manajemen Proyek',
    description: 'Pantau milestone, progres, dan timeline proyek.',
    color: '#FF2F92',
  },
  {
    icon: Users,
    title: 'Kolaborasi Tim',
    description: 'Kelola tugas dan kapasitas tim lebih terarah.',
    color: '#FFD83D',
  },
  {
    icon: Sparkles,
    title: 'Analisis AI',
    description: 'Temukan risiko dan insight untuk keputusan bisnis.',
    color: '#B8A0F0',
  },
]

export default function Login() {
  const [email, setEmail] = useState('admin@pkm.co.id')
  const [password, setPassword] = useState('admin123')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotNotice, setForgotNotice] = useState(false)

  const { user, login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setForgotNotice(false)

    if (!email.trim()) {
      setError('Email atau username wajib diisi.')
      return
    }

    if (!password) {
      setError('Password wajib diisi.')
      return
    }

    setLoading(true)

    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      console.error('Login error:', err)
      setError(
        err.response?.data?.errors?.email?.[0] ||
          err.response?.data?.message ||
          'Email atau password salah. Silakan periksa kembali kredensial Anda.'
      )
    } finally {
      setLoading(false)
    }
  }

  const fillDemoAccount = () => {
    setEmail('admin@pkm.co.id')
    setPassword('admin123')
    setError('')
    setForgotNotice(false)
  }

  return (
    <div className="login-page">
      <header className="login-header">
        <a href="/login" className="login-brand" aria-label="PKM Login">
          <span className="login-brand-name">PKM<span>.</span></span>
          <span className="login-brand-divider" />
          <span className="login-brand-caption">
            BUSINESS CONTROL
            <br />
            CENTER
          </span>
        </a>

        <div className="login-header-message">
          <div>
            <span>SMARTER ANALYSIS</span>
            <span>BETTER DECISIONS</span>
            <span>BIGGER IMPACT</span>
          </div>
          <div className="login-header-icon">
            <ArrowUpRight size={21} strokeWidth={2.5} />
          </div>
        </div>
      </header>

      <main className="login-main">
        <section className="login-intro">
          <div className="login-version">
            <span className="login-status-dot" />
            PT POTENSI KARYA MANDIRI
            <span className="login-version-number">V1.0.0</span>
          </div>

          <div className="login-headline">
            <p className="login-eyebrow">PROJECT & BUSINESS MANAGEMENT</p>
            <h1>
              TAKE CONTROL
              <br />
              OF YOUR
              <br />
              <span>BUSINESS.</span>
            </h1>
            <p className="login-description">
              Satu platform untuk mengelola proyek, menyelaraskan tim,
              memantau progres, dan mengambil keputusan bisnis dengan lebih
              percaya diri.
            </p>
          </div>

          <div className="login-features">
            {features.map((feature) => {
              const Icon = feature.icon

              return (
                <article className="login-feature" key={feature.title}>
                  <div
                    className="login-feature-icon"
                    style={{ backgroundColor: feature.color }}
                  >
                    <Icon size={19} strokeWidth={2.2} />
                  </div>
                  <h2>{feature.title}</h2>
                  <p>{feature.description}</p>
                </article>
              )
            })}
          </div>

          <div className="login-manifesto">
            <span className="login-manifesto-line" />
            <p>Lebih Terarah, Lebih Berdampak.</p>
          </div>

          <div className="login-decoration" aria-hidden="true">
            PKM
          </div>
        </section>

        <section className="login-form-section">
          <div className="login-card">
            <div className="login-card-top">
              <div className="login-card-label">
                <ShieldCheck size={14} />
                PORTAL OTORISASI
              </div>
              <span className="login-card-index">01 / ACCESS</span>
            </div>

            <div className="login-form-heading">
              <h2>Selamat Datang.</h2>
              <p>
                Masuk ke akun Anda untuk melanjutkan ke Business Control
                Center.
              </p>
            </div>

            {error && (
              <div className="login-alert" role="alert">
                <AlertCircle size={18} />
                <p>{error}</p>
              </div>
            )}

            {forgotNotice && (
              <div className="login-notice" role="status">
                Silakan hubungi Administrator IT PT PKM untuk reset kata sandi.
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-field">
                <label htmlFor="login-email">EMAIL / USERNAME</label>
                <div className="login-input-wrap">
                  <Mail size={18} />
                  <input
                    id="login-email"
                    type="text"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@perusahaan.co.id"
                    required
                  />
                </div>
              </div>

              <div className="login-field">
                <div className="login-label-row">
                  <label htmlFor="login-password">KATA SANDI</label>
                  <button
                    type="button"
                    className="login-forgot"
                    onClick={() => setForgotNotice((value) => !value)}
                  >
                    Lupa password?
                  </button>
                </div>

                <div className="login-input-wrap">
                  <Lock size={18} />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    required
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <label className="login-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="login-custom-checkbox" />
                <span>Ingat saya di perangkat ini</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="login-submit"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="login-spinner" />
                    MEMVERIFIKASI...
                  </>
                ) : (
                  <>
                    MASUK KE DASHBOARD
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="login-demo">
              <div className="login-demo-heading">
                <span>AKSES DEMO</span>
                <span>TEST ACCOUNT</span>
              </div>
              <p>Gunakan akun demo untuk mengisi kredensial dengan cepat.</p>
              <button
                type="button"
                onClick={fillDemoAccount}
                className="login-demo-button"
              >
                <span className="login-demo-avatar">A</span>
                <span className="login-demo-account">
                  <strong>Administrator</strong>
                  <small>admin@pkm.co.id</small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            </div>

            <div className="login-card-footer">
              <ShieldCheck size={15} />
              <span>Akses aman untuk pengguna terdaftar</span>
            </div>
          </div>

          <p className="login-outside-note">
            PLATFORM TERPADU UNTUK KINERJA YANG LEBIH BAIK
          </p>
        </section>
      </main>

      <footer className="login-footer">
        <p>
          © {new Date().getFullYear()} PT POTENSI KARYA MANDIRI
        </p>
        <div className="login-footer-right">
          <span>
            <span className="login-footer-dot" />
            SISTEM AKTIF
          </span>
          <span>PRIVASI & KEAMANAN</span>
          <span>BANTUAN</span>
        </div>
      </footer>
    </div>
  )
}
