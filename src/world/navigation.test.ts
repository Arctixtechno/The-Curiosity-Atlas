import { describe, expect, it } from 'vitest'
import { rooms } from '../rooms/registry.ts'
import type { RoomDefinition } from '../types/room.ts'
import { arrivalAt, computeRoomStates, findDoor } from './navigation.ts'
import { moveWithCollisions } from './collision.ts'

describe('arrivalAt', () => {
  it('places the player in front of a door, facing into the room', () => {
    const { position, yaw } = arrivalAt({ id: 'd', label: 'D', position: [0, 0, 5], rotationY: Math.PI })
    expect(position[0]).toBeCloseTo(0)
    expect(position[2]).toBeCloseTo(3.6)
    // Facing -z, back towards the centre of the room.
    expect(-Math.sin(yaw)).toBeCloseTo(0)
    expect(-Math.cos(yaw)).toBeCloseTo(-1)
  })
})

describe('room registry', () => {
  const allDoors = Object.values(rooms).flatMap((room) => room.doors.map((door) => ({ room, door })))

  it('links every open door to a door that leads back to it', () => {
    for (const { room, door } of allDoors) {
      if (!door.target) continue
      const other = findDoor(rooms, door.target.roomId, door.target.doorId)
      expect(other.target).toEqual({ roomId: room.id, doorId: door.id })
    }
  })

  it('only links to rooms that have an interior to load', () => {
    for (const { door } of allDoors) {
      if (door.target) expect(rooms[door.target.roomId].load).toBeDefined()
    }
  })

  it('never puts an arriving player inside a collider', () => {
    for (const { room, door } of allDoors) {
      const { position } = arrivalAt(door)
      // A zero-length move from a blocked spot would still be "allowed",
      // so check that a tiny step in any direction is possible.
      const [x, z] = moveWithCollisions(position[0], position[2], 0.01, 0.01, room.colliders)
      expect([x, z], `${room.id}/${door.id}`).toEqual([position[0] + 0.01, position[2] + 0.01])
    }
  })
})

describe('computeRoomStates', () => {
  const Stub = () => null
  const load = async () => ({ default: Stub })
  const testRooms: Record<string, RoomDefinition> = {
    hall: { id: 'hall', displayName: 'Hall', colliders: [], doors: [], load },
    theatre: { id: 'theatre', displayName: 'Theatre', colliders: [], doors: [], load },
    yard: { id: 'yard', displayName: 'Yard', colliders: [], doors: [], load, visibleExteriors: ['cafe'] },
    cafe: { id: 'cafe', displayName: 'Café', colliders: [], doors: [], exterior: Stub },
  }

  it('marks only the current room as active', () => {
    expect(computeRoomStates(testRooms, 'hall', new Set())).toEqual({
      hall: 'active',
      theatre: 'unloaded',
      yard: 'unloaded',
      cafe: 'unloaded',
    })
  })

  it('preloads rooms whose doors the player is near', () => {
    expect(computeRoomStates(testRooms, 'hall', new Set(['theatre'])).theatre).toBe('preloading')
  })

  it('shows exteriors visible from the current room', () => {
    expect(computeRoomStates(testRooms, 'yard', new Set(['cafe'])).cafe).toBe('exterior')
  })
})
