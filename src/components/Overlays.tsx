import { CINEMA_OVERLAY, CinemaPanel } from '../features/cinema/CinemaPanel.tsx'
import { FountainPanel } from '../features/discoveries/FountainPanel.tsx'
import { LibraryPanel } from '../features/library/LibraryPanel.tsx'
import { LoungePanel } from '../features/philosophy/LoungePanel.tsx'
import { useGame } from '../world/store.ts'

/** Shows whichever full-screen panel is open. */
export function Overlays() {
  const overlay = useGame((s) => s.overlay)
  if (overlay === CINEMA_OVERLAY) return <CinemaPanel />
  if (overlay === 'fountain') return <FountainPanel />
  if (overlay === 'library') return <LibraryPanel />
  if (overlay === 'lounge') return <LoungePanel />
  return null
}
