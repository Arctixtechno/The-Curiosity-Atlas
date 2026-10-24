import type { Collider } from '../types/room.ts'

// Room sizes in metres, shared by the registry (colliders, doors) and the
// lazily loaded interiors (geometry).
export const MAIN_HALL = { width: 8, length: 20, height: 3.6 }
export const THEATRE = { width: 10, length: 14, height: 5 }
/** Recliner rows (z) and seat/table positions (x): two pairs either side of a centre aisle. */
export const THEATRE_ROWS = [-1.4, 1.6]
export const THEATRE_SEAT_XS = [-2.55, -1.25, 1.25, 2.55]
export const THEATRE_TABLE_XS = [-1.9, 1.9]
/** Philosophy Lounge: armchairs by the fire at the far end, bookcases along both side walls. */
export const LOUNGE = { width: 8, length: 9, height: 3.4, seatingZ: -2, chairX: 0.95, bookcaseZ: 1, bookcaseLength: 3.2 }
export const OBSERVATORY = { width: 10, length: 10, height: 4 }
export const COURTYARD = { width: 14, length: 18, hedgeHeight: 1.2 }
/** The café building sits against the far end of the courtyard. */
export const CAFE = { width: 8, depth: 4, height: 3.2, frontZ: COURTYARD.length / 2 - 4 }

/** Columned porch around the house's front door, relative to the house wall. */
export const PORTICO = { columnX: 1.35, columnZ: 1.1, height: 3.3 }

export const WALL_THICKNESS = 0.2
export const EYE_HEIGHT = 1.65

/** Four walls enclosing a width × length floor centred on the origin. */
export function wallColliders(width: number, length: number, t = WALL_THICKNESS): Collider[] {
  const hw = width / 2
  const hl = length / 2
  return [
    { minX: -hw - t, maxX: -hw, minZ: -hl, maxZ: hl },
    { minX: hw, maxX: hw + t, minZ: -hl, maxZ: hl },
    { minX: -hw, maxX: hw, minZ: -hl - t, maxZ: -hl },
    { minX: -hw, maxX: hw, minZ: hl, maxZ: hl + t },
  ]
}

export function boxCollider(x: number, z: number, sizeX: number, sizeZ: number): Collider {
  return { minX: x - sizeX / 2, maxX: x + sizeX / 2, minZ: z - sizeZ / 2, maxZ: z + sizeZ / 2 }
}
