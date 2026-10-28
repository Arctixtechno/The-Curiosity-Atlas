import { CornerShading } from '../components/Mouldings.tsx'
import type { TextureName } from '../components/textures.ts'
import { useSurfaceTexture } from '../hooks/useTiledTexture.ts'
import type { BoxCollider } from '../types/room.ts'
import { wallColliders } from './dimensions.ts'

export interface Surface {
  color: string
  texture?: TextureName
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
  /** Soft shading along the corners; off for rooms whose mouldings already shade them. */
  cornerShade?: boolean
}

function Wall({ collider, height, surface, seed }: { collider: BoxCollider; height: number; surface: Surface; seed: number }) {
  const sizeX = collider.maxX - collider.minX
  const sizeZ = collider.maxZ - collider.minZ
  const map = useSurfaceTexture(surface.texture, Math.max(sizeX, sizeZ), height, seed)
  return (
    <mesh position={[(collider.minX + collider.maxX) / 2, height / 2, (collider.minZ + collider.maxZ) / 2]} receiveShadow>
      <boxGeometry args={[sizeX, height, sizeZ]} />
      <meshStandardMaterial color={surface.color} map={map} bumpMap={map} bumpScale={0.3} roughness={0.95} />
    </mesh>
  )
}

/** Floor, four walls and an optional flat ceiling, matching `wallColliders`. Each surface gets its own texture. */
export function RoomShell({ width, length, height, floor, walls, ceiling, wallThickness, cornerShade = true }: RoomShellProps) {
  const floorMap = useSurfaceTexture(floor.texture, width, length, 1)
  const ceilingMap = useSurfaceTexture(ceiling?.texture, width, length, 2, 64)

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color={floor.color} map={floorMap} bumpMap={floorMap} bumpScale={0.6} roughness={0.75} />
      </mesh>
      {ceiling && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
          <planeGeometry args={[width, length]} />
          <meshStandardMaterial color={ceiling.color} map={ceilingMap} roughness={1} />
        </mesh>
      )}
      {wallColliders(width, length, wallThickness).map((c, i) => (
        <Wall key={i} collider={c} height={height} surface={walls} seed={10 + i} />
      ))}
      {cornerShade && <CornerShading width={width} length={length} height={height} ceiling={!!ceiling} />}
    </group>
  )
}
