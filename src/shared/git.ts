import type { WorktreeInfo } from './types'

export function parseWorktreePorcelain(text: string, mainRepo: string): WorktreeInfo[] {
  const trees: WorktreeInfo[] = []
  let current: Partial<WorktreeInfo> | null = null

  const flush = (): void => {
    if (!current?.path) return
    trees.push({
      path: current.path,
      branch: current.branch ?? null,
      isMain: current.path === mainRepo.replace(/\/+$/, ''),
      dirty: false
    })
    current = null
  }

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    if (!line) {
      flush()
      continue
    }
    if (line.startsWith('worktree ')) {
      flush()
      current = { path: line.slice('worktree '.length) }
      continue
    }
    if (line.startsWith('branch ') && current) {
      const ref = line.slice('branch '.length)
      current.branch = ref.replace(/^refs\/heads\//, '')
    }
  }
  flush()
  return trees
}

export function truncateDiff(text: string, maxChars = 200_000): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n\n… truncated (${text.length - maxChars} more bytes)`
}

export type GitFileKind = 'unstaged' | 'staged' | 'untracked'

export function parseGitStatusShort(
  text: string
): Array<{ path: string; kind: GitFileKind; code: string }> {
  const files: Array<{ path: string; kind: GitFileKind; code: string }> = []
  for (const raw of text.split('\n')) {
    if (!raw || raw.startsWith('##')) continue
    const xy = raw.slice(0, 2)
    let filePath = raw.slice(3)
    if (filePath.includes(' -> ')) filePath = filePath.split(' -> ').pop() ?? filePath
    const x = xy[0]
    const y = xy[1]
    if (x === '?' && y === '?') {
      files.push({ path: filePath, kind: 'untracked', code: '?' })
      continue
    }
    if (x && x !== ' ' && x !== '?') files.push({ path: filePath, kind: 'staged', code: x })
    if (y && y !== ' ' && y !== '?') files.push({ path: filePath, kind: 'unstaged', code: y })
  }
  return files
}

export function splitPath(filePath: string): { dir: string; name: string } {
  const slash = filePath.lastIndexOf('/')
  if (slash === -1) return { dir: '', name: filePath }
  return { dir: filePath.slice(0, slash), name: filePath.slice(slash + 1) }
}

export function parseStatusBranch(status: string): string {
  const line = status.split('\n')[0] ?? ''
  const match = line.match(/^##\s+([^\s.]+)/)
  return match?.[1] ?? ''
}
