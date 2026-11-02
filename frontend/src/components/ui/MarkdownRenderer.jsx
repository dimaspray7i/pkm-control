import React from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MarkdownRenderer({ content, className = '' }) {
  if (!content) return null

  return (
    <div className={`markdown-content text-xs text-[#171717] leading-relaxed space-y-2.5 ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="font-display text-base font-black uppercase text-[#171717] tracking-tight mt-3 mb-1.5 pb-1 border-b border-[#171717]/20" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="font-display text-sm font-black uppercase text-[#171717] tracking-tight mt-3 mb-1" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="font-display text-xs font-black uppercase text-[#FF2F92] tracking-wide mt-2.5 mb-1" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="font-display text-xs font-bold uppercase text-[#171717] mt-2 mb-0.5" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="my-1.5 leading-relaxed font-medium" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-5 my-1.5 space-y-1" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-5 my-1.5 space-y-1 font-semibold" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="my-0.5 pl-0.5" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-black text-[#171717]" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic text-[#171717]/85" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-3 border-[#FF2F92] pl-3 py-1 my-2 bg-white/60 italic text-[#171717]/90 rounded-r" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-2.5">
              <table className="w-full text-left text-[11px] border-collapse border border-[#171717] bg-white rounded" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-[#FAF7F2] border-b border-[#171717] font-black uppercase text-[10px]" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="py-1.5 px-2.5 border-r border-[#171717] last:border-r-0 font-bold" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="py-1.5 px-2.5 border-t border-[#171717]/20 border-r border-[#171717]/20 last:border-r-0 font-medium" {...props} />
          ),
          code: ({ node, inline, ...props }) => (
            <code className="px-1.5 py-0.5 bg-white border border-[#171717]/30 rounded text-[11px] font-mono text-[#FF2F92]" {...props} />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-3 border-[#171717]/20" {...props} />
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}
