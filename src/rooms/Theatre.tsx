import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { useTiledTexture } from '../hooks/useTiledTexture.ts'
import { Atmosphere } from './Atmosphere.tsx'
import { THEATRE } from './dimensions.ts'
import { RoomShell } from './RoomShell.tsx'

const SEAT_ROWS = [-1, 1.4]
const SEATS_PER_ROW = 6
const SCREEN = { width: 7, height: 3.4, y: 2.6 }
const FRAME = 0.18

function Seat({ x, z }: { x: number; z: number }) {
  const fabric = useTiledTexture('fabric', 1, 1)
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.9, 0.5, 0.7]} />
        <meshStandardMaterial color="#a8303a" map={fabric} bumpMap={fabric} bumpScale={1} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.65, 0.3]} castShadow>
        <boxGeometry args={[0.9, 0.8, 0.15]} />
        <meshStandardMaterial color="#a8303a" map={fabric} bumpMap={fabric} bumpScale={1} roughness={0.95} />
      </mesh>
      {[-0.47, 0.47].map((ax) => (
        <mesh key={ax} position={[ax, 0.4, 0.05]} castShadow>
          <boxGeometry args={[0.06, 0.25, 0.65]} />
          <meshStandardMaterial color="#2a1a10" roughness={0.6} />
        </mesh>
      ))}
    </group>
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
        floor={{ color: '#ffffff', texture: 'carpet', scale: 1.5 }}
        walls={{ color: '#ffffff', texture: 'panel', scale: 2 }}
        ceiling={{ color: '#2a2024' }}
      />
      <Screen />
      <Curtains />

      {SEAT_ROWS.map((z) =>
        Array.from({ length: SEATS_PER_ROW }, (_, i) => (
          <Seat key={`${z}-${i}`} x={(i - (SEATS_PER_ROW - 1) / 2) * 1.05} z={z} />
        )),
      )}

      {[-2, 3].flatMap((z) => [-wallX, wallX].map((x) => <Sconce key={`${x}-${z}`} x={x} z={z} />))}
    </group>
  )
}
