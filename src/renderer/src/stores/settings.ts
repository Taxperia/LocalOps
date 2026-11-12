import { create } from 'zustand'
import { api } from '@/lib/ipc'
import { cloneSettings, DEFAULT_SETTINGS } from '@shared/settingsSchema'
import type { AppSettings } from '@shared/types'

interface SettingsState {
  settings: AppSettings
  hydrated: boolean
  load: () => Promise<void>
  update: (patch: Partial<AppSettings>) => Promise<void>
  replace: (s: AppSettings) => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: cloneSettings(DEFAULT_SETTINGS),
  hydrated: false,
  load: async () => {
    try {
      const s = await api.getSettings()
      set({ settings: s, hydrated: true })
    } catch {
      set({ hydrated: true })
    }
    applyDocumentTheme(get().settings)
  },
  update: async (patch) => {
    const prev = get().settings
    const optimistic: AppSettings = {
      ...prev,
      ...patch,
      notifications: patch.notifications ? { ...prev.notifications, ...patch.notifications } : prev.notifications,
      dashboard: patch.dashboard ? patch.dashboard : prev.dashboard
    }
    set({ settings: optimistic })
    applyDocumentTheme(optimistic)
    try {
      const saved = await api.updateSettings(patch)
      set({ settings: saved })
      applyDocumentTheme(saved)
    } catch {
      set({ settings: prev })
      applyDocumentTheme(prev)
    }
  },
  replace: (s) => {
    set({ settings: s })
    applyDocumentTheme(s)
  }
}))

function applyDocumentTheme(s: AppSettings): void {
  document.documentElement.dataset.accent = s.accent
  document.documentElement.lang = s.locale
}
