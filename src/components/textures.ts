import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

// Procedural textures drawn on a canvas at runtime, so the prototype gets
// surface detail without downloading any image files.
//
// Large surfaces (floors, walls) get a texture painted for their exact size,
// so nothing repeats. Small objects share a tile that repeats.

/** Pixels per metre for one-off surface textures. */
const SURFACE_PPM = 160
/** Largest texture side most GPUs accept. */
const MAX_PX = 4096

type Rand = () => number

/** Deterministic pseudo-random numbers, so surfaces look the same every visit. */
function seeded(seed: number): Rand {
  let s = (seed * 2654435761) >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

function rgb(hex: string, lighten = 0, alpha = 1) {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + lighten * 255)))
  return `rgba(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)}, ${alpha})`
}

interface Canvas {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
  /** Pixels per metre. */
  ppm: number
  rand: Rand
}

let noiseTile: HTMLCanvasElement | null = null

/** A small tile of random light and dark pixels, built once and reused as a pattern. */
function getNoiseTile() {
  if (!noiseTile) {
    noiseTile = document.createElement('canvas')
    noiseTile.width = noiseTile.height = 256
    const ctx = noiseTile.getContext('2d')!
    const image = ctx.createImageData(256, 256)
    const rand = seeded(99)
    for (let i = 0; i < image.data.length; i += 4) {
      const v = rand() > 0.5 ? 255 : 0
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v
      image.data[i + 3] = Math.floor(rand() * 255)
    }
    ctx.putImageData(image, 0, 0)
  }
  return noiseTile
}

/** Fine grain: random light and dark specks over the whole surface. */
function grain({ ctx, w, h, rand }: Canvas, alpha: number) {
  const pattern = ctx.createPattern(getNoiseTile(), 'repeat')!
  // Offset per surface so neighbouring surfaces don't share the same speckle.
  pattern.setTransform(new DOMMatrix().translate(rand() * 256, rand() * 256))
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

/** Large soft patches of light and shade, `size` in metres, so big surfaces don't look flat. */
function mottle({ ctx, w, h, ppm, rand }: Canvas, size: number, alpha: number) {
  const count = Math.ceil((w * h) / (size * size * ppm * ppm)) * 3
  for (let i = 0; i < count; i++) {
    const r = size * ppm * (0.5 + rand())
    const x = rand() * w
    const y = rand() * h
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const tone = rand() > 0.5 ? '255,250,240' : '60,45,30'
    g.addColorStop(0, `rgba(${tone},${alpha})`)
    g.addColorStop(1, `rgba(${tone},0)`)
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
}

type Painter = (c: Canvas) => void

const painters = {
  /** Wooden planks running along the longer side, with staggered joints, grain and knots. */
  wood: (c) => {
    const { ctx, ppm, rand } = c
    const along = c.w >= c.h
    const length = along ? c.w : c.h
    const across = along ? c.h : c.w
    if (!along) {
      ctx.save()
      ctx.translate(c.w, 0)
      ctx.rotate(Math.PI / 2)
    }
    const plankW = 0.16 * ppm
    for (let row = 0; row * plankW < across; row++) {
      let x = -rand() * 2 * ppm
      while (x < length) {
        const plankL = (1.2 + rand() * 1.4) * ppm
        const tone = (rand() - 0.5) * 0.14
        const y = row * plankW
        ctx.fillStyle = rgb('#7a5434', tone)
        ctx.fillRect(x, y, plankL, plankW)
        // Grain: long gently wavy lines.
        for (let g = 0; g < 9; g++) {
          ctx.strokeStyle = `rgba(40, 20, 8, ${0.06 + rand() * 0.12})`
          ctx.lineWidth = 0.6 + rand() * 1.2
          const gy = y + rand() * plankW
          const phase = rand() * 10
          ctx.beginPath()
          ctx.moveTo(x, gy)
          for (let px = 0; px <= plankL; px += 12) {
            ctx.lineTo(x + px, gy + Math.sin(px / (40 + g * 9) + phase) * 2.2)
          }
          ctx.stroke()
        }
        if (rand() < 0.18) {
          const kx = x + rand() * plankL
          const ky = y + plankW * (0.3 + rand() * 0.4)
          ctx.fillStyle = 'rgba(45, 22, 8, 0.55)'
          ctx.beginPath()
          ctx.ellipse(kx, ky, 5 + rand() * 6, 3 + rand() * 3, 0, 0, Math.PI * 2)
          ctx.fill()
        }
        // Seams.
        ctx.fillStyle = 'rgba(20, 10, 4, 0.7)'
        ctx.fillRect(x, y, 2, plankW)
        ctx.fillRect(x, y, plankL, 1.5)
        x += plankL
      }
    }
    if (!along) ctx.restore()
    grain(c, 0.06)
  },

  /** Smooth warm plaster with soft trowel marks. */
  plaster: (c) => {
    const { ctx, w, h, ppm, rand } = c
    ctx.fillStyle = '#ddd0b6'
    ctx.fillRect(0, 0, w, h)
    mottle(c, 1.2, 0.035)
    mottle(c, 0.35, 0.02)
    const strokes = (w * h) / (ppm * ppm) * 25
    for (let i = 0; i < strokes; i++) {
      ctx.strokeStyle = rand() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(90,70,45,0.025)'
      ctx.lineWidth = 6 + rand() * 18
      const x = rand() * w
      const y = rand() * h
      const r = (0.15 + rand() * 0.3) * ppm
      ctx.beginPath()
      ctx.arc(x, y, r, rand() * Math.PI, rand() * Math.PI + 1)
      ctx.stroke()
    }
    grain(c, 0.05)
  },

  /** Painted white stucco for the house front. */
  stucco: (c) => {
    const { ctx, w, h } = c
    ctx.fillStyle = '#f4efe4'
    ctx.fillRect(0, 0, w, h)
    mottle(c, 1.5, 0.025)
    mottle(c, 0.4, 0.015)
    grain(c, 0.05)
  },

  /** Irregular flagstones laid in courses, with grout. */
  stone: (c) => {
    const { ctx, w, h, ppm, rand } = c
    ctx.fillStyle = '#5d564c'
    ctx.fillRect(0, 0, w, h)
    const course = 0.6 * ppm
    for (let y = 0; y < h; y += course) {
      let x = -rand() * ppm
      while (x < w) {
        const slab = (0.5 + rand() * 0.6) * ppm
        ctx.fillStyle = rgb('#a39a88', (rand() - 0.5) * 0.14)
        ctx.fillRect(x + 2, y + 2, slab - 4, course - 4)
        x += slab
      }
    }
    mottle(c, 0.8, 0.06)
    grain(c, 0.12)
  },

  /** Short grass. */
  grass: (c) => {
    const { ctx, w, h, rand } = c
    ctx.fillStyle = '#3d5a26'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < w * h * 0.06; i++) {
      ctx.strokeStyle = rgb(rand() > 0.5 ? '#557a33' : '#2c4419', (rand() - 0.5) * 0.1, 0.8)
      ctx.lineWidth = 1
      const x = rand() * w
      const y = rand() * h
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + (rand() - 0.5) * 3, y - 2 - rand() * 4)
      ctx.stroke()
    }
  },

  /** Dense clipped hedge: overlapping leaf clusters with dark gaps. */
  hedge: (c) => {
    const { ctx, w, h, rand } = c
    ctx.fillStyle = '#22381a'
    ctx.fillRect(0, 0, w, h)
    const greens = ['#3a6226', '#4a7a30', '#5a8a38', '#2f5222', '#6a9a42']
    for (let i = 0; i < w * h * 0.02; i++) {
      ctx.fillStyle = greens[Math.floor(rand() * greens.length)]
      ctx.beginPath()
      ctx.ellipse(rand() * w, rand() * h, 2 + rand() * 4, 1.5 + rand() * 2.5, rand() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
  },

  /** Theatre carpet with a small repeating diamond pattern. */
  carpet: (c) => {
    const { ctx, w, h, ppm } = c
    ctx.fillStyle = '#3a1a22'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(200, 150, 80, 0.16)'
    ctx.lineWidth = 2
    const step = 0.25 * ppm
    for (let x = 0; x < w; x += step) {
      for (let y = 0; y < h; y += step) {
        ctx.beginPath()
        ctx.moveTo(x + step / 2, y + step * 0.15)
        ctx.lineTo(x + step * 0.85, y + step / 2)
        ctx.lineTo(x + step / 2, y + step * 0.85)
        ctx.lineTo(x + step * 0.15, y + step / 2)
        ctx.closePath()
        ctx.stroke()
      }
    }
    mottle(c, 1, 0.05)
    grain(c, 0.15)
  },

  /** Fabric-covered acoustic panels for the theatre walls. */
  panel: (c) => {
    const { ctx, w, h, ppm, rand } = c
    ctx.fillStyle = '#251a1f'
    ctx.fillRect(0, 0, w, h)
    const pw = 0.6 * ppm
    for (let x = 0; x < w; x += pw) {
      ctx.fillStyle = rgb('#3e2b33', (rand() - 0.5) * 0.04)
      ctx.fillRect(x + 3, 0, pw - 6, h)
    }
    mottle(c, 1, 0.04)
    grain(c, 0.08)
  },

  /** Woven upholstery. */
  fabric: (c) => {
    const { ctx, w, h, rand } = c
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < Math.max(w, h); i += 3) {
      ctx.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.05})`
      ctx.fillRect(i, 0, 1.5, h)
      ctx.fillRect(0, i, w, 1.5)
    }
    grain(c, 0.1)
  },

  /** Soft leather: fine pebbled grain and a few creases. Tinted by the material colour. */
  leather: (c) => {
    const { ctx, w, h, rand } = c
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < w * h * 0.05; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.04 + rand() * 0.06})`
      ctx.beginPath()
      ctx.arc(rand() * w, rand() * h, 0.8 + rand() * 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = 'rgba(0,0,0,0.08)'
      ctx.lineWidth = 1 + rand() * 2
      ctx.beginPath()
      let x = rand() * w
      let y = rand() * h
      ctx.moveTo(x, y)
      for (let s = 0; s < 5; s++) {
        x += (rand() - 0.5) * 60
        y += (rand() - 0.5) * 20
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  },

  /** A panelled door: vertical grain with four recessed panels. Tinted by the material colour. */
  door: (c) => {
    const { ctx, w, h, rand } = c
    ctx.fillStyle = '#c9a582'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < w / 2; i++) {
      ctx.strokeStyle = `rgba(70, 40, 15, ${0.05 + rand() * 0.1})`
      ctx.lineWidth = 0.5 + rand()
      const x = rand() * w
      ctx.beginPath()
      ctx.moveTo(x, 0)
      for (let y = 0; y <= h; y += 16) ctx.lineTo(x + Math.sin(y / 70 + i) * 1.5, y)
      ctx.stroke()
    }
    const m = w * 0.12
    const pw = (w - m * 3) / 2
    const ph = [(h - m * 3) * 0.38, (h - m * 3) * 0.62]
    let y = m
    for (const panelH of ph) {
      for (const x of [m, m * 2 + pw]) {
        ctx.fillStyle = 'rgba(0,0,0,0.12)'
        ctx.fillRect(x, y, pw, panelH)
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'
        ctx.lineWidth = 3
        ctx.strokeRect(x + 1.5, y + 1.5, pw - 3, panelH - 3)
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'
        ctx.lineWidth = 2
        ctx.strokeRect(x + 6, y + 6, pw - 12, panelH - 12)
      }
      y += panelH + m
    }
  },

  /** White marble with grey veins. */
  marble: (c) => {
    const { ctx, w, h, rand } = c
    ctx.fillStyle = '#eeebe5'
    ctx.fillRect(0, 0, w, h)
    mottle(c, 0.3, 0.06)
    for (let v = 0; v < 7; v++) {
      ctx.strokeStyle = `rgba(110, 110, 120, ${0.15 + rand() * 0.25})`
      ctx.lineWidth = 0.5 + rand() * 2
      let x = rand() * w
      let y = 0
      ctx.beginPath()
      ctx.moveTo(x, y)
      while (y < h) {
        x += (rand() - 0.5) * 30
        y += 10 + rand() * 25
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  },
} satisfies Record<string, Painter>

export type TextureName = keyof typeof painters

function paint(name: TextureName, wPx: number, hPx: number, ppm: number, seed: number): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = wPx
  canvas.height = hPx
  const ctx = canvas.getContext('2d')!
  painters[name]({ ctx, w: wPx, h: hPx, ppm, rand: seeded(seed) })
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.anisotropy = 8
  return texture
}

/**
 * A texture painted for one surface of `width` × `height` metres, so nothing
 * repeats across it. The caller owns it and should dispose it.
 */
export function surfaceTexture(
  name: TextureName,
  width: number,
  height: number,
  seed = 1,
  pixelsPerMetre = SURFACE_PPM,
): CanvasTexture {
  const ppm = Math.min(pixelsPerMetre, MAX_PX / width, MAX_PX / height)
  return paint(name, Math.ceil(width * ppm), Math.ceil(height * ppm), ppm, seed + name.length * 31)
}

/** Shared tiles for small objects: [metres covered by one tile, pixels per metre]. */
const TILE_SIZES: Partial<Record<TextureName, [number, number]>> = {
  leather: [0.5, 512],
  marble: [1, 512],
  hedge: [1, 384],
  grass: [2, 256],
  fabric: [0.5, 512],
}

const tileCache = new Map<TextureName, CanvasTexture>()

/** A copy of a shared tile, repeated `x` × `y` times across an object. Dispose the copy when done. */
export function tiled(name: TextureName, x: number, y: number): Texture {
  let tile = tileCache.get(name)
  if (!tile) {
    const [metres, ppm] = TILE_SIZES[name] ?? [1, 256]
    tile = paint(name, metres * ppm, metres * ppm, ppm, 7)
    tileCache.set(name, tile)
  }
  const texture = tile.clone()
  texture.repeat.set(x, y)
  texture.needsUpdate = true
  return texture
}
