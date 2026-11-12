import type { PowerPlan } from '@shared/types'
import { extractLastJson, runScriptOnce } from './scriptRunner'
import { POWER_SCRIPT, powerSetActiveScript } from './scripts'
import type { ActionResult } from '@shared/types'

const GUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/

export class PowerService {
  async list(): Promise<PowerPlan[]> {
    const out = await runScriptOnce(POWER_SCRIPT, 30000)
    const parsed = extractLastJson<{ schemes: Array<{ guid: string; name: string; active: boolean }> }>(out)
    if (!parsed?.schemes) return []
    return parsed.schemes
      .filter((s) => GUID_RE.test(s.guid))
      .map((s) => ({ guid: s.guid, name: s.name || s.guid, active: s.active === true }))
  }

  async setActive(guid: string): Promise<ActionResult> {
    if (!GUID_RE.test(guid)) return { ok: false, error: 'invalid guid' }
    try {
      const out = await runScriptOnce(powerSetActiveScript(guid), 30000)
      const text = out.trim().split('\n').pop()?.trim() ?? ''
      if (text === 'OK') return { ok: true }
      return { ok: false, error: text.startsWith('ERR:') ? text.slice(4) : 'unknown error' }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}
