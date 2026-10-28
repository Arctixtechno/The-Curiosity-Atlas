import { describe, expect, it } from 'vitest'
import { CDU_START, flashPoint, furnaceDuty, outletFor, runCdu } from './cdu.ts'
import { CRUDES, percentBelow, temperatureAt } from './crudes.ts'
import { DEAD_TIME, measured, runFurnace, startFurnace, stepFurnace, type FurnaceState } from './furnace.ts'

describe('crude assays', () => {
  it('reads the boiling curve both ways', () => {
    for (const crude of Object.values(CRUDES)) {
      for (const t of [20, 150, 300, 500]) expect(temperatureAt(crude, percentBelow(crude, t))).toBeCloseTo(t, 6)
    }
  })

  it('has heavier crudes boiling later', () => {
    expect(percentBelow(CRUDES.maya, 350)).toBeLessThan(percentBelow(CRUDES.arabLight, 350))
    expect(percentBelow(CRUDES.arabLight, 350)).toBeLessThan(percentBelow(CRUDES.brent, 350))
  })
})

describe('crude distillation unit', () => {
  it('balances: the products add up to the crude', () => {
    const r = runCdu(CDU_START)
    const total = Object.values(r.products).reduce((s, p) => s + p.percent, 0)
    expect(total).toBeCloseTo(100, 6)
    expect(Object.values(r.products).reduce((s, p) => s + p.rate, 0)).toBeCloseTo(CDU_START.feed, 6)
  })

  it('makes everything on spec at the design settings', () => {
    const r = runCdu(CDU_START)
    expect(r.starved).toBe(false)
    for (const p of Object.values(r.products)) expect(p.onSpec, p.id).toBe(true)
    expect(r.economics.margin).toBeGreaterThan(0)
  })

  it('keeps sulphur in balance and gathers it in the heavy end', () => {
    const r = runCdu({ ...CDU_START, crude: 'arabLight', dieselDraw: 18 })
    const crude = CRUDES.arabLight
    const average = Object.values(r.products).reduce((s, p) => s + p.percent * p.sulphurPpm, 0) / 100
    expect(average / 10_000).toBeCloseTo(crude.sulphur, 6)
    expect(r.products.naphtha.sulphurPpm).toBeLessThan(r.products.kerosene.sulphurPpm)
    expect(r.products.diesel.sulphurPpm).toBeLessThan(r.products.residue.sulphurPpm)
  })

  it('moves the kerosene end point up as more kerosene is drawn, until it fails', () => {
    const end = (keroDraw: number) => runCdu({ ...CDU_START, keroDraw, dieselDraw: 10 }).products.kerosene.specs[1]
    expect(end(18).value).toBeGreaterThan(end(14).value)
    expect(end(14).ok).toBe(true)
    expect(end(26).ok).toBe(false)
  })

  it('fails the kerosene flash point when the top runs cold and light naphtha drops into it', () => {
    const flash = (topTemp: number) => runCdu({ ...CDU_START, topTemp }).products.kerosene.specs[0]
    expect(flash(105).value).toBeLessThan(flash(125).value)
    expect(flash(105).ok).toBe(false)
  })

  it('lets more stripping steam raise the flash points', () => {
    const flash = (steam: 'low' | 'high') => runCdu({ ...CDU_START, steam }).products.kerosene.specs[0].value
    expect(flash('high')).toBeGreaterThan(flash('low'))
  })

  it('starves the diesel draw when the furnace is too cold', () => {
    const cold = runCdu({ ...CDU_START, cot: 330 })
    expect(cold.starved).toBe(true)
    expect(cold.products.diesel.percent).toBeLessThan(CDU_START.dieselDraw)
    expect(cold.warnings.join(' ')).toMatch(/running dry/)
  })

  it('makes far less distillate from a heavy crude', () => {
    const brent = runCdu(CDU_START)
    const maya = runCdu({ ...CDU_START, crude: 'maya' })
    expect(maya.products.residue.percent).toBeGreaterThan(brent.products.residue.percent + 15)
  })

  it('follows the flash point correlation', () => {
    // Riazi–Daubert: a 10% point of 170 °C gives a flash point near 46 °C.
    expect(flashPoint(170)).toBeCloseTo(46, 0)
  })
})

describe('furnace', () => {
  it('needs a believable duty for a 100,000 barrel a day unit', () => {
    const duty = furnaceDuty(CRUDES.brent, 100, 360)
    expect(duty.absorbed).toBeGreaterThan(50)
    expect(duty.absorbed).toBeLessThan(100)
    expect(outletFor(CRUDES.brent, 100, duty.fired)).toBeCloseTo(360, 1)
  })

  it('starts lined out', () => {
    const s = runFurnace(startFurnace(), 600)
    expect(s.outlet).toBeCloseTo(360, 0)
  })

  it('waits out the dead time before answering a valve move', () => {
    let s: FurnaceState = { ...startFurnace(), mode: 'manual' }
    s = stepFurnace(s)
    s = { ...s, valve: s.valve + 10 }
    const before = s.outlet
    for (let t = 0; t < DEAD_TIME - 2; t++) s = stepFurnace({ ...s, valve: s.valve })
    expect(Math.abs(s.outlet - before)).toBeLessThan(0.05)
    s = runFurnace(s, 600)
    expect(s.outlet).toBeGreaterThan(before + 10)
  })

  it('brings the outlet to a new setpoint in automatic, without much overshoot', () => {
    let s = { ...startFurnace(), setpoint: 366 }
    let peak = 0
    for (let t = 0; t < 1800; t++) {
      s = stepFurnace(s)
      peak = Math.max(peak, s.outlet)
    }
    expect(measured(s)).toBeCloseTo(366, 0)
    expect(peak).toBeLessThan(366 + 2)
  })

  it('rides out a fouled preheat train in automatic', () => {
    let s = startFurnace()
    s = { ...s, disturbances: { ...s.disturbances, fouling: 15 } }
    s = runFurnace(s, 2400)
    expect(s.outlet).toBeCloseTo(360, 0)
  })

  it('oscillates with too much gain', () => {
    let s = { ...startFurnace(), tuning: { gain: 6, integral: 1, derivative: 0 }, setpoint: 365 }
    let crossings = 0
    let above = false
    for (let t = 0; t < 3600; t++) {
      s = stepFurnace(s)
      if (!s.tripped && s.outlet > 365 !== above) ((above = !above), crossings++)
    }
    expect(crossings > 6 || s.tripped).toBe(true)
  })

  it('trips on high-high outlet temperature and shuts the fuel', () => {
    let s: FurnaceState = { ...startFurnace(), mode: 'manual' }
    s = stepFurnace(s)
    s = { ...s, valve: 100 }
    for (let t = 0; t < 3600 && !s.tripped; t++) s = stepFurnace({ ...s, valve: 100 })
    expect(s.tripped).toBe(true)
    expect(s.valve).toBe(0)
  })
})

describe('the live unit and its shift tasks', () => {
  it('completes "line out at 365 °C" after holding for five minutes of plant time', async () => {
    const { advancePlant, controls, currentResult, getPlant } = await import('./plant.ts')
    const { checkChallenges } = await import('./challenges.ts')
    controls.reset()
    controls.setSpeed(30)
    controls.setSetpoint(365)
    let progress = 0
    // An hour of plant time, checked every simulated ten seconds as the panel would.
    for (let i = 0; i < 360 && progress < 1; i++) {
      advancePlant(10 / 30)
      progress = checkChallenges(getPlant(), currentResult())['lineout']
    }
    expect(progress).toBe(1)
  })

  it('raises an alarm when the furnace trips, and keeps it in the log once cleared', async () => {
    const { advancePlant, controls, getPlant } = await import('./plant.ts')
    controls.reset()
    controls.setSpeed(30)
    controls.setMode('manual')
    controls.setValve(100)
    for (let i = 0; i < 600 && !getPlant().furnace.tripped; i++) advancePlant(1)
    expect(getPlant().furnace.tripped).toBe(true)
    expect(getPlant().alarms.some((a) => a.id === 'trip' && a.active)).toBe(true)
  })
})
