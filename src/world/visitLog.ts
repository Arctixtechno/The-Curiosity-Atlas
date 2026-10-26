import { useSyncExternalStore } from 'react'
import { gameStore } from './store.ts'

// A record of the visit for the "Your visit" page: every panel the player has
// opened (so each experiment, exhibit and instrument tried), the drinks made at
// the café counter, and the day of the first visit. Kept in this browser only.

interface VisitLog {
  /** The first day here, as an ISO date. */
  since: string
  /** Panels opened at least once, by their overlay id. */
  opened: string[]
  /** Café drinks made, by id. */
  drinks: string[]
}

const KEY = 'atlas.visit'

function load(): VisitLog {
  const fresh = { since: new Date().toISOString().slice(0, 10), opened: [], drinks: [] }
  try {
    return { ...fresh, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return fresh
  }
}

let log: VisitLog = load()
const listeners = new Set<() => void>()

function commit(next: VisitLog) {
  log = next
  try {
    localStorage.setItem(KEY, JSON.stringify(log))
  } catch {
    // Storage can be unavailable (private windows); the record then lasts for this visit only.
  }
  listeners.forEach((l) => l())
}

function add(list: 'opened' | 'drinks', id: string) {
  if (!log[list].includes(id)) commit({ ...log, [list]: [...log[list], id] })
}

/** Notes that a drink has been made at the café counter. */
export const noteDrink = (id: string) => add('drinks', id)

/** Starts noting each panel as it opens. Returns a way to stop. */
export function followPanels() {
  // Save the first visit's date straight away.
  commit(log)
  let last: string | null = null
  const stop = gameStore.subscribe(() => {
    const { overlay } = gameStore.get()
    if (overlay && overlay !== last) add('opened', overlay)
    last = overlay
  })
  return () => void stop()
}

export function useVisitLog(): VisitLog {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => log,
  )
}
