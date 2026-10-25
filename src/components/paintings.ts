import { CanvasTexture, SRGBColorSpace } from 'three'

// Procedurally painted artworks for the walls, so the house can be decorated
// without image files. Each one is drawn once and shared.

export type PaintingName = 'seascape' | 'hills' | 'map' | 'stars' | 'botanical' | 'abstract'

type Rand = () => number

function seeded(seed: number): Rand {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

const W = 768
const H = 576

const painters: Record<PaintingName, (ctx: CanvasRenderingContext2D, rand: Rand) => void> = {
  /** Sunset over the sea, in loose brushwork. */
  seascape: (ctx, rand) => {
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.6)
    sky.addColorStop(0, '#2c3e66')
    sky.addColorStop(0.6, '#d98a5a')
    sky.addColorStop(1, '#f3c98b')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, H * 0.6)
    ctx.fillStyle = '#ffe2a8'
    ctx.beginPath()
    ctx.arc(W * 0.62, H * 0.55, 46, 0, Math.PI * 2)
    ctx.fill()
    const sea = ctx.createLinearGradient(0, H * 0.58, 0, H)
    sea.addColorStop(0, '#5a6a80')
    sea.addColorStop(1, '#1d2a3a')
    ctx.fillStyle = sea
    ctx.fillRect(0, H * 0.58, W, H * 0.42)
    for (let i = 0; i < 260; i++) {
      const y = H * 0.6 + rand() * H * 0.4
      ctx.strokeStyle = `rgba(255, 210, 150, ${0.05 + (1 - Math.abs(rand() * 2 - 1)) * 0.25 * (1 - (y - H * 0.6) / (H * 0.4))})`
      ctx.lineWidth = 2 + rand() * 3
      const x = W * 0.62 + (rand() - 0.5) * 300
      ctx.beginPath()
      ctx.moveTo(x - 20 - rand() * 30, y)
      ctx.lineTo(x + 20 + rand() * 30, y)
      ctx.stroke()
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rand() * 0.08})`
      ctx.fillRect(rand() * W, rand() * H * 0.5, 60 + rand() * 120, 6 + rand() * 10)
    }
  },
  /** Rolling hills fading into mist. */
  hills: (ctx, rand) => {
    const sky = ctx.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, '#c9d6d8')
    sky.addColorStop(1, '#f1e6cf')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, H)
    const colours = ['#a9b8a6', '#8aa085', '#6c8a62', '#4f6e45', '#38542f']
    colours.forEach((colour, layer) => {
      ctx.fillStyle = colour
      ctx.beginPath()
      const base = H * (0.4 + layer * 0.12)
      ctx.moveTo(0, H)
      for (let x = 0; x <= W; x += 16) {
        ctx.lineTo(x, base + Math.sin(x / (90 + layer * 20) + layer * 2 + rand()) * (18 + layer * 6))
      }
      ctx.lineTo(W, H)
      ctx.fill()
    })
    ctx.fillStyle = '#2c3a24'
    for (let i = 0; i < 6; i++) {
      const x = 80 + rand() * (W - 160)
      ctx.beginPath()
      ctx.ellipse(x, H * 0.82, 18, 34, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  },
  /** An antique chart of an imaginary coast, with a compass rose. */
  map: (ctx, rand) => {
    ctx.fillStyle = '#e9dbb8'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#d9c38f'
    ctx.beginPath()
    let x = 0
    let y = H * 0.35
    ctx.moveTo(0, 0)
    ctx.lineTo(0, y)
    while (x < W) {
      x += 10 + rand() * 20
      y += (rand() - 0.5) * 40
      y = Math.max(H * 0.15, Math.min(H * 0.7, y))
      ctx.lineTo(x, y)
    }
    ctx.lineTo(W, 0)
    ctx.fill()
    ctx.strokeStyle = '#7a5a30'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.strokeStyle = 'rgba(122, 90, 48, 0.25)'
    ctx.lineWidth = 1
    for (let i = 1; i < 8; i++) {
      ctx.beginPath()
      ctx.moveTo((W / 8) * i, 0)
      ctx.lineTo((W / 8) * i, H)
      ctx.moveTo(0, (H / 6) * i)
      ctx.lineTo(W, (H / 6) * i)
      ctx.stroke()
    }
    const cx = W * 0.72
    const cy = H * 0.72
    ctx.fillStyle = '#7a5a30'
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4
      const r = i % 2 ? 40 : 80
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a - 0.15) * 14, cy + Math.sin(a - 0.15) * 14)
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
      ctx.lineTo(cx + Math.cos(a + 0.15) * 14, cy + Math.sin(a + 0.15) * 14)
      ctx.fill()
    }
    ctx.font = 'italic 34px Georgia, serif'
    ctx.fillText('Terra Incognita', 60, H - 50)
  },
  /** A celestial chart: constellations on deep blue. */
  stars: (ctx, rand) => {
    ctx.fillStyle = '#0f1a3a'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(214, 190, 130, 0.5)'
    ctx.beginPath()
    ctx.arc(W / 2, H / 2, H * 0.44, 0, Math.PI * 2)
    ctx.stroke()
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = `rgba(255, 250, 230, ${0.3 + rand() * 0.7})`
      ctx.fillRect(rand() * W, rand() * H, 1.5, 1.5)
    }
    for (let c = 0; c < 6; c++) {
      let px = 100 + rand() * (W - 200)
      let py = 80 + rand() * (H - 160)
      ctx.strokeStyle = 'rgba(214, 190, 130, 0.7)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(px, py)
      for (let s = 0; s < 4; s++) {
        ctx.fillStyle = '#fff6d8'
        ctx.beginPath()
        ctx.arc(px, py, 3.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(px, py)
        px += (rand() - 0.5) * 120
        py += (rand() - 0.5) * 120
        ctx.lineTo(px, py)
        ctx.stroke()
      }
    }
  },
  /** A botanical study: leaves on parchment. */
  botanical: (ctx, rand) => {
    ctx.fillStyle = '#f2ead6'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = '#4b5e34'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(W / 2, H - 40)
    ctx.bezierCurveTo(W / 2 - 40, H * 0.6, W / 2 + 40, H * 0.3, W / 2, 50)
    ctx.stroke()
    for (let i = 0; i < 12; i++) {
      const t = i / 12
      const y = H - 60 - t * (H - 120)
      const side = i % 2 ? 1 : -1
      ctx.save()
      ctx.translate(W / 2 + side * 6, y)
      ctx.rotate(side * (0.7 + rand() * 0.3))
      ctx.fillStyle = ['#5f7a3e', '#6d8a46', '#4f6834'][i % 3]
      ctx.beginPath()
      ctx.ellipse(side * 55, 0, 60 - t * 25, 18 - t * 5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    ctx.fillStyle = '#5a4a30'
    ctx.font = 'italic 26px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('Folium curiositatis', W / 2, H - 12)
  },
  /** Circles and lines in the spirit of early abstract painting. */
  abstract: (ctx, rand) => {
    ctx.fillStyle = '#efe6d2'
    ctx.fillRect(0, 0, W, H)
    const colours = ['#c0392b', '#2a5d8f', '#e0a63a', '#1f1f1f', '#3f7d5a']
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = colours[i % colours.length]
      ctx.globalAlpha = 0.85
      ctx.beginPath()
      ctx.arc(rand() * W, rand() * H, 20 + rand() * 90, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.strokeStyle = '#1f1f1f'
    for (let i = 0; i < 7; i++) {
      ctx.lineWidth = 2 + rand() * 6
      ctx.beginPath()
      ctx.moveTo(rand() * W, rand() * H)
      ctx.lineTo(rand() * W, rand() * H)
      ctx.stroke()
    }
  },
}

const cache = new Map<PaintingName, CanvasTexture>()

/** The canvas texture for a painting, painted on first use. */
export function getPainting(name: PaintingName): CanvasTexture {
  let texture = cache.get(name)
  if (!texture) {
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!
    painters[name](ctx, seeded(name.length * 131 + 7))
    // A little canvas texture over everything so it reads as paint, not print.
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},0.04)`
      ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2)
    }
    texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    cache.set(name, texture)
  }
  return texture
}
