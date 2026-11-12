import type { BatteryDetail, DiskHealth, HealthPayload, ThermalZone } from '@shared/types'
import { extractLastJson, runScriptOnce } from './scriptRunner'
import { HEALTH_SCRIPT } from './scripts'

export class HealthService {
  async get(): Promise<HealthPayload> {
    const out = await runScriptOnce(HEALTH_SCRIPT, 90000)
    const parsed = extractLastJson<{
      disks: Array<{
        model: string
        media: string
        health: string
        temp: number | null
        wear: number | null
        readErr: number | null
        writeErr: number | null
        powerOnHours: number | null
      }>
      temps: Array<{ zone: string; c: number }>
      battery: {
        pct: number | null
        charging: boolean
        voltage: number | null
        runtimeSec: number | null
        status: string
      } | null
    }>(out)
    const disks: DiskHealth[] = (parsed?.disks ?? []).map((d) => ({
      model: d.model || 'Disk',
      mediaType: d.media || null,
      healthStatus: d.health || null,
      temperatureC: typeof d.temp === 'number' && d.temp > 0 ? d.temp : null,
      wearPercent: typeof d.wear === 'number' && d.wear > 0 ? d.wear : null,
      readErrors: d.readErr ?? null,
      writeErrors: d.writeErr ?? null,
      powerOnHours: d.powerOnHours ?? null
    }))
    const thermal: ThermalZone[] = (parsed?.temps ?? []).map((t) => ({ zone: t.zone, celsius: t.c }))
    let battery: BatteryDetail | null = null
    if (parsed?.battery) {
      battery = {
        chargePercent: parsed.battery.pct ?? null,
        charging: parsed.battery.charging === true,
        voltage: parsed.battery.voltage ?? null,
        estimatedRuntimeSec: parsed.battery.runtimeSec ?? null,
        status: parsed.battery.status || null
      }
    }
    return { disks, thermal, battery }
  }
}
