import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { BrowserWindow, Notification, clipboard, dialog, ipcMain, shell } from 'electron'
import type {
  AppSettings,
  CreateWorktreeRequest,
  LaunchTicketRequest,
  PersistedTab,
  PtySpawnRequest
} from '../shared/types'
import { implementTicketPrompt, ticketSlug, worktreePathForSlug } from '../shared/ticket'
import { fileDiff, gitSnapshot, listWorktrees, prInfo, unwatchAllGit, unwatchGit, watchGit } from './git-service'
import { imageFileToDataUrl, pasteFromClipboard } from './clipboard-paste'
import { runCommand } from './cli'
import {
  deleteSession,
  latestSessionId,
  listSessions,
  listSkills,
  mcpHealth,
  renameSession,
  sessionUsage
} from './grok-index'
import { findIssue, listMyIssues } from './linear'
import { openInCursor, openInFinder, openUrl } from './opener'
import { killTab, resizeTab, spawnGrok, writeTab } from './pty-broker'
import { loadSettings, loadTabs, saveSettings, saveTabs } from './settings'
import { createNutshellWorktree, removeWorktree, repairWorktree } from './worktrees'

export function registerIpc(getWindow: () => BrowserWindow | null, userData: string): void {
  ipcMain.handle('settings:get', () => loadSettings(userData))
  ipcMain.handle('settings:save', (_event, settings: AppSettings) => saveSettings(userData, settings))
  ipcMain.handle('tabs:load', () => loadTabs(userData))
  ipcMain.handle('tabs:save', (_event, tabs: PersistedTab[], activeId: string | null) => {
    saveTabs(userData, tabs, activeId)
  })

  ipcMain.handle('pty:spawn', (_event, request: PtySpawnRequest) => {
    const win = getWindow()
    if (!win) return { ok: false, error: 'no window' }
    return spawnGrok(win, request)
  })
  ipcMain.on('pty:write', (_event, tabId: string, data: string) => writeTab(tabId, data))
  ipcMain.on('pty:resize', (_event, tabId: string, cols: number, rows: number) => {
    resizeTab(tabId, cols, rows)
  })
  ipcMain.handle('pty:kill', (_event, tabId: string) => {
    killTab(tabId)
  })

  ipcMain.handle('sessions:list', async (_event, cwd: string) => listSessions(cwd))
  ipcMain.handle('sessions:delete', async (_event, sessionId: string, cwd: string) =>
    deleteSession(sessionId, cwd)
  )
  ipcMain.handle('sessions:rename', (_event, sessionId: string, cwd: string, title: string) =>
    renameSession(sessionId, cwd, title)
  )
  ipcMain.handle('skills:list', async (_event, cwd: string) => listSkills(cwd))
  ipcMain.handle('mcp:health', async (_event, cwd: string) => mcpHealth(cwd))
  ipcMain.handle('git:snapshot', async (_event, cwd: string) => gitSnapshot(cwd))
  ipcMain.handle('git:file-diff', async (_event, cwd: string, filePath: string, staged: boolean) =>
    fileDiff(cwd, filePath, staged)
  )
  ipcMain.handle('git:pr', async (_event, cwd: string) => prInfo(cwd))
  ipcMain.handle('git:watch', (_event, cwd: string) => {
    const win = getWindow()
    watchGit(cwd, () => {
      if (win && !win.isDestroyed()) win.webContents.send('git:changed', cwd)
    })
  })
  ipcMain.handle('git:unwatch', (_event, cwd: string) => {
    unwatchGit(cwd)
  })

  ipcMain.handle('worktrees:list', async (_event, repoRoot: string) => listWorktrees(repoRoot))
  ipcMain.handle('worktrees:create', async (_event, request: CreateWorktreeRequest) =>
    createNutshellWorktree(request)
  )
  ipcMain.handle('worktrees:repair', async (_event, path: string, repoRoot: string) =>
    repairWorktree(path, repoRoot)
  )
  ipcMain.handle('worktrees:remove', async (_event, path: string, repoRoot: string, force: boolean) =>
    removeWorktree(path, repoRoot, force)
  )

  ipcMain.handle('linear:list', async () => {
    const key = loadSettings(userData).linearApiKey
    if (!key) return { ok: false as const, error: 'no-token', issues: [] }
    try {
      return { ok: true as const, issues: await listMyIssues(key) }
    } catch (error) {
      return { ok: false as const, error: String(error), issues: [] }
    }
  })
  ipcMain.handle('linear:find', async (_event, raw: string) => {
    const key = loadSettings(userData).linearApiKey
    if (!key) return { ok: false as const, error: 'no-token', issue: null }
    try {
      return { ok: true as const, issue: await findIssue(key, raw) }
    } catch (error) {
      return { ok: false as const, error: String(error), issue: null }
    }
  })

  ipcMain.handle('ticket:launch', async (_event, request: LaunchTicketRequest) => {
    const settings = loadSettings(userData)
    const slug = ticketSlug(request.identifier)
    const prompt = implementTicketPrompt(request.identifier, {
      planOnly: request.planOnly,
      paired: request.paired
    })
    let cwd = settings.defaultRepo
    if (request.createWorktree) {
      const created = await createNutshellWorktree({
        repoRoot: settings.defaultRepo,
        slug,
        branch: request.gitBranchName || slug
      })
      if (!created.ok) return created
      cwd = created.path
    }
    return { ok: true as const, cwd, prompt, slug, worktreePath: worktreePathForSlug(slug) }
  })

  ipcMain.handle('dialog:pick-directory', async () => {
    const win = getWindow()
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('open:worktree-manager', async () => {
    const opened = await runCommand('open', ['-a', 'Worktree Manager'], process.cwd())
    if (opened.code === 0) return { opened: 'app' as const }
    const folder = join(homedir(), 'source', 'worktree-manager')
    openInFinder(folder)
    return { opened: 'folder' as const, path: folder }
  })

  ipcMain.handle('open:cursor', async (_event, cwd: string, file?: string) => {
    await openInCursor(cwd, file)
  })
  ipcMain.handle('open:finder', (_event, path: string) => {
    openInFinder(path)
  })
  ipcMain.handle('open:url', (_event, url: string) => {
    openUrl(url)
  })
  ipcMain.handle('clipboard:write', (_event, text: string) => {
    clipboard.writeText(text)
  })
  ipcMain.handle('clipboard:paste', () => pasteFromClipboard())
  ipcMain.handle('clipboard:preview', (_event, path: string) => imageFileToDataUrl(path))
  ipcMain.handle('usage:session', async (_event, sessionId: string) => sessionUsage(sessionId))
  ipcMain.handle('usage:latest-session', (_event, cwd: string, afterMs: number) =>
    latestSessionId(cwd, afterMs)
  )

  ipcMain.handle('readme:read', () => {
    const candidates = [join(process.cwd(), 'README.md'), join(__dirname, '../../README.md')]
    for (const path of candidates) {
      if (existsSync(path)) return readFileSync(path, 'utf8')
    }
    return '# README missing\n\nCould not find README.md next to Grok Cockpit.'
  })

  ipcMain.handle('notify', (_event, title: string, body: string) => {
    if (!loadSettings(userData).notify) return
    const win = getWindow()
    if (win?.isFocused()) return
    new Notification({ title, body }).show()
  })

  ipcMain.handle('shell:open-path', async (_event, path: string) => {
    await shell.openPath(path)
  })
}

export function teardownIpc(): void {
  unwatchAllGit()
}
