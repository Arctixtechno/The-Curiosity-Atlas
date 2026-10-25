import { useEffect, useRef, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { AU_KM, findPlanet, PLANETS, position, separation, SUN_DIAMETER_KM, VALID_YEARS, type PlanetId } from './planets.ts'
import './SolarSystemPanel.css'

const SIZE = 420
/** Days of simulated time per real second, for each speed button. */
const SPEEDS = [
  { label: 'Paused', days: 0 },
  { label: 'A day a second', days: 1 },
  { label: 'A month a second', days: 30 },
  { label: 'A year a second', days: 365.25 },
]
const DAY_MS = 86400000
const MIN_TIME = Date.UTC(VALID_YEARS[0], 0, 1)
const MAX_TIME = Date.UTC(VALID_YEARS[1], 11, 31)

/**
 * Distances on the chart: square-root scaled, so Mercury and Neptune both fit while
 * the order and spacing still read. (On a true scale, the inner planets would crowd the Sun.)
 */
function chartRadius(au: number, inner: boolean) {
  const max = inner ? 1.7 : 31
  return Math.sqrt(au / max) * (SIZE / 2 - 18)
}

function draw(ctx: CanvasRenderingContext2D, time: number, inner: boolean, selected: PlanetId, trails: Map<PlanetId, number[]>) {
  const date = new Date(time)
  const c = SIZE / 2
  ctx.clearRect(0, 0, SIZE, SIZE)
  // A faint star field.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  for (let i = 0; i < 120; i++) ctx.fillRect((i * 97) % SIZE, (i * 211) % SIZE, 1, 1)
  // Direction of the March equinox, the zero of ecliptic longitude.
  ctx.strokeStyle = 'rgba(224, 164, 88, 0.25)'
  ctx.setLineDash([3, 5])
  ctx.beginPath()
  ctx.moveTo(c, c)
  ctx.lineTo(SIZE - 6, c)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = 'rgba(224, 164, 88, 0.6)'
  ctx.font = '10px Georgia, serif'
  ctx.textAlign = 'right'
  ctx.fillText('♈ March equinox', SIZE - 8, c - 6)
  // The Sun.
  const g = ctx.createRadialGradient(c, c, 0, c, c, 16)
  g.addColorStop(0, '#fff4c0')
  g.addColorStop(0.4, '#ffc040')
  g.addColorStop(1, 'rgba(255, 160, 40, 0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(c, c, 16, 0, Math.PI * 2)
  ctx.fill()
  for (const planet of PLANETS) {
    const [a] = planet.elements
    if (inner && a > 2) continue
    // Orbit: sample positions over one period (looking down from the north, so y is flipped).
    ctx.strokeStyle = planet.id === selected ? 'rgba(224, 164, 88, 0.55)' : 'rgba(255, 255, 255, 0.12)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let k = 0; k <= 96; k++) {
      const p = position(planet, new Date(time + (k / 96) * planet.facts.periodDays * DAY_MS))
      const r = chartRadius(Math.hypot(p.x, p.y), inner)
      const ang = Math.atan2(p.y, p.x)
      const x = c + Math.cos(ang) * r
      const y = c - Math.sin(ang) * r
      if (k === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    const p = position(planet, date)
    const r = chartRadius(Math.hypot(p.x, p.y), inner)
    const ang = Math.atan2(p.y, p.x)
    const x = c + Math.cos(ang) * r
    const y = c - Math.sin(ang) * r
    // A short trail of recent positions.
    const trail = trails.get(planet.id) ?? []
    trail.push(x, y)
    if (trail.length > 40) trail.splice(0, trail.length - 40)
    trails.set(planet.id, trail)
    ctx.strokeStyle = `${planet.colour}66`
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i < trail.length; i += 2) (i ? ctx.lineTo : ctx.moveTo).call(ctx, trail[i], trail[i + 1])
    ctx.stroke()
    // Planet dots grow gently with real size, so the giants stand out.
    const dot = 3 + Math.sqrt(planet.facts.diameterKm / 12756) * 2
    ctx.fillStyle = planet.colour
    ctx.beginPath()
    ctx.arc(x, y, dot, 0, Math.PI * 2)
    ctx.fill()
    if (planet.facts.rings && planet.id === 'saturn') {
      ctx.strokeStyle = 'rgba(230, 210, 154, 0.8)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.ellipse(x, y, dot * 2, dot * 0.8, -0.4, 0, Math.PI * 2)
      ctx.stroke()
    }
    if (planet.id === selected) {
      ctx.strokeStyle = '#e0a458'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x, y, dot + 5, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(244, 234, 216, 0.85)'
    ctx.font = '11px Georgia, serif'
    // Labels sit to the right, unless that would run off the chart.
    const labelRight = x < SIZE - 70
    ctx.textAlign = labelRight ? 'left' : 'right'
    ctx.fillText(planet.name, labelRight ? x + dot + 4 : x - dot - 4, y + 4)
  }
}

/** Jupiter's disc on the to-scale strip, in pixels; everything else is sized against it. */
const STRIP_JUPITER_PX = 84

/** Every planet's disc side by side, at one scale, with the edge of the Sun behind them. */
function SizeStrip() {
  const px = (km: number) => (km / 142984) * STRIP_JUPITER_PX
  const sun = px(SUN_DIAMETER_KM)
  return (
    <div className="solar-sizes" aria-label="The planets to scale" style={{ height: STRIP_JUPITER_PX + 48 }}>
      <div
        className="solar-sun-edge"
        style={{ width: sun, height: sun, left: 26 - sun }}
        title={`The Sun: ${SUN_DIAMETER_KM.toLocaleString()} km across, ${Math.round(SUN_DIAMETER_KM / 12756)} times Earth`}
      />
      {PLANETS.map((p) => (
        <div key={p.id} className="solar-size">
          <div className="solar-disc" style={{ background: p.colour, width: Math.max(2, px(p.facts.diameterKm)) }} />
          <span>{p.name}</span>
        </div>
      ))}
    </div>
  )
}

/** The orrery's panel: the planets where they really are on any date from 1800 to 2050, and how they compare. */
export function SolarSystemPanel() {
  const [speed, setSpeed] = useState(SPEEDS[1].days)
  const [inner, setInner] = useState(false)
  const [selected, setSelected] = useState<PlanetId>('earth')
  const [time, setTime] = useState(() => Date.now())
  const canvas = useRef<HTMLCanvasElement>(null)
  const sim = useRef({ time, speed, inner, selected, trails: new Map<PlanetId, number[]>() })
  sim.current.speed = speed
  sim.current.selected = selected
  if (sim.current.inner !== inner) {
    sim.current.inner = inner
    sim.current.trails.clear()
  }

  useEffect(() => {
    const ctx = canvas.current!.getContext('2d')!
    let frame = 0
    let last = performance.now()
    let shown = 0
    const tick = (now: number) => {
      const s = sim.current
      s.time = Math.min(MAX_TIME, Math.max(MIN_TIME, s.time + ((now - last) / 1000) * s.speed * DAY_MS))
      last = now
      draw(ctx, s.time, s.inner, s.selected, s.trails)
      // Update the date readout a few times a second rather than every frame.
      if (now - shown > 200) {
        shown = now
        setTime(s.time)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const jump = (t: number) => {
    sim.current.time = t
    sim.current.trails.clear()
    setTime(t)
  }
  const planet = findPlanet(selected)
  const date = new Date(time)
  const fromEarth = selected === 'earth' ? null : separation(planet, findPlanet('earth'), date)
  const pos = position(planet, date)
  const fromSun = Math.hypot(pos.x, pos.y, pos.z)
  const f = planet.facts
  const million = (km: number) => `${(km / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 })} million km`

  return (
    <Panel title="The solar system" wide>
      <div className="solar-layout">
        <div>
          <canvas
            ref={canvas}
            width={SIZE}
            height={SIZE}
            className="solar-canvas"
            aria-label={`The planets on ${date.toDateString()}, seen from above the Sun's north pole`}
          />
          <p className="muted solar-note">Seen from above the north pole of the Sun. Distances are square-root scaled to fit.</p>
        </div>
        <div>
          <p className="solar-date">{date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <div className="solar-row" role="radiogroup" aria-label="Speed">
            {SPEEDS.map((s) => (
              <button
                key={s.label}
                role="radio"
                aria-checked={speed === s.days}
                className={`button${speed === s.days ? ' button-active' : ''}`}
                onClick={() => setSpeed(s.days)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="solar-row">
            <button className="button" onClick={() => jump(Date.now())}>
              Today
            </button>
            <button className={`button${inner ? ' button-active' : ''}`} onClick={() => setInner(!inner)}>
              {inner ? 'Show all planets' : 'Zoom to the inner planets'}
            </button>
          </div>
          <div className="solar-row" role="radiogroup" aria-label="Planet">
            {PLANETS.map((p) => (
              <button
                key={p.id}
                role="radio"
                aria-checked={p.id === selected}
                className={`button solar-planet${p.id === selected ? ' button-active' : ''}`}
                onClick={() => setSelected(p.id)}
              >
                <i style={{ background: p.colour }} />
                {p.name}
              </button>
            ))}
          </div>
          <h3>{planet.name}</h3>
          <dl className="solar-facts">
            <dt>From the Sun now</dt>
            <dd>
              {fromSun.toFixed(2)} au ({million(fromSun * AU_KM)})
            </dd>
            {fromEarth !== null && (
              <>
                <dt>From Earth now</dt>
                <dd>
                  {fromEarth.toFixed(2)} au: light takes {((fromEarth * AU_KM) / 299792.458 / 60).toFixed(1)} minutes
                </dd>
              </>
            )}
            <dt>A year there</dt>
            <dd>
              {f.periodDays.toLocaleString()} Earth days
              {f.periodDays > 700 ? ` (${(f.periodDays / 365.25).toFixed(1)} years)` : ''}
            </dd>
            <dt>A day there</dt>
            <dd>{f.dayHours > 48 ? `${(f.dayHours / 24).toFixed(1)} Earth days` : `${f.dayHours} hours`}</dd>
            <dt>Diameter</dt>
            <dd>
              {f.diameterKm.toLocaleString()} km ({(f.diameterKm / 12756).toFixed(2)} × Earth)
            </dd>
            <dt>Gravity</dt>
            <dd>
              {f.gravity} m/s² ({(f.gravity / 9.8).toFixed(2)} × Earth)
            </dd>
            <dt>Mean temperature</dt>
            <dd>{f.meanTempC} °C</dd>
            <dt>Moons</dt>
            <dd>
              {f.moons}
              {f.rings ? ', and a ring system' : ''}
            </dd>
          </dl>
        </div>
      </div>
      <h3>To scale</h3>
      <SizeStrip />
      <p className="muted">
        Positions are worked out from JPL's Keplerian elements for 1800 to 2050, and the figures come from NASA's Planetary Fact
        Sheet.{' '}
        <a href="https://ssd.jpl.nasa.gov/planets/approx_pos.html" target="_blank" rel="noreferrer">
          JPL
        </a>{' '}
        ·{' '}
        <a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/" target="_blank" rel="noreferrer">
          NASA
        </a>
      </p>
    </Panel>
  )
}
