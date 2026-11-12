import type { DiagnosticCheck } from './types'

export interface DiagnosticInputs {
  volumes: { volume: string; totalBytes: number; freeBytes: number }[]
  memoryUsedPercent: number
  sysErrors24h: number
  appErrors24h: number
  pendingReboot: boolean
  antivirus: { name: string }[]
  uptimeSec: number
  pagefile: { allocatedMb: number; usedMb: number } | null
}

/** Pure rule assembly so the checks stay unit-testable. */
export function buildDiagnostics(inputs: DiagnosticInputs): DiagnosticCheck[] {
  const checks: DiagnosticCheck[] = []

  for (const v of inputs.volumes) {
    if (v.totalBytes <= 0) continue
    const freePercent = (v.freeBytes / v.totalBytes) * 100
    if (freePercent < 5) {
      checks.push({ id: 'disk.low', severity: 'fail', params: { volume: v.volume, percent: Math.round(freePercent) } })
    } else if (freePercent < 15) {
      checks.push({ id: 'disk.low', severity: 'warn', params: { volume: v.volume, percent: Math.round(freePercent) } })
    } else {
      checks.push({ id: 'disk.ok', severity: 'ok', params: { volume: v.volume, percent: Math.round(freePercent) } })
    }
  }

  if (inputs.memoryUsedPercent >= 95) {
    checks.push({ id: 'memory.high', severity: 'fail', params: { percent: Math.round(inputs.memoryUsedPercent) } })
  } else if (inputs.memoryUsedPercent >= 90) {
    checks.push({ id: 'memory.high', severity: 'warn', params: { percent: Math.round(inputs.memoryUsedPercent) } })
  } else {
    checks.push({ id: 'memory.ok', severity: 'ok', params: { percent: Math.round(inputs.memoryUsedPercent) } })
  }

  const errors = inputs.sysErrors24h + inputs.appErrors24h
  if (errors >= 200) {
    checks.push({ id: 'events.errors', severity: 'fail', params: { count: errors } })
  } else if (errors >= 50) {
    checks.push({ id: 'events.errors', severity: 'warn', params: { count: errors } })
  } else {
    checks.push({ id: 'events.ok', severity: 'ok', params: { count: errors } })
  }

  if (inputs.pendingReboot) {
    checks.push({ id: 'pending.reboot', severity: 'warn', params: {} })
  }

  if (inputs.antivirus.length === 0) {
    checks.push({ id: 'av.missing', severity: 'warn', params: {} })
  } else {
    checks.push({ id: 'av.present', severity: 'ok', params: { name: inputs.antivirus.map((a) => a.name).join(', ') } })
  }

  const days = Math.floor(inputs.uptimeSec / 86400)
  if (days >= 14) {
    checks.push({ id: 'uptime.long', severity: 'info', params: { days } })
  }

  if (inputs.pagefile) {
    checks.push({
      id: 'pagefile',
      severity: 'info',
      params: { used: inputs.pagefile.usedMb, alloc: inputs.pagefile.allocatedMb }
    })
  }

  return checks
}
