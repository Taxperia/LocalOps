import os from 'node:os'
import { Notification } from 'electron'
import { IPC } from '@shared/channels'
import { clamp, cpuUsagePercent, toCpuTimes, type CpuTimes } from '@shared/metricsMath'
import type {
  AlertKind,
  AppSettings,
  BatterySnapshot,
  DiskSnapshot,
  GpuSnapshot,
  HistoryPoint,
  LogicalVolume,
  MetricsSnapshot,
  NetSnapshot,
  SamplerStatus
} from '@shared/types'
import { ScriptRunner, parseJsonLine } from './scriptRunner'
import { FAST_SAMPLER_SCRIPT } from './scripts'

const HISTORY_CAP = 1800 // 30 min at 1s cadence
const ALERT_SUSTAIN_MS = 5000

interface FastSample {
  ts: number
  mem: {
    available: number
    committed: number
    limit: number
    cache: number
    poolPaged: number
    poolNonPaged: number
  } | null
  disks: { device: string; read: number; write: number; idle: number; queue: number }[]
  net: { id: string; sent: number; recv: number; bw: number }[]
  gpu: { id: string; util: number | null; dedicated: number | null; shared: number | null }[]
  logical?: { volume: string; label: string | null; total: number; free: number }[] | null
  battery?: { pct: number; charging: boolean } | null
}

interface AlertState {
  since: number | null
  lastAlert: number
}

const ALERT_TEXT: Record<string, Record<AlertKind, string>> = {
  tr: {
    cpu: 'CPU kullanımı eşiği aştı: %{v}',
    memory: 'Bellek kullanımı eşiği aştı: %{v}',
    disk: 'Disk etkinliği eşiği aştı: %{v}'
  },
  en: {
    cpu: 'CPU usage exceeded threshold: {v}%',
    memory: 'Memory usage exceeded threshold: {v}%',
    disk: 'Disk activity exceeded threshold: {v}%'
  }
}

export interface MetricsEngineDeps {
  getSettings: () => AppSettings
  getProcessStats: () => { count: number; threads: number }
  send: (channel: string, payload: unknown) => void
  recordPoint?: (p: HistoryPoint) => void
  evaluateAutomations?: (s: MetricsSnapshot) => void
}

export class MetricsEngine {
  systemCpuUsage = 0
  perCoreUsage: number[] = []
  private lastSnapshot: MetricsSnapshot | null = null
  private runner: ScriptRunner
  private prevCpu: CpuTimes[] = toCpuTimes(os.cpus())
  private lastFast: FastSample | null = null
  private lastLogical: LogicalVolume[] = []
  private lastBattery: BatterySnapshot | null = null
  private history: HistoryPoint[] = []
  private lastEmit = 0
  private timer: NodeJS.Timeout | null = null
  private alerts: Record<AlertKind, AlertState> = {
    cpu: { since: null, lastAlert: 0 },
    memory: { since: null, lastAlert: 0 },
    disk: { since: null, lastAlert: 0 }
  }

  constructor(private readonly deps: MetricsEngineDeps) {
    this.runner = new ScriptRunner(
      'fast',
      FAST_SAMPLER_SCRIPT,
      (line) => this.handleLine(line),
      (err) => console.error('[metrics] fast sampler stderr:', err)
    )
  }

  start(): void {
    this.runner.start()
    this.timer = setInterval(() => this.tick(), 1000)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.runner.stop()
  }

  getHistory(): { points: HistoryPoint[] } {
    return { points: [...this.history] }
  }

  getLatestSnapshot(): MetricsSnapshot | null {
    return this.lastSnapshot
  }

  setProcessSamplerStatus(state: SamplerStatus['processes']): void {
    this._procStatus = state
  }

  private _procStatus: SamplerStatus['processes'] = 'starting'

  samplerStatus(): SamplerStatus {
    return { fast: this.runner.status, processes: this._procStatus, meta: this._procStatus }
  }

  private handleLine(line: string): void {
    const data = parseJsonLine<FastSample>(line)
    if (!data) return
    this.lastFast = data
    if (data.logical) {
      this.lastLogical = data.logical.map((l) => ({
        volume: l.volume,
        label: l.label || null,
        totalBytes: l.total,
        freeBytes: l.free
      }))
    }
    if (data.battery !== undefined) {
      this.lastBattery = data.battery
        ? { chargePercent: data.battery.pct, charging: data.battery.charging }
        : null
    }
  }

  private tick(): void {
    const now = Date.now()
    const next = toCpuTimes(os.cpus())
    const usage = cpuUsagePercent(this.prevCpu, next)
    this.prevCpu = next
    this.systemCpuUsage = usage.usage
    this.perCoreUsage = usage.perCore

    const s = this.lastFast
    const totalMem = os.totalmem()
    const available = s?.mem ? s.mem.available : os.freemem()
    const memory = {
      totalBytes: totalMem,
      availableBytes: available,
      usedPercent: totalMem > 0 ? clamp((1 - available / totalMem) * 100, 0, 100) : 0,
      committedBytes: s?.mem?.committed ?? 0,
      commitLimitBytes: s?.mem?.limit ?? 0,
      cachedBytes: s?.mem?.cache ?? 0,
      pagedPoolBytes: s?.mem?.poolPaged ?? 0,
      nonPagedPoolBytes: s?.mem?.poolNonPaged ?? 0
    }

    const logicalByVolume = new Map(this.lastLogical.map((l) => [l.volume, l]))
    const disks: DiskSnapshot[] = (s?.disks ?? []).map((d) => {
      const volumes = d.device.split(' ').slice(1).filter((v) => v.length > 0)
      let total = 0
      let free = 0
      let hasCap = false
      for (const vol of volumes) {
        const l = logicalByVolume.get(vol)
        if (l) {
          total += l.totalBytes
          free += l.freeBytes
          hasCap = true
        }
      }
      return {
        device: d.device,
        volumes,
        totalBytes: hasCap ? total : null,
        freeBytes: hasCap ? free : null,
        readBytesSec: d.read ?? 0,
        writeBytesSec: d.write ?? 0,
        activityPercent: clamp(100 - (d.idle ?? 0), 0, 100),
        queueLength: d.queue ?? 0
      }
    })

    const network: NetSnapshot[] = (s?.net ?? []).map((n) => ({
      id: n.id,
      sentBytesSec: n.sent ?? 0,
      receivedBytesSec: n.recv ?? 0,
      linkSpeedBps: n.bw > 0 ? n.bw : null
    }))

    const gpus: GpuSnapshot[] = (s?.gpu ?? []).map((g) => ({
      id: g.id,
      utilPercent: typeof g.util === 'number' ? g.util : null,
      dedicatedUsedBytes: g.dedicated ?? null,
      sharedUsedBytes: g.shared ?? null
    }))

    const stats = this.deps.getProcessStats()
    const snapshot: MetricsSnapshot = {
      ts: now,
      cpu: { usage: usage.usage, perCore: usage.perCore },
      memory,
      disks,
      logicalVolumes: this.lastLogical,
      network,
      gpus,
      battery: this.lastBattery,
      uptimeSec: os.uptime(),
      processCount: stats.count,
      threadCount: stats.threads,
      samplerStatus: this.samplerStatus()
    }
    this.lastSnapshot = snapshot

    const point: HistoryPoint = {
      ts: now,
      cpu: usage.usage,
      mem: memory.usedPercent,
      diskRead: disks.reduce((a, d) => a + d.readBytesSec, 0),
      diskWrite: disks.reduce((a, d) => a + d.writeBytesSec, 0),
      netRecv: network.reduce((a, n) => a + n.receivedBytesSec, 0),
      netSent: network.reduce((a, n) => a + n.sentBytesSec, 0)
    }
    this.history.push(point)
    if (this.history.length > HISTORY_CAP) this.splice()
    if (now - this.lastRecord >= 30_000) {
      this.lastRecord = now
      try {
        this.deps.recordPoint?.(point)
      } catch {
        // persistence failure must not break live metrics
      }
    }

    const interval = clamp(this.deps.getSettings().intervalMs, 1000, 10000)
    if (now - this.lastEmit >= interval) {
      this.lastEmit = now
      this.deps.send(IPC.metricsEvent, snapshot)
      try {
        this.deps.evaluateAutomations?.(snapshot)
      } catch {
        // automation failure must not break live metrics
      }
      this.checkAlerts(snapshot)
    }
  }

  private lastRecord = 0

  private splice(): void {
    this.history.splice(0, this.history.length - HISTORY_CAP)
  }

  private checkAlerts(snapshot: MetricsSnapshot): void {
    const cfg = this.deps.getSettings().notifications
    if (!cfg.enabled) return
    const now = Date.now()
    const cooldownMs = cfg.cooldownMinutes * 60_000
    const check = (
      kind: AlertKind,
      value: number,
      threshold: number,
      sustainMs: number
    ): void => {
      const st = this.alerts[kind]
      if (value >= threshold) {
        if (st.since == null) st.since = now
        if (now - st.since >= sustainMs && now - st.lastAlert >= cooldownMs) {
          st.lastAlert = now
          st.since = now
          const locale = this.deps.getSettings().locale
          let text = ALERT_TEXT[locale][kind]
          text = text.replace('{v}', String(Math.round(value)))
          this.deps.send(IPC.alertsEvent, {
            id: `${kind}-${now}`,
            kind,
            value,
            threshold,
            ts: now
          })
          try {
            if (Notification.isSupported()) {
              new Notification({ title: 'LocalOps', body: text, silent: false }).show()
            }
          } catch {
            // notifications unavailable — in-app toast still fires
          }
        }
      } else {
        st.since = null
      }
    }
    check('cpu', snapshot.cpu.usage, cfg.cpuPercent, ALERT_SUSTAIN_MS)
    check('memory', snapshot.memory.usedPercent, cfg.memoryPercent, ALERT_SUSTAIN_MS)
    check('disk', Math.max(0, ...snapshot.disks.map((d) => d.activityPercent)), cfg.diskActivityPercent, ALERT_SUSTAIN_MS + 5000)
  }
}
