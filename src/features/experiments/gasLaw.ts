// The ideal gas law, pV = nRT, for the laboratory's piston experiment. Real
// gases stray from it at high pressure or close to condensing, but for air
// near room conditions it is accurate to well under one per cent.

/** Molar gas constant, J/(mol·K). */
export const GAS_CONSTANT = 8.314462618
/** Molar mass of nitrogen (N₂), most of air, in kg/mol. */
export const NITROGEN_MOLAR_MASS = 0.0280134
/** Standard atmospheric pressure, in kPa. */
export const ATMOSPHERE_KPA = 101.325

export interface GasState {
  /** Amount of gas, in moles. */
  moles: number
  /** Temperature, in kelvin. */
  kelvin: number
  /** Volume, in litres. */
  litres: number
}

/** The limits of the apparatus on the bench. */
export const GAS_LIMITS = {
  moles: { min: 0.02, max: 0.2 },
  kelvin: { min: 200, max: 600 },
  litres: { min: 0.5, max: 5 },
}

/** About one atmosphere at room temperature. */
export const GAS_START: GasState = { moles: 0.1, kelvin: 293.15, litres: 2.4 }

/** Pressure in kPa from pV = nRT. */
export function pressureKPa({ moles, kelvin, litres }: GasState) {
  return (moles * GAS_CONSTANT * kelvin) / (litres / 1000) / 1000
}

/** Root-mean-square speed of the molecules, in m/s: √(3RT / M). */
export function rmsSpeed(kelvin: number, molarMass = NITROGEN_MOLAR_MASS) {
  return Math.sqrt((3 * GAS_CONSTANT * kelvin) / molarMass)
}

export const celsius = (kelvin: number) => kelvin - 273.15
