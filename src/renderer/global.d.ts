import type {
  AppSettings,
  CreateWorktreeRequest,
  CreateWorktreeResult,
  GitSnapshot,
  GrokSession,
  LaunchTicketRequest,
  LinearIssue,
  McpServerHealth,
  PersistedTab,
  PrInfo,
  PtySpawnRequest,
  SkillInfo,
  UpdateStatus,
  WorktreeInfo
} from '../shared/types'
import type { AcpEvent, ConfigOption, PermissionMode, RpcCall } from '../shared/acp'
import type { SessionUsage } from '../shared/usage'

type LinearListResult =
  | { ok: true; issues: LinearIssue[] }
  | { ok: false; error: string; issues: LinearIssue[] }

type LinearFindResult =
  | { ok: true; issue: LinearIssue | null }
  | { ok: false; error: string; issue: null }

type TicketLaunchResult =
  | { ok: true; cwd: string; prompt: string; slug: string; worktreePath: string }
  | { ok: false; error: string }

type PtySpawnResult = { ok: true } | { ok: false; error: string }

type PasteResult =
  | { kind: 'image'; path: string; dataUrl: string }
  | { kind: 'text'; text: string }
  | { kind: 'empty' }

declare global {
  interface Window {
    api: {
      getUpdateStatus: () => Promise<UpdateStatus>
      checkForUpdates: () => Promise<UpdateStatus>
      downloadUpdate: () => Promise<UpdateStatus>
      installUpdate: () => Promise<void>
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void
      getSettings: () => Promise<AppSettings>
      saveSettings: (settings: AppSettings) => Promise<AppSettings>
      loadTabs: () => Promise<{ tabs: PersistedTab[]; activeId: string | null }>
      saveTabs: (tabs: PersistedTab[], activeId: string | null) => Promise<void>
      spawnPty: (request: PtySpawnRequest) => Promise<PtySpawnResult>
      writePty: (tabId: string, data: string) => void
      resizePty: (tabId: string, cols: number, rows: number) => void
      killPty: (tabId: string) => Promise<void>
      startAcp: (
        tabId: string,
        cwd: string,
        resumeId?: string,
        mode?: PermissionMode
      ) => Promise<{ ok: true; sessionId: string; config: ConfigOption[] } | { ok: false; error: string }>
      promptAcp: (tabId: string, text: string) => Promise<void>
      callAcp: (tabId: string, call: RpcCall) => Promise<{ ok: true; result: unknown } | { ok: false; error: string }>
      replyAcp: (tabId: string, id: number, result?: unknown, error?: string) => Promise<void>
      cancelAcp: (tabId: string) => Promise<void>
      stopAcp: (tabId: string) => Promise<void>
      onAcpEvent: (callback: (tabId: string, event: AcpEvent) => void) => () => void
      onPtyData: (callback: (tabId: string, data: string) => void) => () => void
      onPtyExit: (callback: (tabId: string, code: number) => void) => () => void
      onPtyQuiet: (callback: (tabId: string) => void) => () => void
      onShortcut: (callback: (name: string) => void) => () => void
      onGitChanged: (callback: (cwd: string) => void) => () => void
      listSessions: (cwd: string) => Promise<GrokSession[]>
      deleteSession: (
        sessionId: string,
        cwd: string
      ) => Promise<{ ok: true } | { ok: false; error: string }>
      renameSession: (
        sessionId: string,
        cwd: string,
        title: string
      ) => Promise<{ ok: true } | { ok: false; error: string }>
      listSkills: (cwd: string) => Promise<SkillInfo[]>
      mcpHealth: (cwd: string) => Promise<McpServerHealth[]>
      gitSnapshot: (cwd: string) => Promise<GitSnapshot>
      gitFileDiff: (cwd: string, filePath: string, staged: boolean) => Promise<string>
      gitPr: (cwd: string) => Promise<PrInfo>
      watchGit: (cwd: string) => Promise<void>
      unwatchGit: (cwd: string) => Promise<void>
      listWorktrees: (repoRoot: string) => Promise<WorktreeInfo[]>
      createWorktree: (request: CreateWorktreeRequest) => Promise<CreateWorktreeResult>
      repairWorktree: (path: string, repoRoot: string) => Promise<CreateWorktreeResult>
      removeWorktree: (
        path: string,
        repoRoot: string,
        force: boolean
      ) => Promise<{ ok: true } | { ok: false; error: string }>
      listLinearIssues: () => Promise<LinearListResult>
      findLinearIssue: (raw: string) => Promise<LinearFindResult>
      launchTicket: (request: LaunchTicketRequest) => Promise<TicketLaunchResult>
      pickDirectory: () => Promise<string | null>
      openCursor: (cwd: string, file?: string) => Promise<void>
      openFinder: (path: string) => Promise<void>
      openUrl: (url: string) => Promise<void>
      openWorktreeManager: () => Promise<{ opened: 'app' } | { opened: 'folder'; path: string }>
      writeClipboard: (text: string) => Promise<void>
      pasteClipboard: () => Promise<PasteResult>
      previewPath: (path: string) => Promise<string | null>
      sessionUsage: (sessionId: string) => Promise<SessionUsage | null>
      latestSessionId: (cwd: string, afterMs: number) => Promise<string | null>
      notify: (title: string, body: string) => Promise<void>
      readReadme: () => Promise<string>
      readPlan: (sessionId: string, cwd: string) => Promise<string>
    }
  }
}

export {}
