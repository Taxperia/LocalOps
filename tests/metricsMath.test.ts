import { describe, expect, it } from 'vitest'
import { clamp, cpuUsagePercent, processCpuPercent, toCpuTimes } from '../src/shared/metricsMath'

function cpuTimes(idle: number, user: number, sys = 0) {
  return { times: { idle, user, nice: 0, sys, irq: 0 } }
}

describe('toCpuTimes', () => {
  it('sums all time components', () => {
    const t = toCpuTimes([cpuTimes(10, 60, 30)])
    expect(t).toEqual([{ idle: 10, total: 100 }])
  })
})

describe('cpuUsagePercent', () => {
  it('computes total and per-core usage', () => {
    const prev = toCpuTimes([cpuTimes(0, 0), cpuTimes(0, 0)])
    const next = toCpuTimes([cpuTimes(10, 90), cpuTimes(50, 50)])
    const { usage, perCore } = cpuUsagePercent(prev, next)
    expect(usage).toBeCloseTo(70, 5)
    expect(perCore[0]).toBeCloseTo(90, 5)
    expect(perCore[1]).toBeCloseTo(50, 5)
  })

  it('returns 0 when no time has passed', () => {
    const same = toCpuTimes([cpuTimes(10, 10)])
    const { usage } = cpuUsagePercent(same, same)
    expect(usage).toBe(0)
  })

  it('clamps to 0-100', () => {
    const prev = toCpuTimes([cpuTimes(100, 0)])
    const next = toCpuTimes([cpuTimes(0, 200)])
    const { usage, perCore } = cpuUsagePercent(prev, next)
    expect(usage).toBe(100)
    expect(perCore[0]).toBe(100)
  })
})

describe('processCpuPercent', () => {
  it('normalizes across cores (Task Manager style)', () => {
    // 1.5 CPU-seconds in 1 wall-second on 4 cores = 37.5%
    expect(processCpuPercent(1.5, 1, 4)).toBeCloseTo(37.5)
  })

  it('caps at 100%', () => {
    expect(processCpuPercent(8, 1, 4)).toBe(100)
  })

  it('returns null for invalid inputs', () => {
    expect(processCpuPercent(-1, 1, 4)).toBeNull()
    expect(processCpuPercent(1, 0, 4)).toBeNull()
    expect(processCpuPercent(Number.NaN, 1, 4)).toBeNull()
  })
})

describe('clamp', () => {
  it('clamps values', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(15, 0, 10)).toBe(10)
  })
})
