import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'

// Small personal things in the Philosophy Lounge: a portrait in an oval gilt
// frame, a gold pocket watch left open on the side table, and a bundle of old
// letters tied with ribbon on the mantelpiece.

const GILT = { color: '#b08d57', metalness: 0.75, roughness: 0.3 }
const GOLD = { color: '#d8b46a', metalness: 0.85, roughness: 0.25 }

/** An old-master style head and shoulders: a sitter in a dark coat and white stock against a brown ground. */
function drawPortrait(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const ground = ctx.createRadialGradient(w * 0.45, h * 0.35, 20, w / 2, h / 2, w * 0.8)
  ground.addColorStop(0, '#5a4630')
  ground.addColorStop(1, '#1a120a')
  ctx.fillStyle = ground
  ctx.fillRect(0, 0, w, h)
  // Coat and shoulders.
  ctx.fillStyle = '#16120e'
  ctx.beginPath()
  ctx.moveTo(w * 0.08, h)
  ctx.quadraticCurveTo(w * 0.12, h * 0.66, w * 0.38, h * 0.6)
  ctx.lineTo(w * 0.62, h * 0.6)
  ctx.quadraticCurveTo(w * 0.88, h * 0.66, w * 0.92, h)
  ctx.fill()
  // White stock at the neck.
  ctx.fillStyle = '#e8e0d0'
  ctx.beginPath()
  ctx.moveTo(w * 0.42, h * 0.58)
  ctx.quadraticCurveTo(w * 0.5, h * 0.75, w * 0.58, h * 0.58)
  ctx.lineTo(w * 0.55, h * 0.54)
  ctx.lineTo(w * 0.45, h * 0.54)
  ctx.fill()
  // Face, lit from the left.
  const face = ctx.createRadialGradient(w * 0.46, h * 0.36, 4, w * 0.5, h * 0.4, w * 0.16)
  face.addColorStop(0, '#e6c0a0')
  face.addColorStop(1, '#8a5e44')
  ctx.fillStyle = face
  ctx.beginPath()
  ctx.ellipse(w * 0.5, h * 0.4, w * 0.12, h * 0.15, 0, 0, Math.PI * 2)
  ctx.fill()
  // Grey powdered hair.
  ctx.fillStyle = '#9a948a'
  ctx.beginPath()
  ctx.ellipse(w * 0.5, h * 0.3, w * 0.15, h * 0.1, 0, Math.PI, 0)
  ctx.fill()
  ctx.fillRect(w * 0.36, h * 0.3, w * 0.05, h * 0.14)
  ctx.fillRect(w * 0.59, h * 0.3, w * 0.05, h * 0.14)
  // Eyes and mouth, faintly.
  ctx.fillStyle = 'rgba(40, 24, 16, 0.7)'
  for (const ex of [0.45, 0.55]) ctx.fillRect(w * ex - 4, h * 0.38, 9, 3)
  ctx.fillRect(w * 0.47, h * 0.47, w * 0.06, 2)
  // Old varnish: a warm, dark vignette.
  const varnish = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.7)
  varnish.addColorStop(0, 'rgba(120, 80, 20, 0.08)')
  varnish.addColorStop(1, 'rgba(10, 6, 2, 0.6)')
  ctx.fillStyle = varnish
  ctx.fillRect(0, 0, w, h)
}

function useCanvas(width: number, height: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    draw(canvas.getContext('2d')!, width, height)
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [width, height]) // Each call site passes a fixed painter.
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

/** A portrait in an oval gilt frame, hanging on the wall. Faces local +z. */
export function OvalPortrait({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  const picture = useCanvas(384, 512, drawPortrait)
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0, 0.02]} scale={[0.75, 1, 1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.05, 48]} />
        <meshStandardMaterial {...GILT} />
      </mesh>
      <mesh position={[0, 0, 0.046]} scale={[0.75, 1, 1]}>
        <torusGeometry args={[0.43, 0.025, 8, 48]} />
        <meshStandardMaterial color="#e0c080" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0.047]} scale={[0.75, 1, 1]}>
        <circleGeometry args={[0.42, 48]} />
        <meshStandardMaterial map={picture} roughness={0.6} />
      </mesh>
      {/* A small brass name plate below. */}
      <mesh position={[0, -0.6, 0.02]}>
        <boxGeometry args={[0.22, 0.05, 0.01]} />
        <meshStandardMaterial {...GOLD} />
      </mesh>
    </group>
  )
}

/** A gold pocket watch lying open, its chain trailing. Lies flat at `position`. */
export function PocketWatch({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  const dial = useCanvas(128, 128, (ctx, w) => {
    const c = w / 2
    ctx.fillStyle = '#f6efe0'
    ctx.fillRect(0, 0, w, w)
    ctx.fillStyle = '#2a2018'
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      ctx.fillRect(c + Math.sin(a) * c * 0.78 - 2, c - Math.cos(a) * c * 0.78 - 2, 4, 4)
    }
    ctx.lineWidth = 3
    ctx.strokeStyle = '#2a2018'
    ctx.beginPath()
    ctx.moveTo(c, c)
    ctx.lineTo(c + c * 0.35, c - c * 0.2)
    ctx.moveTo(c, c)
    ctx.lineTo(c - c * 0.1, c - c * 0.6)
    ctx.stroke()
  })
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.008, 0]}>
        <cylinderGeometry args={[0.028, 0.028, 0.012, 32]} />
        <meshStandardMaterial {...GOLD} />
      </mesh>
      <mesh position={[0, 0.0145, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.024, 32]} />
        <meshStandardMaterial map={dial} roughness={0.4} />
      </mesh>
      {/* The open lid, tipped back on its hinge. */}
      <mesh position={[0, 0.02, -0.04]} rotation={[-1.2, 0, 0]}>
        <cylinderGeometry args={[0.028, 0.028, 0.004, 32]} />
        <meshStandardMaterial {...GOLD} />
      </mesh>
      <mesh position={[0, 0.008, 0.032]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.007, 0.002, 6, 12]} />
        <meshStandardMaterial {...GOLD} />
      </mesh>
      {/* The chain, as a run of small links curving away. */}
      {Array.from({ length: 14 }, (_, i) => {
        const t = i / 13
        return (
          <mesh
            key={i}
            position={[Math.sin(t * 2.4) * 0.06, 0.003, 0.04 + t * 0.12]}
            rotation={[Math.PI / 2, 0, (i % 2) * (Math.PI / 2)]}
          >
            <torusGeometry args={[0.0045, 0.0013, 4, 8]} />
            <meshStandardMaterial {...GOLD} />
          </mesh>
        )
      })}
    </group>
  )
}

/** A bundle of old letters tied with a faded red ribbon, a wax seal on the top one. */
export function Letters({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  const tones = ['#efe4cc', '#e6d6b4', '#f2ead6', '#e0cfa8']
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {tones.map((tone, i) => (
        <mesh key={i} position={[(i % 2) * 0.006, 0.004 + i * 0.006, (i % 3) * 0.004]} rotation={[0, (i - 1.5) * 0.06, 0]}>
          <boxGeometry args={[0.2, 0.005, 0.12]} />
          <meshStandardMaterial color={tone} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 0.014, 0]}>
        <boxGeometry args={[0.012, 0.03, 0.126]} />
        <meshStandardMaterial color="#8a2a24" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.014, 0]}>
        <boxGeometry args={[0.206, 0.03, 0.012]} />
        <meshStandardMaterial color="#8a2a24" roughness={0.8} />
      </mesh>
      <mesh position={[0.05, 0.03, 0.03]}>
        <cylinderGeometry args={[0.012, 0.013, 0.004, 16]} />
        <meshStandardMaterial color="#7a1410" roughness={0.5} />
      </mesh>
    </group>
  )
}
