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
    const strokes = ((w * h) / (ppm * ppm)) * 25
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

  /** London stock brick in Flemish bond: yellow-grey bricks, the odd darker header, lime mortar. */
  brick: (c) => {
    const { ctx, w, h, ppm, rand } = c
    ctx.fillStyle = '#cfc6b4'
    ctx.fillRect(0, 0, w, h)
    const course = 0.075 * ppm
    const stretcher = 0.225 * ppm
    const header = 0.1125 * ppm
    const joint = Math.max(1, 0.01 * ppm)
    for (let row = 0, y = 0; y < h; row++, y += course) {
      // Alternate stretcher and header, offset every other course.
      let x = row % 2 ? -(stretcher + header) / 2 : 0
      for (let i = 0; x < w; i++) {
        const isHeader = i % 2 === 1
        const len = isHeader ? header : stretcher
        const base = isHeader && rand() < 0.5 ? '#8a7258' : rand() < 0.08 ? '#b06a48' : '#c9a774'
        ctx.fillStyle = rgb(base, (rand() - 0.5) * 0.12)
        ctx.fillRect(x + joint / 2, y + joint / 2, len - joint, course - joint)
        x += len
      }
    }
    mottle(c, 0.6, 0.06)
    grain(c, 0.14)
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

  /** Foliage: clumps of light and shade, overlaid with individual pointed leaves. */
  hedge: (c) => {
    const { ctx, w, h, rand } = c
    ctx.fillStyle = '#1e3416'
    ctx.fillRect(0, 0, w, h)
    // Clumps: soft lighter patches with darker gaps between them.
    for (let i = 0; i < (w * h) / 900; i++) {
      const x = rand() * w
      const y = rand() * h
      const r = 18 + rand() * 30
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r)
      g.addColorStop(0, rgb('#4f7a32', (rand() - 0.5) * 0.08, 0.9))
      g.addColorStop(1, 'rgba(30, 52, 22, 0)')
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    // Leaves: pointed ellipses in varied greens, lit from above.
    const greens = ['#2f5222', '#3d6a28', '#4d7d30', '#5f8f3a', '#6f9e44', '#2a4a1e']
    for (let i = 0; i < (w * h) / 60; i++) {
      const x = rand() * w
      const y = rand() * h
      const len = 5 + rand() * 7
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rand() * Math.PI * 2)
      ctx.fillStyle = greens[Math.floor(rand() * greens.length)]
      ctx.beginPath()
      ctx.moveTo(-len, 0)
      ctx.quadraticCurveTo(0, -len * 0.45, len, 0)
      ctx.quadraticCurveTo(0, len * 0.45, -len, 0)
      ctx.fill()
      ctx.restore()
    }
  },

  /**
   * Clipped box or privet: small leaves packed in layers, darker deeper in
   * and brighter on the outside where the light reaches, with dark gaps.
   */
  boxleaf: (c) => {
    const { ctx, w, h, ppm, rand } = c
    ctx.fillStyle = '#132310'
    ctx.fillRect(0, 0, w, h)
    const layers = [
      { greens: ['#1f3a17', '#24421a', '#2a4a1d'], count: 0.9 },
      { greens: ['#2f5521', '#3a6427', '#33592a'], count: 1 },
      { greens: ['#4a7a2f', '#578a37', '#3f6c2a', '#6a9a40'], count: 0.75 },
      { greens: ['#78a84a', '#88b656', '#6e9e45'], count: 0.18 },
    ]
    for (const { greens, count } of layers) {
      const n = ((w * h) / (ppm * ppm)) * 9000 * count
      for (let i = 0; i < n; i++) {
        const x = rand() * w
        const y = rand() * h
        const len = (0.009 + rand() * 0.008) * ppm
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(rand() * Math.PI * 2)
        ctx.fillStyle = greens[Math.floor(rand() * greens.length)]
        ctx.beginPath()
        ctx.ellipse(0, 0, len, len * 0.55, 0, 0, Math.PI * 2)
        ctx.fill()
        // A glint along one side of the leaf, where it catches the sky.
        ctx.fillStyle = 'rgba(220, 240, 190, 0.12)'
        ctx.beginPath()
        ctx.ellipse(-len * 0.2, -len * 0.18, len * 0.6, len * 0.22, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }
    mottle(c, 0.25, 0.06)
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

  /** Victorian black and cream chequered floor tiles, slightly worn. */
  chequer: (c) => {
    const { ctx, w, h, ppm, rand } = c
    const tile = 0.3 * ppm
    ctx.fillStyle = '#4a4540'
    ctx.fillRect(0, 0, w, h)
    for (let y = 0; y * tile < h; y++) {
      for (let x = 0; x * tile < w; x++) {
        ctx.fillStyle = (x + y) % 2 ? rgb('#1e1c1b', (rand() - 0.5) * 0.04) : rgb('#e4dccb', (rand() - 0.5) * 0.06)
        ctx.fillRect(x * tile + 1.5, y * tile + 1.5, tile - 3, tile - 3)
      }
    }
    mottle(c, 0.7, 0.05)
    grain(c, 0.1)
  },

  /** White glazed wall tiles in a brick bond, with grey grout. */
  glazed: (c) => {
    const { ctx, w, h, ppm, rand } = c
    const tw = 0.15 * ppm
    const th = 0.075 * ppm
    ctx.fillStyle = '#9a968c'
    ctx.fillRect(0, 0, w, h)
    for (let row = 0; row * th < h; row++) {
      for (let x = row % 2 ? -tw / 2 : 0; x < w; x += tw) {
        ctx.fillStyle = rgb('#efece3', (rand() - 0.5) * 0.05)
        ctx.fillRect(x + 1, row * th + 1, tw - 2, th - 2)
      }
    }
    grain(c, 0.05)
  },

  /** Oak parquet laid in a herringbone, the blocks at 45° to the walls. */
  herringbone: (c) => {
    const { ctx, w, h, ppm, rand } = c
    const u = 0.07 * ppm
    const k = 5
    const L = u * k
    const span = Math.hypot(w, h)
    ctx.fillStyle = '#3a2614'
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate(Math.PI / 4)
    const block = (x: number, y: number, bw: number, bh: number) => {
      ctx.fillStyle = rgb('#8a6038', (rand() - 0.5) * 0.12)
      ctx.fillRect(x, y, bw, bh)
      // A few grain lines along the block.
      const along = bw > bh
      ctx.strokeStyle = `rgba(40, 20, 8, ${0.08 + rand() * 0.08})`
      ctx.lineWidth = 0.8
      ctx.beginPath()
      for (let g = 0; g < 3; g++) {
        const t = 0.2 + rand() * 0.6
        if (along) {
          ctx.moveTo(x, y + bh * t)
          ctx.lineTo(x + bw, y + bh * (t + (rand() - 0.5) * 0.2))
        } else {
          ctx.moveTo(x + bw * t, y)
          ctx.lineTo(x + bw * (t + (rand() - 0.5) * 0.2), y + bh)
        }
      }
      ctx.stroke()
      ctx.strokeStyle = 'rgba(25, 12, 4, 0.6)'
      ctx.lineWidth = 1
      ctx.strokeRect(x, y, bw, bh)
    }
    // Each chain steps diagonally: a block along x, then one along y. Chains repeat every 2L along x.
    const steps = Math.ceil(span / u)
    const chains = Math.ceil(span / (2 * L)) + k
    for (let ci = -chains; ci <= chains; ci++) {
      for (let n = -steps; n <= steps; n++) {
        const x = ci * 2 * L + n * u
        const y = n * u
        if (Math.abs(x) > span || Math.abs(y) > span) continue
        block(x, y, L, u)
        block(x, y + u, u, L)
      }
    }
    ctx.restore()
    mottle(c, 1, 0.05)
    grain(c, 0.08)
  },

  /** Painted tongue-and-groove boarding, upright. Tinted by the material colour. */
  boarding: (c) => {
    const { ctx, w, h, ppm, rand } = c
    const board = 0.1 * ppm
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    for (let x = 0; x < w; x += board) {
      ctx.fillStyle = `rgba(0, 0, 0, ${(rand() * 0.04).toFixed(3)})`
      ctx.fillRect(x, 0, board, h)
      // The groove: a dark line with a highlight beside it.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
      ctx.fillRect(x, 0, 2, h)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.fillRect(x + 2, 0, 1.5, h)
    }
    mottle(c, 0.8, 0.04)
    grain(c, 0.06)
  },

  /**
   * A worn Persian-style rug: a madder-red field with a central medallion,
   * corner pieces and layered borders, the pile faded where feet go.
   */
  rug: (c) => {
    const { ctx, w, h, ppm, rand } = c
    const u = ppm * 0.01
    ctx.fillStyle = '#7a2a22'
    ctx.fillRect(0, 0, w, h)
    // Borders: a dark guard, the main border with a running vine, and a light inner guard.
    const band = (inset: number, width: number, colour: string) => {
      ctx.strokeStyle = colour
      ctx.lineWidth = width * u
      ctx.strokeRect((inset + width / 2) * u, (inset + width / 2) * u, w - (inset * 2 + width) * u, h - (inset * 2 + width) * u)
    }
    band(0, 4, '#1f2438')
    band(4, 22, '#24304a')
    band(26, 3, '#d8c49a')
    band(29, 2, '#1f2438')
    // A running vine of small flowers along the main border.
    ctx.fillStyle = '#c99a4a'
    const vine = (x: number, y: number) => {
      ctx.beginPath()
      ctx.arc(x, y, 3.2 * u, 0, Math.PI * 2)
      ctx.fill()
    }
    const mid = 15 * u
    for (let x = mid; x < w - mid; x += 14 * u) {
      vine(x, mid)
      vine(x, h - mid)
    }
    for (let y = mid; y < h - mid; y += 14 * u) {
      vine(mid, y)
      vine(w - mid, y)
    }
    ctx.fillStyle = '#a8433a'
    for (let x = mid + 7 * u; x < w - mid; x += 14 * u) {
      vine(x, mid)
      vine(x, h - mid)
    }
    // The field's small all-over pattern of lozenges.
    const fx = 34 * u
    ctx.save()
    ctx.beginPath()
    ctx.rect(fx, fx, w - fx * 2, h - fx * 2)
    ctx.clip()
    for (let y = fx; y < h; y += 12 * u) {
      for (let x = fx + ((y / (12 * u)) % 2) * 6 * u; x < w; x += 12 * u) {
        ctx.fillStyle = rand() > 0.5 ? 'rgba(30, 36, 56, 0.35)' : 'rgba(210, 170, 100, 0.22)'
        ctx.beginPath()
        ctx.moveTo(x, y - 2.5 * u)
        ctx.lineTo(x + 2.5 * u, y)
        ctx.lineTo(x, y + 2.5 * u)
        ctx.lineTo(x - 2.5 * u, y)
        ctx.fill()
      }
    }
    ctx.restore()
    // Medallion: nested lobed shapes in navy, ivory and gold.
    const cx = w / 2
    const cy = h / 2
    const medallion = (r: number, colour: string, lobes: number) => {
      ctx.fillStyle = colour
      ctx.beginPath()
      for (let i = 0; i <= 200; i++) {
        const a = (i / 200) * Math.PI * 2
        const rr = r * (1 + 0.12 * Math.cos(a * lobes))
        const x = cx + Math.cos(a) * rr * 1.5
        const y = cy + Math.sin(a) * rr
        if (i) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      }
      ctx.fill()
    }
    medallion(Math.min(w, h) * 0.24, '#1f2a44', 8)
    medallion(Math.min(w, h) * 0.19, '#d9c49a', 8)
    medallion(Math.min(w, h) * 0.15, '#8a3026', 12)
    medallion(Math.min(w, h) * 0.07, '#24304a', 6)
    medallion(Math.min(w, h) * 0.035, '#d6a64e', 6)
    // Corner pieces echo the medallion.
    for (const [x, y] of [
      [fx, fx],
      [w - fx, fx],
      [fx, h - fx],
      [w - fx, h - fx],
    ]) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, 40 * u)
      g.addColorStop(0, '#24304a')
      g.addColorStop(0.75, '#24304a')
      g.addColorStop(0.76, 'rgba(36, 48, 74, 0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, 40 * u, 0, Math.PI * 2)
      ctx.fill()
    }
    // Wear: the pile faded in the middle where people walk, and a fine knotted texture.
    const wear = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.6)
    wear.addColorStop(0, 'rgba(230, 200, 160, 0.16)')
    wear.addColorStop(1, 'rgba(230, 200, 160, 0)')
    ctx.fillStyle = wear
    ctx.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 2) {
      ctx.fillStyle = `rgba(0, 0, 0, ${(0.02 + rand() * 0.05).toFixed(3)})`
      ctx.fillRect(0, y, w, 1)
    }
    mottle(c, 0.4, 0.06)
    grain(c, 0.18)
  },

  /** Damask wallpaper: a faint tone-on-tone motif in staggered rows. Tinted by the material colour. */
  damask: (c) => {
    const { ctx, w, h, ppm } = c
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    const step = 0.26 * ppm
    ctx.fillStyle = 'rgba(0, 0, 0, 0.07)'
    for (let row = 0; row * step * 1.4 < h + step; row++) {
      for (let x = (row % 2) * (step / 2); x < w + step; x += step) {
        const y = row * step * 1.4
        // A stylised flower: a teardrop with leaves either side.
        ctx.beginPath()
        ctx.ellipse(x, y, step * 0.13, step * 0.3, 0, 0, Math.PI * 2)
        ctx.fill()
        for (const side of [-1, 1]) {
          ctx.beginPath()
          ctx.ellipse(x + side * step * 0.2, y + step * 0.12, step * 0.07, step * 0.2, side * 0.7, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.beginPath()
        ctx.arc(x, y - step * 0.42, step * 0.05, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    mottle(c, 0.6, 0.05)
    grain(c, 0.05)
  },

  /**
   * Panelled wainscoting: stiles and rails framing recessed panels, with
   * light catching the top and left of each moulding. Tinted by the material colour.
   */
  wainscot: (c) => {
    const { ctx, w, h, ppm, rand } = c
    ctx.fillStyle = '#d8b48a'
    ctx.fillRect(0, 0, w, h)
    // Vertical grain over everything.
    for (let i = 0; i < w / 3; i++) {
      ctx.strokeStyle = `rgba(70, 40, 15, ${(0.05 + rand() * 0.08).toFixed(3)})`
      ctx.lineWidth = 0.5 + rand()
      const x = rand() * w
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + (rand() - 0.5) * 4, h)
      ctx.stroke()
    }
    const frame = 0.09 * ppm
    const panelW = 0.62 * ppm
    const count = Math.max(1, Math.round((w - frame) / (panelW + frame)))
    const pw = (w - frame * (count + 1)) / count
    const ph = h - frame * 2
    for (let i = 0; i < count; i++) {
      const x = frame + i * (pw + frame)
      const y = frame
      // The recess: shadow along the top and left, light along the bottom and right.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
      ctx.fillRect(x, y, pw, 4)
      ctx.fillRect(x, y, 4, ph)
      ctx.fillStyle = 'rgba(255, 240, 210, 0.25)'
      ctx.fillRect(x, y + ph - 3, pw, 3)
      ctx.fillRect(x + pw - 3, y, 3, ph)
      // The raised field, with a bevel all round.
      const b = 0.03 * ppm
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)'
      ctx.fillRect(x + 4, y + 4, pw - 7, ph - 7)
      ctx.fillStyle = rgb('#d8b48a', (rand() - 0.5) * 0.05)
      ctx.fillRect(x + b, y + b, pw - b * 2, ph - b * 2)
      ctx.fillStyle = 'rgba(255, 240, 210, 0.18)'
      ctx.fillRect(x + b, y + b, pw - b * 2, 2)
    }
    mottle(c, 0.5, 0.05)
    grain(c, 0.06)
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
  boxleaf: [1, 512],
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
