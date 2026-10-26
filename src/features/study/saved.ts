import { useSyncExternalStore } from 'react'

// A small value kept in this browser's storage, that components can follow.
// Each study tool keeps its own under its own key.

export interface Saved<T> {
  get: () => T
  set: (next: T | ((current: T) => T)) => void
  subscribe: (listener: () => void) => () => void
}

export function saved<T>(key: string, initial: T): Saved<T> {
  let value: T = initial
  try {
    const stored = localStorage.getItem(key)
    if (stored) value = JSON.parse(stored) as T
  } catch {
    // Unreadable or unavailable storage: start fresh.
  }
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(next) {
      value = typeof next === 'function' ? (next as (current: T) => T)(value) : next
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Storage can be unavailable (private windows); the value then lasts for this visit only.
      }
      listeners.forEach((l) => l())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function useSaved<T>(store: Saved<T>): T {
  return useSyncExternalStore(store.subscribe, store.get)
}

/** A short random id for a new note, card or task. */
export const newId = () => Math.random().toString(36).slice(2, 10)

/** Today's date in this computer's time zone, as YYYY-MM-DD. */
export function dayKey(time: number | Date = Date.now()): string {
  const d = new Date(time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The same, kept only until the page closes. */
export function memory<T>(initial: T): Saved<T> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(next) {
      value = typeof next === 'function' ? (next as (current: T) => T)(value) : next
      listeners.forEach((l) => l())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
