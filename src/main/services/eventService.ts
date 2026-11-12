import type { EventLevelFilter, EventLogName, EventQueryRequest, EventQueryResult, EventRecord } from '@shared/types'
import { extractLastJson, runScriptOnce } from './scriptRunner'
import { eventQueryScript } from './scripts'

const LEVEL_FILTER: Record<EventLevelFilter, number[] | null> = {
  critical: [1],
  error: [1, 2],
  warning: [1, 2, 3],
  information: [1, 2, 3, 4],
  all: null
}

export class EventService {
  async query(req: EventQueryRequest): Promise<EventQueryResult> {
    const levels = LEVEL_FILTER[req.level] ?? null
    try {
      const out = await runScriptOnce(eventQueryScript(req.log, levels, req.startMs, req.maxCount), 60000)
      const parsed = extractLastJson<{
        ok: boolean
        error?: string
        events: Array<{
          time: number
          recordId: number
          id: number
          level: number
          levelName: string
          provider: string
          message: string
        }>
      }>(out)
      if (!parsed) return { events: [], error: 'query failed' }
      if (!parsed.ok) return { events: [], error: parsed.error ?? 'query failed' }
      const events: EventRecord[] = (parsed.events ?? []).map((e) => ({
        time: e.time,
        recordId: typeof e.recordId === 'number' ? e.recordId : null,
        id: e.id,
        levelId: e.level,
        levelName: e.levelName || null,
        provider: e.provider || null,
        log: req.log,
        message: e.message || null
      }))
      return { events, error: null }
    } catch (err) {
      return { events: [], error: err instanceof Error ? err.message : String(err) }
    }
  }
}

export function isAccessDeniedError(msg: string | null): boolean {
  if (!msg) return false
  return /access is denied|erişim reddedildi|unauthorized/i.test(msg)
}

export type { EventLogName }
