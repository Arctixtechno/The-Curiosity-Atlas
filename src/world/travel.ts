import { rooms } from '../rooms/registry.ts'
import type { DoorDefinition } from '../types/room.ts'
import { arrivalAt, findDoor } from './navigation.ts'
import { gameStore } from './store.ts'

/** How long the screen takes to fade to black before the room swaps. */
export const FADE_MS = 350

/** How long to wait for a new room to say it is ready before fading in anyway. */
const READY_TIMEOUT_MS = 4000

let markReady: (() => void) | null = null

/**
 * Called once the new room has compiled its shaders and drawn its first
 * frames. Until then the screen stays black, so the work of setting up a
 * room shows as a slightly longer fade instead of a stutter on arrival.
 */
export function roomReady() {
  markReady?.()
  markReady = null
}

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
    const ready = new Promise<void>((resolve) => {
      markReady = resolve
      setTimeout(resolve, READY_TIMEOUT_MS)
    })
    gameStore.set({ activeRoomId: target.roomId, arrival, nearbyRoomIds: new Set() })
    await ready
  } finally {
    markReady = null
    gameStore.set({ transitioning: false })
  }
}
