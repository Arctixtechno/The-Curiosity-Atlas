import { useEffect } from 'react'
import { useGame } from '../world/store.ts'
import { FountainPanel } from './discoveries/FountainPanel.tsx'
import { LibraryPanel } from './library/LibraryPanel.tsx'
import { LoungePanel } from './philosophy/LoungePanel.tsx'
import { closePanel, openPanel, useOpenPanel, type PanelId } from './panels.ts'
import './FeaturePanels.css'

const PANEL_NAMES: Record<PanelId, string> = {
  fountain: 'Discovery Fountain',
  library: 'Library of Discoveries',
  lounge: 'Philosophy Lounge',
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement

/**
 * HTML overlay for the central features (Discovery Fountain, Library,
 * Philosophy Lounge). Sits
 * above the HUD; L opens the Library from anywhere, Escape closes a panel.
 */
export function FeaturePanels() {
  const panel = useOpenPanel()
  const isExploring = useGame((s) => s.isExploring)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && panel) closePanel()
      if (e.code === 'KeyL' && !e.repeat && !isTyping(e.target)) {
        if (panel === 'library') closePanel(true)
        else openPanel('library')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [panel])

  if (!panel) {
    return isExploring ? (
      <div className="library-hint" aria-hidden="true">
        <kbd>L</kbd> Library
      </div>
    ) : null
  }

  return (
    // Clicks inside must not reach the document, where they would recapture the mouse.
    <div className="feature-backdrop" onClick={(e) => (e.stopPropagation(), e.target === e.currentTarget && closePanel(true))}>
      <section className="feature-panel" role="dialog" aria-modal="true" aria-label={PANEL_NAMES[panel]}>
        <button className="panel-close" onClick={() => closePanel(true)} aria-label="Close and keep exploring">
          ×
        </button>
        {panel === 'fountain' && <FountainPanel />}
        {panel === 'library' && <LibraryPanel />}
        {panel === 'lounge' && <LoungePanel />}
      </section>
    </div>
  )
}
