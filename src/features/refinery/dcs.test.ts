import { beforeEach, describe, expect, it } from 'vitest'
import { lagTags, runApc, TAG, TAGS, updateDcsAlarms } from './dcs.ts'
import { FCC_LIMITS } from './fcc.ts'
import { measured, runFurnace } from './furnace.ts'
import { advancePlant, controls, conversionResult, getPlant, reformingResult } from './plant.ts'

beforeEach(() => controls.reset())

/** Runs the plant clock on by `seconds` of simulated time. */
function run(seconds: number) {
  controls.setSpeed(30)
  for (let t = 0; t < seconds; t += 30) advancePlant(1)
}

describe('tags', () => {
  it('lag towards their targets at their own pace', () => {
    const start = Object.fromEntries(TAGS.map((t) => [t.id, 0]))
    const target = Object.fromEntries(TAGS.map((t) => [t.id, 100]))
    const after = lagTags(start, target, 600)
    // The regenerator (10 minute time constant) is 63% of the way there after 10 minutes; the tank level is there at once.
    expect(after['TI-302']).toBeCloseTo(100 * (1 - Math.exp(-1)), 6)
    expect(after['LI-crude']).toBe(100)
    expect(after['AI-502']).toBeLessThan(after['TI-302'])
  })

  it('start lined out and follow the plant clock', () => {
    run(60)
    const p = getPlant()
    expect(p.tags['FI-100']).toBeCloseTo(100, 1)
    expect(p.tagHistory.length).toBeGreaterThan(0)
  })

  it('show a change arriving over time, not at once', () => {
    run(60)
    controls.setFcc({ rot: 545 })
    run(60)
    const early = getPlant().tags['TI-302']
    run(1800)
    const late = getPlant().tags['TI-302']
    const settled = conversionResult().fcc.regenTemp
    expect(Math.abs(late - settled)).toBeLessThan(Math.abs(early - settled))
  })
})

describe('alarms', () => {
  const condition = { id: 'X-H', area: 'fcc' as const, text: 'x high', priority: 'medium' as const }

  it('come in unacknowledged, stay until acknowledged after clearing, then go', () => {
    let alarms = updateDcsAlarms([], [condition], 10)
    expect(alarms[0]).toMatchObject({ active: true, acked: false, time: 10 })
    alarms = updateDcsAlarms(alarms, [], 20)
    expect(alarms[0]).toMatchObject({ active: false, acked: false })
    alarms = updateDcsAlarms(alarms.map((a) => ({ ...a, acked: true })), [], 30)
    expect(alarms).toHaveLength(0)
  })

  it('come back as new if the condition returns', () => {
    let alarms = updateDcsAlarms([], [condition], 10)
    alarms = updateDcsAlarms(alarms.map((a) => ({ ...a, acked: true })), [condition], 20)
    expect(alarms[0].acked).toBe(true)
    alarms = updateDcsAlarms(alarms, [], 30)
    expect(alarms).toHaveLength(0)
    alarms = updateDcsAlarms(alarms, [condition], 40)
    expect(alarms[0]).toMatchObject({ acked: false, time: 40 })
  })

  it('raise a high alarm when the regenerator runs past its limit', () => {
    controls.setFcc({ feed: 45, preheat: 370 })
    run(4000)
    expect(getPlant().tags['TI-302']).toBeGreaterThan(TAG['TI-302'].hi!)
    expect(getPlant().dcsAlarms.some((a) => a.tag === 'TI-302')).toBe(true)
  })

  it('can be acknowledged and shelved', () => {
    run(120)
    const first = getPlant().dcsAlarms[0]
    expect(first).toBeDefined()
    controls.ackAllAlarms()
    expect(getPlant().dcsAlarms.every((a) => a.acked)).toBe(true)
    controls.shelveAlarm(getPlant().dcsAlarms[0].id, 3600)
    expect(getPlant().dcsAlarms[0].shelvedUntil).toBeGreaterThan(0)
  })
})

describe('feed-forward', () => {
  /** The outlet's integrated absolute error over the ten minutes after a 15 kb/d crude rate step, °C·s. */
  function iae(feedForward: boolean) {
    controls.reset()
    controls.setFeedForward(feedForward)
    controls.setFeed(115)
    let f = getPlant().furnace
    let sum = 0
    for (let t = 0; t < 600; t += 10) {
      f = runFurnace(f, 10)
      sum += Math.abs(measured(f) - f.setpoint) * 10
    }
    return sum
  }

  it('keeps the furnace outlet much closer to setpoint after a rate change', () => {
    // The dead time still lets the first dip through, but the long tail of the upset goes.
    expect(iae(true)).toBeLessThan(iae(false) / 3)
  })
})

describe('advanced control', () => {
  it('pushes the cat cracker feed up until a constraint, and holds there', () => {
    controls.setApc({ fcc: true })
    let p = getPlant()
    for (let i = 0; i < 60; i++) p = runApc(p)
    expect(p.fcc.feed).toBeGreaterThan(30)
    expect(p.apc.fccStatus).toMatch(/constraint|limit/)
    const fcc = conversionResult(p).fcc
    expect(fcc.regenTemp).toBeLessThanOrEqual(FCC_LIMITS.regenMax)
    expect(fcc.air).toBeLessThanOrEqual(FCC_LIMITS.airMax)
  })

  it('brings reformate octane to its target', () => {
    controls.setApc({ reformer: true, octaneTarget: 99 })
    let p = getPlant()
    for (let i = 0; i < 60; i++) p = runApc(p)
    expect(reformingResult(p).reformer.octane).toBeCloseTo(99, 0)
  })
})
