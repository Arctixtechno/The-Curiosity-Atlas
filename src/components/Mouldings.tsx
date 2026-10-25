import { useEffect, useMemo } from 'react'
import { CanvasTexture, ExtrudeGeometry, Shape } from 'three'
import { useSurfaceTexture } from '../hooks/useTiledTexture.ts'
import type { TextureName } from './textures.ts'

// The joinery that makes a room's corners read as real: a moulded cornice
// where the walls meet the ceiling, a skirting board, an optional dado rail
// with panelling below it, and soft shading along every corner, the way
// light falls off where two surfaces meet.

export type WallSide = 'north' | 'south' | 'east' | 'west'

/** A gap in the mouldings for a doorway: which wall, the centre along it (x or z) and its width, in metres. */
export interface Opening {
  side: WallSide
  centre: number
  width: number
}

interface MouldingsProps {
  width: number
  length: number
  height: number
  /** Paint or wood colour of the skirting and dado rail. */
  trim: string
  /** Colour of the cornice; ceilings are usually painted the same. */
  cornice?: string
  /** Height of the dado rail, with panelling (`texture`, tinted `colour`) below it. */
  dado?: { height: number; colour: string; texture?: TextureName }
  openings?: Opening[]
}

/** Profiles as [out from the wall, up] in metres. */
const CORNICE: [number, number][] = [
  [0, -0.24],
  [0.018, -0.24],
  [0.018, -0.215],
  [0.03, -0.205],
  // The cove, curving up and out to the ceiling.
  ...Array.from({ length: 9 }, (_, i): [number, number] => {
    const a = (i / 8) * (Math.PI / 2)
    return [0.03 + 0.14 * (1 - Math.cos(a)), -0.205 + 0.15 * Math.sin(a)]
  }),
  [0.17, -0.045],
  [0.2, -0.045],
  [0.2, -0.02],
  [0.22, -0.02],
  [0.22, 0],
  [0, 0],
]
const SKIRTING: [number, number][] = [
  [0, 0],
  [0.024, 0],
  [0.024, 0.16],
  // An ogee along the top edge.
  ...Array.from({ length: 7 }, (_, i): [number, number] => {
    const t = i / 6
    return [0.024 - 0.012 * t - 0.004 * Math.sin(t * Math.PI), 0.16 + 0.05 * t]
  }),
  [0.008, 0.215],
  [0, 0.215],
]
const DADO: [number, number][] = [
  [0, -0.02],
  [0.012, -0.018],
  [0.024, -0.008],
  [0.027, 0.004],
  [0.022, 0.016],
  [0.01, 0.024],
  [0, 0.025],
]

function useProfile(points: [number, number][]) {
  const shape = useMemo(() => {
    const s = new Shape()
    points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
    s.closePath()
    return s
  }, [points])
  return shape
}

/** A moulding of `shape` along one run of wall, `length` metres long, starting at local x = 0. */
function Run({ shape, length, y, colour }: { shape: Shape; length: number; y: number; colour: string }) {
  const geometry = useMemo(() => {
    const g = new ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, curveSegments: 1 })
    // Extruded along local z; turn it to run along x, standing out along +z.
    g.rotateY(-Math.PI / 2)
    g.translate(length, y, 0)
    g.computeVertexNormals()
    return g
  }, [shape, length, y])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={colour} roughness={0.55} />
    </mesh>
  )
}

/** A soft dark fade: opaque at one edge, clear at the other, shared by every corner. */
let fade: CanvasTexture | null = null
function fadeTexture() {
  if (!fade) {
    const canvas = document.createElement('canvas')
    canvas.width = 4
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 0, 128)
    // The canvas's bottom row lands on the plane's bottom edge, where the corner is.
    g.addColorStop(0, '#000000')
    g.addColorStop(0.65, '#555555')
    g.addColorStop(1, '#ffffff')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 4, 128)
    fade = new CanvasTexture(canvas)
  }
  return fade
}

/** Shading where two surfaces meet: `size` metres wide, darkest along the corner (the plane's bottom edge). */
function CornerShade({ length, size, strength }: { length: number; size: number; strength: number }) {
  return (
    <mesh position={[length / 2, size / 2, 0]} renderOrder={2}>
      <planeGeometry args={[length, size]} />
      <meshBasicMaterial color="#000000" alphaMap={fadeTexture()} transparent opacity={strength} depthWrite={false} />
    </mesh>
  )
}

/** Runs of wall between doorways, as [start, end] along the wall's local x. */
function runs(length: number, gaps: Opening[]): [number, number][] {
  const cuts = gaps
    .map((g) => [g.centre + length / 2 - g.width / 2, g.centre + length / 2 + g.width / 2])
    .sort((a, b) => a[0] - b[0])
  const out: [number, number][] = []
  let at = 0
  for (const [from, to] of cuts) {
    if (from > at) out.push([at, from])
    at = Math.max(at, to)
  }
  if (at < length) out.push([at, length])
  return out
}

function Panelling({
  length,
  height,
  colour,
  texture,
  seed,
}: {
  length: number
  height: number
  colour: string
  texture: TextureName
  seed: number
}) {
  const map = useSurfaceTexture(texture, length, height, seed)
  return (
    <mesh position={[length / 2, height / 2, 0.006]} receiveShadow>
      <planeGeometry args={[length, height]} />
      <meshStandardMaterial color={colour} map={map} bumpMap={map} bumpScale={0.5} roughness={0.6} />
    </mesh>
  )
}

export function Mouldings({ width, length, height, trim, cornice = '#efe6d4', dado, openings = [] }: MouldingsProps) {
  const corniceShape = useProfile(CORNICE)
  const skirtingShape = useProfile(SKIRTING)
  const dadoShape = useProfile(DADO)
  // Each wall as a group whose local x runs along it and +z faces into the room. Doorway gaps are measured
  // from the wall's centre, along x for the north and south walls and along z for the east and west.
  const walls: { side: WallSide; position: [number, number, number]; rotationY: number; length: number; flip: boolean }[] = [
    { side: 'north', position: [-width / 2, 0, -length / 2], rotationY: 0, length: width, flip: false },
    { side: 'south', position: [width / 2, 0, length / 2], rotationY: Math.PI, length: width, flip: true },
    { side: 'west', position: [-width / 2, 0, length / 2], rotationY: Math.PI / 2, length, flip: true },
    { side: 'east', position: [width / 2, 0, -length / 2], rotationY: -Math.PI / 2, length, flip: false },
  ]
  return (
    <group>
      {walls.map((wall, w) => {
        const gaps = openings.filter((o) => o.side === wall.side).map((o) => ({ ...o, centre: wall.flip ? -o.centre : o.centre }))
        return (
          <group key={wall.side} position={wall.position} rotation={[0, wall.rotationY, 0]}>
            <Run shape={corniceShape} length={wall.length} y={height} colour={cornice} />
            {/* Shade down the wall from the cornice, and along the ceiling beside it. */}
            <group position={[0, height - 0.24, 0.003]} rotation={[0, 0, Math.PI]} scale={[-1, 1, 1]}>
              <CornerShade length={wall.length} size={0.5} strength={0.22} />
            </group>
            <group position={[0, height - 0.003, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
              <CornerShade length={wall.length} size={0.45} strength={0.2} />
            </group>
            {runs(wall.length, gaps).map(([from, to]) => (
              <group key={from} position={[from, 0, 0]}>
                <Run shape={skirtingShape} length={to - from} y={0} colour={trim} />
                {dado && (
                  <>
                    <Run shape={dadoShape} length={to - from} y={dado.height} colour={trim} />
                    <group position={[0, 0.215, 0]}>
                      <Panelling
                        length={to - from}
                        height={dado.height - 0.235}
                        colour={dado.colour}
                        texture={dado.texture ?? 'wainscot'}
                        seed={w * 7 + Math.round(from * 10)}
                      />
                    </group>
                  </>
                )}
                {/* Shade up the wall from the floor, and across the floor beside it. */}
                <group position={[0, 0.215, 0.026]}>
                  <CornerShade length={to - from} size={0.5} strength={0.28} />
                </group>
                <group position={[0, 0.004, 0.024]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, -1, 1]}>
                  <CornerShade length={to - from} size={0.55} strength={0.3} />
                </group>
              </group>
            ))}
          </group>
        )
      })}
    </group>
  )
}
