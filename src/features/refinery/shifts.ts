import { CDU_LIMITS } from './cdu.ts'
import { measured } from './furnace.ts'
import { BLENDING_OVERLAY, CDU_OVERLAY, CONVERSION_OVERLAY, DCS_OVERLAY, PLANNING_OVERLAY, TREATING_OVERLAY } from './overlayIds.ts'
import { lightEndsResult } from './lightEndsPlant.ts'
import { controls, getPlant, type Plant } from './plant.ts'
import type { SiteBalance } from './site.ts'
import { SRU_LIMITS } from './treating.ts'

// Shifts: short scenarios that hand you the whole live plant with something
// about to happen (a sour cargo, a summer market, a fouling exchanger), and
// score you on the things a shift team is judged on: products on spec,
// emissions inside the permit, the furnace safe and the margin. Each starts
// from the same plant, so a shift plays the same way every time, and the
// site is handed back as you left it afterwards.

export interface ShiftContext {
  /** The site margin when the shift started, dollars a day. */
  startMargin: number
}

export interface ShiftGoal {
  id: string
  text: string
  /**
   * `always`: held for nearly all the shift (from `from` seconds in); `never` is broken by a single slip; `end`: true
   * when the shift ends.
   */
  kind: 'always' | 'never' | 'end'
  from?: number
  check: (p: Plant, b: SiteBalance, c: ShiftContext) => boolean
  /** What a good shift does to meet it, for the report. */
  how: string
}

export interface ShiftEvent {
  /** Simulated seconds into the shift. */
  at: number
  text: string
  apply?: () => void
}

export interface Shift {
  id: string
  title: string
  /** When it is, for the card: "Night shift". */
  when: string
  brief: string
  /** Simulated seconds. */
  length: number
  /** Puts the plant into the shift's starting state, from a fresh plant. */
  setup: () => void
  events: ShiftEvent[]
  goals: ShiftGoal[]
  /** The screens the shift is played from. */
  screens: { label: string; overlay: string }[]
}

const SCREENS = {
  cdu: { label: 'Crude unit', overlay: CDU_OVERLAY },
  blending: { label: 'Blending', overlay: BLENDING_OVERLAY },
  treating: { label: 'Treating and sulphur', overlay: TREATING_OVERLAY },
  fcc: { label: 'Cat cracker', overlay: CONVERSION_OVERLAY },
  market: { label: 'Market', overlay: PLANNING_OVERLAY },
  dcs: { label: 'Control room', overlay: DCS_OVERLAY },
}

/** Share of the samples an `always` goal must hold for. */
export const HOLD_SHARE = 0.9
/** Simulated seconds between samples. */
export const SAMPLE_EVERY = 10

/** Both blends as the planner would set them: where a shift team leaves the blenders. */
export function planBlends() {
  const r = lightEndsResult(getPlant())
  const recipe = (pool: typeof r.petrol) => Object.fromEntries(pool.components.map((c, i) => [c.id, pool.best.volumes[i]]))
  controls.applyRecipe('petrol', recipe(r.petrol), true)
  controls.applyRecipe('diesel', recipe(r.diesel), true)
}

const cduOnSpec = (b: SiteBalance) => {
  const cdu = b.units.treating.conversion.cdu
  return !cdu.starved && Object.values(cdu.products).every((x) => x.onSpec)
}
const blendsOnSpec = (b: SiteBalance) => b.units.petrol.blend.onSpec && b.units.diesel.blend.onSpec
const so2Ok = (b: SiteBalance) => b.units.treating.sru.so2 <= SRU_LIMITS.so2Permit
const furnaceSafe = (p: Plant) => !p.furnace.tripped && p.furnace.outlet < CDU_LIMITS.cot.coking

export const SHIFTS: Shift[] = [
  {
    id: 'handover',
    title: 'Taking over',
    when: 'Day shift',
    brief:
      'You’ve taken over a plant that’s losing money: the petrol pool is off spec, so every barrel of it sells cheap as blendstock. Get the site into the black and keep it there, without upsetting the furnace.',
    length: 1800,
    setup: () => undefined,
    screens: [SCREENS.blending, SCREENS.cdu, SCREENS.dcs],
    events: [{ at: 600, text: 'The planners ring: they’d like the site above $400k a day by the end of the shift.' }],
    goals: [
      { id: 'black', text: 'End the shift with a site margin above $400k a day', kind: 'end', check: (_, b) => b.margin >= 400_000, how: 'Blend both pools on spec: the planner on the blending screen finds a recipe in one press.' },
      { id: 'spec', text: 'Petrol and diesel on spec at handover', kind: 'end', check: (_, b) => blendsOnSpec(b), how: 'Re-plan the blends after any change upstream: the components change with it.' },
      { id: 'safe', text: 'Never trip or coke the furnace', kind: 'never', check: (p) => furnaceSafe(p), how: 'Leave the furnace in automatic and change its setpoint in small steps.' },
    ],
  },
  {
    id: 'sour',
    title: 'Sour crude',
    when: 'Night shift',
    brief:
      'A cargo of Maya, heavy and sour, has been pumped into the crude tank, and the crude unit switches over to it five minutes in. It holds four times Brent’s sulphur and far less diesel. Keep the sulphur plant inside its permit and the products on spec.',
    length: 3000,
    setup: () => planBlends(),
    screens: [SCREENS.treating, SCREENS.cdu, SCREENS.blending],
    events: [
      { at: 300, text: 'The crude unit is on Maya now: watch the sulphur plant and the draw trays.', apply: () => controls.setCrude('maya') },
      { at: 1500, text: 'The environment agency’s inspector is on site tomorrow: SO₂ will be checked against the permit.' },
    ],
    goals: [
      { id: 'so2', text: 'SO₂ from the sulphur plant inside its permit, from ten minutes after the switch', kind: 'always', from: 900, check: (_, b) => so2Ok(b), how: 'Put the third converter and the tail gas unit on: Maya brings four times the sulphur.' },
      { id: 'cdu', text: 'Every crude unit product on spec and no dry draw tray at handover', kind: 'end', check: (_, b) => cduOnSpec(b), how: 'Draw what Maya holds: far less diesel and kerosene than Brent, or a hotter furnace to lift more.' },
      { id: 'blends', text: 'Petrol and diesel on spec at handover', kind: 'end', check: (_, b) => blendsOnSpec(b), how: 'Re-plan both blends once the new crude’s components have settled.' },
      { id: 'safe', text: 'Never trip or coke the furnace', kind: 'never', check: (p) => furnaceSafe(p), how: 'Keep the outlet below the coking limit if you raise it to lift more.' },
    ],
  },
  {
    id: 'summer',
    title: 'Driving season',
    when: 'Day shift, July',
    brief:
      'It’s the height of the summer driving season and the site is trading at market prices: petrol’s crack is at its best of the year. Make the most of it, by $150k a day more than you started with, without breaking the sulphur plant’s permit.',
    length: 2400,
    screens: [SCREENS.fcc, SCREENS.treating, SCREENS.blending, SCREENS.market],
    setup: () => {
      planBlends()
      controls.setMarket({ live: true })
      // Mid-July on the market's calendar.
      const p = getPlant()
      controls.replace({ ...p, tanks: { ...p.tanks, day: 195 } })
    },
    events: [{ at: 900, text: 'Trading: the petrol crack is up again today. Every extra barrel of on-spec petrol counts.' }],
    goals: [
      { id: 'margin', text: 'Lift the site margin by $150k a day by handover', kind: 'end', check: (_, b, c) => b.margin >= c.startMargin + 150_000, how: 'Crack more gas oil into petrol: raise the cat cracker’s feed, then re-plan the petrol blend.' },
      { id: 'spec', text: 'Petrol and diesel on spec at handover', kind: 'end', check: (_, b) => blendsOnSpec(b), how: 'Re-plan the blends after every change upstream.' },
      { id: 'so2', text: 'SO₂ inside the permit all shift', kind: 'always', check: (_, b) => so2Ok(b), how: 'More cracking sends more sulphur to the sulphur plant: add a converter before you push the cracker.' },
    ],
  },
  {
    id: 'fouling',
    title: 'Dirty exchangers',
    when: 'Night shift, winter',
    brief:
      'The preheat exchangers have fouled, so the crude reaches the furnace 15 °C cooler, and the fuel gas is going lean as the gas plant’s feed changes. Hold the furnace outlet steady in automatic and keep the crude rate up. The controller’s usual tuning is too gentle for this.',
    length: 1800,
    setup: () => controls.toggleFouling(),
    screens: [SCREENS.cdu, SCREENS.dcs],
    events: [{ at: 600, text: 'The fuel gas has gone lean: each cubic metre now gives a tenth less heat.', apply: () => controls.toggleLeanFuel() }],
    goals: [
      {
        id: 'steady',
        text: 'Outlet within 2 °C of its setpoint, in automatic, nearly all shift',
        kind: 'always',
        from: 120,
        check: (p) => p.furnace.mode === 'auto' && !p.furnace.tripped && Math.abs(measured(p.furnace) - p.furnace.setpoint) <= 2,
        how: 'Tighten TIC-101 on the crude unit screen: about twice the gain and a two-minute integral. Push it much further and it starts to hunt.',
      },
      { id: 'rate', text: 'Crude rate at 100 kb/d or more at handover', kind: 'end', check: (p) => p.furnace.feed >= 100, how: 'Don’t cut the rate to cope: the furnace has the duty to spare.' },
      { id: 'safe', text: 'Never trip or coke the furnace', kind: 'never', check: (p) => furnaceSafe(p), how: 'In manual, the valve has to be moved by hand for every disturbance.' },
    ],
  },
]

export interface ShiftRun {
  id: string
  /** Plant time when it started. */
  startedAt: number
  context: ShiftContext
  /** Plant time of the last sample. */
  sampledAt: number
  /** For each `always` and `never` goal, samples taken since its start and how many it held for. */
  held: Record<string, { samples: number; met: number }>
  /** How many of the events have happened. */
  fired: number
  marginSum: number
  samples: number
  /** Highest furnace outlet seen, °C. */
  peakOutlet: number
}

export interface ShiftResult {
  id: string
  goals: { id: string; met: boolean; detail: string }[]
  stars: number
  averageMargin: number
  peakOutlet: number
}

export function startRun(shift: Shift, p: Plant, b: SiteBalance): ShiftRun {
  return {
    id: shift.id,
    startedAt: p.furnace.time,
    context: { startMargin: b.margin },
    sampledAt: p.furnace.time - SAMPLE_EVERY,
    held: Object.fromEntries(shift.goals.filter((g) => g.kind !== 'end').map((g) => [g.id, { samples: 0, met: 0 }])),
    fired: 0,
    marginSum: 0,
    samples: 0,
    peakOutlet: p.furnace.outlet,
  }
}

/** Takes a sample if one is due: each goal checked against the plant now. */
export function sampleRun(shift: Shift, run: ShiftRun, p: Plant, b: SiteBalance): ShiftRun {
  if (p.furnace.time - run.sampledAt < SAMPLE_EVERY) return run
  const into = p.furnace.time - run.startedAt
  const held = { ...run.held }
  for (const g of shift.goals) {
    if (g.kind === 'end' || into < (g.from ?? 0)) continue
    const h = held[g.id]
    held[g.id] = { samples: h.samples + 1, met: h.met + (g.check(p, b, run.context) ? 1 : 0) }
  }
  return { ...run, sampledAt: p.furnace.time, held, marginSum: run.marginSum + b.margin, samples: run.samples + 1, peakOutlet: Math.max(run.peakOutlet, p.furnace.outlet) }
}

/** How a goal stands so far: met, broken or not yet decided. */
export function goalState(sh: Shift, g: ShiftGoal, run: ShiftRun, p: Plant, b: SiteBalance): 'met' | 'failing' | 'broken' | 'waiting' {
  if (g.kind === 'end') return g.check(p, b, run.context) ? 'met' : 'failing'
  const h = run.held[g.id]
  if (!h || h.samples === 0) return 'waiting'
  if (g.kind === 'never') return h.met < h.samples ? 'broken' : 'met'
  // Broken once too many samples have missed for the share to be reached by the end.
  const total = Math.max(1, Math.round((sh.length - (g.from ?? 0)) / SAMPLE_EVERY))
  if (h.samples - h.met > total * (1 - HOLD_SHARE)) return 'broken'
  return g.check(p, b, run.context) ? 'met' : 'failing'
}

/** The report when the shift ends: each goal met or not, and stars for how many were. */
export function finishRun(sh: Shift, run: ShiftRun, p: Plant, b: SiteBalance): ShiftResult {
  const goals = sh.goals.map((g) => {
    if (g.kind === 'end') {
      const met = g.check(p, b, run.context)
      return { id: g.id, met, detail: met ? 'Met at handover' : 'Not met at handover' }
    }
    const h = run.held[g.id] ?? { samples: 0, met: 0 }
    const share = h.samples ? h.met / h.samples : 1
    const met = g.kind === 'never' ? h.met === h.samples : share >= HOLD_SHARE
    return { id: g.id, met, detail: g.kind === 'never' ? (met ? 'Never broken' : 'Broken during the shift') : `Held ${Math.round(share * 100)}% of the time` }
  })
  const missed = goals.filter((g) => !g.met).length
  const stars = missed === 0 ? 3 : missed === 1 ? 2 : missed < goals.length ? 1 : 0
  return { id: sh.id, goals, stars, averageMargin: run.samples ? run.marginSum / run.samples : b.margin, peakOutlet: run.peakOutlet }
}
