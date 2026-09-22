import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  CreateWorktreeRequest,
  LaunchTicketRequest,
  PersistedTab,
  PtySpawnRequest
} from '../shared/types'

const api = {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: AppSettings): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:save', settings),
  loadTabs: () => ipcRenderer.invoke('tabs:load'),
  saveTabs: (tabs: PersistedTab[], activeId: string | null) =>
    ipcRenderer.invoke('tabs:save', tabs, activeId),

  spawnPty: (request: PtySpawnRequest) => ipcRenderer.invoke('pty:spawn', request),
  writePty: (tabId: string, data: string): void => {
    ipcRenderer.send('pty:write', tabId, data)
  },
  resizePty: (tabId: string, cols: number, rows: number): void => {
    ipcRenderer.send('pty:resize', tabId, cols, rows)
  },
  killPty: (tabId: string) => ipcRenderer.invoke('pty:kill', tabId),
  startAcp: (tabId: string, cwd: string, resumeId?: string, mode?: string) =>
    ipcRenderer.invoke('acp:start', tabId, cwd, resumeId, mode),
  promptAcp: (tabId: string, text: string) => ipcRenderer.invoke('acp:prompt', tabId, text),
  callAcp: (tabId: string, call: { method: string; params: Record<string, unknown> }) =>
    ipcRenderer.invoke('acp:call', tabId, call),
  replyAcp: (tabId: string, id: number, result?: unknown, error?: string) =>
    ipcRenderer.invoke('acp:reply', tabId, id, result, error),
  cancelAcp: (tabId: string) => ipcRenderer.invoke('acp:cancel', tabId),
  stopAcp: (tabId: string) => ipcRenderer.invoke('acp:stop', tabId),
  onAcpEvent: (callback: (tabId: string, event: unknown) => void) => {
    const handler = (_event: unknown, tabId: string, event: unknown): void => callback(tabId, event)
    ipcRenderer.on('acp:event', handler)
    return () => ipcRenderer.removeListener('acp:event', handler)
  },
  onPtyData: (callback: (tabId: string, data: string) => void) => {
    const handler = (_event: unknown, tabId: string, data: string): void => callback(tabId, data)
    ipcRenderer.on('pty:data', handler)
    return () => ipcRenderer.removeListener('pty:data', handler)
  },
  onPtyExit: (callback: (tabId: string, code: number) => void) => {
    const handler = (_event: unknown, tabId: string, code: number): void => callback(tabId, code)
    ipcRenderer.on('pty:exit', handler)
    return () => ipcRenderer.removeListener('pty:exit', handler)
  },
  onPtyQuiet: (callback: (tabId: string) => void) => {
    const handler = (_event: unknown, tabId: string): void => callback(tabId)
    ipcRenderer.on('pty:quiet', handler)
    return () => ipcRenderer.removeListener('pty:quiet', handler)
  },
  onShortcut: (callback: (name: string) => void) => {
    const handler = (_event: unknown, name: string): void => callback(name)
    ipcRenderer.on('app:shortcut', handler)
    return () => ipcRenderer.removeListener('app:shortcut', handler)
  },
  onGitChanged: (callback: (cwd: string) => void) => {
    const handler = (_event: unknown, cwd: string): void => callback(cwd)
    ipcRenderer.on('git:changed', handler)
    return () => ipcRenderer.removeListener('git:changed', handler)
  },

  listSessions: (cwd: string) => ipcRenderer.invoke('sessions:list', cwd),
  deleteSession: (sessionId: string, cwd: string) =>
    ipcRenderer.invoke('sessions:delete', sessionId, cwd),
  renameSession: (sessionId: string, cwd: string, title: string) =>
    ipcRenderer.invoke('sessions:rename', sessionId, cwd, title),
  listSkills: (cwd: string) => ipcRenderer.invoke('skills:list', cwd),
  mcpHealth: (cwd: string) => ipcRenderer.invoke('mcp:health', cwd),
  gitSnapshot: (cwd: string) => ipcRenderer.invoke('git:snapshot', cwd),
  gitFileDiff: (cwd: string, filePath: string, staged: boolean) =>
    ipcRenderer.invoke('git:file-diff', cwd, filePath, staged),
  gitPr: (cwd: string) => ipcRenderer.invoke('git:pr', cwd),
  watchGit: (cwd: string) => ipcRenderer.invoke('git:watch', cwd),
  unwatchGit: (cwd: string) => ipcRenderer.invoke('git:unwatch', cwd),
  listWorktrees: (repoRoot: string) => ipcRenderer.invoke('worktrees:list', repoRoot),
  createWorktree: (request: CreateWorktreeRequest) =>
    ipcRenderer.invoke('worktrees:create', request),
  repairWorktree: (path: string, repoRoot: string) =>
    ipcRenderer.invoke('worktrees:repair', path, repoRoot),
  removeWorktree: (path: string, repoRoot: string, force: boolean) =>
    ipcRenderer.invoke('worktrees:remove', path, repoRoot, force),
  listLinearIssues: () => ipcRenderer.invoke('linear:list'),
  findLinearIssue: (raw: string) => ipcRenderer.invoke('linear:find', raw),
  launchTicket: (request: LaunchTicketRequest) => ipcRenderer.invoke('ticket:launch', request),
  pickDirectory: () => ipcRenderer.invoke('dialog:pick-directory'),
  openCursor: (cwd: string, file?: string) => ipcRenderer.invoke('open:cursor', cwd, file),
  openFinder: (path: string) => ipcRenderer.invoke('open:finder', path),
  openUrl: (url: string) => ipcRenderer.invoke('open:url', url),
  openWorktreeManager: () => ipcRenderer.invoke('open:worktree-manager'),
  writeClipboard: (text: string) => ipcRenderer.invoke('clipboard:write', text),
  pasteClipboard: () => ipcRenderer.invoke('clipboard:paste'),
  previewPath: (path: string) => ipcRenderer.invoke('clipboard:preview', path),
  sessionUsage: (sessionId: string) => ipcRenderer.invoke('usage:session', sessionId),
  latestSessionId: (cwd: string, afterMs: number) =>
    ipcRenderer.invoke('usage:latest-session', cwd, afterMs),
  notify: (title: string, body: string) => ipcRenderer.invoke('notify', title, body),
  readReadme: () => ipcRenderer.invoke('readme:read') as Promise<string>,
  readPlan: (sessionId: string, cwd: string) => ipcRenderer.invoke('plan:read', sessionId, cwd) as Promise<string>
}

export type CockpitAPI = typeof api

contextBridge.exposeInMainWorld('api', api)
