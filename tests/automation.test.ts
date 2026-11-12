import { describe, expect, it } from 'vitest'
import {
  automationValue,
  nextAutomationState,
  shouldFireAutomation,
  type AutomationState
} from '../src/shared/automationRules'
import { DEFAULT_SETTINGS } from '../src/shared/settingsSchema'
import type { MetricsSnapshot } from '../src/shared/types'

const baseSnapshot: MetricsSnapshot = {
  ts: 0,
  cpu: { usage: 50, perCore: [50] },
  memory: {
    totalBytes: 16e9,
    availableBytes: 8e9,
    usedPercent: 50,
    committedBytes: 0,
    commitLimitBytes: 0,
    cachedBytes: 0,
    pagedPoolBytes: 0,
    nonPagedPoolBytes: 0
  },
  disks: [{ device: '0 C:', volumes: ['C:'], totalBytes: 1, freeBytes: 1, readBytesSec: 0, writeBytesSec: 0, activityPercent: 40, queueLength: 0 }],
  logicalVolumes: [],
  network: [
    { id: 'a', sentBytesSec: 1000, receivedBytesSec: 2000, linkSpeedBps: null },
    { id: 'b', sentBytesSec: 500, receivedBytesSec: 500, linkSpeedBps: null }
  ],
  gpus: [],
  battery: null,
  uptimeSec: 0,
  processCount: 0,
  threadCount: 0,
  samplerStatus: { fast: 'up', processes: 'up', meta: 'up' }
}

const rule = (over: Partial<Parameters<typeof shouldFireAutomation>[0]> = {}) => ({
  id: 'r1',
  kind: 'cpu' as const,
  threshold: 80,
  durationSec: 10,
  cooldownMin: 5,
  message: null,
  enabled: true,
  ...over
})

describe('automationValue', () => {
  it('maps kinds to snapshot values', () => {
    expect(automationValue('cpu', baseSnapshot)).toBe(50)
    expect(automationValue('memory', baseSnapshot)).toBe(50)
    expect(automationValue('disk', baseSnapshot)).toBe(40)
    expect(automationValue('netRecv', baseSnapshot)).toBe(2500)
    expect(automationValue('netSent', baseSnapshot)).toBe(1500)
  })
})

describe('shouldFireAutomation', () => {
  const fresh: AutomationState = { overSince: null, lastFired: 0 }

  it('does not fire before the sustain duration', () => {
    expect(shouldFireAutomation(rule(), 90, 1000, { overSince: 500, lastFired: 0 })).toBe(false)
  })

  it('fires after sustain and cooldown', () => {
    const state: AutomationState = { overSince: 0, lastFired: 0 }
    expect(shouldFireAutomation(rule(), 90, 11000, state)).toBe(true)
  })

  it('respects cooldown', () => {
    const state: AutomationState = { overSince: 0, lastFired: 10_000 }
    // cooldown 5 min = 300000 ms → fires again only 300000 ms after the last fire
    expect(shouldFireAutomation(rule(), 90, 309_999, state)).toBe(false)
    expect(shouldFireAutomation(rule(), 90, 310_000, state)).toBe(true)
  })

  it('allows the first fire regardless of cooldown', () => {
    const state: AutomationState = { overSince: 0, lastFired: 0 }
    expect(shouldFireAutomation(rule(), 90, 11_000, state)).toBe(true)
  })

  it('does not fire when disabled or below threshold', () => {
    expect(shouldFireAutomation(rule({ enabled: false }), 90, 60000, fresh)).toBe(false)
    expect(shouldFireAutomation(rule(), 70, 60000, fresh)).toBe(false)
  })
})

describe('nextAutomationState', () => {
  it('resets overSince when value drops below threshold', () => {
    const next = nextAutomationState(rule(), 50, 1000, { overSince: 500, lastFired: 0 })
    expect(next.overSince).toBeNull()
    expect(next.lastFired).toBe(0)
  })

  it('sets lastFired when it fires', () => {
    const next = nextAutomationState(rule(), 90, 11000, { overSince: 0, lastFired: 0 })
    expect(next.lastFired).toBe(11000)
  })
})

describe('settings schema keeps automations', () => {
  it('sanitizeSettings defaults to empty automations', () => {
    expect(DEFAULT_SETTINGS.automations).toEqual([])
  })
})
