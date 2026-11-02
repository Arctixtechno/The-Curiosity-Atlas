// The oil market, day by day: how far crude has moved from the prices the
// plant is built on, each product's crack (its price over crude) and the
// price of gas. Made up but shaped like the real thing: crude wanders over
// months, petrol cracks peak in the summer driving season and diesel in the
// winter, and gas is dearest in winter. It is fixed by the day, so a day's
// prices are the same however you get there.

export type CrackId = 'lpg' | 'petrol' | 'naphtha' | 'jet' | 'diesel' | 'fuelOil'

export interface MarketDay {
  day: number
  /** Brent, dollars a barrel. */
  brent: number
  /** Crude's move from the base prices, dollars a barrel: every crude moves with Brent. */
  crude: number
  /** Each product's crack's move from its base, dollars a barrel, on top of the crude move. */
  cracks: Record<CrackId, number>
  /** Fuel and natural gas, dollars a gigajoule. */
  gas: number
}

export const BASE_BRENT = 82
export const BASE_GAS = 9

/** A smooth wiggle: the sum of a few sines with unrelated periods (in days). */
const wave = (day: number, parts: [number, number, number][]) => parts.reduce((sum, [amp, period, phase]) => sum + amp * Math.sin((2 * Math.PI * day) / period + phase), 0)

/** The year's season: +1 in midsummer (day 172), −1 in midwinter. */
const season = (day: number) => Math.cos((2 * Math.PI * (day - 172)) / 365)

/** Day 0 is 1 January. */
export function marketOn(day: number): MarketDay {
  const crude = wave(day, [
    [6, 97, 0.4],
    [3, 41, 1.9],
    [1.4, 13, 0.7],
  ])
  const cracks: Record<CrackId, number> = {
    lpg: -3 * season(day) + wave(day, [[1.5, 29, 2]]),
    petrol: 5 * season(day) + wave(day, [
      [2, 37, 0.3],
      [1, 11, 2.2],
    ]),
    naphtha: wave(day, [
      [3, 53, 1.1],
      [1, 17, 0.2],
    ]),
    jet: -2 * season(day) + wave(day, [
      [2.5, 61, 2.6],
      [1, 19, 1],
    ]),
    diesel: -4 * season(day) + wave(day, [
      [3, 71, 1.4],
      [1.2, 23, 0.5],
    ]),
    fuelOil: wave(day, [
      [3, 83, 2.9],
      [1, 31, 0.1],
    ]),
  }
  const gas = BASE_GAS * (1 - 0.25 * season(day)) + wave(day, [[0.8, 47, 0.6]])
  return { day, brent: BASE_BRENT + crude, crude, cracks, gas }
}

/** Which crack a site product moves with. */
export const PRODUCT_CRACK: Partial<Record<string, CrackId>> = {
  lpg: 'lpg',
  petrol: 'petrol',
  blendstock: 'naphtha',
  jet: 'jet',
  diesel: 'diesel',
  fuelOil: 'fuelOil',
}

/** Days of market history up to and including `day`, one point a day. */
export function history(day: number, days: number): MarketDay[] {
  const today = Math.floor(day)
  return Array.from({ length: days }, (_, i) => marketOn(today - days + 1 + i))
}

/** Tonnes of CO₂ per gigajoule of fuel gas burnt. */
export const CO2_PER_GJ = 0.056
/** Tonnes of CO₂ per tonne of coke burnt in the cat cracker's regenerator. */
export const CO2_PER_COKE = 3.67

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** A plant day as a calendar date, for the charts. */
export function dateOf(day: number) {
  const d = new Date(Date.UTC(2026, 0, 1) + Math.floor(day) * 86400000)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}
