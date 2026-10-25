// Archimedes' principle for the laboratory's tank: a block feels an upward
// force equal to the weight of the liquid it pushes aside. Densities are
// typical textbook values near 20 °C; real samples vary a little.

export const GRAVITY = 9.81

export interface Substance {
  id: string
  name: string
  /** kg/m³ */
  density: number
  colour: string
}

export const LIQUIDS: Substance[] = [
  { id: 'water', name: 'Fresh water', density: 998, colour: '#5f9fc4' },
  { id: 'sea', name: 'Sea water', density: 1025, colour: '#3f8aa0' },
  { id: 'oil', name: 'Olive oil', density: 911, colour: '#c8b24a' },
  { id: 'glycerol', name: 'Glycerol', density: 1261, colour: '#d8e2e6' },
  { id: 'mercury', name: 'Mercury', density: 13534, colour: '#b8bcc4' },
]

export const BLOCKS: Substance[] = [
  { id: 'cork', name: 'Cork', density: 240, colour: '#b98d5c' },
  { id: 'pine', name: 'Pine', density: 500, colour: '#d9b27a' },
  { id: 'ice', name: 'Ice', density: 917, colour: '#e6f4fb' },
  { id: 'wax', name: 'Paraffin wax', density: 900, colour: '#f1e6c8' },
  { id: 'aluminium', name: 'Aluminium', density: 2700, colour: '#c9ced4' },
  { id: 'steel', name: 'Steel', density: 7850, colour: '#7c8590' },
  { id: 'gold', name: 'Gold', density: 19300, colour: '#e2b84a' },
]

/** The blocks on the bench are 10 cm cubes: one litre each. */
export const BLOCK_SIDE = 0.1

export interface Outcome {
  floats: boolean
  /** Share of the block below the surface once it settles (1 when it sinks). */
  submerged: number
  /** Forces at rest, in newtons. */
  weight: number
  buoyancy: number
  /** What a spring balance would read holding the block fully under the surface. */
  apparentWeight: number
}

/** Where a block of `block` settles in `liquid`, and the forces on it. */
export function settle(block: Substance, liquid: Substance, side = BLOCK_SIDE): Outcome {
  const volume = side ** 3
  const weight = block.density * volume * GRAVITY
  const floats = block.density < liquid.density
  const submerged = floats ? block.density / liquid.density : 1
  const buoyancy = liquid.density * volume * submerged * GRAVITY
  return { floats, submerged, weight, buoyancy, apparentWeight: (block.density - liquid.density) * volume * GRAVITY }
}

/**
 * Net upward acceleration of the block when its bottom is `depth` metres
 * below the surface and it moves at `velocity` m/s (up is positive), for the
 * animation. Water drag is modelled simply, as a damping term.
 */
export function acceleration(block: Substance, liquid: Substance, depth: number, velocity: number, side = BLOCK_SIDE) {
  const mass = block.density * side ** 3
  const underwater = Math.min(side, Math.max(0, depth)) / side
  const buoyancy = liquid.density * side ** 3 * underwater * GRAVITY
  const drag = -velocity * underwater * 6 * Math.sqrt(liquid.density * side ** 3)
  return (buoyancy + drag) / mass - GRAVITY
}
