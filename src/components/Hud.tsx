import { useEffect, useState } from 'react'
import { rooms } from '../rooms/registry.ts'
import { computeRoomStates } from '../world/navigation.ts'
import { useGame } from '../world/store.ts'
import './Hud.css'

// Conventional HTML overlay drawn on top of the 3D canvas.
export function Hud() {
  const isExploring = useGame((s) => s.isExploring)
  const transitioning = useGame((s) => s.transitioning)
  const prompt = useGame((s) => s.prompt)
  const activeRoomId = useGame((s) => s.activeRoomId)
  const toast = useGame((s) => s.toast)
  const overlay = useGame((s) => s.overlay)
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
      {isExploring ? (
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
      ) : (
        !overlay && <Intro />
      )}
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
        <h1>The Curiosity Atlas</h1>
        <p className="tagline">A small world built for endless curiosity.</p>
        <p className="start">Click anywhere to explore</p>
        <ul className="controls">
          <li>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> Move
          </li>
          <li>
            <kbd>Mouse</kbd> or <kbd>←</kbd>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <kbd>→</kbd> Look around
          </li>
          <li>
            <kbd>E</kbd> Open doors and interact
          </li>
          <li>
            <kbd>Shift</kbd> Walk faster
          </li>
          <li>
            <kbd>[</kbd>
            <kbd>]</kbd> Mouse sensitivity
          </li>
          <li>
            <kbd>Q</kbd> Release cursor (<kbd>Esc</kbd> also leaves full screen)
          </li>
        </ul>
      </div>
    </div>
  )
}
