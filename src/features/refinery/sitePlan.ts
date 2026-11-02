import { REFINERY } from '../../rooms/dimensions.ts'
import { stationReadings, STATIONS, type ReadingState } from './fieldReadouts.ts'
import {
  ACADEMY_OVERLAY,
  BLENDING_OVERLAY,
  CDU_OVERLAY,
  CONVERSION_OVERLAY,
  DCS_OVERLAY,
  HEAVY_END_OVERLAY,
  LIGHT_ENDS_OVERLAY,
  REFORMER_OVERLAY,
  SAFETY_OVERLAY,
  SITE_OVERLAY,
  TREATING_OVERLAY,
} from './overlayIds.ts'
import type { Plant } from './plant.ts'
import type { SafetyState } from './safetyStore.ts'

// The site plan: every unit drawn where it stands, coloured by how it's
// running, so you can see the whole site at a glance and walk straight to
// any part of it.

export type PlanShape = { kind: 'rect'; size: [number, number] } | { kind: 'circle'; radius: number }

export interface PlanUnit {
  id: string
  name: string
  at: [number, number]
  shape: PlanShape
  /** The field readouts it shares, if any. */
  station?: string
  overlay?: string
  /** Not a process unit: drawn plainer, and has no running state. */
  building?: boolean
}

const r = REFINERY

export const PLAN_UNITS: PlanUnit[] = [
  { id: 'furnace', name: 'Crude furnace', at: r.furnace.at, shape: { kind: 'rect', size: r.furnace.size }, station: 'cdu', overlay: CDU_OVERLAY },
  { id: 'column', name: 'Crude column', at: r.column.at, shape: { kind: 'circle', radius: r.column.radius }, station: 'cdu', overlay: CDU_OVERLAY },
  { id: 'vacuum', name: 'Vacuum unit', at: r.vacuum.at, shape: { kind: 'circle', radius: r.vacuum.radius }, station: 'fcc', overlay: CONVERSION_OVERLAY },
  { id: 'fcc', name: 'Cat cracker', at: r.fcc.at, shape: { kind: 'rect', size: [r.fcc.size, r.fcc.size] }, station: 'fcc', overlay: CONVERSION_OVERLAY },
  { id: 'reformer', name: 'Reformer', at: r.reformer.at, shape: { kind: 'rect', size: r.reformer.size }, station: 'reformer', overlay: REFORMER_OVERLAY },
  { id: 'treating', name: 'Treating and sulphur', at: r.treating.at, shape: { kind: 'rect', size: r.treating.size }, station: 'treating', overlay: TREATING_OVERLAY },
  { id: 'lightEnds', name: 'Gas plant, isom, alky', at: r.lightEnds.at, shape: { kind: 'rect', size: r.lightEnds.size }, station: 'lightEnds', overlay: LIGHT_ENDS_OVERLAY },
  { id: 'coker', name: 'Coker', at: r.coker.at, shape: { kind: 'rect', size: r.coker.size }, station: 'coker', overlay: HEAVY_END_OVERLAY },
  { id: 'hydrocracker', name: 'Hydrocracker', at: r.hydrocracker.at, shape: { kind: 'rect', size: r.hydrocracker.size }, station: 'hydrocracker', overlay: HEAVY_END_OVERLAY },
  { id: 'smr', name: 'Hydrogen plant', at: r.smr.at, shape: { kind: 'rect', size: r.smr.size }, station: 'smr', overlay: HEAVY_END_OVERLAY },
  { id: 'blending', name: 'Blending', at: r.blending.at, shape: { kind: 'rect', size: r.blending.size }, station: 'blending', overlay: BLENDING_OVERLAY },
  ...r.tanks.map((t): PlanUnit => ({ id: `tank-${t.tank}`, name: `${t.label} tank`, at: t.at, shape: { kind: 'circle', radius: r.tankRadius }, station: 'tanks', overlay: SITE_OVERLAY })),
  { id: 'flare', name: 'Flare', at: r.flare, shape: { kind: 'circle', radius: 1.4 }, station: 'flare', overlay: SAFETY_OVERLAY },
  { id: 'control', name: 'Control room', at: r.controlRoom.at, shape: { kind: 'rect', size: r.controlRoom.size }, station: 'control', overlay: DCS_OVERLAY, building: true },
  { id: 'training', name: 'Training centre and planning office', at: r.training.at, shape: { kind: 'rect', size: r.training.size }, overlay: ACADEMY_OVERLAY, building: true },
]

export type UnitStatus = 'running' | 'warning' | 'alarm' | 'off'

/** How a unit is doing: off if it's shut down, otherwise the worst of its readings. */
export function unitStatus(u: PlanUnit, p: Plant, s: SafetyState): UnitStatus {
  if (u.id === 'coker' && !p.coker.running) return 'off'
  if (u.id === 'hydrocracker' && !p.hydrocracker.running) return 'off'
  if (u.id === 'smr' && !p.smr.running) return 'off'
  if ((u.id === 'furnace' || u.id === 'column') && p.furnace.tripped) return 'alarm'
  const station = STATIONS.find((st) => st.id === u.station)
  if (!station) return 'running'
  // The tank farm's station reads every tank; each tank on the plan is judged by its own level.
  const readings = stationReadings(station, p, s).filter((x) => !u.id.startsWith('tank-') || x.label.toLowerCase().includes(u.name.split(' ')[0].toLowerCase()))
  const worst = (states: ReadingState[]) => (states.some((x) => x === 'hh' || x === 'll') ? 'alarm' : states.some((x) => x === 'hi' || x === 'lo') ? 'warning' : 'running')
  return worst(readings.map((x) => x.state))
}

/** A spot to stand at, a few metres from a unit on the side towards the main road junction, and the way to face it. */
export function standingSpot(u: PlanUnit): { at: [number, number]; yaw: number } {
  const half = u.shape.kind === 'circle' ? u.shape.radius : Math.max(...u.shape.size) / 2
  const junction: [number, number] = [0, 11]
  const dx = junction[0] - u.at[0]
  const dz = junction[1] - u.at[1]
  const d = Math.hypot(dx, dz) || 1
  const away = Math.min(d, half + 3.5)
  const at: [number, number] = [u.at[0] + (dx / d) * away, u.at[1] + (dz / d) * away]
  return { at, yaw: Math.atan2(-(u.at[0] - at[0]), -(u.at[1] - at[1])) }
}
