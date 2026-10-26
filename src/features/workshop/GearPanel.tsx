import { useEffect, useRef, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { HowItWorks } from '../../components/HowItWorks.tsx'
import { GearIcon } from '../../components/icons.tsx'
import { CHALLENGES, GEAR_START, MAX_STAGES, meetsChallenge, TEETH, train, type Stage } from './gears.ts'
import './Workshop.css'

const W = 420
const H = 300

interface DrawnGear {
  x: number
  y: number
  teeth: number
  /** Turns per input turn, signed for direction. */
  speed: number
  /** Angle offset so its teeth sit between its neighbour's. */
  phase: number
  colour: string
  front: boolean
}

/** Lays the train out left to right: each driven gear shares a shaft with the next stage's driver. */
function layout(stages: Stage[]) {
  const gears: DrawnGear[] = []
  let x = 0
  let speed = 1
  let phase = 0
  stages.forEach((s, i) => {
    const driver: DrawnGear = { x, y: 0, teeth: s.driver, speed, phase, colour: i % 2 ? '#c9a24e' : '#b8bcc0', front: i > 0 }
    const driven: DrawnGear = {
      x: x + s.driver + s.driven,
      y: 0,
      teeth: s.driven,
      speed: (-speed * s.driver) / s.driven,
      // Mirror the driver's teeth across the contact point, then shift half a tooth so its gaps meet them.
      phase: Math.PI - (phase * s.driver) / s.driven - (0.05 * Math.PI * 2) / s.driven,
      colour: i % 2 ? '#b8bcc0' : '#c9a24e',
      front: false,
    }
    gears.push(driver, driven)
    x = driven.x
    speed = driven.speed
    phase = driven.phase
  })
  return { gears, width: x }
}

function drawGear(ctx: CanvasRenderingContext2D, g: DrawnGear, scale: number, angle: number) {
  const r = g.teeth * scale
  const depth = Math.max(2.5, scale * 1.6)
  ctx.save()
  ctx.translate(g.x, g.y)
  ctx.rotate(angle)
  ctx.beginPath()
  for (let i = 0; i < g.teeth; i++) {
    const a = (i / g.teeth) * Math.PI * 2
    const step = (Math.PI * 2) / g.teeth
    // A trapezoid tooth, then the gap.
    ctx.lineTo(Math.cos(a) * (r - depth), Math.sin(a) * (r - depth))
    ctx.lineTo(Math.cos(a + step * 0.15) * (r + depth), Math.sin(a + step * 0.15) * (r + depth))
    ctx.lineTo(Math.cos(a + step * 0.4) * (r + depth), Math.sin(a + step * 0.4) * (r + depth))
    ctx.lineTo(Math.cos(a + step * 0.55) * (r - depth), Math.sin(a + step * 0.55) * (r - depth))
  }
  ctx.closePath()
  ctx.fillStyle = g.colour
  ctx.fill()
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)'
  ctx.lineWidth = 1
  ctx.stroke()
  // Spokes, so you can see it turn.
  if (r > 18) {
    ctx.fillStyle = 'rgba(30, 26, 22, 0.75)'
    for (let q = 0; q < 4; q++) {
      ctx.beginPath()
      ctx.arc(0, 0, r * 0.7, (q * Math.PI) / 2 + 0.25, ((q + 1) * Math.PI) / 2 - 0.25)
      ctx.arc(0, 0, r * 0.3, ((q + 1) * Math.PI) / 2 - 0.25, (q * Math.PI) / 2 + 0.25, true)
      ctx.fill()
    }
  } else {
    ctx.fillStyle = 'rgba(30, 26, 22, 0.6)'
    ctx.fillRect(-1, -r * 0.7, 2, r * 1.4)
  }
  ctx.beginPath()
  ctx.arc(0, 0, Math.max(3, r * 0.12), 0, Math.PI * 2)
  ctx.fillStyle = '#2a2622'
  ctx.fill()
  ctx.restore()
  ctx.font = '11px Georgia, serif'
  ctx.fillStyle = 'rgba(244, 234, 216, 0.75)'
  ctx.textAlign = 'center'
  if (!g.front) ctx.fillText(`${g.teeth}`, g.x, g.y + r + depth + 14)
  else ctx.fillText(`${g.teeth}`, g.x, g.y - r - depth - 6)
}

function draw(ctx: CanvasRenderingContext2D, stages: Stage[], turns: number) {
  ctx.clearRect(0, 0, W, H)
  const { gears, width } = layout(stages)
  const maxR = Math.max(...gears.map((g) => g.teeth))
  // One tooth's worth of pitch radius per pixel scale, chosen so the whole train fits.
  const scale = Math.min((W - 40) / (width + maxR * 2 + 8), (H - 70) / (maxR * 2 + 8))
  ctx.save()
  const first = gears[0].teeth * scale
  const span = width * scale + first + gears[gears.length - 1].teeth * scale
  ctx.translate((W - span) / 2 + first, H / 2)
  const placed = gears.map((g) => ({ ...g, x: g.x * scale }))
  // Back gears first, then the drivers fixed in front of them on the same shaft.
  for (const g of [...placed.filter((g) => !g.front), ...placed.filter((g) => g.front)]) {
    drawGear(ctx, g, scale, g.phase + turns * g.speed * Math.PI * 2)
  }
  ctx.restore()
  // Arrows for the input and output direction.
  ctx.font = '12px Georgia, serif'
  ctx.fillStyle = 'rgba(244, 234, 216, 0.8)'
  ctx.textAlign = 'left'
  ctx.fillText('input', 12, 20)
  ctx.textAlign = 'right'
  ctx.fillText('output', W - 12, 20)
}

/** The gear bench: build a train of up to three stages and see how speed and turning force trade off. */
export function GearPanel() {
  const [stages, setStages] = useState<Stage[]>(GEAR_START.stages)
  const [rpm, setRpm] = useState(GEAR_START.rpm)
  const [torque, setTorque] = useState(GEAR_START.torque)
  const canvas = useRef<HTMLCanvasElement>(null)
  const sim = useRef({ stages, rpm, turns: 0 })
  sim.current.stages = stages
  sim.current.rpm = rpm

  useEffect(() => {
    const ctx = canvas.current!.getContext('2d')!
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const s = sim.current
      // Shown at a tenth of real speed, so fast trains stay readable.
      s.turns += ((now - last) / 60000) * s.rpm * 0.1
      last = now
      draw(ctx, s.stages, s.turns)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const result = train(stages, rpm, torque)
  const setStage = (i: number, part: Partial<Stage>) => setStages(stages.map((s, j) => (j === i ? { ...s, ...part } : s)))
  const select = (value: number, onChange: (n: number) => void, label: string) => (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label}>
      {TEETH.map((t) => (
        <option key={t} value={t}>
          {t} teeth
        </option>
      ))}
    </select>
  )
  const format = (n: number) => (Number.isInteger(n) ? `${n}` : n < 1 ? n.toFixed(3) : n.toFixed(2))

  return (
    <Panel title="Gears" subtitle="The train bench: how gears trade speed for force" icon={<GearIcon />} wide>
      <div className="shop-layout">
        <canvas ref={canvas} width={W} height={H} className="shop-canvas" aria-label="The gear train, turning" />
        <div>
          <h3>Stages</h3>
          {stages.map((s, i) => (
            <div className="shop-row" key={i}>
              {select(s.driver, (n) => setStage(i, { driver: n }), `Stage ${i + 1} driver`)}
              <span className="muted">drives</span>
              {select(s.driven, (n) => setStage(i, { driven: n }), `Stage ${i + 1} driven gear`)}
            </div>
          ))}
          <div className="shop-row">
            <button
              className="button"
              disabled={stages.length >= MAX_STAGES}
              onClick={() => setStages([...stages, { driver: 12, driven: 24 }])}
            >
              Add a stage
            </button>
            <button className="button" disabled={stages.length <= 1} onClick={() => setStages(stages.slice(0, -1))}>
              Remove one
            </button>
          </div>
          <label className="shop-control">
            <span>Input speed</span>
            <input type="range" min={6} max={120} step={6} value={rpm} onChange={(e) => setRpm(Number(e.target.value))} />
            <output>{rpm} rpm</output>
          </label>
          <label className="shop-control">
            <span>Input torque</span>
            <input type="range" min={0.5} max={5} step={0.5} value={torque} onChange={(e) => setTorque(Number(e.target.value))} />
            <output>{torque} N·m</output>
          </label>
          <dl className="shop-readings">
            <dt>Gear ratio</dt>
            <dd>{format(result.ratio)} : 1</dd>
            <dt>Output</dt>
            <dd>
              {format(result.rpm)} rpm at {format(result.torque)} N·m, turning{' '}
              {result.direction === 1 ? 'the same way as' : 'against'} the input
            </dd>
            <dt>Power</dt>
            <dd>{((rpm / 60) * 2 * Math.PI * torque).toFixed(2)} W in and out: gears trade speed for force, never make power</dd>
          </dl>
        </div>
      </div>
      <h3>Try to build</h3>
      <ul>
        {CHALLENGES.map((c) => (
          <li key={c.id} className={meetsChallenge(result, c) ? 'shop-done' : undefined}>
            <strong>{c.name}:</strong> {c.goal}
            {meetsChallenge(result, c) ? ' ✓' : ''}
          </li>
        ))}
      </ul>
      <HowItWorks>
        <p>
          Meshing teeth move past each other at the same speed, so a gear with three times the teeth turns a third as fast, and
          each pair of gears turns in opposite directions. On a compound train the gears on a shared shaft turn together, so the
          ratios multiply. The torque grows by the same ratio the speed falls, which is why a low gear helps you climb a hill.
        </p>
        <p className="muted">
          Calculated from the tooth counts, for ideal gears with no friction. Real gear trains lose some power to friction at each
          mesh.
        </p>
      </HowItWorks>
    </Panel>
  )
}
