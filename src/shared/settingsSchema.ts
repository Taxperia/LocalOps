import type { AccentId, AppSettings, AutomationMetric, AutomationRule, DashboardWidgetState, Locale, ProcessPriority } from './types'

export const WIDGET_IDS = ['cpu', 'memory', 'gpu', 'disk', 'network', 'system'] as const
export type WidgetId = (typeof WIDGET_IDS)[number]

export const ACCENTS: AccentId[] = ['violet', 'blue', 'emerald', 'amber', 'rose']
export const INTERVAL_CHOICES = [1000, 2000, 5000]
export const PROCESS_PRIORITIES: ProcessPriority[] = ['Idle', 'BelowNormal', 'Normal', 'AboveNormal', 'High', 'RealTime']
export const AUTOMATION_KINDS: AutomationMetric[] = ['cpu', 'memory', 'disk', 'netRecv', 'netSent']

export const DEFAULT_SETTINGS: AppSettings = {
  locale: 'tr',
  accent: 'violet',
  intervalMs: 2000,
  sidebarCollapsed: false,
  notifications: {
    enabled: true,
    cpuPercent: 90,
    memoryPercent: 90,
    diskActivityPercent: 98,
    cooldownMinutes: 5
  },
  dashboard: {
    widgets: WIDGET_IDS.map((id, i) => ({ id, visible: true, order: i }))
  },
  automations: [],
  historyRetentionDays: 14,
  cleanupRetentionHours: 24,
  autoCheckUpdates: true
}

export function cloneSettings(s: AppSettings): AppSettings {
  return {
    ...s,
    notifications: { ...s.notifications },
    dashboard: { widgets: s.dashboard.widgets.map((w) => ({ ...w })) },
    automations: s.automations.map((a) => ({ ...a }))
  }
}

function clampNum(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : def
  return Math.min(max, Math.max(min, n))
}

function bool(v: unknown, def: boolean): boolean {
  return typeof v === 'boolean' ? v : def
}

function sanitizeWidgets(raw: unknown): DashboardWidgetState[] {
  const defaults = DEFAULT_SETTINGS.dashboard.widgets
  const byId = new Map<string, DashboardWidgetState>()
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const r = item as Record<string, unknown>
      if (typeof r.id !== 'string' || !(WIDGET_IDS as readonly string[]).includes(r.id)) continue
      byId.set(r.id, {
        id: r.id,
        visible: bool(r.visible, true),
        order: clampNum(r.order, 0, 0, 100)
      })
    }
  }
  const result = defaults.map((d) => byId.get(d.id) ?? { ...d })
  result.sort((a, b) => a.order - b.order)
  result.forEach((w, i) => (w.order = i))
  return result
}

function sanitizeNotifications(raw: unknown) {
  const d = DEFAULT_SETTINGS.notifications
  if (!raw || typeof raw !== 'object') return { ...d }
  const r = raw as Record<string, unknown>
  return {
    enabled: bool(r.enabled, d.enabled),
    cpuPercent: clampNum(r.cpuPercent, d.cpuPercent, 10, 100),
    memoryPercent: clampNum(r.memoryPercent, d.memoryPercent, 10, 100),
    diskActivityPercent: clampNum(r.diskActivityPercent, d.diskActivityPercent, 10, 100),
    cooldownMinutes: clampNum(r.cooldownMinutes, d.cooldownMinutes, 1, 60)
  }
}

function sanitizeAutomations(raw: unknown): AutomationRule[] {
  if (!Array.isArray(raw)) return []
  const out: AutomationRule[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || out.length >= 20) continue
    const r = item as Record<string, unknown>
    if (typeof r.kind !== 'string' || !AUTOMATION_KINDS.includes(r.kind as AutomationMetric)) continue
    const isPercent = r.kind === 'cpu' || r.kind === 'memory' || r.kind === 'disk'
    out.push({
      id: typeof r.id === 'string' && r.id.length > 0 ? r.id.slice(0, 40) : `rule-${Math.random().toString(36).slice(2, 9)}`,
      kind: r.kind as AutomationMetric,
      threshold: isPercent
        ? clampNum(r.threshold, 90, 1, 100)
        : clampNum(r.threshold, 1_000_000, 1, 1_000_000_000),
      durationSec: clampNum(r.durationSec, 30, 0, 3600),
      cooldownMin: clampNum(r.cooldownMin, 10, 1, 1440),
      message: typeof r.message === 'string' && r.message.length > 0 ? r.message.slice(0, 200) : null,
      enabled: bool(r.enabled, true)
    })
  }
  return out
}

/** Full sanitize: coerces unknown/invalid input onto defaults (used when loading from disk). */
export function sanitizeSettings(raw: unknown): AppSettings {
  const d = DEFAULT_SETTINGS
  if (!raw || typeof raw !== 'object') return cloneSettings(d)
  const r = raw as Record<string, unknown>
  return {
    locale: (r.locale === 'en' || r.locale === 'tr' ? r.locale : d.locale) as Locale,
    accent: (ACCENTS.includes(r.accent as AccentId) ? r.accent : d.accent) as AccentId,
    intervalMs: (INTERVAL_CHOICES.includes(r.intervalMs as number) ? r.intervalMs : d.intervalMs) as number,
    sidebarCollapsed: bool(r.sidebarCollapsed, d.sidebarCollapsed),
    notifications: sanitizeNotifications(r.notifications),
    dashboard: { widgets: sanitizeWidgets(r.dashboard && (r.dashboard as Record<string, unknown>).widgets) },
    automations: sanitizeAutomations(r.automations),
    historyRetentionDays: clampNum(r.historyRetentionDays, d.historyRetentionDays, 1, 90),
    cleanupRetentionHours: clampNum(r.cleanupRetentionHours, d.cleanupRetentionHours, 0, 2160),
    autoCheckUpdates: bool(r.autoCheckUpdates, d.autoCheckUpdates)
  }
}

/** Patch sanitize: keeps only provided, valid keys (used for settings updates from the UI). */
export function sanitizePatch(patch: unknown): Partial<AppSettings> {
  if (!patch || typeof patch !== 'object') return {}
  const r = patch as Record<string, unknown>
  const out: Partial<AppSettings> = {}
  if (r.locale === 'tr' || r.locale === 'en') out.locale = r.locale
  if (ACCENTS.includes(r.accent as AccentId)) out.accent = r.accent as AccentId
  if (INTERVAL_CHOICES.includes(r.intervalMs as number)) out.intervalMs = r.intervalMs as number
  if (typeof r.sidebarCollapsed === 'boolean') out.sidebarCollapsed = r.sidebarCollapsed
  if (typeof r.autoCheckUpdates === 'boolean') out.autoCheckUpdates = r.autoCheckUpdates
  if (r.notifications && typeof r.notifications === 'object') out.notifications = sanitizeNotifications(r.notifications)
  if (r.dashboard && typeof r.dashboard === 'object') {
    const dash = r.dashboard as Record<string, unknown>
    if (Array.isArray(dash.widgets)) out.dashboard = { widgets: sanitizeWidgets(dash.widgets) }
  }
  if (r.automations !== undefined) out.automations = sanitizeAutomations(r.automations)
  if (r.historyRetentionDays !== undefined) out.historyRetentionDays = clampNum(r.historyRetentionDays, DEFAULT_SETTINGS.historyRetentionDays, 1, 90)
  if (r.cleanupRetentionHours !== undefined) out.cleanupRetentionHours = clampNum(r.cleanupRetentionHours, DEFAULT_SETTINGS.cleanupRetentionHours, 0, 2160)
  return out
}
