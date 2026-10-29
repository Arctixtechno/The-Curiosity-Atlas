import { controls, getPlant } from './plant.ts'
import type { SafetyState } from './safetyStore.ts'

// Emergency drills and procedures, run on the live plant. A drill puts a real
// upset on the plant, then the trainee picks actions from a list: the right
// ones in the right order before the deadline keep the plant safe; wrong ones
// are logged with why. Pure logic here; the running drill lives in safetyStore.ts.

export interface DrillAction {
  id: string
  label: string
  /** Where it comes in the right sequence, from 1; null for an action that's wrong. */
  step: number | null
  why: string
  /** What it does to the plant. */
  effect?: () => void
  /** Relief it sends to the flare while the drill runs, t/h. */
  flare?: number
}

export interface Drill {
  id: string
  title: string
  kind: 'emergency' | 'procedure'
  /** What the board says when it starts. */
  alarm: string
  briefing: string
  /** The upset, put on the live plant. */
  start?: () => void
  actions: DrillAction[]
  /** Plant seconds to finish the right actions before it escalates; null for a procedure with no clock. */
  deadline: number | null
  escalation: string
  /** What escalating does to the plant. */
  escalate?: () => void
  /** Relief to the flare once escalated, until the drill is finished, t/h. */
  flare: number
  /** Puts the plant back afterwards. */
  restore?: () => void
  debrief: string
}

const manualAt = (valve: number) => {
  controls.setMode('manual')
  controls.setValve(valve)
}

const backToAuto = (setpoint = 360) => {
  controls.setMode('auto')
  controls.setSetpoint(setpoint)
}

export const DRILLS: Drill[] = [
  {
    id: 'charge-pump',
    title: 'Crude charge pump trips',
    kind: 'emergency',
    alarm: 'FAL-100 LOW CRUDE FLOW · P-101A TRIPPED',
    briefing:
      'The crude charge pump has tripped and the booster pump alone is pushing 35 kb/d through the furnace. The burners are still firing for 100. With so little oil in the tubes, the tube metal heats up fast.',
    start: () => controls.setFeed(35),
    actions: [
      { id: 'cut-firing', label: 'Put TIC-101 in manual and cut the fuel valve to 25%', step: 1, why: 'Less flow needs less fire. Full firing on a third of the flow overheats the tubes and cokes them.', effect: () => manualAt(25) },
      { id: 'start-spare', label: 'Start the spare charge pump, P-101B', step: 2, why: 'The spare is lined up and ready for exactly this. The field operator checks it once it runs.' },
      { id: 'restore-feed', label: 'Bring the crude rate back up to 100 kb/d', step: 3, why: 'With the spare running, the flow can come back.', effect: () => controls.setFeed(100) },
      { id: 'back-auto', label: 'Put TIC-101 back in automatic at 360 °C', step: 4, why: 'The controller takes the outlet back to its setpoint now the flow is steady.', effect: () => backToAuto() },
      { id: 'raise-sp', label: 'Raise the outlet setpoint to keep the products on spec', step: null, why: 'Firing harder with little flow is how furnace tubes rupture. Off-spec product is the least of the worries.' },
      { id: 'cut-steam', label: 'Shut off the stripping steam', step: null, why: 'It doesn’t touch the danger, which is in the furnace tubes.' },
      { id: 'walk-out', label: 'Leave the board and go out to look at the pump', step: null, why: 'The panel operator stays at the board in an upset. A field operator goes to the pump.' },
    ],
    deadline: 180,
    escalation: 'The coil low-flow trip fired and shut the furnace down. The crude unit is off line and will take a shift to restart.',
    flare: 0,
    restore: () => {
      controls.setFeed(100)
      backToAuto()
    },
    debrief: 'Low flow through a fired heater is one of the most dangerous upsets on a refinery. Cut the fire first, then restore the flow.',
  },
  {
    id: 'flame-out',
    title: 'Fuel gas goes lean: flame-out',
    kind: 'emergency',
    alarm: 'BAL-101 FLAME FAILURE · B-101 BURNERS 3 AND 4',
    briefing:
      'The fuel gas has gone lean and two of the furnace’s burners have blown out. Gas is still flowing to them, into a firebox hot enough to light it at any moment.',
    start: () => controls.toggleLeanFuel(),
    actions: [
      { id: 'close-fuel', label: 'Put TIC-101 in manual and close the fuel valve', step: 1, why: 'Stop the gas first. Unburnt fuel building up in a hot firebox is what explodes.', effect: () => manualAt(0) },
      { id: 'purge', label: 'Purge the firebox with air: five volume changes', step: 2, why: 'The purge sweeps out any gas that collected before a flame comes near it.' },
      { id: 'swap-fuel', label: 'Swap to the backup fuel gas supply', step: 3, why: 'Relighting on the same lean gas would blow the burners out again.', effect: () => controls.toggleLeanFuel() },
      { id: 'pilots', label: 'Prove the pilots are alight', step: 4, why: 'Main burners are only lit from proven pilots.' },
      { id: 'relight', label: 'Relight the main burners and bring the outlet back slowly', step: 5, why: 'A slow warm-up spares the tubes and refractory a thermal shock.', effect: () => backToAuto() },
      { id: 'open-fuel', label: 'Open the fuel valve wider to keep the flames alight', step: null, why: 'More gas into a firebox with burners out is the worst thing you can do.' },
      { id: 'relight-now', label: 'Relight straight away to save the production', step: null, why: 'Without a purge, the gas already in the firebox can explode on relight. Many furnace explosions began this way.' },
    ],
    deadline: 120,
    escalation: 'Gas collected in the firebox and lit with a bang: the explosion doors blew open. Nobody was hurt this time, but the furnace needs inspecting before it runs again.',
    escalate: () => manualAt(0),
    flare: 0,
    restore: () => {
      if (getPlant().furnace.disturbances.fuelQuality < 1) controls.toggleLeanFuel()
      backToAuto()
    },
    debrief: 'With a flame-out: stop the fuel, purge, then relight from proven pilots. Never relight a hot firebox without purging it.',
  },
  {
    id: 'h2s-leak',
    title: 'H₂S leak at the sulphur plant',
    kind: 'emergency',
    alarm: 'AAH-1105 H₂S 50 PPM · SULPHUR PLANT NORTH',
    briefing:
      'A gas detector by the sulphur plant’s acid gas line reads 50 ppm of hydrogen sulphide and rising. The wind is from the south-west. Two fitters are working nearby.',
    actions: [
      { id: 'alarm', label: 'Sound the toxic gas alarm', step: 1, why: 'Everyone near needs to know at once. Seconds count with H₂S.' },
      { id: 'muster', label: 'Send everyone to the upwind muster point', step: 2, why: 'Upwind, the gas blows away from you. The two fitters are counted at the muster point.' },
      { id: 'isolate', label: 'Close the acid gas emergency valve from the board and send the gas to the flare', step: 3, why: 'Stop the leak from a safe place. The flare burns the acid gas to SO₂ while the line is isolated.', flare: 8 },
      { id: 'ba-team', label: 'Send the response team in wearing breathing apparatus', step: 4, why: 'Only with their own air supply can anyone go near a toxic leak.' },
      { id: 'sniff', label: 'Send someone to find the leak by smell', step: null, why: 'Above about 100 ppm H₂S deadens the sense of smell: the gas seems to vanish as it becomes deadly.' },
      { id: 'downwind', label: 'Muster at the nearest point, downwind of the plant', step: null, why: 'Downwind is where the gas goes.' },
      { id: 'hand-valve', label: 'Send a fitter to shut the hand valve by the leak', step: null, why: 'Nobody approaches a toxic release without breathing apparatus.' },
    ],
    deadline: 90,
    escalation: 'The gas reached the fitters before they were warned: one was overcome and carried out by the response team. He recovered in hospital.',
    flare: 0,
    debrief: 'With toxic gas: raise the alarm, get people upwind, isolate from a safe place, and go in only with breathing apparatus.',
  },
  {
    id: 'cooling-water',
    title: 'Cooling water fails at the crude column',
    kind: 'emergency',
    alarm: 'PAH-102 COLUMN TOP PRESSURE HIGH · CW PUMP P-901 TRIPPED',
    briefing:
      'The cooling water pump has tripped. The crude column’s overhead is no longer being condensed, and its top pressure is climbing towards the relief valves’ set pressure.',
    actions: [
      { id: 'cut-fire', label: 'Cut the furnace firing to make less vapour', step: 1, why: 'Every tonne of vapour the furnace makes must go somewhere. Less heat in means less to relieve.', effect: () => manualAt(30) },
      { id: 'cut-feed', label: 'Cut the crude rate to 60 kb/d', step: 2, why: 'Less feed lowers the vapour load further.', effect: () => controls.setFeed(60) },
      { id: 'vent', label: 'Open the overhead to the flare under pressure control', step: 3, why: 'A controlled release to the flare holds the pressure below the relief valves’ setting.', flare: 40 },
      { id: 'standby', label: 'Start the standby cooling water pump', step: 4, why: 'With cooling back, the overhead condenses again.' },
      { id: 'recover', label: 'Bring the unit back to normal once the pressure falls', step: 5, why: 'Normal rates once the cause is fixed.', effect: () => {
        controls.setFeed(100)
        backToAuto()
      } },
      { id: 'block-in', label: 'Close the overhead vapour line to hold the pressure in', step: null, why: 'A blocked outlet is the classic overpressure case: the relief valves would lift at once.' },
      { id: 'more-reflux', label: 'Raise the reflux to cool the top', step: null, why: 'The reflux comes from the condenser that just lost its cooling.' },
    ],
    deadline: 150,
    escalation: 'The relief valves lifted: about 120 tonnes an hour of hydrocarbon went to the flare until the pressure fell. The flare held, as designed.',
    flare: 120,
    restore: () => {
      controls.setFeed(100)
      backToAuto()
    },
    debrief: 'Loss of cooling is a design case for the relief valves and flare. Cutting the heat early keeps them from lifting.',
  },
  {
    id: 'shutdown',
    title: 'Shut the crude unit down for a turnaround',
    kind: 'procedure',
    alarm: 'PLANNED SHUTDOWN · CDU-100 TURNAROUND',
    briefing:
      'The crude unit is coming down for its four-yearly turnaround. Put the shutdown steps in order. There is no clock, but every step out of order is a real hazard.',
    actions: [
      { id: 'cut-rate', label: 'Cut the crude rate in stages and line the products to slops as they go off spec', step: 1, why: 'Rates come down first, while everything still works.' },
      { id: 'cool', label: 'Lower the furnace outlet at no more than 50 °C an hour', step: 2, why: 'Slow cooling spares the tubes, refractory and column internals.' },
      { id: 'steam-out', label: 'Take out the stripping steam before the column cools below 120 °C', step: 3, why: 'Below that, steam condenses to water, which flashes violently if it meets hot oil later.' },
      { id: 'burners', label: 'Shut the burners and close the fuel gas isolation', step: 4, why: 'The fire goes out while oil still flows through the tubes.' },
      { id: 'pump', label: 'Stop the charge pump once the outlet is below 200 °C', step: 5, why: 'Flow stops only once the coils can no longer coke.' },
      { id: 'drain', label: 'Drain the column to slops and steam it out to the flare', step: 6, why: 'Steaming clears the hydrocarbon so the vessels can be opened.' },
      { id: 'blind', label: 'Fit blinds to isolate the unit from the rest of the site', step: 7, why: 'Positive isolation: a closed valve can pass, a blind can’t.' },
      { id: 'pump-first', label: 'Stop the charge pump first, to stop the feed', step: null, why: 'No flow through a hot, fired furnace cokes and can burst the tubes.' },
      { id: 'open-hot', label: 'Open the column manways to let it cool faster', step: null, why: 'Air into hot hydrocarbon vapour can ignite, and iron sulphide scale catches fire in air.' },
    ],
    deadline: null,
    escalation: '',
    flare: 0,
    debrief: 'Shutdowns and start-ups are when most process incidents happen: the plant is in a state it rarely sees, and the order of steps matters.',
  },
]

export interface TakenAction {
  id: string
  /** Plant seconds into the drill. */
  at: number
}

export interface DrillAssessment {
  /** Right actions taken in order. */
  done: number
  required: number
  /** Each action taken, with whether it was accepted and why. */
  log: { action: DrillAction; at: number; verdict: 'right' | 'early' | 'wrong' | 'repeat' }[]
  status: 'running' | 'safe' | 'escalated' | 'recovered'
  /** Out of 100. */
  score: number
  /** The right action to take next. */
  next: DrillAction | null
}

/** Works out how a drill is going from the actions taken so far and the time since it started. */
export function assessDrill(drill: Drill, taken: TakenAction[], elapsed: number): DrillAssessment {
  const required = drill.actions.filter((a) => a.step !== null).length
  let done = 0
  let finishedAt: number | null = null
  const log: DrillAssessment['log'] = []
  for (const t of taken) {
    const action = drill.actions.find((a) => a.id === t.id)
    if (!action) continue
    let verdict: DrillAssessment['log'][number]['verdict']
    if (action.step === null) verdict = 'wrong'
    else if (action.step <= done) verdict = 'repeat'
    else if (action.step === done + 1) {
      verdict = 'right'
      done++
      if (done === required) finishedAt = t.at
    } else verdict = 'early'
    log.push({ action, at: t.at, verdict })
  }
  const late = drill.deadline !== null && (finishedAt ?? elapsed) > drill.deadline
  const status = finishedAt !== null ? (late ? 'recovered' : 'safe') : late ? 'escalated' : 'running'
  const wrong = log.filter((l) => l.verdict === 'wrong').length
  const early = log.filter((l) => l.verdict === 'early').length
  const score = Math.max(0, 100 - wrong * 15 - early * 10 - (late ? 30 : 0))
  const next = drill.actions.filter((a) => a.step !== null).find((a) => a.step === done + 1) ?? null
  return { done, required, log, status, score, next }
}

/** The relief a running drill sends to the flare, t/h. */
export function drillFlare(drill: Drill, assessment: DrillAssessment): number {
  if (assessment.status === 'safe' || assessment.status === 'recovered') return 0
  const accepted = assessment.log.filter((l) => l.verdict === 'right').reduce((sum, l) => sum + (l.action.flare ?? 0), 0)
  return accepted + (assessment.status === 'escalated' ? drill.flare : 0)
}

/** Gas always flowing to keep air out of the flare header, t/h. */
export const PURGE = 0.5

/** What the flare is burning now, t/h: purge gas, a test firing, and whatever a running drill sends it. */
export function liveFlare(s: SafetyState, now: number): number {
  let load = PURGE
  if (s.flareTest && now < s.flareTest.until) load += s.flareTest.load
  const drill = s.drill && !s.drill.finished ? DRILLS.find((d) => d.id === s.drill!.id) : undefined
  if (drill && s.drill) load += drillFlare(drill, assessDrill(drill, s.drill.taken, now - s.drill.startedAt))
  return load
}
