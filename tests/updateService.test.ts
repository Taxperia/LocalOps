import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { updater, runtime, listeners } = vi.hoisted(() => {
  const listeners = new Map<string, (...args: any[]) => void>()
  return {
    runtime: { isPackaged: true }, listeners,
    updater: { setFeedURL: vi.fn(), on: vi.fn((event: string, fn: (...args: any[]) => void) => listeners.set(event, fn)),
      checkForUpdates: vi.fn(), quitAndInstall: vi.fn(), autoDownload: false, autoInstallOnAppQuit: true, allowDowngrade: true, allowPrerelease: true }
  }
})
vi.mock('electron', () => ({ app: runtime }))
vi.mock('electron-updater', () => ({ autoUpdater: updater }))
import { UpdateService } from '../src/main/services/updateService'

describe('GitHub updates', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); listeners.clear(); runtime.isPackaged = true })
  afterEach(() => vi.useRealTimers())
  it('uses the fixed public repository and requires an explicit installation', () => {
    const service = new UpdateService(vi.fn())
    expect(updater.setFeedURL).toHaveBeenCalledWith({ provider: 'github', owner: 'Taxperia', repo: 'LocalOps', private: false })
    expect(updater.autoInstallOnAppQuit).toBe(false)
    expect(updater.allowDowngrade).toBe(false)
    expect(updater.allowPrerelease).toBe(false)
    expect(service.install().ok).toBe(false)
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
  })
  it('publishes progress and installs only after download completion', async () => {
    const send = vi.fn()
    const service = new UpdateService(send)
    listeners.get('update-available')!({ version: '1.1.0' })
    listeners.get('download-progress')!({ percent: 45.7 })
    expect(service.getStatus()).toEqual({ state: 'downloading', version: '1.1.0', percent: 46 })
    expect(service.install().ok).toBe(false)
    listeners.get('update-downloaded')!({ version: '1.1.0' })
    expect(service.install().ok).toBe(true)
    expect(service.install().ok).toBe(false)
    await vi.runAllTimersAsync()
    expect(updater.quitAndInstall).toHaveBeenCalledExactlyOnceWith(false, true)
    expect(send).toHaveBeenCalled()
  })
  it('suppresses concurrent checks and keeps network failures recoverable', async () => {
    const service = new UpdateService(vi.fn())
    let finish!: () => void
    updater.checkForUpdates.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve }))
    const pending = service.check()
    await service.check()
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    finish(); await pending
    updater.checkForUpdates.mockRejectedValueOnce(new Error('offline'))
    expect(await service.check()).toEqual({ state: 'error', error: 'offline' })
  })
  it('cancels scheduled automatic checks when disabled', async () => {
    const service = new UpdateService(vi.fn())
    service.configure(true)
    service.configure(false)
    await vi.advanceTimersByTimeAsync(5 * 60 * 60 * 1000)
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
  })
  it('does not contact GitHub from development builds', async () => {
    runtime.isPackaged = false
    const service = new UpdateService(vi.fn())
    service.configure(true)
    expect(await service.check()).toEqual({ state: 'disabled' })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
  })
})
