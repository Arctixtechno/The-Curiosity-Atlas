import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { PointLight } from 'three'
import { LoungeInteraction } from '../features/philosophy/LoungeInteraction.tsx'
import { useTiledTexture } from '../hooks/useTiledTexture.ts'
import { Atmosphere } from './Atmosphere.tsx'
import { LOUNGE } from './dimensions.ts'
import { RoomShell } from './RoomShell.tsx'

const BOOK_COLOURS = ['#6b2a22', '#2f4a3a', '#1f3350', '#7a5a2a', '#4a2a44', '#8a7a5a', '#2a2a2a']

function Armchair({ x, z, rotationY }: { x: number; z: number; rotationY: number }) {
  const leather = useTiledTexture('leather', 1, 1)
  const material = <meshStandardMaterial color="#7a3b22" map={leather} bumpMap={leather} bumpScale={0.4} roughness={0.55} />
  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.95, 0.5, 0.9]} />
        {material}
      </mesh>
      <mesh position={[0, 0.85, -0.38]} castShadow>
        <boxGeometry args={[0.95, 0.75, 0.2]} />
        {material}
      </mesh>
      {[-0.42, 0.42].map((ax) => (
        <mesh key={ax} position={[ax, 0.62, 0.02]} castShadow>
          <boxGeometry args={[0.16, 0.28, 0.86]} />
          {material}
        </mesh>
      ))}
    </group>
  )
}

function SideTable() {
  const wood = useTiledTexture('wood', 1, 1)
  return (
    <group position={[0, 0, LOUNGE.seatingZ]}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.38, 0.38, 0.04, 28]} />
        <meshStandardMaterial color="#5a3a22" map={wood} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.05, 0.12, 0.5, 12]} />
        <meshStandardMaterial color="#3a2616" roughness={0.6} />
      </mesh>
      {/* A pair of books and a candle. */}
      <mesh position={[-0.1, 0.545, 0.05]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.22, 0.05, 0.3]} />
        <meshStandardMaterial color="#2f4a3a" roughness={0.8} />
      </mesh>
      <mesh position={[0.15, 0.58, -0.08]}>
        <cylinderGeometry args={[0.03, 0.03, 0.12, 12]} />
        <meshStandardMaterial color="#f2ead8" emissive="#ffcf80" emissiveIntensity={0.15} />
      </mesh>
    </group>
  )
}

function Fireplace() {
  const stone = useTiledTexture('stone', 1.5, 1)
  const fire = useRef<PointLight>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (fire.current) fire.current.intensity = 5 + Math.sin(t * 7.3) * 0.6 + Math.sin(t * 13.1) * 0.4
  })
  const z = -LOUNGE.length / 2
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, 0.6, 0.15]} castShadow receiveShadow>
        <boxGeometry args={[2, 1.2, 0.3]} />
        <meshStandardMaterial color="#d8cfc0" map={stone} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.45, 0.31]}>
        <planeGeometry args={[0.9, 0.7]} />
        <meshStandardMaterial color="#120a06" emissive="#ff6a1a" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 1.26, 0.2]} castShadow>
        <boxGeometry args={[2.3, 0.1, 0.45]} />
        <meshStandardMaterial color="#e6ddcc" map={stone} roughness={0.7} />
      </mesh>
      {/* Mirror above the mantel. */}
      <mesh position={[0, 2.05, 0.02]}>
        <boxGeometry args={[1.1, 1.2, 0.04]} />
        <meshStandardMaterial color="#b08d57" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 2.05, 0.05]}>
        <planeGeometry args={[0.95, 1.05]} />
        <meshStandardMaterial color="#8a9aa0" metalness={0.9} roughness={0.08} />
      </mesh>
      <pointLight ref={fire} position={[0, 0.5, 0.7]} color="#ff9a4a" intensity={5} distance={7} decay={1.6} />
    </group>
  )
}

function Bookcase({ x, side }: { x: number; side: 1 | -1 }) {
  const wood = useTiledTexture('wood', 1, 2)
  const shelves = [0.35, 0.85, 1.35, 1.85]
  return (
    <group position={[x, 0, LOUNGE.bookcaseZ]} rotation={[0, (side * Math.PI) / 2, 0]}>
      <mesh position={[0, 1.15, -0.02]} castShadow receiveShadow>
        <boxGeometry args={[LOUNGE.bookcaseLength, 2.3, 0.04]} />
        <meshStandardMaterial color="#3a2616" map={wood} roughness={0.7} />
      </mesh>
      {shelves.map((y, row) => (
        <group key={y}>
          <mesh position={[0, y - 0.02, 0.16]}>
            <boxGeometry args={[LOUNGE.bookcaseLength, 0.04, 0.34]} />
            <meshStandardMaterial color="#4a3220" map={wood} roughness={0.7} />
          </mesh>
          {Array.from({ length: 18 }, (_, i) => {
            const n = (i * 7 + row * 5) % BOOK_COLOURS.length
            const h = 0.3 + ((i * 13 + row * 3) % 7) * 0.02
            return (
              <mesh key={i} position={[-LOUNGE.bookcaseLength / 2 + 0.15 + i * 0.165, y + h / 2, 0.16]}>
                <boxGeometry args={[0.1 + (n % 3) * 0.02, h, 0.26]} />
                <meshStandardMaterial color={BOOK_COLOURS[n]} roughness={0.85} />
              </mesh>
            )
          })}
        </group>
      ))}
      <mesh position={[0, 2.3, 0.18]}>
        <boxGeometry args={[LOUNGE.bookcaseLength + 0.1, 0.08, 0.4]} />
        <meshStandardMaterial color="#3a2616" map={wood} roughness={0.7} />
      </mesh>
    </group>
  )
}

function FloorLamp({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.5, 8]} />
        <meshStandardMaterial color="#b08d57" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <cylinderGeometry args={[0.16, 0.24, 0.28, 20, 1, true]} />
        <meshStandardMaterial color="#f0dcb0" emissive="#ffc070" emissiveIntensity={0.6} side={2} />
      </mesh>
      <pointLight position={[0, 1.5, 0]} color="#ffcf8a" intensity={2.5} distance={6} />
    </group>
  )
}

/** The Philosophy Lounge (spec section 5.2): a quiet library-like room for conversation by the fire. */
export default function PhilosophyLounge() {
  const carpet = useTiledTexture('carpet', 2, 2)
  const halfW = LOUNGE.width / 2
  return (
    <group>
      <Atmosphere background="#0c0806" />
      <hemisphereLight args={['#ffe2bf', '#3a2a1c', 1.2]} />
      <RoomShell
        {...LOUNGE}
        floor={{ color: '#a07a5a', texture: 'wood' }}
        walls={{ color: '#5f7a66', texture: 'plaster' }}
        ceiling={{ color: '#efe4d0', texture: 'plaster' }}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, LOUNGE.seatingZ + 0.3]} receiveShadow>
        <planeGeometry args={[3.6, 2.8]} />
        <meshStandardMaterial color="#9a4a3a" map={carpet} roughness={1} />
      </mesh>
      <Fireplace />
      <Armchair x={-LOUNGE.chairX} z={LOUNGE.seatingZ} rotationY={Math.PI / 2} />
      <Armchair x={LOUNGE.chairX} z={LOUNGE.seatingZ} rotationY={-Math.PI / 2} />
      <SideTable />
      <Bookcase x={-halfW + 0.02} side={1} />
      <Bookcase x={halfW - 0.02} side={-1} />
      <FloorLamp x={-halfW + 0.6} z={LOUNGE.seatingZ - 1.4} />
      <FloorLamp x={halfW - 0.6} z={LOUNGE.seatingZ - 1.4} />
      <LoungeInteraction position={[0, 0, LOUNGE.seatingZ]} />
    </group>
  )
}
