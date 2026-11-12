import { buildDiagnostics, type DiagnosticInputs } from '@shared/diagnosticsRules'
import type { DiagnosticCheck } from '@shared/types'
import { extractLastJson, runScriptOnce } from './scriptRunner'
import { DIAG_INPUTS_SCRIPT } from './scripts'

export interface DiagnosticsContext {
  volumes: { volume: string; totalBytes: number; freeBytes: number }[]
  memoryUsedPercent: number
  uptimeSec: number
}

export class DiagnosticsService {
  async run(ctx: DiagnosticsContext): Promise<DiagnosticCheck[]> {
    const out = await runScriptOnce(DIAG_INPUTS_SCRIPT, 90000)
    const parsed = extractLastJson<{
      pendingReboot: boolean
      av: Array<{ name: string; state: string }>
      sysErrors: number
      appErrors: number
      pagefile: { alloc: number; used: number } | null
    }>(out)
    const inputs: DiagnosticInputs = {
      volumes: ctx.volumes.filter((v) => v.totalBytes > 0),
      memoryUsedPercent: ctx.memoryUsedPercent,
      sysErrors24h: typeof parsed?.sysErrors === 'number' ? parsed.sysErrors : 0,
      appErrors24h: typeof parsed?.appErrors === 'number' ? parsed.appErrors : 0,
      pendingReboot: parsed?.pendingReboot === true,
      antivirus: (parsed?.av ?? []).map((a) => ({ name: a.name || 'Antivirus' })),
      uptimeSec: ctx.uptimeSec,
      pagefile: parsed?.pagefile ? { allocatedMb: parsed.pagefile.alloc, usedMb: parsed.pagefile.used } : null
    }
    return buildDiagnostics(inputs)
  }
}
