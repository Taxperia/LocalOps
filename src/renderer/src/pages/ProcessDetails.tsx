import { useEffect, useState } from 'react'
import { useT } from '@/i18n'
import { useProcessesStore } from '@/stores/processes'
import { useUiStore } from '@/stores/ui'
import { api } from '@/lib/ipc'
import { Badge, CloseButton, KeyValue, Spinner } from '@/components/ui'
import { formatBytes, formatDateTime, formatPercent } from '@shared/format'
import type { ProcessDetails } from '@shared/types'

export function ProcessDetailsPanel() {
  const t = useT()
  const selectedPid = useProcessesStore((s) => s.selectedPid)
  const setSelected = useProcessesStore((s) => s.setSelected)
  const processes = useProcessesStore((s) => s.processes)
  const pushToast = useUiStore((s) => s.pushToast)
  const askConfirm = useUiStore((s) => s.askConfirm)
  const [details, setDetails] = useState<ProcessDetails | null>(null)
  const [loading, setLoading] = useState(false)

  const selected = processes.find((p) => p.pid === selectedPid) ?? null

  useEffect(() => {
    setDetails(null)
    if (selectedPid == null) return
    let alive = true
    setLoading(true)
    api
      .getProcessDetails(selectedPid)
      .then((d) => {
        if (alive) setDetails(d)
      })
      .catch(() => {
        if (alive) setDetails(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [selectedPid])

  if (selectedPid == null) return null

  const live = selected ?? details?.info

  const killSelected = async (): Promise<void> => {
    if (!live) return
    const ok = await askConfirm({
      title: t('proc.killConfirmTitle'),
      message: t('proc.killConfirmMsg', { name: live.name, pid: live.pid }),
      confirmLabel: t('proc.kill'),
      danger: true
    })
    if (!ok) return
    const res = await api.killProcess(live.pid, true)
    if (res.ok) {
      pushToast({ kind: 'success', title: t('proc.killed', { name: live.name }) })
      setSelected(null)
    } else {
      const denied = /access|denied|erişim/i.test(res.error ?? '')
      pushToast({ kind: 'error', title: t('err.killFailed'), message: denied ? t('err.accessDenied') : res.error })
    }
  }

  return (
    <aside aria-label={t('proc.details')} className="anim-fade h-full w-[320px] shrink-0 overflow-y-auto border-l border-line-soft bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-[13.5px] font-semibold text-ink" title={live?.name}>
            {live?.name ?? '—'}
          </h2>
          <div className="tnum mt-0.5 text-[11.5px] text-ink-3">PID {live?.pid ?? '—'}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void killSelected()}
            className="rounded-md border border-danger/40 px-2.5 py-1 text-[11.5px] text-danger transition-colors hover:bg-danger hover:text-white"
          >
            {t('proc.kill')}
          </button>
          <CloseButton onClick={() => setSelected(null)} />
        </div>
      </div>

      {loading && !details ? (
        <Spinner label={t('proc.loadingDetails')} />
      ) : (
        <div className="mt-3 space-y-3">
          <div className="tnum grid grid-cols-3 gap-2">
            <Stat label="CPU" value={formatPercent(live?.cpuPercent, 'tr', 1)} />
            <Stat label={t('proc.col.memory')} value={formatBytes(live?.memoryBytes, 'tr', 0)} />
            <Stat label={t('proc.col.private')} value={formatBytes(live?.privateBytes, 'tr', 0)} />
          </div>

          <Section title={t('proc.details')}>
            <KeyValue label={t('proc.path')}>
              {live?.path ? (
                <span className="break-all" title={live.path}>
                  {live.path}
                </span>
              ) : (
                <span className="text-ink-3">{t('proc.pathUnavailable')}</span>
              )}
            </KeyValue>
            {live?.commandLine ? <KeyValue label={t('proc.cmdline')}>{live.commandLine}</KeyValue> : null}
            <KeyValue label={t('proc.started')}>{live?.startedAt ? formatDateTime(live.startedAt, 'tr') : '—'}</KeyValue>
            {live?.userName ? <KeyValue label={t('proc.col.user')}>{live.userName}</KeyValue> : null}
            <KeyValue label={t('proc.parent')}>
              {details?.parentName ? `${details.parentName} (${live?.ppid})` : live?.ppid ?? '—'}
            </KeyValue>
            {details?.children && details.children.length > 0 ? (
              <KeyValue label={t('proc.children')}>
                <span className="flex flex-wrap justify-end gap-1">
                  {details.children.slice(0, 8).map((c) => (
                    <button
                      key={c.pid}
                      type="button"
                      onClick={() => useProcessesStore.getState().setSelected(c.pid)}
                      className="rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-ink-2 hover:text-ink"
                    >
                      {c.name}
                    </button>
                  ))}
                  {details.children.length > 8 ? <span className="text-ink-3">+{details.children.length - 8}</span> : null}
                </span>
              </KeyValue>
            ) : null}
          </Section>

          {details?.fileInfo ? (
            <Section title={t('proc.company')}>
              <KeyValue label={t('proc.company')}>{details.fileInfo.company ?? '—'}</KeyValue>
              <KeyValue label={t('proc.description')}>{details.fileInfo.description ?? '—'}</KeyValue>
              <KeyValue label={t('proc.fileVersion')}>{details.fileInfo.fileVersion ?? '—'}</KeyValue>
              <KeyValue label={t('proc.product')}>{details.fileInfo.productName ?? '—'}</KeyValue>
              <KeyValue label={t('proc.fileSize')}>{formatBytes(details.fileInfo.fileSizeBytes)}</KeyValue>
              <KeyValue label={t('proc.modified')}>
                {formatDateTime(details.fileInfo.modifiedAt, 'tr')}
              </KeyValue>
            </Section>
          ) : null}

          <Section title={t('proc.signature')}>
            {details?.signature ? (
              <div className="space-y-1.5">
                <div>
                  {details.signature.status.toLowerCase() === 'valid' ? (
                    <Badge tone="ok">{t('proc.sigValid')}</Badge>
                  ) : details.signature.status.toLowerCase() === 'notsigned' ? (
                    <Badge tone="neutral">{t('proc.sigNotSigned')}</Badge>
                  ) : (
                    <Badge tone="warn">{t('proc.sigBad')}</Badge>
                  )}
                </div>
                {details.signature.signer ? (
                  <div className="break-all text-[11px] text-ink-3">
                    {t('proc.signer')}: {details.signature.signer}
                  </div>
                ) : null}
              </div>
            ) : live?.path ? (
              <div className="text-[11.5px] text-ink-3">{t('common.unavailable')}</div>
            ) : (
              <div className="text-[11.5px] text-ink-3">{t('proc.pathUnavailable')}</div>
            )}
          </Section>
        </div>
      )}
    </aside>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line-soft bg-surface-2 p-2 text-center">
      <div className="tnum truncate text-[13px] font-semibold text-ink" title={value}>
        {value}
      </div>
      <div className="mt-0.5 truncate text-[10.5px] text-ink-3">{label}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-3">{title}</div>
      <div className="rounded-md border border-line-soft bg-surface-2 px-2.5 py-1.5">{children}</div>
    </div>
  )
}
