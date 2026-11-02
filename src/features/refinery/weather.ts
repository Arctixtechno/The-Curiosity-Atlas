// The wind over the marshes, through the plant's days: mostly from the
// south-west, as it is over the Thames estuary, swinging round with passing
// weather and dropping to a calm now and then. It moves the stack plumes and
// the flare on site, tilts the flare's flame on the safety screen, and says
// which muster point is upwind. Fixed by the time, like the market.

export interface Wind {
  /** Where it blows from, degrees clockwise from north. */
  from: number
  /** Metres a second at 10 m up. */
  speed: number
}

/** Where the wind usually blows from: the south-west. */
export const PREVAILING = 225

const wave = (t: number, parts: [number, number, number][]) =>
  parts.reduce((sum, [amp, period, phase]) => sum + amp * Math.sin((2 * Math.PI * t) / period + phase), 0)

/** The wind at a moment of the plant's calendar, in days (fractions move it through the day). */
export function windOn(day: number): Wind {
  const from =
    PREVAILING +
    wave(day, [
      [55, 5.3, 0.4],
      [30, 1.7, 2.1],
      [12, 0.37, 1.2],
    ])
  // A sea breeze picks up in the afternoon; passing weather brings the strong days.
  const speed =
    6 +
    wave(day, [
      [3, 4.1, 1.3],
      [1.6, 1, -1.9],
      [0.8, 0.21, 0.6],
    ])
  return { from: ((from % 360) + 360) % 360, speed: Math.max(0.5, speed) }
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const NAMES: Record<string, string> = { N: 'north', NE: 'north-east', E: 'east', SE: 'south-east', S: 'south', SW: 'south-west', W: 'west', NW: 'north-west' }

/** The nearest of the eight compass points, such as "SW". */
export const compass = (degrees: number) => POINTS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8]
/** The compass point written out, such as "south-west". */
export const compassName = (degrees: number) => NAMES[compass(degrees)]

/**
 * The way the wind carries things on site, as a unit [x, z]. The site is laid out with north up the map, towards −z,
 * and east towards +x, where the estuary is.
 */
export function downwind(w: Wind): [number, number] {
  const towards = ((w.from + 180) * Math.PI) / 180
  return [Math.sin(towards), -Math.cos(towards)]
}

/** The Beaufort force and its name, from a wind speed in m/s. */
export function beaufort(speed: number): { force: number; name: string } {
  const limits = [0.5, 1.6, 3.4, 5.5, 8, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7]
  const names = [
    'Calm',
    'Light air',
    'Light breeze',
    'Gentle breeze',
    'Moderate breeze',
    'Fresh breeze',
    'Strong breeze',
    'Near gale',
    'Gale',
    'Strong gale',
    'Storm',
    'Violent storm',
    'Hurricane',
  ]
  const force = limits.filter((l) => speed >= l).length
  return { force, name: names[force] }
}
