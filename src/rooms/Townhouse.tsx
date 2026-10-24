import { RoundedBox } from '@react-three/drei'
import { useSurfaceTexture, useTiledTexture } from '../hooks/useTiledTexture.ts'
import { PORTICO } from './dimensions.ts'

// Pieces of a white stucco London townhouse terrace, in the style of
// Kensington: rusticated ground floor, tall sash windows, a cornice and a
// columned portico around the front door. All groups face +z.

const STUCCO = '#f3eee4'
const TRIM = '#fbf8f2'

interface WindowProps {
  x: number
  y: number
  width: number
  height: number
  /** Warm light behind some windows so the house feels lived in. */
  lit?: boolean
  balconette?: boolean
}

/** A sash window with a white surround, glazing bars and an optional iron balconette. */
export function SashWindow({ x, y, width, height, lit, balconette }: WindowProps) {
  return (
    <group position={[x, y, 0]}>
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[width + 0.3, height + 0.3, 0.08]} />
        <meshStandardMaterial color={TRIM} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.085]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          color={lit ? '#3a2e22' : '#1c242c'}
          emissive={lit ? '#ffb45a' : '#000000'}
          emissiveIntensity={lit ? 0.35 : 0}
          roughness={0.08}
          metalness={0.5}
        />
      </mesh>
      {/* Glazing bars: two sashes of three by two panes. */}
      {[-width / 6, width / 6].map((bx) => (
        <mesh key={bx} position={[bx, 0, 0.095]}>
          <boxGeometry args={[0.03, height, 0.02]} />
          <meshStandardMaterial color={TRIM} />
        </mesh>
      ))}
      {[-height / 4, 0, height / 4].map((by) => (
        <mesh key={by} position={[0, by, 0.095]}>
          <boxGeometry args={[width, by === 0 ? 0.06 : 0.03, 0.02]} />
          <meshStandardMaterial color={TRIM} />
        </mesh>
      ))}
      {/* Cornice hood above the window. */}
      <mesh position={[0, height / 2 + 0.24, 0.1]}>
        <boxGeometry args={[width + 0.5, 0.12, 0.2]} />
        <meshStandardMaterial color={TRIM} roughness={0.7} />
      </mesh>
      {balconette && (
        <group position={[0, -height / 2 + 0.25, 0.3]}>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[width + 0.4, 0.04, 0.04]} />
            <meshStandardMaterial color="#111111" metalness={0.6} roughness={0.4} />
          </mesh>
          {Array.from({ length: 11 }, (_, i) => (
            <mesh key={i} position={[(i / 10 - 0.5) * (width + 0.4), 0.25, 0]}>
              <boxGeometry args={[0.02, 0.5, 0.02]} />
              <meshStandardMaterial color="#111111" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
          <mesh position={[0, -0.04, -0.12]}>
            <boxGeometry args={[width + 0.5, 0.08, 0.4]} />
            <meshStandardMaterial color={TRIM} />
          </mesh>
        </group>
      )}
    </group>
  )
}

/** Flat stucco front wall of a terrace, with rustication grooves, string course and cornice. */
export function TerraceWall({ width, height, seed = 1 }: { width: number; height: number; seed?: number }) {
  const stucco = useSurfaceTexture('stucco', width, height, seed, 96)
  const groundFloor = 3.6
  return (
    <group>
      <mesh position={[0, height / 2, -0.2]} receiveShadow castShadow>
        <boxGeometry args={[width, height, 0.4]} />
        <meshStandardMaterial color={STUCCO} map={stucco} bumpMap={stucco} bumpScale={0.3} roughness={0.85} />
      </mesh>
      {/* Rusticated ground floor: horizontal channels. */}
      {Array.from({ length: Math.floor(groundFloor / 0.45) }, (_, i) => (
        <mesh key={i} position={[0, 0.45 * (i + 1), 0.004]}>
          <planeGeometry args={[width, 0.035]} />
          <meshStandardMaterial color="#b9b2a4" roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, groundFloor + 0.1, 0.06]} castShadow>
        <boxGeometry args={[width, 0.2, 0.14]} />
        <meshStandardMaterial color={TRIM} roughness={0.7} />
      </mesh>
      <mesh position={[0, height - 0.5, 0.15]} castShadow>
        <boxGeometry args={[width, 0.3, 0.32]} />
        <meshStandardMaterial color={TRIM} roughness={0.7} />
      </mesh>
      <mesh position={[0, height - 0.18, 0.02]}>
        <boxGeometry args={[width, 0.36, 0.1]} />
        <meshStandardMaterial color={STUCCO} roughness={0.8} />
      </mesh>
    </group>
  )
}

function Column({ x, z, height }: { x: number; z: number; height: number }) {
  const marble = useTiledTexture('marble', 1, 3)
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.52, 0.24, 0.52]} />
        <meshStandardMaterial color="#f2efe9" map={marble} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.26, 0.12, 24]} />
        <meshStandardMaterial color="#f2efe9" map={marble} roughness={0.35} />
      </mesh>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.2, height - 0.6, 24]} />
        <meshPhysicalMaterial color="#f4f1ec" map={marble} roughness={0.25} clearcoat={0.4} />
      </mesh>
      <mesh position={[0, height - 0.24, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.17, 0.2, 24]} />
        <meshStandardMaterial color="#f2efe9" map={marble} roughness={0.35} />
      </mesh>
      <mesh position={[0, height - 0.08, 0]} castShadow>
        <boxGeometry args={[0.52, 0.16, 0.52]} />
        <meshStandardMaterial color="#f2efe9" map={marble} roughness={0.35} />
      </mesh>
    </group>
  )
}

/** Columned porch around the front door, with a balustrade on top and a marble step. */
export function Portico() {
  const marble = useTiledTexture('marble', 3, 1.5)
  const { columnX, columnZ, height } = PORTICO
  const depth = columnZ + 0.4
  return (
    <group>
      <mesh position={[0, 0.03, depth / 2]} receiveShadow>
        <boxGeometry args={[columnX * 2 + 0.9, 0.06, depth + 0.3]} />
        <meshStandardMaterial color="#e8e4dc" map={marble} roughness={0.3} />
      </mesh>
      {[-columnX, columnX].map((x) => (
        <Column key={x} x={x} z={columnZ} height={height} />
      ))}
      {/* Entablature and cornice. */}
      <RoundedBox args={[columnX * 2 + 0.8, 0.5, depth]} radius={0.02} position={[0, height + 0.25, depth / 2]} castShadow>
        <meshStandardMaterial color={TRIM} roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, height + 0.57, depth / 2 + 0.05]} castShadow>
        <boxGeometry args={[columnX * 2 + 1.1, 0.14, depth + 0.2]} />
        <meshStandardMaterial color={TRIM} roughness={0.6} />
      </mesh>
      {/* Balustrade. */}
      <group position={[0, height + 0.64, columnZ + 0.25]}>
        <mesh position={[0, 0.62, 0]}>
          <boxGeometry args={[columnX * 2 + 0.9, 0.1, 0.22]} />
          <meshStandardMaterial color={TRIM} />
        </mesh>
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} position={[(i / 8 - 0.5) * (columnX * 2 + 0.5), 0.3, 0]}>
            <cylinderGeometry args={[0.06, 0.09, 0.56, 10]} />
            <meshStandardMaterial color={TRIM} />
          </mesh>
        ))}
      </group>
      {/* Fanlight above the door. */}
      <group position={[0, 2.42, 0.02]}>
        <mesh position={[0, 0, 0.005]}>
          <circleGeometry args={[0.7, 32, 0, Math.PI]} />
          <meshStandardMaterial color={TRIM} />
        </mesh>
        <mesh position={[0, 0, 0.012]}>
          <circleGeometry args={[0.6, 32, 0, Math.PI]} />
          <meshStandardMaterial color="#2a2418" emissive="#ffb45a" emissiveIntensity={0.25} roughness={0.1} />
        </mesh>
        {[0.25, 0.5, 0.75].map((t) => (
          <mesh key={t} position={[Math.cos(t * Math.PI) * 0.3, Math.sin(t * Math.PI) * 0.3, 0.02]} rotation={[0, 0, t * Math.PI]}>
            <boxGeometry args={[0.6, 0.02, 0.01]} />
            <meshStandardMaterial color={TRIM} />
          </mesh>
        ))}
      </group>
      {/* A pair of carriage lanterns either side of the door. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.02, 2.05, 0.16]}>
          <mesh position={[0, -0.05, -0.1]}>
            <boxGeometry args={[0.05, 0.05, 0.2]} />
            <meshStandardMaterial color="#111111" metalness={0.5} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.18, 0.26, 0.18]} />
            <meshStandardMaterial color="#ffe2b0" emissive="#ffc070" emissiveIntensity={1.4} transparent opacity={0.9} />
          </mesh>
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx}${sz}`} position={[sx * 0.09, 0, sz * 0.09]}>
                <boxGeometry args={[0.018, 0.28, 0.018]} />
                <meshStandardMaterial color="#111111" metalness={0.5} />
              </mesh>
            )),
          )}
          <mesh position={[0, 0.17, 0]}>
            <coneGeometry args={[0.15, 0.1, 4]} />
            <meshStandardMaterial color="#111111" metalness={0.5} />
          </mesh>
          <pointLight color="#ffcf8a" intensity={1.4} distance={4} />
        </group>
      ))}
    </group>
  )
}
