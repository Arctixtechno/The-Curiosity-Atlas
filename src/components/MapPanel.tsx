import { MAIN_HALL } from '../rooms/dimensions.ts'
import { rooms } from '../rooms/registry.ts'
import type { DoorDefinition } from '../types/room.ts'
import { closeOverlay } from '../world/overlay.ts'
import { playerPose, useGame } from '../world/store.ts'
import { travelTo } from '../world/travel.ts'
import { useVisited } from '../world/visited.ts'
import { Panel } from './Panel.tsx'
import { MapIcon } from './icons.tsx'
import './MapPanel.css'

export const MAP_OVERLAY = 'map'

const HALL_W = MAIN_HALL.width / 2
const HALL_L = MAIN_HALL.length / 2
/** Size of each room's block on the plan, in metres: along the hall wall, and outwards from it. */
const BLOCK = { along: 4.4, out: 5.5, gap: 0.4 }
const PAD = 2

interface Block {
  door: DoorDefinition
  x: number
  z: number
  w: number
  h: number
}

/** Places a block for the room behind each of the hall's doors, against the wall that door is on. */
function blockFor(door: DoorDefinition, doors: DoorDefinition[]): Block {
  const [x, , z] = door.position
  if (Math.abs(Math.abs(x) - HALL_W) < 0.5) {
    const side = Math.sign(x)
    // Narrower where another door on the same wall is close by, so neighbouring blocks don't overlap.
    const nearest = Math.min(
      ...doors
        .filter((d) => d !== door && Math.sign(d.position[0]) === side && Math.abs(Math.abs(d.position[0]) - HALL_W) < 0.5)
        .map((d) => Math.abs(d.position[2] - z)),
    )
    const along = Math.min(BLOCK.along, nearest - BLOCK.gap)
    return { door, x: side > 0 ? HALL_W + BLOCK.gap : -HALL_W - BLOCK.gap - BLOCK.out, z: z - along / 2, w: BLOCK.out, h: along }
  }
  const side = Math.sign(z)
  const wide = MAIN_HALL.width + 2
  return { door, x: -wide / 2, z: side > 0 ? HALL_L + BLOCK.gap : -HALL_L - BLOCK.gap - BLOCK.out, w: wide, h: BLOCK.out }
}

/** Closes the map and walks straight into the room. */
function goTo(roomId: string) {
  closeOverlay()
  void travelTo(roomId)
}

/**
 * A plan of the house: the main hall in the middle with every room off it,
 * where you are, and which rooms are still to come. Rooms you have been in
 * can be clicked to go straight back to them.
 */
export function MapPanel() {
  const activeRoomId = useGame((s) => s.activeRoomId)
  const visited = useVisited()
  const canGo = (roomId: string | undefined): roomId is string => !!roomId && roomId !== activeRoomId && visited.has(roomId)
  const blocks = rooms.mainHall.doors.map((door, _, doors) => blockFor(door, doors))
  const minX = Math.min(...blocks.map((b) => b.x), -HALL_W) - PAD
  const maxX = Math.max(...blocks.map((b) => b.x + b.w), HALL_W) + PAD
  const minZ = Math.min(...blocks.map((b) => b.z), -HALL_L) - PAD
  const maxZ = Math.max(...blocks.map((b) => b.z + b.h), HALL_L) + PAD
  const inHall = activeRoomId === 'mainHall'

  return (
    <Panel title="Map of the house" subtitle="Where you are, and the rooms you've been to" icon={<MapIcon />}>
      <svg className="map" viewBox={`${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}`} role="img" aria-label="Plan of the house">
        <rect
          className={`map-room${inHall ? ' map-here' : ''}${canGo('mainHall') ? ' map-go' : ''}`}
          x={-HALL_W}
          y={-HALL_L}
          width={HALL_W * 2}
          height={HALL_L * 2}
          onClick={canGo('mainHall') ? () => goTo('mainHall') : undefined}
        />
        <text className="map-label" x={0} y={-1.6}>
          Main Hall
        </text>
        <circle className="map-fountain" cx={0} cy={0} r={1} />
        {blocks.map(({ door, x, z, w, h }) => {
          const target = door.target?.roomId
          const here = target === activeRoomId
          const round = target === 'observatory'
          const go = canGo(target)
          const className = `map-room${target ? '' : ' map-locked'}${here ? ' map-here' : ''}${target === 'courtyard' ? ' map-outdoors' : ''}${go ? ' map-go' : ''}`
          return (
            <g key={door.id} onClick={go ? () => goTo(target) : undefined}>
              {round ? (
                <circle className={className} cx={x + w / 2} cy={z + h / 2} r={Math.min(w, h) / 2} />
              ) : (
                <rect className={className} x={x} y={z} width={w} height={h} rx={0.3} />
              )}
              <text className="map-label" x={x + w / 2} y={z + h / 2 - (target ? 0 : 0.5)}>
                {/* Long names go on two lines to fit their block. */}
                {door.label.length > 11 && door.label.includes(' ')
                  ? door.label.split(' ').map((word, i, words) => (
                      <tspan key={word} x={x + w / 2} dy={i === 0 ? -0.5 * (words.length - 1) : 1}>
                        {word}
                      </tspan>
                    ))
                  : door.label}
              </text>
              {!target && (
                <text className="map-note" x={x + w / 2} y={z + h / 2 + 1.3}>
                  coming later
                </text>
              )}
              {here && (
                <text className="map-note map-note-here" x={x + w / 2} y={z + h / 2 + 1}>
                  you are here
                </text>
              )}
              <rect className="map-door" x={door.position[0] - 0.6} y={door.position[2] - 0.6} width={1.2} height={1.2} />
            </g>
          )
        })}
        {inHall && (
          <g transform={`translate(${playerPose.x} ${playerPose.z}) rotate(${(-playerPose.yaw * 180) / Math.PI})`}>
            <path className="map-you" d="M 0 -1.1 L 0.7 0.7 L 0 0.3 L -0.7 0.7 Z" />
          </g>
        )}
      </svg>
      <div className="map-travel" role="group" aria-label="Go straight to a room you've visited">
        <span className="muted">Go straight to:</span>
        {Object.values(rooms)
          .filter((r) => canGo(r.id))
          .map((r) => (
            <button key={r.id} className="button" onClick={() => goTo(r.id)}>
              {r.displayName}
            </button>
          ))}
        {![...visited].some((id) => id !== activeRoomId) && <span className="muted">rooms you visit will appear here.</span>}
      </div>
      <p className="muted">
        Press <kbd>M</kbd> to open or close the map. Click a room you've been in to go straight back. Rooms marked "coming later"
        open in later versions.
      </p>
    </Panel>
  )
}
