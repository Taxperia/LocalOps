import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import { useT } from '@/i18n'
import { api } from '@/lib/ipc'
import { Badge, Card, KeyValue, PageHeader, Spinner } from '@/components/ui'
import { useMetricsStore } from '@/stores/metrics'
import { formatDuration } from '@shared/format'
import type { PowerPlan } from '@shared/types'
import { useUiStore } from '@/stores/ui'

export function PowerPage() {
  const t = useT()
  const pushToast = useUiStore((s) => s.pushToast)
  const askConfirm = useUiStore((s) => s.askConfirm)
  const snapshot = useMetricsStore((s) => s.snapshot)
  const [plans, setPlans] = useState<PowerPlan[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    try {
      setPlans(await api.getPowerPlans())
    } catch {
      // keep old data
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const setActive = async (plan: PowerPlan): Promise<void> => {
    const ok = await askConfirm({
      title: t('power.setActiveTitle'),
      message: t('power.setActiveMsg', { name: plan.name }),
      confirmLabel: t('power.setActive')
    })
    if (!ok) return
    setBusy(plan.guid)
    try {
      const res = await api.setPowerPlan(plan.guid)
      if (!res.ok) {
        const denied = /access|denied|erişim|privilege/i.test(res.error ?? '')
        pushToast({ kind: 'error', title: t('err.generic'), message: denied ? t('err.accessDenied') : res.error })
      }
    } finally {
      setBusy(null)
      setTimeout(() => void load(), 1000)
    }
  }

  return (
    <div className="p-4">
      <PageHeader title={t('power.title')} />

      <div className="mt-3 grid max-w-[760px] grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-ink-3">{t('power.plans')}</div>
          {!plans ? (
            <Spinner />
          ) : plans.length === 0 ? (
            <div className="text-[12px] text-ink-3">{t('common.none')}</div>
          ) : (
            <div className="space-y-1.5">
              {plans.map((p) => (
                <div key={p.guid} className="flex items-center gap-2 rounded-md border border-line-soft bg-surface-2 px-2.5 py-1.5">
                  <Zap size={13} className={p.active ? 'text-accent' : 'text-ink-3'} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{p.name}</span>
                  {p.active ? (
                    <Badge tone="ok">{t('power.active')}</Badge>
                  ) : (
                    <button
                      type="button"
                      disabled={busy === p.guid}
                      onClick={() => void setActive(p)}
                      className="rounded border border-line px-2 py-0.5 text-[11px] text-ink-2 hover:text-ink disabled:opacity-40"
                    >
                      {t('power.setActive')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-ink-3">{t('power.battery')}</div>
          {snapshot?.battery ? (
            <div>
              <div className="mb-2 flex items-baseline gap-2">
                <span className="tnum text-[24px] font-semibold text-ink">
                  {snapshot.battery.chargePercent != null ? `${Math.round(snapshot.battery.chargePercent)}%` : '—'}
                </span>
                <Badge tone={snapshot.battery.charging ? 'ok' : 'neutral'}>
                  {snapshot.battery.charging ? t('battery.charging') : t('battery.discharging')}
                </Badge>
              </div>
              <KeyValue label={t('system.uptime')}>{formatDuration(snapshot.uptimeSec, 'tr')}</KeyValue>
            </div>
          ) : (
            <div className="text-[12px] text-ink-3">{t('health.unsupported')}</div>
          )}
        </Card>
      </div>
    </div>
  )
}
