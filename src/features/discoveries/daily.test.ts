import { describe, expect, it } from 'vitest'
import { dailyDiscovery, localDayNumber, unexpectedDiscovery } from './daily.ts'
import { discoveries } from './discoveries.ts'

describe('dailyDiscovery', () => {
  it('stays the same through a day and changes the next day', () => {
    const morning = dailyDiscovery(discoveries, new Date(2026, 9, 24, 0, 5))
    const evening = dailyDiscovery(discoveries, new Date(2026, 9, 24, 23, 55))
    const tomorrow = dailyDiscovery(discoveries, new Date(2026, 9, 25, 9, 0))
    expect(evening).toBe(morning)
    expect(tomorrow).not.toBe(morning)
  })

  it('visits every discovery before repeating', () => {
    const start = new Date(2026, 0, 1)
    const seen = new Set<string>()
    for (let i = 0; i < discoveries.length; i++) {
      seen.add(dailyDiscovery(discoveries, new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)).id)
    }
    expect(seen.size).toBe(discoveries.length)
  })

  it('counts consecutive local days', () => {
    expect(localDayNumber(new Date(2026, 2, 30)) - localDayNumber(new Date(2026, 2, 29))).toBe(1)
  })
})

describe('unexpectedDiscovery', () => {
  it('picks a different subject', () => {
    const current = discoveries[0]
    for (const r of [0, 0.5, 0.999]) {
      expect(unexpectedDiscovery(discoveries, current, () => r).topic).not.toBe(current.topic)
    }
  })
})

describe('curated discoveries', () => {
  it('have unique ids and a source', () => {
    expect(new Set(discoveries.map((d) => d.id)).size).toBe(discoveries.length)
    for (const d of discoveries) expect(d.source.url).toMatch(/^https:\/\//)
  })
})
