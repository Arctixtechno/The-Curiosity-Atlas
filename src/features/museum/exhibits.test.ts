import { describe, expect, it } from 'vitest'
import { MUSEUM } from '../../rooms/dimensions.ts'
import { EXHIBITS } from './exhibits.ts'
import { EXHIBIT_IDS, exhibitFromOverlay, exhibitOverlay } from './overlayId.ts'

describe('museum exhibits', () => {
  it('each have a source, facts and a case in the gallery', () => {
    expect(Object.keys(EXHIBITS).sort()).toEqual([...EXHIBIT_IDS].sort())
    expect(Object.keys(MUSEUM.exhibits).sort()).toEqual([...EXHIBIT_IDS].sort())
    for (const id of EXHIBIT_IDS) {
      const e = EXHIBITS[id]
      expect(e.source).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//)
      expect(e.facts.length).toBeGreaterThan(2)
      expect(e.notice.length).toBeGreaterThan(0)
    }
  })

  it('round-trip through their overlay ids', () => {
    for (const id of EXHIBIT_IDS) expect(exhibitFromOverlay(exhibitOverlay(id))).toBe(id)
    expect(exhibitFromOverlay('museum:unicorn')).toBeNull()
    expect(exhibitFromOverlay(null)).toBeNull()
  })
})
