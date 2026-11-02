import { beforeEach, describe, expect, it } from 'vitest'
import { controls, getPlant } from './plant.ts'
import { CHECKPOINTS, faultsFor, scoreRound, type RoundCall } from './rounds.ts'
import { getRounds, rounds } from './roundStore.ts'
import { getSafety, safety } from './safetyStore.ts'
import { TOUR, yawTowards } from './tour.ts'

beforeEach(() => {
  controls.reset()
  safety.reset()
  rounds.reset()
})

const none = new Set<never>()

describe('field rounds', () => {
  it('plants two or three faults a round, the same each time for the same round', () => {
    for (let n = 1; n <= 30; n++) {
      const f = faultsFor(n)
      expect(f.size).toBeGreaterThanOrEqual(2)
      expect(f.size).toBeLessThanOrEqual(3)
      expect([...f]).toEqual([...faultsFor(n)])
    }
    expect(new Set(Array.from({ length: 30 }, (_, n) => [...faultsFor(n + 1)].sort().join())).size).toBeGreaterThan(5)
  })

  it('reads normal everywhere on a healthy plant with nothing planted', () => {
    for (const c of CHECKPOINTS) expect(c.read(getPlant(), none, getSafety()).abnormal, c.id).toBe(false)
  })

  it('finds every planted fault where it was planted', () => {
    for (const c of CHECKPOINTS) expect(c.read(getPlant(), new Set([c.fault]), getSafety()).abnormal, c.id).toBe(true)
  })

  it('notices what the plant is really doing', () => {
    const furnace = CHECKPOINTS.find((c) => c.id === 'furnace')!
    const p = { ...getPlant(), furnace: { ...getPlant().furnace, outlet: 378 } }
    expect(furnace.read(p, none, getSafety()).abnormal).toBe(true)
    const flare = CHECKPOINTS.find((c) => c.id === 'flare')!
    safety.testFlare(100, getPlant().furnace.time + 100)
    expect(flare.read(getPlant(), none, getSafety()).abnormal).toBe(true)
  })

  it('scores the calls against the readings', () => {
    const calls: Record<string, RoundCall> = {}
    for (const c of CHECKPOINTS) {
      const reading = c.read(getPlant(), new Set(['bearing']), getSafety())
      calls[c.id] = { call: c.id === 'pump' ? 'report' : c.id === 'tank' ? 'report' : 'normal', reading }
    }
    const s = scoreRound(calls)
    expect(s.checked).toBe(CHECKPOINTS.length)
    expect(s.right).toBe(CHECKPOINTS.length - 1)
    expect(s.wrong.map((c) => c.id)).toEqual(['tank'])
  })

  it('numbers rounds and keeps the best', () => {
    rounds.start()
    expect(getRounds().active?.number).toBe(1)
    rounds.finish(6)
    rounds.start()
    expect(getRounds().active?.number).toBe(2)
    rounds.finish(4)
    expect(getRounds().best).toBe(6)
  })
})

describe('site tour', () => {
  it('faces each stop’s subject', () => {
    expect(yawTowards([0, 0], [0, -10])).toBeCloseTo(0)
    expect(yawTowards([0, 0], [-10, 0])).toBeCloseTo(Math.PI / 2)
    for (const s of TOUR) expect(Math.hypot(s.look[0] - s.at[0], s.look[1] - s.at[1])).toBeGreaterThan(4)
  })
})
