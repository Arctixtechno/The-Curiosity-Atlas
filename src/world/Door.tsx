import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Vector3, type Group } from 'three'
import { Label3D } from '../components/Label3D.tsx'
import { useSurfaceTexture } from '../hooks/useTiledTexture.ts'
import type { DoorDefinition } from '../types/room.ts'
import { useInteractable } from './InteractionSystem.tsx'
import { preloadRoom, travelThrough } from './travel.ts'
import { gameStore } from './store.ts'

const DOOR_WIDTH = 1.3
const DOOR_HEIGHT = 2.3
const OPEN_ANGLE = -1.4
/** Start loading the room behind a door once the player is this close. */
const PRELOAD_RADIUS = 5

/** A door on a room's wall. Open doors lead to another room; the rest are locked for now. */
export function Door({ door }: { door: DoorDefinition }) {
  const hinge = useRef<Group>(null)
  const opening = useRef(false)
  const near = useRef(false)
  const { target } = door
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

  useFrame(({ camera }, delta) => {
    if (hinge.current && opening.current) {
      const r = hinge.current.rotation
      r.y += (OPEN_ANGLE - r.y) * Math.min(1, delta * 8)
    }
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

  return (
    <group position={door.position} rotation={[0, door.rotationY, 0]}>
      <mesh position={[0, DOOR_HEIGHT / 2 + 0.05, -0.04]}>
        <boxGeometry args={[DOOR_WIDTH + 0.2, DOOR_HEIGHT + 0.1, 0.06]} />
        <meshStandardMaterial color="#2e1d10" roughness={0.8} />
      </mesh>
      <group ref={hinge} position={[-DOOR_WIDTH / 2, 0, 0]}>
        <mesh position={[DOOR_WIDTH / 2, DOOR_HEIGHT / 2, 0]} castShadow>
          <boxGeometry args={[DOOR_WIDTH, DOOR_HEIGHT, 0.08]} />
          <meshStandardMaterial
            color={door.color ?? (target ? '#8a5a36' : '#6e5440')}
            map={wood}
            bumpMap={wood}
            bumpScale={door.color ? 0.6 : 2}
            roughness={door.color ? 0.3 : 0.55}
          />
        </mesh>
        <mesh position={[DOOR_WIDTH - 0.17, 1.1, 0.06]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color="#c9a55c" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
      <Label3D text={door.label} position={[0, door.signHeight ?? DOOR_HEIGHT + 0.3, 0.05]} />
    </group>
  )
}
