import type { CrudeId } from './crudes.ts'

// The naphtha hydrotreater and the catalytic reformer.
//
// The hydrotreater strips sulphur from the heavy naphtha, because the
// reformer's platinum catalyst can't stand more than about half a part per
// million of it. Desulphurisation is first order in sulphur with an
// Arrhenius rate, so each few degrees of reactor temperature takes off
// another slice.
//
// The reformer runs three reactions on a platinum catalyst, each lumped:
//   naphthenes → aromatics + 3 H₂   fast and strongly endothermic
//   paraffins → aromatics + 4 H₂    slower, endothermic, favoured by low pressure
//   paraffins + H₂ → LPG and gas    hydrocracking: slow, exothermic, a yield loss
// The heat they absorb cools the oil as it passes through each reactor, which
// slows the reactions, so the unit has three reactors with a furnace before
// each. The model integrates down every bed in small slices, tracking
// composition and temperature together, which gives the classic sawtooth
// temperature profile. Coke laid down on the catalyst slowly kills its
// activity over months, and the operator raises the inlet temperatures to
// keep the octane up until the furnaces or the yield say stop.
//
// Rates and heats are lumped values shaped to published reformer data (Gary
// and Handwerk; Antos and Aitani, Catalytic Naphtha Reforming). Typical, not a design tool.

export interface NhtInputs {
  /** Reactor inlet temperature, °C. */
  temp: number
}

export interface ReformerInputs {
  /** Inlet temperature of all three reactors, °C (the weighted average inlet temperature, WAIT). */
  wait: number
  /** Separator pressure, bar gauge. */
  pressure: number
  /** Recycle hydrogen to hydrocarbon, mol/mol. */
  h2hc: number
}

/** Where the catalyst is in its cycle. */
export interface CatalystState {
  /** Days since the last regeneration. */
  days: number
  /** Coke on catalyst, wt%. */
  coke: number
}

export const NHT_LIMITS = { temp: { min: 260, max: 360, design: 320 } }
export const REFORMER_LIMITS = {
  wait: { min: 470, max: 540 },
  pressure: { min: 8, max: 30 },
  h2hc: { min: 3, max: 8 },
  /** Furnace tubes reach their metal limit with inlets this hot. */
  waitMax: 530,
  /** Reformer feed the reactors are sized for, thousand barrels a day. */
  feedDesign: 18,
  /** Sulphur the platinum catalyst can tolerate, ppm. */
  sulphurMax: 0.5,
  /** Coke on catalyst at which a semi-regenerative unit has to stop and burn it off, wt%. */
  cokeMax: 20,
}

export const NHT_START: NhtInputs = { temp: 320 }
export const REFORMER_START: ReformerInputs = { wait: 505, pressure: 18, h2hc: 5 }
export const FRESH_CATALYST: CatalystState = { days: 0, coke: 2 }

/** Heavy naphtha composition, wt%: paraffins, naphthenes and aromatics. Rounded from typical assays. */
export const NAPHTHA_PNA: Record<CrudeId, { p: number; n: number; a: number }> = {
  brent: { p: 48, n: 36, a: 16 },
  wti: { p: 55, n: 32, a: 13 },
  arabLight: { p: 66, n: 22, a: 12 },
  maya: { p: 45, n: 38, a: 17 },
}

/** The light naphtha (C5 and C6, boiling below this) goes to the isomerisation unit, not the reformer, °C. */
export const LIGHT_NAPHTHA_END = 80

/** Catalyst split between the three reactors: the first is small because the fast reaction is done early. */
export const BEDS = [0.15, 0.3, 0.55]

// Kinetics: rate constants at 500 °C, per unit of catalyst-hours, and activation energies over R, K.
const T_REF = 773.15
const K_NAPH = 40
const E_NAPH = 16000
const K_CYC = 1.6
const E_CYC = 15000
const K_HC = 1.0
const E_HC = 19000
/** Heats of reaction, kJ per kg converted: positive absorbs heat. */
const DH_NAPH = 2150
const DH_CYC = 2600
const DH_HC = -650
/** Heat capacity of the reacting gas per kg of naphtha, kJ/kg·K: the oil plus its recycle hydrogen. */
const CP_OIL = 3.3
const CP_H2_PER_RATIO = 0.35
/** Hydrogen released, kg per kg converted: 3 H₂ per C7 naphthene, 4 per C7 paraffin. Hydrocracking takes 2%. */
const H2_NAPH = 0.061
const H2_CYC = 0.08
const H2_HC = 0.02
/** Research octane each class contributes to the reformate. */
const RON = { p: 62, n: 72, a: 111, feedP: 45 }
const SLICES = 40

export interface NhtResult {
  sulphurIn: number
  sulphurOut: number
  warnings: string[]
}

/** Product sulphur from the hydrotreater, ppm. */
export function runNht(sulphurIn: number, rate: number, inputs: NhtInputs): NhtResult {
  // Design: 18 kb/d at 320 °C takes sulphur down a thousandfold.
  const k = 7.6 * Math.exp(-12000 * (1 / (inputs.temp + 273.15) - 1 / 593.15)) * (REFORMER_LIMITS.feedDesign / Math.max(1, rate))
  const sulphurOut = sulphurIn * Math.exp(-k)
  const warnings: string[] = []
  if (sulphurOut > REFORMER_LIMITS.sulphurMax)
    warnings.push(
      `Sulphur is breaking through the hydrotreater (${sulphurOut.toFixed(1)} ppm against ${REFORMER_LIMITS.sulphurMax}): it is poisoning the reformer's platinum. Raise the hydrotreater temperature.`,
    )
  return { sulphurIn, sulphurOut, warnings }
}

export interface ReformerFeed {
  /** Thousand barrels a day. */
  rate: number
  p: number
  n: number
  a: number
  /** Feed end point, °C: heavier feed lays down coke faster. */
  endPoint: number
  /** Sulphur after the hydrotreater, ppm. */
  sulphur: number
}

/** One point down the reactors: how far through the catalyst (0 to 1), and the temperature there. */
export interface ProfilePoint {
  at: number
  temp: number
}

export interface ReformerResult {
  /** Catalyst activity, 0 to 1: coke and sulphur take it down. */
  activity: number
  /** Temperature drop across each reactor, °C. */
  drops: number[]
  profile: ProfilePoint[]
  /** Product, wt% of feed. */
  yields: { reformate: number; hydrogen: number; lpg: number; fuelGas: number }
  /** Reformate composition, wt% of reformate. */
  composition: { p: number; n: number; a: number }
  octane: number
  /** Hydrogen made, tonnes a day. */
  hydrogen: number
  /** Furnace duty to reheat between the reactors, MW. */
  duty: number
  /** Coke laid down, wt% on catalyst a day. */
  cokeRate: number
  /** Days until the catalyst reaches its coke limit at this rate. */
  daysLeft: number
  economics: { productValue: number; feedCost: number; fuelCost: number; margin: number }
  warnings: string[]
}

/**
 * Illustrative values, US dollars a tonne. Reformate is worth more for each point of octane above 95, because the
 * blenders need less of other components to make premium petrol. Hydrogen is valued at what a steam reformer would charge.
 */
export const REFORMER_PRICES = { feed: 640, reformate: 860, perOctane: 14, hydrogen: 1800, lpg: 520, fuelGas: 300, fuelPerGJ: 9 }

const arrhenius = (k: number, e: number, kelvin: number) => k * Math.exp(-e * (1 / kelvin - 1 / T_REF))

/** Naphtha mass flow, tonnes a day. */
export function naphthaTonnes(kbpd: number) {
  return kbpd * 1000 * 0.158987 * 0.75
}

export function runReformer(inputs: ReformerInputs, feed: ReformerFeed, catalyst: CatalystState): ReformerResult {
  const poison = Math.max(0, feed.sulphur - REFORMER_LIMITS.sulphurMax)
  const activity = Math.exp(-Math.max(0, catalyst.coke - FRESH_CATALYST.coke) / 14) / (1 + 0.6 * poison)
  // Catalyst-hours per unit of feed: more feed, less time on the catalyst.
  const contact = (1 / 1.5) * (REFORMER_LIMITS.feedDesign / Math.max(1, feed.rate))
  const pressure = inputs.pressure / 18
  const cp = CP_OIL + CP_H2_PER_RATIO * inputs.h2hc

  // Fractions of the feed, by weight.
  let p = feed.p / 100
  let n = feed.n / 100
  let a = feed.a / 100
  let h2 = 0
  let cracked = 0
  const drops: number[] = []
  const profile: ProfilePoint[] = []
  let done = 0
  // Each furnace heats the oil from where it arrives to the reactor inlet: the first from the feed–effluent exchanger at about 430 °C.
  let arriving = 430
  let reheat = 0
  for (const bed of BEDS) {
    reheat += inputs.wait - arriving
    let t = inputs.wait + 273.15
    profile.push({ at: done, temp: t - 273.15 })
    const dw = (bed * contact) / SLICES
    for (let i = 0; i < SLICES; i++) {
      const dn = n * (1 - Math.exp(-arrhenius(K_NAPH, E_NAPH, t) * activity * dw))
      const dc = p * (1 - Math.exp(-arrhenius(K_CYC, E_CYC, t) * activity * dw * pressure ** -0.5))
      const dh = p * (1 - Math.exp(-arrhenius(K_HC, E_HC, t) * activity * dw * pressure ** 0.6))
      n -= dn
      p -= dc + dh
      a += dn * (1 - H2_NAPH) + dc * (1 - H2_CYC)
      h2 += dn * H2_NAPH + dc * H2_CYC - dh * H2_HC
      cracked += dh * (1 + H2_HC)
      t -= (dn * DH_NAPH + dc * DH_CYC + dh * DH_HC) / cp
      done += bed / SLICES
      profile.push({ at: done, temp: t - 273.15 })
    }
    arriving = t - 273.15
    drops.push(inputs.wait - arriving)
  }

  const reformate = p + n + a
  const octane = (p * RON.p + n * RON.n + a * RON.a) / reformate
  const tonnes = naphthaTonnes(feed.rate)
  const hydrogen = h2 * tonnes
  const duty = (cp * reheat * tonnes * 1000) / 86400 / 1000
  const yields = { reformate: reformate * 100, hydrogen: h2 * 100, lpg: cracked * 70, fuelGas: cracked * 30 }

  // Coke grows with temperature and heavier feed, and falls with hydrogen pressure.
  const cokeRate =
    0.06 *
    Math.exp(9000 * (1 / T_REF - 1 / (inputs.wait + 273.15))) *
    (18 / inputs.pressure) ** 1.4 *
    (5 / inputs.h2hc) ** 0.7 *
    Math.exp((feed.endPoint - 170) / 30) *
    (feed.rate / REFORMER_LIMITS.feedDesign)
  const daysLeft = Math.max(0, (REFORMER_LIMITS.cokeMax - catalyst.coke) / cokeRate)

  const value = (share: number, price: number) => share * tonnes * price
  const productValue =
    value(reformate, REFORMER_PRICES.reformate + REFORMER_PRICES.perOctane * (octane - 95)) + value(h2, REFORMER_PRICES.hydrogen) + value(cracked * 0.7, REFORMER_PRICES.lpg) + value(cracked * 0.3, REFORMER_PRICES.fuelGas)
  const feedCost = tonnes * REFORMER_PRICES.feed
  const fuelCost = (duty * 86400 * REFORMER_PRICES.fuelPerGJ) / 1000 / 0.85
  const warnings: string[] = []
  if (inputs.wait > REFORMER_LIMITS.waitMax)
    warnings.push(`Reactor inlets above ${REFORMER_LIMITS.waitMax} °C: the furnace tubes are past their metal limit, and coke and cracking are climbing fast.`)
  if (poison > 0) warnings.push('Sulphur is poisoning the platinum: activity is down until the feed is clean again.')
  if (catalyst.coke >= REFORMER_LIMITS.cokeMax) warnings.push('The catalyst is at its coke limit: shut down and regenerate it.')
  else if (daysLeft < 30) warnings.push(`At this rate the catalyst reaches its coke limit in ${daysLeft.toFixed(0)} days.`)
  if (feed.endPoint > 200) warnings.push('The feed end point is high: heavy aromatics in it lay down coke fast.')

  return {
    activity,
    drops,
    profile,
    yields,
    composition: { p: (p / reformate) * 100, n: (n / reformate) * 100, a: (a / reformate) * 100 },
    octane,
    hydrogen,
    duty,
    cokeRate,
    daysLeft,
    economics: { productValue, feedCost, fuelCost, margin: productValue - feedCost - fuelCost },
    warnings,
  }
}

/** Research octane of the feed, for comparison. */
export function feedOctane(feed: { p: number; n: number; a: number }) {
  return (feed.p * RON.feedP + feed.n * RON.n + feed.a * RON.a) / (feed.p + feed.n + feed.a)
}

/** Runs the catalyst on for `days` at these conditions. */
export function ageCatalyst(catalyst: CatalystState, result: ReformerResult, days: number): CatalystState {
  return { days: catalyst.days + days, coke: Math.min(REFORMER_LIMITS.cokeMax, catalyst.coke + result.cokeRate * days) }
}
