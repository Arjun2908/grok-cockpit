import { spawn } from 'node:child_process'
import { runCommand } from './cli'

function openDetached(file: string, args: string[]): void {
  spawn(file, args, { detached: true, stdio: 'ignore' }).unref()
}

export async function openInCursor(cwd: string, file?: string, line?: number): Promise<void> {
  if (file) {
    const loc = line ? `${file}:${line}` : file
    const result = await runCommand('cursor', ['-g', loc], cwd)
    if (result.code === 0) return
    openDetached('open', ['-a', 'Cursor', file])
    return
  }
  const result = await runCommand('cursor', [cwd], cwd)
  if (result.code === 0) return
  openDetached('open', ['-a', 'Cursor', cwd])
}

export function openInFinder(path: string): void {
  openDetached('open', [path])
}

export function openUrl(url: string): void {
  openDetached('open', [url])
}
