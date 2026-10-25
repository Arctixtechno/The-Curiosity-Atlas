import { useSyncExternalStore } from 'react'

// Where things in the lounge show on screen once the visitor is seated, as
// fractions of the window: the companion's empty armchair, so the
// conversation screen can place the companion's presence over it, and the
// fire, whose light the screen keeps flickering while the 3D view rests.

export interface Point {
  x: number
  y: number
}

export interface SeatAnchors {
  companion: Point
  fire: Point
}

let anchors: SeatAnchors = { companion: { x: 0.32, y: 0.42 }, fire: { x: 0.12, y: 0.62 } }
const listeners = new Set<() => void>()

const near = (a: Point, b: Point) => Math.abs(a.x - b.x) < 1e-4 && Math.abs(a.y - b.y) < 1e-4

export function setSeatAnchors(next: SeatAnchors) {
  if (near(next.companion, anchors.companion) && near(next.fire, anchors.fire)) return
  anchors = next
  listeners.forEach((l) => l())
}

export function useSeatAnchors(): SeatAnchors {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    () => anchors,
  )
}
