import { useEffect, useMemo, useRef, useState } from 'react'
import { FolderSearch, Play, X } from 'lucide-react'
import { useT } from '@/i18n'
import { api } from '@/lib/ipc'
import { Badge, Card, EmptyState, PageHeader, Spinner } from '@/components/ui'
import { UsageBar } from '@/components/charts'
import { formatBytes, formatNumber, formatRate } from '@shared/format'
import type { DiskScanEvent, DiskScanResult } from '@shared/types'

export function StoragePage() {
  const t = useT()
  const [path, setPath] = useState('C:\\')
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<{ files: number; bytes: number; skipped: number } | null>(null)
  const [result, setResult] = useState<DiskScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    const un = api.onDiskScanEvent((ev: DiskScanEvent) => {
      if (ev.kind === 'started') {
        setScanning(true)
        setProgress({ files: 0, bytes: 0, skipped: 0 })
        setError(null)
      } else if (ev.kind === 'progress') {
        setProgress({ files: ev.files ?? 0, bytes: ev.bytes ?? 0, skipped: ev.skipped ?? 0 })
      } else if (ev.kind === 'done') {
        setScanning(false)
        if (ev.result) setResult(ev.result)
      } else if (ev.kind === 'cancelled') {
        setScanning(false)
      } else if (ev.kind === 'error') {
        setScanning(false)
        setError(ev.error ?? 'error')
      }
    })
    return un
  }, [])

  const start = async (target?: string): Promise<void> => {
    const p = target ?? path
    setError(null)
    if (scanning) return
    const res = await api.startDiskScan(p)
    if (!res.ok) {
      if (res.error === 'scan already running') pushBusyOnce()
      else setError(res.error ?? 'error')
    }
  }

  const pushBusyOnce = (): void => setError('busy')

  const drill = async (childPath: string): Promise<void> => {
    setPath(childPath)
    const cached = await api.getDiskScanResult(childPath)
    if (cached) {
      setResult(cached)
      return
    }
    await start(childPath)
  }

  const maxChild = useMemo(() => Math.max(1, ...(result?.children.map((c) => c.size) ?? [1])), [result])

  const crumbs = useMemo(() => {
    const parts = path.split('\\').filter((p) => p.length > 0)
    const acc: string[] = []
    return parts.map((p, i) => {
      acc.push(p)
      const joined = i === 0 ? `${p}\\` : acc.join('\\')
      return { label: p, path: joined }
    })
  }, [path])

  return (
    <div className="flex h-full flex-col p-4">
      <PageHeader title={t('storage.title')} subtitle={t('storage.hint')} />

      <div className="mt-3 flex items-center gap-2">
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          spellCheck={false}
          className="h-8 flex-1 rounded-md border border-line bg-surface-2 px-3 text-[12.5px] text-ink outline-none focus:border-accent"
          placeholder="C:\"
        />
        {scanning ? (
          <button
            type="button"
            onClick={() => void api.cancelDiskScan()}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-danger/40 px-3 text-[12px] text-danger hover:bg-danger hover:text-white"
          >
            <X size={13} />
            {t('storage.cancel')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void start()}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[12px] font-medium text-white hover:opacity-90"
          >
            <Play size={13} />
            {t('storage.scan')}
          </button>
        )}
      </div>

      {scanning ? (
        <Card className="mt-3 p-3">
          <div className="flex items-center gap-3">
            <Spinner />
            <div className="flex-1">
              <div className="tnum flex justify-between text-[12px]">
                <span className="text-ink-2">{t('storage.scanning')} {path}</span>
                <span className="text-ink-3">
                  {progress ? t('storage.filesScanned', { n: formatNumber(progress.files, 'tr') }) : ''}
                  {progress ? ` · ${formatRate(progress.bytes, 'tr', 0)} → ${formatBytes(progress.bytes)}` : ''}
                </span>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {error ? (
        <Card className="mt-3 border-danger/40 p-2.5 text-[12px] text-danger">
          {error === 'busy'
            ? t('storage.busy')
            : error === 'path not found' || error === 'invalid path'
              ? `${t('common.error')}: ${path}`
              : `${t('common.error')}: ${error}`}
        </Card>
      ) : null}

      {result && !scanning ? (
        <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto">
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <FolderSearch size={14} className="text-accent" />
            {crumbs.map((c, i) => (
              <span key={c.path} className="flex items-center gap-2">
                {i > 0 ? <span className="text-ink-3">\</span> : null}
                <button
                  type="button"
                  onClick={() => void drill(c.path)}
                  className={`rounded px-1 hover:bg-surface-2 ${i === crumbs.length - 1 ? 'font-medium text-ink' : 'text-ink-2'}`}
                >
                  {c.label}
                </button>
              </span>
            ))}
            <span className="ml-auto flex items-center gap-2">
              <Badge tone="neutral">{t('storage.total')}: {formatBytes(result.totalBytes)}</Badge>
              <Badge tone="neutral">{t('storage.filesScanned', { n: formatNumber(result.totalFiles, 'tr') })}</Badge>
              {result.skipped > 0 ? <Badge tone="warn">{t('storage.skipped', { n: formatNumber(result.skipped, 'tr') })}</Badge> : null}
              <Badge tone="neutral">{t('storage.elapsed', { n: result.elapsedSec })}</Badge>
            </span>
          </div>

          <Card className="p-3">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">{t('storage.children')}</div>
            {result.children.length === 0 ? (
              <EmptyState message={t('storage.empty')} />
            ) : (
              <div className="space-y-1.5">
                {result.children.slice(0, 40).map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => void drill(joinPath(result.path, c.name))}
                    className="block w-full text-left"
                  >
                    <div className="mb-0.5 flex items-baseline justify-between gap-3">
                      <span className="truncate text-[12px] text-ink-2">{c.name}</span>
                      <span className="tnum shrink-0 text-[11.5px] text-ink">
                        {formatBytes(c.size)} · {formatNumber(c.files, 'tr')}
                      </span>
                    </div>
                    <UsageBar percent={(c.size / maxChild) * 100} />
                  </button>
                ))}
              </div>
            )}
          </Card>

          {result.direct.length > 0 ? (
            <Card className="p-3">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">{t('storage.directFiles')}</div>
              <div className="space-y-1">
                {result.direct.map((f) => (
                  <div key={f.path} className="flex items-center justify-between gap-3 text-[11.5px]">
                    <span className="truncate text-ink-2" title={f.path}>{fileName(f.path)}</span>
                    <span className="tnum shrink-0 text-ink">{formatBytes(f.size)}</span>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Card className="p-3">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">{t('storage.largest')}</div>
            <div className="space-y-1">
              {result.largest.map((f) => (
                <div key={f.path} className="flex items-center justify-between gap-3 text-[11.5px]">
                  <span className="truncate text-ink-2" title={f.path}>{f.path}</span>
                  <span className="tnum shrink-0 text-ink">{formatBytes(f.size)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}

function joinPath(base: string, name: string): string {
  return base.endsWith('\\') ? `${base}${name}` : `${base}\\${name}`
}

function fileName(p: string): string {
  const idx = p.lastIndexOf('\\')
  return idx >= 0 ? p.slice(idx + 1) : p
}
