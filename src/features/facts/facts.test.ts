import { describe, expect, it } from 'vitest'
import { FACTS, factFor } from './facts.ts'

describe('hall facts', () => {
  it('are all different and short enough for a plaque', () => {
    expect(new Set(FACTS.map((f) => f.text)).size).toBe(FACTS.length)
    for (const f of FACTS) expect(f.text.length).toBeLessThanOrEqual(140)
  })

  it('change every hour, and two plaques never show the same one', () => {
    for (let hour = 0; hour < 200; hour++) {
      expect(factFor(hour, 0)).not.toBe(factFor(hour, 1))
      expect(factFor(hour, 0)).not.toBe(factFor(hour + 1, 0))
    }
  })
})
