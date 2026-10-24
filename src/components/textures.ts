import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

// Procedural textures drawn on a canvas at runtime, so the prototype gets
// some surface detail without downloading any image files. Each texture is
// drawn once and shared; use `tiled` to get a copy with its own repeat.

const SIZE = 512

/** Deterministic pseudo-random numbers, so surfaces look the same every visit. */
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amount * 255)))
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`
}

function speckle(ctx: CanvasRenderingContext2D, rand: () => number, count: number, alpha: number) {
  for (let i = 0; i < count; i++) {
    const light = rand() > 0.5
    ctx.fillStyle = light ? `rgba(255,255,255,${alpha * rand()})` : `rgba(0,0,0,${alpha * rand()})`
    ctx.fillRect(rand() * SIZE, rand() * SIZE, 1 + rand() * 2, 1 + rand() * 2)
  }
}

type Painter = (ctx: CanvasRenderingContext2D, rand: () => number) => void

const painters = {
  /** Horizontal wooden planks with grain and seams. */
  wood: (ctx, rand) => {
    const base = '#6b4a2f'
    const planks = 8
    const h = SIZE / planks
    for (let p = 0; p < planks; p++) {
      ctx.fillStyle = shade(base, (rand() - 0.5) * 0.12)
      ctx.fillRect(0, p * h, SIZE, h)
      for (let g = 0; g < 14; g++) {
        ctx.strokeStyle = `rgba(30, 15, 5, ${0.08 + rand() * 0.12})`
        ctx.lineWidth = 1 + rand()
        const y = p * h + rand() * h
        ctx.beginPath()
        ctx.moveTo(0, y)
        for (let x = 0; x <= SIZE; x += 32) ctx.lineTo(x, y + Math.sin(x / 60 + g) * 2)
        ctx.stroke()
      }
      ctx.fillStyle = 'rgba(20, 10, 4, 0.55)'
      ctx.fillRect(0, p * h, SIZE, 2)
      const joint = rand() * SIZE
      ctx.fillRect(joint, p * h, 2, h)
    }
  },
  /** Warm plaster with soft blotches. */
  plaster: (ctx, rand) => {
    ctx.fillStyle = '#d8c7a8'
    ctx.fillRect(0, 0, SIZE, SIZE)
    for (let i = 0; i < 60; i++) {
      const r = 20 + rand() * 60
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
      const tone = rand() > 0.5 ? '255,250,240' : '120,95,60'
      g.addColorStop(0, `rgba(${tone},0.06)`)
      g.addColorStop(1, `rgba(${tone},0)`)
      ctx.save()
      ctx.translate(rand() * SIZE, rand() * SIZE)
      ctx.fillStyle = g
      ctx.fillRect(-r, -r, r * 2, r * 2)
      ctx.restore()
    }
    speckle(ctx, rand, 6000, 0.08)
  },
  /** Woven upholstery fabric. */
  fabric: (ctx, rand) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, SIZE, SIZE)
    for (let i = 0; i < SIZE; i += 4) {
      ctx.fillStyle = `rgba(0,0,0,${0.06 + rand() * 0.05})`
      ctx.fillRect(i, 0, 2, SIZE)
      ctx.fillStyle = `rgba(0,0,0,${0.04 + rand() * 0.04})`
      ctx.fillRect(0, i, SIZE, 2)
    }
    speckle(ctx, rand, 3000, 0.1)
  },
  /** Theatre carpet with a small repeating diamond pattern. */
  carpet: (ctx, rand) => {
    ctx.fillStyle = '#3a1a22'
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.strokeStyle = 'rgba(200, 150, 80, 0.18)'
    ctx.lineWidth = 3
    const step = 64
    for (let x = 0; x < SIZE; x += step) {
      for (let y = 0; y < SIZE; y += step) {
        ctx.beginPath()
        ctx.moveTo(x + step / 2, y + 8)
        ctx.lineTo(x + step - 8, y + step / 2)
        ctx.lineTo(x + step / 2, y + step - 8)
        ctx.lineTo(x + 8, y + step / 2)
        ctx.closePath()
        ctx.stroke()
      }
    }
    speckle(ctx, rand, 12000, 0.15)
  },
  /** Square stone paving with grout lines. */
  stone: (ctx, rand) => {
    const tiles = 4
    const t = SIZE / tiles
    ctx.fillStyle = '#6f6555'
    ctx.fillRect(0, 0, SIZE, SIZE)
    for (let x = 0; x < tiles; x++) {
      for (let y = 0; y < tiles; y++) {
        ctx.fillStyle = shade('#b9a888', (rand() - 0.5) * 0.12)
        ctx.fillRect(x * t + 3, y * t + 3, t - 6, t - 6)
      }
    }
    speckle(ctx, rand, 8000, 0.12)
  },
  /** Fine dark acoustic panelling for theatre walls. */
  panel: (ctx, rand) => {
    ctx.fillStyle = '#3a2a30'
    ctx.fillRect(0, 0, SIZE, SIZE)
    const w = SIZE / 4
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = shade('#3a2a30', (rand() - 0.5) * 0.04)
      ctx.fillRect(i * w + 4, 0, w - 8, SIZE)
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(i * w, 0, 4, SIZE)
    }
    speckle(ctx, rand, 4000, 0.08)
  },
} satisfies Record<string, Painter>

export type TextureName = keyof typeof painters

const cache = new Map<TextureName, CanvasTexture>()

/** The shared texture for a surface type, drawn on first use. */
export function getTexture(name: TextureName): CanvasTexture {
  let texture = cache.get(name)
  if (!texture) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = SIZE
    painters[name](canvas.getContext('2d')!, seeded(name.length * 7919))
    texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.anisotropy = 8
    cache.set(name, texture)
  }
  return texture
}

/** A copy of a texture repeated `x` × `y` times across a surface. Shares the image. */
export function tiled(name: TextureName, x: number, y: number): Texture {
  const texture = getTexture(name).clone()
  texture.repeat.set(x, y)
  texture.needsUpdate = true
  return texture
}
