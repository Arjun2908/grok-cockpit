import { describe, expect, it } from 'vitest'
import { parseGitStatusShort, parseStatusBranch, parseWorktreePorcelain, splitPath, truncateDiff } from './git'

describe('parseWorktreePorcelain', () => {
  it('parses git worktree list --porcelain', () => {
    const text = `worktree /Users/me/source/nutshell/nutshell
HEAD abc
branch refs/heads/main

worktree /private/tmp/ava-1-wt
HEAD def
branch refs/heads/ava-1
`
    const trees = parseWorktreePorcelain(text, '/Users/me/source/nutshell/nutshell')
    expect(trees).toEqual([
      { path: '/Users/me/source/nutshell/nutshell', branch: 'main', isMain: true, dirty: false },
      { path: '/private/tmp/ava-1-wt', branch: 'ava-1', isMain: false, dirty: false }
    ])
  })
})

describe('path helpers', () => {
  it('splits directory and name', () => {
    expect(splitPath('src/main/ipc.ts')).toEqual({ dir: 'src/main', name: 'ipc.ts' })
  })

  it('reads the branch from status -sb', () => {
    expect(parseStatusBranch('## main...origin/main\n M file')).toBe('main')
  })
})

describe('truncateDiff', () => {
  it('keeps small diffs intact', () => {
    expect(truncateDiff('hello', 10)).toBe('hello')
  })

  it('truncates large diffs', () => {
    expect(truncateDiff('abcdefghij', 4)).toContain('truncated')
  })
})

describe('parseGitStatusShort', () => {
  it('classifies staged, unstaged, and untracked', () => {
    const files = parseGitStatusShort(`## main
M  staged.ts
 M unstaged.ts
?? new.ts
MM both.ts
`)
    expect(files).toEqual([
      { path: 'staged.ts', kind: 'staged', code: 'M' },
      { path: 'unstaged.ts', kind: 'unstaged', code: 'M' },
      { path: 'new.ts', kind: 'untracked', code: '?' },
      { path: 'both.ts', kind: 'staged', code: 'M' },
      { path: 'both.ts', kind: 'unstaged', code: 'M' }
    ])
  })
})
