import type { RoomDefinition } from '../types/room.ts'

interface RoomManagerProps {
  activeRoom: RoomDefinition
}

/**
 * Decides which rooms are in the scene. In Phase 0 only the active room is
 * rendered; exterior, preloading and unloading states (spec section 4) come
 * in Phase 1.
 */
export function RoomManager({ activeRoom }: RoomManagerProps) {
  const Room = activeRoom.component
  return <Room key={activeRoom.id} />
}
