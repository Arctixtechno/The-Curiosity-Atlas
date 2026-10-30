// Safe systems of work: permits to work, a HAZOP on one node of the crude
// unit, and the incidents that taught the industry why both matter.

export interface Control {
  id: string
  label: string
  /** Whether this job needs it. */
  needed: boolean
  why: string
}

export interface GasTest {
  lel: number
  oxygen: number
  h2s: number
  /** Whether the readings are safe for this job. */
  safe: boolean
  why: string
}

export interface PermitJob {
  id: string
  title: string
  /** Hot work, cold work or confined space entry. */
  type: string
  where: string
  description: string
  controls: Control[]
  gas: GasTest
}

/** Gas test limits most sites use: below 10% of the lower explosive limit (1% for entry), oxygen 19.5–23.5%, H₂S under 5 ppm. */
export const GAS_LIMITS = { lel: 10, lelEntry: 1, oxygenMin: 19.5, oxygenMax: 23.5, h2s: 5 }

export const PERMIT_JOBS: PermitJob[] = [
  {
    id: 'valve',
    title: 'Replace a leaking valve on the naphtha rundown line',
    type: 'Cold work',
    where: 'Crude unit, naphtha rundown to tankage',
    description: 'A gate valve on the naphtha line from the reflux drum weeps at its gland. A fitter will unbolt it and fit a new one.',
    controls: [
      { id: 'isolate', label: 'Isolate the line both sides and fit blinds', needed: true, why: 'A closed valve can pass. Blinds make the isolation positive.' },
      { id: 'drain', label: 'Drain and flush the line to the closed drain', needed: true, why: 'Naphtha left in the line would spill when the valve comes out.' },
      { id: 'lock', label: 'Lock and tag every isolation', needed: true, why: 'So nobody reopens a valve while the line is open.' },
      { id: 'gas', label: 'Test for gas before breaking the joint', needed: true, why: 'Naphtha vapour is flammable well below the level anyone can smell.' },
      { id: 'tools', label: 'Use non-sparking tools and an intrinsically safe torch', needed: true, why: 'There may still be vapour about.' },
      { id: 'fire-watch', label: 'Post a fire watch with an extinguisher', needed: false, why: 'There is no flame or spark from this job: it is cold work.' },
      { id: 'standby', label: 'A standby attendant at a vessel entrance', needed: false, why: 'Nobody is entering a confined space.' },
    ],
    gas: { lel: 2, oxygen: 20.9, h2s: 0, safe: true, why: '2% of the lower explosive limit is under the 10% most sites allow for breaking into a line.' },
  },
  {
    id: 'weld',
    title: 'Weld a pipe support near the LPG spheres',
    type: 'Hot work',
    where: 'Gas plant, beside the LPG spheres',
    description: 'A support under a fire water line has corroded through. A welder will cut it out and weld in a new one, ten metres from the spheres.',
    controls: [
      { id: 'hot', label: 'Issue a hot work permit, signed by the area authority', needed: true, why: 'Any flame or spark near hydrocarbons needs the area’s owner to agree.' },
      { id: 'gas-cont', label: 'Test for gas continuously while work goes on', needed: true, why: 'A leak elsewhere can bring gas to the welder at any moment.' },
      { id: 'drains', label: 'Cover the drains and sewers within 15 m', needed: true, why: 'Heavy LPG vapour runs into drains, and sparks fall into them.' },
      { id: 'watch', label: 'Post a fire watch with an extinguisher, staying 30 minutes after', needed: true, why: 'Smouldering fires often start after the welder leaves.' },
      { id: 'screens', label: 'Put up fire blankets and screens to catch the sparks', needed: true, why: 'Welding spatter travels metres.' },
      { id: 'drain-line', label: 'Drain the fire water line', needed: false, why: 'The support is under the line, not in it. Keep fire water live by the spheres.' },
      { id: 'ba', label: 'Breathing apparatus for the welder', needed: false, why: 'Outdoors with gas testing, it isn’t needed. Welding fume is handled by standing upwind.' },
    ],
    gas: { lel: 0, oxygen: 20.9, h2s: 0, safe: true, why: 'No flammable gas at all. Hot work can start, with the detector left running.' },
  },
  {
    id: 'vessel',
    title: 'Inspect inside the sour water stripper’s feed drum',
    type: 'Confined space entry',
    where: 'Sulphur plant, sour water drum D-1101',
    description: 'An inspector will climb inside the empty drum to measure its wall thickness.',
    controls: [
      { id: 'blind', label: 'Blind every line into the drum', needed: true, why: 'Nothing must be able to flow in while someone is inside.' },
      { id: 'steam', label: 'Steam out, then ventilate with fresh air', needed: true, why: 'Clears the H₂S and hydrocarbon, then brings the oxygen back.' },
      { id: 'test', label: 'Test the atmosphere at the top, middle and bottom', needed: true, why: 'Gases layer: H₂S is heavier than air and pools at the bottom.' },
      { id: 'attendant', label: 'A trained attendant at the manway the whole time', needed: true, why: 'The attendant watches, keeps count and calls the rescue team. They never go in.' },
      { id: 'rescue', label: 'A rescue plan and equipment at the manway', needed: true, why: 'Most confined space deaths are would-be rescuers who went in unprotected.' },
      { id: 'monitor', label: 'A personal H₂S monitor on the entrant', needed: true, why: 'Sour water drums can release H₂S from scale as it is disturbed.' },
      { id: 'hot-permit', label: 'A hot work permit', needed: false, why: 'Measuring wall thickness makes no spark.' },
    ],
    gas: {
      lel: 0,
      oxygen: 19.1,
      h2s: 3,
      safe: false,
      why: 'Oxygen at 19.1% is below the 19.5% minimum: something is still displacing the air. Ventilate longer and test again before anyone enters.',
    },
  },
]

export interface PermitCheck {
  missed: Control[]
  unneeded: Control[]
  gasRight: boolean
  passed: boolean
}

/** Checks the controls a trainee chose for a job and their call on the gas test. */
export function checkPermit(job: PermitJob, chosen: ReadonlySet<string>, gasSafe: boolean): PermitCheck {
  const missed = job.controls.filter((c) => c.needed && !chosen.has(c.id))
  const unneeded = job.controls.filter((c) => !c.needed && chosen.has(c.id))
  const gasRight = gasSafe === job.gas.safe
  return { missed, unneeded, gasRight, passed: missed.length === 0 && gasRight }
}

export interface Deviation {
  guide: string
  parameter: string
  cause: string
  consequence: string
  safeguard: string
}

/** The HAZOP node: the crude column's reflux drum and pump. */
export const HAZOP_NODE = {
  name: 'Crude column overhead: reflux drum D-101 and reflux pump P-102',
  intent: 'Condense the column’s overhead vapour, separate the water, and pump naphtha back as reflux and forward to rundown.',
}

export const DEVIATIONS: Deviation[] = [
  {
    guide: 'No',
    parameter: 'Flow (reflux)',
    cause: 'The reflux pump trips',
    consequence: 'The column top heats up and the naphtha goes off spec',
    safeguard: 'Low-flow alarm and an auto-start spare pump',
  },
  {
    guide: 'More',
    parameter: 'Pressure',
    cause: 'The overhead air cooler’s fans stop',
    consequence: 'The drum and column are over-pressured',
    safeguard: 'Relief valve to the flare',
  },
  {
    guide: 'More',
    parameter: 'Level',
    cause: 'The naphtha rundown valve fails shut',
    consequence: 'Liquid carries over into the fuel gas system',
    safeguard: 'High-level alarm and an independent high-high trip',
  },
  {
    guide: 'Less',
    parameter: 'Level',
    cause: 'The level control valve fails wide open',
    consequence: 'Gas blows through into the naphtha tank',
    safeguard: 'Low-low level trip that shuts the outlet',
  },
  {
    guide: 'Other than',
    parameter: 'Composition (water)',
    cause: 'Condensed stripping steam builds up in the boot',
    consequence: 'Water in the naphtha corrodes and makes the pump cavitate',
    safeguard: 'Boot level control drawing off the water',
  },
  {
    guide: 'Reverse',
    parameter: 'Flow',
    cause: 'The idle pump’s check valve passes',
    consequence: 'The idle pump spins backwards and the drum drains back',
    safeguard: 'A check valve on each pump’s discharge, tested at turnarounds',
  },
]

export type HazopColumn = 'cause' | 'consequence' | 'safeguard'

/** Three choices for one cell: the right answer and two from other deviations, in a fixed shuffled order. */
export function hazopOptions(index: number, column: HazopColumn): string[] {
  const n = DEVIATIONS.length
  const right = DEVIATIONS[index][column]
  const others = [DEVIATIONS[(index + 2) % n][column], DEVIATIONS[(index + 4) % n][column]]
  const at = (index + (column === 'cause' ? 0 : column === 'consequence' ? 1 : 2)) % 3
  const options = [...others]
  options.splice(at, 0, right)
  return options
}

export interface Incident {
  id: string
  name: string
  date: string
  place: string
  toll: string
  what: string
  causes: string[]
  lessons: string[]
  /** Which part of the safety screen practises it. */
  practise: 'drills' | 'flare' | 'permits' | 'hazop'
}

export const INCIDENTS: Incident[] = [
  {
    id: 'texas-city',
    name: 'Texas City refinery explosion',
    date: '23 March 2005',
    place: 'BP Texas City refinery, Texas',
    toll: '15 killed, about 180 injured',
    what: 'During the start-up of the isomerisation unit, the raffinate splitter tower was overfilled with liquid for hours. When it relieved, hydrocarbon went to a blowdown drum and stack open to the air, overflowed it and formed a vapour cloud that exploded. Most of those killed were in temporary trailers close by.',
    causes: [
      'A level gauge that read within range while the tower filled up',
      'Start-up procedures not followed, and operators tired after long runs of shifts',
      'An atmospheric blowdown stack instead of a flare',
      'Occupied trailers sited close to the unit',
    ],
    lessons: ['Send relief to a flare, not to the air', 'Keep people out of harm’s way during start-ups', 'Measure process safety, not just slips and trips'],
    practise: 'flare',
  },
  {
    id: 'buncefield',
    name: 'Buncefield oil depot explosion',
    date: '11 December 2005',
    place: 'Hertfordshire Oil Storage Terminal, England',
    toll: '43 injured; nobody killed. The biggest fire in peacetime Europe',
    what: 'A petrol tank being filled overnight overflowed: its level gauge had stuck and its independent high-level switch didn’t work. Petrol cascaded down the tank and formed a vapour cloud that exploded early on a Sunday morning.',
    causes: ['A level gauge that stuck, often, and wasn’t fixed', 'An independent high-level switch that couldn’t trip', 'Bunds that didn’t hold the burning fuel and fire water'],
    lessons: ['Independent overfill protection that is tested', 'Know your tank levels and how long a tank takes to fill', 'Containment that holds'],
    practise: 'drills',
  },
  {
    id: 'piper-alpha',
    name: 'Piper Alpha',
    date: '6 July 1988',
    place: 'North Sea oil and gas platform',
    toll: '167 killed',
    what: 'A condensate pump’s pressure safety valve had been taken off for maintenance and its opening blanked. The night shift didn’t know, and when the other pump tripped they started this one. Gas leaked from the blank and exploded, and fires fed from connected platforms destroyed the platform.',
    causes: ['A permit to work that didn’t reach the night shift', 'Two pieces of work on one pump that nobody linked', 'Fire water pumps on manual control because divers were in the water'],
    lessons: ['A permit system that everyone uses and every handover covers', 'Isolations visible on the plant, not just on paper', 'The UK’s safety case regime came from the inquiry'],
    practise: 'permits',
  },
  {
    id: 'flixborough',
    name: 'Flixborough',
    date: '1 June 1974',
    place: 'Nypro chemical works, Lincolnshire',
    toll: '28 killed',
    what: 'A cracked reactor in a train of six was taken out and replaced by a temporary bypass pipe, built without a proper design. Two months later the pipe failed and tens of tonnes of hot cyclohexane escaped. The cloud exploded and destroyed the plant.',
    causes: ['A temporary modification made with no engineering design or review', 'No qualified mechanical engineer on site at the time', 'An occupied control room close to the plant'],
    lessons: ['Management of change: every modification is designed and reviewed', 'Review hazards systematically, the way a HAZOP does', 'Site control rooms to withstand an explosion'],
    practise: 'hazop',
  },
]
