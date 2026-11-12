import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import type { HistoryPoint, HistoryStats } from '@shared/types'

interface HistoryStore {
  readonly backend: 'sqlite' | 'jsonl'
  append(p: HistoryPoint): void
  query(fromMs: number, toMs: number, maxPoints: number): HistoryPoint[]
  count(): number
  prune(beforeMs: number): void
  close(): void
}

function requireSqlite(): { DatabaseSync: new (path: string) => SqliteDb } | null {
  try {
    // node:sqlite is bundled in recent Electron runtimes; resolve lazily so a
    // missing module degrades to the JSONL store instead of crashing startup.
    const req = createRequire(__filename)
    return req('node:sqlite')
  } catch {
    return null
  }
}

interface SqliteStmt {
  run(...params: unknown[]): void
  all(...params: unknown[]): unknown[]
}
interface SqliteDb {
  exec(sql: string): void
  prepare(sql: string): SqliteStmt
  close(): void
}

class SqliteStore implements HistoryStore {
  readonly backend = 'sqlite' as const
  private db: SqliteDb
  private insert: SqliteStmt
  private cnt = 0

  constructor(file: string) {
    const mod = requireSqlite()
    if (!mod) throw new Error('node:sqlite unavailable')
    this.db = new mod.DatabaseSync(file)
    this.db.exec('CREATE TABLE IF NOT EXISTS metrics (ts INTEGER PRIMARY KEY, cpu REAL, mem REAL, diskRead REAL, diskWrite REAL, netRecv REAL, netSent REAL)')
    this.insert = this.db.prepare('INSERT OR REPLACE INTO metrics VALUES (?, ?, ?, ?, ?, ?, ?)')
    try {
      const rows = this.db.prepare('SELECT COUNT(*) AS c FROM metrics').all()
      this.cnt = Number((rows[0] as { c?: number } | undefined)?.c ?? 0)
    } catch {
      this.cnt = 0
    }
  }

  append(p: HistoryPoint): void {
    this.insert.run(p.ts, p.cpu, p.mem, p.diskRead, p.diskWrite, p.netRecv, p.netSent)
    this.cnt++
  }

  query(fromMs: number, toMs: number, maxPoints: number): HistoryPoint[] {
    const rows = this.db
      .prepare('SELECT ts, cpu, mem, diskRead, diskWrite, netRecv, netSent FROM metrics WHERE ts >= ? AND ts <= ? ORDER BY ts ASC')
      .all(fromMs, toMs) as Array<Record<string, unknown>>
    const points: HistoryPoint[] = rows.map((r) => ({
      ts: Number(r.ts),
      cpu: Number(r.cpu),
      mem: Number(r.mem),
      diskRead: Number(r.diskRead),
      diskWrite: Number(r.diskWrite),
      netRecv: Number(r.netRecv),
      netSent: Number(r.netSent)
    }))
    return stride(points, maxPoints)
  }

  count(): number {
    return this.cnt
  }

  prune(beforeMs: number): void {
    this.db.prepare('DELETE FROM metrics WHERE ts < ?').run(beforeMs)
    try {
      const rows = this.db.prepare('SELECT COUNT(*) AS c FROM metrics').all()
      this.cnt = Number((rows[0] as { c?: number } | undefined)?.c ?? 0)
    } catch {
      // keep old count
    }
  }

  close(): void {
    try {
      this.db.close()
    } catch {
      // already closed
    }
  }
}

class JsonlStore implements HistoryStore {
  readonly backend = 'jsonl' as const
  private file: string
  private cnt = 0

  constructor(file: string) {
    this.file = file
    try {
      const text = fs.readFileSync(file, 'utf-8')
      this.cnt = text.split('\n').filter((l) => l.trim().startsWith('{')).length
    } catch {
      this.cnt = 0
    }
  }

  append(p: HistoryPoint): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      fs.appendFileSync(this.file, JSON.stringify(p) + '\n', 'utf-8')
      this.cnt++
      if (this.cnt > 200_000) this.prune(Date.now() - 14 * 86400_000)
    } catch {
      // non-fatal
    }
  }

  query(fromMs: number, toMs: number, maxPoints: number): HistoryPoint[] {
    const points: HistoryPoint[] = []
    try {
      const text = fs.readFileSync(this.file, 'utf-8')
      for (const line of text.split('\n')) {
        if (!line.startsWith('{')) continue
        try {
          const p = JSON.parse(line) as HistoryPoint
          if (p.ts >= fromMs && p.ts <= toMs) points.push(p)
        } catch {
          // skip corrupt line
        }
      }
    } catch {
      // no file yet
    }
    points.sort((a, b) => a.ts - b.ts)
    return stride(points, maxPoints)
  }

  count(): number {
    return this.cnt
  }

  prune(beforeMs: number): void {
    try {
      const text = fs.readFileSync(this.file, 'utf-8')
      const kept = text
        .split('\n')
        .filter((l) => {
          if (!l.startsWith('{')) return false
          try {
            return (JSON.parse(l) as HistoryPoint).ts >= beforeMs
          } catch {
            return false
          }
        })
      fs.writeFileSync(this.file, kept.length > 0 ? kept.join('\n') + '\n' : '', 'utf-8')
      this.cnt = kept.length
    } catch {
      // nothing to prune
    }
  }

  close(): void {
    // nothing to do
  }
}

function stride(points: HistoryPoint[], maxPoints: number): HistoryPoint[] {
  if (maxPoints <= 0 || points.length <= maxPoints) return points
  const step = Math.ceil(points.length / maxPoints)
  const out: HistoryPoint[] = []
  for (let i = 0; i < points.length; i += step) out.push(points[i])
  return out
}

export class HistoryService {
  private store: HistoryStore
  private pruneTimer: NodeJS.Timeout | null = null

  constructor(userDataDir: string, private readonly getRetentionDays: () => number) {
    let store: HistoryStore | null = null
    try {
      store = new SqliteStore(path.join(userDataDir, 'metrics.db'))
    } catch {
      store = null
    }
    this.store = store ?? new JsonlStore(path.join(userDataDir, 'metrics-history.jsonl'))
    void this.prune()
    this.pruneTimer = setInterval(() => void this.prune(), 60 * 60_000)
  }

  get backend(): 'sqlite' | 'jsonl' {
    return this.store.backend
  }

  record(p: HistoryPoint): void {
    this.store.append(p)
  }

  status(): { backend: 'sqlite' | 'jsonl'; count: number; recordedSince: number | null } {
    let recordedSince: number | null = null
    const points = this.store.query(0, Date.now(), 1)
    if (points.length > 0) recordedSince = points[0].ts
    return { backend: this.store.backend, count: this.store.count(), recordedSince }
  }

  query(fromMs: number, toMs: number, maxPoints: number): HistoryPoint[] {
    return this.store.query(fromMs, toMs, maxPoints)
  }

  stats(fromMs: number, toMs: number): HistoryStats {
    const points = this.store.query(fromMs, toMs, 100000)
    const acc = {
      cpu: { sum: 0, max: -Infinity, min: Infinity },
      mem: { sum: 0, max: -Infinity, min: Infinity },
      diskRead: { sum: 0, max: -Infinity, min: Infinity },
      diskWrite: { sum: 0, max: -Infinity, min: Infinity },
      netRecv: { sum: 0, max: -Infinity, min: Infinity },
      netSent: { sum: 0, max: -Infinity, min: Infinity }
    }
    for (const p of points) {
      for (const key of ['cpu', 'mem', 'diskRead', 'diskWrite', 'netRecv', 'netSent'] as const) {
        const v = p[key]
        const a = acc[key]
        a.sum += v
        a.max = Math.max(a.max, v)
        a.min = Math.min(a.min, v)
      }
    }
    const n = Math.max(1, points.length)
    const stat = (a: { sum: number; max: number; min: number }) => ({
      avg: points.length > 0 ? a.sum / n : 0,
      max: points.length > 0 ? a.max : 0,
      min: points.length > 0 ? a.min : 0
    })
    return {
      from: fromMs,
      to: toMs,
      count: points.length,
      cpu: stat(acc.cpu),
      mem: stat(acc.mem),
      diskRead: stat(acc.diskRead),
      diskWrite: stat(acc.diskWrite),
      netRecv: stat(acc.netRecv),
      netSent: stat(acc.netSent)
    }
  }

  prune(): void {
    const days = Math.max(1, Math.min(90, this.getRetentionDays()))
    this.store.prune(Date.now() - days * 86400_000)
  }

  close(): void {
    if (this.pruneTimer) clearInterval(this.pruneTimer)
    this.pruneTimer = null
    this.store.close()
  }
}
