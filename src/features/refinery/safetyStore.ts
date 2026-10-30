import { useSyncExternalStore } from 'react'

// The drill that's running, the flare test, and the trainee's best results on
// the safety screen. Free of the plant so the HUD can ask cheaply whether a
// drill is on; times are plant seconds, passed in by the callers.

export interface RunningDrill {
  id: string
  /** Plant time it started. */
  startedAt: number
  taken: { id: string; at: number }[]
  /** Its escalation has been put on the plant. */
  escalated: boolean
  /** It has been finished and recorded. */
  finished: boolean
}

export interface SafetyState {
  drill: RunningDrill | null
  /** A test firing of the flare, until a plant time. */
  flareTest: { load: number; until: number } | null
  /** Best score for each drill, out of 100. */
  best: Record<string, number>
  /** Permits issued correctly. */
  permits: string[]
  /** Best HAZOP score, cells right out of all of them. */
  hazop: number
}

const KEY = 'atlas.refinery.safety'
const EMPTY: SafetyState = { drill: null, flareTest: null, best: {}, permits: [], hazop: 0 }

function load(): SafetyState {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return { ...EMPTY, best: saved.best ?? {}, permits: saved.permits ?? [], hazop: saved.hazop ?? 0 }
  } catch {
    return EMPTY
  }
}

let state = load()
const listeners = new Set<() => void>()

function set(change: Partial<SafetyState>) {
  state = { ...state, ...change }
  try {
    localStorage.setItem(KEY, JSON.stringify({ best: state.best, permits: state.permits, hazop: state.hazop }))
  } catch {
    // Storage can be unavailable; results then last for this visit only.
  }
  listeners.forEach((l) => l())
}

export const getSafety = () => state

export function useSafety<T>(selector: (s: SafetyState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => selector(state),
  )
}

export const safety = {
  startDrill(id: string, now: number) {
    set({ drill: { id, startedAt: now, taken: [], escalated: false, finished: false } })
  },
  takeAction(id: string, now: number) {
    const d = state.drill
    if (!d || d.finished) return
    set({ drill: { ...d, taken: [...d.taken, { id, at: now - d.startedAt }] } })
  },
  markEscalated() {
    if (state.drill) set({ drill: { ...state.drill, escalated: true } })
  },
  /** Records the drill's score, keeping the best. */
  finishDrill(score: number) {
    const d = state.drill
    if (!d || d.finished) return
    set({ drill: { ...d, finished: true }, best: { ...state.best, [d.id]: Math.max(score, state.best[d.id] ?? 0) } })
  },
  endDrill() {
    set({ drill: null })
  },
  testFlare(load: number, until: number) {
    set({ flareTest: { load, until } })
  },
  passPermit(id: string) {
    if (!state.permits.includes(id)) set({ permits: [...state.permits, id] })
  },
  scoreHazop(score: number) {
    set({ hazop: Math.max(score, state.hazop) })
  },
  reset() {
    set(EMPTY)
  },
}
