import { EYE_HEIGHT } from '../rooms/dimensions.ts'
import type { DoorDefinition, Placement, RoomDefinition, RoomState } from '../types/room.ts'

/** How far in front of a door the player appears after walking through it. */
export const ARRIVAL_DISTANCE = 1.4

/** Where the player stands, and which way they face, after coming through `door`. */
export function arrivalAt(door: DoorDefinition): Placement {
  const [x, , z] = door.position
  return {
    position: [
      x + Math.sin(door.rotationY) * ARRIVAL_DISTANCE,
      door.position[1] + EYE_HEIGHT,
      z + Math.cos(door.rotationY) * ARRIVAL_DISTANCE,
    ],
    // The camera looks down -z at yaw 0, so face away from the door.
    yaw: door.rotationY + Math.PI,
  }
}

/** Finds the door a target points at, or throws if the registry is inconsistent. */
export function findDoor(
  rooms: Record<string, RoomDefinition>,
  roomId: string,
  doorId: string,
): DoorDefinition {
  const door = rooms[roomId]?.doors.find((d) => d.id === doorId)
  if (!door) throw new Error(`Unknown door ${roomId}/${doorId}`)
  return door
}

/**
 * Lifecycle state of every room (spec section 4.2), given the room the
 * player is in and the rooms whose doors they are standing near.
 */
export function computeRoomStates(
  rooms: Record<string, RoomDefinition>,
  activeRoomId: string,
  nearbyRoomIds: ReadonlySet<string>,
): Record<string, RoomState> {
  const visible = new Set(rooms[activeRoomId]?.visibleExteriors ?? [])
  const states: Record<string, RoomState> = {}
  for (const id of Object.keys(rooms)) {
    if (id === activeRoomId) states[id] = 'active'
    else if (nearbyRoomIds.has(id) && rooms[id].load) states[id] = 'preloading'
    else if (visible.has(id)) states[id] = 'exterior'
    else states[id] = 'unloaded'
  }
  return states
}
