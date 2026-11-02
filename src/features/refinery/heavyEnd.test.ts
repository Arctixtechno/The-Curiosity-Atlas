import { beforeEach, describe, expect, it } from 'vitest'
import { COKER_START, drumCycle, HC_START, reformerEquilibrium, runCoker, runHydrocracker, runSmr, SMR_START } from './heavyEnd.ts'
import { HEAVY_END_TASKS } from './heavyEndTasks.ts'
import { controls, getPlant, treatingResult } from './plant.ts'
import { siteBalance } from './site.ts'

beforeEach(() => controls.reset())

describe('delayed coker', () => {
  const on = { ...COKER_START, running: true }

  it('makes about 1.6 times the feed’s carbon residue as coke, and balances', () => {
    const r = runCoker(15, 'brent', 550, on)
    expect(r.yields.coke).toBeGreaterThan(1.4 * r.ccr)
    expect(r.yields.coke).toBeLessThan(1.8 * r.ccr)
    const total = r.yields.gas + r.yields.lpg + r.yields.naphtha + r.yields.gasOil + r.yields.coke
    expect(total).toBeCloseTo(100, 6)
  })

  it('makes more coke from a heavier residue and at higher pressure', () => {
    expect(runCoker(15, 'maya', 550, on).yields.coke).toBeGreaterThan(runCoker(15, 'brent', 550, on).yields.coke * 1.5)
    expect(runCoker(15, 'brent', 550, { ...on, pressure: 4 }).yields.coke).toBeGreaterThan(runCoker(15, 'brent', 550, on).yields.coke)
  })

  it('fills its drums higher on a longer cycle, and warns of foam-over', () => {
    const short = runCoker(25, 'brent', 550, { ...on, cycle: 14 })
    const long = runCoker(25, 'brent', 550, { ...on, cycle: 24 })
    expect(long.fill).toBeGreaterThan(short.fill)
    expect(long.warnings.some((w) => w.includes('foam'))).toBe(true)
  })

  it('switches drums each cycle', () => {
    expect(drumCycle(1, 18).filling).toBe('A')
    expect(drumCycle(19, 18).filling).toBe('B')
    expect(drumCycle(37, 18).filling).toBe('A')
  })
})

describe('hydrocracker', () => {
  const on = { ...HC_START, running: true, feed: 15 }

  it('converts more when hotter, and less of it to middle distillates', () => {
    const cool = runHydrocracker(15, 0, 6000, { ...on, temp: 380 })
    const hot = runHydrocracker(15, 0, 6000, { ...on, temp: 410 })
    expect(hot.conversion).toBeGreaterThan(cool.conversion)
    const middle = (r: typeof hot) => (r.rates.jet + r.rates.diesel) / (r.rates.jet + r.rates.diesel + r.rates.naphtha + r.rates.lpg)
    expect(middle(hot)).toBeLessThan(middle(cool))
  })

  it('reaches near-complete conversion with recycle', () => {
    expect(runHydrocracker(15, 0, 6000, { ...on, recycle: true, temp: 400 }).conversion).toBeGreaterThan(95)
  })

  it('uses 2–3.5 wt% hydrogen', () => {
    const r = runHydrocracker(15, 0, 6000, on)
    expect(r.hydrogenPct).toBeGreaterThan(2)
    expect(r.hydrogenPct).toBeLessThan(3.5)
  })
})

describe('hydrogen plant', () => {
  it('converts more methane hotter and with more steam', () => {
    expect(reformerEquilibrium(900, 3).conversion).toBeGreaterThan(reformerEquilibrium(820, 3).conversion)
    expect(reformerEquilibrium(860, 4).conversion).toBeGreaterThan(reformerEquilibrium(860, 2.5).conversion)
  })

  it('makes hydrogen on about 160 MJ of gas and 9 t of CO₂ a tonne', () => {
    const r = runSmr(50, { ...SMR_START, running: true })
    expect(r.hydrogen).toBe(50)
    expect(r.gasPerKg).toBeGreaterThan(140)
    expect(r.gasPerKg).toBeLessThan(185)
    expect(r.co2 / r.hydrogen).toBeGreaterThan(7.5)
    expect(r.co2 / r.hydrogen).toBeLessThan(11)
  })

  it('follows the header: makes what the reformer can’t', () => {
    controls.setHydrocracker({ running: true, feed: 20 })
    const before = treatingResult()
    expect(before.hydrogen.imported).toBeGreaterThan(0)
    controls.setSmr({ running: true })
    const after = treatingResult()
    expect(after.hydrogen.imported).toBeCloseTo(0, 6)
    expect(after.smr.hydrogen).toBeCloseTo(before.hydrogen.imported, 6)
  })
})

describe('on the site', () => {
  it('coking the residue cuts fuel oil and sells coke', () => {
    const before = siteBalance()
    controls.setCoker({ running: true })
    const after = siteBalance()
    const fuelOil = (b: typeof before) => b.products.find((o) => o.id === 'fuelOil')!.rate
    expect(fuelOil(after)).toBeLessThan(fuelOil(before) - 5)
    expect(after.products.find((o) => o.id === 'coke')!.rate).toBeGreaterThan(200)
  })

  it('hydrocracking adds jet and diesel, and draws on the gas oil', () => {
    const before = siteBalance()
    controls.setHydrocracker({ running: true, feed: 10 })
    const after = siteBalance()
    const rate = (b: typeof before, id: string) => b.products.find((o) => o.id === id)!.rate
    expect(rate(after, 'jet')).toBeGreaterThan(rate(before, 'jet'))
    expect(after.vgoToTank).toBeLessThan(before.vgoToTank)
  })
})

describe('heavy end tasks', () => {
  const met = (id: string) => HEAVY_END_TASKS.find((t) => t.id === id)!.met(getPlant(), treatingResult())

  it('starts with none met', () => {
    for (const t of HEAVY_END_TASKS) expect(met(t.id), t.id).toBe(false)
  })

  it('can bring the coker on line', () => {
    controls.setCoker({ running: true, cycle: 16 })
    expect(met('coker-start')).toBe(true)
  })

  it('can coke Maya', () => {
    controls.setCrude('maya')
    controls.setFeed(60)
    controls.setCoker({ running: true, cycle: 14, recycle: 0.05, pressure: 1.2 })
    expect(met('coker-maya')).toBe(true)
  })

  it('can make diesel and recycle to extinction', () => {
    controls.setCoker({ running: true })
    controls.setHydrocracker({ running: true, feed: 18, temp: 395 })
    expect(met('hc-diesel')).toBe(true)
    controls.setHydrocracker({ recycle: true, feed: 10, temp: 402 })
    expect(met('hc-extinction')).toBe(true)
  })

  it('can make all its own hydrogen, efficiently', () => {
    controls.setHydrocracker({ running: true, feed: 18 })
    controls.setSmr({ running: true })
    expect(met('smr-own')).toBe(true)
    controls.setSmr({ outlet: 890, steamCarbon: 2.6 })
    expect(met('smr-efficient')).toBe(true)
  })
})
