import React from 'react'

export default function StatCard({
  title,
  value,
  change,
  changeType = 'neutral', // 'positive' | 'negative' | 'neutral'
  icon: Icon,
  variant = 'white', // 'white' | 'pink' | 'yellow' | 'lavender'
  subtext,
  onClick,
}) {
  const variantStyles = {
    white: {
      bg: 'bg-white',
      text: 'text-[#171717]',
      titleColor: 'text-[#171717]/70',
      iconBg: 'bg-[#F5F1E9]',
      iconColor: 'text-[#171717]',
    },
    pink: {
      bg: 'bg-[#FF2F92]',
      text: 'text-white',
      titleColor: 'text-white/90',
      iconBg: 'bg-white/20',
      iconColor: 'text-white',
    },
    yellow: {
      bg: 'bg-[#FFD83D]',
      text: 'text-[#171717]',
      titleColor: 'text-[#171717]/80',
      iconBg: 'bg-white/40',
      iconColor: 'text-[#171717]',
    },
    lavender: {
      bg: 'bg-[#B8A0F0]',
      text: 'text-[#171717]',
      titleColor: 'text-[#171717]/80',
      iconBg: 'bg-white/40',
      iconColor: 'text-[#171717]',
    },
  }

  const v = variantStyles[variant] || variantStyles.white

  return (
    <div 
      onClick={onClick}
      className={`p-4 border-1.5 border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] flex flex-col justify-between ${v.bg} ${v.text} ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#171717] transition-all' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-[10px] font-black uppercase tracking-wider ${v.titleColor}`}>
          {title}
        </span>
        {Icon && (
          <div className={`w-7 h-7 rounded-md border border-[#171717] flex items-center justify-center shrink-0 ${v.iconBg} ${v.iconColor}`}>
            <Icon size={14} strokeWidth={2.4} />
          </div>
        )}
      </div>

      <div className="my-1">
        <span className="font-display text-3xl sm:text-4xl leading-none tracking-tight">
          {value}
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] font-bold mt-1 pt-1 border-t border-[#171717]/15">
        {change && (
          <span className={variant === 'pink' ? 'text-white/90' : changeType === 'positive' ? 'text-emerald-700' : changeType === 'negative' ? 'text-[#FF2F92]' : 'text-[#171717]/60'}>
            {change}
          </span>
        )}
        {subtext && (
          <span className={variant === 'pink' ? 'text-white/70' : 'text-[#171717]/50'}>
            {subtext}
          </span>
        )}
      </div>
    </div>
  )
}
