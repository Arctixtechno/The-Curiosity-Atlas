import type { CrudeId } from './crudes.ts'

// The bottom of the barrel: a delayed coker that turns vacuum residue into
// lighter oils and solid coke, a hydrocracker that breaks gas oil into jet
// and diesel with a great deal of hydrogen, and a steam methane reformer
// that makes that hydrogen from natural gas.
//
// Coker yields follow Gary and Handwerk's correlations on the feed's
// Conradson carbon; the hydrocracker is first-order cracking with an
// Arrhenius rate and a selectivity that falls as it's pushed harder; the
// hydrogen plant solves the reforming and shift equilibria. Typical, not a
// design tool.

/* ---------------- Vacuum residue ---------------- */

/** Vacuum residue at a 550 °C cut: Conradson carbon (wt%), sulphur (wt%), nickel plus vanadium (ppm). */
export const RESIDUE: Record<CrudeId, { ccr: number; sulphur: number; metals: number }> = {
  brent: { ccr: 14, sulphur: 1.2, metals: 60 },
  wti: { ccr: 12, sulphur: 0.9, metals: 45 },
  arabLight: { ccr: 19, sulphur: 4, metals: 110 },
  maya: { ccr: 26, sulphur: 5, metals: 700 },
}

/** The residue the vacuum unit leaves gets heavier the deeper it cuts. */
export function residueQuality(crude: CrudeId, cutPoint: number) {
  const r = RESIDUE[crude]
  const f = Math.max(0.6, 1 + (0.7 * (cutPoint - 550)) / 100)
  return { ccr: Math.min(40, r.ccr * f), sulphur: r.sulphur * Math.min(1.4, 0.8 + 0.2 * f), metals: r.metals * f }
}

/** Vacuum residue density, kg/m³. */
export const RESIDUE_DENSITY = 1010

/* ---------------- Delayed coker ---------------- */

export interface CokerInputs {
  running: boolean
  /** Heater outlet temperature, °C. */
  heater: number
  /** Coke drum pressure, bar gauge. */
  pressure: number
  /** Recycle ratio: heavy gas oil sent back with the fresh feed. */
  recycle: number
  /** Hours each drum fills before the switch. */
  cycle: number
}

export const COKER_LIMITS = {
  heater: { min: 470, max: 515 },
  pressure: { min: 1, max: 4.5 },
  recycle: { min: 0.03, max: 0.4 },
  cycle: { min: 12, max: 24 },
  /** Hours the idle drum needs to steam, quench, cut and warm up again. */
  decoke: 14,
  /** Drum volume usable before foam reaches the top, m³, and coke's bulk density in the drum, t/m³. */
  drumVolume: 1000,
  cokeDensity: 0.9,
  /** Fresh feed the heater and fractionator are sized for, kb/d. */
  capacity: 25,
}

export const COKER_START: CokerInputs = { running: false, heater: 495, pressure: 1.8, recycle: 0.1, cycle: 18 }

export interface CokerResult {
  feed: number
  ccr: number
  /** Yields on fresh feed, wt%. */
  yields: { gas: number; lpg: number; naphtha: number; gasOil: number; coke: number }
  /** Products, kb/d (coke in t/d). */
  rates: { naphtha: number; gasOil: number; lpg: number; coke: number; gas: number }
  /** Volatile matter left in the coke, wt%: too high is soft "green" coke, too low means the heater is coking. */
  vcm: number
  /** Coke grade, from sulphur and metals. */
  grade: 'anode' | 'fuel'
  cokeSulphur: number
  /** How full each drum gets before the switch, share of usable height. */
  fill: number
  heaterDuty: number
  warnings: string[]
}

export function runCoker(feed: number, crude: CrudeId, cutPoint: number, inputs: CokerInputs): CokerResult {
  const q = residueQuality(crude, cutPoint)
  const ccr = q.ccr
  // Gary and Handwerk, at about 1 bar gauge and the design heater outlet.
  let coke = 1.6 * ccr
  let gas = 7.8 + 0.144 * ccr
  let naphtha = 11.29 + 0.343 * ccr
  // Pressure and recycle hold heavy molecules in the drum longer: more coke and gas, less gas oil.
  const dp = inputs.pressure - 1
  const dr = inputs.recycle - 0.05
  coke *= 1 + 0.06 * dp + 0.5 * dr
  gas *= 1 + 0.05 * dp + 0.3 * dr
  naphtha *= 1 + 0.02 * dp
  // A hotter heater drives more volatile matter out of the coke and into the liquids.
  const dt = inputs.heater - 495
  coke *= 1 - 0.006 * dt
  const gasOil = Math.max(0, 100 - coke - gas - naphtha)
  const lpg = gas * 0.4
  const yields = { gas: gas - lpg, lpg, naphtha, gasOil, coke }

  const tonnes = (feed * 158.987 * RESIDUE_DENSITY) / 1000
  const rates = {
    naphtha: ((naphtha / 100) * tonnes) / (0.158987 * 750),
    gasOil: ((gasOil / 100) * tonnes) / (0.158987 * 930),
    lpg: ((lpg / 100) * tonnes) / (0.158987 * 560),
    coke: (coke / 100) * tonnes,
    gas: ((gas - lpg) / 100) * tonnes,
  }
  const vcm = Math.max(4, 11 - 0.25 * dt + 0.8 * dp)
  const cokeSulphur = q.sulphur * 1.25
  const grade = cokeSulphur < 3 && q.metals * 3 < 400 ? 'anode' : 'fuel'
  const fill = (rates.coke / 24) * inputs.cycle / COKER_LIMITS.cokeDensity / COKER_LIMITS.drumVolume
  // Heat the feed to the heater outlet from about 300 °C, with a little cracking in the tubes: about 0.9 GJ a tonne.
  const heaterDuty = (tonnes * (1 + inputs.recycle) * 0.9 * (1 + 0.004 * dt)) / 86.4

  const warnings: string[] = []
  if (inputs.running) {
    if (feed > COKER_LIMITS.capacity) warnings.push(`The coker is taking ${feed.toFixed(1)} kb/d against a design of ${COKER_LIMITS.capacity}: the heater and fractionator are overloaded.`)
    if (fill > 1) warnings.push('The drums will foam over before the switch: shorten the cycle, cut the feed, or add antifoam. Foam carried over fouls the fractionator.')
    else if (fill > 0.9) warnings.push('The drums are filling close to the top: little room left for foam.')
    if (inputs.cycle < COKER_LIMITS.decoke) warnings.push(`A ${inputs.cycle} hour cycle doesn't give the crew the ${COKER_LIMITS.decoke} hours they need to decoke the other drum.`)
    if (vcm > 12) warnings.push('Volatile matter in the coke is high: soft, tarry coke that is hard to cut and sells badly. Run the heater hotter.')
    if (inputs.heater > 505) warnings.push('The heater is very hot: coke is laying down inside its tubes, which will have to be spalled or pigged.')
  }
  return { feed, ccr, yields, rates, vcm, grade, cokeSulphur, fill, heaterDuty, warnings }
}

/**
 * Where each drum is in its cycle at `hours` of plant time: one fills while the other is steamed, quenched, cut and
 * warmed. Returns the filling drum, how far through its fill it is, and what the other drum is doing.
 */
export function drumCycle(hours: number, cycle: number) {
  const phase = hours / cycle
  const filling = Math.floor(phase) % 2 === 0 ? 'A' : 'B'
  const through = phase - Math.floor(phase)
  const idleSteps: [number, string][] = [
    [0.15, 'steaming out'],
    [0.35, 'water quench'],
    [0.45, 'draining'],
    [0.75, 'cutting the coke out with water jets'],
    [0.9, 'heading up and testing'],
    [1, 'warming with vapour from the full drum'],
  ]
  const idle = idleSteps.find(([end]) => through < end)?.[1] ?? 'ready'
  return { filling, through, idle } as const
}

/* ---------------- Hydrocracker ---------------- */

export interface HydrocrackerInputs {
  running: boolean
  /** Fresh vacuum gas oil taken, kb/d. Coker gas oil joins it when the coker runs. */
  feed: number
  /** Cracking reactor temperature, °C. */
  temp: number
  /** Reactor pressure, bar. */
  pressure: number
  /** Send the unconverted oil round again (to extinction) or bleed it to the cat cracker. */
  recycle: boolean
  /** Fractionator cut: as much diesel as it can, or more naphtha. */
  mode: 'diesel' | 'naphtha'
}

export const HC_LIMITS = {
  feed: { min: 0, max: 30 },
  temp: { min: 360, max: 425 },
  pressure: { min: 100, max: 180 },
  /** Total reactor charge the unit is built for, kb/d. */
  capacity: 32,
  /** End-of-run catalyst temperature, °C. */
  endOfRun: 415,
}

export const HC_START: HydrocrackerInputs = { running: false, feed: 0, temp: 390, pressure: 150, recycle: false, mode: 'diesel' }

export interface HydrocrackerResult {
  freshFeed: number
  /** Conversion per pass through the reactors, and overall, %. */
  perPass: number
  conversion: number
  /** Total charge including recycle, kb/d. */
  charge: number
  /** Products on fresh feed, kb/d. */
  rates: { lpg: number; naphtha: number; jet: number; diesel: number; unconverted: number }
  /** Hydrogen used, wt% of fresh feed and t/d. */
  hydrogenPct: number
  hydrogen: number
  dieselCetane: number
  /** Sulphur removed as H₂S, t/d. */
  sulphurRemoved: number
  heaterDuty: number
  warnings: string[]
}

export function runHydrocracker(vgo: number, cokerGasOil: number, sulphurPpm: number, inputs: HydrocrackerInputs): HydrocrackerResult {
  const freshFeed = vgo + cokerGasOil
  const cokerShare = freshFeed > 0 ? cokerGasOil / freshFeed : 0
  const kelvin = inputs.temp + 273.15
  // First-order cracking, E/R about 18 000 K; pressure helps, and coker gas oil's nitrogen holds the catalyst back.
  const k = 0.85 * Math.exp(-18000 * (1 / kelvin - 1 / 663.15)) * (inputs.pressure / 150) ** 0.5 * (1 - 0.35 * cokerShare)
  // With recycle the reactors see the fresh feed plus the unconverted oil, so space velocity is higher.
  const recycleRatio = inputs.recycle ? 0.6 : 0
  const lhsvFactor = freshFeed > 0 ? Math.max(0.6, (freshFeed * (1 + recycleRatio)) / 25) : 1
  const perPass = 1 - Math.exp(-k / lhsvFactor)
  const conversion = inputs.recycle ? Math.min(0.98, perPass / (perPass + (1 - perPass) * 0.06)) : perPass
  // Selectivity to middle distillates falls as each pass is pushed harder, and with temperature.
  const middle = Math.max(0.45, 0.82 - 0.35 * perPass - 0.004 * (inputs.temp - 390)) * (inputs.mode === 'naphtha' ? 0.72 : 1)
  const lpgShare = 0.04 + 0.05 * perPass
  const naphthaShare = 1 - middle - lpgShare
  const converted = freshFeed * conversion * 1.12 // volume swell: hydrogen added, lighter products
  const jetShare = inputs.mode === 'diesel' ? 0.38 : 0.45
  const rates = {
    lpg: converted * lpgShare * 1.35,
    naphtha: converted * naphthaShare,
    jet: converted * middle * jetShare,
    diesel: converted * middle * (1 - jetShare),
    unconverted: freshFeed * (1 - conversion),
  }
  // Hydrogen: saturating aromatics and breaking chains, about 2–3 wt% of feed.
  const hydrogenPct = (1.4 + 1.6 * conversion + 0.6 * cokerShare) * (inputs.pressure / 150) ** 0.3
  const feedTonnes = (freshFeed * 158.987 * 920) / 1000
  const hydrogen = (feedTonnes * hydrogenPct) / 100
  const sulphurRemoved = (feedTonnes * sulphurPpm * 0.995) / 1e6
  const heaterDuty = freshFeed > 0 ? (feedTonnes * (1 + recycleRatio) * 0.35) / 86.4 : 0
  const charge = freshFeed * (1 + recycleRatio)
  const warnings: string[] = []
  if (inputs.running && freshFeed > 0) {
    if (charge > HC_LIMITS.capacity) warnings.push(`The reactors are charged with ${charge.toFixed(1)} kb/d, over the ${HC_LIMITS.capacity} they are built for: cut the feed or stop recycling.`)
    if (inputs.temp > HC_LIMITS.endOfRun) warnings.push('The reactors are past their end-of-run temperature: cracking runs away above this. A hydrocracker can heat up fast; watch the bed temperatures.')
    if (inputs.pressure < 120 && cokerShare > 0.2) warnings.push('Coker gas oil at low pressure: its nitrogen and aromatics are cutting the catalyst’s activity.')
  }
  return {
    freshFeed,
    perPass: perPass * 100,
    conversion: conversion * 100,
    charge,
    rates,
    hydrogenPct,
    hydrogen,
    dieselCetane: 57 - 6 * cokerShare + 2 * ((inputs.pressure - 150) / 30),
    sulphurRemoved,
    heaterDuty,
    warnings,
  }
}

/* ---------------- Steam methane reformer ---------------- */

export interface SmrInputs {
  running: boolean
  /** Reformer tube outlet temperature, °C. */
  outlet: number
  /** Steam to carbon ratio, mol/mol. */
  steamCarbon: number
}

export const SMR_LIMITS = {
  outlet: { min: 780, max: 920 },
  steamCarbon: { min: 2.2, max: 4.5 },
  /** Hydrogen the plant can make, t/d. */
  capacity: 120,
  /** Reformer pressure, bar. */
  pressure: 25,
  /** Tubes creep and fail above this outlet temperature over their design life. */
  tubeLimit: 900,
  /** Below this steam ratio carbon lays down on the nickel catalyst. */
  carbonLimit: 2.5,
  /** Share of hydrogen the pressure swing adsorption unit recovers. */
  psa: 0.89,
}

export const SMR_START: SmrInputs = { running: false, outlet: 860, steamCarbon: 3 }

/** Equilibrium constants for CH₄ + H₂O ⇌ CO + 3H₂ (bar²) and CO + H₂O ⇌ CO₂ + H₂, from standard fits. */
export const kReforming = (kelvin: number) => Math.exp(-26830 / kelvin + 30.114)
export const kShift = (kelvin: number) => Math.exp(4400 / kelvin - 4.036)

/** Reforming and shift equilibrium at the tube outlet, per mole of methane fed. */
export function reformerEquilibrium(outlet: number, steamCarbon: number, pressure = SMR_LIMITS.pressure) {
  const T = outlet + 273.15
  const k1 = kReforming(T)
  const k2 = kShift(T)
  // Nested bisection: for each methane conversion x, the shift extent y that satisfies K2; then x to satisfy K1.
  const shiftFor = (x: number) => {
    let lo = 0
    let hi = Math.min(x, steamCarbon - x)
    for (let i = 0; i < 60; i++) {
      const y = (lo + hi) / 2
      const q = ((y * (3 * x + y)) / ((x - y) * (steamCarbon - x - y))) - k2
      if (q > 0) hi = y
      else lo = y
    }
    return (lo + hi) / 2
  }
  let lo = 0
  let hi = Math.min(1, steamCarbon) - 1e-9
  for (let i = 0; i < 60; i++) {
    const x = (lo + hi) / 2
    const y = shiftFor(x)
    const total = 1 + steamCarbon + 2 * x
    const q = (((x - y) * (3 * x + y) ** 3) / ((1 - x) * (steamCarbon - x - y))) * (pressure / total) ** 2 - k1
    if (q > 0) hi = x
    else lo = x
  }
  const x = (lo + hi) / 2
  const y = shiftFor(x)
  const total = 1 + steamCarbon + 2 * x
  return { conversion: x, shift: y, slip: ((1 - x) / (total - (steamCarbon - x - y))) * 100, co: x - y, h2: 3 * x + y }
}

export interface SmrResult {
  /** Hydrogen made, t/d. */
  hydrogen: number
  /** Methane converted in the tubes, %, and left in the dry gas, mol%. */
  conversion: number
  slip: number
  /** Natural gas used as feed and fuel, GJ/d, and per kg of hydrogen, MJ. */
  gas: number
  gasPerKg: number
  /** CO₂ released, t/d. */
  co2: number
  steam: number
  warnings: string[]
}

/** Runs the hydrogen plant to make `demand` t/d, up to its capacity. */
export function runSmr(demand: number, inputs: SmrInputs): SmrResult {
  const eq = reformerEquilibrium(inputs.outlet, inputs.steamCarbon)
  // A high-temperature shift reactor at about 350 °C turns most of the remaining CO into hydrogen.
  const htsK = kShift(623)
  const coLeft = eq.co / (1 + htsK * 0.06)
  const h2PerCh4 = (eq.h2 + (eq.co - coLeft)) * SMR_LIMITS.psa
  const hydrogen = inputs.running ? Math.min(SMR_LIMITS.capacity, Math.max(0, demand)) : 0
  const ch4Feed = hydrogen > 0 ? (hydrogen * 1000) / 2.016 / h2PerCh4 : 0 // kmol/d
  // Heat for the endothermic reforming and the steam, less what the PSA tail gas gives back when burned.
  const reformHeat = ch4Feed * (206 * eq.conversion - 41 * eq.shift) // MJ/d (kJ/mol = MJ/kmol)
  const steamHeat = ch4Feed * inputs.steamCarbon * 45
  const tailGas = ch4Feed * ((1 - eq.conversion) * 802 + coLeft * 283) + (ch4Feed * eq.h2 * (1 - SMR_LIMITS.psa)) * 242
  const fuel = Math.max(0.15 * (reformHeat + steamHeat), (reformHeat + steamHeat) / 0.85 - tailGas)
  const gas = (ch4Feed * 802 + fuel) / 1000 // GJ/d
  const co2 = ((ch4Feed + fuel / 802) * 44) / 1000
  const warnings: string[] = []
  if (inputs.running) {
    if (demand > SMR_LIMITS.capacity) warnings.push(`The refinery needs ${demand.toFixed(0)} t/d of hydrogen, more than the plant's ${SMR_LIMITS.capacity}: the rest is bought over the fence.`)
    if (inputs.outlet > SMR_LIMITS.tubeLimit) warnings.push('The reformer tubes are running hot: they creep, and a tube that fails starts a fire in the box.')
    if (inputs.steamCarbon < SMR_LIMITS.carbonLimit) warnings.push('Too little steam: carbon is laying down on the nickel catalyst, which blocks tubes and makes hot bands.')
  }
  return {
    hydrogen,
    conversion: eq.conversion * 100,
    slip: eq.slip,
    gas,
    gasPerKg: hydrogen > 0 ? (gas * 1000) / (hydrogen * 1000) : 0,
    co2,
    steam: (ch4Feed * inputs.steamCarbon * 18) / 1000,
    warnings,
  }
}
