import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Vector3, type Group } from 'three'
import { Label3D } from '../components/Label3D.tsx'
import { useSurfaceTexture } from '../hooks/useTiledTexture.ts'
import type { DoorDefinition } from '../types/room.ts'
import { CarDoor } from './CarDoor.tsx'
import { useInteractable } from './InteractionSystem.tsx'
import { preloadRoom, travelThrough } from './travel.ts'
import { gameStore } from './store.ts'

const DOOR_WIDTH = 1.3
const DOOR_HEIGHT = 2.3
const OPEN_ANGLE = -1.4
/** Start loading the room behind a door once the player is this close. */
const PRELOAD_RADIUS = 5
/** Deep London front-door navy. */
const FRONT_DOOR_COLOR = '#1d3157'

/** A door on a room's wall. Open doors lead to another room; the rest are locked for now. */
export function Door({ door }: { door: DoorDefinition }) {
  return door.variant === 'car' ? <CarDoor door={door} /> : <HingedDoor door={door} />
}

/**
 * Starts loading the room behind a door when the player comes within reach
 * of `center`, and tells the Room Manager they're nearby.
 */
export function usePreloadNear(door: DoorDefinition, center: Vector3) {
  const near = useRef(false)
  const { target } = door
  useFrame(({ camera }) => {
    if (!target) return
    const dx = camera.position.x - center.x
    const dz = camera.position.z - center.z
    const isNear = dx * dx + dz * dz < PRELOAD_RADIUS * PRELOAD_RADIUS
    if (isNear === near.current) return
    near.current = isNear
    const nearby = new Set(gameStore.get().nearbyRoomIds)
    if (isNear) {
      nearby.add(target.roomId)
      preloadRoom(target.roomId)
    } else {
      nearby.delete(target.roomId)
    }
    gameStore.set({ nearbyRoomIds: nearby })
  })
}

function HingedDoor({ door }: { door: DoorDefinition }) {
  const hinge = useRef<Group>(null)
  const opening = useRef(false)
  const { target } = door
  const front = door.variant === 'front'
  const wood = useSurfaceTexture('door', DOOR_WIDTH, DOOR_HEIGHT, 1, 400)

  const center = useMemo(() => new Vector3(door.position[0], 1.2, door.position[2]), [door.position])

  useInteractable({
    position: center,
    radius: 2.2,
    prompt: target ? (door.prompt ?? `Press E to enter the ${door.label}`) : `${door.label}: opens in a later version`,
    onInteract: target
      ? () => {
          opening.current = true
          void travelThrough(door)
        }
      : undefined,
  })

  usePreloadNear(door, center)
  useFrame((_, delta) => {
    if (hinge.current && opening.current) {
      const r = hinge.current.rotation
      r.y += (OPEN_ANGLE - r.y) * Math.min(1, delta * 8)
    }
  })

  return (
    <group position={door.position} rotation={[0, door.rotationY, 0]}>
      <mesh position={[0, DOOR_HEIGHT / 2 + 0.05, -0.04]}>
        <boxGeometry args={[DOOR_WIDTH + 0.2, DOOR_HEIGHT + 0.1, 0.06]} />
        {/* A front door sits in a white painted surround; inside doors in dark oak. */}
        <meshStandardMaterial color={front ? '#ece7dc' : '#2e1d10'} roughness={front ? 0.5 : 0.8} />
      </mesh>
      <group ref={hinge} position={[-DOOR_WIDTH / 2, 0, 0]}>
        <mesh position={[DOOR_WIDTH / 2, DOOR_HEIGHT / 2, 0]} castShadow>
          <boxGeometry args={[DOOR_WIDTH, DOOR_HEIGHT, 0.08]} />
          {front ? (
            // Gloss paint over timber: the grain shows only faintly through the finish.
            <meshPhysicalMaterial
              color={door.color ?? FRONT_DOOR_COLOR}
              bumpMap={wood}
              bumpScale={0.4}
              roughness={0.35}
              clearcoat={1}
              clearcoatRoughness={0.1}
            />
          ) : (
            <meshStandardMaterial
              color={door.color ?? (target ? '#8a5a36' : '#6e5440')}
              map={wood}
              bumpMap={wood}
              bumpScale={2}
              roughness={0.55}
            />
          )}
        </mesh>
        {front ? (
          <FrontDoorDetails color={door.color ?? FRONT_DOOR_COLOR} />
        ) : (
          <mesh position={[DOOR_WIDTH - 0.17, 1.1, 0.06]}>
            <sphereGeometry args={[0.045, 12, 12]} />
            <meshStandardMaterial color="#c9a55c" metalness={0.8} roughness={0.3} />
          </mesh>
        )}
      </group>
      <Label3D text={door.label} position={[0, door.signHeight ?? DOOR_HEIGHT + 0.3, 0.05]} />
    </group>
  )
}

// Moderate metalness: with no environment map, fully metallic brass renders almost black.
const BRASS = { color: '#dcb86a', metalness: 0.55, roughness: 0.28 }

/**
 * Raised panels and brass furniture for a grand front door: a lion-ring
 * knocker, a letter plate and a centre knob, as on a London townhouse.
 * Drawn on the hinged leaf, in its local space.
 */
function FrontDoorDetails({ color }: { color: string }) {
  const cx = DOOR_WIDTH / 2
  const panelW = DOOR_WIDTH * 0.34
  const panels: [number, number, number][] = [
    [cx - DOOR_WIDTH * 0.21, 0.55, 0.8],
    [cx + DOOR_WIDTH * 0.21, 0.55, 0.8],
    [cx - DOOR_WIDTH * 0.21, 1.62, 1.0],
    [cx + DOOR_WIDTH * 0.21, 1.62, 1.0],
  ]
  return (
    <group>
      {panels.map(([x, y, h]) => (
        <group key={`${x}-${y}`} position={[x, y, 0.04]}>
          {/* Bolection moulding round each panel, then the raised field. */}
          <mesh position={[0, 0, 0.012]}>
            <boxGeometry args={[panelW, h, 0.024]} />
            <meshPhysicalMaterial color={color} roughness={0.3} clearcoat={1} clearcoatRoughness={0.08} />
          </mesh>
          <mesh position={[0, 0, 0.03]}>
            <boxGeometry args={[panelW - 0.1, h - 0.1, 0.02]} />
            <meshPhysicalMaterial color={color} roughness={0.3} clearcoat={1} clearcoatRoughness={0.08} />
          </mesh>
        </group>
      ))}
      {/* Knocker: backplate and ring, at eye level in the middle rail. */}
      <group position={[cx, 1.45, 0.06]}>
        <mesh>
          <cylinderGeometry args={[0.06, 0.06, 0.03, 20]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
        <mesh position={[0, -0.09, 0.03]}>
          <torusGeometry args={[0.07, 0.012, 10, 28]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
      </group>
      {/* Letter plate on the lock rail. */}
      <mesh position={[cx, 1.08, 0.055]}>
        <boxGeometry args={[0.32, 0.07, 0.015]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      {/* Centre knob and keyhole escutcheon. */}
      <mesh position={[cx, 1.2, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.03, 0.05, 20]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[DOOR_WIDTH - 0.14, 1.0, 0.05]}>
        <boxGeometry args={[0.04, 0.1, 0.01]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      {/* Kick plate. */}
      <mesh position={[cx, 0.08, 0.045]}>
        <boxGeometry args={[DOOR_WIDTH - 0.08, 0.14, 0.008]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
    </group>
  )
}
