import { lazy, Suspense, useEffect } from 'react'
import { CINEMA_OVERLAY, CinemaPanel } from '../features/cinema/CinemaPanel.tsx'
import { FountainPanel } from '../features/discoveries/FountainPanel.tsx'
import { LibraryPanel } from '../features/library/LibraryPanel.tsx'
import { LoungePanel } from '../features/philosophy/LoungePanel.tsx'
import { CAFE_OVERLAY } from '../features/cafe/overlayId.ts'
import { BUOYANCY_OVERLAY, GAS_OVERLAY } from '../features/experiments/overlayIds.ts'
import { CIRCUIT_OVERLAY, GEARS_OVERLAY } from '../features/workshop/overlayIds.ts'
import { SOLAR_OVERLAY } from '../features/solar/overlayId.ts'
import { CDU_OVERLAY, CONVERSION_OVERLAY, OVERVIEW_OVERLAY, REFORMER_OVERLAY, TREATING_OVERLAY } from '../features/refinery/overlayIds.ts'
import { exhibitFromOverlay } from '../features/museum/overlayId.ts'
import { CITY_EXPLORER_OVERLAY } from '../features/tourism/overlayId.ts'
import { toggleOverlay } from '../world/overlay.ts'
import { gameStore, useGame } from '../world/store.ts'
import { MAP_OVERLAY, MapPanel } from './MapPanel.tsx'
import { PanelLoading } from './Panel.tsx'
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
const SolarSystemPanel = lazy(() =>
  import('../features/solar/SolarSystemPanel.tsx').then((m) => ({ default: m.SolarSystemPanel })),
)
const CduPanel = lazy(() => import('../features/refinery/CduPanel.tsx').then((m) => ({ default: m.CduPanel })))
const ConversionPanel = lazy(() => import('../features/refinery/ConversionPanel.tsx').then((m) => ({ default: m.ConversionPanel })))
const ReformerPanel = lazy(() => import('../features/refinery/ReformerPanel.tsx').then((m) => ({ default: m.ReformerPanel })))
const TreatingPanel = lazy(() => import('../features/refinery/TreatingPanel.tsx').then((m) => ({ default: m.TreatingPanel })))
const OverviewPanel = lazy(() => import('../features/refinery/OverviewPanel.tsx').then((m) => ({ default: m.OverviewPanel })))
const BuoyancyPanel = lazy(() => import('../features/experiments/BuoyancyPanel.tsx').then((m) => ({ default: m.BuoyancyPanel })))

/** Keys that open a panel from anywhere: M for the map, O for settings, L for the library. */
const SHORTCUTS: Record<string, string> = { KeyM: MAP_OVERLAY, KeyO: SETTINGS_OVERLAY, KeyL: 'library' }

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
  if (overlay === 'fountain') return <FountainPanel />
  if (overlay === 'library') return <LibraryPanel />
  if (overlay === 'lounge') return <LoungePanel />
  if (overlay === MAP_OVERLAY) return <MapPanel />
  if (overlay === SETTINGS_OVERLAY) return <SettingsPanel />
  const exhibit = exhibitFromOverlay(overlay)
  if (exhibit)
    return (
      <Suspense fallback={<PanelLoading />}>
        <ExhibitPanel key={exhibit} id={exhibit} />
      </Suspense>
    )
  const Lazy = {
    [CITY_EXPLORER_OVERLAY]: CityExplorerPanel,
    [GAS_OVERLAY]: GasPanel,
    [BUOYANCY_OVERLAY]: BuoyancyPanel,
    [CAFE_OVERLAY]: CafePanel,
    [SOLAR_OVERLAY]: SolarSystemPanel,
    [GEARS_OVERLAY]: GearPanel,
    [CIRCUIT_OVERLAY]: CircuitPanel,
    [CDU_OVERLAY]: CduPanel,
    [CONVERSION_OVERLAY]: ConversionPanel,
    [OVERVIEW_OVERLAY]: OverviewPanel,
    [REFORMER_OVERLAY]: ReformerPanel,
    [TREATING_OVERLAY]: TreatingPanel,
  }[overlay ?? '']
  if (Lazy)
    return (
      <Suspense fallback={<PanelLoading />}>
        <Lazy />
      </Suspense>
    )
  return null
}
