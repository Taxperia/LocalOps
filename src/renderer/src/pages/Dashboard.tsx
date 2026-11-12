import { useMemo, useRef, useState } from 'react'
import {
  BatteryCharging,
  BatteryMedium,
  Cpu,
  Eye,
  EyeOff,
  GripVertical,
  HardDrive,
  MemoryStick,
  MonitorSmartphone,
  Network,
  RotateCcw,
  Timer,
  Tv
} from 'lucide-react'
import { useT } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'
import { useMetricsStore } from '@/stores/metrics'
import { useStaticStore } from '@/stores/static'
import { CoreBars, LiveAreaChart, UsageBar, type ChartPoint } from '@/components/charts'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { formatBytes, formatDuration, formatPercent, formatRate } from '@shared/format'
import { cloneSettings, DEFAULT_SETTINGS, type WidgetId } from '@shared/settingsSchema'
import type { MetricsSnapshot } from '@shared/types'
import type { TKey } from '@/i18n'

function useCpuTrend(): ChartPoint[] {
  const trend = useMetricsStore((s) => s.trend)
  return useMemo(() => trend.map((p) => ({ ts: p.ts, value: p.cpu })), [trend])
}

function WidgetShell({
  title,
  icon,
  span,
  editing,
  hidden,
  onToggle,
  dragProps,
  children
}: {
  title: string
  icon: React.ReactNode
  span: number
  editing: boolean
  hidden?: boolean
  onToggle?: () => void
  dragProps?: React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean }
  children: React.ReactNode
}) {
  return (
    <div
      {...dragProps}
      style={{ gridColumn: `span ${span} / span ${span}` }}
      className={`group/card rounded-lg border border-line-soft bg-surface p-3 transition-opacity ${
        editing ? 'cursor-grab active:cursor-grabbing' : ''
      } ${hidden ? 'opacity-40' : ''}`}
    >
      <div className="mb-2 flex items-center gap-2">
        {editing ? <GripVertical size={13} className="text-ink-3" /> : icon}
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-2">{title}</span>
        {editing && onToggle ? (
          <button type="button" onClick={onToggle} className="ml-auto text-ink-3 hover:text-ink" title={hidden ? 'Göster' : 'Gizle'}>
            {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function CpuWidget({ snap }: { snap: MetricsSnapshot }) {
  const t = useT()
  const data = useCpuTrend()
  return (
    <>
      <div className="flex items-end justify-between">
        <span className="tnum text-[26px] font-semibold leading-none text-ink">{formatPercent(snap.cpu.usage, 'tr', 1)}</span>
        <span className="text-[11px] text-ink-3">{t('cpu.perCore')}: {snap.cpu.perCore.length}</span>
      </div>
      <LiveAreaChart data={data} percent height={70} />
      <CoreBars values={snap.cpu.perCore} />
    </>
  )
}

function MemoryWidget({ snap }: { snap: MetricsSnapshot }) {
  const t = useT()
  const m = snap.memory
  const trend = useMetricsStore((s) => s.trend)
  const data = useMemo<ChartPoint[]>(() => trend.map((p) => ({ ts: p.ts, value: p.mem })), [trend])
  return (
    <>
      <div className="flex items-end justify-between">
        <span className="tnum text-[26px] font-semibold leading-none text-ink">{formatPercent(m.usedPercent, 'tr', 1)}</span>
        <span className="tnum text-[11px] text-ink-3">
          {formatBytes(m.totalBytes - m.availableBytes)} / {formatBytes(m.totalBytes)}
        </span>
      </div>
      <LiveAreaChart data={data} percent height={70} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px]">
        <Row label={t('memory.committed')} value={formatBytes(m.committedBytes)} />
        <Row label={t('memory.available')} value={formatBytes(m.availableBytes)} />
        <Row label={t('memory.cached')} value={formatBytes(m.cachedBytes)} />
        <Row label={t('memory.nonPagedPool')} value={formatBytes(m.nonPagedPoolBytes)} />
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-ink-3">{label}</span>
      <span className="tnum text-ink-2">{value}</span>
    </div>
  )
}

function GpuWidget({ snap }: { snap: MetricsSnapshot }) {
  const t = useT()
  const staticInfo = useStaticStore((s) => s.info)
  if (snap.gpus.length === 0) {
    return <EmptyState message={t('gpu.none')} />
  }
  return (
    <div className="space-y-2.5">
      {snap.gpus.map((g, i) => {
        const name = staticInfo?.gpus[i]?.name ?? `GPU ${g.id}`
        return (
          <div key={g.id}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-[12px] text-ink-2" title={name}>{name}</span>
              <span className="tnum text-[12px] text-ink">{formatPercent(g.utilPercent, 'tr', 0)}</span>
            </div>
            <UsageBar percent={g.utilPercent ?? 0} />
            <div className="mt-1 flex justify-between text-[11px] text-ink-3">
              <span>
                {t('gpu.dedicated')}: {formatBytes(g.dedicatedUsedBytes)}
              </span>
              <span>
                {t('gpu.shared')}: {formatBytes(g.sharedUsedBytes)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DiskWidget({ snap }: { snap: MetricsSnapshot }) {
  const t = useT()
  const trend = useMetricsStore((s) => s.trend)
  const totalRead = snap.disks.reduce((a, d) => a + d.readBytesSec, 0)
  const totalWrite = snap.disks.reduce((a, d) => a + d.writeBytesSec, 0)
  const ioData = useMemo(
    () =>
      trend.map((p) => ({
        ts: p.ts,
        a: p.diskRead,
        b: p.diskWrite
      })),
    [trend]
  )
  const busiest = snap.disks.reduce<MetricsSnapshot['disks'][number] | null>(
    (best, d) => (best == null || d.activityPercent > best.activityPercent ? d : best),
    null
  )
  return (
    <>
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-3">
          <span className="tnum text-[20px] font-semibold leading-none text-ink">{formatRate(totalRead, 'tr', 0)}</span>
          <span className="text-[11px] text-ink-3">{t('disk.read')}</span>
          <span className="tnum text-[20px] font-semibold leading-none text-ok">{formatRate(totalWrite, 'tr', 0)}</span>
          <span className="text-[11px] text-ink-3">{t('disk.write')}</span>
        </div>
        {busiest ? (
          <Badge tone="neutral">
            {t('disk.activity')} {formatPercent(busiest.activityPercent)}
          </Badge>
        ) : null}
      </div>
      <LiveAreaChart data={ioData.map((d) => ({ ts: d.ts, value: d.a + d.b }))} height={60} />
      <div className="flex flex-wrap gap-2">
        {snap.logicalVolumes.map((v) => {
          const used = v.totalBytes - v.freeBytes
          const pct = v.totalBytes > 0 ? (used / v.totalBytes) * 100 : 0
          return (
            <div key={v.volume} className="min-w-[140px] flex-1">
              <div className="mb-1 flex justify-between text-[11.5px]">
                <span className="text-ink-2">{v.volume}</span>
                <span className="tnum text-ink-3">
                  {formatBytes(v.freeBytes)} {t('disk.free').toLowerCase()}
                </span>
              </div>
              <UsageBar percent={pct} color={pct > 90 ? 'var(--color-danger)' : 'var(--accent)'} />
            </div>
          )
        })}
      </div>
    </>
  )
}

function NetworkWidget({ snap }: { snap: MetricsSnapshot }) {
  const t = useT()
  const trend = useMetricsStore((s) => s.trend)
  const down = snap.network.reduce((a, n) => a + n.receivedBytesSec, 0)
  const up = snap.network.reduce((a, n) => a + n.sentBytesSec, 0)
  const data = useMemo(() => trend.map((p) => ({ ts: p.ts, a: p.netRecv, b: p.netSent })), [trend])
  const active = snap.network
    .filter((n) => n.receivedBytesSec + n.sentBytesSec > 1)
    .sort((a, b) => b.receivedBytesSec + b.sentBytesSec - (a.receivedBytesSec + a.sentBytesSec))
    .slice(0, 3)
  return (
    <>
      <div className="flex items-baseline gap-3">
        <span className="tnum text-[20px] font-semibold leading-none text-ink">{formatRate(down, 'tr', 0)}</span>
        <span className="text-[11px] text-ink-3">↓ {t('net.download')}</span>
        <span className="tnum text-[20px] font-semibold leading-none text-ok">{formatRate(up, 'tr', 0)}</span>
        <span className="text-[11px] text-ink-3">↑ {t('net.upload')}</span>
      </div>
      <LiveAreaChart data={data.map((d) => ({ ts: d.ts, value: d.a + d.b }))} color="green" height={60} />
      <div className="space-y-1">
        {active.length === 0 ? (
          <div className="text-[11.5px] text-ink-3">{t('net.noTraffic')}</div>
        ) : (
          active.map((n) => (
            <div key={n.id} className="flex items-center justify-between gap-2 text-[11.5px]">
              <span className="truncate text-ink-2" title={n.id}>{n.id}</span>
              <span className="tnum shrink-0 text-ink-3">
                ↓ {formatRate(n.receivedBytesSec, 'tr', 0)} · ↑ {formatRate(n.sentBytesSec, 'tr', 0)}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  )
}

function SystemWidget({ snap }: { snap: MetricsSnapshot }) {
  const t = useT()
  const staticInfo = useStaticStore((s) => s.info)
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]">
      <Row label={t('system.hostname')} value={staticInfo?.os.hostname ?? '—'} />
      <Row label={t('system.os')} value={staticInfo?.os.caption ?? '—'} />
      <Row label={t('system.cpu')} value={staticInfo?.cpu.name ?? '—'} />
      <Row label={t('system.uptime')} value={formatDuration(snap.uptimeSec, 'tr')} />
      <Row label={t('system.processes')} value={String(snap.processCount)} />
      <Row label={t('system.threads')} value={String(snap.threadCount)} />
    </div>
  )
}

function BatteryWidget({ snap }: { snap: MetricsSnapshot }) {
  const t = useT()
  const b = snap.battery
  if (!b) return null
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        {b.charging ? <BatteryCharging size={22} className="text-ok" /> : <BatteryMedium size={22} className="text-ink-2" />}
        <span className="tnum text-[22px] font-semibold text-ink">{formatPercent(b.chargePercent)}</span>
      </div>
      <span className="text-[12px] text-ink-3">{b.charging ? t('battery.charging') : t('battery.discharging')}</span>
    </div>
  )
}

const SPANS: Record<WidgetId, number> = {
  cpu: 5,
  memory: 4,
  gpu: 3,
  disk: 7,
  network: 5,
  system: 12
}

const WIDGET_TITLES: Record<WidgetId, TKey> = {
  cpu: 'widget.cpu',
  memory: 'widget.memory',
  gpu: 'widget.gpu',
  disk: 'widget.disk',
  network: 'widget.network',
  system: 'widget.system'
}

const WIDGET_ICONS: Record<WidgetId, React.ReactNode> = {
  cpu: <Cpu size={13} className="text-accent" />,
  memory: <MemoryStick size={13} className="text-accent" />,
  gpu: <Tv size={13} className="text-accent" />,
  disk: <HardDrive size={13} className="text-accent" />,
  network: <Network size={13} className="text-accent" />,
  system: <MonitorSmartphone size={13} className="text-accent" />
}

export function DashboardPage() {
  const t = useT()
  const snapshot = useMetricsStore((s) => s.snapshot)
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const [editing, setEditing] = useState(false)
  const dragIndex = useRef<number | null>(null)

  const widgets = useMemo(
    () => [...settings.dashboard.widgets].sort((a, b) => a.order - b.order),
    [settings.dashboard.widgets]
  )

  const reorder = (from: number, to: number): void => {
    if (from === to) return
    const next = widgets.map((w) => ({ ...w }))
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    void update({ dashboard: { widgets: next.map((w, i) => ({ ...w, order: i })) } })
  }

  const toggleVisible = (id: string): void => {
    const next = widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    void update({ dashboard: { widgets: next } })
  }

  const batteryPresent = snapshot?.battery != null
  const stale = snapshot == null

  return (
    <div className="p-4">
      <PageHeader
        title={t('nav.dashboard')}
        subtitle={stale ? t('states.connecting') : undefined}
        actions={
          editing ? (
            <div className="flex items-center gap-2">
              <span className="text-[11.5px] text-ink-3">{t('dashboard.editHint')}</span>
              <button
                type="button"
                title={t('dashboard.reset')}
                onClick={() => void update({ dashboard: { widgets: cloneSettings(DEFAULT_SETTINGS).dashboard.widgets } })}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 text-[12px] text-ink-2 hover:text-ink"
              >
                <RotateCcw size={12} />
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md bg-accent px-3 py-1 text-[12px] font-medium text-white hover:opacity-90"
              >
                {t('dashboard.done')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md border border-line bg-surface-2 px-3 py-1 text-[12px] text-ink-2 transition-colors hover:text-ink"
            >
              {t('dashboard.edit')}
            </button>
          )
        }
      />

      <div className="mt-3 grid grid-cols-12 gap-3">
        {widgets.map((w, i) => {
          const wid = w.id as WidgetId
          const span = wid === 'system' && batteryPresent ? 8 : SPANS[wid]
          return (
            <WidgetShell
              key={w.id}
              title={t(WIDGET_TITLES[wid])}
              icon={WIDGET_ICONS[wid]}
              span={span}
              editing={editing}
              hidden={!w.visible}
              onToggle={() => toggleVisible(w.id)}
              dragProps={
                editing
                  ? {
                      draggable: true,
                      onDragStart: () => (dragIndex.current = i),
                      onDragOver: (e: React.DragEvent) => e.preventDefault(),
                      onDrop: () => {
                        if (dragIndex.current != null) reorder(dragIndex.current, i)
                        dragIndex.current = null
                      }
                    }
                  : {}
              }
            >
              {w.visible && snapshot ? (
                wid === 'cpu' ? (
                  <CpuWidget snap={snapshot} />
                ) : wid === 'memory' ? (
                  <MemoryWidget snap={snapshot} />
                ) : wid === 'gpu' ? (
                  <GpuWidget snap={snapshot} />
                ) : wid === 'disk' ? (
                  <DiskWidget snap={snapshot} />
                ) : wid === 'network' ? (
                  <NetworkWidget snap={snapshot} />
                ) : wid === 'system' ? (
                  <SystemWidget snap={snapshot} />
                ) : null
              ) : null}
            </WidgetShell>
          )
        })}

        {batteryPresent && snapshot ? (
          <WidgetShell title={t('widget.battery')} icon={<Timer size={13} className="text-accent" />} span={4} editing={false}>
            <BatteryWidget snap={snapshot} />
          </WidgetShell>
        ) : null}
      </div>

      {stale ? (
        <Card className="mt-3 p-1">
          <EmptyState message={t('states.connecting')} />
        </Card>
      ) : null}
    </div>
  )
}
