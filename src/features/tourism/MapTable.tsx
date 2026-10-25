import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace, Vector3 } from 'three'
import { useTiledTexture } from '../../hooks/useTiledTexture.ts'
import { MAP_TABLE } from '../../rooms/dimensions.ts'
import { useInteractable } from '../../world/InteractionSystem.tsx'
import { openOverlay } from '../../world/overlay.ts'
import { CITY_EXPLORER_OVERLAY } from './overlayId.ts'

const TOP = { width: 0.9, length: 1.4, height: 0.82 }

/** An old-style chart of London for the tabletop: parchment, the Thames, parks and a compass rose. */
function paintChart() {
  const w = 768
  const h = 1200
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const paper = ctx.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, h * 0.7)
  paper.addColorStop(0, '#efe2c0')
  paper.addColorStop(1, '#c9b385')
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, w, h)
  // A street grid in faint ink.
  ctx.strokeStyle = 'rgba(90, 70, 40, 0.25)'
  ctx.lineWidth = 2
  let seed = 3
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 70; i++) {
    const x = rand() * w
    const y = rand() * h
    const a = rand() * Math.PI
    ctx.beginPath()
    ctx.moveTo(x - Math.cos(a) * 160, y - Math.sin(a) * 160)
    ctx.lineTo(x + Math.cos(a) * 160, y + Math.sin(a) * 160)
    ctx.stroke()
  }
  // Parks.
  ctx.fillStyle = 'rgba(110, 140, 80, 0.45)'
  for (const [x, y, rx, ry] of [
    [250, 260, 120, 90],
    [520, 520, 90, 120],
    [200, 640, 70, 50],
  ]) {
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, 0.3, 0, Math.PI * 2)
    ctx.fill()
  }
  // The Thames, winding across the lower half.
  ctx.strokeStyle = '#7f9fb0'
  ctx.lineWidth = 34
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-20, 980)
  ctx.bezierCurveTo(180, 820, 260, 1120, 420, 940)
  ctx.bezierCurveTo(560, 790, 640, 900, w + 20, 760)
  ctx.stroke()
  // Compass rose and title.
  ctx.fillStyle = '#5a3a1e'
  ctx.font = 'italic 54px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText('London', w / 2, 110)
  ctx.save()
  ctx.translate(w - 110, h - 130)
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2)
    ctx.beginPath()
    ctx.moveTo(0, -70)
    ctx.lineTo(12, 0)
    ctx.lineTo(-12, 0)
    ctx.fill()
  }
  ctx.restore()
  ctx.strokeStyle = '#5a3a1e'
  ctx.lineWidth = 6
  ctx.strokeRect(18, 18, w - 36, h - 36)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

/**
 * A map table in the main hall with a chart of London spread on it, and pins
 * stuck in. Press E to open the City Explorer.
 */
export function MapTable() {
  const [x, z] = MAP_TABLE
  const wood = useTiledTexture('wood', 1, 1)
  const chart = useMemo(paintChart, [])
  useEffect(() => () => chart.dispose(), [chart])
  useInteractable({
    position: useMemo(() => new Vector3(x, 1, z), [x, z]),
    radius: 1.9,
    prompt: 'Press E to explore London',
    onInteract: () => openOverlay(CITY_EXPLORER_OVERLAY),
  })
  const walnut = { color: '#6a4430', map: wood, roughness: 0.45 }
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, TOP.height - 0.03, 0]} castShadow>
        <boxGeometry args={[TOP.width, 0.06, TOP.length]} />
        <meshStandardMaterial {...walnut} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            position={[sx * (TOP.width / 2 - 0.08), (TOP.height - 0.06) / 2, sz * (TOP.length / 2 - 0.08)]}
          >
            <cylinderGeometry args={[0.035, 0.025, TOP.height - 0.06, 10]} />
            <meshStandardMaterial {...walnut} />
          </mesh>
        )),
      )}
      {/* The chart, a little smaller than the top, and a few brass-headed pins. */}
      <mesh position={[0, TOP.height + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TOP.width - 0.12, TOP.length - 0.12]} />
        <meshStandardMaterial map={chart} roughness={0.9} />
      </mesh>
      {[
        [-0.15, -0.3, '#b03a2e'],
        [0.12, -0.05, '#2e5a8a'],
        [-0.05, 0.22, '#b03a2e'],
        [0.2, 0.35, '#3a7a3a'],
      ].map(([px, pz, color]) => (
        <group key={`${px}${pz}`} position={[px as number, TOP.height, pz as number]}>
          <mesh position={[0, 0.025, 0]}>
            <cylinderGeometry args={[0.003, 0.003, 0.05, 6]} />
            <meshStandardMaterial color="#c9a55c" metalness={0.5} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.055, 0]}>
            <sphereGeometry args={[0.012, 12, 8]} />
            <meshStandardMaterial color={color as string} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* A brass magnifier resting on the map. */}
      <group position={[0.22, TOP.height + 0.01, -0.4]} rotation={[0, 0.6, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.06, 0.008, 8, 28]} />
          <meshStandardMaterial color="#c9a55c" metalness={0.55} roughness={0.28} />
        </mesh>
        <mesh position={[0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 0.12, 8]} />
          <meshStandardMaterial color="#3a2618" roughness={0.5} />
        </mesh>
      </group>
    </group>
  )
}
