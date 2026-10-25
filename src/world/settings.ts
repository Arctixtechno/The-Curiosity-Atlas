import { useSyncExternalStore } from 'react'

// Player preferences, remembered between visits. Mouse sensitivity lives in
// the game store because the [ and ] keys change it mid-game.

export type Quality = 'auto' | 'high' | 'low'

export interface Settings {
  /** Auto lowers the resolution when frames drop; high and low fix it. */
  quality: Quality
  /** Bob the view with each footstep. Off by default when the system asks for reduced motion. */
  headBob: boolean
  /** Vertical field of view in degrees. */
  fov: number
}

const KEY = 'atlas.settings'
const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const DEFAULT_SETTINGS: Settings = { quality: 'auto', headBob: !prefersReducedMotion, fov: 70 }
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

export function useSettings<T>(selector: (s: Settings) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => selector(settings),
  )
}
