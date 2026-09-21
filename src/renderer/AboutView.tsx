import { X } from 'lucide-react'
import { useState } from 'react'

const GITHUB = 'https://github.com/Arjun2908/worktree-manager'

export default function AboutView({ onClose }: { onClose: () => void }) {
  const [note, setNote] = useState<string | null>(null)

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-8" onClick={onClose}>
      <div
        className="w-[34rem] max-w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pb-2 pt-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Built by</div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Arjun Gupta</h2>
            <p className="mt-1 text-[13px] text-zinc-400">Software engineer at Nutshell.</p>
          </div>
          <button className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="px-6 pb-6 pt-4">
          <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-5">
            <div className="text-[11px] uppercase tracking-[0.14em] text-amber-200/80">Also built</div>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <h3 className="text-lg font-medium">Worktree Manager</h3>
              <span className="font-mono text-[11px] text-zinc-500">1.1.3</span>
            </div>
            <p className="mt-2 text-[13px] leading-6 text-zinc-400">
              A macOS app for the Git worktrees that pile up from Claude, Cursor, and Grok — see what they are,
              whether they’re safe to delete, and clean them up.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                className="rounded-lg bg-zinc-100 px-3 py-2 text-[13px] font-medium text-zinc-900"
                onClick={() => void window.api.openUrl(GITHUB)}
              >
                View on GitHub
              </button>
              <button
                className="rounded-lg border border-zinc-700 px-3 py-2 text-[13px] text-zinc-200 hover:bg-zinc-900"
                onClick={async () => {
                  const result = await window.api.openWorktreeManager()
                  setNote(
                    result.opened === 'app'
                      ? 'Opened Worktree Manager.'
                      : `App isn’t installed. Opened ${result.path}.`
                  )
                }}
              >
                Open app
              </button>
            </div>
            {note && <p className="mt-3 text-[12px] text-zinc-500">{note}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
