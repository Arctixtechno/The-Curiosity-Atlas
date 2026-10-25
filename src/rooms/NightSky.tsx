import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Matrix4,
  SRGBColorSpace,
  Vector3,
  type Mesh,
  type MeshBasicMaterial,
} from 'three'

// A night sky generated afresh on every visit: a Milky Way band, coloured
// stars, faint nebulae, a cratered moon and the odd shooting star. Directions
// use the same convention as three's SphereGeometry, so the painted sky and
// the star points line up: azimuth `u` (0 to 1 round the sky) and elevation
// in radians above the horizon.

const SKY_RADIUS = 85
const STAR_RADIUS = 80
/** Azimuth of -z, the way the observatory's slit faces. The Milky Way passes overhead there. */
const SLIT_U = 0.75

type Rand = () => number

function randomSource(seed: number): Rand {
  let s = seed % 2147483647 || 1
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

function direction(u: number, elevation: number, out = new Vector3()) {
  const phi = u * Math.PI * 2
  return out.set(-Math.cos(phi) * Math.cos(elevation), Math.sin(elevation), Math.sin(phi) * Math.cos(elevation))
}

/** Elevation of the middle of the Milky Way at azimuth `u`: high over the slit, low behind it. */
function bandElevation(u: number) {
  return (Math.PI / 2) * 0.62 * Math.cos(2 * Math.PI * (u - SLIT_U))
}

function gaussian(rand: Rand) {
  return (rand() + rand() + rand() - 1.5) / 1.5
}

/** The soft parts of the sky: a deep gradient, the Milky Way's glow and dust lanes, and a few nebulae. */
function paintSky(rand: Rand) {
  const w = 2048
  const h = 1024
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  // Row 0 is the zenith and the middle row the horizon.
  const bg = ctx.createLinearGradient(0, 0, 0, h / 2)
  bg.addColorStop(0, '#02030a')
  bg.addColorStop(0.8, '#060a1c')
  bg.addColorStop(1, '#121a34')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  const yAt = (elevation: number) => (0.5 - elevation / Math.PI) * h
  const blob = (x: number, y: number, r: number, color: string, alpha: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, color.replace('A', String(alpha)))
    g.addColorStop(1, color.replace('A', '0'))
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  ctx.globalCompositeOperation = 'lighter'
  // The Milky Way: many overlapping soft clouds along the band.
  for (let i = 0; i < 1400; i++) {
    const u = rand()
    const y = yAt(bandElevation(u) + gaussian(rand) * 0.16)
    const tone = rand() < 0.2 ? 'rgba(255, 214, 170, A)' : 'rgba(190, 205, 255, A)'
    blob(u * w, y, 14 + rand() * 46, tone, 0.025 + rand() * 0.04)
  }
  // Nebulae: a few faint coloured patches.
  for (let i = 0; i < 6; i++) {
    const u = rand()
    const y = yAt(bandElevation(u) + gaussian(rand) * 0.4)
    const tone = ['rgba(255, 90, 140, A)', 'rgba(90, 160, 255, A)', 'rgba(150, 110, 255, A)'][i % 3]
    for (let j = 0; j < 8; j++) blob(u * w + gaussian(rand) * 40, y + gaussian(rand) * 25, 20 + rand() * 40, tone, 0.05)
  }
  // Dark dust lanes down the middle of the band.
  ctx.globalCompositeOperation = 'source-over'
  for (let i = 0; i < 500; i++) {
    const u = rand()
    const y = yAt(bandElevation(u) + gaussian(rand) * 0.05)
    blob(u * w, y, 8 + rand() * 22, 'rgba(2, 3, 10, A)', 0.12 + rand() * 0.12)
  }
  // Star dust too faint to pick out one by one.
  for (let i = 0; i < 9000; i++) {
    const u = rand()
    const inBand = rand() < 0.6
    const elevation = inBand ? bandElevation(u) + gaussian(rand) * 0.2 : Math.asin(rand())
    ctx.fillStyle = `rgba(230, 236, 255, ${0.15 + rand() * 0.35})`
    ctx.fillRect(u * w, yAt(elevation), 1, 1)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** Star colours from cool red to hot blue, weighted towards white. */
const STAR_COLOURS = ['#ffd2a1', '#fff4e8', '#ffffff', '#ffffff', '#e4ecff', '#cad8ff', '#aac4ff']

/** Crisp stars as points, in three brightness groups, concentrated towards the Milky Way. */
function makeStars(rand: Rand) {
  const groups = [
    { count: 2600, size: 1.4, brightness: 0.7 },
    { count: 500, size: 2.2, brightness: 0.9 },
    { count: 70, size: 3.4, brightness: 1 },
  ]
  const v = new Vector3()
  return groups.map(({ count, size, brightness }) => {
    const positions: number[] = []
    const colours: number[] = []
    for (let i = 0; i < count; i++) {
      const u = rand()
      const elevation = rand() < 0.45 ? bandElevation(u) + gaussian(rand) * 0.25 : Math.asin(rand() * 0.98 + 0.02)
      direction(u, Math.max(0.02, elevation), v).multiplyScalar(STAR_RADIUS)
      positions.push(v.x, v.y, v.z)
      const hex = parseInt(STAR_COLOURS[Math.floor(rand() * STAR_COLOURS.length)].slice(1), 16)
      const b = brightness * (0.6 + rand() * 0.4)
      colours.push(((hex >> 16) / 255) * b, (((hex >> 8) & 255) / 255) * b, ((hex & 255) / 255) * b)
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new Float32BufferAttribute(colours, 3))
    return { geometry, size }
  })
}

/** A full moon with maria and craters. */
function paintMoon(rand: Rand) {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size / 2
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#e8e4d8'
  ctx.fillRect(0, 0, size, size / 2)
  // Maria: large darker grey seas.
  for (let i = 0; i < 14; i++) {
    const x = rand() * size
    const y = size * (0.1 + rand() * 0.3)
    const r = 20 + rand() * 60
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(120, 118, 112, 0.55)')
    g.addColorStop(1, 'rgba(120, 118, 112, 0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  // Craters: a dark floor with a bright rim.
  for (let i = 0; i < 160; i++) {
    const x = rand() * size
    const y = rand() * (size / 2)
    const r = 1.5 + rand() ** 3 * 14
    ctx.fillStyle = 'rgba(90, 88, 84, 0.35)'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 250, 0.4)'
    ctx.lineWidth = Math.max(1, r * 0.2)
    ctx.beginPath()
    ctx.arc(x - r * 0.1, y - r * 0.1, r, Math.PI * 0.9, Math.PI * 1.9)
    ctx.stroke()
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** A short streak, transparent at the tail and bright at the head (the +x end). */
function paintStreak() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 16
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 256, 0)
  g.addColorStop(0, 'rgba(255, 255, 255, 0)')
  g.addColorStop(0.85, 'rgba(220, 230, 255, 0.6)')
  g.addColorStop(1, 'rgba(255, 255, 255, 1)')
  ctx.fillStyle = g
  const v = ctx.createLinearGradient(0, 0, 0, 16)
  ctx.fillRect(0, 0, 256, 16)
  // Fade the top and bottom edges so it reads as a line of light.
  v.addColorStop(0, 'rgba(0,0,0,1)')
  v.addColorStop(0.5, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = v
  ctx.fillRect(0, 0, 256, 16)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

const METEOR = { length: 9, seconds: 0.7, minWait: 2.5, maxWait: 7 }
const basis = new Matrix4()
const xAxis = new Vector3()
const yAxis = new Vector3()
const zAxis = new Vector3()

/** Now and then a meteor streaks across the part of the sky seen through the slit. */
function ShootingStar({ rand }: { rand: Rand }) {
  const mesh = useRef<Mesh>(null)
  const streak = useMemo(paintStreak, [])
  useEffect(() => () => streak.dispose(), [streak])
  const state = useRef({ wait: 1.5, t: -1, start: new Vector3(), velocity: new Vector3(), head: new Vector3() })

  useFrame((_, delta) => {
    const m = mesh.current
    if (!m) return
    const s = state.current
    const material = m.material as MeshBasicMaterial
    if (s.t < 0) {
      s.wait -= delta
      material.opacity = 0
      if (s.wait > 0) return
      // Start somewhere in front of the slit and fall slantwise towards the horizon.
      direction(SLIT_U + (rand() - 0.5) * 0.06, 0.6 + rand() * 0.75, s.start).multiplyScalar(STAR_RADIUS - 2)
      const side = rand() < 0.5 ? -1 : 1
      s.velocity.set(side * (8 + rand() * 10), -(10 + rand() * 12), 0)
      s.t = 0
    }
    s.t += delta / METEOR.seconds
    if (s.t >= 1) {
      s.t = -1
      s.wait = METEOR.minWait + rand() * (METEOR.maxWait - METEOR.minWait)
      material.opacity = 0
      return
    }
    s.head.copy(s.start).addScaledVector(s.velocity, s.t * METEOR.seconds)
    // Face the middle of the room, with the streak's length along its path.
    zAxis.copy(s.head).negate().normalize()
    xAxis.copy(s.velocity).addScaledVector(zAxis, -s.velocity.dot(zAxis)).normalize()
    yAxis.crossVectors(zAxis, xAxis)
    basis.makeBasis(xAxis, yAxis, zAxis)
    m.quaternion.setFromRotationMatrix(basis)
    m.position.copy(s.head).addScaledVector(xAxis, -METEOR.length / 2)
    material.opacity = Math.sin(s.t * Math.PI)
  })

  return (
    <mesh ref={mesh}>
      <planeGeometry args={[METEOR.length, 0.18]} />
      <meshBasicMaterial map={streak} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
    </mesh>
  )
}

/** The night sky outside the observatory, different on every visit. `moon` is where the moon sits. */
export function NightSky({ moon }: { moon: [number, number, number] }) {
  const rand = useMemo(() => randomSource(Math.floor(Math.random() * 2147483646) + 1), [])
  const sky = useMemo(() => paintSky(rand), [rand])
  const stars = useMemo(() => makeStars(rand), [rand])
  const moonMap = useMemo(() => paintMoon(rand), [rand])
  const halo = useHalo()
  useEffect(
    () => () => {
      sky.dispose()
      moonMap.dispose()
      stars.forEach((s) => s.geometry.dispose())
    },
    [sky, moonMap, stars],
  )
  return (
    <group>
      <mesh>
        <sphereGeometry args={[SKY_RADIUS, 64, 32]} />
        <meshBasicMaterial map={sky} side={BackSide} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
      {stars.map(({ geometry, size }) => (
        <points key={size} geometry={geometry}>
          <pointsMaterial vertexColors size={size} sizeAttenuation={false} transparent depthWrite={false} toneMapped={false} fog={false} />
        </points>
      ))}
      <mesh position={moon} rotation={[0.3, 2.2, 0]}>
        <sphereGeometry args={[2, 48, 24]} />
        <meshBasicMaterial map={moonMap} toneMapped={false} fog={false} />
      </mesh>
      {/* Halo round the moon. */}
      <mesh position={moon} renderOrder={1} onUpdate={(m) => m.lookAt(0, 0, 0)}>
        <planeGeometry args={[14, 14]} />
        <meshBasicMaterial map={halo} color="#c8d4ff" transparent opacity={0.35} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <ShootingStar rand={rand} />
    </group>
  )
}

function useHalo() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const ctx = canvas.getContext('2d')!
    const g = ctx.createRadialGradient(64, 64, 9, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,0.9)')
    g.addColorStop(0.3, 'rgba(255,255,255,0.25)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    return tex
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}
