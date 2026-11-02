import { CDU_LIMITS } from './cdu.ts'
import { CRUDES, percentBelow, type CrudeId } from './crudes.ts'
import { COKER_LIMITS } from './heavyEnd.ts'
import { lightEndsResult } from './lightEndsPlant.ts'
import { maximise } from './lp.ts'
import { treatingResult, type Plant } from './plant.ts'
import { siteBalance } from './site.ts'
import { SRU_LIMITS } from './treating.ts'

// Planning: next month's crude slate by linear programming, and the critical
// path of a turnaround. The two big decisions a refinery's planners make that
// operators don't.

export const CRUDE_IDS = Object.keys(CRUDES) as CrudeId[]
/** A colour for each crude, for the slate. */
export const CRUDE_COLOURS: Record<CrudeId, string> = {
  brent: '#e0a458',
  wti: '#f0d070',
  arabLight: '#9fd0e0',
  maya: '#8a5a3a',
  bonny: '#b8e08a',
  sverdrup: '#7fb4dc',
  basrah: '#c8a0e0',
  wcs: '#5a4a40',
}
export const PLAN_DAYS = 30
/** A cargo, thousand barrels: an Aframax tanker's load. */
export const CARGO = 600
/** Most a refinery can usually buy of one grade in a month, cargoes. */
export const MAX_CARGOES = 2
/** Crude the crude unit can run in a month, kb/d: above design, short of its hydraulic limit. */
export const CDU_PLAN_RATE = 120
/** Residue the site can sell as fuel oil without the coker, kb/d. */
export const FUEL_OIL_OUTLET = 22

/** What one barrel of a crude does on the site at today's settings and prices. */
export interface CrudeValue {
  id: CrudeId
  /** Site margin per barrel run, dollars. */
  margin: number
  /** Vacuum residue per barrel, barrels. */
  residue: number
  /** Sulphur to the sulphur plant per thousand barrels, tonnes. */
  sulphur: number
  /** Every product on spec, at 100 kb/d. */
  onSpec: boolean
}

/** Natural cuts, °C: kerosene from 170 to 235, diesel on to 345. */
const CUTS = { kero: [170, 235], diesel: [235, 345] }

/**
 * The plant as it would run a crude: at 100 kb/d, with the crude unit's draws set to the crude's natural kerosene and
 * diesel cuts and both blends re-planned for what it makes. Everything else stays as it is, and the crude running now
 * keeps its own draws and blends.
 */
export function trialPlant(p: Plant, id: CrudeId): Plant {
  // The crude running now is valued as it's being run.
  if (id === p.furnace.crude) return { ...p, furnace: { ...p.furnace, feed: 100 } }
  const crude = CRUDES[id]
  const cut = ([from, to]: number[]) => Math.round(percentBelow(crude, to) - percentBelow(crude, from))
  let trial: Plant = { ...p, furnace: { ...p.furnace, crude: id, feed: 100 }, column: { ...p.column, keroDraw: cut(CUTS.kero), dieselDraw: cut(CUTS.diesel) } }
  const r = lightEndsResult(trial)
  const recipe = (pool: typeof r.petrol) => Object.fromEntries(pool.components.map((c, i) => [c.id, pool.best.volumes[i]]))
  trial = { ...trial, blend: { ...trial.blend, petrol: recipe(r.petrol), diesel: recipe(r.diesel), planned: { petrol: true, diesel: true } } }
  return trial
}

/** Runs each crude through the whole site model at 100 kb/d and the plant's other settings. */
export function crudeValues(p: Plant): CrudeValue[] {
  return CRUDE_IDS.map((id) => {
    const trial = trialPlant(p, id)
    const b = siteBalance(trial)
    const t = treatingResult(trial)
    return {
      id,
      margin: b.perBarrel,
      residue: t.conversion.vdu.residueRate / 100,
      sulphur: t.sru.feed / 100,
      onSpec: Object.values(t.conversion.cdu.products).every((x) => x.onSpec) && !t.conversion.cdu.starved,
    }
  })
}

export interface PlanConstraint {
  id: 'cdu' | 'residue' | 'sulphur'
  name: string
  /** Its limit over the month, and how much the plan uses. */
  limit: number
  used: number
  unit: string
  /** What one more unit of the limit would add to the month's margin, dollars. */
  shadow: number
}

export interface CrudePlan {
  /** Thousand barrels of each crude over the month. */
  barrels: Record<CrudeId, number>
  /** Margin over the month, dollars. */
  margin: number
  constraints: PlanConstraint[]
}

export interface PlanOptions {
  /** Crudes offered this month. */
  offered: ReadonlySet<CrudeId>
  /** Dollars a barrel off (positive) or on each crude's price. */
  discounts: Partial<Record<CrudeId, number>>
  coker: boolean
}

/**
 * Chooses next month's crude slate to make the most margin, within the crude unit's rate, what the site can do with
 * residue, the sulphur plant's capacity and the cargoes on offer. Each crude's margin is taken from the full site
 * model at today's settings, so the plan is linear around how the plant runs now: what planners call a base-delta
 * model.
 */
export function planCrudes(values: CrudeValue[], o: PlanOptions): CrudePlan {
  const ids = values.map((v) => v.id)
  // Objective: dollars per thousand barrels; a crude not on offer is held to zero.
  const c = values.map((v) => (o.offered.has(v.id) ? (v.margin + (o.discounts[v.id] ?? 0)) * 1000 : 0))
  const limits = {
    cdu: CDU_PLAN_RATE * PLAN_DAYS,
    residue: (o.coker ? COKER_LIMITS.capacity : FUEL_OIL_OUTLET) * PLAN_DAYS,
    sulphur: SRU_LIMITS.capacity * PLAN_DAYS,
  }
  const rows = [values.map(() => 1), values.map((v) => v.residue), values.map((v) => v.sulphur)]
  // One row a crude for the cargoes on offer.
  const availability = values.map((_, i) => values.map((__, j) => (i === j ? 1 : 0)))
  const a = [...rows, ...availability]
  const b = [limits.cdu, limits.residue, limits.sulphur, ...values.map((v) => (o.offered.has(v.id) ? MAX_CARGOES * CARGO : 0))]
  const solve = (bb: number[]) => maximise(c, a, bb)
  const best = solve(b)
  const x = best.x
  const barrels = Object.fromEntries(ids.map((id, i) => [id, x[i]])) as Record<CrudeId, number>
  // Shadow prices by re-solving with each limit a little looser.
  const shadow = (row: number) => {
    const step = b[row] * 0.01
    const loose = [...b]
    loose[row] += step
    return (solve(loose).value - best.value) / step
  }
  const used = (row: number) => rows[row].reduce((s, k, i) => s + k * x[i], 0)
  return {
    barrels,
    margin: best.value,
    constraints: [
      { id: 'cdu', name: 'Crude unit', limit: limits.cdu, used: used(0), unit: 'kbbl', shadow: shadow(0) },
      { id: 'residue', name: o.coker ? 'Coker' : 'Fuel oil sales', limit: limits.residue, used: used(1), unit: 'kbbl of residue', shadow: shadow(1) },
      { id: 'sulphur', name: 'Sulphur plant', limit: limits.sulphur, used: used(2), unit: 't of sulphur', shadow: shadow(2) },
    ],
  }
}

/** The crude unit's design rate, for comparing a plan against. */
export const DESIGN_RATE = CDU_LIMITS.feed.design

export interface TurnaroundTask {
  id: string
  name: string
  /** Days with the normal crew, and with an extra crew working nights. */
  days: number
  crashed: number
  /** What the extra crew costs, dollars. */
  crashCost: number
  after: string[]
}

export const TURNAROUND: TurnaroundTask[] = [
  { id: 'shutdown', name: 'Shut down and cool', days: 2, crashed: 2, crashCost: 0, after: [] },
  { id: 'decon', name: 'Steam out and decontaminate', days: 2, crashed: 2, crashCost: 0, after: ['shutdown'] },
  { id: 'blind', name: 'Fit blinds and isolate', days: 1, crashed: 1, crashCost: 0, after: ['decon'] },
  { id: 'column', name: 'Open the column, replace damaged trays', days: 9, crashed: 6, crashCost: 900_000, after: ['blind'] },
  { id: 'exchangers', name: 'Pull and clean the preheat exchangers', days: 6, crashed: 4, crashCost: 350_000, after: ['blind'] },
  { id: 'furnace', name: 'Decoke and inspect the furnace tubes', days: 7, crashed: 4, crashCost: 600_000, after: ['blind'] },
  { id: 'catalyst', name: 'Change the reformer’s catalyst', days: 8, crashed: 5, crashCost: 1_400_000, after: ['blind'] },
  { id: 'repairs', name: 'Repair what inspection finds', days: 4, crashed: 3, crashCost: 300_000, after: ['column', 'exchangers', 'furnace'] },
  { id: 'closeup', name: 'Box up and remove the blinds', days: 2, crashed: 2, crashCost: 0, after: ['repairs', 'catalyst'] },
  { id: 'leak', name: 'Leak test and purge', days: 1, crashed: 1, crashCost: 0, after: ['closeup'] },
  { id: 'startup', name: 'Start up and line out', days: 2, crashed: 2, crashCost: 0, after: ['leak'] },
]

export interface Schedule {
  start: Record<string, number>
  finish: Record<string, number>
  /** Days a task can slip without delaying the whole turnaround. */
  slack: Record<string, number>
  critical: string[]
  days: number
  crashCost: number
}

/** The critical path method: earliest starts forward, latest finishes backward, and the tasks with no slack. */
export function schedule(tasks: TurnaroundTask[], crashed: ReadonlySet<string>): Schedule {
  const length = (t: TurnaroundTask) => (crashed.has(t.id) ? t.crashed : t.days)
  const start: Record<string, number> = {}
  const finish: Record<string, number> = {}
  // Tasks are listed after everything they wait for, so one pass forward is enough.
  for (const t of tasks) {
    start[t.id] = Math.max(0, ...t.after.map((id) => finish[id]))
    finish[t.id] = start[t.id] + length(t)
  }
  const days = Math.max(...tasks.map((t) => finish[t.id]))
  const latestFinish: Record<string, number> = {}
  for (const t of [...tasks].reverse()) {
    const followers = tasks.filter((f) => f.after.includes(t.id))
    latestFinish[t.id] = followers.length ? Math.min(...followers.map((f) => latestFinish[f.id] - length(f))) : days
  }
  const slack = Object.fromEntries(tasks.map((t) => [t.id, latestFinish[t.id] - finish[t.id]]))
  return {
    start,
    finish,
    slack,
    critical: tasks.filter((t) => slack[t.id] < 1e-9).map((t) => t.id),
    days,
    crashCost: tasks.reduce((sum, t) => sum + (crashed.has(t.id) ? t.crashCost : 0), 0),
  }
}

/** The cheapest set of extra crews, counting a day of lost margin against what each crew costs. Tries them all. */
export function bestCrashing(tasks: TurnaroundTask[], dailyMargin: number): Set<string> {
  const options = tasks.filter((t) => t.crashed < t.days)
  let best = new Set<string>()
  let bestCost = Infinity
  for (let mask = 0; mask < 1 << options.length; mask++) {
    const set = new Set(options.filter((_, i) => mask & (1 << i)).map((t) => t.id))
    const s = schedule(tasks, set)
    const cost = s.days * dailyMargin + s.crashCost
    if (cost < bestCost - 1e-6) {
      bestCost = cost
      best = set
    }
  }
  return best
}
