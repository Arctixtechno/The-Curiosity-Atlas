// The light ends: the gas plant, isomerisation and alkylation.
//
// Gas plant: the LPG from the crude unit, cat cracker and reformer is split in
// a depropaniser into propane and propylene overhead and butanes and
// butylenes at the bottom. How cleanly it splits depends on the reflux ratio,
// worked out the way a process engineer would on the back of an envelope:
// Underwood's minimum reflux, Gilliland's correlation (Eduljee's form) for
// how many ideal stages that buys, and Fenske's equation for the purity
// those stages give. More reflux means cleaner products and a bigger reboiler.
//
// Isomerisation: light straight-run naphtha (pentanes and hexanes) is
// rearranged over a platinum catalyst into branched isomers, which knock far
// less. Branching is favoured by low temperature (it is mildly exothermic),
// but the reaction is slow when cold, so there is a best temperature between
// the rate and the equilibrium. Recycling the unconverted normal paraffins
// from a deisohexaniser pushes the octane up further. The reactor also
// saturates the feed's benzene.
//
// Alkylation: isobutane is joined to butylenes (and propylene) in strong
// sulphuric acid, making iso-octanes: alkylate, the cleanest petrol
// component. Cold, lots of excess isobutane and strong acid all favour the
// main reaction over polymerisation, which makes poorer octane and eats acid.
//
// Correlations are shaped to published data (Gary and Handwerk; Meyers,
// Handbook of Petroleum Refining Processes). Typical, not a design tool.

/** Density of each light component, kg/m³. */
export const DENSITY = {
  propane: 508,
  propylene: 522,
  isobutane: 557,
  butane: 584,
  butylenes: 601,
  lightNaphtha: 660,
  isomerate: 650,
  alkylate: 700,
}

/** Thousand barrels a day from tonnes a day at a density in kg/m³. */
export function kbpd(tonnesPerDay: number, density: number) {
  return (tonnesPerDay * 1000) / density / 158.987
}

/** LPG components, thousand barrels a day. */
export interface Lpg {
  propane: number
  propylene: number
  isobutane: number
  butane: number
  butylenes: number
}

export const NO_LPG: Lpg = { propane: 0, propylene: 0, isobutane: 0, butane: 0, butylenes: 0 }

export function addLpg(...parts: Lpg[]): Lpg {
  return parts.reduce(
    (sum, p) => ({
      propane: sum.propane + p.propane,
      propylene: sum.propylene + p.propylene,
      isobutane: sum.isobutane + p.isobutane,
      butane: sum.butane + p.butane,
      butylenes: sum.butylenes + p.butylenes,
    }),
    NO_LPG,
  )
}

/** Splits a mass of LPG (tonnes a day) by weight fractions into volumes. */
export function lpgFromTonnes(tonnes: number, split: Partial<Record<keyof Lpg, number>>): Lpg {
  const out = { ...NO_LPG }
  for (const [k, share] of Object.entries(split) as [keyof Lpg, number][]) out[k] = kbpd(tonnes * share, DENSITY[k])
  return out
}

/* ---------------- Gas plant ---------------- */

export interface GasPlantInputs {
  /** Depropaniser reflux ratio, reflux over distillate. */
  reflux: number
}

export const GAS_PLANT_LIMITS = {
  reflux: { min: 1.2, max: 5 },
  /** Ideal stages in the depropaniser. */
  stages: 20,
  /** Relative volatility of propane over isobutane at column conditions. */
  alpha: 2.3,
  /** Commercial propane may carry this much butane, vol% (EN 589 class). */
  butaneInPropaneMax: 2.5,
}

export const GAS_PLANT_START: GasPlantInputs = { reflux: 2.4 }

export interface GasPlantResult {
  feed: Lpg
  /** Light key (C3) mole fraction in the feed. */
  lightShare: number
  minReflux: number
  /** Ideal stages the column is worth at this reflux, by Fenske. */
  minStages: number
  /** Share of each key that goes the right way, %. */
  purity: number
  /** C3 overhead and C4 bottoms, after the split, kb/d. */
  overhead: Lpg
  bottoms: Lpg
  butaneInPropane: number
  /** Reboiler duty, MW. */
  duty: number
  warnings: string[]
}

export function runGasPlant(feed: Lpg, inputs: GasPlantInputs): GasPlantResult {
  const { alpha, stages } = GAS_PLANT_LIMITS
  const c3 = feed.propane + feed.propylene
  const c4 = feed.isobutane + feed.butane + feed.butylenes
  const lightShare = c3 + c4 > 0 ? c3 / (c3 + c4) : 0.5
  // Underwood, for a binary of the keys fed as boiling liquid, taking nearly pure products.
  const minReflux = 1 / ((alpha - 1) * Math.max(0.15, lightShare))
  const r = Math.max(inputs.reflux, minReflux + 0.01)
  // Gilliland, in Eduljee's form: how far the reflux above minimum takes the stages towards the minimum.
  const x = (r - minReflux) / (r + 1)
  const y = 0.75 * (1 - x ** 0.5668)
  const minStages = Math.max(1, stages - y * (stages + 1))
  // Fenske, splitting the separation evenly between top and bottom.
  const ratio = alpha ** (minStages / 2)
  const p = ratio / (1 + ratio)
  const overhead = {
    propane: feed.propane * p,
    propylene: feed.propylene * p,
    isobutane: feed.isobutane * (1 - p),
    butane: feed.butane * (1 - p),
    butylenes: feed.butylenes * (1 - p),
  }
  const bottoms = {
    propane: feed.propane - overhead.propane,
    propylene: feed.propylene - overhead.propylene,
    isobutane: feed.isobutane - overhead.isobutane,
    butane: feed.butane - overhead.butane,
    butylenes: feed.butylenes - overhead.butylenes,
  }
  const top = overhead.propane + overhead.propylene + overhead.isobutane + overhead.butane + overhead.butylenes
  const butaneInPropane = top > 0 ? ((overhead.isobutane + overhead.butane + overhead.butylenes) / top) * 100 : 0
  // Vapour boiled up = (R + 1) × distillate; LPG takes about 350 kJ/kg to boil.
  const distillateKgs = (c3 * 158.987 * 1000 * 0.515) / 86400
  const duty = (inputs.reflux + 1) * distillateKgs * 0.35
  const warnings: string[] = []
  if (inputs.reflux < minReflux)
    warnings.push(`The reflux is below the minimum (${minReflux.toFixed(2)}): the column can't make the split at any number of trays.`)
  if (butaneInPropane > GAS_PLANT_LIMITS.butaneInPropaneMax)
    warnings.push(
      `Propane carries ${butaneInPropane.toFixed(1)}% butane, over the ${GAS_PLANT_LIMITS.butaneInPropaneMax}% allowed: in winter it won't vaporise fully in customers' tanks. Raise the reflux.`,
    )
  return { feed, lightShare, minReflux, minStages, purity: p * 100, overhead, bottoms, butaneInPropane, duty, warnings }
}

/* ---------------- Isomerisation ---------------- */

export interface IsomInputs {
  /** Reactor temperature, °C. */
  temp: number
  /** Recycle unconverted normal paraffins from the deisohexaniser. */
  recycle: boolean
  /** Run the unit at all: off sends the light naphtha straight to blending. */
  running: boolean
}

export const ISOM_LIMITS = { temp: { min: 100, max: 220 } }
export const ISOM_START: IsomInputs = { temp: 150, recycle: false, running: true }

/** Share of branched isomers in straight-run light naphtha. */
const FEED_ISO = 0.35

export interface IsomResult {
  feed: number
  /** Branched share at equilibrium and as made. */
  equilibrium: number
  iso: number
  /** How close the reactor gets to equilibrium, 0–1. */
  approach: number
  octane: number
  feedOctane: number
  product: number
  /** Benzene in the product, vol%: the reactor saturates it. */
  benzene: number
  warnings: string[]
}

export const isoOctane = (iso: number) => 55 + 36 * iso

export function runIsom(feed: number, inputs: IsomInputs): IsomResult {
  const kelvin = inputs.temp + 273.15
  const equilibrium = Math.min(0.95, 0.92 - 0.0022 * (inputs.temp - 100))
  const k = 3 * Math.exp(-8000 * (1 / kelvin - 1 / 423.15))
  const approach = 1 - Math.exp(-k)
  let iso = FEED_ISO + (equilibrium - FEED_ISO) * approach
  // The deisohexaniser sends most of what stayed straight back round for another pass.
  if (inputs.recycle) iso = 1 - (1 - iso) * 0.4
  const warnings: string[] = []
  if (inputs.temp < 125) warnings.push('The isomerisation reactor is too cold for the catalyst to keep up: the product falls short of equilibrium.')
  if (inputs.temp > 190) warnings.push('The isomerisation reactor is hot: equilibrium now favours straight chains, and cracking to gas starts.')
  return {
    feed,
    equilibrium,
    iso,
    approach,
    octane: isoOctane(iso),
    feedOctane: isoOctane(FEED_ISO),
    product: feed * (inputs.recycle ? 0.97 : 0.98),
    benzene: 0,
    warnings,
  }
}

/* ---------------- Alkylation ---------------- */

export interface AlkyInputs {
  /** Isobutane to olefin ratio at the reactor, by volume. */
  ratio: number
  /** Reactor temperature, °C: the refrigeration holds it. */
  temp: number
  /** Acid strength held by fresh acid makeup, wt% H₂SO₄. */
  acid: number
  /** Send propylene to the alkylation unit as well as butylenes. */
  propylene: boolean
}

export const ALKY_LIMITS = {
  ratio: { min: 5, max: 15 },
  temp: { min: 2, max: 16 },
  acid: { min: 86, max: 96 },
  /** Below this strength the acid can run away: olefins polymerise and dilute it further. */
  acidRunaway: 88,
}

export const ALKY_START: AlkyInputs = { ratio: 8, temp: 8, acid: 92, propylene: false }

export interface AlkyResult {
  olefins: number
  propyleneShare: number
  alkylate: number
  octane: number
  /** Isobutane used up, available from the gas plant, and bought in, kb/d. */
  isobutaneUsed: number
  isobutaneAvailable: number
  isobutaneImported: number
  /** Fresh acid, tonnes a day. */
  acidUse: number
  /** Refrigeration and deisobutaniser, MW. */
  power: number
  warnings: string[]
}

export function runAlky(bottoms: Lpg, overhead: Lpg, inputs: AlkyInputs): AlkyResult {
  const c3 = inputs.propylene ? overhead.propylene : 0
  const c4 = bottoms.butylenes
  const olefins = c3 + c4
  const propyleneShare = olefins > 0 ? c3 / olefins : 0
  const alkylate = 1.78 * c4 + 1.8 * c3
  const octane = Math.min(
    98.5,
    96.4 - 0.22 * (inputs.temp - 5) + 0.18 * (inputs.ratio - 8) - 1.2 * Math.max(0, 90 - inputs.acid) - 4.5 * propyleneShare,
  )
  const isobutaneUsed = 1.15 * c4 + 1.25 * c3
  const isobutaneAvailable = bottoms.isobutane
  // Acid use: more when warm, short of isobutane, weak, or on propylene. About 0.3 lb per gallon of alkylate at best.
  const alkylateTonnes = (alkylate * 158.987 * DENSITY.alkylate) / 1000
  const acidRate =
    0.036 * Math.exp(0.06 * (inputs.temp - 5)) * Math.sqrt(8 / inputs.ratio) * (1 + 1.5 * propyleneShare) * (1 + 0.15 * (inputs.acid - 90))
  const acidUse = alkylateTonnes * acidRate
  // Refrigeration rises as the reactor runs colder; the deisobutaniser boils the recycled isobutane.
  const olefinKgs = (olefins * 158.987 * 1000 * 0.58) / 86400
  const power = olefinKgs * (0.09 * (20 - inputs.temp) + 0.08 * inputs.ratio)
  const warnings: string[] = []
  if (inputs.acid < ALKY_LIMITS.acidRunaway)
    warnings.push('Acid strength is below 88%: it can run away, polymerising the olefins into red oil. Add fresh acid now.')
  if (inputs.temp > 12) warnings.push('The reactor is warm: polymerisation is taking over from alkylation, costing octane and acid.')
  if (inputs.ratio < 6) warnings.push('Too little isobutane: olefins react with each other instead of with isobutane.')
  return {
    olefins,
    propyleneShare,
    alkylate,
    octane,
    isobutaneUsed,
    isobutaneAvailable,
    isobutaneImported: Math.max(0, isobutaneUsed - isobutaneAvailable),
    acidUse,
    power,
    warnings,
  }
}
