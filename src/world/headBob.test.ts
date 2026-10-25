import { describe, expect, it } from 'vitest'
import { BOB_HEIGHT, headBobOffset } from './headBob.ts'

describe('headBobOffset', () => {
  it('rests at eye height when standing still', () => {
    expect(headBobOffset(1.3, 0)).toEqual({ up: -0, side: 0 })
  })

  it('dips once per step, never rising above eye height', () => {
    expect(headBobOffset(0, 1).up).toBeCloseTo(0)
    expect(headBobOffset(Math.PI / 2, 1).up).toBeCloseTo(-BOB_HEIGHT)
    expect(headBobOffset(Math.PI, 1).up).toBeCloseTo(0)
    for (let p = 0; p < 10; p += 0.1) expect(headBobOffset(p, 1).up).toBeLessThanOrEqual(0)
  })

  it('sways to opposite sides on alternate steps', () => {
    expect(Math.sign(headBobOffset(0, 1).side)).toBe(-Math.sign(headBobOffset(Math.PI, 1).side))
  })
})
