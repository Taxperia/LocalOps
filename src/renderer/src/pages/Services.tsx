import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Play, RotateCw, Search, Square } from 'lucide-react'
import { useT } from '@/i18n'
import { api } from '@/lib/ipc'
import { Badge, Card, EmptyState, PageHeader, Segmented, Spinner } from '@/components/ui'
import { formatNumber } from '@shared/format'
import type { ServiceInfo, ServiceStartupType } from '@shared/types'
import { useUiStore } from '@/stores/ui'
import { useProcessesStore } from '@/stores/processes'
import { useSettingsStore } from '@/stores/settings'

type Filter = 'all' | 'running' | 'stopped'

const CRITICAL_SERVICES = new Set([
  'rpcss',
  'dcomlaunch',
  'winmgmt',
  'lsm',
  'schedule',
  'eventlog',
  'mpssvc',
  'windefend',
  'wisvc'
])

function stateTone(state: ServiceInfo['state']): 'ok' | 'neutral' | 'warn' | 'accent' {
  if (state === 'running') return 'ok'
  if (state === 'stopped') return 'neutral'
  if (state === 'paused') return 'warn'
  return 'accent'
}

export function ServicesPage() {
  const t = useT()
  const locale = useSettingsStore((s) => s.settings.locale)
  const pushToast = useUiStore((s) => s.pushToast)
  const askConfirm = useUiStore((s) => s.askConfirm)
  const setPage = useUiStore((s) => s.setPage)
  const setSelected = useProcessesStore((s) => s.setSelected)

  const [services, setServices] = useState<ServiceInfo[] | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [busyName, setBusyName] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    try {
      const list = await api.getServices()
      setServices(list)
    } catch {
      // keep old data
    }
  }

  useEffect(() => {
    void load()
    const iv = setInterval(() => void load(), 10000)
    return () => clearInterval(iv)
  }, [])

  const rows = useMemo(() => {
    let list = services ?? []
    if (filter === 'running') list = list.filter((s) => s.state === 'running')
    else if (filter === 'stopped') list = list.filter((s) => s.state === 'stopped')
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.displayName.toLowerCase().includes(q)
      )
    }
    return list
  }, [services, filter, query])

  const actionLabel = (a: 'start' | 'stop' | 'restart'): string =>
    a === 'start' ? t('svc.start') : a === 'stop' ? t('svc.stop') : t('svc.restart')

  const runAction = async (svc: ServiceInfo, action: 'start' | 'stop' | 'restart'): Promise<void> => {
    const critical = CRITICAL_SERVICES.has(svc.name.toLowerCase()) && action !== 'start'
    const ok = await askConfirm({
      title: t('svc.confirmTitle'),
      message:
        t('svc.confirmMsg', { name: svc.displayName, action: actionLabel(action) }) +
        (critical ? `\n\n${t('svc.confirmStopCritical')}` : ''),
      confirmLabel: actionLabel(action),
      danger: critical
    })
    if (!ok) return
    setBusyName(svc.name)
    try {
      const res = await api.serviceAction(svc.name, action)
      if (!res.ok) {
        const denied = /access|denied|erişim/i.test(res.error ?? '')
        pushToast({ kind: 'error', title: t('err.generic'), message: denied ? t('err.accessDenied') : res.error })
      }
    } finally {
      setBusyName(null)
      setTimeout(() => void load(), 1200)
    }
  }

  const changeStartup = async (svc: ServiceInfo, mode: ServiceStartupType): Promise<void> => {
    const ok = await askConfirm({
      title: t('svc.setStartupTitle'),
      message: t('svc.setStartupMsg', {
        name: svc.displayName,
        mode: t(`svc.mode.${mode.toLowerCase() === 'automatic' ? 'auto' : mode.toLowerCase()}` as never)
      }),
      confirmLabel: 'OK'
    })
    if (!ok) return
    setBusyName(svc.name)
    try {
      const res = await api.setServiceStartupType(svc.name, mode)
      if (!res.ok) {
        const denied = /access|denied|erişim/i.test(res.error ?? '')
        pushToast({ kind: 'error', title: t('err.generic'), message: denied ? t('err.accessDenied') : res.error })
      }
    } finally {
      setBusyName(null)
      setTimeout(() => void load(), 1200)
    }
  }

  const openProcess = (pid: number | null): void => {
    if (pid == null) return
    setSelected(pid)
    setPage('processes')
  }

  return (
    <div className="flex h-full flex-col p-4">
      <PageHeader
        title={t('svc.title')}
        subtitle={services ? t('svc.count', { n: formatNumber(rows.length, 'tr') }) : undefined}
        actions={
          <>
            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: t('svc.filter.all') },
                { value: 'running', label: t('svc.filter.running') },
                { value: 'stopped', label: t('svc.filter.stopped') }
              ]}
            />
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('svc.search')}
                className="h-8 w-[220px] rounded-md border border-line bg-surface-2 pl-8 pr-2 text-[12px] text-ink outline-none placeholder:text-ink-3 focus:border-accent"
              />
            </div>
          </>
        }
      />

      <Card className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
        {!services ? (
          <Spinner label={t('common.loading')} />
        ) : rows.length === 0 ? (
          <EmptyState message={t('svc.empty')} />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {rows.map((svc) => {
              const critical = CRITICAL_SERVICES.has(svc.name.toLowerCase())
              const busy = busyName === svc.name
              return (
                <div
                  key={svc.name}
                  className="flex items-center gap-3 border-b border-line-soft px-3 py-2 last:border-b-0 hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[12.5px] font-medium text-ink" title={svc.description ?? undefined}>
                        {svc.displayName}
                      </span>
                      {critical ? (
                        <span title={t('svc.confirmStopCritical')}>
                          <AlertTriangle size={12} className="shrink-0 text-warn" />
                        </span>
                      ) : null}
                      {busy ? <Spinner /> : null}
                    </div>
                    <div className="tnum truncate text-[11px] text-ink-3" title={svc.name}>
                      {svc.name}
                    </div>
                  </div>
                  <div className="w-[110px] shrink-0">
                    <Badge tone={stateTone(svc.state)}>{t(`svc.state.${svc.state}` as never)}</Badge>
                  </div>
                  <div className="w-[150px] shrink-0">
                    <select
                      value={
                        svc.startMode === 'auto' || svc.startMode === 'autoDelayed'
                          ? 'Automatic'
                          : svc.startMode === 'manual'
                            ? 'Manual'
                            : svc.startMode === 'disabled'
                              ? 'Disabled'
                              : ''
                      }
                      disabled={svc.startMode === 'other' || busy}
                      onChange={(e) => void changeStartup(svc, e.target.value as ServiceStartupType)}
                      className="w-full rounded border border-line bg-surface-2 px-1.5 py-1 text-[11.5px] text-ink-2 outline-none focus:border-accent"
                    >
                      {svc.startMode === 'other' ? <option value="">{t('svc.mode.other')}</option> : null}
                      <option value="Automatic">{t('svc.mode.auto')}</option>
                      <option value="Manual">{t('svc.mode.manual')}</option>
                      <option value="Disabled">{t('svc.mode.disabled')}</option>
                    </select>
                  </div>
                  <div className="w-[140px] shrink-0 truncate text-[11.5px] text-ink-3" title={svc.account ?? ''}>
                    {svc.account ?? '—'}
                  </div>
                  <button
                    type="button"
                    onClick={() => openProcess(svc.pid)}
                    disabled={svc.pid == null}
                    className="tnum w-[60px] shrink-0 text-right text-[11.5px] text-ink-3 hover:text-accent disabled:cursor-default disabled:hover:text-ink-3"
                    title={svc.pid != null ? t('proc.details') : ''}
                  >
                    {svc.pid ?? '—'}
                  </button>
                  <div className="flex w-[92px] shrink-0 items-center justify-end gap-1">
                    <ActBtn
                      title={t('svc.start')}
                      disabled={svc.state === 'running' || busy}
                      onClick={() => void runAction(svc, 'start')}
                    >
                      <Play size={12} />
                    </ActBtn>
                    <ActBtn
                      title={t('svc.stop')}
                      disabled={svc.state === 'stopped' || !svc.canStop || busy}
                      danger
                      onClick={() => void runAction(svc, 'stop')}
                    >
                      <Square size={11} />
                    </ActBtn>
                    <ActBtn
                      title={t('svc.restart')}
                      disabled={svc.state === 'stopped' || busy}
                      onClick={() => void runAction(svc, 'restart')}
                    >
                      <RotateCw size={12} />
                    </ActBtn>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
      {locale !== 'en' ? null : null}
    </div>
  )
}

function ActBtn({
  title,
  disabled,
  danger,
  onClick,
  children
}: {
  title: string
  disabled?: boolean
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-6 w-6 items-center justify-center rounded border border-line bg-surface-2 text-ink-2 transition-colors hover:text-ink disabled:opacity-30 ${
        danger ? 'hover:!border-danger/40 hover:!text-danger' : ''
      }`}
    >
      {children}
    </button>
  )
}
