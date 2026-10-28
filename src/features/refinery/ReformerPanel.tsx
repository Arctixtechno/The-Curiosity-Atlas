import { useEffect, useMemo, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { complete, useCompleted } from './challenges.ts'
import { CRUDES } from './crudes.ts'
import { ReformerIcon } from './icons.tsx'
import { controls, reformingResult, usePlant, type Plant, type ReformingResult } from './plant.ts'
import { BEDS, feedOctane, naphthaTonnes, NHT_LIMITS, REFORMER_LIMITS, REFORMER_PRICES } from './reformer.ts'
import { ReformerPfd } from './ReformerPfd.tsx'
import { REFORMING_TASKS } from './reformingTasks.ts'
import { money, Slider } from './ui.tsx'
import './Refinery.css'

type Tab = 'operate' | 'shift' | 'learn'

/** The naphtha hydrotreater and reformer's operator screen, with the catalyst's whole cycle to run through. */
export function ReformerPanel() {
  const plant = usePlant((p) => p)
  const result = useMemo(() => reformingResult(plant), [plant])
  const [tab, setTab] = useState<Tab>('operate')

  useEffect(() => {
    for (const t of REFORMING_TASKS) if (t.met(plant, result)) complete(t.id)
  }, [plant, result])

  return (
    <Panel
      title="Naphtha hydrotreater and reformer"
      subtitle="Units 400 and 500 at Marshgate: high-octane petrol and the refinery's hydrogen"
      icon={<ReformerIcon />}
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
          <span className="muted">
            Fed by the crude unit: {CRUDES[plant.furnace.crude].name} at {plant.furnace.feed.toFixed(0)} kb/d
          </span>
        </div>
        <ReformerPfd plant={plant} result={result} />
        {tab === 'operate' && <Operate plant={plant} result={result} />}
        {tab === 'shift' && <Shift plant={plant} result={result} />}
        {tab === 'learn' && <Learn />}
      </div>
    </Panel>
  )
}

function Operate({ plant, result }: { plant: Plant; result: ReformingResult }) {
  const { nht, reformer: r, feed } = result
  const warnings = [...nht.warnings, ...r.warnings]
  return (
    <div className="cdu-grid">
      <section className="cdu-card">
        <h3>Naphtha hydrotreater</h3>
        <p className="cdu-note">
          The crude unit's naphtha boils from 30 to {feed.endPoint.toFixed(0)} °C. The light part, below 80 °C, goes to isomerisation;
          the {feed.rate.toFixed(1)} kb/d above it comes here, carrying {nht.sulphurIn.toFixed(0)} ppm of sulphur.
        </p>
        <Slider
          label="Reactor inlet"
          value={plant.nht.temp}
          min={NHT_LIMITS.temp.min}
          max={NHT_LIMITS.temp.max}
          step={1}
          unit="°C"
          onChange={(temp) => controls.setNht({ temp })}
        />
        <dl className="cdu-readings">
          <dt>Sulphur to the reformer</dt>
          <dd className={nht.sulphurOut > REFORMER_LIMITS.sulphurMax ? 'cdu-bad' : 'cdu-good'}>
            {nht.sulphurOut < 0.1 ? nht.sulphurOut.toFixed(3) : nht.sulphurOut.toFixed(2)} ppm{' '}
            <small className="muted">(limit {REFORMER_LIMITS.sulphurMax})</small>
          </dd>
          <dt>Removed</dt>
          <dd>{(100 * (1 - nht.sulphurOut / Math.max(1e-9, nht.sulphurIn))).toFixed(3)}%</dd>
        </dl>
        <h3>Feed and reformate</h3>
        <Composition label="Feed" pna={feed} octane={feedOctane(feed)} />
        <Composition label="Reformate" pna={r.composition} octane={r.octane} />
        <ul className="cv-legend">
          {PNA.map((c) => (
            <li key={c.id}>
              <span className="cdu-swatch" style={{ background: c.colour }} /> {c.name}
            </li>
          ))}
        </ul>
        <p className="cdu-note">
          Paraffins (chains) have poor octane, naphthenes (rings) fair, aromatics (benzene rings) excellent. Reforming turns the first
          two into the third.
        </p>
      </section>

      <section className="cdu-card">
        <h3>Reformer</h3>
        <Slider
          label="Reactor inlets"
          value={plant.reformer.wait}
          min={REFORMER_LIMITS.wait.min}
          max={REFORMER_LIMITS.wait.max}
          step={1}
          unit="°C"
          onChange={(wait) => controls.setReformer({ wait })}
        />
        <Slider
          label="Pressure"
          value={plant.reformer.pressure}
          min={REFORMER_LIMITS.pressure.min}
          max={REFORMER_LIMITS.pressure.max}
          step={1}
          unit="bar"
          onChange={(pressure) => controls.setReformer({ pressure })}
        />
        <Slider
          label="Hydrogen to oil"
          value={plant.reformer.h2hc}
          min={REFORMER_LIMITS.h2hc.min}
          max={REFORMER_LIMITS.h2hc.max}
          step={0.5}
          unit="mol/mol"
          digits={1}
          onChange={(h2hc) => controls.setReformer({ h2hc })}
        />
        <dl className="cdu-readings">
          <dt>Reformate octane</dt>
          <dd>
            <strong>{r.octane.toFixed(1)} RON</strong>
          </dd>
          <dt>Reformate yield</dt>
          <dd>{r.yields.reformate.toFixed(1)} wt%</dd>
          <dt>Hydrogen made</dt>
          <dd>
            {r.hydrogen.toFixed(0)} t/d <small className="muted">({r.yields.hydrogen.toFixed(2)} wt%)</small>
          </dd>
          <dt>Furnace duty</dt>
          <dd>{r.duty.toFixed(0)} MW across three furnaces</dd>
          <dt>Catalyst activity</dt>
          <dd className={r.activity < 0.5 ? 'cdu-bad' : ''}>{(r.activity * 100).toFixed(0)}% of fresh</dd>
        </dl>
        <h3>Temperature through the reactors</h3>
        <Profile plant={plant} result={result} />
      </section>

      <section className="cdu-card cdu-wide">
        <h3>Catalyst cycle</h3>
        <Cycle plant={plant} result={result} />
      </section>

      <section className="cdu-card cdu-wide">
        <h3>Products</h3>
        <Products plant={plant} result={result} />
      </section>

      <section className="cdu-card cdu-wide">
        <h3>Warnings</h3>
        {warnings.length === 0 ? (
          <p className="muted">Nothing to report. Both units are inside their limits.</p>
        ) : (
          <ul className="cdu-alarms">
            {warnings.map((w) => (
              <li key={w} className="cdu-alarm-active cdu-alarm-low">
                {w}
              </li>
            ))}
          </ul>
        )}
        <button className="button button-quiet" onClick={controls.resetReforming}>
          Reset both units to design, with fresh catalyst
        </button>
      </section>
    </div>
  )
}

const PNA = [
  { id: 'p', name: 'Paraffins', colour: '#9fb7c8' },
  { id: 'n', name: 'Naphthenes', colour: '#8fcf9f' },
  { id: 'a', name: 'Aromatics', colour: '#f0c050' },
] as const

/** Paraffins, naphthenes and aromatics as one stacked bar. */
function Composition({ label, pna, octane }: { label: string; pna: { p: number; n: number; a: number }; octane: number }) {
  const total = pna.p + pna.n + pna.a
  return (
    <div className="cv-heat-row">
      <span>{label}</span>
      <div className="cv-stack" role="img" aria-label={PNA.map((c) => `${c.name} ${((pna[c.id] / total) * 100).toFixed(0)}%`).join(', ')}>
        {PNA.map((c) => (
          <div key={c.id} style={{ width: `${(pna[c.id] / total) * 100}%`, background: c.colour }} title={`${c.name} ${((pna[c.id] / total) * 100).toFixed(0)}%`} />
        ))}
      </div>
      <output>{octane.toFixed(0)} RON</output>
    </div>
  )
}

/** The sawtooth: temperature against how far the oil has travelled through the catalyst. */
function Profile({ plant, result }: { plant: Plant; result: ReformingResult }) {
  const { profile, drops } = result.reformer
  const w = 340
  const h = 150
  const pad = { l: 34, r: 8, t: 10, b: 22 }
  const hi = Math.ceil((plant.reformer.wait + 10) / 10) * 10
  const lo = Math.floor((Math.min(...profile.map((p) => p.temp)) - 10) / 10) * 10
  const x = (at: number) => pad.l + at * (w - pad.l - pad.r)
  const y = (t: number) => pad.t + (1 - (t - lo) / (hi - lo)) * (h - pad.t - pad.b)
  let start = 0
  const beds = BEDS.map((b) => {
    const bed = { from: start, to: start + b }
    start += b
    return bed
  })
  return (
    <div>
      <svg className="cdu-tbp" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Reactor temperatures: drops of ${drops.map((d) => d.toFixed(0)).join(', ')} °C`}>
        {beds.map((b, i) => (
          <g key={i}>
            <rect x={x(b.from)} y={pad.t} width={x(b.to) - x(b.from)} height={h - pad.t - pad.b} className={i % 2 ? 'cdu-trend-bg' : 'rf-bed'} />
            <text x={(x(b.from) + x(b.to)) / 2} y={h - 8} textAnchor="middle">
              R{i + 1}
            </text>
            <text x={(x(b.from) + x(b.to)) / 2 + 6} y={pad.t + 12} textAnchor="middle" className="cdu-tbp-cut">
              −{drops[i].toFixed(0)}°
            </text>
          </g>
        ))}
        {[lo, hi].map((t) => (
          <text key={t} x={pad.l - 4} y={y(t) + 3} textAnchor="end">
            {t}
          </text>
        ))}
        <polyline className="cdu-trend-pv" points={profile.map((p) => `${x(p.at).toFixed(1)},${y(p.temp).toFixed(1)}`).join(' ')} />
      </svg>
      <p className="cdu-note">
        Each reactor cools the oil as the reactions soak up heat; the furnace before the next one heats it back up. The first drop is
        the biggest because naphthenes react fastest.
      </p>
    </div>
  )
}

function Cycle({ plant, result }: { plant: Plant; result: ReformingResult }) {
  const { catalyst } = plant
  const r = result.reformer
  const spent = catalyst.coke >= REFORMER_LIMITS.cokeMax
  return (
    <div className="rf-cycle">
      <div>
        <dl className="cdu-readings">
          <dt>Days on stream</dt>
          <dd>{catalyst.days.toFixed(0)}</dd>
          <dt>Coke on catalyst</dt>
          <dd className={spent ? 'cdu-bad' : ''}>
            {catalyst.coke.toFixed(1)} wt% <small className="muted">(limit {REFORMER_LIMITS.cokeMax})</small>
          </dd>
          <dt>Coking rate</dt>
          <dd>{(r.cokeRate * 30).toFixed(2)} wt% a month</dd>
          <dt>Left in this cycle</dt>
          <dd>{spent ? 'none: regenerate' : `about ${r.daysLeft.toFixed(0)} days at these settings`}</dd>
        </dl>
        <div className="cdu-lift-bar">
          <div className="cdu-lift-fill" style={{ width: `${(catalyst.coke / REFORMER_LIMITS.cokeMax) * 100}%` }} />
        </div>
        <div className="cdu-row">
          <div className="cdu-stepper">
            {[10, 30, 90].map((d) => (
              <button key={d} className="button button-quiet" disabled={spent} onClick={() => controls.runCatalyst(d)}>
                Run {d} days
              </button>
            ))}
          </div>
          <button className="button button-quiet" onClick={controls.regenerate}>
            Regenerate
          </button>
        </div>
        <p className="cdu-note">
          Running on lays coke on the catalyst at today's settings. Raise the inlets as it goes to hold your octane. Regenerating burns
          the coke off: in a semi-regenerative unit like this, that means two or three weeks shut down.
        </p>
      </div>
      <CycleChart plant={plant} />
    </div>
  )
}

/** Inlet temperature and octane over the cycle so far. */
function CycleChart({ plant }: { plant: Plant }) {
  const w = 380
  const h = 160
  const pad = { l: 34, r: 34, t: 10, b: 22 }
  const points = plant.cycle
  const end = Math.max(240, ...points.map((p) => p.days))
  const x = (d: number) => pad.l + (d / end) * (w - pad.l - pad.r)
  const yT = (t: number) => pad.t + (1 - (t - 480) / 60) * (h - pad.t - pad.b)
  const yO = (o: number) => pad.t + (1 - (o - 90) / 14) * (h - pad.t - pad.b)
  const line = (pick: (p: (typeof points)[number]) => number, scale: (v: number) => number) =>
    points.map((p) => `${x(p.days).toFixed(1)},${scale(pick(p)).toFixed(1)}`).join(' ')
  return (
    <svg className="cdu-trend" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Reactor inlet temperature and reformate octane through the catalyst cycle">
      <rect x={pad.l} y={pad.t} width={w - pad.l - pad.r} height={h - pad.t - pad.b} className="cdu-trend-bg" />
      <line x1={pad.l} x2={w - pad.r} y1={yT(REFORMER_LIMITS.waitMax)} y2={yT(REFORMER_LIMITS.waitMax)} className="rf-limit" />
      {[480, 510, 540].map((t) => (
        <text key={t} x={pad.l - 4} y={yT(t) + 3} textAnchor="end">
          {t}°
        </text>
      ))}
      {[90, 97, 104].map((o) => (
        <text key={o} x={w - pad.r + 4} y={yO(o) + 3} className="rf-octane-label">
          {o}
        </text>
      ))}
      <text x={pad.l} y={h - 6}>
        day 0
      </text>
      <text x={w - pad.r} y={h - 6} textAnchor="end">
        day {end.toFixed(0)}
      </text>
      {points.length > 1 ? (
        <>
          <polyline className="cdu-trend-pv" points={line((p) => p.wait, yT)} />
          <polyline className="rf-octane" points={line((p) => p.octane, yO)} />
        </>
      ) : (
        <text x={w / 2} y={h / 2} textAnchor="middle" className="rf-empty">
          Run the catalyst on to draw the cycle
        </text>
      )}
    </svg>
  )
}

function Products({ plant, result }: { plant: Plant; result: ReformingResult }) {
  const r = result.reformer
  const tonnes = naphthaTonnes(result.feed.rate)
  const rows = [
    { name: 'Reformate', share: r.yields.reformate, goes: 'petrol blending: the highest-octane component', colour: '#f0c050' },
    { name: 'Hydrogen', share: r.yields.hydrogen, goes: 'the hydrotreaters, through the hydrogen header', colour: '#a9c9e8' },
    { name: 'LPG', share: r.yields.lpg, goes: 'gas plant', colour: '#9fd0e0' },
    { name: 'Fuel gas', share: r.yields.fuelGas, goes: 'refinery fuel', colour: '#b9c7d6' },
  ]
  const e = r.economics
  return (
    <div className="cdu-table-wrap">
      <table className="cdu-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Yield</th>
            <th>Goes to</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>
                <span className="cdu-swatch" style={{ background: row.colour }} /> {row.name}
              </td>
              <td>
                {row.share.toFixed(row.name === 'Hydrogen' ? 2 : 1)} wt%<small> · {((row.share / 100) * tonnes).toFixed(0)} t/d</small>
              </td>
              <td className="cdu-goes">{row.goes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="cdu-readings">
        <dt>Products</dt>
        <dd>{money(e.productValue)} a day</dd>
        <dt>Naphtha</dt>
        <dd>−{money(e.feedCost)}</dd>
        <dt>Furnace fuel</dt>
        <dd>−{money(e.fuelCost)}</dd>
        <dt>Margin</dt>
        <dd>
          <strong className={e.margin < 0 ? 'cdu-bad' : 'cdu-good'}>{money(e.margin)} a day</strong>
        </dd>
      </dl>
      <p className="cdu-note">
        Reformate is valued at ${REFORMER_PRICES.reformate}/t at 95 octane, plus ${REFORMER_PRICES.perOctane} for each point above, and
        hydrogen at ${REFORMER_PRICES.hydrogen}/t, what a steam reformer would charge to make it. The margin doesn't count the cost of
        regenerating sooner. Prices are illustrative.
      </p>
      {plant.catalyst.coke >= REFORMER_LIMITS.cokeMax && <p className="cdu-bad">The catalyst is spent: regenerate it.</p>}
    </div>
  )
}

function Shift({ plant, result }: { plant: Plant; result: ReformingResult }) {
  const completed = useCompleted()
  return (
    <div className="cdu-shift">
      <p>
        Requests from the planners and the shift supervisor. Each is done as soon as you meet it, and progress is saved in this
        browser. For the long run, use the catalyst cycle's Run buttons and keep an eye on the octane each time.
      </p>
      <ol className="cdu-tasks">
        {REFORMING_TASKS.map((t) => {
          const done = completed.has(t.id)
          return (
            <li key={t.id} className={done ? 'cdu-task-done' : ''}>
              <div className="cdu-task-head">
                <strong>{t.title}</strong>
                <span className={done ? 'cdu-good' : 'muted'}>{done ? 'Done' : t.met(plant, result) ? 'Met' : 'Not yet'}</span>
              </div>
              <p>{t.task}</p>
              {!done && (
                <details>
                  <summary>Hint</summary>
                  <p className="cdu-note">{t.hint}</p>
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
      <h3>Why reform naphtha</h3>
      <p>
        Straight-run heavy naphtha has an octane of about 50 to 65: put it in a car and it would knock. Its molecules are mostly
        straight chains (paraffins) and rings (naphthenes). Aromatics, rings with alternating double bonds like benzene and toluene,
        resist knocking far better. The reformer rearranges the naphtha's molecules into aromatics, lifting the octane to 95–105, and
        gives off hydrogen as it does so.
      </p>
      <h3>First, the hydrotreater</h3>
      <p>
        The reformer's catalyst is platinum, and sulphur poisons it: more than half a part per million and it loses activity. So the
        naphtha first goes through a hydrotreater, where hydrogen over a cobalt–molybdenum catalyst at about 320 °C turns the sulphur
        compounds into hydrogen sulphide, which a stripper boils off to the amine unit. The reaction rate roughly doubles every 15 °C,
        and the sulphur left falls exponentially with it, which is why a few degrees too cool lets sulphur break through.
      </p>
      <h3>The reactions</h3>
      <ul>
        <li>
          <strong>Dehydrogenation</strong>: naphthenes lose hydrogen and become aromatics (methylcyclohexane → toluene + 3 H₂). Fast,
          and strongly endothermic.
        </li>
        <li>
          <strong>Dehydrocyclisation</strong>: paraffins close into rings and then lose hydrogen (n-heptane → toluene + 4 H₂). Slow,
          endothermic, and the reaction that needs severity. Low pressure helps it.
        </li>
        <li>
          <strong>Isomerisation</strong>: straight paraffins become branched ones, which have better octane.
        </li>
        <li>
          <strong>Hydrocracking</strong>: paraffins break into propane and butane, using up hydrogen. Exothermic, worse at high
          temperature and pressure, and the main loss of liquid yield.
        </li>
      </ul>
      <h3>Three reactors and three furnaces</h3>
      <p>
        The reactions absorb so much heat that the oil can cool by 80 °C in the first reactor, and a cooler oil reacts more slowly.
        So the catalyst is split between three reactors, with a furnace before each to heat the oil back up. The first reactor is the
        smallest, because the fast naphthene reaction is mostly done there; the last is the biggest, for the slow paraffin reactions.
        The temperature drop across each reactor tells the operator what is happening inside: a smaller drop in the first reactor
        than usual is the first sign of a poisoned catalyst.
      </p>
      <h3>Pressure, hydrogen and coke</h3>
      <p>
        Low pressure favours the reactions that make aromatics and hydrogen and holds back hydrocracking, so yield and hydrogen go up.
        But coke builds up on the catalyst much faster at low pressure, and with less recycle hydrogen to sweep it away. A
        semi-regenerative unit like this one runs at 15–25 bar, cokes up over 6 to 18 months, and shuts down to burn the coke off.
        Modern continuous units run at 3.5 bar and regenerate the catalyst constantly, moving it through the reactors and a
        regenerator like a slow river.
      </p>
      <h3>About this model</h3>
      <p className="muted">
        Three lumped first-order reactions with Arrhenius rates, integrated in 40 slices down each bed with an adiabatic energy
        balance; heats of reaction from the model compounds above. Desulphurisation is first order with an activation energy of about
        100 kJ/mol. Coking rate and the octane of each class are shaped to published semi-regenerative reformer data (Antos and
        Aitani, Catalytic Naphtha Reforming). The trends are right and the numbers typical, but it is not a design tool.
      </p>
    </div>
  )
}
