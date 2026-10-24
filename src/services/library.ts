import { useSyncExternalStore } from 'react'

// The visitor's personal Library of Discoveries (spec section 5.4), kept in
// localStorage for now. Items are stored as full snapshots so saved entries
// survive changes to the curated list, and so later features (conversations,
// videos) can save into the same library.

export type LibraryItemKind = 'discovery'

export interface LibraryItem {
  /** Unique per saved thing, e.g. "discovery:ship-of-theseus". */
  id: string
  kind: LibraryItemKind
  title: string
  topic: string
  summary: string
  body: string[]
  source?: { title: string; url: string }
  /** ISO timestamp. */
  savedAt: string
}

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const STORAGE_KEY = 'atlas.library.v1'

function isLibraryItem(value: unknown): value is LibraryItem {
  const v = value as LibraryItem
  return typeof v === 'object' && v !== null && typeof v.id === 'string' && typeof v.title === 'string' && Array.isArray(v.body)
}

export function createLibrary(storage: KeyValueStorage | null) {
  let items: LibraryItem[] = []
  const listeners = new Set<() => void>()

  try {
    const parsed: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '[]')
    if (Array.isArray(parsed)) items = parsed.filter(isLibraryItem)
  } catch {
    // Corrupt or unavailable storage: start with an empty library.
  }

  function commit(next: LibraryItem[]) {
    items = next
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // Storage full or blocked; the library still works for this visit.
    }
    listeners.forEach((l) => l())
  }

  return {
    /** Newest first. */
    all: () => items,
    has: (id: string) => items.some((i) => i.id === id),
    save(item: Omit<LibraryItem, 'savedAt'>, now = new Date()) {
      if (items.some((i) => i.id === item.id)) return
      commit([{ ...item, savedAt: now.toISOString() }, ...items])
    },
    remove(id: string) {
      commit(items.filter((i) => i.id !== id))
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export const library = createLibrary(browserStorage())

export function useLibrary(): LibraryItem[] {
  return useSyncExternalStore(library.subscribe, library.all)
}

/** Case-insensitive search across title, subject, summary and text. */
export function searchLibrary(items: LibraryItem[], query: string, topic?: string): LibraryItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return items.filter((item) => {
    if (topic && item.topic !== topic) return false
    const text = [item.title, item.topic, item.summary, ...item.body].join(' ').toLowerCase()
    return words.every((w) => text.includes(w))
  })
}
