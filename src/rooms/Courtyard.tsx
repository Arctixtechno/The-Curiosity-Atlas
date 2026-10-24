import { RoundedBox, Sky } from '@react-three/drei'
import { useSurfaceTexture, useTiledTexture } from '../hooks/useTiledTexture.ts'
import { Atmosphere } from './Atmosphere.tsx'
import { COURTYARD } from './dimensions.ts'
import { Portico, SashWindow, TerraceWall } from './Townhouse.tsx'

const SUN: [number, number, number] = [45, 40, 8]
const HOUSE_Z = -COURTYARD.length / 2
const TERRACE_WIDTH = 44

function Tree({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  const leaves = useTiledTexture('hedge', 2, 2)
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.2, 2.8, 10]} />
        <meshStandardMaterial color="#3e2c1e" roughness={1} />
      </mesh>
      {[
        [0, 3.2, 0, 1.3],
        [0.7, 2.8, 0.3, 0.9],
        [-0.6, 2.9, -0.2, 0.95],
        [0.1, 3.9, -0.3, 0.9],
      ].map(([px, py, pz, r], i) => (
        <mesh key={i} position={[px, py, pz]} castShadow>
          <icosahedronGeometry args={[r, 2]} />
          <meshStandardMaterial color="#c8dca8" map={leaves} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/** A tree in a stone planter, inside the courtyard. */
function PlanterTree({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.6, 0.8]} />
        <meshStandardMaterial color="#9a9284" roughness={0.9} />
      </mesh>
      <Tree x={0} z={0} scale={0.75} />
    </group>
  )
}

/** A clipped box hedge along one side. */
function Hedge({ x, z, width, length }: { x: number; z: number; width: number; length: number }) {
  const leaves = useTiledTexture('hedge', Math.max(width, length), COURTYARD.hedgeHeight)
  return (
    <RoundedBox
      args={[width, COURTYARD.hedgeHeight, length]}
      radius={0.12}
      smoothness={3}
      position={[x, COURTYARD.hedgeHeight / 2, z]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color="#c0d8a0" map={leaves} bumpMap={leaves} bumpScale={3} roughness={1} />
    </RoundedBox>
  )
}

/** The front of the house: a white stucco terrace with a columned porch around the entrance. */
function HouseFront() {
  const upper = [-12, -8, -4, 0, 4, 8, 12]
  const ground = [-12, -8, -4, 4, 8, 12]
  return (
    <group position={[0, 0, HOUSE_Z]}>
      <TerraceWall width={TERRACE_WIDTH} height={11} seed={3} />
      {ground.map((x) => (
        <SashWindow key={`g${x}`} x={x} y={1.9} width={1.3} height={2} lit={x === -4 || x === 8} />
      ))}
      {upper.map((x) => (
        <SashWindow key={`f${x}`} x={x} y={5.6} width={1.3} height={2.4} balconette lit={x === 4} />
      ))}
      {upper.map((x) => (
        <SashWindow key={`s${x}`} x={x} y={8.7} width={1.1} height={1.7} lit={x === -8} />
      ))}
      <Portico />
    </group>
  )
}

/** Houses across the gardens, so the courtyard sits in a street rather than floating in the sky. */
function DistantTerrace() {
  return (
    <group position={[0, 0, 34]} rotation={[0, Math.PI, 0]}>
      <TerraceWall width={110} height={13} seed={8} />
      {Array.from({ length: 21 }, (_, i) => (i - 10) * 5).map((x) =>
        [2, 5.8, 9.4].map((y) => <SashWindow key={`${x}-${y}`} x={x} y={y} width={1.3} height={2} lit={(x + y) % 4 === 0} />),
      )}
    </group>
  )
}

function Ground() {
  const paving = useSurfaceTexture('stone', COURTYARD.width, COURTYARD.length, 4)
  const grass = useTiledTexture('grass', 200, 200)
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[COURTYARD.width, COURTYARD.length]} />
        <meshStandardMaterial color="#ffffff" map={paving} bumpMap={paving} bumpScale={0.8} roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#ffffff" map={grass} roughness={1} />
      </mesh>
    </>
  )
}

/** Placeholder courtyard: a walled garden in front of the house, with the café at the far end. */
export default function Courtyard() {
  const hw = COURTYARD.width / 2
  const hl = COURTYARD.length / 2
  return (
    <group>
      <Atmosphere background="#c4d2e0" fog={[45, 160]} />
      <Sky sunPosition={SUN} turbidity={5} rayleigh={1.2} mieCoefficient={0.004} mieDirectionalG={0.85} />
      <hemisphereLight args={['#dbe7ff', '#6a7350', 1.8]} />
      <directionalLight
        position={SUN}
        intensity={2.6}
        color="#fff1dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-camera-far={120}
        shadow-bias={-0.0005}
      />

      <Ground />
      {/* Side and far hedges. The near side is the house, so there's no hedge there to clash with it. */}
      <Hedge x={-hw - 0.2} z={-0.075} width={0.4} length={COURTYARD.length + 0.15} />
      <Hedge x={hw + 0.2} z={-0.075} width={0.4} length={COURTYARD.length + 0.15} />
      <Hedge x={0} z={hl + 0.2} width={COURTYARD.width + 0.8} length={0.4} />

      <HouseFront />
      <DistantTerrace />

      <PlanterTree x={-4.5} z={-2} />
      <PlanterTree x={4.5} z={-2} />
      {[
        [-12, 4, 1.1],
        [-15, 14, 1.3],
        [13, 6, 1.2],
        [16, 16, 1],
        [-9, 22, 1.3],
        [10, 24, 1.1],
        ...Array.from({ length: 6 }, (_, i) => [-26, -6 + i * 7, 1.2 + (i % 3) * 0.15]),
        ...Array.from({ length: 6 }, (_, i) => [26, -4 + i * 7, 1.15 + (i % 2) * 0.2]),
      ].map(([x, z, s]) => (
        <Tree key={`${x}-${z}`} x={x} z={z} scale={s} />
      ))}
    </group>
  )
}
