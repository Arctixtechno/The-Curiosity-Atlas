import { useSyncExternalStore } from 'react'
import { startingRoomId } from '../rooms/registry.ts'

// Rooms the player has been in, remembered between visits, so the map can
// offer a quick way back to them.

const KEY = 'atlas.visitedRooms'

function load(): Set<string> {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return new Set([startingRoomId, ...(Array.isArray(saved) ? saved : [])])
  } catch {
    return new Set([startingRoomId])
  }
}

let visited: ReadonlySet<string> = load()
const listeners = new Set<() => void>()

export function markVisited(roomId: string) {
  if (visited.has(roomId)) return
  visited = new Set([...visited, roomId])
  try {
    localStorage.setItem(KEY, JSON.stringify([...visited]))
  } catch {
    // Storage can be unavailable (private windows); the map then only remembers this visit.
  }
  listeners.forEach((l) => l())
}

export function useVisited(): ReadonlySet<string> {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => visited,
  )
}
