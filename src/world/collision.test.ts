import { describe, expect, it } from 'vitest'
import type { Collider } from '../types/room.ts'
import { moveWithCollisions } from './collision.ts'

const wall: Collider = { minX: 1, maxX: 2, minZ: -5, maxZ: 5 }

describe('moveWithCollisions', () => {
  it('moves freely when nothing is in the way', () => {
    expect(moveWithCollisions(0, 0, 0.2, 0.1, [wall])).toEqual([0.2, 0.1])
  })

  it('stops the player before walking into a wall', () => {
    const [x] = moveWithCollisions(0.6, 0, 0.2, 0, [wall])
    expect(x).toBe(0.6)
  })

  it('slides along a wall when moving diagonally into it', () => {
    const [x, z] = moveWithCollisions(0.6, 0, 0.2, 0.3, [wall])
    expect(x).toBe(0.6)
    expect(z).toBeCloseTo(0.3)
  })
})
