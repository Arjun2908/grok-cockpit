import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { DEFAULT_REPO, type AppSettings, type PersistedTab } from '../shared/types'

const defaults = (): AppSettings => ({
  defaultRepo: DEFAULT_REPO,
  linearApiKey: process.env.LINEAR_API_KEY ?? '',
  notify: true,
  seenWorktreePromo: false
})

function settingsPath(userData: string): string {
  return join(userData, 'settings.json')
}

export function loadSettings(userData: string): AppSettings {
  const path = settingsPath(userData)
  const base = defaults()
  if (!existsSync(path)) return base
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<AppSettings>
    return {
      defaultRepo: parsed.defaultRepo || base.defaultRepo,
      linearApiKey: parsed.linearApiKey || base.linearApiKey,
      notify: parsed.notify !== false,
      seenWorktreePromo: Boolean(parsed.seenWorktreePromo)
    }
  } catch {
    return base
  }
}

export function saveSettings(userData: string, settings: AppSettings): AppSettings {
  const path = settingsPath(userData)
  mkdirSync(dirname(path), { recursive: true })
  const next: AppSettings = {
    defaultRepo: settings.defaultRepo.trim() || DEFAULT_REPO,
    linearApiKey: settings.linearApiKey.trim(),
    notify: settings.notify !== false,
    seenWorktreePromo: Boolean(settings.seenWorktreePromo)
  }
  writeFileSync(path, JSON.stringify(next, null, 2))
  return next
}

export function grokBinary(): string {
  if (process.env.GROK_BIN) return process.env.GROK_BIN
  return join(homedir(), '.grok', 'bin', 'grok')
}

function tabsPath(userData: string): string {
  return join(userData, 'tabs.json')
}

export function loadTabs(userData: string): { tabs: PersistedTab[]; activeId: string | null } {
  const path = tabsPath(userData)
  if (!existsSync(path)) return { tabs: [], activeId: null }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
      tabs?: PersistedTab[]
      activeId?: string | null
    }
    return { tabs: parsed.tabs ?? [], activeId: parsed.activeId ?? null }
  } catch {
    return { tabs: [], activeId: null }
  }
}

export function saveTabs(
  userData: string,
  tabs: PersistedTab[],
  activeId: string | null
): void {
  mkdirSync(userData, { recursive: true })
  writeFileSync(tabsPath(userData), JSON.stringify({ tabs, activeId }, null, 2))
}
