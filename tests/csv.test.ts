import { describe, expect, it } from 'vitest'
import { parseCsvLine } from '../src/shared/csv'

describe('parseCsvLine', () => {
  it('parses simple quoted fields (tasklist format)', () => {
    expect(parseCsvLine('"a.exe","1234","Console","1","10.256 K"')).toEqual([
      'a.exe',
      '1234',
      'Console',
      '1',
      '10.256 K'
    ])
  })

  it('handles commas inside quoted fields', () => {
    expect(parseCsvLine('"chrome.exe","99","Console","1","1 K","Running","pc\\user","0:00:01","My Title, Part 2"')).toEqual([
      'chrome.exe',
      '99',
      'Console',
      '1',
      '1 K',
      'Running',
      'pc\\user',
      '0:00:01',
      'My Title, Part 2'
    ])
  })

  it('handles doubled quotes inside quoted fields', () => {
    expect(parseCsvLine('"He said ""hi""","2"')).toEqual(['He said "hi"', '2'])
  })

  it('handles unquoted fields and empty lines', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c'])
    expect(parseCsvLine('')).toEqual([''])
  })
})
