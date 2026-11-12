import { create } from 'zustand'
import type { AppInfo, AlertPayload } from '@shared/types'

export type PageId =
  | 'dashboard'
  | 'performance'
  | 'processes'
  | 'network'
  | 'services'
  | 'startup'
  | 'apps'
  | 'events'
  | 'storage'
  | 'sysinfo'
  | 'tasks'
  | 'drivers'
  | 'power'
  | 'cleanup'
  | 'health'
  | 'diag'
  | 'automation'
  | 'reports'
  | 'settings'

export type ToastKind = 'info' | 'success' | 'error' | 'alert'

export interface Toast {
  id: number
  kind: ToastKind
  title: string
  message?: string
}

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolver: ((v: boolean) => void) | null
}

interface UiState {
  page: PageId
  paletteOpen: boolean
  settingsOpen: boolean
  confirm: ConfirmState
  toasts: Toast[]
  appInfo: AppInfo | null
  setPage: (p: PageId) => void
  setPaletteOpen: (v: boolean) => void
  setSettingsOpen: (v: boolean) => void
  askConfirm: (opts: ConfirmOptions) => Promise<boolean>
  answerConfirm: (v: boolean) => void
  pushToast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
  setAppInfo: (a: AppInfo) => void
}

let toastSeq = 1

export const useUiStore = create<UiState>((set, get) => ({
  page: 'dashboard',
  paletteOpen: false,
  settingsOpen: false,
  confirm: { open: false, title: '', message: '', danger: false, resolver: null },
  toasts: [],
  appInfo: null,
  setPage: (page) => page === 'settings' ? set({ settingsOpen: true }) : set({ page }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  askConfirm: (opts) =>
    new Promise<boolean>((resolve) => {
      set({ confirm: { ...opts, open: true, resolver: resolve } })
    }),
  answerConfirm: (v) => {
    const c = get().confirm
    c.resolver?.(v)
    set({ confirm: { ...c, open: false, resolver: null } })
  },
  pushToast: (t) => {
    const id = toastSeq++
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
    setTimeout(() => get().dismissToast(id), 5000)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setAppInfo: (appInfo) => set({ appInfo })
}))

export function alertToast(payload: AlertPayload, title: string): void {
  useUiStore.getState().pushToast({ kind: 'alert', title, message: `⚠ ${Math.round(payload.value)}% > ${payload.threshold}%` })
}
