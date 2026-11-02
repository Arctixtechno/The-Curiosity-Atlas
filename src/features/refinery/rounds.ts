import { CDU_LIMITS } from './cdu.ts'
import { liveFlare } from './drills.ts'
import { FCC_LIMITS } from './fcc.ts'
import { conversionResult, treatingResult, type Plant } from './plant.ts'
import type { SafetyState } from './safetyStore.ts'
import { TANK_LIMITS, TANKS } from './tankFarm.ts'

// The field operator's round: eight checkpoints round the site, each with
// readings to take and a call to make, normal or report it. Most of what an
// operator finds on a round never shows in the control room. Some faults are
// planted for the round (fixed by its number, so a round can be replayed);
// others come from how the plant is really running.

export type FaultId = 'bearing' | 'hotspot' | 'boot' | 'seal' | 'roof' | 'knockout' | 'afterburn' | 'gauge'

export interface Reading {
  lines: { label: string; value: string }[]
  abnormal: boolean
  /** What a good operator would say about it, shown after the call. */
  finding: string
}

export interface Checkpoint {
  id: string
  name: string
  /** Where it stands on site, [x, z]. */
  at: [number, number]
  /** What to look at. */
  check: string
  /** The fault that can be planted here. */
  fault: FaultId
  read: (p: Plant, faults: ReadonlySet<FaultId>, safety: SafetyState) => Reading
}

const ok = (lines: Reading['lines'], finding: string): Reading => ({ lines, abnormal: false, finding })
const bad = (lines: Reading['lines'], finding: string): Reading => ({ lines, abnormal: true, finding })

export const CHECKPOINTS: Checkpoint[] = [
  {
    id: 'pump',
    name: 'Crude charge pumps P-101A/B',
    at: [-9.6, -0.6],
    check: 'Discharge pressure, bearing vibration and temperature, seal leaks',
    fault: 'bearing',
    read: (p, f) => {
      const lines = [
        { label: 'Discharge', value: `${(10 + p.furnace.feed / 12).toFixed(1)} bar` },
        { label: 'Vibration', value: f.has('bearing') ? '7.9 mm/s' : '2.1 mm/s' },
        { label: 'Bearing housing', value: f.has('bearing') ? '96 °C, hot to the hand' : '58 °C' },
      ]
      return f.has('bearing')
        ? bad(lines, 'The running pump’s bearing is failing: vibration over 7 mm/s and running hot. Report it and get the spare started before it seizes and trips.')
        : ok(lines, 'Steady discharge, low vibration, a cool bearing and a dry seal.')
    },
  },
  {
    id: 'furnace',
    name: 'Crude furnace B-101, through the peepholes',
    at: [-4, 0.4],
    check: 'Flame shape, the colour of the tubes, the draft',
    fault: 'hotspot',
    read: (p, f) => {
      const hot = p.furnace.outlet > CDU_LIMITS.cot.coking
      const lines = [
        { label: 'Draft', value: '−2.4 mbar' },
        { label: 'Flames', value: p.furnace.tripped ? 'out: the furnace has tripped' : 'short, steady, blue at the root' },
        { label: 'Tubes', value: f.has('hotspot') ? 'one tube glowing bright orange near the floor' : hot ? 'a dull cherry red all along' : 'dark, evenly coloured' },
      ]
      if (f.has('hotspot')) return bad(lines, 'A bright spot on one tube means coke is building inside it, or a flame is touching it. Report it: tubes that overheat can rupture.')
      if (hot) return bad(lines, `The outlet is over ${CDU_LIMITS.cot.coking} °C, where crude starts to coke the tubes. Report it to the panel.`)
      return ok(lines, 'Flames clear of the tubes, tubes evenly dark, steady draft.')
    },
  },
  {
    id: 'column',
    name: 'Crude column C-101, bottom level glass',
    at: [2.4, -2.6],
    check: 'The level in the gauge glass against the transmitter',
    fault: 'gauge',
    read: (_, f) => {
      const lines = [
        { label: 'Gauge glass', value: f.has('gauge') ? '20%' : '52%' },
        { label: 'Transmitter LI-101', value: '52%' },
      ]
      return f.has('gauge')
        ? bad(lines, 'The glass and the transmitter disagree by 32 points. One of them is wrong, and the control room is trusting the transmitter. Report it so an instrument tech checks it: a bad level reading started the Texas City disaster.')
        : ok(lines, 'The glass and the transmitter agree.')
    },
  },
  {
    id: 'boot',
    name: 'Reflux drum D-101, water boot',
    at: [12.4, 0.4],
    check: 'Water level in the boot, the water draw-off',
    fault: 'boot',
    read: (_, f) => {
      const lines = [
        { label: 'Boot level glass', value: f.has('boot') ? 'full of water, up into the drum' : 'a third full' },
        { label: 'Water draw-off', value: f.has('boot') ? 'valve shut' : 'running clear' },
      ]
      return f.has('boot')
        ? bad(lines, 'The water draw-off has stopped and water is backing up into the drum. It will carry into the naphtha and the reflux pump. Report it and get the draw-off running.')
        : ok(lines, 'The boot is draining the condensed steam as it should.')
    },
  },
  {
    id: 'regen',
    name: 'Cat cracker regenerator',
    at: [-14, -8.6],
    check: 'Flue gas temperature, afterburn, the slide valves',
    fault: 'afterburn',
    read: (p, f) => {
      const fcc = conversionResult(p).fcc
      const lines = [
        { label: 'Dense bed', value: `${fcc.regenTemp.toFixed(0)} °C` },
        { label: 'Flue gas', value: f.has('afterburn') ? `${(fcc.regenTemp + 45).toFixed(0)} °C` : `${(fcc.regenTemp + 8).toFixed(0)} °C` },
        { label: 'Slide valves', value: 'moving freely' },
      ]
      if (f.has('afterburn')) return bad(lines, 'The flue gas is far hotter than the bed: CO is burning above the bed (afterburn), which can overheat the cyclones. Report it so the panel trims the air.')
      if (fcc.regenTemp > FCC_LIMITS.regenMax) return bad(lines, `The bed is over its ${FCC_LIMITS.regenMax} °C limit. Report it to the panel.`)
      return ok(lines, 'The flue gas runs a few degrees over the bed: no afterburn.')
    },
  },
  {
    id: 'sulphur',
    name: 'Sulphur pit and loading',
    at: [-21, 3.4],
    check: 'Personal H₂S monitor, the pit’s vapour seal, sulphur colour',
    fault: 'seal',
    read: (p, f) => {
      const sru = treatingResult(p).sru
      const lines = [
        { label: 'H₂S monitor', value: f.has('seal') ? '14 ppm, alarming' : '0 ppm' },
        { label: 'Sulphur', value: sru.recovery > 99 ? 'bright yellow' : 'yellow, a little dark' },
        { label: 'Make', value: `${sru.sulphur.toFixed(0)} t/d` },
      ]
      return f.has('seal')
        ? bad(lines, 'Your monitor is alarming: H₂S is escaping from the pit’s vapour seal. Step back upwind and report it. Don’t stay to investigate.')
        : ok(lines, 'No H₂S at the pit, and the sulphur is clean.')
    },
  },
  {
    id: 'tank',
    name: 'Crude tank T-1',
    at: [19.6, 21.6],
    check: 'Level against the high alarms, the floating roof, the bund',
    fault: 'roof',
    read: (p, f) => {
      const share = p.tanks.levels.crude / TANKS.crude.capacity
      const lines = [
        { label: 'Level', value: `${(share * 100).toFixed(0)}%` },
        { label: 'Floating roof', value: f.has('roof') ? 'tilted, with oil on the deck' : 'level, deck dry' },
        { label: 'Bund', value: 'dry, drain valve shut' },
      ]
      if (f.has('roof')) return bad(lines, 'Oil on a floating roof means a seal or pontoon has failed: a fire risk, and the roof could sink. Report it.')
      if (share > TANK_LIMITS.high) return bad(lines, `The tank is over its ${TANK_LIMITS.high * 100}% high level. Report it before it reaches the high-high: Buncefield began with a tank overfilling.`)
      if (share < TANK_LIMITS.heel * 2) return bad(lines, 'The tank is nearly empty: the crude unit will soon be starved. Report it so a ship is brought in.')
      return ok(lines, 'Level well inside its limits, roof level, bund dry.')
    },
  },
  {
    id: 'flare',
    name: 'Flare knock-out drum',
    at: [22.4, -18.4],
    check: 'Liquid level in the knock-out drum, the flare flame',
    fault: 'knockout',
    read: (p, f, s) => {
      const load = liveFlare(s, p.furnace.time)
      const lines = [
        { label: 'Knock-out drum', value: f.has('knockout') ? '78%, pump not running' : '12%' },
        { label: 'Flare', value: load > 5 ? `big and loud: about ${load.toFixed(0)} t/h` : 'a small pilot-sized flame' },
      ]
      if (f.has('knockout')) return bad(lines, 'Liquid is building up in the knock-out drum and its pump isn’t running. If it fills, burning liquid rains from the flare tip. Report it.')
      if (load > 5) return bad(lines, 'The flare is burning a big relief load. Report it: something on the site is relieving.')
      return ok(lines, 'Drum nearly empty, flare quiet.')
    },
  },
]

const FAULTS = CHECKPOINTS.map((c) => c.fault)

/** The faults planted for a round: two or three, fixed by the round's number. */
export function faultsFor(round: number): Set<FaultId> {
  let seed = (round * 2654435761) % 4294967296
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  const count = 2 + (rand() < 0.5 ? 1 : 0)
  const pool = [...FAULTS]
  const picked = new Set<FaultId>()
  while (picked.size < count) picked.add(pool.splice(Math.floor(rand() * pool.length), 1)[0])
  return picked
}

export interface RoundCall {
  call: 'normal' | 'report'
  reading: Reading
}

/** How a round went: calls right out of the checkpoints, and the ones missed. */
export function scoreRound(calls: Record<string, RoundCall>) {
  const done = CHECKPOINTS.filter((c) => calls[c.id])
  const right = done.filter((c) => (calls[c.id].call === 'report') === calls[c.id].reading.abnormal)
  return { checked: done.length, right: right.length, total: CHECKPOINTS.length, wrong: done.filter((c) => !right.includes(c)) }
}
