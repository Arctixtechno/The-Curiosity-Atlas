import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  CubeCamera,
  DataTexture,
  Float32BufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh as ThreeMesh,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLCubeRenderTarget,
  type Mesh,
  type WebGLRenderer,
  type MeshBasicMaterial,
} from 'three'
import { useGame } from '../world/store.ts'

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
function galaxy(rand: Rand, near: Vector3) {
  // Close to the moon, so the telescope shows the Milky Way behind it.
  const core = near
    .clone()
    .normalize()
    .add(new Vector3(gaussian(rand), gaussian(rand), gaussian(rand)).normalize().multiplyScalar(0.12))
    .normalize()
  const across = new Vector3(Math.cos(rand() * Math.PI * 2), 0, Math.sin(rand() * Math.PI * 2))
  const pole = new Vector3().crossVectors(core, across).normalize()
  const along = new Vector3().crossVectors(pole, core)
  /** Galactic latitude and longitude of a direction, in radians, with the core at longitude 0. */
  const toGalaxy = (d: Vector3) => ({ b: Math.asin(d.dot(pole)), l: Math.atan2(d.dot(along), d.dot(core)) })
  return { core, pole, along, toGalaxy }
}

/**
 * The soft parts of the sky, worked out for every pixel on the graphics card
 * so it stays sharp at any magnification: a deep gradient with faint airglow
 * at the horizon, the Milky Way with clumps and dust lanes, a few nebulae, and
 * layers of stars too faint to see by eye that come out through the telescope.
 */
function skyMaterial(rand: Rand, moon: Vector3) {
  const { core, pole, along, toGalaxy } = galaxy(rand, moon)
  const nebulae = Array.from({ length: 4 }, () => {
    const at = direction(OPENING_U + gaussian(rand) * 0.12, 0.35 + rand() * 1.1)
    const tone = [
      [1, 0.35, 0.55],
      [0.35, 0.6, 1],
      [0.75, 0.45, 1],
    ][Math.floor(rand() * 3)]
    return { at, size: 0.04 + rand() * 0.06, tone: new Vector3(...tone) }
  })
  const material = new ShaderMaterial({
    uniforms: {
      core: { value: core },
      pole: { value: pole },
      along: { value: along },
      seed: { value: new Vector3(rand() * 100, rand() * 100, rand() * 100) },
      nebulaAt: { value: nebulae.map((n) => n.at) },
      nebulaSize: { value: nebulae.map((n) => n.size) },
      nebulaTone: { value: nebulae.map((n) => n.tone) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 core;
      uniform vec3 pole;
      uniform vec3 along;
      uniform vec3 seed;
      uniform vec3 nebulaAt[4];
      uniform float nebulaSize[4];
      uniform vec3 nebulaTone[4];
      varying vec3 vDir;

      float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
          mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
          f.z);
      }
      float fbm(vec3 p, int octaves) {
        float sum = 0.0;
        float amp = 0.5;
        float norm = 0.0;
        for (int o = 0; o < 8; o++) {
          if (o >= octaves) break;
          sum += amp * noise(p);
          norm += amp;
          p *= 2.03;
          amp *= 0.5;
        }
        return sum / norm;
      }

      // One layer of stars: a random star in some cells of a grid over the
      // sky, drawn about a pixel wide whatever the zoom.
      float starLayer(vec3 d, float scale, float threshold) {
        vec3 p = d * scale;
        float pixel = length(fwidth(p));
        // Only once a cell spans a few pixels, so these stars come out as you
        // zoom in rather than turning the wide view to grain.
        float resolved = smoothstep(0.5, 0.2, pixel);
        if (resolved <= 0.0) return 0.0;
        vec3 cell = floor(p);
        float h = hash(cell + seed);
        if (h < threshold) return 0.0;
        vec3 centre = cell + 0.5 + (vec3(hash(cell + 1.3), hash(cell + 2.7), hash(cell + 5.1)) - 0.5) * 0.7;
        float dist = length(p - centre) / max(pixel, 1e-4);
        return resolved * exp(-dist * dist * 0.9) * pow((h - threshold) / (1.0 - threshold), 2.0);
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = max(0.0, d.y);
        vec3 colour = vec3(
          0.012 + 0.05 * exp(-h * 4.0),
          0.016 + 0.06 * exp(-h * 4.0) + 0.025 * exp(-h * 14.0),
          0.04 + 0.11 * exp(-h * 3.2));

        float lat = asin(clamp(dot(d, pole), -1.0, 1.0));
        float lon = atan(dot(d, along), dot(d, core));
        float coreGlow = 0.45 + 0.55 * exp(-pow(lon / 0.8, 2.0));
        float clumps = fbm(d * 3.0 + seed + 7.0, 8);
        float width = 0.11 + 0.05 * fbm(d * 1.5 + seed.yzx, 3);
        float band = exp(-pow(lat / width, 2.0)) * (0.35 + 0.9 * pow(clumps, 1.5)) + 0.22 * exp(-pow(lat / 0.4, 2.0));
        band *= coreGlow;
        // Star clouds: knots and voids down to small scales, for the telescope.
        band *= 0.55 + 0.9 * fbm(d * 40.0 + seed.yxz, 5);
        // Dust lanes, dark and wispy close to the plane, with fine filaments.
        float dust = smoothstep(0.48, 0.72, fbm(d * 7.0 + seed.zxy, 8)) * exp(-pow((lat - 0.02) / 0.06, 2.0));
        band *= 1.0 - 0.85 * dust;
        float warm = exp(-pow(lon / 0.6, 2.0));
        // Magnified, the Milky Way's glow spreads thin and breaks up into the
        // stars that make it, so the glow fades as the view narrows.
        float pixelAngle = length(fwidth(d));
        float glow = mix(0.3, 1.0, smoothstep(0.00025, 0.0012, pixelAngle));
        colour += band * 0.17 * glow * vec3(0.75 + 0.25 * warm, 0.78 + 0.12 * warm, 0.95 - 0.15 * warm);

        for (int i = 0; i < 4; i++) {
          float a = acos(clamp(dot(d, nebulaAt[i]), -1.0, 1.0));
          float shape = smoothstep(0.35, 0.8, fbm(d * 18.0 + float(i) * 5.0, 5));
          colour += exp(-pow(a / nebulaSize[i], 2.0)) * shape * 0.16 * nebulaTone[i];
        }

        // Unresolved starlight: more and fainter stars come out as you zoom
        // in, thickest along the Milky Way and thinned out by dust.
        float crowd = 0.3 + 0.7 * exp(-pow(lat / 0.2, 2.0)) * (1.0 - 0.7 * dust);
        float stars = starLayer(d, 260.0, 0.93) * 0.6
          + starLayer(d, 700.0, 0.88 - 0.14 * crowd) * 0.5
          + starLayer(d, 1800.0, 0.84 - 0.2 * crowd) * 0.4
          + starLayer(d, 4500.0, 0.8 - 0.25 * crowd) * 0.3;
        colour += stars * crowd * vec3(0.92, 0.95, 1.0);

        // Fade into the haze towards the horizon.
        colour *= mix(0.6, 1.0, smoothstep(-0.05, 0.25, d.y));
        gl_FragColor = vec4(colour, 1.0);
      }
    `,
    side: BackSide,
    depthWrite: false,
  })
  return { material, toGalaxy }
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
      albedo[i] = (0.72 + 0.16 * rough) * (1 - 0.6 * mare)
      height[i] = 0.06 * rough * (1 - 0.7 * mare) - 0.04 * mare
    }
  }
  const rays: { at: Vector3; size: number }[] = []
  for (let k = 0; k < 900; k++) {
    const size = 0.005 + rand() ** 6 * 0.13
    const at = new Vector3(gaussian(rand), gaussian(rand), gaussian(rand)).normalize()
    // The maria are younger lava plains, so far fewer craters landed on them.
    if (noise(at.x * 1.8 + 3, at.y * 1.8, at.z * 1.8, 5) > 0.55 && rand() < 0.75) continue
    if (rays.length < 5 && size > 0.03 && size < 0.07) rays.push({ at, size })
    const depth = size * 0.7
    // Big craters have flat floors and a central peak; small ones are simple bowls.
    const complex = size > 0.035
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
        const bowl = dist < 1 ? Math.max(dist * dist - 1, complex ? -0.6 : -1) * depth : 0
        const rim = depth * 0.3 * Math.exp(-(((dist - 1) / 0.18) ** 2))
        const peak = complex ? depth * 0.14 * Math.exp(-((dist / 0.1) ** 2)) : 0
        // A blanket of thrown-out rock, rough just beyond the rim.
        const ejecta =
          dist > 1 ? depth * 0.06 * Math.exp(-(dist - 1) * 4) * noise(dirs[i].x * 60, dirs[i].y * 60, dirs[i].z * 60, 1) : 0
        height[i] += bowl + rim + peak + ejecta
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
      varying vec3 vSurface;
      void main() {
        vUv = uv;
        vSurface = position;
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
      varying vec3 vSurface;
      float heightAt(vec2 uv) { return texture2D(map, uv).g; }
      float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
          mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
          f.z);
      }
      // Fine rubble and small pits, finer than the map can hold, for close views through the telescope.
      float detail(vec3 p) {
        return noise(p * 24.0) * 0.5 + noise(p * 61.0) * 0.3 + noise(p * 150.0) * 0.2;
      }
      void main() {
        vec3 n = normalize(vNormal);
        vec2 dx = dFdx(vUv);
        vec2 dy = dFdy(vUv);
        // Skip the relief across the map's seam, where the texture coordinates jump.
        float seam = step(0.25, max(abs(dx.x), abs(dy.x)));
        float h0 = heightAt(vUv);
        vec2 slope = vec2(heightAt(vUv + dx) - h0, heightAt(vUv + dy) - h0) * relief * (1.0 - seam);
        float fine = detail(vSurface);
        slope += vec2(dFdx(fine), dFdy(fine)) * 0.006;
        vec3 sx = dFdx(vPosition);
        vec3 sy = dFdy(vPosition);
        vec3 r1 = cross(sy, n);
        vec3 r2 = cross(n, sx);
        float det = dot(sx, r1);
        vec3 bumped = normalize(abs(det) * n - sign(det) * (slope.x * r1 + slope.y * r2));
        float albedo = texture2D(map, vUv).r * (0.94 + 0.12 * fine);
        // The moon is not lit like a matt ball: its dusty surface throws light
        // back towards the sun, so the disc stays bright right to its edge
        // (the lunar-Lambert model, a blend of Lambert and Lommel-Seeliger).
        vec3 view = normalize(cameraPosition - vPosition);
        float incidence = max(dot(bumped, sun), 0.0);
        float emergence = max(dot(n, view), 0.05);
        float lunar = min(1.3, 2.0 * incidence / (incidence + emergence));
        float light = mix(incidence, lunar, 0.7) * smoothstep(-0.03, 0.08, dot(n, sun));
        // Faint earthshine on the night side.
        vec3 colour = albedo * vec3(1.0, 0.975, 0.94) * (0.008 + 0.72 * light);
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

/** Size of each face of the baked sky, in pixels: about one texel per screen pixel at the normal field of view. */
const BAKED_SKY_SIZE = 1024

/**
 * Paints the sky's shader once into a cube map. Its noise and stars don't
 * change, so the room samples this instead of working the sky out for every
 * pixel on every frame, which was most of the observatory's cost.
 */
function bakeSky(gl: WebGLRenderer, material: ShaderMaterial) {
  const target = new WebGLCubeRenderTarget(BAKED_SKY_SIZE)
  const scene = new Scene()
  const geometry = new SphereGeometry(SKY_RADIUS, 64, 32)
  scene.add(new ThreeMesh(geometry, material))
  new CubeCamera(1, SKY_RADIUS * 2, target).update(gl, scene)
  geometry.dispose()
  return target
}

/** Shows the baked sky: one texture look-up per pixel. */
function bakedSkyMaterial(target: WebGLCubeRenderTarget) {
  return new ShaderMaterial({
    uniforms: { sky: { value: target.texture } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform samplerCube sky;
      varying vec3 vDir;
      void main() {
        gl_FragColor = vec4(textureCube(sky, vDir).rgb, 1.0);
      }
    `,
    side: BackSide,
    depthWrite: false,
  })
}

/** The night sky outside the observatory, different on every visit. `moon` is where the moon sits. */
export function NightSky({ moon }: { moon: [number, number, number] }) {
  const rand = useMemo(() => randomSource(Math.floor(Math.random() * 2147483646) + 1), [])
  // The moon's glow in the air only shows by eye, not through the eyepiece.
  const looking = useGame((s) => s.viewing !== null)
  const sky = useMemo(() => skyMaterial(rand, new Vector3(...moon)), [rand, moon])
  // Through the telescope the full shader draws the sky, so fainter stars come out as you zoom; by eye, the baked copy.
  const gl = useThree((s) => s.gl)
  // Baked in an effect so the cube map lives exactly as long as the room shows it.
  const [baked, setBaked] = useState<{ target: WebGLCubeRenderTarget; material: ShaderMaterial } | null>(null)
  useEffect(() => {
    const target = bakeSky(gl, sky.material)
    const material = bakedSkyMaterial(target)
    setBaked({ target, material })
    return () => {
      target.dispose()
      material.dispose()
    }
  }, [gl, sky])
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
      sky.material.dispose()
      moonMap.dispose()
      moonShading.dispose()
      stars.dispose()
      starShading.dispose()
    },
    [sky, moonMap, moonShading, stars, starShading],
  )
  return (
    <group>
      {/* Drawn after the room, so its costly shading only runs where the dome's opening leaves sky showing. */}
      <mesh material={looking || !baked ? sky.material : baked.material} renderOrder={1}>
        <sphereGeometry args={[SKY_RADIUS, 64, 32]} />
      </mesh>
      <Stars geometry={stars} material={starShading} />
      {/* Tilted so its poles sit side-on to the room, where the map is least stretched. */}
      <mesh position={moon} rotation={[0.86, 2.2, 0]} material={moonShading}>
        <sphereGeometry args={[2, 128, 64]} />
      </mesh>
      {/* A faint glow of moonlight in the air round it. */}
      <mesh position={moon} renderOrder={1} visible={!looking} onUpdate={(m) => m.lookAt(0, 0, 0)}>
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
