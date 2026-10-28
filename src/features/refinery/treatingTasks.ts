import type { Plant, TreatingResult } from './plant.ts'
import { SRU_LIMITS } from './treating.ts'

// Shift tasks for the diesel hydrotreater, the hydrogen header and the
// sulphur plant. Each is done as soon as its condition is met.

export interface TreatingTask {
  id: string
  title: string
  task: string
  hint: string
  met: (plant: Plant, result: TreatingResult) => boolean
}

export const TREATING_TASKS: TreatingTask[] = [
  {
    id: 'dht-lco',
    title: 'Upgrade the cycle oil',
    task: 'Take the cat cracker’s light cycle oil into the diesel hydrotreater and keep the diesel at 10 ppm sulphur or less.',
    hint: 'Cycle oil carries more of the hard, shielded sulphur, and its aromatics crowd the catalyst. Hard sulphur answers to temperature and, even more, to hydrogen pressure.',
    met: (p, r) => p.dht.lco && r.dht.onSpec,
  },
  {
    id: 'dht-lean',
    title: 'Go easy on hydrogen',
    task: 'With the cycle oil in, make road diesel while the hydrotreater uses no more than 30 tonnes of hydrogen a day.',
    hint: 'Pressure removes sulphur but also saturates aromatics, which eats hydrogen. Temperature speeds desulphurisation without nearly as much saturation, at the cost of a shorter catalyst run.',
    met: (p, r) => p.dht.lco && r.dht.onSpec && r.dht.hydrogen <= 30,
  },
  {
    id: 'sru-ratio',
    title: 'Two to one',
    task: 'Recover at least 97% of the sulphur in the Claus plant alone, without the tail gas unit.',
    hint: 'The tail gas analyser should read 2:1 H₂S to SO₂: any excess of either leaves unreacted. A third converter takes the reaction closer to equilibrium.',
    met: (p, r) => !p.sru.tailGas && r.sru.recovery >= 97,
  },
  {
    id: 'sru-sour',
    title: 'Sour crude, clean stack',
    task: 'Run Arab Light or Maya and keep the stack inside its SO₂ permit.',
    hint: 'A sour crude sends several times more H₂S to the sulphur plant. Even a perfect Claus plant lets 3% through; the tail gas unit catches nearly all of that and sends it back.',
    met: (p, r) => (p.furnace.crude === 'arabLight' || p.furnace.crude === 'maya') && r.sru.so2 <= SRU_LIMITS.so2Permit,
  },
]
