import { PointerLockControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Euler, Vector3 } from 'three'
import { useKeyboard } from '../hooks/useKeyboard.ts'
import { EYE_HEIGHT } from '../rooms/dimensions.ts'
import type { Collider } from '../types/room.ts'
import { moveWithCollisions } from './collision.ts'
import { gameStore } from './store.ts'

const WALK_SPEED = 2.2
const RUN_SPEED = 4
/** Mouse look speed (three.js default is 1). */
const MOUSE_SENSITIVITY = 1.8
/** Arrow-key look speed in radians per second. */
const KEY_TURN_SPEED = 2
const KEY_PITCH_SPEED = 1.3
const MAX_PITCH = Math.PI / 2 - 0.05
/** Head bob height in metres, and bobs per metre walked. */
const BOB_HEIGHT = 0.035
const BOB_FREQUENCY = 1.6

const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface PlayerProps {
  colliders: Collider[]
}

const forward = new Vector3()
const right = new Vector3()
const up = new Vector3(0, 1, 0)
const euler = new Euler(0, 0, 0, 'YXZ')

const held = (k: Set<string>, code: string) => Number(k.has(code))

/**
 * First-person player: WASD to walk, mouse or arrow keys to look, a gentle
 * head bob while walking (off when the system asks for reduced motion).
 */
export function Player({ colliders }: PlayerProps) {
  const keys = useKeyboard()
  const bobPhase = useRef(0)

  // Q releases the mouse. Escape does too, but in full screen the browser
  // also uses Escape to leave full screen, which can't be prevented.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyQ' && document.pointerLockElement) document.exitPointerLock()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useFrame(({ camera }, delta) => {
    const { isExploring, transitioning } = gameStore.get()
    if (!isExploring || transitioning) return
    const k = keys.current
    const dt = Math.min(delta, 0.05)

    const turn = held(k, 'ArrowLeft') - held(k, 'ArrowRight')
    const pitch = held(k, 'ArrowUp') - held(k, 'ArrowDown')
    if (turn || pitch) {
      euler.setFromQuaternion(camera.quaternion)
      euler.y += turn * KEY_TURN_SPEED * dt
      euler.x = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, euler.x + pitch * KEY_PITCH_SPEED * dt))
      camera.quaternion.setFromEuler(euler)
    }

    const ahead = held(k, 'KeyW') - held(k, 'KeyS')
    const side = held(k, 'KeyD') - held(k, 'KeyA')
    let moved = 0

    if (ahead || side) {
      camera.getWorldDirection(forward)
      forward.y = 0
      forward.normalize()
      right.crossVectors(forward, up)

      const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? RUN_SPEED : WALK_SPEED
      // Cap the step so a long frame (e.g. tab switch) can't tunnel through walls.
      const move = forward.multiplyScalar(ahead).add(right.multiplyScalar(side)).normalize().multiplyScalar(speed * dt)

      const [x, z] = moveWithCollisions(camera.position.x, camera.position.z, move.x, move.z, colliders)
      moved = Math.hypot(x - camera.position.x, z - camera.position.z)
      camera.position.x = x
      camera.position.z = z
    }

    if (reduceMotion) return
    if (moved > 0) {
      bobPhase.current += moved * BOB_FREQUENCY * Math.PI * 2
    } else {
      // Settle back to the nearest resting point instead of snapping.
      const rest = Math.round(bobPhase.current / Math.PI) * Math.PI
      bobPhase.current += (rest - bobPhase.current) * Math.min(1, dt * 10)
    }
    camera.position.y = EYE_HEIGHT + Math.abs(Math.sin(bobPhase.current)) * BOB_HEIGHT
  })

  return (
    <PointerLockControls
      pointerSpeed={MOUSE_SENSITIVITY}
      onLock={() => gameStore.set({ isExploring: true })}
      onUnlock={() => {
        keys.current.clear()
        gameStore.set({ isExploring: false, prompt: null })
      }}
    />
  )
}
