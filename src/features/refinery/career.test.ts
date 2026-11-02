import { describe, expect, it } from 'vitest'
import { LESSONS, TOPICS } from './academy.ts'
import { ALL_TASK_IDS, medals, rankOf, RANKS, type Progress } from './career.ts'
import { DRILLS } from './drills.ts'
import { PERMIT_JOBS } from './permits.ts'
import { CHECKPOINTS } from './rounds.ts'
import { SHIFTS } from './shifts.ts'

const nothing: Progress = { tasksDone: new Set(), lessonsDone: [], quiz: {}, drillBest: {}, permits: [], roundBest: 0, shiftBest: {} }
const everything: Progress = {
  tasksDone: new Set(ALL_TASK_IDS),
  lessonsDone: LESSONS.map((l) => l.id),
  quiz: Object.fromEntries(TOPICS.map((t) => [t.id, 1])),
  drillBest: Object.fromEntries(DRILLS.map((d) => [d.id, 100])),
  permits: PERMIT_JOBS.map((j) => j.id),
  roundBest: CHECKPOINTS.length,
  shiftBest: Object.fromEntries(SHIFTS.map((s) => [s.id, 3])),
}

describe('the logbook', () => {
  it('counts every shift task once', () => {
    expect(new Set(ALL_TASK_IDS).size).toBe(ALL_TASK_IDS.length)
    expect(ALL_TASK_IDS.length).toBeGreaterThan(20)
  })

  it('starts a trainee with no medals', () => {
    const list = medals(nothing)
    expect(list.every((m) => m.tier === 'none')).toBe(true)
    expect(rankOf(list).rank.title).toBe('Trainee')
  })

  it('makes a refinery manager of someone who has done everything', () => {
    const list = medals(everything)
    expect(list.every((m) => m.tier === 'gold')).toBe(true)
    const r = rankOf(list)
    expect(r.rank).toBe(RANKS.at(-1))
    expect(r.next).toBeNull()
    expect(r.points).toBe(r.max)
  })

  it('awards bronze, silver and gold at their steps, in order', () => {
    const one = medals({ ...nothing, lessonsDone: LESSONS.slice(0, 2).map((l) => l.id) }).find((m) => m.id === 'lessons')!
    expect(one.tier).toBe('bronze')
    const four = medals({ ...nothing, lessonsDone: LESSONS.slice(0, 4).map((l) => l.id) }).find((m) => m.id === 'lessons')!
    expect(four.tier).toBe('silver')
    for (const m of medals(nothing)) expect(m.steps[0] <= m.steps[1] && m.steps[1] <= m.steps[2] && m.steps[2] <= m.of).toBe(true)
  })
})
