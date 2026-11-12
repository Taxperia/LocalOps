import { describe, expect, it } from 'vitest'
import { buildDiagnostics, type DiagnosticInputs } from '../src/shared/diagnosticsRules'

const healthy: DiagnosticInputs = {
  volumes: [{ volume: 'C:', totalBytes: 1000, freeBytes: 400 }],
  memoryUsedPercent: 60,
  sysErrors24h: 2,
  appErrors24h: 3,
  pendingReboot: false,
  antivirus: [{ name: 'Defender' }],
  uptimeSec: 3600,
  pagefile: { allocatedMb: 4096, usedMb: 512 }
}

describe('buildDiagnostics', () => {
  it('flags low disk space as fail under 5%', () => {
    const checks = buildDiagnostics({ ...healthy, volumes: [{ volume: 'C:', totalBytes: 1000, freeBytes: 30 }] })
    const disk = checks.find((c) => c.id === 'disk.low')
    expect(disk?.severity).toBe('fail')
  })

  it('warns on 5-15% free', () => {
    const checks = buildDiagnostics({ ...healthy, volumes: [{ volume: 'C:', totalBytes: 1000, freeBytes: 100 }] })
    expect(checks.find((c) => c.id === 'disk.low')?.severity).toBe('warn')
  })

  it('reports ok disk and memory in healthy state', () => {
    const checks = buildDiagnostics(healthy)
    expect(checks.find((c) => c.id === 'disk.ok')).toBeDefined()
    expect(checks.find((c) => c.id === 'memory.ok')).toBeDefined()
  })

  it('escalates error event counts', () => {
    const checks = buildDiagnostics({ ...healthy, sysErrors24h: 250 })
    expect(checks.find((c) => c.id === 'events.errors')?.severity).toBe('fail')
  })

  it('warns on pending reboot and missing antivirus', () => {
    const checks = buildDiagnostics({ ...healthy, pendingReboot: true, antivirus: [] })
    expect(checks.find((c) => c.id === 'pending.reboot')?.severity).toBe('warn')
    expect(checks.find((c) => c.id === 'av.missing')?.severity).toBe('warn')
  })

  it('adds info check for long uptime', () => {
    const checks = buildDiagnostics({ ...healthy, uptimeSec: 20 * 86400 })
    expect(checks.find((c) => c.id === 'uptime.long')?.params.days).toBe(20)
  })
})
