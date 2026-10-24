import type { ComponentType } from 'react'

/** Axis-aligned box on the floor plane (x/z), in world units (metres). */
export interface Collider {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** Lifecycle states from spec section 4.2. Only `active` is used in Phase 0. */
export type RoomState = 'exterior' | 'preloading' | 'active' | 'unloaded'

/** Standard room configuration (spec section 8.3). */
export interface RoomDefinition {
  id: string
  displayName: string
  /** Where the player appears when the room is entered. */
  spawn: { position: [number, number, number]; yaw: number }
  /** Solid areas the player cannot walk through. */
  colliders: Collider[]
  component: ComponentType
}
