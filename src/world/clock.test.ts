import { describe, expect, it } from 'vitest'
import { clockText, hourAt, minutesUntilNight, phaseAt, SECONDS_PER_HOUR } from './clock.ts'

describe('the house clock', () => {
  it('runs a whole day in 40 real minutes', () => {
    expect(SECONDS_PER_HOUR * 24).toBe(40 * 60)
    expect(hourAt(0)).toBe(0)
    expect(hourAt(SECONDS_PER_HOUR * 1000 * 13.5)).toBeCloseTo(13.5)
    expect(hourAt(SECONDS_PER_HOUR * 1000 * 25)).toBeCloseTo(1)
  })

  it('knows day from night', () => {
    expect(phaseAt(12)).toBe('day')
    expect(phaseAt(19)).toBe('dusk')
    expect(phaseAt(23)).toBe('night')
    expect(phaseAt(2)).toBe('night')
    expect(phaseAt(6)).toBe('dawn')
  })

  it('counts down to nightfall in real minutes', () => {
    expect(minutesUntilNight(22)).toBe(0)
    expect(minutesUntilNight(19)).toBe(Math.ceil(SECONDS_PER_HOUR / 60))
    expect(minutesUntilNight(8)).toBe(Math.ceil((12 * SECONDS_PER_HOUR) / 60))
  })

  it('shows the time to the nearest ten minutes', () => {
    expect(clockText(21.7)).toBe('21:40')
    expect(clockText(0)).toBe('00:00')
  })
})
