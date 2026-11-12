import type { StartupItem } from '@shared/types'
import { extractLastJson, runScriptOnce } from './scriptRunner'
import { STARTUP_LIST_SCRIPT, startupToggleScript } from './scripts'
import type { ActionResult } from '@shared/types'

export class StartupService {
  async list(): Promise<StartupItem[]> {
    const out = await runScriptOnce(STARTUP_LIST_SCRIPT, 30000)
    const parsed = extractLastJson<{
      items: Array<{
        kind: 'registry' | 'folder'
        target: 'HKLM' | 'HKCU'
        sub: 'Run' | 'RunOnce' | 'StartupFolder'
        name: string
        command: string
        location: string
        enabled: boolean
        toggleable: boolean
      }>
    }>(out)
    if (!parsed?.items) return []
    return parsed.items
      .filter((i) => typeof i.name === 'string' && i.name.length > 0)
      .map((i) => ({
        kind: i.kind,
        target: i.target,
        sub: i.sub,
        name: i.name,
        command: i.command || null,
        location: i.location,
        enabled: i.enabled !== false,
        toggleable: i.toggleable === true
      }))
  }

  async toggle(item: Pick<StartupItem, 'kind' | 'target' | 'sub' | 'name'>, enable: boolean): Promise<ActionResult> {
    if (item.sub === 'RunOnce') return { ok: false, error: 'RunOnce items cannot be toggled' }
    try {
      const out = await runScriptOnce(startupToggleScript(item.target, item.sub, item.name, enable), 30000)
      const text = out.trim().split('\n').pop()?.trim() ?? ''
      if (text === 'OK') return { ok: true }
      return { ok: false, error: text.startsWith('ERR:') ? text.slice(4) : 'unknown error' }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}
