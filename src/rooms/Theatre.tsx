import { RoundedBox } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'
import { useTiledTexture } from '../hooks/useTiledTexture.ts'
import { Atmosphere } from './Atmosphere.tsx'
import { THEATRE, THEATRE_ROWS, THEATRE_SEAT_XS, THEATRE_TABLE_XS } from './dimensions.ts'
import { RoomShell } from './RoomShell.tsx'

const SCREEN = { width: 7, height: 3.4, y: 2.6 }
const FRAME = 0.18
const LEATHER = '#4a0e14'

/** Leather that responds to light like a soft sheen rather than plastic. */
function Leather({ map }: { map: Texture | null }) {
  return <meshPhysicalMaterial color={LEATHER} map={map} bumpMap={map} bumpScale={0.6} roughness={0.5} clearcoat={0.25} clearcoatRoughness={0.6} />
}

/** A premium recliner facing the screen (local -z). `reclined` raises the footrest. */
function Recliner({ x, z, reclined }: { x: number; z: number; reclined?: boolean }) {
  const leather = useTiledTexture('leather', 2, 2)
  const back = reclined ? 0.42 : 0.24
  return (
    <group position={[x, 0, z]}>
      {/* Plinth */}
      <RoundedBox args={[0.92, 0.22, 0.9]} radius={0.04} position={[0, 0.11, 0.05]} castShadow>
        <meshStandardMaterial color="#1a1012" roughness={0.6} />
      </RoundedBox>
      {/* Seat cushion */}
      <RoundedBox args={[0.6, 0.2, 0.72]} radius={0.08} smoothness={4} position={[0, 0.34, -0.02]} castShadow>
        <Leather map={leather} />
      </RoundedBox>
      {/* Backrest, leaning back from its base */}
      <group position={[0, 0.32, 0.36]} rotation={[back, 0, 0]}>
        <RoundedBox args={[0.62, 0.86, 0.2]} radius={0.09} smoothness={4} position={[0, 0.43, 0]} castShadow>
          <Leather map={leather} />
        </RoundedBox>
        <RoundedBox args={[0.42, 0.2, 0.1]} radius={0.05} smoothness={4} position={[0, 0.74, -0.12]}>
          <Leather map={leather} />
        </RoundedBox>
      </group>
      {/* Padded armrests */}
      {[-0.4, 0.4].map((ax) => (
        <RoundedBox key={ax} args={[0.17, 0.42, 0.86]} radius={0.07} smoothness={4} position={[ax, 0.43, 0.03]} castShadow>
          <Leather map={leather} />
        </RoundedBox>
      ))}
      {/* Footrest: tucked in, or raised when reclined */}
      <group position={[0, 0.3, -0.38]} rotation={[reclined ? -1.25 : 0, 0, 0]}>
        <RoundedBox args={[0.58, 0.08, 0.4]} radius={0.035} position={[0, reclined ? 0 : -0.05, reclined ? -0.2 : 0.02]} castShadow>
          <Leather map={leather} />
        </RoundedBox>
      </group>
    </group>
  )
}

/** Small round side table with a cup holder, between recliners. */
function SideTable({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 0.56, 12]} />
        <meshStandardMaterial color="#1a1012" />
      </mesh>
      <mesh position={[0, 0.58, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.17, 0.04, 24]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.4} />
      </mesh>
      <mesh position={[0.06, 0.61, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.045, 0.008, 8, 20]} />
        <meshStandardMaterial color="#b08d57" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  )
}

/** One row: two pairs of recliners with a table between each pair, either side of a centre aisle. */
function SeatRow({ z, reclinedSeats }: { z: number; reclinedSeats: number[] }) {
  return (
    <>
      {THEATRE_SEAT_XS.map((x, i) => (
        <Recliner key={x} x={x} z={z} reclined={reclinedSeats.includes(i)} />
      ))}
      {THEATRE_TABLE_XS.map((x) => (
        <SideTable key={x} x={x} z={z + 0.1} />
      ))}
    </>
  )
}

/** Placeholder "now showing" card until the video player arrives (Phase 3). */
function usePosterTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1400
    canvas.height = 680
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
  const z = -THEATRE.length / 2 + 0.15
  return (
    <group position={[0, SCREEN.y, z]}>
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[SCREEN.width + FRAME * 2, SCREEN.height + FRAME * 2, 0.08]} />
        <meshStandardMaterial color="#1a1412" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Thin gold inner edge. */}
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[SCREEN.width + 0.06, SCREEN.height + 0.06]} />
        <meshStandardMaterial color="#b08d57" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.012]}>
        <planeGeometry args={[SCREEN.width, SCREEN.height]} />
        <meshBasicMaterial map={poster} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0, 1.5]} intensity={4} distance={9} color="#b8a6e0" />
    </group>
  )
}

function Curtains() {
  const fabric = useTiledTexture('fabric', 2, 4)
  const z = -THEATRE.length / 2 + 0.35
  return (
    <>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (SCREEN.width / 2 + 0.8), THEATRE.height / 2, z]} castShadow>
          <boxGeometry args={[1.2, THEATRE.height, 0.25]} />
          <meshStandardMaterial color="#7a1a22" map={fabric} bumpMap={fabric} bumpScale={1.5} roughness={1} />
        </mesh>
      ))}
    </>
  )
}

function Sconce({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 2.8, z]}>
      <mesh>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color="#ffd0a0" emissive="#ffb070" emissiveIntensity={2} />
      </mesh>
      <pointLight color="#ffb070" intensity={6} distance={7} />
    </group>
  )
}

/** Placeholder theatre: panelled walls, a framed screen and rows of seats. */
export default function Theatre() {
  const wallX = THEATRE.width / 2 - 0.25
  return (
    <group>
      <Atmosphere background="#0a0709" fog={[16, 34]} />
      <hemisphereLight args={['#f0dcc8', '#3a2228', 1.3]} />
      <RoomShell
        {...THEATRE}
        floor={{ color: '#ffffff', texture: 'carpet' }}
        walls={{ color: '#ffffff', texture: 'panel' }}
        ceiling={{ color: '#2a2024' }}
      />
      <Screen />
      <Curtains />

      <SeatRow z={THEATRE_ROWS[0]} reclinedSeats={[1]} />
      <SeatRow z={THEATRE_ROWS[1]} reclinedSeats={[2]} />

      {[-2, 3].flatMap((z) => [-wallX, wallX].map((x) => <Sconce key={`${x}-${z}`} x={x} z={z} />))}
    </group>
  )
}
