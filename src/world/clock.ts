import { useEffect, useState } from 'react'

// The house's own clock. A day passes in 40 minutes of real time, the same
// for everyone and carrying on between visits, so the courtyard, the roof
// terrace and the observatory all agree on whether it's day or night.

/** Real seconds per hour of the house's day. */
export const SECONDS_PER_HOUR = 100
const DAY_SECONDS = SECONDS_PER_HOUR * 24

export type DayPhase = 'day' | 'dusk' | 'night' | 'dawn'

/** Adding ?hour=22 to the address holds the clock at that hour, to see a time of day without waiting for it. */
function hourFromAddress(): number | null {
  if (typeof location === 'undefined') return null
  const hour = Number(new URLSearchParams(location.search).get('hour'))
  return new URLSearchParams(location.search).has('hour') && hour >= 0 && hour < 24 ? hour : null
}

let forcedHour: number | null = hourFromAddress()

/** Holds the clock at one hour (for testing and screenshots), or lets it run again with null. */
export function setForcedHour(hour: number | null) {
  forcedHour = hour
}

/** The hour of the house's day, from 0 up to 24, at real time `now` (ms). */
export function hourAt(now = Date.now()): number {
  if (forcedHour !== null) return forcedHour
  return ((now / 1000) % DAY_SECONDS) / SECONDS_PER_HOUR
}

/** Day from 07:00, dusk from 18:30, night from 20:00, dawn from 05:30. */
export function phaseAt(hour: number): DayPhase {
  if (hour >= 7 && hour < 18.5) return 'day'
  if (hour >= 18.5 && hour < 20) return 'dusk'
  if (hour >= 5.5 && hour < 7) return 'dawn'
  return 'night'
}

/** Real minutes until the stars are out (20:00), or 0 if they already are. */
export function minutesUntilNight(hour: number): number {
  if (phaseAt(hour) === 'night') return 0
  const hours = (20 - hour + 24) % 24
  return Math.ceil((hours * SECONDS_PER_HOUR) / 60)
}

/** The time as 24-hour clock text, such as "21:40", to the nearest ten minutes. */
export function clockText(hour: number): string {
  const minutes = Math.floor((hour * 60) / 10) * 10
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function useTick(ms: number) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(timer)
  }, [ms])
  return now
}

/** The house's hour, updated every ten real seconds (a few minutes of its day). */
export function useHour() {
  return hourAt(useTick(10_000))
}

/** Day, dusk, night or dawn, changing as the house's clock moves on. */
export function useDayPhase(): DayPhase {
  return phaseAt(useHour())
}
