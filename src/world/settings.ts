import { useSyncExternalStore } from 'react'

// Player preferences, remembered between visits. Mouse sensitivity lives in
// the game store because the [ and ] keys change it mid-game.

export type Quality = 'auto' | 'high' | 'low'
/** Battery saver: on, off, or on whenever the computer is running on its battery. */
export type BatterySaver = 'auto' | 'on' | 'off'

export interface Settings {
  /** Auto lowers the resolution when frames drop; high and low fix it. */
  quality: Quality
  /** Bob the view with each footstep. Off by default when the system asks for reduced motion. */
  headBob: boolean
  /** Vertical field of view in degrees. */
  fov: number
  batterySaver: BatterySaver
}

const KEY = 'atlas.settings'
/** The system asks for less movement on screen. */
export const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const DEFAULT_SETTINGS: Settings = { quality: 'auto', headBob: !prefersReducedMotion, fov: 70, batterySaver: 'auto' }
export const FOV_RANGE = [55, 90] as const

function load(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULT_SETTINGS
  }
}

let settings = load()
const listeners = new Set<() => void>()

export const getSettings = () => settings

export function updateSettings(partial: Partial<Settings>) {
  settings = { ...settings, ...partial }
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // Storage can be unavailable (private windows); settings then last for this visit only.
  }
  listeners.forEach((l) => l())
}

export function subscribeSettings(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSettings<T>(selector: (s: Settings) => T): T {
  return useSyncExternalStore(subscribeSettings, () => selector(settings))
}

// Whether the computer is running on its battery, where the browser says (Chrome and Edge do; Safari and Firefox don't).
let onBattery = false

interface BatteryManager extends EventTarget {
  charging: boolean
}

if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
  void (navigator as Navigator & { getBattery: () => Promise<BatteryManager> })
    .getBattery()
    .then((battery) => {
      const update = () => {
        onBattery = !battery.charging
        listeners.forEach((l) => l())
      }
      battery.addEventListener('chargingchange', update)
      update()
    })
    .catch(() => undefined)
}

/** Whether battery saving is in effect now. */
export function savingBattery(s: Settings = settings) {
  return s.batterySaver === 'on' || (s.batterySaver === 'auto' && onBattery)
}

/** Battery saving, for components: re-renders when it switches on or off. */
export function useSavingBattery() {
  return useSyncExternalStore(subscribeSettings, () => savingBattery())
}
