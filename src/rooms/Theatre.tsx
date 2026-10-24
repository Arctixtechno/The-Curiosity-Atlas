import { THEATRE } from './dimensions.ts'
import { RoomShell } from './RoomShell.tsx'
import { Atmosphere } from './Atmosphere.tsx'

const SEAT_ROWS = [-1, 1.4]
const SEATS_PER_ROW = 6

function Seat({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.9, 0.5, 0.7]} />
        <meshStandardMaterial color="#7a1f24" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.65, 0.3]} castShadow>
        <boxGeometry args={[0.9, 0.8, 0.15]} />
        <meshStandardMaterial color="#7a1f24" roughness={0.9} />
      </mesh>
    </group>
  )
}

/** Placeholder theatre: dark walls, a large screen and rows of seats. */
export default function Theatre() {
  const screenZ = -THEATRE.length / 2 + 0.15
  return (
    <group>
      <Atmosphere background="#050406" fog={[14, 30]} />
      <hemisphereLight args={['#e0d0ff', '#2a1a20', 0.9]} />
      <RoomShell {...THEATRE} floorColor="#2a1a1c" wallColor="#1c1418" ceilingColor="#120c10" />

      <mesh position={[0, 2.6, screenZ]}>
        <planeGeometry args={[7, 3.4]} />
        <meshStandardMaterial color="#dfe6f0" emissive="#8a9ab8" emissiveIntensity={0.9} />
      </mesh>
      <pointLight position={[0, 2.6, screenZ + 1.5]} intensity={4} distance={9} color="#b8c6e0" />

      {SEAT_ROWS.map((z) =>
        Array.from({ length: SEATS_PER_ROW }, (_, i) => (
          <Seat key={`${z}-${i}`} x={(i - (SEATS_PER_ROW - 1) / 2) * 1.05} z={z} />
        )),
      )}

      {[-THEATRE.width / 2 + 0.3, THEATRE.width / 2 - 0.3].map((x) => (
        <pointLight key={x} position={[x, 3.4, 2]} color="#ffb070" intensity={6} distance={8} />
      ))}
    </group>
  )
}
