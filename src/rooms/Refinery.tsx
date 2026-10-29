import { Sky } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  CanvasTexture,
  DoubleSide,
  type Group,
  type InstancedMesh,
  type Mesh,
  type MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { Label3D } from '../components/Label3D.tsx'
import {
  BLENDING_OVERLAY,
  CDU_OVERLAY,
  CONVERSION_OVERLAY,
  DCS_OVERLAY,
  LIGHT_ENDS_OVERLAY,
  OVERVIEW_OVERLAY,
  REFORMER_OVERLAY,
  SITE_OVERLAY,
  TREATING_OVERLAY,
} from '../features/refinery/overlayIds.ts'
import { lightEndsResult } from '../features/refinery/lightEndsPlant.ts'
import { usePlantClock } from '../features/refinery/clock.ts'
import { getPlant, usePlant } from '../features/refinery/plant.ts'
import { TANKS } from '../features/refinery/tankFarm.ts'
import { useInteractable } from '../world/InteractionSystem.tsx'
import { openOverlay } from '../world/overlay.ts'
import { Atmosphere } from './Atmosphere.tsx'
import { REFINERY } from './dimensions.ts'

// Marshgate Refinery at dusk: an open site on the Thames estuary marshes,
// behind a chain-link fence. The crude unit stands in the middle (furnace,
// column, strippers and reflux drum, tied together by a pipe rack), with the
// units still to come around it, a tank farm and a flare.
//
// Everything here is built from simple shapes with shared materials, and the
// shadows are drawn once, since nothing that casts one moves.

const W = REFINERY.width
const L = REFINERY.length
/** Low sun in the west, for a long orange dusk. */
const SUN: [number, number, number] = [-80, 6, -30]
const HORIZON = '#c08a74'

/**
 * Steel, concrete and insulation, shared by every unit. Metalness is kept
 * low: with no environment to reflect, metallic surfaces render nearly black.
 */
function useMaterials() {
  const m = useMemo(
    () => ({
      steel: new MeshStandardMaterial({ color: '#8f959b', metalness: 0.2, roughness: 0.6 }),
      darkSteel: new MeshStandardMaterial({ color: '#555b61', metalness: 0.15, roughness: 0.7 }),
      // Columns and hot vessels are lagged with aluminium-clad insulation.
      cladding: new MeshStandardMaterial({ color: '#c9cdd1', metalness: 0.3, roughness: 0.4 }),
      yellow: new MeshStandardMaterial({ color: '#d8a92b', roughness: 0.55 }),
      concrete: new MeshStandardMaterial({ color: '#8d8a84', roughness: 0.95 }),
      brick: new MeshStandardMaterial({ color: '#7a4a3a', roughness: 0.9 }),
      tank: new MeshStandardMaterial({ color: '#d9d6cf', metalness: 0.2, roughness: 0.6 }),
      pipe: new MeshStandardMaterial({ color: '#6f757b', metalness: 0.2, roughness: 0.55 }),
      haze: new MeshStandardMaterial({ color: '#6a5f6a', roughness: 1 }),
      lamp: new MeshStandardMaterial({ color: '#ffd8a0', emissive: '#ffb860', emissiveIntensity: 3 }),
      window: new MeshStandardMaterial({ color: '#ffe6b8', emissive: '#ffcf8a', emissiveIntensity: 1.4 }),
    }),
    [],
  )
  useEffect(() => () => Object.values(m).forEach((mat) => mat.dispose()), [m])
  return m
}
type Materials = ReturnType<typeof useMaterials>

/** Asphalt with painted walkways and road lines, drawn once for the whole site. */
function useGroundTexture() {
  const texture = useMemo(() => {
    const ppm = 20
    const canvas = document.createElement('canvas')
    canvas.width = W * ppm
    canvas.height = L * ppm
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#4a4744'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // Speckled aggregate and darker patches.
    let seed = 5
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < 40000; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
      ctx.fillRect(rand() * canvas.width, rand() * canvas.height, 2, 2)
    }
    for (let i = 0; i < 60; i++) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 60 + rand() * 80)
      g.addColorStop(0, 'rgba(20,18,16,0.25)')
      g.addColorStop(1, 'rgba(20,18,16,0)')
      ctx.save()
      ctx.translate(rand() * canvas.width, rand() * canvas.height)
      ctx.fillStyle = g
      ctx.fillRect(-150, -150, 300, 300)
      ctx.restore()
    }
    const px = (x: number) => (x + W / 2) * ppm
    const pz = (z: number) => (z + L / 2) * ppm
    // The main road up from the gate, with its centre line.
    ctx.fillStyle = '#3a3836'
    ctx.fillRect(px(-3), pz(-L / 2), 6 * ppm, L * ppm)
    ctx.fillRect(px(-W / 2), pz(8.5), W * ppm, 5 * ppm)
    ctx.strokeStyle = 'rgba(240, 235, 220, 0.75)'
    ctx.lineWidth = 3
    ctx.setLineDash([3 * ppm, 3 * ppm])
    ctx.beginPath()
    ctx.moveTo(px(0), pz(L / 2))
    ctx.lineTo(px(0), pz(-L / 2))
    ctx.moveTo(px(-W / 2), pz(11))
    ctx.lineTo(px(W / 2), pz(11))
    ctx.stroke()
    // Car park bays by the gate.
    ctx.setLineDash([])
    for (let i = 0; i < 6; i++) {
      const x = px(-17 + i * 2.6)
      ctx.beginPath()
      ctx.moveTo(x, pz(19.5))
      ctx.lineTo(x, pz(24.5))
      ctx.stroke()
    }
    // Yellow pedestrian walkway from the car park to the site board and on to the crude unit.
    ctx.strokeStyle = '#d8b02a'
    ctx.lineWidth = 4
    for (const offset of [-0.7, 0.7]) {
      ctx.beginPath()
      ctx.moveTo(px(-7 + offset), pz(19))
      ctx.lineTo(px(-7 + offset), pz(16 + offset))
      ctx.lineTo(px(1.5 + offset), pz(16 + offset))
      ctx.lineTo(px(1.5 + offset), pz(1))
      ctx.stroke()
    }
    // Bund floors under the units: lighter concrete.
    ctx.fillStyle = 'rgba(160, 155, 145, 0.35)'
    ctx.fillRect(px(-9), pz(-8), 21 * ppm, 13 * ppm)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 8
    return tex
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

/** A diamond-mesh pattern, for the chain-link fence. */
function useChainLink() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = 'rgba(200, 205, 210, 1)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(64, 64)
    ctx.moveTo(64, 0)
    ctx.lineTo(0, 64)
    ctx.stroke()
    const tex = new CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = RepeatWrapping
    return tex
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

function Ground() {
  const site = useGroundTexture()
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, L]} />
        <meshStandardMaterial map={site} roughness={0.95} />
      </mesh>
      {/* Marsh grass outside the fence, out to the fog. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#4a5236" roughness={1} />
      </mesh>
    </>
  )
}

/** Fence posts round the site, with chain link between them and a gap for the gate. */
function Fence() {
  const link = useChainLink()
  const posts = useRef<InstancedMesh>(null)
  const spots = useMemo(() => {
    const list: [number, number][] = []
    for (let x = -W / 2; x <= W / 2; x += 3) list.push([x, -L / 2], [x, L / 2])
    for (let z = -L / 2 + 3; z < L / 2; z += 3) list.push([-W / 2, z], [W / 2, z])
    return list
  }, [])
  useLayoutEffect(() => {
    const dummy = new Object3D()
    spots.forEach(([x, z], i) => {
      dummy.position.set(x, 1.25, z)
      dummy.updateMatrix()
      posts.current!.setMatrixAt(i, dummy.matrix)
    })
    posts.current!.instanceMatrix.needsUpdate = true
  }, [spots])
  const sides: { at: [number, number, number]; rot: number; length: number }[] = [
    { at: [0, 1.2, -L / 2], rot: 0, length: W },
    { at: [-W / 2, 1.2, 0], rot: Math.PI / 2, length: L },
    { at: [W / 2, 1.2, 0], rot: Math.PI / 2, length: L },
    // South side either side of the gate.
    { at: [-W / 4 - 2, 1.2, L / 2], rot: 0, length: W / 2 - 4 },
    { at: [W / 4 + 2, 1.2, L / 2], rot: 0, length: W / 2 - 4 },
  ]
  return (
    <group>
      <instancedMesh ref={posts} args={[undefined, undefined, spots.length]}>
        <cylinderGeometry args={[0.05, 0.05, 2.5, 8]} />
        <meshStandardMaterial color="#6d7378" metalness={0.6} roughness={0.5} />
      </instancedMesh>
      {sides.map(({ at, rot, length }, i) => (
        <mesh key={i} position={at} rotation={[0, rot, 0]}>
          <planeGeometry args={[length, 2.4]} />
          <meshStandardMaterial
            map={link}
            map-repeat={[length * 6, 2.4 * 6]}
            color="#aab0b5"
            transparent
            alphaTest={0.3}
            side={DoubleSide}
            metalness={0.5}
          />
        </mesh>
      ))}
      {/* Gatehouse barrier, raised. */}
      <mesh position={[3.4, 1.0, L / 2 - 0.3]}>
        <boxGeometry args={[0.4, 1.0, 0.4]} />
        <meshStandardMaterial color="#d8d4cc" />
      </mesh>
      <mesh position={[3.4, 3.2, L / 2 - 0.3]} rotation={[0, 0, Math.PI / 2 - 0.15]}>
        <boxGeometry args={[4.5, 0.1, 0.1]} />
        <meshStandardMaterial color="#d23a2a" />
      </mesh>
    </group>
  )
}

/** A vertical vessel: a cylinder with domed heads, on a skirt. */
function Vessel({
  x,
  z,
  radius,
  height,
  base = 0,
  material,
}: {
  x: number
  z: number
  radius: number
  height: number
  base?: number
  material: MeshStandardMaterial
}) {
  return (
    <group position={[x, base, z]}>
      <mesh position={[0, height / 2, 0]} material={material} castShadow>
        <cylinderGeometry args={[radius, radius, height, 28]} />
      </mesh>
      <mesh position={[0, height, 0]} scale={[1, 0.5, 1]} material={material} castShadow>
        <sphereGeometry args={[radius, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  )
}

/** A ring platform with a handrail round a column, every few metres up. */
function Platforms({ x, z, radius, heights, m }: { x: number; z: number; radius: number; heights: number[]; m: Materials }) {
  return (
    <group position={[x, 0, z]}>
      {heights.map((h) => (
        <group key={h} position={[0, h, 0]}>
          <mesh material={m.darkSteel} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[radius, radius + 1.1, 32]} />
          </mesh>
          {/* Top rail and knee rail. */}
          {[1.05, 0.55].map((y) => (
            <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.yellow}>
              <torusGeometry args={[radius + 1.05, 0.03, 4, 40]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Ladder rails up the side. */}
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, heights[heights.length - 1] / 2, radius + 0.45]} material={m.yellow}>
          <boxGeometry args={[0.05, heights[heights.length - 1], 0.05]} />
        </mesh>
      ))}
    </group>
  )
}

/** The crude furnace: radiant box on legs, convection section above, tall stack, and burners glowing through peepholes. */
function Furnace({ m }: { m: Materials }) {
  const { at, size, height } = REFINERY.furnace
  const firing = usePlant((p) => (p.furnace.tripped ? 0 : p.furnace.valve / 100))
  const glow = useMemo(() => new MeshStandardMaterial({ color: '#ff9a4a', emissive: '#ff6a1a' }), [])
  useEffect(() => () => glow.dispose(), [glow])
  glow.emissiveIntensity = 0.3 + firing * 4
  const legs = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (size[0] / 2 - 0.3), sz * (size[1] / 2 - 0.3)] as const))
  return (
    <group position={[at[0], 0, at[1]]}>
      {legs.map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, 1, z]} material={m.darkSteel} castShadow>
          <boxGeometry args={[0.35, 2, 0.35]} />
        </mesh>
      ))}
      <mesh position={[0, 2 + height / 2, 0]} material={m.steel} castShadow receiveShadow>
        <boxGeometry args={[size[0], height, size[1]]} />
      </mesh>
      {/* Peepholes along both long sides, lit by the burners. */}
      {[-1, 1].flatMap((side) =>
        [-2.4, -0.8, 0.8, 2.4].map((x) => (
          <mesh key={`${side},${x}`} position={[x, 3.2, side * (size[1] / 2 + 0.01)]} rotation={[0, side < 0 ? Math.PI : 0, 0]} material={glow}>
            <planeGeometry args={[0.35, 0.25]} />
          </mesh>
        )),
      )}
      {/* Burner glow on the ground under the box. */}
      <pointLight position={[0, 1.2, 0]} color="#ff7a2a" intensity={4 + firing * 30} distance={9} decay={1.6} />
      <mesh position={[0, 2 + height + 1.5, 0]} material={m.steel} castShadow>
        <boxGeometry args={[size[0] - 2, 3, size[1] - 1.2]} />
      </mesh>
      <mesh position={[0, 2 + height + 3.4, 0]} material={m.darkSteel}>
        <boxGeometry args={[2, 0.8, 1.6]} />
      </mesh>
      <mesh position={[0, 2 + height + 3.8 + 9, 0]} material={m.darkSteel} castShadow>
        <cylinderGeometry args={[0.7, 0.8, 18, 20]} />
      </mesh>
      {/* Aircraft warning light on the stack. */}
      <mesh position={[0, 2 + height + 3.8 + 18.2, 0]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#ff4030" emissive="#ff2010" emissiveIntensity={3} />
      </mesh>
      {/* Transfer line from the furnace outlet to the column. */}
      <mesh position={[4.5, 3.4, -1]} rotation={[0, 0, Math.PI / 2]} material={m.cladding} castShadow>
        <cylinderGeometry args={[0.35, 0.35, 9.6, 12]} />
      </mesh>
      <Label3D text="Crude furnace" position={[0, 1.6, size[1] / 2 + 0.05]} scale={2} />
    </group>
  )
}

/** The atmospheric column, its side strippers and the overhead line to the air coolers. */
function CrudeColumn({ m }: { m: Materials }) {
  const { at, radius, height } = REFINERY.column
  const [x, z] = at
  return (
    <group>
      <Vessel x={x} z={z} radius={radius + 0.3} height={2.5} material={m.concrete} />
      <Vessel x={x} z={z} radius={radius} height={height} base={2.5} material={m.cladding} />
      <Platforms x={x} z={z} radius={radius} heights={[8, 14, 20, 26, 32]} m={m} />
      {REFINERY.strippers.map(([sx, sz]) => (
        <Vessel key={sz} x={sx} z={sz} radius={0.6} height={9} base={1} material={m.cladding} />
      ))}
      {/* Side draw lines to the strippers. */}
      {REFINERY.strippers.map(([sx, sz], i) => (
        <mesh key={`draw-${sz}`} position={[(x + sx) / 2, 16 - i * 4, sz]} rotation={[0, 0, Math.PI / 2]} material={m.pipe}>
          <cylinderGeometry args={[0.12, 0.12, sx - x, 8]} />
        </mesh>
      ))}
      {/* Overhead vapour line up and over to the air coolers on the rack. */}
      <mesh position={[x, height + 2.5 + radius * 0.5 + 1.2, z]} material={m.cladding}>
        <cylinderGeometry args={[0.45, 0.45, 2.4, 12]} />
      </mesh>
      <mesh position={[x + 2, height + 2.5 + radius * 0.5 + 2.4, z + 5]} rotation={[Math.PI / 2 - 0.35, 0, -0.2]} material={m.cladding}>
        <cylinderGeometry args={[0.45, 0.45, 13, 12]} />
      </mesh>
      <mesh position={[x + 4, (height + 2.5 + REFINERY.rack.height) / 2 + 2, REFINERY.rack.z]} material={m.cladding}>
        <cylinderGeometry args={[0.45, 0.45, height - REFINERY.rack.height + 4, 12]} />
      </mesh>
      {/* Reflux drum on its saddles. */}
      <group position={[REFINERY.refluxDrum[0], 1.6, REFINERY.refluxDrum[1]]}>
        <mesh rotation={[0, 0, Math.PI / 2]} material={m.tank} castShadow>
          <capsuleGeometry args={[0.95, 3.2, 8, 20]} />
        </mesh>
        {[-1.2, 1.2].map((sx) => (
          <mesh key={sx} position={[sx, -0.9, 0]} material={m.concrete}>
            <boxGeometry args={[0.4, 1.4, 1.6]} />
          </mesh>
        ))}
      </group>
      {/* Lights up the column at dusk. */}
      {[8, 14, 20, 26, 32].map((h, i) => (
        <mesh key={h} position={[x + Math.sin(i * 2.1) * (radius + 1.1), h + 1.6, z + Math.cos(i * 2.1) * (radius + 1.1)]} material={m.lamp}>
          <sphereGeometry args={[0.12, 8, 8]} />
        </mesh>
      ))}
      <pointLight position={[x, 3, z + radius + 2.5]} color="#ffc070" intensity={10} distance={12} decay={1.6} />
    </group>
  )
}

/** Field instrument panel at the foot of the column: opens the crude unit's operator screen. */
function FieldPanel() {
  const [x, z] = REFINERY.column.at
  const pz = z + REFINERY.column.radius + 1.6
  useInteractable({
    position: useMemo(() => new Vector3(x, 1.2, pz), [x, pz]),
    radius: 2.8,
    prompt: 'Press E to run the crude distillation unit',
    onInteract: () => openOverlay(CDU_OVERLAY),
  })
  return (
    <group position={[x, 0, pz]}>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[0.1, 1.5, 0.1]} />
        <meshStandardMaterial color="#555b60" metalness={0.5} />
      </mesh>
      <mesh position={[0, 1.35, 0.05]}>
        <boxGeometry args={[0.9, 0.7, 0.12]} />
        <meshStandardMaterial color="#3a4a5a" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.38, 0.115]}>
        <planeGeometry args={[0.72, 0.48]} />
        <meshStandardMaterial color="#1a3a2a" emissive="#4adf8a" emissiveIntensity={0.9} />
      </mesh>
      <Label3D text="Unit 100 · Crude distillation" position={[0, 2.05, 0.1]} scale={1.3} />
    </group>
  )
}

/** The pipe rack: steel portal frames carrying a bundle of pipes, with air coolers on top above the crude unit. */
function PipeRack({ m }: { m: Materials }) {
  const { z, x, width, height, bay } = REFINERY.rack
  const portals: number[] = []
  for (let px = x[0]; px <= x[1] + 0.01; px += bay) portals.push(px)
  const length = x[1] - x[0]
  const mid = (x[0] + x[1]) / 2
  const pipes = [
    [-1.1, 0.3],
    [-0.6, 0.22],
    [-0.1, 0.35],
    [0.45, 0.18],
    [0.85, 0.25],
    [1.2, 0.15],
  ]
  return (
    <group>
      {portals.map((px) => (
        <group key={px} position={[px, 0, z]}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, height / 2, (s * width) / 2]} material={m.steel} castShadow>
              <boxGeometry args={[0.3, height, 0.3]} />
            </mesh>
          ))}
          <mesh position={[0, height, 0]} material={m.steel}>
            <boxGeometry args={[0.3, 0.35, width + 0.3]} />
          </mesh>
          <mesh position={[0, height - 2.5, 0]} material={m.steel}>
            <boxGeometry args={[0.25, 0.3, width + 0.3]} />
          </mesh>
        </group>
      ))}
      {pipes.map(([offset, r], i) => (
        <mesh key={i} position={[mid, height + 0.2 + r, z + offset]} rotation={[0, 0, Math.PI / 2]} material={i % 3 === 0 ? m.cladding : m.pipe}>
          <cylinderGeometry args={[r, r, length, 10]} />
        </mesh>
      ))}
      {pipes.slice(0, 3).map(([offset, r], i) => (
        <mesh key={`low${i}`} position={[mid, height - 2.3 + r, z + offset]} rotation={[0, 0, Math.PI / 2]} material={m.pipe}>
          <cylinderGeometry args={[r * 0.8, r * 0.8, length, 10]} />
        </mesh>
      ))}
      {/* Air coolers (fin fans) on a deck above the rack: they condense the column's overhead vapour. */}
      <mesh position={[9, height + 2.2, z]} material={m.darkSteel} castShadow>
        <boxGeometry args={[10, 0.8, width + 1]} />
      </mesh>
      {[5.5, 8, 10.5, 13].map((fx) => (
        <mesh key={fx} position={[fx, height + 2.65, z]} material={m.steel}>
          <cylinderGeometry args={[1, 1, 0.12, 20]} />
        </mesh>
      ))}
      {[4.2, 13.8].flatMap((fx) =>
        [-1, 1].map((s) => (
          <mesh key={`${fx}${s}`} position={[fx, height + 1, z + s * (width / 2 + 0.3)]} material={m.steel}>
            <boxGeometry args={[0.2, 2, 0.2]} />
          </mesh>
        )),
      )}
    </group>
  )
}

/** A beacon on the control room roof that flashes amber while the DCS has an unacknowledged alarm, red for a high-priority one. */
function AlarmBeacon({ position }: { position: [number, number, number] }) {
  const lamp = useRef<Mesh>(null)
  const state = useRef<'off' | 'medium' | 'high'>('off')
  const since = useRef(1)
  useFrame(({ clock }, dt) => {
    since.current += dt
    if (since.current >= 0.5) {
      since.current = 0
      const open = getPlant().dcsAlarms.filter((a) => !a.acked && a.shelvedUntil === undefined)
      state.current = open.some((a) => a.priority === 'high') ? 'high' : open.length ? 'medium' : 'off'
    }
    if (!lamp.current) return
    const material = lamp.current.material as MeshBasicMaterial
    const on = state.current !== 'off' && Math.sin(clock.elapsedTime * 8) > 0
    material.color.set(!on ? '#3a3a36' : state.current === 'high' ? '#ff3a2a' : '#ffb020')
  })
  return (
    <mesh ref={lamp} position={position}>
      <cylinderGeometry args={[0.18, 0.22, 0.4, 12]} />
      <meshBasicMaterial color="#3a3a36" toneMapped={false} />
    </mesh>
  )
}

/** The blast-resistant control room: low concrete walls, lit windows and its door. */
function ControlRoom({ m }: { m: Materials }) {
  const { at, size, height } = REFINERY.controlRoom
  const front = at[1] + size[1] / 2
  useInteractable({
    position: useMemo(() => new Vector3(at[0], 1.2, front + 0.6), [at, front]),
    radius: 2.6,
    prompt: 'Press E to sit at the control room DCS: every unit, alarms and trends',
    onInteract: () => openOverlay(DCS_OVERLAY),
  })
  return (
    <group position={[at[0], 0, at[1]]}>
      <AlarmBeacon position={[size[0] / 2 - 0.6, height + 0.5, size[1] / 2 - 0.6]} />
      <mesh position={[0, height / 2, 0]} material={m.concrete} castShadow receiveShadow>
        <boxGeometry args={[size[0], height, size[1]]} />
      </mesh>
      <mesh position={[0, height + 0.15, 0]} material={m.darkSteel}>
        <boxGeometry args={[size[0] + 0.3, 0.3, size[1] + 0.3]} />
      </mesh>
      {/* A strip of small windows (blast-rated), lit from inside. */}
      {[-4.2, -2.4, 2.4, 4.2].map((x) => (
        <mesh key={x} position={[x, 2.4, size[1] / 2 + 0.01]} material={m.window}>
          <planeGeometry args={[1.1, 0.7]} />
        </mesh>
      ))}
      <mesh position={[0, 1.15, size[1] / 2 + 0.01]}>
        <planeGeometry args={[1.4, 2.3]} />
        <meshStandardMaterial color="#5a6a78" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.5, size[1] / 2 + 0.25]} material={m.lamp}>
        <boxGeometry args={[0.5, 0.1, 0.2]} />
      </mesh>
      <pointLight position={[0, 2.6, size[1] / 2 + 1.2]} color="#ffd8a0" intensity={6} distance={8} decay={1.8} />
      <Label3D text="Control room" position={[0, 3.4, size[1] / 2 + 0.05]} scale={2} />
    </group>
  )
}

/** The site board by the car park: opens the guide to the whole refinery. */
function SiteBoard() {
  const [x, z] = REFINERY.board
  useInteractable({
    position: useMemo(() => new Vector3(x, 1.4, z), [x, z]),
    radius: 3,
    prompt: 'Press E to read the site board: how a refinery works',
    onInteract: () => openOverlay(OVERVIEW_OVERLAY),
  })
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#0f3a5a'
    ctx.fillRect(0, 0, 512, 256)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 34px system-ui, sans-serif'
    ctx.fillText('MARSHGATE REFINERY', 26, 52)
    ctx.font = '22px system-ui, sans-serif'
    ctx.fillStyle = '#cfe2f0'
    ctx.fillText('Site plan · Process units · Safety', 26, 88)
    // A little block diagram.
    ctx.strokeStyle = '#ffd25a'
    ctx.lineWidth = 3
    const boxes = [
      [30, 120],
      [140, 120],
      [250, 110],
      [250, 170],
      [360, 120],
      [360, 180],
    ]
    for (const [bx, by] of boxes) ctx.strokeRect(bx, by, 80, 40)
    ctx.beginPath()
    ctx.moveTo(110, 140)
    ctx.lineTo(140, 140)
    ctx.moveTo(220, 140)
    ctx.lineTo(250, 130)
    ctx.moveTo(220, 140)
    ctx.lineTo(250, 190)
    ctx.moveTo(330, 130)
    ctx.lineTo(360, 140)
    ctx.moveTo(330, 190)
    ctx.lineTo(360, 200)
    ctx.stroke()
    ctx.fillStyle = '#ffd25a'
    ctx.fillRect(0, 236, 512, 20)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    return tex
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <group position={[x, 0, z]}>
      {[-1.1, 1.1].map((px) => (
        <mesh key={px} position={[px, 1.1, 0]}>
          <boxGeometry args={[0.1, 2.2, 0.1]} />
          <meshStandardMaterial color="#6d7378" metalness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 1.7, 0.06]}>
        <planeGeometry args={[2.4, 1.2]} />
        <meshStandardMaterial map={texture} emissiveMap={texture} emissive="#ffffff" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 1.7, 0]}>
        <boxGeometry args={[2.5, 1.3, 0.08]} />
        <meshStandardMaterial color="#2a2e32" />
      </mesh>
    </group>
  )
}

/**
 * A unit's name board: opens its operator screen, or says when it's coming. `at` is in the parent group's
 * coordinates, so the interaction point is read back from the board's world position once it is placed.
 */
function UnitSign({ at, text, prompt, overlay, height = 2.4 }: { at: [number, number]; text: string; prompt: string; overlay?: string; height?: number }) {
  const anchor = useRef<Group>(null)
  const position = useMemo(() => new Vector3(at[0], 1.2, at[1]), [at])
  useLayoutEffect(() => {
    if (!anchor.current) return
    anchor.current.updateWorldMatrix(true, false)
    anchor.current.getWorldPosition(position)
  })
  useInteractable({ position, radius: 3, prompt, onInteract: overlay ? () => openOverlay(overlay) : undefined })
  return (
    <group ref={anchor} position={[at[0], 1.2, at[1]]}>
      <Label3D text={text} position={[0, height - 1.2, 0]} scale={2.2} />
    </group>
  )
}

/** The vacuum column: shorter and much fatter than the crude column, because vapour under vacuum takes up so much room. */
function VacuumUnit({ m }: { m: Materials }) {
  const { at, radius, height } = REFINERY.vacuum
  return (
    <group>
      <Vessel x={at[0]} z={at[1]} radius={radius * 0.55} height={6} material={m.cladding} />
      <Vessel x={at[0]} z={at[1]} radius={radius} height={height - 10} base={6} material={m.cladding} />
      <Vessel x={at[0]} z={at[1]} radius={radius * 0.5} height={6} base={height - 4} material={m.cladding} />
      <Platforms x={at[0]} z={at[1]} radius={radius} heights={[8, 14]} m={m} />
      <UnitSign
        at={[at[0], at[1] + radius + 1.4]}
        text="Unit 200 · Vacuum distillation"
        prompt="Press E to run the vacuum unit and cat cracker"
        overlay={CONVERSION_OVERLAY}
      />
    </group>
  )
}

/** The fluid catalytic cracker: a steel structure holding the regenerator, the reactor above it, and the riser between. */
function CatCracker({ m }: { m: Materials }) {
  const { at, size } = REFINERY.fcc
  const [x, z] = at
  const levels = [6, 12, 18, 24]
  return (
    <group position={[x, 0, z]}>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx},${sz}`} position={[(sx * size) / 2, 14, (sz * size) / 2]} material={m.steel} castShadow>
            <boxGeometry args={[0.4, 28, 0.4]} />
          </mesh>
        )),
      )}
      {levels.map((h) => (
        <mesh key={h} position={[0, h, 0]} material={m.darkSteel} receiveShadow>
          <boxGeometry args={[size, 0.2, size]} />
        </mesh>
      ))}
      {/* Regenerator: fat vessel low down, where the coke is burnt off the catalyst. */}
      <Vessel x={-1.5} z={0} radius={3.2} height={12} base={4} material={m.cladding} />
      {/* Reactor and its cyclones up top. */}
      <Vessel x={2} z={1} radius={1.6} height={8} base={20} material={m.cladding} />
      {/* The riser, where hot catalyst meets the oil. */}
      <mesh position={[3.3, 14, 1]} material={m.cladding}>
        <cylinderGeometry args={[0.5, 0.5, 20, 12]} />
      </mesh>
      {/* Main column alongside. */}
      <Vessel x={size / 2 + 3} z={-2} radius={1.8} height={24} material={m.cladding} />
      {levels.map((h, i) => (
        <mesh key={`l${h}`} position={[size / 2, h + 0.4, i % 2 ? 2 : -2]} material={m.lamp}>
          <sphereGeometry args={[0.13, 8, 8]} />
        </mesh>
      ))}
      <UnitSign
        at={[size / 2 + 1, size / 2 + 1.6]}
        text="Unit 300 · Cat cracker"
        prompt="Press E to run the cat cracker and vacuum unit"
        overlay={CONVERSION_OVERLAY}
      />
    </group>
  )
}

/** The catalytic reformer: a row of reactors with the furnace that reheats the oil between them. */
function Reformer({ m }: { m: Materials }) {
  const { at, size } = REFINERY.reformer
  const [x, z] = at
  return (
    <group position={[x, 0, z]}>
      {[-4.5, -1.5, 1.5, 4.5].map((rx, i) => (
        <Vessel key={rx} x={rx} z={-1.6} radius={1.1 + i * 0.12} height={8 + i} base={1} material={m.cladding} />
      ))}
      <mesh position={[0, 3.5, 2]} material={m.steel} castShadow>
        <boxGeometry args={[size[0] - 1, 5, 2.4]} />
      </mesh>
      {[-4, 0, 4].map((sx) => (
        <mesh key={sx} position={[sx, 10, 2]} material={m.darkSteel}>
          <cylinderGeometry args={[0.4, 0.45, 10, 12]} />
        </mesh>
      ))}
      <UnitSign
        at={[0, size[1] / 2 + 1.2]}
        text="Unit 500 · Catalytic reformer"
        prompt="Press E to run the naphtha hydrotreater and reformer"
        overlay={REFORMER_OVERLAY}
      />
    </group>
  )
}

/** The diesel hydrotreater's reactors and the sulphur plant, with its incinerator stack and sulphur pit. */
function Treating({ m }: { m: Materials }) {
  const { at, size } = REFINERY.treating
  const [x, z] = at
  return (
    <group position={[x, 0, z]}>
      <Vessel x={-2.6} z={-1.2} radius={1.1} height={9} base={1} material={m.cladding} />
      <Vessel x={-0.2} z={-1.2} radius={1.1} height={9} base={1} material={m.cladding} />
      {/* Claus furnace and converters, low and long. */}
      <mesh position={[2.2, 1.4, -1]} rotation={[Math.PI / 2, 0, 0]} material={m.steel} castShadow>
        <cylinderGeometry args={[1, 1, 3.6, 16]} />
      </mesh>
      <mesh position={[2.2, 1, 1.4]} material={m.darkSteel} castShadow>
        <boxGeometry args={[3, 2, 1.4]} />
      </mesh>
      <mesh position={[size[0] / 2 - 0.6, 7, -1.8]} material={m.darkSteel} castShadow>
        <cylinderGeometry args={[0.35, 0.45, 14, 12]} />
      </mesh>
      {/* The sulphur pit, its liquid sulphur showing through the grating. */}
      <mesh position={[-1.4, 0.06, 1.9]} rotation={[-Math.PI / 2, 0, 0]} material={m.yellow}>
        <planeGeometry args={[3, 1.2]} />
      </mesh>
      <UnitSign
        at={[0, size[1] / 2 + 1.2]}
        text="Units 600–700 · Hydrotreating and sulphur"
        prompt="Press E to run the diesel hydrotreater and sulphur plant"
        overlay={TREATING_OVERLAY}
      />
    </group>
  )
}

/** A status lamp that shows whether a product is on spec, checked once a second rather than every frame. */
function SpecLamp({ position, check }: { position: [number, number, number]; check: () => boolean }) {
  const lamp = useRef<Mesh>(null)
  const since = useRef(1)
  useFrame((_, dt) => {
    since.current += dt
    if (since.current < 1 || !lamp.current) return
    since.current = 0
    ;(lamp.current.material as MeshBasicMaterial).color.set(check() ? '#6fe08a' : '#ff5a3a')
  })
  return (
    <mesh ref={lamp} position={position}>
      <sphereGeometry args={[0.16, 12, 12]} />
      <meshBasicMaterial color="#6fe08a" toneMapped={false} />
    </mesh>
  )
}

/** The gas plant, isomerisation and alkylation: slim columns, LPG spheres on legs, and the alkylation contactors, frosted cold. */
function LightEnds({ m }: { m: Materials }) {
  const { at, size } = REFINERY.lightEnds
  const [x, z] = at
  const frost = useMemo(() => new MeshStandardMaterial({ color: '#dfe9f2', roughness: 0.35, metalness: 0.1 }), [])
  useEffect(() => () => frost.dispose(), [frost])
  return (
    <group position={[x, 0, z]}>
      {/* Depropaniser and deisobutaniser. */}
      <Vessel x={-3} z={-2} radius={0.6} height={16} material={m.cladding} />
      <Vessel x={-1.3} z={-2} radius={0.9} height={20} material={m.cladding} />
      <Platforms x={-1.3} z={-2} radius={0.9} heights={[7, 14]} m={m} />
      {/* Isomerisation reactors, in series. */}
      <Vessel x={1} z={-2.2} radius={0.6} height={5} base={0.6} material={m.steel} />
      <Vessel x={2.4} z={-2.2} radius={0.6} height={5} base={0.6} material={m.steel} />
      {/* Alkylation contactors, lying down, kept a few degrees above freezing. */}
      {[0.6, 1.9].map((cz) => (
        <mesh key={cz} position={[-1.2, 1.1, cz]} rotation={[0, 0, Math.PI / 2]} material={frost} castShadow>
          <cylinderGeometry args={[0.6, 0.6, 3.4, 20]} />
        </mesh>
      ))}
      {/* LPG storage spheres on their legs. */}
      {[[2.4, 1.4]].map(([sx, sz]) => (
        <group key={sx} position={[sx, 0, sz]}>
          <mesh position={[0, 3.2, 0]} material={m.tank} castShadow>
            <sphereGeometry args={[1.5, 24, 16]} />
          </mesh>
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2
            return (
              <mesh key={i} position={[Math.cos(a) * 1.35, 1.6, Math.sin(a) * 1.35]} material={m.darkSteel}>
                <cylinderGeometry args={[0.07, 0.07, 3.2, 6]} />
              </mesh>
            )
          })}
        </group>
      ))}
      <SpecLamp position={[-3, 1.5, -1.3]} check={() => lightEndsResult(getPlant()).gasPlant.butaneInPropane <= 2.5} />
      <UnitSign
        at={[0, size[1] / 2 + 1.2]}
        text="Units 800–1000 · Gas plant, isom, alkylation"
        prompt="Press E to run the gas plant, isomerisation and alkylation"
        overlay={LIGHT_ENDS_OVERLAY}
      />
    </group>
  )
}

/** The blend header: a run-down line from every component tank, the in-line analysers in their hut, and lamps for the two pools. */
function Blending({ m }: { m: Materials }) {
  const { at, size } = REFINERY.blending
  const [x, z] = at
  const colours = ['#9fd0e0', '#b8e08a', '#f0c050', '#e0a458', '#d6e8f0', '#c8a0e0', '#d9733c', '#a8c878']
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.08, 0]} material={m.concrete} receiveShadow>
        <boxGeometry args={[size[0], 0.16, size[1]]} />
      </mesh>
      {/* Component lines rising to the header. */}
      {colours.map((c, i) => (
        <mesh key={c} position={[-1.4, 0.9, -2 + i * 0.5]}>
          <cylinderGeometry args={[0.13, 0.13, 1.6, 8]} />
          <meshStandardMaterial color={c} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[-1.4, 1.7, -0.25]} rotation={[Math.PI / 2, 0, 0]} material={m.pipe}>
        <cylinderGeometry args={[0.16, 0.16, 4, 10]} />
      </mesh>
      {/* Analyser house. */}
      <mesh position={[0.6, 1.1, 0.6]} material={m.tank} castShadow>
        <boxGeometry args={[1.6, 2.2, 1.8]} />
      </mesh>
      <mesh position={[0.6, 2.25, 0.6]} material={m.darkSteel}>
        <boxGeometry args={[1.8, 0.1, 2]} />
      </mesh>
      <SpecLamp position={[1.45, 1.8, 0.2]} check={() => lightEndsResult(getPlant()).petrol.blend.onSpec} />
      <SpecLamp position={[1.45, 1.8, 1]} check={() => lightEndsResult(getPlant()).diesel.blend.onSpec} />
      <UnitSign at={[0, size[1] / 2 + 0.8]} text="Blending · petrol and diesel" prompt="Press E to blend petrol and diesel" overlay={BLENDING_OVERLAY} />
    </group>
  )
}

/** Storage tanks with floating roofs, in the tank farm. The roof rides on the oil, and a gauge board on the shell shows the level. */
function Tanks({ m }: { m: Materials }) {
  const r = REFINERY.tankRadius
  const levels = usePlant((p) => p.tanks.levels)
  return (
    <group>
      {REFINERY.tanks.map(({ at, label, tank }) => {
        const share = Math.min(1, levels[tank] / TANKS[tank].capacity)
        const y = 0.5 + share * 8.2
        return (
          <group key={label} position={[at[0], 0, at[1]]}>
            <mesh position={[0, 4.5, 0]} material={m.tank} castShadow receiveShadow>
              <cylinderGeometry args={[r, r, 9, 40, 1, true]} />
            </mesh>
            <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.darkSteel}>
              <circleGeometry args={[r - 0.05, 40]} />
            </mesh>
            <mesh position={[0, 9.05, 0]} material={m.yellow}>
              <torusGeometry args={[r, 0.04, 4, 48]} />
            </mesh>
            {/* Stairs spiralling up the shell, drawn as a single sloping band. */}
            <mesh position={[0, 4.5, 0]} rotation={[0, 0, 0]} material={m.darkSteel}>
              <cylinderGeometry args={[r + 0.06, r + 0.06, 0.25, 40, 1, true, 0, 0.6]} />
            </mesh>
            {/* Float gauge board: the marker rides up and down with the roof. */}
            <mesh position={[-1.6, 4.5, r + 0.02]} material={m.darkSteel}>
              <boxGeometry args={[0.35, 8.6, 0.05]} />
            </mesh>
            <mesh position={[-1.6, y, r + 0.07]}>
              <boxGeometry args={[0.5, 0.18, 0.06]} />
              <meshBasicMaterial color={share > 0.9 || share < 0.08 ? '#ff5a3a' : '#ffd25a'} toneMapped={false} />
            </mesh>
            <Label3D text={`${label} · ${(share * 100).toFixed(0)}%`} position={[0, 5, r + 0.1]} scale={3} />
          </group>
        )
      })}
      <UnitSign at={REFINERY.tankFarmSign} text="Tank farm · plant manager" prompt="Press E for the plant manager: margin, tanks and the jetty" overlay={SITE_OVERLAY} />
    </group>
  )
}

/** The flare stack, with its flame flickering at the top. */
function Flare({ m }: { m: Materials }) {
  const [x, z] = REFINERY.flare
  const height = 45
  const flame = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (flame.current) flame.current.scale.set(1 + Math.sin(t * 9) * 0.08, 1 + Math.sin(t * 6.3) * 0.15 + Math.sin(t * 13) * 0.06, 1)
  })
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, height / 2, 0]} material={m.darkSteel} castShadow>
        <cylinderGeometry args={[0.45, 0.7, height, 12]} />
      </mesh>
      {[12, 24, 36].map((h) => (
        <mesh key={h} position={[0, h, 0]} material={m.yellow}>
          <torusGeometry args={[0.9, 0.05, 4, 20]} />
        </mesh>
      ))}
      <mesh ref={flame} position={[0, height + 2.2, 0]}>
        <coneGeometry args={[1.1, 4.4, 12, 1, true]} />
        <meshBasicMaterial color="#ffb34a" transparent opacity={0.9} side={DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[0, height + 1.4, 0]}>
        <sphereGeometry args={[0.8, 12, 12]} />
        <meshBasicMaterial color="#fff0b0" toneMapped={false} />
      </mesh>
      <pointLight position={[0, height + 2, 0]} color="#ff9a3a" intensity={60} distance={70} decay={1.4} />
    </group>
  )
}

/** Tall lamp posts along the roads, all one instanced mesh. */
function Lamps({ m }: { m: Materials }) {
  const spots: [number, number][] = [
    [3.6, 24],
    [3.6, 14],
    [-3.6, 4],
    [3.6, -10],
    [-3.6, -24],
    [-12, 13.6],
    [12, 8.4],
    [24, 13.6],
    [-26, 8.4],
  ]
  const poles = useRef<InstancedMesh>(null)
  const heads = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const dummy = new Object3D()
    spots.forEach(([x, z], i) => {
      dummy.position.set(x, 4, z)
      dummy.updateMatrix()
      poles.current!.setMatrixAt(i, dummy.matrix)
      dummy.position.set(x, 8, z)
      dummy.updateMatrix()
      heads.current!.setMatrixAt(i, dummy.matrix)
    })
    poles.current!.instanceMatrix.needsUpdate = true
    heads.current!.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      <instancedMesh ref={poles} args={[undefined, m.darkSteel, spots.length]}>
        <cylinderGeometry args={[0.08, 0.12, 8, 8]} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, m.lamp, spots.length]}>
        <boxGeometry args={[0.5, 0.15, 0.3]} />
      </instancedMesh>
    </group>
  )
}

/** Other plants along the estuary, beyond the fence: dark shapes in the haze with a few lights. */
function Distance({ m }: { m: Materials }) {
  const shapes = useMemo(() => {
    let seed = 3
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    return Array.from({ length: 34 }, () => {
      const angle = rand() * Math.PI * 2
      const r = 70 + rand() * 60
      const tall = rand() > 0.6
      return {
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        w: tall ? 2 + rand() * 3 : 8 + rand() * 14,
        h: tall ? 15 + rand() * 30 : 4 + rand() * 8,
      }
    })
  }, [])
  return (
    <group>
      {shapes.map((s, i) => (
        <mesh key={i} position={[s.x, s.h / 2, s.z]} material={m.haze}>
          <boxGeometry args={[s.w, s.h, s.w]} />
        </mesh>
      ))}
    </group>
  )
}

/** Draws the shadow map once: nothing that casts a shadow here moves, and the sun is fixed. */
function StaticShadows() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    return () => {
      gl.shadowMap.autoUpdate = true
    }
  }, [gl])
  return null
}

export default function Refinery() {
  const m = useMaterials()
  // The plant runs while you're on site, so the tanks and furnace move as you walk round.
  usePlantClock()
  return (
    <group>
      <Atmosphere background={HORIZON} fog={[50, 210]} />
      <Sky sunPosition={SUN} turbidity={8} rayleigh={2.5} mieCoefficient={0.006} mieDirectionalG={0.9} />
      <hemisphereLight args={['#cdc6e4', '#6a5a44', 2.1]} />
      <directionalLight
        position={SUN}
        intensity={2.6}
        color="#ffb27a"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-far={200}
        shadow-bias={-0.0008}
      />
      <StaticShadows />
      <Ground />
      <Fence />
      <Lamps m={m} />
      <SiteBoard />
      <ControlRoom m={m} />
      <Furnace m={m} />
      <CrudeColumn m={m} />
      <FieldPanel />
      <PipeRack m={m} />
      <VacuumUnit m={m} />
      <CatCracker m={m} />
      <Reformer m={m} />
      <Treating m={m} />
      <LightEnds m={m} />
      <Blending m={m} />
      <Tanks m={m} />
      <Flare m={m} />
      <Distance m={m} />
      <Label3D text="Atmospheric distillation column" position={[REFINERY.column.at[0], 6, REFINERY.column.at[1] + REFINERY.column.radius + 0.4]} scale={2} />
    </group>
  )
}
