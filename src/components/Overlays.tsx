import { CINEMA_OVERLAY, CinemaPanel } from '../features/cinema/CinemaPanel.tsx'
import { useGame } from '../world/store.ts'

/** Shows whichever full-screen panel is open. */
export function Overlays() {
  const overlay = useGame((s) => s.overlay)
  if (overlay === CINEMA_OVERLAY) return <CinemaPanel />
  return null
}
