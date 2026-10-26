import { useEffect, useMemo } from 'react'
import { CanvasTexture, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three'
import { Flowers, Stool } from '../components/Furnishings.tsx'
import { DRINKS } from '../features/cafe/drinks.ts'
import { CAFE_OVERLAY } from '../features/cafe/overlayId.ts'
import { useSurfaceTexture, useTiledTexture } from '../hooks/useTiledTexture.ts'
import { useInteractable } from '../world/InteractionSystem.tsx'
import { openOverlay } from '../world/overlay.ts'
import { Atmosphere } from './Atmosphere.tsx'
import { CAFE_ROOM } from './dimensions.ts'
import { RoomShell } from './RoomShell.tsx'

const { width: W, length: L, height: H, counterSize: COUNTER } = CAFE_ROOM
const GREEN = '#1f3d31'
const BRASS = { color: '#d4b064', metalness: 0.6, roughness: 0.28 }
const CHROME = { color: '#d8dcdf', metalness: 0.9, roughness: 0.18 }
const IRON = { color: '#1a1a1a', metalness: 0.4, roughness: 0.5 }
const DADO_HEIGHT = 1.1
/** Shop windows, matching the outside: sill and head heights. */
const SILL = 0.75
const HEAD = 2.45
const CURTAIN_TOP = 1.55

/** Paints a canvas once and hands it back as a texture, disposed on unmount. */
function useCanvas(width: number, height: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    draw(canvas.getContext('2d')!, width, height)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }, [width, height]) // Each call site passes a fixed painter.
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

/** The courtyard seen through the shop window: sky, the stucco terrace across the garden, and the hedges. */
function drawView(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.5)
  sky.addColorStop(0, '#8fb6d8')
  sky.addColorStop(1, '#dce8ef')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  // A couple of soft clouds.
  for (const [cx, cy, r] of [
    [0.25, 0.12, 60],
    [0.7, 0.2, 80],
  ]) {
    const g = ctx.createRadialGradient(w * cx, h * cy, 0, w * cx, h * cy, r)
    g.addColorStop(0, 'rgba(255, 255, 255, 0.7)')
    g.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  // The terrace: cream stucco with rows of sash windows and a cornice.
  const top = h * 0.3
  ctx.fillStyle = '#ece4d4'
  ctx.fillRect(0, top, w, h - top)
  ctx.fillStyle = '#d8cfbd'
  ctx.fillRect(0, top, w, 8)
  for (const row of [0.4, 0.6]) {
    for (let x = 18; x < w; x += 64) {
      ctx.fillStyle = '#f6f1e6'
      ctx.fillRect(x - 4, h * row - 4, 34, 58)
      ctx.fillStyle = '#4a5560'
      ctx.fillRect(x, h * row, 26, 50)
      ctx.fillStyle = '#f6f1e6'
      ctx.fillRect(x, h * row + 23, 26, 3)
      ctx.fillRect(x + 12, h * row, 2, 50)
    }
  }
  // Hedges and paving in front.
  ctx.fillStyle = '#4f6e3a'
  ctx.fillRect(0, h * 0.8, w, h * 0.08)
  for (let x = 0; x < w; x += 10) {
    ctx.fillStyle = `rgba(30, 50, 20, ${0.2 + ((x * 7) % 5) / 20})`
    ctx.beginPath()
    ctx.arc(x, h * 0.8, 9, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#b8b0a2'
  ctx.fillRect(0, h * 0.88, w, h * 0.12)
}

/** The menu board behind the counter, listing the drinks the counter can make. */
function drawMenu(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#232b27'
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 30; i++) {
    const x = (i * 97) % w
    const y = (i * 61) % h
    const g = ctx.createRadialGradient(x, y, 0, x, y, 70)
    g.addColorStop(0, 'rgba(255, 255, 255, 0.04)')
    g.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  ctx.fillStyle = 'rgba(244, 240, 228, 0.92)'
  ctx.textAlign = 'center'
  ctx.font = 'italic 54px Georgia, serif'
  ctx.fillText('Coffee', w / 2, 70)
  ctx.font = '30px Georgia, serif'
  const half = Math.ceil(DRINKS.length / 2)
  DRINKS.forEach((d, i) => {
    const col = i < half ? 0 : 1
    ctx.fillText(d.name, w * (col ? 0.72 : 0.28), 130 + (i % half) * 44)
  })
  ctx.strokeStyle = 'rgba(244, 240, 228, 0.5)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(w * 0.3, 92)
  ctx.lineTo(w * 0.7, 92)
  ctx.stroke()
}

/** A botanical print of coffee: leaves and ripe red cherries along a branch. */
function drawBotanical(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#f1e9d6'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#5a4630'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(w * 0.5, h * 0.92)
  ctx.bezierCurveTo(w * 0.45, h * 0.6, w * 0.6, h * 0.35, w * 0.5, h * 0.08)
  ctx.stroke()
  for (let i = 0; i < 7; i++) {
    const t = 0.15 + i * 0.11
    const y = h * (0.9 - t * 0.85)
    const x = w * (0.5 + Math.sin(t * 5) * 0.04)
    for (const side of [-1, 1]) {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(side * (0.9 + i * 0.04))
      ctx.fillStyle = i % 2 ? '#3f6a3a' : '#4d7a42'
      ctx.beginPath()
      ctx.ellipse(0, -w * 0.13, w * 0.05, w * 0.13, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(240, 240, 210, 0.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(0, -w * 0.25)
      ctx.stroke()
      ctx.restore()
    }
    if (i % 2 === 0) {
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = c % 2 ? '#a8261c' : '#c4352a'
        ctx.beginPath()
        ctx.arc(x + (c - 1.5) * 9, y + 8 + (c % 2) * 6, 7, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  ctx.fillStyle = '#5a4630'
  ctx.font = 'italic 22px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText('Coffea arabica', w / 2, h - 14)
}

/** Green-painted boarding along the lower walls, with a moulded rail. */
function Dado() {
  const sides = [
    { position: [-W / 2 + 0.01, 0, 0], rotationY: Math.PI / 2, length: L },
    { position: [W / 2 - 0.01, 0, 0], rotationY: -Math.PI / 2, length: L },
  ] as const
  return (
    <>
      {sides.map((s, i) => (
        <DadoSide key={i} seed={i} {...s} />
      ))}
    </>
  )
}

function DadoSide({
  position,
  rotationY,
  length,
  seed,
}: {
  position: readonly number[]
  rotationY: number
  length: number
  seed: number
}) {
  const boards = useSurfaceTexture('boarding', length, DADO_HEIGHT, 60 + seed, 200)
  return (
    <group position={position as [number, number, number]} rotation={[0, rotationY, 0]}>
      <mesh position={[0, DADO_HEIGHT / 2, 0]}>
        <planeGeometry args={[length, DADO_HEIGHT]} />
        <meshStandardMaterial color="#3d6a55" map={boards} bumpMap={boards} bumpScale={0.6} roughness={0.45} />
      </mesh>
      <mesh position={[0, DADO_HEIGHT, 0.02]}>
        <boxGeometry args={[length, 0.05, 0.04]} />
        <meshStandardMaterial color={GREEN} roughness={0.4} />
      </mesh>
    </group>
  )
}

/** Light linen café curtains on a brass rail: a plane rippled into soft folds. */
function useCurtainGeometry(width: number, height: number) {
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(width, height, 60, 1)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / width) * Math.PI * 22) * 0.02)
    g.computeVertexNormals()
    return g
  }, [width, height])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

/** One shop window from inside: the courtyard beyond, glazing bars, a curtain over the lower half. */
function ShopWindow({ x }: { x: number }) {
  const view = useCanvas(512, 384, drawView)
  const width = CAFE_ROOM.bayWidth
  const curtain = useCurtainGeometry(width, CURTAIN_TOP - SILL)
  const linen = useTiledTexture('fabric', 4, 1)
  const glassH = HEAD - SILL
  const cy = (HEAD + SILL) / 2
  return (
    <group position={[x, 0, L / 2 - 0.01]} rotation={[0, Math.PI, 0]}>
      {/* Daylight outside: unlit, so it reads brighter than the room. */}
      <mesh position={[0, cy, -0.005]}>
        <planeGeometry args={[width, glassH]} />
        <meshBasicMaterial map={view} color="#f4f4f4" toneMapped={false} />
      </mesh>
      {[-width / 6, width / 6].map((mx) => (
        <mesh key={mx} position={[mx, cy, 0.02]}>
          <boxGeometry args={[0.05, glassH, 0.04]} />
          <meshStandardMaterial color={GREEN} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, HEAD - 0.4, 0.02]}>
        <boxGeometry args={[width, 0.05, 0.04]} />
        <meshStandardMaterial color={GREEN} roughness={0.35} />
      </mesh>
      {/* Frame round the opening. */}
      {[
        [0, HEAD + 0.04, width + 0.16, 0.08],
        [0, SILL - 0.03, width + 0.16, 0.06],
        [-width / 2 - 0.04, cy, 0.08, glassH],
        [width / 2 + 0.04, cy, 0.08, glassH],
      ].map(([fx, fy, fw, fh], i) => (
        <mesh key={i} position={[fx, fy, 0.03]}>
          <boxGeometry args={[fw, fh, 0.06]} />
          <meshStandardMaterial color={GREEN} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, SILL, 0.1]}>
        <boxGeometry args={[width + 0.1, 0.04, 0.2]} />
        <meshStandardMaterial color="#e8e0cc" roughness={0.5} />
      </mesh>
      <mesh geometry={curtain} position={[0, (CURTAIN_TOP + SILL) / 2 + 0.02, 0.07]}>
        <meshStandardMaterial color="#f3ecdc" map={linen} transparent opacity={0.92} roughness={1} side={2} />
      </mesh>
      <mesh position={[0, CURTAIN_TOP + 0.03, 0.07]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, width, 8]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
    </group>
  )
}

/** A twin-group espresso machine in polished steel, with cups warming on top. */
function EspressoMachine({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.8, 0.5, 0.5]} />
        <meshStandardMaterial {...CHROME} />
      </mesh>
      {/* A painted side panel band and the drip tray. */}
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[0.81, 0.12, 0.51]} />
        <meshStandardMaterial color="#2f5a45" roughness={0.3} />
      </mesh>
      {/* A brass maker's plate on the back, the side the room sees. */}
      <mesh position={[0, 0.24, -0.252]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.32, 0.07]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, 0.02, 0.32]}>
        <boxGeometry args={[0.7, 0.04, 0.18]} />
        <meshStandardMaterial color="#2a2c2e" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Group heads with portafilters. */}
      {[-0.2, 0.2].map((gx) => (
        <group key={gx} position={[gx, 0.22, 0.28]}>
          <mesh>
            <cylinderGeometry args={[0.045, 0.05, 0.06, 20]} />
            <meshStandardMaterial {...CHROME} />
          </mesh>
          <mesh position={[0, -0.05, 0.02]}>
            <cylinderGeometry args={[0.04, 0.035, 0.04, 20]} />
            <meshStandardMaterial {...CHROME} />
          </mesh>
          <mesh position={[0, -0.05, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.014, 0.018, 0.18, 10]} />
            <meshStandardMaterial color="#1c1410" roughness={0.4} />
          </mesh>
          {/* A cup under each spout. */}
          <mesh position={[0, -0.155, 0.02]}>
            <cylinderGeometry args={[0.03, 0.024, 0.05, 16]} />
            <meshStandardMaterial color="#fbfaf6" roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* Steam wand. */}
      <mesh position={[0.36, 0.2, 0.3]} rotation={[0.25, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.28, 8]} />
        <meshStandardMaterial {...CHROME} />
      </mesh>
      {/* Pressure gauge. */}
      <group position={[0, 0.4, 0.252]}>
        <mesh>
          <circleGeometry args={[0.04, 24]} />
          <meshStandardMaterial color="#f2ece0" />
        </mesh>
        <mesh position={[0.008, 0.008, 0.002]} rotation={[0, 0, -0.8]}>
          <planeGeometry args={[0.004, 0.032]} />
          <meshStandardMaterial color="#b0301c" />
        </mesh>
      </group>
      {/* Cups warming on top, with a gallery rail. */}
      {[-0.26, -0.13, 0, 0.13, 0.26].map((cx, i) => (
        <mesh key={cx} position={[cx, 0.53 + (i % 2) * 0.05, 0]} rotation={[Math.PI, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.03, 0.06, 16]} />
          <meshStandardMaterial color="#fbfaf6" roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 0.58, 0.24]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.006, 0.006, 0.8, 6]} />
        <meshStandardMaterial {...CHROME} />
      </mesh>
    </group>
  )
}

/** A coffee grinder: a glass hopper of beans over a steel body. */
function Grinder({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.2, 0.06, 0.24]} />
        <meshStandardMaterial color="#2a2c2e" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.22, -0.02]} castShadow>
        <boxGeometry args={[0.16, 0.32, 0.18]} />
        <meshStandardMaterial color="#2a2c2e" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.48, -0.02]}>
        <cylinderGeometry args={[0.1, 0.05, 0.2, 20]} />
        <meshStandardMaterial color="#5a3820" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.5, -0.02]}>
        <cylinderGeometry args={[0.11, 0.055, 0.26, 20, 1, true]} />
        <meshStandardMaterial color="#dceef5" transparent opacity={0.25} roughness={0.05} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** A cake under a glass dome, with a slice taken out. */
function CakeStand({ position, colour }: { position: [number, number, number]; colour: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.03, 0.06, 0.12, 12]} />
        <meshStandardMaterial color="#f4f0e8" roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.125, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.012, 32]} />
        <meshStandardMaterial color="#f4f0e8" roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.1, 32, 1, false, 0.6, Math.PI * 2 - 0.6]} />
        <meshStandardMaterial color={colour} roughness={0.8} side={2} />
      </mesh>
      <mesh position={[0, 0.232, 0]}>
        <cylinderGeometry args={[0.121, 0.121, 0.01, 32, 1, false, 0.6, Math.PI * 2 - 0.6]} />
        <meshStandardMaterial color="#f8f2e6" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#e4f0f4" transparent opacity={0.18} roughness={0.05} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.25, 0]} scale={[1, 0.001, 1]}>
        <cylinderGeometry args={[0.16, 0.16, 1, 24, 1, true]} />
        <meshStandardMaterial color="#e4f0f4" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** The counter: green panelled front, marble top, brass foot rail, and the machine on it. */
function Counter() {
  const [x, z] = CAFE_ROOM.counter
  useInteractable({
    position: useMemo(() => new Vector3(x, 1.2, z), [x, z]),
    radius: 2.3,
    prompt: 'Press E to make a drink at the counter',
    onInteract: () => openOverlay(CAFE_OVERLAY),
  })
  const marble = useTiledTexture('marble', COUNTER.length / 1.2, 1)
  const boards = useSurfaceTexture('boarding', COUNTER.length, COUNTER.height, 70, 200)
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, (COUNTER.height - 0.04) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[COUNTER.length - 0.06, COUNTER.height - 0.04, COUNTER.depth - 0.08]} />
        <meshStandardMaterial color="#3d6a55" roughness={0.45} />
      </mesh>
      <mesh position={[0, (COUNTER.height - 0.04) / 2, COUNTER.depth / 2 - 0.035]}>
        <planeGeometry args={[COUNTER.length - 0.06, COUNTER.height - 0.04]} />
        <meshStandardMaterial color="#3d6a55" map={boards} bumpMap={boards} bumpScale={0.6} roughness={0.45} />
      </mesh>
      <mesh position={[0, COUNTER.height - 0.02, 0.02]} castShadow receiveShadow>
        <boxGeometry args={[COUNTER.length, 0.04, COUNTER.depth + 0.04]} />
        <meshStandardMaterial color="#f4f1ea" map={marble} roughness={0.25} />
      </mesh>
      {/* Brass foot rail on posts. */}
      <mesh position={[0, 0.18, COUNTER.depth / 2 + 0.12]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.022, 0.022, COUNTER.length - 0.2, 12]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      {[-1.8, 0, 1.8].map((px) => (
        <mesh key={px} position={[px, 0.12, COUNTER.depth / 2 + 0.07]} rotation={[Math.PI / 2 - 0.6, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.16, 8]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
      ))}
      <group position={[0, COUNTER.height, 0]}>
        {/* The machine faces the barista, with its polished back to the room. */}
        <EspressoMachine position={[0.6, 0, -0.05]} rotationY={Math.PI} />
        <Grinder position={[1.5, 0, -0.1]} />
        <CakeStand position={[-1.6, 0, 0.05]} colour="#7a4a2c" />
        <CakeStand position={[-1.15, 0, 0.1]} colour="#e8c87a" />
        {/* The till and a stack of saucers. */}
        <mesh position={[-0.5, 0.09, -0.1]} rotation={[-0.35, 0, 0]}>
          <boxGeometry args={[0.28, 0.18, 0.22]} />
          <meshStandardMaterial color="#2a2624" roughness={0.5} />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[1.95, 0.008 + i * 0.016, 0.12]}>
            <cylinderGeometry args={[0.07, 0.06, 0.014, 24]} />
            <meshStandardMaterial color="#fbfaf6" roughness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** The back wall behind the counter: white metro tiles, shelves of jars and cups, and the menu board. */
function BackBar() {
  const tiles = useSurfaceTexture('glazed', COUNTER.length + 0.6, 1.4, 80, 200)
  const wood = useTiledTexture('wood', 2, 0.5)
  const menu = useCanvas(768, 384, drawMenu)
  const [x] = CAFE_ROOM.counter
  const back = -L / 2 + 0.01
  const jars = ['#d9c79a', '#c08a50', '#e8dcc0', '#8a5a34', '#5a3820']
  return (
    <group position={[x, 0, back]}>
      <mesh position={[0, 0.9 + 0.7, 0]}>
        <planeGeometry args={[COUNTER.length + 0.6, 1.4]} />
        <meshStandardMaterial map={tiles} roughness={0.2} />
      </mesh>
      {/* A low back counter for the barista. */}
      <mesh position={[0, 0.45, 0.3]}>
        <boxGeometry args={[COUNTER.length, 0.9, 0.58]} />
        <meshStandardMaterial color="#2f5a45" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.91, 0.3]}>
        <boxGeometry args={[COUNTER.length + 0.04, 0.03, 0.62]} />
        <meshStandardMaterial color="#9a6a42" map={wood} roughness={0.45} />
      </mesh>
      {[1.35, 1.75].map((y, row) => (
        <group key={y} position={[0, y, 0.14]}>
          <mesh>
            <boxGeometry args={[COUNTER.length - 0.4, 0.035, 0.26]} />
            <meshStandardMaterial color="#9a6a42" map={wood} roughness={0.45} />
          </mesh>
          {Array.from({ length: 14 }, (_, i) => {
            const jx = -1.85 + i * 0.28 + row * 0.1
            const tall = (i + row) % 3 === 0
            return row === 0 ? (
              <group key={i} position={[jx, 0.02, 0]}>
                <mesh position={[0, tall ? 0.1 : 0.075, 0]}>
                  <cylinderGeometry args={[0.055, 0.055, tall ? 0.2 : 0.15, 16]} />
                  <meshStandardMaterial color={jars[(i * 3 + row) % jars.length]} roughness={0.7} />
                </mesh>
                <mesh position={[0, tall ? 0.21 : 0.16, 0]}>
                  <cylinderGeometry args={[0.058, 0.058, 0.025, 16]} />
                  <meshStandardMaterial {...BRASS} />
                </mesh>
              </group>
            ) : (
              <mesh key={i} position={[jx, 0.045, 0]}>
                <cylinderGeometry args={[0.045, 0.035, 0.09, 14]} />
                <meshStandardMaterial color={i % 4 === 0 ? '#2f5a45' : '#fbfaf6'} roughness={0.3} />
              </mesh>
            )
          })}
        </group>
      ))}
      {/* Menu board in a wooden frame. */}
      <group position={[0, 2.62, 0.04]}>
        <mesh>
          <boxGeometry args={[2.2, 1.12, 0.05]} />
          <meshStandardMaterial color="#5a3a24" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.03]}>
          <planeGeometry args={[2.08, 1.0]} />
          <meshStandardMaterial map={menu} roughness={0.95} />
        </mesh>
      </group>
    </group>
  )
}

/** A green leather banquette along the west wall. */
function Banquette() {
  const leather = useTiledTexture('leather', 6, 1)
  const length = 3.8
  const z = 0.5
  return (
    <group position={[-W / 2, 0, z]}>
      <mesh position={[0.28, 0.2, 0]}>
        <boxGeometry args={[0.55, 0.4, length]} />
        <meshStandardMaterial color="#3a2a1c" roughness={0.6} />
      </mesh>
      <mesh position={[0.28, 0.45, 0]} castShadow>
        <boxGeometry args={[0.55, 0.1, length]} />
        <meshStandardMaterial color="#2f5a45" map={leather} roughness={0.55} />
      </mesh>
      {/* Buttoned back in panels. */}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} position={[0.08, 0.78, -length / 2 + length / 10 + (i * length) / 5]} rotation={[0, 0, -0.08]}>
          <boxGeometry args={[0.12, 0.56, length / 5 - 0.03]} />
          <meshStandardMaterial color="#2f5a45" map={leather} roughness={0.55} />
        </mesh>
      ))}
    </group>
  )
}

/** A round marble table on a cast-iron pedestal, with a coffee or two on it. */
function Table({ position, cups = 1, flowers }: { position: [number, number]; cups?: number; flowers?: [string, string] }) {
  const marble = useTiledTexture('marble', 1, 1)
  return (
    <group position={[position[0], 0, position[1]]}>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.03, 32]} />
        <meshStandardMaterial color="#f4f1ea" map={marble} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.37, 0]}>
        <cylinderGeometry args={[0.025, 0.03, 0.72, 10]} />
        <meshStandardMaterial {...IRON} />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.12, 0.03, Math.sin(a) * 0.12]} rotation={[0, -a, 0]}>
            <boxGeometry args={[0.26, 0.04, 0.04]} />
            <meshStandardMaterial {...IRON} />
          </mesh>
        )
      })}
      {Array.from({ length: cups }, (_, i) => (
        <group key={i} position={[i ? 0.12 : -0.12, 0.755, i ? -0.08 : 0.06]}>
          <mesh>
            <cylinderGeometry args={[0.065, 0.055, 0.01, 20]} />
            <meshStandardMaterial color="#fbfaf6" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.035, 0]}>
            <cylinderGeometry args={[0.04, 0.03, 0.06, 16]} />
            <meshStandardMaterial color="#fbfaf6" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.064, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.036, 16]} />
            <meshStandardMaterial color="#c8a27a" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {flowers && (
        <group position={[0.05, 0.755, 0.15]} scale={0.5}>
          <Flowers position={[0, 0, 0]} colours={flowers} />
        </group>
      )}
    </group>
  )
}

/** A bentwood café chair facing along -z (turn it with rotationY). */
function Chair({ position, rotationY }: { position: [number, number]; rotationY: number }) {
  const wood = { color: '#4a2e1c', roughness: 0.45 }
  return (
    <group position={[position[0], 0, position[1]]} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.46, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.035, 24]} />
        <meshStandardMaterial {...wood} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2 + Math.PI / 4
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.15, 0.23, Math.sin(a) * 0.15]}
            rotation={[Math.sin(a) * 0.08, 0, -Math.cos(a) * 0.08]}
          >
            <cylinderGeometry args={[0.014, 0.016, 0.46, 8]} />
            <meshStandardMaterial {...wood} />
          </mesh>
        )
      })}
      <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.15, 0.01, 6, 24]} />
        <meshStandardMaterial {...wood} />
      </mesh>
      {/* The bent hoop of the back. */}
      <group position={[0, 0.5, 0.18]} rotation={[-0.12, 0, 0]}>
        <mesh position={[0, 0.2, 0]}>
          <torusGeometry args={[0.17, 0.013, 8, 24, Math.PI]} />
          <meshStandardMaterial {...wood} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.17, 0.1, 0]}>
            <cylinderGeometry args={[0.013, 0.013, 0.2, 8]} />
            <meshStandardMaterial {...wood} />
          </mesh>
        ))}
        <mesh position={[0, 0.18, 0]}>
          <torusGeometry args={[0.1, 0.009, 6, 20, Math.PI]} />
          <meshStandardMaterial {...wood} />
        </mesh>
      </group>
    </group>
  )
}

/** A narrow bar under the east window, for sitting and watching the courtyard. */
function WindowBar() {
  const wood = useTiledTexture('wood', 2, 0.3)
  const [bx] = CAFE_ROOM.bays.slice(-1)
  return (
    <group position={[bx, 0, L / 2 - 0.2]}>
      <mesh position={[0, 1.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[CAFE_ROOM.bayWidth, 0.04, 0.36]} />
        <meshStandardMaterial color="#9a6a42" map={wood} roughness={0.45} />
      </mesh>
      {[-0.9, 0.9].map((sx) => (
        <mesh key={sx} position={[sx, 0.95, 0.12]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.03, 0.18, 0.03]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
      ))}
      <mesh position={[-0.3, 1.075, 0]}>
        <cylinderGeometry args={[0.04, 0.03, 0.07, 16]} />
        <meshStandardMaterial color="#fbfaf6" roughness={0.3} />
      </mesh>
      {/* A folded newspaper. */}
      <mesh position={[0.4, 1.05, 0.02]} rotation={[0, 0.2, 0]}>
        <boxGeometry args={[0.3, 0.012, 0.22]} />
        <meshStandardMaterial color="#e6e1d6" roughness={0.9} />
      </mesh>
      {[-0.55, 0.55].map((sx) => (
        <Stool key={sx} position={[sx, 0, -0.45]} height={0.75} />
      ))}
    </group>
  )
}

/** A potted fiddle-leaf fig in the corner by the door. */
function Fig({ position }: { position: [number, number] }) {
  const leaves = useTiledTexture('hedge', 1, 1)
  const clumps = [
    [0, 1.25, 0, 0.3],
    [0.16, 1.55, 0.06, 0.24],
    [-0.14, 1.6, -0.04, 0.25],
    [0.04, 1.85, 0.02, 0.2],
    [-0.08, 1.05, 0.12, 0.2],
  ]
  return (
    <group position={[position[0], 0, position[1]]}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.19, 0.5, 20]} />
        <meshStandardMaterial color="#c9c0b0" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.025, 0.035, 1.1, 6]} />
        <meshStandardMaterial color="#5a4632" />
      </mesh>
      {clumps.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color="#8fb070" map={leaves} roughness={0.8} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/** A framed print, hung with its face along +z (turn it with rotationY). */
function Print({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  const art = useCanvas(320, 440, drawBotanical)
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh>
        <boxGeometry args={[0.56, 0.74, 0.03]} />
        <meshStandardMaterial color="#c9a55c" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.017]}>
        <planeGeometry args={[0.46, 0.64]} />
        <meshStandardMaterial map={art} roughness={0.9} />
      </mesh>
    </group>
  )
}

/** A green enamel pendant shade with a warm bulb under it. */
function Pendant({ x, z, drop = 0.9, light }: { x: number; z: number; drop?: number; light?: boolean }) {
  return (
    <group position={[x, H, z]}>
      <mesh position={[0, -drop / 2, 0]}>
        <cylinderGeometry args={[0.006, 0.006, drop, 6]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0, -drop - 0.06, 0]}>
        <coneGeometry args={[0.17, 0.14, 24, 1, true]} />
        <meshStandardMaterial color={GREEN} roughness={0.35} metalness={0.2} side={2} />
      </mesh>
      <mesh position={[0, -drop - 0.12, 0]}>
        <sphereGeometry args={[0.045, 16, 10]} />
        <meshStandardMaterial color="#fff4dc" emissive="#ffdca0" emissiveIntensity={2.2} />
      </mesh>
      {light && <pointLight position={[0, -drop - 0.25, 0]} color="#ffe2b8" intensity={6} distance={7} decay={1.5} />}
    </group>
  )
}

/** The Curiosity Café: a warm London café with a working espresso counter. */
export default function Cafe() {
  const [cx, cz] = CAFE_ROOM.counter
  return (
    <group>
      <Atmosphere background="#d8e4ea" />
      <hemisphereLight args={['#fff8ee', '#6a5440', 1.15]} />
      {/* Daylight through the shopfront. */}
      <directionalLight position={[1, 4, L / 2 + 3]} color="#fff6e8" intensity={1.1} />
      <RoomShell
        width={W}
        length={L}
        height={H}
        floor={{ color: '#ffffff', texture: 'herringbone' }}
        walls={{ color: '#f8f0e0', texture: 'plaster' }}
        ceiling={{ color: '#fffaf0' }}
      />
      <Dado />
      {CAFE_ROOM.bays.map((x) => (
        <ShopWindow key={x} x={x} />
      ))}
      <Counter />
      <BackBar />
      <Banquette />
      {CAFE_ROOM.banquetteTables.map(([x, z], i) => (
        <group key={`b${z}`}>
          <Table position={[x, z]} cups={i + 1} flowers={i === 0 ? ['#f2c4d0', '#fff4e0'] : undefined} />
          <Chair position={[x + 0.62, z]} rotationY={Math.PI / 2} />
        </group>
      ))}
      {CAFE_ROOM.bistroTables.map(([x, z], i) => (
        <group key={`t${z}`}>
          <Table position={[x, z]} cups={2 - i} flowers={i === 1 ? ['#f4d06a', '#fff4e0'] : undefined} />
          <Chair position={[x - 0.6, z]} rotationY={-Math.PI / 2 + 0.15} />
          <Chair position={[x + 0.6, z]} rotationY={Math.PI / 2 - 0.1} />
        </group>
      ))}
      <WindowBar />
      <Fig position={[-W / 2 + 0.45, L / 2 - 0.5]} />
      <Print position={[-W / 2 + 0.03, 1.85, 0.5]} rotationY={Math.PI / 2} />
      <Print position={[W / 2 - 0.03, 1.85, 0.7]} rotationY={-Math.PI / 2} />
      {[-0.9, 0.6, 2.1].map((px, i) => (
        <Pendant key={px} x={cx + px - 0.6} z={cz + 0.1} drop={1.2} light={i === 1} />
      ))}
      {[...CAFE_ROOM.banquetteTables, ...CAFE_ROOM.bistroTables].map(([x, z], i) => (
        <Pendant key={`p${i}`} x={x} z={z} drop={1.2} light={i === 0 || i === 3} />
      ))}
    </group>
  )
}
