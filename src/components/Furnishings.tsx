import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import { useTiledTexture } from '../hooks/useTiledTexture.ts'

// Small pieces of furniture shared between rooms: the things that make a
// place look lived in rather than staged.

const BRASS = { color: '#d4b064', metalness: 0.55, roughness: 0.3 }
const DARK_WOOD = '#5a3a24'

type Position = [number, number, number]

/** A wall clock that keeps the real time. Its face points along +z. */
export function WallClock({
  position,
  rotationY = 0,
  radius = 0.22,
}: {
  position: Position
  rotationY?: number
  radius?: number
}) {
  const hours = useRef<Group>(null)
  const minutes = useRef<Group>(null)
  const seconds = useRef<Group>(null)
  useFrame(() => {
    const now = new Date()
    const s = now.getSeconds() + now.getMilliseconds() / 1000
    const m = now.getMinutes() + s / 60
    const h = (now.getHours() % 12) + m / 60
    if (seconds.current) seconds.current.rotation.z = -(s / 60) * Math.PI * 2
    if (minutes.current) minutes.current.rotation.z = -(m / 60) * Math.PI * 2
    if (hours.current) hours.current.rotation.z = -(h / 12) * Math.PI * 2
  })
  const hand = (length: number, width: number, colour: string, z: number) => (
    <mesh position={[0, length / 2 - 0.02, z]}>
      <boxGeometry args={[width, length, 0.004]} />
      <meshStandardMaterial color={colour} />
    </mesh>
  )
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius + 0.03, radius + 0.03, 0.06, 40]} />
        <meshStandardMaterial color={DARK_WOOD} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.031]}>
        <circleGeometry args={[radius, 40]} />
        <meshStandardMaterial color="#f4eee2" roughness={0.7} />
      </mesh>
      {/* Hour marks. */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.sin(a) * radius * 0.85, Math.cos(a) * radius * 0.85, 0.033]} rotation={[0, 0, -a]}>
            <boxGeometry args={[i % 3 ? 0.006 : 0.012, radius * 0.12, 0.002]} />
            <meshStandardMaterial color="#2a2420" />
          </mesh>
        )
      })}
      <group ref={hours}>{hand(radius * 0.55, 0.014, '#1c1a18', 0.036)}</group>
      <group ref={minutes}>{hand(radius * 0.8, 0.009, '#1c1a18', 0.039)}</group>
      <group ref={seconds}>{hand(radius * 0.85, 0.003, '#a8321e', 0.042)}</group>
      <mesh position={[0, 0, 0.044]}>
        <cylinderGeometry args={[0.012, 0.012, 0.01, 12]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
    </group>
  )
}

/** A bentwood coat stand, with a coat and a scarf hung on it. */
export function CoatStand({
  position,
  coat = '#3a4a5c',
  scarf = '#a8402e',
}: {
  position: Position
  coat?: string
  scarf?: string
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 1.8, 10]} />
        <meshStandardMaterial color={DARK_WOOD} roughness={0.45} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <group key={i} rotation={[0, (i * Math.PI) / 2 + 0.4, 0]}>
          <mesh position={[0.18, 0.06, 0]} rotation={[0, 0, 0.5]}>
            <cylinderGeometry args={[0.018, 0.018, 0.42, 8]} />
            <meshStandardMaterial color={DARK_WOOD} roughness={0.45} />
          </mesh>
          <mesh position={[0.1, 1.68, 0]} rotation={[0, 0, -0.9]}>
            <cylinderGeometry args={[0.012, 0.012, 0.22, 8]} />
            <meshStandardMaterial color={DARK_WOOD} roughness={0.45} />
          </mesh>
        </group>
      ))}
      {/* A coat hanging from one hook: shoulders, then the body falling straight. */}
      <group position={[0.16, 0, 0.1]}>
        <mesh position={[0, 1.55, 0]} scale={[1, 0.6, 0.7]}>
          <sphereGeometry args={[0.16, 16, 10]} />
          <meshStandardMaterial color={coat} roughness={0.95} />
        </mesh>
        <mesh position={[0, 1.15, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.22, 0.8, 16]} />
          <meshStandardMaterial color={coat} roughness={0.95} />
        </mesh>
      </group>
      <mesh position={[-0.12, 1.45, -0.08]} rotation={[0.2, 0, 0.1]}>
        <boxGeometry args={[0.1, 0.5, 0.03]} />
        <meshStandardMaterial color={scarf} roughness={1} />
      </mesh>
    </group>
  )
}

/** A wooden bench with a slatted seat. Its length runs along x. */
export function Bench({ position, rotationY = 0, length = 1.5 }: { position: Position; rotationY?: number; length?: number }) {
  const wood = useTiledTexture('wood', 2, 0.5)
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {[-0.13, -0.04, 0.05, 0.14].map((z) => (
        <mesh key={z} position={[0, 0.45, z]} castShadow receiveShadow>
          <boxGeometry args={[length, 0.035, 0.08]} />
          <meshStandardMaterial color="#b88a5c" map={wood} roughness={0.6} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (length / 2 - 0.12), 0, 0]}>
          <mesh position={[0, 0.22, 0]} castShadow>
            <boxGeometry args={[0.06, 0.44, 0.36]} />
            <meshStandardMaterial color="#2c2a28" metalness={0.5} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** A tall stool on a turned wooden frame. */
export function Stool({ position, height = 0.68 }: { position: Position; height?: number }) {
  return (
    <group position={position}>
      <mesh position={[0, height, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.16, 0.04, 20]} />
        <meshStandardMaterial color="#8a5a36" roughness={0.5} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.11, height / 2, Math.sin(a) * 0.11]}
            rotation={[Math.sin(a) * 0.1, 0, -Math.cos(a) * 0.1]}
          >
            <cylinderGeometry args={[0.016, 0.02, height, 8]} />
            <meshStandardMaterial color={DARK_WOOD} roughness={0.5} />
          </mesh>
        )
      })}
      <mesh position={[0, height * 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.12, 0.01, 6, 20]} />
        <meshStandardMaterial color={DARK_WOOD} roughness={0.5} />
      </mesh>
    </group>
  )
}

/** A glass vase of flowers: a few stems and soft blooms in two colours. */
export function Flowers({ position, colours = ['#f2c4d0', '#fff4e0'] }: { position: Position; colours?: [string, string] }) {
  const blooms = [
    [0.04, 0.42, 0.02, 0],
    [-0.05, 0.38, 0.03, 1],
    [0.0, 0.46, -0.04, 1],
    [0.07, 0.36, -0.03, 0],
    [-0.03, 0.44, -0.06, 0],
    [-0.07, 0.35, -0.01, 1],
  ] as const
  return (
    <group position={position}>
      <mesh position={[0, 0.11, 0]}>
        <cylinderGeometry args={[0.06, 0.05, 0.22, 20]} />
        <meshStandardMaterial color="#cfe6ec" transparent opacity={0.35} roughness={0.05} depthWrite={false} />
      </mesh>
      {blooms.map(([x, y, z, c], i) => (
        <group key={i}>
          <mesh position={[x / 2, (y + 0.1) / 2, z / 2]} rotation={[z * 3, 0, -x * 3]}>
            <cylinderGeometry args={[0.004, 0.004, y - 0.08, 5]} />
            <meshStandardMaterial color="#4a6a32" />
          </mesh>
          <mesh position={[x, y, z]}>
            <icosahedronGeometry args={[0.035, 1]} />
            <meshStandardMaterial color={colours[c]} roughness={0.8} />
          </mesh>
        </group>
      ))}
      {/* A few leaves. */}
      {[0.6, 2.4, 4.4].map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.06, 0.3, Math.sin(a) * 0.06]} rotation={[0, -a, 0.9]} scale={[1, 0.35, 1]}>
          <sphereGeometry args={[0.05, 8, 6]} />
          <meshStandardMaterial color="#5a7e3c" roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

/** A narrow console table against a wall. Its length runs along x, with the back at -z. */
export function ConsoleTable({
  position,
  rotationY = 0,
  children,
}: {
  position: Position
  rotationY?: number
  children?: React.ReactNode
}) {
  const wood = useTiledTexture('wood', 1, 0.5)
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.82, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.04, 0.36]} />
        <meshStandardMaterial color="#9a6a42" map={wood} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.74, 0]}>
        <boxGeometry args={[1.0, 0.12, 0.32]} />
        <meshStandardMaterial color="#7a4c2c" map={wood} roughness={0.5} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.48, 0.36, sz * 0.13]} castShadow>
            <cylinderGeometry args={[0.018, 0.012, 0.72, 8]} />
            <meshStandardMaterial color={DARK_WOOD} roughness={0.5} />
          </mesh>
        )),
      )}
      <group position={[0, 0.84, 0]}>{children}</group>
    </group>
  )
}

/** A terracotta pot with a clipped round box ball, for either side of a door. */
export function BoxBallPot({ position }: { position: Position }) {
  const leaves = useTiledTexture('boxleaf', 2, 1)
  return (
    <group position={position}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.19, 0.44, 24]} />
        <meshStandardMaterial color="#a8603e" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <torusGeometry args={[0.25, 0.025, 8, 24]} />
        <meshStandardMaterial color="#a05a3a" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow>
        <sphereGeometry args={[0.3, 24, 18]} />
        <meshStandardMaterial color="#dfe8d4" map={leaves} bumpMap={leaves} bumpScale={2} roughness={0.9} />
      </mesh>
    </group>
  )
}
