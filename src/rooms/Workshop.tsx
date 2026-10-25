import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, ExtrudeGeometry, Shape, SRGBColorSpace, Vector3, type Group } from 'three'
import { Stool, WallClock } from '../components/Furnishings.tsx'
import { CIRCUIT_OVERLAY, GEARS_OVERLAY } from '../features/workshop/overlayIds.ts'
import { useSurfaceTexture, useTiledTexture } from '../hooks/useTiledTexture.ts'
import { useInteractable } from '../world/InteractionSystem.tsx'
import { openOverlay } from '../world/overlay.ts'
import { Atmosphere } from './Atmosphere.tsx'
import { WORKSHOP } from './dimensions.ts'
import { RoomShell } from './RoomShell.tsx'

const { width: W, length: L, height: H, bench: BENCH } = WORKSHOP
const STEEL = { color: '#8a9096', metalness: 0.7, roughness: 0.35 }
const IRON = { color: '#2a2c2e', metalness: 0.5, roughness: 0.5 }
const BRASS = { color: '#d4b064', metalness: 0.55, roughness: 0.3 }
const ENGINEER_GREEN = '#4a6a58'

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

/** London rooftops through the workshop's steel window: chimney pots and slate roofs under a pale sky. */
function drawRooftops(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#9cbcd6')
  sky.addColorStop(1, '#e4ebee')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  let x = 0
  let i = 0
  while (x < w) {
    const width = 70 + ((i * 37) % 60)
    const top = h * (0.5 + ((i * 13) % 20) / 100)
    ctx.fillStyle = i % 2 ? '#6a6e74' : '#5a5e66'
    ctx.beginPath()
    ctx.moveTo(x, h)
    ctx.lineTo(x, top + 18)
    ctx.lineTo(x + width / 2, top)
    ctx.lineTo(x + width, top + 18)
    ctx.lineTo(x + width, h)
    ctx.fill()
    // A chimney stack with pots.
    ctx.fillStyle = '#9a6a4a'
    ctx.fillRect(x + width * 0.6, top - 22, 18, 30)
    ctx.fillStyle = '#b8704a'
    ctx.fillRect(x + width * 0.6 + 2, top - 30, 5, 9)
    ctx.fillRect(x + width * 0.6 + 10, top - 28, 5, 7)
    x += width
    i++
  }
}

/** A pegboard of hand tools, drawn flat. */
function drawPegboard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#c8b08a'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(60, 40, 20, 0.45)'
  for (let y = 12; y < h; y += 24) for (let x = 12; x < w; x += 24) ctx.fillRect(x - 2, y - 2, 4, 4)
  // Spanners in a row, smallest to largest.
  for (let i = 0; i < 6; i++) {
    const x = 40 + i * 34
    const len = 90 + i * 14
    ctx.fillStyle = '#9aa0a6'
    ctx.fillRect(x - 4, 40, 8, len)
    ctx.beginPath()
    ctx.arc(x, 40, 10 + i, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#c8b08a'
    ctx.fillRect(x - 4, 26 - i, 8, 14)
  }
  // A hammer, a saw and a pair of pliers.
  ctx.fillStyle = '#8a5a34'
  ctx.fillRect(300, 60, 12, 150)
  ctx.fillStyle = '#4a4e54'
  ctx.fillRect(278, 44, 56, 22)
  ctx.fillStyle = '#b8bcc0'
  ctx.beginPath()
  ctx.moveTo(360, 50)
  ctx.lineTo(480, 60)
  ctx.lineTo(480, 100)
  ctx.lineTo(360, 120)
  ctx.fill()
  ctx.fillStyle = '#8a5a34'
  ctx.fillRect(480, 52, 30, 56)
  ctx.strokeStyle = '#a8301e'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(380, 160)
  ctx.lineTo(420, 230)
  ctx.moveTo(400, 160)
  ctx.lineTo(370, 230)
  ctx.stroke()
  // Screwdrivers.
  for (let i = 0; i < 4; i++) {
    const x = 60 + i * 40
    ctx.fillStyle = ['#c43a2a', '#e0a020', '#2a6aa8', '#3a8a5a'][i]
    ctx.fillRect(x - 6, 190, 12, 40)
    ctx.fillStyle = '#9aa0a6'
    ctx.fillRect(x - 2, 230, 4, 40)
  }
}

/** A heavy timber workbench on a painted steel frame, with a shelf below. */
function Workbench({ at, children }: { at: [number, number]; children?: React.ReactNode }) {
  const wood = useTiledTexture('wood', 2, 1)
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh position={[0, BENCH.height - 0.04, 0]} castShadow receiveShadow>
        <boxGeometry args={[BENCH.width, 0.08, BENCH.depth]} />
        <meshStandardMaterial color="#c8a070" map={wood} roughness={0.6} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            position={[sx * (BENCH.width / 2 - 0.08), (BENCH.height - 0.08) / 2, sz * (BENCH.depth / 2 - 0.08)]}
          >
            <boxGeometry args={[0.06, BENCH.height - 0.08, 0.06]} />
            <meshStandardMaterial color={ENGINEER_GREEN} roughness={0.5} metalness={0.3} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[BENCH.width - 0.1, 0.03, BENCH.depth - 0.1]} />
        <meshStandardMaterial color="#8a6a48" map={wood} roughness={0.7} />
      </mesh>
      <group position={[0, BENCH.height, 0]}>{children}</group>
    </group>
  )
}

/** A spur gear's outline, extruded: one mesh rather than a disc and a box per tooth. */
function useGearGeometry(radius: number, teeth: number, thickness: number) {
  const geometry = useMemo(() => {
    const tip = radius + radius * 0.06 + 0.003
    const root = radius - radius * 0.04
    const step = (Math.PI * 2) / teeth
    const shape = new Shape()
    for (let i = 0; i < teeth; i++) {
      const a = i * step - step * 0.3
      // A trapezoid tooth, then the gap to the next one.
      const points: [number, number][] = [
        [a, root],
        [a + step * 0.15, tip],
        [a + step * 0.45, tip],
        [a + step * 0.6, root],
      ]
      points.forEach(([pa, pr], j) => {
        const px = Math.cos(pa) * pr
        const py = Math.sin(pa) * pr
        if (i === 0 && j === 0) shape.moveTo(px, py)
        else shape.lineTo(px, py)
      })
    }
    shape.closePath()
    const g = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 1 })
    g.translate(0, 0, -thickness / 2)
    return g
  }, [radius, teeth, thickness])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

/** A spur gear: the toothed wheel and an iron hub. */
function Gear({
  radius,
  teeth,
  thickness = 0.02,
  colour = '#b8bcc0',
}: {
  radius: number
  teeth: number
  thickness?: number
  colour?: string
}) {
  const geometry = useGearGeometry(radius, teeth, thickness)
  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={colour} metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.15, radius * 0.15, thickness + 0.02, 16]} />
        <meshStandardMaterial {...IRON} />
      </mesh>
    </group>
  )
}

/** The gear bench: a board of meshing gears turning, a hand crank, and a vice. */
function GearStation() {
  const [x, z] = WORKSHOP.gearBench
  useInteractable({
    position: useMemo(() => new Vector3(x, 1.2, z), [x, z]),
    radius: 2.1,
    prompt: 'Press E to build a gear train',
    onInteract: () => openOverlay(GEARS_OVERLAY),
  })
  // A 12-tooth pinion drives a 36, whose shaft carries a 16 driving a 32: a 6 : 1 compound train.
  const gears = useRef<(Group | null)[]>([])
  const train = [
    { r: 0.06, t: 12, x: -0.2, y: 0.45, speed: 1, colour: '#c9a24e' },
    { r: 0.18, t: 36, x: 0.04, y: 0.45, speed: -1 / 3, colour: '#b8bcc0' },
    { r: 0.08, t: 16, x: 0.04, y: 0.45, speed: -1 / 3, colour: '#c9a24e', front: true },
    { r: 0.16, t: 32, x: 0.28, y: 0.45, speed: 1 / 6, colour: '#b8bcc0' },
  ]
  useFrame((_, delta) => {
    train.forEach((g, i) => {
      const group = gears.current[i]
      if (group) group.rotation.z += delta * 1.2 * g.speed
    })
  })
  return (
    <Workbench at={WORKSHOP.gearBench}>
      {/* The gear board, standing at the back of the bench. */}
      <group position={[0.2, 0, -BENCH.depth / 2 + 0.08]}>
        <mesh position={[0, 0.45, -0.02]}>
          <boxGeometry args={[1.2, 0.8, 0.03]} />
          <meshStandardMaterial color="#3a3430" roughness={0.8} />
        </mesh>
        {train.map((g, i) => (
          <group key={i} position={[g.x, g.y, g.front ? 0.04 : 0.015]}>
            <group ref={(el) => void (gears.current[i] = el)} rotation={[0, 0, i === 1 ? Math.PI / 36 : 0]}>
              <Gear radius={g.r} teeth={g.t} colour={g.colour} />
            </group>
          </group>
        ))}
        {/* The crank on the pinion. */}
        <mesh position={[-0.2, 0.45, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.05, 8]} />
          <meshStandardMaterial {...IRON} />
        </mesh>
      </group>
      {/* An engineer's vice bolted to the corner. */}
      <group position={[-0.9, 0, 0.3]}>
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[0.2, 0.16, 0.18]} />
          <meshStandardMaterial color="#3a5a8a" metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.17, 0.06]}>
          <boxGeometry args={[0.18, 0.05, 0.03]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
        <mesh position={[0, 0.08, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.2, 8]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
        <mesh position={[0, 0.08, 0.28]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.008, 0.008, 0.22, 8]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
      </group>
      {/* Loose gears and a tin of oil. */}
      {[
        [0.75, 0.25, 0.05, 20],
        [0.9, 0.1, 0.035, 12],
      ].map(([gx, gz, r, t]) => (
        <group key={gx} position={[gx, 0.012, gz]} rotation={[-Math.PI / 2, 0, 0]}>
          <Gear radius={r} teeth={t} thickness={0.015} />
        </group>
      ))}
      <mesh position={[0.5, 0.06, 0.3]}>
        <cylinderGeometry args={[0.04, 0.04, 0.12, 16]} />
        <meshStandardMaterial color="#c43a2a" metalness={0.4} roughness={0.4} />
      </mesh>
    </Workbench>
  )
}

/** The circuit bench: a board with a battery box, switches and three bulbs that glow. */
function CircuitStation() {
  const [x, z] = WORKSHOP.circuitBench
  useInteractable({
    position: useMemo(() => new Vector3(x, 1.2, z), [x, z]),
    radius: 2.1,
    prompt: 'Press E to wire up a circuit',
    onInteract: () => openOverlay(CIRCUIT_OVERLAY),
  })
  return (
    <Workbench at={WORKSHOP.circuitBench}>
      <group position={[0, 0.015, -0.05]}>
        <mesh>
          <boxGeometry args={[1.1, 0.03, 0.55]} />
          <meshStandardMaterial color="#d8c8a8" roughness={0.8} />
        </mesh>
        {/* Battery box with two cells. */}
        <mesh position={[-0.4, 0.04, 0]}>
          <boxGeometry args={[0.16, 0.05, 0.12]} />
          <meshStandardMaterial color="#1c1c1c" roughness={0.6} />
        </mesh>
        {[-0.025, 0.025].map((cz) => (
          <mesh key={cz} position={[-0.4, 0.07, cz]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.014, 0.014, 0.1, 12]} />
            <meshStandardMaterial color={cz < 0 ? '#c8a040' : '#2a2a2a'} metalness={0.4} roughness={0.4} />
          </mesh>
        ))}
        {/* Three bulbs in holders, wired in a row. */}
        {[-0.1, 0.12, 0.34].map((bx, i) => (
          <group key={bx} position={[bx, 0.03, -0.08]}>
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.025, 0.03, 0.04, 16]} />
              <meshStandardMaterial color="#e8e0d0" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.065, 0]}>
              <sphereGeometry args={[0.022, 16, 12]} />
              <meshStandardMaterial
                color="#fff4d8"
                emissive="#ffd890"
                emissiveIntensity={1.2 - i * 0.35}
                transparent
                opacity={0.9}
              />
            </mesh>
          </group>
        ))}
        {/* Wires. */}
        {[
          [-0.25, -0.08, 0.3],
          [0.01, -0.08, 0.18],
          [0.23, -0.08, 0.18],
          [0.0, 0.1, 0.9],
        ].map(([wx, wz, len], i) => (
          <mesh key={i} position={[wx, 0.025, wz]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.004, 0.004, len, 6]} />
            <meshStandardMaterial color={i === 3 ? '#2a2a2a' : '#c43a2a'} roughness={0.6} />
          </mesh>
        ))}
        {/* A multimeter. */}
        <group position={[0.4, 0.02, 0.17]} rotation={[0, -0.3, 0]}>
          <mesh>
            <boxGeometry args={[0.1, 0.03, 0.16]} />
            <meshStandardMaterial color="#e0a020" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.016, -0.03]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.07, 0.05]} />
            <meshStandardMaterial color="#a8b8a0" emissive="#506048" emissiveIntensity={0.3} />
          </mesh>
        </group>
      </group>
      {/* A soldering iron in its stand. */}
      <group position={[-0.85, 0, 0.2]}>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.06, 0.07, 0.03, 16]} />
          <meshStandardMaterial {...IRON} />
        </mesh>
        <mesh position={[0.05, 0.1, 0]} rotation={[0, 0, -0.7]}>
          <cylinderGeometry args={[0.012, 0.008, 0.2, 10]} />
          <meshStandardMaterial color="#2a5a8a" roughness={0.5} />
        </mesh>
      </group>
    </Workbench>
  )
}

/** A steel-framed factory window with small panes, the rooftops beyond. Its face points along +x. */
function FactoryWindow({ z }: { z: number }) {
  const view = useCanvas(512, 384, drawRooftops)
  const width = 2.4
  const height = 1.8
  const sill = 1.2
  const bars = []
  for (let i = 1; i < 6; i++) bars.push({ x: -width / 2 + (i * width) / 6, vertical: true })
  for (let i = 1; i < 4; i++) bars.push({ y: -height / 2 + (i * height) / 4, vertical: false })
  return (
    <group position={[-W / 2 + 0.01, sill + height / 2, z]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={view} color="#f0f0f0" toneMapped={false} />
      </mesh>
      {bars.map((b, i) =>
        b.vertical ? (
          <mesh key={i} position={[b.x!, 0, 0.02]}>
            <boxGeometry args={[0.025, height, 0.02]} />
            <meshStandardMaterial color="#2a2c2e" metalness={0.4} roughness={0.5} />
          </mesh>
        ) : (
          <mesh key={i} position={[0, b.y!, 0.02]}>
            <boxGeometry args={[width, 0.025, 0.02]} />
            <meshStandardMaterial color="#2a2c2e" metalness={0.4} roughness={0.5} />
          </mesh>
        ),
      )}
      {[
        [0, height / 2 + 0.03, width + 0.1, 0.06],
        [0, -height / 2 - 0.03, width + 0.1, 0.06],
        [-width / 2 - 0.03, 0, 0.06, height],
        [width / 2 + 0.03, 0, 0.06, height],
      ].map(([fx, fy, fw, fh], i) => (
        <mesh key={i} position={[fx, fy, 0.03]}>
          <boxGeometry args={[fw, fh, 0.05]} />
          <meshStandardMaterial color="#2a2c2e" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, -height / 2 - 0.07, 0.1]}>
        <boxGeometry args={[width + 0.2, 0.05, 0.22]} />
        <meshStandardMaterial color="#8a6a48" roughness={0.7} />
      </mesh>
    </group>
  )
}

function Pegboard() {
  const art = useCanvas(640, 320, drawPegboard)
  return (
    <group position={[0, 1.95, -L / 2 + 0.02]}>
      <mesh>
        <planeGeometry args={[2, 1]} />
        <meshStandardMaterial map={art} roughness={0.85} />
      </mesh>
    </group>
  )
}

/** A pillar drill on its own stand. */
function PillarDrill() {
  const [x, z] = WORKSHOP.drill
  return (
    <group position={[x, 0, z]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.4, 0.06, 0.5]} />
        <meshStandardMaterial {...IRON} />
      </mesh>
      <mesh position={[0, 0.85, -0.15]}>
        <cylinderGeometry args={[0.04, 0.04, 1.7, 12]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh position={[0, 0.75, 0.02]}>
        <boxGeometry args={[0.3, 0.04, 0.3]} />
        <meshStandardMaterial {...IRON} />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <boxGeometry args={[0.24, 0.3, 0.42]} />
        <meshStandardMaterial color={ENGINEER_GREEN} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.33, 0.08]}>
        <cylinderGeometry args={[0.03, 0.02, 0.14, 12]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      {[0, 2.1, 4.2].map((a) => (
        <mesh key={a} position={[0.14, 1.5, 0.08]} rotation={[a, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.008, 0.008, 0.2, 6]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
      ))}
    </group>
  )
}

/** A tailor's dummy on a turned stand, with a tape measure over its shoulders. */
function TailorsDummy() {
  const [x, z] = WORKSHOP.dummy
  return (
    <group position={[x, 0, z]} rotation={[0, 0.6, 0]}>
      {[0, 2.1, 4.2].map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.15, 0.03, Math.sin(a) * 0.15]} rotation={[0, -a, 0]}>
          <boxGeometry args={[0.32, 0.03, 0.04]} />
          <meshStandardMaterial color="#5a3a24" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.02, 0.025, 1.1, 10]} />
        <meshStandardMaterial color="#5a3a24" roughness={0.5} />
      </mesh>
      {/* The torso: chest, waist and hips as stacked, slightly flattened shapes. */}
      <mesh position={[0, 1.28, 0]} scale={[1, 1, 0.72]}>
        <cylinderGeometry args={[0.2, 0.15, 0.36, 24]} />
        <meshStandardMaterial color="#d8c8a8" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.02, 0]} scale={[1, 1, 0.72]}>
        <cylinderGeometry args={[0.15, 0.19, 0.2, 24]} />
        <meshStandardMaterial color="#d8c8a8" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.48, 0]} scale={[1, 0.5, 0.72]}>
        <sphereGeometry args={[0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#d8c8a8" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.045, 0.05, 0.1, 12]} />
        <meshStandardMaterial color="#d8c8a8" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.66, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.02, 16]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      {/* A yellow tape measure hanging over both shoulders. */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.12, 1.35, 0.13]} rotation={[0.15, 0, s * 0.08]}>
          <boxGeometry args={[0.02, 0.34, 0.003]} />
          <meshStandardMaterial color="#e8c840" roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

/** A red steel tool chest on castors, its drawers half shut. */
function ToolChest() {
  const [x, z] = WORKSHOP.chest
  return (
    <group position={[x, 0, z]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.8, 0.95, 0.5]} />
        <meshStandardMaterial color="#a8281e" metalness={0.35} roughness={0.4} />
      </mesh>
      {[0.25, 0.42, 0.59, 0.76, 0.93].map((y, i) => (
        <group key={y} position={[0, y, 0.251 + (i === 2 ? 0.06 : 0)]}>
          <mesh>
            <boxGeometry args={[0.74, 0.14, 0.01]} />
            <meshStandardMaterial color="#b83228" metalness={0.35} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.03, 0.01]}>
            <boxGeometry args={[0.5, 0.015, 0.015]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.33, 0.04, sz * 0.18]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.04, 0.04, 0.03, 12]} />
            <meshStandardMaterial {...IRON} />
          </mesh>
        )),
      )}
    </group>
  )
}

/** A green enamel factory shade over each bench. */
function FactoryLamp({ x, z, light }: { x: number; z: number; light?: boolean }) {
  return (
    <group position={[x, H, z]}>
      <mesh position={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 1.2, 6]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0, -1.25, 0]}>
        <coneGeometry args={[0.26, 0.16, 28, 1, true]} />
        <meshStandardMaterial color={ENGINEER_GREEN} roughness={0.35} metalness={0.2} side={2} />
      </mesh>
      <mesh position={[0, -1.3, 0]}>
        <sphereGeometry args={[0.05, 16, 10]} />
        <meshStandardMaterial color="#fff4dc" emissive="#ffdca0" emissiveIntensity={2.2} />
      </mesh>
      {light && <pointLight position={[0, -1.45, 0]} color="#ffe6c4" intensity={7} distance={8} decay={1.5} />}
    </group>
  )
}

/** Timber ceiling joists, running across the room. */
function Joists() {
  const wood = useSurfaceTexture('wood', W, 0.2, 90, 200)
  return (
    <>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[0, H - 0.1, -L / 2 + 0.6 + i * 1.2]}>
          <boxGeometry args={[W, 0.2, 0.1]} />
          <meshStandardMaterial color="#9a7a58" map={wood} roughness={0.8} />
        </mesh>
      ))}
    </>
  )
}

/** The Workshop: two benches with exact, hands-on mechanics and electrics, in a brick room off the laboratory. */
export default function Workshop() {
  return (
    <group>
      <Atmosphere background="#d8e2ea" />
      <hemisphereLight args={['#fff6ea', '#7a6450', 1.1]} />
      {/* Daylight through the west window. */}
      <directionalLight position={[-W / 2 - 3, 4, -1]} color="#fff6e8" intensity={1.1} />
      <RoomShell
        width={W}
        length={L}
        height={H}
        floor={{ color: '#a89070', texture: 'wood' }}
        walls={{ color: '#ffffff', texture: 'brick' }}
        ceiling={{ color: '#efe8da', texture: 'plaster' }}
      />
      <Joists />
      <GearStation />
      <CircuitStation />
      <Pegboard />
      <FactoryWindow z={-0.8} />
      <PillarDrill />
      <TailorsDummy />
      <ToolChest />
      {[WORKSHOP.gearBench, WORKSHOP.circuitBench].flatMap(([bx, bz]) =>
        [-0.6, 0.6].map((dx) => <Stool key={`${bx}${dx}`} position={[bx + dx, 0, bz + BENCH.depth / 2 + 0.45]} />),
      )}
      <WallClock position={[W / 2 - 0.04, 2.6, -2]} rotationY={-Math.PI / 2} />
      <FactoryLamp x={WORKSHOP.gearBench[0]} z={WORKSHOP.gearBench[1]} light />
      <FactoryLamp x={WORKSHOP.circuitBench[0]} z={WORKSHOP.circuitBench[1]} light />
      <FactoryLamp x={0} z={2} light />
    </group>
  )
}
