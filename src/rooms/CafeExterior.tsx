import { useEffect, useMemo } from 'react'
import { CanvasTexture, DoubleSide, RepeatWrapping, SRGBColorSpace } from 'three'
import { useSurfaceTexture, useTiledTexture } from '../hooks/useTiledTexture.ts'
import { CAFE, CAFE_TABLES } from './dimensions.ts'

// The café's shopfront faces the house, towards -z. Positions below are in
// courtyard space, with F the plane of the front wall.
const F = CAFE.frontZ
const GREEN = '#1f3d31'
const CREAM = '#efe6d2'
const GOLD = '#d8b25e'
const IRON = { color: '#1a1a1a', metalness: 0.4, roughness: 0.5 }
/** Shopfront window bays, either side of the door. */
const BAYS = [-2.05, 2.05]
const BAY_WIDTH = 2.3
const SILL = 0.75
const HEAD = 2.45
/** Top of the shopfront frame; the fascia sits above it. */
const FRAME_TOP = 2.7

/** Paints a canvas once and hands it back as a texture, disposed on unmount. */
function useCanvas(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat = 1) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    draw(canvas.getContext('2d')!)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 4
    if (repeat !== 1) {
      tex.wrapS = RepeatWrapping
      tex.repeat.set(repeat, 1)
    }
    return tex
  }, [width, height, repeat]) // Each call site passes a fixed painter.
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

/** The warm interior seen through the glass: shelves, pendant lamps, a counter and tables. */
function drawInterior(ctx: CanvasRenderingContext2D, flip: boolean) {
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#6b4a2c')
  bg.addColorStop(0.55, '#a87a48')
  bg.addColorStop(1, '#4a3220')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  if (flip) {
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
  }
  // Shelves of jars along the back wall.
  for (const y of [0.3, 0.45]) {
    ctx.fillStyle = '#3b2616'
    ctx.fillRect(w * 0.05, h * y, w * 0.5, 5)
    for (let x = w * 0.07; x < w * 0.53; x += 22) {
      ctx.fillStyle = ['#d9c79a', '#c08a50', '#e8dcc0', '#8a5a34'][Math.floor(x / 22) % 4]
      ctx.fillRect(x, h * y - 22, 14, 22)
    }
  }
  // Counter.
  ctx.fillStyle = '#2c1c10'
  ctx.fillRect(w * 0.02, h * 0.62, w * 0.6, h * 0.38)
  ctx.fillStyle = '#d8cdb8'
  ctx.fillRect(w * 0.02, h * 0.6, w * 0.6, 8)
  // A bistro table and chairs nearer the glass.
  ctx.fillStyle = '#1e140c'
  ctx.beginPath()
  ctx.ellipse(w * 0.8, h * 0.7, w * 0.09, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(w * 0.8 - 3, h * 0.7, 6, h * 0.3)
  for (const dx of [-0.13, 0.13]) {
    ctx.fillRect(w * (0.8 + dx) - 14, h * 0.76, 28, 6)
    ctx.fillRect(w * (0.8 + dx) - 2, h * 0.76, 4, h * 0.24)
    ctx.fillRect(w * (0.8 + dx) + (dx > 0 ? 12 : -14), h * 0.58, 4, h * 0.2)
  }
  // Pendant lamps with a soft glow.
  for (const x of [0.2, 0.45, 0.78]) {
    ctx.strokeStyle = '#1e140c'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(w * x, 0)
    ctx.lineTo(w * x, h * 0.18)
    ctx.stroke()
    const g = ctx.createRadialGradient(w * x, h * 0.2, 0, w * x, h * 0.2, 70)
    g.addColorStop(0, 'rgba(255, 226, 160, 0.95)')
    g.addColorStop(1, 'rgba(255, 200, 120, 0)')
    ctx.fillStyle = g
    ctx.fillRect(w * x - 70, h * 0.2 - 70, 140, 140)
    ctx.fillStyle = '#fff1cc'
    ctx.beginPath()
    ctx.arc(w * x, h * 0.2, 9, Math.PI, 0)
    ctx.fill()
  }
}

/** Gilded lettering on the painted fascia board. */
function drawFascia(ctx: CanvasRenderingContext2D) {
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  ctx.fillStyle = GREEN
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 3
  ctx.strokeRect(10, 10, w - 20, h - 20)
  ctx.fillStyle = GOLD
  ctx.font = `italic ${Math.round(h * 0.52)}px Georgia, 'Times New Roman', serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('The Curiosity Café', w / 2, h / 2 + 4)
}

/** Green and cream awning stripes, one pair per texture repeat. */
function drawStripes(ctx: CanvasRenderingContext2D) {
  const w = ctx.canvas.width
  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, w, ctx.canvas.height)
  ctx.fillStyle = '#2f5a45'
  ctx.fillRect(0, 0, w / 2, ctx.canvas.height)
}

/** The awning's scalloped front edge: stripes with a cut-out lower edge (via alpha). */
function drawValance(ctx: CanvasRenderingContext2D) {
  drawStripes(ctx)
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.arc(w / 2, h, w / 2, Math.PI, 0)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
}

function drawChalkboard(ctx: CanvasRenderingContext2D) {
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  ctx.fillStyle = '#26302b'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#f2efe6'
  ctx.textAlign = 'center'
  ctx.font = `bold 34px Georgia, serif`
  ctx.fillText('Today', w / 2, 52)
  ctx.font = `24px Georgia, serif`
  ;['Coffee', 'Tea & cake', 'Curiosities', '', 'Opening soon'].forEach((line, i) => ctx.fillText(line, w / 2, 100 + i * 34))
}

function ShopWindow({ x, flip }: { x: number; flip: boolean }) {
  const interior = useCanvas(512, 384, (ctx) => drawInterior(ctx, flip))
  const glassH = HEAD - SILL
  const cy = (HEAD + SILL) / 2
  return (
    <group position={[x, 0, F]}>
      {/* The scene inside, glowing softly behind the glass. */}
      <mesh position={[0, cy, -0.02]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[BAY_WIDTH, glassH]} />
        <meshStandardMaterial map={interior} emissiveMap={interior} emissive="#ffffff" emissiveIntensity={0.75} roughness={1} />
      </mesh>
      {/* Glass sheen. */}
      <mesh position={[0, cy, -0.035]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[BAY_WIDTH, glassH]} />
        <meshPhysicalMaterial color="#cfe2ea" transparent opacity={0.12} roughness={0.05} metalness={0.2} />
      </mesh>
      {/* Glazing bars: two mullions and a transom. */}
      {[-BAY_WIDTH / 6, BAY_WIDTH / 6].map((mx) => (
        <mesh key={mx} position={[mx, cy, -0.05]}>
          <boxGeometry args={[0.05, glassH, 0.05]} />
          <meshStandardMaterial color={GREEN} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, HEAD - 0.4, -0.05]}>
        <boxGeometry args={[BAY_WIDTH, 0.05, 0.05]} />
        <meshStandardMaterial color={GREEN} roughness={0.35} />
      </mesh>
      {/* Stall riser below the glass, with a raised panel. */}
      <mesh position={[0, (SILL + 0.3) / 2, -0.05]}>
        <boxGeometry args={[BAY_WIDTH, SILL - 0.3, 0.06]} />
        <meshStandardMaterial color={GREEN} roughness={0.35} />
      </mesh>
      <mesh position={[0, (SILL + 0.3) / 2, -0.09]}>
        <boxGeometry args={[BAY_WIDTH - 0.24, SILL - 0.44, 0.03]} />
        <meshStandardMaterial color="#244739" roughness={0.3} />
      </mesh>
      <mesh position={[0, SILL, -0.1]}>
        <boxGeometry args={[BAY_WIDTH + 0.06, 0.05, 0.14]} />
        <meshStandardMaterial color={GREEN} roughness={0.35} />
      </mesh>
    </group>
  )
}

/** A striped canvas awning over a window bay, sloping out and down, with a scalloped edge. */
function Awning({ x }: { x: number }) {
  const stripes = useCanvas(64, 8, drawStripes, BAY_WIDTH / 0.25)
  const valance = useCanvas(64, 32, drawValance, BAY_WIDTH / 0.25)
  const reach = 1
  const drop = 0.4
  const slope = Math.atan2(drop, reach)
  const top = FRAME_TOP - 0.08
  return (
    <group position={[x, 0, F]}>
      <mesh position={[0, top - drop / 2, -reach / 2]} rotation={[-Math.PI / 2 - slope, 0, 0]} castShadow>
        <planeGeometry args={[BAY_WIDTH + 0.1, Math.hypot(reach, drop)]} />
        <meshStandardMaterial map={stripes} side={DoubleSide} roughness={0.9} />
      </mesh>
      <mesh position={[0, top - drop - 0.1, -reach]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[BAY_WIDTH + 0.1, 0.2]} />
        <meshStandardMaterial map={valance} side={DoubleSide} alphaTest={0.5} roughness={0.9} />
      </mesh>
      {/* Iron arms holding it out. */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (BAY_WIDTH / 2), top - drop / 2 - 0.03, -reach / 2]} rotation={[-slope, 0, 0]}>
          <boxGeometry args={[0.02, 0.02, Math.hypot(reach, drop)]} />
          <meshStandardMaterial {...IRON} />
        </mesh>
      ))}
    </group>
  )
}

/** A clipped bay tree in a zinc planter, beside the shopfront. */
function BayTree({ x }: { x: number }) {
  const leaves = useTiledTexture('hedge', 2, 2)
  return (
    <group position={[x, 0, F - 0.4]}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.45, 0.5, 0.45]} />
        <meshStandardMaterial color="#8d9592" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.025, 0.03, 0.8, 8]} />
        <meshStandardMaterial color="#4a3826" />
      </mesh>
      <mesh position={[0, 1.45, 0]} castShadow>
        <icosahedronGeometry args={[0.38, 3]} />
        <meshStandardMaterial color="#b9d0a0" map={leaves} roughness={0.95} />
      </mesh>
    </group>
  )
}

/** A round marble bistro table with two iron chairs. */
function BistroSet({ x, z }: { x: number; z: number }) {
  const marble = useTiledTexture('marble', 1, 1)
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.74, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.03, 28]} />
        <meshStandardMaterial color="#f4f1ea" map={marble} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.37, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.72, 8]} />
        <meshStandardMaterial {...IRON} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.03, 20]} />
        <meshStandardMaterial {...IRON} />
      </mesh>
      {/* Coffee cups. */}
      {[-0.1, 0.12].map((cx) => (
        <mesh key={cx} position={[cx, 0.79, cx * 0.5]}>
          <cylinderGeometry args={[0.04, 0.03, 0.07, 14]} />
          <meshStandardMaterial color="#fbfaf6" roughness={0.3} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.58, 0, 0]} rotation={[0, (side * Math.PI) / 2, 0]}>
          <mesh position={[0, 0.46, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.03, 20]} />
            <meshStandardMaterial {...IRON} />
          </mesh>
          {[0, 1, 2, 3].map((i) => {
            const a = (i * Math.PI) / 2 + Math.PI / 4
            return (
              <mesh key={i} position={[Math.cos(a) * 0.14, 0.23, Math.sin(a) * 0.14]}>
                <cylinderGeometry args={[0.012, 0.012, 0.46, 6]} />
                <meshStandardMaterial {...IRON} />
              </mesh>
            )
          })}
          {/* Hooped back, facing away from the table. */}
          <mesh position={[0, 0.72, -0.18]}>
            <torusGeometry args={[0.18, 0.012, 8, 24, Math.PI]} />
            <meshStandardMaterial {...IRON} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.18, 0.59, -0.18]}>
              <cylinderGeometry args={[0.012, 0.012, 0.26, 6]} />
              <meshStandardMaterial {...IRON} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function Chalkboard({ x, z }: { x: number; z: number }) {
  const board = useCanvas(256, 300, drawChalkboard)
  const lean = 0.18
  return (
    <group position={[x, 0, z]} rotation={[0, Math.PI + 0.3, 0]}>
      {[-1, 1].map((s) => (
        <group key={s} rotation={[s * lean, s === 1 ? Math.PI : 0, 0]} position={[0, 0.48, 0]}>
          <mesh position={[0, 0, 0.09]}>
            <boxGeometry args={[0.6, 0.95, 0.03]} />
            <meshStandardMaterial color="#6b4a2e" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0, 0.106]}>
            <planeGeometry args={[0.5, 0.82]} />
            <meshStandardMaterial map={board} roughness={0.95} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/**
 * The outside of the café, seen from the courtyard: a London stock-brick
 * pavilion with a painted green shopfront, striped awnings and tables
 * outside. The interior arrives in a later phase.
 */
export function CafeExterior() {
  const centerZ = F + CAFE.depth / 2
  const brick = useSurfaceTexture('brick', CAFE.width, CAFE.height, 5)
  const fascia = useCanvas(1024, 96, drawFascia)
  return (
    <group>
      <mesh position={[0, CAFE.height / 2, centerZ]} castShadow receiveShadow>
        <boxGeometry args={[CAFE.width, CAFE.height, CAFE.depth]} />
        <meshStandardMaterial color="#ffffff" map={brick} bumpMap={brick} bumpScale={1.2} roughness={0.92} />
      </mesh>
      {/* Stone plinth and parapet coping. */}
      <mesh position={[0, 0.15, centerZ]}>
        <boxGeometry args={[CAFE.width + 0.08, 0.3, CAFE.depth + 0.08]} />
        <meshStandardMaterial color="#b9b1a2" roughness={0.9} />
      </mesh>
      <mesh position={[0, CAFE.height + 0.05, centerZ]}>
        <boxGeometry args={[CAFE.width + 0.16, 0.1, CAFE.depth + 0.16]} />
        <meshStandardMaterial color="#ddd6c8" roughness={0.85} />
      </mesh>
      {/* Chimney stack at the back, with two pots. */}
      <group position={[2.6, CAFE.height, centerZ + 1.2]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.8, 1.1, 0.5]} />
          <meshStandardMaterial color="#c4a576" roughness={0.95} />
        </mesh>
        {[-0.18, 0.18].map((px) => (
          <mesh key={px} position={[px, 1.22, 0]}>
            <cylinderGeometry args={[0.09, 0.11, 0.25, 12]} />
            <meshStandardMaterial color="#a8603e" roughness={0.9} />
          </mesh>
        ))}
      </group>

      {/* Shopfront: pilasters, fascia with gilded lettering, and a cornice. */}
      {[-3.4, -0.72, 0.72, 3.4].map((px) => (
        <mesh key={px} position={[px, FRAME_TOP / 2, F - 0.06]}>
          <boxGeometry args={[0.16, FRAME_TOP, 0.12]} />
          <meshStandardMaterial color={GREEN} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, FRAME_TOP + 0.22, F - 0.07]}>
        <boxGeometry args={[7.1, 0.44, 0.1]} />
        <meshStandardMaterial color={GREEN} roughness={0.35} />
      </mesh>
      <mesh position={[0, FRAME_TOP + 0.22, F - 0.125]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[6.9, 0.4]} />
        <meshStandardMaterial map={fascia} roughness={0.4} />
      </mesh>
      <mesh position={[0, FRAME_TOP + 0.48, F - 0.1]}>
        <boxGeometry args={[7.3, 0.08, 0.2]} />
        <meshStandardMaterial color={GREEN} roughness={0.35} />
      </mesh>

      {BAYS.map((bx, i) => (
        <ShopWindow key={bx} x={bx} flip={i === 1} />
      ))}
      {BAYS.map((bx) => (
        <Awning key={bx} x={bx} />
      ))}
      <BayTree x={-3.75} />
      <BayTree x={3.75} />
      {CAFE_TABLES.map(([tx, tz]) => (
        <BistroSet key={tx} x={tx} z={tz} />
      ))}
      <Chalkboard x={1.3} z={F - 0.75} />
    </group>
  )
}
