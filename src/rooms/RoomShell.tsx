import type { TextureName } from '../components/textures.ts'
import { useTiledTexture } from '../hooks/useTiledTexture.ts'
import { wallColliders } from './dimensions.ts'

export interface Surface {
  color: string
  texture?: TextureName
  /** Metres covered by one repeat of the texture. */
  scale?: number
}

interface RoomShellProps {
  width: number
  length: number
  height: number
  floor: Surface
  walls: Surface
  /** Omit for a room with its own ceiling (or none). */
  ceiling?: Surface
  wallThickness?: number
}

/** Floor, four walls and an optional flat ceiling, matching `wallColliders`. */
export function RoomShell({ width, length, height, floor, walls, ceiling, wallThickness }: RoomShellProps) {
  const floorScale = floor.scale ?? 2
  const wallScale = walls.scale ?? 2.5
  const floorMap = useTiledTexture(floor.texture, width / floorScale, length / floorScale)
  const ceilingMap = useTiledTexture(ceiling?.texture, width / 3, length / 3)
  const longWallMap = useTiledTexture(walls.texture, length / wallScale, height / wallScale)
  const shortWallMap = useTiledTexture(walls.texture, width / wallScale, height / wallScale)

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color={floor.color} map={floorMap} bumpMap={floorMap} bumpScale={0.6} roughness={0.8} />
      </mesh>
      {ceiling && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
          <planeGeometry args={[width, length]} />
          <meshStandardMaterial color={ceiling.color} map={ceilingMap} roughness={1} />
        </mesh>
      )}
      {wallColliders(width, length, wallThickness).map((c, i) => (
        <mesh key={i} position={[(c.minX + c.maxX) / 2, height / 2, (c.minZ + c.maxZ) / 2]} receiveShadow>
          <boxGeometry args={[c.maxX - c.minX, height, c.maxZ - c.minZ]} />
          <meshStandardMaterial
            color={walls.color}
            map={i < 2 ? longWallMap : shortWallMap}
            bumpMap={i < 2 ? longWallMap : shortWallMap}
            bumpScale={0.4}
            roughness={0.95}
          />
        </mesh>
      ))}
    </group>
  )
}
