export type Locale = 'tr' | 'en'
export type AccentId = 'violet' | 'blue' | 'emerald' | 'amber' | 'rose'

export interface NotificationSettings {
  enabled: boolean
  cpuPercent: number
  memoryPercent: number
  diskActivityPercent: number
  cooldownMinutes: number
}

export interface DashboardWidgetState {
  id: string
  visible: boolean
  order: number
}

export interface AppSettings {
  locale: Locale
  accent: AccentId
  intervalMs: number
  sidebarCollapsed: boolean
  notifications: NotificationSettings
  dashboard: { widgets: DashboardWidgetState[] }
  automations: AutomationRule[]
  historyRetentionDays: number
  cleanupRetentionHours: number
  autoCheckUpdates: boolean
}

export interface UpdateStatus {
  state: 'disabled' | 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  error?: string
}

export interface CpuSnapshot {
  usage: number
  perCore: number[]
}

export interface MemorySnapshot {
  totalBytes: number
  availableBytes: number
  usedPercent: number
  committedBytes: number
  commitLimitBytes: number
  cachedBytes: number
  pagedPoolBytes: number
  nonPagedPoolBytes: number
}

export interface DiskSnapshot {
  device: string
  volumes: string[]
  totalBytes: number | null
  freeBytes: number | null
  readBytesSec: number
  writeBytesSec: number
  activityPercent: number
  queueLength: number
}

export interface LogicalVolume {
  volume: string
  label: string | null
  totalBytes: number
  freeBytes: number
}

export interface NetSnapshot {
  id: string
  sentBytesSec: number
  receivedBytesSec: number
  linkSpeedBps: number | null
}

export interface GpuSnapshot {
  id: string
  utilPercent: number | null
  dedicatedUsedBytes: number | null
  sharedUsedBytes: number | null
}

export interface BatterySnapshot {
  chargePercent: number | null
  charging: boolean | null
}

export type SamplerState = 'up' | 'down' | 'starting'

export interface SamplerStatus {
  fast: SamplerState
  processes: SamplerState
  meta: SamplerState
}

export interface MetricsSnapshot {
  ts: number
  cpu: CpuSnapshot
  memory: MemorySnapshot
  disks: DiskSnapshot[]
  logicalVolumes: LogicalVolume[]
  network: NetSnapshot[]
  gpus: GpuSnapshot[]
  battery: BatterySnapshot | null
  uptimeSec: number
  processCount: number
  threadCount: number
  samplerStatus: SamplerStatus
}

export type ProcessPriority = 'Idle' | 'BelowNormal' | 'Normal' | 'AboveNormal' | 'High' | 'RealTime'

export type ProcessStatus = 'running' | 'notResponding' | 'unknown'

export interface ProcessInfo {
  pid: number
  name: string
  ppid: number | null
  path: string | null
  commandLine: string | null
  cpuPercent: number | null
  memoryBytes: number
  privateBytes: number
  handles: number | null
  threads: number | null
  startedAt: number | null
  userName: string | null
  status: ProcessStatus
  windowTitle: string | null
}

export interface ProcessListPayload {
  ts: number
  processes: ProcessInfo[]
  systemCpuUsage: number
}

export interface SignatureInfo {
  status: string
  signer: string | null
}

export interface ProcessFileInfo {
  company: string | null
  description: string | null
  fileVersion: string | null
  productName: string | null
  fileSizeBytes: number | null
  modifiedAt: number | null
}

export interface ProcessDetails {
  info: ProcessInfo
  parentName: string | null
  children: { pid: number; name: string }[]
  signature: SignatureInfo | null
  fileInfo: ProcessFileInfo | null
}

export interface RamModule {
  slot: string
  capacityBytes: number
  speedMhz: number | null
  configuredSpeedMhz: number | null
  manufacturer: string | null
  partNumber: string | null
}

export interface GpuStaticInfo {
  name: string
  driverVersion: string | null
  driverDate: number | null
  vramBytes: number | null
  videoMode: string | null
  status: string | null
  pnpId: string | null
}

export interface StorageDeviceInfo {
  model: string
  sizeBytes: number | null
  busType: string | null
  mediaType: string | null
  healthStatus: string | null
  firmware: string | null
}

export interface AdapterInfo {
  name: string
  description: string | null
  mac: string | null
  status: string | null
  linkSpeed: string | null
}

export interface StaticSystemInfo {
  ts: number
  os: {
    caption: string | null
    version: string | null
    build: string | null
    arch: string | null
    installDate: number | null
    lastBoot: number | null
    locale: string | null
    hostname: string | null
  }
  computer: { manufacturer: string | null; model: string | null; pcType: string | null }
  cpu: {
    name: string | null
    manufacturer: string | null
    cores: number | null
    logical: number | null
    baseClockMhz: number | null
    maxClockMhz: number | null
    l2MB: number | null
    l3MB: number | null
  }
  memory: { totalBytes: number | null; modules: RamModule[] }
  motherboard: { manufacturer: string | null; product: string | null; version: string | null }
  bios: { vendor: string | null; version: string | null; releaseDate: number | null }
  gpus: GpuStaticInfo[]
  storage: StorageDeviceInfo[]
  adapters: AdapterInfo[]
  isElevated: boolean
}

export type AlertKind = 'cpu' | 'memory' | 'disk'

export interface AlertPayload {
  id: string
  kind: AlertKind
  value: number
  threshold: number
  ts: number
}

export interface HistoryPoint {
  ts: number
  cpu: number
  mem: number
  diskRead: number
  diskWrite: number
  netRecv: number
  netSent: number
}

export interface HistoryBundle {
  points: HistoryPoint[]
}

export interface AppInfo {
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
  isElevated: boolean | null
}

export interface ActionResult {
  ok: boolean
  error?: string
}

// ── Network Monitor ──────────────────────────────────────────────

export interface NetConnection {
  protocol: 'TCP' | 'UDP'
  localAddress: string
  localPort: number
  remoteAddress: string | null
  remotePort: number | null
  state: string | null
  pid: number | null
  processName: string | null
}

export interface NetConnectionsPayload {
  ts: number
  source: 'cim' | 'netstat'
  connections: NetConnection[]
}

// ── Services ─────────────────────────────────────────────────────

export type ServiceState =
  | 'running'
  | 'stopped'
  | 'paused'
  | 'startPending'
  | 'stopPending'
  | 'continuePending'
  | 'pausePending'
  | 'other'

export type ServiceStartMode = 'auto' | 'autoDelayed' | 'manual' | 'disabled' | 'other'
export type ServiceAction = 'start' | 'stop' | 'restart'
export type ServiceStartupType = 'Automatic' | 'Manual' | 'Disabled'

export interface ServiceInfo {
  name: string
  displayName: string
  state: ServiceState
  startMode: ServiceStartMode
  account: string | null
  pid: number | null
  description: string | null
  path: string | null
  canStop: boolean
  canPause: boolean
}

// ── Startup Manager ──────────────────────────────────────────────

export type StartupTarget = 'HKLM' | 'HKCU'
export type StartupSub = 'Run' | 'RunOnce' | 'StartupFolder'
export type StartupKind = 'registry' | 'folder'

export interface StartupItem {
  kind: StartupKind
  target: StartupTarget
  sub: StartupSub
  name: string
  command: string | null
  location: string
  enabled: boolean
  toggleable: boolean
}

// ── App Manager ──────────────────────────────────────────────────

export interface InstalledApp {
  id: string
  name: string
  version: string | null
  publisher: string | null
  installDate: string | null
  estimatedSizeBytes: number | null
  installLocation: string | null
  hasUninstaller: boolean
}

// ── Event Viewer ─────────────────────────────────────────────────

export type EventLogName = 'System' | 'Application' | 'Security' | 'Setup'
export type EventLevelFilter = 'all' | 'critical' | 'error' | 'warning' | 'information'

export interface EventRecord {
  time: number
  recordId: number | null
  id: number
  levelId: number
  levelName: string | null
  provider: string | null
  log: string
  message: string | null
}

export interface EventQueryRequest {
  log: EventLogName
  level: EventLevelFilter
  startMs: number
  maxCount: number
}

export interface EventQueryResult {
  events: EventRecord[]
  error: string | null
}

// ── Disk Analyzer ────────────────────────────────────────────────

export interface DiskScanChild {
  name: string
  size: number
  files: number
}

export interface DiskScanFile {
  path: string
  size: number
}

export interface DiskScanResult {
  path: string
  totalBytes: number
  totalFiles: number
  skipped: number
  elapsedSec: number
  children: DiskScanChild[]
  direct: DiskScanFile[]
  largest: DiskScanFile[]
}

export interface DiskScanEvent {
  kind: 'started' | 'progress' | 'done' | 'error' | 'cancelled'
  scanId: number
  path: string
  files?: number
  bytes?: number
  skipped?: number
  error?: string
  result?: DiskScanResult
}

// ── Task Scheduler ───────────────────────────────────────────────

export interface ScheduledTaskInfo {
  path: string
  name: string
  state: 'Ready' | 'Running' | 'Disabled' | 'Queued' | 'other'
  author: string | null
  action: string | null
  nextRun: number | null
  lastRun: number | null
  lastResult: number | null
}

export type TaskAction = 'run' | 'stop' | 'enable' | 'disable'

// ── Drivers ──────────────────────────────────────────────────────

export interface DriverInfo {
  name: string
  friendlyName: string | null
  version: string | null
  date: number | null
  manufacturer: string | null
  signed: boolean
  inf: string | null
  deviceClass: string | null
}

export interface ProblemDevice {
  name: string | null
  code: number
  deviceId: string | null
}

export interface DriversPayload {
  drivers: DriverInfo[]
  problems: ProblemDevice[]
}

// ── Power ────────────────────────────────────────────────────────

export interface PowerPlan {
  guid: string
  name: string
  active: boolean
}

export interface BatteryDetail {
  chargePercent: number | null
  charging: boolean | null
  voltage: number | null
  estimatedRuntimeSec: number | null
  status: string | null
}

// ── Cleanup ──────────────────────────────────────────────────────

export type CleanupTargetId = 'usertemp' | 'wintemp' | 'wudownload' | 'thumbs'

export interface CleanupScanResult {
  target: CleanupTargetId
  bytes: number
  files: number
  skipped: number
  top: { path: string; size: number }[]
}

export interface CleanupResult {
  target: CleanupTargetId
  removedFiles: number
  removedBytes: number
  failed: number
}

// ── System Health ────────────────────────────────────────────────

export interface DiskHealth {
  model: string
  mediaType: string | null
  healthStatus: string | null
  temperatureC: number | null
  wearPercent: number | null
  readErrors: number | null
  writeErrors: number | null
  powerOnHours: number | null
}

export interface ThermalZone {
  zone: string
  celsius: number
}

export interface HealthPayload {
  disks: DiskHealth[]
  thermal: ThermalZone[]
  battery: BatteryDetail | null
}

// ── Diagnostics ──────────────────────────────────────────────────

export type DiagnosticSeverity = 'ok' | 'info' | 'warn' | 'fail'

export interface DiagnosticCheck {
  id: string
  severity: DiagnosticSeverity
  params: Record<string, string | number>
}

// ── Automation ───────────────────────────────────────────────────

export type AutomationMetric = 'cpu' | 'memory' | 'disk' | 'netRecv' | 'netSent'

export interface AutomationRule {
  id: string
  kind: AutomationMetric
  threshold: number
  durationSec: number
  cooldownMin: number
  message: string | null
  enabled: boolean
}

export interface AutomationFiredPayload {
  rule: AutomationRule
  value: number
  ts: number
}

// ── History & Reports ────────────────────────────────────────────

export interface HistoryStats {
  from: number
  to: number
  count: number
  cpu: MetricStats
  mem: MetricStats
  diskRead: MetricStats
  diskWrite: MetricStats
  netRecv: MetricStats
  netSent: MetricStats
}

export interface MetricStats {
  avg: number
  max: number
  min: number
}

export interface HistoryStatus {
  backend: 'sqlite' | 'jsonl'
  count: number
  recordedSince: number | null
}
