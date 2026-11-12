import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useUiStore, type Toast } from '@/stores/ui'

const ICONS: Record<Toast['kind'], React.ReactNode> = {
  info: <Info size={14} className="text-accent" />,
  success: <CheckCircle2 size={14} className="text-ok" />,
  error: <AlertTriangle size={14} className="text-danger" />,
  alert: <AlertTriangle size={14} className="text-warn" />
}

export function Toaster() {
  const toasts = useUiStore((s) => s.toasts)
  const dismiss = useUiStore((s) => s.dismissToast)
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-[300px] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="anim-fade flex items-start gap-2 rounded-lg border border-line bg-surface-2 p-3 shadow-xl"
        >
          <span className="mt-0.5">{ICONS[t.kind]}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium text-ink">{t.title}</div>
            {t.message ? <div className="mt-0.5 text-[11.5px] text-ink-3">{t.message}</div> : null}
          </div>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="text-ink-3 hover:text-ink"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
