import type { RoomDefinition } from '../types/room.ts'
import { MainHall, mainHallColliders } from './MainHall.tsx'

// Every room the Room Manager knows about. New rooms are added here.
export const rooms: Record<string, RoomDefinition> = {
  mainHall: {
    id: 'mainHall',
    displayName: 'Main Hall',
    spawn: { position: [0, 1.65, 7], yaw: 0 },
    colliders: mainHallColliders,
    component: MainHall,
  },
}

export const startingRoomId = 'mainHall'
