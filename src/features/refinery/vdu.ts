import { CRUDES, percentBelow, type CrudeId } from './crudes.ts'

// The vacuum distillation unit: the atmospheric residue is heated again and
// flashed at a fraction of atmospheric pressure, so heavy gas oils boil off
// without being hot enough to crack. Everything rests on one relationship:
// how much lower a liquid boils when the pressure over it drops.
//
// That comes from the Clausius–Clapeyron equation with the entropy of
// vaporisation held constant (Trouton's rule, about 88 J/mol·K for ordinary
// liquids; nearer 100 for heavy oils, so ΔS/R ≈ 12):
//   ln(P / 760 mmHg) = 12 × (1 − Tb / T)
// so oil that boils at T under pressure P would boil at
//   Tb = T × (1 − ln(P / 760) / 12)
// at atmospheric pressure: its atmospheric equivalent temperature (AET).
// Refiners use charts built on the same idea (Maxwell and Bonnell's).

export interface VduInputs {
  /** Furnace outlet temperature, °C. */
  cot: number
  /** Flash zone pressure, mmHg absolute. Atmospheric is 760. */
  pressure: number
  /** Steam in the furnace coils and column bottom lowers the oil's partial pressure further. */
  steam: boolean
}

export const VDU_LIMITS = {
  cot: { min: 360, max: 430, design: 395, coking: 415 },
  pressure: { min: 15, max: 120, design: 40 },
}

export const VDU_START: VduInputs = { cot: 395, pressure: 40, steam: false }

/** Entropy of vaporisation over the gas constant, ΔHvap / (R·Tb), for heavy gas oils: about 100 / 8.314. */
const TROUTON = 12
/** Steam carries this share of the vapour in a wet unit, so the oil's partial pressure falls by the rest. */
const STEAM_SHARE = 0.3
/** The vapour lifted is a little lighter than the flash zone equilibrium: wash oil and overflash, °C. */
const WASH = 10

/** Normal boiling point (°C) of oil that boils at `temp` °C under `mmHg`. */
export function atmosphericEquivalent(temp: number, mmHg: number) {
  const kelvin = temp + 273.15
  return kelvin * (1 - Math.log(mmHg / 760) / TROUTON) - 273.15
}

/** How each crude's heavy end behaves: Conradson carbon and nickel plus vanadium scale with these. */
const HEAVY_END: Record<CrudeId, { carbon: number; metals: number; crackability: number }> = {
  brent: { carbon: 1, metals: 1, crackability: 1 },
  wti: { carbon: 0.8, metals: 0.7, crackability: 1.05 },
  arabLight: { carbon: 1.6, metals: 2.5, crackability: 0.95 },
  maya: { carbon: 3, metals: 9, crackability: 0.85 },
}

export interface VduResult {
  /** The flash zone's atmospheric equivalent cut point between gas oil and residue, °C. */
  cutPoint: number
  /** Vacuum gas oil and vacuum residue, % of the crude. */
  vgo: number
  residue: number
  /** Thousand barrels a day, at the crude rate given. */
  vgoRate: number
  residueRate: number
  /** Conradson carbon residue of the gas oil, % by weight: what turns to coke when it's cracked. */
  carbon: number
  /** Nickel plus vanadium in the gas oil, ppm: catalyst poisons. */
  metals: number
  /** How readily the gas oil cracks (1 for Brent's). */
  crackability: number
  warnings: string[]
}

/** What the vacuum unit makes from the crude unit's residue, which starts boiling at `residueFrom` °C. */
export function runVdu(crude: CrudeId, crudeRate: number, residueFrom: number, inputs: VduInputs): VduResult {
  const partial = inputs.pressure * (inputs.steam ? 1 - STEAM_SHARE : 1)
  const cutPoint = atmosphericEquivalent(inputs.cot, partial) - WASH
  const start = percentBelow(CRUDES[crude], residueFrom)
  const vgo = Math.max(0, percentBelow(CRUDES[crude], cutPoint) - start)
  const residue = 100 - start - vgo
  const heavy = HEAVY_END[crude]
  // Carbon and metals sit in the heaviest molecules, so they climb steeply as the cut deepens.
  const depth = Math.max(0, (cutPoint - 500) / 150)
  const carbon = heavy.carbon * (0.15 + 3 * depth ** 2.5)
  const metals = heavy.metals * (0.3 + 8 * depth ** 3)
  const warnings: string[] = []
  if (inputs.cot >= VDU_LIMITS.cot.coking)
    warnings.push(`The vacuum furnace is above ${VDU_LIMITS.cot.coking} °C: residue is cracking and coking in the tubes and the wash zone.`)
  if (carbon > 1.5)
    warnings.push('The gas oil carries a lot of carbon residue: the cat cracker will make much more coke and run its regenerator hot.')
  if (metals > 5) warnings.push('Nickel and vanadium are high: they poison the cat cracker catalyst.')
  return {
    cutPoint,
    vgo,
    residue,
    vgoRate: (vgo / 100) * crudeRate,
    residueRate: (residue / 100) * crudeRate,
    carbon,
    metals,
    crackability: heavy.crackability,
    warnings,
  }
}
