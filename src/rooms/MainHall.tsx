import { useSurfaceTexture, useTiledTexture } from '../hooks/useTiledTexture.ts'
import { Bench, CoatStand, ConsoleTable, Flowers } from '../components/Furnishings.tsx'
import { Painting } from '../components/Painting.tsx'
import { MapTable } from '../features/tourism/MapTable.tsx'
import { Atmosphere } from './Atmosphere.tsx'
import { HALL_FURNITURE, HALL_PLANTS, MAIN_HALL } from './dimensions.ts'
import { RoomShell } from './RoomShell.tsx'

const FOUNTAIN_RADIUS = 1.1
const SKIRTING_HEIGHT = 0.18
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
/** Low wooden skirting board running round all four walls. */
function Skirting() {
  const hw = MAIN_HALL.width / 2 - 0.02
  const hl = MAIN_HALL.length / 2 - 0.02
  const pieces: { position: [number, number, number]; size: [number, number, number]; seed: number }[] = [
    { position: [-hw, SKIRTING_HEIGHT / 2, 0], size: [0.04, SKIRTING_HEIGHT, MAIN_HALL.length], seed: 3 },
    { position: [hw, SKIRTING_HEIGHT / 2, 0], size: [0.04, SKIRTING_HEIGHT, MAIN_HALL.length], seed: 4 },
    { position: [0, SKIRTING_HEIGHT / 2, -hl], size: [MAIN_HALL.width, SKIRTING_HEIGHT, 0.04], seed: 5 },
    { position: [0, SKIRTING_HEIGHT / 2, hl], size: [MAIN_HALL.width, SKIRTING_HEIGHT, 0.04], seed: 6 },
  ]
  return (
    <>
      {pieces.map((p) => (
        <SkirtingPiece key={p.seed} {...p} />
      ))}
    </>
  )
}

function SkirtingPiece({
  position,
  size,
  seed,
}: {
  position: [number, number, number]
  size: [number, number, number]
  seed: number
}) {
  const wood = useSurfaceTexture('wood', Math.max(size[0], size[2]), size[1], seed, 200)
  return (
    <group position={position}>
      <mesh receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#6e4a30" map={wood} roughness={0.5} />
      </mesh>
      {/* Rounded moulding along the top edge. */}
      <mesh position={[0, size[1] / 2, 0]} rotation={size[0] > size[2] ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, Math.max(size[0], size[2]), 8]} />
        <meshStandardMaterial color="#5a3a24" roughness={0.45} />
      </mesh>
    </group>
  )
}

/** A potted plant for the corners. */
function Plant({ x, z }: { x: number; z: number }) {
  const leaves = useTiledTexture('hedge', 1.5, 1.5)
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.2, 0.56, 20]} />
        <meshStandardMaterial color="#2c3b3a" roughness={0.35} metalness={0.2} />
      </mesh>
      {[
        [0, 1.0, 0, 0.42],
        [0.18, 1.35, 0.08, 0.32],
        [-0.15, 1.3, -0.06, 0.34],
        [0.02, 1.65, 0.02, 0.26],
      ].map(([px, py, pz, r], i) => (
        <mesh key={i} position={[px, py, pz]} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color="#b8d098" map={leaves} roughness={0.9} flatShading />
        </mesh>
      ))}
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.6, 6]} />
        <meshStandardMaterial color="#4a3422" />
      </mesh>
    </group>
  )
}

/** Paintings between the doors, each with its own picture light. */
function Paintings() {
  const x = MAIN_HALL.width / 2 - 0.01
  const z = MAIN_HALL.length / 2 - 0.01
  return (
    <>
      {/* Over the console table. */}
      <Painting name="seascape" position={[-x, 1.95, HALL_FURNITURE.console[1]]} rotationY={Math.PI / 2} width={0.9} />
      <Painting name="map" position={[-x, 1.85, -6]} rotationY={Math.PI / 2} width={1} />
      <Painting name="botanical" position={[-x, 1.85, 3]} rotationY={Math.PI / 2} width={0.9} />
      <Painting name="stars" position={[x, 1.85, -3]} rotationY={-Math.PI / 2} width={1} />
      <Painting name="hills" position={[x, 1.85, 3]} rotationY={-Math.PI / 2} />
      <Painting name="abstract" position={[x, 1.85, 6]} rotationY={-Math.PI / 2} width={0.9} />
      <Painting name="hills" position={[-2.5, 1.85, -z]} rotationY={0} width={0.8} />
      <Painting name="map" position={[2.5, 1.85, -z]} rotationY={0} width={0.8} />
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
      <Skirting />
      <Paintings />
      {HALL_PLANTS.map(([x, z]) => (
        <Plant key={`${x}-${z}`} x={x} z={z} />
      ))}
      <CeilingBeams />
      <Runner />
      <Fountain />
      <MapTable />
      <CoatStand position={[HALL_FURNITURE.coatStand[0], 0, HALL_FURNITURE.coatStand[1]]} />
      <Bench position={[HALL_FURNITURE.bench[0], 0, HALL_FURNITURE.bench[1]]} rotationY={Math.PI / 2} />
      <ConsoleTable position={[HALL_FURNITURE.console[0], 0, HALL_FURNITURE.console[1]]} rotationY={Math.PI / 2}>
        <Flowers position={[0.25, 0, 0]} />
        {/* A small stack of books. */}
        <mesh position={[-0.25, 0.03, 0]} rotation={[0, 0.2, 0]}>
          <boxGeometry args={[0.24, 0.06, 0.17]} />
          <meshStandardMaterial color="#6a2c22" roughness={0.8} />
        </mesh>
        <mesh position={[-0.24, 0.085, 0.01]} rotation={[0, -0.1, 0]}>
          <boxGeometry args={[0.21, 0.05, 0.15]} />
          <meshStandardMaterial color="#2c4a5a" roughness={0.8} />
        </mesh>
      </ConsoleTable>
      <CeilingLamp z={-6} />
      <CeilingLamp z={6} />
    </group>
  )
}
