import type { GrokSession, WorktreeInfo } from './types'

const UUID =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/i

export function parseGrokSessionsList(text: string, defaultRepo = ''): GrokSession[] {
  const sessions: GrokSession[] = []
  let group = '(no label)'

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^SESSION ID\b/i.test(trimmed)) continue

    const match = trimmed.match(UUID)
    if (match) {
      sessions.push({
        id: match[1],
        created: match[2],
        updated: match[3],
        status: match[4],
        summary: match[5].trim(),
        group,
        cwd: defaultRepo
      })
      continue
    }

    group = trimmed
  }

  return sessions
}

export function resolveSessionCwd(
  session: Pick<GrokSession, 'group'>,
  defaultRepo: string,
  worktrees: WorktreeInfo[]
): string {
  const group = session.group.trim()
  if (!group || group === '(no label)') return defaultRepo
  if (group.startsWith('/')) return group
  const byBranch = worktrees.find((tree) => tree.branch === group)
  if (byBranch) return byBranch.path
  const byPath = worktrees.find(
    (tree) => tree.path.endsWith(`/${group}`) || tree.path.endsWith(`/${group}-wt`)
  )
  if (byPath) return byPath.path
  return defaultRepo
}

export type SessionFilter = 'all' | 'repo' | 'worktrees' | 'today'

const TICKET = /\b[A-Za-z]+-\d+\b/g

export function ticketIdsIn(text: string): string[] {
  return [...text.matchAll(TICKET)].map((match) => match[0].toUpperCase())
}

export function cwdLabel(cwd: string): string {
  const parts = cwd.replace(/\/+$/, '').split('/')
  return parts[parts.length - 1] || cwd
}

export function formatSessionDate(isoDay: string, today = ''): string {
  if (!isoDay) return ''
  if (today && isoDay === today) return 'today'
  const [, month, day] = isoDay.split('-')
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthName = names[Number(month) - 1]
  if (!monthName || !day) return isoDay
  return `${monthName} ${Number(day)}`
}

export function filterSessions(
  sessions: GrokSession[],
  query: string,
  options: { filter?: SessionFilter; defaultRepo?: string; today?: string } = {}
): GrokSession[] {
  const q = query.trim().toLowerCase()
  const filter = options.filter ?? 'all'
  const repo = (options.defaultRepo ?? '').replace(/\/+$/, '')
  return sessions.filter((session) => {
    const cwd = session.cwd.replace(/\/+$/, '')
    if (filter === 'repo' && repo && cwd !== repo) return false
    if (filter === 'worktrees' && repo && cwd === repo) return false
    if (filter === 'today' && options.today && session.updated !== options.today) return false
    if (!q) return true
    const haystack = [
      session.summary,
      session.id,
      session.group,
      session.cwd,
      cwdLabel(session.cwd),
      session.updated,
      formatSessionDate(session.updated, options.today),
      ...ticketIdsIn(`${session.summary} ${session.group}`)
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export type SessionGroup = {
  cwd: string
  label: string
  branch: string | null
  sessions: GrokSession[]
}

export function groupSessions(sessions: GrokSession[], worktrees: WorktreeInfo[] = []): SessionGroup[] {
  const order: string[] = []
  const buckets = new Map<string, GrokSession[]>()
  for (const session of sessions) {
    const key = session.cwd.replace(/\/+$/, '') || '(unknown)'
    if (!buckets.has(key)) {
      buckets.set(key, [])
      order.push(key)
    }
    buckets.get(key)?.push(session)
  }
  return order.map((cwd) => {
    const tree = worktrees.find((item) => item.path.replace(/\/+$/, '') === cwd)
    return {
      cwd,
      label: cwdLabel(cwd),
      branch: tree?.branch ?? null,
      sessions: buckets.get(cwd) ?? []
    }
  })
}
