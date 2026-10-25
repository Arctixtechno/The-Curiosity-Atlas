import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  DataTexture,
  Float32BufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  RepeatWrapping,
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
/** Azimuth of -z, the way the observatory's opening faces. The Milky Way passes overhead there. */
const OPENING_U = 0.75

type Rand = () => number

function randomSource(seed: number): Rand {
  let s = seed % 2147483647 || 1
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

function direction(u: number, elevation: number, out = new Vector3()) {
  const phi = u * Math.PI * 2
  return out.set(-Math.cos(phi) * Math.cos(elevation), Math.sin(elevation), Math.sin(phi) * Math.cos(elevation))
}

function gaussian(rand: Rand) {
  return (rand() + rand() + rand() - 1.5) / 1.5
}

/** Smooth 3D value noise, so patterns wrap round the sky with no seam. */
function makeNoise(rand: Rand) {
  const perm = new Uint8Array(512)
  for (let i = 0; i < 256; i++) perm[i] = i
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i]
  const hash = (x: number, y: number, z: number) => perm[perm[perm[x & 255] + (y & 255)] + (z & 255)] / 255
  const fade = (t: number) => t * t * (3 - 2 * t)
  const noise = (x: number, y: number, z: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const zi = Math.floor(z)
    const u = fade(x - xi)
    const v = fade(y - yi)
    const w = fade(z - zi)
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const x0 = lerp(lerp(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), lerp(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v)
    const x1 = lerp(
      lerp(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u),
      lerp(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u),
      v,
    )
    return lerp(x0, x1, w)
  }
  /** Fractal noise from 0 to about 1. */
  return (x: number, y: number, z: number, octaves = 4) => {
    let sum = 0
    let amp = 0.5
    let f = 1
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise(x * f, y * f, z * f)
      f *= 2.03
      amp *= 0.5
    }
    return sum / (1 - 0.5 ** octaves)
  }
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * The plane of the Milky Way: a great circle through a point high over the
 * opening, at a random tilt, with its bright core over the opening.
 */
function galaxy(rand: Rand) {
  const core = direction(OPENING_U + (rand() - 0.5) * 0.03, 0.75 + rand() * 0.45)
  const across = new Vector3(Math.cos(rand() * Math.PI * 2), 0, Math.sin(rand() * Math.PI * 2))
  const pole = new Vector3().crossVectors(core, across).normalize()
  const along = new Vector3().crossVectors(pole, core)
  /** Galactic latitude and longitude of a direction, in radians, with the core at longitude 0. */
  return (d: Vector3) => ({ b: Math.asin(d.dot(pole)), l: Math.atan2(d.dot(along), d.dot(core)) })
}

/**
 * The soft parts of the sky: a deep gradient with faint airglow at the
 * horizon, the Milky Way with its dust lanes, and a few nebulae. Worked out
 * pixel by pixel at a lower resolution (it's all soft), then scaled up.
 */
function paintSky(rand: Rand) {
  const noise = makeNoise(rand)
  const toGalaxy = galaxy(rand)
  const nebulae = Array.from({ length: 4 }, () => ({
    at: direction(OPENING_U + gaussian(rand) * 0.12, 0.35 + rand() * 1.1),
    size: 0.04 + rand() * 0.06,
    tone: [
      [1, 0.35, 0.55],
      [0.35, 0.6, 1],
      [0.75, 0.45, 1],
    ][Math.floor(rand() * 3)],
  }))
  const lw = 1024
  const lh = 512
  // Only the sky above the horizon (and a little below, for the haze) is ever seen.
  const rows = Math.ceil(lh * 0.56)
  const low = document.createElement('canvas')
  low.width = lw
  low.height = lh
  const lctx = low.getContext('2d')!
  const image = lctx.createImageData(lw, lh)
  const d = new Vector3()
  for (let y = 0; y < lh; y++) {
    const elevation = Math.PI / 2 - ((y + 0.5) / lh) * Math.PI
    const h = Math.max(0, elevation)
    // Night sky: near black overhead, deep blue lower down, a faint green airglow at the horizon.
    let r = 0.012 + 0.05 * Math.exp(-h * 4)
    let g = 0.016 + 0.06 * Math.exp(-h * 4) + 0.025 * Math.exp(-h * 14)
    let b = 0.04 + 0.11 * Math.exp(-h * 3.2)
    for (let x = 0; x < lw && y < rows; x++) {
      direction((x + 0.5) / lw, elevation, d)
      const { b: lat, l } = toGalaxy(d)
      const coreGlow = 0.45 + 0.55 * Math.exp(-((l / 0.8) ** 2))
      const clumps = noise(d.x * 3 + 7, d.y * 3, d.z * 3)
      const width = 0.11 + 0.05 * noise(d.x * 1.5, d.y * 1.5 + 3, d.z * 1.5)
      let band = Math.exp(-((lat / width) ** 2)) * (0.35 + 0.9 * clumps ** 1.5) + 0.22 * Math.exp(-((lat / 0.4) ** 2))
      band *= coreGlow
      // Dust lanes: dark, wispy and close to the plane.
      const dust = smoothstep(0.48, 0.72, noise(d.x * 7 + 11, d.y * 7, d.z * 7 - 5, 5)) * Math.exp(-(((lat - 0.02) / 0.06) ** 2))
      band *= 1 - 0.85 * dust
      const warm = Math.exp(-((l / 0.6) ** 2))
      const glow = band * 0.22
      r += glow * (0.75 + 0.25 * warm)
      g += glow * (0.78 + 0.12 * warm)
      b += glow * (0.95 - 0.15 * warm)
      for (const n of nebulae) {
        const a = Math.acos(Math.min(1, d.dot(n.at)))
        if (a > n.size * 3) continue
        const amount = Math.exp(-((a / n.size) ** 2)) * smoothstep(0.35, 0.8, noise(d.x * 18, d.y * 18, d.z * 18 + 9)) * 0.16
        r += amount * n.tone[0]
        g += amount * n.tone[1]
        b += amount * n.tone[2]
      }
      // A touch of grain so the gradients don't band.
      const grain = (rand() - 0.5) * 0.008
      const i = (y * lw + x) * 4
      image.data[i] = Math.min(255, (r + grain) * 255)
      image.data[i + 1] = Math.min(255, (g + grain) * 255)
      image.data[i + 2] = Math.min(255, (b + grain) * 255)
      image.data[i + 3] = 255
      r = 0.012 + 0.05 * Math.exp(-h * 4)
      g = 0.016 + 0.06 * Math.exp(-h * 4) + 0.025 * Math.exp(-h * 14)
      b = 0.04 + 0.11 * Math.exp(-h * 3.2)
    }
    if (y >= rows) {
      for (let x = 0; x < lw; x++) {
        const i = (y * lw + x) * 4
        image.data[i] = r * 255
        image.data[i + 1] = g * 255
        image.data[i + 2] = b * 255
        image.data[i + 3] = 255
      }
    }
  }
  lctx.putImageData(image, 0, 0)

  const w = 2048
  const h = 1024
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(low, 0, 0, w, h)
  // Star dust too faint to pick out one by one, thickest in the Milky Way.
  for (let i = 0; i < 26000; i++) {
    const u = rand()
    const elevation = Math.asin(rand())
    const { b: lat } = toGalaxy(direction(u, elevation, d))
    if (rand() > 0.25 + 0.75 * Math.exp(-((lat / 0.18) ** 2))) continue
    ctx.fillStyle = `rgba(225, 232, 255, ${0.08 + rand() * 0.22})`
    ctx.fillRect(u * w, (0.5 - elevation / Math.PI) * h, 1, 1)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return { texture, toGalaxy }
}

/** Star colours from cool red to hot blue, weighted towards white. */
const STAR_COLOURS = ['#ffcf9e', '#ffe9d0', '#fff6ec', '#ffffff', '#ffffff', '#e8eeff', '#cfdcff', '#b4c8ff']

/**
 * Crisp stars as soft round points that twinkle a little, many faint and a
 * few bright, concentrated towards the Milky Way.
 */
function makeStars(rand: Rand, toGalaxy: (d: Vector3) => { b: number }) {
  const positions: number[] = []
  const colours: number[] = []
  const sizes: number[] = []
  const twinkles: number[] = []
  const v = new Vector3()
  const c = new Color()
  for (let i = 0; i < 7000; i++) {
    const u = rand()
    const elevation = Math.asin(0.01 + rand() * 0.99)
    direction(u, elevation, v)
    const near = Math.exp(-((toGalaxy(v).b / 0.25) ** 2))
    if (rand() > 0.4 + 0.6 * near) continue
    v.multiplyScalar(STAR_RADIUS)
    positions.push(v.x, v.y, v.z)
    // Brightness follows a steep power law, as real star counts do.
    const bright = rand() ** 7
    // Low stars are dimmed and reddened by the extra air they shine through.
    const air = smoothstep(0, 0.35, elevation)
    c.set(STAR_COLOURS[Math.floor(rand() * STAR_COLOURS.length)])
    if (air < 1) c.lerp(new Color('#ffb070'), (1 - air) * 0.4)
    c.multiplyScalar((0.35 + 0.65 * Math.min(1, 0.25 + bright * 1.6)) * (0.5 + 0.5 * air))
    colours.push(c.r, c.g, c.b)
    sizes.push(2.2 + bright * 9)
    twinkles.push(0.08 + 0.3 * (1 - air) + 0.12 * rand())
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3))
  geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1))
  geometry.setAttribute('twinkle', new Float32BufferAttribute(twinkles, 1))
  return geometry
}

function starMaterial() {
  return new ShaderMaterial({
    uniforms: { time: { value: 0 }, pixelRatio: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute float twinkle;
      attribute vec3 color;
      uniform float time;
      uniform float pixelRatio;
      varying vec3 vColor;
      void main() {
        float phase = position.x * 1.7 + position.z * 2.3 + position.y;
        float flicker = 1.0 + twinkle * (0.6 * sin(time * 3.1 + phase) + 0.4 * sin(time * 7.3 + phase * 1.9));
        vColor = color * flicker;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * pixelRatio;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float light = exp(-r * r * 14.0) + 0.18 * exp(-r * 5.0);
        if (light < 0.01) discard;
        gl_FragColor = vec4(vColor * light, 1.0);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
}

/** Twinkles the stars, with points sized for the screen's pixel density. */
function Stars({ geometry, material }: { geometry: BufferGeometry; material: ShaderMaterial }) {
  const pixelRatio = useThree((s) => s.viewport.dpr)
  useFrame(({ clock }) => {
    material.uniforms.time.value = clock.elapsedTime
    material.uniforms.pixelRatio.value = pixelRatio
  })
  return <points geometry={geometry} material={material} />
}

/**
 * The moon's surface as an equirectangular map: albedo in the red channel and
 * height in the green, so the shader can light the relief from the true sun
 * direction. Dark smooth maria, bright rough highlands, and craters of every
 * size with bowls, raised rims and a few bright ray systems.
 */
function paintMoon(rand: Rand) {
  const w = 1024
  const h = 512
  const noise = makeNoise(rand)
  const albedo = new Float32Array(w * h)
  const height = new Float32Array(w * h)
  const dirs: Vector3[] = []
  for (let y = 0; y < h; y++) {
    const theta = ((y + 0.5) / h) * Math.PI
    for (let x = 0; x < w; x++) {
      const phi = ((x + 0.5) / w) * Math.PI * 2
      const d = new Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta))
      dirs.push(d)
      const i = y * w + x
      const mare = smoothstep(0.5, 0.6, noise(d.x * 1.8 + 3, d.y * 1.8, d.z * 1.8, 5))
      const rough = noise(d.x * 14, d.y * 14, d.z * 14, 4)
      albedo[i] = (0.72 + 0.16 * rough) * (1 - 0.55 * mare)
      height[i] = 0.06 * rough * (1 - 0.7 * mare) - 0.04 * mare
    }
  }
  const rays: { at: Vector3; size: number }[] = []
  for (let k = 0; k < 900; k++) {
    const size = 0.005 + rand() ** 6 * 0.13
    const at = new Vector3(gaussian(rand), gaussian(rand), gaussian(rand)).normalize()
    if (rays.length < 5 && size > 0.03 && size < 0.07) rays.push({ at, size })
    const depth = size * 0.7
    const theta = Math.acos(at.y)
    const reach = size * 1.6
    const y0 = Math.max(0, Math.floor(((theta - reach) / Math.PI) * h))
    const y1 = Math.min(h - 1, Math.ceil(((theta + reach) / Math.PI) * h))
    const phi = Math.atan2(at.z, -at.x)
    const span = Math.min(Math.PI, reach / Math.max(0.05, Math.sin(theta)))
    const x0 = Math.floor(((phi - span) / (Math.PI * 2)) * w)
    const x1 = Math.ceil(((phi + span) / (Math.PI * 2)) * w)
    for (let y = y0; y <= y1; y++) {
      for (let xx = x0; xx <= x1; xx++) {
        const x = ((xx % w) + w) % w
        const i = y * w + x
        const dist = Math.acos(Math.min(1, dirs[i].dot(at))) / size
        if (dist > 1.6) continue
        const bowl = dist < 1 ? (dist * dist - 1) * depth : 0
        const rim = depth * 0.3 * Math.exp(-(((dist - 1) / 0.18) ** 2))
        height[i] += bowl + rim
        // Fresh crater floors and walls are a little brighter.
        if (dist < 1.1) albedo[i] *= 1.04
      }
    }
  }
  // Bright rays splashed out from a few young craters.
  for (const { at, size } of rays) {
    const spokes = Array.from({ length: 14 }, () => ({ angle: rand() * Math.PI * 2, length: size * (4 + rand() * 8) }))
    const east = new Vector3(0, 1, 0).cross(at).normalize()
    const north = new Vector3().crossVectors(at, east)
    // Only the rows within reach of the crater need checking.
    const theta = Math.acos(at.y)
    const y0 = Math.max(0, Math.floor(((theta - size * 12) / Math.PI) * h))
    const y1 = Math.min(h, Math.ceil(((theta + size * 12) / Math.PI) * h))
    for (let i = y0 * w; i < y1 * w; i++) {
      const d = dirs[i]
      const dist = Math.acos(Math.min(1, d.dot(at)))
      if (dist < size || dist > size * 12) continue
      const angle = Math.atan2(d.dot(north), d.dot(east))
      for (const s of spokes) {
        const off = Math.abs(((angle - s.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * dist
        if (off < size * 0.35 && dist < s.length) albedo[i] += 0.12 * (1 - dist / s.length) * (1 - off / (size * 0.35))
      }
    }
  }
  const data = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = Math.min(255, albedo[i] * 255)
    data[i * 4 + 1] = Math.min(255, Math.max(0, (0.5 + height[i] * 2) * 255))
    data[i * 4 + 3] = 255
  }
  const texture = new DataTexture(data, w, h)
  texture.wrapS = RepeatWrapping
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

/**
 * Sunlight on the moon: the relief is lit from the sun's direction, with a
 * sharp but slightly soft terminator, as a telescope shows it.
 */
function moonMaterial(map: DataTexture, sun: Vector3) {
  return new ShaderMaterial({
    uniforms: { map: { value: map }, sun: { value: sun }, relief: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vUv = uv;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vPosition = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec3 sun;
      uniform float relief;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      float heightAt(vec2 uv) { return texture2D(map, uv).g; }
      void main() {
        vec3 n = normalize(vNormal);
        vec2 dx = dFdx(vUv);
        vec2 dy = dFdy(vUv);
        // Skip the relief across the map's seam, where the texture coordinates jump.
        float seam = step(0.25, max(abs(dx.x), abs(dy.x)));
        float h0 = heightAt(vUv);
        vec2 slope = vec2(heightAt(vUv + dx) - h0, heightAt(vUv + dy) - h0) * relief * (1.0 - seam);
        vec3 sx = dFdx(vPosition);
        vec3 sy = dFdy(vPosition);
        vec3 r1 = cross(sy, n);
        vec3 r2 = cross(n, sx);
        float det = dot(sx, r1);
        vec3 bumped = normalize(abs(det) * n - sign(det) * (slope.x * r1 + slope.y * r2));
        float albedo = texture2D(map, vUv).r;
        float light = max(dot(bumped, sun), 0.0) * smoothstep(-0.04, 0.1, dot(n, sun));
        vec3 colour = albedo * vec3(1.0, 0.97, 0.92) * (0.01 + 0.95 * light);
        gl_FragColor = vec4(colour, 1.0);
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

/** Now and then a meteor streaks across the part of the sky seen through the opening. */
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
      // Start somewhere in front of the opening and fall slantwise towards the horizon.
      direction(OPENING_U + (rand() - 0.5) * 0.04, 0.6 + rand() * 0.75, s.start).multiplyScalar(STAR_RADIUS - 2)
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
      <meshBasicMaterial
        map={streak}
        transparent
        opacity={0}
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  )
}

/** The night sky outside the observatory, different on every visit. `moon` is where the moon sits. */
export function NightSky({ moon }: { moon: [number, number, number] }) {
  const rand = useMemo(() => randomSource(Math.floor(Math.random() * 2147483646) + 1), [])
  const sky = useMemo(() => paintSky(rand), [rand])
  const stars = useMemo(() => makeStars(rand, sky.toGalaxy), [rand, sky])
  const starShading = useMemo(starMaterial, [])
  const moonMap = useMemo(() => paintMoon(rand), [rand])
  const moonShading = useMemo(() => {
    // Lit from one side of the line of sight from the room, so it shows as a bright gibbous moon.
    const towardsRoom = new Vector3(0, 3, 0).sub(new Vector3(...moon)).normalize()
    return moonMaterial(moonMap, towardsRoom.add(new Vector3(-0.9, 0, 0)).normalize())
  }, [moonMap, moon])
  const halo = useHalo()
  useEffect(
    () => () => {
      sky.texture.dispose()
      moonMap.dispose()
      moonShading.dispose()
      stars.dispose()
      starShading.dispose()
    },
    [sky, moonMap, moonShading, stars, starShading],
  )
  return (
    <group>
      <mesh>
        <sphereGeometry args={[SKY_RADIUS, 64, 32]} />
        <meshBasicMaterial map={sky.texture} side={BackSide} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
      <Stars geometry={stars} material={starShading} />
      {/* Tilted so its poles sit side-on to the room, where the map is least stretched. */}
      <mesh position={moon} rotation={[0.86, 2.2, 0]} material={moonShading}>
        <sphereGeometry args={[2, 128, 64]} />
      </mesh>
      {/* A faint glow of moonlight in the air round it. */}
      <mesh position={moon} renderOrder={1} onUpdate={(m) => m.lookAt(0, 0, 0)}>
        <planeGeometry args={[18, 18]} />
        <meshBasicMaterial
          map={halo}
          color="#dfe6ff"
          transparent
          opacity={0.16}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
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
