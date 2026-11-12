import { useCallback, useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { useT } from '@/i18n'
import { api } from '@/lib/ipc'
import { Badge, Card, PageHeader, Segmented, Spinner } from '@/components/ui'
import { LiveAreaChart } from '@/components/charts'
import { formatDateTime, formatNumber, formatRate } from '@shared/format'
import type { HistoryPoint, HistoryStats, HistoryStatus } from '@shared/types'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'

type RangeSec = 3600 | 86400 | 604800

interface StatRow {
  key: 'cpu' | 'mem' | 'diskRead' | 'diskWrite' | 'netRecv' | 'netSent'
  labelKey: 'reports.metric.cpu' | 'reports.metric.mem' | 'reports.metric.diskRead' | 'reports.metric.diskWrite' | 'reports.metric.netRecv' | 'reports.metric.netSent'
  fmt: (v: number) => string
}

const ROWS: StatRow[] = [
  { key: 'cpu', labelKey: 'reports.metric.cpu', fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'mem', labelKey: 'reports.metric.mem', fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'diskRead', labelKey: 'reports.metric.diskRead', fmt: (v) => formatRate(v, 'tr', 0) },
  { key: 'diskWrite', labelKey: 'reports.metric.diskWrite', fmt: (v) => formatRate(v, 'tr', 0) },
  { key: 'netRecv', labelKey: 'reports.metric.netRecv', fmt: (v) => formatRate(v, 'tr', 0) },
  { key: 'netSent', labelKey: 'reports.metric.netSent', fmt: (v) => formatRate(v, 'tr', 0) }
]

export function ReportsPage() {
  const t = useT()
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const pushToast = useUiStore((s) => s.pushToast)
  const [status, setStatus] = useState<HistoryStatus | null>(null)
  const [range, setRange] = useState<RangeSec>(86400)
  const [points, setPoints] = useState<HistoryPoint[] | null>(null)
  const [stats, setStats] = useState<HistoryStats | null>(null)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    const to = Date.now()
    const from = to - range * 1000
    try {
      const [st, pts, sts] = await Promise.all([
        api.getHistoryStatus(),
        api.queryHistory(from, to, 600),
        api.getHistoryStats(from, to)
      ])
      setStatus(st)
      setPoints(pts)
      setStats(sts)
    } catch {
      // keep old data
    }
  }, [range])

  useEffect(() => {
    void load()
    const iv = setInterval(() => void load(), 30000)
    return () => clearInterval(iv)
  }, [load])

  const doExport = async (format: 'csv' | 'json'): Promise<void> => {
    setExporting(true)
    try {
      const res = await api.exportHistory(format, Date.now() - range * 1000, Date.now())
      if (res.ok) {
        pushToast({ kind: 'success', title: t('sysinfo.copied') })
      } else if (res.error !== 'cancelled') {
        pushToast({ kind: 'error', title: t('err.generic'), message: res.error })
      }
    } finally {
      setExporting(false)
    }
  }

  const rangeLabel = range === 3600 ? t('reports.range.1h') : range === 86400 ? t('reports.range.24h') : t('reports.range.7d')
  const chartData = (points ?? []).map((p) => ({ ts: p.ts, value: p.cpu }))

  return (
    <div className="flex h-full flex-col p-4">
      <PageHeader
        title={t('reports.title')}
        subtitle={t('reports.hint')}
        actions={
          <>
            <Segmented<RangeSec>
              value={range}
              onChange={setRange}
              options={[
                { value: 3600, label: t('reports.range.1h') },
                { value: 86400, label: t('reports.range.24h') },
                { value: 604800, label: t('reports.range.7d') }
              ]}
            />
            <button
              type="button"
              onClick={() => void doExport('csv')}
              disabled={exporting}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 text-[12px] text-ink-2 hover:text-ink disabled:opacity-40"
            >
              <Download size={12} />
              CSV
            </button>
            <button
              type="button"
              onClick={() => void doExport('json')}
              disabled={exporting}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 text-[12px] text-ink-2 hover:text-ink disabled:opacity-40"
            >
              <Download size={12} />
              JSON
            </button>
          </>
        }
      />

      <Card className="mt-3 p-3">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{t('reports.recording')}</span>
          {status ? (
            <>
              <Badge tone="ok">{status.backend === 'sqlite' ? t('reports.backend.sqlite') : t('reports.backend.jsonl')}</Badge>
              <Badge tone="neutral">{t('reports.points', { n: formatNumber(status.count, 'tr') })}</Badge>
              {status.recordedSince ? (
                <span className="text-ink-3">{t('reports.since', { date: formatDateTime(status.recordedSince, 'tr') })}</span>
              ) : null}
            </>
          ) : (
            <Spinner />
          )}
          <span className="ml-auto flex items-center gap-3">
            <span className="text-[12px] text-ink-2">{t('reports.retention')}</span>
            <span className="tnum w-[44px] text-right text-[12px] text-ink">
              {t('reports.retentionDays', { n: settings.historyRetentionDays })}
            </span>
            <input
              type="range"
              min={1}
              max={90}
              value={settings.historyRetentionDays}
              onChange={(e) => void update({ historyRetentionDays: Number(e.target.value) })}
              className="h-1.5 w-[160px] cursor-pointer appearance-none rounded-full bg-surface-3"
              style={{ accentColor: 'var(--accent)' }}
            />
          </span>
        </div>
      </Card>

      <Card className="mt-3 p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{t('reports.metric.cpu')}</span>
          {stats ? (
            <span className="tnum text-[12px] text-ink">{stats.cpu.avg.toFixed(1)}% {t('reports.avg').toLowerCase()}</span>
          ) : null}
        </div>
        {points && points.length > 0 ? (
          <LiveAreaChart data={chartData} percent height={110} />
        ) : (
          <div className="py-6 text-center text-[12px] text-ink-3">{t('reports.empty')}</div>
        )}
      </Card>

      {stats && stats.count > 0 ? (
        <Card className="mt-3 flex-1 p-3">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">
            {t('reports.stats', { range: rangeLabel })}
          </div>
          <table className="w-full text-[12px]">
            <thead className="text-ink-3">
              <tr>
                <th className="py-1 text-left font-medium">{t('reports.metricName')}</th>
                <th className="py-1 text-right font-medium">{t('reports.avg')}</th>
                <th className="py-1 text-right font-medium">{t('reports.max')}</th>
                <th className="py-1 text-right font-medium">{t('reports.min')}</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => {
                const s = stats[r.key]
                return (
                  <tr key={r.key} className="border-t border-line-soft">
                    <td className="py-1.5 text-ink-2">{t(r.labelKey)}</td>
                    <td className="tnum py-1.5 text-right text-ink">{r.fmt(s.avg)}</td>
                    <td className="tnum py-1.5 text-right text-ink-2">{r.fmt(s.max)}</td>
                    <td className="tnum py-1.5 text-right text-ink-3">{r.fmt(s.min)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  )
}
