import { useMemo, useState } from 'react'
import { Bot, Plus, Trash2 } from 'lucide-react'
import { useT } from '@/i18n'
import { api } from '@/lib/ipc'
import { Badge, Card, EmptyState, PageHeader, Toggle } from '@/components/ui'
import { formatBytes } from '@shared/format'
import { AUTOMATION_KINDS } from '@shared/settingsSchema'
import type { AutomationMetric, AutomationRule } from '@shared/types'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { useMetricsStore } from '@/stores/metrics'

function defaultThreshold(kind: AutomationMetric): number {
  return kind === 'netRecv' || kind === 'netSent' ? 50_000_000 : 90
}

export function AutomationPage() {
  const t = useT()
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const pushToast = useUiStore((s) => s.pushToast)
  const snapshot = useMetricsStore((s) => s.snapshot)

  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<AutomationMetric>('cpu')
  const [threshold, setThreshold] = useState(90)
  const [durationSec, setDurationSec] = useState(30)
  const [cooldownMin, setCooldownMin] = useState(10)
  const [message, setMessage] = useState('')

  const isPercent = kind === 'cpu' || kind === 'memory' || kind === 'disk'

  const currentValue = useMemo(() => {
    if (!snapshot) return null
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
  }, [snapshot, kind])

  const fmtValue = (kind: AutomationMetric, v: number): string =>
    kind === 'netRecv' || kind === 'netSent' ? formatBytes(v, 'tr', 0) + '/s' : `${Math.round(v)}%`

  const save = (): void => {
    const rules = settings.automations
    if (rules.length >= 20) {
      pushToast({ kind: 'error', title: t('automation.limit') })
      return
    }
    const rule: AutomationRule = {
      id: `rule-${Math.random().toString(36).slice(2, 9)}`,
      kind,
      threshold: isPercent ? Math.min(100, Math.max(1, threshold)) : Math.max(1, threshold),
      durationSec: Math.min(3600, Math.max(0, durationSec)),
      cooldownMin: Math.min(1440, Math.max(1, cooldownMin)),
      message: message.trim().length > 0 ? message.trim().slice(0, 200) : null,
      enabled: true
    }
    void update({ automations: [...rules, rule] })
    setAdding(false)
    setMessage('')
  }

  const remove = (id: string): void => {
    void update({ automations: settings.automations.filter((r) => r.id !== id) })
  }

  const toggle = (rule: AutomationRule): void => {
    void update({
      automations: settings.automations.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
    })
  }

  const test = async (rule: AutomationRule): Promise<void> => {
    await api.testAutomation(rule)
    pushToast({ kind: 'info', title: t('automation.test') })
  }

  return (
    <div className="flex h-full flex-col p-4">
      <PageHeader
        title={t('automation.title')}
        subtitle={t('automation.hint')}
        actions={
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[12px] font-medium text-white hover:opacity-90"
          >
            <Plus size={13} />
            {t('automation.add')}
          </button>
        }
      />

      {adding ? (
        <Card className="mt-3 p-4">
          <div className="grid max-w-[680px] grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-[12px] text-ink-2">{t('automation.metric')}</div>
              <select
                value={kind}
                onChange={(e) => {
                  const k = e.target.value as AutomationMetric
                  setKind(k)
                  setThreshold(defaultThreshold(k))
                }}
                className="w-full rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-accent"
              >
                {AUTOMATION_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`automation.metric.${k}` as never)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 text-[12px] text-ink-2">
                {t('automation.threshold')} ({isPercent ? '%' : 'B/s'})
                {currentValue != null ? (
                  <span className="tnum ml-2 text-ink-3">{t('perf.current')}: {fmtValue(kind, currentValue)}</span>
                ) : null}
              </div>
              <input
                type="number"
                min={1}
                max={isPercent ? 100 : 1_000_000_000}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-accent"
              />
            </div>
            <div>
              <div className="mb-1 text-[12px] text-ink-2">{t('automation.duration')}</div>
              <input
                type="number"
                min={0}
                max={3600}
                value={durationSec}
                onChange={(e) => setDurationSec(Number(e.target.value))}
                className="w-full rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-accent"
              />
            </div>
            <div>
              <div className="mb-1 text-[12px] text-ink-2">{t('automation.cooldown')}</div>
              <input
                type="number"
                min={1}
                max={1440}
                value={cooldownMin}
                onChange={(e) => setCooldownMin(Number(e.target.value))}
                className="w-full rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-accent"
              />
            </div>
            <div className="col-span-2">
              <div className="mb-1 text-[12px] text-ink-2">{t('automation.message')}</div>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={200}
                className="w-full rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-ink-3 focus:border-accent"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={save}
              className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
            >
              {t('automation.save')}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-md border border-line px-3 py-1.5 text-[12px] text-ink-2 hover:text-ink"
            >
              {t('common.cancel')}
            </button>
          </div>
        </Card>
      ) : null}

      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {settings.automations.length === 0 && !adding ? (
          <Card className="p-2">
            <EmptyState icon={<Bot size={20} />} message={t('automation.empty')} />
          </Card>
        ) : (
          settings.automations.map((rule) => (
            <Card key={rule.id} className="flex items-center gap-3 p-3">
              <Bot size={15} className={rule.enabled ? 'text-accent' : 'text-ink-3'} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] font-medium text-ink">{t(`automation.metric.${rule.kind}` as never)}</span>
                  <Badge tone={rule.enabled ? 'accent' : 'neutral'}>
                    ≥ {rule.kind === 'netRecv' || rule.kind === 'netSent' ? formatBytes(rule.threshold, 'tr', 0) + '/s' : `${rule.threshold}%`}
                  </Badge>
                  <span className="tnum text-[11px] text-ink-3">
                    {rule.durationSec} sn · {rule.cooldownMin} dk
                  </span>
                </div>
                {rule.message ? <div className="truncate text-[11.5px] text-ink-3">{rule.message}</div> : null}
                {currentValue != null && rule.kind === kind ? (
                  <div className="tnum text-[11px] text-ink-3">
                    {t('automation.value', {
                      value: fmtValue(kind, currentValue),
                      threshold: rule.kind === 'netRecv' || rule.kind === 'netSent' ? formatBytes(rule.threshold, 'tr', 0) + '/s' : `${rule.threshold}%`
                    })}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void test(rule)}
                title={t('automation.test')}
                className="rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] text-ink-2 hover:text-ink"
              >
                {t('automation.test')}
              </button>
              <Toggle checked={rule.enabled} onChange={() => toggle(rule)} />
              <button
                type="button"
                onClick={() => remove(rule.id)}
                title={t('automation.delete')}
                className="text-ink-3 hover:text-danger"
              >
                <Trash2 size={14} />
              </button>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
