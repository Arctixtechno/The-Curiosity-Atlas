// Direct-current circuits from Ohm's law (V = IR) and the rules for combining
// resistances. The cell is ideal (no internal resistance), and each bulb is
// treated as a fixed resistance, though a real filament's resistance rises as
// it heats up.

export type Arrangement = 'series' | 'parallel'

export interface Part {
  id: string
  name: string
  ohms: number
  bulb: boolean
}

export const PARTS: Part[] = [
  { id: 'bulb', name: 'Torch bulb (12 Ω)', ohms: 12, bulb: true },
  { id: 'r10', name: '10 Ω resistor', ohms: 10, bulb: false },
  { id: 'r47', name: '47 Ω resistor', ohms: 47, bulb: false },
  { id: 'r100', name: '100 Ω resistor', ohms: 100, bulb: false },
]

export const CELLS = [
  { volts: 1.5, name: 'One AA cell (1.5 V)' },
  { volts: 3, name: 'Two AA cells (3 V)' },
  { volts: 4.5, name: 'Three AA cells (4.5 V)' },
  { volts: 9, name: 'A 9 V battery' },
]

/** The power at which our torch bulb glows at full brightness: 3 V across 12 Ω. */
export const BULB_RATED_WATTS = (3 * 3) / 12

export function totalResistance(parts: Part[], arrangement: Arrangement) {
  if (parts.length === 0) return Infinity
  return arrangement === 'series' ? parts.reduce((sum, p) => sum + p.ohms, 0) : 1 / parts.reduce((sum, p) => sum + 1 / p.ohms, 0)
}

export interface PartReading {
  part: Part
  volts: number
  amps: number
  watts: number
}

export interface CircuitResult {
  ohms: number
  amps: number
  watts: number
  parts: PartReading[]
}

export function solve(volts: number, parts: Part[], arrangement: Arrangement): CircuitResult {
  const ohms = totalResistance(parts, arrangement)
  const amps = parts.length ? volts / ohms : 0
  const readings = parts.map((part) => {
    // In series every part carries the same current; in parallel every part has the full voltage across it.
    const a = arrangement === 'series' ? amps : volts / part.ohms
    const v = a * part.ohms
    return { part, volts: v, amps: a, watts: v * a }
  })
  return { ohms, amps, watts: volts * amps, parts: readings }
}

/** How brightly a bulb glows, from 0 (dark) to 1 (its rated power), more than that and it would burn out. */
export function brightness(watts: number) {
  return Math.min(1.5, watts / BULB_RATED_WATTS)
}
