import { useEffect, useState } from 'react'
import { Command, ShieldCheck, ShieldAlert } from 'lucide-react'
import { useMetricsStore } from '@/stores/metrics'
import { useUiStore } from '@/stores/ui'
import { useT } from '@/i18n'

function StreamDot() {
  const lastEventAt = useMetricsStore((s) => s.lastEventAt)
  const t = useT()
  const [alive, setAlive] = useState(false)
  useEffect(() => {
    const check = () => setAlive(Date.now() - lastEventAt < 8000 && lastEventAt > 0)
    check()
    const iv = setInterval(check, 2000)
    return () => clearInterval(iv)
  }, [lastEventAt])
  return (
    <span
      title={alive ? t('topbar.streamOk') : t('topbar.streamLost')}
      className={`h-2 w-2 rounded-full ${alive ? 'bg-ok anim-pulse' : 'bg-ink-3'}`}
    />
  )
}

function AdminBadge() {
  const appInfo = useUiStore((s) => s.appInfo)
  const t = useT()
  if (appInfo?.isElevated == null) return null
  return appInfo.isElevated ? (
    <span className="inline-flex items-center gap-1 rounded border border-ok/25 px-1.5 py-0.5 text-[10.5px] text-ok">
      <ShieldCheck size={11} />
      {t('topbar.admin')}
    </span>
  ) : (
    <span
      title={t('topbar.restrictedHint')}
      className="inline-flex items-center gap-1 rounded border border-warn/25 px-1.5 py-0.5 text-[10.5px] text-warn"
    >
      <ShieldAlert size={11} />
      {t('topbar.restricted')}
    </span>
  )
}

export function TitleBar() {
  const t = useT()
  const page = useUiStore((s) => s.page)
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen)

  const pageTitles: Record<string, string> = {
    dashboard: t('nav.dashboard'),
    performance: t('nav.performance'),
    processes: t('nav.processes'),
    network: t('nav.network'),
    services: t('nav.services'),
    startup: t('nav.startup'),
    apps: t('nav.apps'),
    events: t('nav.events'),
    storage: t('nav.storage'),
    sysinfo: t('nav.sysinfo'),
    tasks: t('nav.tasks'),
    drivers: t('nav.drivers'),
    power: t('nav.power'),
    cleanup: t('nav.cleanup'),
    health: t('nav.health'),
    diag: t('nav.diag'),
    automation: t('nav.automation'),
    reports: t('nav.reports'),
    settings: t('nav.settings')
  }

  return (
    <div className="titlebar app-drag flex shrink-0 items-center border-b border-line-soft bg-surface/60 pl-3">
      <span className="text-[12px] font-semibold tracking-tight text-ink">LocalOps</span>
      <span className="mx-2 text-ink-3 text-[12px]">/</span>
      <span className="text-[12px] text-ink-2">{pageTitles[page] ?? ''}</span>
      <div className="flex-1" />
      <div className="app-no-drag flex items-center gap-2 pr-3">
        <StreamDot />
        <AdminBadge />
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          title={t('topbar.openPalette')}
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] text-ink-3 transition-colors hover:text-ink"
        >
          <Command size={11} />
          Ctrl K
        </button>
      </div>
    </div>
  )
}
