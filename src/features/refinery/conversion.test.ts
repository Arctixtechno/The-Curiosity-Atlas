import { beforeEach, describe, expect, it } from 'vitest'
import { CONVERSION_TASKS, withinLimits } from './conversionTasks.ts'
import { CRUDES, percentBelow } from './crudes.ts'
import { DEFAULT_FEED, FCC_LIMITS, FCC_START, runFcc } from './fcc.ts'
import { controls, conversionResult, getPlant } from './plant.ts'
import { atmosphericEquivalent, runVdu, VDU_START } from './vdu.ts'

describe('vacuum unit', () => {
  it('boils oil far below its normal boiling point under vacuum', () => {
    expect(atmosphericEquivalent(100, 760)).toBeCloseTo(100, 5)
    // 400 °C at 40 mmHg is about 560 °C at atmospheric pressure, as on a Maxwell–Bonnell chart.
    expect(atmosphericEquivalent(400, 40)).toBeGreaterThan(540)
    expect(atmosphericEquivalent(400, 40)).toBeLessThan(580)
  })

  it('cuts deeper with lower pressure, more heat or steam, and the gas oil gets dirtier', () => {
    const base = runVdu('brent', 100, 360, VDU_START)
    expect(base.cutPoint).toBeGreaterThan(530)
    expect(base.cutPoint).toBeLessThan(570)
    const deeper = [
      runVdu('brent', 100, 360, { ...VDU_START, pressure: 20 }),
      runVdu('brent', 100, 360, { ...VDU_START, cot: 410 }),
      runVdu('brent', 100, 360, { ...VDU_START, steam: true }),
    ]
    for (const d of deeper) {
      expect(d.vgo).toBeGreaterThan(base.vgo)
      expect(d.carbon).toBeGreaterThan(base.carbon)
    }
  })

  it('balances: residue in equals gas oil plus vacuum residue', () => {
    const r = runVdu('arabLight', 80, 360, VDU_START)
    expect(r.vgo + r.residue).toBeCloseTo(100 - percentBelow(CRUDES.arabLight, 360), 6)
    expect(r.vgoRate + r.residueRate).toBeCloseTo(((r.vgo + r.residue) / 100) * 80, 6)
  })

  it('makes heavier crudes give dirtier gas oil', () => {
    const brent = runVdu('brent', 100, 360, VDU_START)
    const maya = runVdu('maya', 100, 360, VDU_START)
    expect(maya.metals).toBeGreaterThan(brent.metals * 5)
    expect(maya.carbon).toBeGreaterThan(brent.carbon)
  })
})

describe('cat cracker', () => {
  it('lines out like a typical gas oil cracker at design', () => {
    const r = runFcc(FCC_START, DEFAULT_FEED)
    expect(r.catOil).toBeGreaterThan(5)
    expect(r.catOil).toBeLessThan(7.5)
    expect(r.regenTemp).toBeGreaterThan(690)
    expect(r.regenTemp).toBeLessThan(FCC_LIMITS.regenMax)
    expect(r.conversion).toBeGreaterThan(70)
    expect(r.conversion).toBeLessThan(80)
    expect(r.yields.coke).toBeGreaterThan(4)
    expect(r.yields.coke).toBeLessThan(6)
    expect(r.yields.gasoline).toBeGreaterThan(48)
    expect(withinLimits(r)).toBe(true)
  })

  it('closes its mass balance', () => {
    const y = runFcc(FCC_START).yields
    expect(y.dryGas + y.lpg + y.gasoline + y.lco + y.slurry + y.coke).toBeCloseTo(100, 6)
  })

  it('closes its heat balance: the coke burned supplies everything the riser needs', () => {
    const h = runFcc(FCC_START).heat
    expect(h.coke).toBeCloseTo(h.feedHeating + h.vaporising + h.cracking + h.air + h.cooler + h.losses, 0)
  })

  it('circulates less catalyst, converts less and runs the regenerator hotter on hotter feed', () => {
    const cool = runFcc({ ...FCC_START, preheat: 200 })
    const hot = runFcc({ ...FCC_START, preheat: 300 })
    expect(hot.catOil).toBeLessThan(cool.catOil)
    expect(hot.conversion).toBeLessThan(cool.conversion)
    expect(hot.regenTemp).toBeGreaterThan(cool.regenTemp)
  })

  it('makes more octane and more coke with a hotter riser', () => {
    const cool = runFcc({ ...FCC_START, rot: 515 })
    const hot = runFcc({ ...FCC_START, rot: 540 })
    expect(hot.octane).toBeGreaterThan(cool.octane)
    expect(hot.yields.lpg).toBeGreaterThan(cool.yields.lpg)
    expect(hot.regenTemp).toBeGreaterThan(cool.regenTemp)
  })

  it('runs the regenerator hot on feed with carbon residue, and a catalyst cooler brings it back', () => {
    const dirty = { carbon: 2, metals: 3, crackability: 0.95 }
    const hot = runFcc(FCC_START, dirty)
    expect(hot.regenTemp).toBeGreaterThan(runFcc(FCC_START).regenTemp + 30)
    expect(hot.warnings.some((w) => w.includes('regenerator'))).toBe(true)
    const cooled = runFcc({ ...FCC_START, cooler: 20 }, dirty)
    expect(cooled.regenTemp).toBeLessThan(FCC_LIMITS.regenMax)
  })

  it('scales air and gas with feed, so the blower sets the maximum rate', () => {
    expect(runFcc({ ...FCC_START, feed: 45 }).air).toBeGreaterThan(FCC_LIMITS.airMax)
    expect(runFcc({ ...FCC_START, feed: 45 }).warnings.some((w) => w.includes('air blower'))).toBe(true)
  })
})

describe('linked units and shift tasks', () => {
  beforeEach(() => controls.reset())

  it('feeds the cat cracker gas oil whose quality follows the vacuum unit', () => {
    const base = conversionResult()
    controls.setVdu({ cot: 410, pressure: 25, steam: true })
    const deep = conversionResult()
    expect(deep.vdu.vgoRate).toBeGreaterThan(base.vdu.vgoRate)
    expect(deep.fcc.regenTemp).toBeGreaterThan(base.fcc.regenTemp)
    expect(base.toTank).toBeCloseTo(base.vdu.vgoRate - getPlant().fcc.feed, 6)
  })

  it('leaves every task undone at design, and every one can be done', () => {
    const done = (id: string) => CONVERSION_TASKS.find((t) => t.id === id)!.met(getPlant(), conversionResult())
    for (const t of CONVERSION_TASKS) expect(done(t.id)).toBe(false)

    controls.setFcc({ rot: 542, preheat: 180, cooler: 10 })
    expect(done('fcc-octane')).toBe(true)

    controls.reset()
    controls.setFcc({ feed: 45, preheat: 300 })
    expect(done('fcc-max-feed')).toBe(true)

    controls.reset()
    controls.setVdu({ cot: 405, pressure: 30, steam: true })
    controls.setFcc({ preheat: 200, cooler: 10 })
    expect(done('vdu-deep-cut')).toBe(true)

    controls.reset()
    controls.setCrude('maya')
    controls.setVdu({ pressure: 60 })
    expect(done('fcc-maya')).toBe(true)
  })
})
