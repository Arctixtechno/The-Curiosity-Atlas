import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import { rooms } from '../rooms/registry.ts'
import { Door } from './Door.tsx'
import { useGame } from './store.ts'

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
      <Suspense fallback={null}>
        <Interior />
      </Suspense>
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
