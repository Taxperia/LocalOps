import { Notification } from 'electron'
import { IPC } from '@shared/channels'
import { automationValue, nextAutomationState, type AutomationState } from '@shared/automationRules'
import type { AppSettings, AutomationFiredPayload, AutomationMetric, AutomationRule, MetricsSnapshot } from '@shared/types'

export class AutomationService {
  private states = new Map<string, AutomationState>()

  constructor(
    private readonly getSettings: () => AppSettings,
    private readonly send: (channel: string, payload: unknown) => void
  ) {}

  evaluate(snapshot: MetricsSnapshot): void {
    const rules = this.getSettings().automations
    if (rules.length === 0) return
    const now = Date.now()
    for (const rule of rules) {
      if (!rule.enabled) continue
      const value = automationValue(rule.kind, snapshot)
      const state = this.states.get(rule.id) ?? { overSince: null, lastFired: 0 }
      const fire = shouldFire(rule, value, now, state)
      this.states.set(rule.id, nextAutomationState(rule, value, now, state))
      if (fire) {
        this.fire(rule, value)
      }
    }
    // drop state for removed rules
    for (const id of [...this.states.keys()]) {
      if (!rules.some((r) => r.id === id)) this.states.delete(id)
    }
  }

  test(rule: AutomationRule): void {
    this.fire(rule, rule.threshold, true)
  }

  private fire(rule: AutomationRule, value: number, isTest = false): void {
    const locale = this.getSettings().locale
    const defaultMsg =
      locale === 'tr'
        ? `${metricLabelTr(rule.kind)} eşiği aştı: ${formatValue(rule.kind, value)}`
        : `${metricLabelEn(rule.kind)} exceeded threshold: ${formatValue(rule.kind, value)}`
    const body = isTest ? (locale === 'tr' ? `[Test] ${defaultMsg}` : `[Test] ${defaultMsg}`) : rule.message || defaultMsg
    this.send(IPC.automationFiredEvent, { rule, value, ts: Date.now() } satisfies AutomationFiredPayload)
    try {
      if (Notification.isSupported()) {
        new Notification({ title: 'LocalOps — ' + (isTest ? (locale === 'tr' ? 'test' : 'test') : locale === 'tr' ? 'otomasyon' : 'automation'), body, silent: false }).show()
      }
    } catch {
      // notifications unavailable — in-app toast still fires
    }
  }
}

function shouldFire(rule: AutomationRule, value: number, now: number, state: AutomationState): boolean {
  if (value < rule.threshold) return false
  const since = state.overSince ?? now
  if (now - since < rule.durationSec * 1000) return false
  return now - state.lastFired >= rule.cooldownMin * 60_000
}

function formatValue(kind: AutomationMetric, value: number): string {
  if (kind === 'netRecv' || kind === 'netSent') {
    const mb = value / (1024 * 1024)
    return mb >= 1 ? `${mb.toFixed(1)} MB/s` : `${Math.round(value / 1024)} KB/s`
  }
  return `${Math.round(value)}%`
}

function metricLabelTr(kind: AutomationMetric): string {
  switch (kind) {
    case 'cpu':
      return 'CPU kullanımı'
    case 'memory':
      return 'Bellek kullanımı'
    case 'disk':
      return 'Disk etkinliği'
    case 'netRecv':
      return 'Ağ indirme'
    case 'netSent':
      return 'Ağ gönderme'
  }
}

function metricLabelEn(kind: AutomationMetric): string {
  switch (kind) {
    case 'cpu':
      return 'CPU usage'
    case 'memory':
      return 'Memory usage'
    case 'disk':
      return 'Disk activity'
    case 'netRecv':
      return 'Network download'
    case 'netSent':
      return 'Network upload'
  }
}
