import { describe, expect, it } from 'vitest'
import { exitVelocity, flameTilt, radiation, safeDistance } from './flare.ts'
import { beaufort, compass, downwind, PREVAILING, windOn } from './weather.ts'

describe('the wind', () => {
  it('is fixed by the time, and stays within believable bounds', () => {
    expect(windOn(12.3)).toEqual(windOn(12.3))
    for (let d = 0; d < 365; d += 0.25) {
      const w = windOn(d)
      expect(w.from).toBeGreaterThanOrEqual(0)
      expect(w.from).toBeLessThan(360)
      expect(w.speed).toBeGreaterThan(0)
      expect(w.speed).toBeLessThan(20)
    }
  })

  it('blows mostly from the south-west over a year', () => {
    let sw = 0
    for (let d = 0; d < 365; d += 0.5) if (Math.abs(windOn(d).from - PREVAILING) < 67.5) sw++
    expect(sw / 730).toBeGreaterThan(0.6)
  })

  it('carries things the right way on the site’s map, north being −z', () => {
    const [x, z] = downwind({ from: 225, speed: 5 })
    // From the south-west, towards the north-east: east (+x) and north (−z).
    expect(x).toBeGreaterThan(0.6)
    expect(z).toBeLessThan(-0.6)
    expect(downwind({ from: 270, speed: 5 })[0]).toBeCloseTo(1)
    expect(compass(225)).toBe('SW')
    expect(compass(350)).toBe('N')
    expect(beaufort(0.2).force).toBe(0)
    expect(beaufort(9).name).toBe('Fresh breeze')
  })
})

describe('the flare in the wind', () => {
  it('lays a small flame over further than a big relief', () => {
    expect(exitVelocity(260)).toBeGreaterThan(exitVelocity(10))
    expect(flameTilt(0.5, 8)).toBeGreaterThan(flameTilt(260, 8))
    expect(flameTilt(260, 0)).toBe(0)
    expect(flameTilt(120, 15)).toBeGreaterThan(flameTilt(120, 3))
  })

  it('moves the radiation downwind', () => {
    const mw = 1500
    const tilt = flameTilt(120, 10)
    expect(radiation(mw, 60, 60, tilt)).toBeGreaterThan(radiation(mw, -60, 60, tilt))
    expect(safeDistance(mw, 1.58, 60, tilt)).toBeGreaterThan(safeDistance(mw, 1.58, 60, 0))
    expect(safeDistance(mw, 1.58, 60, 0)).toBeGreaterThan(0)
    // With no wind it's the same either side.
    expect(radiation(mw, 60, 60, 0)).toBeCloseTo(radiation(mw, -60, 60, 0))
  })
})
