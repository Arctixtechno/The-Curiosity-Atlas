import { useThree } from '@react-three/fiber'
import { Component, lazy, Suspense, useEffect, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react'
import { rooms } from '../rooms/registry.ts'
import { Door } from './Door.tsx'
import { useGame } from './store.ts'
import { roomReady } from './travel.ts'

// One lazy component per interior, so each room is its own code-split chunk.
const interiors: Record<string, LazyExoticComponent<ComponentType>> = {}
for (const room of Object.values(rooms)) {
  if (room.load) interiors[room.id] = lazy(room.load)
}

/**
 * Coordinates which rooms are in the scene (spec section 4). Only the active
 * room's interior is mounted; leaving a room unmounts it, which disposes its
 * geometry and materials, while the browser keeps the loaded code cached.
 * Neighbouring rooms appear only as lightweight exteriors.
 */
export function RoomManager() {
  const activeRoomId = useGame((s) => s.activeRoomId)
  const room = rooms[activeRoomId]
  const Interior = interiors[activeRoomId]

  return (
    <group key={activeRoomId}>
      <RoomErrorBoundary>
        <Suspense fallback={null}>
          <Interior />
          <RoomReady />
        </Suspense>
      </RoomErrorBoundary>
      {room.visibleExteriors?.map((id) => {
        const Exterior = rooms[id].exterior
        return Exterior ? <Exterior key={id} /> : null
      })}
      {room.doors.map((door) => (
        <Door key={door.id} door={door} />
      ))}
    </group>
  )
}

/** Frames to draw behind the fade after compiling, so texture uploads happen while the screen is black. */
const WARM_UP_FRAMES = 2

/**
 * Mounts alongside a room's interior, once its code has loaded. Compiles the
 * room's shaders (in parallel where the browser supports it), lets it draw a
 * couple of frames, then tells the transition it can fade in.
 */
function RoomReady() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    let cancelled = false
    let frames = 0
    const tick = () => {
      if (cancelled) return
      if (++frames >= WARM_UP_FRAMES) roomReady()
      else requestAnimationFrame(tick)
    }
    gl.compileAsync(scene, camera)
      .catch(() => undefined)
      .then(() => requestAnimationFrame(tick))
    return () => {
      cancelled = true
    }
  }, [gl, scene, camera])
  return null
}

/**
 * Keeps a fault in one room's interior from taking down the whole scene: the
 * room's doors and the rest of the world keep working, and the error is logged.
 */
class RoomErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('A room failed to load', error)
    // Don't leave the screen black waiting for a room that won't arrive.
    roomReady()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
