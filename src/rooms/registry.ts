import type { DoorDefinition, RoomDefinition } from '../types/room.ts'
import { CafeExterior } from './CafeExterior.tsx'
import {
  boxCollider,
  CAFE,
  CAFE_TABLES,
  COURTYARD,
  EYE_HEIGHT,
  HALL_PLANTS,
  MAIN_HALL,
  MAP_TABLE,
  OBSERVATORY,
  observatoryWallPoint,
  PORTICO,
  THEATRE,
  THEATRE_AISLE,
  THEATRE_LANDING_HEIGHT,
  THEATRE_LECTERN,
  THEATRE_TIERS,
  theatreFloorHeight,
  wallColliders,
} from './dimensions.ts'

// Every room the Room Manager knows about. Interiors are loaded on demand
// through `load`, so each one ends up in its own code-split chunk.

const hallL = MAIN_HALL.length / 2 - 0.05
const hallW = MAIN_HALL.width / 2 - 0.05

const mainHallDoors: DoorDefinition[] = [
  { id: 'theatre', label: 'Theatre', position: [hallW, 0, 0], rotationY: -Math.PI / 2, target: { roomId: 'theatre', doorId: 'hall' } },
  { id: 'observatory', label: 'Observatory', position: [hallW, 0, -6], rotationY: -Math.PI / 2, target: { roomId: 'observatory', doorId: 'hall' } },
  { id: 'entrance', label: 'Courtyard', prompt: 'Press E to go out to the Courtyard', position: [0, 0, hallL], rotationY: Math.PI, target: { roomId: 'courtyard', doorId: 'hall' } },
  { id: 'library', label: 'Library', position: [0, 0, -hallL], rotationY: 0 },
  { id: 'laboratory', label: 'Laboratory', position: [-hallW, 0, 0], rotationY: Math.PI / 2 },
  { id: 'lounge', label: 'Philosophy Lounge', position: [-hallW, 0, 6], rotationY: Math.PI / 2 },
]

export const rooms: Record<string, RoomDefinition> = {
  mainHall: {
    id: 'mainHall',
    displayName: 'Main Hall',
    colliders: [
      ...wallColliders(MAIN_HALL.width, MAIN_HALL.length),
      boxCollider(0, 0, 2.2, 2.2),
      ...HALL_PLANTS.map(([x, z]) => boxCollider(x, z, 0.6, 0.6)),
      boxCollider(...MAP_TABLE, 1.1, 1.6),
    ],
    doors: mainHallDoors,
    load: () => import('./MainHall.tsx'),
  },
  theatre: {
    id: 'theatre',
    displayName: 'Theatre',
    colliders: [
      ...wallColliders(THEATRE.width, THEATRE.length),
      // Recliner rows either side of the centre aisle (footrests reach forward).
      ...THEATRE_TIERS.flatMap(({ rowZ }) =>
        rowZ === undefined
          ? []
          : [-1, 1].map((side) => ({
              minX: side < 0 ? -3.95 : THEATRE_AISLE.halfWidth,
              maxX: side < 0 ? -THEATRE_AISLE.halfWidth : 3.95,
              minZ: rowZ - 1.05,
              maxZ: rowZ + 0.75,
            })),
      ),
      // The film lectern on the landing.
      boxCollider(...THEATRE_LECTERN, 0.6, 0.6),
      // Plinth under the screen.
      { minX: -4.6, maxX: 4.6, minZ: -THEATRE.length / 2, maxZ: -THEATRE.length / 2 + 0.6 },
    ],
    doors: [
      { id: 'hall', label: 'Main Hall', position: [0, THEATRE_LANDING_HEIGHT, THEATRE.length / 2 - 0.05], rotationY: Math.PI, target: { roomId: 'mainHall', doorId: 'theatre' } },
    ],
    load: () => import('./Theatre.tsx'),
    floorHeight: theatreFloorHeight,
  },
  observatory: {
    id: 'observatory',
    displayName: 'Observatory',
    colliders: [
      { kind: 'ring', x: 0, z: 0, radius: OBSERVATORY.radius - 0.05 },
      boxCollider(...OBSERVATORY.telescope, 0.9, 0.9),
      boxCollider(...OBSERVATORY.orrery, 1.3, 1.3),
      boxCollider(...OBSERVATORY.globe, 0.9, 0.9),
      boxCollider(...observatoryWallPoint(OBSERVATORY.deskAngle, 0.75), 1.6, 1.6),
      boxCollider(...observatoryWallPoint(OBSERVATORY.bookcaseAngle, 0.3), 1.5, 1.5),
    ],
    doors: [
      { id: 'hall', label: 'Main Hall', position: [0, 0, OBSERVATORY.radius - 0.15], rotationY: Math.PI, target: { roomId: 'mainHall', doorId: 'observatory' } },
    ],
    load: () => import('./Observatory.tsx'),
  },
  courtyard: {
    id: 'courtyard',
    displayName: 'Courtyard',
    colliders: [
      ...wallColliders(COURTYARD.width, COURTYARD.length, 0.4),
      { minX: -CAFE.width / 2, maxX: CAFE.width / 2, minZ: CAFE.frontZ, maxZ: COURTYARD.length / 2 },
      // Café tables and the chalkboard outside it.
      ...CAFE_TABLES.map(([x, z]) => boxCollider(x, z, 1.6, 0.9)),
      boxCollider(1.3, CAFE.frontZ - 0.75, 0.6, 0.5),
      boxCollider(-4.5, -2, 0.8, 0.8),
      boxCollider(4.5, -2, 0.8, 0.8),
      // Portico columns either side of the front door.
      boxCollider(-PORTICO.columnX, -COURTYARD.length / 2 + PORTICO.columnZ, 0.52, 0.52),
      boxCollider(PORTICO.columnX, -COURTYARD.length / 2 + PORTICO.columnZ, 0.52, 0.52),
    ],
    doors: [
      {
        id: 'hall',
        label: 'Entrance',
        prompt: 'Press E to go inside',
        position: [0, 0, -COURTYARD.length / 2 + 0.05],
        rotationY: 0,
        variant: 'front',
        signHeight: 2.68,
        target: { roomId: 'mainHall', doorId: 'entrance' },
      },
      { id: 'cafe', label: 'Café', position: [0, 0, CAFE.frontZ - 0.05], rotationY: Math.PI, color: '#5f9a7c', signHeight: 2.52 },
    ],
    load: () => import('./Courtyard.tsx'),
    visibleExteriors: ['cafe'],
  },
  cafe: {
    id: 'cafe',
    displayName: 'Café',
    colliders: [],
    doors: [],
    exterior: CafeExterior,
  },
}

export const startingRoomId = 'mainHall'
export const startingPlacement = { position: [0, EYE_HEIGHT, 7] as [number, number, number], yaw: 0 }
