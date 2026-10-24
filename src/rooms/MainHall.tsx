import { MAIN_HALL } from './dimensions.ts'
import { RoomShell } from './RoomShell.tsx'
import { Atmosphere } from './Atmosphere.tsx'

const FOUNTAIN_RADIUS = 1.1

function Fountain() {
  return (
    <group>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[FOUNTAIN_RADIUS, FOUNTAIN_RADIUS + 0.1, 0.5, 32]} />
        <meshStandardMaterial color="#8a8070" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.46, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[FOUNTAIN_RADIUS - 0.1, 32]} />
        <meshStandardMaterial color="#5fa3b8" emissive="#1d4e5c" roughness={0.1} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 0.9, 16]} />
        <meshStandardMaterial color="#9a9080" roughness={0.8} />
      </mesh>
      <pointLight position={[0, 1.6, 0]} color="#9fd8e8" intensity={3} distance={5} />
    </group>
  )
}

function CeilingLamp({ z }: { z: number }) {
  return (
    <group position={[0, MAIN_HALL.height - 0.4, z]}>
      <mesh>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#ffe2b0" emissive="#ffcf85" emissiveIntensity={2} />
      </mesh>
      <pointLight color="#ffcf85" intensity={14} distance={14} decay={1.5} castShadow />
    </group>
  )
}

/** Placeholder main hall: the hub every other room connects to. */
export default function MainHall() {
  return (
    <group>
      <Atmosphere background="#120d08" fog={[18, 40]} />
      <hemisphereLight args={['#ffe9c7', '#5a4430', 1.4]} />
      <RoomShell {...MAIN_HALL} floorColor="#6b4a2f" wallColor="#d8c7a8" ceilingColor="#e8dcc6" />
      <Fountain />
      <CeilingLamp z={-6} />
      <CeilingLamp z={6} />
    </group>
  )
}
