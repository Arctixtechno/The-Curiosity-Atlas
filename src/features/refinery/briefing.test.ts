import { describe, expect, it } from 'vitest'
import { briefing } from './briefing.ts'
import { medals, type Progress } from './career.ts'
import { getPlant } from './plant.ts'
import { getSafety } from './safetyStore.ts'
import { SHIFTS } from './shifts.ts'

const nothing: Progress = { tasksDone: new Set(), lessonsDone: [], quiz: {}, drillBest: {}, permits: [], roundBest: 0, shiftBest: {} }

describe('the away briefing', () => {
  it('reads a fresh plant: losing money, with the blends and the first shift to do', () => {
    const b = briefing(getPlant(), getSafety(), { active: null, best: {} }, medals(nothing))
    expect(b.headline).toMatch(/losing money/)
    expect(b.facts.map((f) => f.label)).toEqual(['Plant day', 'Site margin', 'Alarms waiting', 'Wind', 'Flare'])
    for (const f of b.facts) expect(f.value).not.toMatch(/NaN|undefined/)
    expect(b.next.length).toBeGreaterThan(0)
    expect(b.next.length).toBeLessThanOrEqual(3)
    expect(b.next.join(' ')).toMatch(/blend/)
    expect(b.next.join(' ')).toContain(SHIFTS[0].title)
    expect(b.rank.title).toBe('Trainee')
    expect(b.rank.toNext).toBe(3)
  })

  it('puts a tripped furnace and a running shift first', () => {
    const p = getPlant()
    const tripped = { ...p, furnace: { ...p.furnace, tripped: true } }
    const run = { id: SHIFTS[1].id, startedAt: p.furnace.time } as never
    const b = briefing(tripped, getSafety(), { active: run, best: {} }, medals(nothing))
    expect(b.headline).toMatch(/needs you/)
    expect(b.next[0]).toContain(SHIFTS[1].title)
    expect(b.next[0]).toMatch(/minutes to handover/)
    expect(b.next[1]).toMatch(/furnace has tripped/)
  })

  it('asks for the stars still missing once every shift has been tried', () => {
    const best = Object.fromEntries(SHIFTS.map((s, i) => [s.id, i === 2 ? 2 : 3]))
    const b = briefing(getPlant(), getSafety(), { active: null, best }, medals({ ...nothing, shiftBest: best }))
    expect(b.next.join(' ')).toContain(`“${SHIFTS[2].title}” has 2 of 3 stars`)
  })
})
