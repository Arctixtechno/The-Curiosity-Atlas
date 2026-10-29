import { OFF_SPEC_PRICE } from './blending.ts'
import { CRUDES } from './crudes.ts'
import { feedMass } from './fcc.ts'
import { lightEndsResult, type LightEndsResult } from './lightEndsPlant.ts'
import { getPlant, type Plant } from './plant.ts'

// The whole site's balance: crude in, every product out, and what the site
// buys and burns, in barrels and dollars a day. It is what a refinery's
// planners and accountants look at every morning, and what the tank farm
// runs on.

export type ProductOutId = 'lpg' | 'petrol' | 'blendstock' | 'jet' | 'diesel' | 'fuelOil' | 'sulphur' | 'coke'

export interface ProductOut {
  id: ProductOutId
  name: string
  /** Thousand barrels a day (tonnes a day for sulphur). */
  rate: number
  /** Dollars a barrel (a tonne for sulphur). */
  price: number
  colour: string
  /** What's in it, for the breakdown. */
  note: string
}

export interface Cost {
  name: string
  /** Dollars a day. */
  dollars: number
  note: string
}

export interface SiteBalance {
  units: LightEndsResult
  crude: { rate: number; price: number; cost: number }
  products: ProductOut[]
  /** Vacuum gas oil into (positive) or out of (negative) its tank, kb/d. */
  vgoToTank: number
  costs: Cost[]
  revenue: number
  margin: number
  perBarrel: number
  /** Liquid barrels out per barrel of crude in, %: cracking makes more, lighter barrels than it takes. */
  volumeGain: number
}

/** Illustrative prices, dollars a barrel (a tonne where marked). */
export const SITE_PRICES = {
  propane: 40,
  /** Fuel oil from cutter stocks (slurry, cycle oil, coker gas oil), and vacuum residue, which is worth far less. */
  fuelOil: 62,
  residue: 48,
  /** Dollars a tonne. */
  sulphur: 90,
  /** Dollars a tonne, from a steam methane reformer over the fence. */
  hydrogen: 1800,
  isobutane: 55,
  /** Vacuum gas oil in the tank, valued at what it would cost to buy in. */
  vgo: 80,
  /** Dollars a tonne of fresh acid, net of what the spent acid regenerator charges. */
  acid: 150,
  /** Fuel gas, dollars a gigajoule; electricity, dollars a megawatt-hour. */
  fuel: 9,
  power: 80,
  /** Coke, dollars a tonne: calcinable anode grade, or fuel grade for cement kilns and power stations. */
  coke: { anode: 260, fuel: 70 },
  /** Naphtha from the coker and hydrocracker sold for further processing, dollars a barrel. */
  cokerNaphtha: 64,
  hcNaphtha: 74,
}

/** Sulphur and coke are sold by the tonne; everything else by the barrel. */
export const isTonnes = (id: ProductOutId) => id === 'sulphur' || id === 'coke'

const sumVolumes = (volumes: number[]) => volumes.reduce((a, b) => a + b, 0)

export function siteBalance(p: Plant = getPlant()): SiteBalance {
  const units = lightEndsResult(p)
  const { treating, gasPlant, alky, petrol, diesel } = units
  const { conversion, reforming, dht, kero, lco, hydrogen, sru, smr } = treating
  const { cdu, vdu, fcc, coker, hc } = conversion
  const cokerOn = p.coker.running
  const hcOn = p.hydrocracker.running
  const crude = CRUDES[p.furnace.crude]

  // LPG: propane (and propylene unless it's alkylated) and the butane the blenders leave.
  const butaneBlended = petrol.volumes[petrol.components.findIndex((c) => c.id === 'butane')] ?? 0
  const butaneMade = petrol.components.find((c) => c.id === 'butane')?.available ?? 0
  const propane = gasPlant.overhead.propane + (p.alky.propylene ? 0 : gasPlant.overhead.propylene)
  const lpgRate = propane + Math.max(0, butaneMade - butaneBlended)
  const lpgValue = propane * SITE_PRICES.propane + Math.max(0, butaneMade - butaneBlended) * 45

  // Petrol components the blenders don't use go for export as blendstock at their own value.
  // The coker's and hydrocracker's naphtha go for export too, for others to treat and reform.
  let blendstockRate = (cokerOn ? coker.rates.naphtha : 0) + (hcOn ? hc.rates.naphtha : 0)
  let blendstockValue = (cokerOn ? coker.rates.naphtha * SITE_PRICES.cokerNaphtha : 0) + (hcOn ? hc.rates.naphtha * SITE_PRICES.hcNaphtha : 0)
  petrol.components.forEach((c, i) => {
    if (c.purchased || c.id === 'butane') return
    const spare = Math.max(0, c.available - petrol.volumes[i])
    blendstockRate += spare
    blendstockValue += spare * c.value
  })

  // Jet: kerosene not blended into diesel. Diesel: the blend, plus hydrotreated diesel left over.
  const keroIndex = diesel.components.findIndex((c) => c.id === 'kerosene')
  const jetRate = Math.max(0, kero.rate - (diesel.volumes[keroIndex] ?? 0)) + (hcOn ? hc.rates.jet : 0)
  const jetPrice = cdu.products.kerosene.onSpec ? 105 : OFF_SPEC_PRICE
  const dhtIndex = diesel.components.findIndex((c) => c.id === 'dhtDiesel')
  const dieselSpare = Math.max(0, diesel.components[dhtIndex].available - diesel.volumes[dhtIndex])

  // Fuel oil: vacuum residue, the cracker's slurry, and its cycle oil if it isn't hydrotreated.
  const fccTonnes = (feedMass(p.fcc.feed) * 86400) / 1000
  const slurry = ((fcc.yields.slurry / 100) * fccTonnes) / (0.158987 * 1050)
  const residueToFuel = cokerOn ? 0 : vdu.residueRate
  const fuelOil = residueToFuel + slurry + (p.dht.lco ? 0 : lco.rate) + (cokerOn && !hcOn ? coker.rates.gasOil : 0)
  const fuelOilPrice = fuelOil > 0 ? (residueToFuel * SITE_PRICES.residue + (fuelOil - residueToFuel) * SITE_PRICES.fuelOil) / fuelOil : SITE_PRICES.fuelOil

  const petrolPrice = petrol.blend.onSpec ? petrol.grade.price : OFF_SPEC_PRICE
  const dieselPrice = diesel.blend.onSpec ? diesel.grade.price : OFF_SPEC_PRICE
  const products: ProductOut[] = [
    { id: 'lpg', name: 'LPG', rate: lpgRate, price: lpgRate > 0 ? lpgValue / lpgRate : 0, colour: '#9fd0e0', note: 'propane, and the butane not blended' },
    { id: 'petrol', name: petrol.grade.name, rate: petrol.blend.total, price: petrolPrice, colour: '#f0c050', note: petrol.blend.onSpec ? 'on spec' : 'off spec: sold as blendstock' },
    {
      id: 'blendstock',
      name: 'Export blendstock',
      rate: blendstockRate,
      price: blendstockRate > 0 ? blendstockValue / blendstockRate : 0,
      colour: '#e0a458',
      note: 'petrol components the blend doesn’t use',
    },
    { id: 'jet', name: 'Jet fuel', rate: jetRate, price: jetPrice, colour: '#f0a64a', note: 'kerosene not blended into diesel' },
    {
      id: 'diesel',
      name: 'Road diesel',
      rate: diesel.blend.total + dieselSpare,
      price: diesel.blend.total + dieselSpare > 0 ? (diesel.blend.total * dieselPrice + dieselSpare * 92) / (diesel.blend.total + dieselSpare) : 0,
      colour: '#d9733c',
      note: diesel.blend.onSpec ? 'on spec' : 'off spec: sold as blendstock',
    },
    { id: 'fuelOil', name: 'Fuel oil', rate: fuelOil, price: fuelOilPrice, colour: '#6b5a4a', note: [cokerOn ? '' : 'vacuum residue', 'slurry', p.dht.lco ? '' : 'cycle oil', cokerOn && !hcOn ? 'coker gas oil' : ''].filter(Boolean).join(', ') },
    { id: 'sulphur', name: 'Sulphur (t/d)', rate: sru.sulphur, price: SITE_PRICES.sulphur, colour: '#e8d27a', note: 'from the Claus plant' },
    ...(cokerOn
      ? [{ id: 'coke' as const, name: 'Coke (t/d)', rate: coker.rates.coke, price: SITE_PRICES.coke[coker.grade], colour: '#3a3a3a', note: coker.grade === 'anode' ? 'anode grade, for aluminium smelters' : 'fuel grade' }]
      : []),
  ]

  const bought = (pool: typeof petrol) => pool.components.reduce((sum, c, i) => sum + (c.purchased ? pool.volumes[i] * 1000 * c.value : 0), 0)
  const furnaceFuel = cdu.economics.fuelCost
  const reformerFuel = reforming.reformer.economics.fuelCost
  const gasPlantFuel = (gasPlant.duty * 86400 * SITE_PRICES.fuel) / 1000 / 0.85
  // The diesel hydrotreater's charge heater: about 0.1 GJ a barrel.
  const dhtFuel = dht.feedRate * 1000 * 0.1 * SITE_PRICES.fuel
  const costs: Cost[] = [
    { name: 'Bought blend components', dollars: bought(petrol) + bought(diesel), note: 'ethanol and biodiesel' },
    { name: 'Hydrogen bought', dollars: hydrogen.imported * SITE_PRICES.hydrogen, note: `${hydrogen.imported.toFixed(1)} t/d` },
    { name: 'Isobutane bought', dollars: alky.isobutaneImported * 1000 * SITE_PRICES.isobutane, note: `${alky.isobutaneImported.toFixed(2)} kb/d` },
    { name: 'Alkylation acid', dollars: alky.acidUse * SITE_PRICES.acid, note: `${alky.acidUse.toFixed(1)} t/d` },
    {
      name: 'Fuel',
      dollars: furnaceFuel + reformerFuel + gasPlantFuel + dhtFuel + (((cokerOn ? coker.heaterDuty : 0) + (hcOn ? hc.heaterDuty : 0)) * 86.4 * SITE_PRICES.fuel) / 0.85,
      note: 'furnaces and reboilers',
    },
    ...(smr.hydrogen > 0 ? [{ name: 'Natural gas for hydrogen', dollars: smr.gas * SITE_PRICES.fuel, note: `${smr.hydrogen.toFixed(0)} t/d of hydrogen, ${smr.co2.toFixed(0)} t/d of CO₂` }] : []),
    {
      name: conversion.toTank >= 0 ? 'Gas oil into its tank' : 'Gas oil from its tank',
      dollars: -conversion.toTank * 1000 * SITE_PRICES.vgo,
      note: `${Math.abs(conversion.toTank).toFixed(1)} kb/d, valued at $${SITE_PRICES.vgo}`,
    },
    { name: 'Steam and power', dollars: cdu.economics.steamCost + alky.power * 24 * SITE_PRICES.power, note: 'stripping steam, refrigeration' },
  ]

  const crudeCost = p.furnace.feed * 1000 * crude.price
  const revenue = products.reduce((sum, o) => sum + o.rate * (isTonnes(o.id) ? 1 : 1000) * o.price, 0)
  const margin = revenue - crudeCost - costs.reduce((sum, c) => sum + c.dollars, 0)
  const liquids = products.filter((o) => !isTonnes(o.id)).reduce((sum, o) => sum + o.rate, 0)
  const bought_ = sumVolumes(petrol.components.map((c, i) => (c.purchased ? petrol.volumes[i] : 0))) + sumVolumes(diesel.components.map((c, i) => (c.purchased ? diesel.volumes[i] : 0)))
  return {
    units,
    crude: { rate: p.furnace.feed, price: crude.price, cost: crudeCost },
    products,
    vgoToTank: conversion.toTank,
    costs,
    revenue,
    margin,
    perBarrel: p.furnace.feed > 0 ? margin / (p.furnace.feed * 1000) : 0,
    volumeGain: p.furnace.feed > 0 ? ((liquids - bought_ + conversion.toTank) / p.furnace.feed) * 100 : 0,
  }
}
