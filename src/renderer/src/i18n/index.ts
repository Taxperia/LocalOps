import { useMemo } from 'react'
import { useSettingsStore } from '@/stores/settings'
import { tr } from './tr'
import { en } from './en'

const dicts: Record<'tr' | 'en', Record<string, string>> = { tr, en }

export type TKey = keyof typeof tr

export function tFor(locale: 'tr' | 'en') {
  return (key: TKey, vars?: Record<string, string | number>): string => {
    let s = dicts[locale][key] ?? dicts.tr[key] ?? String(key)
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replaceAll(`{${k}}`, String(v))
      }
    }
    return s
  }
}

export function useT() {
  const locale = useSettingsStore((s) => s.settings.locale)
  return useMemo(() => tFor(locale), [locale])
}
