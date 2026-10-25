import { useLayoutEffect, useRef } from 'react'
import { DoubleSide, type InstancedMesh, Object3D } from 'three'
import { Bench } from '../components/Furnishings.tsx'
import { useLathe } from '../hooks/useLathe.ts'
import { useSurfaceTexture, useTiledTexture } from '../hooks/useTiledTexture.ts'
import { Atmosphere } from './Atmosphere.tsx'
import { TERRACE } from './dimensions.ts'
import { NightSky } from './NightSky.tsx'
import { Skyline } from './Skyline.tsx'

// The roof terrace beside the observatory: stone flags behind a marble
// balustrade, with the dome rising behind and London spread out at night,
// lit windows and all, out to the landmarks on the horizon.

const W = TERRACE.width
const D = TERRACE.depth
/** The moon, out over the city in front of the terrace. */
const MOON: [number, number, number] = [-24, 30, 70]
const SKYLINE: [number, number, number] = [40, 60, 80]

const RAIL_HEIGHT = 0.95
const BALUSTER_SPACING = 0.26
/** A turned baluster: a vase shape between a square foot and head. */
const BALUSTER: [number, number][] = [
  [0.001, 0],
  [0.06, 0],
  [0.06, 0.06],
  [0.045, 0.09],
  [0.05, 0.14],
  [0.075, 0.3],
  [0.07, 0.42],
  [0.04, 0.55],
  [0.032, 0.62],
  [0.045, 0.66],
  [0.06, 0.7],
  [0.06, 0.74],
  [0.001, 0.74],
]

/** Runs of balustrade, as [x, z] of each end, between the corner posts. */
const RUNS: [[number, number], [number, number]][] = [
  [
    [-W / 2 + TERRACE.balustradeInset, D / 2 - TERRACE.balustradeInset],
    [W / 2 - TERRACE.balustradeInset, D / 2 - TERRACE.balustradeInset],
  ],
  [
    [-W / 2 + TERRACE.balustradeInset, -D / 2 + 0.3],
    [-W / 2 + TERRACE.balustradeInset, D / 2 - TERRACE.balustradeInset],
  ],
  [
    [W / 2 - TERRACE.balustradeInset, -D / 2 + 0.3],
    [W / 2 - TERRACE.balustradeInset, D / 2 - TERRACE.balustradeInset],
  ],
]

function Balustrade() {
  const marble = useTiledTexture('marble', 4, 0.3)
  const baluster = useLathe(BALUSTER, 12)
  const instances = useRef<InstancedMesh>(null)
  const spots = RUNS.flatMap(([[x1, z1], [x2, z2]]) => {
    const length = Math.hypot(x2 - x1, z2 - z1)
    const n = Math.floor(length / BALUSTER_SPACING)
    return Array.from({ length: n - 1 }, (_, i) => {
      const t = (i + 1) / n
      return [x1 + (x2 - x1) * t, z1 + (z2 - z1) * t] as [number, number]
    })
  })
  useLayoutEffect(() => {
    const mesh = instances.current
    if (!mesh) return
    const dummy = new Object3D()
    spots.forEach(([x, z], i) => {
      dummy.position.set(x, 0.14, z)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [spots])
  const stone = <meshStandardMaterial color="#e6dfd2" map={marble} roughness={0.5} />
  const posts = [
    [-W / 2 + TERRACE.balustradeInset, D / 2 - TERRACE.balustradeInset],
    [W / 2 - TERRACE.balustradeInset, D / 2 - TERRACE.balustradeInset],
    [0, D / 2 - TERRACE.balustradeInset],
    [-W / 2 + TERRACE.balustradeInset, -0.2],
    [W / 2 - TERRACE.balustradeInset, -0.2],
  ]
  return (
    <group>
      <instancedMesh ref={instances} args={[baluster, undefined, spots.length]} castShadow>
        {stone}
      </instancedMesh>
      {RUNS.map(([[x1, z1], [x2, z2]], i) => {
        const along = Math.abs(x2 - x1) > Math.abs(z2 - z1)
        const length = Math.hypot(x2 - x1, z2 - z1)
        const size = (h: number, w: number): [number, number, number] => (along ? [length, h, w] : [w, h, length])
        return (
          <group key={i} position={[(x1 + x2) / 2, 0, (z1 + z2) / 2]}>
            <mesh position={[0, 0.07, 0]} receiveShadow>
              <boxGeometry args={size(0.14, 0.32)} />
              {stone}
            </mesh>
            <mesh position={[0, RAIL_HEIGHT - 0.035, 0]} castShadow receiveShadow>
              <boxGeometry args={size(0.07, 0.3)} />
              {stone}
            </mesh>
            <mesh position={[0, RAIL_HEIGHT + 0.02, 0]} castShadow>
              <boxGeometry args={size(0.05, 0.34)} />
              {stone}
            </mesh>
          </group>
        )
      })}
      {posts.map(([x, z]) => (
        <group key={`${x},${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.52, 0]} castShadow>
            <boxGeometry args={[0.38, 1.04, 0.38]} />
            {stone}
          </mesh>
          <mesh position={[0, 1.06, 0]}>
            <boxGeometry args={[0.44, 0.06, 0.44]} />
            {stone}
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** A lantern on a post, the terrace's warm light. */
function Lantern({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 1.09, z]}>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.2, 0.04, 0.2]} />
        <meshStandardMaterial color="#1c1a18" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.16, 0.3, 0.16]} />
        <meshStandardMaterial color="#ffe0a8" emissive="#ffb860" emissiveIntensity={1.6} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <coneGeometry args={[0.15, 0.12, 4]} />
        <meshStandardMaterial color="#1c1a18" metalness={0.6} roughness={0.5} />
      </mesh>
      <pointLight position={[0, 0.2, 0]} color="#ffb870" intensity={4} distance={6} decay={1.8} />
    </group>
  )
}

/** A clipped bay tree in a terracotta pot. */
function Bay({ x, z }: { x: number; z: number }) {
  const pot = useLathe(
    [
      [0.001, 0],
      [0.2, 0],
      [0.26, 0.42],
      [0.3, 0.46],
      [0.3, 0.5],
      [0.26, 0.5],
      [0.25, 0.46],
      [0.001, 0.46],
    ],
    20,
  )
  const leaves = useTiledTexture('boxleaf', 1.5, 1.5)
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={pot} castShadow>
        <meshStandardMaterial color="#a8603e" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.025, 0.035, 0.8, 8]} />
        <meshStandardMaterial color="#5a4030" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.45, 0]} castShadow>
        <sphereGeometry args={[0.45, 24, 16]} />
        <meshStandardMaterial color="#7aa060" map={leaves} bumpMap={leaves} bumpScale={2} roughness={0.85} />
      </mesh>
    </group>
  )
}

/** A brass telescope on a wooden tripod, pointed out over the city. */
function SpyGlass() {
  const [x, z] = TERRACE.telescope
  const brass = { color: '#c49a4a', metalness: 0.85, roughness: 0.3 }
  return (
    <group position={[x, 0, z]} rotation={[0, 0.5, 0]}>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2
        return (
          <mesh
            key={i}
            position={[Math.sin(a) * 0.22, 0.6, Math.cos(a) * 0.22]}
            rotation={[Math.cos(a) * -0.33, 0, Math.sin(a) * 0.33]}
          >
            <cylinderGeometry args={[0.018, 0.022, 1.25, 8]} />
            <meshStandardMaterial color="#6a4a30" roughness={0.6} />
          </mesh>
        )
      })}
      <group position={[0, 1.25, 0]} rotation={[0.18, 0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.15]}>
          <cylinderGeometry args={[0.05, 0.035, 0.9, 20]} />
          <meshStandardMaterial {...brass} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.6]}>
          <cylinderGeometry args={[0.058, 0.058, 0.06, 20]} />
          <meshStandardMaterial {...brass} />
        </mesh>
      </group>
    </group>
  )
}

/** The wall of the observatory's drum, with its copper dome rising behind and a cornice along the top. */
function DomeWall() {
  const render = useSurfaceTexture('plaster', W, 3.4, 9)
  return (
    <group position={[0, 0, -D / 2]}>
      <mesh position={[0, 1.7, 0]} receiveShadow>
        <planeGeometry args={[W, 3.4]} />
        <meshStandardMaterial color="#d8d0c0" map={render} roughness={0.9} />
      </mesh>
      <mesh position={[0, 3.45, 0.08]}>
        <boxGeometry args={[W, 0.14, 0.2]} />
        <meshStandardMaterial color="#ece4d4" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.1, 0.02]}>
        <boxGeometry args={[W, 0.2, 0.05]} />
        <meshStandardMaterial color="#a89c88" roughness={0.9} />
      </mesh>
      {/* The verdigris dome, its ribs catching the moonlight. */}
      <mesh position={[0, 3.5, -5.4]}>
        <sphereGeometry args={[6.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#6f9a8a" metalness={0.4} roughness={0.55} flatShading side={DoubleSide} />
      </mesh>
      {/* A lit window either side of the door. */}
      {[-2.4, 2.4].map((x) => (
        <group key={x} position={[x, 1.6, 0.01]}>
          <mesh>
            <planeGeometry args={[0.9, 1.5]} />
            <meshStandardMaterial color="#ffd9a0" emissive="#ffb868" emissiveIntensity={0.7} />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[0.04, 1.5]} />
            <meshStandardMaterial color="#e8e0d0" />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[0.9, 0.04]} />
            <meshStandardMaterial color="#e8e0d0" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Floor() {
  const flags = useSurfaceTexture('stone', W, D, 12)
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[W, D]} />
      <meshStandardMaterial color="#b8b0a4" map={flags} bumpMap={flags} bumpScale={0.6} roughness={0.85} />
    </mesh>
  )
}

/** The roof terrace, reached from the observatory. */
export default function RoofTerrace() {
  return (
    <group>
      <Atmosphere background="#04050d" />
      <hemisphereLight args={['#6a7aa8', '#3a2c20', 1.1]} />
      <directionalLight position={MOON} intensity={0.45} color="#b8c8ff" />
      <NightSky moon={MOON} />
      <Skyline radii={SKYLINE} ground={[-TERRACE.roofHeight, -14, -4]} night rotationY={Math.PI} />

      <Floor />
      <DomeWall />
      <Balustrade />
      <Lantern x={-W / 2 + TERRACE.balustradeInset} z={D / 2 - TERRACE.balustradeInset} />
      <Lantern x={W / 2 - TERRACE.balustradeInset} z={D / 2 - TERRACE.balustradeInset} />
      {TERRACE.bays.map(([x, z]) => (
        <Bay key={`${x},${z}`} x={x} z={z} />
      ))}
      <Bench position={[TERRACE.bench[0], 0, TERRACE.bench[1]]} length={1.6} />
      <SpyGlass />
    </group>
  )
}
