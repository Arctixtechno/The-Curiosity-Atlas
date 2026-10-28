import { beforeEach, describe, expect, it } from 'vitest'
import { controls, getPlant, treatingResult } from './plant.ts'
import { DHT_LIMITS, DHT_START, hydrogenBalance, runDht, runSru, SRU_LIMITS } from './treating.ts'
import { TREATING_TASKS } from './treatingTasks.ts'

const FEED = { rate: 20, sulphur: 3000, lcoRate: 5, lcoSulphur: 7500 }

describe('diesel hydrotreater', () => {
  it('makes road diesel from straight-run gas oil at design, and not when cold', () => {
    expect(runDht(FEED, DHT_START).sulphurOut).toBeLessThan(DHT_LIMITS.sulphurMax)
    const cold = runDht(FEED, { ...DHT_START, temp: 335 })
    expect(cold.onSpec).toBe(false)
    expect(cold.warnings.length).toBeGreaterThan(0)
  })

  it('finds cycle oil much harder, and needs more hydrogen for it', () => {
    const straight = runDht(FEED, DHT_START)
    const cracked = runDht(FEED, { ...DHT_START, lco: true })
    expect(cracked.sulphurOut).toBeGreaterThan(straight.sulphurOut * 5)
    expect(cracked.hydrogenPct).toBeGreaterThan(straight.hydrogenPct * 1.5)
  })

  it('removes the hard sulphur with temperature or pressure, and pressure costs more hydrogen', () => {
    const hot = runDht(FEED, { ...DHT_START, lco: true, temp: 365 })
    const pressed = runDht(FEED, { ...DHT_START, lco: true, temp: 355, pressure: 62 })
    expect(hot.onSpec).toBe(true)
    expect(pressed.onSpec).toBe(true)
    expect(pressed.hydrogen).toBeGreaterThan(hot.hydrogen)
  })

  it('balances sulphur: what comes out of the oil leaves as H₂S', () => {
    const r = runDht({ ...FEED, lcoRate: 0 }, DHT_START)
    const tonnes = (20 * 158.987 * 850) / 1000
    expect(r.sulphurRemoved).toBeCloseTo((tonnes * (r.sulphurIn - r.sulphurOut)) / 1e6, 9)
  })
})

describe('hydrogen and sulphur', () => {
  it('imports only what the reformer can’t supply', () => {
    const short = hydrogenBalance(20, [{ name: 'a', tonnes: 15 }, { name: 'b', tonnes: 10 }])
    expect(short.imported).toBeCloseTo(5, 9)
    expect(short.surplus).toBe(0)
  })

  it('recovers most at the 2:1 ratio, more with a third converter, and nearly all with the tail gas unit', () => {
    const at = (air: number, converters: 2 | 3, tailGas = false) => runSru(50, { air, converters, tailGas })
    expect(at(100, 2).ratio).toBeCloseTo(2, 9)
    expect(at(100, 2).recovery).toBeGreaterThan(at(95, 2).recovery)
    expect(at(100, 2).recovery).toBeGreaterThan(at(105, 2).recovery)
    expect(at(95, 2).ratio).toBeGreaterThan(2)
    expect(at(105, 2).ratio).toBeLessThan(2)
    expect(at(100, 3).recovery).toBeGreaterThan(at(100, 2).recovery)
    expect(at(100, 3, true).recovery).toBeGreaterThan(99.9)
    expect(at(100, 2).so2).toBeCloseTo(2 * (50 - at(100, 2).sulphur), 9)
  })

  it('flares what the plant can’t take', () => {
    const over = runSru(SRU_LIMITS.capacity + 20, { air: 100, converters: 3, tailGas: true })
    expect(over.so2).toBeGreaterThan(40)
    expect(over.warnings.some((w) => w.includes('can take'))).toBe(true)
  })
})

describe('linked units and shift tasks', () => {
  beforeEach(() => controls.reset())

  it('collects H₂S from every unit and sends a sour crude’s sulphur to the plant', () => {
    const sweet = treatingResult()
    expect(sweet.sulphurSources.every((s) => s.tonnes > 0)).toBe(true)
    expect(sweet.sru.feed).toBeLessThan(sweet.crudeSulphur)
    controls.setCrude('arabLight')
    expect(treatingResult().sru.feed).toBeGreaterThan(sweet.sru.feed * 3)
  })

  it('takes hydrogen from the reformer for every hydrotreater', () => {
    const r = treatingResult()
    expect(r.hydrogen.supply).toBeCloseTo(r.reforming.reformer.hydrogen, 9)
    expect(r.hydrogen.users.find((u) => u.name === 'Diesel hydrotreater')!.tonnes).toBeCloseTo(r.dht.hydrogen, 9)
  })

  it('leaves every task undone at design, and every one can be done', () => {
    const met = (id: string) => TREATING_TASKS.find((t) => t.id === id)!.met(getPlant(), treatingResult())
    for (const t of TREATING_TASKS) expect(met(t.id)).toBe(false)

    controls.setDht({ lco: true, temp: 365 })
    expect(met('dht-lco')).toBe(true)
    expect(met('dht-lean')).toBe(true)
    controls.setDht({ temp: 355, pressure: 62 })
    expect(met('dht-lco')).toBe(true)
    expect(met('dht-lean')).toBe(false)

    controls.setSru({ converters: 3, air: 100 })
    expect(met('sru-ratio')).toBe(true)

    controls.setCrude('arabLight')
    expect(met('sru-sour')).toBe(false)
    controls.setSru({ tailGas: true })
    expect(met('sru-sour')).toBe(true)
  })
})
