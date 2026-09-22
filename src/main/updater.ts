import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '../shared/types'

let status: UpdateStatus = {
  phase: 'idle',
  version: '',
  currentVersion: '',
  percent: 0,
  message: ''
}

function publish(next: UpdateStatus): void {
  status = next
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('update:status', next)
  }
}

export function getUpdateStatus(): UpdateStatus {
  return status
}

export function initializeUpdater(): void {
  status = { ...status, currentVersion: app.getVersion() }
  if (!app.isPackaged) {
    publish({ ...status, phase: 'unsupported', message: 'Updates install from the signed app.' })
    return
  }
  autoUpdater.setFeedURL({ provider: 'github', owner: 'Arjun2908', repo: 'grok-cockpit' })
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => publish({ ...status, phase: 'checking', message: 'Checking for updates' }))
  autoUpdater.on('update-available', (info) => {
    publish({ ...status, phase: 'available', version: info.version, percent: 0, message: `Update ${info.version} is ready` })
  })
  autoUpdater.on('update-not-available', () => publish({ ...status, phase: 'uptodate', message: 'Up to date' }))
  autoUpdater.on('download-progress', (progress) => {
    publish({ ...status, phase: 'downloading', percent: Math.round(progress.percent), message: 'Downloading' })
  })
  autoUpdater.on('update-downloaded', (info) => {
    publish({ ...status, phase: 'downloaded', version: info.version, percent: 100, message: 'Restart to install' })
  })
  autoUpdater.on('error', (error) => {
    publish({ ...status, phase: 'error', message: error.message || 'Update check failed' })
  })
  setTimeout(() => {
    void checkForUpdates()
  }, 4000)
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  if (!app.isPackaged) return status
  publish({ ...status, phase: 'checking', message: 'Checking for updates' })
  await autoUpdater.checkForUpdates()
  return status
}

export async function downloadUpdate(): Promise<UpdateStatus> {
  if (status.phase !== 'available' && status.phase !== 'downloading') return status
  await autoUpdater.downloadUpdate()
  return status
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall()
}
