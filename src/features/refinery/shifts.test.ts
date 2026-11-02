import { beforeEach, describe, expect, it } from 'vitest'
import { CRUDES, percentBelow } from './crudes.ts'
import { advancePlant, controls, getPlant } from './plant.ts'
import { getShifts, shifts } from './shiftStore.ts'
import { planBlends, SHIFTS } from './shifts.ts'
import { siteBalance } from './site.ts'

beforeEach(() => {
  shifts.reset()
  controls.reset()
})

/** Runs the shift to its end, doing `act` once when the shift is `at` seconds in. */
function play(id: string, actions: { at: number; act: () => void }[] = []) {
  shifts.start(id)
  const todo = [...actions]
  for (let i = 0; i < 2000 && getShifts().active; i++) {
    const into = getPlant().furnace.time - getShifts().active!.startedAt
    while (todo.length && into >= todo[0].at) todo.shift()!.act()
    advancePlant(1)
    shifts.tick()
  }
  return getShifts().result!
}

/** Sets the crude unit's draws to the first that keep every product on spec with no dry tray. */
function fitDraws() {
  const crude = CRUDES[getPlant().furnace.crude]
  const cut = (from: number, to: number) => Math.round(percentBelow(crude, to) - percentBelow(crude, from))
  for (let diesel = cut(235, 345); diesel >= 4; diesel--)
    for (let kero = cut(170, 235); kero >= 4; kero--) {
      controls.setColumn({ keroDraw: kero, dieselDraw: diesel })
      const cdu = siteBalance(getPlant()).units.treating.conversion.cdu
      if (!cdu.starved && Object.values(cdu.products).every((x) => x.onSpec)) return
    }
}

describe('shifts', () => {
  it('each has goals, a brief and events inside its length', () => {
    for (const s of SHIFTS) {
      expect(s.goals.length).toBeGreaterThan(1)
      for (const e of s.events) expect(e.at).toBeLessThan(s.length)
      for (const g of s.goals) expect(g.from ?? 0).toBeLessThan(s.length)
    }
  })

  it('takes a lazy shift: nothing done, few stars', () => {
    const r = play('handover')
    expect(r.goals.find((g) => g.id === 'black')!.met).toBe(false)
    expect(r.stars).toBeLessThan(3)
  })

  it('gives three stars for a good handover shift, and hands the plant back', () => {
    controls.setFeed(95)
    const r = play('handover', [{ at: 60, act: planBlends }])
    expect(r.stars).toBe(3)
    expect(getPlant().furnace.feed).toBe(95)
    expect(getShifts().best.handover).toBe(3)
  })

  it('can be won on sour crude', () => {
    const r = play('sour', [
      { at: 420, act: () => controls.setSru({ converters: 3, tailGas: true }) },
      { at: 480, act: fitDraws },
      { at: 600, act: planBlends },
    ])
    expect(r.goals.filter((g) => !g.met)).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('fails the permit on sour crude if the sulphur plant is left alone', () => {
    const r = play('sour', [{ at: 480, act: fitDraws }])
    expect(r.goals.find((g) => g.id === 'so2')!.met).toBe(false)
  })

  it('can be won in the driving season', () => {
    const r = play('summer', [
      { at: 30, act: () => controls.setSru({ converters: 3, tailGas: true }) },
      { at: 60, act: () => controls.setFcc({ feed: 40 }) },
      { at: 120, act: planBlends },
    ])
    expect(r.goals.filter((g) => !g.met)).toEqual([])
  })

  it('needs the furnace controller tightened for dirty exchangers, but not so far that it hunts', () => {
    expect(play('fouling').goals.find((g) => g.id === 'steady')!.met).toBe(false)
    const tuned = play('fouling', [{ at: 60, act: () => controls.setTuning({ gain: 2, integral: 2 }) }])
    expect(tuned.goals.filter((g) => !g.met)).toEqual([])
    const hunting = play('fouling', [{ at: 60, act: () => controls.setTuning({ gain: 4, integral: 1 }) }])
    expect(hunting.goals.find((g) => g.id === 'steady')!.met).toBe(false)
  })

  it('loses the steady-outlet goal in manual', () => {
    const r = play('fouling', [{ at: 200, act: () => controls.setMode('manual') }])
    expect(r.goals.find((g) => g.id === 'steady')!.met).toBe(false)
  })

  it('gives the plant back when a shift is abandoned', () => {
    controls.setFeed(92)
    shifts.start('sour')
    expect(getPlant().furnace.feed).toBe(100)
    shifts.abandon()
    expect(getPlant().furnace.feed).toBe(92)
    expect(getShifts().active).toBeNull()
  })
})
