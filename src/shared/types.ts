export const DEFAULT_REPO = '/Users/arjungupta/source/nutshell/nutshell'
export const WORKTREE_ROOT = '/private/tmp'

export type PtySpawnRequest = {
  tabId: string
  cwd: string
  cols: number
  rows: number
  resumeId?: string
  firstPrompt?: string
}

export type GrokSession = {
  id: string
  created: string
  updated: string
  status: string
  summary: string
  group: string
  cwd: string
}

export type LinearIssue = {
  identifier: string
  title: string
  url: string
  gitBranchName: string | null
  state: string
  teamKey: string
  description: string
}

export type WorktreeInfo = {
  path: string
  branch: string | null
  isMain: boolean
  dirty: boolean
}

export type McpServerHealth = {
  name: string
  healthy: boolean
  detail: string
}

export type SkillInfo = {
  name: string
  description: string
  userInvocable: boolean
}

export type GitFile = {
  path: string
  kind: 'unstaged' | 'staged' | 'untracked'
  code: string
}

export type GitSnapshot = {
  cwd: string
  status: string
  diff: string
  files: GitFile[]
}

export type PersistedTab = {
  id: string
  title: string
  cwd: string
  resumeId?: string
}

export type PrInfo = {
  title: string
  url: string
} | null

export type CreateWorktreeRequest = {
  repoRoot: string
  slug: string
  branch?: string
  baseRef?: string
}

export type CreateWorktreeResult =
  | { ok: true; path: string; branch: string; attached: boolean }
  | { ok: false; error: string }

export type AppSettings = {
  defaultRepo: string
  linearApiKey: string
  notify: boolean
  seenWorktreePromo: boolean
}

export type LaunchTicketRequest = {
  identifier: string
  createWorktree: boolean
  planOnly: boolean
  paired: boolean
  gitBranchName?: string | null
}

export const CURATED_SKILLS: SkillInfo[] = [
  {
    name: 'implement-ticket',
    description: 'Implement a Nutshell Linear ticket (not auto-invoked — use this).',
    userInvocable: true
  },
  {
    name: 'bugfix',
    description: 'Focused Nutshell bug fix with caller compatibility.',
    userInvocable: true
  },
  {
    name: 'plan',
    description: 'Enter Grok plan mode.',
    userInvocable: true
  },
  {
    name: 'compact',
    description: 'Compress conversation history.',
    userInvocable: true
  },
  {
    name: 'always-approve',
    description: 'Toggle always-approve in the TUI.',
    userInvocable: true
  },
  {
    name: 'context',
    description: 'Show context-window usage.',
    userInvocable: true
  }
]
