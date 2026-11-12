import fs from 'node:fs'
import { IPC } from '@shared/channels'
import type { DiskScanEvent, DiskScanResult } from '@shared/types'
import { parseJsonLine, spawnStreamReader, type StreamReaderHandle } from './scriptRunner'
import { diskScanScript, psQuote } from './scripts'

function normalizePath(raw: string): string {
  let p = raw.trim().replace(/\//g, '\\')
  if (/^[A-Za-z]:$/.test(p)) p += '\\'
  return p
}

function cacheKey(p: string): string {
  return p.toLowerCase()
}

interface ActiveScan {
  scanId: number
  path: string
  handle: StreamReaderHandle
  killed: boolean
  done: boolean
}

export class DiskScanService {
  private active: ActiveScan | null = null
  private cache = new Map<string, DiskScanResult>()
  private seq = 1

  constructor(private readonly send: (channel: string, payload: unknown) => void) {}

  start(rawPath: string): { ok: boolean; error?: string } {
    const path = normalizePath(rawPath)
    if (!/^[A-Za-z]:\\/.test(path) || path.includes('\0')) return { ok: false, error: 'invalid path' }
    try {
      if (!fs.existsSync(path)) return { ok: false, error: 'path not found' }
      if (!fs.statSync(path).isDirectory()) return { ok: false, error: 'not a directory' }
    } catch {
      return { ok: false, error: 'path not accessible' }
    }
    if (this.active) return { ok: false, error: 'scan already running' }

    const scanId = this.seq++
    const state: ActiveScan = {
      scanId,
      path,
      killed: false,
      done: false,
      handle: spawnStreamReader(diskScanScript(psQuote(path)), (line) => this.onLine(state, line))
    }
    this.active = state
    this.emit({ kind: 'started', scanId, path })
    void state.handle.promise.then(() => {
      if (this.active?.scanId === scanId) this.active = null
      if (!state.done) {
        this.emit(
          state.killed
            ? { kind: 'cancelled', scanId, path }
            : { kind: 'error', scanId, path, error: 'scanner terminated unexpectedly' }
        )
      }
    })
    return { ok: true }
  }

  cancel(): void {
    if (this.active) {
      this.active.killed = true
      this.active.handle.kill()
    }
  }

  isBusy(): boolean {
    return this.active != null
  }

  getResult(rawPath: string): DiskScanResult | null {
    return this.cache.get(cacheKey(normalizePath(rawPath))) ?? null
  }

  private emit(ev: DiskScanEvent): void {
    this.send(IPC.diskScanEvent, ev)
  }

  private onLine(state: ActiveScan, line: string): void {
    const data = parseJsonLine<Record<string, unknown>>(line)
    if (!data) return
    if (data.type === 'progress') {
      this.emit({
        kind: 'progress',
        scanId: state.scanId,
        path: state.path,
        files: typeof data.files === 'number' ? data.files : 0,
        bytes: typeof data.bytes === 'number' ? data.bytes : 0,
        skipped: typeof data.skipped === 'number' ? data.skipped : 0
      })
      return
    }
    if (data.type === 'error') {
      state.done = true
      this.emit({ kind: 'error', scanId: state.scanId, path: state.path, error: String(data.message ?? 'scan error') })
      return
    }
    if (data.type === 'done') {
      state.done = true
      const children = Array.isArray(data.children)
        ? (data.children as Array<{ name: string; size: number; files: number }>).map((c) => ({
            name: String(c.name),
            size: typeof c.size === 'number' ? c.size : 0,
            files: typeof c.files === 'number' ? c.files : 0
          }))
        : []
      const filesOf = (arr: unknown): { path: string; size: number }[] =>
        Array.isArray(arr)
          ? (arr as Array<{ path: string; size: number }>).map((f) => ({
              path: String(f.path),
              size: typeof f.size === 'number' ? f.size : 0
            }))
          : []
      const result: DiskScanResult = {
        path: state.path,
        totalBytes: typeof data.totalBytes === 'number' ? data.totalBytes : 0,
        totalFiles: typeof data.totalFiles === 'number' ? data.totalFiles : 0,
        skipped: typeof data.skipped === 'number' ? data.skipped : 0,
        elapsedSec: typeof data.elapsedSec === 'number' ? data.elapsedSec : 0,
        children,
        direct: filesOf(data.direct),
        largest: filesOf(data.largest)
      }
      this.cache.set(cacheKey(state.path), result)
      this.emit({ kind: 'done', scanId: state.scanId, path: state.path, result })
    }
  }
}
