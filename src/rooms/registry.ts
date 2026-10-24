import type { DoorDefinition, RoomDefinition } from '../types/room.ts'
import { CafeExterior } from './CafeExterior.tsx'
import {
  boxCollider,
  CAFE,
  COURTYARD,
  EYE_HEIGHT,
  LOUNGE,
  MAIN_HALL,
  OBSERVATORY,
  PORTICO,
  THEATRE,
  THEATRE_ROWS,
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
  { id: 'lounge', label: 'Philosophy Lounge', position: [-hallW, 0, 6], rotationY: Math.PI / 2, target: { roomId: 'lounge', doorId: 'hall' } },
]

export const rooms: Record<string, RoomDefinition> = {
  mainHall: {
    id: 'mainHall',
    displayName: 'Main Hall',
    colliders: [...wallColliders(MAIN_HALL.width, MAIN_HALL.length), boxCollider(0, 0, 2.2, 2.2)],
    doors: mainHallDoors,
    load: () => import('./MainHall.tsx'),
  },
  theatre: {
    id: 'theatre',
    displayName: 'Theatre',
    colliders: [
      ...wallColliders(THEATRE.width, THEATRE.length),
      // Recliner rows, either side of the centre aisle (footrests reach forward).
      ...THEATRE_ROWS.flatMap((z) => [-1, 1].map((side) => ({
        minX: side < 0 ? -3.05 : 0.75,
        maxX: side < 0 ? -0.75 : 3.05,
        minZ: z - 0.95,
        maxZ: z + 0.6,
      }))),
    ],
    doors: [
      { id: 'hall', label: 'Main Hall', position: [0, 0, THEATRE.length / 2 - 0.05], rotationY: Math.PI, target: { roomId: 'mainHall', doorId: 'theatre' } },
    ],
    load: () => import('./Theatre.tsx'),
  },
  observatory: {
    id: 'observatory',
    displayName: 'Observatory',
    colliders: [...wallColliders(OBSERVATORY.width, OBSERVATORY.length), boxCollider(0, -1, 1.2, 1.2)],
    doors: [
      { id: 'hall', label: 'Main Hall', position: [0, 0, OBSERVATORY.length / 2 - 0.05], rotationY: Math.PI, target: { roomId: 'mainHall', doorId: 'observatory' } },
    ],
    load: () => import('./Observatory.tsx'),
  },
  lounge: {
    id: 'lounge',
    displayName: 'Philosophy Lounge',
    colliders: [
      ...wallColliders(LOUNGE.width, LOUNGE.length),
      // Armchairs, table and fireplace, then the bookcases along each side wall.
      boxCollider(0, LOUNGE.seatingZ, LOUNGE.chairX * 2 + 1, 1),
      boxCollider(0, -LOUNGE.length / 2 + 0.2, 2.3, 0.5),
      boxCollider(-LOUNGE.width / 2 + 0.2, LOUNGE.bookcaseZ, 0.4, LOUNGE.bookcaseLength),
      boxCollider(LOUNGE.width / 2 - 0.2, LOUNGE.bookcaseZ, 0.4, LOUNGE.bookcaseLength),
    ],
    doors: [
      { id: 'hall', label: 'Main Hall', position: [0, 0, LOUNGE.length / 2 - 0.05], rotationY: Math.PI, target: { roomId: 'mainHall', doorId: 'lounge' } },
    ],
    load: () => import('./PhilosophyLounge.tsx'),
  },
  courtyard: {
    id: 'courtyard',
    displayName: 'Courtyard',
    colliders: [
      ...wallColliders(COURTYARD.width, COURTYARD.length, 0.4),
      { minX: -CAFE.width / 2, maxX: CAFE.width / 2, minZ: CAFE.frontZ, maxZ: COURTYARD.length / 2 },
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
        color: '#141414',
        signHeight: 3.05,
        target: { roomId: 'mainHall', doorId: 'entrance' },
      },
      { id: 'cafe', label: 'Café', position: [0, 0, CAFE.frontZ - 0.05], rotationY: Math.PI },
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
