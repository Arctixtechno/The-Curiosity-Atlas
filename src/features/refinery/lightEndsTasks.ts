import { octaneGiveaway } from './blending.ts'
import { GAS_PLANT_LIMITS } from './lightEnds.ts'
import type { LightEndsResult } from './lightEndsPlant.ts'
import type { Plant } from './plant.ts'
import type { Task } from './ui.tsx'

// Shift tasks for the light ends and the blenders. Each is done the moment
// its condition is met; the blending ones ask for a recipe you set by hand,
// not the planner's.

export const LIGHT_ENDS_TASKS: Task<Plant, LightEndsResult>[] = [
  {
    id: 'gp-lean',
    title: 'Just enough reflux',
    task: 'Make on-spec propane (2.5% butane at most) with the depropaniser’s reboiler at 5.3 MW or less.',
    hint: 'Every bit of reflux has to be boiled up again by the reboiler. Find the least reflux that still keeps the butane out of the propane: watch the purity curve.',
    met: (_, r) => r.gasPlant.butaneInPropane <= GAS_PLANT_LIMITS.butaneInPropaneMax && r.gasPlant.duty <= 5.3,
  },
  {
    id: 'isom-best',
    title: 'Squeeze the isomerate',
    task: 'Make isomerate of at least 87.5 research octane.',
    hint: 'Equilibrium wants it cold, the catalyst wants it warm: the best once-through octane is where the two curves cross. Then send the straight-chain hexanes round again.',
    met: (p, r) => p.isom.running && r.isom.octane >= 87.5,
  },
  {
    id: 'alky-quality',
    title: 'Top-grade alkylate',
    task: 'Make alkylate of 97 research octane or better while using no more than 18 tonnes of fresh acid a day.',
    hint: 'Cold, plenty of isobutane and strong acid all favour alkylation over polymerisation. Strong acid costs more makeup, but a cold reactor uses less.',
    met: (_, r) => r.alky.octane >= 97 && r.alky.acidUse <= 18,
  },
  {
    id: 'alky-propylene',
    title: 'Propylene too',
    task: 'Send the propylene to alkylation as well and still make alkylate of 95 octane or better.',
    hint: 'Propylene alkylate has poorer octane than butylene alkylate. Make up for it with everything else that helps quality.',
    met: (p, r) => p.alky.propylene && r.alky.octane >= 95,
  },
]

export const BLENDING_TASKS: Task<Plant, LightEndsResult>[] = [
  {
    id: 'blend-95',
    title: 'Your first blend',
    task: 'Blend summer Premium 95 that meets every spec, with a recipe you set yourself.',
    hint: 'Start with everything in and look at what fails. Butane raises vapour pressure, cat gasoline brings olefins and sulphur, reformate brings aromatics and benzene, and ethanol is the strongest octane booster.',
    met: (p, r) => p.blend.grade === 'premium' && p.blend.season === 'summer' && !p.blend.planned.petrol && r.petrol.blend.onSpec,
  },
  {
    id: 'blend-giveaway',
    title: 'No giveaway',
    task: 'Blend Premium 95 by hand with no more than 0.3 octane to spare on research or motor octane, whichever is tighter, earning at least 90% of what the planner would.',
    hint: 'Octane above spec is octane given away for free. One of the two octane tests always pinches first (here it is usually motor octane): bring in cheaper, lower-octane components until that one sits right on its limit.',
    met: (p, r) => p.blend.grade === 'premium' && !p.blend.planned.petrol && r.petrol.blend.onSpec && octaneGiveaway(r.petrol.blend) <= 0.3 && r.petrol.blend.margin >= 0.9 * r.petrol.best.margin,
  },
  {
    id: 'blend-98',
    title: 'Super 98',
    task: 'Blend Super 98 that meets every spec.',
    hint: 'Alkylate and ethanol carry octane without aromatics or olefins. Expect to make much less of it.',
    met: (p, r) => p.blend.grade === 'super' && r.petrol.blend.onSpec,
  },
  {
    id: 'blend-winter',
    title: 'Winter diesel',
    task: 'Switch to winter and blend road diesel that won’t wax up, meeting every spec.',
    hint: 'Kerosene has almost no wax and brings the cloud point down, but it lowers cetane and density and is worth more as jet.',
    met: (p, r) => p.blend.season === 'winter' && r.diesel.blend.onSpec,
  },
]
