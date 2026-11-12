import { describe, expect, it } from 'vitest'
import { buildProcessTree } from '../src/shared/processTree'
import type { ProcessInfo } from '../src/shared/types'

const proc = (pid: number, ppid: number | null): ProcessInfo => ({ pid, ppid, name: `process-${pid}` } as ProcessInfo)

describe('process tree', () => {
  it('keeps children after their parent', () => {
    expect(buildProcessTree([proc(2, 1), proc(1, null)]).map((r) => [r.proc.pid, r.depth])).toEqual([[1, 0], [2, 1]])
  })
  it('does not lose processes with reused, missing or cyclic parent PIDs', () => {
    const rows = [proc(1, 2), proc(2, 1), proc(3, 3), proc(4, 99)]
    const tree = buildProcessTree(rows)
    expect(tree.map((r) => r.proc.pid).sort()).toEqual([1, 2, 3, 4])
  })
  it('keeps deep descendants visible', () => {
    const tree = buildProcessTree(Array.from({ length: 100 }, (_, i) => proc(i + 1, i || null)))
    expect(tree).toHaveLength(100)
    expect(Math.max(...tree.map((r) => r.depth))).toBe(40)
  })
})
