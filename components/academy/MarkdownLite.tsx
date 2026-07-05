'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Renderer markdown materi Academy — styling mengikuti palet app (#0F6E56 / #E5E3DC).
// Tabel penting untuk materi Excel, makanya pakai remark-gfm.
export default function MarkdownLite({ content }: { content: string }) {
  return (
    <div className="academy-md text-sm text-[#444441] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => <h2 className="font-serif font-bold text-[#0F6E56] text-lg mt-5 mb-2 first:mt-0" {...props} />,
          h2: (props) => <h2 className="font-serif font-bold text-[#0F6E56] text-base mt-5 mb-2 first:mt-0" {...props} />,
          h3: (props) => <h3 className="font-semibold text-[#111111] text-sm mt-4 mb-1.5" {...props} />,
          p: (props) => <p className="mb-3" {...props} />,
          ul: (props) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
          ol: (props) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
          strong: (props) => <strong className="font-semibold text-[#111111]" {...props} />,
          a: (props) => <a className="text-[#0F6E56] underline" target="_blank" rel="noopener noreferrer" {...props} />,
          blockquote: (props) => (
            <blockquote className="border-l-2 border-[#0F6E56] bg-[#E1F5EE]/50 rounded-r-lg pl-3 py-2 pr-2 mb-3 text-[#0F6E56]" {...props} />
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = /language-/.test(className || '')
            return isBlock ? (
              <code className="block bg-[#111111] text-[#E1F5EE] rounded-lg p-3 text-xs overflow-x-auto mb-3 font-mono" {...props}>{children}</code>
            ) : (
              <code className="bg-[#FAEEDA] text-[#854F0B] rounded px-1 py-0.5 text-[12px] font-mono" {...props}>{children}</code>
            )
          },
          pre: (props) => <pre className="mb-0" {...props} />,
          table: (props) => (
            <div className="overflow-x-auto mb-3 rounded-lg border border-[#E5E3DC]">
              <table className="w-full text-xs" {...props} />
            </div>
          ),
          th: (props) => <th className="bg-[#FAFAF7] border-b border-[#E5E3DC] px-2.5 py-1.5 text-left font-semibold text-[#111111]" {...props} />,
          td: (props) => <td className="border-b border-[#F1EFE8] px-2.5 py-1.5 align-top" {...props} />,
          hr: () => <hr className="border-[#E5E3DC] my-4" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
