import { useEffect, useState } from 'react'
import { Play, Trash2 } from 'lucide-react'
import { useT } from '@/i18n'
import { api } from '@/lib/ipc'
import { Badge, Card, PageHeader, Segmented, Spinner } from '@/components/ui'
import { formatBytes, formatNumber } from '@shared/format'
import type { CleanupScanResult, CleanupTargetId } from '@shared/types'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'

const TARGETS: CleanupTargetId[] = ['usertemp', 'wintemp', 'wudownload', 'thumbs']

type RetentionChoice = '0' | '24' | '168' | '720'

export function CleanupPage() {
  const t = useT()
  const locale = useSettingsStore((s) => s.settings.locale)
  const retentionSetting = useSettingsStore((s) => s.settings.cleanupRetentionHours)
  const update = useSettingsStore((s) => s.update)
  const pushToast = useUiStore((s) => s.pushToast)
  const askConfirm = useUiStore((s) => s.askConfirm)
  const [scans, setScans] = useState<Partial<Record<CleanupTargetId, CleanupScanResult | null>>>({})
  const [busy, setBusy] = useState<CleanupTargetId | 'all' | null>(null)
  const [retention, setRetention] = useState<RetentionChoice>(String(retentionSetting) as RetentionChoice)

  useEffect(() => {
    setRetention(String(retentionSetting) as RetentionChoice)
  }, [retentionSetting])

  const cutoffMs = (): number => {
    const hours = Number(retention)
    return Date.now() - hours * 3600_000
  }

  const retentionText = (): string => {
    const hours = Number(retention)
    if (hours === 0) return t('cleanup.retention.now')
    if (hours >= 24) return t('cleanup.retention.days', { n: hours / 24 })
    return t('cleanup.retention.hours', { n: hours })
  }

  const scan = async (target: CleanupTargetId): Promise<void> => {
    setBusy(target)
    try {
      const res = await api.scanCleanupTarget(target)
      setScans((s) => ({ ...s, [target]: res }))
    } finally {
      setBusy(null)
    }
  }

  const scanAll = async (): Promise<void> => {
    setBusy('all')
    try {
      for (const target of TARGETS) {
        const res = await api.scanCleanupTarget(target)
        setScans((s) => ({ ...s, [target]: res }))
      }
    } finally {
      setBusy(null)
    }
  }

  const clean = async (target: CleanupTargetId): Promise<void> => {
    const scanRes = scans[target]
    const sizeText = scanRes ? formatBytes(scanRes.bytes) : '?'
    const ok = await askConfirm({
      title: t('cleanup.confirmTitle'),
      message: t('cleanup.confirmMsg', {
        target: t(`cleanup.target.${target}` as never),
        rule: retentionText().toLowerCase(),
        size: sizeText
      }),
      confirmLabel: t('cleanup.clean'),
      danger: true
    })
    if (!ok) return
    setBusy(target)
    try {
      const res = await api.cleanCleanupTarget(target, cutoffMs())
      if (res) {
        if (res.removedFiles > 0) {
          pushToast({
            kind: 'success',
            title: t('cleanup.freed', { size: formatBytes(res.removedBytes), n: formatNumber(res.removedFiles, 'tr') }),
            message: res.failed > 0 ? t('cleanup.failed', { n: formatNumber(res.failed, 'tr') }) : undefined
          })
        } else {
          pushToast({ kind: 'info', title: t('cleanup.nothing') })
        }
      }
    } finally {
      setBusy(null)
      setTimeout(() => void scan(target), 500)
    }
  }

  const setRetentionAndSave = (v: RetentionChoice): void => {
    setRetention(v)
    void update({ cleanupRetentionHours: Number(v) })
  }

  return (
    <div className="flex h-full flex-col p-4">
      <PageHeader
        title={t('cleanup.title')}
        subtitle={t('cleanup.hint')}
        actions={
          <>
            <Segmented<RetentionChoice>
              value={retention}
              onChange={setRetentionAndSave}
              options={[
                { value: '0', label: t('cleanup.retention.now') },
                { value: '24', label: t('cleanup.retention.days', { n: 1 }) },
                { value: '168', label: t('cleanup.retention.days', { n: 7 }) },
                { value: '720', label: t('cleanup.retention.days', { n: 30 }) }
              ]}
            />
            <button
              type="button"
              onClick={() => void scanAll()}
              disabled={busy != null}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy === 'all' ? <Spinner /> : <Play size={13} />}
              {t('cleanup.scanAll')}
            </button>
          </>
        }
      />

      <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {TARGETS.map((target) => {
          const res = scans[target]
          return (
            <Card key={target} className="p-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-medium text-ink">{t(`cleanup.target.${target}` as never)}</span>
                    {res ? (
                      <Badge tone={res.bytes > 0 ? 'warn' : 'ok'}>
                        {formatBytes(res.bytes)} · {t('cleanup.files', { n: formatNumber(res.files, 'tr') })}
                      </Badge>
                    ) : null}
                  </div>
                  {res && res.top.length > 0 ? (
                    <div className="mt-1 space-y-0.5">
                      {res.top.slice(0, 3).map((f) => (
                        <div key={f.path} className="flex items-center justify-between gap-3 text-[11px] text-ink-3">
                          <span className="truncate" title={f.path}>{f.path}</span>
                          <span className="tnum shrink-0">{formatBytes(f.size)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void scan(target)}
                    disabled={busy != null}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 text-[11.5px] text-ink-2 hover:text-ink disabled:opacity-40"
                  >
                    {busy === target ? <Spinner /> : <Play size={12} />}
                    {t('cleanup.analyze')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void clean(target)}
                    disabled={busy != null || !res || res.files === 0}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-danger/40 px-2.5 text-[11.5px] text-danger hover:bg-danger hover:text-white disabled:opacity-30"
                  >
                    <Trash2 size={12} />
                    {t('cleanup.clean')}
                  </button>
                </div>
              </div>
            </Card>
          )
        })}
        <p className="text-[11.5px] text-ink-3">
          {t('reports.hint')} · {locale === 'tr' ? 'Saklama tercihi ayarlarda saklanır.' : 'Retention preference is stored in settings.'}
        </p>
      </div>
    </div>
  )
}
