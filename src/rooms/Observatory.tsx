import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  BackSide,
  CanvasTexture,
  type PerspectiveCamera,
  Color,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
  type Group,
  type InstancedMesh,
} from 'three'
import { Glow } from '../components/Glow.tsx'
import { Painting } from '../components/Painting.tsx'
import { getPainting } from '../components/paintings.ts'
import { findPlanet, position, type PlanetId } from '../features/solar/planets.ts'
import { SOLAR_OVERLAY } from '../features/solar/overlayId.ts'
import { useSurfaceTexture, useTiledTexture } from '../hooks/useTiledTexture.ts'
import { useInteractable } from '../world/InteractionSystem.tsx'
import { openOverlay } from '../world/overlay.ts'
import { gameStore, useGame } from '../world/store.ts'
import { Atmosphere } from './Atmosphere.tsx'
import { OBSERVATORY, observatoryWallPoint } from './dimensions.ts'
import { NightSky } from './NightSky.tsx'

const { radius: R, wallHeight: WALL_H } = OBSERVATORY
// Moderate metalness: with no environment map, fully metallic brass renders almost black.
const BRASS = { color: '#d4b064', metalness: 0.55, roughness: 0.28 }
const IRON = { color: '#23262c', metalness: 0.6, roughness: 0.45 }
/** The dome opens towards -z; the telescope points through the opening at the moon. */
const MOON: [number, number, number] = [0, 52, -44]
const TELESCOPE_ELEVATION = (50 * Math.PI) / 180

/** Paints a canvas once into a texture, disposed when the room unloads. */
function useCanvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
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

function seededRandom(seed: number) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** The inside of the dome, painted as a star chart: gilt stars, constellation lines and a faint grid. */
function drawDome(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const rand = seededRandom(17)
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#101838')
  bg.addColorStop(1, '#1f2c58')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  // Meridians and two circles of declination.
  ctx.strokeStyle = 'rgba(216, 178, 94, 0.18)'
  ctx.lineWidth = 2
  for (let i = 0; i < 24; i++) {
    ctx.beginPath()
    ctx.moveTo((i / 24) * w, 0)
    ctx.lineTo((i / 24) * w, h)
    ctx.stroke()
  }
  for (const y of [0.4, 0.75]) {
    ctx.beginPath()
    ctx.moveTo(0, y * h)
    ctx.lineTo(w, y * h)
    ctx.stroke()
  }
  // Background stars, thinner near the top where the texture is squeezed together at the pole.
  for (let i = 0; i < 2600; i++) {
    const y = Math.sqrt(rand()) * h
    const x = rand() * w
    ctx.fillStyle = rand() > 0.7 ? 'rgba(240, 210, 140, 0.9)' : 'rgba(230, 236, 255, 0.75)'
    ctx.beginPath()
    ctx.arc(x, y, 0.8 + rand() * 1.6, 0, Math.PI * 2)
    ctx.fill()
  }
  // Constellations: a few bright stars joined by gilt lines.
  for (let c = 0; c < 22; c++) {
    let x = rand() * w
    let y = h * (0.3 + rand() * 0.62)
    const points: [number, number][] = [[x, y]]
    for (let i = 0; i < 3 + Math.floor(rand() * 4); i++) {
      x += (rand() - 0.5) * 140
      y += (rand() - 0.5) * 90
      points.push([x, Math.max(h * 0.25, Math.min(h * 0.97, y))])
    }
    ctx.strokeStyle = 'rgba(216, 178, 94, 0.55)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
    ctx.stroke()
    for (const [px, py] of points) {
      const g = ctx.createRadialGradient(px, py, 0, px, py, 9)
      g.addColorStop(0, 'rgba(255, 236, 180, 1)')
      g.addColorStop(1, 'rgba(255, 220, 140, 0)')
      ctx.fillStyle = g
      ctx.fillRect(px - 9, py - 9, 18, 18)
    }
  }
}

/** A compass-rose rug under the telescope. */
function drawCompassRug(ctx: CanvasRenderingContext2D, w: number) {
  const c = w / 2
  ctx.fillStyle = '#1d2748'
  ctx.beginPath()
  ctx.arc(c, c, c, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#c9a55c'
  for (const [r, lw] of [
    [0.95, 6],
    [0.88, 2],
    [0.62, 2],
    [0.2, 3],
  ] as const) {
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.arc(c, c, c * r, 0, Math.PI * 2)
    ctx.stroke()
  }
  // Degree ticks between the outer rings.
  ctx.lineWidth = 2
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2
    const r0 = c * (i % 2 ? 0.9 : 0.885)
    ctx.beginPath()
    ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0)
    ctx.lineTo(c + Math.cos(a) * c * 0.93, c + Math.sin(a) * c * 0.93)
    ctx.stroke()
  }
  // Sixteen-point star: long cardinal points, then shorter ones between.
  for (const [count, length, offset, colors] of [
    [8, 0.5, Math.PI / 8, ['#8a6c3a', '#b08a4c']],
    [4, 0.82, 0, ['#c9a55c', '#e8cf8e']],
  ] as const) {
    for (let i = 0; i < count; i++) {
      const a = offset + (i / count) * Math.PI * 2 - Math.PI / 2
      for (const side of [0, 1]) {
        ctx.fillStyle = colors[side]
        ctx.beginPath()
        ctx.moveTo(c, c)
        ctx.lineTo(c + Math.cos(a) * c * length, c + Math.sin(a) * c * length)
        const b = a + (side ? 1 : -1) * 0.22
        ctx.lineTo(c + Math.cos(b) * c * 0.14, c + Math.sin(b) * c * 0.14)
        ctx.fill()
      }
    }
  }
  ctx.fillStyle = '#e8cf8e'
  ctx.font = `bold ${Math.round(c * 0.11)}px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ;['N', 'E', 'S', 'W'].forEach((letter, i) => {
    const a = (i / 4) * Math.PI * 2 - Math.PI / 2
    ctx.fillText(letter, c + Math.cos(a) * c * 0.74, c + Math.sin(a) * c * 0.74)
  })
}

function Floor() {
  const wood = useSurfaceTexture('wood', R * 2, R * 2, 7)
  const rug = useCanvasTexture(1024, 1024, (ctx, w) => drawCompassRug(ctx, w))
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[R, 64]} />
        <meshStandardMaterial color="#c8a888" map={wood} bumpMap={wood} bumpScale={0.5} roughness={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -0.6]} receiveShadow>
        <circleGeometry args={[2.4, 64]} />
        {/* N faces the opening (-z). */}
        <meshStandardMaterial map={rug} roughness={1} />
      </mesh>
    </>
  )
}

/**
 * The dome is built from eight gores, tapering wedges that meet at the top.
 * The one facing -z opens: its shutter slides round over the next gore when
 * you come in, leaving a triangular opening from the wall up to the crown.
 */
const GORES = 8
const GORE = (2 * Math.PI) / GORES
const DOME_THICKNESS = 0.3
/** Angles of the ribs as turns about y of an arc that starts along +x: π/2 points at -z, the open gore's middle. */
const RIB_ANGLES = Array.from({ length: GORES }, (_, i) => Math.PI / 2 + GORE / 2 + i * GORE)
/** The open gore's span in SphereGeometry's azimuth, which puts -z at 3π/2. */
const OPENING = { start: (3 * Math.PI) / 2 - GORE / 2, length: GORE }
const SHUTTER = { delay: 0.8, seconds: 4.5 }

/** The opening's frame: the cut faces of the dome along both edges, heavier brass ribs and a crown at the top. */
function OpeningFrame() {
  const edge = { color: '#2a2f3c', roughness: 0.6, metalness: 0.3 }
  return (
    <group position={[0, WALL_H, 0]}>
      {[RIB_ANGLES[GORES - 1], RIB_ANGLES[0]].map((angle) => (
        <group key={angle} rotation={[0, angle, 0]}>
          <mesh>
            <ringGeometry args={[R - 0.02, R + DOME_THICKNESS, 48, 1, 0, Math.PI / 2]} />
            <meshStandardMaterial {...edge} side={2} />
          </mesh>
          <mesh>
            <torusGeometry args={[R - 0.05, 0.075, 8, 64, Math.PI / 2]} />
            <meshStandardMaterial {...BRASS} />
          </mesh>
          <mesh>
            <torusGeometry args={[R + 0.06, 0.03, 6, 64, Math.PI / 2]} />
            <meshStandardMaterial {...IRON} />
          </mesh>
        </group>
      ))}
      {/* Crown where the gores meet. */}
      <mesh position={[0, R - 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.06, 10, 32]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, R - 0.04, 0]}>
        <sphereGeometry args={[0.16, 20, 10]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
    </group>
  )
}

/** The open gore's shutter, just outside the dome, sliding round to uncover the sky when you arrive. */
function Shutter() {
  const group = useRef<Group>(null)
  const clock = useRef(0)
  useFrame((_, delta) => {
    const g = group.current
    if (!g || clock.current > SHUTTER.delay + SHUTTER.seconds) return
    clock.current += delta
    const t = Math.min(1, Math.max(0, (clock.current - SHUTTER.delay) / SHUTTER.seconds))
    g.rotation.y = -GORE * t * t * (3 - 2 * t)
  })
  return (
    <group ref={group} position={[0, WALL_H, 0]}>
      <mesh>
        <sphereGeometry args={[R + DOME_THICKNESS + 0.02, 16, 24, OPENING.start, OPENING.length, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#1b2340" metalness={0.4} roughness={0.55} side={2} />
      </mesh>
    </group>
  )
}

/** Round wall, skirting, the brass track the dome turns on, and the dome itself with its open gore. */
function Shell() {
  const plaster = useSurfaceTexture('plaster', 2 * Math.PI * R, WALL_H, 8, 80)
  const chart = useCanvasTexture(4096, 1024, drawDome)
  // The dome leaves out the open gore, so map the chart by true azimuth to keep it in place.
  const domeStart = OPENING.start + OPENING.length
  const domeLength = Math.PI * 2 - OPENING.length
  useLayoutEffect(() => {
    chart.wrapS = RepeatWrapping
    chart.repeat.x = domeLength / (Math.PI * 2)
    chart.offset.x = domeStart / (Math.PI * 2)
    chart.needsUpdate = true
  }, [chart, domeStart, domeLength])
  return (
    <>
      <mesh position={[0, WALL_H / 2, 0]} receiveShadow>
        <cylinderGeometry args={[R, R, WALL_H, 96, 1, true]} />
        <meshStandardMaterial color="#5b6c8c" map={plaster} side={BackSide} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[R - 0.02, R - 0.02, 0.18, 96, 1, true]} />
        <meshStandardMaterial color="#3a2618" side={BackSide} roughness={0.5} />
      </mesh>
      <mesh position={[0, WALL_H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[R - 0.05, 0.07, 10, 120]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, WALL_H, 0]}>
        <sphereGeometry args={[R, 120, 48, domeStart, domeLength, 0, Math.PI / 2]} />
        <meshStandardMaterial
          map={chart}
          emissiveMap={chart}
          emissive="#ffffff"
          emissiveIntensity={0.35}
          side={BackSide}
          roughness={0.85}
        />
      </mesh>
      {RIB_ANGLES.slice(1, -1).map((angle) => (
        <mesh key={angle} position={[0, WALL_H, 0]} rotation={[0, angle, 0]}>
          <torusGeometry args={[R - 0.06, 0.035, 8, 48, Math.PI / 2]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
      ))}
      <OpeningFrame />
      <Shutter />
    </>
  )
}

/** A large brass refractor on an iron equatorial mount, pointing out through the opening. */
function Telescope() {
  const [x, z] = OBSERVATORY.telescope
  useInteractable({
    position: useMemo(() => new Vector3(x, 1.2, z), [x, z]),
    radius: 2.4,
    prompt: 'Press E to look through the telescope',
    // Deferred so the same key press doesn't also count as stepping back.
    onInteract: () => setTimeout(() => gameStore.set({ viewing: TELESCOPE_VIEW })),
  })
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.5, 0.55, 0.1, 32]} />
        <meshStandardMaterial {...IRON} />
      </mesh>
      <mesh position={[0, 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.26, 1.2, 24]} />
        <meshStandardMaterial {...IRON} />
      </mesh>
      <group position={[0, 1.3, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.32, 0.22, 0.32]} />
          <meshStandardMaterial {...IRON} />
        </mesh>
        {/* Counterweight shaft and weights. */}
        <group rotation={[0, 0, Math.PI / 2]}>
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.8, 10]} />
            <meshStandardMaterial {...BRASS} />
          </mesh>
          <mesh position={[0, 0.65, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.12, 0.12, 20]} />
            <meshStandardMaterial {...IRON} />
          </mesh>
        </group>
        {/* Tube, tilted up towards the opening (-z). */}
        <group position={[-0.25, 0.12, 0]} rotation={[-(Math.PI / 2 - TELESCOPE_ELEVATION), 0, 0]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.14, 2.6, 32]} />
            <meshPhysicalMaterial color="#b8904e" metalness={0.85} roughness={0.22} clearcoat={0.5} />
          </mesh>
          <mesh position={[0, 1.95, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.35, 32, 1, true]} />
            <meshStandardMaterial {...IRON} side={2} />
          </mesh>
          {[-0.3, 0.6, 1.4].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <torusGeometry args={[0.165, 0.018, 8, 32]} />
              <meshStandardMaterial {...BRASS} />
            </mesh>
          ))}
          {/* Eyepiece and finder scope. */}
          <mesh position={[0, -0.85, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 0.2, 16]} />
            <meshStandardMaterial {...IRON} />
          </mesh>
          <mesh position={[0.2, 0.7, 0]}>
            <cylinderGeometry args={[0.04, 0.035, 0.6, 16]} />
            <meshStandardMaterial {...BRASS} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

export const TELESCOPE_VIEW = 'telescope'
/** Where the eye goes when looking through the telescope: high up the tube, clear of the dome. */
const EYEPIECE = new Vector3(0, 3.4, -2.1)
const VIEW_FOV = { start: 7, min: 1.5, max: 24 }

/**
 * Looking through the telescope: the camera moves up to the tube, narrows
 * to a few degrees and starts on the moon. Scroll to zoom; E steps back.
 */
function TelescopeView() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const viewing = useGame((s) => s.viewing === TELESCOPE_VIEW)
  const fov = useRef<number | null>(null)

  useEffect(() => {
    if (!viewing) return
    const saved = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov }
    camera.position.copy(EYEPIECE)
    camera.lookAt(...MOON)
    fov.current = VIEW_FOV.start
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' && !e.repeat) gameStore.set({ viewing: null })
    }
    const onWheel = (e: WheelEvent) => {
      fov.current = Math.min(VIEW_FOV.max, Math.max(VIEW_FOV.min, (fov.current ?? VIEW_FOV.start) * Math.exp(e.deltaY * 0.001)))
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('wheel', onWheel)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('wheel', onWheel)
      camera.position.copy(saved.position)
      camera.quaternion.copy(saved.quaternion)
      camera.fov = saved.fov
      camera.updateProjectionMatrix()
      fov.current = null
    }
  }, [viewing, camera])

  // Leaving the room always puts the eye back.
  useEffect(() => () => gameStore.set({ viewing: null }), [])

  useFrame((_, delta) => {
    if (fov.current === null || Math.abs(camera.fov - fov.current) < 0.01) return
    camera.fov += (fov.current - camera.fov) * Math.min(1, delta * 10)
    camera.updateProjectionMatrix()
  })
  return null
}

/** A brass orrery on a round table, with planets slowly turning round the sun. */
const INNER: PlanetId[] = ['mercury', 'venus', 'earth', 'mars']

function Orrery() {
  const [x, z] = OBSERVATORY.orrery
  const arms = useRef<(Group | null)[]>([])
  // The four inner planets, set where they really are, then run forward at two days a second.
  const planets = useMemo(
    () =>
      INNER.map((id, i) => ({
        planet: findPlanet(id),
        r: 0.18 + i * 0.1,
        size: [0.025, 0.035, 0.038, 0.03][i],
      })),
    [],
  )
  const start = useMemo(() => ({ real: Date.now(), clock: performance.now() }), [])
  useFrame(() => {
    const date = new Date(start.real + ((performance.now() - start.clock) / 1000) * 2 * 86400000)
    arms.current.forEach((arm, i) => {
      if (!arm) return
      const p = position(planets[i].planet, date)
      // Ecliptic longitude, counter-clockwise seen from above (north up through the model).
      arm.rotation.y = Math.atan2(p.y, p.x)
    })
  })
  useInteractable({
    position: useMemo(() => new Vector3(x, 1, z), [x, z]),
    radius: 2,
    prompt: 'Press E to explore the solar system',
    onInteract: () => openOverlay(SOLAR_OVERLAY),
  })
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.06, 0.18, 0.84, 16]} />
        <meshStandardMaterial color="#3a2618" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.86, 0]} castShadow>
        <cylinderGeometry args={[0.6, 0.6, 0.05, 40]} />
        <meshStandardMaterial color="#4a2e1a" roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.04, 0.08, 0.15, 12]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <sphereGeometry args={[0.07, 24, 16]} />
        <meshStandardMaterial color="#ffd27a" emissive="#ffb030" emissiveIntensity={1.5} />
      </mesh>
      {planets.map((p, i) => (
        <group key={i} position={[0, 1.02 + i * 0.012, 0]} ref={(g) => void (arms.current[i] = g)}>
          <mesh position={[p.r / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.004, 0.004, p.r, 6]} />
            <meshStandardMaterial {...BRASS} />
          </mesh>
          <mesh position={[p.r, 0.04, 0]}>
            <sphereGeometry args={[p.size, 16, 12]} />
            <meshStandardMaterial color={p.planet.colour} roughness={0.6} />
          </mesh>
        </group>
      ))}
      <Glow position={[0, 1.1, 0]} rotation={[-Math.PI / 2, 0, 0]} size={[1.4, 1.4]} color="#ffb040" opacity={0.25} />
    </group>
  )
}

/** A celestial globe on a wooden stand, turning slowly. */
function CelestialGlobe() {
  const [x, z] = OBSERVATORY.globe
  const globe = useRef<Group>(null)
  const map = useMemo(() => getPainting('stars'), [])
  useFrame((_, delta) => {
    if (globe.current) globe.current.rotation.y += delta * 0.1
  })
  return (
    <group position={[x, 0, z]}>
      {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((a) => (
        <mesh
          key={a}
          position={[Math.cos(a) * 0.22, 0.35, Math.sin(a) * 0.22]}
          rotation={[Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25]}
        >
          <cylinderGeometry args={[0.025, 0.03, 0.72, 8]} />
          <meshStandardMaterial color="#4a2e1a" roughness={0.5} />
        </mesh>
      ))}
      <group position={[0, 1.05, 0]} rotation={[0, 0, 0.41]}>
        <group ref={globe}>
          <mesh castShadow>
            <sphereGeometry args={[0.3, 32, 20]} />
            <meshStandardMaterial map={map} roughness={0.5} />
          </mesh>
        </group>
        <mesh>
          <torusGeometry args={[0.34, 0.012, 8, 48]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
      </group>
      <mesh position={[0, 0.78, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.36, 0.03, 8, 48]} />
        <meshStandardMaterial color="#4a2e1a" roughness={0.5} />
      </mesh>
    </group>
  )
}

/** Stands furniture against the curved wall at `angle`, with its local +z facing into the room. */
function AgainstWall({ angle, inset, children }: { angle: number; inset: number; children: React.ReactNode }) {
  const [x, z] = observatoryWallPoint(angle, inset)
  return (
    <group position={[x, 0, z]} rotation={[0, angle + Math.PI, 0]}>
      {children}
    </group>
  )
}

/** A writing desk with an open star atlas, a green banker's lamp and a chair. */
function Desk() {
  const wood = useTiledTexture('wood', 1, 1)
  const leftPage = useMemo(() => getPainting('stars'), [])
  const rightPage = useMemo(() => getPainting('map'), [])
  const walnut = { color: '#7a5034', map: wood, roughness: 0.45 }
  useInteractable({
    position: useMemo(() => {
      const [x, z] = observatoryWallPoint(OBSERVATORY.deskAngle, 0.75)
      return new Vector3(x, 1, z)
    }, []),
    radius: 2,
    prompt: 'Star atlas: your own observations will be kept here',
  })
  return (
    <AgainstWall angle={OBSERVATORY.deskAngle} inset={0.45}>
      <mesh position={[0, 0.76, 0]} castShadow>
        <boxGeometry args={[1.4, 0.05, 0.7]} />
        <meshStandardMaterial {...walnut} />
      </mesh>
      {/* Drawer pedestals. */}
      {[-0.5, 0.5].map((x) => (
        <group key={x} position={[x, 0.37, 0]}>
          <mesh>
            <boxGeometry args={[0.38, 0.74, 0.64]} />
            <meshStandardMaterial {...walnut} />
          </mesh>
          {[0.2, 0, -0.2].map((y) => (
            <mesh key={y} position={[0, y, 0.325]}>
              <boxGeometry args={[0.05, 0.015, 0.015]} />
              <meshStandardMaterial {...BRASS} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Leather writing inset and the open atlas. */}
      <mesh position={[0, 0.786, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 0.5]} />
        <meshStandardMaterial color="#2c4a36" roughness={0.6} />
      </mesh>
      {[
        [-0.17, leftPage, 0.08],
        [0.17, rightPage, -0.08],
      ].map(([x, page, tilt]) => (
        <mesh key={x as number} position={[x as number, 0.8, 0.05]} rotation={[-Math.PI / 2, tilt as number, 0]}>
          <planeGeometry args={[0.33, 0.25]} />
          <meshStandardMaterial map={page as CanvasTexture} roughness={0.9} />
        </mesh>
      ))}
      {/* Banker's lamp with a glowing green shade. */}
      <group position={[0.5, 0.79, -0.18]}>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.08, 0.09, 0.03, 20]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
        <mesh position={[0, 0.17, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.3, 8]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
        <mesh position={[0, 0.33, 0.04]} rotation={[0.3, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, 0.28, 20, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color="#1f6a46" emissive="#2a8a5a" emissiveIntensity={0.9} roughness={0.2} side={2} />
        </mesh>
        <Glow position={[-0.25, 0.015, 0.15]} rotation={[-Math.PI / 2, 0, 0]} size={[0.9, 0.7]} color="#ffd9a0" opacity={0.45} />
        {/* A small, soft light: enough to read the desk by, with no shadows. */}
        <pointLight position={[0, 0.25, 0.25]} color="#ffd9a0" intensity={1.6} distance={3} decay={2} />
      </group>
      {/* A pair of books and a brass magnifier. */}
      {[
        ['#6a2a22', -0.55, 0.06],
        ['#22385a', -0.55, 0.11],
      ].map(([color, x, y]) => (
        <mesh key={color as string} position={[x as number, 0.79 + (y as number) / 2, -0.15]} rotation={[0, 0.2, 0]}>
          <boxGeometry args={[0.24, 0.045, 0.32]} />
          <meshStandardMaterial color={color as string} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0.32, 0.79, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.05, 0.008, 8, 24]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      {/* Chair, pulled out a little. */}
      <group position={[0, 0, 0.7]} rotation={[0, 0.25, 0]}>
        <mesh position={[0, 0.46, 0]}>
          <boxGeometry args={[0.46, 0.06, 0.44]} />
          <meshStandardMaterial color="#5a2a22" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.78, 0.2]}>
          <boxGeometry args={[0.44, 0.56, 0.05]} />
          <meshStandardMaterial {...walnut} />
        </mesh>
        {[-0.19, 0.19].flatMap((x) =>
          [-0.18, 0.18].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 0.22, z]}>
              <boxGeometry args={[0.04, 0.44, 0.04]} />
              <meshStandardMaterial {...walnut} />
            </mesh>
          )),
        )}
      </group>
    </AgainstWall>
  )
}

/** A tall bookcase of leather-bound volumes, each spine a slightly different colour and height. */
function Bookcase() {
  const wood = useTiledTexture('wood', 1, 1)
  const books = useRef<InstancedMesh>(null)
  const width = 1.4
  const shelves = [0.12, 0.6, 1.08, 1.56]
  const list = useMemo(() => {
    const rand = seededRandom(5)
    const spines = ['#6a2a22', '#22385a', '#2c4a36', '#7a5a2a', '#4a2a3a', '#8a7a5a']
    const out: { x: number; y: number; w: number; h: number; tilt: number; color: string }[] = []
    for (const shelf of shelves) {
      let x = -width / 2 + 0.06
      while (x < width / 2 - 0.08) {
        const w = 0.03 + rand() * 0.035
        const h = 0.26 + rand() * 0.12
        // Every so often a gap, with the next book leaning into it.
        const tilt = rand() < 0.06 ? 0.25 : 0
        out.push({ x: x + w / 2, y: shelf + 0.02 + h / 2, w, h, tilt, color: spines[Math.floor(rand() * spines.length)] })
        x += w + (tilt ? 0.08 : 0.004)
      }
    }
    return out
  }, [])
  useLayoutEffect(() => {
    const dummy = new Object3D()
    const color = new Color()
    list.forEach((b, i) => {
      dummy.position.set(b.x, b.y, 0)
      dummy.rotation.set(0, 0, b.tilt)
      dummy.scale.set(b.w, b.h, 0.22)
      dummy.updateMatrix()
      books.current!.setMatrixAt(i, dummy.matrix)
      books.current!.setColorAt(i, color.set(b.color))
    })
    books.current!.instanceMatrix.needsUpdate = true
    if (books.current!.instanceColor) books.current!.instanceColor.needsUpdate = true
  }, [list])
  const walnut = { color: '#6a4430', map: wood, roughness: 0.5 }
  return (
    <AgainstWall angle={OBSERVATORY.bookcaseAngle} inset={0.25}>
      <mesh position={[0, 1.05, -0.13]}>
        <boxGeometry args={[width, 2.1, 0.03]} />
        <meshStandardMaterial {...walnut} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * (width + 0.04)) / 2, 1.05, 0]}>
          <boxGeometry args={[0.04, 2.1, 0.3]} />
          <meshStandardMaterial {...walnut} />
        </mesh>
      ))}
      {[...shelves, 2.06].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[width, 0.04, 0.3]} />
          <meshStandardMaterial {...walnut} />
        </mesh>
      ))}
      <mesh position={[0, 2.12, 0.02]}>
        <boxGeometry args={[width + 0.12, 0.08, 0.36]} />
        <meshStandardMaterial {...walnut} />
      </mesh>
      <instancedMesh ref={books} args={[undefined, undefined, list.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.75} />
      </instancedMesh>
      {/* Picture light over the shelves, washing the spines with warm light. */}
      <mesh position={[0, 2.02, 0.2]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 0.9, 12]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <pointLight position={[0, 1.6, 0.6]} color="#ffd2a0" intensity={1.4} distance={2.6} decay={2} />
      {/* A brass sextant resting on top. */}
      <mesh position={[0.3, 2.3, 0]} rotation={[0, 0.4, 0]}>
        <torusGeometry args={[0.13, 0.01, 6, 24, Math.PI / 3]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
    </AgainstWall>
  )
}

/** Brass wall light: a soft pool of light on the wall, no hard source. */
function WallLight({ angle }: { angle: number }) {
  const x = Math.sin(angle) * (R - 0.06)
  const z = Math.cos(angle) * (R - 0.06)
  return (
    <group position={[x, 2.2, z]} rotation={[0, angle + Math.PI, 0]}>
      <mesh position={[0, 0, 0.05]}>
        <cylinderGeometry args={[0.06, 0.09, 0.18, 16, 1, true]} />
        <meshStandardMaterial color="#fff0d8" emissive="#ffc890" emissiveIntensity={0.9} side={2} />
      </mesh>
      <mesh position={[0, -0.1, 0.03]}>
        <boxGeometry args={[0.04, 0.12, 0.06]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <Glow position={[0, 0.3, 0]} size={[1.2, 1.6]} color="#ffb070" opacity={0.3} />
    </group>
  )
}

/** Round observatory: domed roof with one gore open to the night sky, a big telescope, an orrery and a celestial globe. */
export default function Observatory() {
  return (
    <group>
      <Atmosphere background="#03040c" />
      <hemisphereLight args={['#8a9ed8', '#3a2c20', 1.0]} />
      <ambientLight intensity={0.18} color="#c0c8ff" />
      {/* Moonlight falling through the opening. */}
      <directionalLight position={MOON} intensity={0.6} color="#b8c8ff" />
      <pointLight position={[0, 2.6, 1.5]} color="#ffcf90" intensity={6} distance={9} decay={1.6} />
      <NightSky moon={MOON} />

      <Floor />
      <Shell />
      <Telescope />
      <TelescopeView />
      <Orrery />
      <CelestialGlobe />
      <Desk />
      <Bookcase />
      {[0.9, -0.9, 2.2, -2.2].map((a) => (
        <WallLight key={a} angle={a} />
      ))}
      <Painting
        name="stars"
        position={[Math.sin(Math.PI) * (R - 0.05), 1.75, Math.cos(Math.PI) * (R - 0.05)]}
        rotationY={0}
        width={1.1}
      />
      <Painting
        name="map"
        position={[Math.sin(-1.6) * (R - 0.05), 1.75, Math.cos(-1.6) * (R - 0.05)]}
        rotationY={-1.6 + Math.PI}
        width={1}
      />
    </group>
  )
}
