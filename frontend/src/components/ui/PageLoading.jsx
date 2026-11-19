import { Loader2 } from 'lucide-react'

/**
 * PageLoading — Komponen loading global PKM Control Center.
 * Gunakan komponen ini di seluruh halaman untuk memastikan konsistensi visual.
 *
 * Mode:
 *   "full"      — Application boot / session restore (min-h-screen)
 *   "page"      — Halaman sedang fetch data utama (min-h-[60vh])
 *   "component" — Bagian kecil dalam halaman, tabel, atau card (py-12)
 *
 * @param {string}  mode    - "full" | "page" | "component"
 * @param {string}  text    - Teks yang ditampilkan di bawah spinner
 * @param {string}  subtext - Teks sekunder opsional
 */
export default function PageLoading({
  mode = 'page',
  text = 'Memuat data...',
  subtext = null,
  className = '',
  transparent = false,
}) {
  if (mode === 'button') {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`} role="status">
        <Loader2 className="w-3.5 h-3.5 text-current animate-spin" strokeWidth={2.5} />
        {text && <span>{text}</span>}
      </span>
    )
  }

  const heightClass =
    mode === 'full'
      ? 'min-h-screen'
      : mode === 'page'
      ? 'min-h-[55vh]'
      : 'py-10'

  const bgClass =
    transparent || mode === 'component'
      ? 'bg-transparent'
      : 'bg-[#F5F1E9]'

  const spinnerSize =
    mode === 'component'
      ? 'w-8 h-8'
      : 'w-10 h-10'

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 w-full ${heightClass} ${bgClass} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={text}
    >
      {/* Spinner */}
      <div className="relative">
        <Loader2
          className={`${spinnerSize} text-[#FF2F92] animate-spin`}
          strokeWidth={2.5}
        />
      </div>

      {/* Teks utama */}
      <div className="text-center space-y-1">
        <p className={`font-body font-black uppercase tracking-wider text-[#171717] ${mode === 'component' ? 'text-xs' : 'text-sm tracking-widest'}`}>
          {text}
        </p>
        {subtext && (
          <p className="font-body text-xs text-[#171717]/65 max-w-xs mx-auto">
            {subtext}
          </p>
        )}
      </div>

      {/* Dekorasi strip PKM */}
      <div className="flex items-center gap-0.5 mt-0.5 opacity-40">
        <div className="w-4 h-1 bg-[#FF2F92]" />
        <div className="w-2 h-1 bg-[#171717]" />
        <div className="w-4 h-1 bg-[#B8A0F0]" />
        <div className="w-3 h-1 bg-[#FFD83D]" />
      </div>
    </div>
  )
}
