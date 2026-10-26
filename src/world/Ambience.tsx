import { useEffect } from 'react'
import { COURTYARD, COURTYARD_FOUNTAIN } from '../rooms/dimensions.ts'
import { hourAt, phaseAt } from './clock.ts'
import { setLevel, type AmbienceName, type Floor } from './sound.ts'
import { gameStore, playerPose } from './store.ts'

// Which sounds each room has, and how loud. The fountain gets louder as you
// walk up to it; birds sing in the courtyard by day only.

type Levels = Partial<Record<AmbienceName, number>>

/** The fountain's loudness from where the player stands in the courtyard. */
function fountainNear(): number {
  const [fx, fz] = COURTYARD_FOUNTAIN.at
  const d = Math.hypot(playerPose.x - fx, playerPose.z - fz)
  return Math.max(0.08, Math.min(1, 1 - (d - 3) / (COURTYARD.length * 0.7))) ** 2
}

function roomLevels(roomId: string): Levels {
  const day = phaseAt(hourAt()) === 'day'
  switch (roomId) {
    case 'lounge':
      return { fire: 0.9, rain: 0.3 }
    case 'courtyard':
      return { fountain: fountainNear(), birds: day ? 0.8 : 0, city: 0.25 }
    case 'terrace':
      return { city: 0.8, fountain: 0.1, birds: day ? 0.25 : 0, wind: 0.2 }
    case 'observatory':
      return { wind: 0.3 }
    case 'cafe':
      return { city: 0.08 }
    default:
      return {}
  }
}

const ALL: AmbienceName[] = ['fire', 'rain', 'fountain', 'city', 'birds', 'wind']

/** What the floor underfoot is made of in each room, for footsteps. */
const FLOORS: Record<string, Floor> = {
  theatre: 'carpet',
  library: 'wood',
  courtyard: 'stone',
  terrace: 'stone',
  museum: 'stone',
  laboratory: 'tile',
  cafe: 'tile',
}

export function floorIn(roomId: string): Floor {
  return FLOORS[roomId] ?? 'wood'
}

/** Keeps the room's sounds at the right levels: on arrival, as you move, and as day turns to night. */
export function Ambience() {
  useEffect(() => {
    const update = () => {
      const levels = roomLevels(gameStore.get().activeRoomId)
      for (const name of ALL) setLevel(name, levels[name] ?? 0)
    }
    update()
    const timer = setInterval(update, 250)
    return () => {
      clearInterval(timer)
      for (const name of ALL) setLevel(name, 0)
    }
  }, [])
  return null
}
