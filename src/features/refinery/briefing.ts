import { rankOf, type Medal } from './career.ts'
import { liveFlare } from './drills.ts'
import { dateOf } from './market.ts'
import type { Plant } from './plant.ts'
import type { SafetyState } from './safetyStore.ts'
import { SHIFTS } from './shifts.ts'
import type { ShiftState } from './shiftStore.ts'
import { siteBalance } from './site.ts'
import { PLAN_UNITS, unitStatus } from './sitePlan.ts'
import { money } from './ui.tsx'
import { compassName, windOn } from './weather.ts'

// The briefing you get away from the site: on the drive there, on the drive
// home and on the house map. What the plant is doing, and the one or two
// things most worth doing next, worked out from everything you've done.

export type Tone = 'good' | 'warn' | 'bad' | 'plain'

export interface BriefingFact {
  label: string
  value: string
  tone: Tone
}

export interface Briefing {
  /** One line on how the site is. */
  headline: string
  facts: BriefingFact[]
  /** The most useful things to do next, most pressing first: at most three. */
  next: string[]
  rank: { title: string; points: number; max: number; toNext: number | null; nextTitle: string | null }
}

export function briefing(p: Plant, s: SafetyState, sh: Pick<ShiftState, 'active' | 'best'>, medalList: Medal[]): Briefing {
  const b = siteBalance(p)
  const wind = windOn(p.tanks.day)
  const open = p.dcsAlarms.filter((a) => !a.acked && a.shelvedUntil === undefined)
  const high = open.filter((a) => a.priority === 'high').length
  const flare = liveFlare(s, p.furnace.time)
  const statuses = PLAN_UNITS.filter((u) => !u.building).map((u) => ({ u, st: unitStatus(u, p, s) }))
  const inAlarm = statuses.filter((x) => x.st === 'alarm')
  const off = statuses.filter((x) => x.st === 'off')
  const r = rankOf(medalList)

  const facts: BriefingFact[] = [
    { label: 'Plant day', value: `${Math.floor(p.tanks.day) + 1} · ${dateOf(p.tanks.day)}`, tone: 'plain' },
    { label: 'Site margin', value: `${money(b.margin)}/day`, tone: b.margin < 0 ? 'bad' : 'good' },
    { label: 'Alarms waiting', value: open.length ? `${open.length}${high ? `, ${high} high` : ''}` : 'none', tone: high ? 'bad' : open.length ? 'warn' : 'good' },
    { label: 'Wind', value: `${compassName(wind.from)}, ${wind.speed.toFixed(0)} m/s`, tone: 'plain' },
    { label: 'Flare', value: flare > 5 ? `burning ${flare.toFixed(0)} t/h` : 'pilot only', tone: flare > 5 ? 'warn' : 'good' },
  ]

  const next: string[] = []
  if (sh.active) {
    const shift = SHIFTS.find((x) => x.id === sh.active!.id)
    const left = Math.max(0, (shift?.length ?? 0) - (p.furnace.time - sh.active.startedAt))
    next.push(`Your “${shift?.title ?? 'shift'}” shift is still running, ${Math.ceil(left / 60)} plant minutes to handover.`)
  }
  if (p.furnace.tripped) next.push('The crude furnace has tripped and is waiting for a restart from the crude unit screen.')
  else if (high) next.push(`${high === 1 ? 'A high-priority alarm is' : `${high} high-priority alarms are`} waiting in the control room.`)
  else if (inAlarm.length) next.push(`${inAlarm.map((x) => x.u.name).slice(0, 2).join(' and ')} ${inAlarm.length === 1 ? 'is' : 'are'} in alarm.`)
  if (off.length) next.push(`${off.map((x) => x.u.name).join(', ')} ${off.length === 1 ? 'is' : 'are'} shut down: the heavy-end screen starts ${off.length === 1 ? 'it' : 'them'} up.`)
  if (b.margin < 0) next.push('The site is losing money: plan the blends on the blending screen to put it back in profit.')
  const untried = SHIFTS.find((x) => !(sh.best[x.id] > 0))
  const short = SHIFTS.find((x) => (sh.best[x.id] ?? 0) > 0 && sh.best[x.id] < 3)
  if (!sh.active && untried) next.push(`The “${untried.title}” shift (${untried.when.toLowerCase()}) is waiting at the shift desk.`)
  else if (!sh.active && short) next.push(`“${short.title}” has ${sh.best[short.id]} of 3 stars: take it again for a clean handover.`)
  const nextMedal = medalList.find((m) => m.tier === 'none') ?? medalList.find((m) => m.tier !== 'gold')
  if (r.next && nextMedal) next.push(`${r.next.points - r.points} more logbook point${r.next.points - r.points === 1 ? '' : 's'} to ${r.next.title}: try “${nextMedal.title}”.`)

  const trouble = p.furnace.tripped || high > 0 || inAlarm.length > 0
  const headline = trouble
    ? 'Marshgate needs you: something is in alarm.'
    : b.margin < 0
      ? 'Marshgate is running, but losing money.'
      : `Marshgate is running steadily, making ${money(b.margin)} a day.`

  return {
    headline,
    facts,
    next: next.slice(0, 3),
    rank: { title: r.rank.title, points: r.points, max: r.max, toNext: r.next ? r.next.points - r.points : null, nextTitle: r.next?.title ?? null },
  }
}
