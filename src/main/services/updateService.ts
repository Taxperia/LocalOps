import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IPC } from '@shared/channels'
import type { ActionResult, UpdateStatus } from '@shared/types'

export class UpdateService {
  private status: UpdateStatus = { state: app.isPackaged ? 'idle' : 'disabled' }
  private timer: NodeJS.Timeout | null = null
  private initialTimer: NodeJS.Timeout | null = null
  private busy = false
  private installing = false

  constructor(private readonly send: (channel: string, payload: unknown) => void) {
    // Repository is fixed at build time; never accept a feed URL or token from the renderer.
    autoUpdater.setFeedURL({ provider: 'github', owner: 'Taxperia', repo: 'LocalOps', private: false })
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.allowDowngrade = false
    autoUpdater.allowPrerelease = false
    autoUpdater.on('checking-for-update', () => this.publish({ state: 'checking' }))
    autoUpdater.on('update-not-available', () => this.publish({ state: 'up-to-date' }))
    autoUpdater.on('update-available', (info) => this.publish({ state: 'available', version: info.version }))
    autoUpdater.on('download-progress', (p) => this.publish({ ...this.status, state: 'downloading', percent: Math.round(p.percent) }))
    autoUpdater.on('update-downloaded', (info) => this.publish({ state: 'downloaded', version: info.version, percent: 100 }))
    autoUpdater.on('error', (error) => {
      this.installing = false
      this.publish({ state: 'error', error: error.message })
    })
  }

  private publish(status: UpdateStatus): void {
    this.status = status
    this.send(IPC.updateEvent, status)
  }

  getStatus(): UpdateStatus { return { ...this.status } }

  configure(enabled: boolean): void {
    this.stop()
    if (!app.isPackaged || !enabled) return
    this.initialTimer = setTimeout(() => void this.check(), 30_000)
    this.timer = setInterval(() => void this.check(), 4 * 60 * 60 * 1000)
    this.initialTimer.unref()
    this.timer.unref()
  }

  async check(): Promise<UpdateStatus> {
    if (!app.isPackaged || this.busy || ['available', 'downloading', 'downloaded'].includes(this.status.state)) return this.getStatus()
    this.busy = true
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      this.publish({ state: 'error', error: error instanceof Error ? error.message : String(error) })
    } finally { this.busy = false }
    return this.getStatus()
  }

  install(): ActionResult {
    if (this.status.state !== 'downloaded' || this.installing) return { ok: false, error: 'No downloaded update is ready.' }
    this.installing = true
    // Let the IPC response arrive before shutting down the renderer.
    setImmediate(() => autoUpdater.quitAndInstall(false, true))
    return { ok: true }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    if (this.initialTimer) clearTimeout(this.initialTimer)
    this.timer = this.initialTimer = null
  }
}
