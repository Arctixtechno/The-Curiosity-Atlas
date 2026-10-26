// The focus timer, as plain functions of the time (so it can be tested and
// survives a reload): work for a while, take a short break, and after every
// few sessions a longer one. Lengths are in minutes, times in milliseconds.

export type Phase = 'focus' | 'short' | 'long'

export interface TimerSettings {
  focus: number
  short: number
  long: number
  /** A long break after this many focus sessions. */
  longEvery: number
  /** Start the next session or break straight away when one ends. */
  autoStart: boolean
  /** Show a system notification when a session ends, for when the Atlas is in another tab. */
  notify: boolean
}

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  focus: 25,
  short: 5,
  long: 15,
  longEvery: 4,
  autoStart: false,
  notify: false,
}

export interface TimerState {
  phase: Phase
  running: boolean
  /** When the running phase ends. */
  endsAt: number | null
  /** Time left, while paused. */
  remaining: number
  /** Focus sessions finished since the last long break. */
  done: number
  /** What the current session is for, if the student said. */
  label: string
}

export const PHASE_NAMES: Record<Phase, string> = { focus: 'Focus', short: 'Short break', long: 'Long break' }

const MINUTE = 60_000

export function phaseLength(settings: TimerSettings, phase: Phase): number {
  return settings[phase] * MINUTE
}

export function initialTimer(settings: TimerSettings = DEFAULT_TIMER_SETTINGS): TimerState {
  return { phase: 'focus', running: false, endsAt: null, remaining: phaseLength(settings, 'focus'), done: 0, label: '' }
}

export function timeLeft(state: TimerState, now: number): number {
  return state.running && state.endsAt !== null ? Math.max(0, state.endsAt - now) : state.remaining
}

export function start(state: TimerState, now: number): TimerState {
  if (state.running) return state
  return { ...state, running: true, endsAt: now + state.remaining }
}

export function pause(state: TimerState, now: number): TimerState {
  if (!state.running) return state
  return { ...state, running: false, endsAt: null, remaining: timeLeft(state, now) }
}

/** Back to the start of the current phase. */
export function reset(state: TimerState, settings: TimerSettings): TimerState {
  return { ...state, running: false, endsAt: null, remaining: phaseLength(settings, state.phase) }
}

/** Switches to `phase`, stopped and full length. */
export function choosePhase(state: TimerState, settings: TimerSettings, phase: Phase): TimerState {
  return { ...state, phase, running: false, endsAt: null, remaining: phaseLength(settings, phase) }
}

/** The phase that follows the current one, counting a focus session as done if `credit`. */
function following(state: TimerState, settings: TimerSettings, credit: boolean): { phase: Phase; done: number } {
  if (state.phase !== 'focus') return { phase: 'focus', done: state.phase === 'long' ? 0 : state.done }
  const done = state.done + (credit ? 1 : 0)
  return { phase: done > 0 && done % settings.longEvery === 0 ? 'long' : 'short', done }
}

/**
 * Ends the current phase at `now` and moves on to the next, running straight
 * away if the settings say so. `credit` says whether a focus session counts.
 */
export function advance(state: TimerState, settings: TimerSettings, now: number, credit = true): TimerState {
  const { phase, done } = following(state, settings, credit)
  const remaining = phaseLength(settings, phase)
  const running = settings.autoStart
  return { ...state, phase, done, running, remaining, endsAt: running ? now + remaining : null }
}

/** Minutes and seconds, as 24:59. */
export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Minutes as "1 h 25 min" or "40 min". */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes)
  if (m < 60) return `${m} min`
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`
}
