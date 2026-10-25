import { useEffect } from 'react'
import { toggleOverlay } from '../world/overlay.ts'
import { useGame } from '../world/store.ts'
import './FeaturePanels.css'

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement

/** L opens or closes the Library of Discoveries from anywhere, with a small reminder while exploring. */
export function LibraryShortcut() {
  const isExploring = useGame((s) => s.isExploring)
  const overlay = useGame((s) => s.overlay)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyL' && !e.repeat && !isTyping(e.target)) toggleOverlay('library')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return isExploring && !overlay ? (
    <div className="library-hint" aria-hidden="true">
      <kbd>L</kbd> Library
    </div>
  ) : null
}
