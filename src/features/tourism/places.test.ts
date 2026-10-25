import { describe, expect, it } from 'vitest'
import { distanceMetres } from './geo.ts'
import { ALL_PLACES, NEIGHBOURHOODS } from './places.ts'

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
})
