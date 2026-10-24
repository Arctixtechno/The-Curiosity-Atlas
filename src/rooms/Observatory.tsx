import { Stars } from '@react-three/drei'
import { BackSide } from 'three'
import { OBSERVATORY } from './dimensions.ts'
import { RoomShell } from './RoomShell.tsx'
import { Atmosphere } from './Atmosphere.tsx'

// The dome has to cover the square room's corners.
const DOME_RADIUS = Math.hypot(OBSERVATORY.width, OBSERVATORY.length) / 2

function Telescope() {
  return (
    <group position={[0, 0, -1]}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.5, 1, 16]} />
        <meshStandardMaterial color="#3b3b44" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.5, -0.3]} rotation={[-0.7, 0, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.22, 2.2, 20]} />
        <meshStandardMaterial color="#b08d57" metalness={0.8} roughness={0.25} />
      </mesh>
    </group>
  )
}

/** Placeholder observatory: an open dome onto the night sky and a telescope. */
export default function Observatory() {
  return (
    <group>
      <Atmosphere background="#03040c" />
      <hemisphereLight args={['#8a9fe0', '#2a2430', 1.3]} />
      <RoomShell {...OBSERVATORY} floorColor="#3a3330" wallColor="#4a4560" />

      <mesh position={[0, OBSERVATORY.height, 0]}>
        <sphereGeometry args={[DOME_RADIUS, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#0b0d22" side={BackSide} transparent opacity={0.25} />
      </mesh>
      <Stars radius={40} depth={20} count={2500} factor={3} fade speed={0.3} />

      <Telescope />
      <pointLight position={[0, 3, 2]} color="#ffd9a0" intensity={12} distance={12} />
    </group>
  )
}
