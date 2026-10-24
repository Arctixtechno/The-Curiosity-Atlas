import { PointerLockControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Vector3 } from 'three'
import { useKeyboard } from '../hooks/useKeyboard.ts'
import type { Collider } from '../types/room.ts'
import { moveWithCollisions } from './collision.ts'

const WALK_SPEED = 2.2
const RUN_SPEED = 4

interface PlayerProps {
  colliders: Collider[]
  onLockChange: (locked: boolean) => void
}

const forward = new Vector3()
const right = new Vector3()
const up = new Vector3(0, 1, 0)

/** First-person player: mouse look via pointer lock, WASD to walk. */
export function Player({ colliders, onLockChange }: PlayerProps) {
  const keys = useKeyboard()
  const locked = useRef(false)

  useFrame(({ camera }, delta) => {
    if (!locked.current) return
    const k = keys.current
    const ahead = Number(k.has('KeyW') || k.has('ArrowUp')) - Number(k.has('KeyS') || k.has('ArrowDown'))
    const side = Number(k.has('KeyD') || k.has('ArrowRight')) - Number(k.has('KeyA') || k.has('ArrowLeft'))
    if (ahead === 0 && side === 0) return

    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()
    right.crossVectors(forward, up)

    const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? RUN_SPEED : WALK_SPEED
    // Cap the step so a long frame (e.g. tab switch) can't tunnel through walls.
    const step = speed * Math.min(delta, 0.05)
    const move = forward.multiplyScalar(ahead).add(right.multiplyScalar(side)).normalize().multiplyScalar(step)

    const [x, z] = moveWithCollisions(camera.position.x, camera.position.z, move.x, move.z, colliders)
    camera.position.x = x
    camera.position.z = z
  })

  return (
    <PointerLockControls
      onLock={() => {
        locked.current = true
        onLockChange(true)
      }}
      onUnlock={() => {
        locked.current = false
        keys.current.clear()
        onLockChange(false)
      }}
    />
  )
}
