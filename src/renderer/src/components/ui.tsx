import type { ReactNode } from 'react'
import { AlertTriangle, Check, Info, Loader2, X } from 'lucide-react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-line-soft bg-surface ${className}`}>{children}</div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1 basis-[160px]">
        <h1 className="truncate text-[15px] font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="truncate text-[12px] text-ink-3">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function EmptyState({ icon, message }: { icon?: ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-ink-3">
      {icon ?? <Info size={20} />}
      <span className="text-[12px]">{message}</span>
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-ink-3">
      <Loader2 size={16} className="animate-spin" />
      {label ? <span className="text-[12px]">{label}</span> : null}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2"
      aria-pressed={checked}
    >
      <span
        className={`relative inline-block h-[18px] w-[32px] rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-surface-3'
        }`}
      >
        <span
          className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all ${
            checked ? 'left-[16px]' : 'left-[2px]'
          }`}
        />
      </span>
      {label ? <span className="text-[12px] text-ink-2">{label}</span> : null}
    </button>
  )
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  display
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  label: string
  display: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[12px] text-ink-2">{label}</span>
        <span className="tnum text-[12px] text-ink">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-[var(--accent)]"
        style={{ accentColor: 'var(--accent)' }}
      />
    </div>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-line">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 text-[12px] transition-colors ${
            value === o.value ? 'bg-accent-soft text-ink' : 'text-ink-3 hover:bg-surface-2 hover:text-ink-2'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Select<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-accent"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-surface-2">
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Badge({
  children,
  tone = 'neutral'
}: {
  children: ReactNode
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'accent'
}) {
  const tones: Record<string, string> = {
    neutral: 'border-line text-ink-2',
    ok: 'border-ok/30 text-ok',
    warn: 'border-warn/30 text-warn',
    danger: 'border-danger/30 text-danger',
    accent: 'border-accent/40 text-accent'
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="shrink-0 text-[12px] text-ink-3">{label}</span>
      <span className="min-w-0 break-words text-right text-[12px] text-ink tnum">{children}</span>
    </div>
  )
}

export function ResultBadge({ status, signer }: { status: string; signer: string | null }) {
  const s = status.toLowerCase()
  if (s === 'valid') {
    return (
      <div className="space-y-1">
        <Badge tone="ok">
          <Check size={11} /> Valid
        </Badge>
        {signer ? <div className="break-all text-[11px] text-ink-3">{signer}</div> : null}
      </div>
    )
  }
  if (s === 'notsigned') {
    return <Badge tone="neutral">Not signed</Badge>
  }
  return (
    <div className="space-y-1">
      <Badge tone="warn">
        <AlertTriangle size={11} /> {status}
      </Badge>
      {signer ? <div className="break-all text-[11px] text-ink-3">{signer}</div> : null}
    </div>
  )
}

export function IconButton({
  onClick,
  title,
  children,
  active = false,
  danger = false
}: {
  onClick: () => void
  title: string
  children: ReactNode
  active?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
        active
          ? 'border-accent/40 bg-accent-soft text-accent'
          : 'border-line bg-surface-2 text-ink-2 hover:text-ink hover:border-ink-3/40'
      } ${danger ? 'hover:!border-danger/40 hover:!text-danger' : ''}`}
    >
      {children}
    </button>
  )
}

export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-3 hover:bg-surface-3 hover:text-ink"
    >
      <X size={14} />
    </button>
  )
}
