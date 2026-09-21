import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { grokBinary } from './settings'

const execFileAsync = promisify(execFile)

export async function runCommand(
  file: string,
  args: string[],
  cwd: string,
  timeoutMs = 20_000,
  extraEnv: NodeJS.ProcessEnv = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, ...extraEnv }
    })
    return { stdout: stdout.toString(), stderr: stderr.toString(), code: 0 }
  } catch (error) {
    const err = error as {
      stdout?: string | Buffer
      stderr?: string | Buffer
      code?: number | string
      message?: string
    }
    return {
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? err.message ?? String(error),
      code: typeof err.code === 'number' ? err.code : 1
    }
  }
}

export function runGrok(
  args: string[],
  cwd: string,
  timeoutMs = 30_000
): Promise<{ stdout: string; stderr: string; code: number }> {
  return runCommand(grokBinary(), args, cwd, timeoutMs)
}
