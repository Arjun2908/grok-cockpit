import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { worktreePathForSlug } from '../shared/ticket'
import type { CreateWorktreeRequest, CreateWorktreeResult } from '../shared/types'
import { runCommand } from './cli'
import { resolveMainRepo } from './git-service'

export async function createNutshellWorktree(
  request: CreateWorktreeRequest
): Promise<CreateWorktreeResult> {
  const mainRepo = await resolveMainRepo(request.repoRoot)
  const path = worktreePathForSlug(request.slug)
  if (existsSync(path)) {
    return { ok: true, path, branch: request.branch?.trim() || request.slug, attached: true }
  }

  const setup = join(mainRepo, '.cursor', 'hooks', 'worktree-setup.sh')
  if (!existsSync(setup)) {
    return {
      ok: false,
      error: `Nutshell worktree-setup.sh not found at ${setup}. Refusing to create a bare git worktree.`
    }
  }

  const branch = request.branch?.trim() || request.slug
  const baseRef = request.baseRef?.trim() || 'origin/main'
  const showBranch = await runCommand('git', ['rev-parse', '--verify', branch], mainRepo)
  const add =
    showBranch.code === 0
      ? await runCommand('git', ['worktree', 'add', path, branch], mainRepo)
      : await runCommand('git', ['worktree', 'add', '-b', branch, path, baseRef], mainRepo)

  if (add.code !== 0) {
    return { ok: false, error: add.stderr || add.stdout || 'git worktree add failed' }
  }

  const setupRun = await runCommand('bash', [setup], path, 60_000, {
    ROOT_WORKTREE_PATH: mainRepo
  })
  if (setupRun.code !== 0) {
    return {
      ok: false,
      error: `worktree created at ${path} but setup failed: ${setupRun.stderr || setupRun.stdout}`
    }
  }

  if (!existsSync(join(path, 'node_modules'))) {
    return {
      ok: false,
      error: `worktree created at ${path} but node_modules was not symlinked. Run worktree-setup.sh before using grok.`
    }
  }

  return { ok: true, path, branch, attached: false }
}

export async function repairWorktree(path: string, repoRoot: string): Promise<CreateWorktreeResult> {
  const mainRepo = await resolveMainRepo(repoRoot)
  const setup = join(mainRepo, '.cursor', 'hooks', 'worktree-setup.sh')
  if (!existsSync(setup)) {
    return { ok: false, error: `worktree-setup.sh not found at ${setup}` }
  }
  const setupRun = await runCommand('bash', [setup], path, 60_000, {
    ROOT_WORKTREE_PATH: mainRepo
  })
  if (setupRun.code !== 0) {
    return { ok: false, error: setupRun.stderr || setupRun.stdout || 'setup failed' }
  }
  const branch = await runCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD'], path)
  return { ok: true, path, branch: branch.stdout.trim() || path, attached: true }
}

export async function removeWorktree(
  path: string,
  repoRoot: string,
  force: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const mainRepo = await resolveMainRepo(repoRoot)
  if (path === mainRepo) {
    return { ok: false, error: 'Refusing to remove the main checkout' }
  }
  const args = force ? ['worktree', 'remove', '--force', path] : ['worktree', 'remove', path]
  const result = await runCommand('git', args, mainRepo)
  if (result.code !== 0) {
    return { ok: false, error: result.stderr || result.stdout || 'git worktree remove failed' }
  }
  return { ok: true }
}
