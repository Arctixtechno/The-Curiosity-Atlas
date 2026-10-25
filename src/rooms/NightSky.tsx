import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Matrix4,
  ShaderMaterial,
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

/**
 * The moon's surface as an equirectangular map: grey highlands, dark maria,
 * craters with a shadowed wall and a sunlit wall, and a few bright ray
 * craters. Shapes are widened towards the poles so they look round on the sphere.
 */
function paintMoon(rand: Rand) {
  const w = 2048
  const h = 1024
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#b9b5ac'
  ctx.fillRect(0, 0, w, h)
  /** Horizontal stretch at canvas row `y`, so shapes come out round on the sphere. */
  const stretch = (y: number) => 1 / Math.max(0.15, Math.sin((y / h) * Math.PI))
  const ellipse = (x: number, y: number, r: number, fill: string | CanvasGradient) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(stretch(y), 1)
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  // Highland texture: lots of faint light and dark mottling.
  for (let i = 0; i < 2500; i++) {
    const y = h * (0.05 + rand() * 0.9)
    ellipse(rand() * w, y, 3 + rand() * 18, rand() < 0.5 ? 'rgba(255,255,250,0.05)' : 'rgba(60,58,54,0.05)')
  }
  // Maria: clusters of overlapping dark blobs, mostly on one hemisphere, as on the real near side.
  for (let m = 0; m < 9; m++) {
    const cx = w * (0.3 + rand() * 0.4)
    const cy = h * (0.25 + rand() * 0.45)
    const spread = 40 + rand() * 90
    for (let i = 0; i < 40; i++) {
      const x = cx + (rand() - 0.5) * spread * 2
      const y = cy + (rand() - 0.5) * spread * 1.2
      const r = 12 + rand() * spread * 0.5
      ellipse(x, y, r, 'rgba(70, 70, 72, 0.16)')
    }
  }
  // Craters, many small and few large. Light comes from the left, so the left
  // inner wall is in shadow and the right inner wall is lit.
  for (let i = 0; i < 1100; i++) {
    const y = h * (0.04 + rand() * 0.92)
    const x = rand() * w
    const r = 1.2 + rand() ** 4 * 34
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(stretch(y), 1)
    const floor = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
    floor.addColorStop(0, 'rgba(120, 118, 112, 0.35)')
    floor.addColorStop(0.75, 'rgba(110, 108, 102, 0.25)')
    floor.addColorStop(1, 'rgba(110, 108, 102, 0)')
    ctx.fillStyle = floor
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = Math.max(0.8, r * 0.18)
    ctx.strokeStyle = 'rgba(40, 38, 36, 0.35)'
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.85, Math.PI * 0.6, Math.PI * 1.4)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(250, 248, 240, 0.4)'
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.85, -Math.PI * 0.4, Math.PI * 0.4)
    ctx.stroke()
    ctx.restore()
  }
  // A few young craters with bright rays splashing out across the surface.
  for (let i = 0; i < 4; i++) {
    const x = w * (0.2 + rand() * 0.6)
    const y = h * (0.25 + rand() * 0.5)
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(stretch(y), 1)
    ctx.strokeStyle = 'rgba(255, 255, 250, 0.12)'
    for (let k = 0; k < 18; k++) {
      const a = rand() * Math.PI * 2
      const len = 60 + rand() * 160
      ctx.lineWidth = 2 + rand() * 4
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(255, 255, 250, 0.7)'
    ctx.beginPath()
    ctx.arc(0, 0, 5 + rand() * 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

/** Sunlight on the moon: lit from one side, with a soft terminator and a faint earthshine on the dark part. */
function moonMaterial(map: CanvasTexture, sun: Vector3) {
  return new ShaderMaterial({
    uniforms: { map: { value: map }, sun: { value: sun } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec3 sun;
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vec3 albedo = texture2D(map, vUv).rgb;
        float light = smoothstep(-0.08, 0.35, dot(normalize(vNormal), sun));
        gl_FragColor = vec4(albedo * (0.025 + 1.15 * light), 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
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
  const moonShading = useMemo(() => {
    // Lit from one side of the line of sight from the room, so it shows as a bright gibbous moon.
    const towardsRoom = new Vector3(0, 3, 0).sub(new Vector3(...moon)).normalize()
    return moonMaterial(moonMap, towardsRoom.add(new Vector3(-0.9, 0, 0)).normalize())
  }, [moonMap, moon])
  const halo = useHalo()
  useEffect(
    () => () => {
      sky.dispose()
      moonMap.dispose()
      moonShading.dispose()
      stars.forEach((s) => s.geometry.dispose())
    },
    [sky, moonMap, moonShading, stars],
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
      {/* Tilted so its poles sit side-on to the room, where the map is least stretched. */}
      <mesh position={moon} rotation={[0.86, 2.2, 0]} material={moonShading}>
        <sphereGeometry args={[2, 96, 48]} />
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
