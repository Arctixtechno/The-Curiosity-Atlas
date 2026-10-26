import { openOverlay } from '../../world/overlay.ts'
import { CITY_EXPLORER_OVERLAY } from './overlayId.ts'

// Opening the City Explorer at a particular place, e.g. from the roof
// terrace's spyglass. The panel picks the place up as it opens.

let pending: string | null = null

export function openCityExplorerAt(placeId: string) {
  pending = placeId
  openOverlay(CITY_EXPLORER_OVERLAY)
}

/** The place the explorer was asked to open at, if any. */
export function peekCityExplorerFocus() {
  return pending
}

/** Called once the explorer has opened at the place, so the next opening starts afresh. */
export function clearCityExplorerFocus() {
  pending = null
}
