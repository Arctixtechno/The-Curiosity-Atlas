// Hydrotreating, the hydrogen balance and sulphur recovery.
//
// Diesel hydrotreater: road diesel may carry 10 ppm of sulphur (EN 590), and
// straight-run gas oil arrives with thousands. Most of its sulphur sits in
// easy molecules (thiols, sulphides, plain thiophenes), but the last few
// hundred ppm are in dibenzothiophenes with methyl groups shielding the
// sulphur atom (4,6-DMDBT), which react slowly and need pressure. The model
// treats them as two first-order lumps with their own rates. Cracked light
// cycle oil from the cat cracker is richer in the hard sulphur, and its
// aromatics and nitrogen hold the catalyst back.
//
// Hydrogen: the reformer makes it and every hydrotreater uses it. Anything
// the reformer can't supply is bought from a steam methane reformer.
//
// Sulphur recovery (Claus): the hydrogen sulphide washed out by the amine
// unit is burned with a third of the air it needs, to make SO₂ for the rest
// to react with:  2 H₂S + SO₂ → 3 S + 2 H₂O. Each catalytic converter takes
// the reaction further. Get the air wrong and the 2:1 ratio is lost, and
// what doesn't react goes up the incinerator stack as SO₂.
//
// Rates and recoveries are lumped values shaped to published data (Gary and
// Handwerk; Kohl and Nielsen, Gas Purification). Typical, not a design tool.

export interface DhtInputs {
  /** Reactor inlet temperature, °C. */
  temp: number
  /** Hydrogen partial pressure, bar. */
  pressure: number
  /** Take the cat cracker's light cycle oil into the diesel pool. */
  lco: boolean
}

export interface SruInputs {
  /** Combustion air as % of what makes exactly 2:1 H₂S to SO₂. */
  air: number
  /** Catalytic converters in service. */
  converters: 2 | 3
  /** Tail gas unit, which recycles what the Claus stages miss. */
  tailGas: boolean
}

export const DHT_LIMITS = {
  temp: { min: 320, max: 400 },
  pressure: { min: 30, max: 80 },
  /** Feed the reactors are sized for, thousand barrels a day. */
  feedDesign: 25,
  /** Road diesel sulphur limit, ppm (EN 590). */
  sulphurMax: 10,
  /** Above this the catalyst cokes fast and the diesel darkens: end of run. */
  endOfRun: 390,
}

export const SRU_LIMITS = {
  air: { min: 85, max: 115 },
  /** Sulphur the plant can make, tonnes a day. */
  capacity: 150,
  /** The site's permit for SO₂ from the incinerator stack, tonnes a day. */
  so2Permit: 3,
}

export const DHT_START: DhtInputs = { temp: 345, pressure: 45, lco: false }
export const SRU_START: SruInputs = { air: 96, converters: 2, tailGas: false }

/** Share of each feed's sulphur in the hard, sterically hindered molecules. */
const HARD = { straightRun: 0.2, lco: 0.45 }
const T_REF = 623.15

export interface DhtFeed {
  /** Straight-run diesel from the crude unit, thousand barrels a day, and its sulphur, ppm. */
  rate: number
  sulphur: number
  /** Light cycle oil from the cat cracker (0 when not taken). */
  lcoRate: number
  lcoSulphur: number
}

export interface DhtResult {
  feedRate: number
  sulphurIn: number
  sulphurOut: number
  onSpec: boolean
  /** Hydrogen used, wt% of feed and tonnes a day. */
  hydrogenPct: number
  hydrogen: number
  /** Sulphur taken out, tonnes a day. */
  sulphurRemoved: number
  warnings: string[]
}

/** Gas oil and cycle oil, tonnes a day from thousand barrels a day. */
export function gasOilTonnes(kbpd: number, density = 850) {
  return kbpd * 158.987 * density / 1000
}

export function runDht(feed: DhtFeed, inputs: DhtInputs): DhtResult {
  const lcoRate = inputs.lco ? feed.lcoRate : 0
  const feedRate = feed.rate + lcoRate
  const lcoShare = feedRate > 0 ? lcoRate / feedRate : 0
  const srTonnes = gasOilTonnes(feed.rate)
  const lcoTonnes = gasOilTonnes(lcoRate, 950)
  const tonnes = srTonnes + lcoTonnes
  const sulphurIn = tonnes > 0 ? (srTonnes * feed.sulphur + lcoTonnes * feed.lcoSulphur) / tonnes : 0
  const kelvin = inputs.temp + 273.15
  const space = DHT_LIMITS.feedDesign / Math.max(1, feedRate)
  // Aromatics and nitrogen in cycle oil compete for the catalyst's sites.
  const inhibition = 1 / (1 + 2.2 * lcoShare)
  const easy = 7 * Math.exp(-11000 * (1 / kelvin - 1 / T_REF)) * (inputs.pressure / 45) ** 0.5 * space * inhibition
  const hard = 4.6 * Math.exp(-15000 * (1 / kelvin - 1 / T_REF)) * (inputs.pressure / 45) ** 1.3 * space * inhibition
  const hardShare = HARD.straightRun * (1 - lcoShare) + HARD.lco * lcoShare
  const sulphurOut = sulphurIn * ((1 - hardShare) * Math.exp(-easy) + hardShare * Math.exp(-hard))
  // Hydrogen goes on the sulphur and, more, on saturating aromatics: far more of those in cycle oil, and more at pressure.
  const saturation = (0.45 * (1 - lcoShare) + 2 * lcoShare) * (inputs.pressure / 45) ** 0.7 * (1 + (inputs.temp - 345) / 200)
  const hydrogenPct = saturation + (0.0625 * (sulphurIn - sulphurOut)) / 10_000
  const warnings: string[] = []
  const onSpec = sulphurOut <= DHT_LIMITS.sulphurMax
  if (!onSpec)
    warnings.push(
      `Diesel carries ${sulphurOut.toFixed(0)} ppm of sulphur against the ${DHT_LIMITS.sulphurMax} ppm road limit: it has to be sold as heating oil.`,
    )
  if (inputs.temp > DHT_LIMITS.endOfRun)
    warnings.push(`The reactor is above ${DHT_LIMITS.endOfRun} °C: coke builds fast and the diesel darkens. That is end-of-run territory.`)
  return {
    feedRate,
    sulphurIn,
    sulphurOut,
    onSpec,
    hydrogenPct,
    hydrogen: (hydrogenPct / 100) * tonnes,
    sulphurRemoved: (tonnes * (sulphurIn - sulphurOut)) / 1e6,
    warnings,
  }
}

export interface HydrogenBalance {
  supply: number
  /** Users, tonnes a day. */
  users: { name: string; tonnes: number }[]
  demand: number
  /** Bought in when positive. */
  imported: number
  /** Sent to fuel gas when the reformer makes more than is used. */
  surplus: number
}

export function hydrogenBalance(supply: number, users: HydrogenBalance['users']): HydrogenBalance {
  const demand = users.reduce((sum, u) => sum + u.tonnes, 0)
  return { supply, users, demand, imported: Math.max(0, demand - supply), surplus: Math.max(0, supply - demand) }
}

export interface SruResult {
  /** Sulphur arriving as H₂S, tonnes a day. */
  feed: number
  /** Share recovered as liquid sulphur, %. */
  recovery: number
  sulphur: number
  /** SO₂ out of the stack, tonnes a day. */
  so2: number
  /** H₂S to SO₂ in the tail gas: 2 is perfect. */
  ratio: number
  warnings: string[]
}

export function runSru(sulphurIn: number, inputs: SruInputs): SruResult {
  const off = inputs.air - 100
  // Each converter gets closer to equilibrium; a wrong air ratio leaves the excess reactant unconverted.
  const claus = (inputs.converters === 3 ? 97.2 : 95.6) - 0.09 * off ** 2
  const recovery = inputs.tailGas ? 100 - (100 - claus) * 0.025 : claus
  const loaded = Math.min(sulphurIn, SRU_LIMITS.capacity)
  const sulphur = (loaded * recovery) / 100
  // Whatever isn't recovered, or the plant can't take, is burned to SO₂: 2 t of SO₂ for each tonne of sulphur.
  const so2 = 2 * (sulphurIn - sulphur)
  const x = off / 100
  const ratio = Math.max(0, (2 * (1 - 3 * x)) / (1 + 6 * x))
  const warnings: string[] = []
  if (sulphurIn > SRU_LIMITS.capacity)
    warnings.push(`More H₂S than the sulphur plant can take (${SRU_LIMITS.capacity} t/d of sulphur): the rest is flared as SO₂.`)
  if (so2 > SRU_LIMITS.so2Permit)
    warnings.push(`The stack is putting out ${so2.toFixed(1)} t/d of SO₂, over the ${SRU_LIMITS.so2Permit} t/d permit.`)
  if (Math.abs(off) >= 4) warnings.push(`The tail gas analyser reads ${ratio.toFixed(1)}:1 H₂S to SO₂. Trim the air towards 2:1.`)
  return { feed: sulphurIn, recovery, sulphur, so2, ratio, warnings }
}
