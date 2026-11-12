import { app, BrowserWindow, screen } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { registerIpc } from './ipc/register'
import { MetricsEngine } from './services/metricsEngine'
import { ProcessService } from './services/processService'
import { SettingsStore } from './services/settingsStore'
import { StaticInfoService } from './services/staticInfo'
import { NetworkService } from './services/networkService'
import { ServicesService } from './services/servicesService'
import { StartupService } from './services/startupService'
import { AppService } from './services/appService'
import { EventService } from './services/eventService'
import { DiskScanService } from './services/diskScanService'
import { TaskSchedulerService } from './services/taskSchedulerService'
import { DriverService } from './services/driverService'
import { PowerService } from './services/powerService'
import { CleanupService } from './services/cleanupService'
import { HealthService } from './services/healthService'
import { DiagnosticsService } from './services/diagnosticsService'
import { HistoryService } from './services/historyService'
import { AutomationService } from './services/automationService'
import { UpdateService } from './services/updateService'
import { stopScriptProcesses } from './services/scriptRunner'

let mainWindow: BrowserWindow | null = null
let settingsStore: SettingsStore | null = null
let engine: MetricsEngine | null = null
let procService: ProcessService | null = null
let staticService: StaticInfoService | null = null
let diskScanService: DiskScanService | null = null
let historyService: HistoryService | null = null
let updateService: UpdateService | null = null

const isDev = !app.isPackaged && !!process.env['ELECTRON_RENDERER_URL']

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
}

function windowStateFile(): string {
  return path.join(app.getPath('userData'), 'window-state.json')
}

function loadWindowState(): WindowState {
  const fallback: WindowState = { width: 1280, height: 820, isMaximized: false }
  try {
    const raw = JSON.parse(fs.readFileSync(windowStateFile(), 'utf-8')) as Partial<WindowState>
    if (typeof raw.width !== 'number' || typeof raw.height !== 'number') return fallback
    const state: WindowState = {
      width: Math.max(960, raw.width),
      height: Math.max(600, raw.height),
      isMaximized: raw.isMaximized === true
    }
    if (typeof raw.x === 'number' && typeof raw.y === 'number') {
      const visible = screen.getAllDisplays().some((d) => {
        const { x, y, width, height } = d.workArea
        return raw.x! >= x - 40 && raw.x! < x + width && raw.y! >= y - 40 && raw.y! < y + height
      })
      if (visible) {
        state.x = raw.x
        state.y = raw.y
      }
    }
    return state
  } catch {
    return fallback
  }
}

function saveWindowState(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const bounds = mainWindow.getNormalBounds()
  const state: WindowState = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: mainWindow.isMaximized()
  }
  try {
    fs.writeFileSync(windowStateFile(), JSON.stringify(state), 'utf-8')
  } catch {
    // non-critical
  }
}

function broadcast(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(channel, payload)
  }
}

function createWindow(): void {
  const state = loadWindowState()
  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#0b0d10',
    title: 'LocalOps',
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'win32' ? { color: '#0b0d10', symbolColor: '#a9b1bd', height: 36 } : false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      webSecurity: true
    }
  })

  if (state.isMaximized) mainWindow.maximize()
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault())
  mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  mainWindow.webContents.session.setPermissionCheckHandler(() => false)
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('close', saveWindowState)
  mainWindow.on('closed', () => (mainWindow = null))

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    settingsStore = SettingsStore.forDir(app.getPath('userData'))
    staticService = new StaticInfoService()
    procService = new ProcessService({
      send: broadcast,
      getSystemCpu: () => engine?.systemCpuUsage ?? 0
    })
    historyService = new HistoryService(app.getPath('userData'), () => settingsStore!.get().historyRetentionDays)
    const automationService = new AutomationService(() => settingsStore!.get(), broadcast)
    updateService = new UpdateService(broadcast)
    updateService.configure(settingsStore.get().autoCheckUpdates)
    let autoCheckUpdates = settingsStore.get().autoCheckUpdates
    settingsStore.onChange((s) => {
      if (autoCheckUpdates !== s.autoCheckUpdates) {
        autoCheckUpdates = s.autoCheckUpdates
        updateService?.configure(autoCheckUpdates)
      }
    })
    engine = new MetricsEngine({
      getSettings: () => settingsStore!.get(),
      getProcessStats: () => procService!.getStats(),
      send: broadcast,
      recordPoint: (p) => historyService?.record(p),
      evaluateAutomations: (s) => automationService.evaluate(s)
    })

    // keep sampler status indicator honest
    setInterval(() => {
      if (!engine || !procService) return
      engine.setProcessSamplerStatus(procService.getStatus())
    }, 2000)

    registerIpc({
      settingsStore,
      engine,
      procService,
      staticService,
      netService: new NetworkService(),
      svcService: new ServicesService(),
      startupService: new StartupService(),
      appService: new AppService(),
      eventService: new EventService(),
      diskScanService: (diskScanService = new DiskScanService(broadcast)),
      taskService: new TaskSchedulerService(),
      driverService: new DriverService(),
      powerService: new PowerService(),
      cleanupService: new CleanupService(),
      healthService: new HealthService(),
      diagService: new DiagnosticsService(),
      historyService,
      automationService,
      updateService,
      getWindow: () => mainWindow
    })

    procService.start()
    engine.start()

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', () => {
  saveWindowState()
  engine?.stop()
  procService?.stop()
  diskScanService?.cancel()
  historyService?.close()
  updateService?.stop()
  stopScriptProcesses()
})
