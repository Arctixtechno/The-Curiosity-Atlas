import type { DoorDefinition, RoomDefinition } from '../types/room.ts'
import { CafeExterior } from './CafeExterior.tsx'
import {
  boxCollider,
  CAFE,
  CAFE_ROOM,
  CAFE_TABLES,
  carCollider,
  COURTYARD_CAR,
  COURTYARD,
  EYE_HEIGHT,
  HALL_FURNITURE,
  HALL_PLANTS,
  LAB_COAT_STAND,
  COURTYARD_BENCH,
  DOOR_POTS,
  LABORATORY,
  LOUNGE,
  MAIN_HALL,
  MAP_TABLE,
  MUSEUM,
  OBSERVATORY,
  OBSERVATORY_TERRACE_DOOR,
  observatoryWallPoint,
  PORTICO,
  REFINERY,
  TERRACE,
  THEATRE,
  WORKSHOP,
  THEATRE_AISLE,
  THEATRE_LANDING_HEIGHT,
  THEATRE_LECTERN,
  THEATRE_TIERS,
  theatreFloorHeight,
  wallColliders,
} from './dimensions.ts'

// Every room the Room Manager knows about. Interiors are loaded on demand
// through `load`, so each one ends up in its own code-split chunk.

const terraceDoor = observatoryWallPoint(OBSERVATORY_TERRACE_DOOR, 0.15)

const hallL = MAIN_HALL.length / 2 - 0.05
const hallW = MAIN_HALL.width / 2 - 0.05

const mainHallDoors: DoorDefinition[] = [
  {
    id: 'theatre',
    label: 'Theatre',
    position: [hallW, 0, 0],
    rotationY: -Math.PI / 2,
    target: { roomId: 'theatre', doorId: 'hall' },
  },
  {
    id: 'observatory',
    label: 'Observatory',
    position: [hallW, 0, -6],
    rotationY: -Math.PI / 2,
    target: { roomId: 'observatory', doorId: 'hall' },
  },
  {
    id: 'entrance',
    label: 'Courtyard',
    prompt: 'Press E to go out to the Courtyard',
    position: [0, 0, hallL],
    rotationY: Math.PI,
    target: { roomId: 'courtyard', doorId: 'hall' },
  },
  {
    id: 'museum',
    label: 'Museum',
    prompt: 'Press E to enter the Museum of Everything',
    position: [-hallW, 0, -3],
    rotationY: Math.PI / 2,
    target: { roomId: 'museum', doorId: 'hall' },
  },
  { id: 'library', label: 'Library', position: [0, 0, -hallL], rotationY: 0 },
  {
    id: 'laboratory',
    label: 'Laboratory',
    position: [-hallW, 0, 0],
    rotationY: Math.PI / 2,
    target: { roomId: 'laboratory', doorId: 'hall' },
  },
  {
    id: 'lounge',
    label: 'Philosophy Lounge',
    position: [-hallW, 0, 6],
    rotationY: Math.PI / 2,
    target: { roomId: 'lounge', doorId: 'hall' },
  },
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
      boxCollider(...HALL_FURNITURE.coatStand, 0.5, 0.5),
      boxCollider(...HALL_FURNITURE.bench, 0.5, 1.6),
      boxCollider(...HALL_FURNITURE.console, 0.45, 1.2),
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
      {
        id: 'hall',
        label: 'Main Hall',
        position: [0, THEATRE_LANDING_HEIGHT, THEATRE.length / 2 - 0.05],
        rotationY: Math.PI,
        target: { roomId: 'mainHall', doorId: 'theatre' },
      },
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
      {
        id: 'hall',
        label: 'Main Hall',
        position: [0, 0, OBSERVATORY.radius - 0.15],
        rotationY: Math.PI,
        target: { roomId: 'mainHall', doorId: 'observatory' },
      },
      {
        id: 'terrace',
        label: 'Roof Terrace',
        prompt: 'Press E to step out onto the roof terrace',
        position: [terraceDoor[0], 0, terraceDoor[1]],
        rotationY: OBSERVATORY_TERRACE_DOOR + Math.PI,
        target: { roomId: 'terrace', doorId: 'observatory' },
      },
    ],
    load: () => import('./Observatory.tsx'),
  },
  terrace: {
    id: 'terrace',
    displayName: 'Roof Terrace',
    colliders: [
      // The balustrade on three sides and the dome's wall behind, kept a little short of their faces.
      ...wallColliders(TERRACE.width - 0.8, TERRACE.depth - 0.8),
      boxCollider(...TERRACE.bench, 1.7, 0.6),
      boxCollider(...TERRACE.telescope, 0.9, 0.9),
      ...TERRACE.bays.map(([x, z]) => boxCollider(x, z, 0.8, 0.8)),
    ],
    doors: [
      {
        id: 'observatory',
        label: 'Observatory',
        position: [0, 0, -TERRACE.depth / 2 + 0.05],
        rotationY: 0,
        target: { roomId: 'observatory', doorId: 'terrace' },
      },
    ],
    load: () => import('./RoofTerrace.tsx'),
  },
  laboratory: {
    id: 'laboratory',
    displayName: 'Laboratory',
    colliders: [
      ...wallColliders(LABORATORY.width, LABORATORY.length),
      boxCollider(...LABORATORY.gasBench, LABORATORY.bench.width + 0.2, LABORATORY.bench.depth + 0.2),
      boxCollider(...LABORATORY.buoyancyBench, LABORATORY.bench.width + 0.2, LABORATORY.bench.depth + 0.2),
      boxCollider(...LAB_COAT_STAND, 0.5, 0.5),
      // Glassware shelves along the far wall.
      {
        minX: -LABORATORY.width / 2,
        maxX: LABORATORY.width / 2,
        minZ: -LABORATORY.length / 2,
        maxZ: -LABORATORY.length / 2 + 0.55,
      },
    ],
    doors: [
      {
        id: 'hall',
        label: 'Main Hall',
        position: [0, 0, LABORATORY.length / 2 - 0.05],
        rotationY: Math.PI,
        target: { roomId: 'mainHall', doorId: 'laboratory' },
      },
      {
        id: 'workshop',
        label: 'Workshop',
        position: [-LABORATORY.width / 2 + 0.05, 0, 2.5],
        rotationY: Math.PI / 2,
        target: { roomId: 'workshop', doorId: 'laboratory' },
      },
    ],
    load: () => import('./Laboratory.tsx'),
  },
  lounge: {
    id: 'lounge',
    displayName: 'Philosophy Lounge',
    colliders: [
      ...wallColliders(LOUNGE.width, LOUNGE.length),
      // Armchairs, table and fireplace, then the bookcases along each side wall.
      // The two armchairs and the table between them.
      boxCollider(0, LOUNGE.seatingZ, LOUNGE.chairX * 2 + 1, 1.1),
      // The hearth and fireplace.
      boxCollider(0, -LOUNGE.length / 2 + 0.35, 2.4, 0.7),
      boxCollider(...LOUNGE.chessTable, 0.9, 0.9),
      boxCollider(-LOUNGE.width / 2 + 0.2, LOUNGE.bookcaseZ, 0.4, LOUNGE.bookcaseLength),
      boxCollider(LOUNGE.width / 2 - 0.2, LOUNGE.bookcaseZ, 0.4, LOUNGE.bookcaseLength),
    ],
    doors: [
      {
        id: 'hall',
        label: 'Main Hall',
        position: [0, 0, LOUNGE.length / 2 - 0.05],
        rotationY: Math.PI,
        target: { roomId: 'mainHall', doorId: 'lounge' },
      },
    ],
    load: () => import('./PhilosophyLounge.tsx'),
  },
  workshop: {
    id: 'workshop',
    displayName: 'Workshop',
    colliders: [
      ...wallColliders(WORKSHOP.width, WORKSHOP.length),
      boxCollider(...WORKSHOP.gearBench, WORKSHOP.bench.width + 0.2, WORKSHOP.bench.depth + 0.2),
      boxCollider(...WORKSHOP.circuitBench, WORKSHOP.bench.width + 0.2, WORKSHOP.bench.depth + 0.2),
      boxCollider(...WORKSHOP.dummy, 0.6, 0.6),
      boxCollider(...WORKSHOP.drill, 0.7, 0.6),
      boxCollider(...WORKSHOP.chest, 0.6, 0.9),
    ],
    doors: [
      {
        id: 'laboratory',
        label: 'Laboratory',
        position: [0, 0, WORKSHOP.length / 2 - 0.05],
        rotationY: Math.PI,
        target: { roomId: 'laboratory', doorId: 'workshop' },
      },
    ],
    load: () => import('./Workshop.tsx'),
  },
  museum: {
    id: 'museum',
    displayName: 'Museum of Everything',
    colliders: [
      ...wallColliders(MUSEUM.width, MUSEUM.length),
      ...Object.values(MUSEUM.exhibits).map(({ at, case: kind }) =>
        kind === 'tall'
          ? boxCollider(...at, 1.4, 0.9)
          : kind === 'open'
            ? boxCollider(...at, 1.0, 1.0)
            : boxCollider(...at, 1.1, 0.9),
      ),
      // The open plinth's label stand.
      boxCollider(MUSEUM.exhibits.meteorite.at[0], MUSEUM.exhibits.meteorite.at[1] + 0.62, 0.3, 0.3),
      boxCollider(...MUSEUM.bench, 1.9, 0.5),
    ],
    doors: [
      {
        id: 'hall',
        label: 'Main Hall',
        position: [0, 0, MUSEUM.length / 2 - 0.05],
        rotationY: Math.PI,
        target: { roomId: 'mainHall', doorId: 'museum' },
      },
    ],
    load: () => import('./Museum.tsx'),
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
      boxCollider(...COURTYARD_BENCH, 0.5, 1.6),
      ...DOOR_POTS.map(([x, z]) => boxCollider(x, z, 0.6, 0.6)),
      // Portico columns either side of the front door.
      boxCollider(-PORTICO.columnX, -COURTYARD.length / 2 + PORTICO.columnZ, 0.52, 0.52),
      boxCollider(PORTICO.columnX, -COURTYARD.length / 2 + PORTICO.columnZ, 0.52, 0.52),
      carCollider(COURTYARD_CAR.position, COURTYARD_CAR.rotationY),
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
      {
        id: 'cafe',
        label: 'Café',
        position: [0, 0, CAFE.frontZ - 0.05],
        rotationY: Math.PI,
        color: '#5f9a7c',
        signHeight: 2.52,
        target: { roomId: 'cafe', doorId: 'courtyard' },
      },
      {
        id: 'refinery',
        label: 'Drive to the refinery',
        prompt: 'Press E to drive to Marshgate Refinery',
        ...COURTYARD_CAR,
        variant: 'car',
        target: { roomId: 'refinery', doorId: 'car' },
      },
    ],
    load: () => import('./Courtyard.tsx'),
    visibleExteriors: ['cafe'],
  },
  cafe: {
    id: 'cafe',
    displayName: 'Café',
    colliders: [
      ...wallColliders(CAFE_ROOM.width, CAFE_ROOM.length),
      // The counter and the barista's side behind it.
      {
        minX: CAFE_ROOM.counter[0] - CAFE_ROOM.counterSize.length / 2 - 0.1,
        maxX: CAFE_ROOM.counter[0] + CAFE_ROOM.counterSize.length / 2 + 0.1,
        minZ: -CAFE_ROOM.length / 2,
        maxZ: CAFE_ROOM.counter[1] + CAFE_ROOM.counterSize.depth / 2 + 0.15,
      },
      // The banquette and its tables, and the chairs facing them.
      { minX: -CAFE_ROOM.width / 2, maxX: -2.55, minZ: -1.45, maxZ: 2.45 },
      ...CAFE_ROOM.banquetteTables.map(([x, z]) => boxCollider(x + 0.62, z, 0.5, 0.5)),
      ...CAFE_ROOM.bistroTables.map(([x, z]) => boxCollider(x, z, 1.7, 0.8)),
      // The window bar and its stools, and the fig by the door.
      {
        minX: CAFE_ROOM.bays[1] - CAFE_ROOM.bayWidth / 2,
        maxX: CAFE_ROOM.width / 2,
        minZ: CAFE_ROOM.length / 2 - 0.9,
        maxZ: CAFE_ROOM.length / 2,
      },
      boxCollider(-CAFE_ROOM.width / 2 + 0.45, CAFE_ROOM.length / 2 - 0.5, 0.7, 0.7),
    ],
    doors: [
      {
        id: 'courtyard',
        label: 'Courtyard',
        prompt: 'Press E to go out to the Courtyard',
        position: [0, 0, CAFE_ROOM.length / 2 - 0.05],
        rotationY: Math.PI,
        color: '#2f5a48',
        target: { roomId: 'courtyard', doorId: 'cafe' },
      },
    ],
    load: () => import('./Cafe.tsx'),
    exterior: CafeExterior,
  },
  refinery: {
    id: 'refinery',
    displayName: 'Marshgate Refinery',
    colliders: [
      ...wallColliders(REFINERY.width - 0.6, REFINERY.length - 0.6),
      carCollider(REFINERY.car.position, REFINERY.car.rotationY),
      boxCollider(...REFINERY.board, 2.6, 0.4),
      boxCollider(...REFINERY.controlRoom.at, REFINERY.controlRoom.size[0] + 0.2, REFINERY.controlRoom.size[1] + 0.2),
      boxCollider(...REFINERY.furnace.at, REFINERY.furnace.size[0] + 0.4, REFINERY.furnace.size[1] + 0.4),
      // The column with its skirt and platforms, its field panel, the strippers and the reflux drum.
      boxCollider(...REFINERY.column.at, REFINERY.column.radius * 2 + 1.2, REFINERY.column.radius * 2 + 1.2),
      boxCollider(REFINERY.column.at[0], REFINERY.column.at[1] + REFINERY.column.radius + 1.6, 1, 0.4),
      boxCollider(REFINERY.strippers[1][0], REFINERY.strippers[1][1], 1.6, 7.6),
      boxCollider(...REFINERY.refluxDrum, 5.4, 2.2),
      // Pipe rack legs, every bay along both sides.
      ...Array.from({ length: Math.floor((REFINERY.rack.x[1] - REFINERY.rack.x[0]) / REFINERY.rack.bay) + 1 }, (_, i) =>
        [-1, 1].map((s) =>
          boxCollider(REFINERY.rack.x[0] + i * REFINERY.rack.bay, REFINERY.rack.z + (s * REFINERY.rack.width) / 2, 0.5, 0.5),
        ),
      ).flat(),
      boxCollider(...REFINERY.vacuum.at, REFINERY.vacuum.radius * 2 + 2.4, REFINERY.vacuum.radius * 2 + 2.4),
      boxCollider(REFINERY.fcc.at[0] + 1.6, REFINERY.fcc.at[1], REFINERY.fcc.size + 4, REFINERY.fcc.size + 0.6),
      boxCollider(...REFINERY.reformer.at, REFINERY.reformer.size[0], REFINERY.reformer.size[1] - 1.5),
      ...REFINERY.tanks.map(({ at }) => boxCollider(...at, REFINERY.tankRadius * 2 + 0.4, REFINERY.tankRadius * 2 + 0.4)),
      boxCollider(...REFINERY.flare, 2, 2),
    ],
    doors: [
      {
        id: 'car',
        label: 'Drive home',
        prompt: 'Press E to drive back to the house',
        ...REFINERY.car,
        variant: 'car',
        target: { roomId: 'courtyard', doorId: 'refinery' },
      },
    ],
    load: () => import('./Refinery.tsx'),
    journey: { place: 'Marshgate Refinery', miles: 34, minutes: 50, route: 'out along the Thames estuary' },
  },
}

export const startingRoomId = 'mainHall'
export const startingPlacement = { position: [0, EYE_HEIGHT, 7] as [number, number, number], yaw: 0 }
