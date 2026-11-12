import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, Trash2 } from 'lucide-react'
import { useT } from '@/i18n'
import { api } from '@/lib/ipc'
import { Card, EmptyState, PageHeader, Spinner } from '@/components/ui'
import { formatBytes, formatNumber } from '@shared/format'
import type { InstalledApp } from '@shared/types'
import { useUiStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'

function formatInstallDate(s: string | null, locale: 'tr' | 'en'): string {
  if (!s || !/^\d{8}$/.test(s)) return '—'
  const d = new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)))
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US')
}

export function AppsPage() {
  const t = useT()
  const locale = useSettingsStore((s) => s.settings.locale)
  const pushToast = useUiStore((s) => s.pushToast)
  const askConfirm = useUiStore((s) => s.askConfirm)
  const [apps, setApps] = useState<InstalledApp[] | null>(null)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    try {
      setApps(await api.getInstalledApps())
    } catch {
      // keep old data
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const rows = useMemo(() => {
    let list = apps ?? []
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (a) => a.name.toLowerCase().includes(q) || (a.publisher?.toLowerCase().includes(q) ?? false)
      )
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [apps, query])

  const uninstall = async (app: InstalledApp): Promise<void> => {
    const ok = await askConfirm({
      title: t('apps.uninstallTitle'),
      message: t('apps.uninstallMsg', { name: app.name }),
      confirmLabel: t('apps.uninstall'),
      danger: true
    })
    if (!ok) return
    setBusyId(app.id)
    try {
      const res = await api.uninstallApp(app.id)
      if (res.ok) {
        pushToast({ kind: 'success', title: t('apps.launched') })
      } else {
        const denied = /access|denied|erişim/i.test(res.error ?? '')
        pushToast({ kind: 'error', title: t('err.generic'), message: denied ? t('err.accessDenied') : res.error })
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex h-full flex-col p-4">
      <PageHeader
        title={t('apps.title')}
        subtitle={apps ? t('apps.count', { n: formatNumber(rows.length, 'tr') }) : undefined}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('apps.search')}
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

      <Card className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
        {!apps ? (
          <Spinner label={t('common.loading')} />
        ) : rows.length === 0 ? (
          <EmptyState message={t('apps.empty')} />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {rows.map((app) => (
              <div
                key={app.id}
                className="flex items-center gap-3 border-b border-line-soft px-3 py-2 last:border-b-0 hover:bg-surface-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium text-ink" title={app.name}>
                    {app.name}
                  </div>
                  <div className="truncate text-[11px] text-ink-3" title={app.publisher ?? ''}>
                    {app.publisher ?? '—'}
                  </div>
                </div>
                <div className="tnum w-[90px] shrink-0 text-right text-[11.5px] text-ink-2">
                  {app.version ?? '—'}
                </div>
                <div className="tnum w-[80px] shrink-0 text-right text-[11.5px] text-ink-2">
                  {formatBytes(app.estimatedSizeBytes, 'tr', 0)}
                </div>
                <div className="tnum w-[90px] shrink-0 text-right text-[11.5px] text-ink-3">
                  {formatInstallDate(app.installDate, locale)}
                </div>
                <div className="w-[80px] shrink-0 text-right">
                  {app.hasUninstaller ? (
                    <button
                      type="button"
                      disabled={busyId === app.id}
                      onClick={() => void uninstall(app)}
                      className="inline-flex items-center gap-1 rounded border border-line bg-surface-2 px-2 py-1 text-[11.5px] text-ink-2 transition-colors hover:!border-danger/40 hover:!text-danger disabled:opacity-40"
                    >
                      {busyId === app.id ? <Spinner /> : <Trash2 size={12} />}
                      {t('apps.uninstall')}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
