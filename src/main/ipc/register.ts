import { app, clipboard, dialog, ipcMain, shell, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import fs from 'node:fs'
import { IPC } from '@shared/channels'
import { PROCESS_PRIORITIES } from '@shared/settingsSchema'
import type {
  EventLevelFilter,
  EventLogName,
  ProcessPriority,
  ServiceAction,
  ServiceStartupType,
  StartupItem
} from '@shared/types'
import type { MetricsEngine } from '../services/metricsEngine'
import type { ProcessService } from '../services/processService'
import type { SettingsStore } from '../services/settingsStore'
import type { StaticInfoService } from '../services/staticInfo'
import { NetworkService } from '../services/networkService'
import type { ServicesService } from '../services/servicesService'
import type { StartupService } from '../services/startupService'
import type { AppService } from '../services/appService'
import type { EventService } from '../services/eventService'
import type { DiskScanService } from '../services/diskScanService'
import type { TaskSchedulerService } from '../services/taskSchedulerService'
import type { DriverService } from '../services/driverService'
import type { PowerService } from '../services/powerService'
import { isValidTarget } from '../services/cleanupService'
import type { CleanupService } from '../services/cleanupService'
import type { HealthService } from '../services/healthService'
import type { DiagnosticsService } from '../services/diagnosticsService'
import type { HistoryService } from '../services/historyService'
import type { AutomationService } from '../services/automationService'
import { runScriptOnce } from '../services/scriptRunner'
import { psQuote } from '../services/scripts'
import { isTrustedRendererUrl } from './security'
import type { UpdateService } from '../services/updateService'

export interface IpcDeps {
  settingsStore: SettingsStore
  engine: MetricsEngine
  procService: ProcessService
  staticService: StaticInfoService
  netService: NetworkService
  svcService: ServicesService
  startupService: StartupService
  appService: AppService
  eventService: EventService
  diskScanService: DiskScanService
  taskService: TaskSchedulerService
  driverService: DriverService
  powerService: PowerService
  cleanupService: CleanupService
  healthService: HealthService
  diagService: DiagnosticsService
  historyService: HistoryService
  automationService: AutomationService
  updateService: UpdateService
  getWindow: () => BrowserWindow | null
}

const SERVICE_NAME_RE = /^[A-Za-z0-9_.\- $]{1,80}$/
const EVENT_LOGS: EventLogName[] = ['System', 'Application', 'Security', 'Setup']
const EVENT_LEVELS: EventLevelFilter[] = ['all', 'critical', 'error', 'warning', 'information']

function toPid(v: unknown): number {
  if (typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 2 ** 32) return v
  throw new Error('invalid pid')
}

function errResult(err: unknown): { ok: false; error: string } {
  return { ok: false, error: err instanceof Error ? err.message : String(err) }
}

export function registerIpc(deps: IpcDeps): void {
  const getWindow = () => deps.getWindow()

  /** Only accept calls originating from our own main window's webContents. */
  const guarded =
    <T>(fn: (payload: unknown) => Promise<T> | T) =>
    async (_e: IpcMainInvokeEvent, payload: unknown): Promise<T> => {
      const w = getWindow()
      if (!w || w.isDestroyed() || _e.sender !== w.webContents) throw new Error('forbidden sender')
      if (!_e.senderFrame || _e.senderFrame !== w.webContents.mainFrame || !isTrustedRendererUrl(_e.senderFrame.url)) throw new Error('forbidden frame')
      return fn(payload)
    }

  ipcMain.handle(IPC.settingsGet, guarded(() => deps.settingsStore.get()))
  ipcMain.handle(IPC.updateStatus, guarded(() => deps.updateService.getStatus()))
  ipcMain.handle(IPC.updateCheck, guarded(() => deps.updateService.check()))
  ipcMain.handle(IPC.updateInstall, guarded(() => deps.updateService.install()))

  ipcMain.handle(
    IPC.settingsSet,
    guarded((patch: unknown) => deps.settingsStore.update(patch))
  )

  ipcMain.handle(
    IPC.staticInfo,
    guarded((force: unknown) => deps.staticService.get(force === true))
  )

  ipcMain.handle(IPC.metricsHistory, guarded(() => deps.engine.getHistory()))

  ipcMain.handle(IPC.processesList, guarded(() => deps.procService.getList()))

  ipcMain.handle(
    IPC.processDetails,
    guarded(async (pid: unknown) => {
      try {
        return await deps.procService.details(toPid(pid))
      } catch {
        return null
      }
    })
  )

  ipcMain.handle(
    IPC.processKill,
    guarded(async (payload: unknown) => {
      try {
        const p = (payload ?? {}) as Record<string, unknown>
        const pid = toPid(p.pid)
        return await deps.procService.kill(pid, p.force === true)
      } catch (err) {
        return errResult(err)
      }
    })
  )

  ipcMain.handle(
    IPC.processPriority,
    guarded(async (payload: unknown) => {
      try {
        const p = (payload ?? {}) as Record<string, unknown>
        const pid = toPid(p.pid)
        const priority = p.priority as ProcessPriority
        if (!PROCESS_PRIORITIES.includes(priority)) throw new Error('invalid priority')
        return await deps.procService.setPriority(pid, priority)
      } catch (err) {
        return errResult(err)
      }
    })
  )

  ipcMain.handle(
    IPC.appInfo,
    guarded(() => ({
      version: app.getVersion(),
      electron: process.versions.electron ?? '—',
      chrome: process.versions.chrome ?? '—',
      node: process.versions.node ?? '—',
      platform: process.platform,
      isElevated: deps.staticService.isElevated
    }))
  )

  ipcMain.handle(
    IPC.windowControl,
    guarded((action: unknown) => {
      const w = getWindow()
      if (!w || w.isDestroyed()) return
      if (action === 'minimize') w.minimize()
      else if (action === 'maximize') w.isMaximized() ? w.unmaximize() : w.maximize()
      else if (action === 'close') w.close()
    })
  )

  ipcMain.handle(IPC.windowIsMaximized, guarded(() => getWindow()?.isMaximized() ?? false))

  ipcMain.handle(
    IPC.openDataFolder,
    guarded(async () => {
      await shell.openPath(app.getPath('userData'))
    })
  )

  ipcMain.handle(
    IPC.clipboardWrite,
    guarded((text: unknown) => {
      if (typeof text === 'string') clipboard.writeText(text)
    })
  )

  // ── Network Monitor ───────────────────────────────────────────
  ipcMain.handle(
    IPC.networkConnections,
    guarded(async () => {
      const raw = await deps.netService.getConnections()
      if (!raw) return { ts: Date.now(), source: 'cim' as const, connections: [] }
      const nameByPid = new Map<number, string>()
      for (const p of deps.procService.getList().processes) nameByPid.set(p.pid, p.name)
      return {
        ts: Date.now(),
        source: raw.source,
        connections: NetworkService.toConnections(raw, nameByPid)
      }
    })
  )

  // ── Services ──────────────────────────────────────────────────
  ipcMain.handle(IPC.servicesList, guarded(() => deps.svcService.list()))

  ipcMain.handle(
    IPC.serviceAction,
    guarded(async (payload: unknown) => {
      try {
        const p = (payload ?? {}) as Record<string, unknown>
        const name = typeof p.name === 'string' ? p.name : ''
        const action = p.action as ServiceAction
        if (!SERVICE_NAME_RE.test(name)) throw new Error('invalid service name')
        if (!['start', 'stop', 'restart'].includes(action)) throw new Error('invalid action')
        return await deps.svcService.action(name, action)
      } catch (err) {
        return errResult(err)
      }
    })
  )

  ipcMain.handle(
    IPC.serviceSetStartup,
    guarded(async (payload: unknown) => {
      try {
        const p = (payload ?? {}) as Record<string, unknown>
        const name = typeof p.name === 'string' ? p.name : ''
        const mode = p.startupType as ServiceStartupType
        if (!SERVICE_NAME_RE.test(name)) throw new Error('invalid service name')
        if (!['Automatic', 'Manual', 'Disabled'].includes(mode)) throw new Error('invalid startup type')
        return await deps.svcService.setStartupType(name, mode)
      } catch (err) {
        return errResult(err)
      }
    })
  )

  // ── Startup items ─────────────────────────────────────────────
  ipcMain.handle(IPC.startupList, guarded(() => deps.startupService.list()))

  ipcMain.handle(
    IPC.startupToggle,
    guarded(async (payload: unknown) => {
      try {
        const p = (payload ?? {}) as Record<string, unknown>
        const item = p.item as Partial<StartupItem>
        const enable = p.enable === true
        if (!item || !['registry', 'folder'].includes(item.kind ?? '')) throw new Error('invalid item')
        if (!['HKLM', 'HKCU'].includes(item.target ?? '')) throw new Error('invalid target')
        if (!['Run', 'StartupFolder'].includes(item.sub ?? '')) throw new Error('invalid subkey')
        if (typeof item.name !== 'string' || item.name.length === 0 || item.name.length > 260) {
          throw new Error('invalid name')
        }
        return await deps.startupService.toggle(
          { kind: item.kind as StartupItem['kind'], target: item.target as StartupItem['target'], sub: item.sub as StartupItem['sub'], name: item.name },
          enable
        )
      } catch (err) {
        return errResult(err)
      }
    })
  )

  // ── Installed apps ────────────────────────────────────────────
  ipcMain.handle(IPC.appsList, guarded(() => deps.appService.list()))

  ipcMain.handle(
    IPC.appUninstall,
    guarded(async (payload: unknown) => {
      try {
        const p = (payload ?? {}) as Record<string, unknown>
        if (typeof p.id !== 'string' || p.id.length === 0 || p.id.length > 200) throw new Error('invalid app id')
        return await deps.appService.uninstall(p.id)
      } catch (err) {
        return errResult(err)
      }
    })
  )

  // ── Event viewer ──────────────────────────────────────────────
  ipcMain.handle(
    IPC.eventsQuery,
    guarded(async (payload: unknown) => {
      try {
        const p = (payload ?? {}) as Record<string, unknown>
        const log = p.log as EventLogName
        const level = p.level as EventLevelFilter
        if (!EVENT_LOGS.includes(log)) throw new Error('invalid log')
        if (!EVENT_LEVELS.includes(level)) throw new Error('invalid level')
        const startMs = typeof p.startMs === 'number' && Number.isFinite(p.startMs) ? p.startMs : Date.now() - 86400000
        const maxCount = typeof p.maxCount === 'number' ? Math.min(2000, Math.max(10, Math.floor(p.maxCount))) : 300
        return await deps.eventService.query({ log, level, startMs, maxCount })
      } catch (err) {
        return { events: [], error: err instanceof Error ? err.message : String(err) }
      }
    })
  )

  // ── Disk scan ─────────────────────────────────────────────────
  ipcMain.handle(
    IPC.diskScanStart,
    guarded((payload: unknown) => {
      const p = (payload ?? {}) as Record<string, unknown>
      if (typeof p.path !== 'string') return { ok: false, error: 'invalid path' }
      return deps.diskScanService.start(p.path)
    })
  )

  ipcMain.handle(IPC.diskScanCancel, guarded(() => {
    deps.diskScanService.cancel()
    return { ok: true }
  }))

  ipcMain.handle(
    IPC.diskScanGet,
    guarded((payload: unknown) => {
      const p = (payload ?? {}) as Record<string, unknown>
      return typeof p.path === 'string' ? deps.diskScanService.getResult(p.path) : null
    })
  )

  // ── Task Scheduler ────────────────────────────────────────────
  ipcMain.handle(IPC.tasksList, guarded((userOnly: unknown) => deps.taskService.list(userOnly !== false)))

  ipcMain.handle(
    IPC.taskAction,
    guarded(async (payload: unknown) => {
      try {
        const p = (payload ?? {}) as Record<string, unknown>
        if (typeof p.path !== 'string' || typeof p.name !== 'string') throw new Error('invalid task')
        if (typeof p.action !== 'string') throw new Error('invalid action')
        return await deps.taskService.action(p.path, p.name, p.action as 'run' | 'stop' | 'enable' | 'disable')
      } catch (err) {
        return errResult(err)
      }
    })
  )

  // ── Drivers ───────────────────────────────────────────────────
  ipcMain.handle(IPC.driversList, guarded((force: unknown) => deps.driverService.list(force === true)))

  // ── Power ─────────────────────────────────────────────────────
  ipcMain.handle(IPC.powerPlans, guarded(() => deps.powerService.list()))

  ipcMain.handle(
    IPC.powerSetActive,
    guarded(async (guid: unknown) => {
      if (typeof guid !== 'string') return { ok: false, error: 'invalid guid' }
      return deps.powerService.setActive(guid)
    })
  )

  // ── Cleanup ───────────────────────────────────────────────────
  ipcMain.handle(
    IPC.cleanupScan,
    guarded(async (target: unknown) => {
      if (!isValidTarget(target)) return null
      return deps.cleanupService.scan(target)
    })
  )

  ipcMain.handle(
    IPC.cleanupClean,
    guarded(async (payload: unknown) => {
      try {
        const p = (payload ?? {}) as Record<string, unknown>
        if (!isValidTarget(p.target)) throw new Error('invalid target')
        const cutoff = typeof p.cutoffMs === 'number' && Number.isFinite(p.cutoffMs) ? p.cutoffMs : 0
        return await deps.cleanupService.clean(p.target, cutoff)
      } catch (err) {
        return errResult(err)
      }
    })
  )

  // ── Health ────────────────────────────────────────────────────
  ipcMain.handle(IPC.healthInfo, guarded(() => deps.healthService.get()))

  // ── Diagnostics ───────────────────────────────────────────────
  ipcMain.handle(IPC.diagRun, guarded(() => {
    const snap = deps.engine.getLatestSnapshot()
    return deps.diagService.run({
      volumes:
        snap?.logicalVolumes.map((v) => ({ volume: v.volume, totalBytes: v.totalBytes, freeBytes: v.freeBytes })) ?? [],
      memoryUsedPercent: snap?.memory.usedPercent ?? 0,
      uptimeSec: snap?.uptimeSec ?? 0
    })
  }))

  // ── Automation ────────────────────────────────────────────────
  ipcMain.handle(
    IPC.automationTest,
    guarded((payload: unknown) => {
      const p = (payload ?? {}) as Record<string, unknown>
      const rule = p.rule as Parameters<AutomationService['test']>[0] | undefined
      if (!rule || typeof rule.kind !== 'string' || typeof rule.threshold !== 'number') {
        return { ok: false, error: 'invalid rule' }
      }
      deps.automationService.test(rule)
      return { ok: true }
    })
  )

  // ── History & Reports ─────────────────────────────────────────
  ipcMain.handle(IPC.historyStatus, guarded(() => deps.historyService.status()))

  ipcMain.handle(
    IPC.historyQuery,
    guarded((payload: unknown) => {
      const p = (payload ?? {}) as Record<string, unknown>
      const from = typeof p.fromMs === 'number' ? p.fromMs : Date.now() - 3600_000
      const to = typeof p.toMs === 'number' ? p.toMs : Date.now()
      const max = typeof p.maxPoints === 'number' ? Math.min(5000, Math.max(10, p.maxPoints)) : 400
      return deps.historyService.query(from, to, max)
    })
  )

  ipcMain.handle(
    IPC.historyStats,
    guarded((payload: unknown) => {
      const p = (payload ?? {}) as Record<string, unknown>
      const from = typeof p.fromMs === 'number' ? p.fromMs : Date.now() - 3600_000
      const to = typeof p.toMs === 'number' ? p.toMs : Date.now()
      return deps.historyService.stats(from, to)
    })
  )

  ipcMain.handle(
    IPC.historyExport,
    guarded(async (payload: unknown) => {
      try {
        const p = (payload ?? {}) as Record<string, unknown>
        const format = p.format === 'json' ? 'json' : 'csv'
        const from = typeof p.fromMs === 'number' ? p.fromMs : Date.now() - 86400_000
        const to = typeof p.toMs === 'number' ? p.toMs : Date.now()
        const w = getWindow()
        if (!w) return { ok: false, error: 'no window' }
        const res = await dialog.showSaveDialog(w, {
          title: 'LocalOps',
          defaultPath: `localops-history-${new Date().toISOString().slice(0, 10)}.${format}`
        })
        if (res.canceled || !res.filePath) return { ok: false, error: 'cancelled' }
        const points = deps.historyService.query(from, to, 1_000_000)
        const content =
          format === 'json'
            ? JSON.stringify(points, null, 2)
            : 'timestamp,cpu_percent,memory_percent,disk_read_bps,disk_write_bps,net_recv_bps,net_sent_bps\n' +
              points
                .map((pt) =>
                  [new Date(pt.ts).toISOString(), pt.cpu.toFixed(2), pt.mem.toFixed(2), Math.round(pt.diskRead), Math.round(pt.diskWrite), Math.round(pt.netRecv), Math.round(pt.netSent)].join(',')
                )
                .join('\n')
        fs.writeFileSync(res.filePath, content, 'utf-8')
        return { ok: true }
      } catch (err) {
        return errResult(err)
      }
    })
  )

  // ── Elevation ─────────────────────────────────────────────────
  ipcMain.handle(
    IPC.appRestartElevated,
    guarded(async () => {
      if (!app.isPackaged) return { ok: false, error: 'packaged only' }
      try {
        const out = await runScriptOnce(
          `Start-Process -FilePath ${psQuote(process.execPath)} -Verb RunAs -ErrorAction Stop; Write-Output 'OK'`,
          120000
        )
        if (out.trim().includes('OK')) {
          setTimeout(() => app.quit(), 500)
          return { ok: true }
        }
        return { ok: false, error: 'elevation declined' }
      } catch (err) {
        return errResult(err)
      }
    })
  )

  deps.settingsStore.onChange((s) => {
    const w = getWindow()
    if (w && !w.isDestroyed()) w.webContents.send(IPC.settingsEvent, s)
  })
}
