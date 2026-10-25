import { describe, expect, it } from 'vitest'
import { eccentricAnomaly, findPlanet, julianDate, PLANETS, position, separation } from './planets.ts'

const deg = (r: number) => (r * 180) / Math.PI

describe('planet positions', () => {
  it('count Julian dates from J2000', () => {
    expect(julianDate(new Date(Date.UTC(2000, 0, 1, 12)))).toBe(2451545.0)
  })

  it("solve Kepler's equation", () => {
    for (const [M, e] of [
      [30, 0.2],
      [-170, 0.05],
      [90, 0.0934],
    ]) {
      const E = eccentricAnomaly(M, e)
      expect(E - deg(e) * Math.sin((E * Math.PI) / 180)).toBeCloseTo(M, 5)
    }
  })

  it('put Earth near perihelion in early January, about 0.983 au from the Sun', () => {
    const p = position(findPlanet('earth'), new Date(Date.UTC(2000, 0, 3)))
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(0.9833, 3)
    const july = position(findPlanet('earth'), new Date(Date.UTC(2000, 6, 4)))
    expect(Math.hypot(july.x, july.y, july.z)).toBeCloseTo(1.0167, 3)
  })

  it('return each planet to the same place after one orbital period from the fact sheet', () => {
    const start = new Date(Date.UTC(2020, 0, 1))
    for (const planet of PLANETS) {
      const later = new Date(start.getTime() + planet.facts.periodDays * 86400000)
      if (later.getUTCFullYear() > 2050) continue
      const a = position(planet, start)
      const b = position(planet, later)
      const angle = Math.abs(deg(Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x)) % 360)
      expect(Math.min(angle, 360 - angle), planet.name).toBeLessThan(1)
    }
  })

  it('keep each orbit near its semi-major axis', () => {
    for (const planet of PLANETS) {
      const p = position(planet, new Date(Date.UTC(2026, 9, 25)))
      const r = Math.hypot(p.x, p.y, p.z)
      const [a, e] = planet.elements
      expect(r).toBeGreaterThanOrEqual(a * (1 - e) - 0.01)
      expect(r).toBeLessThanOrEqual(a * (1 + e) + 0.01)
    }
  })

  it('bring Mars closest to Earth around its oppositions', () => {
    // Mars was at opposition on 13 October 2020, about 0.42 au from Earth.
    const d = separation(findPlanet('earth'), findPlanet('mars'), new Date(Date.UTC(2020, 9, 6)))
    expect(d).toBeLessThan(0.45)
  })
})
