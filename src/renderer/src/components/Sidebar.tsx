import {
  Activity,
  Bot,
  CalendarClock,
  Eraser,
  FileBarChart,
  Globe,
  HardDrive,
  HeartPulse,
  Info,
  LayoutDashboard,
  ListTree,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Power,
  ScrollText,
  Server,
  Settings,
  Stethoscope,
  Zap
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore, type PageId } from '@/stores/ui'
import { useT } from '@/i18n'
import type { TKey } from '@/i18n'

interface NavItem {
  id: PageId
  icon: LucideIcon
  key: TKey
}

const GROUPS: { labelKey: TKey; items: NavItem[] }[] = [
  {
    labelKey: 'nav.group.monitor',
    items: [
      { id: 'dashboard', icon: LayoutDashboard, key: 'nav.dashboard' },
      { id: 'performance', icon: Activity, key: 'nav.performance' },
      { id: 'processes', icon: ListTree, key: 'nav.processes' },
      { id: 'network', icon: Globe, key: 'nav.network' },
      { id: 'health', icon: HeartPulse, key: 'nav.health' }
    ]
  },
  {
    labelKey: 'nav.group.system',
    items: [
      { id: 'services', icon: Server, key: 'nav.services' },
      { id: 'startup', icon: Power, key: 'nav.startup' },
      { id: 'apps', icon: Package, key: 'nav.apps' },
      { id: 'drivers', icon: Zap, key: 'nav.drivers' },
      { id: 'tasks', icon: CalendarClock, key: 'nav.tasks' },
      { id: 'sysinfo', icon: Info, key: 'nav.sysinfo' }
    ]
  },
  {
    labelKey: 'nav.group.tools',
    items: [
      { id: 'storage', icon: HardDrive, key: 'nav.storage' },
      { id: 'cleanup', icon: Eraser, key: 'nav.cleanup' },
      { id: 'events', icon: ScrollText, key: 'nav.events' },
      { id: 'automation', icon: Bot, key: 'nav.automation' },
      { id: 'diag', icon: Stethoscope, key: 'nav.diag' },
      { id: 'reports', icon: FileBarChart, key: 'nav.reports' }
    ]
  },
  {
    labelKey: 'nav.group.general',
    items: [{ id: 'settings', icon: Settings, key: 'nav.settings' }]
  }
]

export function Sidebar() {
  const t = useT()
  const collapsed = useSettingsStore((s) => s.settings.sidebarCollapsed)
  const update = useSettingsStore((s) => s.update)
  const page = useUiStore((s) => s.page)
  const settingsOpen = useUiStore((s) => s.settingsOpen)
  const setPage = useUiStore((s) => s.setPage)

  return (
    <nav
      className={`flex shrink-0 flex-col overflow-y-auto border-r border-line-soft bg-surface/40 py-2 transition-[width] duration-200 ${
        collapsed ? 'w-[52px]' : 'w-[188px]'
      }`}
    >
      {GROUPS.map((group, gi) => (
        <div key={group.labelKey} className={`flex flex-col gap-0.5 px-2 ${gi > 0 ? 'mt-3' : ''}`}>
          {!collapsed ? (
            <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-ink-3">
              {t(group.labelKey)}
            </div>
          ) : gi > 0 ? (
            <div className="mx-2 mb-2 border-t border-line-soft" />
          ) : null}
          {group.items.map((item) => {
            const Icon = item.icon
            const active = item.id === 'settings' ? settingsOpen : page === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setPage(item.id)}
                title={t(item.key)}
                className={`group flex h-[28px] items-center gap-2.5 rounded-md px-2 text-[12px] transition-colors ${
                  active
                    ? 'bg-accent-soft font-medium text-ink'
                    : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <Icon size={14} className={active ? 'text-accent' : 'text-ink-3 group-hover:text-ink-2'} />
                {!collapsed && <span className="truncate">{t(item.key)}</span>}
              </button>
            )
          })}
        </div>
      ))}
      <div className="mt-auto px-2 pt-2">
        <button
          type="button"
          onClick={() => void update({ sidebarCollapsed: !collapsed })}
          title={t('cmd.toggleSidebar')}
          className="flex h-[30px] w-full items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>
    </nav>
  )
}
