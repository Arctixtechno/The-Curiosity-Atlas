import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  Object3D,
  ShaderMaterial,
  SRGBColorSpace,
  type InstancedMesh,
  type PointLight,
} from 'three'
import { Mouldings } from '../components/Mouldings.tsx'
import { Painting } from '../components/Painting.tsx'
import { LoungeInteraction } from '../features/philosophy/LoungeInteraction.tsx'
import { LoungeSeat } from '../features/philosophy/Seat.tsx'
import { useLathe } from '../hooks/useLathe.ts'
import { useSurfaceTexture, useTiledTexture } from '../hooks/useTiledTexture.ts'
import { Atmosphere } from './Atmosphere.tsx'
import { LOUNGE, loungeChair } from './dimensions.ts'
import { Letters, OvalPortrait, PocketWatch } from './LoungeKeepsakes.tsx'
import { RoomShell } from './RoomShell.tsx'
import { useMotion } from '../world/FrameScheduler.tsx'

// The Philosophy Lounge: a Georgian study for conversation by the fire. Dark
// oak herringbone underfoot, green damask above oak panelling, two wingback
// chairs angled in towards the fire, built-in bookcases and a rainy London
// evening through the window.

const { width: W, length: L, height: H } = LOUNGE
const OAK = '#5a3a22'
const DARK_OAK = '#3a2414'
const BRASS = { color: '#c9a25a', metalness: 0.8, roughness: 0.3 }
const LEATHER = '#6e2a1c'
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

const LEG: [number, number][] = [
  [0.001, 0],
  [0.022, 0],
  [0.028, 0.03],
  [0.02, 0.06],
  [0.03, 0.1],
  [0.034, 0.13],
  [0.001, 0.13],
]

/** A leather wingback armchair: buttoned back, wings, rolled arms, a loose seat cushion and turned legs. */
function WingbackChair({ x, z, rotationY }: { x: number; z: number; rotationY: number }) {
  const leather = useTiledTexture('leather', 2, 2)
  const leg = useLathe(LEG, 12)
  const material = <meshStandardMaterial color={LEATHER} map={leather} bumpMap={leather} bumpScale={0.6} roughness={0.5} />
  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} geometry={leg} position={[sx * 0.34, 0, sz * 0.32]}>
            <meshStandardMaterial color={DARK_OAK} roughness={0.45} />
          </mesh>
        )),
      )}
      {/* The base and the loose seat cushion. */}
      <RoundedBox args={[0.84, 0.28, 0.8]} radius={0.04} smoothness={3} position={[0, 0.27, 0]} castShadow>
        {material}
      </RoundedBox>
      <RoundedBox args={[0.6, 0.13, 0.64]} radius={0.05} smoothness={3} position={[0, 0.47, 0.06]} castShadow>
        {material}
      </RoundedBox>
      {/* The back, leaning back a little, with a cushion against it. */}
      <RoundedBox
        args={[0.84, 0.82, 0.16]}
        radius={0.06}
        smoothness={3}
        position={[0, 0.84, -0.34]}
        rotation={[-0.1, 0, 0]}
        castShadow
      >
        {material}
      </RoundedBox>
      <RoundedBox args={[0.58, 0.5, 0.1]} radius={0.05} smoothness={3} position={[0, 0.78, -0.24]} rotation={[-0.12, 0, 0]}>
        {material}
      </RoundedBox>
      {/* Buttons across the back. */}
      {[0.66, 0.84, 1.02].flatMap((by, row) =>
        [-0.24, -0.08, 0.08, 0.24].map((bx) => (
          <mesh key={`${by}${bx}`} position={[bx + (row % 2) * 0.08 - 0.04, by + 0.1, -0.24 - (by - 0.66) * 0.1]}>
            <sphereGeometry args={[0.012, 6, 4]} />
            <meshStandardMaterial color="#3a140c" roughness={0.6} />
          </mesh>
        )),
      )}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          {/* The wing, curving forward at head height. */}
          <RoundedBox
            args={[0.12, 0.46, 0.36]}
            radius={0.05}
            smoothness={3}
            position={[sx * 0.38, 0.98, -0.2]}
            rotation={[0, sx * 0.25, 0]}
            castShadow
          >
            {material}
          </RoundedBox>
          {/* The arm, with a rolled top. */}
          <RoundedBox args={[0.12, 0.22, 0.72]} radius={0.04} smoothness={3} position={[sx * 0.37, 0.5, 0.02]}>
            {material}
          </RoundedBox>
          <mesh position={[sx * 0.39, 0.62, 0.04]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.075, 0.7, 16]} />
            {material}
          </mesh>
          <mesh position={[sx * 0.39, 0.62, 0.39]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.068, 0.068, 0.012, 16]} />
            <meshStandardMaterial color="#4a1a10" roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Animated flames: noise rising through a teardrop shape, added onto what's behind. */
function flameMaterial(seed: number) {
  return new ShaderMaterial({
    uniforms: { time: { value: 0 }, seed: { value: seed } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform float seed;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        vec2 p = vUv;
        float t = time * 1.6 + seed * 10.0;
        // Noise scrolling upwards, stretched so it reads as tongues of flame.
        float n = noise(vec2(p.x * 5.0 + seed, p.y * 3.0 - t)) * 0.6 + noise(vec2(p.x * 11.0 - seed, p.y * 7.0 - t * 1.7)) * 0.4;
        float width = 0.42 * (1.0 - p.y) * (1.0 - p.y * 0.4);
        float shape = smoothstep(width, width * 0.25, abs(p.x - 0.5 + (n - 0.5) * 0.25 * p.y));
        float body = shape * smoothstep(1.0, 0.15, p.y + n * 0.45) * smoothstep(0.0, 0.08, p.y);
        vec3 colour = mix(vec3(1.0, 0.25, 0.03), vec3(1.0, 0.75, 0.3), smoothstep(0.2, 0.9, body));
        colour = mix(colour, vec3(1.0, 0.95, 0.75), smoothstep(0.85, 1.0, body) * (1.0 - p.y));
        gl_FragColor = vec4(colour * body * 1.3, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  })
}

/**
 * What the mirror shows, painted: the dim room behind you, with the lamps'
 * glow and the window's cool light, and the old glass's slight tint and
 * foxing. A real reflection would mean drawing the whole room twice.
 */
function useMirrorTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    const base = ctx.createLinearGradient(0, 0, 0, 256)
    base.addColorStop(0, '#3a3026')
    base.addColorStop(0.55, '#2a2018')
    base.addColorStop(1, '#1a120c')
    ctx.fillStyle = base
    ctx.fillRect(0, 0, 256, 256)
    // The far wall's lamps and the door between them.
    for (const [x, y, r, colour] of [
      [60, 120, 70, 'rgba(255, 200, 130, 0.35)'],
      [196, 120, 70, 'rgba(255, 200, 130, 0.35)'],
      [128, 150, 50, 'rgba(255, 160, 90, 0.18)'],
    ] as const) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, colour)
      g.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 256, 256)
    }
    ctx.fillStyle = 'rgba(20, 12, 8, 0.6)'
    ctx.fillRect(108, 130, 40, 90)
    // The cornice line, and a sheen across the old glass.
    ctx.fillStyle = 'rgba(240, 225, 200, 0.18)'
    ctx.fillRect(0, 40, 256, 6)
    const sheen = ctx.createLinearGradient(0, 0, 256, 256)
    sheen.addColorStop(0.3, 'rgba(255, 255, 255, 0)')
    sheen.addColorStop(0.45, 'rgba(255, 255, 255, 0.07)')
    sheen.addColorStop(0.6, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = sheen
    ctx.fillRect(0, 0, 256, 256)
    const edge = ctx.createRadialGradient(128, 128, 90, 128, 128, 190)
    edge.addColorStop(0, 'rgba(0, 0, 0, 0)')
    edge.addColorStop(1, 'rgba(30, 20, 5, 0.55)')
    ctx.fillStyle = edge
    ctx.fillRect(0, 0, 256, 256)
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    return t
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

/** A brass wall sconce with two candle bulbs under small pleated shades. */
function Sconce({ x, z, rotationY }: { x: number; z: number; rotationY: number }) {
  return (
    <group position={[x, 1.85, z]} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[0.08, 0.16, 0.03]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.13, 0.08, 0.12]}>
          <mesh position={[-s * 0.065, -0.06, -0.05]} rotation={[0.6, 0, s * 1.1]}>
            <cylinderGeometry args={[0.008, 0.008, 0.2, 6]} />
            <meshStandardMaterial {...BRASS} />
          </mesh>
          <mesh position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.045, 0.07, 0.09, 16, 1, true]} />
            <meshStandardMaterial color="#f2dcae" emissive="#ffc070" emissiveIntensity={0.9} side={DoubleSide} />
          </mesh>
        </group>
      ))}
      <pointLight position={[0, 0.1, 0.25]} color="#ffcf8a" intensity={1.4} distance={4.5} decay={1.6} />
    </group>
  )
}

/** A marble fireplace with a log fire, an iron grate, brass fender and a gilt mirror over the mantel. */
function Fireplace() {
  const marble = useTiledTexture('marble', 1.5, 1)
  const fire = useRef<PointLight>(null)
  const flames = useMemo(() => [0, 1, 2, 3].map(flameMaterial), [])
  useEffect(() => () => flames.forEach((f) => f.dispose()), [flames])
  useMotion()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (fire.current) fire.current.intensity = 6 + Math.sin(t * 7.3) * 0.7 + Math.sin(t * 13.1) * 0.5 + Math.sin(t * 2.1) * 0.4
    for (const f of flames) f.uniforms.time.value = t
  })
  const reflection = useMirrorTexture()
  const z = -L / 2
  const marbleMaterial = <meshStandardMaterial color="#efeae2" map={marble} roughness={0.35} />
  return (
    <group position={[0, 0, z]}>
      {/* The firebox: a sooty recess in the wall. */}
      <mesh position={[0, 0.48, 0.12]}>
        <boxGeometry args={[0.9, 0.86, 0.02]} />
        <meshStandardMaterial color="#120c08" roughness={1} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.45, 0.48, 0.22]} rotation={[0, (s * Math.PI) / 2, 0]}>
          <planeGeometry args={[0.22, 0.86]} />
          <meshStandardMaterial color="#1c140e" roughness={1} side={DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, 0.9, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 0.22]} />
        <meshStandardMaterial color="#0e0906" roughness={1} side={DoubleSide} />
      </mesh>
      {/* Marble surround: pilasters, frieze and a moulded shelf. */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.62, 0.56, 0.3]} castShadow receiveShadow>
          <boxGeometry args={[0.32, 1.12, 0.2]} />
          {marbleMaterial}
        </mesh>
      ))}
      <mesh position={[0, 1.04, 0.3]} castShadow>
        <boxGeometry args={[1.56, 0.2, 0.2]} />
        {marbleMaterial}
      </mesh>
      <mesh position={[0, 1.16, 0.33]} castShadow>
        <boxGeometry args={[1.82, 0.05, 0.3]} />
        {marbleMaterial}
      </mesh>
      <mesh position={[0, 1.2, 0.34]} castShadow>
        <boxGeometry args={[1.9, 0.04, 0.33]} />
        {marbleMaterial}
      </mesh>
      {/* Black slate hearth. */}
      <mesh position={[0, 0.02, 0.6]} receiveShadow>
        <boxGeometry args={[2.1, 0.04, 0.6]} />
        <meshStandardMaterial color="#1c1e22" roughness={0.4} />
      </mesh>
      {/* Iron grate with logs. */}
      <group position={[0, 0.06, 0.32]}>
        {[-0.2, -0.1, 0, 0.1, 0.2].map((gx) => (
          <mesh key={gx} position={[gx, 0.1, 0.12]}>
            <boxGeometry args={[0.018, 0.22, 0.018]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[0.6, 0.03, 0.3]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.5} />
        </mesh>
        {[
          [0, 0.1, 0, 0.3, 0.06],
          [-0.06, 0.16, -0.04, -0.4, 0.05],
          [0.07, 0.17, 0.02, 0.5, 0.045],
        ].map(([lx, ly, lz, ry, r], i) => (
          <mesh key={i} position={[lx, ly, lz]} rotation={[0, ry, Math.PI / 2]}>
            <cylinderGeometry args={[r, r * 1.1, 0.5, 10]} />
            <meshStandardMaterial color="#3a2618" roughness={0.95} emissive="#ff4a10" emissiveIntensity={0.18} />
          </mesh>
        ))}
        {/* Glowing embers under the logs. */}
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.55, 0.26]} />
          <meshBasicMaterial color="#ff5a14" toneMapped={false} />
        </mesh>
        {/* Flames: crossed planes so they look full from any angle. */}
        {flames.map((material, i) => (
          <mesh
            key={i}
            material={material}
            position={[(i - 1.5) * 0.09, 0.32, 0.02]}
            rotation={[0, (i % 2 ? 1 : -1) * 0.6 + i * 0.3, 0]}
            renderOrder={3}
          >
            <planeGeometry args={[0.32, 0.5]} />
          </mesh>
        ))}
      </group>
      {/* Brass fender along the hearth. */}
      <mesh position={[0, 0.07, 0.86]}>
        <boxGeometry args={[1.5, 0.06, 0.02]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.75, 0.07, 0.62]}>
          <boxGeometry args={[0.02, 0.06, 0.5]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
      ))}
      {/* On the mantel: a carriage clock and a pair of candlesticks. */}
      <group position={[0, 1.22, 0.32]}>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.14, 0.2, 0.09]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
        <mesh position={[0, 0.11, 0.046]}>
          <circleGeometry args={[0.045, 24]} />
          <meshStandardMaterial color="#f4ecd8" roughness={0.6} />
        </mesh>
        {[-0.6, 0.6].map((cx) => (
          <group key={cx} position={[cx, 0, 0]}>
            <mesh position={[0, 0.12, 0]}>
              <cylinderGeometry args={[0.015, 0.045, 0.24, 12]} />
              <meshStandardMaterial {...BRASS} />
            </mesh>
            <mesh position={[0, 0.3, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.12, 8]} />
              <meshStandardMaterial color="#f4ecd8" emissive="#ffd9a0" emissiveIntensity={0.15} />
            </mesh>
          </group>
        ))}
      </group>
      <Letters position={[0.36, 1.22, 0.3]} rotationY={0.25} />
      {/* Gilt mirror above the mantel, catching the room. */}
      <mesh position={[0, 2.15, 0.04]}>
        <boxGeometry args={[1.2, 1.25, 0.06]} />
        <meshStandardMaterial color="#b08d57" metalness={0.75} roughness={0.3} />
      </mesh>
      <mesh position={[0, 2.15, 0.075]}>
        <planeGeometry args={[1.02, 1.07]} />
        <meshBasicMaterial map={reflection} toneMapped={false} />
      </mesh>
      <pointLight ref={fire} position={[0, 0.5, 0.9]} color="#ff9040" intensity={6} distance={6.5} decay={1.6} />
    </group>
  )
}

/** Painted spines: gilt bands near the top and bottom, the rest left for the book's colour. */
function useSpineTexture() {
  const texture = useMemo(() => {
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
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    return tex
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

/** A built-in oak bookcase: every book is one instance of a single mesh, so a full case is one draw. */
function Bookcase({ side }: { side: -1 | 1 }) {
  const wood = useTiledTexture('wood', 1, 2)
  const spines = useSpineTexture()
  const books = useRef<InstancedMesh>(null)
  const length = LOUNGE.bookcaseLength
  const shelves = [0.42, 0.88, 1.34, 1.8, 2.26]
  const layout = useMemo(() => {
    let seed = side > 0 ? 7 : 3
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const out: { x: number; y: number; w: number; h: number; d: number; lean: number; flat: boolean; colour: string }[] = []
    shelves.forEach((y) => {
      let x = -length / 2 + 0.06
      while (x < length / 2 - 0.1) {
        // Now and then a gap, a stack lying flat, or a book leaning on its neighbour.
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
  }, [side, length])

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

  const x = side * (W / 2 - 0.02)
  return (
    <group position={[x, 0, LOUNGE.bookcaseZ]} rotation={[0, (-side * Math.PI) / 2, 0]}>
      {/* Back, sides, a plinth and a cornice. */}
      <mesh position={[0, 1.22, 0.01]} receiveShadow>
        <boxGeometry args={[length, 2.44, 0.02]} />
        <meshStandardMaterial color={DARK_OAK} map={wood} roughness={0.7} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * length) / 2, 1.22, 0.17]} castShadow>
          <boxGeometry args={[0.05, 2.44, 0.34]} />
          <meshStandardMaterial color={OAK} map={wood} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 0.17, 0.18]}>
        <boxGeometry args={[length + 0.06, 0.34, 0.36]} />
        <meshStandardMaterial color={OAK} map={wood} roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.5, 0.2]}>
        <boxGeometry args={[length + 0.14, 0.12, 0.42]} />
        <meshStandardMaterial color={OAK} map={wood} roughness={0.6} />
      </mesh>
      {shelves.map((y) => (
        <mesh key={y} position={[0, y, 0.17]} receiveShadow>
          <boxGeometry args={[length, 0.03, 0.32]} />
          <meshStandardMaterial color={OAK} map={wood} roughness={0.6} />
        </mesh>
      ))}
      <instancedMesh ref={books} args={[undefined, undefined, layout.length]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial map={spines} roughness={0.8} />
      </instancedMesh>
      {/* A few objects among the books: a small brass globe, a bust and a pair of bookends. */}
      <group position={[length / 2 - 0.35, 1.36, 0.17]}>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.05, 0.06, 0.06, 16]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <sphereGeometry args={[0.1, 16, 12]} />
          <meshStandardMaterial color="#5a7a8a" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.16, 0]} rotation={[0, 0, 0.4]}>
          <torusGeometry args={[0.115, 0.006, 6, 32]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
      </group>
      <group position={[-length / 2 + 0.4, 1.82, 0.17]}>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.12, 0.12, 0.12]} />
          <meshStandardMaterial color="#e8e2d6" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.07, 16, 12]} />
          <meshStandardMaterial color="#e8e2d6" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.045, 0.08, 0.1, 16]} />
          <meshStandardMaterial color="#e8e2d6" roughness={0.4} />
        </mesh>
      </group>
    </group>
  )
}

/** A round wine table between the chairs, with a banker's lamp, a decanter and two glasses, and a book left open. */
function SideTable() {
  const wood = useTiledTexture('wood', 1, 1)
  const decanter = useLathe([
    [0.001, 0],
    [0.05, 0.002],
    [0.07, 0.05],
    [0.072, 0.1],
    [0.055, 0.15],
    [0.02, 0.19],
    [0.018, 0.24],
    [0.026, 0.25],
    [0.001, 0.25],
  ])
  const glass = useLathe([
    [0.001, 0],
    [0.032, 0.002],
    [0.034, 0.075],
    [0.03, 0.075],
    [0.028, 0.006],
    [0.001, 0.006],
  ])
  const glassMaterial = (
    <meshStandardMaterial color="#f0e8e0" transparent opacity={0.28} roughness={0.05} metalness={0.1} depthWrite={false} />
  )
  const top = 0.56
  return (
    <group position={[0, 0, LOUNGE.seatingZ - 0.5]}>
      <mesh position={[0, top, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.035, 32]} />
        <meshStandardMaterial color={OAK} map={wood} roughness={0.35} />
      </mesh>
      <mesh position={[0, top / 2, 0]}>
        <cylinderGeometry args={[0.03, 0.05, top, 12]} />
        <meshStandardMaterial color={DARK_OAK} roughness={0.5} />
      </mesh>
      {[0, 2.1, 4.2].map((a) => (
        <mesh key={a} position={[Math.sin(a) * 0.14, 0.05, Math.cos(a) * 0.14]} rotation={[0, a, 0.9]}>
          <boxGeometry args={[0.03, 0.3, 0.03]} />
          <meshStandardMaterial color={DARK_OAK} roughness={0.5} />
        </mesh>
      ))}
      <group position={[0, top + 0.018, 0]}>
        {/* Banker's lamp with a green glass shade. */}
        <group position={[0.02, 0, -0.17]}>
          <mesh position={[0, 0.012, 0]}>
            <boxGeometry args={[0.18, 0.024, 0.1]} />
            <meshStandardMaterial {...BRASS} />
          </mesh>
          <mesh position={[0, 0.17, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.3, 8]} />
            <meshStandardMaterial {...BRASS} />
          </mesh>
          <mesh position={[0, 0.31, 0.03]} rotation={[0.25, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.06, 0.06, 0.26, 20, 1, true, 0, Math.PI]} />
            <meshStandardMaterial color="#1f6a46" emissive="#2a8a5a" emissiveIntensity={0.35} roughness={0.2} side={DoubleSide} />
          </mesh>
          <pointLight position={[0, 0.26, 0.06]} color="#ffd59a" intensity={1.6} distance={3} decay={1.8} />
        </group>
        <mesh geometry={decanter} position={[-0.13, 0, 0.06]}>
          {glassMaterial}
        </mesh>
        <mesh position={[-0.13, 0.05, 0.06]}>
          <cylinderGeometry args={[0.064, 0.066, 0.09, 20]} />
          <meshStandardMaterial color="#7a3a12" transparent opacity={0.75} roughness={0.1} />
        </mesh>
        {[
          [0.12, 0.1],
          [0.2, -0.02],
        ].map(([gx, gz]) => (
          <mesh key={gx} geometry={glass} position={[gx, 0, gz]}>
            {glassMaterial}
          </mesh>
        ))}
        <PocketWatch position={[0.18, 0, 0.17]} rotationY={-0.6} />
        {/* An open book, face down. */}
        <mesh position={[-0.02, 0.012, 0.18]} rotation={[0, 0.4, 0]}>
          <boxGeometry args={[0.24, 0.024, 0.16]} />
          <meshStandardMaterial color="#2f4a3a" roughness={0.8} />
        </mesh>
      </group>
    </group>
  )
}

/** A brass floor lamp with a pleated silk shade. */
function FloorLamp({ x, z }: { x: number; z: number }) {
  const base = useLathe([
    [0.001, 0],
    [0.16, 0],
    [0.15, 0.025],
    [0.06, 0.05],
    [0.025, 0.09],
    [0.012, 0.12],
    [0.001, 0.12],
  ])
  const shade = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 32
    const ctx = canvas.getContext('2d')!
    for (let i = 0; i < 256; i += 8) {
      ctx.fillStyle = '#f5e2bc'
      ctx.fillRect(i, 0, 4, 32)
      ctx.fillStyle = '#e2c898'
      ctx.fillRect(i + 4, 0, 4, 32)
    }
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    return t
  }, [])
  useEffect(() => () => shade.dispose(), [shade])
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={base}>
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.013, 0.013, 1.4, 8]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <cylinderGeometry args={[0.15, 0.24, 0.3, 32, 1, true]} />
        <meshStandardMaterial map={shade} emissive="#ffc070" emissiveMap={shade} emissiveIntensity={0.7} side={DoubleSide} />
      </mesh>
      <pointLight position={[0, 1.45, 0]} color="#ffcf8a" intensity={2.2} distance={6} />
    </group>
  )
}

/** A rainy London evening: wet slate roofs and glowing windows across the street, under a deep blue sky. */
function drawEvening(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#141c2c')
  sky.addColorStop(0.6, '#2a3446')
  sky.addColorStop(1, '#3a3c44')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  let seed = 5
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  // The terrace across the street, with lit windows.
  ctx.fillStyle = '#1a1c22'
  ctx.fillRect(0, h * 0.42, w, h)
  for (let x = 0; x < w; x += w / 5) {
    ctx.fillStyle = '#20222a'
    ctx.beginPath()
    ctx.moveTo(x, h * 0.42)
    ctx.lineTo(x + w / 10, h * 0.36)
    ctx.lineTo(x + w / 5, h * 0.42)
    ctx.fill()
    ctx.fillRect(x + w * 0.13, h * 0.3, w * 0.03, h * 0.08)
  }
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      const lit = rand() > 0.45
      ctx.fillStyle = lit ? `rgba(255, ${190 + Math.floor(rand() * 40)}, 120, 0.85)` : '#2a2c34'
      ctx.fillRect(col * (w / 6) + w * 0.04, h * (0.48 + row * 0.16), w * 0.07, h * 0.1)
    }
  }
  // A street lamp's halo in the rain.
  const g = ctx.createRadialGradient(w * 0.7, h * 0.62, 0, w * 0.7, h * 0.62, w * 0.25)
  g.addColorStop(0, 'rgba(255, 210, 140, 0.55)')
  g.addColorStop(1, 'rgba(255, 210, 140, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

/** Rain running down the glass, drawn over the view. */
function rainMaterial() {
  return new ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      varying vec2 vUv;
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        vec2 p = vUv * vec2(28.0, 1.0);
        float column = floor(p.x);
        float speed = 0.05 + hash(column) * 0.12;
        float y = fract(vUv.y + time * speed + hash(column * 3.1));
        float x = fract(p.x) - 0.5 + sin(vUv.y * 20.0 + column) * 0.08;
        // A bead of water with a thin trail above it.
        float bead = smoothstep(0.12, 0.0, length(vec2(x * 1.4, (y - 0.5) * 18.0)));
        float trail = smoothstep(0.05, 0.0, abs(x)) * smoothstep(0.5, 0.95, y) * 0.25;
        float a = (bead + trail) * step(0.45, hash(column * 7.7));
        gl_FragColor = vec4(vec3(0.8, 0.85, 0.95), a * 0.35);
      }
    `,
    transparent: true,
    depthWrite: false,
  })
}

/** A tall sash window on the west wall, with heavy velvet curtains and a rainy evening outside. */
function Window() {
  const view = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 1024
    drawEvening(canvas.getContext('2d')!, 512, 1024)
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    return t
  }, [])
  const rain = useMemo(rainMaterial, [])
  useEffect(
    () => () => {
      view.dispose()
      rain.dispose()
    },
    [view, rain],
  )
  useFrame(({ clock }) => (rain.uniforms.time.value = clock.elapsedTime))
  useMotion()
  const velvet = useTiledTexture('fabric', 2, 4)
  const width = 1.1
  const height = 2.1
  const sill = 0.75
  return (
    <group position={[-W / 2 + 0.01, 0, LOUNGE.windowZ]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, sill + height / 2, -0.005]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={view} toneMapped={false} />
      </mesh>
      <mesh position={[0, sill + height / 2, 0.01]} material={rain}>
        <planeGeometry args={[width, height]} />
      </mesh>
      {/* Glazing bars: two sashes of six panes. */}
      {[-width / 6, width / 6].map((bx) => (
        <mesh key={bx} position={[bx, sill + height / 2, 0.02]}>
          <boxGeometry args={[0.025, height, 0.03]} />
          <meshStandardMaterial color="#efe8dc" roughness={0.6} />
        </mesh>
      ))}
      {[0.25, 0.5, 0.75].map((t) => (
        <mesh key={t} position={[0, sill + height * t, 0.02]}>
          <boxGeometry args={[width, t === 0.5 ? 0.06 : 0.025, 0.04]} />
          <meshStandardMaterial color="#efe8dc" roughness={0.6} />
        </mesh>
      ))}
      {/* The frame and a deep sill. */}
      <mesh position={[0, sill - 0.03, 0.1]}>
        <boxGeometry args={[width + 0.2, 0.05, 0.22]} />
        <meshStandardMaterial color="#efe8dc" roughness={0.5} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (width + 0.08)) / 2, sill + height / 2, 0.03]}>
          <boxGeometry args={[0.08, height + 0.08, 0.06]} />
          <meshStandardMaterial color="#efe8dc" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, sill + height + 0.02, 0.03]}>
        <boxGeometry args={[width + 0.16, 0.08, 0.06]} />
        <meshStandardMaterial color="#efe8dc" roughness={0.6} />
      </mesh>
      {/* Curtains, gathered in folds, on a brass pole. */}
      <mesh position={[0, sill + height + 0.18, 0.14]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.018, 0.018, width + 0.9, 10]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (width / 2 + 0.22), 0, 0.12]}>
          {[0, 1, 2, 3].map((f) => (
            <mesh key={f} position={[(f - 1.5) * 0.08, (sill + height + 0.18) / 2, (f % 2) * 0.03]} castShadow>
              <cylinderGeometry args={[0.05, 0.065, sill + height + 0.16, 10]} />
              <meshStandardMaterial color="#5a1820" map={velvet} roughness={0.85} />
            </mesh>
          ))}
        </group>
      ))}
      {/* A cool spill of evening light from the window. */}
      <pointLight position={[0, sill + height / 2, 0.6]} color="#8aa0c8" intensity={0.6} distance={4} />
    </group>
  )
}

const PAWN: [number, number][] = [
  [0.001, 0],
  [0.016, 0],
  [0.016, 0.006],
  [0.009, 0.014],
  [0.006, 0.03],
  [0.01, 0.034],
  [0.004, 0.036],
  [0.009, 0.045],
  [0.001, 0.054],
]

/** A chess table by the east wall with a game left half-played. Each side's pieces are one instanced mesh. */
function ChessTable() {
  const board = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#3a2414'
    ctx.fillRect(0, 0, 256, 256)
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#2a1a0e' : '#d8bc8c'
        ctx.fillRect(16 + c * 28, 16 + r * 28, 28, 28)
      }
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    return t
  }, [])
  useEffect(() => () => board.dispose(), [board])
  const piece = useLathe(PAWN, 12)
  const white = useRef<InstancedMesh>(null)
  const black = useRef<InstancedMesh>(null)
  const square = 0.36 / 8
  const squares = {
    white: [
      [1, 0],
      [1, 1],
      [2, 2],
      [1, 5],
      [1, 6],
      [1, 7],
      [0, 4],
      [0, 6],
      [3, 4],
      [0, 0],
      [2, 5],
    ],
    black: [
      [6, 0],
      [6, 1],
      [5, 2],
      [6, 5],
      [6, 6],
      [4, 4],
      [7, 4],
      [7, 1],
      [5, 5],
      [7, 7],
    ],
  }
  useLayoutEffect(() => {
    const o = new Object3D()
    for (const [ref, list] of [
      [white, squares.white],
      [black, squares.black],
    ] as const) {
      list.forEach(([r, c], i) => {
        o.position.set((c - 3.5) * square, 0, (r - 3.5) * square)
        // Back-rank pieces stand a little taller than pawns.
        const tall = r === 0 || r === 7 ? 1.45 : 1
        o.scale.set(1, tall, 1)
        o.updateMatrix()
        ref.current!.setMatrixAt(i, o.matrix)
      })
      ref.current!.instanceMatrix.needsUpdate = true
    }
  })
  const top = 0.72
  return (
    <group position={[LOUNGE.chessTable[0], 0, LOUNGE.chessTable[1]]} rotation={[0, 0.3, 0]}>
      <mesh position={[0, top, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.04, 0.6]} />
        <meshStandardMaterial color={OAK} roughness={0.4} />
      </mesh>
      <mesh position={[0, top + 0.021, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.42, 0.42]} />
        <meshStandardMaterial map={board} roughness={0.35} />
      </mesh>
      <mesh position={[0, top / 2, 0]}>
        <cylinderGeometry args={[0.04, 0.06, top, 12]} />
        <meshStandardMaterial color={DARK_OAK} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.2, 0.24, 0.06, 20]} />
        <meshStandardMaterial color={DARK_OAK} roughness={0.5} />
      </mesh>
      <group position={[0, top + 0.022, 0]}>
        <instancedMesh ref={white} args={[piece, undefined, squares.white.length]} castShadow>
          <meshStandardMaterial color="#efe4cc" roughness={0.35} />
        </instancedMesh>
        <instancedMesh ref={black} args={[piece, undefined, squares.black.length]} castShadow>
          <meshStandardMaterial color="#1c1410" roughness={0.3} />
        </instancedMesh>
      </group>
      {/* Two small chairs pulled up to the board. */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0, 0, s * 0.55]} rotation={[0, s > 0 ? Math.PI : 0, 0]}>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[0.42, 0.05, 0.4]} />
            <meshStandardMaterial color={LEATHER} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.72, -0.18]}>
            <boxGeometry args={[0.4, 0.5, 0.04]} />
            <meshStandardMaterial color={OAK} roughness={0.5} />
          </mesh>
          {[-1, 1].flatMap((lx) =>
            [-1, 1].map((lz) => (
              <mesh key={`${lx}${lz}`} position={[lx * 0.18, 0.22, lz * 0.17]}>
                <boxGeometry args={[0.03, 0.44, 0.03]} />
                <meshStandardMaterial color={DARK_OAK} roughness={0.5} />
              </mesh>
            )),
          )}
        </group>
      ))}
    </group>
  )
}

/** A fern on a stand in the corner by the window. */
function Fern({ x, z }: { x: number; z: number }) {
  const fronds = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2 + (i % 2) * 0.2
        return { a, tilt: 0.7 + (i % 3) * 0.2, length: 0.42 + (i % 4) * 0.06 }
      }),
    [],
  )
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 0.7, 16]} />
        <meshStandardMaterial color={DARK_OAK} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.82, 0]}>
        <cylinderGeometry args={[0.17, 0.13, 0.24, 20]} />
        <meshStandardMaterial color="#c8b89a" roughness={0.4} />
      </mesh>
      {fronds.map((f, i) => (
        <group key={i} position={[0, 0.92, 0]} rotation={[0, f.a, f.tilt]}>
          <mesh position={[0, f.length / 2, 0]}>
            <planeGeometry args={[0.12, f.length]} />
            <meshStandardMaterial color={i % 2 ? '#3f6a32' : '#4e7a3a'} roughness={0.8} side={DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export default function PhilosophyLounge() {
  const rug = useSurfaceTexture('rug', 3.4, 2.5, 3, 300)
  const visitor = loungeChair(-1)
  const companion = loungeChair(1)
  return (
    <group>
      <Atmosphere background="#0c0806" />
      <hemisphereLight args={['#ffe2bf', '#2a1c12', 0.9]} />
      <RoomShell
        cornerShade={false}
        width={W}
        length={L}
        height={H}
        floor={{ color: '#7a5636', texture: 'herringbone' }}
        walls={{ color: '#4a6a56', texture: 'damask' }}
        ceiling={{ color: '#e8e2d8', texture: 'plaster' }}
      />
      <Mouldings
        width={W}
        length={L}
        height={H}
        trim="#3e2818"
        cornice="#efe4d0"
        dado={{ height: 1.05, colour: '#6a4428' }}
        openings={[{ side: 'south', centre: 0, width: 1.4 }]}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, LOUNGE.seatingZ + 0.4]} receiveShadow>
        <planeGeometry args={[3.4, 2.5]} />
        <meshStandardMaterial map={rug} roughness={1} />
      </mesh>
      <Fireplace />
      <WingbackChair {...visitor} />
      <WingbackChair {...companion} />
      <SideTable />
      <Bookcase side={-1} />
      <Bookcase side={1} />
      <Window />
      <Painting name="hills" position={[W / 2 - 0.01, 1.85, LOUNGE.windowZ]} rotationY={-Math.PI / 2} width={1} />
      <ChessTable />
      <OvalPortrait position={[-2.65, 1.85, L / 2 - 0.02]} rotationY={Math.PI} />
      <Fern x={-W / 2 + 0.45} z={-L / 2 + 0.5} />
      {[-1.3, 1.3].map((sx) => (
        <Sconce key={sx} x={sx} z={L / 2 - 0.01} rotationY={Math.PI} />
      ))}
      <FloorLamp x={-W / 2 + 0.55} z={LOUNGE.seatingZ + 1.5} />
      <FloorLamp x={W / 2 - 0.55} z={LOUNGE.seatingZ + 1.5} />
      <LoungeInteraction position={[visitor.x, 0, visitor.z]} />
      <LoungeSeat />
    </group>
  )
}
