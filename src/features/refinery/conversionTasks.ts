import type { FccResult } from './fcc.ts'
import { FCC_LIMITS } from './fcc.ts'
import type { ConversionResult, Plant } from './plant.ts'

// Shift tasks for the vacuum unit and cat cracker. These units answer their
// settings at once, so a task is done the moment its condition is met.

export interface ConversionTask {
  id: string
  title: string
  task: string
  hint: string
  met: (plant: Plant, result: ConversionResult) => boolean
}

/** Inside every hard limit: regenerator temperature, air blower, gas compressor and slide valve. */
export function withinLimits(r: FccResult) {
  return r.regenTemp <= FCC_LIMITS.regenMax && r.air <= FCC_LIMITS.airMax && r.gas <= FCC_LIMITS.gasMax && r.limited === null
}

export const CONVERSION_TASKS: ConversionTask[] = [
  {
    id: 'fcc-octane',
    title: 'Octane for the blenders',
    task: 'The petrol blenders are short of octane. Make cat cracked gasoline of at least 92 research octane at 30 kb/d or more, inside every limit.',
    hint: 'A hotter riser makes more olefins and aromatics, which have high octane. It also makes more coke, which heats the regenerator and loads the air blower. Cooler feed lets the slide valve circulate more catalyst.',
    met: (p, r) => p.fcc.feed >= 30 && r.fcc.octane >= 92 && withinLimits(r.fcc),
  },
  {
    id: 'fcc-max-feed',
    title: 'Fill the cracker',
    task: 'Run the cat cracker at 45 kb/d, its hydraulic maximum, inside every limit.',
    hint: 'The air blower runs out first: it has to burn all the coke. Hotter feed needs less heat from the regenerator, so less catalyst circulates, conversion drops a little and less coke is made.',
    met: (p, r) => p.fcc.feed >= 45 && withinLimits(r.fcc),
  },
  {
    id: 'vdu-deep-cut',
    title: 'Deep cut',
    task: 'Lift at least 29.5 kb/d of gas oil from Brent at 100 kb/d of crude, and crack it all inside every limit.',
    hint: 'Lower pressure and stripping steam reach deeper into the residue than a hotter furnace can safely. The deeper cut carries more carbon residue, so the cat cracker makes more coke: give the regenerator somewhere to put the heat.',
    met: (p, r) =>
      p.furnace.crude === 'brent' && p.furnace.feed >= 100 && r.vdu.vgoRate >= 29.5 && p.fcc.feed >= r.vdu.vgoRate && withinLimits(r.fcc),
  },
  {
    id: 'fcc-maya',
    title: 'Sour gas oil',
    task: 'Run Maya through the crude, vacuum and cat cracking units with under 4 ppm of nickel and vanadium in the cracker feed, inside every limit.',
    hint: 'Metals sit in the heaviest molecules. A shallower vacuum cut keeps them in the residue, at the cost of less gas oil.',
    met: (p, r) => p.furnace.crude === 'maya' && r.vdu.metals < 4 && withinLimits(r.fcc),
  },
]
