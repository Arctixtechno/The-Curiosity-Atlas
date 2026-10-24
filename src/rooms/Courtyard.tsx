import { Sky } from '@react-three/drei'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, Object3D, type InstancedMesh } from 'three'
import { useSurfaceTexture, useTiledTexture } from '../hooks/useTiledTexture.ts'
import { Atmosphere } from './Atmosphere.tsx'
import { COURTYARD } from './dimensions.ts'
import { Portico, SashWindow, TerraceWall } from './Townhouse.tsx'

const SUN: [number, number, number] = [45, 40, 8]
const HOUSE_Z = -COURTYARD.length / 2
const TERRACE_WIDTH = 44

function Tree({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  const leaves = useTiledTexture('hedge', 1, 1)
  const mesh = useRef<InstancedMesh>(null)
  // A crown made of leafy clumps scattered through a few overlapping spheres.
  const clumps = useMemo(() => {
    let seed = Math.round(Math.abs(x * 97 + z * 31)) + 11
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
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
  }, [x, z])

  useLayoutEffect(() => {
    const dummy = new Object3D()
    clumps.forEach(([px, py, pz, s], i) => {
      dummy.position.set(px, py, pz)
      dummy.rotation.set(px * 3, py * 2, pz * 5)
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      mesh.current!.setMatrixAt(i, dummy.matrix)
    })
    mesh.current!.instanceMatrix.needsUpdate = true
  }, [clumps])

  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.2, 2.8, 10]} />
        <meshStandardMaterial color="#3e2c1e" roughness={1} />
      </mesh>
      <mesh position={[0, 3.1, 0]}>
        <sphereGeometry args={[1.1, 12, 10]} />
        <meshStandardMaterial color="#1a2c12" roughness={1} />
      </mesh>
      <instancedMesh ref={mesh} args={[undefined, undefined, clumps.length]} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#c4dca8" map={leaves} roughness={0.95} />
      </instancedMesh>
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

/**
 * A clipped hedge: a dense scatter of small leafy clumps over its sides and top,
 * each a slightly different green, so it reads as foliage rather than rows.
 */
function Hedge({ x, z, width, length }: { x: number; z: number; width: number; length: number }) {
  const leaves = useTiledTexture('hedge', 3, 3)
  const mesh = useRef<InstancedMesh>(null)
  const alongX = width > length
  const span = Math.max(width, length)
  const depth = Math.min(width, length)
  const h = COURTYARD.hedgeHeight
  const face = useSurfaceTexture('hedge', span, h, Math.round(x + z) + 20)
  const clumps = useMemo(() => {
    let seed = Math.round(span * 1000 + x * 7 + z * 13) || 1
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const list: { pos: [number, number, number]; scale: [number, number, number]; shade: number }[] = []
    // Clumps are flattened against the face they sit on: a clipped hedge has relief, not balls.
    const add = (along: number, y: number, across: number, s: number, flat: 'across' | 'up') => {
      const a = s * (1.4 + rand() * 0.6)
      const n = s * 0.45
      const sAcross = flat === 'across' ? n : s * 1.4
      const sUp = flat === 'up' ? n : s
      list.push({
        pos: alongX ? [along, y, across] : [across, y, along],
        scale: alongX ? [a, sUp, sAcross] : [sAcross, sUp, a],
        // Lighter towards the top, where the sun catches it.
        shade: 0.72 + rand() * 0.22 + (y / h) * 0.18,
      })
    }
    // Both long faces, scattered at random rather than in rows.
    for (const side of [-1, 1]) {
      for (let i = 0; i < span * 22; i++) {
        add((rand() - 0.5) * (span - 0.1), 0.08 + rand() * (h - 0.12), side * (depth / 2 + 0.01), 0.1 + rand() * 0.07, 'across')
      }
    }
    // The clipped top, slightly domed.
    for (let i = 0; i < span * depth * 40; i++) {
      const across = (rand() - 0.5) * depth
      add((rand() - 0.5) * (span - 0.1), h - 0.02 - Math.abs(across) * 0.08, across, 0.1 + rand() * 0.07, 'up')
    }
    return list
  }, [span, depth, alongX, x, z, h])

  useLayoutEffect(() => {
    const dummy = new Object3D()
    const color = new Color()
    clumps.forEach((c, i) => {
      dummy.position.set(...c.pos)
      dummy.scale.set(...c.scale)
      dummy.updateMatrix()
      mesh.current!.setMatrixAt(i, dummy.matrix)
      mesh.current!.setColorAt(i, color.setRGB(c.shade * 0.85, c.shade, c.shade * 0.8))
    })
    mesh.current!.instanceMatrix.needsUpdate = true
    if (mesh.current!.instanceColor) mesh.current!.instanceColor.needsUpdate = true
  }, [clumps])

  return (
    <group position={[x, 0, z]}>
      {/* The clipped body of the hedge; the clumps add relief on top of it. */}
      <mesh position={[0, h / 2 - 0.03, 0]}>
        <boxGeometry args={[width - 0.02, h - 0.06, length - 0.02]} />
        <meshStandardMaterial color="#c8dcb0" map={face} bumpMap={face} bumpScale={1.5} roughness={1} />
      </mesh>
      <instancedMesh ref={mesh} args={[undefined, undefined, clumps.length]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#d4e6bc" map={leaves} roughness={0.95} />
      </instancedMesh>
    </group>
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
