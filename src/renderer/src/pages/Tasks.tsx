import { useEffect, useMemo, useState } from 'react'
import { Play, RefreshCw, Search, Square, Power as PowerIcon } from 'lucide-react'
import { useT } from '@/i18n'
import { api } from '@/lib/ipc'
import { Badge, Card, EmptyState, PageHeader, Spinner, Toggle } from '@/components/ui'
import { formatDateTime, formatNumber } from '@shared/format'
import type { ScheduledTaskInfo, TaskAction } from '@shared/types'
import { useUiStore } from '@/stores/ui'

function stateTone(state: ScheduledTaskInfo['state']): 'ok' | 'accent' | 'neutral' | 'warn' {
  if (state === 'Running') return 'ok'
  if (state === 'Ready') return 'accent'
  if (state === 'Disabled') return 'neutral'
  return 'warn'
}

export function TasksPage() {
  const t = useT()
  const pushToast = useUiStore((s) => s.pushToast)
  const askConfirm = useUiStore((s) => s.askConfirm)
  const [tasks, setTasks] = useState<ScheduledTaskInfo[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [userOnly, setUserOnly] = useState(true)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = async (uo: boolean): Promise<void> => {
    setLoading(true)
    try {
      setTasks(await api.getTasks(uo))
    } catch {
      // keep old data
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(userOnly)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userOnly])

  const rows = useMemo(() => {
    let list = tasks ?? []
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((x) => x.name.toLowerCase().includes(q) || x.path.toLowerCase().includes(q))
    return [...list].sort((a, b) => `${a.path}${a.name}`.localeCompare(`${b.path}${b.name}`))
  }, [tasks, query])

  const runAction = async (task: ScheduledTaskInfo, action: TaskAction): Promise<void> => {
    const actionText = t(`tasks.act.${action}` as never)
    const ok = await askConfirm({
      title: t('tasks.confirmTitle'),
      message: t('tasks.confirmMsg', { name: task.name, action: actionText }),
      confirmLabel: 'OK'
    })
    if (!ok) return
    const id = `${task.path}|${task.name}`
    setBusy(id)
    try {
      const res = await api.taskAction(task.path, task.name, action)
      if (!res.ok) {
        const denied = /access|denied|erişim/i.test(res.error ?? '')
        pushToast({ kind: 'error', title: t('err.generic'), message: denied ? t('err.accessDenied') : res.error })
      }
    } finally {
      setBusy(null)
      setTimeout(() => void load(userOnly), 1200)
    }
  }

  return (
    <div className="flex h-full flex-col p-4">
      <PageHeader
        title={t('tasks.title')}
        subtitle={tasks ? t('tasks.count', { n: formatNumber(rows.length, 'tr') }) : undefined}
        actions={
          <>
            <label className="flex items-center gap-2 text-[12px] text-ink-2">
              <Toggle checked={userOnly} onChange={setUserOnly} label={t('tasks.userOnly')} />
            </label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('tasks.search')}
                className="h-8 w-[200px] rounded-md border border-line bg-surface-2 pl-8 pr-2 text-[12px] text-ink outline-none placeholder:text-ink-3 focus:border-accent"
              />
            </div>
            <button
              type="button"
              onClick={() => void load(userOnly)}
              title={t('common.refresh')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface-2 text-ink-2 hover:text-ink"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </>
        }
      />

      <Card className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
        {!tasks && loading ? (
          <Spinner label={t('common.loading')} />
        ) : rows.length === 0 ? (
          <EmptyState message={t('tasks.empty')} />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {rows.map((task) => {
              const id = `${task.path}|${task.name}`
              const disabled = task.state === 'Disabled'
              return (
                <div
                  key={id}
                  className="flex items-center gap-3 border-b border-line-soft px-3 py-1.5 last:border-b-0 hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium text-ink" title={task.action ?? undefined}>
                      {task.name}
                    </div>
                    <div className="truncate text-[11px] text-ink-3" title={`${task.path} — ${task.action ?? ''}`}>
                      {task.path}
                    </div>
                  </div>
                  <div className="w-[90px] shrink-0">
                    <Badge tone={stateTone(task.state)}>{t(`tasks.state.${task.state}` as never)}</Badge>
                  </div>
                  <div className="tnum w-[130px] shrink-0 text-right text-[11.5px] text-ink-3">
                    {task.nextRun ? formatDateTime(task.nextRun, 'tr') : t('tasks.never')}
                  </div>
                  <div className="tnum w-[130px] shrink-0 text-right text-[11.5px] text-ink-3">
                    {task.lastRun ? formatDateTime(task.lastRun, 'tr') : t('tasks.never')}
                  </div>
                  <div className="tnum w-[64px] shrink-0 text-right text-[11.5px] text-ink-3">
                    {task.lastResult ?? '—'}
                  </div>
                  <div className="flex w-[96px] shrink-0 items-center justify-end gap-1">
                    {busy === id ? (
                      <Spinner />
                    ) : (
                      <>
                        <ActBtn title={t('tasks.run')} onClick={() => void runAction(task, 'run')}>
                          <Play size={11} />
                        </ActBtn>
                        <ActBtn title={t('tasks.stop')} disabled={task.state !== 'Running'} onClick={() => void runAction(task, 'stop')}>
                          <Square size={10} />
                        </ActBtn>
                        <ActBtn
                          title={disabled ? t('tasks.enable') : t('tasks.disable')}
                          onClick={() => void runAction(task, disabled ? 'enable' : 'disable')}
                        >
                          <PowerIcon size={11} />
                        </ActBtn>
                      </>
                    )}
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

function ActBtn({
  title,
  disabled,
  onClick,
  children
}: {
  title: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-6 w-6 items-center justify-center rounded border border-line bg-surface-2 text-ink-2 transition-colors hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  )
}
