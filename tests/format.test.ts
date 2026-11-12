import { describe, expect, it } from 'vitest'
import { formatBytes, formatDuration, formatPercent, formatRate } from '../src/shared/format'

describe('formatBytes', () => {
  it('formats bytes, KB, MB, GB', () => {
    expect(formatBytes(0, 'en')).toBe('0 B')
    expect(formatBytes(512, 'en')).toBe('512 B')
    expect(formatBytes(1024, 'en')).toBe('1 KB')
    expect(formatBytes(1536, 'en')).toBe('1.5 KB')
    expect(formatBytes(1024 * 1024, 'en')).toBe('1 MB')
    expect(formatBytes(1024 ** 3 * 2.25, 'en')).toBe('2.3 GB')
  })

  it('uses Turkish decimal comma', () => {
    expect(formatBytes(1536, 'tr')).toBe('1,5 KB')
  })

  it('returns dash for invalid values', () => {
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(undefined)).toBe('—')
    expect(formatBytes(Number.NaN)).toBe('—')
    expect(formatBytes(-5)).toBe('—')
  })
})

describe('formatRate', () => {
  it('appends /s', () => {
    expect(formatRate(1024 * 1024, 'en')).toBe('1 MB/s')
    expect(formatRate(null)).toBe('—')
  })
})

describe('formatPercent', () => {
  it('formats with percent sign', () => {
    expect(formatPercent(45.6, 'en', 1)).toBe('45.6%')
    expect(formatPercent(45.6, 'tr', 1)).toBe('45,6%')
    expect(formatPercent(null)).toBe('—')
  })
})

describe('formatDuration', () => {
  it('formats compound durations', () => {
    expect(formatDuration(2 * 86400 + 3 * 3600 + 4 * 60, 'en')).toBe('2d 3h 4m')
    expect(formatDuration(90, 'en')).toBe('1m 30s')
    expect(formatDuration(45, 'tr')).toBe('45sn')
  })

  it('handles invalid input', () => {
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(-1)).toBe('—')
    expect(formatDuration(0, 'en')).toBe('0s')
  })
})
