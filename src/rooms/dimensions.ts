import type { BoxCollider } from '../types/room.ts'

// Room sizes in metres, shared by the registry (colliders, doors) and the
// lazily loaded interiors (geometry).
export const MAIN_HALL = { width: 8, length: 20, height: 3.6 }
/** Corner plant positions; matching colliders are in the registry. */
export const HALL_PLANTS: [number, number][] = [
  [-3.4, -9.4],
  [3.4, -9.4],
  [-3.4, 9.4],
  [3.4, 9.4],
]

export const THEATRE = { width: 12, length: 16, height: 5.5 }

/**
 * The theatre floor rises in tiers from the screen (z = -8) to the entrance
 * landing at the back (z = +8). Each tier holds one row of recliners. The
 * centre aisle climbs the same height in smaller steps.
 */
export const THEATRE_TIERS = [
  { fromZ: -3.4, height: 0.4, rowZ: -1.8 },
  { fromZ: -0.2, height: 0.8, rowZ: 1.4 },
  { fromZ: 3.0, height: 1.2 },
]
export const THEATRE_AISLE = { halfWidth: 1, stepDepth: 0.8, stepHeight: 0.15 }
/** The film menu's lectern on the entrance landing, as [x, z]. */
export const THEATRE_LECTERN: [number, number] = [-2.4, 4.4]
/** Furniture round the main hall, as [x, z]: a coat stand by the front door, a bench, a console table. */
export const HALL_FURNITURE = {
  coatStand: [1.8, 9.35] as [number, number],
  bench: [3.75, 6] as [number, number],
  console: [-3.8, -8.3] as [number, number],
}
/** The City Explorer's map table in the main hall, as [x, z]. */
export const MAP_TABLE: [number, number] = [-2.4, -5.5]
export const THEATRE_LANDING_HEIGHT = 1.2
/** Recliner centres (x) and the side tables between each pair, either side of the aisle. */
export const THEATRE_SEAT_XS = [-3.3, -1.62, 1.62, 3.3]
export const THEATRE_TABLE_XS = [-2.46, 2.46]
/** How much larger than life-size-ish the recliners are drawn. */
export const RECLINER_SCALE = 1.3

export function theatreFloorHeight(x: number, z: number): number {
  const landing = THEATRE_TIERS[THEATRE_TIERS.length - 1]
  if (z >= landing.fromZ) return landing.height
  const first = THEATRE_TIERS[0].fromZ
  if (z < first) return 0
  if (Math.abs(x) < THEATRE_AISLE.halfWidth) {
    const step = Math.ceil((z - first) / THEATRE_AISLE.stepDepth)
    return Math.min(landing.height, step * THEATRE_AISLE.stepHeight)
  }
  let height = 0
  for (const tier of THEATRE_TIERS) if (z >= tier.fromZ) height = tier.height
  return height
}

/** Round observatory under a dome. Furniture positions are shared with the registry's colliders. */
export const OBSERVATORY = {
  radius: 6,
  wallHeight: 3.2,
  telescope: [0, -1.2] as [number, number],
  orrery: [3, 1.6] as [number, number],
  globe: [-3, 1.6] as [number, number],
  /** Furniture against the curved wall, by angle round the room (0 is the door, at +z). */
  deskAngle: 2.5,
  bookcaseAngle: -2.5,
}

/** A point `inset` metres in from the observatory wall, at `angle` round the room. */
export function observatoryWallPoint(angle: number, inset: number): [number, number] {
  const r = OBSERVATORY.radius - inset
  return [Math.sin(angle) * r, Math.cos(angle) * r]
}
/** The laboratory: two experiment benches, a chalkboard and shelves of glassware. Bench centres are [x, z]. */
export const LABORATORY = {
  width: 10,
  length: 12,
  height: 3.8,
  gasBench: [-2.6, -2] as [number, number],
  buoyancyBench: [2.6, -2] as [number, number],
  bench: { width: 2.2, depth: 0.9, height: 0.92 },
}
/** Where the laboratory's coat stand stands, by its door, as [x, z]. */
export const LAB_COAT_STAND: [number, number] = [-1.7, 5.5]
/**
 * Philosophy Lounge: two wingback chairs angled in towards the fire at the far
 * (north) end, built-in bookcases along both side walls, a tall window on the
 * west wall and a chess table opposite it.
 */
export const LOUNGE = {
  width: 8,
  length: 9,
  height: 3.4,
  seatingZ: -2.2,
  chairX: 1.05,
  /** How far each chair is turned from facing the other towards the fire, in radians. */
  chairTurn: 0.42,
  bookcaseZ: 1.2,
  bookcaseLength: 3.2,
  windowZ: -3,
  chessTable: [2.75, -2.9] as [number, number],
  /** Height of the eye when sitting in an armchair. */
  seatedEye: 1.12,
}

/** Where an armchair stands and which way it faces (its front is local +z). `side` -1 is the visitor's, +1 the companion's. */
export function loungeChair(side: -1 | 1) {
  return {
    x: side * LOUNGE.chairX,
    z: LOUNGE.seatingZ,
    rotationY: -side * (Math.PI / 2 + LOUNGE.chairTurn),
  }
}
export const COURTYARD = { width: 20, length: 26, hedgeHeight: 1.2 }
/** The Discovery Fountain in the middle of the courtyard: where it stands, as [x, z], and how much bigger than life-size model it's built. */
export const COURTYARD_FOUNTAIN = { at: [0, -1.5] as [number, number], scale: 1.75 }
/** The stand with today's question, on the house side of the fountain, as [x, z]. */
export const QUESTION_STAND: [number, number] = [
  COURTYARD_FOUNTAIN.at[0] + 1.2,
  COURTYARD_FOUNTAIN.at[1] - (1.3 * COURTYARD_FOUNTAIN.scale + 2.2),
]
/** Stone planters with clipped trees, round the fountain, as [x, z]. */
export const COURTYARD_PLANTERS: [number, number][] = [
  [-7, -7],
  [7, -7],
  [-7, 4.5],
  [7, 4.5],
]
/** The café building sits against the far end of the courtyard. */
export const CAFE = { width: 8, depth: 4, height: 3.2, frontZ: COURTYARD.length / 2 - 4 }
/** Bistro tables outside the café, as [x, z]. */
export const CAFE_TABLES: [number, number][] = [
  [-2.2, CAFE.frontZ - 1.7],
  [2.2, CAFE.frontZ - 1.7],
]

/**
 * Inside the café. The shopfront, with the door to the courtyard, is the +z wall.
 * The counter runs along the back; a banquette lines the west wall.
 */
export const CAFE_ROOM = {
  width: 8,
  length: 7,
  height: CAFE.height,
  /** Centre of the counter, as [x, z], and its size. */
  counter: [0.6, -2.0] as [number, number],
  counterSize: { length: 4.4, depth: 0.7, height: 1.0 },
  /** Tables along the banquette, and the bistro tables on the east side, as [x, z]. */
  banquetteTables: [
    [-2.95, -0.4],
    [-2.95, 1.5],
  ] as [number, number][],
  bistroTables: [
    [2.5, -0.2],
    [2.5, 1.6],
  ] as [number, number][],
  /** Shop window bays either side of the door, matching the outside. */
  bays: [-2.05, 2.05],
  bayWidth: 2.3,
}

/**
 * The Museum of Everything: a top-lit gallery off the main hall. Its door is the +z wall.
 * Exhibits stand in cases down each side, with the largest at the far end.
 */
export const MUSEUM = {
  width: 10,
  length: 14,
  height: 4.6,
  /** Where each exhibit stands, as [x, z], and the kind of case it's in. */
  exhibits: {
    rosetta: { at: [0, -5.3], case: 'tall' },
    meteorite: { at: [0, -1.6], case: 'open' },
    astrolabe: { at: [-3, -2.8], case: 'table' },
    chronometer: { at: [3, -2.8], case: 'table' },
    ammonite: { at: [-3, 1.6], case: 'table' },
    antikythera: { at: [3, 1.6], case: 'table' },
  } as Record<string, { at: [number, number]; case: 'tall' | 'open' | 'table' }>,
  bench: [0, 2.4] as [number, number],
}

/**
 * The Library: a tall reading room off the north end of the hall, lined with
 * books. Its door is the +z wall; the reading desk with your own saved
 * discoveries stands against the far wall.
 */
export const LIBRARY = {
  width: 9,
  length: 12,
  height: 4.4,
  /** The side walls' bookcases: centre along z, and length. */
  sideCases: { z: -0.6, length: 9.6 },
  /** The far wall's two bookcases either side of the desk: centre x (each side), and length. */
  backCases: { x: 2.75, length: 2.9 },
  table: { at: [0, -0.4] as [number, number], width: 1.2, length: 3.6 },
  desk: [0, -5.35] as [number, number],
}

/** Half the width of the roped-off square round the museum's open plinth. */
export const MUSEUM_ROPE = 0.85

/** The workshop, off the laboratory's west wall. Its door is the +z wall; the benches stand along the back. */
export const WORKSHOP = {
  width: 9,
  length: 11,
  height: 3.8,
  gearBench: [-2.3, -3.4] as [number, number],
  circuitBench: [2.3, -3.4] as [number, number],
  bench: { width: 2.4, depth: 0.9, height: 0.9 },
  /** A tailor's dummy in the corner, and a pillar drill and tool chest on the east wall, as [x, z]. */
  dummy: [-3.7, 3.9] as [number, number],
  drill: [3.9, 0.6] as [number, number],
  chest: [3.95, 2.6] as [number, number],
}

/** Garden benches against the side hedges, facing the fountain, and the pots either side of the front porch, as [x, z]. */
export const COURTYARD_BENCHES: [number, number][] = [
  [-9.65, -1.5],
  [9.65, -1.5],
]
export const DOOR_POTS: [number, number][] = [
  [-2.1, -COURTYARD.length / 2 + 0.5],
  [2.1, -COURTYARD.length / 2 + 0.5],
]

/** Columned porch around the house's front door, relative to the house wall. */
export const PORTICO = { columnX: 1.35, columnZ: 1.1, height: 3.3 }

export const WALL_THICKNESS = 0.2
export const EYE_HEIGHT = 1.65

/** Four walls enclosing a width × length floor centred on the origin. */
export function wallColliders(width: number, length: number, t = WALL_THICKNESS): BoxCollider[] {
  const hw = width / 2
  const hl = length / 2
  return [
    { minX: -hw - t, maxX: -hw, minZ: -hl, maxZ: hl },
    { minX: hw, maxX: hw + t, minZ: -hl, maxZ: hl },
    { minX: -hw, maxX: hw, minZ: -hl - t, maxZ: -hl },
    { minX: -hw, maxX: hw, minZ: hl, maxZ: hl + t },
  ]
}

export function boxCollider(x: number, z: number, sizeX: number, sizeZ: number): BoxCollider {
  return { minX: x - sizeX / 2, maxX: x + sizeX / 2, minZ: z - sizeZ / 2, maxZ: z + sizeZ / 2 }
}

/**
 * The roof terrace beside the observatory dome: a stone terrace behind a
 * marble balustrade, looking out over London. The door is in the middle of
 * the back wall (z = -depth / 2). Positions are [x, z].
 */
export const TERRACE = {
  width: 12,
  depth: 7,
  /** Height of the roof above the street, for the view. */
  roofHeight: 24,
  balustradeInset: 0.2,
  bench: [-2.6, 1.2] as [number, number],
  telescope: [3.9, 2.4] as [number, number],
  bays: [
    [-5.2, -2.9],
    [5.2, -2.9],
    [-5.2, 2.9],
  ] as [number, number][],
}
/** Where the observatory's door onto the terrace is, by angle round the room (see observatoryWallPoint). */
export const OBSERVATORY_TERRACE_DOOR = 1.55
