import type { NetConnection } from '@shared/types'
import { extractLastJson, runScriptOnce } from './scriptRunner'
import { NETWORK_SCRIPT } from './scripts'

interface RawRow {
  la: string
  lp: number
  ra?: string
  rp?: number
  st?: string
  pid: number
}

export class NetworkService {
  async getConnections(): Promise<{ source: 'cim' | 'netstat'; tcp: RawRow[]; udp: RawRow[] } | null> {
    const out = await runScriptOnce(NETWORK_SCRIPT, 30000)
    const parsed = extractLastJson<{ src: 'cim' | 'netstat'; tcp: RawRow[]; udp: RawRow[] }>(out)
    if (!parsed) return null
    return {
      source: parsed.src === 'netstat' ? 'netstat' : 'cim',
      tcp: Array.isArray(parsed.tcp) ? parsed.tcp : [],
      udp: Array.isArray(parsed.udp) ? parsed.udp : []
    }
  }

  static toConnections(raw: { source: 'cim' | 'netstat'; tcp: RawRow[]; udp: RawRow[] }, nameByPid: Map<number, string>): NetConnection[] {
    const out: NetConnection[] = []
    for (const t of raw.tcp) {
      if (typeof t.pid !== 'number' || typeof t.lp !== 'number') continue
      out.push({
        protocol: 'TCP',
        localAddress: t.la ?? '',
        localPort: t.lp,
        remoteAddress: t.ra ?? null,
        remotePort: typeof t.rp === 'number' ? t.rp : null,
        state: t.st ?? null,
        pid: t.pid,
        processName: nameByPid.get(t.pid) ?? null
      })
    }
    for (const u of raw.udp) {
      if (typeof u.pid !== 'number' || typeof u.lp !== 'number') continue
      out.push({
        protocol: 'UDP',
        localAddress: u.la ?? '',
        localPort: u.lp,
        remoteAddress: null,
        remotePort: null,
        state: null,
        pid: u.pid,
        processName: nameByPid.get(u.pid) ?? null
      })
    }
    return out
  }
}
