import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  cloneSettings,
  sanitizePatch,
  sanitizeSettings
} from '../src/shared/settingsSchema'

describe('sanitizeSettings', () => {
  it('migrates old settings and validates update preferences', () => {
    expect(sanitizeSettings({}).autoCheckUpdates).toBe(true)
    expect(sanitizeSettings({ autoCheckUpdates: false }).autoCheckUpdates).toBe(false)
    expect(sanitizePatch({ autoCheckUpdates: 'yes' })).toEqual({})
    expect(sanitizePatch({ autoCheckUpdates: false })).toEqual({ autoCheckUpdates: false })
  })
  it('falls back to defaults on garbage input', () => {
    const s = sanitizeSettings('nonsense')
    expect(s).toEqual(DEFAULT_SETTINGS)
  })

  it('coerces invalid fields to defaults', () => {
    const s = sanitizeSettings({ locale: 'fr', accent: 'pink', intervalMs: 42 })
    expect(s.locale).toBe('tr')
    expect(s.accent).toBe('violet')
    expect(s.intervalMs).toBe(2000)
  })

  it('keeps valid values', () => {
    const s = sanitizeSettings({ locale: 'en', accent: 'blue', intervalMs: 5000, sidebarCollapsed: true })
    expect(s.locale).toBe('en')
    expect(s.accent).toBe('blue')
    expect(s.intervalMs).toBe(5000)
    expect(s.sidebarCollapsed).toBe(true)
  })

  it('drops unknown widget ids, keeps provided order, re-indexes gaps', () => {
    const s = sanitizeSettings({
      dashboard: { widgets: [{ id: 'cpu', visible: false, order: 5 }, { id: 'hacker', visible: true, order: 0 }] }
    })
    expect([...s.dashboard.widgets.map((w) => w.id)].sort()).toEqual(
      [...DEFAULT_SETTINGS.dashboard.widgets.map((w) => w.id)].sort()
    )
    expect(s.dashboard.widgets.find((w) => w.id === 'cpu')?.visible).toBe(false)
    expect(s.dashboard.widgets.map((w) => w.order)).toEqual([0, 1, 2, 3, 4, 5])
    expect(s.dashboard.widgets.filter((w) => w.id === 'hacker')).toHaveLength(0)
  })

  it('clamps notification thresholds', () => {
    const s = sanitizeSettings({ notifications: { cpuPercent: 1000, memoryPercent: -5 } })
    expect(s.notifications.cpuPercent).toBe(100)
    expect(s.notifications.memoryPercent).toBe(10)
  })
})

describe('sanitizePatch', () => {
  it('keeps only provided valid keys', () => {
    const p = sanitizePatch({ locale: 'en', accent: 'nope', extra: true })
    expect(p).toEqual({ locale: 'en' })
  })

  it('returns empty object for invalid input', () => {
    expect(sanitizePatch(null)).toEqual({})
    expect(sanitizePatch(42)).toEqual({})
  })

  it('sanitizes nested notifications', () => {
    const p = sanitizePatch({ notifications: { enabled: false, cooldownMinutes: 999 } })
    expect(p.notifications?.enabled).toBe(false)
    expect(p.notifications?.cooldownMinutes).toBe(60)
  })
})

describe('cloneSettings', () => {
  it('deep-copies nested objects', () => {
    const a = cloneSettings(DEFAULT_SETTINGS)
    a.notifications.cpuPercent = 1
    a.dashboard.widgets[0].visible = false
    expect(DEFAULT_SETTINGS.notifications.cpuPercent).toBe(90)
    expect(DEFAULT_SETTINGS.dashboard.widgets[0].visible).toBe(true)
  })
})
