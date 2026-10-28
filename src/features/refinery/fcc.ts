// The fluid catalytic cracker (FCC): heavy gas oil meets hot, powdered
// zeolite catalyst at the bottom of a riser and cracks in a couple of
// seconds into gas, LPG, petrol and cycle oils. The spent catalyst, coated
// in coke, goes to the regenerator, where air burns the coke off. That fire
// heats the catalyst, and the hot catalyst carries the heat back to the
// riser to crack the next lot of oil.
//
// So the unit is heat balanced: it makes exactly as much coke as it needs
// to burn to supply its own heat. The operator sets the riser outlet
// temperature; the slide valve then lets through whatever catalyst flow
// (catalyst to oil ratio) holds it, and the regenerator temperature settles
// wherever the coke burn balances. Change one thing and everything moves.
//
// The model solves that balance for the catalyst to oil ratio, with
// cracking kinetics and yield curves shaped like published FCC data
// (Sadeghbeigi, Fluid Catalytic Cracking Handbook). Typical, not a design tool.

export interface FccInputs {
  /** Feed rate, thousand barrels a day. */
  feed: number
  /** Feed preheat temperature, °C. */
  preheat: number
  /** Riser outlet temperature, °C. */
  rot: number
  /** Equilibrium catalyst activity, as a MAT (microactivity test) number. */
  activity: number
  /** Heat taken out of the regenerator by a catalyst cooler, MW. */
  cooler: number
}

/** Feed quality, from the vacuum unit. */
export interface FccFeed {
  /** Conradson carbon residue, wt%. */
  carbon: number
  /** Nickel plus vanadium, ppm. */
  metals: number
  /** How readily it cracks (1 is a typical paraffinic gas oil). */
  crackability: number
}

export const FCC_LIMITS = {
  feed: { min: 15, max: 45, design: 30 },
  preheat: { min: 180, max: 370 },
  rot: { min: 490, max: 560 },
  activity: { min: 60, max: 76 },
  cooler: { min: 0, max: 40 },
  /** Regenerator metal and catalyst limit, °C. */
  regenMax: 750,
  /** Catalyst to oil ratio the slide valve can't go beyond. */
  catOilMax: 10,
  catOilMin: 3.5,
  /** Air blower capacity, tonnes an hour. */
  airMax: 165,
  /** Wet gas compressor capacity: dry gas plus LPG, tonnes an hour. */
  gasMax: 50,
}

export const FCC_START: FccInputs = { feed: 30, preheat: 230, rot: 525, activity: 70, cooler: 0 }
export const DEFAULT_FEED: FccFeed = { carbon: 0.45, metals: 0.8, crackability: 1 }

/** Specific heats, kJ/kg·K: hot oil vapour and catalyst. */
const CP_OIL = 2.7
const CP_CAT = 1.15
/** Heat to vaporise the feed, kJ/kg. */
const LATENT = 250
/** Heat absorbed by cracking, kJ per kg of feed per unit of conversion. */
const HEAT_OF_CRACKING = 450
/** Steam, losses and the stripper, kJ/kg feed. */
const REACTOR_LOSSES = 40
/** Coke burned completely to CO₂ and water releases this much heat, kJ/kg (about 92% carbon, 8% hydrogen). */
const COKE_HEAT = 39_800
/** Air needed per kg of coke burned, with 2% excess oxygen in the flue gas, kg. */
const AIR_PER_COKE = 14
const CP_AIR = 1.1
/** Air arrives from the blower at about this temperature, °C. */
const AIR_IN = 200
/** Share of the regenerator's heat lost through its walls. */
const REGEN_LOSS = 0.03
/** Cracking activation energy over the gas constant, K: +10 °C adds about 1.7 points of conversion. */
const EA_OVER_R = 6000
/** Gas oil density, kg/m³. */
const FEED_DENSITY = 910

export interface FccYields {
  /** Weight % of feed. */
  dryGas: number
  lpg: number
  gasoline: number
  lco: number
  slurry: number
  coke: number
}

export interface FccResult {
  /** Conversion to gasoline and lighter (plus coke), wt%. */
  conversion: number
  catOil: number
  regenTemp: number
  /** Catalyst circulation, tonnes a minute. */
  circulation: number
  yields: FccYields
  /** Research octane of the gasoline. */
  octane: number
  /** Air to the regenerator, and dry gas plus LPG to the gas compressor, tonnes an hour. */
  air: number
  gas: number
  /** Where the regenerator's heat goes, kJ per kg of feed. */
  heat: {
    coke: number
    feedHeating: number
    vaporising: number
    cracking: number
    air: number
    cooler: number
    losses: number
    /** Heat the coke makes beyond what the riser can use (positive), or short of it (negative), when the slide valve is at a limit. */
    unbalanced: number
  }
  economics: { productValue: number; feedCost: number; margin: number }
  warnings: string[]
  /** The heat balance couldn't close inside the slide valve's range. */
  limited: 'catOilMax' | 'catOilMin' | null
}

/** Feed mass flow, kg/s. */
export function feedMass(kbpd: number) {
  return ((kbpd * 1000 * 0.158987) / 86400) * FEED_DENSITY
}

/** Conversion (0–1) from the catalyst to oil ratio, by second-order cracking kinetics. */
export function conversionAt(catOil: number, inputs: FccInputs, feed: FccFeed) {
  // Nickel deposits make hydrogen and coke and vanadium destroys zeolite: activity falls with metals.
  const activity = (inputs.activity / 70) * Math.max(0.5, 1 - 0.008 * feed.metals)
  const k =
    0.936 * catOil ** 0.65 * Math.exp(-EA_OVER_R * (1 / (inputs.rot + 273.15) - 1 / 798.15)) * activity * feed.crackability * (1 - 0.06 * feed.carbon)
  return k / (1 + k)
}

/** Coke, wt% of feed: catalytic coke, coke from the feed's carbon residue, and oil the stripper misses. */
function cokeYield(conversion: number, catOil: number, feed: FccFeed) {
  const k = conversion / (1 - conversion)
  return 1.4 * k + 0.9 * feed.carbon + 0.03 * catOil + 0.08 * feed.metals
}

function yieldsAt(conversion: number, catOil: number, inputs: FccInputs, feed: FccFeed): FccYields {
  const x = conversion * 100
  const coke = cokeYield(conversion, catOil, feed)
  const hotter = inputs.rot - 520
  // Thermal cracking and nickel make dry gas; LPG climbs faster than conversion as the petrol overcracks.
  const dryGas = 1.2 + 0.04 * (x - 60) + 0.05 * hotter + 0.15 * feed.metals
  const lpg = 15 + 0.45 * (x - 75) + 0.025 * Math.max(0, x - 75) ** 2 + 0.06 * hotter
  const gasoline = x - dryGas - lpg - coke
  const unconverted = 100 - x
  return { dryGas, lpg, gasoline, lco: unconverted * 0.68, slurry: unconverted * 0.32, coke }
}

export const FCC_PRODUCTS: { id: keyof FccYields; name: string; colour: string; goesTo: string }[] = [
  { id: 'dryGas', name: 'Dry gas', colour: '#b9c7d6', goesTo: 'fuel gas for the refinery’s furnaces' },
  { id: 'lpg', name: 'LPG', colour: '#9fd0e0', goesTo: 'gas plant: propylene and butylenes go on to alkylation' },
  { id: 'gasoline', name: 'Cat gasoline', colour: '#e8d27a', goesTo: 'petrol blending, after its sulphur is taken out' },
  { id: 'lco', name: 'Light cycle oil', colour: '#d9733c', goesTo: 'diesel hydrotreater, or heating oil' },
  { id: 'slurry', name: 'Slurry oil', colour: '#5a3e30', goesTo: 'fuel oil or carbon black feed' },
  { id: 'coke', name: 'Coke', colour: '#2a2a2a', goesTo: 'burned in the regenerator: the unit’s own fuel' },
]

/** Illustrative values, US dollars a tonne. */
export const FCC_PRICES = { feed: 560, dryGas: 300, lpg: 520, gasoline: 820, lco: 600, slurry: 350 }

/** Solves the heat balance and returns everything the unit does at these settings. */
export function runFcc(inputs: FccInputs, feed: FccFeed = DEFAULT_FEED): FccResult {
  const mass = feedMass(inputs.feed)
  const coolerPerKg = (inputs.cooler * 1000) / mass

  const evaluate = (catOil: number) => {
    const conversion = conversionAt(catOil, inputs, feed)
    const coke = cokeYield(conversion, catOil, feed) / 100
    const feedHeating = CP_OIL * (inputs.rot - inputs.preheat)
    const cracking = HEAT_OF_CRACKING * conversion
    const demand = feedHeating + LATENT + cracking + REACTOR_LOSSES
    const regenTemp = inputs.rot + demand / (catOil * CP_CAT)
    const airHeat = coke * AIR_PER_COKE * CP_AIR * (regenTemp - AIR_IN)
    const burn = coke * COKE_HEAT
    const losses = burn * REGEN_LOSS
    // Positive when the coke supplies more heat than the riser needs.
    const surplus = burn - airHeat - losses - coolerPerKg - demand
    const heat = { coke: burn, feedHeating, vaporising: LATENT, cracking, air: airHeat, cooler: coolerPerKg, losses: losses + REACTOR_LOSSES, unbalanced: surplus }
    return { conversion, coke, regenTemp, surplus, heat }
  }

  // More catalyst means more conversion and more coke, so the surplus rises with the ratio: bisect for zero.
  let lo = FCC_LIMITS.catOilMin
  let hi = FCC_LIMITS.catOilMax
  let limited: FccResult['limited'] = null
  if (evaluate(lo).surplus > 0) {
    hi = lo
    limited = 'catOilMin'
  } else if (evaluate(hi).surplus < 0) {
    lo = hi
    limited = 'catOilMax'
  } else {
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2
      if (evaluate(mid).surplus < 0) lo = mid
      else hi = mid
    }
  }
  const catOil = (lo + hi) / 2
  const state = evaluate(catOil)
  const yields = yieldsAt(state.conversion, catOil, inputs, feed)
  const tonnesPerHour = (mass * 3600) / 1000
  const air = (yields.coke / 100) * tonnesPerHour * AIR_PER_COKE
  const gas = ((yields.dryGas + yields.lpg) / 100) * tonnesPerHour
  const octane = 89.5 + 0.1 * (inputs.rot - 520) + 0.08 * (state.conversion * 100 - 75)

  const tonnesPerDay = tonnesPerHour * 24
  const value = (share: number, price: number) => (share / 100) * tonnesPerDay * price
  const productValue =
    value(yields.dryGas, FCC_PRICES.dryGas) +
    value(yields.lpg, FCC_PRICES.lpg) +
    value(yields.gasoline, FCC_PRICES.gasoline) +
    value(yields.lco, FCC_PRICES.lco) +
    value(yields.slurry, FCC_PRICES.slurry)
  const feedCost = tonnesPerDay * FCC_PRICES.feed

  const warnings: string[] = []
  if (state.regenTemp > FCC_LIMITS.regenMax)
    warnings.push(
      `The regenerator is at ${state.regenTemp.toFixed(0)} °C, above its ${FCC_LIMITS.regenMax} °C limit: the zeolite loses activity fast and the internals are at risk. Lower the feed preheat to make the unit circulate more catalyst, or use the catalyst cooler.`,
    )
  if (limited === 'catOilMax')
    warnings.push('The slide valve is wide open and still can’t carry enough heat: the riser outlet will fall below its setpoint.')
  if (limited === 'catOilMin')
    warnings.push(
      'The coke makes more heat than the riser can use, even with the slide valve nearly shut: the regenerator and riser will run away hot. Clean up the feed, cool it, or put the catalyst cooler on.',
    )
  if (air > FCC_LIMITS.airMax)
    warnings.push(`The air blower is at its limit (${FCC_LIMITS.airMax} t/h): not all the coke can be burned, so carbon builds up on the catalyst.`)
  if (gas > FCC_LIMITS.gasMax)
    warnings.push(`The wet gas compressor is at its limit (${FCC_LIMITS.gasMax} t/h of gas and LPG): the reactor pressure will rise.`)
  if (yields.gasoline < yieldsAt(Math.max(0, state.conversion - 0.02), catOil, inputs, feed).gasoline)
    warnings.push('Overcracking: pushing conversion higher now turns petrol into LPG and gas.')

  return {
    conversion: state.conversion * 100,
    catOil,
    regenTemp: state.regenTemp,
    circulation: (catOil * mass * 60) / 1000,
    yields,
    octane,
    air,
    gas,
    heat: state.heat,
    economics: { productValue, feedCost, margin: productValue - feedCost },
    warnings,
    limited,
  }
}
