import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'

const FONT_PX = 48
const PADDING_PX = 24
/** World height of the label in metres. */
const HEIGHT = 0.28

interface Label3DProps {
  text: string
  position: [number, number, number]
  scale?: number
}

/**
 * A small sign drawn to a canvas texture. Lighter than an HTML overlay and
 * mounts and unmounts cleanly with the room it belongs to.
 */
export function Label3D({ text, position, scale = 1 }: Label3DProps) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const font = `${FONT_PX}px Georgia, 'Times New Roman', serif`
    ctx.font = font
    canvas.width = Math.ceil(ctx.measureText(text).width) + PADDING_PX * 2
    canvas.height = FONT_PX + PADDING_PX * 2
    ctx.fillStyle = 'rgba(24, 18, 12, 0.85)'
    ctx.beginPath()
    ctx.roundRect(0, 0, canvas.width, canvas.height, 16)
    ctx.fill()
    ctx.font = font
    ctx.fillStyle = '#f4ead8'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }, [text])

  useEffect(() => () => texture.dispose(), [texture])

  const { width, height } = texture.image as HTMLCanvasElement
  const h = HEIGHT * scale
  return (
    <mesh position={position}>
      <planeGeometry args={[(h * width) / height, h]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  )
}
