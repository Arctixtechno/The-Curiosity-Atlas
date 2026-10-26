import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { useHourCount } from '../../world/clock.ts'
import { factFor, type Fact } from './facts.ts'

// A "Did you know?" board on the wall: a printed card in a mahogany and
// brass frame, showing a different fact every hour of the house's clock.

const W = 1024
const H = 768

/** Breaks text into lines no wider than `width` in the context's current font. */
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

function drawCard(fact: Fact, number: number) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const paper = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7)
  paper.addColorStop(0, '#f6eedb')
  paper.addColorStop(1, '#e4d5b4')
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#a8823e'
  ctx.lineWidth = 3
  ctx.strokeRect(36, 36, W - 72, H - 72)
  ctx.lineWidth = 1
  ctx.strokeRect(48, 48, W - 96, H - 96)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#8a6424'
  ctx.font = '600 40px Georgia, serif'
  ctx.fillText('DID  YOU  KNOW?', W / 2, 128)
  ctx.font = 'italic 30px Georgia, serif'
  ctx.fillStyle = '#7a6a50'
  ctx.fillText(`No. ${number} · ${fact.topic}`, W / 2, 170)
  ctx.fillRect(W / 2 - 60, 196, 120, 2)

  // The fact, as large as fits.
  ctx.fillStyle = '#2a2016'
  let size = 54
  let lines: string[] = []
  for (; size > 30; size -= 2) {
    ctx.font = `${size}px Georgia, serif`
    lines = wrap(ctx, fact.text, W - 200)
    if (lines.length * size * 1.3 < H - 360) break
  }
  const top = (H + 210 - 110) / 2 - ((lines.length - 1) * size * 1.3) / 2
  lines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * size * 1.3))

  ctx.font = 'italic 26px Georgia, serif'
  ctx.fillStyle = '#8a7a60'
  ctx.fillText("A new one every hour of the house's clock", W / 2, H - 84)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

interface FactPlaqueProps {
  /** Which plaque this is, so each on the wall shows its own fact. */
  plaque: number
  position: [number, number, number]
  rotationY: number
  width?: number
}

export function FactPlaque({ plaque, position, rotationY, width = 1.0 }: FactPlaqueProps) {
  const hourCount = useHourCount()
  const fact = factFor(hourCount, plaque)
  const texture = useMemo(() => drawCard(fact, (hourCount % 900) + 100), [fact, hourCount])
  useEffect(() => () => texture.dispose(), [texture])
  const height = width * 0.75
  const brass = { color: '#d4b064', metalness: 0.6, roughness: 0.3 }
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0, 0.03]} castShadow>
        <boxGeometry args={[width + 0.2, height + 0.2, 0.06]} />
        <meshStandardMaterial color="#4a2a18" roughness={0.45} />
      </mesh>
      <mesh position={[0, 0, 0.062]}>
        <boxGeometry args={[width + 0.04, height + 0.04, 0.008]} />
        <meshStandardMaterial {...brass} />
      </mesh>
      <mesh position={[0, 0, 0.068]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={texture} roughness={0.8} />
      </mesh>
      {/* Brass corner bosses. */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sy) => (
          <mesh key={`${sx}${sy}`} position={[(sx * (width + 0.12)) / 2, (sy * (height + 0.12)) / 2, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.02, 16]} />
            <meshStandardMaterial {...brass} />
          </mesh>
        )),
      )}
    </group>
  )
}
