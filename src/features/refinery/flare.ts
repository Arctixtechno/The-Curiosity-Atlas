// The flare: how much heat a relief load releases, how long the flame is, and
// how much of its heat reaches people on the ground, by the simple point-source
// method of API 521. The flame leans over in the wind, with its centre
// halfway along it.

/** Lower heating value of typical relief gas, MJ/kg. */
export const LHV = 46
/** Share of the heat radiated, typical for a hydrocarbon flare. */
export const RADIATED = 0.25
/** The site flare's stack height, m. */
export const STACK_HEIGHT = 60

/** API 521's design levels of radiation, kW/m² (the sun gives about 1). */
export const RADIATION_LIMITS = [
  { kw: 1.58, label: 'Anyone, for any length of time' },
  { kw: 4.73, label: 'A few minutes, in work clothes, to take emergency action' },
  { kw: 6.31, label: 'Thirty seconds to escape' },
  { kw: 9.46, label: 'Seconds only, at the edge of the sterile zone' },
]

export interface ReliefCase {
  id: string
  name: string
  /** Relief load, t/h. */
  load: number
  why: string
}

export const RELIEF_CASES: ReliefCase[] = [
  { id: 'purge', name: 'Normal running: purge gas only', load: 0.5, why: 'A little gas always flows to keep air out of the flare header.' },
  { id: 'reformer', name: 'Reformer recycle compressor trips', load: 60, why: 'Hydrogen-rich gas from the reformer’s separator has nowhere to go.' },
  { id: 'fire', name: 'Fire under the LPG spheres', load: 45, why: 'A pool fire boils the LPG; the spheres’ relief valves protect them from bursting.' },
  { id: 'cooling', name: 'Cooling water fails at the crude column', load: 120, why: 'The overhead is no longer condensed, so the vapour relieves to the flare.' },
  { id: 'power', name: 'Site-wide power failure', load: 260, why: 'Every pump, fan and compressor stops at once. This usually sizes the flare.' },
]

/** Heat released, MW, from a relief load in t/h. */
export const flareHeat = (load: number) => ((load * 1000) / 3600) * LHV

/** Flame length, m, from the heat released: an approximate fit to API 521's chart. */
export const flameLength = (mw: number) => (mw <= 0 ? 0 : 0.00326 * (mw * 1e6) ** 0.478)

/** The flare tip's diameter, m, and the relief gas's density as it leaves, kg/m³. */
export const TIP_DIAMETER = 0.9
export const GAS_DENSITY = 1.2

/** How fast the gas leaves the tip, m/s, for a relief load in t/h. */
export const exitVelocity = (load: number) => (load * 1000) / 3600 / (GAS_DENSITY * Math.PI * (TIP_DIAMETER / 2) ** 2)

/**
 * How far the wind bends the flame over from upright, radians, by the ratio of the wind's speed to the gas's: a
 * fit to the shape of API 521's flame-distortion chart. A pilot-sized flame lies almost flat in any breeze; a big
 * relief stands up nearly straight against it.
 */
export function flameTilt(load: number, wind: number) {
  if (wind <= 0) return 0
  if (load <= 0) return (80 * Math.PI) / 180
  return Math.min((80 * Math.PI) / 180, Math.atan(2 * Math.sqrt(wind / exitVelocity(load))))
}

/** The flame's centre, m: how far downwind of the stack and how high. */
export function flameCentre(mw: number, height = STACK_HEIGHT, tilt = 0) {
  const half = flameLength(mw) / 2
  return { x: half * Math.sin(tilt), y: height + half * Math.cos(tilt) }
}

/** Radiation at ground level, kW/m², a horizontal distance (m) from the stack's foot: downwind if positive. */
export function radiation(mw: number, distance: number, height = STACK_HEIGHT, tilt = 0) {
  const c = flameCentre(mw, height, tilt)
  const d2 = (distance - c.x) ** 2 + c.y * c.y
  return (RADIATED * mw * 1000) / (4 * Math.PI * d2)
}

/** How close to the stack (m, horizontal, downwind) anyone can stand for a given radiation limit; 0 if it's safe even at the foot. */
export function safeDistance(mw: number, limit: number, height = STACK_HEIGHT, tilt = 0) {
  const c = flameCentre(mw, height, tilt)
  const d2 = (RADIATED * mw * 1000) / (4 * Math.PI * limit)
  if (d2 <= c.y * c.y) return 0
  return Math.max(0, c.x + Math.sqrt(d2 - c.y * c.y))
}

/** Steam to the tip, kg per kg of gas: too little smokes, too much snuffs and roars. */
export function steamVerdict(ratio: number): { state: 'smoky' | 'smokeless' | 'oversteamed'; text: string } {
  if (ratio < 0.25) return { state: 'smoky', text: 'Smoking: not enough steam to mix air into the flame. Black smoke is a breach of the permit.' }
  if (ratio > 0.8) return { state: 'oversteamed', text: 'Over-steamed: the flame lifts, roars and can go out, letting unburnt gas escape.' }
  return { state: 'smokeless', text: 'Smokeless: the steam pulls in enough air to burn the soot.' }
}

/** Receivers on a full-size site, m from the flare stack. */
export const RECEIVERS = [
  { name: 'Sterile zone fence', distance: 60 },
  { name: 'Nearest process unit', distance: 90 },
  { name: 'Tank farm', distance: 120 },
  { name: 'Control room', distance: 160 },
  { name: 'Site boundary', distance: 220 },
]
