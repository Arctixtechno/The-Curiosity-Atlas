import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { dailyDiscovery } from './daily.ts'
import { discoveries } from './discoveries.ts'

// A brass reading stand in front of the fountain, holding a card with today's
// question, so you can see what the fountain is asking before you go up to it.

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > width && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

function drawCard(question: string, topic: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#f4ecd8'
  ctx.fillRect(0, 0, 768, 512)
  ctx.strokeStyle = '#a8823e'
  ctx.lineWidth = 3
  ctx.strokeRect(22, 22, 724, 468)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#8a6424'
  ctx.font = '600 30px Georgia, serif'
  ctx.fillText("TODAY'S  QUESTION", 384, 86)
  ctx.font = 'italic 24px Georgia, serif'
  ctx.fillStyle = '#7a6a50'
  ctx.fillText(topic, 384, 122)
  ctx.fillStyle = '#2a2016'
  let size = 44
  let lines: string[] = []
  for (; size > 26; size -= 2) {
    ctx.font = `${size}px Georgia, serif`
    lines = wrap(ctx, question, 640)
    if (lines.length * size * 1.3 < 270) break
  }
  const top = 300 - ((lines.length - 1) * size * 1.3) / 2
  lines.forEach((l, i) => ctx.fillText(l, 384, top + i * size * 1.3))
  ctx.font = 'italic 22px Georgia, serif'
  ctx.fillStyle = '#8a7a60'
  ctx.fillText('Make a guess at the fountain to find out', 384, 462)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

/** The stand, at `position`, turned by `rotationY`; the card faces its local +z. */
export function QuestionCard({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  const today = dailyDiscovery(discoveries)
  const texture = useMemo(() => drawCard(today.question, today.topic), [today])
  useEffect(() => () => texture.dispose(), [texture])
  const brass = { color: '#c9a55c', metalness: 0.7, roughness: 0.3 }
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.22, 0.26, 0.04, 24]} />
        <meshStandardMaterial {...brass} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.025, 0.035, 1.05, 12]} />
        <meshStandardMaterial {...brass} />
      </mesh>
      <group position={[0, 1.12, 0]} rotation={[-0.55, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.66, 0.46, 0.03]} />
          <meshStandardMaterial {...brass} />
        </mesh>
        <mesh position={[0, 0, 0.017]}>
          <planeGeometry args={[0.6, 0.4]} />
          <meshStandardMaterial map={texture} roughness={0.8} />
        </mesh>
      </group>
    </group>
  )
}
