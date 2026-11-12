import { create } from 'zustand'
import type { MetricsSnapshot } from '@shared/types'

export interface TrendPoint {
  ts: number
  cpu: number
  mem: number
  diskRead: number
  diskWrite: number
  netRecv: number
  netSent: number
}

const TREND_CAP = 300

interface MetricsState {
  snapshot: MetricsSnapshot | null
  lastEventAt: number
  trend: TrendPoint[]
  apply: (s: MetricsSnapshot) => void
}

export const useMetricsStore = create<MetricsState>((set) => ({
  snapshot: null,
  lastEventAt: 0,
  trend: [],
  apply: (s) =>
    set((prev) => {
      const point: TrendPoint = {
        ts: s.ts,
        cpu: s.cpu.usage,
        mem: s.memory.usedPercent,
        diskRead: s.disks.reduce((a, d) => a + d.readBytesSec, 0),
        diskWrite: s.disks.reduce((a, d) => a + d.writeBytesSec, 0),
        netRecv: s.network.reduce((a, n) => a + n.receivedBytesSec, 0),
        netSent: s.network.reduce((a, n) => a + n.sentBytesSec, 0)
      }
      const trend = [...prev.trend, point]
      if (trend.length > TREND_CAP) trend.splice(0, trend.length - TREND_CAP)
      return { snapshot: s, lastEventAt: Date.now(), trend }
    })
}))
