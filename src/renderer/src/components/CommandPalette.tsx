import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Bot,
  CalendarClock,
  Eraser,
  EyeOff,
  FileBarChart,
  Gauge,
  Globe,
  HardDrive,
  HeartPulse,
  Info,
  LayoutDashboard,
  Languages,
  ListTree,
  Package,
  Palette,
  Power,
  RefreshCw,
  ScrollText,
  Server,
  Settings,
  Stethoscope,
  Zap
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { fuzzyMatch } from '@/lib/fuzzy'
import { useT } from '@/i18n'
import type { TKey } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore, type PageId } from '@/stores/ui'
import { cloneSettings, DEFAULT_SETTINGS, WIDGET_IDS } from '@shared/settingsSchema'

interface Command {
  id: string
  label: string
  group: 'palette.group.navigate' | 'palette.group.view'
  icon: LucideIcon
  run: () => void
}

export function CommandPalette() {
  const t = useT()
  const open = useUiStore((s) => s.paletteOpen)
  const setOpen = useUiStore((s) => s.setPaletteOpen)
  const setPage = useUiStore((s) => s.setPage)
  const update = useSettingsStore((s) => s.update)
  const settings = useSettingsStore((s) => s.settings)

  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const commands = useMemo<Command[]>(() => {
    const nav = (id: PageId, key: TKey, icon: LucideIcon): Command => ({
      id: `nav-${id}`,
      label: t(key),
      group: 'palette.group.navigate',
      icon,
      run: () => setPage(id)
    })
    const cmds: Command[] = [
      nav('dashboard', 'cmd.goDashboard', LayoutDashboard),
      nav('performance', 'cmd.goPerformance', Activity),
      nav('processes', 'cmd.goProcesses', ListTree),
      nav('network', 'nav.network', Globe),
      nav('services', 'nav.services', Server),
      nav('startup', 'nav.startup', Power),
      nav('apps', 'nav.apps', Package),
      nav('drivers', 'nav.drivers', Zap),
      nav('tasks', 'nav.tasks', CalendarClock),
      nav('sysinfo', 'nav.sysinfo', Info),
      nav('storage', 'nav.storage', HardDrive),
      nav('cleanup', 'nav.cleanup', Eraser),
      nav('events', 'nav.events', ScrollText),
      nav('health', 'nav.health', HeartPulse),
      nav('diag', 'nav.diag', Stethoscope),
      nav('automation', 'nav.automation', Bot),
      nav('reports', 'nav.reports', FileBarChart),
      nav('settings', 'cmd.goSettings', Settings)
    ]
    const interval: Array<[number, 'cmd.interval1000' | 'cmd.interval2000' | 'cmd.interval5000']> = [
      [1000, 'cmd.interval1000'],
      [2000, 'cmd.interval2000'],
      [5000, 'cmd.interval5000']
    ]
    for (const [ms, key] of interval) {
      cmds.push({
        id: `interval-${ms}`,
        label: t(key),
        group: 'palette.group.view',
        icon: Gauge,
        run: () => void update({ intervalMs: ms })
      })
    }
    cmds.push({
      id: 'lang-tr',
      label: t('cmd.langTr'),
      group: 'palette.group.view',
      icon: Languages,
      run: () => void update({ locale: 'tr' })
    })
    cmds.push({
      id: 'lang-en',
      label: t('cmd.langEn'),
      group: 'palette.group.view',
      icon: Languages,
      run: () => void update({ locale: 'en' })
    })
    cmds.push({
      id: 'sidebar',
      label: t('cmd.toggleSidebar'),
      group: 'palette.group.view',
      icon: EyeOff,
      run: () => void update({ sidebarCollapsed: !settings.sidebarCollapsed })
    })
    cmds.push({
      id: 'reset-dashboard',
      label: t('cmd.resetDashboard'),
      group: 'palette.group.view',
      icon: RefreshCw,
      run: () => void update({ dashboard: { widgets: cloneSettings(DEFAULT_SETTINGS).dashboard.widgets } })
    })
    return cmds
  }, [t, setPage, update, settings.sidebarCollapsed])

  const results = useMemo(() => {
    if (!query.trim()) return commands
    return commands
      .map((c) => ({ cmd: c, score: fuzzyMatch(query, c.label) }))
      .filter((r): r is { cmd: Command; score: number } => r.score != null)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.cmd)
  }, [commands, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  useEffect(() => setIndex(0), [query])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
      else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIndex((i) => Math.min(results.length - 1, i + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        results[index]?.run()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, results, index, setOpen])

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [index])

  if (!open) return null

  let lastGroup = ''

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[14vh]" onClick={() => setOpen(false)}>
      <div
        className="anim-pop w-[520px] overflow-hidden rounded-xl border border-line bg-surface-2 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line-soft p-2">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('palette.placeholder')}
            className="w-full bg-transparent px-2 py-1.5 text-[13px] text-ink outline-none placeholder:text-ink-3"
          />
        </div>
        <div ref={listRef} className="max-h-[320px] overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-ink-3">{t('palette.empty')}</div>
          ) : (
            results.map((c, i) => {
              const groupLabel = t(c.group)
              const showGroup = groupLabel !== lastGroup
              lastGroup = groupLabel
              const Icon = c.icon
              return (
                <div key={c.id}>
                  {showGroup ? (
                    <div className="px-3 pb-1 pt-2 text-[10.5px] font-medium uppercase tracking-wide text-ink-3">
                      {groupLabel}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    data-active={i === index}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => {
                      c.run()
                      setOpen(false)
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12.5px] ${
                      i === index ? 'bg-accent-soft text-ink' : 'text-ink-2'
                    }`}
                  >
                    <Icon size={14} className={i === index ? 'text-accent' : 'text-ink-3'} />
                    {c.label}
                  </button>
                </div>
              )
            })
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-line-soft px-3 py-1.5 text-[10.5px] text-ink-3">
          <span className="inline-flex items-center gap-1">
            <Palette size={10} /> {t('app.name')}
          </span>
          <span>↑↓</span>
          <span>↵</span>
          <span>Esc</span>
          <span className="ml-auto tnum">{WIDGET_IDS.length} widget</span>
        </div>
      </div>
    </div>
  )
}
