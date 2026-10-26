import type { Plant, ReformingResult } from './plant.ts'
import { REFORMER_LIMITS } from './reformer.ts'

// Shift tasks for the naphtha hydrotreater and reformer. Like the cat
// cracker's, they are done the moment their condition is met; the catalyst
// cycle task looks back over the whole run since the last regeneration.

export interface ReformingTask {
  id: string
  title: string
  task: string
  hint: string
  met: (plant: Plant, result: ReformingResult) => boolean
}

const clean = (r: ReformingResult) => r.feed.sulphur <= REFORMER_LIMITS.sulphurMax
const safe = (p: Plant) => p.reformer.wait <= REFORMER_LIMITS.waitMax

export const REFORMING_TASKS: ReformingTask[] = [
  {
    id: 'ref-98',
    title: 'Premium octane',
    task: 'The blenders want reformate of at least 98 research octane, at no less than 87 wt% yield, from clean feed.',
    hint: 'Hotter reactors convert more paraffins to aromatics, which carry the octane. They also crack more of them to LPG, so the yield falls.',
    met: (p, r) => r.reformer.octane >= 98 && r.reformer.yields.reformate >= 87 && clean(r) && safe(p),
  },
  {
    id: 'ref-hydrogen',
    title: 'Hydrogen for the hydrotreaters',
    task: 'The diesel hydrotreater needs more hydrogen. Make at least 75 tonnes a day while keeping reformate yield at 90 wt% or more.',
    hint: 'Turning paraffins into aromatics gives off hydrogen; cracking them uses it up. Lower pressure favours the first and slows the second, at the price of faster coking.',
    met: (p, r) => r.reformer.hydrogen >= 75 && r.reformer.yields.reformate >= 90 && clean(r) && safe(p),
  },
  {
    id: 'ref-arab',
    title: 'Paraffinic feed',
    task: 'Run Arab Light, whose naphtha is mostly paraffins, and still make 98 octane reformate at no less than 85 wt% yield.',
    hint: 'Paraffins are the hard molecules to reform, so you need heat; watch the yield. Lower pressure helps the paraffins cyclise rather than crack. Check the sulphur too: Arab Light is sour.',
    met: (p, r) => p.furnace.crude === 'arabLight' && r.reformer.octane >= 98 && r.reformer.yields.reformate >= 85 && clean(r) && safe(p),
  },
  {
    id: 'ref-cycle',
    title: 'A long run',
    task: 'Run the catalyst for 240 days on Brent without the octane ever falling below 97, or the inlets passing 530 °C.',
    hint: 'Raise the inlet temperatures as the catalyst cokes up to hold the octane. At design pressure the coke wins by about day 200: more hydrogen and more pressure slow the coking.',
    met: (p) =>
      p.furnace.crude === 'brent' &&
      p.catalyst.days >= 240 &&
      p.cycle.length > 1 &&
      p.cycle.every((c) => c.octane >= 97 && c.wait <= REFORMER_LIMITS.waitMax),
  },
]
