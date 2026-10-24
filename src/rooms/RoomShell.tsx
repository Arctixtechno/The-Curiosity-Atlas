import { wallColliders } from './dimensions.ts'

interface RoomShellProps {
  width: number
  length: number
  height: number
  floorColor: string
  wallColor: string
  /** Omit for a room with its own ceiling (or none). */
  ceilingColor?: string
  wallThickness?: number
}

/** Floor, four walls and an optional flat ceiling, matching `wallColliders`. */
export function RoomShell({
  width,
  length,
  height,
  floorColor,
  wallColor,
  ceilingColor,
  wallThickness,
}: RoomShellProps) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color={floorColor} roughness={0.8} />
      </mesh>
      {ceilingColor && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
          <planeGeometry args={[width, length]} />
          <meshStandardMaterial color={ceilingColor} roughness={1} />
        </mesh>
      )}
      {wallColliders(width, length, wallThickness).map((c, i) => (
        <mesh key={i} position={[(c.minX + c.maxX) / 2, height / 2, (c.minZ + c.maxZ) / 2]} receiveShadow>
          <boxGeometry args={[c.maxX - c.minX, height, c.maxZ - c.minZ]} />
          <meshStandardMaterial color={wallColor} roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}
