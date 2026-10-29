import type { SiteBalance } from './site.ts'

// The tank farm and the jetty: crude comes in by ship, products go out by
// road, pipeline and ship, and the tanks in between soak up the difference.
// Run the units without watching the tanks and the crude runs out, or a
// product tank fills to the top and has to be sold off cheap. Time here is in
// days; the plant clock drives it, and it can be run on ahead.

export type TankId = 'crude' | 'vgo' | 'lpg' | 'petrol' | 'jet' | 'diesel' | 'fuelOil' | 'sulphur'

export interface TankSpec {
  id: TankId
  name: string
  /** Thousand barrels (tonnes for sulphur). */
  capacity: number
  start: number
  /** Steady lifting by road, rail or pipeline, per day. */
  lifting: number
  liftingBy: string
  /** A cargo: what a ship or train takes or brings. */
  cargo: number
  cargoBy: 'ship' | 'train'
  colour: string
  unit: 'kbbl' | 't'
}

export const TANKS: Record<TankId, TankSpec> = {
  crude: { id: 'crude', name: 'Crude oil', capacity: 1500, start: 800, lifting: 0, liftingBy: '', cargo: 700, cargoBy: 'ship', colour: '#5a4632', unit: 'kbbl' },
  vgo: { id: 'vgo', name: 'Vacuum gas oil', capacity: 250, start: 140, lifting: 0, liftingBy: '', cargo: 120, cargoBy: 'ship', colour: '#8a6a3a', unit: 'kbbl' },
  lpg: { id: 'lpg', name: 'LPG spheres', capacity: 45, start: 18, lifting: 3, liftingBy: 'road tankers', cargo: 20, cargoBy: 'ship', colour: '#9fd0e0', unit: 'kbbl' },
  petrol: { id: 'petrol', name: 'Petrol', capacity: 450, start: 180, lifting: 16, liftingBy: 'the road rack', cargo: 220, cargoBy: 'ship', colour: '#f0c050', unit: 'kbbl' },
  jet: { id: 'jet', name: 'Jet fuel', capacity: 300, start: 120, lifting: 9, liftingBy: 'the airport pipeline', cargo: 150, cargoBy: 'ship', colour: '#f0a64a', unit: 'kbbl' },
  diesel: { id: 'diesel', name: 'Diesel', capacity: 500, start: 200, lifting: 12, liftingBy: 'the road rack', cargo: 200, cargoBy: 'ship', colour: '#d9733c', unit: 'kbbl' },
  fuelOil: { id: 'fuelOil', name: 'Fuel oil', capacity: 400, start: 160, lifting: 4, liftingBy: 'bunker barges', cargo: 250, cargoBy: 'ship', colour: '#6b5a4a', unit: 'kbbl' },
  sulphur: { id: 'sulphur', name: 'Sulphur pit', capacity: 2500, start: 800, lifting: 14, liftingBy: 'lorries', cargo: 500, cargoBy: 'train', colour: '#e8d27a', unit: 't' },
}

export const TANK_IDS = Object.keys(TANKS) as TankId[]

/** Tanks can't be pumped below a heel or filled past a safe fill height, as a share of capacity. */
export const TANK_LIMITS = { heel: 0.05, high: 0.9, highHigh: 0.97 }

export interface Ship {
  id: number
  name: string
  tank: TankId
  /** Bringing (crude, gas oil) or taking (products). */
  kind: 'discharge' | 'load'
  size: number
  /** Day it arrives off the jetty. */
  eta: number
  /** Still to pump, once alongside. */
  remaining: number
  /** Day it came alongside, once it has. */
  berthed?: number
}

export interface LogEntry {
  day: number
  text: string
  kind: 'info' | 'warn' | 'bad'
}

export interface TankFarm {
  day: number
  levels: Record<TankId, number>
  ships: Ship[]
  nextShip: number
  /** Order crude by itself when the tank falls below 40%. */
  autoCrude: boolean
  /** One sample every quarter day: levels as a share of capacity. */
  history: { day: number; levels: Record<TankId, number> }[]
  /** Dollars since the start: the units' margin, and what the tanks and jetty cost on top. */
  ledger: { margin: number; demurrage: number; distressed: number; lost: number }
  log: LogEntry[]
  /** The crude tank is at its heel: the plant can't run. */
  starved: boolean
}

const SHIP_NAMES = [
  'Northern Star',
  'Maersk Thames',
  'Stena Clyde',
  'Front Hessian',
  'Torm Ingrid',
  'Hafnia Lotte',
  'BW Kestrel',
  'Minerva Iris',
  'Nordic Swan',
  'Seaways Fenland',
  'Gulf Mirage',
  'Ardmore Dawn',
]

/** A ship is due off the jetty this long after it's booked, days: crude comes from further away. */
export const SHIP_LEAD = { discharge: 3, load: 1.5 }
/** Days a ship takes alongside to pump a full cargo, and what each extra day alongside costs, dollars. */
export const BERTH = { days: 1, demurrage: 35_000 }
/** What a tank-topped product fetches below its price, dollars a barrel; and what a starved plant still costs a day. */
export const DISTRESSED_DISCOUNT = 20
export const FIXED_COST = 180_000

const HISTORY_DAYS = 60
const LOG_LIMIT = 40

const startLevels = () => Object.fromEntries(TANK_IDS.map((id) => [id, TANKS[id].start])) as Record<TankId, number>
const shares = (levels: Record<TankId, number>) => Object.fromEntries(TANK_IDS.map((id) => [id, levels[id] / TANKS[id].capacity])) as Record<TankId, number>

export function freshTankFarm(): TankFarm {
  const levels = startLevels()
  return {
    day: 0,
    levels,
    ships: [],
    nextShip: 0,
    autoCrude: true,
    history: [{ day: 0, levels: shares(levels) }],
    ledger: { margin: 0, demurrage: 0, distressed: 0, lost: 0 },
    log: [{ day: 0, text: 'Took over the tank farm. The crude tank holds about eight days of feed.', kind: 'info' }],
    starved: false,
  }
}

function newShip(farm: Pick<TankFarm, 'day' | 'nextShip'>, tank: TankId): Ship {
  const spec = TANKS[tank]
  const kind = tank === 'crude' || tank === 'vgo' ? 'discharge' : 'load'
  const name = spec.cargoBy === 'train' ? 'Sulphur train' : SHIP_NAMES[farm.nextShip % SHIP_NAMES.length]
  return { id: farm.nextShip, name, tank, kind, size: spec.cargo, eta: farm.day + SHIP_LEAD[kind], remaining: spec.cargo }
}

const bookedText = (s: Ship) => {
  const spec = TANKS[s.tank]
  return `Booked ${s.name} to ${s.kind === 'load' ? 'lift' : 'bring'} ${s.size} ${spec.unit} of ${spec.name.toLowerCase()}, due day ${s.eta.toFixed(1)}.`
}

/** Books a ship (or train) for a tank: crude and gas oil come in, products go out. */
export function bookShip(farm: TankFarm, tank: TankId): TankFarm {
  const ship = newShip(farm, tank)
  return { ...farm, ships: [...farm.ships, ship], nextShip: farm.nextShip + 1, log: addLog(farm.log, farm.day, bookedText(ship), 'info') }
}

function addLog(log: LogEntry[], day: number, text: string, kind: LogEntry['kind']) {
  return [{ day, text, kind }, ...log].slice(0, LOG_LIMIT)
}

/** What flows into each tank from the units, per day. */
export function rundowns(balance: SiteBalance): Record<TankId, number> {
  const rate = (id: string) => balance.products.find((p) => p.id === id)?.rate ?? 0
  return {
    crude: -balance.crude.rate,
    vgo: balance.vgoToTank,
    lpg: rate('lpg'),
    petrol: rate('petrol') + rate('blendstock'),
    jet: rate('jet'),
    diesel: rate('diesel'),
    fuelOil: rate('fuelOil'),
    sulphur: rate('sulphur'),
  }
}

/** Only one ship can be alongside at a time (rail and road don't use the jetty). */
const usesJetty = (s: Ship) => TANKS[s.tank].cargoBy === 'ship'

/**
 * Runs the tank farm on by `days`, with the units' rates held as they are. Steps in short slices so ships berth,
 * tanks fill and empty, and the log records each event when it happens.
 */
export function stepTankFarm(farm: TankFarm, balance: SiteBalance, days: number): TankFarm {
  let { day, levels, ships, log, starved, history, nextShip } = farm
  const ledger = { ...farm.ledger }
  levels = { ...levels }
  ships = ships.map((s) => ({ ...s }))
  const flows = rundowns(balance)
  const end = day + days
  let nextSample = (history.at(-1)?.day ?? 0) + 0.25
  while (day < end - 1e-9) {
    const dt = Math.min(0.05, end - day)
    const running = levels.crude > TANKS.crude.capacity * TANK_LIMITS.heel
    if (!running && !starved) log = addLog(log, day, 'The crude tank is down to its heel: the crude unit has lost suction and the plant is shutting down.', 'bad')
    if (running && starved) log = addLog(log, day, 'Crude back above the heel: the plant is restarting.', 'info')
    starved = !running

    // The units run down into the tanks, and the road, rail and pipeline liftings take out.
    for (const id of TANK_IDS) {
      const spec = TANKS[id]
      const inflow = running ? flows[id] : 0
      const before = levels[id] / spec.capacity
      levels[id] += (inflow - spec.lifting) * dt
      // Topped out: what doesn't fit goes cheap to whoever will take it.
      const max = spec.capacity * TANK_LIMITS.highHigh
      if (levels[id] > max) {
        const spill = levels[id] - max
        if (id !== 'crude' && id !== 'vgo') ledger.distressed += spill * (spec.unit === 't' ? 1 : 1000) * (id === 'sulphur' ? 60 : DISTRESSED_DISCOUNT)
        levels[id] = max
        if (before < TANK_LIMITS.highHigh - 1e-6) log = addLog(log, day, `${spec.name} tank is full: the overflow is being sold off at a loss.`, 'bad')
      }
      if (levels[id] < 0) levels[id] = 0
      const after = levels[id] / spec.capacity
      if (before < TANK_LIMITS.high && after >= TANK_LIMITS.high) log = addLog(log, day, `${spec.name} tank high (90%): book a ${spec.cargoBy} or cut the rate.`, 'warn')
      if (id === 'vgo' && before > TANK_LIMITS.heel && after <= TANK_LIMITS.heel)
        log = addLog(log, day, 'Gas oil tank empty: the cat cracker is eating into its feed faster than the vacuum unit makes it.', 'warn')
    }

    // Standing order for crude.
    if (farm.autoCrude && levels.crude < TANKS.crude.capacity * 0.4 && !ships.some((s) => s.tank === 'crude')) {
      const ship = newShip({ day, nextShip }, 'crude')
      ships.push(ship)
      nextShip++
      log = addLog(log, day, `Standing order: the crude tank fell below 40%. ${bookedText(ship)}`, 'info')
    }

    // The jetty takes one ship at a time; trains have their own sidings.
    let jettyBusy = ships.some((s) => s.berthed !== undefined && usesJetty(s))
    for (const s of ships) {
      if (s.berthed !== undefined || s.eta > day || (usesJetty(s) && jettyBusy)) continue
      s.berthed = day
      if (usesJetty(s)) jettyBusy = true
      log = addLog(log, day, `${s.name} ${usesJetty(s) ? 'is alongside the jetty' : 'is in the sidings'}.`, 'info')
    }
    for (const s of ships) {
      if (s.berthed === undefined) continue
      const spec = TANKS[s.tank]
      const pump = Math.min(s.remaining, (s.size / BERTH.days) * dt)
      if (s.kind === 'load') {
        const available = Math.max(0, levels[s.tank] - spec.capacity * TANK_LIMITS.heel)
        const moved = Math.min(pump, available)
        levels[s.tank] -= moved
        s.remaining -= moved
      } else {
        const room = Math.max(0, spec.capacity * TANK_LIMITS.highHigh - levels[s.tank])
        const moved = Math.min(pump, room)
        levels[s.tank] += moved
        s.remaining -= moved
      }
      if (day + dt - s.berthed > BERTH.days + 1e-9) ledger.demurrage += BERTH.demurrage * dt
    }
    const sailed = ships.filter((s) => s.remaining <= 1e-6)
    for (const s of sailed) log = addLog(log, day, `${s.name} has ${s.kind === 'load' ? 'loaded' : 'discharged'} ${s.size} ${TANKS[s.tank].unit} and sailed.`, 'info')
    ships = ships.filter((s) => s.remaining > 1e-6)

    if (running) ledger.margin += balance.margin * dt
    else ledger.lost += FIXED_COST * dt
    day += dt
    if (day >= nextSample - 1e-9) {
      history = [...history, { day, levels: shares(levels) }].filter((h) => h.day >= day - HISTORY_DAYS)
      nextSample += 0.25
    }
  }
  return { ...farm, day, levels, ships, nextShip, log, starved, history, ledger }
}

/** Days until a tank tops out (positive) or runs to its heel (negative); Infinity if it is steady. */
export function daysOfCover(farm: TankFarm, flows: Record<TankId, number>, id: TankId) {
  const spec = TANKS[id]
  const net = flows[id] - spec.lifting
  if (Math.abs(net) < 1e-6) return Infinity
  return net > 0 ? (spec.capacity * TANK_LIMITS.highHigh - farm.levels[id]) / net : -(farm.levels[id] - spec.capacity * TANK_LIMITS.heel) / -net
}

/** The bottom line so far: the units' margin less what the tanks and jetty cost. */
export function ledgerTotal(farm: TankFarm) {
  return farm.ledger.margin - farm.ledger.demurrage - farm.ledger.distressed - farm.ledger.lost
}
