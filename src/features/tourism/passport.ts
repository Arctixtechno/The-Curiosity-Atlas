import { useSyncExternalStore } from 'react'

// The Discovery Passport: places you've been, places you love, and your own
// notes on them. Kept in this browser only.

export interface PassportEntry {
  visited?: boolean
  favourite?: boolean
  note?: string
}

type Passport = Readonly<Record<string, PassportEntry>>

const KEY = 'atlas.passport'

function load(): Passport {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

let passport: Passport = load()
const listeners = new Set<() => void>()

export function updatePassport(placeId: string, change: PassportEntry) {
  const entry = { ...passport[placeId], ...change }
  const empty = !entry.visited && !entry.favourite && !entry.note
  const next = { ...passport }
  if (empty) delete next[placeId]
  else next[placeId] = entry
  passport = next
  try {
    localStorage.setItem(KEY, JSON.stringify(passport))
  } catch {
    // Storage can be unavailable (private windows); the passport then lasts for this visit only.
  }
  listeners.forEach((l) => l())
}

export function usePassport(): Passport {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => passport,
  )
}
