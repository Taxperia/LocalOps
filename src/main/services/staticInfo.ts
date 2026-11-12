import { STATIC_INFO_SCRIPT } from './scripts'
import { extractLastJson, runScriptOnce } from './scriptRunner'
import type { AdapterInfo, GpuStaticInfo, RamModule, StaticSystemInfo, StorageDeviceInfo } from '@shared/types'

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}
function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function mapModules(raw: unknown): RamModule[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((m) => m && typeof m === 'object')
    .map((m) => {
      const r = m as Record<string, unknown>
      return {
        slot: str(r.slot) ?? '—',
        capacityBytes: typeof r.capacity === 'number' ? r.capacity : 0,
        speedMhz: numOrNull(r.speed),
        configuredSpeedMhz: numOrNull(r.configuredSpeed),
        manufacturer: str(r.manufacturer),
        partNumber: str(r.partNumber)
      }
    })
}

function mapGpus(raw: unknown): GpuStaticInfo[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((g) => g && typeof g === 'object')
    .map((g) => {
      const r = g as Record<string, unknown>
      return {
        name: str(r.name) ?? 'GPU',
        driverVersion: str(r.driverVersion),
        driverDate: numOrNull(r.driverDate),
        vramBytes: numOrNull(r.vram),
        videoMode: str(r.videoMode),
        status: str(r.status),
        pnpId: str(r.pnpId)
      }
    })
}

function mapStorage(raw: unknown): StorageDeviceInfo[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((s) => s && typeof s === 'object')
    .map((s) => {
      const r = s as Record<string, unknown>
      return {
        model: str(r.model) ?? 'Disk',
        sizeBytes: numOrNull(r.size),
        busType: str(r.busType),
        mediaType: str(r.mediaType),
        healthStatus: str(r.health),
        firmware: str(r.firmware)
      }
    })
}

function mapAdapters(raw: unknown): AdapterInfo[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((a) => a && typeof a === 'object')
    .map((a) => {
      const r = a as Record<string, unknown>
      return {
        name: str(r.name) ?? '—',
        description: str(r.description),
        mac: str(r.mac),
        status: str(r.status),
        linkSpeed: str(r.linkSpeed)
      }
    })
}

export class StaticInfoService {
  private cache: StaticSystemInfo | null = null
  private cacheTs = 0
  private pending: Promise<StaticSystemInfo> | null = null
  isElevated: boolean | null = null

  async get(force = false): Promise<StaticSystemInfo> {
    if (!force && this.cache && Date.now() - this.cacheTs < 5 * 60_000) return this.cache
    if (this.pending) return this.pending
    this.pending = this.fetch().finally(() => (this.pending = null))
    return this.pending
  }

  private async fetch(): Promise<StaticSystemInfo> {
    const text = await runScriptOnce(STATIC_INFO_SCRIPT, 30000)
    const raw = extractLastJson<Record<string, unknown>>(text)
    if (!raw) throw new Error('static info parse failed')
    this.isElevated = raw.isElevated === true

    const osRaw = (raw.os ?? {}) as Record<string, unknown>
    const csRaw = (raw.computer ?? {}) as Record<string, unknown>
    const cpuRaw = (raw.cpu ?? {}) as Record<string, unknown>
    const boardRaw = (raw.motherboard ?? {}) as Record<string, unknown>
    const biosRaw = (raw.bios ?? {}) as Record<string, unknown>
    const totalMem = csRaw.totalMem != null ? numOrNull(csRaw.totalMem) : null
    const modules = mapModules(raw.ramModules)
    const modulesTotal = modules.reduce((a, m) => a + m.capacityBytes, 0)

    const info: StaticSystemInfo = {
      ts: Date.now(),
      os: {
        caption: str(osRaw.caption),
        version: str(osRaw.version),
        build: str(osRaw.build),
        arch: str(osRaw.arch),
        installDate: numOrNull(osRaw.installDate),
        lastBoot: numOrNull(osRaw.lastBoot),
        locale: str(osRaw.locale),
        hostname: str(osRaw.hostname)
      },
      computer: {
        manufacturer: str(csRaw.manufacturer),
        model: str(csRaw.model),
        pcType: str(csRaw.pcType)
      },
      cpu: {
        name: str(cpuRaw.name),
        manufacturer: str(cpuRaw.manufacturer),
        cores: numOrNull(cpuRaw.cores),
        logical: numOrNull(cpuRaw.logical),
        baseClockMhz: numOrNull(cpuRaw.baseClockMhz),
        maxClockMhz: numOrNull(cpuRaw.maxClockMhz),
        l2MB: numOrNull(cpuRaw.l2MB),
        l3MB: numOrNull(cpuRaw.l3MB)
      },
      memory: {
        totalBytes: totalMem ?? (modulesTotal > 0 ? modulesTotal : null),
        modules
      },
      motherboard: {
        manufacturer: str(boardRaw.manufacturer),
        product: str(boardRaw.product),
        version: str(boardRaw.version)
      },
      bios: {
        vendor: str(biosRaw.vendor),
        version: str(biosRaw.version),
        releaseDate: numOrNull(biosRaw.releaseDate)
      },
      gpus: mapGpus(raw.gpus),
      storage: mapStorage(raw.storage),
      adapters: mapAdapters(raw.adapters),
      isElevated: raw.isElevated === true
    }
    this.cache = info
    this.cacheTs = Date.now()
    return info
  }
}
