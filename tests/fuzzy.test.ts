import { describe, expect, it } from 'vitest'
import { fuzzyMatch } from '../src/renderer/src/lib/fuzzy'

describe('fuzzyMatch', () => {
  it('returns 0 for empty query', () => {
    expect(fuzzyMatch('', 'anything')).toBe(0)
    expect(fuzzyMatch('   ', 'anything')).toBe(0)
  })

  it('returns null when not a subsequence', () => {
    expect(fuzzyMatch('xz', 'settings')).toBeNull()
  })

  it('matches subsequences', () => {
    expect(fuzzyMatch('st', 'settings')).not.toBeNull()
    expect(fuzzyMatch('stngs', 'settings')).not.toBeNull()
  })

  it('ranks prefix and consecutive matches higher', () => {
    const prefix = fuzzyMatch('se', 'settings')
    const spread = fuzzyMatch('se', 'processes')
    expect(prefix!).toBeGreaterThan(spread!)
  })

  it('is case-insensitive', () => {
    expect(fuzzyMatch('CPU', 'cpu usage')).not.toBeNull()
  })
})
