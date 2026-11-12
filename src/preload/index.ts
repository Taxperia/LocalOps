import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '../shared/channels'
import type {
  ActionResult,
  AlertPayload,
  AppInfo,
  AppSettings,
  AutomationFiredPayload,
  AutomationRule,
  CleanupResult,
  CleanupScanResult,
  CleanupTargetId,
  DiagnosticCheck,
  DiskScanEvent,
  DiskScanResult,
  DriversPayload,
  EventQueryRequest,
  EventQueryResult,
  HealthPayload,
  HistoryBundle,
  HistoryPoint,
  HistoryStats,
  HistoryStatus,
  InstalledApp,
  MetricsSnapshot,
  NetConnectionsPayload,
  PowerPlan,
  ProcessDetails,
  ProcessListPayload,
  ProcessPriority,
  ScheduledTaskInfo,
  ServiceInfo,
  ServiceStartupType,
  StartupItem,
  StaticSystemInfo,
  TaskAction
} from '../shared/types'
import type { UpdateStatus } from '../shared/types'
import type { ServiceAction } from '../shared/types'

function subscribe<T>(channel: string, cb: (data: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, data: T): void => cb(data)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  getUpdateStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke(IPC.updateStatus),
  checkForUpdates: (): Promise<UpdateStatus> => ipcRenderer.invoke(IPC.updateCheck),
  installUpdate: (): Promise<ActionResult> => ipcRenderer.invoke(IPC.updateInstall),
  onUpdateStatus: (cb: (status: UpdateStatus) => void): (() => void) => subscribe(IPC.updateEvent, cb),
  // settings
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.settingsGet),
  updateSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.settingsSet, patch),
  onSettingsChanged: (cb: (s: AppSettings) => void): (() => void) =>
    subscribe<AppSettings>(IPC.settingsEvent, cb),

  // metrics
  onMetrics: (cb: (s: MetricsSnapshot) => void): (() => void) =>
    subscribe<MetricsSnapshot>(IPC.metricsEvent, cb),
  getMetricsHistory: (): Promise<HistoryBundle> => ipcRenderer.invoke(IPC.metricsHistory),

  // processes
  onProcesses: (cb: (p: ProcessListPayload) => void): (() => void) =>
    subscribe<ProcessListPayload>(IPC.processesEvent, cb),
  getProcesses: (): Promise<ProcessListPayload> => ipcRenderer.invoke(IPC.processesList),
  getProcessDetails: (pid: number): Promise<ProcessDetails | null> =>
    ipcRenderer.invoke(IPC.processDetails, pid),
  killProcess: (pid: number, force: boolean): Promise<ActionResult> =>
    ipcRenderer.invoke(IPC.processKill, { pid, force }),
  setProcessPriority: (pid: number, priority: ProcessPriority): Promise<ActionResult> =>
    ipcRenderer.invoke(IPC.processPriority, { pid, priority }),

  // alerts
  onAlerts: (cb: (a: AlertPayload) => void): (() => void) =>
    subscribe<AlertPayload>(IPC.alertsEvent, cb),

  // system info & app
  getStaticSystemInfo: (force = false): Promise<StaticSystemInfo> =>
    ipcRenderer.invoke(IPC.staticInfo, force),
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC.appInfo),

  // network monitor
  getNetworkConnections: (): Promise<NetConnectionsPayload> =>
    ipcRenderer.invoke(IPC.networkConnections),

  // services
  getServices: (): Promise<ServiceInfo[]> => ipcRenderer.invoke(IPC.servicesList),
  serviceAction: (name: string, action: ServiceAction): Promise<ActionResult> =>
    ipcRenderer.invoke(IPC.serviceAction, { name, action }),
  setServiceStartupType: (name: string, startupType: ServiceStartupType): Promise<ActionResult> =>
    ipcRenderer.invoke(IPC.serviceSetStartup, { name, startupType }),

  // startup items
  getStartupItems: (): Promise<StartupItem[]> => ipcRenderer.invoke(IPC.startupList),
  toggleStartupItem: (
    item: Pick<StartupItem, 'kind' | 'target' | 'sub' | 'name'>,
    enable: boolean
  ): Promise<ActionResult> => ipcRenderer.invoke(IPC.startupToggle, { item, enable }),

  // installed apps
  getInstalledApps: (): Promise<InstalledApp[]> => ipcRenderer.invoke(IPC.appsList),
  uninstallApp: (id: string): Promise<ActionResult> => ipcRenderer.invoke(IPC.appUninstall, { id }),

  // event viewer
  queryEvents: (req: EventQueryRequest): Promise<EventQueryResult> =>
    ipcRenderer.invoke(IPC.eventsQuery, req),

  // disk analyzer
  startDiskScan: (path: string): Promise<ActionResult> =>
    ipcRenderer.invoke(IPC.diskScanStart, { path }),
  cancelDiskScan: (): Promise<ActionResult> => ipcRenderer.invoke(IPC.diskScanCancel),
  getDiskScanResult: (path: string): Promise<DiskScanResult | null> =>
    ipcRenderer.invoke(IPC.diskScanGet, { path }),
  onDiskScanEvent: (cb: (ev: DiskScanEvent) => void): (() => void) =>
    subscribe<DiskScanEvent>(IPC.diskScanEvent, cb),

  // task scheduler
  getTasks: (userOnly: boolean): Promise<ScheduledTaskInfo[]> => ipcRenderer.invoke(IPC.tasksList, userOnly),
  taskAction: (path: string, name: string, action: TaskAction): Promise<ActionResult> =>
    ipcRenderer.invoke(IPC.taskAction, { path, name, action }),

  // drivers
  getDrivers: (force = false): Promise<DriversPayload> => ipcRenderer.invoke(IPC.driversList, force),

  // power
  getPowerPlans: (): Promise<PowerPlan[]> => ipcRenderer.invoke(IPC.powerPlans),
  setPowerPlan: (guid: string): Promise<ActionResult> => ipcRenderer.invoke(IPC.powerSetActive, guid),

  // cleanup
  scanCleanupTarget: (target: CleanupTargetId): Promise<CleanupScanResult | null> =>
    ipcRenderer.invoke(IPC.cleanupScan, target),
  cleanCleanupTarget: (target: CleanupTargetId, cutoffMs: number): Promise<CleanupResult | null> =>
    ipcRenderer.invoke(IPC.cleanupClean, { target, cutoffMs }),

  // health & diagnostics
  getHealth: (): Promise<HealthPayload> => ipcRenderer.invoke(IPC.healthInfo),
  runDiagnostics: (): Promise<DiagnosticCheck[]> => ipcRenderer.invoke(IPC.diagRun),

  // automation
  testAutomation: (rule: AutomationRule): Promise<ActionResult> =>
    ipcRenderer.invoke(IPC.automationTest, { rule }),
  onAutomationFired: (cb: (p: AutomationFiredPayload) => void): (() => void) =>
    subscribe<AutomationFiredPayload>(IPC.automationFiredEvent, cb),

  // history
  getHistoryStatus: (): Promise<HistoryStatus> => ipcRenderer.invoke(IPC.historyStatus),
  queryHistory: (fromMs: number, toMs: number, maxPoints = 400): Promise<HistoryPoint[]> =>
    ipcRenderer.invoke(IPC.historyQuery, { fromMs, toMs, maxPoints }),
  getHistoryStats: (fromMs: number, toMs: number): Promise<HistoryStats> =>
    ipcRenderer.invoke(IPC.historyStats, { fromMs, toMs }),
  exportHistory: (format: 'csv' | 'json', fromMs: number, toMs: number): Promise<ActionResult> =>
    ipcRenderer.invoke(IPC.historyExport, { format, fromMs, toMs }),

  // elevation
  restartElevated: (): Promise<ActionResult> => ipcRenderer.invoke(IPC.appRestartElevated),

  // window & misc
  window: (action: 'minimize' | 'maximize' | 'close'): Promise<void> =>
    ipcRenderer.invoke(IPC.windowControl, action),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC.windowIsMaximized),
  openDataFolder: (): Promise<void> => ipcRenderer.invoke(IPC.openDataFolder),
  writeClipboard: (text: string): Promise<void> => ipcRenderer.invoke(IPC.clipboardWrite, text)
}

export type LocalOpsApi = typeof api

contextBridge.exposeInMainWorld('localops', api)
