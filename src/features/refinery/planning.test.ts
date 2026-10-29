import { beforeEach, describe, expect, it } from 'vitest'
import { CRUDES, percentBelow } from './crudes.ts'
import { lightEndsResult } from './lightEndsPlant.ts'
import { history, marketOn } from './market.ts'
import { controls, getPlant } from './plant.ts'
import { bestCrashing, CARGO, CDU_PLAN_RATE, CRUDE_IDS, crudeValues, FUEL_OIL_OUTLET, MAX_CARGOES, PLAN_DAYS, planCrudes, schedule, TURNAROUND } from './planning.ts'
import { siteBalance } from './site.ts'

function plan() {
  const r = lightEndsResult()
  for (const pool of ['petrol', 'diesel'] as const)
    controls.applyRecipe(pool, Object.fromEntries(r[pool].components.map((c, i) => [c.id, r[pool].best.volumes[i]])), true)
}

beforeEach(() => controls.reset())

describe('crudes', () => {
  it('each has a rising boiling curve that ends at 100%', () => {
    for (const c of Object.values(CRUDES)) {
      for (let i = 1; i < c.tbp.length; i++) {
        expect(c.tbp[i][0]).toBeGreaterThan(c.tbp[i - 1][0])
        expect(c.tbp[i][1]).toBeGreaterThanOrEqual(c.tbp[i - 1][1])
      }
      expect(c.tbp.at(-1)![1]).toBe(100)
    }
  })

  it('heavier crudes leave more residue', () => {
    const residue = (id: keyof typeof CRUDES) => 100 - percentBelow(CRUDES[id], 550)
    expect(residue('wcs')).toBeGreaterThan(residue('maya'))
    expect(residue('maya')).toBeGreaterThan(residue('brent'))
    expect(residue('bonny')).toBeLessThan(residue('brent'))
  })
})

describe('crude planning', () => {
  it('values the crude running now exactly as the site does', () => {
    plan()
    const values = crudeValues(getPlant())
    const brent = values.find((v) => v.id === 'brent')!
    expect(brent.margin).toBeCloseTo(siteBalance().perBarrel, 6)
  })

  it('keeps the slate inside every limit', () => {
    plan()
    const values = crudeValues(getPlant())
    const p = planCrudes(values, { offered: new Set(CRUDE_IDS), discounts: {}, coker: false })
    for (const c of p.constraints) expect(c.used).toBeLessThanOrEqual(c.limit + 1e-6)
    for (const id of CRUDE_IDS) expect(p.barrels[id]).toBeLessThanOrEqual(MAX_CARGOES * CARGO + 1e-6)
    expect(p.constraints[0].limit).toBe(CDU_PLAN_RATE * PLAN_DAYS)
    expect(p.constraints[1].limit).toBe(FUEL_OIL_OUTLET * PLAN_DAYS)
  })

  it('leaves out a crude that is not on offer, and buys more of one that is discounted', () => {
    plan()
    const values = crudeValues(getPlant())
    const all = new Set(CRUDE_IDS)
    const without = new Set(CRUDE_IDS.filter((id) => id !== 'bonny'))
    expect(planCrudes(values, { offered: without, discounts: {}, coker: false }).barrels.bonny).toBe(0)
    const base = planCrudes(values, { offered: all, discounts: {}, coker: false })
    const cheap = planCrudes(values, { offered: all, discounts: { arabLight: 5 }, coker: false })
    expect(cheap.barrels.arabLight).toBeGreaterThanOrEqual(base.barrels.arabLight)
    expect(cheap.margin).toBeGreaterThanOrEqual(base.margin)
  })

  it('puts a price on the residue outlet when it binds, and a coker loosens it', () => {
    plan()
    const values = crudeValues(getPlant())
    const noCoker = planCrudes(values, { offered: new Set(CRUDE_IDS), discounts: {}, coker: false })
    const residue = noCoker.constraints.find((c) => c.id === 'residue')!
    expect(residue.used).toBeCloseTo(residue.limit, 3)
    expect(residue.shadow).toBeGreaterThan(0)
    controls.setCoker({ running: true })
    const withCoker = planCrudes(crudeValues(getPlant()), { offered: new Set(CRUDE_IDS), discounts: {}, coker: true })
    expect(withCoker.constraints.find((c) => c.id === 'residue')!.limit).toBeGreaterThan(residue.limit)
  })
})

describe('market', () => {
  it('is the same on the same day however you get there', () => {
    expect(marketOn(42)).toEqual(marketOn(42))
    expect(history(100, 30)).toHaveLength(30)
    expect(history(100, 30).at(-1)!.day).toBe(100)
  })

  it('puts petrol cracks up in summer and diesel cracks up in winter', () => {
    expect(marketOn(172).cracks.petrol).toBeGreaterThan(marketOn(355).cracks.petrol)
    expect(marketOn(355).cracks.diesel).toBeGreaterThan(marketOn(172).cracks.diesel)
    expect(marketOn(355).gas).toBeGreaterThan(marketOn(172).gas)
  })

  it('moves the site margin when trading at market prices, and charges for carbon', () => {
    plan()
    const base = siteBalance()
    expect(base.co2.total).toBeGreaterThan(500)
    controls.setMarket({ carbon: 100 })
    const taxed = siteBalance()
    expect(base.margin - taxed.margin).toBeCloseTo(base.co2.total * 100, 0)
    controls.setMarket({ carbon: 0, live: true })
    const live = siteBalance()
    expect(live.market).not.toBeNull()
    expect(live.crude.price).toBeCloseTo(CRUDES.brent.price + live.market!.crude, 9)
    expect(live.margin).not.toBeCloseTo(base.margin, 0)
  })
})

describe('turnaround', () => {
  it('finds the critical path and its slack', () => {
    const s = schedule(TURNAROUND, new Set())
    expect(s.days).toBe(23)
    expect(s.critical).toContain('column')
    expect(s.critical).not.toContain('exchangers')
    expect(s.slack.exchangers).toBe(3)
  })

  it('shortens the turnaround only by crashing critical jobs', () => {
    expect(schedule(TURNAROUND, new Set(['exchangers'])).days).toBe(23)
    expect(schedule(TURNAROUND, new Set(['column'])).days).toBeLessThan(23)
  })

  it('buys extra crews only when a day saved is worth more than they cost', () => {
    expect(bestCrashing(TURNAROUND, 50_000).size).toBe(0)
    const best = bestCrashing(TURNAROUND, 500_000)
    expect(best.has('column')).toBe(true)
    expect(best.has('catalyst')).toBe(false)
    expect(schedule(TURNAROUND, best).days).toBeLessThan(23)
  })
})
