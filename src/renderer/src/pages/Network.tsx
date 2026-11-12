import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { RefreshCw, Search } from 'lucide-react'
import { useT } from '@/i18n'
import { api } from '@/lib/ipc'
import { Card, EmptyState, PageHeader, Segmented, Spinner } from '@/components/ui'
import { formatNumber } from '@shared/format'
import type { NetConnection, NetConnectionsPayload } from '@shared/types'

type Filter = 'all' | 'listening' | 'established'

export function NetworkPage() {
  const t = useT()
  const [data, setData] = useState<NetConnectionsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: 'localPort' | 'processName' | 'state'; dir: 'asc' | 'desc' }>({
    key: 'localPort',
    dir: 'asc'
  })
  const aliveRef = useRef(true)

  const load = async (): Promise<void> => {
    try {
      const d = await api.getNetworkConnections()
      if (aliveRef.current) setData(d)
    } catch {
      // keep old data on transient failure
    } finally {
      if (aliveRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    aliveRef.current = true
    void load()
    const iv = setInterval(() => void load(), 4000)
    return () => {
      aliveRef.current = false
      clearInterval(iv)
    }
  }, [])

  const rows = useMemo<NetConnection[]>(() => {
    let list = data?.connections ?? []
    if (filter === 'listening') list = list.filter((c) => c.state === 'Listen')
    else if (filter === 'established') list = list.filter((c) => c.state === 'Established')
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (c) =>
          c.localAddress.toLowerCase().includes(q) ||
          String(c.localPort).includes(q) ||
          (c.remoteAddress?.toLowerCase().includes(q) ?? false) ||
          String(c.remotePort ?? '').includes(q) ||
          (c.processName?.toLowerCase().includes(q) ?? false)
      )
    }
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      if (sort.key === 'processName') {
        return ((a.processName ?? '').localeCompare(b.processName ?? '')) * dir
      }
      if (sort.key === 'state') return ((a.state ?? '').localeCompare(b.state ?? '')) * dir
      return (a.localPort - b.localPort) * dir
    })
  }, [data, filter, query, sort])

  const counts = useMemo(() => {
    const list = data?.connections ?? []
    return {
      tcp: list.filter((c) => c.protocol === 'TCP').length,
      udp: list.filter((c) => c.protocol === 'UDP').length,
      listening: list.filter((c) => c.state === 'Listen').length,
      established: list.filter((c) => c.state === 'Established').length
    }
  }, [data])

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 26,
    overscan: 15
  })

  const columns = [
    { key: 'proto', label: t('netconn.col.proto'), width: '52px' },
    { key: 'local', label: t('netconn.col.local'), width: 'minmax(170px,1fr)' },
    { key: 'remote', label: t('netconn.col.remote'), width: 'minmax(170px,1fr)' },
    { key: 'state', label: t('netconn.col.state'), width: '110px' },
    { key: 'pid', label: t('netconn.col.pid'), width: '70px', align: 'right' },
    { key: 'process', label: t('netconn.col.process'), width: 'minmax(110px,140px)' }
  ] as const
  const gridTemplate = columns.map((c) => c.width).join(' ')

  return (
    <div className="flex h-full flex-col p-4">
      <PageHeader
        title={t('netconn.title')}
        subtitle={data ? t('netconn.count', { n: formatNumber(rows.length, 'tr') }) : undefined}
        actions={
          <>
            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: `${t('netconn.filter.all')} (${formatNumber(data?.connections.length ?? 0, 'tr')})` },
                { value: 'listening', label: `${t('netconn.filter.listening')} (${formatNumber(counts.listening, 'tr')})` },
                { value: 'established', label: `${t('netconn.filter.established')} (${formatNumber(counts.established, 'tr')})` }
              ]}
            />
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('common.search')}
                className="h-8 w-[200px] rounded-md border border-line bg-surface-2 pl-8 pr-2 text-[12px] text-ink outline-none placeholder:text-ink-3 focus:border-accent"
              />
            </div>
            <button
              type="button"
              onClick={() => void load()}
              title={t('common.refresh')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface-2 text-ink-2 hover:text-ink"
            >
              <RefreshCw size={13} />
            </button>
          </>
        }
      />

      <Card className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
        {loading && !data ? (
          <Spinner label={t('common.loading')} />
        ) : (
          <>
            <div
              className="grid shrink-0 items-center border-b border-line-soft bg-surface-2/60 px-2 py-1.5 text-[11px] font-medium text-ink-3"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {columns.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  disabled={!(c.key === 'state' || c.key === 'process' || c.key === 'local')}
                  onClick={() => {
                    const sk = c.key === 'state' ? 'state' : c.key === 'process' ? 'processName' : 'localPort'
                    setSort((s) => (s.key === sk ? { key: sk, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: sk, dir: 'asc' }))
                  }}
                  className={`text-left ${'align' in c && c.align === 'right' ? 'text-right' : ''} disabled:cursor-default`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
              {rows.length === 0 ? (
                <EmptyState message={t('netconn.empty')} />
              ) : (
                <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                  {virtualizer.getVirtualItems().map((vi) => {
                    const c = rows[vi.index]
                    return (
                      <div
                        key={`${c.protocol}-${c.localAddress}:${c.localPort}-${c.pid}-${vi.index}`}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: vi.size,
                          transform: `translateY(${vi.start}px)`
                        }}
                      >
                        <div
                          className="grid h-full items-center px-2 text-[11.5px] hover:bg-surface-2"
                          style={{ gridTemplateColumns: gridTemplate }}
                        >
                          <div className={c.protocol === 'TCP' ? 'text-accent' : 'text-ok'}>{c.protocol}</div>
                          <div className="tnum truncate text-ink" title={`${c.localAddress}:${c.localPort}`}>
                            {c.localAddress}:{c.localPort}
                          </div>
                          <div className="tnum truncate text-ink-2" title={c.remoteAddress ? `${c.remoteAddress}:${c.remotePort}` : ''}>
                            {c.remoteAddress ? `${c.remoteAddress}:${c.remotePort}` : '—'}
                          </div>
                          <div className="truncate text-ink-3" title={c.state ?? ''}>
                            {c.state ?? '—'}
                          </div>
                          <div className="tnum text-right text-ink-3">{c.pid ?? '—'}</div>
                          <div className="truncate text-ink-2" title={c.processName ?? ''}>
                            {c.processName ?? '—'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </Card>
      <p className="mt-2 text-[11px] text-ink-3">
        TCP {formatNumber(counts.tcp, 'tr')} · UDP {formatNumber(counts.udp, 'tr')} · {t('perf.current')}:{' '}
        {data ? new Date(data.ts).toLocaleTimeString() : '—'}
      </p>
    </div>
  )
}
