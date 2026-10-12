import { useEffect, useId, useRef, useState } from 'react'

export interface FileMenuAction {
  label: string
  hint?: string
  onSelect: () => void
  separatorBefore?: boolean
}

/** Small accessible dropdown ("File" menu): arrow keys, Escape, click-outside. */
export function FileMenu({ actions }: { actions: FileMenuAction[] }) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (!open) return
    itemRefs.current[0]?.focus()
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[]
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[next]?.focus()
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false)
      if (e.key === 'Escape') buttonRef.current?.focus()
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="btn-secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        File
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="File"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {actions.map((action, i) => (
            <div key={action.label}>
              {action.separatorBefore && <div role="separator" className="my-1 border-t border-slate-100" />}
              <button
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
                onClick={() => {
                  setOpen(false)
                  action.onSelect()
                }}
              >
                <span>{action.label}</span>
                {action.hint && <span className="text-xs text-slate-400">{action.hint}</span>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
