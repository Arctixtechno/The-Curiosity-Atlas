import { describe, expect, it } from 'vitest'
import { THEATRE, THEATRE_AISLE, THEATRE_LANDING_HEIGHT, THEATRE_TIERS, theatreFloorHeight } from './dimensions.ts'

describe('theatreFloorHeight', () => {
  it('is level with the entrance landing at the door and the floor by the screen', () => {
    expect(theatreFloorHeight(0, THEATRE.length / 2 - 1)).toBe(THEATRE_LANDING_HEIGHT)
    expect(theatreFloorHeight(0, -THEATRE.length / 2 + 1)).toBe(0)
  })

  it('descends the aisle in small, even steps', () => {
    let previous = theatreFloorHeight(0, THEATRE_TIERS[0].fromZ - 0.1)
    for (let z = THEATRE_TIERS[0].fromZ; z < THEATRE.length / 2; z += 0.05) {
      const h = theatreFloorHeight(0, z)
      expect(h).toBeGreaterThanOrEqual(previous)
      expect(h - previous).toBeLessThanOrEqual(THEATRE_AISLE.stepHeight + 1e-9)
      previous = h
    }
  })

  it('puts each row of seats on its own tier', () => {
    for (const tier of THEATRE_TIERS) {
      if (tier.rowZ !== undefined) expect(theatreFloorHeight(3, tier.rowZ)).toBe(tier.height)
    }
  })
})
