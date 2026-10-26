import { useEffect, useMemo } from 'react'
import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector3,
  VideoTexture,
  type Texture,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { Glow } from '../components/Glow.tsx'
import { getVideo, seekBy, stopFilm, togglePlay, useCinema } from '../features/cinema/cinema.ts'
import { CINEMA_OVERLAY } from '../features/cinema/CinemaPanel.tsx'
import { useTiledTexture } from '../hooks/useTiledTexture.ts'
import { Atmosphere } from './Atmosphere.tsx'
import {
  RECLINER_SCALE,
  THEATRE,
  THEATRE_AISLE,
  THEATRE_LANDING_HEIGHT,
  THEATRE_LECTERN,
  THEATRE_SEAT_XS,
  THEATRE_TABLE_XS,
  THEATRE_TIERS,
} from './dimensions.ts'
import { RoomShell } from './RoomShell.tsx'
import { useInteractable } from '../world/InteractionSystem.tsx'
import { openOverlay } from '../world/overlay.ts'
import { gameStore } from '../world/store.ts'

// Soft rectangular lights need this once before use.
RectAreaLightUniformsLib.init()

const HALF_W = THEATRE.width / 2
const HALF_L = THEATRE.length / 2
const SCREEN = { width: 8.5, height: 4, y: 3.1 }
const FRAME = 0.2
const LEATHER = '#4a0e14'
const WARM = '#ffb070'
const PANEL = { width: 1.6, height: 1.9 }

/**
 * Geometry and materials shared by every recliner and wall panel, built once
 * when the theatre loads and released when it unloads. Rounded boxes are
 * fairly heavy, so sharing them keeps the room light to draw.
 */
function useTheatreParts() {
  const leatherMap = useTiledTexture('leather', 2, 2)
  const fabricMap = useTiledTexture('fabric', 3, 3)
  const parts = useMemo(() => {
    const rounded = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 3, r)
    return {
      base: rounded(0.92, 0.22, 0.9, 0.04),
      cushion: rounded(0.6, 0.2, 0.72, 0.08),
      back: rounded(0.62, 0.86, 0.2, 0.09),
      headrest: rounded(0.42, 0.2, 0.1, 0.05),
      arm: rounded(0.17, 0.42, 0.86, 0.07),
      footrest: rounded(0.58, 0.08, 0.4, 0.035),
      panel: rounded(PANEL.width, PANEL.height, 0.07, 0.03),
      // Leather with a soft sheen rather than a plastic shine.
      leather: new MeshStandardMaterial({
        color: LEATHER,
        map: leatherMap,
        bumpMap: leatherMap,
        bumpScale: 0.6,
        roughness: 0.45,
      }),
      plinth: new MeshStandardMaterial({ color: '#1a1012', roughness: 0.6 }),
      fabric: new MeshStandardMaterial({ color: '#6a1e2a', map: fabricMap, roughness: 1 }),
    }
  }, [leatherMap, fabricMap])
  useEffect(
    () => () => {
      for (const part of Object.values(parts)) part.dispose()
    },
    [parts],
  )
  return parts
}

type TheatreParts = ReturnType<typeof useTheatreParts>

/** A premium recliner facing the screen (local -z). `reclined` raises the footrest. */
function Recliner({ x, y, z, reclined, parts }: { x: number; y: number; z: number; reclined?: boolean; parts: TheatreParts }) {
  const back = reclined ? 0.42 : 0.24
  const { leather } = parts
  return (
    <group position={[x, y, z]} scale={RECLINER_SCALE}>
      <mesh geometry={parts.base} material={parts.plinth} position={[0, 0.11, 0.05]} />
      <mesh geometry={parts.cushion} material={leather} position={[0, 0.34, -0.02]} />
      <group position={[0, 0.32, 0.36]} rotation={[back, 0, 0]}>
        <mesh geometry={parts.back} material={leather} position={[0, 0.43, 0]} />
        <mesh geometry={parts.headrest} material={leather} position={[0, 0.74, -0.12]} />
      </group>
      {[-0.4, 0.4].map((ax) => (
        <mesh key={ax} geometry={parts.arm} material={leather} position={[ax, 0.43, 0.03]} />
      ))}
      <group position={[0, 0.3, -0.38]} rotation={[reclined ? -1.25 : 0, 0, 0]}>
        <mesh geometry={parts.footrest} material={leather} position={[0, reclined ? 0 : -0.05, reclined ? -0.2 : 0.02]} />
      </group>
    </group>
  )
}

function usePopcornTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 32
    const ctx = canvas.getContext('2d')!
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#f4efe6' : '#b3202a'
      ctx.fillRect(i * 16, 0, 16, 32)
    }
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    return tex
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

/** Small round side table between recliners, with a drink and a carton of popcorn. */
function SideTable({ x, y, z, popcorn }: { x: number; y: number; z: number; popcorn: Texture }) {
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.06, 0.1, 0.68, 12]} />
        <meshStandardMaterial color="#1a1012" />
      </mesh>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.04, 28]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.35} />
      </mesh>
      <mesh position={[-0.08, 0.81, 0.04]} castShadow>
        <cylinderGeometry args={[0.07, 0.05, 0.18, 16, 1, true]} />
        <meshStandardMaterial map={popcorn} side={2} />
      </mesh>
      <mesh position={[-0.08, 0.9, 0.04]}>
        <sphereGeometry args={[0.068, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#f0d9a0" roughness={1} />
      </mesh>
      <mesh position={[0.1, 0.79, -0.05]} castShadow>
        <cylinderGeometry args={[0.04, 0.035, 0.14, 14]} />
        {/* Plain transparency: transmission would re-render the whole room every frame for one small glass. */}
        <meshStandardMaterial color="#d8e4ea" transparent opacity={0.45} roughness={0.05} />
      </mesh>
    </group>
  )
}

interface Block {
  x: [number, number]
  z: [number, number]
  height: number
}

/** The stepped floor: one block per tier each side of the aisle, aisle steps, and the entrance landing. */
function floorBlocks(): Block[] {
  const blocks: Block[] = []
  const landing = THEATRE_TIERS[THEATRE_TIERS.length - 1]
  for (let i = 0; i < THEATRE_TIERS.length - 1; i++) {
    const tier = THEATRE_TIERS[i]
    const nextZ = THEATRE_TIERS[i + 1].fromZ
    for (const side of [-1, 1]) {
      const inner = THEATRE_AISLE.halfWidth * side
      const outer = (HALF_W - 0.01) * side
      blocks.push({ x: side < 0 ? [outer, inner] : [inner, outer], z: [tier.fromZ, nextZ], height: tier.height })
    }
  }
  const first = THEATRE_TIERS[0].fromZ
  const steps = Math.round(landing.height / THEATRE_AISLE.stepHeight)
  for (let i = 1; i <= steps; i++) {
    const from = first + (i - 1) * THEATRE_AISLE.stepDepth
    blocks.push({
      x: [-THEATRE_AISLE.halfWidth, THEATRE_AISLE.halfWidth],
      z: [from, Math.min(landing.fromZ, from + THEATRE_AISLE.stepDepth)],
      height: i * THEATRE_AISLE.stepHeight,
    })
  }
  blocks.push({ x: [-HALF_W + 0.01, HALF_W - 0.01], z: [landing.fromZ, HALF_L - 0.01], height: landing.height })
  return blocks
}

/** Carpeted tiers, each with a thin warm light along the front edge of every step. */
function SteppedFloor() {
  const carpet = useTiledTexture('carpet', 2, 2)
  const blocks = useMemo(floorBlocks, [])
  return (
    <>
      {blocks.map(({ x, z, height }, i) => {
        const w = x[1] - x[0]
        const d = z[1] - z[0]
        return (
          <group key={i}>
            <mesh position={[(x[0] + x[1]) / 2, height / 2, (z[0] + z[1]) / 2]} receiveShadow>
              <boxGeometry args={[w, height, d]} />
              <meshStandardMaterial color="#c8a8a8" map={carpet} roughness={1} />
            </mesh>
            <mesh position={[(x[0] + x[1]) / 2, height - 0.03, z[0] - 0.002]}>
              <planeGeometry args={[w - 0.1, 0.02]} />
              <meshBasicMaterial color="#ffc88a" toneMapped={false} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

/** Brass rail along the front of the entrance landing, either side of the aisle. */
function LandingRail() {
  const z = THEATRE_TIERS[THEATRE_TIERS.length - 1].fromZ + 0.08
  const y = THEATRE_LANDING_HEIGHT
  return (
    <>
      {[-1, 1].map((side) => {
        const inner = (THEATRE_AISLE.halfWidth + 0.1) * side
        const outer = (HALF_W - 0.1) * side
        const mid = (inner + outer) / 2
        const len = Math.abs(outer - inner)
        return (
          <group key={side}>
            <mesh position={[mid, y + 0.9, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.03, 0.03, len, 12]} />
              <meshStandardMaterial color="#b08d57" metalness={0.85} roughness={0.25} />
            </mesh>
            {Array.from({ length: 6 }, (_, i) => (
              <mesh key={i} position={[inner + ((outer - inner) * i) / 5, y + 0.45, z]}>
                <cylinderGeometry args={[0.02, 0.02, 0.9, 8]} />
                <meshStandardMaterial color="#b08d57" metalness={0.85} roughness={0.25} />
              </mesh>
            ))}
          </group>
        )
      })}
    </>
  )
}

/** Placeholder "now showing" card until the video player arrives (Phase 3). */
function usePosterTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1400
    canvas.height = 660
    const ctx = canvas.getContext('2d')!
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height)
    sky.addColorStop(0, '#0b1030')
    sky.addColorStop(1, '#3a2a55')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + ((i * 37) % 70) / 100})`
      ctx.fillRect((i * 523) % canvas.width, (i * 211) % (canvas.height * 0.7), 2, 2)
    }
    const planet = ctx.createRadialGradient(1060, 220, 10, 1080, 240, 150)
    planet.addColorStop(0, '#f6c88a')
    planet.addColorStop(1, '#8a4a2a')
    ctx.fillStyle = planet
    ctx.beginPath()
    ctx.arc(1080, 240, 140, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#f4ead8'
    ctx.textAlign = 'center'
    ctx.font = 'italic 40px Georgia, serif'
    ctx.fillText('Now showing', 560, 260)
    ctx.font = '84px Georgia, serif'
    ctx.fillText('The Curiosity Atlas', 560, 360)
    ctx.font = '32px Georgia, serif'
    ctx.fillStyle = '#c9b99c'
    ctx.fillText('Films and documentaries arrive in a later version', 560, 430)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    return tex
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

/** The picture on the screen: the poster, or the film's frames while one is showing. */
function useScreenPicture() {
  const poster = usePosterTexture()
  const showing = useCinema((s) => s.nowShowing !== null && s.error === null)
  const frames = useMemo(() => {
    if (!showing) return null
    const texture = new VideoTexture(getVideo())
    texture.colorSpace = SRGBColorSpace
    return texture
  }, [showing])
  useEffect(() => () => frames?.dispose(), [frames])
  return frames ?? poster
}

function Screen() {
  const picture = useScreenPicture()
  const z = -HALF_L + 0.15
  useInteractable({
    position: useMemo(() => new Vector3(0, SCREEN.y, z), [z]),
    radius: 7,
    prompt: 'Press E to choose a film',
    onInteract: () => openOverlay(CINEMA_OVERLAY),
  })
  return (
    <group position={[0, SCREEN.y, z]}>
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[SCREEN.width + FRAME * 2, SCREEN.height + FRAME * 2, 0.08]} />
        <meshStandardMaterial color="#141010" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[SCREEN.width + 0.06, SCREEN.height + 0.06]} />
        <meshStandardMaterial color="#b08d57" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.012]}>
        <planeGeometry args={[SCREEN.width, SCREEN.height]} />
        <meshBasicMaterial map={picture} toneMapped={false} />
      </mesh>
      {/* Light spilling off the screen into the room. */}
      <rectAreaLight
        position={[0, 0, 0.3]}
        rotation={[0, Math.PI, 0]}
        width={SCREEN.width}
        height={SCREEN.height}
        intensity={1.6}
        color="#9a9ad8"
      />
    </group>
  )
}

/**
 * A lectern on the entrance landing with a glowing tablet: the film menu.
 * Pressing E here (or at the screen) opens it.
 */
function FilmLectern() {
  const [x, z] = THEATRE_LECTERN
  const y = THEATRE_LANDING_HEIGHT
  useInteractable({
    position: useMemo(() => new Vector3(x, y + 1, z), [x, y, z]),
    radius: 1.8,
    prompt: 'Press E to choose a film',
    onInteract: () => openOverlay(CINEMA_OVERLAY),
  })
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.06, 0.12, 1, 16]} />
        <meshStandardMaterial color="#b08d57" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.25, 0.28, 0.04, 24]} />
        <meshStandardMaterial color="#1a1012" roughness={0.6} />
      </mesh>
      <group position={[0, 1.04, 0]} rotation={[-0.5, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.5, 0.36, 0.04]} />
          <meshStandardMaterial color="#1a1012" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.021]}>
          <planeGeometry args={[0.44, 0.3]} />
          <meshStandardMaterial color="#1c1830" emissive="#b89868" emissiveIntensity={0.18} />
        </mesh>
      </group>
    </group>
  )
}

/** P pauses, comma and full stop skip, while you're in the theatre. */
function useCinemaKeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!gameStore.get().isExploring) return
      if (e.code === 'KeyP') togglePlay()
      if (e.code === 'Comma') seekBy(-10)
      if (e.code === 'Period') seekBy(10)
    }
    window.addEventListener('keydown', onKeyDown)
    // Leaving the theatre ends the film.
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      stopFilm()
    }
  }, [])
}

/** Plinth under the screen with a soft uplight along its edge. */
function ScreenPlinth() {
  return (
    <group position={[0, 0, -HALF_L + 0.3]}>
      <mesh position={[0, 0.3, 0]} receiveShadow>
        <boxGeometry args={[9.2, 0.6, 0.6]} />
        <meshStandardMaterial color="#1c1416" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.58, 0.301]}>
        <planeGeometry args={[9, 0.02]} />
        <meshBasicMaterial color="#ffc88a" toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Heavy curtains either side of the screen, as a row of pleats. */
function Curtains() {
  const fabric = useTiledTexture('fabric', 1, 4)
  const z = -HALF_L + 0.4
  const pleats = 7
  return (
    <>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (SCREEN.width / 2 + 0.9), 0, z]}>
          {Array.from({ length: pleats }, (_, i) => (
            <mesh key={i} position={[(i - (pleats - 1) / 2) * 0.17, THEATRE.height / 2, (i % 2) * 0.06]} castShadow>
              <cylinderGeometry args={[0.1, 0.12, THEATRE.height, 10]} />
              <meshStandardMaterial color="#6a1219" map={fabric} roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}

/** Dropped soffit round the ceiling edge, hiding a warm LED cove that washes the ceiling with light. */
const COVE = { width: 0.8, depth: 0.32 }
function CeilingCove({ dim }: { dim: number }) {
  const y = THEATRE.height - COVE.depth / 2
  const sides: {
    pos: [number, number, number]
    size: [number, number, number]
    glow: [number, number, number]
    glowSize: [number, number]
    strip: [number, number, number]
    stripSize: [number, number]
  }[] = [-1, 1].flatMap((s) => [
    {
      pos: [s * (HALF_W - COVE.width / 2), y, 0],
      size: [COVE.width, COVE.depth, THEATRE.length],
      glow: [s * (HALF_W - COVE.width - 0.7), THEATRE.height - 0.01, 0],
      glowSize: [1.6, THEATRE.length - 2 * COVE.width],
      strip: [s * (HALF_W - COVE.width), THEATRE.height - COVE.depth + 0.015, 0],
      stripSize: [0.05, THEATRE.length - 2 * COVE.width],
    },
    {
      pos: [0, y, s * (HALF_L - COVE.width / 2)],
      size: [THEATRE.width, COVE.depth, COVE.width],
      glow: [0, THEATRE.height - 0.01, s * (HALF_L - COVE.width - 0.7)],
      glowSize: [THEATRE.width - 2 * COVE.width, 1.6],
      strip: [0, THEATRE.height - COVE.depth + 0.015, s * (HALF_L - COVE.width)],
      stripSize: [THEATRE.width - 2 * COVE.width, 0.05],
    },
  ])
  return (
    <>
      {sides.map((c) => (
        <group key={c.pos.join()}>
          <mesh position={c.pos}>
            <boxGeometry args={c.size} />
            <meshStandardMaterial color="#2a1a14" roughness={0.6} />
          </mesh>
          {/* The hidden LED strip, then its light spreading across the ceiling. */}
          <mesh position={c.strip} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={c.stripSize} />
            <meshBasicMaterial color="#ffc890" toneMapped={false} />
          </mesh>
          <Glow position={c.glow} rotation={[Math.PI / 2, 0, 0]} size={c.glowSize} color={WARM} opacity={0.4 * dim} />
        </group>
      ))}
    </>
  )
}

/** Upholstered acoustic panel on a side wall, framed in a thin brass trim. */
function AcousticPanel({ side, z, parts }: { side: -1 | 1; z: number; parts: TheatreParts }) {
  const { width: w, height: h } = PANEL
  return (
    <group position={[side * (HALF_W - 0.04), 2.9, z]} rotation={[0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
      <mesh geometry={parts.panel} material={parts.fabric} />
      {[
        [0, h / 2 + 0.01, w + 0.04, 0.02],
        [0, -h / 2 - 0.01, w + 0.04, 0.02],
        [w / 2 + 0.01, 0, 0.02, h],
        [-w / 2 - 0.01, 0, 0.02, h],
      ].map(([px, py, sw, sh]) => (
        <mesh key={`${px}${py}`} position={[px, py, 0.02]}>
          <boxGeometry args={[sw, sh, 0.04]} />
          <meshStandardMaterial color="#c9a55c" metalness={0.5} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

/** Fibre-optic star ceiling: tiny points of light. */
function StarCeiling() {
  const geometry = useMemo(() => {
    const points: number[] = []
    let seed = 7
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < 420; i++) {
      points.push(
        (rand() - 0.5) * (THEATRE.width - 2 * COVE.width - 0.4),
        THEATRE.height - 0.02,
        (rand() - 0.5) * (THEATRE.length - 2 * COVE.width - 0.4),
      )
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(points, 3))
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <points geometry={geometry}>
      <pointsMaterial color="#fff2d8" size={0.035} sizeAttenuation toneMapped={false} />
    </points>
  )
}

const GOLD = { color: '#c9a55c', metalness: 0.7, roughness: 0.3 }

/**
 * A gilded proscenium round the screen and curtains: fluted pilasters either
 * side, a deep swagged valance across the top with a gold fringe, and a
 * moulded gold arch.
 */
function Proscenium() {
  const fabric = useTiledTexture('fabric', 6, 1)
  const z = -HALF_L + 0.55
  const span = SCREEN.width + 2.5
  const top = THEATRE.height - 0.35
  const swags = 7
  return (
    <group position={[0, 0, z]}>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (span / 2 + 0.2), 0, 0]}>
          <mesh position={[0, top / 2, 0]} castShadow>
            <boxGeometry args={[0.42, top, 0.3]} />
            <meshStandardMaterial color="#2a1a14" roughness={0.5} />
          </mesh>
          {[-0.12, -0.04, 0.04, 0.12].map((fx) => (
            <mesh key={fx} position={[fx, top / 2, 0.16]}>
              <cylinderGeometry args={[0.022, 0.022, top - 0.6, 8]} />
              <meshStandardMaterial {...GOLD} />
            </mesh>
          ))}
          <mesh position={[0, 0.2, 0.02]}>
            <boxGeometry args={[0.5, 0.4, 0.36]} />
            <meshStandardMaterial {...GOLD} />
          </mesh>
          <mesh position={[0, top - 0.25, 0.02]}>
            <boxGeometry args={[0.52, 0.3, 0.36]} />
            <meshStandardMaterial {...GOLD} />
          </mesh>
        </group>
      ))}
      {/* Valance: a deep pelmet of swags, each a curve of fabric, over a gold fringe. */}
      <mesh position={[0, top - 0.35, 0.1]}>
        <boxGeometry args={[span + 0.4, 0.7, 0.1]} />
        <meshStandardMaterial color="#5a0e16" map={fabric} roughness={1} />
      </mesh>
      {Array.from({ length: swags }, (_, i) => {
        const x = (i - (swags - 1) / 2) * ((span + 0.2) / swags)
        return (
          <group key={i} position={[x, top - 0.7, 0.16]}>
            <mesh rotation={[0, 0, Math.PI]} scale={[1, 0.45, 0.5]}>
              <torusGeometry args={[(span + 0.2) / swags / 2, 0.09, 8, 20, Math.PI]} />
              <meshStandardMaterial color="#6a1219" map={fabric} roughness={1} />
            </mesh>
            {/* Tassel where two swags meet. */}
            <mesh position={[(span + 0.2) / swags / 2, -0.1, 0]}>
              <coneGeometry args={[0.05, 0.22, 10]} />
              <meshStandardMaterial {...GOLD} />
            </mesh>
          </group>
        )
      })}
      <mesh position={[0, top - 0.72, 0.17]}>
        <boxGeometry args={[span + 0.4, 0.05, 0.04]} />
        <meshStandardMaterial {...GOLD} />
      </mesh>
      <mesh position={[0, top + 0.05, 0.12]}>
        <boxGeometry args={[span + 1.0, 0.16, 0.3]} />
        <meshStandardMaterial {...GOLD} />
      </mesh>
    </group>
  )
}

/** An art deco wall light: a gold fan-shaped shell throwing a wash of light up the wall. */
function DecoSconce({ side, z, dim }: { side: -1 | 1; z: number; dim: number }) {
  const x = side * (HALF_W - 0.04)
  const facing = side < 0 ? Math.PI / 2 : -Math.PI / 2
  return (
    <group position={[x, 3.2, z]} rotation={[0, facing, 0]}>
      <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.06, 24, 1, false, Math.PI / 2, Math.PI]} />
        <meshStandardMaterial {...GOLD} />
      </mesh>
      {[-0.5, -0.25, 0, 0.25, 0.5].map((a) => (
        <mesh key={a} position={[Math.sin(a) * 0.12, Math.cos(a) * 0.12, 0.075]} rotation={[0, 0, -a]}>
          <boxGeometry args={[0.012, 0.16, 0.01]} />
          <meshStandardMaterial color="#6a4a1c" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 0.02, 0.06]}>
        <boxGeometry args={[0.3, 0.025, 0.05]} />
        <meshStandardMaterial color="#ffe0b8" emissive="#ffc690" emissiveIntensity={1.2 * dim} />
      </mesh>
      <mesh position={[0, -0.12, 0.03]}>
        <coneGeometry args={[0.05, 0.14, 12]} />
        <meshStandardMaterial {...GOLD} />
      </mesh>
      <Glow position={[0, 0.85, 0.01]} size={[1.4, 2]} color={WARM} opacity={0.42 * dim} />
    </group>
  )
}

const POSTERS = [
  { title: 'COSMOS', line: 'A journey to the edge of everything', colours: ['#0a0f2e', '#3b2a6a'], accent: '#f2c46a' },
  { title: 'THE DEEP', line: 'Life where the light never reaches', colours: ['#03222e', '#0b5a6a'], accent: '#7fe0d0' },
  { title: 'ROME', line: 'The rise of the eternal city', colours: ['#3a0e08', '#a2502a'], accent: '#f6d9a0' },
  { title: 'GENIUS', line: 'Minds that changed the world', colours: ['#1a1a1a', '#4a3a20'], accent: '#e0a458' },
]

/** An art deco film poster: a sunburst over a gradient, the title in tall capitals and a "coming soon" band. */
function usePoster(index: number) {
  const texture = useMemo(() => {
    const p = POSTERS[index % POSTERS.length]
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 768
    const ctx = canvas.getContext('2d')!
    const bg = ctx.createLinearGradient(0, 0, 0, 768)
    bg.addColorStop(0, p.colours[0])
    bg.addColorStop(1, p.colours[1])
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, 512, 768)
    ctx.strokeStyle = p.accent
    ctx.globalAlpha = 0.35
    for (let i = 0; i < 24; i++) {
      const a = Math.PI + (i / 23) * Math.PI
      ctx.beginPath()
      ctx.moveTo(256, 470)
      ctx.lineTo(256 + Math.cos(a) * 520, 470 + Math.sin(a) * 520)
      ctx.lineWidth = i % 2 ? 2 : 6
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.arc(256, 470, 90, Math.PI, 0)
    ctx.fillStyle = p.accent
    ctx.fill()
    ctx.lineWidth = 4
    ctx.strokeRect(22, 22, 468, 724)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#fff6e4'
    ctx.font = 'bold 86px Georgia, serif'
    ctx.fillText(p.title, 256, 170)
    ctx.font = 'italic 26px Georgia, serif'
    ctx.fillText(p.line, 256, 222)
    ctx.fillStyle = p.accent
    ctx.fillRect(22, 610, 468, 64)
    ctx.fillStyle = p.colours[0]
    ctx.font = 'bold 30px Georgia, serif'
    ctx.fillText('COMING  SOON', 256, 653)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }, [index])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

/** A lit poster case on the wall: a gold frame round a softly backlit poster. */
function PosterCase({ side, z, index, dim }: { side: -1 | 1; z: number; index: number; dim: number }) {
  const poster = usePoster(index)
  const w = 1.1
  const h = 1.65
  return (
    <group position={[side * (HALF_W - 0.05), 2.65, z]} rotation={[0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
      <mesh position={[0, 0, 0.03]}>
        <boxGeometry args={[w + 0.16, h + 0.16, 0.06]} />
        <meshStandardMaterial {...GOLD} />
      </mesh>
      <mesh position={[0, 0, 0.062]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={poster} emissiveMap={poster} emissive="#ffffff" emissiveIntensity={0.55 * (0.4 + 0.6 * dim)} />
      </mesh>
      <Glow position={[0, 0, 0.01]} size={[w * 1.9, h * 1.5]} color={WARM} opacity={0.2 * dim} />
    </group>
  )
}

/**
 * The projection booth's port in the back wall, high above the door. While a
 * film plays, a faint beam reaches from it to the screen.
 */
function ProjectionBooth({ playing }: { playing: boolean }) {
  const port = new Vector3(0, THEATRE.height - 0.9, HALF_L - 0.02)
  const screen = new Vector3(0, SCREEN.y, -HALF_L + 0.2)
  const length = port.distanceTo(screen)
  const pitch = Math.atan2(port.y - screen.y, port.z - screen.z)
  return (
    <>
      <group position={port}>
        <mesh>
          <boxGeometry args={[0.7, 0.42, 0.06]} />
          <meshStandardMaterial {...GOLD} />
        </mesh>
        <mesh position={[0, 0, -0.035]}>
          <planeGeometry args={[0.56, 0.3]} />
          <meshStandardMaterial
            color="#1a1420"
            emissive="#c8d0ff"
            emissiveIntensity={playing ? 1.4 : 0.15}
            roughness={0.1}
            side={2}
          />
        </mesh>
      </group>
      {playing && (
        // A long cone, narrow at the port and as wide as the picture at the screen, drawn faintly and additively.
        <mesh position={port.clone().lerp(screen, 0.5)} rotation={[Math.PI / 2 - pitch, 0, 0]}>
          <cylinderGeometry args={[0.12, SCREEN.height * 0.55, length, 32, 1, true]} />
          <meshBasicMaterial
            color="#b8c4ff"
            transparent
            opacity={0.045}
            depthWrite={false}
            blending={2}
            side={2}
            toneMapped={false}
          />
        </mesh>
      )}
    </>
  )
}

/** Home cinema: tiered floor rising to the entrance, leather recliners, soft wall lamps and a star ceiling. */
export default function Theatre() {
  const popcorn = usePopcornTexture()
  const parts = useTheatreParts()
  const rows = THEATRE_TIERS.filter((t) => t.rowZ !== undefined)
  // House lights go down while a film plays.
  const playing = useCinema((s) => s.playing)
  const dim = playing ? 0.12 : 1
  useCinemaKeys()
  return (
    <group>
      <Atmosphere background="#0a0709" fog={[18, 40]} />
      <hemisphereLight args={['#ffd9b8', '#2a1a20', 1.1 * dim]} />
      <ambientLight intensity={0.3 * dim} color="#ffcfa0" />
      {/* Cove lighting along both side walls: wide, soft and warm. */}
      {[-1, 1].map((side) => (
        <rectAreaLight
          key={side}
          position={[side * (HALF_W - 0.6), THEATRE.height - 0.3, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          width={0.6}
          height={THEATRE.length - 1}
          intensity={2.2 * dim}
          color="#ffb880"
        />
      ))}
      <RoomShell
        {...THEATRE}
        floor={{ color: '#ffffff', texture: 'carpet' }}
        walls={{ color: '#ffffff', texture: 'panel' }}
        ceiling={{ color: '#3a2430', texture: 'fabric' }}
      />
      <CeilingCove dim={dim} />
      <StarCeiling />
      <SteppedFloor />
      <LandingRail />
      <ScreenPlinth />
      <Screen />
      <FilmLectern />
      <Curtains />
      <Proscenium />
      <ProjectionBooth playing={playing} />

      {rows.map((tier, r) =>
        THEATRE_SEAT_XS.map((x, i) => (
          <Recliner
            key={`${r}-${x}`}
            x={x}
            y={tier.height}
            z={tier.rowZ!}
            reclined={(r === 0 && i === 1) || (r === 1 && i === 2)}
            parts={parts}
          />
        )),
      )}
      {rows.map((tier, r) =>
        THEATRE_TABLE_XS.map((x) => (
          <SideTable key={`${r}-${x}`} x={x} y={tier.height} z={tier.rowZ! + 0.15} popcorn={popcorn} />
        )),
      )}

      {[-4.5, 0, 4.5].flatMap((z) =>
        [-1, 1].map((side) => <DecoSconce key={`${side}-${z}`} side={side as -1 | 1} z={z} dim={dim} />),
      )}
      {[-2.25, 2.25].flatMap((z) =>
        [-1, 1].map((side) => <AcousticPanel key={`${side}-${z}`} side={side as -1 | 1} z={z} parts={parts} />),
      )}
      {/* Coming-soon posters in lit cases, front and back of each side wall. */}
      {[-6.6, 6.6].flatMap((z, i) =>
        [-1, 1].map((side, j) => <PosterCase key={`${side}-${z}`} side={side as -1 | 1} z={z} index={i * 2 + j} dim={dim} />),
      )}
    </group>
  )
}
