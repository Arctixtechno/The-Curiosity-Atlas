import { Html, Sky } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { DoubleSide, type InstancedMesh, Object3D, type PerspectiveCamera, Vector3 } from 'three'
import { Bench } from '../components/Furnishings.tsx'
import { useLathe } from '../hooks/useLathe.ts'
import { useSurfaceTexture, useTiledTexture } from '../hooks/useTiledTexture.ts'
import { findPlace } from '../features/tourism/places.ts'
import { openCityExplorerAt } from '../features/tourism/focus.ts'
import { useDayPhase } from '../world/clock.ts'
import { useInteractable } from '../world/InteractionSystem.tsx'
import { gameStore, useGame } from '../world/store.ts'
import { Atmosphere } from './Atmosphere.tsx'
import { CafeExterior } from './CafeExterior.tsx'
import { CourtyardScenery, LIGHT } from './Courtyard.tsx'
import { COURTYARD, TERRACE } from './dimensions.ts'
import { NightSky } from './NightSky.tsx'
import { LANDMARKS, landmarkTop, Skyline } from './Skyline.tsx'
import { BALUSTER } from './Townhouse.tsx'

// The roof terrace beside the observatory: stone flags behind a marble
// balustrade, with the dome rising behind. Below the parapet is the
// courtyard, fountain and all; to either side the house's slate mansard and
// chimneys; and beyond the houses across the square, London out to the
// landmarks on the horizon. It keeps the same time of day as the rest of the
// house.

const W = TERRACE.width
const D = TERRACE.depth
/** The moon, out over the city in front of the terrace. */
const MOON: [number, number, number] = [-24, 30, 70]
const SKYLINE: [number, number, number] = [85, 125, 175]
const SKYLINE_GROUND: [number, number, number] = [-22, -12, -3]
const SKYLINE_TURN = Math.PI
/** How far below the terrace the courtyard is: the house front's height. */
const HOUSE_HEIGHT = 11
/** The house front's face, just in front of the terrace, in terrace space. */
const HOUSE_FRONT_Z = D / 2 - 0.05
/** The courtyard's own house front is at z = -length / 2; this moves it under the terrace. */
const COURTYARD_SHIFT: [number, number, number] = [0, -HOUSE_HEIGHT, HOUSE_FRONT_Z + COURTYARD.length / 2]

const RAIL_HEIGHT = 0.95
const BALUSTER_SPACING = 0.26
/**
 * Runs of balustrade down the sides, as [x, z] of each end, between the corner posts. Along the front the
 * house's own parapet is the rail.
 */
const RUNS: [[number, number], [number, number]][] = [
  [
    [-W / 2 + TERRACE.balustradeInset, -D / 2 + 0.3],
    [-W / 2 + TERRACE.balustradeInset, D / 2 - TERRACE.balustradeInset],
  ],
  [
    [W / 2 - TERRACE.balustradeInset, -D / 2 + 0.3],
    [W / 2 - TERRACE.balustradeInset, D / 2 - TERRACE.balustradeInset],
  ],
]

function Balustrade() {
  const marble = useTiledTexture('marble', 4, 0.3)
  const baluster = useLathe(BALUSTER, 12)
  const instances = useRef<InstancedMesh>(null)
  const spots = RUNS.flatMap(([[x1, z1], [x2, z2]]) => {
    const length = Math.hypot(x2 - x1, z2 - z1)
    const n = Math.floor(length / BALUSTER_SPACING)
    return Array.from({ length: n - 1 }, (_, i) => {
      const t = (i + 1) / n
      return [x1 + (x2 - x1) * t, z1 + (z2 - z1) * t] as [number, number]
    })
  })
  useLayoutEffect(() => {
    const mesh = instances.current
    if (!mesh) return
    const dummy = new Object3D()
    spots.forEach(([x, z], i) => {
      dummy.position.set(x, 0.14, z)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [spots])
  const stone = <meshStandardMaterial color="#e6dfd2" map={marble} roughness={0.5} />
  const posts = [
    [-W / 2 + TERRACE.balustradeInset, D / 2 - TERRACE.balustradeInset],
    [W / 2 - TERRACE.balustradeInset, D / 2 - TERRACE.balustradeInset],
    [-W / 2 + TERRACE.balustradeInset, -0.2],
    [W / 2 - TERRACE.balustradeInset, -0.2],
  ]
  return (
    <group>
      <instancedMesh ref={instances} args={[baluster, undefined, spots.length]} castShadow>
        {stone}
      </instancedMesh>
      {RUNS.map(([[x1, z1], [x2, z2]], i) => {
        const along = Math.abs(x2 - x1) > Math.abs(z2 - z1)
        const length = Math.hypot(x2 - x1, z2 - z1)
        const size = (h: number, w: number): [number, number, number] => (along ? [length, h, w] : [w, h, length])
        return (
          <group key={i} position={[(x1 + x2) / 2, 0, (z1 + z2) / 2]}>
            <mesh position={[0, 0.07, 0]} receiveShadow>
              <boxGeometry args={size(0.14, 0.32)} />
              {stone}
            </mesh>
            <mesh position={[0, RAIL_HEIGHT - 0.035, 0]} castShadow receiveShadow>
              <boxGeometry args={size(0.07, 0.3)} />
              {stone}
            </mesh>
            <mesh position={[0, RAIL_HEIGHT + 0.02, 0]} castShadow>
              <boxGeometry args={size(0.05, 0.34)} />
              {stone}
            </mesh>
          </group>
        )
      })}
      {posts.map(([x, z]) => (
        <group key={`${x},${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.52, 0]} castShadow>
            <boxGeometry args={[0.38, 1.04, 0.38]} />
            {stone}
          </mesh>
          <mesh position={[0, 1.06, 0]}>
            <boxGeometry args={[0.44, 0.06, 0.44]} />
            {stone}
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** A lantern on a post, the terrace's warm light. */
function Lantern({ x, z, lit }: { x: number; z: number; lit: boolean }) {
  return (
    <group position={[x, 1.09, z]}>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.2, 0.04, 0.2]} />
        <meshStandardMaterial color="#1c1a18" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.16, 0.3, 0.16]} />
        <meshStandardMaterial color="#ffe0a8" emissive="#ffb860" emissiveIntensity={lit ? 1.6 : 0} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <coneGeometry args={[0.15, 0.12, 4]} />
        <meshStandardMaterial color="#1c1a18" metalness={0.6} roughness={0.5} />
      </mesh>
      {lit && <pointLight position={[0, 0.2, 0]} color="#ffb870" intensity={4} distance={6} decay={1.8} />}
    </group>
  )
}

/** A clipped bay tree in a terracotta pot. */
function Bay({ x, z }: { x: number; z: number }) {
  const pot = useLathe(
    [
      [0.001, 0],
      [0.2, 0],
      [0.26, 0.42],
      [0.3, 0.46],
      [0.3, 0.5],
      [0.26, 0.5],
      [0.25, 0.46],
      [0.001, 0.46],
    ],
    20,
  )
  const leaves = useTiledTexture('boxleaf', 1.5, 1.5)
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={pot} castShadow>
        <meshStandardMaterial color="#a8603e" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.025, 0.035, 0.8, 8]} />
        <meshStandardMaterial color="#5a4030" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.45, 0]} castShadow>
        <sphereGeometry args={[0.45, 24, 16]} />
        <meshStandardMaterial color="#7aa060" map={leaves} bumpMap={leaves} bumpScale={2} roughness={0.85} />
      </mesh>
    </group>
  )
}

/** A brass telescope on a wooden tripod, pointed out over the city. */
function SpyGlass() {
  const [x, z] = TERRACE.telescope
  useInteractable({
    position: useMemo(() => new Vector3(x, 1.2, z), [x, z]),
    radius: 1.8,
    prompt: 'Press E to look at the skyline through the spyglass',
    // Deferred so the same key press doesn't also count as opening a landmark.
    onInteract: () => setTimeout(() => gameStore.set({ viewing: SPYGLASS_VIEW })),
  })
  const brass = { color: '#c49a4a', metalness: 0.85, roughness: 0.3 }
  return (
    <group position={[x, 0, z]} rotation={[0, 0.5, 0]}>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2
        return (
          <mesh
            key={i}
            position={[Math.sin(a) * 0.22, 0.6, Math.cos(a) * 0.22]}
            rotation={[Math.cos(a) * -0.33, 0, Math.sin(a) * 0.33]}
          >
            <cylinderGeometry args={[0.018, 0.022, 1.25, 8]} />
            <meshStandardMaterial color="#6a4a30" roughness={0.6} />
          </mesh>
        )
      })}
      <group position={[0, 1.25, 0]} rotation={[0.18, 0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.15]}>
          <cylinderGeometry args={[0.05, 0.035, 0.9, 20]} />
          <meshStandardMaterial {...brass} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.6]}>
          <cylinderGeometry args={[0.058, 0.058, 0.06, 20]} />
          <meshStandardMaterial {...brass} />
        </mesh>
      </group>
    </group>
  )
}

export const SPYGLASS_VIEW = 'spyglass'
const SPY_FOV = { start: 18, min: 4, max: 34 }
/** How close to the middle of the view, in degrees, a landmark has to be to count as pointed at. */
const AIM_DEGREES = 4

/** Each landmark on the horizon, its name, City Explorer entry and where its top is in the room. */
const SKYLINE_LABELS = (Object.keys(LANDMARKS) as (keyof typeof LANDMARKS)[]).map((key) => {
  const place = findPlace(LANDMARKS[key].placeId)!
  const top = landmarkTop(key, { radii: SKYLINE, ground: SKYLINE_GROUND, rotationY: SKYLINE_TURN })
  return { key, place, top: new Vector3(top[0], top[1] + 2.5, top[2]) }
})

/**
 * Looking through the spyglass: the eye moves to the eyepiece and the view
 * narrows, with the landmarks on the horizon named. Aim at one and press E to
 * open it in the City Explorer; Q steps back.
 */
function SpyglassView() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const viewing = useGame((s) => s.viewing === SPYGLASS_VIEW)
  const fov = useRef<number | null>(null)
  const aimed = useRef<string | null>(null)

  useEffect(() => {
    if (!viewing) return
    const saved = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov }
    const [x, z] = TERRACE.telescope
    camera.position.set(x, 1.45, z)
    camera.lookAt(SKYLINE_LABELS[0].top)
    fov.current = SPY_FOV.start
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'KeyE') {
        const place = SKYLINE_LABELS.find((l) => l.place.id === aimed.current)?.place
        gameStore.set({ viewing: null })
        if (place) openCityExplorerAt(place.id)
      } else if (e.code === 'KeyQ') gameStore.set({ viewing: null })
    }
    const onWheel = (e: WheelEvent) => {
      fov.current = Math.min(SPY_FOV.max, Math.max(SPY_FOV.min, (fov.current ?? SPY_FOV.start) * Math.exp(e.deltaY * 0.0015)))
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
      aimed.current = null
      gameStore.set({ viewingTarget: null })
    }
  }, [viewing, camera])

  // Leaving the room always puts the eye back.
  useEffect(() => () => gameStore.set({ viewing: null }), [])

  const forward = useMemo(() => new Vector3(), [])
  const toward = useMemo(() => new Vector3(), [])
  useFrame((_, delta) => {
    if (fov.current === null) return
    if (Math.abs(camera.fov - fov.current) > 0.01) {
      camera.fov += (fov.current - camera.fov) * Math.min(1, delta * 10)
      camera.updateProjectionMatrix()
    }
    // Which landmark, if any, sits in the middle of the view.
    camera.getWorldDirection(forward)
    let best: { id: string; name: string; angle: number } | null = null
    for (const { place, top } of SKYLINE_LABELS) {
      toward.copy(top).sub(camera.position).normalize()
      const angle = (forward.angleTo(toward) * 180) / Math.PI
      if (angle < AIM_DEGREES && (!best || angle < best.angle)) best = { id: place.id, name: place.name, angle }
    }
    const id = best?.id ?? null
    if (id !== aimed.current) {
      aimed.current = id
      gameStore.set({ viewingTarget: best?.name ?? null })
    }
  })

  if (!viewing) return null
  return (
    <>
      {SKYLINE_LABELS.map(({ place, top }) => (
        <Html key={place.id} position={top} center zIndexRange={[5, 0]}>
          <div className="spy-label">{place.name}</div>
        </Html>
      ))}
    </>
  )
}

/** The wall of the observatory's drum, with its copper dome rising behind and a cornice along the top. */
function DomeWall({ night }: { night: boolean }) {
  const render = useSurfaceTexture('plaster', W, 3.4, 9)
  return (
    <group position={[0, 0, -D / 2]}>
      <mesh position={[0, 1.7, 0]} receiveShadow>
        <planeGeometry args={[W, 3.4]} />
        <meshStandardMaterial color="#d8d0c0" map={render} roughness={0.9} />
      </mesh>
      <mesh position={[0, 3.45, 0.08]}>
        <boxGeometry args={[W, 0.14, 0.2]} />
        <meshStandardMaterial color="#ece4d4" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.1, 0.02]}>
        <boxGeometry args={[W, 0.2, 0.05]} />
        <meshStandardMaterial color="#a89c88" roughness={0.9} />
      </mesh>
      {/* The verdigris dome, its ribs catching the moonlight. */}
      <mesh position={[0, 3.5, -5.4]}>
        <sphereGeometry args={[6.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#6f9a8a" metalness={0.4} roughness={0.55} flatShading side={DoubleSide} />
      </mesh>
      {/* A window either side of the door, lit after dark. */}
      {[-2.4, 2.4].map((x) => (
        <group key={x} position={[x, 1.6, 0.01]}>
          <mesh>
            <planeGeometry args={[0.9, 1.5]} />
            <meshStandardMaterial
              color={night ? '#ffd9a0' : '#2a3038'}
              emissive="#ffb868"
              emissiveIntensity={night ? 0.7 : 0}
              roughness={0.1}
              metalness={night ? 0 : 0.4}
            />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[0.04, 1.5]} />
            <meshStandardMaterial color="#e8e0d0" />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[0.9, 0.04]} />
            <meshStandardMaterial color="#e8e0d0" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Floor() {
  const flags = useSurfaceTexture('stone', W, D, 12)
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[W, D]} />
      <meshStandardMaterial color="#b8b0a4" map={flags} bumpMap={flags} bumpScale={0.6} roughness={0.85} />
    </mesh>
  )
}

/** A brick chimney stack with a stone cap and a row of clay pots. */
function Chimney({ x, z, pots }: { x: number; z: number; pots: number }) {
  const brick = useTiledTexture('brick', 1, 1.2)
  const width = pots * 0.42 + 0.2
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.4, 0]} castShadow>
        <boxGeometry args={[width, 2.8, 0.75]} />
        <meshStandardMaterial color="#c8a088" map={brick} roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.86, 0]}>
        <boxGeometry args={[width + 0.12, 0.12, 0.87]} />
        <meshStandardMaterial color="#e6e0d4" roughness={0.8} />
      </mesh>
      {Array.from({ length: pots }, (_, i) => (
        <mesh key={i} position={[(i - (pots - 1) / 2) * 0.42, 3.12, 0]}>
          <cylinderGeometry args={[0.11, 0.14, 0.42, 10]} />
          <meshStandardMaterial color="#b8623e" roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * The house's roof either side of the terrace: a slate mansard rising behind
 * the parapet, with dormer windows, and chimney stacks along the ridge.
 */
function HouseRoof({ night }: { night: boolean }) {
  const slate = useTiledTexture('slate', 16, 3)
  const halfHouse = 22
  const sides = [
    [-halfHouse, -W / 2],
    [W / 2, halfHouse],
  ]
  const mansard = { front: HOUSE_FRONT_Z - 0.6, back: -6, rise: 2.6, slope: 1.2 }
  return (
    <group>
      {sides.map(([from, to]) => {
        const width = to - from
        const cx = (from + to) / 2
        const dormers = Array.from({ length: Math.floor(width / 4) }, (_, i) => from + 2 + i * 4)
        return (
          <group key={from}>
            {/* Lead gutter behind the parapet, then the steep slate slope, then the flat top. */}
            <mesh position={[cx, -0.02, (HOUSE_FRONT_Z + mansard.front) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[width, HOUSE_FRONT_Z - mansard.front]} />
              <meshStandardMaterial color="#6a6e72" roughness={0.7} />
            </mesh>
            <mesh
              position={[cx, mansard.rise / 2, mansard.front - mansard.slope / 2]}
              rotation={[-Math.atan2(mansard.slope, mansard.rise), 0, 0]}
            >
              <planeGeometry args={[width, Math.hypot(mansard.slope, mansard.rise)]} />
              <meshStandardMaterial color="#5a6068" map={slate} roughness={0.75} />
            </mesh>
            <mesh
              position={[cx, mansard.rise, (mansard.front - mansard.slope + mansard.back) / 2]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[width, mansard.front - mansard.slope - mansard.back]} />
              <meshStandardMaterial color="#4e5258" roughness={0.8} />
            </mesh>
            {dormers.map((x) => (
              <group key={x} position={[x, 0.9, mansard.front - 0.45]}>
                <mesh castShadow>
                  <boxGeometry args={[1.2, 1.5, 0.9]} />
                  <meshStandardMaterial color="#f6f1e6" roughness={0.75} />
                </mesh>
                <mesh position={[0, 0.85, 0]} rotation={[0, 0, Math.PI / 4]}>
                  <boxGeometry args={[0.95, 0.95, 0.95]} />
                  <meshStandardMaterial color="#5a6068" map={slate} roughness={0.75} />
                </mesh>
                <mesh position={[0, -0.05, 0.451]}>
                  <planeGeometry args={[0.75, 1.0]} />
                  <meshStandardMaterial
                    color={night ? '#3a2e22' : '#1c242c'}
                    emissive="#ffb45a"
                    emissiveIntensity={night && Math.round(x) % 3 === 0 ? 0.5 : 0}
                    roughness={0.1}
                    metalness={0.4}
                  />
                </mesh>
              </group>
            ))}
            {[from + width * 0.25, from + width * 0.75].map((x) => (
              <Chimney key={x} x={x} z={-2.4} pots={4} />
            ))}
          </group>
        )
      })}
    </group>
  )
}

/** The terrace's floor carried out to the parapet, over the house front's cornice. */
function Leads() {
  return (
    <mesh position={[0, -0.01, (D / 2 + HOUSE_FRONT_Z) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[W, 0.6]} />
      <meshStandardMaterial color="#9a948a" roughness={0.9} />
    </mesh>
  )
}

/** The roof terrace, reached from the observatory. */
export default function RoofTerrace() {
  const phase = useDayPhase()
  const night = phase === 'night'
  const light = LIGHT[phase]
  const sun = night ? MOON : light.sun
  return (
    <group>
      <Atmosphere background={light.air} fog={night ? undefined : [70, 240]} />
      {night ? (
        <NightSky moon={MOON} />
      ) : (
        <Sky
          sunPosition={sun}
          turbidity={phase === 'day' ? 5 : 9}
          rayleigh={phase === 'day' ? 1.2 : 2.5}
          mieCoefficient={0.004}
          mieDirectionalG={0.85}
        />
      )}
      <hemisphereLight args={night ? ['#6a7aa8', '#3a2c20', 1.1] : light.sky} />
      <directionalLight position={sun} intensity={night ? 0.45 : light.sunStrength} color={night ? '#b8c8ff' : light.sunColour} />
      <Skyline radii={SKYLINE} ground={SKYLINE_GROUND} night={night} rotationY={SKYLINE_TURN} />

      {/* The courtyard far below, to look at only. */}
      <group position={COURTYARD_SHIFT}>
        <CourtyardScenery phase={phase} distantHeight={8.5} />
        <CafeExterior />
      </group>
      <HouseRoof night={night} />
      <Leads />

      <Floor />
      <DomeWall night={night} />
      <Balustrade />
      <Lantern x={-W / 2 + TERRACE.balustradeInset} z={D / 2 - TERRACE.balustradeInset} lit={night || phase === 'dusk'} />
      <Lantern x={W / 2 - TERRACE.balustradeInset} z={D / 2 - TERRACE.balustradeInset} lit={night || phase === 'dusk'} />
      {TERRACE.bays.map(([x, z]) => (
        <Bay key={`${x},${z}`} x={x} z={z} />
      ))}
      <Bench position={[TERRACE.bench[0], 0, TERRACE.bench[1]]} length={1.6} />
      <SpyGlass />
      <SpyglassView />
    </group>
  )
}
