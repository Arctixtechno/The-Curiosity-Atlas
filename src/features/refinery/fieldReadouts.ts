import { REFINERY } from '../../rooms/dimensions.ts'
import { TAG, tagTargets, type TagDef } from './dcs.ts'
import { liveFlare } from './drills.ts'
import { flameTilt } from './flare.ts'
import {
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
import { siteBalance } from './site.ts'
import { beaufort, compass, windOn } from './weather.ts'

// The local readouts you'd glance at walking round a unit: the gauges and the
// field display by its ladder. Stand near a unit and its live numbers come up
// in the corner, the same values the control room sees, with their alarm
// state, and a key opens the unit's screen.

export type ReadingState = 'hh' | 'hi' | 'ok' | 'lo' | 'll'

export interface FieldReading {
  label: string
  value: string
  state: ReadingState
  /** Where the value sits in its range, 0 to 1, for a small bar; absent for a reading with no range. */
  share?: number
}

export interface Station {
  id: string
  name: string
  /** Where it stands, [x, z], and how near counts as being at it, m. */
  at: [number, number]
  radius: number
  /** DCS tags shown here. */
  tags: string[]
  /** Readings that aren't DCS tags. */
  extra?: (p: Plant, s: SafetyState) => FieldReading[]
  overlay: string
}

const r = REFINERY

export const STATIONS: Station[] = [
  { id: 'cdu', name: 'Unit 100 · Crude distillation', at: [1, -3.5], radius: 9, tags: ['FI-100', 'TI-101', 'TI-102', 'FI-104'], overlay: CDU_OVERLAY },
  { id: 'fcc', name: 'Unit 300 · Cat cracker', at: r.fcc.at, radius: 9.5, tags: ['FI-301', 'TI-301', 'TI-302', 'FI-303', 'FI-304'], overlay: CONVERSION_OVERLAY },
  { id: 'reformer', name: 'Unit 500 · Reformer', at: r.reformer.at, radius: 8.5, tags: ['TI-501', 'AI-502', 'FI-503'], overlay: REFORMER_OVERLAY },
  { id: 'treating', name: 'Units 600–700 · Treating and sulphur', at: r.treating.at, radius: 7, tags: ['AI-603', 'FI-604', 'AI-701'], overlay: TREATING_OVERLAY },
  { id: 'lightEnds', name: 'Units 800–1000 · Gas plant, isom, alky', at: r.lightEnds.at, radius: 7, tags: ['AI-803', 'AI-1001', 'AI-1002'], overlay: LIGHT_ENDS_OVERLAY },
  { id: 'coker', name: 'Unit 1200 · Delayed coker', at: r.coker.at, radius: 8, tags: ['LI-1201'], overlay: HEAVY_END_OVERLAY },
  { id: 'hydrocracker', name: 'Unit 1300 · Hydrocracker', at: r.hydrocracker.at, radius: 7, tags: ['TI-1302', 'AI-1303'], overlay: HEAVY_END_OVERLAY },
  { id: 'smr', name: 'Unit 1400 · Hydrogen plant', at: r.smr.at, radius: 6.5, tags: ['TI-1401'], overlay: HEAVY_END_OVERLAY },
  { id: 'blending', name: 'Unit 1100 · Blending', at: r.blending.at, radius: 5.5, tags: ['AI-1101', 'AI-1102', 'LI-petrol'], overlay: BLENDING_OVERLAY },
  { id: 'tanks', name: 'Tank farm', at: [22, 15], radius: 9, tags: ['LI-crude', 'LI-diesel', 'LI-vgo', 'LI-fuelOil'], overlay: SITE_OVERLAY },
  {
    id: 'control',
    name: 'Control room',
    at: r.controlRoom.at,
    radius: 8.5,
    tags: ['MARGIN'],
    extra: (p) => {
      const open = p.dcsAlarms.filter((a) => !a.acked && a.shelvedUntil === undefined)
      const high = open.some((a) => a.priority === 'high')
      return [{ label: 'Alarms waiting', value: open.length ? `${open.length}${high ? ', high priority' : ''}` : 'none', state: high ? 'hh' : open.length ? 'hi' : 'ok' }]
    },
    overlay: DCS_OVERLAY,
  },
  {
    id: 'flare',
    name: 'Flare',
    at: r.flare,
    radius: 13,
    tags: [],
    extra: (p, s) => {
      const load = liveFlare(s, p.furnace.time)
      const wind = windOn(p.tanks.day)
      const lean = (flameTilt(load, wind.speed) * 180) / Math.PI
      return [
        { label: 'Burning', value: `${load.toFixed(1)} t/h`, state: load > 5 ? 'hi' : 'ok', share: Math.min(1, load / 260) },
        { label: 'Wind', value: `${compass(wind.from)} ${wind.speed.toFixed(0)} m/s, ${beaufort(wind.speed).name.toLowerCase()}`, state: 'ok', share: Math.min(1, wind.speed / 20) },
        { label: 'Flame leans', value: `${lean.toFixed(0)}° downwind`, state: 'ok' },
      ]
    },
    overlay: SAFETY_OVERLAY,
  },
]

/** The station you're standing at: the nearest one whose radius you're inside, or null. */
export function stationAt(x: number, z: number): Station | null {
  let best: Station | null = null
  let bestShare = Infinity
  for (const s of STATIONS) {
    // Measured as a share of each station's radius, so a small unit next to a big one still wins when you're at it.
    const share = Math.hypot(x - s.at[0], z - s.at[1]) / s.radius
    if (share <= 1 && share < bestShare) {
      best = s
      bestShare = share
    }
  }
  return best
}

/** A value's alarm state against its tag's limits. */
export function tagState(t: TagDef, v: number): ReadingState {
  if (t.hh !== undefined && v >= t.hh) return 'hh'
  if (t.ll !== undefined && v <= t.ll) return 'll'
  if (t.hi !== undefined && v >= t.hi) return 'hi'
  if (t.lo !== undefined && v <= t.lo) return 'lo'
  return 'ok'
}

/** Everything the station shows now: its DCS tags as the control room sees them, then its other readings. */
export function stationReadings(station: Station, p: Plant, s: SafetyState): FieldReading[] {
  // Before the DCS has run its first scan, the readings are worked out from the plant directly.
  const values = station.tags.every((id) => p.tags[id] !== undefined) ? p.tags : tagTargets(p, siteBalance(p))
  const tags = station.tags.flatMap((id): FieldReading[] => {
    const t = TAG[id]
    const v = values[id]
    if (v === undefined || Number.isNaN(v)) return []
    const [lo, hi] = t.range
    return [{ label: t.name, value: `${v.toFixed(t.digits)} ${t.units}`, state: tagState(t, v), share: Math.max(0, Math.min(1, (v - lo) / (hi - lo))) }]
  })
  return [...tags, ...(station.extra?.(p, s) ?? [])]
}
