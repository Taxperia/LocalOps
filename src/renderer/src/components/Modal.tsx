import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({ title, closeLabel, onClose, children }: {
  title: string; closeLabel: string; onClose: () => void; children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return (
    <dialog ref={ref} aria-labelledby={titleId} onCancel={(e) => { e.preventDefault(); onClose() }}
      onClick={(e) => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose() } }}
      className="m-auto max-h-[85vh] w-[900px] max-w-[calc(100vw-48px)] overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-2xl backdrop:bg-black/60">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <h2 id={titleId} className="text-[15px] font-semibold">{title}</h2>
        <button type="button" autoFocus aria-label={closeLabel} title={closeLabel} onClick={onClose}
          className="rounded-md p-1.5 text-ink-2 hover:bg-surface-3 hover:text-ink"><X size={16} /></button>
      </div>
      <div className="max-h-[calc(85vh-56px)] overflow-y-auto p-4">{children}</div>
    </dialog>
  )
}
