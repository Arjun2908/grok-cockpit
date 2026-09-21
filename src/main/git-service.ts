import { realpathSync, watch, type FSWatcher } from 'node:fs'
import { join } from 'node:path'
import { parseGitStatusShort, parseWorktreePorcelain, truncateDiff } from '../shared/git'
import type { GitSnapshot, PrInfo, WorktreeInfo } from '../shared/types'
import { runCommand } from './cli'

export async function listWorktrees(repoRoot: string): Promise<WorktreeInfo[]> {
  const { stdout, code, stderr } = await runCommand(
    'git',
    ['worktree', 'list', '--porcelain'],
    repoRoot
  )
  if (code !== 0) throw new Error(stderr || 'git worktree list failed')
  let main = repoRoot
  try {
    main = realpathSync(repoRoot)
  } catch {
    // keep repoRoot
  }
  const trees = parseWorktreePorcelain(stdout, main)
  await Promise.all(
    trees.map(async (tree) => {
      const status = await runCommand('git', ['status', '--porcelain'], tree.path)
      tree.dirty = status.stdout.trim().length > 0
    })
  )
  return trees
}

export async function fileDiff(cwd: string, filePath: string, staged: boolean): Promise<string> {
  const args = staged ? ['diff', '--cached', '--', filePath] : ['diff', '--', filePath]
  const result = await runCommand('git', args, cwd)
  return truncateDiff(result.stdout.trim() || '(no textual diff)')
}

export async function gitSnapshot(cwd: string): Promise<GitSnapshot> {
  const [status, unstaged, staged] = await Promise.all([
    runCommand('git', ['status', '-sb'], cwd),
    runCommand('git', ['diff'], cwd),
    runCommand('git', ['diff', '--cached'], cwd)
  ])
  const parts = [unstaged.stdout, staged.stdout ? `staged:\n${staged.stdout}` : '']
    .map((part) => part.trim())
    .filter(Boolean)
  return {
    cwd,
    status: status.stdout.trim() || status.stderr.trim(),
    diff: truncateDiff(parts.join('\n\n') || '(clean)'),
    files: parseGitStatusShort(status.stdout)
  }
}

export async function prInfo(cwd: string): Promise<PrInfo> {
  const result = await runCommand('gh', ['pr', 'view', '--json', 'title,url'], cwd)
  if (result.code !== 0) return null
  try {
    const parsed = JSON.parse(result.stdout) as { title?: string; url?: string }
    if (!parsed.url) return null
    return { title: parsed.title || 'PR', url: parsed.url }
  } catch {
    return null
  }
}

const watchers = new Map<string, FSWatcher>()

export function watchGit(cwd: string, onChange: () => void): void {
  unwatchGit(cwd)
  let timer: NodeJS.Timeout | undefined
  const fire = (): void => {
    clearTimeout(timer)
    timer = setTimeout(onChange, 300)
  }
  try {
    const watcher = watch(join(cwd, '.git'), fire)
    watchers.set(cwd, watcher)
  } catch {
    // not a git dir
  }
}

export function unwatchGit(cwd: string): void {
  const watcher = watchers.get(cwd)
  if (!watcher) return
  watcher.close()
  watchers.delete(cwd)
}

export function unwatchAllGit(): void {
  for (const cwd of [...watchers.keys()]) unwatchGit(cwd)
}

export async function resolveMainRepo(cwd: string): Promise<string> {
  const common = await runCommand('git', ['rev-parse', '--git-common-dir'], cwd)
  if (common.code !== 0) throw new Error(common.stderr || 'not a git repo')
  const gitCommon = common.stdout.trim()
  const show = await runCommand('git', ['rev-parse', '--show-toplevel'], cwd)
  if (gitCommon === '.git') return show.stdout.trim()
  const parent = await runCommand(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    cwd
  )
  const abs = parent.stdout.trim()
  if (abs.endsWith('/.git')) return abs.slice(0, -'/.git'.length)
  const toplevel = await runCommand('git', ['rev-parse', '--show-toplevel'], cwd)
  return toplevel.stdout.trim()
}
