import { CDU_LIMITS } from './cdu.ts'
import { FCC_LIMITS, runFcc } from './fcc.ts'
import { measured } from './furnace.ts'
import { GAS_PLANT_LIMITS } from './lightEnds.ts'
import { conversionResult, reformingResult, type Plant } from './plant.ts'
import { REFORMER_LIMITS } from './reformer.ts'
import type { SiteBalance } from './site.ts'
import { TANKS, type TankId } from './tankFarm.ts'
import { DHT_LIMITS, SRU_LIMITS } from './treating.ts'

// The control room's distributed control system: one tag per measurement,
// alarms on their limits, trends, and advanced control on top.
//
// Most of the plant's models are steady state: they say where a unit will
// settle, not how it gets there. The DCS gives each tag a first-order lag
// with the time constant that measurement has on a real unit, so a change
// shows on the trends the way it would: a regenerator warming over ten
// minutes, a reformer's octane drifting over a quarter of an hour, an
// analyser catching up after its sample delay.

export type UnitArea = 'cdu' | 'fcc' | 'reformer' | 'treating' | 'lightEnds' | 'blending' | 'tanks' | 'site'

export interface TagDef {
  id: string
  area: UnitArea
  name: string
  units: string
  digits: number
  /** Time constant, simulated seconds; 0 follows the target at once. */
  tau: number
  /** Range for trends and bar graphs. */
  range: [number, number]
  /** Alarm limits: high-high, high, low, low-low. */
  hh?: number
  hi?: number
  lo?: number
  ll?: number
  target: (p: Plant, b: SiteBalance) => number
}

const tank = (id: TankId): TagDef => ({
  id: `LI-${id}`,
  area: 'tanks',
  name: `${TANKS[id].name} tank level`,
  units: '%',
  digits: 0,
  tau: 0,
  range: [0, 100],
  hi: 90,
  hh: 97,
  lo: id === 'vgo' || id === 'crude' ? 15 : undefined,
  ll: id === 'crude' ? 7 : undefined,
  target: (p) => (p.tanks.levels[id] / TANKS[id].capacity) * 100,
})

export const TAGS: TagDef[] = [
  { id: 'FI-100', area: 'cdu', name: 'Crude to the furnace', units: 'kb/d', digits: 1, tau: 30, range: [60, 120], target: (p) => p.furnace.feed },
  {
    id: 'TI-101',
    area: 'cdu',
    name: 'Furnace outlet',
    units: '°C',
    digits: 1,
    tau: 0,
    range: [330, 390],
    hi: CDU_LIMITS.cot.coking,
    hh: CDU_LIMITS.cot.trip - 3,
    lo: 345,
    target: (p) => measured(p.furnace),
  },
  { id: 'TI-102', area: 'cdu', name: 'Column top', units: '°C', digits: 1, tau: 240, range: [100, 160], target: (p) => p.column.topTemp },
  { id: 'FI-104', area: 'cdu', name: 'Diesel draw', units: 'kb/d', digits: 1, tau: 300, range: [0, 40], target: (_, b) => b.units.treating.conversion.cdu.products.diesel.rate },
  { id: 'FI-301', area: 'fcc', name: 'Cat cracker feed', units: 'kb/d', digits: 1, tau: 60, range: [10, 50], target: (p) => p.fcc.feed },
  { id: 'TI-301', area: 'fcc', name: 'Riser outlet', units: '°C', digits: 0, tau: 90, range: [480, 570], hi: 550, target: (p) => p.fcc.rot },
  {
    id: 'TI-302',
    area: 'fcc',
    name: 'Regenerator dense bed',
    units: '°C',
    digits: 0,
    tau: 600,
    range: [620, 800],
    hi: FCC_LIMITS.regenMax - 10,
    hh: FCC_LIMITS.regenMax + 10,
    target: (_, b) => b.units.treating.conversion.fcc.regenTemp,
  },
  { id: 'FI-303', area: 'fcc', name: 'Regenerator air', units: 't/h', digits: 0, tau: 300, range: [60, 180], hi: FCC_LIMITS.airMax * 0.98, target: (_, b) => b.units.treating.conversion.fcc.air },
  { id: 'FI-304', area: 'fcc', name: 'Wet gas compressor', units: 't/h', digits: 1, tau: 300, range: [10, 60], hi: FCC_LIMITS.gasMax * 0.98, target: (_, b) => b.units.treating.conversion.fcc.gas },
  { id: 'TI-501', area: 'reformer', name: 'Reactor inlets', units: '°C', digits: 0, tau: 300, range: [460, 545], hi: REFORMER_LIMITS.waitMax, target: (p) => p.reformer.wait },
  { id: 'AI-502', area: 'reformer', name: 'Reformate octane', units: 'RON', digits: 1, tau: 900, range: [85, 104], lo: 94, target: (_, b) => b.units.treating.reforming.reformer.octane },
  { id: 'FI-503', area: 'reformer', name: 'Hydrogen made', units: 't/d', digits: 0, tau: 600, range: [0, 120], target: (_, b) => b.units.treating.reforming.reformer.hydrogen },
  { id: 'AI-603', area: 'treating', name: 'Diesel sulphur', units: 'ppm', digits: 1, tau: 900, range: [0, 30], hi: DHT_LIMITS.sulphurMax * 0.9, hh: DHT_LIMITS.sulphurMax * 1.5, target: (_, b) => b.units.treating.dht.sulphurOut },
  { id: 'FI-604', area: 'treating', name: 'Hydrogen bought', units: 't/d', digits: 1, tau: 300, range: [0, 60], hi: 20, target: (_, b) => b.units.treating.hydrogen.imported },
  { id: 'AI-701', area: 'treating', name: 'SO₂ to the stack', units: 't/d', digits: 2, tau: 300, range: [0, 8], hi: SRU_LIMITS.so2Permit * 0.85, hh: SRU_LIMITS.so2Permit, target: (_, b) => b.units.treating.sru.so2 },
  {
    id: 'AI-803',
    area: 'lightEnds',
    name: 'Butane in propane',
    units: '%',
    digits: 2,
    tau: 600,
    range: [0, 8],
    hi: GAS_PLANT_LIMITS.butaneInPropaneMax,
    target: (_, b) => b.units.gasPlant.butaneInPropane,
  },
  { id: 'AI-1001', area: 'lightEnds', name: 'Alkylate octane', units: 'RON', digits: 1, tau: 900, range: [88, 99], target: (_, b) => b.units.alky.octane },
  { id: 'AI-1002', area: 'lightEnds', name: 'Alkylation acid', units: 'wt%', digits: 1, tau: 0, range: [84, 98], lo: 89, ll: 88, target: (p) => p.alky.acid },
  { id: 'AI-1101', area: 'blending', name: 'Petrol octane (RON)', units: 'RON', digits: 1, tau: 300, range: [88, 100], target: (_, b) => b.units.petrol.blend.properties.ron ?? 0 },
  { id: 'AI-1102', area: 'blending', name: 'Petrol vapour pressure', units: 'kPa', digits: 1, tau: 300, range: [30, 100], target: (_, b) => b.units.petrol.blend.properties.rvp ?? 0 },
  tank('crude'),
  tank('vgo'),
  tank('petrol'),
  tank('diesel'),
  tank('fuelOil'),
  { id: 'MARGIN', area: 'site', name: 'Site margin', units: '$k/d', digits: 0, tau: 1800, range: [-800, 1500], target: (_, b) => b.margin / 1000 },
]

export const TAG = Object.fromEntries(TAGS.map((t) => [t.id, t])) as Record<string, TagDef>

export type TagValues = Record<string, number>

export function tagTargets(p: Plant, b: SiteBalance): TagValues {
  return Object.fromEntries(TAGS.map((t) => [t.id, t.target(p, b)]))
}

/** Moves every tag towards its target over `seconds`, each at its own pace. */
export function lagTags(values: TagValues, targets: TagValues, seconds: number): TagValues {
  const out: TagValues = {}
  for (const t of TAGS) {
    const v = values[t.id]
    const target = targets[t.id]
    out[t.id] = v === undefined || t.tau === 0 ? target : v + (target - v) * (1 - Math.exp(-seconds / t.tau))
  }
  return out
}

/* ---------------- Alarms ---------------- */

export type Priority = 'high' | 'medium' | 'low'

export interface DcsAlarm {
  id: string
  tag?: string
  area: UnitArea
  text: string
  priority: Priority
  /** Simulated seconds when it came in. */
  time: number
  active: boolean
  acked: boolean
  /** Shelved until this simulated time: hidden, and not raised again. */
  shelvedUntil?: number
}

/** How long a shelved alarm stays shelved, simulated seconds. */
export const SHELVE_SECONDS = 3600
const ALARM_LIMIT = 60

interface Condition {
  id: string
  tag?: string
  area: UnitArea
  text: string
  priority: Priority
}

/** Every alarm condition standing now: tags past their limits, and the units' own warnings. */
export function alarmConditions(values: TagValues, p: Plant, b: SiteBalance): Condition[] {
  const out: Condition[] = []
  for (const t of TAGS) {
    const v = values[t.id]
    if (v === undefined) continue
    const f = (x: number) => `${x.toFixed(t.digits)} ${t.units}`
    if (t.hh !== undefined && v >= t.hh) out.push({ id: `${t.id}-HH`, tag: t.id, area: t.area, text: `${t.id} ${t.name} high-high: ${f(v)}`, priority: 'high' })
    else if (t.hi !== undefined && v >= t.hi) out.push({ id: `${t.id}-H`, tag: t.id, area: t.area, text: `${t.id} ${t.name} high: ${f(v)}`, priority: 'medium' })
    if (t.ll !== undefined && v <= t.ll) out.push({ id: `${t.id}-LL`, tag: t.id, area: t.area, text: `${t.id} ${t.name} low-low: ${f(v)}`, priority: 'high' })
    else if (t.lo !== undefined && v <= t.lo) out.push({ id: `${t.id}-L`, tag: t.id, area: t.area, text: `${t.id} ${t.name} low: ${f(v)}`, priority: 'medium' })
  }
  if (p.furnace.tripped) out.push({ id: 'TZA-101', area: 'cdu', text: 'TZA-101 crude furnace tripped: fuel gas shut off', priority: 'high' })
  if (p.tanks.starved) out.push({ id: 'PLANT-STOP', area: 'tanks', text: 'Crude tank at its heel: plant shut down', priority: 'high' })
  const u = b.units
  const warn = (area: UnitArea, prefix: string, warnings: string[]) =>
    warnings.forEach((w, i) => out.push({ id: `${prefix}-${i}-${w.slice(0, 24)}`, area, text: w, priority: 'low' }))
  warn('fcc', 'FCC', u.treating.conversion.fcc.warnings)
  warn('fcc', 'VDU', u.treating.conversion.vdu.warnings)
  warn('reformer', 'REF', [...u.treating.reforming.nht.warnings, ...u.treating.reforming.reformer.warnings])
  warn('treating', 'TRT', [...u.treating.dht.warnings, ...u.treating.sru.warnings])
  warn('lightEnds', 'LE', [...u.gasPlant.warnings, ...u.alky.warnings])
  if (!u.petrol.blend.onSpec) out.push({ id: 'BLEND-P', area: 'blending', text: 'Petrol blend off spec: selling as blendstock', priority: 'medium' })
  if (!u.diesel.blend.onSpec) out.push({ id: 'BLEND-D', area: 'blending', text: 'Diesel blend off spec: selling as blendstock', priority: 'medium' })
  return out
}

/** Raises new alarms, clears gone ones (kept until acknowledged), and drops cleared, acknowledged ones. */
export function updateDcsAlarms(alarms: DcsAlarm[], conditions: Condition[], time: number): DcsAlarm[] {
  const now = new Set(conditions.map((c) => c.id))
  let next = alarms
    .map((a) => (a.shelvedUntil !== undefined && a.shelvedUntil <= time ? { ...a, shelvedUntil: undefined } : a))
    .map((a) => (a.active && !now.has(a.id) ? { ...a, active: false } : a))
    .filter((a) => a.active || !a.acked)
  for (const c of conditions) {
    const existing = next.find((a) => a.id === c.id)
    if (!existing) next = [{ ...c, time, active: true, acked: false }, ...next]
    else if (!existing.active) next = next.map((a) => (a === existing ? { ...a, ...c, active: true, acked: false, time } : a))
  }
  return next.slice(0, ALARM_LIMIT)
}

/* ---------------- Advanced control ---------------- */

export interface ApcSettings {
  /** Push the cat cracker's feed up to its tightest constraint. */
  fcc: boolean
  /** Hold reformate octane at a target by moving the reactor inlets. */
  reformer: boolean
  octaneTarget: number
  /** What each controller last did, for the screen. */
  fccStatus: string
  reformerStatus: string
}

export const APC_START: ApcSettings = { fcc: false, reformer: false, octaneTarget: 98, fccStatus: 'Off', reformerStatus: 'Off' }

/** APC runs once a simulated minute: small, careful moves, the way real constraint controllers do. */
export const APC_PERIOD = 60
const FCC_MOVE = 0.5
const WAIT_MOVE = 0.5

/** Margins below each limit the controller keeps, so the plant isn't run right on the edge. */
const FCC_MARGINS = { regen: 8, air: 0.97, gas: 0.97 }

function fccHeadroom(p: Plant, feed: number) {
  const vdu = conversionResult(p).vdu
  const fcc = runFcc({ ...p.fcc, feed }, { carbon: vdu.carbon, metals: vdu.metals, crackability: vdu.crackability })
  const limits: [string, boolean][] = [
    ['regenerator temperature', fcc.regenTemp <= FCC_LIMITS.regenMax - FCC_MARGINS.regen],
    ['air blower', fcc.air <= FCC_LIMITS.airMax * FCC_MARGINS.air],
    ['wet gas compressor', fcc.gas <= FCC_LIMITS.gasMax * FCC_MARGINS.gas],
    ['slide valve', fcc.limited === null],
    ['feed limit', feed <= FCC_LIMITS.feed.max],
  ]
  return limits.find(([, ok]) => !ok)?.[0] ?? null
}

/** One move of each controller that's on. Returns the plant with its new settings and status lines. */
export function runApc(p: Plant): Plant {
  let next = p
  const apc = { ...p.apc }
  if (apc.fcc) {
    const now = fccHeadroom(p, p.fcc.feed)
    if (now) {
      const feed = Math.max(FCC_LIMITS.feed.min, p.fcc.feed - FCC_MOVE)
      next = { ...next, fcc: { ...next.fcc, feed } }
      apc.fccStatus = `Backing off: at the ${now} limit. Feed ${feed.toFixed(1)} kb/d.`
    } else {
      const blocked = fccHeadroom(p, p.fcc.feed + FCC_MOVE)
      if (blocked) apc.fccStatus = `Holding ${p.fcc.feed.toFixed(1)} kb/d: the ${blocked} is the active constraint.`
      else {
        next = { ...next, fcc: { ...next.fcc, feed: p.fcc.feed + FCC_MOVE } }
        apc.fccStatus = `Pushing feed up to ${(p.fcc.feed + FCC_MOVE).toFixed(1)} kb/d: no constraint reached.`
      }
    }
  }
  if (apc.reformer) {
    // The controller acts on its model's prediction of where octane will settle, not the lagging analyser, so it doesn't overshoot.
    const octane = reformingResult(p).reformer.octane
    const error = apc.octaneTarget - octane
    if (Math.abs(error) < 0.15) apc.reformerStatus = `On target: heading for ${octane.toFixed(1)} RON at ${p.reformer.wait.toFixed(1)} °C.`
    else {
      const wait = Math.min(REFORMER_LIMITS.waitMax, Math.max(REFORMER_LIMITS.wait.min, p.reformer.wait + Math.sign(error) * WAIT_MOVE))
      if (wait === p.reformer.wait) apc.reformerStatus = `Can't reach ${apc.octaneTarget} RON: the inlets are at their ${error > 0 ? 'metal limit' : 'minimum'}.`
      else {
        next = { ...next, reformer: { ...next.reformer, wait } }
        apc.reformerStatus = `${error > 0 ? 'Raising' : 'Lowering'} the inlets to ${wait.toFixed(1)} °C: the model predicts ${octane.toFixed(1)}.`
      }
    }
  }
  return { ...next, apc }
}
