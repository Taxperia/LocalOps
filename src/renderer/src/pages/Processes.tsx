import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp, Copy, Gauge, Info, ListTree, Rows3, Search } from 'lucide-react'
import { useT } from '@/i18n'
import { useProcessesStore } from '@/stores/processes'
import { useUiStore } from '@/stores/ui'
import { api } from '@/lib/ipc'
import { ContextMenu, type MenuItem } from '@/components/ContextMenu'
import { IconButton } from '@/components/ui'
import { formatBytes, formatNumber, formatPercent, formatTime } from '@shared/format'
import { PROCESS_PRIORITIES } from '@shared/settingsSchema'
import type { ProcessInfo, ProcessPriority } from '@shared/types'
import { ProcessDetailsPanel } from './ProcessDetails'
import { buildProcessTree } from '@shared/processTree'

type SortKey = 'name' | 'pid' | 'cpuPercent' | 'memoryBytes' | 'privateBytes' | 'threads' | 'handles' | 'startedAt'

export function ProcessesPage() {
  const t = useT()
  const processes = useProcessesStore((s) => s.processes)
  const selectedPid = useProcessesStore((s) => s.selectedPid)
  const setSelected = useProcessesStore((s) => s.setSelected)
  const pushToast = useUiStore((s) => s.pushToast)
  const askConfirm = useUiStore((s) => s.askConfirm)

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'cpuPercent', dir: 'desc' })
  const [treeMode, setTreeMode] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; proc: ProcessInfo } | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    void api
      .getProcesses()
      .then((p) => useProcessesStore.getState().apply(p))
      .catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return processes
    return processes.filter(
      (p) => p.name.toLowerCase().includes(q) || String(p.pid).includes(q)
    )
  }, [processes, query])

  const rows: Array<{ proc: ProcessInfo; depth: number }> = useMemo(() => {
    if (treeMode) return buildProcessTree(filtered)
    const sorted = [...filtered]
    const dir = sort.dir === 'asc' ? 1 : -1
    sorted.sort((a, b) => {
      const av = a[sort.key]
      const bv = b[sort.key]
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir
      const an = av == null ? -1 : Number(av)
      const bn = bv == null ? -1 : Number(bv)
      return (an - bn) * dir
    })
    return sorted.map((proc) => ({ proc, depth: 0 }))
  }, [filtered, sort, treeMode])

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    getItemKey: (index) => rows[index].proc.pid,
    estimateSize: () => 28,
    overscan: 12
  })

  const columns: Array<{ key: SortKey | null; label: string; width: string; align?: 'right' }> = [
    { key: 'name', label: t('proc.col.name'), width: 'minmax(200px,2fr)' },
    { key: 'pid', label: t('proc.col.pid'), width: '64px', align: 'right' },
    { key: null, label: t('proc.col.user'), width: 'minmax(90px,110px)' },
    { key: 'cpuPercent', label: t('proc.col.cpu'), width: '76px', align: 'right' },
    { key: 'memoryBytes', label: t('proc.col.memory'), width: '92px', align: 'right' },
    { key: 'threads', label: t('proc.col.threads'), width: '70px', align: 'right' },
    { key: 'handles', label: t('proc.col.handles'), width: '70px', align: 'right' },
    { key: 'startedAt', label: t('proc.col.started'), width: '96px', align: 'right' }
  ]
  const gridTemplate = columns.map((c) => c.width).join(' ')

  const copy = async (text: string): Promise<void> => {
    try {
      await api.writeClipboard(text)
      pushToast({ kind: 'success', title: t('common.copied') })
    } catch {
      pushToast({ kind: 'error', title: t('common.copyFailed') })
    }
  }

  const killProcess = async (proc: ProcessInfo): Promise<void> => {
    const ok = await askConfirm({
      title: t('proc.killConfirmTitle'),
      message: t('proc.killConfirmMsg', { name: proc.name, pid: proc.pid }),
      confirmLabel: t('proc.kill'),
      danger: true
    })
    if (!ok) return
    const res = await api.killProcess(proc.pid, true)
    if (res.ok) {
      pushToast({ kind: 'success', title: t('proc.killed', { name: proc.name }) })
    } else {
      const denied = /access|denied|erişim|erişimred/i.test(res.error ?? '')
      pushToast({ kind: 'error', title: t('err.killFailed'), message: denied ? t('err.accessDenied') : res.error })
    }
  }

  const setPriority = async (proc: ProcessInfo, priority: ProcessPriority): Promise<void> => {
    const res = await api.setProcessPriority(proc.pid, priority)
    if (res.ok) {
      pushToast({ kind: 'success', title: t('proc.priorityChanged') })
    } else {
      const denied = /access|denied|erişim/i.test(res.error ?? '')
      pushToast({ kind: 'error', title: t('err.priorityFailed'), message: denied ? t('err.accessDenied') : res.error })
    }
  }

  const menuItems = useMemo<MenuItem[]>(() => {
    if (!menu) return []
    const proc = menu.proc
    return [
      { label: t('proc.details'), icon: Info, onClick: () => setSelected(proc.pid) },
      { label: t('proc.copyPid'), icon: Copy, onClick: () => void copy(String(proc.pid)) },
      {
        label: t('proc.copyPath'),
        icon: Copy,
        disabled: !proc.path,
        onClick: () => void copy(proc.path ?? '')
      },
      {
        label: t('proc.priority'),
        icon: Gauge,
        submenu: PROCESS_PRIORITIES.map((p) => ({
          label: t(`prio.${p.toLowerCase() as 'idle' | 'belownormal' | 'normal' | 'abovenormal' | 'high' | 'realtime'}`),
          onClick: () => void setPriority(proc, p)
        }))
      },
      { label: t('proc.kill'), icon: undefined, danger: true, onClick: () => void killProcess(proc) }
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, t])

  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight text-ink">{t('proc.title')}</h1>
          <p className="tnum text-[12px] text-ink-3">
            {t('proc.count', { n: formatNumber(processes.length, 'tr') })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('proc.search')}
              className="h-8 w-[240px] rounded-md border border-line bg-surface-2 pl-8 pr-2 text-[12px] text-ink outline-none placeholder:text-ink-3 focus:border-accent"
            />
          </div>
          <IconButton
            title={treeMode ? t('proc.flat') : t('proc.tree')}
            active={treeMode}
            onClick={() => setTreeMode((v) => !v)}
          >
            {treeMode ? <Rows3 size={14} /> : <ListTree size={14} />}
          </IconButton>
        </div>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 overflow-hidden rounded-lg border border-line-soft bg-surface">
      <div className="flex min-w-0 flex-1 flex-col overflow-x-auto" data-testid="process-list">
        <div
          className="grid min-w-[810px] shrink-0 items-center gap-0 border-b border-line-soft bg-surface-2/60 px-2 py-1.5 text-[11px] font-medium text-ink-3"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {columns.map((c) => (
            <button
              key={c.label}
              type="button"
              disabled={c.key == null || treeMode}
              onClick={() => {
                if (!c.key) return
                setSort((s) => (s.key === c.key ? { key: s.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key as SortKey, dir: 'desc' }))
              }}
              className={`flex items-center gap-1 text-left disabled:cursor-default ${
                c.align === 'right' ? 'justify-end' : ''
              } ${sort.key === c.key ? 'text-ink-2' : ''}`}
            >
              {c.align === 'right' && sort.key === c.key ? <SortIcon dir={sort.dir} /> : null}
              {c.label}
              {c.align !== 'right' && sort.key === c.key ? <SortIcon dir={sort.dir} /> : null}
            </button>
          ))}
        </div>

        <div ref={parentRef} className="min-h-0 min-w-[810px] flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[12px] text-ink-3">{t('proc.empty')}</div>
          ) : (
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map((vi) => {
                const row = rows[vi.index]
                const p = row.proc
                const selected = selectedPid === p.pid
                return (
                  <div
                    key={p.pid}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: vi.size,
                      transform: `translateY(${vi.start}px)`
                    }}
                  >
                    <div
                      data-process-pid={p.pid}
                      onClick={() => setSelected(p.pid)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setMenu({ x: e.clientX, y: e.clientY, proc: p })
                      }}
                      className={`grid h-full cursor-default items-center px-2 text-[12px] ${
                        selected ? 'bg-accent-soft' : 'hover:bg-surface-2'
                      }`}
                      style={{ gridTemplateColumns: gridTemplate }}
                    >
                      <div className="flex min-w-0 items-center" style={{ paddingLeft: row.depth * 14 }}>
                        {p.status === 'notResponding' ? (
                          <span title={t('proc.notResponding')} className="mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                        ) : null}
                        {row.depth > 0 ? <span className="mr-1 text-ink-3">└</span> : null}
                        <span className="truncate text-ink" title={p.path ?? p.name}>
                          {p.name}
                        </span>
                      </div>
                      <div className="tnum text-right text-ink-3">{p.pid}</div>
                      <div className="truncate text-ink-3" title={p.userName ?? ''}>
                        {p.userName ?? '—'}
                      </div>
                      <div className={`tnum text-right ${(p.cpuPercent ?? 0) > 5 ? 'text-accent' : 'text-ink-2'}`}>
                        {formatPercent(p.cpuPercent, 'tr', 1)}
                      </div>
                      <div className="tnum text-right text-ink-2">{formatBytes(p.memoryBytes, 'tr', 0)}</div>
                      <div className="tnum text-right text-ink-3">{p.threads ?? '—'}</div>
                      <div className="tnum text-right text-ink-3">{formatNumber(p.handles, 'tr')}</div>
                      <div className="tnum text-right text-ink-3">{p.startedAt ? formatTime(p.startedAt, 'tr') : '—'}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <ProcessDetailsPanel />
      </div>

      {menu ? (
        <ContextMenu position={{ x: menu.x, y: menu.y }} items={menuItems} onClose={() => setMenu(null)} />
      ) : null}
    </div>
  )
}

function SortIcon({ dir }: { dir: 'asc' | 'desc' }) {
  return dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
}
