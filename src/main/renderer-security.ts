import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

interface RendererSecurityOptions {
  isPackaged: boolean
  developmentUrl?: string
  packagedRendererDirectory: string
}

export function developmentRendererUrl(
  isPackaged: boolean,
  configuredUrl?: string
): string | undefined {
  return !isPackaged && configuredUrl ? configuredUrl : undefined
}

export function isTrustedRendererUrl(
  candidateUrl: string,
  options: RendererSecurityOptions
): boolean {
  const devUrl = developmentRendererUrl(options.isPackaged, options.developmentUrl)

  try {
    const candidate = new URL(candidateUrl)
    if (devUrl) return candidate.origin === new URL(devUrl).origin
    if (candidate.protocol !== 'file:') return false

    const rendererRoot = `${resolve(options.packagedRendererDirectory)}${sep}`
    const candidatePath = resolve(fileURLToPath(candidate))
    return candidatePath.startsWith(rendererRoot)
  } catch {
    return false
  }
}
