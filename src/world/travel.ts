import { rooms } from '../rooms/registry.ts'
import type { DoorDefinition } from '../types/room.ts'
import { arrivalAt, findDoor } from './navigation.ts'
import { gameStore } from './store.ts'
import { prefersReducedMotion } from './settings.ts'
import { markVisited } from './visited.ts'

/** How long the screen takes to fade to black before the room swaps. */
export const FADE_MS = 350

/** How long to wait for a new room to say it is ready before fading in anyway. */
const READY_TIMEOUT_MS = 4000

/** How long a drive lasts on screen, and with reduced motion (when it doesn't animate). */
export const DRIVE_MS = 9000
const STILL_DRIVE_MS = 2500

let markReady: (() => void) | null = null
let endDrive: (() => void) | null = null

/** Arrives straight away, for players who don't want to watch the drive. */
export function skipJourney() {
  endDrive?.()
}

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
  // Going to or from somewhere far away is a drive, which hides the room loading behind it.
  const leaving = rooms[gameStore.get().activeRoomId]
  const journey = rooms[target.roomId].journey ?? leaving.journey
  const drive = journey
    ? new Promise<void>((resolve) => {
        endDrive = resolve
        setTimeout(resolve, prefersReducedMotion ? STILL_DRIVE_MS : DRIVE_MS)
      })
    : null
  gameStore.set({
    transitioning: true,
    prompt: null,
    journey: journey ? { ...journey, place: rooms[target.roomId].journey ? journey.place : 'the house', homeward: !rooms[target.roomId].journey } : null,
  })
  try {
    const arrival = arrivalAt(findDoor(rooms, target.roomId, target.doorId))
    await Promise.all([rooms[target.roomId].load?.(), new Promise((r) => setTimeout(r, FADE_MS))])
    const ready = new Promise<void>((resolve) => {
      markReady = resolve
      setTimeout(resolve, READY_TIMEOUT_MS)
    })
    gameStore.set({ activeRoomId: target.roomId, arrival, nearbyRoomIds: new Set() })
    markVisited(target.roomId)
    await Promise.all([ready, drive])
  } finally {
    markReady = null
    endDrive = null
    gameStore.set({ transitioning: false, journey: null })
  }
}

/** Goes straight to a room from anywhere, arriving just inside its first door. Used by the map. */
export function travelTo(roomId: string) {
  const door = rooms[roomId]?.doors.find((d) => d.target)
  if (!door || roomId === gameStore.get().activeRoomId) return
  return travelThrough({
    id: 'map',
    label: rooms[roomId].displayName,
    position: [0, 0, 0],
    rotationY: 0,
    target: { roomId, doorId: door.id },
  })
}
