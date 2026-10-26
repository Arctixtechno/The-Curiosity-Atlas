import { useSyncExternalStore } from 'react'
import { startingPlacement, startingRoomId } from '../rooms/registry.ts'
import type { Journey, Placement } from '../types/room.ts'

// Small shared state for the 3D world and the HTML overlay. Kept dependency
// free; swap for a library if it grows.

export interface GameState {
  /** Pointer is locked and the player can move. */
  isExploring: boolean
  activeRoomId: string
  /** Where the camera is placed when the active room changes. */
  arrival: Placement
  /** Screen is fading out/in during a room transition. */
  transitioning: boolean
  /** Interaction prompt for the object the player is looking at. */
  prompt: string | null
  /** Rooms whose doors the player is currently standing near. */
  nearbyRoomIds: ReadonlySet<string>
  /** Mouse look speed multiplier (three.js default is 1). */
  mouseSensitivity: number
  /** Short message shown briefly in the corner, e.g. after changing a setting. */
  toast: string | null
  /** A full-screen panel (film menu, settings, map…) that has taken over from exploring, if any. */
  overlay: string | null
  /** Looking through an instrument (the telescope) instead of walking about. */
  viewing: string | null
  /** A drive in progress, shown in place of the fade, and whether it is heading out or coming home. */
  journey: (Journey & { homeward: boolean }) | null
}

const SENSITIVITY_KEY = 'atlas.mouseSensitivity'
export const DEFAULT_SENSITIVITY = 2.6

function loadSensitivity(): number {
  try {
    const saved = Number(localStorage.getItem(SENSITIVITY_KEY))
    return saved > 0 ? saved : DEFAULT_SENSITIVITY
  } catch {
    return DEFAULT_SENSITIVITY
  }
}

export function saveSensitivity(value: number) {
  try {
    localStorage.setItem(SENSITIVITY_KEY, String(value))
  } catch {
    // Storage can be unavailable (private windows); the setting just won't persist.
  }
}

let state: GameState = {
  isExploring: false,
  activeRoomId: startingRoomId,
  arrival: startingPlacement,
  transitioning: false,
  prompt: null,
  nearbyRoomIds: new Set(),
  mouseSensitivity: loadSensitivity(),
  toast: null,
  overlay: null,
  viewing: null,
  journey: null,
}

const listeners = new Set<() => void>()

export const gameStore = {
  get: () => state,
  set(partial: Partial<GameState>) {
    state = { ...state, ...partial }
    listeners.forEach((l) => l())
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

export function useGame<T>(selector: (s: GameState) => T): T {
  return useSyncExternalStore(gameStore.subscribe, () => selector(state))
}

/**
 * Where the player is standing and which way they face (radians, 0 = -z),
 * updated every frame for things like the map. Plain object rather than
 * store state, so writing it doesn't re-render anything.
 */
export const playerPose = { x: 0, z: 0, yaw: 0 }
