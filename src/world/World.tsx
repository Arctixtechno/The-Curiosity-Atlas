import { rooms, startingRoomId } from '../rooms/registry.ts'
import { Camera } from './Camera.tsx'
import { Player } from './Player.tsx'
import { RoomManager } from './RoomManager.tsx'

interface WorldProps {
  onLockChange: (locked: boolean) => void
}

export function World({ onLockChange }: WorldProps) {
  const activeRoom = rooms[startingRoomId]

  return (
    <>
      <color attach="background" args={['#120d08']} />
      <fog attach="fog" args={['#120d08', 18, 40]} />
      <hemisphereLight args={['#ffe9c7', '#5a4430', 1.4]} />

      <Camera position={activeRoom.spawn.position} yaw={activeRoom.spawn.yaw} />
      <RoomManager activeRoom={activeRoom} />
      <Player colliders={activeRoom.colliders} onLockChange={onLockChange} />
    </>
  )
}
