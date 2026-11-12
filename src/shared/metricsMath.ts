export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export interface CpuTimes {
  idle: number
  total: number
}

export interface OsCpuTimes {
  idle: number
  user: number
  nice: number
  sys: number
  irq: number
}

export function toCpuTimes(cpus: { times: OsCpuTimes }[]): CpuTimes[] {
  return cpus.map((c) => ({
    idle: c.times.idle,
    total: c.times.idle + c.times.user + c.times.nice + c.times.sys + c.times.irq
  }))
}

/** Task Manager style: 100% = all logical processors fully busy. */
export function cpuUsagePercent(prev: CpuTimes[], next: CpuTimes[]): { usage: number; perCore: number[] } {
  const perCore: number[] = []
  let idleDelta = 0
  let totalDelta = 0
  const n = Math.min(prev.length, next.length)
  for (let i = 0; i < n; i++) {
    const dTotal = next[i].total - prev[i].total
    const dIdle = next[i].idle - prev[i].idle
    if (dTotal > 0) {
      idleDelta += dIdle
      totalDelta += dTotal
      perCore.push(clamp((1 - dIdle / dTotal) * 100, 0, 100))
    } else {
      perCore.push(0)
    }
  }
  const usage = totalDelta > 0 ? clamp((1 - idleDelta / totalDelta) * 100, 0, 100) : 0
  return { usage, perCore }
}

/**
 * Per-process CPU% normalized across all logical processors (Task Manager style).
 * cpuDelta and wallDelta are in the same time unit (seconds).
 */
export function processCpuPercent(cpuDelta: number, wallDeltaSec: number, coreCount: number): number | null {
  if (!Number.isFinite(cpuDelta) || !Number.isFinite(wallDeltaSec)) return null
  if (wallDeltaSec <= 0 || cpuDelta < 0 || coreCount <= 0) return null
  return clamp((cpuDelta / wallDeltaSec / coreCount) * 100, 0, 100)
}
