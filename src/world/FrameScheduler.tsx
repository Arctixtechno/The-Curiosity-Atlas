import { advance, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { savingBattery, subscribeSettings } from './settings.ts'
import { gameStore } from './store.ts'

// Draws the world only as often as it needs to, to save battery. The canvas
// runs with frameloop="never" and this loop decides when to draw:
// - full speed (capped at 60 a second, even on 120 Hz screens) while the
//   player moves, looks round or walks between rooms
// - 30 a second while standing still, enough for water, fire and clocks
// - 10 a second on the start screen or when the window isn't focused
// - not at all behind a full-screen panel, which covers the world anyway

/** Frames per second for each state. */
export const RATES = { active: 60, idle: 30, background: 10, saver: 30 }
/** How long after the last key or mouse movement the player still counts as active, in ms. */
const ACTIVE_FOR_MS = 600
/** The longest step the world advances by in one frame, so a pause doesn't make things jump. */
const MAX_STEP = 0.1

let lastInput = -Infinity
let pendingFrames = 0
const heldKeys = new Set<string>()

/** Asks for the world to be drawn again soon, for example after a setting changes behind a panel. */
export function requestFrame(frames = 2) {
  pendingFrames = Math.max(pendingFrames, frames)
}

function noteInput() {
  lastInput = performance.now()
}

/** The frame rate the world wants right now, or 0 when nothing needs drawing. */
export function targetRate(now: number): number {
  const { overlay, isExploring, transitioning, viewing, journey } = gameStore.get()
  // The drive covers the screen, so the room behind it only needs enough frames to warm up.
  if (transitioning) return journey ? RATES.background : RATES.active
  if (overlay) return 0
  const cap = savingBattery() ? RATES.saver : RATES.active
  if (!document.hasFocus() || !isExploring) return RATES.background
  if (heldKeys.size > 0 || now - lastInput < ACTIVE_FOR_MS || viewing) return cap
  return Math.min(cap, RATES.idle)
}

/** How long to time frames for before judging whether the computer is keeping up, in ms. */
const SAMPLE_MS = 2000
/** Average gap between frames, in ms, above which the resolution drops, and below which it can rise. */
const SLOW_FRAME_MS = 24
const FAST_FRAME_MS = 18

/**
 * Runs the world's frame loop. `onPace` hears, every couple of seconds of
 * moving about, whether frames are keeping up, so the resolution can follow.
 */
export function FrameScheduler({ onPace }: { onPace?: (pace: 'slow' | 'fast') => void }) {
  const get = useThree((s) => s.get)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      heldKeys.add(e.code)
      noteInput()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      heldKeys.delete(e.code)
      noteInput()
    }
    const onBlur = () => heldKeys.clear()
    const onResize = () => requestFrame()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousemove', noteInput)
    window.addEventListener('wheel', noteInput)
    window.addEventListener('pointerdown', noteInput)
    window.addEventListener('blur', onBlur)
    window.addEventListener('resize', onResize)
    // Anything that changes what's on screen gets drawn, even behind a panel.
    const unsubscribeGame = gameStore.subscribe(() => requestFrame())
    const unsubscribeSettings = subscribeSettings(() => requestFrame())

    let frame = 0
    let lastDraw = performance.now()
    let time = 0
    // Frame timing, only while drawing at full speed: slower states say nothing about the computer.
    let sampleStart = 0
    let sampleFrames = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const rate = targetRate(now)
      const due = rate > 0 && now - lastDraw >= 1000 / rate - 2
      if (!due && pendingFrames === 0) return
      if (pendingFrames > 0) pendingFrames--
      const gap = now - lastDraw
      if (rate === RATES.active && gap < 200) {
        if (sampleFrames === 0) sampleStart = lastDraw
        sampleFrames++
        if (now - sampleStart > SAMPLE_MS) {
          const average = (now - sampleStart) / sampleFrames
          if (average > SLOW_FRAME_MS) onPace?.('slow')
          else if (average < FAST_FRAME_MS) onPace?.('fast')
          sampleFrames = 0
        }
      } else sampleFrames = 0
      time += Math.min(gap / 1000, MAX_STEP)
      lastDraw = now
      advance(time, true, get())
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', noteInput)
      window.removeEventListener('wheel', noteInput)
      window.removeEventListener('pointerdown', noteInput)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('resize', onResize)
      unsubscribeGame()
      unsubscribeSettings()
    }
  }, [get, onPace])

  return null
}
