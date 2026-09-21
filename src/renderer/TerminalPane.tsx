import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'
import type { PtySpawnRequest } from '@shared/types'
import { GROK_NEWLINE, isNewlineChord } from '@shared/keys'

type PastedImage = { path: string; dataUrl: string }

type Props = {
  tabId: string
  cwd: string
  resumeId?: string
  firstPrompt?: string
  active: boolean
  visible: boolean
  onImage?: (image: PastedImage) => void
  onSession?: (sessionId: string) => void
}

export default function TerminalPane({
  tabId,
  cwd,
  resumeId,
  firstPrompt,
  active,
  visible,
  onImage,
  onSession
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const onImageRef = useRef(onImage)
  const onSessionRef = useRef(onSession)
  const initialResumeId = useRef(resumeId)
  onImageRef.current = onImage
  onSessionRef.current = onSession

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
      theme: {
        background: '#0c0c0e',
        foreground: '#e6e6ea',
        cursor: '#e6e6ea',
        selectionBackground: '#3d4a80'
      },
      allowProposedApi: true,
      scrollback: 5000,
      macOptionIsMeta: true
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host)
    try {
      term.loadAddon(new WebglAddon())
    } catch {
      // canvas renderer is fine
    }
    fit.fit()
    termRef.current = term
    fitRef.current = fit

    const request: PtySpawnRequest = {
      tabId,
      cwd,
      cols: term.cols,
      rows: term.rows,
      resumeId: initialResumeId.current,
      firstPrompt
    }

    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true
      if (!isNewlineChord(event)) return true
      window.api.writePty(tabId, GROK_NEWLINE)
      return false
    })
    term.onData((data) => window.api.writePty(tabId, data))
    const unsubData = window.api.onPtyData((id, data) => {
      if (id === tabId) term.write(data)
    })
    const unsubExit = window.api.onPtyExit((id) => {
      if (id === tabId) term.writeln('\r\n\x1b[90msession exited\x1b[0m')
    })

    const spawnedAt = Date.now()
    void window.api.spawnPty(request).then((result) => {
      if (!result.ok) {
        term.writeln(`\r\n\x1b[31m${result.error}\x1b[0m`)
        return
      }
      if (!initialResumeId.current) {
        window.setTimeout(() => {
          void window.api.latestSessionId(cwd, spawnedAt - 2000).then((id) => {
            if (id) onSessionRef.current?.(id)
          })
        }, 2000)
      }
    })

    const onKey = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey)) return
      const key = event.key.toLowerCase()
      if (key === 'c' && term.hasSelection()) {
        event.preventDefault()
        event.stopPropagation()
        void window.api.writeClipboard(term.getSelection())
      }
      if (key === 'v') {
        event.preventDefault()
        event.stopPropagation()
        void window.api.pasteClipboard().then((result) => {
          if (result.kind === 'image') {
            window.api.writePty(tabId, `@${result.path} `)
            onImageRef.current?.(result)
            return
          }
          if (result.kind === 'text') window.api.writePty(tabId, result.text)
        })
      }
    }
    host.addEventListener('keydown', onKey)

    const onDragOver = (event: DragEvent): void => {
      event.preventDefault()
    }
    const onDrop = (event: DragEvent): void => {
      event.preventDefault()
      const files = [...(event.dataTransfer?.files ?? [])]
      for (const file of files) {
        const path = (file as File & { path?: string }).path
        if (!path) continue
        window.api.writePty(tabId, `@${path} `)
        if (file.type.startsWith('image/')) {
          void window.api.previewPath(path).then((dataUrl) => {
            if (dataUrl) onImageRef.current?.({ path, dataUrl })
          })
        }
      }
    }
    host.addEventListener('dragover', onDragOver)
    host.addEventListener('drop', onDrop)

    const observer = new ResizeObserver(() => {
      fit.fit()
      window.api.resizePty(tabId, term.cols, term.rows)
    })
    observer.observe(host)

    return () => {
      observer.disconnect()
      host.removeEventListener('keydown', onKey)
      host.removeEventListener('dragover', onDragOver)
      host.removeEventListener('drop', onDrop)
      unsubData?.()
      unsubExit?.()
      void window.api.killPty(tabId)
      term.dispose()
      termRef.current = null
    }
  }, [tabId, cwd, firstPrompt])

  useEffect(() => {
    if (!visible) return
    fitRef.current?.fit()
    const term = termRef.current
    if (term) window.api.resizePty(tabId, term.cols, term.rows)
    if (active) termRef.current?.focus()
  }, [active, visible, tabId])

  return (
    <div
      ref={hostRef}
      className="h-full w-full p-2"
      style={{ display: visible ? 'block' : 'none' }}
    />
  )
}
