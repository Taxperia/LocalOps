import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { useT } from '@/i18n'
import { api } from '@/lib/ipc'
import { Badge, Card, EmptyState, PageHeader, Spinner } from '@/components/ui'
import { formatDateTime, formatNumber } from '@shared/format'
import type { DriversPayload } from '@shared/types'

export function DriversPage() {
  const t = useT()
  const [data, setData] = useState<DriversPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('')

  const load = async (force: boolean): Promise<void> => {
    setLoading(true)
    try {
      setData(await api.getDrivers(force))
    } catch {
      // keep old data
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(false)
  }, [])

  const classes = useMemo(() => {
    const set = new Set<string>()
    for (const d of data?.drivers ?? []) if (d.deviceClass) set.add(d.deviceClass)
    return [...set].sort()
  }, [data])

  const rows = useMemo(() => {
    let list = data?.drivers ?? []
    if (classFilter) list = list.filter((d) => d.deviceClass === classFilter)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.manufacturer?.toLowerCase().includes(q) ?? false) ||
          (d.version?.toLowerCase().includes(q) ?? false)
      )
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [data, query, classFilter])

  return (
    <div className="flex h-full flex-col p-4">
      <PageHeader
        title={t('drivers.title')}
        subtitle={data ? t('drivers.count', { n: formatNumber(rows.length, 'tr') }) : t('drivers.slowHint')}
        actions={
          <>
            {classes.length > 0 ? (
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="h-8 rounded-md border border-line bg-surface-2 px-2 text-[12px] text-ink-2 outline-none focus:border-accent"
              >
                <option value="">{t('common.none')}</option>
                {classes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('drivers.search')}
                className="h-8 w-[220px] rounded-md border border-line bg-surface-2 pl-8 pr-2 text-[12px] text-ink outline-none placeholder:text-ink-3 focus:border-accent"
              />
            </div>
            <button
              type="button"
              onClick={() => void load(true)}
              title={t('common.refresh')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface-2 text-ink-2 hover:text-ink"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </>
        }
      />

      {loading && !data ? (
        <Card className="mt-3 p-4">
          <Spinner label={t('drivers.slowHint')} />
        </Card>
      ) : (
        <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <div>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">{t('drivers.problems')}</div>
            <Card className="p-2">
              {(data?.problems ?? []).length === 0 ? (
                <div className="py-2 text-center text-[12px] text-ink-3">{t('drivers.noProblems')}</div>
              ) : (
                (data?.problems ?? []).map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 border-b border-line-soft px-1.5 py-1.5 last:border-b-0"
                  >
                    <Badge tone="warn">{t('drivers.code', { n: p.code })}</Badge>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-ink" title={p.deviceId ?? undefined}>
                      {p.name ?? p.deviceId ?? '—'}
                    </span>
                  </div>
                ))
              )}
            </Card>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">{t('drivers.all')}</div>
            <Card className="overflow-hidden">
              {rows.length === 0 ? (
                <EmptyState message={t('proc.empty')} />
              ) : (
                <div className="max-h-[calc(100vh-330px)] overflow-y-auto">
                  <table className="w-full text-[11.5px]">
                    <thead className="sticky top-0 bg-surface-2 text-ink-3">
                      <tr>
                        <th className="px-2.5 py-1.5 text-left font-medium">{t('drivers.col.driver')}</th>
                        <th className="px-2.5 py-1.5 text-left font-medium">{t('drivers.col.version')}</th>
                        <th className="px-2.5 py-1.5 text-left font-medium">{t('drivers.col.date')}</th>
                        <th className="px-2.5 py-1.5 text-left font-medium">{t('drivers.col.provider')}</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">{t('drivers.col.signed')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((d, i) => (
                        <tr key={i} className="border-t border-line-soft hover:bg-surface-2">
                          <td className="max-w-[280px] px-2.5 py-1.5">
                            <div className="truncate text-ink" title={`${d.name}${d.deviceClass ? ` [${d.deviceClass}]` : ''}`}>
                              {d.friendlyName ?? d.name}
                            </div>
                          </td>
                          <td className="tnum px-2.5 py-1.5 text-ink-2">{d.version ?? '—'}</td>
                          <td className="tnum px-2.5 py-1.5 text-ink-3">{formatDateTime(d.date, 'tr')}</td>
                          <td className="max-w-[180px] truncate px-2.5 py-1.5 text-ink-3" title={d.manufacturer ?? ''}>
                            {d.manufacturer ?? '—'}
                          </td>
                          <td className="px-2.5 py-1.5 text-right">
                            <Badge tone={d.signed ? 'ok' : 'warn'}>{d.signed ? t('drivers.signed') : t('drivers.unsigned')}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
