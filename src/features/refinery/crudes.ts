// Crude oils the refinery can run, each described by its assay: the true
// boiling point (TBP) curve, which says how much of the oil (by volume) boils
// below each temperature, plus its gravity, sulphur and price.
//
// Values are rounded from typical published assays and change from cargo to
// cargo, so treat them as representative rather than exact.

export type CrudeId = 'brent' | 'wti' | 'arabLight' | 'maya'

export interface Crude {
  id: CrudeId
  name: string
  origin: string
  /** API gravity: higher is lighter. Water is 10. */
  api: number
  /** Sulphur, % by weight. */
  sulphur: number
  /** Illustrative price, US dollars a barrel. */
  price: number
  /** [temperature °C, % by volume boiled off], rising in both. */
  tbp: [number, number][]
  note: string
}

export const CRUDES: Record<CrudeId, Crude> = {
  brent: {
    id: 'brent',
    name: 'Brent Blend',
    origin: 'North Sea',
    api: 38,
    sulphur: 0.4,
    price: 82,
    tbp: [
      [-45, 0],
      [30, 3],
      [90, 12],
      [180, 30],
      [240, 41],
      [350, 63],
      [450, 78],
      [550, 88],
      [750, 100],
    ],
    note: 'Light and sweet (low sulphur): the benchmark most of the world prices oil against.',
  },
  wti: {
    id: 'wti',
    name: 'West Texas Intermediate',
    origin: 'United States',
    api: 41,
    sulphur: 0.3,
    price: 78,
    tbp: [
      [-45, 0],
      [30, 3.5],
      [90, 14],
      [180, 34],
      [240, 45],
      [350, 67],
      [450, 81],
      [550, 90],
      [750, 100],
    ],
    note: 'Lighter and sweeter still, rich in naphtha. The American benchmark.',
  },
  arabLight: {
    id: 'arabLight',
    name: 'Arab Light',
    origin: 'Saudi Arabia',
    api: 33,
    sulphur: 1.9,
    price: 76,
    tbp: [
      [-45, 0],
      [30, 2],
      [90, 8],
      [180, 22],
      [240, 32],
      [350, 52],
      [450, 66],
      [550, 78],
      [750, 100],
    ],
    note: 'Medium and sour: more residue and nearly five times the sulphur of Brent.',
  },
  maya: {
    id: 'maya',
    name: 'Maya',
    origin: 'Mexico',
    api: 22,
    sulphur: 3.3,
    price: 66,
    tbp: [
      [-45, 0],
      [30, 1.3],
      [90, 5],
      [180, 15],
      [240, 22],
      [350, 38],
      [450, 51],
      [550, 63],
      [750, 100],
    ],
    note: 'Heavy and sour. Cheap because almost two thirds of it is residue that needs cracking or coking to be worth much.',
  },
}

/** Specific gravity (relative to water) from API gravity. */
export function specificGravity(api: number) {
  return 141.5 / (api + 131.5)
}

/** Per cent of the crude, by volume, that boils below `temp` °C on its TBP curve. */
export function percentBelow(crude: Crude, temp: number): number {
  const curve = crude.tbp
  if (temp <= curve[0][0]) return 0
  for (let i = 1; i < curve.length; i++) {
    const [t1, v1] = curve[i]
    if (temp <= t1) {
      const [t0, v0] = curve[i - 1]
      return v0 + ((temp - t0) / (t1 - t0)) * (v1 - v0)
    }
  }
  return 100
}

/** The temperature at which `percent` of the crude has boiled: the inverse of percentBelow. */
export function temperatureAt(crude: Crude, percent: number): number {
  const curve = crude.tbp
  if (percent <= 0) return curve[0][0]
  for (let i = 1; i < curve.length; i++) {
    const [t1, v1] = curve[i]
    if (percent <= v1) {
      const [t0, v0] = curve[i - 1]
      return t0 + ((percent - v0) / (v1 - v0)) * (t1 - t0)
    }
  }
  return curve[curve.length - 1][0]
}
