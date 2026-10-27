import React from 'react'

export default function PageHeader({ 
  title, 
  subtitle, 
  tag = "PKM CONTROL", 
  actions = null,
  badge = null 
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          {tag && (
            <span className="px-2 py-0.5 bg-[#FFD83D] border border-[#171717] rounded text-[9px] font-black uppercase tracking-wider text-[#171717] shadow-[1px_1px_0px_#171717]">
              {tag}
            </span>
          )}
          {badge && (
            <span className="px-2 py-0.5 bg-[#B8A0F0] border border-[#171717] rounded text-[9px] font-black uppercase tracking-wider text-[#171717]">
              {badge}
            </span>
          )}
        </div>
        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl leading-tight text-[#171717] uppercase tracking-tight flex items-baseline gap-1.5">
          <span>{title}</span>
          <span className="w-2.5 h-2.5 bg-[#FF2F92] border border-[#171717] inline-block mb-0.5"></span>
        </h1>
        {subtitle && (
          <p className="mt-1 text-xs sm:text-sm font-semibold text-[#171717]/70 leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  )
}
