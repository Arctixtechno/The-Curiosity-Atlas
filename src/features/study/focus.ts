import { gameStore } from '../../world/store.ts'
import { dayKey, memory, saved, useSaved } from './saved.ts'
import { chime, setAmbience, type Ambience } from './sound.ts'
import {
  advance,
  choosePhase,
  DEFAULT_TIMER_SETTINGS,
  initialTimer,
  pause,
  PHASE_NAMES,
  phaseLength,
  reset,
  start,
  timeLeft,
  type Phase,
  type TimerSettings,
  type TimerState,
} from './timer.ts'

// The running focus timer, shared by the study panel, the clock on the study
// table and the little badge that shows while you walk about. It keeps going
// with the panel closed, in other rooms, and across a reload.

export const timerSettings = saved<TimerSettings>('atlas.study.timerSettings', DEFAULT_TIMER_SETTINGS)
export const timer = saved<TimerState>('atlas.study.timer', initialTimer(timerSettings.get()))
/** Minutes focused and sessions finished, by day. */
export const focusLog = saved<Record<string, { minutes: number; sessions: number }>>('atlas.study.log', {})

const settings = () => ({ ...DEFAULT_TIMER_SETTINGS, ...timerSettings.get() })

let toastTimer: ReturnType<typeof setTimeout> | undefined
function toast(message: string) {
  gameStore.set({ toast: message })
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => gameStore.set({ toast: null }), 4000)
}

function announce(ended: Phase, next: Phase) {
  const message =
    ended === 'focus' ? `Focus session done. Time for a ${PHASE_NAMES[next].toLowerCase()}.` : 'Break over. Ready to focus again?'
  chime()
  toast(message)
  if (settings().notify && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
    try {
      new Notification('The Curiosity Atlas', { body: message, tag: 'atlas-focus' })
    } catch {
      // Some browsers only allow notifications from a service worker; the chime and toast still happen.
    }
  }
}

/** Finishes the phase if its time is up, crediting a focus session. */
function check() {
  const state = timer.get()
  const now = Date.now()
  if (!state.running || timeLeft(state, now) > 0) return
  const s = settings()
  if (state.phase === 'focus') {
    const day = dayKey(state.endsAt ?? now)
    focusLog.set((log) => {
      const today = log[day] ?? { minutes: 0, sessions: 0 }
      return { ...log, [day]: { minutes: today.minutes + s.focus, sessions: today.sessions + 1 } }
    })
  }
  const next = advance(state, s, now)
  timer.set(next)
  announce(state.phase, next.phase)
}

// One timeout for the end of the running phase, rescheduled whenever the timer changes.
let due: ReturnType<typeof setTimeout> | undefined
function schedule() {
  clearTimeout(due)
  const state = timer.get()
  if (state.running) due = setTimeout(check, timeLeft(state, Date.now()) + 50)
}
timer.subscribe(schedule)
// A phase that ended while the Atlas was closed counts once it opens again.
check()
schedule()

export const startTimer = () => timer.set((t) => start(t, Date.now()))
export const pauseTimer = () => timer.set((t) => pause(t, Date.now()))
export const resetTimer = () => timer.set((t) => reset(t, settings()))
/** Moves on without counting the current phase. */
export const skipPhase = () => timer.set((t) => advance(t, settings(), Date.now(), false))
export const choose = (phase: Phase) => timer.set((t) => choosePhase(t, settings(), phase))
export const setFocusLabel = (label: string) => timer.set((t) => ({ ...t, label }))

/** Sets a task to work on, and gets a focus session ready for it. */
export function focusOn(label: string) {
  timer.set((t) => (t.phase === 'focus' ? { ...t, label } : { ...choosePhase(t, settings(), 'focus'), label }))
}

export function updateTimerSettings(change: Partial<TimerSettings>) {
  const before = settings()
  timerSettings.set({ ...before, ...change })
  // A stopped, untouched timer takes on its new length.
  const t = timer.get()
  if (!t.running && t.remaining === phaseLength(before, t.phase)) timer.set(reset(t, settings()))
}

export const useTimer = () => useSaved(timer)
export const useTimerSettings = () => ({ ...DEFAULT_TIMER_SETTINGS, ...useSaved(timerSettings) })
export const useFocusLog = () => useSaved(focusLog)

/** The background sound. Its volume is remembered; the sound itself starts off on each visit, as browsers expect. */
export const ambienceVolume = saved('atlas.study.ambienceVolume', 0.35)
export const ambience = memory<Ambience>('off')

export function playAmbience(kind: Ambience, volume = ambienceVolume.get()) {
  ambience.set(kind)
  ambienceVolume.set(volume)
  setAmbience(kind, volume)
}
