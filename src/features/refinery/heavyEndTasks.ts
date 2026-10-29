import { COKER_LIMITS, HC_LIMITS, SMR_LIMITS } from './heavyEnd.ts'
import type { Plant, TreatingResult } from './plant.ts'
import type { Task } from './ui.tsx'

// Shift tasks for the coker, hydrocracker and hydrogen plant: newly built,
// so the first job is to bring them on line well.

export const HEAVY_END_TASKS: Task<Plant, TreatingResult>[] = [
  {
    id: 'coker-start',
    title: 'Coke the residue',
    task: 'Run the coker on all the vacuum residue with the drums no more than 90% full at the switch and the coke’s volatile matter at 12% or less.',
    hint: 'Start it up and look at the drum outage and the coke. A longer cycle fills the drum higher; a hotter heater drives more volatile matter out of the coke.',
    met: (p, r) => p.coker.running && r.conversion.coker.feed > 0 && r.conversion.coker.fill <= 0.9 && r.conversion.coker.vcm <= 12 && p.coker.cycle >= COKER_LIMITS.decoke,
  },
  {
    id: 'coker-maya',
    title: 'Heavy, sour and full of carbon',
    task: 'Coke Maya’s residue without foaming over, overloading the coker or leaving the crew less than 14 hours to decoke.',
    hint: 'Maya leaves twice the residue Brent does, and it is twice as rich in carbon. Cut less of it into the vacuum unit’s residue, or take less crude, and keep the cycle as long as the drums allow.',
    met: (p, r) =>
      p.furnace.crude === 'maya' &&
      p.coker.running &&
      r.conversion.coker.fill <= 1 &&
      r.conversion.coker.feed <= COKER_LIMITS.capacity &&
      p.coker.cycle >= COKER_LIMITS.decoke,
  },
  {
    id: 'hc-diesel',
    title: 'Diesel from gas oil',
    task: 'Make 6 kb/d or more of diesel in the hydrocracker, inside its end-of-run temperature and its charge capacity.',
    hint: 'Feed it gas oil and coker gas oil, and set the fractionator for diesel. Pushing conversion per pass too hard turns diesel into naphtha.',
    met: (p, r) =>
      p.hydrocracker.running && r.conversion.hc.rates.diesel >= 6 && p.hydrocracker.temp <= HC_LIMITS.endOfRun && r.conversion.hc.charge <= HC_LIMITS.capacity,
  },
  {
    id: 'hc-extinction',
    title: 'Recycle to extinction',
    task: 'Run the hydrocracker with recycle at 95% overall conversion or more.',
    hint: 'With the unconverted oil going round again, every pass only needs to crack part of it. Raise the temperature a little, and watch the charge against capacity.',
    met: (p, r) => p.hydrocracker.running && p.hydrocracker.recycle && r.conversion.hc.conversion >= 95 && r.conversion.hc.charge <= HC_LIMITS.capacity,
  },
  {
    id: 'smr-own',
    title: 'Our own hydrogen',
    task: 'Run the hydrocracker on 15 kb/d or more of fresh gas oil with every tonne of hydrogen made on site: none bought over the fence.',
    hint: 'Start the hydrogen plant. It follows the header, making whatever the reformer can’t, up to its capacity.',
    met: (p, r) => p.hydrocracker.running && p.hydrocracker.feed >= 15 && r.hydrogen.imported <= 0.01,
  },
  {
    id: 'smr-efficient',
    title: 'Less gas per kilo',
    task: 'Make hydrogen on 160 MJ of natural gas a kilogram or less, with the tubes inside their limit and enough steam to keep carbon off the catalyst.',
    hint: 'Hotter tubes convert more methane, but the tube limit is real. Less steam saves the heat of raising it, down to where carbon starts to form.',
    met: (p, r) =>
      p.smr.running && r.smr.hydrogen > 0 && r.smr.gasPerKg <= 160 && p.smr.outlet <= SMR_LIMITS.tubeLimit && p.smr.steamCarbon >= SMR_LIMITS.carbonLimit,
  },
]
