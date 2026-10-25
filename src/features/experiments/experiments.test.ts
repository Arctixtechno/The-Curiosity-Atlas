import { describe, expect, it } from 'vitest'
import { acceleration, BLOCKS, LIQUIDS, settle } from './buoyancy.ts'
import { ATMOSPHERE_KPA, GAS_START, pressureKPa, rmsSpeed } from './gasLaw.ts'

const block = (id: string) => BLOCKS.find((b) => b.id === id)!
const liquid = (id: string) => LIQUIDS.find((l) => l.id === id)!

describe('ideal gas law', () => {
  it('gives one atmosphere for a mole at 0 °C in 22.414 litres', () => {
    expect(pressureKPa({ moles: 1, kelvin: 273.15, litres: 22.414 })).toBeCloseTo(ATMOSPHERE_KPA, 1)
  })

  it("follows Boyle's law: half the volume, twice the pressure", () => {
    const p = pressureKPa(GAS_START)
    expect(pressureKPa({ ...GAS_START, litres: GAS_START.litres / 2 })).toBeCloseTo(p * 2, 9)
  })

  it('starts the bench near atmospheric pressure', () => {
    expect(Math.abs(pressureKPa(GAS_START) - ATMOSPHERE_KPA)).toBeLessThan(2)
  })

  it('gives nitrogen molecules a typical speed of about 517 m/s at 300 K', () => {
    expect(rmsSpeed(300)).toBeCloseTo(517, 0)
  })
})

describe('buoyancy', () => {
  it('floats ice in fresh water with about 92% under the surface', () => {
    const r = settle(block('ice'), liquid('water'))
    expect(r.floats).toBe(true)
    expect(r.submerged).toBeCloseTo(0.919, 3)
    expect(r.buoyancy).toBeCloseTo(r.weight, 9)
  })

  it('sinks steel in water, but floats it on mercury', () => {
    expect(settle(block('steel'), liquid('water')).floats).toBe(false)
    expect(settle(block('steel'), liquid('mercury')).submerged).toBeCloseTo(0.58, 2)
  })

  it('makes a litre of aluminium weigh 16.7 N less than 26.5 N under water', () => {
    const r = settle(block('aluminium'), liquid('water'))
    expect(r.weight).toBeCloseTo(26.49, 2)
    expect(r.apparentWeight).toBeCloseTo(26.49 - 9.79, 1)
  })

  it('brings a floating block to rest where the forces balance', () => {
    const b = block('pine')
    const l = liquid('water')
    let depth = 0
    let velocity = 0
    for (let t = 0; t < 20; t += 0.002) {
      velocity += acceleration(b, l, depth, velocity) * 0.002
      depth -= velocity * 0.002
    }
    expect(depth / 0.1).toBeCloseTo(settle(b, l).submerged, 2)
  })
})
