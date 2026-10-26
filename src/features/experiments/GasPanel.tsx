import { useEffect, useRef, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { HowItWorks } from '../../components/HowItWorks.tsx'
import { FlaskIcon } from '../../components/icons.tsx'
import { ATMOSPHERE_KPA, celsius, GAS_LIMITS, GAS_START, pressureKPa, rmsSpeed, type GasState } from './gasLaw.ts'
import './Experiments.css'

const W = 360
const H = 300
/** The cylinder on the canvas: inside width, and the height that holds the largest volume. */
const CYL = { x: 70, width: 150, bottom: 270, maxHeight: 220 }
const GAUGE = { x: 295, y: 90, r: 50, maxKPa: 2000 }
/** Molecules drawn per mole of gas: a stand-in for the real ~6 × 10²³. */
const DOTS_PER_MOLE = 400

interface Dot {
  x: number
  y: number
  vx: number
  vy: number
}

function heightFor(litres: number) {
  return (litres / GAS_LIMITS.litres.max) * CYL.maxHeight
}

/** Blue when cold to red when hot. */
function heatColour(kelvin: number) {
  const t = (kelvin - GAS_LIMITS.kelvin.min) / (GAS_LIMITS.kelvin.max - GAS_LIMITS.kelvin.min)
  return `hsl(${210 - t * 200}, 80%, 62%)`
}

function draw(ctx: CanvasRenderingContext2D, gas: GasState, dots: Dot[]) {
  ctx.clearRect(0, 0, W, H)
  const top = CYL.bottom - heightFor(gas.litres)
  // Gas and its molecules.
  ctx.fillStyle = 'rgba(120, 160, 220, 0.08)'
  ctx.fillRect(CYL.x, top, CYL.width, CYL.bottom - top)
  ctx.fillStyle = heatColour(gas.kelvin)
  for (const d of dots) {
    ctx.beginPath()
    ctx.arc(d.x, d.y, 2.6, 0, Math.PI * 2)
    ctx.fill()
  }
  // Glass cylinder.
  ctx.strokeStyle = 'rgba(220, 235, 255, 0.7)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(CYL.x - 2, CYL.bottom - CYL.maxHeight - 14)
  ctx.lineTo(CYL.x - 2, CYL.bottom + 2)
  ctx.lineTo(CYL.x + CYL.width + 2, CYL.bottom + 2)
  ctx.lineTo(CYL.x + CYL.width + 2, CYL.bottom - CYL.maxHeight - 14)
  ctx.stroke()
  // Litre marks.
  ctx.fillStyle = 'rgba(220, 235, 255, 0.6)'
  ctx.font = '10px Georgia, serif'
  ctx.textAlign = 'right'
  for (let l = 1; l <= GAS_LIMITS.litres.max; l++) {
    const y = CYL.bottom - heightFor(l)
    ctx.fillRect(CYL.x - 10, y, 8, 1.5)
    ctx.fillText(`${l} L`, CYL.x - 13, y + 4)
  }
  // Brass piston and rod.
  ctx.fillStyle = '#c9a55c'
  ctx.fillRect(CYL.x, top - 12, CYL.width, 12)
  ctx.fillRect(CYL.x + CYL.width / 2 - 5, 8, 10, top - 20)
  // Heater under the cylinder, glowing with the temperature.
  ctx.fillStyle = heatColour(gas.kelvin)
  ctx.globalAlpha = 0.35 + 0.5 * ((gas.kelvin - GAS_LIMITS.kelvin.min) / (GAS_LIMITS.kelvin.max - GAS_LIMITS.kelvin.min))
  ctx.fillRect(CYL.x, CYL.bottom + 8, CYL.width, 8)
  ctx.globalAlpha = 1
  // Pressure gauge.
  const p = pressureKPa(gas)
  ctx.strokeStyle = '#c9a55c'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(GAUGE.x, GAUGE.y, GAUGE.r, 0, Math.PI * 2)
  ctx.stroke()
  const start = Math.PI * 0.75
  const sweep = Math.PI * 1.5
  ctx.lineWidth = 1.5
  ctx.fillStyle = '#e8dcc4'
  ctx.textAlign = 'center'
  for (let k = 0; k <= GAUGE.maxKPa; k += 250) {
    const a = start + (k / GAUGE.maxKPa) * sweep
    ctx.beginPath()
    ctx.moveTo(GAUGE.x + Math.cos(a) * (GAUGE.r - 4), GAUGE.y + Math.sin(a) * (GAUGE.r - 4))
    ctx.lineTo(GAUGE.x + Math.cos(a) * (GAUGE.r - (k % 500 ? 9 : 13)), GAUGE.y + Math.sin(a) * (GAUGE.r - (k % 500 ? 9 : 13)))
    ctx.stroke()
    if (k % 500 === 0) ctx.fillText(String(k), GAUGE.x + Math.cos(a) * (GAUGE.r - 23), GAUGE.y + Math.sin(a) * (GAUGE.r - 23) + 3)
  }
  const needle = start + (Math.min(p, GAUGE.maxKPa) / GAUGE.maxKPa) * sweep
  ctx.strokeStyle = '#e05a3c'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(GAUGE.x, GAUGE.y)
  ctx.lineTo(GAUGE.x + Math.cos(needle) * (GAUGE.r - 8), GAUGE.y + Math.sin(needle) * (GAUGE.r - 8))
  ctx.stroke()
  ctx.fillText('kPa', GAUGE.x, GAUGE.y + 28)
  // Pipe from the gauge to the cylinder.
  ctx.strokeStyle = 'rgba(201, 165, 92, 0.8)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(GAUGE.x, GAUGE.y + GAUGE.r)
  ctx.lineTo(GAUGE.x, CYL.bottom - 12)
  ctx.lineTo(CYL.x + CYL.width + 2, CYL.bottom - 12)
  ctx.stroke()
}

/** A small chart of pressure against volume: the curve at this temperature, and where the gas is on it. */
function Isotherm({ gas }: { gas: GasState }) {
  const w = 300
  const h = 120
  const maxP = pressureKPa({ moles: GAS_LIMITS.moles.max, kelvin: GAS_LIMITS.kelvin.max, litres: GAS_LIMITS.litres.min })
  const x = (litres: number) =>
    30 + ((litres - GAS_LIMITS.litres.min) / (GAS_LIMITS.litres.max - GAS_LIMITS.litres.min)) * (w - 40)
  // Square root scale, so both ends of the curve stay readable.
  const y = (kPa: number) => h - 18 - Math.sqrt(Math.min(kPa, maxP) / maxP) * (h - 28)
  const points: string[] = []
  for (let l = GAS_LIMITS.litres.min; l <= GAS_LIMITS.litres.max + 1e-9; l += 0.05) {
    points.push(`${x(l).toFixed(1)},${y(pressureKPa({ ...gas, litres: l })).toFixed(1)}`)
  }
  return (
    <svg className="lab-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Pressure against volume at this temperature">
      <line x1={30} y1={h - 18} x2={w - 8} y2={h - 18} />
      <line x1={30} y1={8} x2={30} y2={h - 18} />
      <line className="lab-chart-ref" x1={30} x2={w - 8} y1={y(ATMOSPHERE_KPA)} y2={y(ATMOSPHERE_KPA)} />
      <text x={w - 10} y={y(ATMOSPHERE_KPA) - 4} textAnchor="end">
        1 atm
      </text>
      <polyline points={points.join(' ')} />
      <circle cx={x(gas.litres)} cy={y(pressureKPa(gas))} r={4.5} />
      <text x={w / 2} y={h - 3} textAnchor="middle">
        volume →
      </text>
      <text x={10} y={14}>
        p
      </text>
    </svg>
  )
}

/** The piston experiment: change the volume, temperature or amount of gas and watch the pressure. */
export function GasPanel() {
  const [gas, setGas] = useState<GasState>(GAS_START)
  const canvas = useRef<HTMLCanvasElement>(null)
  const state = useRef({ gas, dots: [] as Dot[] })
  state.current.gas = gas

  useEffect(() => {
    const ctx = canvas.current!.getContext('2d')!
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { gas, dots } = state.current
      const top = CYL.bottom - heightFor(gas.litres)
      // Keep the number of molecules in step with the amount of gas.
      const want = Math.round(gas.moles * DOTS_PER_MOLE)
      while (dots.length < want) {
        const a = Math.random() * Math.PI * 2
        dots.push({
          x: CYL.x + 4 + Math.random() * (CYL.width - 8),
          y: top + 4 + Math.random() * (CYL.bottom - top - 8),
          vx: Math.cos(a),
          vy: Math.sin(a),
        })
      }
      dots.length = want
      // Screen speed follows the real molecular speed, scaled down a great deal.
      const speed = rmsSpeed(gas.kelvin) * 0.25
      for (const d of dots) {
        const norm = Math.hypot(d.vx, d.vy) || 1
        d.x += (d.vx / norm) * speed * dt
        d.y += (d.vy / norm) * speed * dt
        if (d.x < CYL.x + 3) ((d.x = CYL.x + 3), (d.vx = Math.abs(d.vx)))
        if (d.x > CYL.x + CYL.width - 3) ((d.x = CYL.x + CYL.width - 3), (d.vx = -Math.abs(d.vx)))
        if (d.y < top + 3) ((d.y = top + 3), (d.vy = Math.abs(d.vy)))
        if (d.y > CYL.bottom - 3) ((d.y = CYL.bottom - 3), (d.vy = -Math.abs(d.vy)))
      }
      draw(ctx, gas, dots)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const p = pressureKPa(gas)
  const set = (change: Partial<GasState>) => setGas((g) => ({ ...g, ...change }))
  return (
    <Panel title="Gas laws" subtitle="The piston: pressure, volume and temperature" icon={<FlaskIcon />} wide>
      <div className="lab-layout">
        <canvas ref={canvas} width={W} height={H} className="lab-canvas" aria-label="A gas in a cylinder under a piston" />
        <div>
          <label className="lab-control">
            <span>Volume</span>
            <input
              type="range"
              min={GAS_LIMITS.litres.min}
              max={GAS_LIMITS.litres.max}
              step={0.05}
              value={gas.litres}
              onChange={(e) => set({ litres: Number(e.target.value) })}
            />
            <output>{gas.litres.toFixed(2)} L</output>
          </label>
          <label className="lab-control">
            <span>Temperature</span>
            <input
              type="range"
              min={GAS_LIMITS.kelvin.min}
              max={GAS_LIMITS.kelvin.max}
              step={1}
              value={gas.kelvin}
              onChange={(e) => set({ kelvin: Number(e.target.value) })}
            />
            <output>{celsius(gas.kelvin).toFixed(0)} °C</output>
          </label>
          <label className="lab-control">
            <span>Amount of gas</span>
            <input
              type="range"
              min={GAS_LIMITS.moles.min}
              max={GAS_LIMITS.moles.max}
              step={0.005}
              value={gas.moles}
              onChange={(e) => set({ moles: Number(e.target.value) })}
            />
            <output>{gas.moles.toFixed(3)} mol</output>
          </label>
          <dl className="lab-readings">
            <dt>Pressure</dt>
            <dd>
              {p.toFixed(1)} kPa ({(p / ATMOSPHERE_KPA).toFixed(2)} atm)
            </dd>
            <dt>Molecule speed</dt>
            <dd>about {Math.round(rmsSpeed(gas.kelvin))} m/s (nitrogen, root mean square)</dd>
          </dl>
          <Isotherm gas={gas} />
          <button className="button" onClick={() => setGas(GAS_START)}>
            Reset
          </button>
        </div>
      </div>
      <HowItWorks>
        <p>
          Pressure is molecules hitting the walls. Squeeze the gas into half the space and they hit twice as often, so the
          pressure doubles (Boyle's law). Heat it and they move faster, hitting harder and more often (Gay-Lussac's law). Add more
          gas and there are more of them to hit. All three are one rule, the ideal gas law: <em>pV = nRT</em>.
        </p>
        <p className="muted">
          Calculated with the ideal gas law (R = 8.314 J/mol·K), which is accurate to well under one per cent for air at these
          conditions. The dots stand in for between 10²² and 10²³ real molecules, and move far slower than the real ones.
        </p>
      </HowItWorks>
    </Panel>
  )
}
