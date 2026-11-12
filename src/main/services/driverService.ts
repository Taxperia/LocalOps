import type { DriversPayload } from '@shared/types'
import { extractLastJson, runScriptOnce } from './scriptRunner'
import { DRIVERS_SCRIPT } from './scripts'

interface CacheEntry {
  payload: DriversPayload
  ts: number
}

const TTL = 10 * 60_000

export class DriverService {
  private cache: CacheEntry | null = null
  private pending: Promise<DriversPayload> | null = null

  async list(force = false): Promise<DriversPayload> {
    if (!force && this.cache && Date.now() - this.cache.ts < TTL) return this.cache.payload
    if (this.pending) return this.pending
    this.pending = this.fetch().finally(() => (this.pending = null))
    return this.pending
  }

  private async fetch(): Promise<DriversPayload> {
    const out = await runScriptOnce(DRIVERS_SCRIPT, 120000)
    const parsed = extractLastJson<{
      drivers: Array<{
        name: string
        friendly: string
        version: string
        date: number | null
        maker: string
        signed: boolean
        inf: string
        class: string
      }>
      problems: Array<{ name: string; code: number; deviceId: string }>
    }>(out)
    const payload: DriversPayload = {
      drivers: (parsed?.drivers ?? [])
        .filter((d) => typeof d.name === 'string' && d.name.length > 0)
        .map((d) => ({
          name: d.name,
          friendlyName: d.friendly || null,
          version: d.version || null,
          date: d.date ?? null,
          manufacturer: d.maker || null,
          signed: d.signed === true,
          inf: d.inf || null,
          deviceClass: d.class || null
        })),
      problems: (parsed?.problems ?? []).map((p) => ({
        name: p.name || null,
        code: typeof p.code === 'number' ? p.code : 0,
        deviceId: p.deviceId || null
      }))
    }
    this.cache = { payload, ts: Date.now() }
    return payload
  }
}
