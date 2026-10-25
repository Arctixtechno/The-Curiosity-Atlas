import { useEffect, useRef, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { DropIcon } from '../../components/icons.tsx'
import { acceleration, BLOCK_SIDE, BLOCKS, LIQUIDS, settle, type Substance } from './buoyancy.ts'
import './Experiments.css'

const W = 360
const H = 300
/** Pixels per metre on the canvas. */
const SCALE = 600
const TANK = { x: 60, width: 240, surface: 120, depth: 0.27 }
/** How high above the surface the block is held before it's dropped, in metres. */
const DROP_HEIGHT = 0.06
/** Arrow length per newton, up to a limit that keeps the arrows on the canvas. */
const ARROW = 2.2

function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, length: number, colour: string, label: string) {
  if (Math.abs(length) < 2) return
  const dir = Math.sign(length)
  ctx.strokeStyle = ctx.fillStyle = colour
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y + length - dir * 8)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x, y + length)
  ctx.lineTo(x - 6, y + length - dir * 10)
  ctx.lineTo(x + 6, y + length - dir * 10)
  ctx.fill()
  ctx.font = '11px Georgia, serif'
  ctx.textAlign = 'left'
  ctx.fillText(label, x + 9, y + length - dir * 4)
}

function draw(ctx: CanvasRenderingContext2D, block: Substance, liquid: Substance, depth: number) {
  ctx.clearRect(0, 0, W, H)
  const bottom = TANK.surface + TANK.depth * SCALE
  // Liquid, a little lighter at the top.
  const g = ctx.createLinearGradient(0, TANK.surface, 0, bottom)
  g.addColorStop(0, liquid.colour + 'cc')
  g.addColorStop(1, liquid.colour + '88')
  ctx.fillStyle = g
  ctx.fillRect(TANK.x, TANK.surface, TANK.width, bottom - TANK.surface)
  // Block: its bottom is `depth` below the surface.
  const side = BLOCK_SIDE * SCALE
  const x = TANK.x + TANK.width / 2 - side / 2
  const y = TANK.surface + depth * SCALE - side
  ctx.fillStyle = block.colour
  ctx.fillRect(x, y, side, side)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(x, y, side, side)
  // The part under the surface, seen through the liquid.
  const under = Math.min(side, Math.max(0, depth * SCALE))
  if (under > 0) {
    ctx.fillStyle = liquid.colour + '55'
    ctx.fillRect(x, y + side - under, side, under)
  }
  // Glass tank.
  ctx.strokeStyle = 'rgba(220, 235, 255, 0.7)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(TANK.x - 2, TANK.surface - 70)
  ctx.lineTo(TANK.x - 2, bottom + 2)
  ctx.lineTo(TANK.x + TANK.width + 2, bottom + 2)
  ctx.lineTo(TANK.x + TANK.width + 2, TANK.surface - 70)
  ctx.stroke()
  // Forces on the block, from its middle.
  const volume = BLOCK_SIDE ** 3
  const weight = block.density * volume * 9.81
  const buoyancy = liquid.density * volume * (under / side) * 9.81
  const cx = x + side / 2
  const cy = y + side / 2
  arrow(ctx, cx - 14, cy, Math.min(95, weight * ARROW), '#e8a050', `weight ${weight.toFixed(1)} N`)
  arrow(ctx, cx + 14, cy, -Math.min(95, buoyancy * ARROW), '#7fd0f0', `buoyancy ${buoyancy.toFixed(1)} N`)
}

function Choice({
  items,
  value,
  onChange,
  label,
}: {
  items: Substance[]
  value: Substance
  onChange: (s: Substance) => void
  label: string
}) {
  return (
    <div className="lab-choice" role="radiogroup" aria-label={label}>
      {items.map((s) => (
        <button
          key={s.id}
          role="radio"
          aria-checked={s.id === value.id}
          className={`button${s.id === value.id ? ' button-active' : ''}`}
          onClick={() => onChange(s)}
        >
          {s.name}
        </button>
      ))}
    </div>
  )
}

/** The buoyancy tank: drop a one-litre block of something into a liquid and see whether it floats. */
export function BuoyancyPanel() {
  const [liquid, setLiquid] = useState(LIQUIDS[0])
  const [block, setBlock] = useState(BLOCKS[2])
  const canvas = useRef<HTMLCanvasElement>(null)
  const sim = useRef({ block, liquid, depth: -DROP_HEIGHT, velocity: 0 })
  sim.current.block = block
  sim.current.liquid = liquid

  const drop = () => {
    Object.assign(sim.current, { depth: -DROP_HEIGHT, velocity: 0 })
  }
  useEffect(drop, [block, liquid])

  useEffect(() => {
    const ctx = canvas.current!.getContext('2d')!
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const s = sim.current
      // Small fixed steps keep the motion steady whatever the frame rate.
      let left = Math.min(0.05, (now - last) / 1000)
      last = now
      while (left > 0) {
        const dt = Math.min(0.002, left)
        s.velocity += acceleration(s.block, s.liquid, s.depth, s.velocity) * dt
        s.depth -= s.velocity * dt
        if (s.depth > TANK.depth) {
          s.depth = TANK.depth
          s.velocity = 0
        }
        left -= dt
      }
      draw(ctx, s.block, s.liquid, s.depth)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const result = settle(block, liquid)
  return (
    <Panel title="Buoyancy" subtitle="The tank: why some things float and others sink" icon={<DropIcon />} wide>
      <div className="lab-layout">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          className="lab-canvas"
          aria-label={`A block of ${block.name} in ${liquid.name}`}
        />
        <div>
          <h3>Liquid</h3>
          <Choice items={LIQUIDS} value={liquid} onChange={setLiquid} label="Liquid" />
          <h3>One-litre block</h3>
          <Choice items={BLOCKS} value={block} onChange={setBlock} label="Block" />
          <dl className="lab-readings">
            <dt>Densities</dt>
            <dd>
              {block.name} {block.density.toLocaleString()} kg/m³, {liquid.name.toLowerCase()} {liquid.density.toLocaleString()}{' '}
              kg/m³
            </dd>
            <dt>Result</dt>
            <dd>
              {result.floats
                ? `Floats, with ${(result.submerged * 100).toFixed(0)}% below the surface`
                : `Sinks. Under the surface it weighs ${result.apparentWeight.toFixed(1)} N instead of ${result.weight.toFixed(1)} N`}
            </dd>
          </dl>
          <button className="button" onClick={drop}>
            Drop it again
          </button>
        </div>
      </div>
      <h3>What's happening</h3>
      <p>
        A block in a liquid is pushed up by a force equal to the weight of the liquid it moves aside (Archimedes' principle). If
        the block is less dense than the liquid, it sinks only until the liquid it displaces weighs as much as the block, then
        floats. That's why ice floats with most of it hidden, and why steel floats on mercury.
      </p>
      <p className="muted">
        Forces are calculated from Archimedes' principle with g = 9.81 m/s². Densities are typical values near 20 °C; real samples
        vary a little. The way the block bobs before settling uses a simple drag model.
      </p>
    </Panel>
  )
}
