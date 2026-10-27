import React from 'react'

export default function StatusBadge({ status, text, size = 'sm' }) {
  const norm = (status || text || '').toLowerCase().trim()

  let style = 'bg-[#EAE4D8] text-[#171717]'
  let label = text || status

  if (norm.includes('selesai') || norm.includes('completed') || norm.includes('on track') || norm.includes('done') || norm.includes('aktif') || norm.includes('active')) {
    style = 'bg-emerald-100 text-emerald-900 border-emerald-900'
  } else if (norm.includes('in progress') || norm.includes('berjalan') || norm.includes('review') || norm.includes('warning') || norm.includes('sedang')) {
    style = 'bg-[#FFD83D] text-[#171717] border-[#171717]'
  } else if (norm.includes('delayed') || norm.includes('terlambat') || norm.includes('tinggi') || norm.includes('high') || norm.includes('danger') || norm.includes('at risk')) {
    style = 'bg-[#FF2F92] text-white border-[#171717]'
  } else if (norm.includes('planning') || norm.includes('perencanaan') || norm.includes('rendah') || norm.includes('low')) {
    style = 'bg-[#B8A0F0] text-[#171717] border-[#171717]'
  } else if (norm.includes('admin') || norm.includes('pimpinan')) {
    style = 'bg-[#171717] text-white border-[#171717]'
  }

  const sizeClasses = size === 'xs' 
    ? 'px-1.5 py-0.5 text-[8.5px]' 
    : 'px-2.5 py-1 text-[10px]'

  return (
    <span className={`inline-flex items-center gap-1 font-black uppercase tracking-wider border rounded shadow-[1px_1px_0px_#171717] ${sizeClasses} ${style}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
      <span>{label}</span>
    </span>
  )
}
