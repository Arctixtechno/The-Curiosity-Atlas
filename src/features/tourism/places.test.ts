import { describe, expect, it } from 'vitest'
import { distanceMetres } from './geo.ts'
import { ALL_PLACES, groupOf, NEIGHBOURHOODS, PLACE_GROUPS } from './places.ts'

describe('London places', () => {
  it('have unique ids and a source link each', () => {
    expect(new Set(ALL_PLACES.map((p) => p.id)).size).toBe(ALL_PLACES.length)
    for (const p of ALL_PLACES) expect(p.source).toMatch(/^https:\/\//)
  })

  it('sit within a few kilometres of their neighbourhood', () => {
    for (const n of NEIGHBOURHOODS) {
      for (const p of n.places) expect(distanceMetres(n.centre, p.at)).toBeLessThan(2000)
    }
  })

  it('each belong to one of the groups, and every group has places', () => {
    const ids = PLACE_GROUPS.map((g) => g.id) as string[]
    for (const p of ALL_PLACES) expect(ids).toContain(groupOf(p.kind).id)
    for (const id of ids) expect(ALL_PLACES.some((p) => groupOf(p.kind).id === id)).toBe(true)
  })
})
