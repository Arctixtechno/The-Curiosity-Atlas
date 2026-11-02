import { useSyncExternalStore } from 'react'
import { controls, getPlant, type Plant } from './plant.ts'
import { finishRun, sampleRun, SHIFTS, startRun, type ShiftResult, type ShiftRun } from './shifts.ts'
import { siteBalance } from './site.ts'

// The shift that's running, its referee, and the best result for each shift.
// When a shift starts, the plant as you left it is kept aside (in the browser
// too, in case the page closes) and put back when the shift ends.

export interface ShiftState {
  active: ShiftRun | null
  /** Things that have happened this shift, newest last. */
  log: { at: number; text: string }[]
  /** The last shift's report, until it's closed. */
  result: ShiftResult | null
  best: Record<string, number>
  played: number
}

const KEY = 'curiosity-atlas:refinery:shifts:v1'
const SNAPSHOT_KEY = 'curiosity-atlas:refinery:shift-snapshot:v1'
const EMPTY: ShiftState = { active: null, log: [], result: null, best: {}, played: 0 }

function load(): ShiftState {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null') as Partial<ShiftState> | null
    return { ...EMPTY, best: saved?.best ?? {}, played: saved?.played ?? 0 }
  } catch {
    return EMPTY
  }
}

let state = load()
const listeners = new Set<() => void>()
/** The plant as it was before the shift. */
let kept: Plant | null = null

function set(next: ShiftState) {
  state = next
  listeners.forEach((l) => l())
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ best: state.best, played: state.played }))
  } catch {
    // Storage blocked: scores last until the page closes.
  }
}

function keep(p: Plant | null) {
  kept = p
  try {
    if (p) {
      const { tagHistory: _t, ...rest } = p
      globalThis.localStorage?.setItem(SNAPSHOT_KEY, JSON.stringify({ ...rest, tagHistory: [] }))
    } else globalThis.localStorage?.removeItem(SNAPSHOT_KEY)
  } catch {
    // The plant just won't come back if the page closes mid-shift.
  }
}

// A page closed mid-shift: put the kept plant back.
try {
  const left = globalThis.localStorage?.getItem(SNAPSHOT_KEY)
  if (left) {
    controls.replace(JSON.parse(left) as Plant)
    globalThis.localStorage?.removeItem(SNAPSHOT_KEY)
  }
} catch {
  // Nothing to put back.
}

export const getShifts = () => state

export function useShifts<T>(selector: (s: ShiftState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => selector(state),
  )
}

export const shifts = {
  /** Starts a shift from a fresh plant, keeping yours aside. */
  start(id: string) {
    const shift = SHIFTS.find((s) => s.id === id)
    if (!shift || state.active) return
    keep(getPlant())
    controls.reset()
    shift.setup()
    const p = getPlant()
    set({ ...state, active: startRun(shift, p, siteBalance(p)), log: [{ at: 0, text: 'You’ve taken the shift over.' }], result: null })
  },
  /**
   * Referees the running shift: fires its events when they're due, samples the goals and, at the end, writes the
   * report and hands the site back. Called as the plant clock runs.
   */
  tick() {
    const run = state.active
    if (!run) return
    const shift = SHIFTS.find((s) => s.id === run.id)!
    let p = getPlant()
    const into = p.furnace.time - run.startedAt
    let log = state.log
    let fired = run.fired
    while (fired < shift.events.length && into >= shift.events[fired].at) {
      const e = shift.events[fired]
      e.apply?.()
      log = [...log, { at: e.at, text: e.text }]
      fired++
    }
    p = getPlant()
    const b = siteBalance(p)
    const next = sampleRun(shift, fired === run.fired ? run : { ...run, fired }, p, b)
    if (into >= shift.length) {
      const result = finishRun(shift, next, p, b)
      if (kept) controls.replace(kept)
      keep(null)
      set({ ...state, active: null, log, result, best: { ...state.best, [shift.id]: Math.max(state.best[shift.id] ?? 0, result.stars) }, played: state.played + 1 })
      return
    }
    if (next !== run || log !== state.log) set({ ...state, active: next, log })
  },
  /** Gives up the shift and hands the site back. */
  abandon() {
    if (!state.active) return
    if (kept) controls.replace(kept)
    keep(null)
    set({ ...state, active: null, log: [] })
  },
  closeReport() {
    set({ ...state, result: null, log: [] })
  },
  reset() {
    keep(null)
    set(EMPTY)
  },
}
