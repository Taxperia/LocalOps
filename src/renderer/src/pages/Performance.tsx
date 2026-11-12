import { useEffect, useMemo, useState } from 'react'
import { useT } from '@/i18n'
import { useMetricsStore } from '@/stores/metrics'
import { CoreBars, LiveAreaChart, LiveLinesChart } from '@/components/charts'
import { Card, PageHeader, Segmented, Spinner } from '@/components/ui'
import { formatPercent, formatRate } from '@shared/format'
import type { HistoryPoint } from '@shared/types'
import { api } from '@/lib/ipc'

type RangeSec = 120 | 300 | 900

function toArea(points: HistoryPoint[], pick: (p: HistoryPoint) => number) {
  return points.map((p) => ({ ts: p.ts, value: pick(p) }))
}

function toLines(points: HistoryPoint[], pickA: (p: HistoryPoint) => number, pickB: (p: HistoryPoint) => number) {
  return points.map((p) => ({ ts: p.ts, a: pickA(p), b: pickB(p) }))
}

function ChartCard({
  title,
  current,
  children
}: {
  title: string
  current: string
  children: React.ReactNode
}) {
  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-2">{title}</span>
        <span className="tnum text-[13px] font-semibold text-ink">{current}</span>
      </div>
      {children}
    </Card>
  )
}

export function PerformancePage() {
  const t = useT()
  const snapshot = useMetricsStore((s) => s.snapshot)
  const [range, setRange] = useState<RangeSec>(300)
  const [points, setPoints] = useState<HistoryPoint[] | null>(null)

  useEffect(() => {
    let alive = true
    const load = async (): Promise<void> => {
      try {
        const h = await api.getMetricsHistory()
        if (alive) setPoints(h.points)
      } catch {
        // keep previous data on transient failures
      }
    }
    void load()
    const iv = setInterval(() => void load(), 2000)
    return () => {
      alive = false
      clearInterval(iv)
    }
  }, [])

  const visible = useMemo(() => (points ?? []).slice(-range), [points, range])

  return (
    <div className="p-4">
      <PageHeader
        title={t('nav.performance')}
        subtitle={t('settings.intervalHint')}
        actions={
          <Segmented<RangeSec>
            value={range}
            onChange={setRange}
            options={[
              { value: 120, label: t('perf.range120') },
              { value: 300, label: t('perf.range300') },
              { value: 900, label: t('perf.range900') }
            ]}
          />
        }
      />

      {!points ? (
        <Spinner label={t('common.loading')} />
      ) : visible.length === 0 ? (
        <Card className="mt-3">
          <div className="p-8 text-center text-[12px] text-ink-3">{t('states.noData')}</div>
        </Card>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <ChartCard title={t('perf.cpuTotal')} current={formatPercent(snapshot?.cpu.usage, 'tr', 1)}>
            <LiveAreaChart data={toArea(visible, (p) => p.cpu)} percent height={130} />
          </ChartCard>
          <ChartCard title={t('perf.memory')} current={formatPercent(snapshot?.memory.usedPercent, 'tr', 1)}>
            <LiveAreaChart data={toArea(visible, (p) => p.mem)} percent height={130} />
          </ChartCard>
          <ChartCard
            title={t('perf.diskIo')}
            current={`${formatRate(snapshot?.disks.reduce((a, d) => a + d.readBytesSec, 0), 'tr', 0)} / ${formatRate(snapshot?.disks.reduce((a, d) => a + d.writeBytesSec, 0), 'tr', 0)}`}
          >
            <LiveLinesChart
              data={toLines(visible, (p) => p.diskRead, (p) => p.diskWrite)}
              height={130}
            />
          </ChartCard>
          <ChartCard
            title={t('perf.network')}
            current={`${formatRate(snapshot?.network.reduce((a, n) => a + n.receivedBytesSec, 0), 'tr', 0)} / ${formatRate(snapshot?.network.reduce((a, n) => a + n.sentBytesSec, 0), 'tr', 0)}`}
          >
            <LiveLinesChart
              data={toLines(visible, (p) => p.netRecv, (p) => p.netSent)}
              height={130}
              colorA="green"
              colorB="accent"
            />
          </ChartCard>
          <Card className="col-span-2 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-ink-2">{t('perf.cores')}</span>
              <span className="tnum text-[11px] text-ink-3">
                {snapshot ? `${snapshot.cpu.perCore.length} × · ${Math.round(snapshot.cpu.usage)}%` : ''}
              </span>
            </div>
            {snapshot ? <CoreBars values={snapshot.cpu.perCore} /> : null}
          </Card>
        </div>
      )}
    </div>
  )
}
