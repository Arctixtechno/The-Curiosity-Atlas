import { openOverlay } from '../../world/overlay.ts'
import { CITY_EXPLORER_OVERLAY } from './overlayId.ts'

// Opening the City Explorer at a particular place, e.g. from the roof
// terrace's spyglass. The panel picks the place up as it opens.

let pending: string | null = null

export function openCityExplorerAt(placeId: string) {
  pending = placeId
  openOverlay(CITY_EXPLORER_OVERLAY)
}

/** The place the explorer was asked to open at, once; null after that. */
export function takeCityExplorerFocus() {
  const id = pending
  pending = null
  return id
}
