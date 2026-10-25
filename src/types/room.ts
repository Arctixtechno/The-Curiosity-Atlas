import type { ComponentType } from 'react'

/** Axis-aligned box on the floor plane (x/z), in world units (metres). */
export interface BoxCollider {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** Round wall: keeps the player inside a circle on the floor plane. */
export interface RingCollider {
  kind: 'ring'
  x: number
  z: number
  radius: number
}

export type Collider = BoxCollider | RingCollider

/** Lifecycle states from spec section 4.2. */
export type RoomState = 'exterior' | 'preloading' | 'active' | 'unloaded'

/** A door on a room's wall. Its front (local +z) faces into the room. */
export interface DoorDefinition {
  id: string
  label: string
  /** Floor position at the foot of the door, just inside the wall. */
  position: [number, number, number]
  rotationY: number
  /** Where the door leads. Doors without a target are not open yet. */
  target?: { roomId: string; doorId: string }
  /** Prompt shown when the player can open it. Defaults to "Press E to enter the <label>". */
  prompt?: string
  /** Paint colour, multiplied over the wood texture. */
  color?: string
  /** Height of the sign above the floor. */
  signHeight?: number
  /** 'front' adds raised panels and brass furniture, for the house's front door. */
  variant?: 'front'
}

/** Standard room configuration (spec section 8.3). */
export interface RoomDefinition {
  id: string
  displayName: string
  /** Solid areas the player cannot walk through while in this room. */
  colliders: Collider[]
  doors: DoorDefinition[]
  /** Loads the detailed interior. Rooms without one only exist as an exterior. */
  load?: () => Promise<{ default: ComponentType }>
  /** Lightweight stand-in shown from neighbouring rooms. */
  exterior?: ComponentType
  /** Rooms whose exterior is visible from inside this one. */
  visibleExteriors?: string[]
  /** Height of the floor at a point, for rooms with steps. Flat (0) when omitted. */
  floorHeight?: (x: number, z: number) => number
}

export interface Placement {
  position: [number, number, number]
  yaw: number
}
