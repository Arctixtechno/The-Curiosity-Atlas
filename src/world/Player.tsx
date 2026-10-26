import { PointerLockControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Euler, Vector3 } from 'three'
import { useKeyboard } from '../hooks/useKeyboard.ts'
import { EYE_HEIGHT } from '../rooms/dimensions.ts'
import type { Collider } from '../types/room.ts'
import { moveWithCollisions } from './collision.ts'
import { floorIn } from './Ambience.tsx'
import { headBobOffset, RUN_STRIDE, WALK_STRIDE } from './headBob.ts'
import { footstep } from './sound.ts'
import { getSettings, prefersReducedMotion, updateSettings } from './settings.ts'
import { gameStore, playerPose, saveSensitivity, useGame } from './store.ts'

const WALK_SPEED = 2.2
const RUN_SPEED = 4
/** Arrow-key look speed in radians per second, and how quickly it eases in and out. */
const KEY_TURN_SPEED = 2.4
const KEY_PITCH_SPEED = 1.5
const KEY_LOOK_EASE = 14
const MAX_PITCH = Math.PI / 2 - 0.05
const SENSITIVITY_STEP = 0.2
/** Look speed while viewing through an instrument with a narrow field of view. */
const VIEWING_LOOK_SCALE = 0.08
const SENSITIVITY_RANGE = [0.4, 6] as const
/** On the start screen the view sways gently from side to side: how far (radians) and how slowly (radians per second). */
const DRIFT_YAW = 0.07
const DRIFT_PITCH = 0.015
const DRIFT_SPEED = 0.22

interface PlayerProps {
  colliders: Collider[]
  floorHeight?: (x: number, z: number) => number
}

/** How quickly the camera follows a change in floor height (steps), per second. */
const STEP_FOLLOW = 9

const flat = () => 0

const forward = new Vector3()
const right = new Vector3()
const move = new Vector3()
const up = new Vector3(0, 1, 0)
const euler = new Euler(0, 0, 0, 'YXZ')

const held = (k: Set<string>, code: string) => Number(k.has(code))

let toastTimer: ReturnType<typeof setTimeout> | undefined
function showToast(message: string) {
  gameStore.set({ toast: message })
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => gameStore.set({ toast: null }), 1500)
}

/**
 * First-person player: WASD to walk, mouse or arrow keys to look, and a head
 * bob synced to footsteps (can be turned off in Settings; off by default when the system asks for reduced motion).
 */
export function Player({ colliders, floorHeight = flat }: PlayerProps) {
  const keys = useKeyboard()
  const sensitivity = useGame((s) => s.mouseSensitivity)
  const arrival = useGame((s) => s.arrival)
  const viewing = useGame((s) => s.viewing)
  const look = useRef({ yaw: 0, pitch: 0 })
  const bob = useRef({ phase: 0, amount: 0, side: 0 })
  // Distance walked since the last footstep.
  const stride = useRef(0)
  const floorY = useRef(0)
  // The start screen's sway: its clock, and the offset currently applied to the view.
  const drift = useRef({ t: 0, yaw: 0, pitch: 0 })

  // Arriving in a room puts the eye straight at that spot's floor height.
  useEffect(() => {
    floorY.current = arrival.position[1] - EYE_HEIGHT
    bob.current.side = 0
  }, [arrival])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Q releases the mouse. Escape does too, but in full screen the browser
      // also uses Escape to leave full screen, which can't be prevented.
      if (e.code === 'KeyQ' && document.pointerLockElement) document.exitPointerLock()
      if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
        const [min, max] = SENSITIVITY_RANGE
        const step = e.code === 'BracketRight' ? SENSITIVITY_STEP : -SENSITIVITY_STEP
        const next = Math.round(Math.min(max, Math.max(min, gameStore.get().mouseSensitivity + step)) * 10) / 10
        gameStore.set({ mouseSensitivity: next })
        saveSensitivity(next)
        showToast(`Mouse sensitivity ${next.toFixed(1)}`)
      }
      if (e.code === 'KeyN' && !e.repeat) {
        const muted = !getSettings().muted
        updateSettings({ muted })
        showToast(muted ? 'Sound off (N to turn it back on)' : 'Sound on')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useFrame(({ camera }, delta) => {
    const { isExploring, transitioning, viewing, overlay } = gameStore.get()
    if (!isExploring && !transitioning && !overlay && !viewing && !prefersReducedMotion) {
      // Behind the start screen the room isn't frozen: the view drifts slowly, as if someone were looking round.
      // Only the change since last frame is applied, so starting to explore picks up wherever the sway has got to.
      const d = drift.current
      d.t += Math.min(delta, 0.1) * DRIFT_SPEED
      const yaw = Math.sin(d.t) * DRIFT_YAW
      const pitch = Math.sin(d.t * 0.7) * DRIFT_PITCH
      euler.setFromQuaternion(camera.quaternion)
      euler.y += yaw - d.yaw
      euler.x = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, euler.x + pitch - d.pitch))
      camera.quaternion.setFromEuler(euler)
      d.yaw = yaw
      d.pitch = pitch
    }
    if (!isExploring || transitioning) return
    const k = keys.current
    const dt = Math.min(delta, 0.05)
    // Through an instrument's narrow view, looking around slows right down.
    const lookScale = viewing ? VIEWING_LOOK_SCALE : 1

    // Arrow keys: ease the turn rate in and out so looking feels smooth.
    const ease = Math.min(1, dt * KEY_LOOK_EASE)
    const l = look.current
    l.yaw += ((held(k, 'ArrowLeft') - held(k, 'ArrowRight')) * KEY_TURN_SPEED - l.yaw) * ease
    l.pitch += ((held(k, 'ArrowUp') - held(k, 'ArrowDown')) * KEY_PITCH_SPEED - l.pitch) * ease
    if (Math.abs(l.yaw) > 1e-3 || Math.abs(l.pitch) > 1e-3) {
      euler.setFromQuaternion(camera.quaternion)
      euler.y += l.yaw * dt * lookScale
      euler.x = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, euler.x + l.pitch * dt * lookScale))
      camera.quaternion.setFromEuler(euler)
    }
    // The instrument holds the camera in place.
    if (viewing) return

    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()
    playerPose.x = camera.position.x
    playerPose.z = camera.position.z
    playerPose.yaw = Math.atan2(-forward.x, -forward.z)
    right.crossVectors(forward, up)
    // Take off last frame's sway so collisions use the real position.
    const b = bob.current
    camera.position.addScaledVector(right, -b.side)

    const ahead = held(k, 'KeyW') - held(k, 'KeyS')
    const side = held(k, 'KeyD') - held(k, 'KeyA')
    const running = k.has('ShiftLeft') || k.has('ShiftRight')
    let moved = 0

    if (ahead || side) {
      const speed = running ? RUN_SPEED : WALK_SPEED
      // Cap the step (via dt) so a long frame can't tunnel through walls.
      move
        .copy(forward)
        .multiplyScalar(ahead)
        .addScaledVector(right, side)
        .normalize()
        .multiplyScalar(speed * dt)
      const [x, z] = moveWithCollisions(camera.position.x, camera.position.z, move.x, move.z, colliders)
      moved = Math.hypot(x - camera.position.x, z - camera.position.z)
      camera.position.x = x
      camera.position.z = z
    }

    // Ease towards the floor height under the player, so steps feel like steps rather than jumps.
    const targetFloor = floorHeight(camera.position.x, camera.position.z)
    floorY.current += (targetFloor - floorY.current) * Math.min(1, dt * STEP_FOLLOW)
    const eye = floorY.current + EYE_HEIGHT

    stride.current += moved
    if (stride.current >= (running ? RUN_STRIDE : WALK_STRIDE)) {
      stride.current = 0
      footstep(floorIn(gameStore.get().activeRoomId), running)
    }

    if (!getSettings().headBob) {
      b.side = 0
      camera.position.y = eye
      return
    }
    // Half a cycle per stride; fade the bob in when walking and out when stopping.
    b.phase += (moved / (running ? RUN_STRIDE : WALK_STRIDE)) * Math.PI
    b.amount += ((moved > 0 ? (running ? 1.3 : 1) : 0) - b.amount) * Math.min(1, dt * 6)
    const offset = headBobOffset(b.phase, b.amount)
    b.side = offset.side
    camera.position.y = eye + offset.up
    camera.position.addScaledVector(right, b.side)
  })

  return (
    <PointerLockControls
      pointerSpeed={sensitivity * (viewing ? VIEWING_LOOK_SCALE : 1)}
      onLock={() => gameStore.set({ isExploring: true })}
      onUnlock={() => {
        keys.current.clear()
        // A panel opening over a view (the seat in the lounge) keeps it; otherwise releasing the mouse ends it.
        const { overlay, viewing } = gameStore.get()
        gameStore.set({ isExploring: false, prompt: null, viewing: overlay ? viewing : null })
      }}
    />
  )
}
