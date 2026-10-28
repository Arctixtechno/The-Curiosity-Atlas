import { useSyncExternalStore } from 'react'

// Touch screens have no keyboard and no mouse to lock, so phones and tablets
// get on-screen controls instead: a thumb stick to walk and a drag anywhere
// else to look. Touch mode switches on at the first touch and off again at the
// first mouse click, so a laptop with a touch screen works both ways.

/** What the on-screen controls are doing right now, read by the player each frame. */
export const touchInput = {
  /** The thumb stick, each axis from -1 to 1 (y is down the screen, so -1 walks forwards). */
  move: { x: 0, y: 0 },
  /** Look drag since the player last read it, in screen pixels. */
  look: { x: 0, y: 0 },
  /** Fingers on the stick or the look area, which keeps the world drawing at full speed. */
  held: 0,
}

let touchMode = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
const listeners = new Set<() => void>()

function setTouchMode(on: boolean) {
  if (touchMode === on) return
  touchMode = on
  listeners.forEach((l) => l())
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => setTouchMode(e.pointerType !== 'mouse'), true)
}

export const isTouchMode = () => touchMode

export function useTouchMode() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => touchMode,
  )
}

/** Presses and releases a key, for buttons that stand in for the keyboard. */
export function pressKey(code: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }))
  setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code })), 60)
}
