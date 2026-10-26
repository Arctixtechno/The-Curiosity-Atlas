import { RoundedBox } from '@react-three/drei'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Object3D, type InstancedMesh } from 'three'
import { useLathe } from '../hooks/useLathe.ts'
import { useSurfaceTexture, useTiledTexture } from '../hooks/useTiledTexture.ts'
import { PORTICO } from './dimensions.ts'

// Pieces of a white stucco London townhouse terrace, in the style of
// Kensington: rusticated ground floor, tall sash windows, a cornice and a
// columned portico around the front door. All groups face +z.

const STUCCO = '#fffaf1'
const TRIM = '#fbf8f2'

export interface WindowProps {
  x: number
  y: number
  width: number
  height: number
  /** Warm light behind some windows so the house feels lived in. */
  lit?: boolean
  balconette?: boolean
  /** A triangular pediment over the window instead of a flat hood, as on the first floor of a Kensington terrace. */
  pediment?: boolean
}

/** One box in a window's trim or ironwork: centre and size, in the facade's space, and an optional tilt about z. */
type Piece = [x: number, y: number, z: number, w: number, h: number, d: number, tilt?: number]

/** Breaks each window into simple boxes, sorted by material. */
function windowPieces(windows: WindowProps[]) {
  const trim: Piece[] = []
  const iron: Piece[] = []
  const glass: { lit: Piece[]; dark: Piece[] } = { lit: [], dark: [] }
  for (const { x, y, width, height, lit, balconette, pediment } of windows) {
    trim.push([x, y, 0.04, width + 0.3, height + 0.3, 0.08])
    ;(lit ? glass.lit : glass.dark).push([x, y, 0.085, width, height, 1])
    // Glazing bars: two sashes of three by two panes.
    for (const bx of [-width / 6, width / 6]) trim.push([x + bx, y, 0.095, 0.03, height, 0.02])
    for (const by of [-height / 4, 0, height / 4]) trim.push([x, y + by, 0.095, width, by === 0 ? 0.06 : 0.03, 0.02])
    // Cornice hood above the window, and on the grandest floor a pediment over it, on two little brackets.
    trim.push([x, y + height / 2 + 0.24, 0.1, width + 0.5, 0.12, 0.2])
    if (pediment) {
      const half = width / 2 + 0.3
      const rise = 0.36
      const slope = Math.atan2(rise, half)
      const run = Math.hypot(half, rise)
      for (const side of [-1, 1]) {
        trim.push([x + (side * half) / 2, y + height / 2 + 0.3 + rise / 2, 0.1, run, 0.1, 0.22, -side * slope])
        trim.push([x + side * (width / 2 + 0.2), y + height / 2 + 0.05, 0.08, 0.1, 0.3, 0.16])
      }
    }
    if (balconette) {
      const by = y - height / 2 + 0.25
      iron.push([x, by + 0.5, 0.3, width + 0.4, 0.04, 0.04])
      for (let i = 0; i <= 10; i++) iron.push([x + (i / 10 - 0.5) * (width + 0.4), by + 0.25, 0.3, 0.02, 0.5, 0.02])
      trim.push([x, by - 0.04, 0.18, width + 0.5, 0.08, 0.4])
    }
  }
  return { trim, iron, glass }
}

/** Draws a list of boxes (or planes) as a single instanced mesh. */
function Pieces({ pieces, plane, children }: { pieces: Piece[]; plane?: boolean; children: React.ReactNode }) {
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!mesh.current) return
    const dummy = new Object3D()
    pieces.forEach(([x, y, z, w, h, d, tilt = 0], i) => {
      dummy.position.set(x, y, z)
      dummy.rotation.set(0, 0, tilt)
      dummy.scale.set(w, h, d)
      dummy.updateMatrix()
      mesh.current!.setMatrixAt(i, dummy.matrix)
    })
    mesh.current!.instanceMatrix.needsUpdate = true
    mesh.current!.computeBoundingSphere()
  }, [pieces])
  if (!pieces.length) return null
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, pieces.length]}>
      {plane ? <planeGeometry /> : <boxGeometry />}
      {children}
    </instancedMesh>
  )
}

/**
 * Sash windows with white surrounds, glazing bars and optional iron
 * balconettes. A whole facade's windows are drawn in four instanced meshes
 * rather than a dozen meshes per window.
 */
export function SashWindows({ windows }: { windows: WindowProps[] }) {
  const { trim, iron, glass } = useMemo(() => windowPieces(windows), [windows])
  return (
    <>
      <Pieces pieces={trim}>
        <meshStandardMaterial color={TRIM} roughness={0.7} />
      </Pieces>
      <Pieces pieces={iron}>
        <meshStandardMaterial color="#111111" metalness={0.6} roughness={0.4} />
      </Pieces>
      <Pieces pieces={glass.dark} plane>
        <meshStandardMaterial color="#1c242c" roughness={0.08} metalness={0.5} />
      </Pieces>
      <Pieces pieces={glass.lit} plane>
        <meshStandardMaterial color="#3a2e22" emissive="#ffb45a" emissiveIntensity={0.35} roughness={0.08} metalness={0.5} />
      </Pieces>
    </>
  )
}

/** A turned stone baluster: a vase shape between a square foot and head, 0.74 m tall. */
export const BALUSTER: [number, number][] = [
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

/**
 * Straight runs of stone balustrade along x, each [from, to] at height y and
 * depth z: a plinth, turned balusters every 26 cm and a moulded rail. Every
 * run's balusters are one instanced mesh.
 */
export function Balustrade({
  runs,
  y = 0,
  z = 0,
  color = TRIM,
}: {
  runs: [number, number][]
  y?: number
  z?: number
  color?: string
}) {
  const baluster = useLathe(BALUSTER, 8)
  const marble = useTiledTexture('marble', 4, 0.3)
  const spots = useMemo(
    () =>
      runs.flatMap(([from, to]) => {
        const n = Math.max(2, Math.floor(Math.abs(to - from) / 0.26))
        return Array.from({ length: n - 1 }, (_, i) => from + ((to - from) * (i + 1)) / n)
      }),
    [runs],
  )
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!mesh.current) return
    const dummy = new Object3D()
    spots.forEach((x, i) => {
      dummy.position.set(x, 0.12, 0)
      dummy.updateMatrix()
      mesh.current!.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
    mesh.current.computeBoundingSphere()
  }, [spots])
  const stone = <meshStandardMaterial color={color} map={marble} roughness={0.55} />
  return (
    <group position={[0, y, z]}>
      <instancedMesh ref={mesh} args={[baluster, undefined, spots.length]} castShadow>
        {stone}
      </instancedMesh>
      {runs.map(([from, to]) => (
        <group key={from} position={[(from + to) / 2, 0, 0]}>
          <mesh position={[0, 0.06, 0]} receiveShadow>
            <boxGeometry args={[Math.abs(to - from), 0.12, 0.3]} />
            {stone}
          </mesh>
          <mesh position={[0, 0.9, 0]} castShadow>
            <boxGeometry args={[Math.abs(to - from), 0.08, 0.28]} />
            {stone}
          </mesh>
          <mesh position={[0, 0.96, 0]}>
            <boxGeometry args={[Math.abs(to - from) + 0.04, 0.04, 0.32]} />
            {stone}
          </mesh>
          {[from, to].map((x) => (
            <mesh key={x} position={[x - (from + to) / 2, 0.5, 0]} castShadow>
              <boxGeometry args={[0.3, 1, 0.32]} />
              {stone}
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** Small square blocks in a row under a cornice, as one instanced mesh. */
function Dentils({ width, y, z }: { width: number; y: number; z: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: Math.floor(width / 0.22) }, (_, i): Piece => [-width / 2 + 0.11 + i * 0.22, y, z, 0.11, 0.13, 0.12]),
    [width, y, z],
  )
  return (
    <Pieces pieces={pieces}>
      <meshStandardMaterial color={TRIM} roughness={0.7} />
    </Pieces>
  )
}

interface TerraceWallProps {
  width: number
  height: number
  seed?: number
  /** Flat pilasters up the upper floors, every `spacing` metres from `offset`. */
  pilasters?: { spacing: number; offset: number }
  /** A continuous stone balcony along the first floor, broken at x in (-gap, gap) for a porch. */
  balcony?: { gap: number }
}

/**
 * The stucco front of a Kensington terrace: a rusticated ground floor, a
 * string course, pilasters up the upper floors, a cornice on dentils and a
 * balustraded parapet along the roofline.
 */
export function TerraceWall({ width, height, seed = 1, pilasters, balcony }: TerraceWallProps) {
  const stucco = useSurfaceTexture('stucco', width, height, seed, 96)
  const groundFloor = 3.6
  const pilasterXs = useMemo(() => {
    if (!pilasters) return []
    const xs: number[] = []
    for (let x = pilasters.offset; x < width / 2 - 0.4; x += pilasters.spacing) xs.push(x)
    for (let x = pilasters.offset - pilasters.spacing; x > -width / 2 + 0.4; x -= pilasters.spacing) xs.push(x)
    return xs
  }, [pilasters, width])
  const pilasterPieces = useMemo(() => {
    const top = height - 0.75
    const bottom = groundFloor + 0.2
    return pilasterXs.flatMap((x): Piece[] => [
      [x, (top + bottom) / 2, 0.05, 0.42, top - bottom, 0.1],
      [x, bottom + 0.1, 0.07, 0.52, 0.2, 0.14],
      [x, top - 0.12, 0.08, 0.54, 0.24, 0.16],
    ])
  }, [pilasterXs, height])
  const half = width / 2
  return (
    <group>
      <mesh position={[0, height / 2, -0.2]} receiveShadow castShadow>
        <boxGeometry args={[width, height, 0.4]} />
        <meshStandardMaterial color={STUCCO} map={stucco} bumpMap={stucco} bumpScale={0.3} roughness={0.85} />
      </mesh>
      {/* Rusticated ground floor: horizontal channels. */}
      {Array.from({ length: Math.floor(groundFloor / 0.45) }, (_, i) => (
        <mesh key={i} position={[0, 0.45 * (i + 1), 0.004]}>
          <planeGeometry args={[width, 0.035]} />
          <meshStandardMaterial color="#b9b2a4" roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, groundFloor + 0.1, 0.06]} castShadow>
        <boxGeometry args={[width, 0.2, 0.14]} />
        <meshStandardMaterial color={TRIM} roughness={0.7} />
      </mesh>
      <Pieces pieces={pilasterPieces}>
        <meshStandardMaterial color={TRIM} roughness={0.75} />
      </Pieces>
      {/* Frieze, dentils and the main cornice. */}
      <mesh position={[0, height - 0.62, 0.03]}>
        <boxGeometry args={[width, 0.26, 0.06]} />
        <meshStandardMaterial color={TRIM} roughness={0.75} />
      </mesh>
      <Dentils width={width} y={height - 0.43} z={0.1} />
      <mesh position={[0, height - 0.3, 0.17]} castShadow>
        <boxGeometry args={[width, 0.14, 0.36]} />
        <meshStandardMaterial color={TRIM} roughness={0.7} />
      </mesh>
      <mesh position={[0, height - 0.17, 0.2]} castShadow>
        <boxGeometry args={[width, 0.12, 0.42]} />
        <meshStandardMaterial color={TRIM} roughness={0.7} />
      </mesh>
      <mesh position={[0, height - 0.06, 0.02]}>
        <boxGeometry args={[width, 0.12, 0.3]} />
        <meshStandardMaterial color={STUCCO} roughness={0.8} />
      </mesh>
      <Balustrade runs={[[-half + 0.15, half - 0.15]]} y={height} z={0.05} />
      {balcony && (
        <group position={[0, groundFloor + 0.2, 0]}>
          {[
            [-half, -balcony.gap],
            [balcony.gap, half],
          ].map(([from, to]) => (
            <mesh key={from} position={[(from + to) / 2, 0, 0.35]} castShadow receiveShadow>
              <boxGeometry args={[to - from, 0.16, 0.7]} />
              <meshStandardMaterial color={TRIM} roughness={0.7} />
            </mesh>
          ))}
          <Balustrade
            runs={[
              [-half + 0.2, -balcony.gap - 0.1],
              [balcony.gap + 0.1, half - 0.2],
            ]}
            y={0.08}
            z={0.55}
          />
        </group>
      )}
    </group>
  )
}

function Column({ x, z, height }: { x: number; z: number; height: number }) {
  const marble = useTiledTexture('marble', 1, 3)
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.52, 0.24, 0.52]} />
        <meshStandardMaterial color="#f2efe9" map={marble} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.26, 0.12, 24]} />
        <meshStandardMaterial color="#f2efe9" map={marble} roughness={0.35} />
      </mesh>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.2, height - 0.6, 24]} />
        <meshPhysicalMaterial color="#f4f1ec" map={marble} roughness={0.25} clearcoat={0.4} />
      </mesh>
      <mesh position={[0, height - 0.24, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.17, 0.2, 24]} />
        <meshStandardMaterial color="#f2efe9" map={marble} roughness={0.35} />
      </mesh>
      <mesh position={[0, height - 0.08, 0]} castShadow>
        <boxGeometry args={[0.52, 0.16, 0.52]} />
        <meshStandardMaterial color="#f2efe9" map={marble} roughness={0.35} />
      </mesh>
    </group>
  )
}

/** Columned porch around the front door, with a balustrade on top and a marble step. */
export function Portico() {
  const marble = useTiledTexture('marble', 3, 1.5)
  const { columnX, columnZ, height } = PORTICO
  const depth = columnZ + 0.4
  return (
    <group>
      <mesh position={[0, 0.03, depth / 2]} receiveShadow>
        <boxGeometry args={[columnX * 2 + 0.9, 0.06, depth + 0.3]} />
        <meshStandardMaterial color="#e8e4dc" map={marble} roughness={0.3} />
      </mesh>
      {[-columnX, columnX].map((x) => (
        <Column key={x} x={x} z={columnZ} height={height} />
      ))}
      {/* Entablature and cornice. */}
      <RoundedBox args={[columnX * 2 + 0.8, 0.5, depth]} radius={0.02} position={[0, height + 0.25, depth / 2]} castShadow>
        <meshStandardMaterial color={TRIM} roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, height + 0.57, depth / 2 + 0.05]} castShadow>
        <boxGeometry args={[columnX * 2 + 1.1, 0.14, depth + 0.2]} />
        <meshStandardMaterial color={TRIM} roughness={0.6} />
      </mesh>
      {/* Balustrade. */}
      <group position={[0, height + 0.64, columnZ + 0.25]}>
        <mesh position={[0, 0.62, 0]}>
          <boxGeometry args={[columnX * 2 + 0.9, 0.1, 0.22]} />
          <meshStandardMaterial color={TRIM} />
        </mesh>
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} position={[(i / 8 - 0.5) * (columnX * 2 + 0.5), 0.3, 0]}>
            <cylinderGeometry args={[0.06, 0.09, 0.56, 10]} />
            <meshStandardMaterial color={TRIM} />
          </mesh>
        ))}
      </group>
      {/* Fanlight above the door. */}
      <group position={[0, 2.42, 0.02]}>
        <mesh position={[0, 0, 0.005]}>
          <circleGeometry args={[0.7, 32, 0, Math.PI]} />
          <meshStandardMaterial color={TRIM} />
        </mesh>
        <mesh position={[0, 0, 0.012]}>
          <circleGeometry args={[0.6, 32, 0, Math.PI]} />
          <meshStandardMaterial color="#2a2418" emissive="#ffb45a" emissiveIntensity={0.25} roughness={0.1} />
        </mesh>
        {[0.25, 0.5, 0.75].map((t) => (
          <mesh
            key={t}
            position={[Math.cos(t * Math.PI) * 0.3, Math.sin(t * Math.PI) * 0.3, 0.02]}
            rotation={[0, 0, t * Math.PI]}
          >
            <boxGeometry args={[0.6, 0.02, 0.01]} />
            <meshStandardMaterial color={TRIM} />
          </mesh>
        ))}
      </group>
      {/* A pair of carriage lanterns either side of the door. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.02, 2.05, 0.16]}>
          <mesh position={[0, -0.05, -0.1]}>
            <boxGeometry args={[0.05, 0.05, 0.2]} />
            <meshStandardMaterial color="#111111" metalness={0.5} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.18, 0.26, 0.18]} />
            <meshStandardMaterial color="#ffe2b0" emissive="#ffc070" emissiveIntensity={1.4} transparent opacity={0.9} />
          </mesh>
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx}${sz}`} position={[sx * 0.09, 0, sz * 0.09]}>
                <boxGeometry args={[0.018, 0.28, 0.018]} />
                <meshStandardMaterial color="#111111" metalness={0.5} />
              </mesh>
            )),
          )}
          <mesh position={[0, 0.17, 0]}>
            <coneGeometry args={[0.15, 0.1, 4]} />
            <meshStandardMaterial color="#111111" metalness={0.5} />
          </mesh>
          <pointLight color="#ffcf8a" intensity={1.4} distance={4} />
        </group>
      ))}
    </group>
  )
}
