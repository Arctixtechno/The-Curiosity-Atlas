import { useEffect } from 'react'
import { CINEMA_OVERLAY, CinemaPanel } from '../features/cinema/CinemaPanel.tsx'
import { toggleOverlay } from '../world/overlay.ts'
import { gameStore, useGame } from '../world/store.ts'
import { MAP_OVERLAY, MapPanel } from './MapPanel.tsx'
import { SETTINGS_OVERLAY, SettingsPanel } from './SettingsPanel.tsx'

/** Keys that open a panel from anywhere: M for the map, O for settings. */
const SHORTCUTS: Record<string, string> = { KeyM: MAP_OVERLAY, KeyO: SETTINGS_OVERLAY }

/** Shows whichever full-screen panel is open, and handles the keys that open them. */
export function Overlays() {
  const overlay = useGame((s) => s.overlay)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const id = SHORTCUTS[e.code]
      if (!id || e.repeat) return
      // Typing in a text box shouldn't open panels.
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]')) return
      const { overlay: open, isExploring } = gameStore.get()
      if (open === id || (!open && isExploring)) toggleOverlay(id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (overlay === CINEMA_OVERLAY) return <CinemaPanel />
  if (overlay === MAP_OVERLAY) return <MapPanel />
  if (overlay === SETTINGS_OVERLAY) return <SettingsPanel />
  return null
}
