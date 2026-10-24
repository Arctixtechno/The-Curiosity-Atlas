import { Stars } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BackSide, Vector3, type Group } from 'three'
import { Glow } from '../components/Glow.tsx'
import { Painting } from '../components/Painting.tsx'
import { getPainting } from '../components/paintings.ts'
import { useSurfaceTexture, useTiledTexture } from '../hooks/useTiledTexture.ts'
import { useInteractable } from '../world/InteractionSystem.tsx'
import { Atmosphere } from './Atmosphere.tsx'
import { OBSERVATORY } from './dimensions.ts'

const { radius: R, wallHeight: WALL_H } = OBSERVATORY
const BRASS = { color: '#c9a55c', metalness: 0.9, roughness: 0.25 }
const IRON = { color: '#23262c', metalness: 0.6, roughness: 0.45 }
/** The dome's shutter slit opens towards -z; the telescope points through it. */
const SLIT_WIDTH = 0.5
const TELESCOPE_ELEVATION = (50 * Math.PI) / 180

function Floor() {
  const wood = useSurfaceTexture('wood', R * 2, R * 2, 7)
  const rug = useTiledTexture('carpet', 1, 1)
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[R, 64]} />
        <meshStandardMaterial color="#c8a888" map={wood} bumpMap={wood} bumpScale={0.5} roughness={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -0.6]} receiveShadow>
        <circleGeometry args={[2.4, 48]} />
        <meshStandardMaterial color="#5a6aa0" map={rug} roughness={1} />
      </mesh>
    </>
  )
}

/** Round wall, skirting, the brass track the dome turns on, and the dome itself with its open slit. */
function Shell() {
  const plaster = useSurfaceTexture('plaster', 2 * Math.PI * R, WALL_H, 8, 80)
  const phiStart = (3 * Math.PI) / 2 + SLIT_WIDTH / 2
  const ribs = [0, 1, 2, 3, 5, 6, 7].map((i) => (i * Math.PI) / 8)
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
        <sphereGeometry args={[R, 96, 32, phiStart, Math.PI * 2 - SLIT_WIDTH, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#1b2440" side={BackSide} roughness={0.85} />
      </mesh>
      {/* Brass ribs over the dome, skipping the one that would cross the slit. */}
      {ribs.map((angle) => (
        <mesh key={angle} position={[0, WALL_H, 0]} rotation={[0, angle, 0]}>
          <torusGeometry args={[R - 0.06, 0.035, 8, 64, Math.PI]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
      ))}
    </>
  )
}

/** A large brass refractor on an iron equatorial mount, pointing out through the slit. */
function Telescope() {
  const [x, z] = OBSERVATORY.telescope
  useInteractable({
    position: useMemo(() => new Vector3(x, 1.2, z), [x, z]),
    radius: 2.4,
    prompt: 'Telescope: stargazing arrives in a later version',
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
        {/* Tube, tilted up towards the slit (-z). */}
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

/** A brass orrery on a round table, with planets slowly turning round the sun. */
function Orrery() {
  const [x, z] = OBSERVATORY.orrery
  const arms = useRef<(Group | null)[]>([])
  const planets = [
    { r: 0.18, size: 0.025, color: '#b8a898', speed: 1.6 },
    { r: 0.28, size: 0.035, color: '#e0c080', speed: 1.1 },
    { r: 0.38, size: 0.038, color: '#5a8ad0', speed: 0.8 },
    { r: 0.5, size: 0.03, color: '#c0603a', speed: 0.55 },
  ]
  useFrame((_, delta) => {
    arms.current.forEach((arm, i) => {
      if (arm) arm.rotation.y += delta * planets[i].speed * 0.3
    })
  })
  useInteractable({
    position: useMemo(() => new Vector3(x, 1, z), [x, z]),
    radius: 2,
    prompt: 'Orrery: a working model of the solar system',
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
        <group key={i} position={[0, 1.02 + i * 0.012, 0]} ref={(g) => void (arms.current[i] = g)} rotation={[0, i * 1.7, 0]}>
          <mesh position={[p.r / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.004, 0.004, p.r, 6]} />
            <meshStandardMaterial {...BRASS} />
          </mesh>
          <mesh position={[p.r, 0.04, 0]}>
            <sphereGeometry args={[p.size, 16, 12]} />
            <meshStandardMaterial color={p.color} roughness={0.6} />
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
        <mesh key={a} position={[Math.cos(a) * 0.22, 0.35, Math.sin(a) * 0.22]} rotation={[Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25]}>
          <cylinderGeometry args={[0.025, 0.03, 0.72, 8]} />
          <meshStandardMaterial color="#4a2e1a" roughness={0.5} />
        </mesh>
      ))}
      <group position={[0, 1.05, 0]} rotation={[0, 0, 0.41]}>
        <group ref={globe}>
          <mesh castShadow>
            <sphereGeometry args={[0.3, 48, 32]} />
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

/** Round observatory: domed roof with an open slit to the night sky, a big telescope, an orrery and a celestial globe. */
export default function Observatory() {
  return (
    <group>
      <Atmosphere background="#03040c" />
      <hemisphereLight args={['#8a9ed8', '#3a2c20', 1.0]} />
      <ambientLight intensity={0.18} color="#c0c8ff" />
      {/* Moonlight falling through the slit. */}
      <directionalLight position={[0, 38, -32]} intensity={0.6} color="#b8c8ff" />
      <pointLight position={[0, 2.6, 1.5]} color="#ffcf90" intensity={6} distance={9} decay={1.6} />
      <Stars radius={60} depth={30} count={4000} factor={3.5} fade speed={0.3} />
      <mesh position={[0, 38, -32]}>
        <sphereGeometry args={[2, 32, 16]} />
        <meshBasicMaterial color="#f4f1e6" toneMapped={false} />
      </mesh>

      <Floor />
      <Shell />
      <Telescope />
      <Orrery />
      <CelestialGlobe />
      {[0.9, -0.9, 2.2, -2.2].map((a) => (
        <WallLight key={a} angle={a} />
      ))}
      <Painting name="stars" position={[Math.sin(1.6) * (R - 0.05), 1.75, Math.cos(1.6) * (R - 0.05)]} rotationY={1.6 + Math.PI} width={1.1} />
      <Painting name="map" position={[Math.sin(-1.6) * (R - 0.05), 1.75, Math.cos(-1.6) * (R - 0.05)]} rotationY={-1.6 + Math.PI} width={1} />
    </group>
  )
}
