import { Sky } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, CanvasTexture, type Group, type InstancedMesh, type MeshBasicMaterial, Object3D, SRGBColorSpace } from 'three'
import type { DayPhase } from '../world/clock.ts'
import { Atmosphere } from './Atmosphere.tsx'
import { NightSky } from './NightSky.tsx'

// The refinery's sky and light through the house's day: a high sun by day, the
// long orange dusk it was built for, a misty dawn and a moonlit night when the
// site's own lamps, windows and the flare do most of the lighting.

export interface SiteLight {
  sun: [number, number, number]
  sunColour: string
  sunStrength: number
  /** Sky colour, ground colour and strength of the light from the sky. */
  sky: [string, string, number]
  /** The colour of the air: the background and fog. */
  air: string
  fog: [number, number]
  /** How bright the site's lamps and lit windows are. */
  lamps: number
  windows: number
}

export const SITE_LIGHT: Record<DayPhase, SiteLight> = {
  day: {
    sun: [50, 70, 40],
    sunColour: '#fff1dc',
    sunStrength: 2.7,
    sky: ['#dbe7ff', '#6a6a50', 1.8],
    air: '#b4c2d0',
    fog: [60, 230],
    lamps: 0.15,
    windows: 0.45,
  },
  dusk: {
    sun: [-80, 6, -30],
    sunColour: '#ffb27a',
    sunStrength: 2.6,
    sky: ['#cdc6e4', '#6a5a44', 2.1],
    air: '#c08a74',
    fog: [50, 210],
    lamps: 2,
    windows: 1.4,
  },
  dawn: { sun: [80, 8, 20], sunColour: '#ffc090', sunStrength: 1.7, sky: ['#d8d0f0', '#4a4a50', 1.4], air: '#c4b2b8', fog: [30, 170], lamps: 2, windows: 1.2 },
  night: {
    sun: [-40, 50, 60],
    sunColour: '#b8c8ff',
    sunStrength: 0.4,
    sky: ['#30406a', '#15161a', 0.55],
    air: '#090c15',
    fog: [45, 200],
    lamps: 3.2,
    windows: 1.6,
  },
}

/** The night sky is drawn round the camera and scaled up, so the site's far side never pokes through it. */
const NIGHT_SCALE = 2.2

function FollowCamera({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null)
  const camera = useThree((s) => s.camera)
  useFrame(() => group.current?.position.copy(camera.position))
  return (
    <group ref={group} scale={NIGHT_SCALE}>
      {children}
    </group>
  )
}

/** Draws the shadow map once for each time of day: nothing that casts a shadow here moves. */
function StaticShadows({ phase }: { phase: DayPhase }) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    return () => {
      gl.shadowMap.autoUpdate = true
    }
  }, [gl, phase])
  return null
}

export function SiteSky({ phase }: { phase: DayPhase }) {
  const light = SITE_LIGHT[phase]
  const night = phase === 'night'
  // Scaled in the group, so the moon is placed at its unscaled distance.
  const moon = useMemo(() => light.sun.map((v) => v * 0.9) as [number, number, number], [light.sun])
  return (
    <>
      <Atmosphere background={light.air} fog={light.fog} />
      {night ? (
        <FollowCamera>
          <NightSky moon={moon} />
        </FollowCamera>
      ) : (
        <Sky
          sunPosition={light.sun}
          turbidity={phase === 'day' ? 6 : phase === 'dawn' ? 10 : 8}
          rayleigh={phase === 'day' ? 1.3 : 2.5}
          mieCoefficient={phase === 'dawn' ? 0.01 : 0.006}
          mieDirectionalG={0.9}
        />
      )}
      <hemisphereLight args={light.sky} />
      <directionalLight
        position={light.sun}
        intensity={light.sunStrength}
        color={light.sunColour}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-far={200}
        shadow-bias={-0.0008}
      />
      <StaticShadows phase={phase} />
    </>
  )
}

/** A soft round glow, white in the middle and clear at the edge, for light pools and halos. */
function useGlowTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const ctx = canvas.getContext('2d')!
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    return t
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

/**
 * Pools of lamplight on the ground under each floodlight: a glow painted on the asphalt rather than a real light, as
 * a dozen real lights would cost every surface on site a dozen more sums per pixel.
 */
export function LightPools({ spots, strength }: { spots: [number, number][]; strength: number }) {
  const glow = useGlowTexture()
  const pools = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!pools.current) return
    const dummy = new Object3D()
    dummy.rotation.x = -Math.PI / 2
    spots.forEach(([x, z], i) => {
      dummy.position.set(x, 0.03, z)
      dummy.updateMatrix()
      pools.current!.setMatrixAt(i, dummy.matrix)
    })
    pools.current!.instanceMatrix.needsUpdate = true
  })
  if (strength <= 0) return null
  return (
    <instancedMesh ref={pools} args={[undefined, undefined, spots.length]} renderOrder={1}>
      <planeGeometry args={[11, 11]} />
      <meshBasicMaterial map={glow} color="#ffb860" transparent opacity={strength} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  )
}

/** A halo round something bright, always facing the camera. `level` is read each frame (0 hides it). */
export function Halo({ position, size, colour, level }: { position: [number, number, number]; size: number; colour: string; level: () => number }) {
  const glow = useGlowTexture()
  const mesh = useRef<Group>(null)
  const material = useRef<MeshBasicMaterial>(null)
  useFrame(({ camera }) => {
    if (!mesh.current || !material.current) return
    mesh.current.quaternion.copy(camera.quaternion)
    const l = level()
    mesh.current.visible = l > 0.01
    mesh.current.scale.setScalar(0.6 + 0.4 * Math.min(3, l))
    material.current.opacity = Math.min(1, l)
  })
  return (
    <group ref={mesh} position={position}>
      <mesh renderOrder={2}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial ref={material} map={glow} color={colour} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Red obstruction lights on the tall things, blinking together as aircraft warning lights do. */
export function ObstructionLights({ tops, night }: { tops: [number, number, number][]; night: boolean }) {
  const lamps = useRef<InstancedMesh>(null)
  const material = useRef<MeshBasicMaterial>(null)
  useLayoutEffect(() => {
    const dummy = new Object3D()
    tops.forEach((p, i) => {
      dummy.position.set(...p)
      dummy.updateMatrix()
      lamps.current!.setMatrixAt(i, dummy.matrix)
    })
    lamps.current!.instanceMatrix.needsUpdate = true
  })
  useFrame(({ clock }) => {
    // About forty flashes a minute.
    const on = clock.elapsedTime % 1.5 < 0.5
    material.current?.color.set(on ? '#ff2a1a' : '#401010')
  })
  return (
    <instancedMesh ref={lamps} args={[undefined, undefined, tops.length]}>
      <sphereGeometry args={[night ? 0.32 : 0.22, 10, 8]} />
      <meshBasicMaterial ref={material} color="#ff2a1a" toneMapped={false} />
    </instancedMesh>
  )
}

/** Lights on the other plants across the marsh at night: a scatter of small warm points among the dark shapes. */
export function DistantLights({ shapes }: { shapes: { x: number; z: number; w: number; h: number }[] }) {
  const lights = useRef<InstancedMesh>(null)
  const points = useMemo(() => {
    let seed = 11
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    return shapes.flatMap((s) =>
      Array.from({ length: 3 + Math.floor(rand() * 4) }, () => {
        // On the face towards the site, so they're seen from it.
        const towards = Math.atan2(-s.z, -s.x)
        const across = (rand() - 0.5) * s.w
        return [
          s.x + Math.cos(towards) * (s.w / 2 + 0.2) - Math.sin(towards) * across,
          rand() * s.h,
          s.z + Math.sin(towards) * (s.w / 2 + 0.2) + Math.cos(towards) * across,
        ] as const
      }),
    )
  }, [shapes])
  useLayoutEffect(() => {
    const dummy = new Object3D()
    points.forEach(([x, y, z], i) => {
      dummy.position.set(x, y, z)
      dummy.updateMatrix()
      lights.current!.setMatrixAt(i, dummy.matrix)
    })
    lights.current!.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={lights} args={[undefined, undefined, points.length]}>
      <sphereGeometry args={[0.35, 6, 4]} />
      <meshBasicMaterial color="#ffc070" toneMapped={false} fog={false} />
    </instancedMesh>
  )
}
