import { useEffect } from 'react'
import { Copy, RefreshCw } from 'lucide-react'
import { useT } from '@/i18n'
import { useStaticStore } from '@/stores/static'
import { useUiStore } from '@/stores/ui'
import { api } from '@/lib/ipc'
import { Badge, Card, KeyValue, PageHeader, Spinner } from '@/components/ui'
import { formatBytes, formatClock, formatDateTime, formatNumber } from '@shared/format'

export function SystemInfoPage() {
  const t = useT()
  const info = useStaticStore((s) => s.info)
  const loading = useStaticStore((s) => s.loading)
  const error = useStaticStore((s) => s.error)
  const load = useStaticStore((s) => s.load)
  const pushToast = useUiStore((s) => s.pushToast)

  useEffect(() => {
    void load(true)
  }, [load])

  const copyJson = async (): Promise<void> => {
    if (!info) return
    try {
      await api.writeClipboard(JSON.stringify(info, null, 2))
      pushToast({ kind: 'success', title: t('sysinfo.copied') })
    } catch {
      pushToast({ kind: 'error', title: t('common.copyFailed') })
    }
  }

  if (loading && !info) return <div className="p-4"><Spinner label={t('common.loading')} /></div>
  if (error && !info) return <div className="p-4"><Card className="p-3 text-[12px] text-danger">{t('common.error')}: {error}</Card></div>
  if (!info) return null

  return (
    <div className="space-y-3 p-4">
      <PageHeader
        title={t('sysinfo.title')}
        subtitle={info.os.caption ?? undefined}
        actions={
          <>
            <button
              type="button"
              onClick={() => void load(true)}
              title={t('sysinfo.refresh')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface-2 text-ink-2 hover:text-ink"
            >
              <RefreshCw size={13} />
            </button>
            <button
              type="button"
              onClick={() => void copyJson()}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-3 text-[12px] text-ink-2 hover:text-ink"
            >
              <Copy size={12} />
              {t('sysinfo.copyJson')}
            </button>
          </>
        }
      />

      <div className="grid max-w-[1000px] grid-cols-2 gap-3">
        <Card className="p-4">
          <SectionTitle>{t('sysinfo.osSection')}</SectionTitle>
          <KeyValue label={t('sysinfo.osSection')}>{info.os.caption ?? '—'}</KeyValue>
          <KeyValue label={t('sysinfo.arch')}>{info.os.arch ?? '—'}</KeyValue>
          <KeyValue label={t('sysinfo.build')}>{info.os.version ?? '—'} ({info.os.build ?? '—'})</KeyValue>
          <KeyValue label={t('sysinfo.installed')}>{formatDateTime(info.os.installDate, 'tr')}</KeyValue>
          <KeyValue label={t('sysinfo.lastBoot')}>{formatDateTime(info.os.lastBoot, 'tr')}</KeyValue>
          <KeyValue label={t('system.hostname')}>{info.os.hostname ?? '—'}</KeyValue>
        </Card>

        <Card className="p-4">
          <SectionTitle>{t('sysinfo.computerSection')}</SectionTitle>
          <KeyValue label={t('sysinfo.manufacturer')}>{info.computer.manufacturer ?? '—'}</KeyValue>
          <KeyValue label={t('sysinfo.model')}>{info.computer.model ?? '—'}</KeyValue>
          <KeyValue label={t('sysinfo.type')}>{info.computer.pcType ?? '—'}</KeyValue>
          <KeyValue label={t('settings.elevated')}>
            {info.isElevated ? (
              <Badge tone="ok">{t('settings.elevatedYes')}</Badge>
            ) : (
              <Badge tone="warn">{t('settings.elevatedNo')}</Badge>
            )}
          </KeyValue>
        </Card>

        <Card className="p-4">
          <SectionTitle>{t('sysinfo.cpuSection')}</SectionTitle>
          <KeyValue label={t('system.cpu')}>{info.cpu.name ?? '—'}</KeyValue>
          <KeyValue label={t('sysinfo.cores')}>{formatNumber(info.cpu.cores, 'tr')}</KeyValue>
          <KeyValue label={t('sysinfo.logical')}>{formatNumber(info.cpu.logical, 'tr')}</KeyValue>
          <KeyValue label={t('sysinfo.baseClock')}>{formatClock(info.cpu.baseClockMhz)}</KeyValue>
          <KeyValue label={t('sysinfo.cache')}>
            {info.cpu.l2MB != null ? `${Math.round(info.cpu.l2MB)} MB` : '—'} /{' '}
            {info.cpu.l3MB != null ? `${Math.round(info.cpu.l3MB)} MB` : '—'}
          </KeyValue>
        </Card>

        <Card className="p-4">
          <SectionTitle>{t('sysinfo.ramSection')}</SectionTitle>
          <KeyValue label={t('sysinfo.capacity')}>{formatBytes(info.memory.totalBytes, 'tr', 0)}</KeyValue>
          <KeyValue label={t('sysinfo.modules')}>{info.memory.modules.length}</KeyValue>
          {info.memory.modules.length > 0 ? (
            <div className="mt-2 overflow-hidden rounded-md border border-line-soft">
              <table className="w-full text-[11px]">
                <thead className="bg-surface-2 text-ink-3">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">{t('sysinfo.slot')}</th>
                    <th className="px-2 py-1 text-right font-medium">{t('sysinfo.capacity')}</th>
                    <th className="px-2 py-1 text-right font-medium">{t('sysinfo.speed')}</th>
                    <th className="px-2 py-1 text-left font-medium">{t('sysinfo.manufacturer')}</th>
                  </tr>
                </thead>
                <tbody>
                  {info.memory.modules.map((m, i) => (
                    <tr key={i} className="border-t border-line-soft text-ink-2">
                      <td className="px-2 py-1">{m.slot}</td>
                      <td className="tnum px-2 py-1 text-right">{formatBytes(m.capacityBytes, 'tr', 0)}</td>
                      <td className="tnum px-2 py-1 text-right">
                        {m.configuredSpeedMhz ?? m.speedMhz ?? '—'} MHz
                      </td>
                      <td className="truncate px-2 py-1">{m.manufacturer ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>

        <Card className="p-4">
          <SectionTitle>{t('sysinfo.boardSection')}</SectionTitle>
          <KeyValue label={t('sysinfo.manufacturer')}>{info.motherboard.manufacturer ?? '—'}</KeyValue>
          <KeyValue label={t('sysinfo.model')}>{info.motherboard.product ?? '—'}</KeyValue>
          <KeyValue label="BIOS">{info.bios.vendor ?? '—'}</KeyValue>
          <KeyValue label={t('sysinfo.firmware')}>{info.bios.version ?? '—'}</KeyValue>
          <KeyValue label={t('sysinfo.installed')}>{formatDateTime(info.bios.releaseDate, 'tr')}</KeyValue>
        </Card>

        <Card className="p-4">
          <SectionTitle>{t('sysinfo.gpuSection')}</SectionTitle>
          {info.gpus.length === 0 ? (
            <div className="text-[12px] text-ink-3">—</div>
          ) : (
            info.gpus.map((g, i) => (
              <div key={i} className="mb-2 border-b border-line-soft pb-2 last:mb-0 last:border-b-0 last:pb-0">
                <div className="truncate text-[12.5px] font-medium text-ink" title={g.name}>{g.name}</div>
                <KeyValue label={t('sysinfo.vram')}>{g.vramBytes != null ? formatBytes(g.vramBytes, 'tr', 0) : '—'}</KeyValue>
                <KeyValue label={t('sysinfo.driver')}>{g.driverVersion ?? '—'} ({formatDateTime(g.driverDate, 'tr')})</KeyValue>
                <KeyValue label={t('sysinfo.mode')}>{g.videoMode ?? '—'}</KeyValue>
                <KeyValue label={t('sysinfo.health')}>
                  <Badge tone={g.status?.toLowerCase() === 'ok' ? 'ok' : 'warn'}>{g.status ?? '—'}</Badge>
                </KeyValue>
              </div>
            ))
          )}
        </Card>

        <Card className="p-4">
          <SectionTitle>{t('sysinfo.storageSection')}</SectionTitle>
          {info.storage.map((s, i) => (
            <div key={i} className="mb-2 border-b border-line-soft pb-2 last:mb-0 last:border-b-0 last:pb-0">
              <div className="truncate text-[12.5px] font-medium text-ink" title={s.model}>{s.model}</div>
              <KeyValue label={t('sysinfo.capacity')}>{s.sizeBytes != null ? formatBytes(s.sizeBytes, 'tr', 0) : '—'}</KeyValue>
              <KeyValue label={t('sysinfo.busType')}>{s.busType ?? '—'} · {s.mediaType ?? '—'}</KeyValue>
              <KeyValue label={t('sysinfo.health')}>
                {s.healthStatus ? (
                  <Badge tone={s.healthStatus.toLowerCase() === 'healthy' ? 'ok' : 'warn'}>{s.healthStatus}</Badge>
                ) : (
                  '—'
                )}
              </KeyValue>
              <KeyValue label={t('sysinfo.firmware')}>{s.firmware ?? '—'}</KeyValue>
            </div>
          ))}
        </Card>

        <Card className="p-4">
          <SectionTitle>{t('sysinfo.netSection')}</SectionTitle>
          {info.adapters.length === 0 ? (
            <div className="text-[12px] text-ink-3">—</div>
          ) : (
            info.adapters.map((a, i) => (
              <div key={i} className="mb-2 border-b border-line-soft pb-2 last:mb-0 last:border-b-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[12.5px] font-medium text-ink">{a.name}</span>
                  <Badge tone={a.status?.toLowerCase() === 'up' ? 'ok' : 'neutral'}>{a.status ?? '—'}</Badge>
                </div>
                <div className="truncate text-[11px] text-ink-3" title={a.description ?? ''}>{a.description ?? '—'}</div>
                <KeyValue label={t('sysinfo.mac')}>{a.mac ?? '—'}</KeyValue>
                <KeyValue label={t('sysinfo.linkSpeed')}>{a.linkSpeed ?? '—'}</KeyValue>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">{children}</div>
  )
}
