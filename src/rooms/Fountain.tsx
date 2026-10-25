import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  InstancedMesh,
  Object3D,
  ShaderMaterial,
  SRGBColorSpace,
} from 'three'
import { useLathe } from '../hooks/useLathe.ts'
import { useTiledTexture } from '../hooks/useTiledTexture.ts'

// The Discovery Fountain in the middle of the main hall: a carved stone
// fountain in three tiers. Water rises from the top, spills from each bowl in
// a falling curtain and ripples in the basin, which glows softly from below,
// with coins on its floor from visitors' wishes. Everything that moves is
// drawn by shaders from one clock, so it costs almost nothing per frame.

/** Heights of the three water surfaces, and the radius of each bowl's rim. */
const BASIN = { water: 0.42, rim: 1.0 }
const MIDDLE = { water: 1.22, rim: 0.58, floor: 1.14 }
const TOP = { water: 1.69, rim: 0.29, floor: 1.64 }

const BASIN_PROFILE: [number, number][] = [
  [1.27, 0],
  [1.27, 0.07],
  [1.16, 0.1],
  [1.13, 0.34],
  [1.17, 0.4],
  [1.18, 0.47],
  [1.14, 0.52],
  [1.03, 0.52],
  [1.0, 0.48],
  [1.0, 0.14],
  [0.001, 0.14],
]

const PEDESTAL_PROFILE: [number, number][] = [
  [0.34, 0.14],
  [0.34, 0.22],
  [0.24, 0.3],
  [0.17, 0.42],
  [0.13, 0.62],
  [0.16, 0.74],
  [0.18, 0.8],
  [0.13, 0.9],
  [0.1, 1.0],
  [0.12, 1.02],
  [0.26, 1.05],
  [0.42, 1.1],
  [0.54, 1.17],
  [0.6, 1.23],
  [0.61, 1.27],
  [0.57, 1.28],
  [0.55, 1.24],
  [0.45, 1.19],
  [0.001, MIDDLE.floor],
]

const UPPER_PROFILE: [number, number][] = [
  [0.09, MIDDLE.floor],
  [0.08, 1.24],
  [0.11, 1.3],
  [0.07, 1.4],
  [0.06, 1.5],
  [0.08, 1.54],
  [0.16, 1.58],
  [0.25, 1.64],
  [0.3, 1.7],
  [0.31, 1.73],
  [0.28, 1.74],
  [0.26, 1.71],
  [0.001, TOP.floor],
]

const FINIAL_PROFILE: [number, number][] = [
  [0.05, TOP.floor],
  [0.06, 1.72],
  [0.04, 1.76],
  [0.065, 1.81],
  [0.05, 1.86],
  [0.02, 1.89],
  [0.012, 1.9],
]

const shared = { time: { value: 0 } }

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
`

/**
 * A water surface: deep teal in the middle, lighter at the edge, with rings
 * spreading from where a curtain of water lands (`ring`, as a fraction of
 * the radius) and glints of the hall's warm lamps on the ripples.
 */
function waterMaterial(ring: number, opacity: number) {
  return new ShaderMaterial({
    uniforms: { time: shared.time, ring: { value: ring }, opacity: { value: opacity } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform float ring;
      uniform float opacity;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        // Rings travelling out from where the falling water lands, fading with distance.
        float d = abs(r - ring);
        float rings = sin(d * 70.0 - time * 5.0) * exp(-d * 9.0);
        // A slow, broken shimmer over the whole surface.
        float n = noise(p * 6.0 + vec2(time * 0.25, -time * 0.18)) + noise(p * 13.0 - vec2(time * 0.31, time * 0.2)) * 0.5;
        float wave = rings * 0.6 + (n - 0.75) * 0.5;
        vec3 deep = vec3(0.04, 0.2, 0.24);
        vec3 shallow = vec3(0.24, 0.52, 0.56);
        vec3 colour = mix(deep, shallow, smoothstep(0.2, 1.0, r) * 0.7 + wave * 0.25);
        // Warm glints of the ceiling lamps caught on the crests.
        colour += vec3(1.0, 0.85, 0.6) * pow(max(wave, 0.0), 3.0) * 0.9;
        // Foam where the water lands.
        colour += vec3(0.85, 0.95, 1.0) * exp(-d * 30.0) * (0.35 + 0.25 * noise(p * 40.0 + time * 3.0));
        gl_FragColor = vec4(colour, opacity);
      }
    `,
    transparent: true,
    depthWrite: false,
  })
}

/** A falling curtain of water: streaks pouring down, thinning as they fall and breaking up at the bottom. */
function curtainMaterial(seed: number) {
  return new ShaderMaterial({
    uniforms: { time: shared.time, seed: { value: seed } },
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
      ${NOISE}
      void main() {
        float fall = 1.0 - vUv.y;
        // Streaks around the rim, scrolling down, faster lower down as the water speeds up.
        float streaks = noise(vec2(vUv.x * 140.0 + seed, fall * 3.0 - time * (2.2 + fall)));
        streaks = smoothstep(0.45, 0.95, streaks) + smoothstep(0.6, 1.0, noise(vec2(vUv.x * 300.0 - seed, fall * 8.0 - time * 4.0))) * 0.6;
        float fade = smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
        float alpha = streaks * fade * (0.55 - fall * 0.25);
        gl_FragColor = vec4(vec3(0.85, 0.94, 1.0) * (0.8 + streaks * 0.4), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  })
}

/** Droplets of the jet from the top, each on its own arc, positioned entirely in the vertex shader. */
function useJet(count = 160) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    const seeds = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      seeds[i * 3] = Math.random()
      seeds[i * 3 + 1] = Math.random() * Math.PI * 2
      seeds[i * 3 + 2] = 0.7 + Math.random() * 0.6
    }
    g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
    g.setAttribute('seed', new BufferAttribute(seeds, 3))
    return g
  }, [count])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { time: shared.time },
        vertexShader: /* glsl */ `
          uniform float time;
          attribute vec3 seed;
          varying float vFade;
          void main() {
            float t = fract(time * 0.55 * seed.z + seed.x);
            // Up from the finial and out in a parabola, landing in the top bowl.
            float out_ = t * 0.24 * seed.z;
            float up = t * 0.62 - t * t * 0.84;
            vec3 p = vec3(cos(seed.y) * out_, 1.9 + up, sin(seed.y) * out_);
            vFade = smoothstep(0.0, 0.1, t) * smoothstep(1.0, 0.75, t);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = 11.0 / -mv.z;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vFade;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.1, d) * vFade * 0.8;
            gl_FragColor = vec4(vec3(0.9, 0.97, 1.0), a);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
  return { geometry, material }
}

/** Coins wished into the basin, scattered over its floor. */
function Coins() {
  const ref = useRef<InstancedMesh>(null)
  const count = 22
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const dummy = new Object3D()
    const colours = [new Color('#d6a640'), new Color('#b87333'), new Color('#c9c3b6')]
    let seed = 7
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    for (let i = 0; i < count; i++) {
      const r = 0.42 + random() * 0.5
      const a = random() * Math.PI * 2
      dummy.position.set(Math.cos(a) * r, 0.145 + i * 0.0002, Math.sin(a) * r)
      dummy.rotation.set((random() - 0.5) * 0.3, random() * Math.PI, (random() - 0.5) * 0.3)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, colours[i % 3])
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <cylinderGeometry args={[0.022, 0.022, 0.004, 12]} />
      <meshStandardMaterial metalness={0.8} roughness={0.35} />
    </instancedMesh>
  )
}

/** A small brass plaque on the basin's front. */
function Plaque() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 0, 128)
    g.addColorStop(0, '#d9b46a')
    g.addColorStop(0.5, '#b88a3e')
    g.addColorStop(1, '#8c6428')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 512, 128)
    ctx.strokeStyle = '#5c3f16'
    ctx.lineWidth = 4
    ctx.strokeRect(10, 10, 492, 108)
    ctx.fillStyle = '#3a2508'
    ctx.textAlign = 'center'
    ctx.font = '38px Georgia, serif'
    ctx.fillText('THE DISCOVERY FOUNTAIN', 256, 62)
    ctx.font = 'italic 24px Georgia, serif'
    ctx.fillText('a new question rises every day', 256, 98)
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh position={[0, 0.25, 1.15]} rotation={[-0.04, 0, 0]}>
      <planeGeometry args={[0.5, 0.125]} />
      <meshStandardMaterial map={texture} metalness={0.6} roughness={0.4} />
    </mesh>
  )
}

export function Fountain() {
  const stone = useTiledTexture('marble', 2, 1)
  const basin = useLathe(BASIN_PROFILE, 48)
  const pedestal = useLathe(PEDESTAL_PROFILE, 40)
  const upper = useLathe(UPPER_PROFILE, 32)
  const finial = useLathe(FINIAL_PROFILE, 16)
  const jet = useJet()
  const materials = useMemo(
    () => ({
      basin: waterMaterial(0.66, 0.82),
      middle: waterMaterial(0.5, 0.88),
      top: waterMaterial(0.2, 0.9),
      upperCurtain: curtainMaterial(1),
      lowerCurtain: curtainMaterial(5),
    }),
    [],
  )
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])
  useFrame(({ clock }) => {
    shared.time.value = clock.elapsedTime
  })

  const stoneMaterial = <meshStandardMaterial color="#e4dccd" map={stone} roughness={0.55} />
  return (
    <group>
      <mesh geometry={basin} castShadow receiveShadow>
        {stoneMaterial}
      </mesh>
      <mesh geometry={pedestal} castShadow receiveShadow>
        {stoneMaterial}
      </mesh>
      <mesh geometry={upper} castShadow>
        {stoneMaterial}
      </mesh>
      <mesh geometry={finial}>
        <meshStandardMaterial color="#b88a3e" metalness={0.7} roughness={0.35} />
      </mesh>

      {/* The basin floor, glowing faintly teal under the water, with the wished-for coins. */}
      <mesh position={[0, 0.141, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[BASIN.rim, 48]} />
        <meshStandardMaterial color="#2c5a60" emissive="#0f4a54" emissiveIntensity={0.9} roughness={0.8} />
      </mesh>
      <Coins />

      {/* Water surfaces. */}
      <mesh position={[0, BASIN.water, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials.basin}>
        <circleGeometry args={[BASIN.rim, 64]} />
      </mesh>
      <mesh position={[0, MIDDLE.water, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials.middle}>
        <circleGeometry args={[MIDDLE.rim - 0.04, 48]} />
      </mesh>
      <mesh position={[0, TOP.water, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials.top}>
        <circleGeometry args={[TOP.rim - 0.03, 32]} />
      </mesh>

      {/* Curtains of water spilling over each bowl's rim, flaring a little as they fall. */}
      <mesh position={[0, (TOP.water + 0.04 + MIDDLE.water) / 2, 0]} material={materials.upperCurtain}>
        <cylinderGeometry args={[TOP.rim + 0.02, TOP.rim + 0.07, TOP.water + 0.04 - MIDDLE.water, 48, 1, true]} />
      </mesh>
      <mesh position={[0, (MIDDLE.water + 0.05 + BASIN.water) / 2, 0]} material={materials.lowerCurtain}>
        <cylinderGeometry args={[MIDDLE.rim + 0.03, MIDDLE.rim + 0.1, MIDDLE.water + 0.05 - BASIN.water, 64, 1, true]} />
      </mesh>
      {/* The droplets' positions come from the shader, so the points are never culled by their (empty) bounds. */}
      <points geometry={jet.geometry} material={jet.material} frustumCulled={false} />

      <Plaque />
      {/* Light rising off the water. */}
      <pointLight position={[0, 0.8, 0]} color="#8fd4e0" intensity={2.2} distance={4.5} decay={2} />
    </group>
  )
}
