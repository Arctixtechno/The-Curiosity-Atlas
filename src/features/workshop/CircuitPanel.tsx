import { useEffect, useRef, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { brightness, CELLS, PARTS, solve, type Arrangement, type CircuitResult, type Part } from './circuit.ts'
import './Workshop.css'

const W = 420
const H = 300
const MAX_PARTS = 4
const WIRE = '#d8b06a'

function drawPart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  vertical: boolean,
  part: Part,
  watts: number,
  flicker: number,
) {
  ctx.save()
  ctx.translate(x, y)
  if (vertical) ctx.rotate(Math.PI / 2)
  if (part.bulb) {
    const glow = brightness(watts)
    if (glow > 0.02) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 20 + glow * 30)
      g.addColorStop(0, `rgba(255, 220, 140, ${Math.min(0.9, glow * 0.8 + flicker * 0.05)})`)
      g.addColorStop(1, 'rgba(255, 200, 120, 0)')
      ctx.fillStyle = g
      ctx.fillRect(-60, -60, 120, 120)
    }
    ctx.beginPath()
    ctx.arc(0, 0, 13, 0, Math.PI * 2)
    ctx.fillStyle =
      glow > 0.02 ? `rgba(255, ${200 + glow * 40}, ${120 + glow * 80}, ${0.3 + Math.min(glow, 1) * 0.7})` : '#3a3630'
    ctx.fill()
    ctx.strokeStyle = WIRE
    ctx.lineWidth = 2
    ctx.stroke()
    // The cross of the circuit symbol for a lamp.
    ctx.beginPath()
    ctx.moveTo(-9, -9)
    ctx.lineTo(9, 9)
    ctx.moveTo(-9, 9)
    ctx.lineTo(9, -9)
    ctx.stroke()
  } else {
    ctx.fillStyle = '#2a2622'
    ctx.fillRect(-20, -8, 40, 16)
    ctx.strokeStyle = WIRE
    ctx.lineWidth = 2
    ctx.strokeRect(-20, -8, 40, 16)
  }
  ctx.restore()
  ctx.fillStyle = 'rgba(244, 234, 216, 0.8)'
  ctx.font = '11px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${part.ohms} Ω`, x + (vertical ? 30 : 0), y + (vertical ? 4 : 28))
}

function draw(ctx: CanvasRenderingContext2D, volts: number, arrangement: Arrangement, result: CircuitResult, t: number) {
  ctx.clearRect(0, 0, W, H)
  const left = 60
  const right = W - 40
  const top = 50
  const bottom = H - 50
  ctx.strokeStyle = WIRE
  ctx.lineWidth = 3
  // The cell, on the left side of the loop: long and short plates.
  const cy = (top + bottom) / 2
  ctx.beginPath()
  ctx.moveTo(left, top)
  ctx.lineTo(left, cy - 10)
  ctx.moveTo(left, cy + 10)
  ctx.lineTo(left, bottom)
  ctx.stroke()
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(left - 18, cy - 10)
  ctx.lineTo(left + 18, cy - 10)
  ctx.stroke()
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(left - 9, cy + 10)
  ctx.lineTo(left + 9, cy + 10)
  ctx.stroke()
  ctx.fillStyle = 'rgba(244, 234, 216, 0.85)'
  ctx.font = '12px Georgia, serif'
  ctx.textAlign = 'right'
  ctx.fillText(`${volts} V`, left - 22, cy + 4)
  ctx.lineWidth = 3
  // Top and bottom wires.
  ctx.beginPath()
  ctx.moveTo(left, top)
  ctx.lineTo(right, top)
  ctx.moveTo(left, bottom)
  ctx.lineTo(right, bottom)
  ctx.stroke()
  const n = result.parts.length
  const flicker = Math.sin(t * 40) * 0.5 + 0.5
  if (n === 0) {
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.moveTo(right, top)
    ctx.lineTo(right, bottom)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(244, 234, 216, 0.6)'
    ctx.textAlign = 'center'
    ctx.fillText('Add a part to close the circuit', (left + right) / 2, cy + 4)
    return
  }
  if (arrangement === 'series') {
    // Parts spaced along the top wire, and the right side closing the loop.
    ctx.beginPath()
    ctx.moveTo(right, top)
    ctx.lineTo(right, bottom)
    ctx.stroke()
    result.parts.forEach((r, i) => {
      const x = left + ((i + 1) * (right - left)) / (n + 1)
      ctx.fillStyle = '#1e1b18'
      ctx.fillRect(x - 22, top - 10, 44, 20)
      drawPart(ctx, x, top, false, r.part, r.watts, flicker)
    })
  } else {
    // Each part on its own branch between the top and bottom wires.
    result.parts.forEach((r, i) => {
      // Spaced evenly, with the last branch closing the loop on the right.
      const x = left + ((i + 1) * (right - left)) / n
      ctx.beginPath()
      ctx.moveTo(x, top)
      ctx.lineTo(x, bottom)
      ctx.stroke()
      ctx.fillStyle = '#1e1b18'
      ctx.fillRect(x - 10, cy - 22, 20, 44)
      drawPart(ctx, x, cy, true, r.part, r.watts, flicker)
    })
  }
  // Current: dots flowing round the loop (conventional current, from + to -), faster for more current.
  const speed = Math.min(4, result.amps * 4)
  ctx.fillStyle = 'rgba(140, 200, 255, 0.85)'
  const perimeter = 2 * (right - left) + 2 * (bottom - top)
  for (let d = 0; d < perimeter; d += 40) {
    const p = (d + t * 60 * speed) % perimeter
    let x: number
    let y: number
    if (p < right - left) [x, y] = [left + p, top]
    else if (p < right - left + (bottom - top)) [x, y] = [right, top + (p - (right - left))]
    else if (p < 2 * (right - left) + (bottom - top)) [x, y] = [right - (p - (right - left) - (bottom - top)), bottom]
    else [x, y] = [left, bottom - (p - 2 * (right - left) - (bottom - top))]
    ctx.beginPath()
    ctx.arc(x, y, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }
}

const amps = (a: number) => (a < 1 ? `${(a * 1000).toFixed(a < 0.01 ? 2 : 0)} mA` : `${a.toFixed(2)} A`)
const ohms = (r: number) => (Number.isFinite(r) ? `${r < 10 ? r.toFixed(2) : r.toFixed(1)} Ω` : 'open circuit')

/** The circuit bench: a cell, and up to four bulbs and resistors in series or in parallel. */
export function CircuitPanel() {
  const [volts, setVolts] = useState(CELLS[1].volts)
  const [arrangement, setArrangement] = useState<Arrangement>('series')
  const [parts, setParts] = useState<Part[]>([PARTS[0], PARTS[0]])
  const result = solve(volts, parts, arrangement)
  const canvas = useRef<HTMLCanvasElement>(null)
  const state = useRef({ volts, arrangement, result })
  state.current = { volts, arrangement, result }

  useEffect(() => {
    const ctx = canvas.current!.getContext('2d')!
    let frame = 0
    const tick = (now: number) => {
      const s = state.current
      draw(ctx, s.volts, s.arrangement, s.result, now / 1000)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const overloaded = result.parts.some((r) => r.part.bulb && brightness(r.watts) > 1.2)
  return (
    <Panel title="Circuits: the electrical bench" wide>
      <div className="shop-layout">
        <canvas ref={canvas} width={W} height={H} className="shop-canvas" aria-label="The circuit, with current flowing" />
        <div>
          <h3>Power</h3>
          <div className="shop-row" role="radiogroup" aria-label="Cell">
            {CELLS.map((c) => (
              <button
                key={c.volts}
                role="radio"
                aria-checked={c.volts === volts}
                className={`button${c.volts === volts ? ' button-active' : ''}`}
                onClick={() => setVolts(c.volts)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <h3>Parts</h3>
          <div className="shop-row" role="radiogroup" aria-label="Arrangement">
            {(['series', 'parallel'] as const).map((a) => (
              <button
                key={a}
                role="radio"
                aria-checked={a === arrangement}
                className={`button${a === arrangement ? ' button-active' : ''}`}
                onClick={() => setArrangement(a)}
              >
                In {a}
              </button>
            ))}
          </div>
          <div className="shop-row">
            {PARTS.map((p) => (
              <button key={p.id} className="button" disabled={parts.length >= MAX_PARTS} onClick={() => setParts([...parts, p])}>
                + {p.name}
              </button>
            ))}
          </div>
          <div className="shop-row">
            {parts.map((p, i) => (
              <button
                key={i}
                className="button"
                onClick={() => setParts(parts.filter((_, j) => j !== i))}
                aria-label={`Remove ${p.name}`}
              >
                {p.bulb ? 'Bulb' : `${p.ohms} Ω`} ×
              </button>
            ))}
          </div>
          <dl className="shop-readings">
            <dt>Resistance</dt>
            <dd>{ohms(result.ohms)}</dd>
            <dt>Current</dt>
            <dd>{amps(result.amps)} from the cell</dd>
            <dt>Power</dt>
            <dd>{result.watts.toFixed(2)} W in all</dd>
            {result.parts.map((r, i) => (
              <div key={i} style={{ display: 'contents' }}>
                <dt>{r.part.bulb ? `Bulb ${i + 1}` : `${r.part.ohms} Ω`}</dt>
                <dd>
                  {r.volts.toFixed(2)} V, {amps(r.amps)}, {r.watts.toFixed(3)} W
                  {r.part.bulb ? ` (${Math.round(Math.min(brightness(r.watts), 1) * 100)}% bright)` : ''}
                </dd>
              </div>
            ))}
          </dl>
          {overloaded && <p className="shop-warn">That's well over the bulb's rating: a real bulb would soon burn out.</p>}
        </div>
      </div>
      <h3>What's happening</h3>
      <p>
        Ohm's law says the current through a part is the voltage across it divided by its resistance (I = V / R). In series,
        resistances add up and every part carries the same current, so each bulb gets a share of the voltage and glows dimmer. In
        parallel, every branch gets the full voltage, so each bulb glows fully, and the cell has to supply the current for all of
        them.
      </p>
      <p className="muted">
        Calculated with Ohm's law for an ideal cell. The bulb is treated as a fixed 12 Ω, rated for 3 V; a real filament's
        resistance rises as it heats up.
      </p>
    </Panel>
  )
}
