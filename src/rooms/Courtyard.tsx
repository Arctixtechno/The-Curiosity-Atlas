import { Sky } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, Float32BufferAttribute, Object3D, type InstancedMesh } from 'three'
import { BoxBallPot, Bench } from '../components/Furnishings.tsx'
import { useSurfaceTexture, useTiledTexture } from '../hooks/useTiledTexture.ts'
import { Atmosphere } from './Atmosphere.tsx'
import { Skyline } from './Skyline.tsx'
import { COURTYARD, COURTYARD_BENCH, DOOR_POTS } from './dimensions.ts'
import { Portico, SashWindows, TerraceWall, type WindowProps } from './Townhouse.tsx'

const SUN: [number, number, number] = [45, 40, 8]
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

/** Stone planters for the two trees inside the courtyard. */
const PLANTERS: [number, number][] = [
  [-4.5, -2],
  [4.5, -2],
]

const TREES: TreeSpot[] = [
  ...PLANTERS.map(([x, z]): TreeSpot => [x, z, 0.75]),
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
  ...[-12, -8, -4, 0, 4, 8, 12].map((x) => ({ x, y: 5.6, width: 1.3, height: 2.4, balconette: true, lit: x === 4 })),
  ...[-12, -8, -4, 0, 4, 8, 12].map((x) => ({ x, y: 8.7, width: 1.1, height: 1.7, lit: x === -8 })),
]

const TERRACE_WINDOWS: WindowProps[] = Array.from({ length: 21 }, (_, i) => (i - 10) * 5).flatMap((x) =>
  [2, 5.8, 9.4].map((y) => ({ x, y, width: 1.3, height: 2, lit: (x + y) % 4 === 0 })),
)

/** The front of the house: a white stucco terrace with a columned porch around the entrance. */
function HouseFront() {
  return (
    <group position={[0, 0, HOUSE_Z]}>
      <TerraceWall width={TERRACE_WIDTH} height={11} seed={3} />
      <SashWindows windows={HOUSE_WINDOWS} />
      <Portico />
    </group>
  )
}

/** Houses across the gardens, so the courtyard sits in a street rather than floating in the sky. */
function DistantTerrace() {
  return (
    <group position={[0, 0, 34]} rotation={[0, Math.PI, 0]}>
      <TerraceWall width={110} height={13} seed={8} />
      <SashWindows windows={TERRACE_WINDOWS} />
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
function StaticShadows() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    return () => {
      gl.shadowMap.autoUpdate = true
    }
  }, [gl])
  return null
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

      <StaticShadows />
      <Ground />
      {/* Side and far hedges. The near side is the house, so there's no hedge there to clash with it. */}
      <Hedge x={-hw - 0.2} z={-0.075} width={0.4} length={COURTYARD.length + 0.15} />
      <Hedge x={hw + 0.2} z={-0.075} width={0.4} length={COURTYARD.length + 0.15} />
      <Hedge x={0} z={hl + 0.2} width={COURTYARD.width + 0.8} length={0.4} />

      <HouseFront />
      {DOOR_POTS.map(([x, z]) => (
        <BoxBallPot key={x} position={[x, 0, z]} />
      ))}
      <Bench position={[COURTYARD_BENCH[0], 0, COURTYARD_BENCH[1]]} rotationY={Math.PI / 2} length={1.6} />
      <DistantTerrace />
      <Skyline radii={COURTYARD_SKYLINE} rotationY={Math.PI / 2} />

      {PLANTERS.map(([x, z]) => (
        <mesh key={x} position={[x, 0.3, z]} castShadow receiveShadow>
          <boxGeometry args={[0.8, 0.6, 0.8]} />
          <meshStandardMaterial color="#9a9284" roughness={0.9} />
        </mesh>
      ))}
      <Trees trees={TREES} />
    </group>
  )
}
