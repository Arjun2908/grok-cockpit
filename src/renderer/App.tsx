import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  BookOpen,
  Columns2,
  ExternalLink,
  FolderGit2,
  FolderOpen,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Ticket,
  Trash2,
  UserRound,
  X
} from 'lucide-react'
import type {
  AppSettings,
  GitFile,
  GrokSession,
  LinearIssue,
  McpServerHealth,
  PrInfo,
  SkillInfo,
  WorktreeInfo
} from '@shared/types'
import { DEFAULT_REPO } from '@shared/types'
import { duplicateCwdWarning, parseTicketId, ticketSlug } from '@shared/ticket'
import {
  cwdLabel,
  filterSessions,
  formatSessionDate,
  groupSessions,
  ticketIdsIn,
  type SessionFilter
} from '@shared/sessions'
import { parseStatusBranch, splitPath } from '@shared/git'
import { filterSkills, parsePaletteQuery, skillPrompt } from '@shared/skills'
import { formatUsd, type SessionUsage } from '@shared/usage'
import TerminalPane from './TerminalPane'
import ReadmeView from './ReadmeView'
import AboutView from './AboutView'

type PastedImage = { path: string; dataUrl: string }

type Tab = {
  id: string
  title: string
  cwd: string
  resumeId?: string
  firstPrompt?: string
  started: boolean
}

type LeftPanel = 'sessions' | 'linear' | 'worktrees'
type LaunchState = {
  identifier: string
  title: string
  url: string
  description: string
  gitBranchName: string | null
  createWorktree: boolean
  planOnly: boolean
  paired: boolean
}

function newTabId(): string {
  return crypto.randomUUID()
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>({
    defaultRepo: DEFAULT_REPO,
    linearApiKey: '',
    notify: true,
    seenWorktreePromo: false
  })
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [splitId, setSplitId] = useState<string | null>(null)
  const [left, setLeft] = useState<LeftPanel>('sessions')
  const [showDiff, setShowDiff] = useState(true)
  const [showRawDiff, setShowRawDiff] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [sessions, setSessions] = useState<GrokSession[]>([])
  const [sessionQuery, setSessionQuery] = useState('')
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([])
  const [issues, setIssues] = useState<LinearIssue[]>([])
  const [linearError, setLinearError] = useState<string | null>(null)
  const [ticketQuery, setTicketQuery] = useState('')
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [mcp, setMcp] = useState<McpServerHealth[]>([])
  const [diff, setDiff] = useState({ status: '', diff: '', files: [] as GitFile[] })
  const [pr, setPr] = useState<PrInfo>(null)
  const [launch, setLaunch] = useState<LaunchState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createSlug, setCreateSlug] = useState('')
  const [removePath, setRemovePath] = useState<string | null>(null)
  const [sessionToDelete, setSessionToDelete] = useState<GrokSession | null>(null)
  const [sessionToRename, setSessionToRename] = useState<{ session: GrokSession; title: string } | null>(
    null
  )
  const [images, setImages] = useState<Record<string, PastedImage[]>>({})
  const [viewer, setViewer] = useState<PastedImage | null>(null)
  const [usage, setUsage] = useState<SessionUsage | null>(null)
  const [showReadme, setShowReadme] = useState(false)
  const [readme, setReadme] = useState('')
  const [showAbout, setShowAbout] = useState(false)
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('all')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [selectedGitFile, setSelectedGitFile] = useState<string | null>(null)
  const [fileDiffText, setFileDiffText] = useState('')
  const [ready, setReady] = useState({
    sessions: false,
    linear: false,
    worktrees: false,
    mcp: false,
    git: false
  })

  const repo = settings.defaultRepo || DEFAULT_REPO
  const active = tabs.find((tab) => tab.id === activeId) ?? null
  const warning = useMemo(() => duplicateCwdWarning(tabs.map((tab) => tab.cwd)), [tabs])

  const persist = useCallback((nextTabs: Tab[], nextActive: string | null) => {
    void window.api.saveTabs(
      nextTabs.map(({ id, title, cwd, resumeId }) => ({ id, title, cwd, resumeId })),
      nextActive
    )
  }, [])

  const openTab = useCallback((partial: Omit<Tab, 'id' | 'started'> & { id?: string; started?: boolean }) => {
    const tab: Tab = {
      id: partial.id ?? newTabId(),
      started: partial.started ?? true,
      title: partial.title,
      cwd: partial.cwd,
      resumeId: partial.resumeId,
      firstPrompt: partial.firstPrompt
    }
    setTabs((current) => {
      const next = [...current, tab]
      persist(next, tab.id)
      return next
    })
    setActiveId(tab.id)
    return tab.id
  }, [persist])

  const closeTab = useCallback((id: string) => {
    setTabs((current) => {
      const next = current.filter((tab) => tab.id !== id)
      setActiveId((currentActive) => {
        const nextActive =
          currentActive !== id ? currentActive : next[next.length - 1]?.id ?? null
        persist(next, nextActive)
        return nextActive
      })
      return next
    })
    setSplitId((current) => (current === id ? null : current))
  }, [persist])

  const activateTab = useCallback((id: string) => {
    setActiveId(id)
    setTabs((current) => {
      const next = current.map((tab) => (tab.id === id ? { ...tab, started: true } : tab))
      persist(next, id)
      return next
    })
  }, [persist])

  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await window.api.listSessions(repo))
    } catch (err) {
      setSessions([])
      setError(String(err))
    } finally {
      setReady((current) => ({ ...current, sessions: true }))
    }
  }, [repo])

  const refreshWorktrees = useCallback(async () => {
    try {
      setWorktrees(await window.api.listWorktrees(repo))
    } catch (err) {
      setWorktrees([])
      setError(String(err))
    } finally {
      setReady((current) => ({ ...current, worktrees: true }))
    }
  }, [repo])

  const refreshLinear = useCallback(async () => {
    const result = await window.api.listLinearIssues()
    setIssues(result.issues)
    setLinearError(result.ok ? null : result.error === 'no-token' ? 'no-token' : result.error)
    setReady((current) => ({ ...current, linear: true }))
  }, [])

  const refreshSkills = useCallback(async () => {
    try {
      setSkills(await window.api.listSkills(repo))
    } catch {
      setSkills([])
    }
  }, [repo])

  const refreshMcp = useCallback(async () => {
    try {
      setMcp(await window.api.mcpHealth(repo))
    } catch {
      setMcp([])
    } finally {
      setReady((current) => ({ ...current, mcp: true }))
    }
  }, [repo])

  const loadGit = useCallback(async (cwd: string, silent = false) => {
    if (!silent) setReady((current) => ({ ...current, git: false }))
    const snapshot = await window.api.gitSnapshot(cwd)
    setDiff({ status: snapshot.status, diff: snapshot.diff, files: snapshot.files })
    setPr(await window.api.gitPr(cwd))
    setReady((current) => ({ ...current, git: true }))
  }, [])

  useEffect(() => {
    void (async () => {
      const loaded = await window.api.getSettings()
      setSettings(loaded)
      if (!loaded.seenWorktreePromo) setShowAbout(true)
      const saved = await window.api.loadTabs()
      const nextTabs: Tab[] = saved.tabs.map((tab) => ({
        ...tab,
        started: tab.id === saved.activeId
      }))
      setTabs(nextTabs)
      setActiveId(saved.activeId)
    })()
  }, [])

  useEffect(() => {
    void refreshSessions()
    void refreshWorktrees()
    void refreshLinear()
    void refreshSkills()
    void refreshMcp()
    const timer = window.setInterval(() => void refreshMcp(), 60_000)
    return () => window.clearInterval(timer)
  }, [refreshSessions, refreshWorktrees, refreshLinear, refreshSkills, refreshMcp])

  useEffect(() => {
    const sessionId = active?.resumeId
    if (!sessionId) {
      setUsage(null)
      return
    }
    const load = (): void => {
      void window.api.sessionUsage(sessionId).then((next) => {
        if (next) setUsage(next)
      })
    }
    load()
    const timer = window.setInterval(load, 15_000)
    return () => window.clearInterval(timer)
  }, [active?.resumeId])

  const openReadme = useCallback(async () => {
    if (showReadme) {
      setShowReadme(false)
      return
    }
    if (!readme) {
      try {
        setReadme(await window.api.readReadme())
      } catch (error) {
        setReadme(`# README\n\nCould not load README.md.\n\n${String(error)}`)
      }
    }
    setShowReadme(true)
  }, [readme, showReadme])

  const gitCwd = active?.cwd

  useEffect(() => {
    if (!gitCwd || !showDiff) return
    void loadGit(gitCwd)
    void window.api.watchGit(gitCwd)
    const unsub = window.api.onGitChanged((cwd) => {
      if (cwd === gitCwd) void loadGit(cwd, true)
    })
    return () => {
      unsub()
      void window.api.unwatchGit(gitCwd)
    }
  }, [gitCwd, showDiff, loadGit])

  useEffect(() => {
    const unsubExit = window.api.onPtyExit((tabId) => {
      closeTab(tabId)
    })
    const unsubQuiet = window.api.onPtyQuiet((tabId) => {
      const tab = tabs.find((item) => item.id === tabId)
      void window.api.notify('Grok Cockpit', tab ? `${tab.title} is idle` : 'A session is idle')
    })
    const unsubShortcut = window.api.onShortcut((name) => {
      if (name === 'close-tab' && activeId) closeTab(activeId)
      if (name === 'new-tab') openTab({ title: 'grok', cwd: repo })
      if (name === 'readme') void openReadme()
      if (name === 'about') setShowAbout(true)
      if (name.startsWith('tab-')) {
        const index = Number(name.slice(4)) - 1
        if (tabs[index]) activateTab(tabs[index].id)
      }
      if (name === 'prev-tab' && tabs.length) {
        const index = Math.max(tabs.findIndex((tab) => tab.id === activeId), 0)
        activateTab(tabs[(index - 1 + tabs.length) % tabs.length].id)
      }
      if (name === 'next-tab' && tabs.length) {
        const index = Math.max(tabs.findIndex((tab) => tab.id === activeId), 0)
        activateTab(tabs[(index + 1) % tabs.length].id)
      }
    })
    return () => {
      unsubExit()
      unsubQuiet()
      unsubShortcut()
    }
  }, [activeId, tabs, repo, closeTab, openTab, activateTab, openReadme])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.metaKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setShowPalette(true)
        setPaletteQuery('')
      }
      if (event.metaKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        setShowDiff((value) => !value)
      }
      if (event.metaKey && event.key === ',') setShowSettings(true)
      if (event.key === 'Escape') {
        setShowPalette(false)
        setShowSettings(false)
        setLaunch(null)
        setRemovePath(null)
        setSessionToDelete(null)
        setSessionToRename(null)
        setViewer(null)
        setShowReadme(false)
        setShowAbout(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const runSkill = (name: string, extra = ''): void => {
    if (name === 'rewind') {
      setShowPalette(false)
      return
    }
    const prompt = skillPrompt(name, extra)
    if (active?.started) window.api.writePty(active.id, `${prompt}\r`)
    else openTab({ title: name, cwd: active?.cwd || repo, firstPrompt: prompt })
    setShowPalette(false)
  }

  const startLaunch = (issue: Partial<LinearIssue> & { identifier: string }): void => {
    const slug = ticketSlug(issue.identifier)
    const existing = worktrees.some((tree) => tree.path.endsWith(`/${slug}-wt`))
    setLaunch({
      identifier: issue.identifier,
      title: issue.title ?? issue.identifier,
      url: issue.url ?? '',
      description: issue.description ?? '',
      gitBranchName: issue.gitBranchName ?? null,
      createWorktree: true,
      planOnly: false,
      paired: true
    })
    if (existing) {
      setLaunch((current) => current && { ...current, createWorktree: true })
    }
  }

  const confirmLaunch = async (): Promise<void> => {
    if (!launch) return
    const result = await window.api.launchTicket({
      identifier: launch.identifier,
      createWorktree: launch.createWorktree,
      planOnly: launch.planOnly,
      paired: launch.paired,
      gitBranchName: launch.gitBranchName
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    openTab({
      title: launch.identifier,
      cwd: result.cwd,
      firstPrompt: result.prompt
    })
    setLaunch(null)
    void refreshWorktrees()
  }

  const lookupTicket = async (): Promise<void> => {
    const raw = ticketQuery.trim()
    if (!raw) return
    if (parseTicketId(raw) && !settings.linearApiKey) {
      startLaunch({ identifier: raw.toUpperCase() })
      return
    }
    const result = await window.api.findLinearIssue(raw)
    if (result.issue) startLaunch(result.issue)
    else if (parseTicketId(raw)) startLaunch({ identifier: raw.toUpperCase() })
    else setLinearError(result.ok ? 'No issue found' : result.error)
  }

  const confirmRename = async (): Promise<void> => {
    if (!sessionToRename) return
    const title = sessionToRename.title.trim()
    if (!title) return
    const { session } = sessionToRename
    const previous = sessions
    setSessions((current) =>
      current.map((item) => (item.id === session.id ? { ...item, summary: title } : item))
    )
    setTabs((current) => {
      const next = current.map((tab) => (tab.resumeId === session.id ? { ...tab, title } : tab))
      persist(next, activeId)
      return next
    })
    const live = tabs.find((tab) => tab.resumeId === session.id && tab.started)
    if (live) window.api.writePty(live.id, `/rename ${title}\r`)
    setSessionToRename(null)
    const result = await window.api.renameSession(session.id, session.cwd || repo, title)
    if (!result.ok) {
      setSessions(previous)
      setError(result.error)
    }
  }

  const confirmDeleteSession = async (): Promise<void> => {
    if (!sessionToDelete) return
    const doomed = sessionToDelete
    const previous = sessions
    setSessionToDelete(null)
    setSessions((current) => current.filter((item) => item.id !== doomed.id))
    for (const tab of tabs.filter((item) => item.resumeId === doomed.id)) {
      closeTab(tab.id)
    }
    const result = await window.api.deleteSession(doomed.id, doomed.cwd || repo)
    if (!result.ok) {
      setSessions(previous)
      setError(result.error)
    }
  }

  const createWorktree = async (): Promise<void> => {
    const slug = ticketSlug(createSlug)
    if (!slug) return
    const result = await window.api.createWorktree({ repoRoot: repo, slug })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setCreateSlug('')
    void refreshWorktrees()
    openTab({ title: slug, cwd: result.path })
  }

  const dismissAbout = async (): Promise<void> => {
    setShowAbout(false)
    if (settings.seenWorktreePromo) return
    const saved = await window.api.saveSettings({ ...settings, seenWorktreePromo: true })
    setSettings(saved)
  }

  const today = new Date().toISOString().slice(0, 10)
  const visibleSkills = filterSkills(skills, paletteQuery)
  const visibleSessions = filterSessions(sessions, sessionQuery, {
    filter: sessionFilter,
    defaultRepo: repo,
    today
  })
  const sessionGroups = groupSessions(visibleSessions, worktrees)
  const branchName = parseStatusBranch(diff.status)

  return (
    <div className="relative flex h-full flex-col">
      <header className="titlebar flex h-[52px] items-center gap-3 border-b border-zinc-800 bg-zinc-950 pl-20 pr-4">
        <div className="text-sm font-medium tracking-tight">Grok Cockpit</div>
        <div className="no-drag flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] ${
                tab.id === activeId ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900'
              }`}
              onClick={() => activateTab(tab.id)}
            >
              <span className="max-w-[10rem] truncate">{tab.title}</span>
              <span
                className="rounded p-0.5 hover:bg-zinc-700"
                onClick={(event) => {
                  event.stopPropagation()
                  closeTab(tab.id)
                }}
              >
                <X size={10} />
              </span>
            </button>
          ))}
          <button
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            onClick={() => openTab({ title: 'grok', cwd: repo })}
            title="New session (⌘T)"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="no-drag flex items-center gap-1.5">
          {active && (
            <>
              <button
                className="rounded-md p-1 text-zinc-400 hover:text-white"
                title="Open in Cursor"
                onClick={() => void window.api.openCursor(active.cwd)}
              >
                <ExternalLink size={14} />
              </button>
              <button
                className="rounded-md p-1 text-zinc-400 hover:text-white"
                title="Open in Finder"
                onClick={() => void window.api.openFinder(active.cwd)}
              >
                <FolderOpen size={14} />
              </button>
            </>
          )}
          <button
            className={`rounded-md p-1 ${splitId ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
            title="Split with another tab"
            onClick={() => {
              const other = tabs.find((tab) => tab.id !== activeId)
              setSplitId((current) => (current ? null : other?.id ?? null))
            }}
          >
            <Columns2 size={14} />
          </button>
          <button
            className={`rounded-lg p-1.5 ${showAbout ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
            onClick={() => setShowAbout(true)}
            title="About (⌘⇧A)"
          >
            <UserRound size={15} />
          </button>
          <button
            className={`rounded-lg p-1.5 ${showReadme ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
            onClick={() => void openReadme()}
            title="Cockpit README (⌘⇧/)"
          >
            <BookOpen size={14} />
          </button>
          <button
            className="rounded-md p-1 text-zinc-400 hover:text-white"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <Settings size={14} />
          </button>
        </div>
      </header>

      {warning && (
        <div className="border-b border-amber-900/60 bg-amber-950/80 px-4 py-1.5 text-xs text-amber-200">
          {warning}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 border-b border-red-900/60 bg-red-950/80 px-5 py-2.5 text-[13px] text-red-100">
          <span className="min-w-0 flex-1 truncate">{error}</span>
          <button onClick={() => void window.api.writeClipboard(error)}>Copy</button>
          <button onClick={() => setError(null)}>
            <X size={12} />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-80 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
          <div className="flex border-b border-zinc-800 text-xs">
            {(
              [
                ['sessions', 'Sessions'],
                ['linear', 'Linear'],
                ['worktrees', 'Worktrees']
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className={`flex-1 px-2 py-2 ${left === id ? 'bg-zinc-900 text-white' : 'text-zinc-500'}`}
                onClick={() => setLeft(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {left === 'sessions' && (
            <div className="flex min-h-0 flex-1 flex-col p-3">
              <input
                className="mb-2 h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 text-[13px]"
                placeholder="Search title, ticket, branch…"
                value={sessionQuery}
                onChange={(event) => setSessionQuery(event.target.value)}
              />
              <div className="mb-3 flex flex-wrap gap-1.5">
                {(
                  [
                    ['all', 'All'],
                    ['repo', 'This repo'],
                    ['worktrees', 'Worktrees'],
                    ['today', 'Today']
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    className={`rounded-full px-2.5 py-1 text-[11px] ${
                      sessionFilter === id ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-900 text-zinc-400'
                    }`}
                    onClick={() => setSessionFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                className="mb-3 flex w-full items-center justify-between rounded-lg bg-zinc-800 px-3 py-2 text-left text-[13px] hover:bg-zinc-700"
                onClick={() => openTab({ title: 'grok', cwd: repo })}
              >
                <span>New session in {cwdLabel(repo)}</span>
                <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                  ⌘T
                </kbd>
              </button>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {!ready.sessions && <SidebarSkeleton rows={6} />}
                {ready.sessions && visibleSessions.length === 0 && (
                  <div className="px-1 py-3">
                    <p className="text-[13px] text-zinc-400">No sessions match.</p>
                    <button
                      className="mt-2 text-[12px] text-sky-400"
                      onClick={() => {
                        setSessionQuery('')
                        setSessionFilter('all')
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
                {ready.sessions &&
                  sessionGroups.map((group) => {
                    const collapsed =
                      collapsedGroups[group.cwd] ??
                      (sessionGroups.length > 4 && group.cwd.replace(/\/+$/, '') !== repo.replace(/\/+$/, ''))
                    return (
                      <div key={group.cwd} className="mb-3">
                        <button
                          className="mb-1 flex w-full items-baseline justify-between px-1 text-left"
                          onClick={() =>
                            setCollapsedGroups((current) => ({ ...current, [group.cwd]: !collapsed }))
                          }
                        >
                          <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                            {group.label}
                            {group.branch ? ` · ${group.branch}` : ''}
                          </span>
                          <span className="text-[10px] text-zinc-600">{group.sessions.length}</span>
                        </button>
                        {!collapsed &&
                          group.sessions.map((session) => {
                            const tickets = ticketIdsIn(`${session.summary} ${session.group}`)
                            return (
                              <div
                                key={session.id}
                                className="group mb-1.5 flex items-start gap-1 rounded-lg px-2 py-2 hover:bg-zinc-900"
                              >
                                <button
                                  className="min-w-0 flex-1 text-left"
                                  onClick={() =>
                                    openTab({
                                      title: session.summary.slice(0, 24) || session.id.slice(0, 8),
                                      cwd: session.cwd || repo,
                                      resumeId: session.id
                                    })
                                  }
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                        session.status === 'local' ? 'bg-emerald-400' : 'bg-zinc-600'
                                      }`}
                                    />
                                    <span className="truncate text-[13px] text-zinc-100">
                                      {session.summary || session.id}
                                    </span>
                                  </div>
                                  <div className="mt-1 flex items-center gap-1.5 pl-3 text-[11px] text-zinc-500">
                                    {tickets[0] && (
                                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                                        {tickets[0]}
                                      </span>
                                    )}
                                    <span>{formatSessionDate(session.updated, today)}</span>
                                  </div>
                                </button>
                                <button
                                  className="mt-0.5 hidden p-1 text-zinc-500 hover:text-zinc-200 group-hover:block"
                                  title="Rename"
                                  onClick={() => setSessionToRename({ session, title: session.summary })}
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  className="mt-0.5 hidden p-1 text-zinc-500 hover:text-red-300 group-hover:block"
                                  title="Delete"
                                  onClick={() => setSessionToDelete(session)}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )
                          })}
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {left === 'linear' && (
            <div className="flex min-h-0 flex-1 flex-col p-2">
              <div className="mb-2 flex gap-1">
                <input
                  className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs"
                  placeholder="AVA-1234 or search"
                  value={ticketQuery}
                  onChange={(event) => setTicketQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void lookupTicket()
                  }}
                />
                <button className="rounded-md bg-zinc-800 px-2 text-xs" onClick={() => void lookupTicket()}>
                  <Search size={12} />
                </button>
                <button className="rounded-md bg-zinc-800 px-2 text-xs" onClick={() => void refreshLinear()}>
                  <RefreshCw size={12} />
                </button>
              </div>
              {linearError === 'no-token' && (
                <button
                  className="mb-2 text-left text-[11px] text-amber-300"
                  onClick={() => setShowSettings(true)}
                >
                  Add a Linear API key in Settings
                </button>
              )}
              {linearError && linearError !== 'no-token' && (
                <p className="mb-2 text-[11px] text-amber-300">{linearError}</p>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {!ready.linear && <SidebarSkeleton rows={6} />}
                {ready.linear && issues.length === 0 && !linearError && (
                  <p className="px-1 text-xs text-zinc-500">No open issues assigned to you.</p>
                )}
                {ready.linear && issues.map((issue) => (
                  <button
                    key={issue.identifier}
                    className="mb-1 w-full rounded-md px-2 py-1.5 text-left hover:bg-zinc-900"
                    onClick={() => startLaunch(issue)}
                  >
                    <div className="flex items-center gap-1 text-xs text-zinc-200">
                      <Ticket size={10} />
                      {issue.identifier}
                      <span className="text-[10px] text-zinc-500">{issue.state}</span>
                    </div>
                    <div className="truncate text-[11px] text-zinc-500">{issue.title}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {left === 'worktrees' && (
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <div className="mb-2 flex gap-1">
                <input
                  className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs"
                  placeholder="ava-1234"
                  value={createSlug}
                  onChange={(event) => setCreateSlug(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void createWorktree()
                  }}
                />
                <button className="rounded-md bg-zinc-800 px-2 text-xs" onClick={() => void createWorktree()}>
                  Add
                </button>
              </div>
              {!ready.worktrees && <SidebarSkeleton rows={4} />}
              {ready.worktrees && worktrees.length === 0 && (
                <p className="px-1 text-xs text-zinc-500">No worktrees found.</p>
              )}
              {ready.worktrees && worktrees.map((tree) => (
                <div key={tree.path} className="mb-1 rounded-md px-2 py-1.5 hover:bg-zinc-900">
                  <button
                    className="w-full text-left"
                    onClick={() =>
                      openTab({
                        title: tree.branch || tree.path.split('/').slice(-1)[0],
                        cwd: tree.path
                      })
                    }
                  >
                    <div className="flex items-center gap-1 text-xs text-zinc-200">
                      <FolderGit2 size={10} />
                      {tree.branch || '(detached)'}
                      {tree.isMain ? ' · main' : ''}
                      {tree.dirty ? <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> : null}
                    </div>
                    <div className="truncate text-[10px] text-zinc-500">{tree.path}</div>
                  </button>
                  <div className="mt-1 flex gap-2 text-[10px] text-zinc-500">
                    <button onClick={() => void window.api.openFinder(tree.path)}>Finder</button>
                    <button
                      onClick={async () => {
                        const result = await window.api.repairWorktree(tree.path, repo)
                        if (!result.ok) setError(result.error)
                      }}
                    >
                      Repair setup
                    </button>
                    {!tree.isMain && (
                      <button onClick={() => setRemovePath(tree.path)}>Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        <main className="flex min-w-0 flex-1">
          {tabs.length === 0 ? (
            <EmptyState
              onNew={() => openTab({ title: 'grok', cwd: repo })}
              onLinear={() => setLeft('linear')}
              onResume={() => {
                setLeft('sessions')
                void refreshSessions()
              }}
            />
          ) : (
            tabs.map((tab) => {
              const visible = tab.id === activeId || tab.id === splitId
              if (!tab.started) {
                return (
                  <div
                    key={tab.id}
                    className="h-full min-w-0"
                    style={{ display: visible ? 'flex' : 'none', flex: visible ? 1 : undefined }}
                  />
                )
              }
              return (
                <div
                  key={tab.id}
                  className={`h-full min-w-0 ${tab.id === splitId ? 'border-l border-zinc-800' : ''}`}
                  style={{
                    display: visible ? 'block' : 'none',
                    flex: visible ? 1 : undefined
                  }}
                >
                  <TerminalPane
                    tabId={tab.id}
                    cwd={tab.cwd}
                    resumeId={tab.resumeId}
                    firstPrompt={tab.firstPrompt}
                    active={tab.id === activeId}
                    visible={visible}
                    onImage={(image) => {
                      setImages((current) => ({
                        ...current,
                        [tab.id]: [...(current[tab.id] ?? []), image].slice(-8)
                      }))
                    }}
                    onSession={(sessionId) => {
                      setTabs((current) => {
                        const next = current.map((item) =>
                          item.id === tab.id ? { ...item, resumeId: sessionId } : item
                        )
                        persist(next, activeId)
                        return next
                      })
                    }}
                  />
                </div>
              )
            })
          )}
        </main>

        {showDiff && (
          <aside className="flex w-[22rem] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
            <div className="flex items-baseline justify-between border-b border-zinc-800 px-4 py-3">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-zinc-500">Changes</div>
                <div className="mt-0.5 text-[13px] text-zinc-200">
                  {branchName || (active ? cwdLabel(active.cwd) : 'No session')}
                </div>
              </div>
              <span className="text-[11px] text-zinc-500">
                {diff.files.length ? `${diff.files.length} files` : ''}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
              {!active && <p className="px-1 text-[13px] text-zinc-500">No session</p>}
              {active && !ready.git && <SidebarSkeleton rows={5} />}
              {active && ready.git && diff.files.length === 0 && (
                <p className="px-1 text-[13px] text-zinc-500">Working tree clean</p>
              )}
              {active &&
                ready.git &&
                (['staged', 'unstaged', 'untracked'] as const).map((kind) => {
                  const files = diff.files.filter((file) => file.kind === kind)
                  if (!files.length) return null
                  const label = kind === 'staged' ? 'Staged' : kind === 'unstaged' ? 'Unstaged' : 'Untracked'
                  return (
                    <div key={kind} className="mb-4">
                      <div className="mb-1.5 px-1 text-[10px] uppercase tracking-wide text-zinc-500">
                        {label} · {files.length}
                      </div>
                      {files.map((file) => {
                        const parts = splitPath(file.path)
                        const selected = selectedGitFile === `${file.kind}:${file.path}`
                        return (
                          <div
                            key={`${file.kind}-${file.path}`}
                            className={`mb-1 flex items-center gap-2 rounded-lg px-2 py-2 ${
                              selected ? 'bg-zinc-800' : 'hover:bg-zinc-900'
                            }`}
                          >
                            <span className="w-4 shrink-0 font-mono text-[11px] text-amber-200">{file.code}</span>
                            <button
                              className="min-w-0 flex-1 text-left"
                              onClick={() => void window.api.openCursor(active.cwd, `${active.cwd}/${file.path}`)}
                            >
                              <div className="truncate text-[13px] text-zinc-100">{parts.name}</div>
                              {parts.dir && (
                                <div className="truncate text-[11px] text-zinc-500">{parts.dir}</div>
                              )}
                            </button>
                            {file.kind !== 'untracked' && (
                              <button
                                className="shrink-0 text-[11px] text-sky-400"
                                onClick={async () => {
                                  const key = `${file.kind}:${file.path}`
                                  if (selected) {
                                    setSelectedGitFile(null)
                                    setFileDiffText('')
                                    return
                                  }
                                  setSelectedGitFile(key)
                                  setShowRawDiff(true)
                                  setFileDiffText(
                                    await window.api.gitFileDiff(active.cwd, file.path, file.kind === 'staged')
                                  )
                                }}
                              >
                                diff
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              {active && ready.git && diff.files.length > 0 && (
                <div className="mt-2 border-t border-zinc-800 pt-3">
                  <div className="mb-2 flex gap-3 px-1 text-[11px]">
                    <button
                      className={selectedGitFile ? 'text-zinc-500' : 'text-zinc-200'}
                      onClick={() => {
                        setSelectedGitFile(null)
                        setFileDiffText('')
                        setShowRawDiff(true)
                      }}
                    >
                      All changes
                    </button>
                    <button className="text-zinc-500" onClick={() => setShowRawDiff((value) => !value)}>
                      {showRawDiff ? 'Hide diff' : 'Show diff'}
                    </button>
                  </div>
                  {showRawDiff && (
                    <pre className="whitespace-pre-wrap px-1 font-mono text-[11px] leading-5 text-zinc-400">
                      {selectedGitFile ? fileDiffText : diff.diff}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {active && (images[active.id] ?? []).length > 0 && (
        <div className="flex h-16 items-center gap-2 border-t border-zinc-800 bg-zinc-950 px-3">
          <span className="text-[10px] uppercase text-zinc-500">Images</span>
          {(images[active.id] ?? []).map((image) => (
            <button
              key={image.path}
              className="h-12 w-12 overflow-hidden rounded border border-zinc-700"
              onClick={() => setViewer(image)}
              title={image.path}
            >
              <img src={image.dataUrl} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <footer className="flex h-9 items-center gap-3 border-t border-zinc-800 bg-zinc-950 px-4 text-[11px] text-zinc-400">
        <span className="truncate">{active?.cwd || repo}</span>
        {pr && (
          <button className="truncate text-sky-400" onClick={() => void window.api.openUrl(pr.url)}>
            PR: {pr.title}
          </button>
        )}
        {active?.resumeId && !usage && (
          <span className="h-4 w-12 animate-pulse rounded bg-zinc-800" />
        )}
        {usage && (
          <button
            className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-amber-200"
            title={`${usage.turnCount} turns · ${usage.totalTokens.toLocaleString()} tokens · ${usage.model ?? ''}`}
            onClick={() =>
              void window.api.writeClipboard(
                `${usage.sessionId} ${formatUsd(usage.usd)} (${usage.turnCount} turns)`
              )
            }
          >
            {formatUsd(usage.usd)}
          </button>
        )}
        <span className="ml-auto flex gap-1">
          {!ready.mcp &&
            [0, 1, 2].map((index) => (
              <span key={index} className="h-4 w-12 animate-pulse rounded bg-zinc-800" />
            ))}
          {ready.mcp && mcp.slice(0, 8).map((server) => (
            <button
              key={server.name}
              title={server.detail}
              className={`rounded px-1.5 py-0.5 ${
                server.healthy ? 'bg-emerald-950 text-emerald-300' : 'bg-zinc-900 text-zinc-500'
              }`}
              onClick={() => void window.api.writeClipboard(`${server.name}: ${server.detail}`)}
            >
              {server.name}
            </button>
          ))}
        </span>
        <button className="text-zinc-500 hover:text-zinc-200" onClick={() => setShowPalette(true)}>
          ⌘K
        </button>
      </footer>

      {showAbout && <AboutView onClose={() => void dismissAbout()} />}
      {showReadme && <ReadmeView markdown={readme} onClose={() => setShowReadme(false)} />}

      {viewer && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-8"
          onClick={() => setViewer(null)}
        >
          <img
            src={viewer.dataUrl}
            alt={viewer.path}
            className="max-h-full max-w-full rounded shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}

      {showPalette && (
        <div
          className="absolute inset-0 z-20 flex items-start justify-center bg-black/50 pt-24"
          onClick={() => setShowPalette(false)}
        >
          <div
            className="w-[32rem] rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <input
              autoFocus
              className="w-full border-b border-zinc-800 bg-transparent px-4 py-3 text-sm outline-none"
              placeholder="implement-ticket AVA-12 --paired"
              value={paletteQuery}
              onChange={(event) => setPaletteQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                const parsed = parsePaletteQuery(paletteQuery)
                const match =
                  visibleSkills.find((skill) => skill.name === parsed.name) || visibleSkills[0]
                if (match) runSkill(match.name, match.name === parsed.name ? parsed.extra : '')
              }}
            />
            <div className="max-h-80 overflow-y-auto py-1">
              {visibleSkills.map((skill) => (
                <button
                  key={skill.name}
                  className="flex w-full flex-col px-4 py-2 text-left hover:bg-zinc-900"
                  onClick={() => {
                    const parsed = parsePaletteQuery(paletteQuery)
                    runSkill(skill.name, parsed.name === skill.name ? parsed.extra : '')
                  }}
                >
                  <span className="font-mono text-xs text-zinc-100">/{skill.name}</span>
                  <span className="text-[11px] text-zinc-500">{skill.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {launch && (
        <Modal onClose={() => setLaunch(null)} title={`Start ${launch.identifier}`}>
          <p className="mb-1 text-xs text-zinc-300">{launch.title}</p>
          {launch.description && (
            <p className="mb-3 max-h-24 overflow-auto whitespace-pre-wrap text-[11px] text-zinc-500">
              {launch.description}
            </p>
          )}
          {launch.url && (
            <button
              className="mb-3 text-[11px] text-sky-400"
              onClick={() => void window.api.openUrl(launch.url)}
            >
              Open in Linear
            </button>
          )}
          <label className="mb-2 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={launch.createWorktree}
              onChange={(event) =>
                setLaunch({ ...launch, createWorktree: event.target.checked })
              }
            />
            Use Nutshell worktree at /private/tmp/{ticketSlug(launch.identifier)}-wt (creates or attaches)
          </label>
          <label className="mb-2 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={launch.paired}
              onChange={(event) => setLaunch({ ...launch, paired: event.target.checked })}
            />
            --paired
          </label>
          <label className="mb-4 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={launch.planOnly}
              onChange={(event) => setLaunch({ ...launch, planOnly: event.target.checked })}
            />
            --plan-only
          </label>
          <div className="flex justify-end gap-2">
            <button className="text-xs text-zinc-400" onClick={() => setLaunch(null)}>
              Cancel
            </button>
            <button
              className="rounded-md bg-zinc-100 px-3 py-1 text-xs text-zinc-900"
              onClick={() => void confirmLaunch()}
            >
              Launch grok
            </button>
          </div>
        </Modal>
      )}

      {sessionToRename && (
        <Modal onClose={() => setSessionToRename(null)} title="Rename session">
          <input
            autoFocus
            className="mb-4 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs"
            value={sessionToRename.title}
            onChange={(event) =>
              setSessionToRename({ ...sessionToRename, title: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') void confirmRename()
            }}
          />
          <div className="flex justify-end gap-2">
            <button className="text-xs text-zinc-400" onClick={() => setSessionToRename(null)}>
              Cancel
            </button>
            <button
              className="rounded-md bg-zinc-100 px-3 py-1 text-xs text-zinc-900"
              onClick={() => void confirmRename()}
            >
              Save
            </button>
          </div>
        </Modal>
      )}

      {sessionToDelete && (
        <Modal onClose={() => setSessionToDelete(null)} title="Delete session">
          <p className="mb-1 text-xs text-zinc-300">{sessionToDelete.summary || sessionToDelete.id}</p>
          <p className="mb-4 text-[11px] text-zinc-500">This permanently removes Grok history for this session.</p>
          <div className="flex justify-end gap-2">
            <button className="text-xs text-zinc-400" onClick={() => setSessionToDelete(null)}>
              Cancel
            </button>
            <button
              className="rounded-md bg-red-500 px-3 py-1 text-xs text-white"
              onClick={() => void confirmDeleteSession()}
            >
              Delete
            </button>
          </div>
        </Modal>
      )}

      {removePath && (
        <Modal onClose={() => setRemovePath(null)} title="Remove worktree">
          <p className="mb-4 text-xs text-zinc-400">{removePath}</p>
          <div className="flex justify-end gap-2">
            <button className="text-xs text-zinc-400" onClick={() => setRemovePath(null)}>
              Cancel
            </button>
            <button
              className="rounded-md bg-red-500 px-3 py-1 text-xs text-white"
              onClick={async () => {
                const result = await window.api.removeWorktree(removePath, repo, false)
                if (!result.ok) setError(result.error)
                setRemovePath(null)
                void refreshWorktrees()
              }}
            >
              Remove
            </button>
          </div>
        </Modal>
      )}

      {showSettings && (
        <Modal onClose={() => setShowSettings(false)} title="Settings">
          <label className="mb-1 block text-xs text-zinc-400">Default repo</label>
          <div className="mb-3 flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs"
              value={settings.defaultRepo}
              onChange={(event) => setSettings({ ...settings, defaultRepo: event.target.value })}
            />
            <button
              className="rounded-md bg-zinc-800 px-2 text-xs"
              onClick={async () => {
                const path = await window.api.pickDirectory()
                if (path) setSettings({ ...settings, defaultRepo: path })
              }}
            >
              Browse
            </button>
          </div>
          <label className="mb-1 block text-xs text-zinc-400">Linear API key</label>
          <input
            type="password"
            className="mb-3 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs"
            value={settings.linearApiKey}
            onChange={(event) => setSettings({ ...settings, linearApiKey: event.target.value })}
            placeholder="lin_api_…"
          />
          <label className="mb-4 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={settings.notify}
              onChange={(event) => setSettings({ ...settings, notify: event.target.checked })}
            />
            Notify when a background tab goes idle
          </label>
          <div className="flex justify-end">
            <button
              className="rounded-md bg-zinc-100 px-3 py-1 text-xs text-zinc-900"
              onClick={async () => {
                const saved = await window.api.saveSettings(settings)
                setSettings(saved)
                setShowSettings(false)
                void refreshLinear()
              }}
            >
              Save
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function SidebarSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2 px-1 pt-1">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="animate-pulse space-y-1.5 py-1">
          <div className="h-3 w-4/5 rounded bg-zinc-800" />
          <div className="h-2 w-2/5 rounded bg-zinc-800/70" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({
  onNew,
  onLinear,
  onResume
}: {
  onNew: () => void
  onLinear: () => void
  onResume: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="text-lg font-medium">Nutshell × Grok</div>
      <p className="max-w-sm text-sm text-zinc-500">
        Live TUI tabs, Linear tickets, Nutshell worktrees, skills, MCP health, and git diff.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          className="flex items-center gap-2 rounded-md bg-zinc-100 px-3 py-1.5 text-xs text-zinc-900"
          onClick={onNew}
        >
          New session
          <kbd className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
            ⌘T
          </kbd>
        </button>
        <button className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs" onClick={onResume}>
          Resume
        </button>
        <button className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs" onClick={onLinear}>
          From Linear ticket
        </button>
      </div>
    </div>
  )
}

function Modal({
  title,
  onClose,
  children
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-[32rem] rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 text-sm font-medium">{title}</div>
        {children}
      </div>
    </div>
  )
}
