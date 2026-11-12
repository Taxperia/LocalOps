import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface MenuItem {
  label: string
  icon?: LucideIcon
  danger?: boolean
  disabled?: boolean
  onClick?: () => void
  submenu?: MenuItem[]
}

interface Position {
  x: number
  y: number
}

export function ContextMenu({
  position,
  items,
  onClose
}: {
  position: Position
  items: MenuItem[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [openSub, setOpenSub] = useState<number | null>(null)
  const [adjusted, setAdjusted] = useState<Position>(position)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.min(position.x, window.innerWidth - rect.width - 8)
    const y = Math.min(position.y, window.innerHeight - rect.height - 8)
    setAdjusted({ x: Math.max(4, x), y: Math.max(4, y) })
  }, [position])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }}>
      <div
        ref={ref}
        className="anim-pop absolute min-w-[190px] rounded-lg border border-line bg-surface-2 py-1 shadow-2xl"
        style={{ left: adjusted.x, top: adjusted.y }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((item, i) => {
          const Icon = item.icon
          if (item.submenu) {
            const isOpen = openSub === i
            return (
              <div
                key={i}
                className="relative"
                onMouseEnter={() => setOpenSub(i)}
                onMouseLeave={() => setOpenSub(null)}
              >
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-ink-2 hover:bg-surface-3 hover:text-ink ${
                    item.danger ? 'hover:!text-danger' : ''
                  }`}
                >
                  {Icon ? <Icon size={13} /> : null}
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight size={12} className="text-ink-3" />
                </button>
                {isOpen ? (
                  <div className="anim-pop absolute right-full top-0 min-w-[170px] rounded-lg border border-line bg-surface-2 py-1 shadow-2xl">
                    {item.submenu.map((sub, j) => (
                      <button
                        key={j}
                        type="button"
                        disabled={sub.disabled}
                        onClick={() => {
                          sub.onClick?.()
                          onClose()
                        }}
                        className={`flex w-full items-center px-3 py-1.5 text-left text-[12px] text-ink-2 hover:bg-surface-3 hover:text-ink disabled:opacity-40 ${
                          sub.danger ? 'hover:!text-danger' : ''
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          }
          return (
            <button
              key={i}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                item.onClick?.()
                onClose()
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-ink-2 hover:bg-surface-3 hover:text-ink disabled:opacity-40 ${
                item.danger ? 'hover:!text-danger' : ''
              }`}
            >
              {Icon ? <Icon size={13} /> : null}
              {item.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
