import { WORKTREE_ROOT } from './types'

export function parseTicketId(raw: string): { team: string; number: number } | null {
  const match = raw.trim().match(/^([A-Za-z]+)-(\d+)$/)
  if (!match) return null
  return { team: match[1].toUpperCase(), number: Number(match[2]) }
}

export function ticketSlug(identifier: string): string {
  const parsed = parseTicketId(identifier)
  if (parsed) return `${parsed.team.toLowerCase()}-${parsed.number}`
  return identifier
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function worktreePathForSlug(slug: string): string {
  return `${WORKTREE_ROOT}/${slug}-wt`
}

export function implementTicketPrompt(
  identifier: string,
  flags: { planOnly?: boolean; paired?: boolean } = {}
): string {
  const parsed = parseTicketId(identifier)
  const id = parsed ? `${parsed.team}-${parsed.number}` : identifier.trim()
  let prompt = `/implement-ticket ${id}`
  if (flags.planOnly) prompt += ' --plan-only'
  if (flags.paired) prompt += ' --paired'
  return prompt
}

export function duplicateCwdWarning(cwds: string[]): string | null {
  const counts = new Map<string, number>()
  for (const cwd of cwds) {
    const key = cwd.replace(/\/+$/, '')
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  for (const [cwd, n] of counts) {
    if (n > 1) {
      return `Two sessions are in ${cwd}. Nutshell PHPUnit shares a database — do not run tests in both.`
    }
  }
  return null
}
