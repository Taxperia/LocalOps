import { create } from 'zustand'
import type { ProcessListPayload, ProcessInfo } from '@shared/types'

interface ProcessesState {
  processes: ProcessInfo[]
  ts: number
  systemCpuUsage: number
  selectedPid: number | null
  apply: (p: ProcessListPayload) => void
  setSelected: (pid: number | null) => void
}

export const useProcessesStore = create<ProcessesState>((set) => ({
  processes: [],
  ts: 0,
  systemCpuUsage: 0,
  selectedPid: null,
  apply: (p) => set({ processes: p.processes, ts: p.ts, systemCpuUsage: p.systemCpuUsage }),
  setSelected: (pid) => set({ selectedPid: pid })
}))
