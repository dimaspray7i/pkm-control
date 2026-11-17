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
}) {
  const heightClass =
    mode === 'full'
      ? 'min-h-screen'
      : mode === 'page'
      ? 'min-h-[60vh]'
      : 'py-12'

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 w-full ${heightClass} bg-[#F5F1E9]`}
      role="status"
      aria-live="polite"
      aria-label={text}
    >
      {/* Spinner */}
      <div className="relative">
        <Loader2
          className="w-10 h-10 text-[#FF2F92] animate-spin"
          strokeWidth={2.5}
        />
      </div>

      {/* Teks utama */}
      <div className="text-center space-y-1">
        <p className="font-body font-bold text-sm uppercase tracking-widest text-[#171717]">
          {text}
        </p>
        {subtext && (
          <p className="font-body text-xs text-[#171717]/60 max-w-xs mx-auto">
            {subtext}
          </p>
        )}
      </div>

      {/* Dekorasi strip PKM */}
      <div className="flex items-center gap-0.5 mt-1 opacity-40">
        <div className="w-4 h-1 bg-[#FF2F92]" />
        <div className="w-2 h-1 bg-[#171717]" />
        <div className="w-4 h-1 bg-[#B8A0F0]" />
        <div className="w-3 h-1 bg-[#FFD83D]" />
      </div>
    </div>
  )
}
