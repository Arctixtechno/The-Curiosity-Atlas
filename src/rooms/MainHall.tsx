import { Html } from '@react-three/drei'
import type { Collider } from '../types/room.ts'

// Placeholder hallway built from simple geometry. Dimensions are in metres.
const WIDTH = 8
const LENGTH = 20
const HEIGHT = 3.6
const WALL = 0.2

const halfW = WIDTH / 2
const halfL = LENGTH / 2

const FOUNTAIN_RADIUS = 1.1

export const mainHallColliders: Collider[] = [
  { minX: -halfW - WALL, maxX: -halfW, minZ: -halfL, maxZ: halfL },
  { minX: halfW, maxX: halfW + WALL, minZ: -halfL, maxZ: halfL },
  { minX: -halfW, maxX: halfW, minZ: -halfL - WALL, maxZ: -halfL },
  { minX: -halfW, maxX: halfW, minZ: halfL, maxZ: halfL + WALL },
  {
    minX: -FOUNTAIN_RADIUS,
    maxX: FOUNTAIN_RADIUS,
    minZ: -FOUNTAIN_RADIUS,
    maxZ: FOUNTAIN_RADIUS,
  },
]

interface DoorProps {
  label: string
  position: [number, number, number]
  rotationY: number
}

// Closed placeholder door. Opening doors and entering rooms is Phase 1.
function Door({ label, position, rotationY }: DoorProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 1.15, 0]} castShadow>
        <boxGeometry args={[1.3, 2.3, 0.08]} />
        <meshStandardMaterial color="#6e4527" roughness={0.6} />
      </mesh>
      <mesh position={[0.48, 1.1, 0.06]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial color="#c9a55c" metalness={0.8} roughness={0.3} />
      </mesh>
      <Html position={[0, 2.6, 0.05]} transform distanceFactor={4} pointerEvents="none">
        <div
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            background: 'rgba(24, 18, 12, 0.75)',
            color: '#f4ead8',
            fontFamily: 'Georgia, serif',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  )
}

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
    <group position={[0, HEIGHT - 0.4, z]}>
      <mesh>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#ffe2b0" emissive="#ffcf85" emissiveIntensity={2} />
      </mesh>
      <pointLight color="#ffcf85" intensity={14} distance={14} decay={1.5} castShadow />
    </group>
  )
}

export function MainHall() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[WIDTH, LENGTH]} />
        <meshStandardMaterial color="#6b4a2f" roughness={0.75} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, HEIGHT, 0]}>
        <planeGeometry args={[WIDTH, LENGTH]} />
        <meshStandardMaterial color="#e8dcc6" roughness={1} />
      </mesh>

      {mainHallColliders.slice(0, 4).map((c, i) => (
        <mesh
          key={i}
          position={[(c.minX + c.maxX) / 2, HEIGHT / 2, (c.minZ + c.maxZ) / 2]}
          receiveShadow
        >
          <boxGeometry args={[c.maxX - c.minX, HEIGHT, c.maxZ - c.minZ]} />
          <meshStandardMaterial color="#d8c7a8" roughness={0.95} />
        </mesh>
      ))}

      <Door label="Library" position={[0, 0, -halfL + 0.05]} rotationY={0} />
      <Door label="Entrance" position={[0, 0, halfL - 0.05]} rotationY={Math.PI} />
      <Door label="Laboratory" position={[-halfW + 0.05, 0, 0]} rotationY={Math.PI / 2} />
      <Door label="Theatre" position={[halfW - 0.05, 0, 0]} rotationY={-Math.PI / 2} />
      <Door label="Philosophy Lounge" position={[-halfW + 0.05, 0, 6]} rotationY={Math.PI / 2} />
      <Door label="Observatory" position={[halfW - 0.05, 0, -6]} rotationY={-Math.PI / 2} />

      <Fountain />

      <CeilingLamp z={-6} />
      <CeilingLamp z={6} />
    </group>
  )
}
