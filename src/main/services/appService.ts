import type { InstalledApp } from '@shared/types'
import { extractLastJson, runScriptOnce } from './scriptRunner'
import { APPS_SCRIPT, appUninstallScript } from './scripts'
import type { ActionResult } from '@shared/types'

interface RawApp {
  id: string
  name: string
  version: string
  publisher: string
  installDate: string
  size: number | null
  location: string
  uninstall: string
}

export class AppService {
  private uninstallStrings = new Map<string, string>()

  async list(): Promise<InstalledApp[]> {
    const out = await runScriptOnce(APPS_SCRIPT, 45000)
    const parsed = extractLastJson<{ apps: RawApp[] }>(out)
    if (!parsed?.apps) return []
    this.uninstallStrings.clear()
    return parsed.apps
      .filter((a) => typeof a.name === 'string' && a.name.length > 0)
      .map((a) => {
        if (a.uninstall) this.uninstallStrings.set(a.id, a.uninstall)
        return {
          id: a.id,
          name: a.name,
          version: a.version || null,
          publisher: a.publisher || null,
          installDate: a.installDate || null,
          estimatedSizeBytes: typeof a.size === 'number' && a.size > 0 ? a.size : null,
          installLocation: a.location || null,
          hasUninstaller: Boolean(a.uninstall)
        }
      })
  }

  async uninstall(id: string): Promise<ActionResult> {
    const us = this.uninstallStrings.get(id)
    if (!us) return { ok: false, error: 'app not found (refresh the list)' }
    try {
      const out = await runScriptOnce(appUninstallScript(us), 30000)
      const text = out.trim().split('\n').pop()?.trim() ?? ''
      if (text === 'OK') return { ok: true }
      return { ok: false, error: text.startsWith('ERR:') ? text.slice(4) : 'unknown error' }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}
