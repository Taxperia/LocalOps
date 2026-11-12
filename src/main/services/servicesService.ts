import type { ServiceInfo, ServiceStartMode, ServiceState } from '@shared/types'
import { extractLastJson, runScriptOnce } from './scriptRunner'
import { SERVICES_SCRIPT, serviceActionScript, serviceStartupScript } from './scripts'
import type { ActionResult } from '@shared/types'

const STATE_MAP: Record<string, ServiceState> = {
  Running: 'running',
  Stopped: 'stopped',
  Paused: 'paused',
  'Start Pending': 'startPending',
  'Stop Pending': 'stopPending',
  'Continue Pending': 'continuePending',
  'Pause Pending': 'pausePending'
}

export class ServicesService {
  async list(): Promise<ServiceInfo[]> {
    const out = await runScriptOnce(SERVICES_SCRIPT, 45000)
    const parsed = extractLastJson<{
      services: Array<{
        name: string
        display: string
        state: string
        mode: string
        delayed: boolean
        account: string
        pid: number
        desc: string
        path: string
        acceptStop: boolean
        acceptPause: boolean
      }>
    }>(out)
    if (!parsed?.services) return []
    return parsed.services
      .filter((s) => typeof s.name === 'string' && s.name.length > 0)
      .map((s) => {
        let mode: ServiceStartMode = 'other'
        if (s.mode === 'Auto') mode = s.delayed ? 'autoDelayed' : 'auto'
        else if (s.mode === 'Manual') mode = 'manual'
        else if (s.mode === 'Disabled') mode = 'disabled'
        return {
          name: s.name,
          displayName: s.display || s.name,
          state: STATE_MAP[s.state] ?? 'other',
          startMode: mode,
          account: s.account || null,
          pid: typeof s.pid === 'number' && s.pid > 0 ? s.pid : null,
          description: s.desc || null,
          path: s.path || null,
          canStop: s.acceptStop === true,
          canPause: s.acceptPause === true
        }
      })
  }

  async action(name: string, action: 'start' | 'stop' | 'restart'): Promise<ActionResult> {
    try {
      const out = await runScriptOnce(serviceActionScript(name, action), 90000)
      const text = out.trim().split('\n').pop()?.trim() ?? ''
      if (text === 'OK') return { ok: true }
      return { ok: false, error: text.startsWith('ERR:') ? text.slice(4) : 'unknown error' }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async setStartupType(name: string, mode: 'Automatic' | 'Manual' | 'Disabled'): Promise<ActionResult> {
    try {
      const out = await runScriptOnce(serviceStartupScript(name, mode), 30000)
      const text = out.trim().split('\n').pop()?.trim() ?? ''
      if (text === 'OK') return { ok: true }
      return { ok: false, error: text.startsWith('ERR:') ? text.slice(4) : 'unknown error' }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}
