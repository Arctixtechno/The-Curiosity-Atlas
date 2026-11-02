import { beforeEach, describe, expect, it } from 'vitest'
import { blendProperties, dieselGrade, evaluateBlend, optimiseBlend, petrolGrade, type Component } from './blending.ts'
import { ALKY_START, GAS_PLANT_LIMITS, GAS_PLANT_START, ISOM_START, kbpd, runAlky, runGasPlant, runIsom, type Lpg } from './lightEnds.ts'
import { lightEndsResult, type Pool } from './lightEndsPlant.ts'
import { BLENDING_TASKS, LIGHT_ENDS_TASKS } from './lightEndsTasks.ts'
import { maximise } from './lp.ts'
import { controls, getPlant } from './plant.ts'

const LPG: Lpg = { propane: 3, propylene: 1.5, isobutane: 2, butane: 2.5, butylenes: 1.5 }

describe('linear programme', () => {
  it('solves a textbook problem', () => {
    // Max 3x + 5y, x ≤ 4, 2y ≤ 12, 3x + 2y ≤ 18: optimum at (2, 6), worth 36.
    const r = maximise([3, 5], [[1, 0], [0, 2], [3, 2]], [4, 12, 18])
    expect(r.bounded).toBe(true)
    expect(r.x[0]).toBeCloseTo(2, 9)
    expect(r.x[1]).toBeCloseTo(6, 9)
    expect(r.value).toBeCloseTo(36, 9)
  })

  it('reports an unbounded problem', () => {
    expect(maximise([1, 1], [[1, -1]], [1]).bounded).toBe(false)
  })
})

describe('gas plant', () => {
  it('converts tonnes to barrels', () => {
    expect(kbpd(158.987, 1000)).toBeCloseTo(1, 9)
  })

  it('sharpens the split and costs more heat as reflux rises', () => {
    const lean = runGasPlant(LPG, { reflux: 1.8 })
    const rich = runGasPlant(LPG, { reflux: 4 })
    expect(rich.butaneInPropane).toBeLessThan(lean.butaneInPropane)
    expect(rich.duty).toBeGreaterThan(lean.duty)
  })

  it('warns below minimum reflux and when propane is off spec', () => {
    const r = runGasPlant(LPG, { reflux: GAS_PLANT_LIMITS.reflux.min })
    expect(r.minReflux).toBeGreaterThan(GAS_PLANT_LIMITS.reflux.min)
    expect(r.warnings.length).toBeGreaterThan(0)
  })

  it('conserves every component', () => {
    const r = runGasPlant(LPG, GAS_PLANT_START)
    for (const k of Object.keys(LPG) as (keyof Lpg)[]) expect(r.overhead[k] + r.bottoms[k]).toBeCloseTo(LPG[k], 9)
  })
})

describe('isomerisation', () => {
  it('has a best once-through temperature between too cold and too hot', () => {
    const at = (temp: number) => runIsom(10, { ...ISOM_START, temp }).octane
    const best = [100, 120, 140, 160, 180, 200, 220].reduce((a, t) => (at(t) > at(a) ? t : a), 100)
    expect(best).toBeGreaterThan(120)
    expect(best).toBeLessThan(200)
    expect(at(best)).toBeGreaterThan(at(100))
    expect(at(best)).toBeGreaterThan(at(220))
  })

  it('never passes equilibrium once through, and recycle adds octane', () => {
    for (const temp of [110, 150, 210]) {
      const r = runIsom(10, { ...ISOM_START, temp })
      expect(r.iso).toBeLessThanOrEqual(r.equilibrium + 1e-12)
      expect(runIsom(10, { ...ISOM_START, temp, recycle: true }).octane).toBeGreaterThan(r.octane + 2)
    }
  })
})

describe('alkylation', () => {
  const bottoms: Lpg = { propane: 0.05, propylene: 0.02, isobutane: 3, butane: 2.5, butylenes: 1.5 }
  const overhead: Lpg = { propane: 3, propylene: 1.5, isobutane: 0.02, butane: 0.02, butylenes: 0.01 }

  it('makes better alkylate cold, with more isobutane and strong acid', () => {
    const base = runAlky(bottoms, overhead, ALKY_START).octane
    expect(runAlky(bottoms, overhead, { ...ALKY_START, temp: 4 }).octane).toBeGreaterThan(base)
    expect(runAlky(bottoms, overhead, { ...ALKY_START, ratio: 12 }).octane).toBeGreaterThan(base)
    expect(runAlky(bottoms, overhead, { ...ALKY_START, acid: 87 }).octane).toBeLessThan(base)
  })

  it('makes more but poorer alkylate with propylene, and uses more acid', () => {
    const c4 = runAlky(bottoms, overhead, ALKY_START)
    const both = runAlky(bottoms, overhead, { ...ALKY_START, propylene: true })
    expect(both.alkylate).toBeGreaterThan(c4.alkylate)
    expect(both.octane).toBeLessThan(c4.octane)
    expect(both.acidUse).toBeGreaterThan(c4.acidUse)
  })

  it('uses acid on the scale real units do', () => {
    // About 0.2–0.4 lb of acid per gallon of alkylate: tens of tonnes a day for a few thousand barrels.
    const r = runAlky(bottoms, overhead, ALKY_START)
    expect(r.acidUse).toBeGreaterThan(5)
    expect(r.acidUse).toBeLessThan(60)
  })
})

describe('blending', () => {
  const a: Component = { id: 'a', name: 'A', available: 10, density: 600, value: 50, colour: '', props: { ron: 90, rvp: 100, sulphur: 10 } }
  const b: Component = { id: 'b', name: 'B', available: 10, density: 800, value: 80, colour: '', props: { ron: 100, rvp: 20, sulphur: 0 } }

  it('averages octane by volume, sulphur by mass and vapour pressure by index', () => {
    const p = blendProperties([a, b], [1, 1])
    expect(p.ron).toBeCloseTo(95, 9)
    expect(p.sulphur).toBeCloseTo((600 * 10) / 1400, 9)
    // The index weights the volatile component more than a straight average would.
    expect(p.rvp!).toBeGreaterThan(60)
  })

  it('finds a recipe that meets every spec, and sells off-spec blends as blendstock', () => {
    const grade = petrolGrade('premium', 'summer')
    const result = lightEndsResult(getPlant())
    const best = evaluateBlend(grade, result.petrol.components, optimiseBlend(grade, result.petrol.components))
    expect(best.onSpec).toBe(true)
    expect(best.total).toBeGreaterThan(10)
    const all = evaluateBlend(
      grade,
      result.petrol.components,
      result.petrol.components.map((c) => c.available),
    )
    expect(all.onSpec).toBe(false)
    expect(best.margin).toBeGreaterThan(all.margin)
  })

  it('makes winter diesel only with something to bring the cloud point down', () => {
    const p = lightEndsResult(getPlant())
    const plain = evaluateBlend(dieselGrade('winter'), p.diesel.components, p.diesel.components.map((c) => (c.id === 'dhtDiesel' ? c.available : 0)))
    expect(plain.onSpec).toBe(false)
  })
})

/** Sets a pool to the planner's recipe, but as if typed in by hand. */
function byHand(pool: 'petrol' | 'diesel', p: Pool) {
  controls.applyRecipe(pool, Object.fromEntries(p.components.map((c, i) => [c.id, p.best.volumes[i]])), false)
}

describe('shift tasks', () => {
  beforeEach(() => controls.reset())

  it('starts with none met', () => {
    const r = lightEndsResult()
    for (const t of [...LIGHT_ENDS_TASKS, ...BLENDING_TASKS]) expect(t.met(getPlant(), r), t.id).toBe(false)
  })

  const check = (id: string, setup: () => void) =>
    it(`can meet ${id}`, () => {
      setup()
      const task = [...LIGHT_ENDS_TASKS, ...BLENDING_TASKS].find((t) => t.id === id)!
      expect(task.met(getPlant(), lightEndsResult())).toBe(true)
    })

  check('gp-lean', () => controls.setGasPlant({ reflux: 2.2 }))
  check('isom-best', () => controls.setIsom({ temp: 155, recycle: true }))
  check('alky-quality', () => controls.setAlky({ ratio: 12, temp: 4, acid: 94 }))
  check('alky-propylene', () => controls.setAlky({ propylene: true, ratio: 14, temp: 3, acid: 95 }))
  check('blend-95', () => byHand('petrol', lightEndsResult().petrol))
  check('blend-giveaway', () => byHand('petrol', lightEndsResult().petrol))
  check('blend-98', () => {
    controls.setBlend({ grade: 'super' })
    byHand('petrol', lightEndsResult().petrol)
  })
  check('blend-winter', () => {
    controls.setBlend({ season: 'winter' })
    byHand('diesel', lightEndsResult().diesel)
  })

  it("doesn't count the planner's own recipe", () => {
    const p = lightEndsResult().petrol
    controls.applyRecipe('petrol', Object.fromEntries(p.components.map((c, i) => [c.id, p.best.volumes[i]])), true)
    expect(BLENDING_TASKS.find((t) => t.id === 'blend-95')!.met(getPlant(), lightEndsResult())).toBe(false)
  })
})
