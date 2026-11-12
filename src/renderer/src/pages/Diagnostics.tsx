import { useState } from 'react'
import { Copy, Play } from 'lucide-react'
import { useT } from '@/i18n'
import { api } from '@/lib/ipc'
import { Badge, Card, EmptyState, PageHeader, Spinner } from '@/components/ui'
import type { DiagnosticCheck, DiagnosticSeverity } from '@shared/types'
import { useUiStore } from '@/stores/ui'

function severityTone(s: DiagnosticSeverity): 'ok' | 'neutral' | 'warn' | 'danger' {
  if (s === 'ok') return 'ok'
  if (s === 'info') return 'neutral'
  if (s === 'warn') return 'warn'
  return 'danger'
}

export function DiagnosticsPage() {
  const t = useT()
  const pushToast = useUiStore((s) => s.pushToast)
  const [checks, setChecks] = useState<DiagnosticCheck[] | null>(null)
  const [running, setRunning] = useState(false)

  const run = async (): Promise<void> => {
    setRunning(true)
    try {
      setChecks(await api.runDiagnostics())
    } catch {
      setChecks([])
    } finally {
      setRunning(false)
    }
  }

  const copyReport = async (): Promise<void> => {
    if (!checks) return
    const text = checks
      .map((c) => {
        let msg = t(`diag.id.${c.id}` as never, c.params as never)
        return `[${c.severity.toUpperCase()}] ${msg}`
      })
      .join('\n')
    try {
      await api.writeClipboard(text)
      pushToast({ kind: 'success', title: t('sysinfo.copied') })
    } catch {
      pushToast({ kind: 'error', title: t('common.copyFailed') })
    }
  }

  const worst = checks?.reduce<DiagnosticSeverity | null>((acc, c) => {
    if (c.severity === 'fail' || acc === 'fail') return 'fail'
    if (c.severity === 'warn' || acc === 'warn') return 'warn'
    return acc ?? c.severity
  }, null)

  return (
    <div className="flex h-full flex-col p-4">
      <PageHeader
        title={t('diag.title')}
        subtitle={t('diag.hint')}
        actions={
          <>
            {checks && checks.length > 0 ? (
              <button
                type="button"
                onClick={() => void copyReport()}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-3 text-[12px] text-ink-2 hover:text-ink"
              >
                <Copy size={12} />
                {t('diag.copyReport')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void run()}
              disabled={running}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {running ? <Spinner /> : <Play size={13} />}
              {running ? t('diag.running') : t('diag.run')}
            </button>
          </>
        }
      />

      <Card className="mt-3 min-h-0 flex-1 overflow-y-auto p-3">
        {!checks ? (
          running ? (
            <Spinner label={t('diag.running')} />
          ) : (
            <EmptyState message={t('diag.hint')} />
          )
        ) : checks.length === 0 ? (
          <EmptyState message={t('common.error')} />
        ) : (
          <div className="space-y-1.5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{t('diag.checks')}</span>
              {worst ? <Badge tone={severityTone(worst)}>{t(`diag.sev.${worst}` as never)}</Badge> : null}
            </div>
            {checks.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md border border-line-soft bg-surface-2 px-3 py-2"
              >
                <Badge tone={severityTone(c.severity)}>{t(`diag.sev.${c.severity}` as never)}</Badge>
                <span className="text-[12.5px] text-ink">
                  {t(`diag.id.${c.id}` as never, c.params as never)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
