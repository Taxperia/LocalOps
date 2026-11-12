import { useEffect } from 'react'
import { TitleBar } from '@/components/TitleBar'
import { Sidebar } from '@/components/Sidebar'
import { CommandPalette } from '@/components/CommandPalette'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Toaster } from '@/components/Toaster'
import { DashboardPage } from '@/pages/Dashboard'
import { PerformancePage } from '@/pages/Performance'
import { ProcessesPage } from '@/pages/Processes'
import { NetworkPage } from '@/pages/Network'
import { ServicesPage } from '@/pages/Services'
import { StartupPage } from '@/pages/Startup'
import { AppsPage } from '@/pages/Apps'
import { EventsPage } from '@/pages/Events'
import { StoragePage } from '@/pages/Storage'
import { SystemInfoPage } from '@/pages/SystemInfo'
import { TasksPage } from '@/pages/Tasks'
import { DriversPage } from '@/pages/Drivers'
import { PowerPage } from '@/pages/Power'
import { CleanupPage } from '@/pages/Cleanup'
import { HealthPage } from '@/pages/Health'
import { DiagnosticsPage } from '@/pages/Diagnostics'
import { AutomationPage } from '@/pages/Automation'
import { ReportsPage } from '@/pages/Reports'
import { SettingsModal } from '@/pages/Settings'
import { tFor, useT, type TKey } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'
import { useMetricsStore } from '@/stores/metrics'
import { useProcessesStore } from '@/stores/processes'
import { useStaticStore } from '@/stores/static'
import { useUiStore } from '@/stores/ui'
import { api } from '@/lib/ipc'
import type { AlertPayload, AlertKind } from '@shared/types'

const ALERT_KEYS: Record<AlertKind, TKey> = {
  cpu: 'alerts.cpu',
  memory: 'alerts.memory',
  disk: 'alerts.disk'
}

export default function App() {
  useT() // keeps i18n reactive on locale change
  const page = useUiStore((s) => s.page)

  useEffect(() => {
    void useSettingsStore.getState().load()
    void useStaticStore.getState().load()
    void api
      .getAppInfo()
      .then((info) => useUiStore.getState().setAppInfo(info))
      .catch(() => {})

    const un1 = window.localops.onMetrics((s) => useMetricsStore.getState().apply(s))
    const un2 = window.localops.onProcesses((p) => useProcessesStore.getState().apply(p))
    const un3 = window.localops.onSettingsChanged((s) => useSettingsStore.getState().replace(s))
    const un4 = window.localops.onAlerts((a: AlertPayload) => {
      const locale = useSettingsStore.getState().settings.locale
      useUiStore.getState().pushToast({
        kind: 'alert',
        title: tFor(locale)(ALERT_KEYS[a.kind]),
        message: `${Math.round(a.value)}% → ${a.threshold}%`
      })
    })
    const un5 = window.localops.onAutomationFired((p) => {
      const locale = useSettingsStore.getState().settings.locale
      useUiStore.getState().pushToast({
        kind: 'alert',
        title: p.rule.message || `${tFor(locale)('automation.metric.' + p.rule.kind as TKey)} · ${Math.round(p.value)}%`
      })
    })
    const un6 = window.localops.onUpdateStatus((status) => {
      if (status.state !== 'downloaded') return
      const locale = useSettingsStore.getState().settings.locale
      useUiStore.getState().pushToast({ kind: 'success', title: tFor(locale)('updates.downloaded'), message: tFor(locale)('updates.openSettings') })
    })

    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const open = useUiStore.getState().paletteOpen
        useUiStore.getState().setPaletteOpen(!open)
      }
    }
    window.addEventListener('keydown', onKey)

    return () => {
      un1()
      un2()
      un3()
      un4()
      un5()
      un6()
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">
          {page === 'dashboard' ? <DashboardPage /> : null}
          {page === 'performance' ? <PerformancePage /> : null}
          {page === 'processes' ? <ProcessesPage /> : null}
          {page === 'network' ? <NetworkPage /> : null}
          {page === 'services' ? <ServicesPage /> : null}
          {page === 'startup' ? <StartupPage /> : null}
          {page === 'apps' ? <AppsPage /> : null}
          {page === 'events' ? <EventsPage /> : null}
          {page === 'storage' ? <StoragePage /> : null}
          {page === 'sysinfo' ? <SystemInfoPage /> : null}
          {page === 'tasks' ? <TasksPage /> : null}
          {page === 'drivers' ? <DriversPage /> : null}
          {page === 'power' ? <PowerPage /> : null}
          {page === 'cleanup' ? <CleanupPage /> : null}
          {page === 'health' ? <HealthPage /> : null}
          {page === 'diag' ? <DiagnosticsPage /> : null}
          {page === 'automation' ? <AutomationPage /> : null}
          {page === 'reports' ? <ReportsPage /> : null}
        </main>
      </div>
      <CommandPalette />
      <SettingsModal />
      <ConfirmDialog />
      <Toaster />
    </div>
  )
}
