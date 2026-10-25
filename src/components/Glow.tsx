import { useMemo } from 'react'
import { AdditiveBlending, CanvasTexture, SRGBColorSpace } from 'three'

let glowTexture: CanvasTexture | null = null

function getGlowTexture() {
  if (!glowTexture) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const ctx = canvas.getContext('2d')!
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    glowTexture = new CanvasTexture(canvas)
    glowTexture.colorSpace = SRGBColorSpace
  }
  return glowTexture
}

interface GlowProps {
  position: [number, number, number]
  rotation?: [number, number, number]
  /** Width and height of the glow in metres. */
  size: [number, number]
  color: string
  opacity?: number
}

/**
 * A soft pool of light painted onto a surface (additive, no real light), for
 * the look of a lamp washing a wall without the cost or hard hot spot of a
 * point light.
 */
export function Glow({ position, rotation, size, color, opacity = 0.6 }: GlowProps) {
  const map = useMemo(getGlowTexture, [])
  return (
    <mesh position={position} rotation={rotation} renderOrder={1}>
      <planeGeometry args={size} />
      <meshBasicMaterial
        map={map}
        color={color}
        transparent
        opacity={opacity}
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}
