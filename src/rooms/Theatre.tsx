import { RoundedBox } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, CanvasTexture, Float32BufferAttribute, SRGBColorSpace, type Texture } from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { Glow } from '../components/Glow.tsx'
import { useTiledTexture } from '../hooks/useTiledTexture.ts'
import { Atmosphere } from './Atmosphere.tsx'
import {
  RECLINER_SCALE,
  THEATRE,
  THEATRE_AISLE,
  THEATRE_LANDING_HEIGHT,
  THEATRE_SEAT_XS,
  THEATRE_TABLE_XS,
  THEATRE_TIERS,
} from './dimensions.ts'
import { RoomShell } from './RoomShell.tsx'

// Soft rectangular lights need this once before use.
RectAreaLightUniformsLib.init()

const HALF_W = THEATRE.width / 2
const HALF_L = THEATRE.length / 2
const SCREEN = { width: 8.5, height: 4, y: 3.1 }
const FRAME = 0.2
const LEATHER = '#4a0e14'
const WARM = '#ffb070'

/** Leather with a soft sheen rather than a plastic shine. */
function Leather({ map }: { map: Texture | null }) {
  return (
    <meshPhysicalMaterial
      color={LEATHER}
      map={map}
      bumpMap={map}
      bumpScale={0.6}
      roughness={0.5}
      clearcoat={0.25}
      clearcoatRoughness={0.6}
    />
  )
}

/** A premium recliner facing the screen (local -z). `reclined` raises the footrest. */
function Recliner({ x, y, z, reclined }: { x: number; y: number; z: number; reclined?: boolean }) {
  const leather = useTiledTexture('leather', 2, 2)
  const back = reclined ? 0.42 : 0.24
  return (
    <group position={[x, y, z]} scale={RECLINER_SCALE}>
      <RoundedBox args={[0.92, 0.22, 0.9]} radius={0.04} position={[0, 0.11, 0.05]} castShadow>
        <meshStandardMaterial color="#1a1012" roughness={0.6} />
      </RoundedBox>
      <RoundedBox args={[0.6, 0.2, 0.72]} radius={0.08} smoothness={4} position={[0, 0.34, -0.02]} castShadow>
        <Leather map={leather} />
      </RoundedBox>
      <group position={[0, 0.32, 0.36]} rotation={[back, 0, 0]}>
        <RoundedBox args={[0.62, 0.86, 0.2]} radius={0.09} smoothness={4} position={[0, 0.43, 0]} castShadow>
          <Leather map={leather} />
        </RoundedBox>
        <RoundedBox args={[0.42, 0.2, 0.1]} radius={0.05} smoothness={4} position={[0, 0.74, -0.12]}>
          <Leather map={leather} />
        </RoundedBox>
      </group>
      {[-0.4, 0.4].map((ax) => (
        <RoundedBox key={ax} args={[0.17, 0.42, 0.86]} radius={0.07} smoothness={4} position={[ax, 0.43, 0.03]} castShadow>
          <Leather map={leather} />
        </RoundedBox>
      ))}
      <group position={[0, 0.3, -0.38]} rotation={[reclined ? -1.25 : 0, 0, 0]}>
        <RoundedBox
          args={[0.58, 0.08, 0.4]}
          radius={0.035}
          position={[0, reclined ? 0 : -0.05, reclined ? -0.2 : 0.02]}
          castShadow
        >
          <Leather map={leather} />
        </RoundedBox>
      </group>
    </group>
  )
}

/** Red-and-white striped popcorn carton texture. */
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
        <meshPhysicalMaterial color="#d8e4ea" transparent opacity={0.5} roughness={0.05} transmission={0.6} />
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

function Screen() {
  const poster = usePosterTexture()
  const z = -HALF_L + 0.15
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
        <meshBasicMaterial map={poster} toneMapped={false} />
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

/** Square frosted wall lamp with a soft wash of light above and below it, and no hard light source. */
function WallLamp({ side, z }: { side: -1 | 1; z: number }) {
  const x = side * (HALF_W - 0.06)
  const facing = side < 0 ? Math.PI / 2 : -Math.PI / 2
  return (
    <group position={[x, 3.3, z]} rotation={[0, facing, 0]}>
      <mesh>
        <boxGeometry args={[0.32, 0.32, 0.08]} />
        <meshStandardMaterial color="#2a1c14" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.041]}>
        <planeGeometry args={[0.26, 0.26]} />
        <meshStandardMaterial color="#ffe0b8" emissive="#ffc690" emissiveIntensity={0.9} />
      </mesh>
      <Glow position={[0, 0.7, 0.02]} size={[1.3, 2]} color={WARM} opacity={0.35} />
      <Glow position={[0, -0.7, 0.02]} size={[1.1, 1.6]} color={WARM} opacity={0.22} />
    </group>
  )
}

/** Fibre-optic star ceiling: tiny points of light. */
function StarCeiling() {
  const geometry = useMemo(() => {
    const points: number[] = []
    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 420; i++) {
      points.push((rand() - 0.5) * (THEATRE.width - 0.6), THEATRE.height - 0.02, (rand() - 0.5) * (THEATRE.length - 0.6))
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

/** Home cinema: tiered floor rising to the entrance, leather recliners, soft wall lamps and a star ceiling. */
export default function Theatre() {
  const popcorn = usePopcornTexture()
  const rows = THEATRE_TIERS.filter((t) => t.rowZ !== undefined)
  return (
    <group>
      <Atmosphere background="#0a0709" fog={[18, 40]} />
      <hemisphereLight args={['#ffd9b8', '#2a1a20', 0.8]} />
      <ambientLight intensity={0.2} color="#ffcfa0" />
      {/* Cove lighting along both side walls: wide, soft and warm. */}
      {[-1, 1].map((side) => (
        <rectAreaLight
          key={side}
          position={[side * (HALF_W - 0.6), THEATRE.height - 0.3, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          width={0.6}
          height={THEATRE.length - 1}
          intensity={2.2}
          color="#ffb880"
        />
      ))}
      <RoomShell
        {...THEATRE}
        floor={{ color: '#ffffff', texture: 'carpet' }}
        walls={{ color: '#ffffff', texture: 'panel' }}
        ceiling={{ color: '#161014' }}
      />
      <StarCeiling />
      <SteppedFloor />
      <LandingRail />
      <ScreenPlinth />
      <Screen />
      <Curtains />

      {rows.map((tier, r) =>
        THEATRE_SEAT_XS.map((x, i) => (
          <Recliner key={`${r}-${x}`} x={x} y={tier.height} z={tier.rowZ!} reclined={(r === 0 && i === 1) || (r === 1 && i === 2)} />
        )),
      )}
      {rows.map((tier, r) =>
        THEATRE_TABLE_XS.map((x) => <SideTable key={`${r}-${x}`} x={x} y={tier.height} z={tier.rowZ! + 0.15} popcorn={popcorn} />),
      )}

      {[-4.5, 0, 4.5].flatMap((z) => [-1, 1].map((side) => <WallLamp key={`${side}-${z}`} side={side as -1 | 1} z={z} />))}
    </group>
  )
}
