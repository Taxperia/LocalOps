import os from 'node:os'
import { IPC } from '@shared/channels'
import { parseCsvLine } from '@shared/csv'
import { processCpuPercent } from '@shared/metricsMath'
import { PROCESS_PRIORITIES } from '@shared/settingsSchema'
import type { ActionResult, ProcessDetails, ProcessInfo, ProcessListPayload, ProcessPriority, ProcessStatus } from '@shared/types'
import { extractLastJson, runScriptOnce, ScriptRunner, parseJsonLine } from './scriptRunner'
import { fileInfoScript, killScript, META_SAMPLER_SCRIPT, priorityScript, PROC_SAMPLER_SCRIPT, psQuote, TASKLIST_SCRIPT } from './scripts'

interface ProcSample {
  pid: number
  name: string
  cpu: number
  ws: number
  pm: number
  started: number | null
}

interface MetaSample {
  pid: number
  ppid: number
  path: string
  cmd: string
  threads: number
  handles: number
  started: number | null
}

interface MetaEntry {
  ppid: number
  path: string | null
  cmd: string | null
  threads: number | null
  handles: number | null
  started: number | null
}

export interface ProcessServiceDeps {
  send: (channel: string, payload: unknown) => void
  getSystemCpu: () => number
}

export class ProcessService {
  private procRunner: ScriptRunner
  private metaRunner: ScriptRunner
  private cpuHistory = new Map<number, { cpu: number; ts: number }>()
  private meta = new Map<number, MetaEntry>()
  private missCounts = new Map<number, number>()
  private current: ProcessInfo[] = []
  private lastTs = 0
  private enrichTimer: NodeJS.Timeout | null = null
  private enrichBusy = false
  private enrichment = new Map<number, { user: string | null; status: ProcessStatus; title: string | null }>()
  private readonly coreCount = Math.max(1, os.cpus().length)

  constructor(private readonly deps: ProcessServiceDeps) {
    this.procRunner = new ScriptRunner('processes', PROC_SAMPLER_SCRIPT, (line) => this.onProcLine(line))
    this.metaRunner = new ScriptRunner('meta', META_SAMPLER_SCRIPT, (line) => this.onMetaLine(line))
  }

  start(): void {
    this.procRunner.start()
    this.metaRunner.start()
    void this.refreshEnrichment()
    this.enrichTimer = setInterval(() => void this.refreshEnrichment(), 15000)
  }

  stop(): void {
    this.procRunner.stop()
    this.metaRunner.stop()
    if (this.enrichTimer) clearInterval(this.enrichTimer)
    this.enrichTimer = null
  }

  /** tasklist /v provides user name + responsiveness info that Get-Process lacks. */
  private async refreshEnrichment(): Promise<void> {
    if (this.enrichBusy) return
    this.enrichBusy = true
    try {
      const out = await runScriptOnce(TASKLIST_SCRIPT, 60000)
      const parsed = extractLastJson<{ rows: string[] }>(out)
      if (parsed?.rows) {
        const next = new Map<number, { user: string | null; status: ProcessStatus; title: string | null }>()
        for (const row of parsed.rows) {
          const f = parseCsvLine(row)
          if (f.length < 7) continue
          const pid = Number.parseInt(f[1], 10)
          if (!Number.isInteger(pid) || pid <= 0) continue
          const user = f[6] && f[6] !== 'N/A' ? f[6] : null
          const status: ProcessStatus = /not responding|yanıt vermiyor/i.test(f[5] ?? '')
            ? 'notResponding'
            : 'running'
          const title = f.length > 8 && f[8] && f[8] !== 'N/A' ? f[8] : null
          next.set(pid, { user, status, title })
        }
        this.enrichment = next
      }
    } catch {
      // tasklist unavailable — enrichment stays as-is
    } finally {
      this.enrichBusy = false
    }
  }

  getStatus(): 'up' | 'down' | 'starting' {
    return this.procRunner.status
  }

  getMetaStatus(): 'up' | 'down' | 'starting' {
    return this.metaRunner.status
  }

  getStats(): { count: number; threads: number } {
    let threads = 0
    for (const p of this.current) threads += p.threads ?? 0
    return { count: this.current.length, threads }
  }

  getList(): ProcessListPayload {
    return { ts: this.lastTs, processes: this.current, systemCpuUsage: this.deps.getSystemCpu() }
  }

  private onProcLine(line: string): void {
    const data = parseJsonLine<{ ts: number; procs: ProcSample[] }>(line)
    if (!data || !Array.isArray(data.procs)) return
    const seen = new Set<number>()
    const list: ProcessInfo[] = []
    for (const p of data.procs) {
      if (!p || typeof p.pid !== 'number' || p.pid <= 0 || !p.name) continue
      seen.add(p.pid)
      this.missCounts.delete(p.pid)
      const prev = this.cpuHistory.get(p.pid)
      let cpu: number | null = null
      if (p.cpu >= 0 && prev && p.cpu >= prev.cpu && data.ts > prev.ts) {
        cpu = processCpuPercent(p.cpu - prev.cpu, (data.ts - prev.ts) / 1000, this.coreCount)
      }
      if (p.cpu >= 0) this.cpuHistory.set(p.pid, { cpu: p.cpu, ts: data.ts })
      const m = this.meta.get(p.pid)
      const en = this.enrichment.get(p.pid)
      list.push({
        pid: p.pid,
        name: p.name,
        ppid: m?.ppid ?? null,
        path: m?.path ?? null,
        commandLine: m?.cmd ?? null,
        cpuPercent: cpu,
        memoryBytes: typeof p.ws === 'number' ? p.ws : 0,
        privateBytes: typeof p.pm === 'number' ? p.pm : 0,
        handles: m?.handles ?? null,
        threads: m?.threads ?? null,
        startedAt: p.started ?? m?.started ?? null,
        userName: en?.user ?? null,
        status: en?.status ?? 'running',
        windowTitle: en?.title ?? null
      })
    }
    for (const pid of [...this.cpuHistory.keys()]) {
      if (!seen.has(pid)) this.cpuHistory.delete(pid)
    }
    for (const pid of [...this.enrichment.keys()]) {
      if (!seen.has(pid)) this.enrichment.delete(pid)
    }
    for (const pid of [...this.meta.keys()]) {
      if (!seen.has(pid)) {
        const misses = (this.missCounts.get(pid) ?? 0) + 1
        if (misses >= 3) {
          this.missCounts.delete(pid)
          this.meta.delete(pid)
        } else {
          this.missCounts.set(pid, misses)
        }
      }
    }
    this.current = list
    this.lastTs = data.ts
    this.deps.send(IPC.processesEvent, {
      ts: data.ts,
      processes: list,
      systemCpuUsage: this.deps.getSystemCpu()
    })
  }

  private onMetaLine(line: string): void {
    const data = parseJsonLine<{ ts: number; meta: MetaSample[] }>(line)
    if (!data || !Array.isArray(data.meta)) return
    for (const m of data.meta) {
      if (typeof m.pid !== 'number' || m.pid <= 0) continue
      this.meta.set(m.pid, {
        ppid: m.ppid,
        path: m.path || null,
        cmd: m.cmd || null,
        threads: m.threads ?? null,
        handles: m.handles ?? null,
        started: m.started ?? null
      })
    }
  }

  async kill(pid: number, force: boolean): Promise<ActionResult> {
    if (!Number.isInteger(pid) || pid <= 0) return { ok: false, error: 'invalid pid' }
    try {
      const out = await runScriptOnce(killScript(pid, force), 15000)
      const text = out.trim().split('\n').pop()?.trim() ?? ''
      if (text === 'OK') return { ok: true }
      return { ok: false, error: text.startsWith('ERR:') ? text.slice(4) : 'unknown error' }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async setPriority(pid: number, priority: ProcessPriority): Promise<ActionResult> {
    if (!Number.isInteger(pid) || pid <= 0) return { ok: false, error: 'invalid pid' }
    if (!PROCESS_PRIORITIES.includes(priority)) return { ok: false, error: 'invalid priority' }
    try {
      const out = await runScriptOnce(priorityScript(pid, priority), 15000)
      const text = out.trim().split('\n').pop()?.trim() ?? ''
      if (text === 'OK') return { ok: true }
      return { ok: false, error: text.startsWith('ERR:') ? text.slice(4) : 'unknown error' }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async details(pid: number): Promise<ProcessDetails | null> {
    const info = this.current.find((p) => p.pid === pid)
    if (!info) return null
    const parent = info.ppid != null ? this.current.find((p) => p.pid === info.ppid) : undefined
    const children = this.current
      .filter((p) => p.ppid === pid)
      .map((p) => ({ pid: p.pid, name: p.name }))
    let signature: ProcessDetails['signature'] = null
    let fileInfo: ProcessDetails['fileInfo'] = null
    if (info.path) {
      try {
        const out = await runScriptOnce(fileInfoScript(psQuote(info.path)), 20000)
        const raw = extractLastJson<{
          signature: { status: string; signer: string | null } | null
          fileInfo: {
            company: string
            description: string
            fileVersion: string
            productName: string
            size: number
            modified: number | null
          } | null
        }>(out)
        if (raw?.signature) {
          signature = { status: raw.signature.status, signer: raw.signature.signer || null }
        }
        if (raw?.fileInfo) {
          fileInfo = {
            company: raw.fileInfo.company || null,
            description: raw.fileInfo.description || null,
            fileVersion: raw.fileInfo.fileVersion || null,
            productName: raw.fileInfo.productName || null,
            fileSizeBytes: typeof raw.fileInfo.size === 'number' ? raw.fileInfo.size : null,
            modifiedAt: raw.fileInfo.modified ?? null
          }
        }
      } catch {
        // signature/file info unavailable — panel degrades gracefully
      }
    }
    return {
      info,
      parentName: parent?.name ?? null,
      children,
      signature,
      fileInfo
    }
  }
}
