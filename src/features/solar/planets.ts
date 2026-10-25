// The planets: where they are on any date, and their vital statistics.
//
// Positions use JPL's "Approximate Positions of the Planets", Table 1:
// Keplerian elements and their rates for 1800 AD to 2050 AD
// (https://ssd.jpl.nasa.gov/planets/approx_pos.html). Statistics come from
// NASA's Planetary Fact Sheet (https://nssdc.gsfc.nasa.gov/planetary/factsheet/).

export type PlanetId = 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune'

/** a (au), e, I, L, longitude of perihelion, longitude of ascending node (degrees), then each one's rate per century. */
type Elements = [a: number, e: number, I: number, L: number, peri: number, node: number]

interface Planet {
  id: PlanetId
  name: string
  colour: string
  elements: Elements
  rates: Elements
  facts: {
    diameterKm: number
    massE24Kg: number
    gravity: number
    /** Length of a solar day, in hours. */
    dayHours: number
    distanceE6Km: number
    periodDays: number
    meanTempC: number
    moons: number
    rings: boolean
  }
}

export const PLANETS: Planet[] = [
  {
    id: 'mercury',
    name: 'Mercury',
    colour: '#b8aa9a',
    elements: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
    rates: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
    facts: {
      diameterKm: 4879,
      massE24Kg: 0.33,
      gravity: 3.7,
      dayHours: 4222.6,
      distanceE6Km: 57.9,
      periodDays: 88.0,
      meanTempC: 167,
      moons: 0,
      rings: false,
    },
  },
  {
    id: 'venus',
    name: 'Venus',
    colour: '#e6cf98',
    elements: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255],
    rates: [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
    facts: {
      diameterKm: 12104,
      massE24Kg: 4.87,
      gravity: 8.9,
      dayHours: 2802.0,
      distanceE6Km: 108.2,
      periodDays: 224.7,
      meanTempC: 464,
      moons: 0,
      rings: false,
    },
  },
  {
    // JPL gives the Earth–Moon barycentre, which is within about 5,000 km of Earth's centre.
    id: 'earth',
    name: 'Earth',
    colour: '#5a8ad0',
    elements: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
    rates: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
    facts: {
      diameterKm: 12756,
      massE24Kg: 5.97,
      gravity: 9.8,
      dayHours: 24.0,
      distanceE6Km: 149.6,
      periodDays: 365.2,
      meanTempC: 15,
      moons: 1,
      rings: false,
    },
  },
  {
    id: 'mars',
    name: 'Mars',
    colour: '#c8643c',
    elements: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    rates: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
    facts: {
      diameterKm: 6792,
      massE24Kg: 0.642,
      gravity: 3.7,
      dayHours: 24.7,
      distanceE6Km: 228.0,
      periodDays: 687.0,
      meanTempC: -65,
      moons: 2,
      rings: false,
    },
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    colour: '#d8b48a',
    elements: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    rates: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
    facts: {
      diameterKm: 142984,
      massE24Kg: 1898,
      gravity: 23.1,
      dayHours: 9.9,
      distanceE6Km: 778.5,
      periodDays: 4331,
      meanTempC: -110,
      moons: 95,
      rings: true,
    },
  },
  {
    id: 'saturn',
    name: 'Saturn',
    colour: '#e6d29a',
    elements: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    rates: [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
    facts: {
      diameterKm: 120536,
      massE24Kg: 568,
      gravity: 9.0,
      dayHours: 10.7,
      distanceE6Km: 1432.0,
      periodDays: 10747,
      meanTempC: -140,
      moons: 274,
      rings: true,
    },
  },
  {
    id: 'uranus',
    name: 'Uranus',
    colour: '#9ed6dc',
    elements: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503],
    rates: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
    facts: {
      diameterKm: 51118,
      massE24Kg: 86.8,
      gravity: 8.7,
      dayHours: 17.2,
      distanceE6Km: 2867.0,
      periodDays: 30589,
      meanTempC: -195,
      moons: 28,
      rings: true,
    },
  },
  {
    id: 'neptune',
    name: 'Neptune',
    colour: '#5a7ae0',
    elements: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
    rates: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
    facts: {
      diameterKm: 49528,
      massE24Kg: 102,
      gravity: 11.0,
      dayHours: 16.1,
      distanceE6Km: 4515.0,
      periodDays: 59800,
      meanTempC: -200,
      moons: 16,
      rings: true,
    },
  },
]

export const SUN_DIAMETER_KM = 1392700

/** The years JPL's Table 1 elements were fitted for; outside them the positions drift. */
export const VALID_YEARS = [1800, 2050] as const

const RAD = Math.PI / 180

export function julianDate(date: Date) {
  return date.getTime() / 86400000 + 2440587.5
}

/** Solves Kepler's equation M = E − e sin E for E, all in degrees, by Newton's method as JPL describes. */
export function eccentricAnomaly(M: number, e: number) {
  const eStar = e / RAD
  let E = M + eStar * Math.sin(M * RAD)
  for (let i = 0; i < 30; i++) {
    const dM = M - (E - eStar * Math.sin(E * RAD))
    const dE = dM / (1 - e * Math.cos(E * RAD))
    E += dE
    if (Math.abs(dE) <= 1e-6) break
  }
  return E
}

/** Heliocentric position in the J2000 ecliptic, in au: x towards the March equinox. */
export function position(planet: Planet, date: Date) {
  const T = (julianDate(date) - 2451545.0) / 36525
  const [a, e, I, L, peri, node] = planet.elements.map((v, i) => v + planet.rates[i] * T)
  const omega = peri - node
  // Bring the mean anomaly into −180° to 180°.
  let M = (L - peri) % 360
  if (M > 180) M -= 360
  if (M < -180) M += 360
  const E = eccentricAnomaly(M, e) * RAD
  const xp = a * (Math.cos(E) - e)
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E)
  const [w, O, i] = [omega * RAD, node * RAD, I * RAD]
  return {
    x:
      (Math.cos(w) * Math.cos(O) - Math.sin(w) * Math.sin(O) * Math.cos(i)) * xp +
      (-Math.sin(w) * Math.cos(O) - Math.cos(w) * Math.sin(O) * Math.cos(i)) * yp,
    y:
      (Math.cos(w) * Math.sin(O) + Math.sin(w) * Math.cos(O) * Math.cos(i)) * xp +
      (-Math.sin(w) * Math.sin(O) + Math.cos(w) * Math.cos(O) * Math.cos(i)) * yp,
    z: Math.sin(w) * Math.sin(i) * xp + Math.cos(w) * Math.sin(i) * yp,
  }
}

/** Distance between two planets on a date, in au. */
export function separation(a: Planet, b: Planet, date: Date) {
  const p = position(a, date)
  const q = position(b, date)
  return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)
}

export const AU_KM = 149597870.7

export function findPlanet(id: PlanetId) {
  return PLANETS.find((p) => p.id === id)!
}
