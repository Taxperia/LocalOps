import { create } from 'zustand'
import { api } from '@/lib/ipc'
import type { StaticSystemInfo } from '@shared/types'

interface StaticState {
  info: StaticSystemInfo | null
  loading: boolean
  error: string | null
  load: (force?: boolean) => Promise<void>
}

export const useStaticStore = create<StaticState>((set, get) => ({
  info: null,
  loading: false,
  error: null,
  load: async (force = false) => {
    if (get().loading) return
    if (!force && get().info) return
    set({ loading: true, error: null })
    try {
      const info = await api.getStaticSystemInfo(force)
      set({ info, loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) })
    }
  }
}))
