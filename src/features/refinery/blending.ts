import { maximise } from './lp.ts'

// Blending: every refinery sells petrol and diesel made by mixing the streams
// its units make, so that the blend meets every spec at once for the least
// value given away. Each property blends by its own rule: octane and
// aromatics by volume, sulphur and oxygen by mass, and vapour pressure and
// cloud point through blending indices, because they don't add linearly.
// Written that way, every spec is a straight line in the volumes, which is
// what lets a planner's linear programme find the best recipe.
//
// Octane blending is treated as linear in volume, using blending octanes
// for ethanol (its behaviour in a blend is far better than its own octane
// test suggests). Real blends also show interaction bonuses between
// components; planners fit those to their own plant data.

export type PropertyId = 'ron' | 'mon' | 'rvp' | 'aromatics' | 'olefins' | 'benzene' | 'sulphur' | 'oxygen' | 'ethanol' | 'cetane' | 'density' | 'cloud' | 'fame'

export interface Component {
  id: string
  name: string
  /** What the units make, thousand barrels a day. */
  available: number
  /** Density, kg/m³. */
  density: number
  /** What it fetches if it isn't blended (or, for bought components, what it costs), dollars a barrel. */
  value: number
  /** Bought in rather than made: no limit but cost. */
  purchased?: boolean
  /** Share of what's made that goes to this pool before anyone changes the recipe (1 when absent). */
  start?: number
  colour: string
  props: Partial<Record<PropertyId, number>>
}

export interface Spec {
  prop: PropertyId
  name: string
  unit: string
  kind: 'min' | 'max'
  limit: number
  /** Why the spec exists, in a sentence. */
  why: string
}

export interface Grade {
  id: string
  name: string
  /** Price, dollars a barrel. */
  price: number
  specs: Spec[]
}

interface Rule {
  basis: 'volume' | 'mass'
  /** Blending index and its inverse; linear when absent. */
  index?: (v: number) => number
  inverse?: (i: number) => number
}

const RULES: Record<PropertyId, Rule> = {
  ron: { basis: 'volume' },
  mon: { basis: 'volume' },
  // Chevron's vapour pressure blending index.
  rvp: { basis: 'volume', index: (v) => Math.max(0, v) ** 1.25, inverse: (i) => Math.max(0, i) ** 0.8 },
  aromatics: { basis: 'volume' },
  olefins: { basis: 'volume' },
  benzene: { basis: 'volume' },
  sulphur: { basis: 'mass' },
  oxygen: { basis: 'mass' },
  ethanol: { basis: 'volume' },
  cetane: { basis: 'volume' },
  density: { basis: 'volume' },
  // A cloud point blending index: the waxiest component dominates.
  cloud: { basis: 'volume', index: (t) => Math.exp(0.08 * (t + 40)), inverse: (i) => Math.log(i) / 0.08 - 40 },
  fame: { basis: 'volume' },
}

const index = (prop: PropertyId, v: number) => RULES[prop].index?.(v) ?? v

/** The blend's properties for these volumes (kb/d per component). */
export function blendProperties(components: Component[], volumes: number[]): Partial<Record<PropertyId, number>> {
  const out: Partial<Record<PropertyId, number>> = {}
  const props = new Set(components.flatMap((c) => Object.keys(c.props) as PropertyId[]))
  for (const prop of props) {
    const rule = RULES[prop]
    let sum = 0
    let weight = 0
    components.forEach((c, i) => {
      const w = volumes[i] * (rule.basis === 'mass' ? c.density : 1)
      sum += w * index(prop, c.props[prop] ?? 0)
      weight += w
    })
    if (weight <= 0) continue
    const mean = sum / weight
    out[prop] = rule.inverse ? rule.inverse(mean) : mean
  }
  return out
}

export interface SpecCheck extends Spec {
  value: number
  ok: boolean
}

export function checkSpecs(grade: Grade, properties: Partial<Record<PropertyId, number>>): SpecCheck[] {
  return grade.specs.map((s) => {
    const value = properties[s.prop] ?? 0
    // A hair of tolerance, so an optimised blend that sits exactly on a limit reads as on spec.
    const ok = s.kind === 'min' ? value >= s.limit - 1e-6 : value <= s.limit + 1e-6
    return { ...s, value, ok }
  })
}

export interface BlendResult {
  volumes: number[]
  total: number
  properties: Partial<Record<PropertyId, number>>
  specs: SpecCheck[]
  onSpec: boolean
  /** Product value, components' alternative value given up, and the difference, dollars a day. */
  revenue: number
  componentValue: number
  margin: number
}

/** Value of the blend: on spec it sells as the grade; off spec it can only go as cheap export blendstock. */
export const OFF_SPEC_PRICE = 68

export function evaluateBlend(grade: Grade, components: Component[], volumes: number[]): BlendResult {
  const total = volumes.reduce((a, b) => a + b, 0)
  const properties = blendProperties(components, volumes)
  const specs = checkSpecs(grade, properties)
  const onSpec = total > 0 && specs.every((s) => s.ok)
  const revenue = total * 1000 * (onSpec ? grade.price : OFF_SPEC_PRICE)
  const componentValue = components.reduce((sum, c, i) => sum + volumes[i] * 1000 * c.value, 0)
  return { volumes, total, properties, specs, onSpec, revenue, componentValue, margin: revenue - componentValue }
}

/** Octane over spec on whichever test binds (research or motor): what the customer gets for nothing. */
export function octaneGiveaway(blend: BlendResult) {
  const over = blend.specs.filter((s) => s.prop === 'ron' || s.prop === 'mon').map((s) => s.value - s.limit)
  return over.length ? Math.min(...over) : 0
}

/**
 * The best recipe: the volumes that earn the most over what the components would fetch elsewhere, meeting
 * every spec, with no more of each than the units make. Bought components are capped at the pool's size.
 */
export function optimiseBlend(grade: Grade, components: Component[]): number[] {
  const n = components.length
  const c = components.map((comp) => grade.price - comp.value)
  const a: number[][] = []
  const b: number[] = []
  const made = components.reduce((sum, comp) => sum + (comp.purchased ? 0 : comp.available), 0)
  components.forEach((comp, i) => {
    const row = Array(n).fill(0)
    row[i] = 1
    a.push(row)
    b.push(comp.purchased ? made : comp.available)
  })
  for (const spec of grade.specs) {
    const rule = RULES[spec.prop]
    const limit = index(spec.prop, spec.limit)
    // Σ wᵢ (indexᵢ − limit) ≤ 0 for a maximum, ≥ 0 for a minimum; every index rises with its property.
    const sign = spec.kind === 'max' ? 1 : -1
    a.push(components.map((comp) => sign * (rule.basis === 'mass' ? comp.density : 1) * (index(spec.prop, comp.props[spec.prop] ?? 0) - limit)))
    b.push(0)
  }
  return maximise(c, a, b).x.map((v) => Math.max(0, v))
}

/* ---------------- Grades ---------------- */

export type Season = 'summer' | 'winter'

/** EN 228 petrol, E10: premium 95 or super 98, with the vapour pressure class for the season. */
export function petrolGrade(id: 'premium' | 'super', season: Season): Grade {
  const sup = id === 'super'
  const rvp = season === 'summer' ? { min: 45, max: 60 } : { min: 60, max: 90 }
  return {
    id,
    name: sup ? 'Super 98' : 'Premium 95',
    price: sup ? 112 : 105,
    specs: [
      { prop: 'ron', name: 'Research octane', unit: '', kind: 'min', limit: sup ? 98 : 95, why: 'Resistance to knock at low engine speeds: the number on the pump.' },
      { prop: 'mon', name: 'Motor octane', unit: '', kind: 'min', limit: sup ? 88 : 85, why: 'Knock resistance under load and heat. Olefins and aromatics fall further on this test.' },
      { prop: 'rvp', name: 'Vapour pressure', unit: 'kPa', kind: 'max', limit: rvp.max, why: 'Too high and fuel boils in the tank and lines (vapour lock) and evaporates into smog.' },
      { prop: 'rvp', name: 'Vapour pressure', unit: 'kPa', kind: 'min', limit: rvp.min, why: 'Too low and a cold engine won’t start: there isn’t enough vapour to ignite.' },
      { prop: 'aromatics', name: 'Aromatics', unit: 'vol%', kind: 'max', limit: 35, why: 'Aromatics burn to soot and form benzene in the exhaust.' },
      { prop: 'olefins', name: 'Olefins', unit: 'vol%', kind: 'max', limit: 18, why: 'Olefins form gums in engines and react in sunlight to make ozone.' },
      { prop: 'benzene', name: 'Benzene', unit: 'vol%', kind: 'max', limit: 1, why: 'Benzene causes leukaemia; it is limited at the pump and in the air around it.' },
      { prop: 'sulphur', name: 'Sulphur', unit: 'ppm', kind: 'max', limit: 10, why: 'Sulphur poisons the car’s catalytic converter and makes SO₂.' },
      { prop: 'oxygen', name: 'Oxygen', unit: 'wt%', kind: 'max', limit: 3.7, why: 'Oxygenates lean the mixture; engines are calibrated for a limit.' },
      { prop: 'ethanol', name: 'Ethanol', unit: 'vol%', kind: 'max', limit: 10, why: 'E10: older engines and seals tolerate at most a tenth ethanol.' },
    ],
  }
}

/** EN 590 road diesel, with the cold weather limit for the season. */
export function dieselGrade(season: Season): Grade {
  return {
    id: 'diesel',
    name: 'Road diesel',
    price: 108,
    specs: [
      { prop: 'cetane', name: 'Cetane number', unit: '', kind: 'min', limit: 51, why: 'How readily it ignites under compression: low cetane knocks and smokes on a cold start.' },
      { prop: 'density', name: 'Density', unit: 'kg/m³', kind: 'min', limit: 820, why: 'Injection is metered by volume, so a light fuel delivers too little energy.' },
      { prop: 'density', name: 'Density', unit: 'kg/m³', kind: 'max', limit: 845, why: 'A heavy fuel over-fuels the engine and makes smoke and particulates.' },
      { prop: 'sulphur', name: 'Sulphur', unit: 'ppm', kind: 'max', limit: 10, why: 'Sulphur poisons particulate filters and NOx catalysts.' },
      {
        prop: 'cloud',
        name: 'Cloud point',
        unit: '°C',
        kind: 'max',
        limit: season === 'summer' ? 0 : -5,
        why: 'Below its cloud point wax crystals form and block fuel filters.',
      },
      { prop: 'fame', name: 'Biodiesel (FAME)', unit: 'vol%', kind: 'max', limit: 7, why: 'B7: more FAME than this can clog injectors and grow bugs in storage.' },
    ],
  }
}
