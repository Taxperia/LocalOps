import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { useT } from '@/i18n'
import { api } from '@/lib/ipc'
import { Badge, Card, EmptyState, PageHeader, Spinner, Toggle } from '@/components/ui'
import { formatNumber } from '@shared/format'
import type { StartupItem } from '@shared/types'
import { useUiStore } from '@/stores/ui'

export function StartupPage() {
  const t = useT()
  const pushToast = useUiStore((s) => s.pushToast)
  const [items, setItems] = useState<StartupItem[] | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    try {
      setItems(await api.getStartupItems())
    } catch {
      // keep old data
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const rows = useMemo(() => {
    let list = items ?? []
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (i) => i.name.toLowerCase().includes(q) || (i.command?.toLowerCase().includes(q) ?? false)
      )
    }
    return list
  }, [items, query])

  const toggle = async (item: StartupItem): Promise<void> => {
    const id = `${item.target}|${item.sub}|${item.name}`
    setBusy(id)
    try {
      const res = await api.toggleStartupItem(item, !item.enabled)
      if (res.ok) {
        pushToast({ kind: 'success', title: t('startup.toggled', { name: item.name }) })
      } else {
        const denied = /access|denied|erişim|denied/i.test(res.error ?? '')
        pushToast({
          kind: 'error',
          title: t('err.generic'),
          message: denied ? t('err.accessDenied') : res.error
        })
      }
    } finally {
      setBusy(null)
      setTimeout(() => void load(), 800)
    }
  }

  return (
    <div className="flex h-full flex-col p-4">
      <PageHeader
        title={t('startup.title')}
        subtitle={items ? t('startup.count', { n: formatNumber(rows.length, 'tr') }) : undefined}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('startup.search')}
                className="h-8 w-[240px] rounded-md border border-line bg-surface-2 pl-8 pr-2 text-[12px] text-ink outline-none placeholder:text-ink-3 focus:border-accent"
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
          </div>
        }
      />

      <p className="mt-2 text-[11.5px] text-ink-3">{t('startup.note')}</p>

      <Card className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
        {!items ? (
          <Spinner label={t('common.loading')} />
        ) : rows.length === 0 ? (
          <EmptyState message={t('startup.empty')} />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {rows.map((item) => {
              const id = `${item.target}|${item.sub}|${item.name}`
              return (
                <div
                  key={id}
                  className="flex items-center gap-3 border-b border-line-soft px-3 py-2 last:border-b-0 hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium text-ink" title={item.command ?? undefined}>
                      {item.name}
                    </div>
                    <div className="truncate text-[11px] text-ink-3" title={item.command ?? ''}>
                      {item.command ?? '—'}
                    </div>
                  </div>
                  <div className="w-[190px] shrink-0 truncate text-[11px] text-ink-3" title={item.location}>
                    {item.location}
                  </div>
                  <div className="w-[90px] shrink-0">
                    <Badge tone={item.enabled ? 'ok' : 'neutral'}>
                      {item.enabled ? t('startup.enabled') : t('startup.disabled')}
                    </Badge>
                  </div>
                  <div className="w-[64px] shrink-0 flex justify-end">
                    {item.toggleable ? (
                      busy === id ? (
                        <Spinner />
                      ) : (
                        <Toggle checked={item.enabled} onChange={() => void toggle(item)} />
                      )
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
