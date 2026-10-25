import { useEffect, useState } from 'react'
import { rooms } from '../rooms/registry.ts'
import { computeRoomStates } from '../world/navigation.ts'
import { useGame } from '../world/store.ts'
import { openOverlay } from '../world/overlay.ts'
import { MAP_OVERLAY } from './MapPanel.tsx'
import { SETTINGS_OVERLAY } from './SettingsPanel.tsx'
import { GearIcon, MapIcon } from './icons.tsx'
import './Hud.css'
import './Panel.css'

// Conventional HTML overlay drawn on top of the 3D canvas.
export function Hud() {
  const isExploring = useGame((s) => s.isExploring)
  const transitioning = useGame((s) => s.transitioning)
  const prompt = useGame((s) => s.prompt)
  const activeRoomId = useGame((s) => s.activeRoomId)
  const toast = useGame((s) => s.toast)
  const overlay = useGame((s) => s.overlay)
  const viewing = useGame((s) => s.viewing)
  const [showRoomStates, setShowRoomStates] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Backquote') setShowRoomStates((v) => !v)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <div className={`fade${transitioning ? ' fade-active' : ''}`} aria-hidden="true" />
      <div className="room-name">{rooms[activeRoomId].displayName}</div>
      {showRoomStates && <RoomStates />}
      {toast && <div className="toast">{toast}</div>}
      {viewing === 'telescope' && <Eyepiece />}
      {isExploring
        ? !viewing && (
            <>
              <div className="crosshair" aria-hidden="true" />
              {prompt && (
                <div className="prompt" role="status">
                  {prompt.startsWith('Press E') ? (
                    <>
                      Press <kbd>E</kbd>
                      {prompt.slice('Press E'.length)}
                    </>
                  ) : (
                    prompt
                  )}
                </div>
              )}
            </>
          )
        : !overlay && <Intro />}
    </>
  )
}

/** The round field of view of a telescope eyepiece, with a reminder of the controls. */
function Eyepiece() {
  return (
    <>
      <div className="eyepiece" aria-hidden="true" />
      <div className="eyepiece-caption">
        Looking through the telescope · move the mouse to look around · scroll to zoom · <kbd>E</kbd> to step back
      </div>
    </>
  )
}

/** Developer view of the Room Manager (toggle with the ` key). */
function RoomStates() {
  const activeRoomId = useGame((s) => s.activeRoomId)
  const nearbyRoomIds = useGame((s) => s.nearbyRoomIds)
  const states = computeRoomStates(rooms, activeRoomId, nearbyRoomIds)
  return (
    <div className="room-states">
      <strong>Rooms</strong>
      <ul>
        {Object.entries(states).map(([id, state]) => (
          <li key={id} className={`state-${state}`}>
            {rooms[id].displayName}: {state}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Intro() {
  return (
    <div className="intro">
      <div className="intro-panel">
        <p className="intro-kicker">Welcome to</p>
        <h1>The Curiosity Atlas</h1>
        <p className="tagline">A small world built for endless curiosity.</p>
        {/* Not a real button: the click passes through to the world, which takes the mouse. */}
        <p className="start" aria-hidden="true">
          Click anywhere to explore
        </p>
        <div className="intro-actions">
          <button className="button button-quiet" onClick={(e) => (e.stopPropagation(), openOverlay(SETTINGS_OVERLAY))}>
            <GearIcon size={16} /> Settings
          </button>
          <button className="button button-quiet" onClick={(e) => (e.stopPropagation(), openOverlay(MAP_OVERLAY))}>
            <MapIcon size={16} /> Map
          </button>
        </div>
        <details className="how-to-play" onClick={(e) => e.stopPropagation()}>
          <summary>How to play</summary>
          <ul className="controls">
            <li>
              <span>
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd>
              </span>
              Move
            </li>
            <li>
              <span>
                <kbd>Mouse</kbd> or arrows
              </span>
              Look around
            </li>
            <li>
              <span>
                <kbd>E</kbd>
              </span>
              Open doors, sit, use things
            </li>
            <li>
              <span>
                <kbd>Shift</kbd>
              </span>
              Walk faster
            </li>
            <li>
              <span>
                <kbd>[</kbd>
                <kbd>]</kbd>
              </span>
              Mouse sensitivity
            </li>
            <li>
              <span>
                <kbd>M</kbd>
                <kbd>L</kbd>
                <kbd>O</kbd>
              </span>
              Map, Library, Settings
            </li>
            <li>
              <span>
                <kbd>Q</kbd>
              </span>
              <span className="control-note">
                Release the cursor (<kbd>Esc</kbd> also leaves full screen)
              </span>
            </li>
          </ul>
        </details>
      </div>
    </div>
  )
}
