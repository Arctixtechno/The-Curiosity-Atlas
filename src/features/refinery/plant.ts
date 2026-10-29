import { useSyncExternalStore } from 'react'
import { CDU_LIMITS, CDU_START, runCdu, type CduInputs, type CduResult, type SteamLevel } from './cdu.ts'
import { CRUDES, percentBelow, type CrudeId } from './crudes.ts'
import { feedMass, runFcc, FCC_START, type FccInputs, type FccResult } from './fcc.ts'
import { measured, RELIGHT_BELOW, startFurnace, stepFurnace, valveFor, type FurnaceState, type Mode, type Tuning } from './furnace.ts'
import { runVdu, VDU_START, type VduInputs, type VduResult } from './vdu.ts'
import {
  ageCatalyst,
  FRESH_CATALYST,
  LIGHT_NAPHTHA_END,
  NAPHTHA_PNA,
  naphthaTonnes,
  NHT_START,
  REFORMER_LIMITS,
  REFORMER_START,
  runNht,
  runReformer,
  type CatalystState,
  type NhtInputs,
  type NhtResult,
  type ReformerFeed,
  type ReformerInputs,
  type ReformerResult,
} from './reformer.ts'
import {
  DHT_START,
  gasOilTonnes,
  hydrogenBalance,
  runDht,
  runSru,
  SRU_START,
  type DhtInputs,
  type DhtResult,
  type HydrogenBalance,
  type SruInputs,
  type SruResult,
} from './treating.ts'
import { ALKY_START, GAS_PLANT_START, ISOM_START, type AlkyInputs, type GasPlantInputs, type IsomInputs } from './lightEnds.ts'
import type { Season } from './blending.ts'
import { siteBalance } from './site.ts'
import {
  COKER_START,
  HC_START,
  residueQuality,
  runCoker,
  runHydrocracker,
  runSmr,
  SMR_START,
  type CokerInputs,
  type CokerResult,
  type HydrocrackerInputs,
  type HydrocrackerResult,
  type SmrInputs,
  type SmrResult,
} from './heavyEnd.ts'
import { alarmConditions, APC_PERIOD, APC_START, lagTags, runApc, tagTargets, updateDcsAlarms, type ApcSettings, type DcsAlarm, type TagValues } from './dcs.ts'
import { bookShip, freshTankFarm, stepTankFarm, type TankFarm, type TankId } from './tankFarm.ts'

// The live plant: the furnace simulation plus every unit's settings and the
// tank farm, shared by all the operator screens and the 3D site (which glows
// with the furnace's firing and shows the tank levels). One clock runs it
// while you are on site or have a refinery screen open (see clock.ts), and it
// is saved in the browser, so the plant waits where you left it.
//
// The vacuum unit, cat cracker, naphtha hydrotreater and reformer downstream
// are steady-state models: they answer their settings at once, fed by
// whatever the crude unit is doing. The reformer's catalyst ages only when
// you run it on through its cycle.

export interface ColumnSettings {
  topTemp: number
  keroDraw: number
  dieselDraw: number
  steam: SteamLevel
}

export interface Sample {
  time: number
  pv: number
  sp: number
  op: number
}

export interface Alarm {
  id: string
  /** Simulated seconds when it came in. */
  time: number
  text: string
  priority: 'high' | 'low'
  active: boolean
}

export interface Plant {
  furnace: FurnaceState
  column: ColumnSettings
  vdu: VduInputs
  fcc: FccInputs
  nht: NhtInputs
  reformer: ReformerInputs
  catalyst: CatalystState
  /** The catalyst cycle so far, one point each time it is run on. */
  cycle: CyclePoint[]
  dht: DhtInputs
  sru: SruInputs
  gasPlant: GasPlantInputs
  isom: IsomInputs
  alky: AlkyInputs
  blend: BlendSettings
  tanks: TankFarm
  /** The control room's view: every tag's value (lagged towards where the models say it settles), its trend, and alarms. */
  tags: TagValues
  tagHistory: TagSample[]
  dcsAlarms: DcsAlarm[]
  apc: ApcSettings
  /** Feed-forward from crude rate to the furnace's fuel valve. */
  feedForward: boolean
  coker: CokerInputs
  hydrocracker: HydrocrackerInputs
  smr: SmrInputs
  /** Sell and buy at the day's market prices rather than the base ones, and pay for carbon. */
  market: MarketSettings
  /** One sample every SAMPLE_EVERY simulated seconds, newest last. */
  history: Sample[]
  alarms: Alarm[]
  /** Simulated seconds per real second. */
  speed: number
  paused: boolean
}

export interface MarketSettings {
  live: boolean
  /** Carbon price, dollars a tonne of CO₂. */
  carbon: number
}

export const MARKET_START: MarketSettings = { live: false, carbon: 0 }

export interface CyclePoint {
  days: number
  wait: number
  octane: number
  coke: number
}

/** What the blenders are making: a recipe per pool, each component's kb/d (null until first set, which means "everything made"). */
export interface BlendSettings {
  grade: 'premium' | 'super'
  season: Season
  petrol: Record<string, number> | null
  diesel: Record<string, number> | null
  /** Which pools' recipes came straight from the planner, untouched since. */
  planned: { petrol: boolean; diesel: boolean }
}

export const BLEND_START: BlendSettings = { grade: 'premium', season: 'summer', petrol: null, diesel: null, planned: { petrol: false, diesel: false } }

export interface TagSample {
  time: number
  values: TagValues
}

export const SPEEDS = [1, 10, 30]
/** Simulated seconds between tag trend samples, and how much trend is kept (two hours). */
export const TAG_SAMPLE_EVERY = 30
export const TAG_HISTORY_SECONDS = 7200
/** Simulated seconds between trend samples, and how many are kept (30 minutes). */
const SAMPLE_EVERY = 10
export const HISTORY_SECONDS = 30 * 60

function fresh(): Plant {
  const furnace = startFurnace(CDU_START.crude, CDU_START.feed, CDU_START.cot)
  const { topTemp, keroDraw, dieselDraw, steam } = CDU_START
  return {
    furnace,
    column: { topTemp, keroDraw, dieselDraw, steam },
    vdu: VDU_START,
    fcc: FCC_START,
    nht: NHT_START,
    reformer: REFORMER_START,
    catalyst: FRESH_CATALYST,
    cycle: [],
    dht: DHT_START,
    sru: SRU_START,
    gasPlant: GAS_PLANT_START,
    isom: ISOM_START,
    alky: ALKY_START,
    blend: BLEND_START,
    tanks: freshTankFarm(),
    tags: {},
    tagHistory: [],
    dcsAlarms: [],
    apc: APC_START,
    feedForward: false,
    coker: COKER_START,
    hydrocracker: HC_START,
    smr: SMR_START,
    market: MARKET_START,
    // Start with half an hour of steady running on the trend, as if you'd taken over mid-shift.
    history: Array.from({ length: HISTORY_SECONDS / SAMPLE_EVERY + 1 }, (_, i) => ({
      time: (i - HISTORY_SECONDS / SAMPLE_EVERY) * SAMPLE_EVERY,
      pv: furnace.outlet,
      sp: furnace.setpoint,
      op: furnace.valve,
    })),
    alarms: [],
    speed: 10,
    paused: false,
  }
}

/** Where the plant is saved in the browser; bump the version when a saved plant can no longer be read. */
const SAVE_KEY = 'curiosity-atlas:refinery:v1'
const SAVE_DELAY_MS = 1500

/** The plant as last saved, laid over a fresh one so settings added since then get their defaults. */
function load(): Plant | null {
  try {
    const text = globalThis.localStorage?.getItem(SAVE_KEY)
    if (!text) return null
    const saved = JSON.parse(text) as Partial<Plant>
    const base = fresh()
    const merged = { ...base, ...saved, tanks: { ...base.tanks, ...saved.tanks } } as Plant
    for (const key of Object.keys(base) as (keyof Plant)[]) {
      const b = base[key]
      if (b && typeof b === 'object' && !Array.isArray(b) && key !== 'tanks') (merged as unknown as Record<string, unknown>)[key] = { ...b, ...(saved[key] as object) }
    }
    return merged
  } catch {
    return null
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
/** Saves a moment after a change, and at most that often while the clock runs. Trends aren't saved: they start again. */
function scheduleSave() {
  if (!globalThis.localStorage || saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = undefined
    try {
      const { tagHistory: _t, ...rest } = plant
      globalThis.localStorage.setItem(SAVE_KEY, JSON.stringify({ ...rest, tagHistory: [] }))
      lastSaved = Date.now()
    } catch {
      // Storage full or blocked: the plant just won't be there next time.
    }
  }, SAVE_DELAY_MS)
}
let lastSaved = 0
/** When the plant was last saved in this browser (ms since 1970), or 0 if it hasn't been. */
export const savedAt = () => lastSaved

let plant = load() ?? fresh()
const listeners = new Set<() => void>()

function publish(next: Plant) {
  plant = next
  listeners.forEach((l) => l())
  scheduleSave()
}

export const getPlant = () => plant

export function usePlant<T>(selector: (p: Plant) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => selector(plant),
  )
}

/** The column's inputs as they stand, with the furnace outlet at its true temperature. */
export function cduInputs(p: Plant = plant): CduInputs {
  return { crude: p.furnace.crude, feed: p.furnace.feed, cot: p.furnace.outlet, ...p.column }
}

/** What the column is making right now. */
export function currentResult(p: Plant = plant): CduResult {
  return runCdu(cduInputs(p))
}

export interface ConversionResult {
  cdu: CduResult
  vdu: VduResult
  fcc: FccResult
  coker: CokerResult
  hc: HydrocrackerResult
  /** Sulphur in the vacuum gas oil, ppm. */
  vgoSulphur: number
  /**
   * Vacuum gas oil the cat cracker and hydrocracker don't take, plus the hydrocracker's unconverted oil, thousand
   * barrels a day: negative when they draw on the tank.
   */
  toTank: number
}

/** What the vacuum unit, cat cracker, coker and hydrocracker are doing, fed by the crude unit as it stands. */
export function conversionResult(p: Plant = plant): ConversionResult {
  const cdu = currentResult(p)
  const vdu = runVdu(p.furnace.crude, p.furnace.feed, cdu.products.residue.from, p.vdu)
  const fcc = runFcc(p.fcc, { carbon: vdu.carbon, metals: vdu.metals, crackability: vdu.crackability })
  // Gas oil carries most of the residue's sulphur.
  const vgoSulphur = cdu.products.residue.sulphurPpm * 0.75
  const coker = runCoker(p.coker.running ? vdu.residueRate : 0, p.furnace.crude, vdu.cutPoint, p.coker)
  const hcRunning = p.hydrocracker.running
  const hc = runHydrocracker(hcRunning ? p.hydrocracker.feed : 0, hcRunning && p.coker.running ? coker.rates.gasOil : 0, vgoSulphur, p.hydrocracker)
  const unconverted = hcRunning && !p.hydrocracker.recycle ? hc.rates.unconverted : 0
  return { cdu, vdu, fcc, coker, hc, vgoSulphur, toTank: vdu.vgoRate - p.fcc.feed - (hcRunning ? p.hydrocracker.feed : 0) + unconverted }
}

export interface ReformingResult {
  cdu: CduResult
  feed: ReformerFeed
  nht: NhtResult
  reformer: ReformerResult
}

/** What the naphtha hydrotreater and reformer are doing, fed with the heavy part of the crude unit's naphtha. */
export function reformingResult(p: Plant = plant): ReformingResult {
  const cdu = currentResult(p)
  const naphtha = cdu.products.naphtha
  const crude = CRUDES[p.furnace.crude]
  const heavy = Math.max(0, percentBelow(crude, naphtha.to) - percentBelow(crude, LIGHT_NAPHTHA_END))
  const rate = (Math.min(heavy, naphtha.percent) / 100) * p.furnace.feed
  const nht = runNht(naphtha.sulphurPpm, rate, p.nht)
  const feed = { rate, ...NAPHTHA_PNA[p.furnace.crude], endPoint: naphtha.to, sulphur: nht.sulphurOut }
  return { cdu, feed, nht, reformer: runReformer(p.reformer, feed, p.catalyst) }
}

export interface TreatingResult {
  conversion: ConversionResult
  reforming: ReformingResult
  dht: DhtResult
  /** Light cycle oil the cat cracker makes, thousand barrels a day, and its sulphur, ppm. */
  lco: { rate: number; sulphur: number }
  kero: { rate: number; sulphurIn: number; sulphurOut: number }
  hydrogen: HydrogenBalance
  /** Where the H₂S comes from, tonnes of sulphur a day. */
  sulphurSources: { name: string; tonnes: number }[]
  /** Sulphur in the crude, tonnes a day. */
  crudeSulphur: number
  sru: SruResult
  /** The hydrogen plant, making what the reformer can't. */
  smr: SmrResult
}

/** Share of the kerosene's sulphur the kerosene treater takes out, and the hydrogen it uses, wt% of feed. */
const KERO_TREATER = { removal: 0.97, hydrogen: 0.06 }
/** Share of the cat cracker's feed sulphur that leaves as H₂S. */
const FCC_H2S = 0.45

/** The hydrotreaters, the hydrogen header and the sulphur plant, fed by everything upstream. */
export function treatingResult(p: Plant = plant): TreatingResult {
  const conversion = conversionResult(p)
  const reforming = reformingResult(p)
  const { cdu, fcc, coker, hc, vgoSulphur } = conversion
  // Cracking concentrates the gas oil's sulphur in the cycle oil.
  const fccTonnes = (feedMass(p.fcc.feed) * 86400) / 1000
  const lcoTonnes = (fcc.yields.lco / 100) * fccTonnes
  const lco = { rate: lcoTonnes / (0.158987 * 950), sulphur: vgoSulphur * 1.3 }
  const diesel = cdu.products.diesel
  const dht = runDht({ rate: diesel.rate, sulphur: diesel.sulphurPpm, lcoRate: lco.rate, lcoSulphur: lco.sulphur }, p.dht)
  const keroIn = cdu.products.kerosene
  const kero = { rate: keroIn.rate, sulphurIn: keroIn.sulphurPpm, sulphurOut: keroIn.sulphurPpm * (1 - KERO_TREATER.removal) }
  const keroTonnes = gasOilTonnes(kero.rate, 800)
  const nhtTonnes = naphthaTonnes(reforming.feed.rate)

  const users = [
    { name: 'Naphtha hydrotreater', tonnes: nhtTonnes * 0.0005 },
    { name: 'Kerosene treater', tonnes: (keroTonnes * KERO_TREATER.hydrogen) / 100 },
    { name: 'Diesel hydrotreater', tonnes: dht.hydrogen },
    ...(p.hydrocracker.running ? [{ name: 'Hydrocracker', tonnes: hc.hydrogen }] : []),
  ]
  // The hydrogen plant follows the header: it makes whatever the reformer can't, up to its capacity.
  const shortfall = users.reduce((sum, u) => sum + u.tonnes, 0) - reforming.reformer.hydrogen
  const smr = runSmr(shortfall, p.smr)
  const hydrogen = hydrogenBalance(reforming.reformer.hydrogen + smr.hydrogen, users)
  const sulphurSources = [
    { name: 'Naphtha hydrotreater', tonnes: (nhtTonnes * (reforming.nht.sulphurIn - reforming.nht.sulphurOut)) / 1e6 },
    { name: 'Kerosene treater', tonnes: (keroTonnes * (kero.sulphurIn - kero.sulphurOut)) / 1e6 },
    { name: 'Diesel hydrotreater', tonnes: dht.sulphurRemoved },
    { name: 'Cat cracker', tonnes: (fccTonnes * vgoSulphur * FCC_H2S) / 1e6 },
    ...(p.hydrocracker.running ? [{ name: 'Hydrocracker', tonnes: hc.sulphurRemoved }] : []),
    // About a quarter of the residue's sulphur leaves the coker as H₂S in its gas.
    ...(p.coker.running
      ? [{ name: 'Coker', tonnes: ((coker.feed * 158.987 * 1010) / 1000) * residueQuality(p.furnace.crude, conversion.vdu.cutPoint).sulphur * 0.0025 }]
      : []),
  ]
  const crudeTonnes = p.furnace.feed * 158.987 * (141.5 / (CRUDES[p.furnace.crude].api + 131.5))
  const crudeSulphur = (crudeTonnes * CRUDES[p.furnace.crude].sulphur) / 100
  const sru = runSru(
    sulphurSources.reduce((sum, s) => sum + s.tonnes, 0),
    p.sru,
  )
  return { conversion, reforming, dht, lco, kero, hydrogen, sulphurSources, crudeSulphur, sru, smr }
}

/** Advances the simulation by `realSeconds` of wall-clock time at the plant's speed. */
export function advancePlant(realSeconds: number) {
  if (plant.paused) return
  const steps = Math.min(600, Math.round(realSeconds * plant.speed + carry))
  carry = realSeconds * plant.speed + carry - steps
  if (steps <= 0) return
  let furnace = plant.furnace
  const history = [...plant.history]
  for (let i = 0; i < steps; i++) {
    furnace = stepFurnace(furnace)
    if (furnace.time % SAMPLE_EVERY === 0)
      history.push({ time: furnace.time, pv: measured(furnace), sp: furnace.setpoint, op: furnace.valve })
  }
  while (history.length && history[0].time < furnace.time - HISTORY_SECONDS) history.shift()
  let next: Plant = { ...plant, furnace, history }
  // The tank farm moves slowly, so it is stepped every simulated ten minutes rather than every second.
  tankSeconds += steps
  if (tankSeconds >= TANK_STEP) {
    next = { ...next, tanks: stepTankFarm(next.tanks, siteBalance(next), tankSeconds / 86400) }
    tankSeconds = 0
  }
  next = updateDcs(next, steps, plant.furnace.time)
  publish({ ...next, alarms: updateAlarms(next) })
}
let carry = 0
let tankSeconds = 0
const TANK_STEP = 600

/** Where every tag is heading, worked out from the whole site at most twice a second of real time. */
let targets: TagValues | null = null
let targetsAt = 0
let targetsFrom: Plant | null = null
const TARGET_REFRESH_MS = 500

/** Parts of the plant that change every step by themselves; anything else changing means the operator moved something. */
const DYNAMIC: (keyof Plant)[] = ['furnace', 'history', 'alarms', 'tags', 'tagHistory', 'dcsAlarms', 'tanks', 'speed', 'paused']

function settingsChanged(p: Plant, from: Plant | null) {
  if (!from) return true
  if (p.furnace.feed !== from.furnace.feed || p.furnace.crude !== from.furnace.crude) return true
  return (Object.keys(p) as (keyof Plant)[]).some((k) => !DYNAMIC.includes(k) && p[k] !== from[k])
}

/** Moves the control room's tags on by `steps` simulated seconds, samples their trends, runs APC and raises alarms. */
function updateDcs(p: Plant, steps: number, before: number): Plant {
  const now = Date.now()
  let next = p
  const crossed = (every: number) => Math.floor(p.furnace.time / every) > Math.floor(before / every)
  if (next.apc.fcc || next.apc.reformer) if (crossed(APC_PERIOD)) next = runApc(next)
  const refresh = !targets || now - targetsAt > TARGET_REFRESH_MS || settingsChanged(next, targetsFrom)
  let balance = null
  if (refresh) {
    balance = siteBalance(next)
    targets = tagTargets(next, balance)
    targetsAt = now
    targetsFrom = next
  }
  // The furnace outlet is truly dynamic, so its tag reads the thermocouple every step.
  const tags = { ...lagTags(next.tags, targets!, steps), 'TI-101': measured(next.furnace) }
  let tagHistory = next.tagHistory
  if (crossed(TAG_SAMPLE_EVERY) || tagHistory.length === 0) {
    tagHistory = [...tagHistory, { time: next.furnace.time, values: tags }]
    while (tagHistory.length && tagHistory[0].time < next.furnace.time - TAG_HISTORY_SECONDS) tagHistory = tagHistory.slice(1)
  }
  const dcsAlarms = balance ? updateDcsAlarms(next.dcsAlarms, alarmConditions(tags, next, balance), next.furnace.time) : next.dcsAlarms
  return { ...next, tags, tagHistory, dcsAlarms }
}

function startPoint(p: Plant): CyclePoint {
  return { days: p.catalyst.days, wait: p.reformer.wait, octane: reformingResult(p).reformer.octane, coke: p.catalyst.coke }
}

const ALARM_LIMIT = 30

/** Raises alarms that have just come in and clears ones that have gone. */
function updateAlarms(p: Plant): Alarm[] {
  const f = p.furnace
  const r = currentResult(p)
  const conditions: Omit<Alarm, 'time' | 'active'>[] = []
  if (f.tripped)
    conditions.push({ id: 'trip', text: 'TZA-101 furnace tripped: fuel gas shut off on high-high outlet temperature', priority: 'high' })
  else if (f.outlet >= CDU_LIMITS.cot.coking)
    conditions.push({ id: 'cot-hi', text: `TIC-101 outlet high (${CDU_LIMITS.cot.coking} °C): coking risk in the tubes`, priority: 'high' })
  else if (f.outlet < 345) conditions.push({ id: 'cot-lo', text: 'TIC-101 outlet low (345 °C)', priority: 'low' })
  if (f.valve >= 98 && f.mode === 'auto') conditions.push({ id: 'op-hi', text: 'TIC-101 output at its limit: valve wide open', priority: 'low' })
  if (r.starved) conditions.push({ id: 'dry', text: 'LI-104 diesel draw tray level low: not enough vapour lifted', priority: 'high' })
  for (const product of Object.values(r.products))
    for (const spec of product.specs)
      if (!spec.ok) conditions.push({ id: `spec-${product.id}-${spec.name}`, text: `${product.id} off spec: ${spec.name.toLowerCase()}`, priority: 'low' })

  const now = new Set(conditions.map((c) => c.id))
  const alarms = p.alarms.map((a) => (a.active && !now.has(a.id) ? { ...a, active: false } : a))
  for (const c of conditions)
    if (!alarms.some((a) => a.active && a.id === c.id)) alarms.unshift({ ...c, time: f.time, active: true })
  return alarms.slice(0, ALARM_LIMIT)
}

function setFurnace(change: Partial<FurnaceState>) {
  publish({ ...plant, furnace: { ...plant.furnace, ...change } })
}

export const controls = {
  setColumn(change: Partial<ColumnSettings>) {
    const column = { ...plant.column, ...change }
    publish({ ...plant, column, alarms: updateAlarms({ ...plant, column }) })
  },
  setCrude(crude: CrudeId) {
    setFurnace({ crude })
  },
  setFeed(feed: number) {
    const f = plant.furnace
    // Feed-forward: move the fuel valve by what the new rate will need, before the outlet temperature has to tell the controller.
    if (plant.feedForward && f.mode === 'auto' && !f.tripped) {
      const valve = f.valve + valveFor(f.crude, feed, f.setpoint, f.disturbances) - valveFor(f.crude, f.feed, f.setpoint, f.disturbances)
      setFurnace({ feed, valve: Math.min(100, Math.max(0, valve)) })
    } else setFurnace({ feed })
  },
  setFeedForward(feedForward: boolean) {
    publish({ ...plant, feedForward })
  },
  setApc(change: Partial<ApcSettings>) {
    const apc = { ...plant.apc, ...change }
    if (change.fcc === false) apc.fccStatus = 'Off'
    if (change.reformer === false) apc.reformerStatus = 'Off'
    if (change.fcc) apc.fccStatus = 'Waiting for its first move'
    if (change.reformer) apc.reformerStatus = 'Waiting for its first move'
    publish({ ...plant, apc })
  },
  ackAlarm(id: string) {
    publish({ ...plant, dcsAlarms: plant.dcsAlarms.map((a) => (a.id === id ? { ...a, acked: true } : a)).filter((a) => a.active || !a.acked) })
  },
  ackAllAlarms() {
    publish({ ...plant, dcsAlarms: plant.dcsAlarms.map((a) => ({ ...a, acked: true })).filter((a) => a.active) })
  },
  shelveAlarm(id: string, seconds: number) {
    publish({ ...plant, dcsAlarms: plant.dcsAlarms.map((a) => (a.id === id ? { ...a, acked: true, shelvedUntil: plant.furnace.time + seconds } : a)) })
  },
  setSetpoint(setpoint: number) {
    if (plant.furnace.mode === 'auto') setFurnace({ setpoint: Math.min(CDU_LIMITS.cot.max, Math.max(CDU_LIMITS.cot.min, setpoint)) })
  },
  setMode(mode: Mode) {
    if (plant.furnace.tripped && mode === 'auto') return
    setFurnace({ mode, setpoint: mode === 'auto' ? Math.round(measured(plant.furnace) * 10) / 10 : plant.furnace.setpoint })
  },
  setValve(valve: number) {
    if (plant.furnace.mode === 'manual' && !plant.furnace.tripped) setFurnace({ valve })
  },
  setTuning(change: Partial<Tuning>) {
    setFurnace({ tuning: { ...plant.furnace.tuning, ...change } })
  },
  toggleFouling() {
    const d = plant.furnace.disturbances
    setFurnace({ disturbances: { ...d, fouling: d.fouling ? 0 : 15 } })
  },
  toggleLeanFuel() {
    const d = plant.furnace.disturbances
    setFurnace({ disturbances: { ...d, fuelQuality: d.fuelQuality < 1 ? 1 : 0.9 } })
  },
  /** Relights a tripped furnace once it has cooled, in manual at the valve that would hold the design temperature. */
  relight() {
    const f = plant.furnace
    if (!f.tripped || f.outlet > RELIGHT_BELOW) return
    setFurnace({ tripped: false, mode: 'manual', valve: Math.round(valveFor(f.crude, f.feed, 340, f.disturbances)) })
  },
  setVdu(change: Partial<VduInputs>) {
    publish({ ...plant, vdu: { ...plant.vdu, ...change } })
  },
  setFcc(change: Partial<FccInputs>) {
    publish({ ...plant, fcc: { ...plant.fcc, ...change } })
  },
  setNht(change: Partial<NhtInputs>) {
    publish({ ...plant, nht: { ...plant.nht, ...change } })
  },
  setReformer(change: Partial<ReformerInputs>) {
    publish({ ...plant, reformer: { ...plant.reformer, ...change } })
  },
  /** Runs the reformer on for some days at its current settings, laying coke on the catalyst. */
  runCatalyst(days: number) {
    if (plant.catalyst.coke >= REFORMER_LIMITS.cokeMax) return
    const catalyst = ageCatalyst(plant.catalyst, reformingResult(plant).reformer, days)
    const next = { ...plant, catalyst }
    const point = { days: catalyst.days, wait: plant.reformer.wait, octane: reformingResult(next).reformer.octane, coke: catalyst.coke }
    publish({ ...next, cycle: [...(plant.cycle.length ? plant.cycle : [startPoint(plant)]), point] })
  },
  /** Burns the coke off the catalyst and starts a new cycle. */
  regenerate() {
    publish({ ...plant, catalyst: FRESH_CATALYST, cycle: [] })
  },
  resetReforming() {
    publish({ ...plant, nht: NHT_START, reformer: REFORMER_START, catalyst: FRESH_CATALYST, cycle: [] })
  },
  setDht(change: Partial<DhtInputs>) {
    publish({ ...plant, dht: { ...plant.dht, ...change } })
  },
  setSru(change: Partial<SruInputs>) {
    publish({ ...plant, sru: { ...plant.sru, ...change } })
  },
  setGasPlant(change: Partial<GasPlantInputs>) {
    publish({ ...plant, gasPlant: { ...plant.gasPlant, ...change } })
  },
  setIsom(change: Partial<IsomInputs>) {
    publish({ ...plant, isom: { ...plant.isom, ...change } })
  },
  setAlky(change: Partial<AlkyInputs>) {
    publish({ ...plant, alky: { ...plant.alky, ...change } })
  },
  resetLightEnds() {
    publish({ ...plant, gasPlant: GAS_PLANT_START, isom: ISOM_START, alky: ALKY_START })
  },
  setBlend(change: Partial<BlendSettings>) {
    publish({ ...plant, blend: { ...plant.blend, ...change } })
  },
  /** Sets one component's volume in a pool's recipe, starting from `base` if the recipe isn't set yet. */
  setRecipe(pool: 'petrol' | 'diesel', id: string, volume: number, base: Record<string, number>) {
    const recipe = { ...(plant.blend[pool] ?? base), [id]: Math.max(0, volume) }
    publish({ ...plant, blend: { ...plant.blend, [pool]: recipe, planned: { ...plant.blend.planned, [pool]: false } } })
  },
  /** Replaces a pool's whole recipe, marking whether it came from the planner. */
  applyRecipe(pool: 'petrol' | 'diesel', recipe: Record<string, number> | null, planned: boolean) {
    publish({ ...plant, blend: { ...plant.blend, [pool]: recipe, planned: { ...plant.blend.planned, [pool]: planned } } })
  },
  setCoker(change: Partial<CokerInputs>) {
    publish({ ...plant, coker: { ...plant.coker, ...change } })
  },
  setHydrocracker(change: Partial<HydrocrackerInputs>) {
    publish({ ...plant, hydrocracker: { ...plant.hydrocracker, ...change } })
  },
  setSmr(change: Partial<SmrInputs>) {
    publish({ ...plant, smr: { ...plant.smr, ...change } })
  },
  setMarket(change: Partial<MarketSettings>) {
    publish({ ...plant, market: { ...plant.market, ...change } })
  },
  resetHeavyEnd() {
    publish({ ...plant, coker: COKER_START, hydrocracker: HC_START, smr: SMR_START })
  },
  resetTreating() {
    publish({ ...plant, dht: DHT_START, sru: SRU_START })
  },
  resetConversion() {
    publish({ ...plant, vdu: VDU_START, fcc: FCC_START })
  },
  setSpeed(speed: number) {
    publish({ ...plant, speed })
  },
  togglePause() {
    publish({ ...plant, paused: !plant.paused })
  },
  /** Runs the tank farm on by some days with the units held as they are: the planner's fast-forward. */
  runDays(days: number) {
    publish({ ...plant, tanks: stepTankFarm(plant.tanks, siteBalance(plant), days) })
  },
  bookShip(tank: TankId) {
    publish({ ...plant, tanks: bookShip(plant.tanks, tank) })
  },
  setAutoCrude(autoCrude: boolean) {
    publish({ ...plant, tanks: { ...plant.tanks, autoCrude } })
  },
  resetTanks() {
    publish({ ...plant, tanks: freshTankFarm() })
  },
  /** Starts the whole plant afresh, and forgets the saved one. */
  reset() {
    carry = 0
    tankSeconds = 0
    targets = null
    targetsFrom = null
    publish(fresh())
  },
}
