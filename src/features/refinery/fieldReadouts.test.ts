import { describe, expect, it } from 'vitest'
import { TAG } from './dcs.ts'
import { stationAt, stationReadings, STATIONS, tagState } from './fieldReadouts.ts'
import { getPlant } from './plant.ts'
import { getSafety } from './safetyStore.ts'

describe('field readouts', () => {
  it('finds the unit you are standing at, and nothing out in the open', () => {
    expect(stationAt(-20, -14)?.id).toBe('fcc')
    expect(stationAt(-17, 14)?.id).toBe('control')
    expect(stationAt(27, -23)?.id).toBe('flare')
    expect(stationAt(0, 40)).toBeNull()
  })

  it('names only tags the DCS has', () => {
    for (const s of STATIONS) for (const id of s.tags) expect(TAG[id], id).toBeDefined()
  })

  it('shows every station’s readings from a fresh plant, with values inside their bars', () => {
    const p = getPlant()
    for (const s of STATIONS) {
      const readings = stationReadings(s, p, getSafety())
      expect(readings.length, s.id).toBeGreaterThan(0)
      for (const r of readings) {
        expect(r.value).not.toMatch(/NaN|undefined/)
        if (r.share !== undefined) expect(r.share).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('grades a value against its alarm limits', () => {
    const t = TAG['TI-101']
    expect(tagState(t, 360)).toBe('ok')
    expect(tagState(t, t.hi! + 0.5)).toBe('hi')
    expect(tagState(t, t.hh! + 0.5)).toBe('hh')
    expect(tagState(t, t.lo! - 1)).toBe('lo')
  })
})
