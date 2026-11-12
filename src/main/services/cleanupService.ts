import os from 'node:os'
import type { CleanupResult, CleanupScanResult, CleanupTargetId } from '@shared/types'
import { extractLastJson, runScriptOnce } from './scriptRunner'
import { cleanupCleanScript, cleanupScanScript } from './scripts'

interface Target {
  id: CleanupTargetId
  root: string
  pattern: string | null
  recursive: boolean
}

function buildTargets(): Target[] {
  const localAppData = process.env['LOCALAPPDATA'] ?? ''
  const list: Target[] = [
    {
      id: 'usertemp',
      root: os.tmpdir(),
      pattern: null,
      recursive: true
    },
    {
      id: 'wintemp',
      root: 'C:\\Windows\\Temp',
      pattern: null,
      recursive: true
    },
    {
      id: 'wudownload',
      root: 'C:\\Windows\\SoftwareDistribution\\Download',
      pattern: null,
      recursive: true
    },
    {
      id: 'thumbs',
      root: localAppData ? `${localAppData}\\Microsoft\\Windows\\Explorer` : '',
      pattern: 'thumbcache_*.db',
      recursive: false
    }
  ]
  return list.filter((t) => t.root.length > 0)
}

const IDS = new Set<CleanupTargetId>(['usertemp', 'wintemp', 'wudownload', 'thumbs'])

export class CleanupService {
  private targets(): Target[] {
    return buildTargets()
  }

  getTargetRoot(id: CleanupTargetId): string | null {
    return this.targets().find((t) => t.id === id)?.root ?? null
  }

  async scan(id: CleanupTargetId): Promise<CleanupScanResult | null> {
    if (!IDS.has(id)) return null
    const target = this.targets().find((t) => t.id === id)
    if (!target) return null
    const out = await runScriptOnce(cleanupScanScript(target.root, target.pattern, target.recursive), 120000)
    const parsed = extractLastJson<{
      ok: boolean
      bytes: number
      files: number
      skipped: number
      top: Array<{ path: string; size: number }>
    }>(out)
    if (!parsed?.ok) return null
    return {
      target: id,
      bytes: typeof parsed.bytes === 'number' ? parsed.bytes : 0,
      files: typeof parsed.files === 'number' ? parsed.files : 0,
      skipped: typeof parsed.skipped === 'number' ? parsed.skipped : 0,
      top: (parsed.top ?? []).map((f) => ({ path: String(f.path), size: typeof f.size === 'number' ? f.size : 0 }))
    }
  }

  async clean(id: CleanupTargetId, cutoffMs: number): Promise<CleanupResult | null> {
    if (!IDS.has(id)) return null
    const target = this.targets().find((t) => t.id === id)
    if (!target) return null
    const out = await runScriptOnce(cleanupCleanScript(target.root, target.pattern, target.recursive, cutoffMs), 300000)
    const parsed = extractLastJson<{ ok: boolean; removed: number; removedBytes: number; failed: number }>(out)
    if (!parsed?.ok) return null
    return {
      target: id,
      removedFiles: typeof parsed.removed === 'number' ? parsed.removed : 0,
      removedBytes: typeof parsed.removedBytes === 'number' ? parsed.removedBytes : 0,
      failed: typeof parsed.failed === 'number' ? parsed.failed : 0
    }
  }
}

export function isValidTarget(id: unknown): id is CleanupTargetId {
  return typeof id === 'string' && IDS.has(id as CleanupTargetId)
}
