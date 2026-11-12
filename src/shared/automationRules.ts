import type { AutomationMetric, AutomationRule, MetricsSnapshot } from './types'

export interface AutomationState {
  overSince: number | null
  lastFired: number
}

/** Extracts the metric value a rule watches from a live snapshot. */
export function automationValue(kind: AutomationMetric, snapshot: MetricsSnapshot): number {
  switch (kind) {
    case 'cpu':
      return snapshot.cpu.usage
    case 'memory':
      return snapshot.memory.usedPercent
    case 'disk':
      return snapshot.disks.reduce((a, d) => Math.max(a, d.activityPercent), 0)
    case 'netRecv':
      return snapshot.network.reduce((a, n) => a + n.receivedBytesSec, 0)
    case 'netSent':
      return snapshot.network.reduce((a, n) => a + n.sentBytesSec, 0)
  }
}

/** Pure firing decision (caller owns the mutable state). */
export function shouldFireAutomation(
  rule: AutomationRule,
  value: number,
  now: number,
  state: AutomationState
): boolean {
  if (!rule.enabled) return false
  const over = value >= rule.threshold
  if (!over) return false
  const since = state.overSince ?? now
  const sustained = now - since >= rule.durationSec * 1000
  // lastFired === 0 means "never fired" — the initial cooldown must not block the first fire.
  const cooled = state.lastFired === 0 || now - state.lastFired >= rule.cooldownMin * 60_000
  return sustained && cooled
}

export function nextAutomationState(
  rule: AutomationRule,
  value: number,
  now: number,
  state: AutomationState
): AutomationState {
  const over = value >= rule.threshold && rule.enabled
  if (!over) return { overSince: null, lastFired: state.lastFired }
  const fired = shouldFireAutomation(rule, value, now, state)
  return {
    overSince: state.overSince ?? now,
    lastFired: fired ? now : state.lastFired
  }
}
