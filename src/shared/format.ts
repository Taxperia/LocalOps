export type FormatLocale = 'tr' | 'en'

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

function intl(locale: FormatLocale, digits: number): Intl.NumberFormat {
  return new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0
  })
}

export function formatBytes(bytes: number | null | undefined, locale: FormatLocale = 'tr', digits = 1): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  return `${intl(locale, digits).format(value)} ${UNITS[unit]}`
}

export function formatRate(bytesPerSec: number | null | undefined, locale: FormatLocale = 'tr', digits = 1): string {
  if (bytesPerSec == null || !Number.isFinite(bytesPerSec) || bytesPerSec < 0) return '—'
  return `${formatBytes(bytesPerSec, locale, digits)}/s`
}

export function formatPercent(p: number | null | undefined, locale: FormatLocale = 'tr', digits = 0): string {
  if (p == null || !Number.isFinite(p)) return '—'
  return `${intl(locale, digits).format(p)}%`
}

export function formatNumber(n: number | null | undefined, locale: FormatLocale = 'tr', digits = 0): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return intl(locale, digits).format(n)
}

export function formatDuration(sec: number | null | undefined, locale: FormatLocale = 'tr'): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '—'
  const labels = locale === 'tr'
    ? ['g', 'sa', 'dk', 'sn']
    : ['d', 'h', 'm', 's']
  const values = [
    Math.floor(sec / 86400),
    Math.floor((sec % 86400) / 3600),
    Math.floor((sec % 3600) / 60),
    Math.floor(sec % 60)
  ]
  const parts: string[] = []
  let started = false
  for (let i = 0; i < values.length; i++) {
    if (values[i] > 0 || started) {
      started = true
      parts.push(`${values[i]}${labels[i]}`)
    }
    if (parts.length >= 3) break
  }
  return parts.length > 0 ? parts.join(' ') : `0${labels[3]}`
}

function localeTag(locale: FormatLocale): string {
  return locale === 'tr' ? 'tr-TR' : 'en-US'
}

export function formatDateTime(ms: number | null | undefined, locale: FormatLocale = 'tr'): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  return new Intl.DateTimeFormat(localeTag(locale), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ms))
}

export function formatTime(ms: number | null | undefined, locale: FormatLocale = 'tr'): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  const d = new Date(ms)
  const sameDay = new Date().toDateString() === d.toDateString()
  if (sameDay) {
    return new Intl.DateTimeFormat(localeTag(locale), { timeStyle: 'medium' }).format(d)
  }
  return new Intl.DateTimeFormat(localeTag(locale), { dateStyle: 'short', timeStyle: 'short' }).format(d)
}

export function formatClock(mhz: number | null | undefined): string {
  if (mhz == null || !Number.isFinite(mhz) || mhz <= 0) return '—'
  if (mhz >= 1000) return `${(mhz / 1000).toFixed(2)} GHz`
  return `${Math.round(mhz)} MHz`
}
