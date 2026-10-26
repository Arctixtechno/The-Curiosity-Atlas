import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { CanvasTexture, Color, Object3D, SRGBColorSpace, type InstancedMesh } from 'three'
import { useTiledTexture } from '../hooks/useTiledTexture.ts'

// A built-in bookcase full of books, shared by the lounge and the library.
// Every book is one instance of a single mesh, so a full case is one draw
// however many books it holds.

const BOOK_COLOURS = [
  '#6b2a22',
  '#2f4a3a',
  '#1f3350',
  '#7a5a2a',
  '#4a2a44',
  '#8a7a5a',
  '#2a2a2a',
  '#5a1e1a',
  '#33402a',
  '#8a6a3a',
]

/** Painted spines: gilt bands near the top and bottom, the rest left for the book's colour. */
let spineTexture: CanvasTexture | null = null
function spines() {
  if (!spineTexture) {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 32, 128)
    ctx.fillStyle = '#e8c070'
    for (const y of [10, 16, 104, 112]) ctx.fillRect(0, y, 32, 2)
    ctx.fillRect(8, 30, 16, 6)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'
    ctx.fillRect(0, 0, 3, 128)
    ctx.fillRect(29, 0, 3, 128)
    spineTexture = new CanvasTexture(canvas)
    spineTexture.colorSpace = SRGBColorSpace
  }
  return spineTexture
}

interface BookcaseProps {
  /** Width along the wall, in metres. */
  length: number
  /** Height of the case's sides; the cornice sits on top. */
  height: number
  /** Heights of the shelves above the floor. */
  shelves: number[]
  /** Picks the books, so neighbouring cases don't look alike. */
  seed: number
  wood?: string
  back?: string
  /** Objects standing among the books, in the case's own space (x along it, +z out into the room). */
  children?: ReactNode
}

/**
 * A bookcase standing at its back's centre, facing +z: plinth, shelves,
 * cornice and books of every size, with now and then a gap, a stack lying
 * flat or a book leaning on its neighbour.
 */
export function Bookcase({ length, height, shelves, seed, wood = '#5a3a22', back = '#3a2414', children }: BookcaseProps) {
  const grain = useTiledTexture('wood', 1, 2)
  const books = useRef<InstancedMesh>(null)
  const layout = useMemo(() => {
    let s = seed
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647
    const out: { x: number; y: number; w: number; h: number; d: number; lean: number; flat: boolean; colour: string }[] = []
    shelves.forEach((y) => {
      let x = -length / 2 + 0.06
      while (x < length / 2 - 0.1) {
        const roll = rand()
        if (roll < 0.06) {
          x += 0.12 + rand() * 0.15
          continue
        }
        if (roll < 0.12) {
          for (let k = 0; k < 3 + Math.floor(rand() * 3); k++) {
            const h = 0.035 + rand() * 0.02
            out.push({
              x: x + 0.12,
              y: y + 0.02 + k * 0.045,
              w: 0.24,
              h,
              d: 0.17 + rand() * 0.04,
              lean: 0,
              flat: true,
              colour: BOOK_COLOURS[Math.floor(rand() * BOOK_COLOURS.length)],
            })
          }
          x += 0.28
          continue
        }
        const w = 0.025 + rand() * 0.035
        const h = 0.24 + rand() * 0.12
        const lean = roll > 0.95 ? 0.25 : 0
        out.push({
          x: x + w / 2,
          y: y + 0.02,
          w,
          h,
          d: 0.18 + rand() * 0.05,
          lean,
          flat: false,
          colour: BOOK_COLOURS[Math.floor(rand() * BOOK_COLOURS.length)],
        })
        x += w + 0.003 + (lean ? 0.06 : 0)
      }
    })
    return out
  }, [seed, length, shelves])

  useLayoutEffect(() => {
    const mesh = books.current!
    const o = new Object3D()
    const colour = new Color()
    layout.forEach((b, i) => {
      o.position.set(b.x, b.flat ? b.y : b.y + (b.h / 2) * Math.cos(b.lean), 0.04 + b.d / 2)
      o.rotation.set(0, 0, b.flat ? Math.PI / 2 : b.lean)
      if (b.lean) o.position.x += (b.h / 2) * Math.sin(b.lean)
      o.scale.set(b.w, b.h, b.d)
      if (b.flat) o.scale.set(b.h, b.w, b.d)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      mesh.setColorAt(i, colour.set(b.colour).offsetHSL(0, 0, (Math.sin(i * 12.9) - 0.5) * 0.04))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [layout])

  return (
    <group>
      {/* Back, sides, a plinth and a cornice. */}
      <mesh position={[0, height / 2, 0.01]} receiveShadow>
        <boxGeometry args={[length, height, 0.02]} />
        <meshStandardMaterial color={back} map={grain} roughness={0.7} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * length) / 2, height / 2, 0.17]} castShadow>
          <boxGeometry args={[0.05, height, 0.34]} />
          <meshStandardMaterial color={wood} map={grain} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 0.17, 0.18]}>
        <boxGeometry args={[length + 0.06, 0.34, 0.36]} />
        <meshStandardMaterial color={wood} map={grain} roughness={0.6} />
      </mesh>
      <mesh position={[0, height + 0.06, 0.2]}>
        <boxGeometry args={[length + 0.14, 0.12, 0.42]} />
        <meshStandardMaterial color={wood} map={grain} roughness={0.6} />
      </mesh>
      {shelves.map((y) => (
        <mesh key={y} position={[0, y, 0.17]} receiveShadow>
          <boxGeometry args={[length, 0.03, 0.32]} />
          <meshStandardMaterial color={wood} map={grain} roughness={0.6} />
        </mesh>
      ))}
      <instancedMesh ref={books} args={[undefined, undefined, layout.length]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial map={spines()} roughness={0.8} />
      </instancedMesh>
      {children}
    </group>
  )
}
