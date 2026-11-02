import { useSyncExternalStore } from 'react'
import {
  ACADEMY_OVERLAY,
  CDU_OVERLAY,
  CONVERSION_OVERLAY,
  DCS_OVERLAY,
  HEAVY_END_OVERLAY,
  LIGHT_ENDS_OVERLAY,
  OVERVIEW_OVERLAY,
  REFORMER_OVERLAY,
  SAFETY_OVERLAY,
  SITE_OVERLAY,
  TREATING_OVERLAY,
} from './overlayIds.ts'

// A guided walk round Marshgate: eleven stops, each a place to stand and a
// thing to look at, with a few lines on what it does and the screen that runs
// it. Plain data and a tiny store, so the HUD can run it without the plant.

export interface TourStop {
  title: string
  text: string
  /** Where to stand, [x, z], and what to face. */
  at: [number, number]
  look: [number, number]
  overlay?: string
}

export const TOUR: TourStop[] = [
  {
    title: 'Marshgate Refinery',
    text: 'A hundred thousand barrels of crude a day come in by ship, and petrol, diesel, jet and more go out by road, pipe and sea. The site board by the gate shows how every unit connects.',
    at: [-1, 22],
    look: [6, -4],
    overlay: OVERVIEW_OVERLAY,
  },
  {
    title: 'The crude unit',
    text: 'Every barrel starts here. The furnace heats the crude to about 360 °C and the 30-metre column splits it by boiling point into gas, naphtha, kerosene, diesel and residue.',
    at: [0, 11],
    look: [4, -4],
    overlay: CDU_OVERLAY,
  },
  {
    title: 'The control room',
    text: 'Blast-resistant, and the only place the whole site is run from. Every tag, alarm and trend comes to the DCS here, and advanced control nudges the units against their limits.',
    at: [-11, 19.5],
    look: [-17, 14],
    overlay: DCS_OVERLAY,
  },
  {
    title: 'Vacuum unit and cat cracker',
    text: 'The squat vacuum column lifts gas oil out of the residue without cracking it. The cat cracker breaks that gas oil into petrol in two seconds on hot catalyst, and burns the coke off in its regenerator.',
    at: [-7, -6],
    look: [-20, -14],
    overlay: CONVERSION_OVERLAY,
  },
  {
    title: 'The reformer',
    text: 'Three reactors with a furnace before each turn low-octane naphtha into aromatics for petrol, and give off the hydrogen the hydrotreaters need.',
    at: [-3, -10],
    look: [-3, -19],
    overlay: REFORMER_OVERLAY,
  },
  {
    title: 'Hydrotreating and sulphur',
    text: 'Hydrotreaters swap the fuels’ sulphur for hydrogen, making H₂S. The Claus plant burns a third of it and turns the rest into bright yellow sulphur.',
    at: [-14, 2.5],
    look: [-23, -1],
    overlay: TREATING_OVERLAY,
  },
  {
    title: 'Light ends',
    text: 'The gas plant separates propane and butane, isomerisation reshapes light naphtha for octane, and the alkylation unit makes the cleanest petrol component of all.',
    at: [15, 1],
    look: [20, -3],
    overlay: LIGHT_ENDS_OVERLAY,
  },
  {
    title: 'The heavy end',
    text: 'Round the edges, the newest units: the hydrocracker turns gas oil into diesel and jet under hydrogen, the coker turns residue into fuels and solid coke, and the hydrogen plant makes the hydrogen from natural gas.',
    at: [2, -13],
    look: [10, -22],
    overlay: HEAVY_END_OVERLAY,
  },
  {
    title: 'Tank farm and jetty',
    text: 'The tanks soak up the difference between a steady plant and ships that come and go. Out beyond the fence, the jetty takes one tanker at a time.',
    at: [30, 14.5],
    look: [48, 4],
    overlay: SITE_OVERLAY,
  },
  {
    title: 'The flare',
    text: 'Sixty metres up, the flare burns whatever the relief valves release, safely above everyone’s heads. On a quiet day it is no bigger than a candle.',
    at: [9, -11],
    look: [27, -23],
    overlay: SAFETY_OVERLAY,
  },
  {
    title: 'Training centre and planning office',
    text: 'Downstairs, lessons that walk you through the live plant. Upstairs, the planners choose next month’s crudes. That’s the tour: the whole site is yours to run.',
    at: [-8, 25],
    look: [-17, 23],
    overlay: ACADEMY_OVERLAY,
  },
]

/** The way to face from `at` to look at `look`: yaw 0 faces −z, and positive yaw turns left. */
export function yawTowards([x, z]: [number, number], [tx, tz]: [number, number]) {
  return Math.atan2(-(tx - x), -(tz - z))
}

let stop: number | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const tour = {
  go(index: number | null) {
    stop = index === null ? null : Math.max(0, Math.min(TOUR.length - 1, index))
    emit()
  },
}

export const getTourStop = () => stop

export function useTourStop(): number | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => stop,
  )
}
