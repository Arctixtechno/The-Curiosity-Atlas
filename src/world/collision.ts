import type { Collider } from '../types/room.ts'

export const PLAYER_RADIUS = 0.3

function overlaps(x: number, z: number, radius: number, c: Collider): boolean {
  const nearestX = Math.max(c.minX, Math.min(x, c.maxX))
  const nearestZ = Math.max(c.minZ, Math.min(z, c.maxZ))
  const dx = x - nearestX
  const dz = z - nearestZ
  return dx * dx + dz * dz < radius * radius
}

function blocked(x: number, z: number, radius: number, colliders: Collider[]): boolean {
  return colliders.some((c) => overlaps(x, z, radius, c))
}

/**
 * Moves a circular player from (x, z) by (dx, dz), resolving each axis
 * separately so the player slides along walls instead of stopping dead.
 */
export function moveWithCollisions(
  x: number,
  z: number,
  dx: number,
  dz: number,
  colliders: Collider[],
  radius = PLAYER_RADIUS,
): [number, number] {
  let nextX = x + dx
  if (blocked(nextX, z, radius, colliders)) nextX = x
  let nextZ = z + dz
  if (blocked(nextX, nextZ, radius, colliders)) nextZ = z
  return [nextX, nextZ]
}
