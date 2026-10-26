import { useSyncExternalStore } from 'react'
import type { CduResult } from './cdu.ts'
import { measured } from './furnace.ts'
import type { Plant } from './plant.ts'

// Shift tasks for the crude unit: each is a condition the plant has to hold
// for a while, checked against the live simulation.

export interface Challenge {
  id: string
  title: string
  task: string
  /** A nudge for someone who's stuck. */
  hint: string
  /** Simulated seconds the condition has to hold. */
  hold: number
  met: (plant: Plant, result: CduResult) => boolean
}

const allOnSpec = (r: CduResult) => !r.starved && Object.values(r.products).every((p) => p.onSpec)

export const CHALLENGES: Challenge[] = [
  {
    id: 'lineout',
    title: 'Line out at 365 °C',
    task: 'With TIC-101 in automatic, raise the setpoint to 365 °C and hold the outlet within half a degree of it for five minutes.',
    hint: 'Change the setpoint and let the controller do the work. If it hunts up and down, lower the gain.',
    hold: 300,
    met: (p) => p.furnace.mode === 'auto' && Math.abs(p.furnace.setpoint - 365) < 0.05 && Math.abs(p.furnace.outlet - 365) < 0.5,
  },
  {
    id: 'manual',
    title: 'Fly it by hand',
    task: 'Put TIC-101 in manual and hold the outlet within a degree of 355 °C for five minutes, moving the fuel valve yourself.',
    hint: 'The outlet answers about half a minute after you move the valve, then takes minutes to settle. Make small moves and wait.',
    hold: 300,
    met: (p) => p.furnace.mode === 'manual' && !p.furnace.tripped && Math.abs(p.furnace.outlet - 355) < 1,
  },
  {
    id: 'jet',
    title: 'Maximise jet',
    task: 'Make at least 18% of the crude into kerosene with every product on spec.',
    hint: 'Kerosene can grow at both ends: take its front end from the naphtha (lower the top temperature) and its back end from the diesel. Watch the flash point and end point.',
    hold: 60,
    met: (_, r) => r.products.kerosene.percent >= 18 && allOnSpec(r),
  },
  {
    id: 'fouling',
    title: 'Fouled exchanger',
    task: 'Turn on preheat fouling (the crude reaches the furnace 15 °C cooler) and keep the outlet within a degree of its setpoint, in automatic, for ten minutes.',
    hint: 'In automatic the controller opens the fuel valve to make up the lost heat. Good tuning keeps the dip small.',
    hold: 600,
    met: (p) =>
      p.furnace.disturbances.fouling > 0 && p.furnace.mode === 'auto' && Math.abs(measured(p.furnace) - p.furnace.setpoint) < 1,
  },
  {
    id: 'maya',
    title: 'Heavy, sour crude',
    task: 'Switch to Maya and run with every product on spec and no dry draw trays.',
    hint: 'Maya has far less diesel in it than Brent. Draw what the crude actually holds.',
    hold: 60,
    met: (p, r) => p.furnace.crude === 'maya' && allOnSpec(r),
  },
  {
    id: 'margin',
    title: 'Best margin',
    task: 'Earn more than $2.00 a barrel on Brent with every product on spec.',
    hint: 'Jet and diesel are worth the most. Push them as far as their specs allow, and use stripping steam to rescue a flash point.',
    hold: 60,
    met: (p, r) => p.furnace.crude === 'brent' && allOnSpec(r) && r.economics.perBarrel > 2,
  },
]

const KEY = 'atlas.refinery.challenges'

function load(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

let done = load()
const listeners = new Set<() => void>()
/** When each challenge's condition started holding, in simulated seconds. */
const since = new Map<string, number>()

/** Checks every challenge against the plant; returns how far through its hold each one is (0 to 1). */
export function checkChallenges(plant: Plant, result: CduResult): Record<string, number> {
  const progress: Record<string, number> = {}
  for (const c of CHALLENGES) {
    if (done.has(c.id)) {
      progress[c.id] = 1
      continue
    }
    if (!c.met(plant, result)) {
      since.delete(c.id)
      progress[c.id] = 0
      continue
    }
    const start = since.get(c.id) ?? plant.furnace.time
    since.set(c.id, start)
    progress[c.id] = Math.min(1, (plant.furnace.time - start) / c.hold)
    if (progress[c.id] >= 1) complete(c.id)
  }
  return progress
}

function complete(id: string) {
  done = new Set(done).add(id)
  try {
    localStorage.setItem(KEY, JSON.stringify([...done]))
  } catch {
    // Storage can be unavailable; progress then lasts for this visit only.
  }
  listeners.forEach((l) => l())
}

export function useCompleted(): ReadonlySet<string> {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => done,
  )
}
