import { existsSync } from 'node:fs'
import type { BrowserWindow } from 'electron'
import { spawn, type IPty } from 'node-pty'
import type { PtySpawnRequest } from '../shared/types'
import { grokBinary } from './settings'

type Session = {
  pty: IPty
  cwd: string
  quietTimer?: NodeJS.Timeout
}

const sessions = new Map<string, Session>()
const suppressedExits = new Set<string>()
const QUIET_MS = 8000

function grokArgs(request: PtySpawnRequest): string[] {
  const args: string[] = []
  if (request.resumeId) args.push('--resume', request.resumeId)
  if (request.firstPrompt) args.push(request.firstPrompt)
  return args
}

export function spawnGrok(win: BrowserWindow, request: PtySpawnRequest): { ok: true } | { ok: false; error: string } {
  killTab(request.tabId)
  const bin = grokBinary()
  if (!existsSync(bin)) {
    return { ok: false, error: `grok binary not found at ${bin}` }
  }
  if (!existsSync(request.cwd)) {
    return { ok: false, error: `working directory does not exist: ${request.cwd}` }
  }

  const pty = spawn(bin, grokArgs(request), {
    name: 'xterm-256color',
    cols: Math.max(request.cols, 40),
    rows: Math.max(request.rows, 12),
    cwd: request.cwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      // Same family as VS Code's xterm.js: Grok skips Kitty keyboard protocol
      // and treats Alt+Enter as newline. We map Shift+Enter to that sequence.
      TERM_PROGRAM: 'vscode'
    }
  })

  sessions.set(request.tabId, { pty, cwd: request.cwd })

  pty.onData((data) => {
    if (!win.isDestroyed()) win.webContents.send('pty:data', request.tabId, data)
    const session = sessions.get(request.tabId)
    if (!session) return
    if (session.quietTimer) clearTimeout(session.quietTimer)
    session.quietTimer = setTimeout(() => {
      if (!win.isDestroyed()) win.webContents.send('pty:quiet', request.tabId)
    }, QUIET_MS)
  })
  pty.onExit(({ exitCode }) => {
    sessions.delete(request.tabId)
    if (suppressedExits.delete(request.tabId)) return
    if (!win.isDestroyed()) win.webContents.send('pty:exit', request.tabId, exitCode)
  })

  return { ok: true }
}

export function writeTab(tabId: string, data: string): void {
  sessions.get(tabId)?.pty.write(data)
}

export function resizeTab(tabId: string, cols: number, rows: number): void {
  const session = sessions.get(tabId)
  if (!session) return
  session.pty.resize(Math.max(cols, 20), Math.max(rows, 8))
}

export function killTab(tabId: string): void {
  const session = sessions.get(tabId)
  if (!session) return
  suppressedExits.add(tabId)
  if (session.quietTimer) clearTimeout(session.quietTimer)
  try {
    session.pty.kill()
  } catch {
    // already dead
  }
  sessions.delete(tabId)
}

export function killAll(): void {
  for (const tabId of [...sessions.keys()]) killTab(tabId)
}

export function tabCwd(tabId: string): string | undefined {
  return sessions.get(tabId)?.cwd
}
