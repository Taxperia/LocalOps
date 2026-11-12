import fs from 'node:fs'
import path from 'node:path'
import { cloneSettings, sanitizePatch, sanitizeSettings } from '@shared/settingsSchema'
import type { AppSettings } from '@shared/types'

export class SettingsStore {
  private data: AppSettings
  private listeners = new Set<(s: AppSettings) => void>()

  constructor(private readonly file: string) {
    this.data = this.load()
  }

  static forDir(dir: string): SettingsStore {
    return new SettingsStore(path.join(dir, 'settings.json'))
  }

  private load(): AppSettings {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf-8'))
      return sanitizeSettings(raw)
    } catch {
      return cloneSettings(sanitizeSettings(null))
    }
  }

  get(): AppSettings {
    return this.data
  }

  update(patch: unknown): AppSettings {
    const valid = sanitizePatch(patch)
    this.data = {
      ...this.data,
      ...valid,
      notifications: valid.notifications
        ? { ...this.data.notifications, ...valid.notifications }
        : this.data.notifications,
      dashboard: valid.dashboard ? valid.dashboard : this.data.dashboard
    }
    this.save()
    this.emit()
    return this.data
  }

  replace(next: AppSettings): void {
    this.data = cloneSettings(next)
    this.save()
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (err) {
      console.error('[settings] save failed:', err)
    }
  }

  onChange(fn: (s: AppSettings) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.data)
  }
}
