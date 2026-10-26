import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { EYE_HEIGHT, loungeChair } from '../../rooms/dimensions.ts'
import { pathToSeat } from './Seat.tsx'

describe('sitting down', () => {
  const chair = loungeChair(-1)
  // Inside the chair's back or arms, in its own frame. Over the seat itself is fine: that's sitting down.
  const inChair = (p: Vector3) => {
    const dx = p.x - chair.x
    const dz = p.z - chair.z
    const across = dx * Math.cos(chair.rotationY) - dz * Math.sin(chair.rotationY)
    const along = dx * Math.sin(chair.rotationY) + dz * Math.cos(chair.rotationY)
    const inFootprint = Math.abs(across) < 0.5 && along > -0.5 && along < 0.3
    return inFootprint && (along < -0.2 || Math.abs(across) > 0.32)
  }

  it.each([
    ['in front', [0, 0]],
    ['behind', [-2.6, -1.5]],
    ['beside', [-1.2, 0.6]],
    ['by the door', [-1, 3.5]],
  ])('walks round the chair from %s, never through it', (_, [x, z]) => {
    const path = pathToSeat(new Vector3(x, EYE_HEIGHT, z))
    for (let i = 0; i <= 200; i++) expect(inChair(path.getPoint(i / 200))).toBe(false)
  })
})
