import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { BrowserWindow } from 'electron'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  configFromResult,
  permissionFromRequest,
  questionFromRequest,
  eventsFromLogLine,
  eventsFromSessionLog,
  reduceNotification,
  reduceUpdate,
  type AcpEvent,
  type ConfigOption,
  type PermissionMode,
  type RpcCall
} from '../shared/acp'
import { grokBinary } from './settings'

type JsonRpc = {
  id?: number
  method?: string
  params?: Record<string, unknown>
  result?: Record<string, unknown>
  error?: { message?: string; data?: unknown }
}

type HeldRequest = {
  method: string
  params: Record<string, unknown>
}

type TerminalJob = {
  output: string
  exitCode: number | null
  done: Promise<void>
}

type Session = {
  proc: ChildProcessWithoutNullStreams
  sessionId: string | null
  cwd: string
  nextId: number
  pending: Map<number, (msg: JsonRpc) => void>
  held: Map<number, HeldRequest>
  terminals: Map<string, TerminalJob>
  mode: PermissionMode
  config: ConfigOption[]
  live: { stop: () => void } | null
}

const sessions = new Map<string, Session>()

export type AcpHost = {
  isDestroyed(): boolean
  send(channel: string, tabId: string, event: AcpEvent): void
}

function emit(win: BrowserWindow | AcpHost, tabId: string, event: AcpEvent): void {
  if (win.isDestroyed()) return
  if ('webContents' in win) win.webContents.send('acp:event', tabId, event)
  else win.send('acp:event', tabId, event)
}

function send(session: Session, method: string, params: unknown): number {
  const id = session.nextId++
  session.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  return id
}

function notify(session: Session, method: string, params: unknown): void {
  session.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n')
}

function reply(session: Session, id: number, body: { result?: unknown; error?: { code: number; message: string } }): void {
  session.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, ...body }) + '\n')
}

function request(session: Session, method: string, params: unknown, timeoutMs = 30_000): Promise<JsonRpc> {
  const id = send(session, method, params)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      session.pending.delete(id)
      reject(new Error(`${method} timed out`))
    }, timeoutMs)
    session.pending.set(id, (msg) => {
      clearTimeout(timer)
      resolve(msg)
    })
  })
}

function updatesPath(session: Session): string | null {
  return planPath(session)?.replace(/plan\.md$/, 'updates.jsonl') ?? null
}

function watchUpdates(win: BrowserWindow | AcpHost, tabId: string, session: Session): void {
  session.live?.stop()
  const path = updatesPath(session)
  if (!path) return
  let offset = existsSync(path) ? statSync(path).size : 0
  let carry = ''
  const timer = setInterval(() => {
    if (!existsSync(path)) return
    const size = statSync(path).size
    if (size < offset) offset = 0
    if (size === offset) return
    const fd = openSync(path, 'r')
    const buffer = Buffer.alloc(size - offset)
    const read = readSync(fd, buffer, 0, buffer.length, offset)
    closeSync(fd)
    offset += read
    carry += buffer.subarray(0, read).toString()
    const lines = carry.split('\n')
    carry = lines.pop() || ''
    for (const line of lines) {
      for (const event of eventsFromLogLine(line)) emit(win, tabId, event)
    }
  }, 250)
  session.live = {
    stop: () => {
      clearInterval(timer)
      session.live = null
    }
  }
}

function planPath(session: Session): string | null {
  if (!session.sessionId) return null
  return join(homedir(), '.grok', 'sessions', encodeURIComponent(session.cwd), session.sessionId, 'plan.md')
}

function emitPlan(win: BrowserWindow | AcpHost, tabId: string, session: Session, pending: boolean): void {
  const path = planPath(session)
  const markdown = path && existsSync(path) ? readFileSync(path, 'utf8') : ''
  emit(win, tabId, { type: 'plan', markdown, pending })
}

function beginTerminal(session: Session, params: Record<string, unknown>): string {
  const terminalId = `cockpit-${session.nextId}`
  const job: TerminalJob = { output: '', exitCode: null, done: Promise.resolve() }
  let settle = (): void => undefined
  job.done = new Promise<void>((resolve) => {
    settle = resolve
  })
  const child = spawn(String(params.command || ''), {
    cwd: String(params.cwd || session.cwd),
    shell: true,
    env: process.env
  })
  child.stdout?.on('data', (chunk: Buffer) => {
    job.output += chunk.toString()
  })
  child.stderr?.on('data', (chunk: Buffer) => {
    job.output += chunk.toString()
  })
  child.on('exit', (code) => {
    job.exitCode = code ?? 0
    settle()
  })
  child.on('error', () => {
    job.exitCode = 1
    settle()
  })
  session.terminals.set(terminalId, job)
  return terminalId
}

function answerTerminal(session: Session, msg: JsonRpc): boolean {
  if (msg.id == null || !msg.method?.startsWith('terminal/')) return false
  const terminalId = String(msg.params?.terminalId || '')
  const job = session.terminals.get(terminalId)
  if (msg.method === 'terminal/output') {
    reply(session, msg.id, { result: { output: job?.output || '', truncated: false } })
    return true
  }
  if (msg.method === 'terminal/wait_for_exit') {
    const requestId = msg.id
    void (job?.done ?? Promise.resolve()).then(() => {
      reply(session, requestId, { result: { exitCode: job?.exitCode ?? 0, signal: null } })
    })
    return true
  }
  if (msg.method === 'terminal/kill' || msg.method === 'terminal/release') {
    reply(session, msg.id, { result: {} })
    return true
  }
  return false
}

function handleClientRequest(win: BrowserWindow | AcpHost, tabId: string, session: Session, msg: JsonRpc): boolean {
  if (msg.id == null || !msg.method) return false
  if (answerTerminal(session, msg)) return true
  if (msg.method === 'session/request_permission') {
    const options = (msg.params?.options as Array<{ optionId?: string; name?: string }> | undefined) || []
    emit(win, tabId, {
      type: 'permission',
      permission: {
        id: `perm-${msg.id}`,
        requestId: msg.id,
        method: msg.method,
        title: String(msg.params?.title || options[0]?.name || 'Allow tool'),
        detail: JSON.stringify(msg.params || {}).slice(0, 500)
      }
    })
    return true
  }
  if (msg.method === '_x.ai/ask_user_question' || msg.method === 'x.ai/ask_user_question') {
    emit(win, tabId, { type: 'question', question: questionFromRequest(msg.id, msg.params || {}) })
    return true
  }
  if (msg.method === '_x.ai/exit_plan_mode' || msg.method === 'x.ai/exit_plan_mode') {
    const path = planPath(session)
    const markdown = path && existsSync(path) ? readFileSync(path, 'utf8') : ''
    emit(win, tabId, { type: 'plan', markdown, pending: true, requestId: msg.id })
    return true
  }
  if (msg.method === 'terminal/create' || msg.method === 'fs/write_text_file' || msg.method === 'fs/read_text_file') {
    const path = String(msg.params?.path || '')
    const planFile = planPath(session)
    const touchesPlan = planFile != null && path === planFile
    if (
      session.mode === 'always-approve' ||
      (session.mode === 'auto' && msg.method !== 'fs/write_text_file') ||
      touchesPlan
    ) {
      acceptClientRequest(session, msg.id, msg.method, msg.params || {})
      return true
    }
    if (session.mode === 'plan' && msg.method === 'fs/write_text_file' && path !== planFile) {
      reply(session, msg.id, { error: { code: -32000, message: 'plan mode only allows edits to plan.md' } })
      return true
    }
    session.held.set(msg.id, { method: msg.method, params: msg.params || {} })
    emit(win, tabId, { type: 'permission', permission: permissionFromRequest(msg.id, msg.method, msg.params || {}) })
    return true
  }
  return false
}

export async function startAcp(
  win: BrowserWindow | AcpHost,
  tabId: string,
  cwd: string,
  resumeId?: string,
  mode: PermissionMode = 'ask'
): Promise<{ ok: true; sessionId: string; config: ConfigOption[] } | { ok: false; error: string }> {
  stopAcp(tabId)
  const bin = grokBinary()
  if (!existsSync(bin)) return { ok: false, error: `grok binary not found at ${bin}` }
  const proc = spawn(bin, ['agent', '--no-leader', 'stdio'], {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe']
  })
  const session: Session = {
    proc,
    sessionId: null,
    cwd,
    nextId: 1,
    pending: new Map(),
    held: new Map(),
    terminals: new Map(),
    mode,
    config: [],
    live: null
  }
  sessions.set(tabId, session)
  const rl = createInterface({ input: proc.stdout })
  rl.on('line', (line) => {
    let msg: JsonRpc
    try {
      msg = JSON.parse(line) as JsonRpc
    } catch {
      return
    }
    if (msg.id != null && session.pending.has(msg.id) && (msg.result !== undefined || msg.error)) {
      session.pending.get(msg.id)?.(msg)
      session.pending.delete(msg.id)
      return
    }
    if (msg.method === 'session/update' && msg.params?.update) {
      for (const event of reduceUpdate(msg.params.update as never)) emit(win, tabId, event)
      return
    }
    if (msg.method && msg.id == null) {
      for (const event of reduceNotification(msg.method, msg.params || {})) emit(win, tabId, event)
    }
    if (msg.id != null && msg.method && handleClientRequest(win, tabId, session, msg)) return
  })
  proc.on('exit', (code) => {
    sessions.delete(tabId)
    emit(win, tabId, { type: 'status', text: `agent exited (${code ?? 0})` })
  })

  try {
    const init = await request(session, 'initialize', {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true }
    })
    if (init.error) return { ok: false, error: init.error.message || 'initialize failed' }
    const meta = (mode === 'always-approve' ? { yoloMode: true } : mode === 'auto' ? { autoMode: true } : {}) as Record<string, unknown>
    const created = resumeId
      ? await request(session, 'session/load', { sessionId: resumeId, cwd, mcpServers: [] }, 45_000)
      : await request(session, 'session/new', { cwd, mcpServers: [], _meta: meta }, 45_000)
    const sessionId = String(created.result?.sessionId || resumeId || '')
    if (!sessionId) return { ok: false, error: created.error?.message || 'no session id' }
    session.sessionId = sessionId
    session.config = configFromResult(created.result?.configOptions as Array<Record<string, unknown>> | undefined)
    if (mode !== 'ask') {
      const set = await request(session, 'session/set_mode', { sessionId, modeId: mode === 'always-approve' ? 'always_approve' : mode })
      if (set.error) emit(win, tabId, { type: 'error', text: set.error.message || 'set_mode failed' })
    }
    emit(win, tabId, { type: 'config', options: session.config })
    emit(win, tabId, { type: 'mode', mode })
    if (resumeId) {
      const updates = planPath(session)?.replace(/plan\.md$/, 'updates.jsonl')
      if (updates && existsSync(updates)) {
        for (const event of eventsFromSessionLog(readFileSync(updates, 'utf8'))) emit(win, tabId, event)
      }
      emitPlan(win, tabId, session, mode === 'plan')
    }
    watchUpdates(win, tabId, session)
    emit(win, tabId, { type: 'status', text: 'ready' })
    return { ok: true, sessionId, config: session.config }
  } catch (error) {
    stopAcp(tabId)
    return { ok: false, error: String(error) }
  }
}

export async function promptAcp(win: BrowserWindow | AcpHost, tabId: string, text: string): Promise<void> {
  const session = sessions.get(tabId)
  if (!session?.sessionId) {
    emit(win, tabId, { type: 'error', text: 'session is not ready' })
    return
  }
  try {
    const result = await request(
      session,
      'session/prompt',
      { sessionId: session.sessionId, prompt: [{ type: 'text', text }] },
      600_000
    )
    emit(win, tabId, { type: 'turn-done', stopReason: String(result.result?.stopReason || result.error?.message || 'end_turn') })
    if (session.mode === 'plan' || existsSync(planPath(session) || '')) emitPlan(win, tabId, session, session.mode === 'plan')
  } catch (error) {
    emit(win, tabId, { type: 'error', text: String(error) })
    emit(win, tabId, { type: 'turn-done', stopReason: 'error' })
  }
}

export async function callAcp(win: BrowserWindow | AcpHost, tabId: string, call: RpcCall): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  const session = sessions.get(tabId)
  if (!session?.sessionId) return { ok: false, error: 'session is not ready' }
  const params: Record<string, unknown> = { sessionId: session.sessionId, ...call.params }
  if (call.method === '_x.ai/session/fork') {
    params.sourceSessionId = params.sourceSessionId || session.sessionId
    params.sourceCwd = params.sourceCwd || session.cwd
    params.newCwd = params.newCwd || session.cwd
  }
  if (call.method === '_x.ai/rewind/execute' && params.mode == null) {
    params.mode = 'conversation_only'
  }
  if (call.method === '_x.ai/prompt_history' && params.cwd == null) {
    params.cwd = session.cwd
  }
  try {
    if (call.method.includes('compact')) emit(win, tabId, { type: 'status', text: 'compacting' })
    const response = await request(session, call.method, params, call.method.includes('compact') ? 180_000 : 45_000)
    if (response.error) {
      emit(win, tabId, { type: 'error', text: `${call.method}: ${response.error.message || 'failed'}` })
      return { ok: false, error: response.error.message || 'failed' }
    }
    if (call.method === 'session/set_config_option') {
      session.config = configFromResult(response.result?.configOptions as Array<Record<string, unknown>> | undefined)
      emit(win, tabId, { type: 'config', options: session.config })
    }
    if (call.method === 'session/set_mode') {
      const modeId = String(call.params.modeId || '')
      session.mode = modeId === 'always_approve' ? 'always-approve' : modeId === 'plan' ? 'plan' : modeId === 'auto' ? 'auto' : 'ask'
      emit(win, tabId, { type: 'mode', mode: session.mode })
    }
    if (call.method === '_x.ai/session/usage') {
      const usage = (response.result?.usage || {}) as { totalTokens?: number; numTurns?: number }
      emit(win, tabId, { type: 'usage', totalTokens: usage.totalTokens || 0, turns: usage.numTurns || 0 })
    }
    return { ok: true, result: response.result }
  } catch (error) {
    const text = String(error)
    emit(win, tabId, { type: 'error', text })
    return { ok: false, error: text }
  }
}

function acceptClientRequest(session: Session, id: number, method: string, params: Record<string, unknown>): void {
  if (method === 'terminal/create') {
    reply(session, id, { result: { terminalId: beginTerminal(session, params) } })
    return
  }
  if (method === 'fs/read_text_file') {
    const path = String(params.path || '')
    reply(session, id, { result: { content: existsSync(path) ? readFileSync(path, 'utf8') : '' } })
    return
  }
  if (method === 'fs/write_text_file') {
    const path = String(params.path || '')
    const content = String(params.content || '')
    if (path) {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, content)
    }
    reply(session, id, { result: {} })
    return
  }
  reply(session, id, { result: {} })
}

export function replyAcp(tabId: string, id: number, result?: unknown, error?: string): void {
  const session = sessions.get(tabId)
  if (!session) return
  const held = session.held.get(id)
  session.held.delete(id)
  if (error) {
    reply(session, id, { error: { code: -32000, message: error } })
    return
  }
  if (held && (result == null || (typeof result === 'object' && result !== null && 'outcome' in (result as object) && held.method === 'terminal/create'))) {
    acceptClientRequest(session, id, held.method, held.params)
    return
  }
  reply(session, id, { result: result ?? {} })
}

export async function cancelAcp(win: BrowserWindow | AcpHost, tabId: string): Promise<void> {
  const session = sessions.get(tabId)
  if (!session?.sessionId) return
  notify(session, 'session/cancel', { sessionId: session.sessionId })
  try {
    const response = await request(session, 'session/cancel', { sessionId: session.sessionId }, 8_000)
    if (response.error) {
      emit(win, tabId, {
        type: 'error',
        text: `session/cancel: ${response.error.message || 'not accepted by this grok build'}`
      })
    }
  } catch (error) {
    emit(win, tabId, { type: 'error', text: String(error) })
  }
  emit(win, tabId, { type: 'turn-done', stopReason: 'cancelled' })
}

export function stopAcp(tabId: string): void {
  const session = sessions.get(tabId)
  if (!session) return
  session.live?.stop()
  session.proc.kill()
  sessions.delete(tabId)
}

export function stopAllAcp(): void {
  for (const tabId of [...sessions.keys()]) stopAcp(tabId)
}
