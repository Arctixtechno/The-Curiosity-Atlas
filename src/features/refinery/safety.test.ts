import { beforeEach, describe, expect, it } from 'vitest'
import { assessDrill, DRILLS, drillFlare, liveFlare, PURGE, type Drill } from './drills.ts'
import { flameLength, flareHeat, radiation, RECEIVERS, RELIEF_CASES, safeDistance, steamVerdict } from './flare.ts'
import { checkPermit, DEVIATIONS, hazopOptions, PERMIT_JOBS } from './permits.ts'
import { advancePlant, controls, getPlant } from './plant.ts'
import { getSafety, safety } from './safetyStore.ts'

beforeEach(() => {
  controls.reset()
  safety.reset()
})

const rightOrder = (d: Drill) => d.actions.filter((a) => a.step !== null).sort((a, b) => a.step! - b.step!)

describe('drills', () => {
  it.each(DRILLS.map((d) => [d.id, d] as const))('%s is made safe by the right actions in order, and puts the plant back', (_, d) => {
    d.start?.()
    const taken = rightOrder(d).map((a, i) => {
      a.effect?.()
      advancePlant(0.5)
      return { id: a.id, at: i * 10 }
    })
    const a = assessDrill(d, taken, taken.at(-1)!.at)
    expect(a.status).toBe('safe')
    expect(a.score).toBe(100)
    expect(a.next).toBeNull()
    d.restore?.()
    const p = getPlant()
    expect(p.furnace.feed).toBe(100)
    expect(p.furnace.disturbances.fuelQuality).toBe(1)
  })

  it('logs wrong and early actions and takes marks off', () => {
    const d = DRILLS.find((x) => x.id === 'charge-pump')!
    const a = assessDrill(d, [{ id: 'raise-sp', at: 5 }, { id: 'restore-feed', at: 10 }, { id: 'cut-firing', at: 15 }], 20)
    expect(a.log.map((l) => l.verdict)).toEqual(['wrong', 'early', 'right'])
    expect(a.done).toBe(1)
    expect(a.next?.id).toBe('start-spare')
    expect(a.status).toBe('running')
  })

  it('escalates past the deadline, then counts a late recovery', () => {
    const d = DRILLS.find((x) => x.id === 'cooling-water')!
    expect(assessDrill(d, [], d.deadline! + 1).status).toBe('escalated')
    expect(drillFlare(d, assessDrill(d, [], d.deadline! + 1))).toBe(120)
    const late = rightOrder(d).map((a, i) => ({ id: a.id, at: d.deadline! + 10 + i }))
    const a = assessDrill(d, late, d.deadline! + 100)
    expect(a.status).toBe('recovered')
    expect(a.score).toBe(70)
    expect(drillFlare(d, a)).toBe(0)
  })

  it('sends a controlled release to the flare once the overhead is vented', () => {
    const d = DRILLS.find((x) => x.id === 'cooling-water')!
    const steps = rightOrder(d).slice(0, 3).map((a, i) => ({ id: a.id, at: i }))
    expect(drillFlare(d, assessDrill(d, steps, 10))).toBe(40)
  })

  it('cuts the furnace back when the charge pump trips', () => {
    const d = DRILLS.find((x) => x.id === 'charge-pump')!
    d.start?.()
    rightOrder(d)[0].effect?.()
    expect(getPlant().furnace.feed).toBe(35)
    expect(getPlant().furnace.mode).toBe('manual')
    expect(getPlant().furnace.valve).toBe(25)
  })

  it('adds up what the live flare is burning', () => {
    expect(liveFlare(getSafety(), 0)).toBe(PURGE)
    safety.testFlare(60, 100)
    expect(liveFlare(getSafety(), 50)).toBe(PURGE + 60)
    expect(liveFlare(getSafety(), 150)).toBe(PURGE)
    safety.startDrill('cooling-water', 0)
    expect(liveFlare(getSafety(), 1000)).toBe(PURGE + 120)
  })

  it('keeps the best score', () => {
    safety.startDrill('h2s-leak', 0)
    safety.finishDrill(70)
    safety.startDrill('h2s-leak', 0)
    safety.finishDrill(55)
    expect(getSafety().best['h2s-leak']).toBe(70)
  })
})

describe('flare', () => {
  it('burns 100 MW for about 8 t/h, with a flame about 20 m long', () => {
    expect(flareHeat(7.83)).toBeCloseTo(100, 0)
    expect(flameLength(100)).toBeGreaterThan(15)
    expect(flameLength(100)).toBeLessThan(30)
  })

  it('radiates less further away, and the safe distance meets its limit', () => {
    const mw = flareHeat(260)
    expect(radiation(mw, 50)).toBeGreaterThan(radiation(mw, 150))
    const d = safeDistance(mw, 1.58)
    expect(radiation(mw, d)).toBeCloseTo(1.58, 6)
  })

  it('is sized so normal running is harmless, and a site-wide power failure puts the control room near its limit', () => {
    const purge = flareHeat(RELIEF_CASES.find((c) => c.id === 'purge')!.load)
    expect(radiation(purge, 0)).toBeLessThan(0.1)
    const power = flareHeat(RELIEF_CASES.find((c) => c.id === 'power')!.load)
    const room = RECEIVERS.find((r) => r.name === 'Control room')!.distance
    expect(radiation(power, room)).toBeGreaterThan(1.2)
    expect(radiation(power, room)).toBeLessThan(2.5)
  })

  it('needs enough steam to burn without smoke, but not too much', () => {
    expect(steamVerdict(0.1).state).toBe('smoky')
    expect(steamVerdict(0.4).state).toBe('smokeless')
    expect(steamVerdict(1.1).state).toBe('oversteamed')
  })
})

describe('permits and HAZOP', () => {
  it.each(PERMIT_JOBS.map((j) => [j.id, j] as const))('%s passes with exactly the controls it needs and the right gas call', (_, job) => {
    const needed = new Set(job.controls.filter((c) => c.needed).map((c) => c.id))
    expect(checkPermit(job, needed, job.gas.safe).passed).toBe(true)
    expect(checkPermit(job, needed, !job.gas.safe).passed).toBe(false)
    const short = new Set([...needed].slice(1))
    expect(checkPermit(job, short, job.gas.safe).missed.length).toBe(1)
  })

  it('won’t let anyone into a vessel short of oxygen', () => {
    const vessel = PERMIT_JOBS.find((j) => j.id === 'vessel')!
    expect(vessel.gas.oxygen).toBeLessThan(19.5)
    expect(vessel.gas.safe).toBe(false)
  })

  it('offers three different choices in every HAZOP cell, one of them right', () => {
    for (const [i, d] of DEVIATIONS.entries())
      for (const column of ['cause', 'consequence', 'safeguard'] as const) {
        const options = hazopOptions(i, column)
        expect(options).toHaveLength(3)
        expect(new Set(options).size).toBe(3)
        expect(options).toContain(d[column])
      }
  })
})
