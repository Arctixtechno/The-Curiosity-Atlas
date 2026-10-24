import { useSyncExternalStore } from 'react'
import { startingPlacement, startingRoomId } from '../rooms/registry.ts'
import type { Placement } from '../types/room.ts'

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
}

let state: GameState = {
  isExploring: false,
  activeRoomId: startingRoomId,
  arrival: startingPlacement,
  transitioning: false,
  prompt: null,
  nearbyRoomIds: new Set(),
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
