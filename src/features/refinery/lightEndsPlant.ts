import { dieselGrade, evaluateBlend, optimiseBlend, petrolGrade, type BlendResult, type Component, type Grade } from './blending.ts'
import { feedMass } from './fcc.ts'
import { CRUDES, percentBelow } from './crudes.ts'
import {
  addLpg,
  DENSITY,
  kbpd,
  lpgFromTonnes,
  NO_LPG,
  runAlky,
  runGasPlant,
  runIsom,
  type AlkyResult,
  type GasPlantResult,
  type IsomResult,
  type Lpg,
} from './lightEnds.ts'
import { treatingResult, type Plant, type TreatingResult, getPlant } from './plant.ts'
import { LIGHT_NAPHTHA_END, naphthaTonnes } from './reformer.ts'

// Wires the light ends and the blenders into the rest of the plant: LPG from
// the crude unit, cat cracker and reformer to the gas plant, light naphtha to
// isomerisation, butylenes and isobutane to alkylation, and every petrol and
// diesel stream to the blend headers.

export interface LightEndsResult {
  treating: TreatingResult
  lpgSources: { name: string; lpg: Lpg }[]
  lightNaphtha: number
  gasPlant: GasPlantResult
  isom: IsomResult
  alky: AlkyResult
  petrol: Pool
  diesel: Pool
}

export interface Pool {
  grade: Grade
  components: Component[]
  /** The recipe as set, kb/d per component, in component order. */
  volumes: number[]
  blend: BlendResult
  /** What the optimiser would do, for comparison. */
  best: BlendResult
}

const sum = (l: Lpg) => l.propane + l.propylene + l.isobutane + l.butane + l.butylenes

function pool(grade: Grade, components: Component[], recipe: Record<string, number> | null): Pool {
  const volumes = components.map((c) => Math.min(c.purchased ? Infinity : c.available, recipe?.[c.id] ?? (c.purchased ? 0 : c.available * (c.start ?? 1))))
  const bestVolumes = optimiseBlend(grade, components)
  return { grade, components, volumes, blend: evaluateBlend(grade, components, volumes), best: evaluateBlend(grade, components, bestVolumes) }
}

export function lightEndsResult(p: Plant = getPlant()): LightEndsResult {
  const treating = treatingResult(p)
  const { conversion, reforming, dht, kero, lco } = treating
  const { cdu, fcc } = conversion
  const crude = CRUDES[p.furnace.crude]

  // LPG: the crude unit's light ends (by volume), and the cracked and reformed gas (by weight).
  const cduGas = cdu.products.gas.rate * 0.8
  const cduLpg: Lpg = { propane: cduGas * 0.3, propylene: 0, isobutane: cduGas * 0.25, butane: cduGas * 0.45, butylenes: 0 }
  const fccTonnes = (feedMass(p.fcc.feed) * 86400) / 1000
  const fccLpg = lpgFromTonnes((fcc.yields.lpg / 100) * fccTonnes, { propane: 0.12, propylene: 0.33, isobutane: 0.2, butane: 0.06, butylenes: 0.29 })
  const reformerLpg = lpgFromTonnes((reforming.reformer.yields.lpg / 100) * naphthaTonnes(reforming.feed.rate), {
    propane: 0.45,
    isobutane: 0.2,
    butane: 0.35,
  })
  // The coker's gas is olefinic, the hydrocracker's saturated and rich in isobutane; both are already in kb/d.
  const { coker, hc } = conversion
  const cokerLpg: Lpg = p.coker.running
    ? { propane: coker.rates.lpg * 0.4, propylene: coker.rates.lpg * 0.15, isobutane: coker.rates.lpg * 0.1, butane: coker.rates.lpg * 0.25, butylenes: coker.rates.lpg * 0.1 }
    : NO_LPG
  const hcLpg: Lpg = p.hydrocracker.running ? { propane: hc.rates.lpg * 0.4, propylene: 0, isobutane: hc.rates.lpg * 0.38, butane: hc.rates.lpg * 0.22, butylenes: 0 } : NO_LPG
  const lpgSources = [
    { name: 'Crude unit', lpg: cduLpg },
    { name: 'Cat cracker', lpg: fccLpg },
    { name: 'Reformer', lpg: reformerLpg },
    ...(p.coker.running ? [{ name: 'Coker', lpg: cokerLpg }] : []),
    ...(p.hydrocracker.running ? [{ name: 'Hydrocracker', lpg: hcLpg }] : []),
  ]
  const gasPlant = runGasPlant(addLpg(cduLpg, fccLpg, reformerLpg, cokerLpg, hcLpg), p.gasPlant)

  const naphtha = cdu.products.naphtha
  const lightShare = Math.max(0, Math.min(percentBelow(crude, LIGHT_NAPHTHA_END), percentBelow(crude, naphtha.to)) - percentBelow(crude, naphtha.from))
  const lightNaphtha = (Math.min(lightShare, naphtha.percent) / 100) * p.furnace.feed
  const isom = runIsom(p.isom.running ? lightNaphtha : 0, p.isom)
  const alky = runAlky(gasPlant.bottoms, gasPlant.overhead, p.alky)

  const reformateRate = kbpd((reforming.reformer.yields.reformate / 100) * naphthaTonnes(reforming.feed.rate), 800)
  const fccGasoline = kbpd((fcc.yields.gasoline / 100) * fccTonnes, 740)
  const spareIsobutane = Math.max(0, alky.isobutaneAvailable - alky.isobutaneUsed)
  const butanes = gasPlant.bottoms.butane + spareIsobutane
  const ron = reforming.reformer.octane

  const petrolComponents: Component[] = [
    { id: 'butane', name: 'Butanes', available: butanes, density: DENSITY.butane, value: 45, colour: '#9fd0e0', props: { ron: 94, mon: 90, rvp: 360 } },
    ...(p.isom.running
      ? []
      : [
          {
            id: 'lightNaphtha',
            name: 'Light naphtha',
            available: lightNaphtha,
            density: DENSITY.lightNaphtha,
            value: 70,
            colour: '#e8e2a8',
            props: { ron: isom.feedOctane, mon: isom.feedOctane - 2, rvp: 80, aromatics: 3, benzene: 2, sulphur: 8 },
          },
        ]),
    ...(p.isom.running
      ? [
          {
            id: 'isomerate',
            name: 'Isomerate',
            available: isom.product,
            density: DENSITY.isomerate,
            value: 78,
            colour: '#b8e08a',
            props: { ron: isom.octane, mon: isom.octane - 2, rvp: 90, sulphur: 0.5 },
          },
        ]
      : []),
    {
      id: 'reformate',
      name: 'Reformate',
      available: reformateRate,
      density: 800,
      value: 86,
      colour: '#f0c050',
      props: { ron, mon: ron - 10.5, rvp: 35, aromatics: reforming.reformer.composition.a * 0.92, benzene: 2.5, olefins: 0.5, sulphur: 0.2 },
    },
    {
      id: 'fccGasoline',
      name: 'Cat gasoline',
      available: fccGasoline,
      density: 740,
      value: 76,
      colour: '#e0a458',
      props: { ron: fcc.octane, mon: fcc.octane - 11, rvp: 55, aromatics: 28, olefins: 32, benzene: 0.9, sulphur: 15 },
    },
    {
      id: 'alkylate',
      name: 'Alkylate',
      available: alky.alkylate,
      density: DENSITY.alkylate,
      value: 92,
      colour: '#d6e8f0',
      props: { ron: alky.octane, mon: alky.octane - 3.5, rvp: 30, sulphur: 3 },
    },
    {
      id: 'ethanol',
      name: 'Ethanol (bought)',
      available: 0,
      purchased: true,
      density: 790,
      value: 110,
      colour: '#c8a0e0',
      props: { ron: 129, mon: 102, rvp: 130, oxygen: 34.7, ethanol: 100 },
    },
  ]

  const lcoShare = dht.feedRate > 0 && p.dht.lco ? lco.rate / dht.feedRate : 0
  // Pressure saturates cycle oil's aromatics, which lifts cetane and lowers density.
  const saturation = Math.min(1, Math.max(0, (p.dht.pressure - 30) / 50))
  const cracked = lcoShare * (1 - 0.4 * saturation)
  const dieselDensity = 838 + 70 * lcoShare * (1 - 0.5 * saturation)
  const dieselComponents: Component[] = [
    {
      id: 'dhtDiesel',
      name: 'Hydrotreated diesel',
      available: dht.feedRate * 0.99,
      density: dieselDensity,
      value: 92,
      colour: '#d9733c',
      props: { cetane: 54 - 18 * cracked, density: dieselDensity, sulphur: dht.sulphurOut, cloud: -3 - 4 * lcoShare, fame: 0 },
    },
    {
      // Taken from the jet pool and hydrotreated with the diesel: worth a little more as jet.
      id: 'kerosene',
      name: 'Kerosene',
      available: kero.rate,
      density: 800,
      value: 109,
      start: 0,
      colour: '#f0a64a',
      props: { cetane: 46, density: 800, sulphur: Math.min(kero.sulphurOut, dht.sulphurOut), cloud: -47, fame: 0 },
    },
    ...(p.hydrocracker.running && hc.rates.diesel > 0
      ? [
          {
            // Hydrocracked diesel: almost no sulphur or aromatics, high cetane, and little wax.
            id: 'hcDiesel',
            name: 'Hydrocracked diesel',
            available: hc.rates.diesel,
            density: 828,
            value: 96,
            colour: '#e8b070',
            props: { cetane: hc.dieselCetane, density: 828, sulphur: 3, cloud: -14, fame: 0 },
          },
        ]
      : []),
    {
      id: 'fame',
      name: 'Biodiesel (bought)',
      available: 0,
      purchased: true,
      density: 883,
      value: 118,
      colour: '#a8c878',
      props: { cetane: 56, density: 883, sulphur: 5, cloud: -3, fame: 100 },
    },
  ]

  return {
    treating,
    lpgSources,
    lightNaphtha,
    gasPlant,
    isom,
    alky,
    petrol: pool(petrolGrade(p.blend.grade, p.blend.season), petrolComponents, p.blend.petrol),
    diesel: pool(dieselGrade(p.blend.season), dieselComponents, p.blend.diesel),
  }
}

export { sum as lpgTotal }
