import { X } from 'lucide-react'
import { type ReactNode } from 'react'
import { parseReadme } from '@shared/readme'

function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const token = match[0]
    if (token.startsWith('**')) {
      parts.push(
        <strong key={key} className="font-semibold text-zinc-100">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('`')) {
      parts.push(
        <code key={key} className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-[11px] text-amber-200">
          {token.slice(1, -1)}
        </code>
      )
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (link) {
        parts.push(
          <a
            key={key}
            href={link[2]}
            className="text-sky-400 underline decoration-sky-400/40"
            onClick={(event) => {
              event.preventDefault()
              void window.api.openUrl(link[2])
            }}
          >
            {link[1]}
          </a>
        )
      }
    }
    key += 1
    last = match.index + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export default function ReadmeView({ markdown, onClose }: { markdown: string; onClose: () => void }) {
  const blocks = parseReadme(markdown)
  return (
    <div className="absolute inset-0 z-40 flex items-stretch justify-center bg-black/70 p-6" onClick={onClose}>
      <div
        className="flex w-[46rem] max-w-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <div className="text-sm font-medium">Cockpit README</div>
            <div className="text-[11px] text-zinc-500">Shortcuts and how this app is meant to be used</div>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              ⌘⇧/
            </kbd>
            <button className="rounded p-1 text-zinc-400 hover:text-white" onClick={onClose}>
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {blocks.map((block, index) => {
            if (block.type === 'h1') {
              return (
                <h1 key={index} className="mb-3 text-xl font-semibold tracking-tight">
                  {block.text}
                </h1>
              )
            }
            if (block.type === 'h2') {
              return (
                <h2 key={index} className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                  {block.text}
                </h2>
              )
            }
            if (block.type === 'code') {
              return (
                <pre
                  key={index}
                  className="mb-4 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 p-3 font-mono text-[11px] leading-5 text-zinc-200"
                >
                  {block.text}
                </pre>
              )
            }
            if (block.type === 'ul') {
              return (
                <ul key={index} className="mb-4 list-disc space-y-1.5 pl-5 text-[13px] leading-5 text-zinc-300">
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{inline(item)}</li>
                  ))}
                </ul>
              )
            }
            if (block.type === 'checks') {
              return (
                <ul key={index} className="mb-4 space-y-1.5 text-[13px] text-zinc-300">
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex gap-2">
                      <span className="text-zinc-500">{item.done ? '☑' : '☐'}</span>
                      <span>{inline(item.text)}</span>
                    </li>
                  ))}
                </ul>
              )
            }
            return (
              <p key={index} className="mb-3 text-[13px] leading-6 text-zinc-300">
                {inline(block.text)}
              </p>
            )
          })}
        </div>
      </div>
    </div>
  )
}
