import type { ProcessInfo } from './types'

export function buildProcessTree(rows: ProcessInfo[]): Array<{ proc: ProcessInfo; depth: number }> {
  const byId = new Map(rows.map((p) => [p.pid, p]))
  const children = new Map<number, ProcessInfo[]>()
  const roots: ProcessInfo[] = []
  for (const p of rows) {
    if (p.ppid != null && p.ppid !== p.pid && byId.has(p.ppid)) {
      const siblings = children.get(p.ppid) ?? []
      siblings.push(p)
      children.set(p.ppid, siblings)
    } else roots.push(p)
  }
  const compare = (a: ProcessInfo, b: ProcessInfo) => a.name.localeCompare(b.name) || a.pid - b.pid
  roots.sort(compare)
  for (const siblings of children.values()) siblings.sort(compare)
  const result: Array<{ proc: ProcessInfo; depth: number }> = []
  const visited = new Set<number>()
  const walk = (proc: ProcessInfo, depth: number): void => {
    if (visited.has(proc.pid)) return
    visited.add(proc.pid)
    result.push({ proc, depth: Math.min(depth, 40) })
    for (const child of children.get(proc.pid) ?? []) walk(child, depth + 1)
  }
  for (const root of roots) walk(root, 0)
  // PID reuse can create transient cycles. Every process must remain visible.
  for (const proc of [...rows].sort(compare)) walk(proc, 0)
  return result
}
