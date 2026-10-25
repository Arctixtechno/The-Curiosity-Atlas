import { lazy, Suspense, useEffect } from 'react'
import { CINEMA_OVERLAY, CinemaPanel } from '../features/cinema/CinemaPanel.tsx'
import { CAFE_OVERLAY } from '../features/cafe/overlayId.ts'
import { BUOYANCY_OVERLAY, GAS_OVERLAY } from '../features/experiments/overlayIds.ts'
import { CIRCUIT_OVERLAY, GEARS_OVERLAY } from '../features/workshop/overlayIds.ts'
import { exhibitFromOverlay } from '../features/museum/overlayId.ts'
import { CITY_EXPLORER_OVERLAY } from '../features/tourism/overlayId.ts'
import { toggleOverlay } from '../world/overlay.ts'
import { gameStore, useGame } from '../world/store.ts'
import { MAP_OVERLAY, MapPanel } from './MapPanel.tsx'
import { SETTINGS_OVERLAY, SettingsPanel } from './SettingsPanel.tsx'

// Panels that only some rooms use load when first opened: the London map pulls in Leaflet.
const CityExplorerPanel = lazy(() =>
  import('../features/tourism/CityExplorerPanel.tsx').then((m) => ({ default: m.CityExplorerPanel })),
)

const GasPanel = lazy(() => import('../features/experiments/GasPanel.tsx').then((m) => ({ default: m.GasPanel })))
const CafePanel = lazy(() => import('../features/cafe/CafePanel.tsx').then((m) => ({ default: m.CafePanel })))
const ExhibitPanel = lazy(() => import('../features/museum/ExhibitPanel.tsx').then((m) => ({ default: m.ExhibitPanel })))
const GearPanel = lazy(() => import('../features/workshop/GearPanel.tsx').then((m) => ({ default: m.GearPanel })))
const CircuitPanel = lazy(() => import('../features/workshop/CircuitPanel.tsx').then((m) => ({ default: m.CircuitPanel })))
const BuoyancyPanel = lazy(() => import('../features/experiments/BuoyancyPanel.tsx').then((m) => ({ default: m.BuoyancyPanel })))

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
  const exhibit = exhibitFromOverlay(overlay)
  if (exhibit)
    return (
      <Suspense fallback={null}>
        <ExhibitPanel key={exhibit} id={exhibit} />
      </Suspense>
    )
  const Lazy = {
    [CITY_EXPLORER_OVERLAY]: CityExplorerPanel,
    [GAS_OVERLAY]: GasPanel,
    [BUOYANCY_OVERLAY]: BuoyancyPanel,
    [CAFE_OVERLAY]: CafePanel,
    [GEARS_OVERLAY]: GearPanel,
    [CIRCUIT_OVERLAY]: CircuitPanel,
  }[overlay ?? '']
  if (Lazy)
    return (
      <Suspense fallback={null}>
        <Lazy />
      </Suspense>
    )
  return null
}
