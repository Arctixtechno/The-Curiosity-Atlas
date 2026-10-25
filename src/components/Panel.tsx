import { useEffect, useRef, type ReactNode } from 'react'
import { closeOverlay } from '../world/overlay.ts'
import './Panel.css'

/**
 * A full-screen panel over the world, for menus like the film list or the
 * settings. Clicks inside don't reach the world (which would grab the mouse),
 * and Escape or the close button returns to exploring. Keyboard focus moves
 * into the panel when it opens and Tab keeps it there until it closes.
 */
export function Panel({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  const dialog = useRef<HTMLElement>(null)
  useEffect(() => {
    dialog.current?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') closeOverlay()
      if (e.code !== 'Tab' || !dialog.current) return
      const focusable = dialog.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const inside = dialog.current.contains(document.activeElement)
      if (e.shiftKey && (!inside || document.activeElement === first || document.activeElement === dialog.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  return (
    <div className="panel-backdrop" onClick={(e) => e.stopPropagation()}>
      <section
        ref={dialog}
        className={`panel${wide ? ' panel-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header className="panel-header">
          <h2>{title}</h2>
          <button className="panel-close" onClick={closeOverlay} aria-label="Close and carry on exploring">
            ×
          </button>
        </header>
        <div className="panel-body">{children}</div>
      </section>
    </div>
  )
}
