import { CRUDES, type CrudeId } from './crudes.ts'
import { CDU_LIMITS, outletFor, PREHEAT_OUTLET } from './cdu.ts'

// The crude furnace and its temperature controller (TIC-101), simulated in
// time. The furnace outlet temperature answers the fuel gas valve slowly and
// after a delay, which is what makes it a real control problem: a first-order
// lag with dead time, the textbook model of a fired heater.

/** Heat released with the fuel gas valve wide open, MW. */
export const MAX_FIRED = 120
/** How long the outlet takes to cover 63% of a change, in simulated seconds. */
export const TIME_CONSTANT = 180
/** Delay before a valve move shows at the outlet thermocouple, in simulated seconds. */
export const DEAD_TIME = 30
/** Seconds of simulated time per step. */
export const STEP = 1

export type Mode = 'auto' | 'manual'

export interface Tuning {
  /** Controller gain, % valve per °C of error. */
  gain: number
  /** Integral (reset) time, minutes. */
  integral: number
  /** Derivative time, minutes. */
  derivative: number
}

/**
 * Tuning from the IMC rule for a lag with dead time, aiming for a closed-loop
 * time constant of twice the dead time: steady, with little overshoot.
 */
export const DEFAULT_TUNING: Tuning = { gain: 1.0, integral: 3, derivative: 0 }

export interface Disturbances {
  /** The preheat train has fouled, so the crude arrives cooler, °C. */
  fouling: number
  /** Fuel gas is leaner than usual: fraction of its normal heating value. */
  fuelQuality: number
}

export interface FurnaceState {
  /** Simulated seconds since the run started. */
  time: number
  crude: CrudeId
  feed: number
  mode: Mode
  setpoint: number
  /** Fuel gas valve, % open. */
  valve: number
  /** True outlet temperature, °C. */
  outlet: number
  /** Valve positions waiting to reach the outlet, one per step of dead time. */
  pipeline: number[]
  /** Last two measurements, for the derivative. */
  previous: [number, number]
  previousError: number
  tuning: Tuning
  disturbances: Disturbances
  /** The high-high trip has shut the fuel off. */
  tripped: boolean
}

/** The valve position that holds `cot` steady. */
export function valveFor(crude: CrudeId, feed: number, cot: number, disturbances?: Disturbances) {
  const inlet = PREHEAT_OUTLET - (disturbances?.fouling ?? 0)
  const fired = firedAt(crude, feed, cot, inlet)
  return (fired / (MAX_FIRED * (disturbances?.fuelQuality ?? 1))) * 100
}

function firedAt(crude: CrudeId, feed: number, cot: number, inlet: number) {
  // Invert outletFor by bisection on the fired duty.
  let lo = 0
  let hi = MAX_FIRED * 3
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (outletFor(CRUDES[crude], feed, mid, inlet) < cot) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** A furnace lined out at its design temperature, in automatic. */
export function startFurnace(crude: CrudeId = 'brent', feed = 100, setpoint: number = CDU_LIMITS.cot.design): FurnaceState {
  const disturbances = { fouling: 0, fuelQuality: 1 }
  const valve = valveFor(crude, feed, setpoint, disturbances)
  return {
    time: 0,
    crude,
    feed,
    mode: 'auto',
    setpoint,
    valve,
    outlet: setpoint,
    pipeline: Array.from({ length: DEAD_TIME / STEP }, () => valve),
    previous: [setpoint, setpoint],
    previousError: 0,
    tuning: DEFAULT_TUNING,
    disturbances,
    tripped: false,
  }
}

/** Small, repeatable thermocouple noise, °C. */
function noise(time: number) {
  return Math.sin(time * 1.7) * 0.08 + Math.sin(time * 0.37 + 1) * 0.06
}

/** What the outlet thermocouple reads. */
export function measured(state: FurnaceState) {
  return state.outlet + noise(state.time)
}

/**
 * Advances the furnace by one step: the controller moves the valve (in
 * automatic), the valve's effect arrives after the dead time, and the outlet
 * moves towards where that firing would settle it.
 */
export function stepFurnace(state: FurnaceState): FurnaceState {
  const s = { ...state, pipeline: [...state.pipeline] }
  const pv = measured(s)
  const error = s.setpoint - pv
  if (s.tripped) {
    s.valve = 0
  } else if (s.mode === 'auto') {
    // Velocity form of PID with derivative on the measurement: moving the
    // setpoint doesn't kick the valve, and the output can't wind up.
    const { gain, integral, derivative } = s.tuning
    const dt = STEP / 60
    const [pv1, pv2] = s.previous
    const delta =
      gain * (error - s.previousError + (integral > 0 ? (dt / integral) * error : 0) - (derivative / dt) * (pv - 2 * pv1 + pv2))
    s.valve = Math.min(100, Math.max(0, s.valve + delta))
  } else {
    // In manual the setpoint follows the measurement, so switching to automatic is bumpless.
    s.setpoint = Math.round(pv * 10) / 10
  }
  s.previous = [pv, s.previous[0]]
  s.previousError = s.mode === 'auto' ? error : 0

  s.pipeline.push(s.valve)
  const arriving = s.pipeline.shift()!
  const fired = (arriving / 100) * MAX_FIRED * s.disturbances.fuelQuality
  const settle = outletFor(CRUDES[s.crude], s.feed, fired, PREHEAT_OUTLET - s.disturbances.fouling)
  s.outlet += ((settle - s.outlet) * STEP) / TIME_CONSTANT
  s.time += STEP

  if (!s.tripped && s.outlet >= CDU_LIMITS.cot.trip) {
    s.tripped = true
    s.mode = 'manual'
    s.valve = 0
  }
  return s
}

/** Runs `seconds` of simulated time. */
export function runFurnace(state: FurnaceState, seconds: number) {
  let s = state
  for (let t = 0; t < seconds; t += STEP) s = stepFurnace(s)
  return s
}

/** The fired duty at the valve's current position, MW. */
export function firedDuty(state: FurnaceState) {
  return (state.valve / 100) * MAX_FIRED * state.disturbances.fuelQuality
}

/** Below this the tripped furnace may be relit. */
export const RELIGHT_BELOW = 330
