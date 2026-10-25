import { useEffect, type ReactNode } from 'react'
import { closeOverlay } from '../world/overlay.ts'
import './Panel.css'

/**
 * A full-screen panel over the world, for menus like the film list or the
 * settings. Clicks inside don't reach the world (which would grab the mouse),
 * and Escape or the close button returns to exploring.
 */
export function Panel({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') closeOverlay()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  return (
    <div className="panel-backdrop" onClick={(e) => e.stopPropagation()}>
      <section className={`panel${wide ? ' panel-wide' : ''}`} role="dialog" aria-label={title}>
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
