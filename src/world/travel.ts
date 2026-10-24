import { rooms } from '../rooms/registry.ts'
import type { DoorDefinition } from '../types/room.ts'
import { arrivalAt, findDoor } from './navigation.ts'
import { gameStore } from './store.ts'

/** How long the screen takes to fade to black before the room swaps. */
export const FADE_MS = 350

/** Starts fetching a room's interior so it is ready by the time the door opens. */
export function preloadRoom(roomId: string) {
  void rooms[roomId]?.load?.()
}

/** Walks the player through `door` into the room it leads to. */
export async function travelThrough(door: DoorDefinition) {
  const { target } = door
  if (!target || gameStore.get().transitioning) return
  gameStore.set({ transitioning: true, prompt: null })
  try {
    const arrival = arrivalAt(findDoor(rooms, target.roomId, target.doorId))
    await Promise.all([rooms[target.roomId].load?.(), new Promise((r) => setTimeout(r, FADE_MS))])
    gameStore.set({ activeRoomId: target.roomId, arrival, nearbyRoomIds: new Set() })
  } finally {
    // Give the new interior a frame to mount before fading back in.
    requestAnimationFrame(() => gameStore.set({ transitioning: false }))
  }
}
