import { beforeEach, describe, expect, it } from 'vitest'
import { lightEndsResult } from './lightEndsPlant.ts'
import { controls, getPlant } from './plant.ts'
import { siteBalance } from './site.ts'
import { SITE_TASKS } from './siteTasks.ts'
import { bookShip, daysOfCover, freshTankFarm, ledgerTotal, rundowns, stepTankFarm, TANKS } from './tankFarm.ts'

/** Both pools on the planner's recipe. */
function plan() {
  const r = lightEndsResult()
  for (const pool of ['petrol', 'diesel'] as const)
    controls.applyRecipe(pool, Object.fromEntries(r[pool].components.map((c, i) => [c.id, r[pool].best.volumes[i]])), true)
}

beforeEach(() => controls.reset())

describe('site balance', () => {
  it('loses money with petrol off spec and makes it with petrol on spec', () => {
    expect(siteBalance().margin).toBeLessThan(0)
    plan()
    const b = siteBalance()
    expect(b.margin).toBeGreaterThan(0)
    expect(b.perBarrel).toBeGreaterThan(5)
    expect(b.perBarrel).toBeLessThan(15)
  })

  it('adds up: margin is revenue less crude and costs', () => {
    plan()
    const b = siteBalance()
    const costs = b.costs.reduce((s, c) => s + c.dollars, 0)
    expect(b.margin).toBeCloseTo(b.revenue - b.crude.cost - costs, 3)
  })

  it('makes about as many barrels as it takes in, a little more from cracking', () => {
    const b = siteBalance()
    expect(b.volumeGain).toBeGreaterThan(95)
    expect(b.volumeGain).toBeLessThan(110)
  })
})

describe('tank farm', () => {
  it('drains the crude tank at the crude rate and fills product tanks', () => {
    const b = siteBalance()
    const farm = stepTankFarm({ ...freshTankFarm(), autoCrude: false }, b, 1)
    expect(farm.levels.crude).toBeCloseTo(TANKS.crude.start - b.crude.rate, 6)
    const flows = rundowns(b)
    expect(farm.levels.petrol).toBeCloseTo(TANKS.petrol.start + flows.petrol - TANKS.petrol.lifting, 6)
    expect(farm.day).toBeCloseTo(1, 9)
  })

  it('shuts the plant down when the crude runs out, and counts the cost', () => {
    const farm = stepTankFarm({ ...freshTankFarm(), autoCrude: false }, siteBalance(), 10)
    expect(farm.starved).toBe(true)
    expect(farm.ledger.lost).toBeGreaterThan(0)
    expect(farm.log.some((e) => e.kind === 'bad')).toBe(true)
  })

  it('orders crude by itself on a standing order, and keeps running', () => {
    const farm = stepTankFarm(freshTankFarm(), siteBalance(), 20)
    expect(farm.ledger.lost).toBe(0)
    expect(farm.levels.crude).toBeGreaterThan(0)
  })

  it('sells a topped-out product cheap', () => {
    const farm = stepTankFarm(freshTankFarm(), siteBalance(), 30)
    expect(farm.ledger.distressed).toBeGreaterThan(0)
  })

  it('loads a ship that is booked, one at a time at the jetty', () => {
    let farm = bookShip(bookShip({ ...freshTankFarm(), autoCrude: false }, 'petrol'), 'diesel')
    const before = farm.levels.petrol
    farm = stepTankFarm(farm, siteBalance(), 2.6)
    // The petrol ship loaded and sailed; the diesel ship waited for the berth and is now alongside.
    expect(farm.ships.map((s) => s.tank)).toEqual(['diesel'])
    expect(farm.ships[0].berthed).toBeDefined()
    expect(farm.levels.petrol).toBeLessThan(before + 2.6 * 40 - TANKS.petrol.cargo + 1)
  })

  it('charges demurrage when a ship waits alongside for product', () => {
    let farm = { ...freshTankFarm(), levels: { ...freshTankFarm().levels, lpg: 3 } }
    farm = bookShip(farm, 'lpg')
    farm = stepTankFarm({ ...farm, levels: { ...farm.levels, lpg: 3 } }, siteBalance(), 6)
    expect(farm.ledger.demurrage).toBeGreaterThan(0)
  })

  it('works out days of cover', () => {
    const b = siteBalance()
    const flows = rundowns(b)
    expect(daysOfCover(freshTankFarm(), flows, 'crude')).toBeLessThan(0)
    expect(daysOfCover(freshTankFarm(), flows, 'petrol')).toBeGreaterThan(0)
  })

  it('keeps running from the plant clock, and from the fast-forward', () => {
    controls.runDays(2)
    expect(getPlant().tanks.day).toBeCloseTo(2, 6)
    expect(ledgerTotal(getPlant().tanks)).not.toBe(0)
  })
})

describe('plant manager tasks', () => {
  const met = (id: string) => SITE_TASKS.find((t) => t.id === id)!.met(getPlant(), siteBalance())

  it('starts with none met', () => {
    for (const t of SITE_TASKS) expect(met(t.id), t.id).toBe(false)
  })

  it('can make $600k a day and $10 a barrel', () => {
    plan()
    expect(met('site-profit')).toBe(true)
    controls.setIsom({ recycle: true, temp: 155 })
    controls.setAlky({ ratio: 12, temp: 4, acid: 94 })
    controls.setFcc({ feed: 40, rot: 535 })
    plan()
    expect(met('site-ten')).toBe(true)
  })

  it('can run a clean month with ships booked in time', () => {
    plan()
    // A schedule worked out by hand: book each product's ship a little before its tank fills.
    for (let day = 0; day < 30; day++) {
      const farm = getPlant().tanks
      const flows = rundowns(siteBalance())
      for (const id of ['lpg', 'petrol', 'jet', 'diesel', 'fuelOil', 'sulphur'] as const) {
        const cover = daysOfCover(farm, flows, id)
        const room = farm.levels[id] - TANKS[id].capacity * 0.05
        if (cover > 0 && cover < 4 && room > TANKS[id].cargo && !farm.ships.some((s) => s.tank === id)) controls.bookShip(id)
      }
      controls.runDays(1)
    }
    const { ledger } = getPlant().tanks
    expect(ledger.lost).toBe(0)
    expect(ledger.distressed).toBe(0)
    expect(ledger.demurrage).toBe(0)
    expect(met('site-month')).toBe(true)
  })
})
