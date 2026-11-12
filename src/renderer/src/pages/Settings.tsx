import { useEffect, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { useT } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { api } from '@/lib/ipc'
import { Modal } from '@/components/Modal'
import { Badge, Card, KeyValue, Segmented, Select, Slider, Toggle } from '@/components/ui'
import { ACCENTS, INTERVAL_CHOICES, WIDGET_IDS } from '@shared/settingsSchema'
import type { AccentId, Locale, UpdateStatus } from '@shared/types'

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-ink-3">{title}</div>
      {children}
    </Card>
  )
}

const ACCENT_HEX: Record<AccentId, string> = {
  violet: '#7c7ff2',
  blue: '#4f8ef7',
  emerald: '#34c98e',
  amber: '#e6a23c',
  rose: '#ef6a8b'
}

export function SettingsModal() {
  const t = useT()
  const open = useUiStore((s) => s.settingsOpen)
  const close = useUiStore((s) => s.setSettingsOpen)
  if (!open) return null
  return <Modal title={t('settings.title')} closeLabel={t('common.close')} onClose={() => close(false)}><SettingsContent /></Modal>
}

function SettingsContent() {
  const t = useT()
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const pushToast = useUiStore((s) => s.pushToast)
  const appInfo = useUiStore((s) => s.appInfo)
  const [version, setVersion] = useState('—')

  useEffect(() => {
    void api
      .getAppInfo()
      .then((info) => setVersion(info.version))
      .catch(() => {})
  }, [])

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 min-[700px]:grid-cols-2">
        <SectionCard title={t('settings.general')}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] text-ink-2">{t('settings.language')}</span>
              <Select<Locale>
                value={settings.locale}
                onChange={(v) => void update({ locale: v })}
                options={[
                  { value: 'tr', label: 'Türkçe' },
                  { value: 'en', label: 'English' }
                ]}
              />
            </div>
            <div>
              <div className="mb-2 text-[12.5px] text-ink-2">{t('settings.accent')}</div>
              <div className="flex gap-2">
                {ACCENTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    title={t(`settings.accent.${a}` as never)}
                    onClick={() => void update({ accent: a })}
                    className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-105 ${
                      settings.accent === a ? 'border-ink' : 'border-transparent'
                    }`}
                    style={{ background: ACCENT_HEX[a] }}
                  />
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title={t('settings.monitoring')}>
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12.5px] text-ink-2">{t('settings.interval')}</span>
                <Segmented<number>
                  value={settings.intervalMs}
                  onChange={(v) => void update({ intervalMs: v })}
                  options={INTERVAL_CHOICES.map((ms) => ({ value: ms, label: `${ms / 1000} sn` }))}
                />
              </div>
              <p className="text-[11.5px] text-ink-3">{t('settings.intervalHint')}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title={t('settings.notifications')}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[12.5px] text-ink-2">{t('settings.notifications')}</div>
                <p className="text-[11.5px] text-ink-3">{t('settings.notificationsHint')}</p>
              </div>
              <Toggle
                checked={settings.notifications.enabled}
                onChange={(v) => void update({ notifications: { ...settings.notifications, enabled: v } })}
              />
            </div>
            <Slider
              label={t('settings.thresholdCpu')}
              value={settings.notifications.cpuPercent}
              min={10}
              max={100}
              onChange={(v) => void update({ notifications: { ...settings.notifications, cpuPercent: v } })}
              display={`${settings.notifications.cpuPercent}%`}
            />
            <Slider
              label={t('settings.thresholdMemory')}
              value={settings.notifications.memoryPercent}
              min={10}
              max={100}
              onChange={(v) => void update({ notifications: { ...settings.notifications, memoryPercent: v } })}
              display={`${settings.notifications.memoryPercent}%`}
            />
            <Slider
              label={t('settings.thresholdDisk')}
              value={settings.notifications.diskActivityPercent}
              min={10}
              max={100}
              onChange={(v) => void update({ notifications: { ...settings.notifications, diskActivityPercent: v } })}
              display={`${settings.notifications.diskActivityPercent}%`}
            />
            <Slider
              label={t('settings.cooldown')}
              value={settings.notifications.cooldownMinutes}
              min={1}
              max={60}
              onChange={(v) => void update({ notifications: { ...settings.notifications, cooldownMinutes: v } })}
              display={`${settings.notifications.cooldownMinutes} ${t('settings.minutes')}`}
            />
          </div>
        </SectionCard>

        <SectionCard title={t('settings.dashboardSection')}>
          <div className="mb-2 text-[12.5px] text-ink-2">{t('settings.widgets')}</div>
          <div className="space-y-1.5">
            {WIDGET_IDS.map((id) => {
              const w = settings.dashboard.widgets.find((x) => x.id === id)
              const visible = w?.visible ?? true
              return (
                <div key={id} className="flex items-center justify-between">
                  <span className="text-[12.5px] text-ink-2">{t(`widget.${id}` as never)}</span>
                  <Toggle
                    checked={visible}
                    onChange={() => {
                      const next = settings.dashboard.widgets.map((x) =>
                        x.id === id ? { ...x, visible: !x.visible } : x
                      )
                      void update({ dashboard: { widgets: next } })
                    }}
                  />
                </div>
              )
            })}
          </div>
        </SectionCard>

        <UpdateCard />

        <SectionCard title={t('settings.about')}>
          <div className="space-y-0.5">
            <KeyValue label={t('settings.version')}>{version}</KeyValue>
            <KeyValue label={t('settings.electron')}>{appInfo?.electron ?? '—'}</KeyValue>
            <KeyValue label={t('settings.node')}>{appInfo?.node ?? '—'}</KeyValue>
            <KeyValue label={t('settings.chrome')}>{appInfo?.chrome ?? '—'}</KeyValue>
            <KeyValue label={t('settings.elevated')}>
              {appInfo?.isElevated ? (
                <Badge tone="ok">{t('settings.elevatedYes')}</Badge>
              ) : (
                <Badge tone="warn">{t('settings.elevatedNo')}</Badge>
              )}
            </KeyValue>
          </div>
          <button
            type="button"
            onClick={() => {
              void api.openDataFolder().catch(() => pushToast({ kind: 'error', title: t('err.generic') }))
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink-2 transition-colors hover:text-ink"
          >
            <FolderOpen size={13} />
            {t('settings.openDataFolder')}
          </button>
        </SectionCard>
      </div>
    </div>
  )
}

function UpdateCard() {
  const t = useT()
  const enabled = useSettingsStore((s) => s.settings.autoCheckUpdates)
  const update = useSettingsStore((s) => s.update)
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
  const [pending, setPending] = useState(false)
  const pushToast = useUiStore((s) => s.pushToast)
  useEffect(() => {
    let active = true
    const unsubscribe = api.onUpdateStatus((next) => { if (active) setStatus(next) })
    void api.getUpdateStatus().then((next) => { if (active) setStatus(next) }).catch(() => {})
    return () => { active = false; unsubscribe() }
  }, [])
  const check = async () => {
    setPending(true)
    try { setStatus(await api.checkForUpdates()) }
    catch { setStatus({ state: 'error' }) }
    finally { setPending(false) }
  }
  return <SectionCard title={t('updates.title')}>
    <div className="space-y-3">
      <Toggle checked={enabled} onChange={(autoCheckUpdates) => void update({ autoCheckUpdates })} label={t('updates.automatic')} />
      <p className="text-[11.5px] text-ink-3">{t('updates.hint')}</p>
      <p role="status" className="text-[12px] text-ink-2">{t(`updates.${status.state}`)}{status.version ? ` · ${status.version}` : ''}{status.percent != null ? ` · ${status.percent}%` : ''}</p>
      {status.state === 'downloading' ? <progress aria-label={t('updates.downloading')} max={100} value={status.percent ?? 0} className="w-full accent-accent" /> : null}
      <button type="button" disabled={pending || ['disabled', 'checking', 'available', 'downloading', 'downloaded'].includes(status.state)}
        onClick={() => void check()} className="rounded-md border border-line bg-surface-2 px-3 py-1.5 text-[12px] text-ink-2 hover:text-ink disabled:opacity-40">{t('updates.check')}</button>
      {status.state === 'downloaded' ? <button type="button" className="ml-2 rounded-md bg-accent px-3 py-1.5 text-[12px] text-white"
        onClick={() => { void api.installUpdate().then((result) => { if (!result.ok) pushToast({ kind: 'error', title: t('updates.error'), message: result.error }) }).catch(() => pushToast({ kind: 'error', title: t('updates.error') })) }}>{t('updates.install')}</button> : null}
    </div>
  </SectionCard>
}
