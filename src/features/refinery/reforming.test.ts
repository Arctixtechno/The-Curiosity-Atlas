import { beforeEach, describe, expect, it } from 'vitest'
import { controls, getPlant, reformingResult } from './plant.ts'
import { feedOctane, FRESH_CATALYST, NAPHTHA_PNA, REFORMER_LIMITS, REFORMER_START, runNht, runReformer } from './reformer.ts'
import { REFORMING_TASKS } from './reformingTasks.ts'

const FEED = { rate: 16.5, ...NAPHTHA_PNA.brent, endPoint: 165, sulphur: 0.2 }

describe('naphtha hydrotreater', () => {
  it('takes sulphur down a thousandfold at design and lets it through when cold', () => {
    expect(runNht(600, 16.5, { temp: 320 }).sulphurOut).toBeLessThan(REFORMER_LIMITS.sulphurMax)
    const cold = runNht(600, 16.5, { temp: 295 })
    expect(cold.sulphurOut).toBeGreaterThan(REFORMER_LIMITS.sulphurMax)
    expect(cold.warnings.length).toBe(1)
  })
})

describe('catalytic reformer', () => {
  it('turns a 65 octane naphtha into reformate of about 97 at design', () => {
    expect(feedOctane(NAPHTHA_PNA.brent)).toBeLessThan(70)
    const r = runReformer(REFORMER_START, FEED, FRESH_CATALYST)
    expect(r.octane).toBeGreaterThan(96)
    expect(r.octane).toBeLessThan(99)
    expect(r.yields.reformate).toBeGreaterThan(85)
    expect(r.yields.hydrogen).toBeGreaterThan(2.5)
    expect(r.yields.hydrogen).toBeLessThan(3.8)
    expect(r.composition.a).toBeGreaterThan(60)
  })

  it('closes its mass balance', () => {
    const y = runReformer(REFORMER_START, FEED, FRESH_CATALYST).yields
    expect(y.reformate + y.hydrogen + y.lpg + y.fuelGas).toBeCloseTo(100, 6)
  })

  it('cools the oil in every reactor, most in the first, and reheats it between', () => {
    const r = runReformer(REFORMER_START, FEED, FRESH_CATALYST)
    expect(r.drops[0]).toBeGreaterThan(r.drops[1])
    expect(r.drops[1]).toBeGreaterThan(r.drops[2])
    for (const d of r.drops) expect(d).toBeGreaterThan(20)
    expect(r.profile[0].temp).toBeCloseTo(REFORMER_START.wait, 6)
    expect(r.duty).toBeGreaterThan(10)
  })

  it('trades yield for octane as the reactors get hotter', () => {
    const cool = runReformer({ ...REFORMER_START, wait: 495 }, FEED, FRESH_CATALYST)
    const hot = runReformer({ ...REFORMER_START, wait: 520 }, FEED, FRESH_CATALYST)
    expect(hot.octane).toBeGreaterThan(cool.octane + 3)
    expect(hot.yields.reformate).toBeLessThan(cool.yields.reformate)
    expect(hot.cokeRate).toBeGreaterThan(cool.cokeRate)
  })

  it('makes more hydrogen and reformate at low pressure, but cokes faster', () => {
    const low = runReformer({ ...REFORMER_START, pressure: 8 }, FEED, FRESH_CATALYST)
    const high = runReformer({ ...REFORMER_START, pressure: 28 }, FEED, FRESH_CATALYST)
    expect(low.yields.hydrogen).toBeGreaterThan(high.yields.hydrogen)
    expect(low.yields.reformate).toBeGreaterThan(high.yields.reformate)
    expect(low.cokeRate).toBeGreaterThan(high.cokeRate * 3)
  })

  it('loses activity to coke and to sulphur', () => {
    const fresh = runReformer(REFORMER_START, FEED, FRESH_CATALYST)
    const old = runReformer(REFORMER_START, FEED, { days: 200, coke: 12 })
    const poisoned = runReformer(REFORMER_START, { ...FEED, sulphur: 3 }, FRESH_CATALYST)
    expect(old.octane).toBeLessThan(fresh.octane - 2)
    expect(poisoned.octane).toBeLessThan(fresh.octane - 2)
    expect(poisoned.warnings.some((w) => w.includes('poisoning'))).toBe(true)
  })

  it('reforms naphthenic feed more easily than paraffinic', () => {
    const maya = runReformer(REFORMER_START, { ...FEED, ...NAPHTHA_PNA.maya }, FRESH_CATALYST)
    const arab = runReformer(REFORMER_START, { ...FEED, ...NAPHTHA_PNA.arabLight }, FRESH_CATALYST)
    expect(maya.octane).toBeGreaterThan(arab.octane + 3)
    expect(maya.yields.reformate).toBeGreaterThan(arab.yields.reformate)
  })
})

describe('linked units, the catalyst cycle and shift tasks', () => {
  beforeEach(() => controls.reset())

  it('feeds the reformer the heavy naphtha, and a heavier naphtha cut cokes faster', () => {
    const base = reformingResult()
    expect(base.feed.rate).toBeGreaterThan(10)
    expect(base.feed.rate).toBeLessThan(base.cdu.products.naphtha.rate)
    controls.setColumn({ topTemp: 145 })
    const heavier = reformingResult()
    expect(heavier.feed.endPoint).toBeGreaterThan(base.feed.endPoint)
    expect(heavier.reformer.cokeRate).toBeGreaterThan(base.reformer.cokeRate)
  })

  it('cokes the catalyst as it runs on, and regenerating restores it', () => {
    const start = reformingResult().reformer.octane
    controls.runCatalyst(150)
    expect(getPlant().catalyst.coke).toBeGreaterThan(8)
    expect(reformingResult().reformer.octane).toBeLessThan(start - 2)
    expect(getPlant().cycle).toHaveLength(2)
    controls.regenerate()
    expect(reformingResult().reformer.octane).toBeCloseTo(start, 6)
    expect(getPlant().cycle).toHaveLength(0)
  })

  it('leaves every task undone at design, and every one can be done', () => {
    const met = (id: string) => REFORMING_TASKS.find((t) => t.id === id)!.met(getPlant(), reformingResult())
    for (const t of REFORMING_TASKS) expect(met(t.id)).toBe(false)

    controls.setReformer({ wait: 512 })
    expect(met('ref-98')).toBe(true)

    controls.reset()
    controls.setReformer({ pressure: 8, wait: 515 })
    expect(met('ref-hydrogen')).toBe(true)

    controls.reset()
    controls.setCrude('arabLight')
    controls.setReformer({ wait: 520, pressure: 8 })
    expect(met('ref-arab')).toBe(true)

    // Holding 97.5 octane by raising the inlets: design pressure runs out of room, more hydrogen pressure makes it.
    const run = (pressure: number, h2hc: number) => {
      controls.reset()
      controls.setReformer({ pressure, h2hc, wait: 500 })
      for (let day = 0; day < 240; day += 10) {
        while (reformingResult().reformer.octane < 97.5 && getPlant().reformer.wait < REFORMER_LIMITS.waitMax)
          controls.setReformer({ wait: getPlant().reformer.wait + 1 })
        controls.runCatalyst(10)
      }
      return met('ref-cycle')
    }
    expect(run(18, 5)).toBe(false)
    expect(run(25, 7)).toBe(true)
  })
})
