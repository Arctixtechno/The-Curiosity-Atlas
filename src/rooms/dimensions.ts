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
/** Philosophy Lounge: armchairs by the fire at the far end, bookcases along both side walls. */
export const LOUNGE = { width: 8, length: 9, height: 3.4, seatingZ: -2, chairX: 0.95, bookcaseZ: 1, bookcaseLength: 3.2 }
export const COURTYARD = { width: 14, length: 18, hedgeHeight: 1.2 }
/** The café building sits against the far end of the courtyard. */
export const CAFE = { width: 8, depth: 4, height: 3.2, frontZ: COURTYARD.length / 2 - 4 }
/** Bistro tables outside the café, as [x, z]. */
export const CAFE_TABLES: [number, number][] = [
  [-2.2, CAFE.frontZ - 1.7],
  [2.2, CAFE.frontZ - 1.7],
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
