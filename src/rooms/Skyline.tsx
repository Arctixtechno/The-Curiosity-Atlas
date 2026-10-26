import { useEffect, useMemo } from 'react'
import { BackSide, CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

// London around the house, painted rather than built: three rings of
// silhouettes at increasing distance, each one canvas texture on an open
// cylinder. The nearest is Georgian terraces with chimney pots and plane
// trees; then mansion blocks and church spires; then, faint in the haze, the
// landmarks on the horizon. Three textured cylinders cost next to nothing to
// draw, however much city they show. By day it fills the courtyard's
// horizon; by night, from the roof terrace, its windows light up.

/** Canvas size of each ring. Wide enough to stay crisp at a distance, small enough to be cheap. */
const W = 4096
const H = 256
/** Each ring spans this much of its radius above the ground, and a little below to hide the join. */
const TOP = 0.32
const BELOW = 0.02

type Rand = () => number
function seeded(seed: number): Rand {
  let s = seed % 2147483647
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

interface Painter {
  ctx: CanvasRenderingContext2D
  rand: Rand
  night: boolean
  /** Pixels per metre, across and up, for a ring of this radius. */
  sx: number
  sy: number
  /** The canvas row where the ground is. */
  ground: number
  radius: number
}

function painter(radius: number, night: boolean, seed: number) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const p: Painter = {
    ctx,
    rand: seeded(seed),
    night,
    sx: W / (2 * Math.PI * radius),
    sy: H / ((TOP + BELOW) * radius),
    ground: H * (TOP / (TOP + BELOW)),
    radius,
  }
  return { canvas, p }
}

/** Mixes a colour towards the haze, by `amount` from 0 to 1. */
function haze(colour: [number, number, number], amount: number, night: boolean) {
  const air = night ? [22, 26, 40] : [196, 210, 224]
  return `rgb(${colour.map((c, i) => Math.round(c + (air[i] - c) * amount)).join(',')})`
}

/** Windows on a building front, lit at random by night. */
function windows(p: Painter, x: number, top: number, width: number, height: number, hazeAmount: number) {
  const { ctx, rand, night, sx, sy } = p
  const floors = Math.max(1, Math.floor(height / 3))
  const across = Math.max(1, Math.floor(width / 1.9))
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < across; i++) {
      const wx = x + (i + 0.3) * (width / across) * sx
      const wy = top + (f * 3 + 0.9) * sy
      if (night) {
        if (rand() > 0.42) continue
        ctx.fillStyle =
          rand() < 0.8
            ? `rgba(255, ${190 + rand() * 40}, ${110 + rand() * 50}, ${0.85 - hazeAmount * 0.4})`
            : 'rgba(170, 200, 255, 0.6)'
      } else ctx.fillStyle = haze([70, 78, 88], hazeAmount + 0.15, false)
      ctx.fillRect(wx, wy, Math.max(1, 0.8 * sx), Math.max(1, 1.3 * sy))
    }
  }
}

/** A row of Georgian and Victorian terraces with chimney stacks and plane trees in front. */
function paintTerraces(p: Painter, hazeAmount: number) {
  const { ctx, rand, night, sx, sy, ground } = p
  let x = 0
  while (x < W) {
    const width = (8 + rand() * 22) * sx
    const height = 10 + rand() * 7
    const top = ground - height * sy
    const front: [number, number, number] = night ? [14, 16, 24] : rand() < 0.7 ? [222, 214, 198] : [168, 108, 82]
    ctx.fillStyle = haze(front, hazeAmount, night)
    ctx.fillRect(x, top, width + 1, ground - top + 4)
    // Roof: a slate mansard, or a parapet with the roof hidden behind.
    const roof = night ? haze([10, 12, 18], hazeAmount, true) : haze([92, 98, 106], hazeAmount, false)
    ctx.fillStyle = roof
    if (rand() < 0.55) {
      const rise = (1.6 + rand() * 1.6) * sy
      ctx.beginPath()
      ctx.moveTo(x, top)
      ctx.lineTo(x + 0.8 * sx, top - rise)
      ctx.lineTo(x + width - 0.8 * sx, top - rise)
      ctx.lineTo(x + width, top)
      ctx.fill()
      // Dormer windows.
      for (let d = x + 2 * sx; d < x + width - 2 * sx; d += 4 * sx) {
        ctx.fillRect(d, top - rise * 0.75, 1.4 * sx, rise * 0.75)
      }
    } else ctx.fillRect(x, top - 0.6 * sy, width, 0.6 * sy)
    // Chimney stacks with their pots.
    const stacks = 1 + Math.floor(rand() * 3)
    for (let s = 0; s < stacks; s++) {
      const cx = x + (0.15 + rand() * 0.7) * width
      const ch = (1.8 + rand() * 1.4) * sy
      ctx.fillStyle = night ? roof : haze([138, 88, 70], hazeAmount, false)
      ctx.fillRect(cx, top - ch - 1.2 * sy, 1.8 * sx, ch + 1.2 * sy)
      ctx.fillStyle = night ? roof : haze([172, 112, 82], hazeAmount, false)
      const pots = 2 + Math.floor(rand() * 4)
      for (let k = 0; k < pots; k++)
        ctx.fillRect(cx + (k + 0.2) * (1.8 / pots) * sx, top - ch - 1.9 * sy, 0.25 * sx + 1, 0.7 * sy)
    }
    windows(p, x, top + 1.2 * sy, width / sx, height - 2, hazeAmount)
    x += width
  }
  // Plane trees along the street in front.
  const trees = 60
  for (let t = 0; t < trees; t++) {
    const tx = rand() * W
    const th = (8 + rand() * 7) * sy
    const tw = (5 + rand() * 4) * sx
    const leaf = night ? haze([8, 12, 10], hazeAmount, true) : haze([70, 96, 58], hazeAmount, false)
    ctx.fillStyle = leaf
    for (let c = 0; c < 9; c++) {
      ctx.beginPath()
      ctx.ellipse(
        tx + (rand() - 0.5) * tw,
        ground - th + (rand() * 0.6 + 0.2) * th * 0.6,
        tw * (0.25 + rand() * 0.2),
        th * (0.18 + rand() * 0.12),
        0,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
    ctx.fillRect(tx - 0.2 * sx, ground - th * 0.5, 0.4 * sx + 1, th * 0.5)
  }
}

/** Taller mansion blocks, a few towers and church spires, further off. */
function paintBlocks(p: Painter, hazeAmount: number) {
  const { ctx, rand, night, sx, sy, ground } = p
  let x = 0
  while (x < W) {
    const width = (12 + rand() * 30) * sx
    const height = rand() < 0.1 ? 20 + rand() * 10 : 8 + rand() * 9
    const top = ground - height * sy
    const tone = rand() * 30
    ctx.fillStyle = night ? haze([12, 14, 22], hazeAmount, true) : haze([150 + tone, 146 + tone, 140 + tone], hazeAmount, false)
    ctx.fillRect(x, top, width + 1, ground - top + 4)
    windows(p, x, top + 1.5 * sy, width / sx, height - 3, hazeAmount)
    if (rand() < 0.12) {
      // A church spire.
      const sx0 = x + width * 0.5
      ctx.beginPath()
      ctx.moveTo(sx0 - 2 * sx, top)
      ctx.lineTo(sx0, top - 22 * sy)
      ctx.lineTo(sx0 + 2 * sx, top)
      ctx.fill()
    }
    x += width + rand() * 6 * sx
  }
}

/**
 * London's landmarks on the horizon: where each stands round the ring (0 to 1), its real height in metres and
 * its City Explorer entry, so the terrace's spyglass can name them.
 */
export const LANDMARKS = {
  shard: { u: 0.53, height: 310, placeId: 'the-shard' },
  btTower: { u: 0.33, height: 190, placeId: 'bt-tower' },
  stPauls: { u: 0.465, height: 111, placeId: 'st-pauls' },
  eye: { u: 0.6, height: 135, placeId: 'london-eye' },
  battersea: { u: 0.7, height: 100, placeId: 'battersea-power-station' },
  gherkin: { u: 0.415, height: 180, placeId: 'gherkin' },
}

/**
 * Where a landmark's top is in the room, for a skyline drawn with these radii, ground and turn. Follows the
 * cylinder's mapping of the texture: across = angle round from +z.
 */
export function landmarkTop(
  landmark: keyof typeof LANDMARKS,
  { radii, ground = [0, 0, 0], rotationY = 0 }: Pick<SkylineProps, 'radii' | 'ground' | 'rotationY'>,
): [number, number, number] {
  const { u, height } = LANDMARKS[landmark]
  const r = radii[2]
  const theta = u * Math.PI * 2 + rotationY
  return [r * Math.sin(theta), ground[2] + (height * TOP * r * 0.6) / 310, r * Math.cos(theta)]
}

/** The horizon: London's landmarks in the haze, placed round the ring by angle (0 to 1). */
function paintLandmarks(p: Painter, hazeAmount: number) {
  const { ctx, rand, night, ground } = p
  // By night the landmarks are floodlit a little, so they stand out against the dark.
  const fill = night ? 'rgb(34, 40, 62)' : haze([128, 138, 152], hazeAmount, false)
  const light = (x: number, y: number, r: number, colour: string) => {
    if (!night) return
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, colour)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
    ctx.fillStyle = fill
  }
  // A low line of the rest of the city.
  ctx.fillStyle = fill
  for (let x = 0; x < W; ) {
    const w = (20 + rand() * 60) * p.sx
    const h = (6 + rand() * 18) * p.sy
    ctx.fillRect(x, ground - h, w + 1, h + 4)
    if (night) {
      for (let i = 0; i < w / 3; i++) {
        ctx.fillStyle = `rgba(255, 200, 140, ${0.3 + rand() * 0.4})`
        ctx.fillRect(x + rand() * w, ground - rand() * h, 1, 1)
      }
      ctx.fillStyle = fill
    }
    x += w
  }
  const at = (u: number) => u * W
  // Landmarks are drawn from their real sizes in metres, shrunk to sit on a horizon a few kilometres off:
  // the Shard, the tallest at 310 m, reaches three fifths of the way up the ring.
  const scale = (TOP * p.radius * 0.6) / 310
  const sx = p.sx * scale
  const sy = p.sy * scale
  // The Shard.
  {
    const x = at(LANDMARKS.shard.u)
    ctx.beginPath()
    ctx.moveTo(x - 22 * sx, ground)
    ctx.lineTo(x - 2 * sx, ground - 300 * sy)
    ctx.lineTo(x + 1 * sx, ground - 310 * sy)
    ctx.lineTo(x + 20 * sx, ground)
    ctx.fill()
    light(x, ground - 300 * sy, 8 * sy, 'rgba(255,255,255,0.9)')
  }
  // The BT Tower.
  {
    const x = at(LANDMARKS.btTower.u)
    ctx.fillRect(x - 5 * sx, ground - 150 * sy, 10 * sx, 150 * sy)
    ctx.fillRect(x - 8 * sx, ground - 160 * sy, 16 * sx, 30 * sy)
    ctx.fillRect(x - 2 * sx, ground - 190 * sy, 4 * sx, 30 * sy)
    if (night) for (let i = 0; i < 6; i++) light(x + (i - 2.5) * 2.5 * sx, ground - 145 * sy, 3 * sy, 'rgba(120,180,255,0.9)')
  }
  // St Paul's dome.
  {
    const x = at(LANDMARKS.stPauls.u)
    ctx.fillRect(x - 40 * sx, ground - 30 * sy, 80 * sx, 30 * sy)
    ctx.fillRect(x - 18 * sx, ground - 62 * sy, 36 * sx, 34 * sy)
    ctx.beginPath()
    ctx.ellipse(x, ground - 62 * sy, 17 * sx, 26 * sy, 0, Math.PI, 0)
    ctx.fill()
    ctx.fillRect(x - 3 * sx, ground - 100 * sy, 6 * sx, 14 * sy)
    ctx.fillRect(x - 0.6 * sx, ground - 110 * sy, 1.2 * sx + 1, 10 * sy)
    light(x, ground - 70 * sy, 30 * sy, 'rgba(255,220,160,0.35)')
  }
  // The London Eye.
  {
    const x = at(LANDMARKS.eye.u)
    const r = 60
    ctx.strokeStyle = fill
    ctx.lineWidth = Math.max(1, 1.5 * sx)
    ctx.beginPath()
    ctx.ellipse(x, ground - (r + 15) * sy, r * sx, r * sy, 0, 0, Math.PI * 2)
    ctx.stroke()
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(x, ground - (r + 15) * sy)
      ctx.lineTo(x + Math.cos(a) * r * sx, ground - (r + 15) * sy + Math.sin(a) * r * sy)
      ctx.lineWidth = 1
      ctx.stroke()
      if (night) light(x + Math.cos(a) * r * sx, ground - (r + 15) * sy + Math.sin(a) * r * sy, 3 * sy, 'rgba(80,150,255,0.9)')
    }
    ctx.lineWidth = 2 * sx
    ctx.beginPath()
    ctx.moveTo(x - 20 * sx, ground)
    ctx.lineTo(x, ground - (r + 15) * sy)
    ctx.lineTo(x + 6 * sx, ground)
    ctx.stroke()
  }
  // Battersea Power Station: the long body and four white chimneys.
  {
    const x = at(LANDMARKS.battersea.u)
    ctx.fillRect(x - 80 * sx, ground - 50 * sy, 160 * sx, 50 * sy)
    for (const c of [-70, -40, 40, 70]) {
      ctx.beginPath()
      ctx.moveTo(x + (c - 4) * sx, ground - 50 * sy)
      ctx.lineTo(x + (c - 3) * sx, ground - 100 * sy)
      ctx.lineTo(x + (c + 3) * sx, ground - 100 * sy)
      ctx.lineTo(x + (c + 4) * sx, ground - 50 * sy)
      ctx.fill()
      light(x + c * sx, ground - 100 * sy, 6 * sy, 'rgba(255,240,220,0.6)')
    }
  }
  // The Gherkin.
  {
    const x = at(LANDMARKS.gherkin.u)
    ctx.beginPath()
    ctx.ellipse(x, ground - 85 * sy, 17 * sx, 95 * sy, 0, Math.PI, 0)
    ctx.lineTo(x + 17 * sx, ground)
    ctx.lineTo(x - 17 * sx, ground)
    ctx.fill()
  }
  // The city's glow on the haze above it at night.
  if (night) {
    const g = ctx.createLinearGradient(0, ground - 120 * sy, 0, ground)
    g.addColorStop(0, 'rgba(255,150,80,0)')
    g.addColorStop(1, 'rgba(255,150,80,0.12)')
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = g
    ctx.fillRect(0, ground - 120 * sy, W, 120 * sy)
    ctx.globalCompositeOperation = 'source-over'
  }
}

const LAYERS = [
  { paint: paintTerraces, haze: 0.18, seed: 11 },
  { paint: paintBlocks, haze: 0.36, seed: 23 },
  { paint: paintLandmarks, haze: 0.4, seed: 37 },
]

interface SkylineProps {
  /** The three rings' radii, nearest first. */
  radii: [number, number, number]
  /**
   * Where street level shows for each ring, relative to the room's floor. From a roof it's well below for the
   * nearest streets but nearer eye level further off, as the city runs towards the horizon.
   */
  ground?: [number, number, number]
  night?: boolean
  /** Turns the ring: the landmarks are gathered round the far side, centred on the Shard, at angle π. */
  rotationY?: number
}

export function Skyline({ radii, ground = [0, 0, 0], night = false, rotationY = 0 }: SkylineProps) {
  const textures = useMemo(
    () =>
      LAYERS.map((layer, i) => {
        const { canvas, p } = painter(radii[i], night, layer.seed)
        layer.paint(p, night ? layer.haze * 0.5 : layer.haze)
        const t = new CanvasTexture(canvas)
        t.colorSpace = SRGBColorSpace
        t.wrapS = RepeatWrapping
        t.anisotropy = 4
        return t
      }),
    [radii, night],
  )
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures])
  return (
    <group rotation={[0, rotationY, 0]}>
      {/* Furthest first, so the nearer rings' see-through sky shows the ones behind. */}
      {[2, 1, 0].map((i) => {
        const r = radii[i]
        const height = (TOP + BELOW) * r
        return (
          <mesh key={i} position={[0, ground[i] - BELOW * r + height / 2, 0]} renderOrder={-3 + (2 - i)}>
            <cylinderGeometry args={[r, r, height, 96, 1, true]} />
            <meshBasicMaterial map={textures[i]} transparent side={BackSide} fog={false} depthWrite={false} toneMapped={false} />
          </mesh>
        )
      })}
    </group>
  )
}
