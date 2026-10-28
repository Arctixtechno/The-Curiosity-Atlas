import { useRef, useState } from 'react'
import { gameStore, useGame } from '../world/store.ts'
import { openOverlay } from '../world/overlay.ts'
import { pressKey, touchInput } from '../world/touch.ts'
import { MAP_OVERLAY } from './MapPanel.tsx'
import { CloseIcon, MapIcon } from './icons.tsx'
import './TouchControls.css'

/** Keeps a finger's moves coming to this control even once it slides off it. Some browsers refuse; it still works without. */
function capture(e: React.PointerEvent) {
  try {
    e.currentTarget.setPointerCapture(e.pointerId)
  } catch {
    // Carry on without capture.
  }
}

/** How far the thumb stick's knob can travel from the middle, in pixels. */
const STICK_REACH = 46

/** The thumb stick: lean it to walk, further to walk faster. */
function Stick() {
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const centre = useRef({ x: 0, y: 0, id: -1 })
  const follow = (e: React.PointerEvent) => {
    if (e.pointerId !== centre.current.id) return
    let x = e.clientX - centre.current.x
    let y = e.clientY - centre.current.y
    const d = Math.hypot(x, y)
    if (d > STICK_REACH) {
      x *= STICK_REACH / d
      y *= STICK_REACH / d
    }
    setKnob({ x, y })
    touchInput.move.x = x / STICK_REACH
    touchInput.move.y = y / STICK_REACH
  }
  const release = (e: React.PointerEvent) => {
    if (e.pointerId !== centre.current.id) return
    centre.current.id = -1
    touchInput.held--
    touchInput.move.x = touchInput.move.y = 0
    setKnob({ x: 0, y: 0 })
  }
  return (
    <div
      className="touch-stick"
      onPointerDown={(e) => {
        const box = e.currentTarget.getBoundingClientRect()
        centre.current = { x: box.left + box.width / 2, y: box.top + box.height / 2, id: e.pointerId }
        touchInput.held++
        capture(e)
        follow(e)
      }}
      onPointerMove={follow}
      onPointerUp={release}
      onPointerCancel={release}
      aria-hidden="true"
    >
      <span style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  )
}

/** Turns the prompt's "Press E to…" into "Tap to…". */
const tapPrompt = (prompt: string) => (prompt.startsWith('Press E to ') ? `Tap to ${prompt.slice('Press E to '.length)}` : prompt)

/**
 * On-screen controls for phones and tablets: a thumb stick bottom left, drag
 * anywhere else to look, tap the prompt to use what's in front of you, and
 * buttons for the map and to pause.
 */
export function TouchControls() {
  const prompt = useGame((s) => s.prompt)
  const viewing = useGame((s) => s.viewing)
  const drag = useRef(new Map<number, { x: number; y: number }>())

  const look = {
    onPointerDown: (e: React.PointerEvent) => {
      drag.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      touchInput.held++
      capture(e)
    },
    onPointerMove: (e: React.PointerEvent) => {
      const last = drag.current.get(e.pointerId)
      if (!last) return
      touchInput.look.x += e.clientX - last.x
      touchInput.look.y += e.clientY - last.y
      drag.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (drag.current.delete(e.pointerId)) touchInput.held--
    },
  }

  return (
    <div className="touch-controls">
      <div className="touch-look" {...look} onPointerCancel={look.onPointerUp} />
      {!viewing && <Stick />}
      <div className="touch-buttons">
        <button className="touch-button" onClick={() => openOverlay(MAP_OVERLAY)} aria-label="Map">
          <MapIcon />
        </button>
        <button
          className="touch-button"
          onClick={() => gameStore.set(viewing ? { viewing: null } : { isExploring: false, prompt: null })}
          aria-label={viewing ? 'Step back' : 'Pause'}
        >
          {viewing ? <CloseIcon /> : <PauseIcon />}
        </button>
      </div>
      {prompt && (
        <button className="prompt touch-prompt" onClick={() => pressKey('KeyE')}>
          {tapPrompt(prompt)}
        </button>
      )}
    </div>
  )
}

function PauseIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}
