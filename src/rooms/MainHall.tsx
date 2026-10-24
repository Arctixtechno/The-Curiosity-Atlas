import { FountainInteraction } from '../features/discoveries/FountainInteraction.tsx'
import { useSurfaceTexture, useTiledTexture } from '../hooks/useTiledTexture.ts'
import { Atmosphere } from './Atmosphere.tsx'
import { MAIN_HALL } from './dimensions.ts'
import { RoomShell } from './RoomShell.tsx'

const FOUNTAIN_RADIUS = 1.1
const WAINSCOT_HEIGHT = 1
const BEAM_SPACING = 2.5

function Fountain() {
  const stone = useTiledTexture('stone', 3, 0.5)
  return (
    <group>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[FOUNTAIN_RADIUS, FOUNTAIN_RADIUS + 0.1, 0.5, 32]} />
        <meshStandardMaterial color="#c8bca8" map={stone} bumpMap={stone} bumpScale={0.8} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.46, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[FOUNTAIN_RADIUS - 0.1, 32]} />
        <meshStandardMaterial color="#5fa3b8" emissive="#1d4e5c" roughness={0.1} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 0.9, 16]} />
        <meshStandardMaterial color="#c8bca8" map={stone} roughness={0.8} />
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
      <pointLight color="#ffcf85" intensity={14} distance={14} decay={1.5} />
    </group>
  )
}

/** Dark wood panelling along the lower part of the long walls. */
function WainscotPanel({ x, seed }: { x: number; seed: number }) {
  const wood = useSurfaceTexture('wood', MAIN_HALL.length, WAINSCOT_HEIGHT, seed)
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, WAINSCOT_HEIGHT / 2, 0]} receiveShadow>
        <boxGeometry args={[0.06, WAINSCOT_HEIGHT, MAIN_HALL.length]} />
        <meshStandardMaterial color="#9a7658" map={wood} bumpMap={wood} bumpScale={0.5} roughness={0.6} />
      </mesh>
      <mesh position={[0, WAINSCOT_HEIGHT + 0.03, 0]}>
        <boxGeometry args={[0.1, 0.06, MAIN_HALL.length]} />
        <meshStandardMaterial color="#4a2e1a" roughness={0.5} />
      </mesh>
    </group>
  )
}

/** Dark wood panelling along the lower part of the long walls. */
function Wainscot() {
  const x = MAIN_HALL.width / 2 - 0.03
  return (
    <>
      <WainscotPanel x={-x} seed={3} />
      <WainscotPanel x={x} seed={4} />
    </>
  )
}

function Beam({ z, seed }: { z: number; seed: number }) {
  const wood = useSurfaceTexture('wood', MAIN_HALL.width, 0.24, seed, 200)
  return (
    <mesh position={[0, MAIN_HALL.height - 0.12, z]}>
      <boxGeometry args={[MAIN_HALL.width, 0.24, 0.22]} />
      <meshStandardMaterial color="#8a6648" map={wood} roughness={0.8} />
    </mesh>
  )
}

function CeilingBeams() {
  const count = Math.floor(MAIN_HALL.length / BEAM_SPACING)
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Beam key={i} z={(i - (count - 1) / 2) * BEAM_SPACING} seed={20 + i} />
      ))}
    </>
  )
}

function Runner() {
  const carpet = useSurfaceTexture('carpet', 2.2, MAIN_HALL.length - 2, 5)
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
      <planeGeometry args={[2.2, MAIN_HALL.length - 2]} />
      <meshStandardMaterial color="#c08070" map={carpet} roughness={1} />
    </mesh>
  )
}

/** Placeholder main hall: the hub every other room connects to. */
export default function MainHall() {
  return (
    <group>
      <Atmosphere background="#120d08" fog={[18, 40]} />
      <hemisphereLight args={['#ffe9c7', '#5a4430', 1.4]} />
      <RoomShell
        {...MAIN_HALL}
        floor={{ color: '#ffffff', texture: 'wood' }}
        walls={{ color: '#ffffff', texture: 'plaster' }}
        ceiling={{ color: '#f2e8d8', texture: 'plaster' }}
      />
      <Wainscot />
      <CeilingBeams />
      <Runner />
      <Fountain />
      <FountainInteraction />
      <CeilingLamp z={-6} />
      <CeilingLamp z={6} />
    </group>
  )
}
