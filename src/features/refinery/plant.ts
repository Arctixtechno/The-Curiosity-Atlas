import { useSyncExternalStore } from 'react'
import { CDU_LIMITS, CDU_START, runCdu, type CduInputs, type CduResult, type SteamLevel } from './cdu.ts'
import type { CrudeId } from './crudes.ts'
import { measured, RELIGHT_BELOW, startFurnace, stepFurnace, valveFor, type FurnaceState, type Mode, type Tuning } from './furnace.ts'

// The live crude unit: the furnace simulation plus the column's settings,
// shared by the operator's panel and the 3D site (which glows with the
// furnace's firing). It runs only while the panel is open, so walking round
// the site costs nothing, and the plant waits where you left it.

export interface ColumnSettings {
  topTemp: number
  keroDraw: number
  dieselDraw: number
  steam: SteamLevel
}

export interface Sample {
  time: number
  pv: number
  sp: number
  op: number
}

export interface Alarm {
  id: string
  /** Simulated seconds when it came in. */
  time: number
  text: string
  priority: 'high' | 'low'
  active: boolean
}

export interface Plant {
  furnace: FurnaceState
  column: ColumnSettings
  /** One sample every SAMPLE_EVERY simulated seconds, newest last. */
  history: Sample[]
  alarms: Alarm[]
  /** Simulated seconds per real second. */
  speed: number
  paused: boolean
}

export const SPEEDS = [1, 10, 30]
/** Simulated seconds between trend samples, and how many are kept (30 minutes). */
const SAMPLE_EVERY = 10
export const HISTORY_SECONDS = 30 * 60

function fresh(): Plant {
  const furnace = startFurnace(CDU_START.crude, CDU_START.feed, CDU_START.cot)
  const { topTemp, keroDraw, dieselDraw, steam } = CDU_START
  return {
    furnace,
    column: { topTemp, keroDraw, dieselDraw, steam },
    // Start with half an hour of steady running on the trend, as if you'd taken over mid-shift.
    history: Array.from({ length: HISTORY_SECONDS / SAMPLE_EVERY + 1 }, (_, i) => ({
      time: (i - HISTORY_SECONDS / SAMPLE_EVERY) * SAMPLE_EVERY,
      pv: furnace.outlet,
      sp: furnace.setpoint,
      op: furnace.valve,
    })),
    alarms: [],
    speed: 10,
    paused: false,
  }
}

let plant = fresh()
const listeners = new Set<() => void>()

function publish(next: Plant) {
  plant = next
  listeners.forEach((l) => l())
}

export const getPlant = () => plant

export function usePlant<T>(selector: (p: Plant) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => selector(plant),
  )
}

/** The column's inputs as they stand, with the furnace outlet at its true temperature. */
export function cduInputs(p: Plant = plant): CduInputs {
  return { crude: p.furnace.crude, feed: p.furnace.feed, cot: p.furnace.outlet, ...p.column }
}

/** What the column is making right now. */
export function currentResult(p: Plant = plant): CduResult {
  return runCdu(cduInputs(p))
}

/** Advances the simulation by `realSeconds` of wall-clock time at the plant's speed. */
export function advancePlant(realSeconds: number) {
  if (plant.paused) return
  const steps = Math.min(600, Math.round(realSeconds * plant.speed + carry))
  carry = realSeconds * plant.speed + carry - steps
  if (steps <= 0) return
  let furnace = plant.furnace
  const history = [...plant.history]
  for (let i = 0; i < steps; i++) {
    furnace = stepFurnace(furnace)
    if (furnace.time % SAMPLE_EVERY === 0)
      history.push({ time: furnace.time, pv: measured(furnace), sp: furnace.setpoint, op: furnace.valve })
  }
  while (history.length && history[0].time < furnace.time - HISTORY_SECONDS) history.shift()
  const next = { ...plant, furnace, history }
  publish({ ...next, alarms: updateAlarms(next) })
}
let carry = 0

const ALARM_LIMIT = 30

/** Raises alarms that have just come in and clears ones that have gone. */
function updateAlarms(p: Plant): Alarm[] {
  const f = p.furnace
  const r = currentResult(p)
  const conditions: Omit<Alarm, 'time' | 'active'>[] = []
  if (f.tripped)
    conditions.push({ id: 'trip', text: 'TZA-101 furnace tripped: fuel gas shut off on high-high outlet temperature', priority: 'high' })
  else if (f.outlet >= CDU_LIMITS.cot.coking)
    conditions.push({ id: 'cot-hi', text: `TIC-101 outlet high (${CDU_LIMITS.cot.coking} °C): coking risk in the tubes`, priority: 'high' })
  else if (f.outlet < 345) conditions.push({ id: 'cot-lo', text: 'TIC-101 outlet low (345 °C)', priority: 'low' })
  if (f.valve >= 98 && f.mode === 'auto') conditions.push({ id: 'op-hi', text: 'TIC-101 output at its limit: valve wide open', priority: 'low' })
  if (r.starved) conditions.push({ id: 'dry', text: 'LI-104 diesel draw tray level low: not enough vapour lifted', priority: 'high' })
  for (const product of Object.values(r.products))
    for (const spec of product.specs)
      if (!spec.ok) conditions.push({ id: `spec-${product.id}-${spec.name}`, text: `${product.id} off spec: ${spec.name.toLowerCase()}`, priority: 'low' })

  const now = new Set(conditions.map((c) => c.id))
  const alarms = p.alarms.map((a) => (a.active && !now.has(a.id) ? { ...a, active: false } : a))
  for (const c of conditions)
    if (!alarms.some((a) => a.active && a.id === c.id)) alarms.unshift({ ...c, time: f.time, active: true })
  return alarms.slice(0, ALARM_LIMIT)
}

function setFurnace(change: Partial<FurnaceState>) {
  publish({ ...plant, furnace: { ...plant.furnace, ...change } })
}

export const controls = {
  setColumn(change: Partial<ColumnSettings>) {
    const column = { ...plant.column, ...change }
    publish({ ...plant, column, alarms: updateAlarms({ ...plant, column }) })
  },
  setCrude(crude: CrudeId) {
    setFurnace({ crude })
  },
  setFeed(feed: number) {
    setFurnace({ feed })
  },
  setSetpoint(setpoint: number) {
    if (plant.furnace.mode === 'auto') setFurnace({ setpoint: Math.min(CDU_LIMITS.cot.max, Math.max(CDU_LIMITS.cot.min, setpoint)) })
  },
  setMode(mode: Mode) {
    if (plant.furnace.tripped && mode === 'auto') return
    setFurnace({ mode, setpoint: mode === 'auto' ? Math.round(measured(plant.furnace) * 10) / 10 : plant.furnace.setpoint })
  },
  setValve(valve: number) {
    if (plant.furnace.mode === 'manual' && !plant.furnace.tripped) setFurnace({ valve })
  },
  setTuning(change: Partial<Tuning>) {
    setFurnace({ tuning: { ...plant.furnace.tuning, ...change } })
  },
  toggleFouling() {
    const d = plant.furnace.disturbances
    setFurnace({ disturbances: { ...d, fouling: d.fouling ? 0 : 15 } })
  },
  toggleLeanFuel() {
    const d = plant.furnace.disturbances
    setFurnace({ disturbances: { ...d, fuelQuality: d.fuelQuality < 1 ? 1 : 0.9 } })
  },
  /** Relights a tripped furnace once it has cooled, in manual at the valve that would hold the design temperature. */
  relight() {
    const f = plant.furnace
    if (!f.tripped || f.outlet > RELIGHT_BELOW) return
    setFurnace({ tripped: false, mode: 'manual', valve: Math.round(valveFor(f.crude, f.feed, 340, f.disturbances)) })
  },
  setSpeed(speed: number) {
    publish({ ...plant, speed })
  },
  togglePause() {
    publish({ ...plant, paused: !plant.paused })
  },
  reset() {
    carry = 0
    publish(fresh())
  },
}
