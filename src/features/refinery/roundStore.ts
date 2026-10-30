import { useSyncExternalStore } from 'react'
import type { RoundCall } from './rounds.ts'

// The field round in progress and the best one so far. Free of the plant, so
// the HUD and the 3D markers can ask about it cheaply.

export interface RoundState {
  /** Rounds started, ever: the next round's number. */
  count: number
  active: { number: number; calls: Record<string, RoundCall> } | null
  /** The checkpoint the operator is standing at, while its reading is open. */
  at: string | null
  /** Most calls right in one round. */
  best: number
}

const KEY = 'atlas.refinery.rounds'
const EMPTY: RoundState = { count: 0, active: null, at: null, best: 0 }

function load(): RoundState {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return { ...EMPTY, count: saved.count ?? 0, best: saved.best ?? 0 }
  } catch {
    return EMPTY
  }
}

let state = load()
const listeners = new Set<() => void>()

function set(change: Partial<RoundState>) {
  state = { ...state, ...change }
  try {
    localStorage.setItem(KEY, JSON.stringify({ count: state.count, best: state.best }))
  } catch {
    // Storage can be unavailable; the count then restarts next visit.
  }
  listeners.forEach((l) => l())
}

export const getRounds = () => state

export function useRounds<T>(selector: (s: RoundState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => selector(state),
  )
}

export const rounds = {
  start() {
    set({ active: { number: state.count + 1, calls: {} }, count: state.count + 1, at: null })
  },
  arrive(id: string | null) {
    set({ at: id })
  },
  call(id: string, call: RoundCall) {
    if (!state.active) return
    set({ active: { ...state.active, calls: { ...state.active.calls, [id]: call } } })
  },
  finish(right: number) {
    set({ active: null, at: null, best: Math.max(state.best, right) })
  },
  abandon() {
    set({ active: null, at: null })
  },
  reset() {
    set(EMPTY)
  },
}
