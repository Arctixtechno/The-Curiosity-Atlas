import { rooms } from '../rooms/registry.ts'
import { Camera } from './Camera.tsx'
import { InteractionSystem } from './InteractionSystem.tsx'
import { Player } from './Player.tsx'
import { RoomManager } from './RoomManager.tsx'
import { useGame } from './store.ts'

export function World() {
  const activeRoomId = useGame((s) => s.activeRoomId)

  return (
    <InteractionSystem>
      <Camera />
      <RoomManager />
      <Player colliders={rooms[activeRoomId].colliders} floorHeight={rooms[activeRoomId].floorHeight} />
    </InteractionSystem>
  )
}
