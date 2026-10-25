import { describe, expect, it } from 'vitest'
import { solve, PARTS, totalResistance } from './circuit.ts'
import { CHALLENGES, meetsChallenge, train } from './gears.ts'

const part = (id: string) => PARTS.find((p) => p.id === id)!

describe('gear trains', () => {
  it('turn slower and stronger through a larger driven gear', () => {
    const r = train([{ driver: 12, driven: 36 }], 60, 1)
    expect(r.ratio).toBe(3)
    expect(r.rpm).toBe(20)
    expect(r.torque).toBe(3)
    expect(r.direction).toBe(-1)
  })

  it('keep power constant through every stage', () => {
    const r = train(
      [
        { driver: 10, driven: 40 },
        { driver: 16, driven: 48 },
      ],
      120,
      2,
    )
    expect(r.ratio).toBe(12)
    expect(r.rpm * r.torque).toBeCloseTo(120 * 2)
    expect(r.direction).toBe(1)
  })

  it('can solve every challenge with gears on the rack', () => {
    const clock = CHALLENGES.find((c) => c.id === 'clock')!
    // 10:40 then 12:36 gives 4 × 3 = 12.
    expect(
      meetsChallenge(
        train(
          [
            { driver: 10, driven: 40 },
            { driver: 12, driven: 36 },
          ],
          1,
          1,
        ),
        clock,
      ),
    ).toBe(true)
    const drill = CHALLENGES.find((c) => c.id === 'drill')!
    expect(meetsChallenge(train([{ driver: 48, driven: 12 }], 1, 1), drill)).toBe(true)
    const same = CHALLENGES.find((c) => c.id === 'same-way')!
    expect(meetsChallenge(train([{ driver: 20, driven: 20 }], 1, 1), same)).toBe(false)
    expect(
      meetsChallenge(
        train(
          [
            { driver: 20, driven: 30 },
            { driver: 30, driven: 20 },
          ],
          1,
          1,
        ),
        same,
      ),
    ).toBe(true)
  })
})

describe('circuits', () => {
  it('add resistances in series and their reciprocals in parallel', () => {
    expect(totalResistance([part('r10'), part('r10'), part('r10')], 'series')).toBe(30)
    expect(totalResistance([part('r10'), part('r10')], 'parallel')).toBe(5)
    expect(totalResistance([part('r100'), part('bulb')], 'parallel')).toBeCloseTo(1 / (1 / 100 + 1 / 12))
  })

  it("follow Ohm's law", () => {
    const series = solve(9, [part('r10'), part('r10'), part('r10')], 'series')
    expect(series.amps).toBeCloseTo(0.3)
    for (const r of series.parts) expect(r.volts).toBeCloseTo(3)
    const parallel = solve(9, [part('r10'), part('r10'), part('r10')], 'parallel')
    expect(parallel.amps).toBeCloseTo(2.7)
    expect(parallel.watts).toBeCloseTo(24.3)
  })

  it('light two bulbs more dimly in series than in parallel', () => {
    const bulbs = [part('bulb'), part('bulb')]
    const s = solve(3, bulbs, 'series').parts[0].watts
    const p = solve(3, bulbs, 'parallel').parts[0].watts
    expect(p).toBeCloseTo(0.75)
    expect(s).toBeCloseTo(p / 4)
  })
})
