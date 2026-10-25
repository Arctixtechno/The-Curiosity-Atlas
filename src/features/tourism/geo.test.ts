import { describe, expect, it } from 'vitest'
import { distanceMetres, planWalk, walkingOrder, walkMinutes, type LatLng } from './geo.ts'

describe('distanceMetres', () => {
  it('is zero for the same point', () => {
    expect(distanceMetres([51.5, -0.1], [51.5, -0.1])).toBe(0)
  })

  it('matches a known distance: one degree of latitude is about 111 km', () => {
    expect(distanceMetres([51, 0], [52, 0])).toBeCloseTo(111_195, -2)
  })
})

describe('walkingOrder', () => {
  it('visits the nearest stop first, then the next nearest', () => {
    const at = (lng: number): LatLng => [51.5, lng]
    const stops = [
      { id: 'far', at: at(-0.13) },
      { id: 'near', at: at(-0.11) },
      { id: 'mid', at: at(-0.12) },
    ]
    expect(walkingOrder(stops, at(-0.1)).map((s) => s.id)).toEqual(['near', 'mid', 'far'])
  })
})

describe('planWalk', () => {
  const stops = [
    { id: 'a', at: [51.5, -0.1] as LatLng, visitMinutes: 30 },
    { id: 'b', at: [51.505, -0.1] as LatLng, visitMinutes: 30 },
    { id: 'c', at: [51.51, -0.1] as LatLng, visitMinutes: 30 },
  ]

  it('fits only as many stops as the time allows', () => {
    const plan = planWalk(stops, [51.5, -0.1], 70)
    expect(plan.stops.map((s) => s.stop.id)).toEqual(['a', 'b'])
    expect(plan.totalMinutes).toBeLessThanOrEqual(70)
  })

  it('adds walking time between stops', () => {
    const plan = planWalk(stops, [51.5, -0.1], 300)
    expect(plan.stops[1].walk).toBe(Math.round(walkMinutes(stops[0].at, stops[1].at)))
    expect(plan.stops[1].arrive).toBe(30 + plan.stops[1].walk)
  })
})
