import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, RefreshCw, Search } from 'lucide-react'
import { useT } from '@/i18n'
import { api } from '@/lib/ipc'
import { Badge, Card, EmptyState, PageHeader, Segmented, Select, Spinner } from '@/components/ui'
import { formatDateTime, formatNumber } from '@shared/format'
import type { EventLevelFilter, EventLogName, EventQueryRequest, EventRecord } from '@shared/types'
import { useSettingsStore } from '@/stores/settings'

const LOGS: EventLogName[] = ['System', 'Application', 'Security', 'Setup']
const LEVELS: EventLevelFilter[] = ['all', 'critical', 'error', 'warning', 'information']

function levelBadge(levelId: number, levelName: string | null, t: (k: never) => string): { tone: 'danger' | 'warn' | 'accent' | 'neutral'; label: string } {
  if (levelId === 1) return { tone: 'danger', label: levelName ?? t('events.lvl.critical' as never) }
  if (levelId === 2) return { tone: 'danger', label: levelName ?? t('events.lvl.error' as never) }
  if (levelId === 3) return { tone: 'warn', label: levelName ?? t('events.lvl.warning' as never) }
  if (levelId === 4) return { tone: 'accent', label: levelName ?? t('events.lvl.information' as never) }
  return { tone: 'neutral', label: levelName ?? String(levelId) }
}

export function EventsPage() {
  const t = useT()
  const locale = useSettingsStore((s) => s.settings.locale)
  const [log, setLog] = useState<EventLogName>('System')
  const [level, setLevel] = useState<EventLevelFilter>('error')
  const [rangeSec, setRangeSec] = useState<86400 | 604800 | 2592000>(86400)
  const [query, setQuery] = useState('')
  const [maxCount, setMaxCount] = useState(300)
  const [records, setRecords] = useState<EventRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  const load = async (req: EventQueryRequest): Promise<void> => {
    setLoading(true)
    try {
      const res = await api.queryEvents(req)
      setRecords(res.events)
      setError(res.error)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load({ log, level, startMs: Date.now() - rangeSec * 1000, maxCount })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, level, rangeSec, maxCount])

  const rows = useMemo(() => {
    let list = records ?? []
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (r) =>
          (r.message?.toLowerCase().includes(q) ?? false) ||
          (r.provider?.toLowerCase().includes(q) ?? false) ||
          String(r.id).includes(q)
      )
    }
    return list
  }, [records, query])

  return (
    <div className="flex h-full flex-col p-4">
      <PageHeader
        title={t('events.title')}
        subtitle={records ? t('events.matching', { n: formatNumber(rows.length, 'tr') }) : undefined}
        actions={
          <>
            <Select<EventLogName>
              value={log}
              onChange={(v) => setLog(v)}
              options={LOGS.map((l) => ({ value: l, label: l }))}
            />
            <Segmented<EventLevelFilter>
              value={level}
              onChange={setLevel}
              options={LEVELS.map((l) => ({ value: l, label: t(`events.lvl.${l}` as never) }))}
            />
            <Segmented<86400 | 604800 | 2592000>
              value={rangeSec}
              onChange={setRangeSec}
              options={[
                { value: 86400, label: t('events.range.1d') },
                { value: 604800, label: t('events.range.7d') },
                { value: 2592000, label: t('events.range.30d') }
              ]}
            />
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('events.search')}
                className="h-8 w-[200px] rounded-md border border-line bg-surface-2 pl-8 pr-2 text-[12px] text-ink outline-none placeholder:text-ink-3 focus:border-accent"
              />
            </div>
            <button
              type="button"
              onClick={() => void load({ log, level, startMs: Date.now() - rangeSec * 1000, maxCount })}
              title={t('common.refresh')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface-2 text-ink-2 hover:text-ink"
            >
              <RefreshCw size={13} />
            </button>
          </>
        }
      />

      {error ? (
        <Card className="mt-3 border-danger/40 p-3">
          <div className="text-[12px] text-danger">
            {/denied|erişim/i.test(error) ? t('events.adminRequired') : `${t('common.error')}: ${error}`}
          </div>
        </Card>
      ) : null}

      <Card className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
        {loading && !records ? (
          <Spinner label={t('common.loading')} />
        ) : rows.length === 0 ? (
          <EmptyState message={t('events.empty')} />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {rows.map((r, i) => {
              const badge = levelBadge(r.levelId, r.levelName, t as never)
              const isOpen = expanded === i
              return (
                <div key={`${r.recordId ?? i}-${r.time}`} className="border-b border-line-soft last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : i)}
                    className="flex w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-surface-2"
                  >
                    {isOpen ? (
                      <ChevronDown size={13} className="shrink-0 text-ink-3" />
                    ) : (
                      <ChevronRight size={13} className="shrink-0 text-ink-3" />
                    )}
                    <span className="tnum w-[130px] shrink-0 text-[11.5px] text-ink-3">
                      {formatDateTime(r.time, locale)}
                    </span>
                    <span className="w-[86px] shrink-0">
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </span>
                    <span className="tnum w-[64px] shrink-0 text-right text-[11.5px] text-ink-3">#{r.id}</span>
                    <span className="w-[170px] shrink-0 truncate text-[11.5px] text-ink-2" title={r.provider ?? ''}>
                      {r.provider ?? '—'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink" title={r.message ?? ''}>
                      {r.message ?? '—'}
                    </span>
                  </button>
                  {isOpen ? (
                    <div className="anim-fade bg-surface-2/60 px-12 py-2.5">
                      <div className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-ink-2">
                        {r.message ?? t('events.noMessage')}
                      </div>
                      <div className="tnum mt-2 text-[11px] text-ink-3">
                        {r.log} · RecordId {r.recordId ?? '—'} · {formatDateTime(r.time, locale)}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <div className="mt-2 flex justify-center">
        <button
          type="button"
          onClick={() => setMaxCount((m) => m + 300)}
          className="rounded-md border border-line bg-surface-2 px-3 py-1.5 text-[12px] text-ink-2 hover:text-ink"
        >
          {t('events.loadMore')}
        </button>
      </div>
    </div>
  )
}
