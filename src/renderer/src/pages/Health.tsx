import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useT } from '@/i18n'
import { api } from '@/lib/ipc'
import { Badge, Card, EmptyState, KeyValue, PageHeader, Spinner } from '@/components/ui'
import { formatDuration, formatNumber } from '@shared/format'
import type { HealthPayload } from '@shared/types'
import { useMetricsStore } from '@/stores/metrics'

export function HealthPage() {
  const t = useT()
  const snapshot = useMetricsStore((s) => s.snapshot)
  const [data, setData] = useState<HealthPayload | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async (): Promise<void> => {
    setLoading(true)
    try {
      setData(await api.getHealth())
    } catch {
      // keep old data
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="p-4">
      <PageHeader
        title={t('health.title')}
        actions={
          <button
            type="button"
            onClick={() => void load()}
            title={t('common.refresh')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface-2 text-ink-2 hover:text-ink"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {loading && !data ? (
        <Card className="mt-3 p-4">
          <Spinner label={t('common.loading')} />
        </Card>
      ) : (
        <div className="mt-3 grid max-w-[1000px] grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">{t('health.disks')}</div>
            {(data?.disks ?? []).length === 0 ? (
              <EmptyState message={t('health.unsupported')} />
            ) : (
              (data?.disks ?? []).map((d, i) => (
                <div key={i} className="mb-2 border-b border-line-soft pb-2 last:mb-0 last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[12.5px] font-medium text-ink" title={d.model}>{d.model}</span>
                    {d.healthStatus ? (
                      <Badge tone={d.healthStatus.toLowerCase() === 'healthy' ? 'ok' : 'warn'}>
                        {d.healthStatus.toLowerCase() === 'healthy' ? t('health.healthy') : d.healthStatus}
                      </Badge>
                    ) : null}
                    <Badge tone="neutral">{d.mediaType ?? '—'}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4">
                    <KeyValue label={t('health.temp')}>
                      {d.temperatureC != null ? `${d.temperatureC} °C` : t('health.unsupported')}
                    </KeyValue>
                    <KeyValue label={t('health.wear')}>
                      {d.wearPercent != null ? `${d.wearPercent}%` : t('health.unsupported')}
                    </KeyValue>
                    <KeyValue label={t('health.readErr')}>{formatNumber(d.readErrors, 'tr')}</KeyValue>
                    <KeyValue label={t('health.writeErr')}>{formatNumber(d.writeErrors, 'tr')}</KeyValue>
                    <KeyValue label={t('health.powerOn')}>
                      {d.powerOnHours != null ? t('health.hours', { n: formatNumber(d.powerOnHours, 'tr') }) : t('health.unsupported')}
                    </KeyValue>
                  </div>
                </div>
              ))
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">{t('health.thermal')}</div>
            {(data?.thermal ?? []).length === 0 ? (
              <EmptyState message={t('health.unsupported')} />
            ) : (
              (data?.thermal ?? []).map((z, i) => {
                const hot = z.celsius >= 80
                const warm = z.celsius >= 65
                return (
                  <KeyValue key={i} label={z.zone}>
                    <Badge tone={hot ? 'danger' : warm ? 'warn' : 'ok'}>{z.celsius} °C</Badge>
                  </KeyValue>
                )
              })
            )}
            <div className="mt-3 border-t border-line-soft pt-2">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">{t('widget.battery')}</div>
              {data?.battery || snapshot?.battery ? (
                <>
                  <KeyValue label={t('battery.level')}>
                    {data?.battery?.chargePercent != null
                      ? `${data.battery.chargePercent}%`
                      : snapshot?.battery?.chargePercent != null
                        ? `${Math.round(snapshot.battery.chargePercent)}%`
                        : '—'}
                  </KeyValue>
                  <KeyValue label={t('power.runtime')}>
                    {data?.battery?.estimatedRuntimeSec != null
                      ? formatDuration(data.battery.estimatedRuntimeSec, 'tr')
                      : t('health.unsupported')}
                  </KeyValue>
                  <KeyValue label={t('power.voltage')}>
                    {data?.battery?.voltage != null ? `${data.battery.voltage} mV` : t('health.unsupported')}
                  </KeyValue>
                </>
              ) : (
                <EmptyState message={t('health.unsupported')} />
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
