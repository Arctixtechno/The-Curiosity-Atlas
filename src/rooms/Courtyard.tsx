import { Sky } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, Float32BufferAttribute, Object3D, type InstancedMesh } from 'three'
import { BoxBallPot, Bench } from '../components/Furnishings.tsx'
import { useSurfaceTexture, useTiledTexture } from '../hooks/useTiledTexture.ts'
import { FountainInteraction } from '../features/discoveries/FountainInteraction.tsx'
import { QuestionCard } from '../features/discoveries/QuestionCard.tsx'
import { useDayPhase, type DayPhase } from '../world/clock.ts'
import { Atmosphere } from './Atmosphere.tsx'
import { Skyline } from './Skyline.tsx'
import { COURTYARD, COURTYARD_BENCHES, COURTYARD_FOUNTAIN, COURTYARD_PLANTERS, DOOR_POTS, QUESTION_STAND } from './dimensions.ts'
import { Fountain } from './Fountain.tsx'
import { NightSky } from './NightSky.tsx'
import { Portico, SashWindows, TerraceWall, type WindowProps } from './Townhouse.tsx'

const SUN: [number, number, number] = [28, 42, 34]
const MOON: [number, number, number] = [-30, 48, 58]
const HOUSE_Z = -COURTYARD.length / 2
/** The painted city round the garden square: terraces across the square, then the town, then the horizon. */
const COURTYARD_SKYLINE: [number, number, number] = [75, 115, 170]
const TERRACE_WIDTH = 44

type TreeSpot = [x: number, z: number, scale: number]

/** Leafy clumps scattered through a few overlapping spheres, for one tree at the origin. */
function crownClumps(x: number, z: number) {
  let seed = Math.round(Math.abs(x * 97 + z * 31)) + 11
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const lobes = [
    [0, 3.2, 0, 1.25],
    [0.75, 2.8, 0.3, 0.9],
    [-0.65, 2.9, -0.2, 0.95],
    [0.1, 3.9, -0.3, 0.9],
  ]
  const list: [number, number, number, number][] = []
  for (const [lx, ly, lz, lr] of lobes) {
    for (let i = 0; i < 14; i++) {
      const theta = rand() * Math.PI * 2
      const phi = Math.acos(rand() * 2 - 1)
      const r = lr * (0.6 + rand() * 0.35)
      list.push([
        lx + r * Math.sin(phi) * Math.cos(theta),
        ly + r * Math.cos(phi) * 0.85,
        lz + r * Math.sin(phi) * Math.sin(theta),
        0.35 + rand() * 0.25,
      ])
    }
  }
  return list
}

/**
 * Every tree in the garden, drawn as three instanced meshes (trunks, dark
 * inner crowns and leafy clumps) instead of three meshes per tree.
 */
function Trees({ trees }: { trees: TreeSpot[] }) {
  const leaves = useTiledTexture('hedge', 1, 1)
  const trunks = useRef<InstancedMesh>(null)
  const cores = useRef<InstancedMesh>(null)
  const clumps = useRef<InstancedMesh>(null)
  const clumpList = useMemo(
    () =>
      trees.flatMap(([x, z, s]) =>
        crownClumps(x, z).map(([px, py, pz, size]) => [x + px * s, py * s, z + pz * s, size * s, px, py, pz] as const),
      ),
    [trees],
  )

  useLayoutEffect(() => {
    const dummy = new Object3D()
    trees.forEach(([x, z, s], i) => {
      dummy.rotation.set(0, 0, 0)
      dummy.position.set(x, 1.4 * s, z)
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      trunks.current!.setMatrixAt(i, dummy.matrix)
      dummy.position.set(x, 3.1 * s, z)
      dummy.updateMatrix()
      cores.current!.setMatrixAt(i, dummy.matrix)
    })
    clumpList.forEach(([x, y, z, size, px, py, pz], i) => {
      dummy.position.set(x, y, z)
      dummy.rotation.set(px * 3, py * 2, pz * 5)
      dummy.scale.setScalar(size)
      dummy.updateMatrix()
      clumps.current!.setMatrixAt(i, dummy.matrix)
    })
    for (const mesh of [trunks, cores, clumps]) {
      mesh.current!.instanceMatrix.needsUpdate = true
      mesh.current!.computeBoundingSphere()
    }
  }, [trees, clumpList])

  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]} castShadow>
        <cylinderGeometry args={[0.12, 0.2, 2.8, 10]} />
        <meshStandardMaterial color="#3e2c1e" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={cores} args={[undefined, undefined, trees.length]}>
        <sphereGeometry args={[1.1, 12, 10]} />
        <meshStandardMaterial color="#1a2c12" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={clumps} args={[undefined, undefined, clumpList.length]} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#c4dca8" map={leaves} roughness={0.95} />
      </instancedMesh>
    </>
  )
}

/** A carved stone planter with a moulded rim and foot. */
function Planter({ x, z }: { x: number; z: number }) {
  const stone = useTiledTexture('marble', 1, 1)
  const material = <meshStandardMaterial color="#d8d0c2" map={stone} roughness={0.7} />
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.92, 0.12, 0.92]} />
        {material}
      </mesh>
      <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.46, 0.8]} />
        {material}
      </mesh>
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[0.94, 0.08, 0.94]} />
        {material}
      </mesh>
      <mesh position={[0, 0.645, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.78, 0.78]} />
        <meshStandardMaterial color="#3a2c20" roughness={1} />
      </mesh>
    </group>
  )
}

/** A ring of paler paving and a low stone kerb round the fountain. */
function FountainSurround() {
  const stone = useTiledTexture('marble', 2, 2)
  const r = 1.3 * COURTYARD_FOUNTAIN.scale
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
        <ringGeometry args={[r, r + 1.6, 64]} />
        <meshStandardMaterial color="#e2dacb" map={stone} roughness={0.75} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <ringGeometry args={[r + 1.6, r + 1.75, 64]} />
        <meshStandardMaterial color="#9a9284" roughness={0.9} />
      </mesh>
    </group>
  )
}

const TREES: TreeSpot[] = [
  ...COURTYARD_PLANTERS.map(([x, z]): TreeSpot => [x, z + 0, 0.7]),
  [-12, 4, 1.1],
  [-15, 14, 1.3],
  [13, 6, 1.2],
  [16, 16, 1],
  [-9, 22, 1.3],
  [10, 24, 1.1],
  ...Array.from({ length: 6 }, (_, i): TreeSpot => [-26, -6 + i * 7, 1.2 + (i % 3) * 0.15]),
  ...Array.from({ length: 6 }, (_, i): TreeSpot => [26, -4 + i * 7, 1.15 + (i % 2) * 0.2]),
]

/** Smooth value noise in 3D, for the hedges' uneven clipping. */
function lumpNoise(seed: number) {
  const hash = (x: number, y: number, z: number) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 17.3) * 43758.5453
    return n - Math.floor(n)
  }
  const fade = (t: number) => t * t * (3 - 2 * t)
  return (x: number, y: number, z: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const zi = Math.floor(z)
    const [u, v, w] = [fade(x - xi), fade(y - yi), fade(z - zi)]
    let sum = 0
    for (let dx = 0; dx < 2; dx++)
      for (let dy = 0; dy < 2; dy++)
        for (let dz = 0; dz < 2; dz++) {
          const weight = (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w)
          sum += weight * hash(xi + dx, yi + dy, zi + dz)
        }
    return sum
  }
}

/**
 * A clipped box hedge: one finely divided block with softly rounded edges,
 * pushed in and out a few centimetres so the clipping looks hand done,
 * covered in small leaves and darker towards its foot where less light reaches.
 */
function useHedgeGeometry(width: number, length: number, height: number, seed: number) {
  const geometry = useMemo(() => {
    const perMetre = 14
    const g = new BoxGeometry(
      width,
      height,
      length,
      Math.max(2, Math.round(width * perMetre)),
      Math.max(2, Math.round(height * perMetre)),
      Math.max(2, Math.round(length * perMetre)),
    )
    const noise = lumpNoise(seed)
    const pos = g.attributes.position
    const normal = g.attributes.normal
    const uv = g.attributes.uv
    const colours: number[] = []
    const round = 0.08
    const hw = width / 2
    const hl = length / 2
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i)
      let y = pos.getY(i) + height / 2
      let z = pos.getZ(i)
      // Round off the top edges, as shears leave them.
      const ex = Math.max(0, Math.abs(x) - (hw - round))
      const ez = Math.max(0, Math.abs(z) - (hl - round))
      const ey = Math.max(0, y - (height - round))
      const corner = Math.hypot(Math.max(ex, ez), ey)
      if (corner > 0 && ey > 0) {
        const pull = corner - round * 0.7
        if (pull > 0) {
          y -= (ey / corner) * pull
          if (ex > ez) x -= Math.sign(x) * (ex / corner) * pull
          else z -= Math.sign(z) * (ez / corner) * pull
        }
      }
      // Bumps of a few centimetres, larger soft swells plus small tufts.
      const bump = (noise(x * 2.2, y * 2.2, z * 2.2) - 0.5) * 0.06 + (noise(x * 9, y * 9, z * 9) - 0.5) * 0.025
      const nx = normal.getX(i)
      const ny = normal.getY(i)
      const nz = normal.getZ(i)
      // Leave the base where it meets the ground.
      const grounded = Math.min(1, y / 0.15)
      x += nx * bump * grounded
      y += ny * bump * grounded
      z += nz * bump * grounded
      pos.setXYZ(i, x, y - height / 2, z)
      // Texture in metres, along whichever face this is.
      if (Math.abs(ny) > 0.5) uv.setXY(i, x, z)
      else if (Math.abs(nx) > 0.5) uv.setXY(i, z, y)
      else uv.setXY(i, x, y)
      // Darker low down and in the hollows.
      const shade = (0.72 + 0.28 * Math.min(1, y / height) ** 0.7) * (0.88 + bump * 3)
      colours.push(shade * 0.95, shade, shade * 0.9)
    }
    g.setAttribute('color', new Float32BufferAttribute(colours, 3))
    g.computeVertexNormals()
    return g
  }, [width, length, height, seed])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

function Hedge({ x, z, width, length }: { x: number; z: number; width: number; length: number }) {
  const h = COURTYARD.hedgeHeight
  const geometry = useHedgeGeometry(width, length, h, Math.round(x * 3 + z * 7))
  const leaves = useTiledTexture('boxleaf', 1, 1)
  return (
    <mesh position={[x, h / 2, z]} geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors map={leaves} bumpMap={leaves} bumpScale={2} roughness={0.9} color="#dfe8d4" />
    </mesh>
  )
}

const HOUSE_WINDOWS: WindowProps[] = [
  ...[-12, -8, -4, 4, 8, 12].map((x) => ({ x, y: 1.9, width: 1.3, height: 2, lit: x === -4 || x === 8 })),
  ...[-12, -8, -4, 0, 4, 8, 12].map((x) => ({ x, y: 5.6, width: 1.3, height: 2.4, pediment: true, lit: x === 4 })),
  ...[-12, -8, -4, 0, 4, 8, 12].map((x) => ({ x, y: 8.7, width: 1.1, height: 1.7, lit: x === -8 })),
]

const TERRACE_WINDOWS: WindowProps[] = Array.from({ length: 21 }, (_, i) => (i - 10) * 5).flatMap((x) =>
  [2, 5.8, 9.4].map((y) => ({ x, y, width: 1.3, height: 2, lit: (x + y) % 4 === 0 })),
)

/** After dark, most of the house's windows are lit. */
const HOUSE_WINDOWS_NIGHT = HOUSE_WINDOWS.map((w, i) => ({ ...w, lit: i % 5 !== 2 }))
const TERRACE_WINDOWS_NIGHT = TERRACE_WINDOWS.map((w, i) => ({ ...w, lit: (i * 7) % 3 !== 0 }))

/** The front of the house: a white stucco terrace with a columned porch around the entrance. */
function HouseFront({ night }: { night: boolean }) {
  return (
    <group position={[0, 0, HOUSE_Z]}>
      <TerraceWall width={TERRACE_WIDTH} height={11} seed={3} pilasters={{ spacing: 4, offset: 2 }} balcony={{ gap: 2.1 }} />
      <SashWindows windows={night ? HOUSE_WINDOWS_NIGHT : HOUSE_WINDOWS} />
      <Portico />
    </group>
  )
}

/** Houses across the gardens, so the courtyard sits in a street rather than floating in the sky. */
function DistantTerrace({ night, height = 13 }: { night: boolean; height?: number }) {
  return (
    <group position={[0, 0, 34]} rotation={[0, Math.PI, 0]}>
      <TerraceWall width={110} height={height} seed={8} pilasters={{ spacing: 5, offset: 2.5 }} />
      <SashWindows windows={night ? TERRACE_WINDOWS_NIGHT : TERRACE_WINDOWS} />
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

/**
 * Nothing in the courtyard moves and the sun is fixed, so the shadow map is
 * drawn once rather than every frame. That pass re-renders every tree and
 * hedge from the sun's point of view, so skipping it roughly halves the work
 * per frame here.
 */
function StaticShadows({ phase }: { phase: DayPhase }) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    // Drawn again when the sun moves on to the next time of day.
    gl.shadowMap.needsUpdate = true
    return () => {
      gl.shadowMap.autoUpdate = true
    }
  }, [gl, phase])
  return null
}

/** Light and sky for each time of day: the sun's place, its colour and strength, and the light from the sky. */
export const LIGHT: Record<
  DayPhase,
  { sun: [number, number, number]; sunColour: string; sunStrength: number; sky: [string, string, number]; air: string }
> = {
  day: { sun: SUN, sunColour: '#fff1dc', sunStrength: 2.6, sky: ['#dbe7ff', '#6a7350', 1.8], air: '#c4d2e0' },
  dusk: { sun: [60, 5, 30], sunColour: '#ff9a5a', sunStrength: 1.4, sky: ['#ffc8a8', '#4a4048', 1.0], air: '#d8a890' },
  dawn: { sun: [-60, 6, -20], sunColour: '#ffc090', sunStrength: 1.3, sky: ['#d8d0f0', '#4a4a50', 1.0], air: '#d8c4c8' },
  night: { sun: MOON, sunColour: '#b8c8ff', sunStrength: 0.35, sky: ['#30406a', '#15161a', 0.5], air: '#05070f' },
}

/** A cast-iron street lamp with a glass lantern, lit at night. */
function LampPost({ x, z, lit }: { x: number; z: number; lit: boolean }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.3, 12]} />
        <meshStandardMaterial color="#1a1c1e" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 3, 10]} />
        <meshStandardMaterial color="#1a1c1e" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0, 3.3, 0]}>
        <cylinderGeometry args={[0.2, 0.12, 0.42, 6]} />
        <meshStandardMaterial
          color="#fff0d0"
          emissive="#ffc070"
          emissiveIntensity={lit ? 1.8 : 0}
          transparent
          opacity={0.85}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, 3.58, 0]}>
        <coneGeometry args={[0.24, 0.18, 6]} />
        <meshStandardMaterial color="#1a1c1e" metalness={0.6} roughness={0.5} />
      </mesh>
      {lit && <pointLight position={[0, 3.2, 0]} color="#ffc27a" intensity={6} distance={11} decay={1.6} />}
    </group>
  )
}

/** The courtyard: a walled garden in front of the house, with the Discovery Fountain in the middle and the café at the far end. */
export default function Courtyard() {
  const phase = useDayPhase()
  const light = LIGHT[phase]
  const night = phase === 'night'
  const [fx, fz] = COURTYARD_FOUNTAIN.at
  return (
    <group>
      <Atmosphere background={light.air} fog={night ? undefined : [45, 160]} />
      {night ? (
        <NightSky moon={MOON} />
      ) : (
        <Sky
          sunPosition={light.sun}
          turbidity={phase === 'day' ? 5 : 9}
          rayleigh={phase === 'day' ? 1.2 : 2.5}
          mieCoefficient={0.004}
          mieDirectionalG={0.85}
        />
      )}
      <hemisphereLight args={light.sky} />
      <directionalLight
        position={light.sun}
        intensity={light.sunStrength}
        color={light.sunColour}
        castShadow={!night}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-camera-far={120}
        shadow-bias={-0.0005}
      />

      <StaticShadows phase={phase} />
      <CourtyardScenery phase={phase} />
      <FountainInteraction x={fx} z={fz} radius={1.3 * COURTYARD_FOUNTAIN.scale + 1.6} />
      {/* Today's question on a stand on the house side of the fountain, facing you as you come out. */}
      <QuestionCard position={[QUESTION_STAND[0], 0, QUESTION_STAND[1]]} rotationY={Math.PI} />
      <Skyline radii={COURTYARD_SKYLINE} rotationY={Math.PI / 2} night={night} />
    </group>
  )
}

/**
 * Everything built in the courtyard, without its sky and light: the garden,
 * the house front, the fountain and the houses across the square. The roof
 * terrace draws it too, far below its balustrade, with lower houses opposite
 * so the city shows over their roofs.
 */
export function CourtyardScenery({ phase, distantHeight }: { phase: DayPhase; distantHeight?: number }) {
  const hw = COURTYARD.width / 2
  const hl = COURTYARD.length / 2
  const night = phase === 'night'
  const [fx, fz] = COURTYARD_FOUNTAIN.at
  return (
    <group>
      <Ground />
      {/* Side and far hedges. The near side is the house, so there's no hedge there to clash with it. */}
      <Hedge x={-hw - 0.2} z={-0.075} width={0.4} length={COURTYARD.length + 0.15} />
      <Hedge x={hw + 0.2} z={-0.075} width={0.4} length={COURTYARD.length + 0.15} />
      <Hedge x={0} z={hl + 0.2} width={COURTYARD.width + 0.8} length={0.4} />

      <HouseFront night={night} />
      {DOOR_POTS.map(([x, z]) => (
        <BoxBallPot key={x} position={[x, 0, z]} />
      ))}
      {COURTYARD_BENCHES.map(([x, z]) => (
        <Bench key={x} position={[x, 0, z]} rotationY={Math.PI / 2} length={1.6} />
      ))}
      <DistantTerrace night={night} height={distantHeight} />

      <group position={[fx, 0, fz]}>
        <FountainSurround />
        <group scale={COURTYARD_FOUNTAIN.scale}>
          <Fountain night={night} />
        </group>
      </group>
      {[-1, 1].map((side) => (
        <LampPost key={side} x={side * 4.6} z={fz + 4.6} lit={night || phase === 'dusk'} />
      ))}

      {COURTYARD_PLANTERS.map(([x, z]) => (
        <Planter key={`${x},${z}`} x={x} z={z} />
      ))}
      <Trees trees={TREES} />
    </group>
  )
}
