import { useMemo, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { ColumnFlameIcon } from './icons.tsx'
import { CDU_LIMITS, PRICES, PRODUCTS, productPrice, type CduResult, type SteamLevel } from './cdu.ts'
import { CHALLENGES, checkChallenges, useCompleted } from './challenges.ts'
import { CRUDES, temperatureAt, type CrudeId } from './crudes.ts'
import { DEAD_TIME, DEFAULT_TUNING, firedDuty, measured, RELIGHT_BELOW, TIME_CONSTANT } from './furnace.ts'
import { Pfd } from './Pfd.tsx'
import { clock, money, SimClock, Slider } from './ui.tsx'
import { controls, currentResult, HISTORY_SECONDS, usePlant, type Plant } from './plant.ts'
import { usePlantClock } from './clock.ts'
import './Refinery.css'

type Tab = 'operate' | 'shift' | 'learn'

/** The crude distillation unit's operator screen: run the furnace and the column, and watch what comes out. */
export function CduPanel() {
  const plant = usePlant((p) => p)
  const result = useMemo(() => currentResult(plant), [plant])
  const [tab, setTab] = useState<Tab>('operate')
  const progress = useMemo(() => checkChallenges(plant, result), [plant, result])

  usePlantClock()

  return (
    <Panel
      title="Crude distillation unit"
      subtitle="Unit 100 at Marshgate: the first step in turning crude oil into fuels"
      icon={<ColumnFlameIcon />}
      wide
    >
      <div className="cdu">
        <div className="cdu-bar">
          <div className="segmented" role="tablist" aria-label="Screen">
            {(
              [
                ['operate', 'Operate'],
                ['shift', 'Shift tasks'],
                ['learn', 'How it works'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} className="button" role="tab" aria-selected={tab === id} aria-pressed={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
          <SimClock plant={plant} />
        </div>
        <Pfd plant={plant} result={result} />
        {tab === 'operate' && <Operate plant={plant} result={result} />}
        {tab === 'shift' && <Shift progress={progress} />}
        {tab === 'learn' && <Learn />}
      </div>
    </Panel>
  )
}

function Operate({ plant, result }: { plant: Plant; result: CduResult }) {
  const f = plant.furnace
  const { column } = plant
  return (
    <div className="cdu-grid">
      <section className="cdu-card">
        <h3>Feed</h3>
        <div className="cdu-crudes" role="group" aria-label="Crude oil">
          {Object.values(CRUDES).map((c) => (
            <button key={c.id} className="button button-quiet" aria-pressed={f.crude === c.id} onClick={() => controls.setCrude(c.id as CrudeId)}>
              <strong>{c.name}</strong>
              <small>
                API {c.api} · {c.sulphur}% S · ${c.price}
              </small>
            </button>
          ))}
        </div>
        <p className="cdu-note">{CRUDES[f.crude].note}</p>
        <Slider
          label="Crude rate"
          value={f.feed}
          min={CDU_LIMITS.feed.min}
          max={CDU_LIMITS.feed.max}
          step={1}
          unit="kb/d"
          onChange={controls.setFeed}
        />
        <Faceplate plant={plant} />
      </section>

      <section className="cdu-card">
        <h3>Column</h3>
        <Slider
          label="Top temperature"
          value={column.topTemp}
          min={CDU_LIMITS.topTemp.min}
          max={CDU_LIMITS.topTemp.max}
          step={1}
          unit="°C"
          onChange={(topTemp) => controls.setColumn({ topTemp })}
        />
        <Slider
          label="Kerosene draw"
          value={column.keroDraw}
          min={CDU_LIMITS.keroDraw.min}
          max={CDU_LIMITS.keroDraw.max}
          step={0.5}
          unit="%"
          digits={1}
          onChange={(keroDraw) => controls.setColumn({ keroDraw })}
        />
        <Slider
          label="Diesel draw"
          value={column.dieselDraw}
          min={CDU_LIMITS.dieselDraw.min}
          max={CDU_LIMITS.dieselDraw.max}
          step={0.5}
          unit="%"
          digits={1}
          onChange={(dieselDraw) => controls.setColumn({ dieselDraw })}
        />
        <div className="cdu-row">
          <span>Stripping steam</span>
          <div className="segmented">
            {(['low', 'normal', 'high'] as SteamLevel[]).map((s) => (
              <button key={s} className="button" aria-pressed={column.steam === s} onClick={() => controls.setColumn({ steam: s })}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <Lift result={result} />
        <h3>Boiling curve and cut points</h3>
        <TbpChart plant={plant} result={result} />
      </section>

      <section className="cdu-card cdu-wide">
        <h3>Products</h3>
        <Products result={result} />
        <Economics result={result} />
      </section>

      <section className="cdu-card cdu-wide">
        <h3>Alarms</h3>
        <Alarms plant={plant} />
        <button className="button button-quiet" onClick={controls.reset}>
          Reset the unit to design
        </button>
      </section>
    </div>
  )
}

/** The furnace temperature controller, laid out like a DCS faceplate. */
function Faceplate({ plant }: { plant: Plant }) {
  const f = plant.furnace
  const pv = measured(f)
  const auto = f.mode === 'auto'
  return (
    <div className={`faceplate${f.tripped ? ' faceplate-tripped' : ''}`}>
      <div className="faceplate-head">
        <strong>TIC-101</strong>
        <span className="muted">Furnace outlet temperature</span>
      </div>
      <div className="faceplate-values">
        <div>
          <span>PV</span>
          <strong className={f.outlet >= CDU_LIMITS.cot.coking ? 'cdu-bad' : ''}>{pv.toFixed(1)}</strong>
          <small>°C</small>
        </div>
        <div>
          <span>SP</span>
          <strong>{f.setpoint.toFixed(1)}</strong>
          <small>°C</small>
        </div>
        <div>
          <span>OP</span>
          <strong>{f.valve.toFixed(1)}</strong>
          <small>%</small>
        </div>
      </div>
      <div className="cdu-row">
        <div className="segmented" aria-label="Controller mode">
          <button className="button" aria-pressed={auto} disabled={f.tripped} onClick={() => controls.setMode('auto')}>
            Auto
          </button>
          <button className="button" aria-pressed={!auto} onClick={() => controls.setMode('manual')}>
            Manual
          </button>
        </div>
        <span className="muted">{firedDuty(f).toFixed(0)} MW fired</span>
      </div>
      {auto ? (
        <div className="cdu-row">
          <span>Setpoint</span>
          <div className="cdu-stepper">
            {[-5, -1, -0.5].map((d) => (
              <button key={d} className="button button-quiet" onClick={() => controls.setSetpoint(f.setpoint + d)}>
                {d}
              </button>
            ))}
            {[0.5, 1, 5].map((d) => (
              <button key={d} className="button button-quiet" onClick={() => controls.setSetpoint(f.setpoint + d)}>
                +{d}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Slider label="Fuel valve" value={f.valve} min={0} max={100} step={0.5} unit="%" digits={1} onChange={controls.setValve} />
      )}
      {f.tripped && (
        <div className="cdu-trip" role="alert">
          <strong>Furnace tripped.</strong> The outlet passed {CDU_LIMITS.cot.trip} °C and the safety system shut the fuel gas off.{' '}
          {f.outlet > RELIGHT_BELOW ? (
            `Wait for it to cool below ${RELIGHT_BELOW} °C to relight.`
          ) : (
            <button className="button button-primary" onClick={controls.relight}>
              Relight burners
            </button>
          )}
        </div>
      )}
      <TrendChart plant={plant} />
      <details className="cdu-details">
        <summary>Tuning and upsets</summary>
        <Slider
          label="Gain (Kc)"
          value={f.tuning.gain}
          min={0.1}
          max={8}
          step={0.1}
          unit="%/°C"
          digits={1}
          onChange={(gain) => controls.setTuning({ gain })}
        />
        <Slider
          label="Integral (Ti)"
          value={f.tuning.integral}
          min={0.2}
          max={20}
          step={0.1}
          unit="min"
          digits={1}
          onChange={(integral) => controls.setTuning({ integral })}
        />
        <Slider
          label="Derivative (Td)"
          value={f.tuning.derivative}
          min={0}
          max={2}
          step={0.05}
          unit="min"
          digits={2}
          onChange={(derivative) => controls.setTuning({ derivative })}
        />
        <div className="cdu-row cdu-upsets">
          <button className="button button-quiet" onClick={() => controls.setTuning(DEFAULT_TUNING)}>
            Default tuning
          </button>
          <button className="button button-quiet" aria-pressed={f.disturbances.fouling > 0} onClick={controls.toggleFouling}>
            Preheat fouling
          </button>
          <button className="button button-quiet" aria-pressed={f.disturbances.fuelQuality < 1} onClick={controls.toggleLeanFuel}>
            Lean fuel gas
          </button>
        </div>
        <p className="cdu-note">
          The outlet answers a valve move after {DEAD_TIME} seconds of dead time, then follows with a {TIME_CONSTANT / 60} minute time
          constant. The default tuning comes from the IMC rule for that.
        </p>
      </details>
    </div>
  )
}

/** The last half hour of TIC-101: outlet, setpoint and valve. */
function TrendChart({ plant }: { plant: Plant }) {
  const w = 340
  const h = 130
  const pad = { l: 34, r: 30, t: 8, b: 18 }
  const { history, furnace } = plant
  const end = furnace.time
  const start = end - HISTORY_SECONDS
  const temps = history.flatMap((s) => [s.pv, s.sp])
  const mid = (Math.max(...temps) + Math.min(...temps)) / 2
  const span = Math.max(10, Math.max(...temps) - Math.min(...temps) + 4)
  const lo = mid - span / 2
  const hi = mid + span / 2
  const x = (t: number) => pad.l + ((t - start) / HISTORY_SECONDS) * (w - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (h - pad.t - pad.b)
  const yOp = (v: number) => pad.t + (1 - v / 100) * (h - pad.t - pad.b)
  const line = (pick: (s: (typeof history)[number]) => number, scale: (v: number) => number) =>
    history.map((s) => `${x(s.time).toFixed(1)},${scale(pick(s)).toFixed(1)}`).join(' ')
  return (
    <svg className="cdu-trend" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Trend of the furnace outlet temperature, setpoint and fuel valve">
      <rect x={pad.l} y={pad.t} width={w - pad.l - pad.r} height={h - pad.t - pad.b} className="cdu-trend-bg" />
      {[lo, mid, hi].map((v) => (
        <text key={v} x={pad.l - 4} y={y(v) + 3} textAnchor="end">
          {v.toFixed(0)}
        </text>
      ))}
      {[0, 50, 100].map((v) => (
        <text key={v} x={w - pad.r + 4} y={yOp(v) + 3} className="cdu-trend-op-label">
          {v}%
        </text>
      ))}
      <text x={pad.l} y={h - 4}>
        −30 min
      </text>
      <text x={w - pad.r} y={h - 4} textAnchor="end">
        now
      </text>
      <polyline className="cdu-trend-op" points={line((s) => s.op, yOp)} />
      <polyline className="cdu-trend-sp" points={line((s) => s.sp, y)} />
      <polyline className="cdu-trend-pv" points={line((s) => s.pv, y)} />
    </svg>
  )
}

/** How much the furnace lifts into the column, against what the draws ask for. */
function Lift({ result }: { result: CduResult }) {
  const max = 100
  return (
    <div className="cdu-lift">
      <div className="cdu-lift-bar">
        <div className="cdu-lift-fill" style={{ width: `${(result.liftable / max) * 100}%` }} />
        <div className={`cdu-lift-ask${result.starved ? ' cdu-bad-bg' : ''}`} style={{ left: `${(result.requested / max) * 100}%` }} />
      </div>
      <p className="cdu-note">
        The flash zone lifts <strong>{result.liftable.toFixed(1)}%</strong> of the crude as vapour; the draws ask for{' '}
        <strong className={result.starved ? 'cdu-bad' : ''}>{result.requested.toFixed(1)}%</strong>.{' '}
        {result.starved ? 'Not enough: the lowest draw runs dry.' : 'Enough to go round.'}
      </p>
    </div>
  )
}

/** The crude's true boiling point curve, coloured by which product each part of it becomes. */
function TbpChart({ plant, result }: { plant: Plant; result: CduResult }) {
  const crude = CRUDES[plant.furnace.crude]
  const w = 340
  const h = 170
  const pad = { l: 34, r: 8, t: 8, b: 22 }
  const maxT = 600
  const x = (pct: number) => pad.l + (pct / 100) * (w - pad.l - pad.r)
  const y = (t: number) => pad.t + (1 - (Math.min(t, maxT) + 50) / (maxT + 50)) * (h - pad.t - pad.b)
  let start = 0
  const bands = PRODUCTS.map((p) => {
    const band = { ...p, from: start, to: start + result.products[p.id].percent }
    start = band.to
    return band
  })
  /** Points along the curve between two percentages boiled off. */
  const curve = (from: number, to: number) => {
    const pts: string[] = []
    for (let pct = from; pct < to; pct += 0.5) pts.push(`${x(pct).toFixed(1)},${y(temperatureAt(crude, pct)).toFixed(1)}`)
    pts.push(`${x(to).toFixed(1)},${y(temperatureAt(crude, to)).toFixed(1)}`)
    return pts
  }
  return (
    <svg className="cdu-tbp" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`True boiling point curve of ${crude.name} with the cut points`}>
      {bands.map((b) => {
        const pts = curve(b.from, b.to)
        if (b.to - b.from < 0.05 || pts.length === 0) return null
        return (
          <polygon
            key={b.id}
            points={`${x(b.from)},${y(-50)} ${pts.join(' ')} ${x(b.to)},${y(-50)}`}
            style={{ fill: b.colour }}
            className="cdu-tbp-band"
          />
        )
      })}
      <polyline className="cdu-tbp-curve" points={curve(0, 100).join(' ')} />
      <line x1={pad.l} y1={y(-50)} x2={w - pad.r} y2={y(-50)} className="cdu-axis" />
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={y(-50)} className="cdu-axis" />
      {[0, 200, 400, 600].map((t) => (
        <text key={t} x={pad.l - 4} y={y(t) + 3} textAnchor="end">
          {t}
        </text>
      ))}
      {[0, 50].map((p) => (
        <text key={p} x={x(p)} y={h - 8} textAnchor="middle">
          {p}%
        </text>
      ))}
      {bands.slice(0, -1).map((b) => (
        <text key={b.id} x={x(b.to) + 3} y={y(result.products[b.id].to) - 4} className="cdu-tbp-cut">
          {result.products[b.id].to.toFixed(0)}°
        </text>
      ))}
      <text x={w - pad.r} y={h - 8} textAnchor="end" className="cdu-tbp-axis-label">
        100% boiled off
      </text>
    </svg>
  )
}

function Products({ result }: { result: CduResult }) {
  return (
    <div className="cdu-table-wrap">
      <table className="cdu-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Yield</th>
            <th>Boils from</th>
            <th>Sulphur</th>
            <th>Specs</th>
            <th>Goes to</th>
          </tr>
        </thead>
        <tbody>
          {PRODUCTS.map((meta) => {
            const p = result.products[meta.id]
            return (
              <tr key={meta.id}>
                <td>
                  <span className="cdu-swatch" style={{ background: meta.colour }} /> {meta.name}
                </td>
                <td>
                  {p.percent.toFixed(1)}%<small> · {p.rate.toFixed(1)} kb/d</small>
                </td>
                <td>{meta.id === 'gas' ? 'below 30 °C' : meta.id === 'residue' ? `${p.from.toFixed(0)} °C up` : `${p.from.toFixed(0)}–${p.to.toFixed(0)} °C`}</td>
                <td>{meta.id === 'gas' ? '—' : p.sulphurPpm >= 10_000 ? `${(p.sulphurPpm / 10_000).toFixed(2)}%` : `${p.sulphurPpm.toFixed(0)} ppm`}</td>
                <td>
                  {p.specs.length === 0 ? (
                    <span className="muted">—</span>
                  ) : (
                    p.specs.map((s) => (
                      <span key={s.name} className={`cdu-spec ${s.ok ? 'cdu-spec-ok' : 'cdu-spec-bad'}`} title={s.why}>
                        {s.name} {s.value.toFixed(0)} {s.unit}
                        <small>
                          {' '}
                          ({s.kind === 'min' ? '≥' : '≤'} {s.limit})
                        </small>
                      </span>
                    ))
                  )}
                </td>
                <td className="cdu-goes">{meta.goesTo}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="cdu-note">
        Straight-run diesel carries {result.products.diesel.sulphurPpm.toFixed(0)} ppm of sulphur, against a road fuel limit of 10 ppm,
        which is why every refinery has hydrotreaters downstream. Hover over a spec to see why it matters.
      </p>
    </div>
  )
}

function Economics({ result }: { result: CduResult }) {
  const e = result.economics
  return (
    <div className="cdu-econ">
      <dl className="cdu-readings">
        <dt>Products</dt>
        <dd>{money(e.productValue)} a day</dd>
        <dt>Crude</dt>
        <dd>−{money(e.crudeCost)}</dd>
        <dt>Furnace fuel</dt>
        <dd>
          −{money(e.fuelCost)} <small className="muted">({result.furnace.fired.toFixed(0)} MW)</small>
        </dd>
        <dt>Stripping steam</dt>
        <dd>−{money(e.steamCost)}</dd>
        <dt>Margin</dt>
        <dd>
          <strong className={e.margin < 0 ? 'cdu-bad' : 'cdu-good'}>{money(e.margin)} a day</strong>{' '}
          <span className="muted">(${e.perBarrel.toFixed(2)} a barrel)</span>
        </dd>
      </dl>
      <p className="cdu-note">
        Products are valued at what the next unit downstream would pay: diesel ${PRICES.products.diesel}, jet $
        {PRICES.products.kerosene}, naphtha ${PRICES.products.naphtha}, residue ${productPrice(result.products.residue).toFixed(0)} (less
        for more sulphur). Anything off spec goes to slops at ${PRICES.slops}. Prices are illustrative.
      </p>
    </div>
  )
}

function Alarms({ plant }: { plant: Plant }) {
  if (plant.alarms.length === 0) return <p className="muted">No alarms. The unit is running quietly.</p>
  return (
    <ul className="cdu-alarms">
      {plant.alarms.map((a) => (
        <li key={`${a.id}-${a.time}`} className={`${a.active ? 'cdu-alarm-active' : ''} cdu-alarm-${a.priority}`}>
          <time>{clock(a.time)}</time> {a.text}
          {!a.active && <span className="muted"> · cleared</span>}
        </li>
      ))}
    </ul>
  )
}

function Shift({ progress }: { progress: Record<string, number> }) {
  const completed = useCompleted()
  return (
    <div className="cdu-shift">
      <p>
        Tasks a new panel operator would be set on a first shift. Each one has to hold for a while in plant time, so speed the clock
        up if you're waiting. Progress is saved in this browser.
      </p>
      <ol className="cdu-tasks">
        {CHALLENGES.map((c) => {
          const done = completed.has(c.id)
          const p = progress[c.id] ?? 0
          return (
            <li key={c.id} className={done ? 'cdu-task-done' : ''}>
              <div className="cdu-task-head">
                <strong>{c.title}</strong>
                <span className={done ? 'cdu-good' : 'muted'}>{done ? 'Done' : p > 0 ? `Holding… ${Math.round(p * 100)}%` : 'Not yet'}</span>
              </div>
              <p>{c.task}</p>
              {!done && p > 0 && (
                <div className="cdu-lift-bar">
                  <div className="cdu-lift-fill" style={{ width: `${p * 100}%` }} />
                </div>
              )}
              {!done && (
                <details>
                  <summary>Hint</summary>
                  <p className="cdu-note">{c.hint}</p>
                </details>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Learn() {
  return (
    <div className="cdu-learn">
      <h3>What the unit does</h3>
      <p>
        Crude oil is a mixture of thousands of hydrocarbons, from gases with three or four carbon atoms to tars with fifty or more.
        Small molecules boil at low temperatures and big ones at high temperatures, so heating the crude and letting it cool again at
        different heights sorts it by size. That is all a crude distillation unit does, and every barrel a refinery processes goes
        through one first.
      </p>
      <h3>Preheat, desalter and furnace</h3>
      <p>
        Cold crude is first warmed by the hot products leaving the unit, in a train of heat exchangers, which recovers most of the
        heat. Part way along, at about 120–150 °C, it is mixed with wash water and passed through a desalter, where an electric field
        breaks the emulsion and the water carries the salt away. Salt left in would turn to hydrochloric acid in the column overhead
        and corrode it. The crude then reaches the furnace at about 265 °C, and the furnace takes it to around 360 °C.
      </p>
      <p>
        Why not hotter? Above roughly 370 °C the heaviest molecules start to crack in the furnace tubes, laying down coke that insulates
        the tubes until they overheat. So everything that won't boil at 360 °C leaves the bottom of this column as residue, and goes
        on to a vacuum column, where low pressure lets it boil at temperatures that don't crack it.
      </p>
      <h3>Inside the column</h3>
      <p>
        The hot crude flashes into the column: about two thirds turns to vapour and rises, the rest falls to the bottom. The column
        is full of trays. On each one, rising vapour bubbles through a pool of liquid; heavier molecules condense into the liquid and
        lighter ones boil out of it. Liquid spills down from tray to tray, vapour climbs up, and every tray does a little more sorting,
        so the column gets cooler towards the top. Cool liquid pumped back in at the top (reflux) is what keeps the top cool.
      </p>
      <h3>Why draws set the cut points</h3>
      <p>
        You can't choose a product's boiling range directly. What you choose is how much you draw off each tray. Draw more kerosene
        and the extra has to come from somewhere: heavier molecules that would have been diesel move up into the kerosene, and its end
        point rises. That's why the cut points move on the boiling curve when you move a draw. The top temperature does the same job
        for naphtha: a hotter top lets heavier molecules leave overhead.
      </p>
      <h3>Strippers and flash point</h3>
      <p>
        A side draw always carries some lighter molecules down with it. Each side product passes through a small stripping column where
        steam blows them back into the main column. The light ends decide the flash point, the temperature at which a fuel gives off
        enough vapour to ignite. Jet fuel must have a flash point of at least 38 °C, and road diesel above 55 °C. More steam strips
        harder but costs money.
      </p>
      <h3>Controlling the furnace</h3>
      <p>
        TIC-101 is a PID controller. Every second it compares the outlet temperature (the process value, PV) with the setpoint (SP)
        and moves the fuel valve (the output, OP):
      </p>
      <ul>
        <li>
          <strong>Proportional</strong>: moves the valve in proportion to the error. More gain reacts harder, but too much and the loop
          oscillates.
        </li>
        <li>
          <strong>Integral</strong>: keeps moving the valve for as long as any error remains, so the temperature ends up exactly on
          setpoint. A shorter integral time acts faster, and also pushes towards oscillation.
        </li>
        <li>
          <strong>Derivative</strong>: reacts to how fast the temperature is changing. Useful on slow loops, but it amplifies
          measurement noise, so many furnace loops run with little or none.
        </li>
      </ul>
      <p>
        A furnace is hard to control because of its dead time: a valve move takes about half a minute to show at the outlet. A
        controller that doesn't wait for its last move to show will keep pushing, overshoot, and oscillate. Try a gain of 4 and an
        integral time of 1 minute, then change the setpoint, and watch the trend.
      </p>
      <h3>About this model</h3>
      <p className="muted">
        The yields come straight from each crude's true boiling point curve (rounded from typical published assays). Flash points use
        the Riazi–Daubert correlation and the furnace follows a first-order lag with dead time, the standard model for fired heaters.
        It leaves out tray-by-tray calculations, pressure, and the difference between TBP and laboratory (ASTM D86) boiling points, so
        the numbers are close to a real unit's but not a design tool.
      </p>
    </div>
  )
}
