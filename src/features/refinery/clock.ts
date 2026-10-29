import { useEffect } from 'react'
import { advancePlant } from './plant.ts'

// One clock for the whole plant. Every refinery screen and the site itself
// ask for it while they're open; it runs while anyone has asked, so the plant
// keeps going as you walk between units, and stops when you leave.

/** How often the simulation hands the screens a new state, in ms. */
const TICK_MS = 100

let users = 0
let timer: ReturnType<typeof setInterval> | undefined
let last = 0

function start() {
  last = performance.now()
  timer = setInterval(() => {
    const now = performance.now()
    advancePlant(Math.min(1, (now - last) / 1000))
    last = now
  }, TICK_MS)
}

/** Keeps the plant clock running while the calling component is mounted. */
export function usePlantClock() {
  useEffect(() => {
    if (users++ === 0) start()
    return () => {
      if (--users === 0) clearInterval(timer)
    }
  }, [])
}
