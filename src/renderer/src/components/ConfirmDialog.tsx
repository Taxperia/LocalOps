import { useEffect } from 'react'
import { useUiStore } from '@/stores/ui'
import { useT } from '@/i18n'

export function ConfirmDialog() {
  const t = useT()
  const confirm = useUiStore((s) => s.confirm)
  const answer = useUiStore((s) => s.answerConfirm)

  useEffect(() => {
    if (!confirm.open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') answer(false)
      if (e.key === 'Enter') answer(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm.open, answer])

  if (!confirm.open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => answer(false)}>
      <div
        className="anim-pop w-[360px] rounded-lg border border-line bg-surface-2 p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[13.5px] font-semibold text-ink">{confirm.title}</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{confirm.message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => answer(false)}
            className="rounded-md border border-line px-3 py-1.5 text-[12px] text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => answer(true)}
            autoFocus
            className={`rounded-md px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 ${
              confirm.danger ? 'bg-danger' : 'bg-accent'
            }`}
          >
            {confirm.confirmLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
