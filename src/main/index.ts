import { app, BrowserWindow, Menu, session } from 'electron'
import { join } from 'node:path'
import { registerIpc, teardownIpc } from './ipc'
import { stopAllAcp } from './acp-broker'
import { killAll } from './pty-broker'
import { developmentRendererUrl, isTrustedRendererUrl } from './renderer-security'

let mainWindow: BrowserWindow | null = null

app.setName('Grok Cockpit')

function sendShortcut(name: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:shortcut', name)
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Grok Cockpit',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: '#0c0c0e',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (
      !isTrustedRendererUrl(url, {
        isPackaged: app.isPackaged,
        developmentUrl: process.env.ELECTRON_RENDERER_URL,
        packagedRendererDirectory: join(__dirname, '../renderer')
      })
    ) {
      event.preventDefault()
    }
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !input.meta) return
    const key = input.key.toLowerCase()
    if (key === 'w' && !input.shift) {
      event.preventDefault()
      sendShortcut('close-tab')
    }
    if (key === 't' && !input.shift) {
      event.preventDefault()
      sendShortcut('new-tab')
    }
    if (/^[1-9]$/.test(key)) {
      event.preventDefault()
      sendShortcut(`tab-${key}`)
    }
    if (input.shift && (key === '[' || key === '{')) {
      event.preventDefault()
      sendShortcut('prev-tab')
    }
    if (input.shift && (key === ']' || key === '}')) {
      event.preventDefault()
      sendShortcut('next-tab')
    }
    if (input.shift && (key === '/' || key === '?')) {
      event.preventDefault()
      sendShortcut('readme')
    }
    if (input.shift && key === 'a') {
      event.preventDefault()
      sendShortcut('about')
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const rendererUrl = developmentRendererUrl(app.isPackaged, process.env.ELECTRON_RENDERER_URL)
  if (rendererUrl) mainWindow.loadURL(rendererUrl)
  else mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

function installMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{ role: 'appMenu' as const }]
      : [{ label: 'File', submenu: [{ role: 'quit' as const }] }]),
    { role: 'editMenu' },
    { role: 'viewMenu' },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => sendShortcut('close-tab')
        },
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Cockpit README',
          accelerator: 'CmdOrCtrl+Shift+/',
          click: () => sendShortcut('readme')
        },
        {
          label: 'About',
          accelerator: 'CmdOrCtrl+Shift+A',
          click: () => sendShortcut('about')
        }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionCheckHandler(() => false)
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(false)
  })
  registerIpc(() => mainWindow, app.getPath('userData'))
  installMenu()
  createWindow()
})

app.on('before-quit', () => {
  teardownIpc()
  stopAllAcp()
  killAll()
})
app.on('window-all-closed', () => {
  teardownIpc()
  killAll()
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
