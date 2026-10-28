import { CRUDES, percentBelow, specificGravity, temperatureAt, type Crude, type CrudeId } from './crudes.ts'

// A steady-state model of a crude distillation unit (CDU): the first unit in
// every refinery. Crude is heated in a furnace and flashed into the bottom of
// a tall column. Everything that vaporises rises and is drawn off as liquid
// at different heights, lightest at the top; what doesn't vaporise leaves at
// the bottom as residue.
//
// The model works the way an operator thinks about the column:
// - The top temperature sets how heavy the naphtha leaving overhead is.
// - The kerosene and diesel draw rates set where the other cuts fall on the
//   crude's boiling curve, because what you draw has to come from somewhere.
// - The furnace decides how much can be vaporised at all. Ask for more
//   distillate than that and the lowest draw tray runs dry.
// - Stripping steam strips light ends out of the side products, which sets
//   their flash points.
//
// It is simplified (no tray-by-tray calculation, TBP rather than ASTM D86
// boiling points) but it follows the real relationships, and every number
// comes from the crude's assay rather than being made up.

export type ProductId = 'gas' | 'naphtha' | 'kerosene' | 'diesel' | 'residue'
export type SteamLevel = 'low' | 'normal' | 'high'

export const PRODUCTS: { id: ProductId; name: string; colour: string; goesTo: string }[] = [
  { id: 'gas', name: 'Gas and LPG', colour: '#b9c7d6', goesTo: 'gas plant: fuel gas, propane and butane' },
  { id: 'naphtha', name: 'Naphtha', colour: '#e8d27a', goesTo: 'naphtha hydrotreater, then the reformer to make petrol' },
  { id: 'kerosene', name: 'Kerosene', colour: '#f0a64a', goesTo: 'kerosene treater, then out as jet fuel' },
  { id: 'diesel', name: 'Diesel', colour: '#d9733c', goesTo: 'diesel hydrotreater to take the sulphur out' },
  { id: 'residue', name: 'Atmospheric residue', colour: '#6b4a3a', goesTo: 'vacuum unit, then the cracker or coker' },
]

export interface CduInputs {
  crude: CrudeId
  /** Crude rate, thousand barrels a day. */
  feed: number
  /** Furnace (coil) outlet temperature, °C. */
  cot: number
  /** Column top temperature, °C. */
  topTemp: number
  /** Kerosene side draw, % of the crude by volume. */
  keroDraw: number
  /** Diesel side draw, % of the crude by volume. */
  dieselDraw: number
  steam: SteamLevel
}

export const CDU_LIMITS = {
  feed: { min: 60, max: 140, design: 100 },
  topTemp: { min: 100, max: 150 },
  keroDraw: { min: 0, max: 26 },
  dieselDraw: { min: 0, max: 34 },
  cot: { min: 300, max: 400, design: 360, coking: 372, trip: 385 },
}

export const CDU_START: CduInputs = {
  crude: 'brent',
  feed: 100,
  cot: 360,
  topTemp: 125,
  keroDraw: 14,
  dieselDraw: 20,
  steam: 'normal',
}

/** Naphtha's end point sits this far above the column top temperature (TBP, at about 1 bar gauge with steam). */
const TOP_TO_CUT = 40
/** Gas and LPG: everything boiling below this, °C. */
const GAS_CUT = 30
/**
 * The flash zone vaporises roughly what boils below the furnace outlet
 * temperature plus this, because steam lowers the oil's partial pressure.
 */
const FLASH_LIFT = 10
/** Vapour that must fall back as liquid to wash the trays above the flash zone (overflash), % of crude. */
const OVERFLASH = 4
/** How far a side product's front end reaches below its cut point, by stripping steam rate (°C). */
const FRONT_TAIL: Record<SteamLevel, number> = { low: 16, normal: 8, high: 4 }
/** How far a product's back end reaches above its cut point, because fractionation is never perfect (°C). */
const BACK_TAIL = 12
/** Stripping steam used, kg per barrel of side products, by setting. */
const STEAM_RATE: Record<SteamLevel, number> = { low: 2, normal: 4.5, high: 8 }

export interface Spec {
  name: string
  value: number
  unit: string
  limit: number
  /** Whether the limit is a minimum or a maximum. */
  kind: 'min' | 'max'
  ok: boolean
  /** Why the spec exists, in a sentence. */
  why: string
}

export interface ProductResult {
  id: ProductId
  /** % of the crude by volume. */
  percent: number
  /** Thousand barrels a day. */
  rate: number
  /** Lower and upper TBP cut points, °C. */
  from: number
  to: number
  /** Sulphur, parts per million by weight. */
  sulphurPpm: number
  specs: Spec[]
  onSpec: boolean
}

export interface CduResult {
  products: Record<ProductId, ProductResult>
  /** % of crude the flash zone can lift into the column as vapour, after overflash. */
  liftable: number
  /** % of crude asked for as distillate (everything but residue). */
  requested: number
  /** The draws asked for more than the furnace vaporises, so the lowest draw tray runs short. */
  starved: boolean
  /** Vapour lifted but not drawn, which falls back into the residue: fuel spent for nothing. */
  wastedLift: number
  furnace: FurnaceDuty
  economics: Economics
  /** Plain-language warnings, most important first. */
  warnings: string[]
}

/**
 * Flash point (°C) from the temperature at which 10% of a product boils, by
 * the API's correlation (Riazi and Daubert): Tf = 0.69·T10 − 118.2, in °F.
 */
export function flashPoint(t10: number) {
  const f = 0.69 * (t10 * 1.8 + 32) - 118.2
  return (f - 32) / 1.8
}

/** Relative sulphur concentration of oil boiling around `temp` °C: sulphur gathers in the heavy end. */
function sulphurWeight(temp: number) {
  return Math.max(0.01, (temp + 40) / 390) ** 2
}

/** Where every cut falls, and how much of each product the column makes. */
export function runCdu(inputs: CduInputs, prices: Prices = PRICES): CduResult {
  const crude = CRUDES[inputs.crude]
  const gas = percentBelow(crude, GAS_CUT)
  const naphthaCut = inputs.topTemp + TOP_TO_CUT
  const naphthaEnd = percentBelow(crude, naphthaCut)
  const liftable = Math.max(0, percentBelow(crude, inputs.cot + FLASH_LIFT) - OVERFLASH)
  const requested = naphthaEnd + inputs.keroDraw + inputs.dieselDraw
  // The column can't draw more than the furnace vaporised: the lowest draws go short first.
  const lifted = Math.max(gas, Math.min(requested, liftable))
  const naphtha = Math.max(0, Math.min(naphthaEnd, lifted) - gas)
  const kerosene = Math.max(0, Math.min(inputs.keroDraw, lifted - gas - naphtha))
  const diesel = Math.max(0, Math.min(inputs.dieselDraw, lifted - gas - naphtha - kerosene))
  const percents: Record<ProductId, number> = {
    gas,
    naphtha,
    kerosene,
    diesel,
    residue: 100 - gas - naphtha - kerosene - diesel,
  }

  // Cumulative boundaries between products, and the temperatures they fall at.
  const order: ProductId[] = ['gas', 'naphtha', 'kerosene', 'diesel', 'residue']
  const bounds: [number, number][] = []
  let start = 0
  for (const id of order) {
    bounds.push([start, start + percents[id]])
    start += percents[id]
  }
  const temps = bounds.map(([a, b]) => [temperatureAt(crude, a), temperatureAt(crude, b)] as [number, number])
  // A temperature part-way through a product, by fraction of its volume.
  const within = (i: number, fraction: number) => {
    const [a, b] = bounds[i]
    return temperatureAt(crude, a + fraction * (b - a))
  }

  // Sulphur: share the crude's sulphur out by where each product boils.
  // Gas leaves as hydrocarbons; its hydrogen sulphide is counted with the naphtha it is washed out of.
  const weights = order.map((id, i) => (id !== 'gas' && percents[id] > 0 ? sulphurWeight(within(i, 0.5)) : 0))
  const totalWeight = order.reduce((sum, id, i) => sum + percents[id] * weights[i], 0) || 1
  const sulphur = (i: number) => ((crude.sulphur * weights[i]) / totalWeight) * 100 * 10_000

  const front = FRONT_TAIL[inputs.steam]
  const specsFor = (id: ProductId, i: number): Spec[] => {
    if (percents[id] < 0.05) return []
    if (id === 'naphtha') {
      const end = temps[i][1] + BACK_TAIL
      return [
        {
          name: 'End point',
          value: end,
          unit: '°C',
          limit: 200,
          kind: 'max',
          ok: end <= 200,
          why: 'Heavier naphtha makes coke on the reformer catalyst.',
        },
      ]
    }
    if (id === 'kerosene') {
      const flash = flashPoint(within(i, 0.1) - front)
      const end = temps[i][1] + BACK_TAIL + 3
      return [
        {
          name: 'Flash point',
          value: flash,
          unit: '°C',
          limit: 38,
          kind: 'min',
          ok: flash >= 38,
          why: 'Jet A-1 must not give off enough vapour to ignite below 38 °C (DEF STAN 91-091).',
        },
        {
          name: 'Final boiling point',
          value: end,
          unit: '°C',
          limit: 300,
          kind: 'max',
          ok: end <= 300,
          why: 'Heavy tails freeze at altitude and burn smokily (Jet A-1 limit 300 °C).',
        },
      ]
    }
    if (id === 'diesel') {
      const flash = flashPoint(within(i, 0.1) - front)
      const t95 = within(i, 0.95) + BACK_TAIL
      return [
        {
          name: 'Flash point',
          value: flash,
          unit: '°C',
          limit: 55,
          kind: 'min',
          ok: flash >= 55,
          why: 'Road diesel must be safe to store and pump: EN 590 asks for above 55 °C.',
        },
        {
          name: '95% boiling point',
          value: t95,
          unit: '°C',
          limit: 360,
          kind: 'max',
          ok: t95 <= 360,
          why: 'Heavy ends burn badly and smoke: EN 590 allows 95% to boil by 360 °C at most.',
        },
      ]
    }
    return []
  }

  const products = {} as Record<ProductId, ProductResult>
  order.forEach((id, i) => {
    const specs = specsFor(id, i)
    products[id] = {
      id,
      percent: percents[id],
      rate: (percents[id] / 100) * inputs.feed,
      from: id === 'gas' ? crude.tbp[0][0] : temps[i][0],
      to: id === 'residue' ? crude.tbp[crude.tbp.length - 1][0] : temps[i][1],
      sulphurPpm: id === 'gas' ? 0 : sulphur(i),
      specs,
      onSpec: specs.every((s) => s.ok),
    }
  })

  const furnace = furnaceDuty(crude, inputs.feed, inputs.cot)
  const sideProducts = ((kerosene + diesel) / 100) * inputs.feed
  const economics = economicsFor(crude, inputs, products, furnace, sideProducts * 1000 * STEAM_RATE[inputs.steam], prices)

  const starved = requested - liftable > 0.05
  const wastedLift = Math.max(0, liftable - requested)
  const warnings: string[] = []
  if (inputs.cot >= CDU_LIMITS.cot.coking)
    warnings.push(
      `The furnace outlet is above ${CDU_LIMITS.cot.coking} °C: the oil is starting to crack in the tubes, laying down coke and making gas.`,
    )
  if (starved)
    warnings.push(
      `The draws ask for ${requested.toFixed(1)}% of the crude, but the flash zone only lifts ${liftable.toFixed(1)}%. The diesel draw tray is running dry: raise the furnace outlet or draw less.`,
    )
  for (const id of order)
    for (const spec of products[id].specs)
      if (!spec.ok)
        warnings.push(
          `${PRODUCTS.find((p) => p.id === id)!.name} is off spec: ${spec.name.toLowerCase()} ${spec.value.toFixed(0)} ${spec.unit} (${spec.kind === 'min' ? 'at least' : 'at most'} ${spec.limit}).`,
        )
  if (wastedLift > 6)
    warnings.push(
      `${wastedLift.toFixed(1)}% of the crude is vaporised but not drawn, so it falls back into the residue. The furnace is working harder than it needs to.`,
    )

  return { products, liftable, requested, starved, wastedLift, furnace, economics, warnings }
}

export interface FurnaceDuty {
  /** Crude flow, kg/s. */
  massFlow: number
  /** Heat the oil takes up, MW. */
  absorbed: number
  /** Heat released by burning fuel gas, MW. */
  fired: number
}

/** Crude arrives at the furnace from the preheat train at this temperature, °C. */
export const PREHEAT_OUTLET = 265
/** Specific heat of hot crude, kJ/kg·K. */
const CP = 2.9
/** Heat to vaporise the oil that flashes, kJ/kg. */
const LATENT = 250
/** Fraction of the fuel's heat that reaches the oil (the rest leaves up the stack). */
export const FURNACE_EFFICIENCY = 0.88

/** Crude mass flow, kg/s, from thousand barrels a day. */
export function massFlow(crude: Crude, feed: number) {
  const m3PerSecond = (feed * 1000 * 0.158987) / 86400
  return m3PerSecond * specificGravity(crude.api) * 1000
}

/** Heat (kJ per kg of crude) to take crude from `inlet` to `cot` and vaporise what flashes. */
function heatPerKg(crude: Crude, inlet: number, cot: number) {
  return CP * (cot - inlet) + (percentBelow(crude, cot + FLASH_LIFT) / 100) * LATENT
}

/** The furnace duty needed to hold an outlet temperature. */
export function furnaceDuty(crude: Crude, feed: number, cot: number, inlet = PREHEAT_OUTLET): FurnaceDuty {
  const m = massFlow(crude, feed)
  const absorbed = (m * Math.max(0, heatPerKg(crude, inlet, cot))) / 1000
  return { massFlow: m, absorbed, fired: absorbed / FURNACE_EFFICIENCY }
}

/** The outlet temperature a steady fired duty would settle at (inverse of furnaceDuty). */
export function outletFor(crude: Crude, feed: number, fired: number, inlet = PREHEAT_OUTLET) {
  const target = (fired * FURNACE_EFFICIENCY * 1000) / massFlow(crude, feed)
  let lo = inlet - 50
  let hi = 600
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (heatPerKg(crude, inlet, mid) < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Illustrative prices, US dollars a barrel, and utilities. */
export interface Prices {
  products: Record<ProductId, number>
  /** Fuel gas, dollars a gigajoule. */
  fuel: number
  /** Steam, dollars a tonne. */
  steam: number
  /** Dollars a barrel taken off the residue's value for each % of sulphur in it. */
  residueSulphurPenalty: number
  /** What an off-spec product fetches: it goes to slops to be run again. */
  slops: number
}

/**
 * Illustrative values, as the dollars a barrel the downstream units would pay
 * for each stream. Residue is worth less the more sulphur it carries.
 */
export const PRICES: Prices = {
  products: { gas: 50, naphtha: 74, kerosene: 105, diesel: 108, residue: 75 },
  residueSulphurPenalty: 4,
  fuel: 9,
  steam: 25,
  slops: 60,
}

export interface Economics {
  /** Dollars a day. */
  productValue: number
  crudeCost: number
  fuelCost: number
  steamCost: number
  margin: number
  /** Margin per barrel of crude. */
  perBarrel: number
}

/** What one barrel of a product is worth, given its quality. */
export function productPrice(p: ProductResult, prices: Prices = PRICES) {
  if (!p.onSpec) return prices.slops
  if (p.id === 'residue') return prices.products.residue - (p.sulphurPpm / 10_000) * prices.residueSulphurPenalty
  return prices.products[p.id]
}

function economicsFor(
  crude: Crude,
  inputs: CduInputs,
  products: Record<ProductId, ProductResult>,
  furnace: FurnaceDuty,
  steamKgPerDay: number,
  prices: Prices,
): Economics {
  let productValue = 0
  for (const p of Object.values(products)) productValue += p.rate * 1000 * productPrice(p, prices)
  const crudeCost = inputs.feed * 1000 * crude.price
  const fuelCost = furnace.fired * 86.4 * prices.fuel
  const steamCost = (steamKgPerDay / 1000) * prices.steam
  const margin = productValue - crudeCost - fuelCost - steamCost
  return { productValue, crudeCost, fuelCost, steamCost, margin, perBarrel: margin / (inputs.feed * 1000) }
}
