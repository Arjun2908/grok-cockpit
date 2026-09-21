import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { dedupeMcpHealth, parseInspectSkills, parseMcpDoctor } from '../shared/mcp'
import { parseGrokSessionsList, resolveSessionCwd } from '../shared/sessions'
import { mergeSkills } from '../shared/skills'
import type { GrokSession, McpServerHealth, SkillInfo } from '../shared/types'
import { parseGrokUsage, type SessionUsage } from '../shared/usage'
import { runGrok } from './cli'
import { listWorktrees } from './git-service'

export async function listSessions(cwd: string): Promise<GrokSession[]> {
  const result = await runGrok(['sessions', 'list', '-n', '50'], cwd, 20_000)
  if (result.code !== 0 && !result.stdout.trim()) {
    throw new Error(result.stderr || 'grok sessions list failed')
  }
  const sessions = parseGrokSessionsList(result.stdout, cwd)
  let worktrees: Awaited<ReturnType<typeof listWorktrees>> = []
  try {
    worktrees = await listWorktrees(cwd)
  } catch {
    worktrees = []
  }
  return sessions.map((session) => ({
    ...session,
    cwd: resolveSessionCwd(session, cwd, worktrees)
  }))
}

export async function listSkills(cwd: string): Promise<SkillInfo[]> {
  const result = await runGrok(['inspect', '--json'], cwd, 45_000)
  if (result.code !== 0 && !result.stdout.trim()) {
    throw new Error(result.stderr || 'grok inspect failed')
  }
  return mergeSkills(parseInspectSkills(result.stdout))
}

export async function mcpHealth(cwd: string): Promise<McpServerHealth[]> {
  const result = await runGrok(['mcp', 'doctor', '--json'], cwd, 60_000)
  if (!result.stdout.trim()) return []
  return dedupeMcpHealth(parseMcpDoctor(result.stdout))
}

export function latestSessionId(cwd: string, afterMs = 0): string | null {
  const dir = join(homedir(), '.grok', 'sessions', encodeURIComponent(cwd))
  try {
    const entries = readdirSync(dir)
      .map((name) => {
        const path = join(dir, name)
        try {
          return { name, mtime: statSync(path).mtimeMs, isDir: statSync(path).isDirectory() }
        } catch {
          return null
        }
      })
      .filter((entry): entry is { name: string; mtime: number; isDir: boolean } => Boolean(entry?.isDir))
      .filter((entry) => /^[0-9a-f-]{36}$/i.test(entry.name))
      .filter((entry) => entry.mtime >= afterMs)
      .sort((a, b) => b.mtime - a.mtime)
    return entries[0]?.name ?? null
  } catch {
    return null
  }
}

export async function sessionUsage(sessionId: string): Promise<SessionUsage | null> {
  const result = await runGrok(['usage', sessionId], process.cwd(), 15_000)
  if (!result.stdout.trim()) return null
  return parseGrokUsage(result.stdout)
}

function summaryPath(cwd: string, sessionId: string): string {
  return join(homedir(), '.grok', 'sessions', encodeURIComponent(cwd), sessionId, 'summary.json')
}

export async function deleteSession(
  sessionId: string,
  cwd: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await runGrok(['sessions', 'delete', sessionId], cwd, 20_000)
  if (result.code !== 0) {
    return { ok: false, error: result.stderr || result.stdout || 'delete failed' }
  }
  return { ok: true }
}

export function renameSession(
  sessionId: string,
  cwd: string,
  title: string
): { ok: true } | { ok: false; error: string } {
  const path = summaryPath(cwd, sessionId)
  if (!existsSync(path)) {
    return { ok: false, error: `summary.json not found for ${sessionId}` }
  }
  try {
    const data = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
    data.generated_title = title
    data.title_is_manual = true
    data.session_summary = title
    writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
}
