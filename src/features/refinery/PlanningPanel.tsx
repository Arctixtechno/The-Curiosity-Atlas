import { useMemo, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { usePlantClock } from './clock.ts'
import { CRUDES, type CrudeId } from './crudes.ts'
import { PlanIcon } from './icons.tsx'
import { BASE_BRENT, dateOf, history, marketOn, type CrackId } from './market.ts'
import { controls, usePlant, type Plant } from './plant.ts'
import { bestCrashing, CARGO, CRUDE_COLOURS, CRUDE_IDS, crudeValues, MAX_CARGOES, PLAN_DAYS, planCrudes, schedule, TURNAROUND } from './planning.ts'
import { siteBalance, SITE_PRICES } from './site.ts'
import { CurveChart, money, SimClock } from './ui.tsx'
import './Refinery.css'

type Tab = 'crudes' | 'market' | 'carbon' | 'turnaround'

/** The planners' office: next month's crudes by linear programming, the market, carbon, and the turnaround. */
export function PlanningPanel() {
  usePlantClock()
  const plant = usePlant((p) => p)
  const [tab, setTab] = useState<Tab>('crudes')
  return (
    <Panel title="Planning and trading" subtitle="Choose next month’s crudes, follow the market, price the carbon and plan the turnaround" icon={<PlanIcon />} wide>
      <div className="cdu pl">
        <div className="cdu-bar">
          <div className="segmented" role="tablist" aria-label="Section">
            {(
              [
                ['crudes', 'Crude plan'],
                ['market', 'Market'],
                ['carbon', 'Carbon'],
                ['turnaround', 'Turnaround'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} className="button" role="tab" aria-selected={tab === id} aria-pressed={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
          <SimClock plant={plant} />
        </div>
        {tab === 'crudes' && <CrudePlan plant={plant} />}
        {tab === 'market' && <Market plant={plant} />}
        {tab === 'carbon' && <Carbon plant={plant} />}
        {tab === 'turnaround' && <Turnaround plant={plant} />}
      </div>
    </Panel>
  )
}

/** The plant's settings, but not its clock: what the planner's sums depend on. */
const settingsKey = (p: Plant) =>
  JSON.stringify([p.furnace.crude, p.column, p.vdu, p.fcc, p.reformer, p.dht, p.sru, p.coker, p.hydrocracker, p.smr, p.blend, p.alky, p.isom, p.market, Math.floor(p.tanks.day)])

function CrudePlan({ plant }: { plant: Plant }) {
  const key = settingsKey(plant)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const values = useMemo(() => crudeValues(plant), [key])
  const [offered, setOffered] = useState<Set<CrudeId>>(() => new Set(CRUDE_IDS))
  const [discounts, setDiscounts] = useState<Partial<Record<CrudeId, number>>>({})
  const plan = useMemo(() => planCrudes(values, { offered, discounts, coker: plant.coker.running }), [values, offered, discounts, plant.coker.running])
  const move = plant.market.live ? marketOn(plant.tanks.day).crude : 0
  const total = CRUDE_IDS.reduce((s, id) => s + plan.barrels[id], 0)
  const leader = CRUDE_IDS.reduce((a, b) => (plan.barrels[b] > plan.barrels[a] ? b : a))

  return (
    <>
      <p className="cdu-note">
        Each crude is run through the whole site model at 100 kb/d: the one running now as it’s set, the others at their natural cuts with the blends
        re-planned. A linear programme then picks next month’s slate for the most margin, within the crude unit, what can be done with the residue, the
        sulphur plant, and {MAX_CARGOES} cargoes of {CARGO} kbbl a grade.
      </p>
      <div className="pl-slate" role="img" aria-label="Next month's crude slate">
        {CRUDE_IDS.filter((id) => plan.barrels[id] > 1).map((id) => (
          <div key={id} style={{ flex: plan.barrels[id], background: CRUDE_COLOURS[id] }} title={`${CRUDES[id].name}: ${plan.barrels[id].toFixed(0)} kbbl`}>
            <span>{CRUDES[id].name}</span>
            <small>{((plan.barrels[id] / CARGO) * 10) / 10 >= 1 ? `${(plan.barrels[id] / CARGO).toFixed(1)} cargoes` : `${plan.barrels[id].toFixed(0)} kbbl`}</small>
          </div>
        ))}
      </div>
      <div className="pl-totals">
        <span>
          Month’s margin <strong>{money(plan.margin)}</strong>
        </span>
        <span>
          <strong>{(total / PLAN_DAYS).toFixed(0)}</strong> kb/d average
        </span>
        <button className="button" onClick={() => controls.setCrude(leader)} disabled={plant.furnace.crude === leader || total < 1}>
          {plant.furnace.crude === leader ? `Running ${CRUDES[leader].name}` : `Run ${CRUDES[leader].name} now`}
        </button>
      </div>
      <div className="pl-constraints">
        {plan.constraints.map((c) => {
          const binding = c.used >= c.limit * 0.999
          return (
            <div key={c.id} className={`pl-constraint${binding ? ' pl-binding' : ''}`}>
              <div className="pl-constraint-head">
                <strong>{c.name}</strong>
                <span>{binding ? 'Binding' : `${Math.round((c.used / c.limit) * 100)}% used`}</span>
              </div>
              <div className="pl-bar" aria-hidden="true">
                <i style={{ width: `${Math.min(100, (c.used / c.limit) * 100)}%` }} />
              </div>
              <small>
                {c.used.toFixed(0)} of {c.limit.toFixed(0)} {c.unit}.{' '}
                {binding && c.shadow > 0.5
                  ? `Shadow price ${c.unit.startsWith('t') ? `$${c.shadow.toFixed(0)} a tonne` : `$${(c.shadow / 1000).toFixed(2)} a barrel`}: what a little more room is worth.`
                  : 'Room to spare: a little more is worth nothing.'}
              </small>
            </div>
          )
        })}
      </div>
      <table className="sf-table pl-table">
        <thead>
          <tr>
            <th>On offer</th>
            <th>Crude</th>
            <th>Price</th>
            <th>Margin at 100 kb/d</th>
            <th>Residue</th>
            <th>Sulphur</th>
            <th>Discount</th>
            <th>Plan</th>
          </tr>
        </thead>
        <tbody>
          {values.map((v) => {
            const c = CRUDES[v.id]
            const d = discounts[v.id] ?? 0
            return (
              <tr key={v.id} className={offered.has(v.id) ? '' : 'pl-off'}>
                <td>
                  <input
                    type="checkbox"
                    checked={offered.has(v.id)}
                    aria-label={`${c.name} on offer`}
                    onChange={() => {
                      const next = new Set(offered)
                      if (next.has(v.id)) next.delete(v.id)
                      else next.add(v.id)
                      setOffered(next)
                    }}
                  />
                </td>
                <td>
                  <span className="cdu-swatch" style={{ background: CRUDE_COLOURS[v.id] }} /> <strong>{c.name}</strong>
                  {plant.furnace.crude === v.id && <small className="pl-now"> running</small>}
                  <br />
                  <small className="muted">
                    {c.origin} · API {c.api} · {c.sulphur}% S
                  </small>
                </td>
                <td>${(c.price + move - d).toFixed(2)}</td>
                <td className={v.margin + d > 0 ? 'cdu-good' : 'cdu-bad'}>
                  ${(v.margin + d).toFixed(2)}/bbl
                  {!v.onSpec && (
                    <small className="sf-warn" title="Some products are off spec at these cuts">
                      {' '}
                      ⚠ off spec
                    </small>
                  )}
                </td>
                <td>{(v.residue * 100).toFixed(0)}%</td>
                <td>{v.sulphur.toFixed(2)} t/kbbl</td>
                <td>
                  <input
                    className="pl-discount"
                    type="range"
                    min={-5}
                    max={5}
                    step={0.5}
                    value={d}
                    aria-label={`${c.name} discount, dollars a barrel`}
                    onChange={(e) => setDiscounts({ ...discounts, [v.id]: Number(e.target.value) })}
                  />
                  <small>{d === 0 ? 'list' : d > 0 ? `−$${d}` : `+$${-d}`}</small>
                </td>
                <td>
                  <strong>{plan.barrels[v.id] > 1 ? `${plan.barrels[v.id].toFixed(0)} kbbl` : '–'}</strong>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="cdu-note muted">
        Real planners then round the plan to whole cargoes and check it against the full model, because a linear model is only exact near where it was
        measured. Try taking a crude off offer, or a dollar off one, and watch the slate and the shadow prices move.
      </p>
    </>
  )
}

const CRACKS: { id: CrackId; name: string; colour: string; base: number }[] = [
  { id: 'petrol', name: 'Petrol crack', colour: '#f0c050', base: 105 - BASE_BRENT },
  { id: 'diesel', name: 'Diesel crack', colour: '#d9733c', base: 108 - BASE_BRENT },
  { id: 'jet', name: 'Jet crack', colour: '#9fd0e0', base: 105 - BASE_BRENT },
  { id: 'fuelOil', name: 'Fuel oil crack', colour: '#8a7a6a', base: SITE_PRICES.fuelOil - BASE_BRENT },
]

function Market({ plant }: { plant: Plant }) {
  const day = plant.tanks.day
  const today = marketOn(day)
  const past = useMemo(() => history(day, 120), [Math.floor(day)]) // eslint-disable-line react-hooks/exhaustive-deps
  const live = plant.market.live
  const key = settingsKey(plant)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const [atBase, atMarket] = useMemo(() => [siteBalance({ ...plant, market: { ...plant.market, live: false } }), siteBalance({ ...plant, market: { ...plant.market, live: true } })], [key])
  const x = (d: number) => d - Math.floor(day)
  return (
    <>
      <p className="cdu-note">
        Refiners don’t earn the price of petrol: they earn its <em>crack</em>, what it sells for over the crude it came from. Crude wanders over months;
        petrol cracks peak in the summer driving season, diesel’s and gas’s in winter. The market moves a day each time the tank farm runs a day.
      </p>
      <div className="pl-market-head">
        <div className="pl-today">
          <small>{dateOf(day)}</small>
          <strong>Brent ${today.brent.toFixed(2)}</strong>
          <span className={today.crude >= 0 ? 'cdu-bad' : 'cdu-good'}>
            {today.crude >= 0 ? '+' : '−'}${Math.abs(today.crude).toFixed(2)} on the plan
          </span>
        </div>
        <label className="pl-toggle">
          <input type="checkbox" checked={live} onChange={() => controls.setMarket({ live: !live })} />
          <span>
            <strong>Trade at market prices</strong>
            <small>The site’s margin, the tank farm and the DCS follow the day’s prices</small>
          </span>
        </label>
        <div className="ac-buttons">
          <button className="button" onClick={() => controls.runDays(1)}>
            Run a day
          </button>
          <button className="button" onClick={() => controls.runDays(7)}>
            Run a week
          </button>
        </div>
      </div>
      <div className="pl-market-grid">
        <CurveChart
          label="Brent over the last 120 days"
          x={{ min: -119, max: 0, label: 'Days ago' }}
          y={{ min: 70, max: 95, label: '$/bbl' }}
          curves={[{ name: 'Brent', colour: '#e0a458', points: past.map((m) => [x(m.day), m.brent]) }]}
          lines={[{ y: BASE_BRENT, label: 'plan' }]}
        />
        <CurveChart
          label="Product cracks over the last 120 days"
          x={{ min: -119, max: 0, label: 'Days ago' }}
          y={{ min: -30, max: 35, label: '$/bbl over Brent' }}
          curves={CRACKS.map((c) => ({ name: c.name, colour: c.colour, points: past.map((m) => [x(m.day), c.base + m.cracks[c.id]] as [number, number]) }))}
        />
      </div>
      <table className="sf-table">
        <thead>
          <tr>
            <th>Today</th>
            <th>Crack</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {CRACKS.map((c) => (
            <tr key={c.id}>
              <td>
                <span className="cdu-swatch" style={{ background: c.colour }} /> {c.name.replace(' crack', '')}
              </td>
              <td>
                ${(c.base + today.cracks[c.id]).toFixed(2)} <small className="muted">({today.cracks[c.id] >= 0 ? '+' : '−'}${Math.abs(today.cracks[c.id]).toFixed(2)})</small>
              </td>
              <td>${(today.brent + c.base + today.cracks[c.id]).toFixed(2)}</td>
            </tr>
          ))}
          <tr>
            <td>Natural gas</td>
            <td />
            <td>${today.gas.toFixed(2)}/GJ</td>
          </tr>
        </tbody>
      </table>
      <div className="sf-test">
        <span>
          Site margin today: <strong>{money(atMarket.margin)}</strong> a day at market prices, against <strong>{money(atBase.margin)}</strong> at the plan’s.
        </span>
      </div>
    </>
  )
}

function Carbon({ plant }: { plant: Plant }) {
  const key = settingsKey(plant)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const b = useMemo(() => siteBalance(plant), [key])
  const parts = [
    { name: 'Fuel burnt in furnaces and reboilers', t: b.co2.fuel, colour: '#e0a458' },
    { name: 'Coke burnt off the cat cracker’s catalyst', t: b.co2.fcc, colour: '#8a7a6a' },
    { name: 'Making hydrogen from natural gas', t: b.co2.hydrogen, colour: '#7fb4dc' },
  ]
  const perBbl = plant.furnace.feed > 0 ? (b.co2.total * 1000) / (plant.furnace.feed * 1000) : 0
  return (
    <>
      <p className="cdu-note">
        A refinery burns a few per cent of its crude to run itself. In the UK and Europe every tonne of CO₂ needs an allowance, so carbon is a running cost
        like fuel. This is the site’s direct CO₂: what its stacks release, not what the fuels release when they’re used.
      </p>
      <div className="pl-carbon">
        <div>
          <div className="pl-co2-total">
            <strong>{b.co2.total.toFixed(0)}</strong> t of CO₂ a day
            <small>{perBbl.toFixed(1)} kg a barrel of crude</small>
          </div>
          <div className="pl-co2-bar" role="img" aria-label="Where the CO₂ comes from">
            {parts
              .filter((p) => p.t > 0.5)
              .map((p) => (
                <i key={p.name} style={{ flex: p.t, background: p.colour }} title={`${p.name}: ${p.t.toFixed(0)} t/d`} />
              ))}
          </div>
          <ul className="cv-legend">
            {parts.map((p) => (
              <li key={p.name}>
                <span className="cdu-swatch" style={{ background: p.colour }} /> {p.name}: {p.t.toFixed(0)} t/d
              </li>
            ))}
          </ul>
        </div>
        <div>
          <label className="cdu-control">
            <span>Carbon price</span>
            <input type="range" min={0} max={150} step={5} value={plant.market.carbon} onChange={(e) => controls.setMarket({ carbon: Number(e.target.value) })} />
            <output>${plant.market.carbon} /t</output>
          </label>
          <dl className="sf-readings">
            <div>
              <dt>Carbon a day</dt>
              <dd>{money(b.co2.total * plant.market.carbon)}</dd>
            </div>
            <div>
              <dt>A barrel</dt>
              <dd>${((perBbl / 1000) * plant.market.carbon).toFixed(2)}</dd>
            </div>
            <div>
              <dt>Site margin</dt>
              <dd className={b.margin > 0 ? 'cdu-good' : 'cdu-bad'}>{money(b.margin)}/d</dd>
            </div>
          </dl>
          <h4 className="sf-sub">Ways to cut it</h4>
          <ul className="pl-tips">
            <li>Run the furnaces cooler: every degree of crude furnace outlet is fuel.</li>
            <li>Keep the preheat exchangers clean: fouling makes the furnace burn more.</li>
            <li>Make less coke in the cat cracker: a cooler riser burns less in the regenerator.</li>
            <li>Buy hydrogen made with carbon capture, or need less of it.</li>
          </ul>
        </div>
      </div>
    </>
  )
}

function Turnaround({ plant }: { plant: Plant }) {
  const key = settingsKey(plant)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const daily = useMemo(() => Math.max(300_000, siteBalance(plant).margin), [key])
  const [crashed, setCrashed] = useState<Set<string>>(new Set())
  const s = schedule(TURNAROUND, crashed)
  const lost = s.days * daily
  const best = useMemo(() => bestCrashing(TURNAROUND, daily), [daily])
  const bestS = schedule(TURNAROUND, best)
  const toggle = (id: string) => {
    const next = new Set(crashed)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setCrashed(next)
  }
  const w = 760
  const left = 250
  const row = 26
  const dayW = (w - left - 20) / 25
  return (
    <>
      <p className="cdu-note">
        Every four or five years the crude unit comes down for a turnaround: inspection, cleaning and repairs no one can do with it running. Every day it’s
        down costs the site its margin, about {money(daily)} today. Extra crews working nights shorten some jobs, at a price. Only the jobs on the{' '}
        <strong>critical path</strong> decide how long it takes: shortening anything else just gives it more slack.
      </p>
      <svg className="pl-gantt" viewBox={`0 0 ${w} ${TURNAROUND.length * row + 34}`} role="img" aria-label={`Turnaround schedule: ${s.days} days`}>
        {Array.from({ length: 26 }, (_, d) => (
          <g key={d}>
            <line x1={left + d * dayW} x2={left + d * dayW} y1={20} y2={TURNAROUND.length * row + 24} className={d % 5 === 0 ? 'pl-grid-major' : 'pl-grid'} />
            {d % 5 === 0 && (
              <text x={left + d * dayW} y={14} textAnchor="middle" className="pl-gantt-day">
                day {d}
              </text>
            )}
          </g>
        ))}
        {TURNAROUND.map((t, i) => {
          const y = 24 + i * row
          const critical = s.critical.includes(t.id)
          const len = s.finish[t.id] - s.start[t.id]
          return (
            <g key={t.id}>
              <text x={left - 8} y={y + 15} textAnchor="end" className={`pl-gantt-name${critical ? ' pl-critical-text' : ''}`}>
                {t.name}
              </text>
              {s.slack[t.id] > 0 && <rect x={left + s.finish[t.id] * dayW} y={y + 8} width={s.slack[t.id] * dayW} height={4} className="pl-slack" />}
              <rect x={left + s.start[t.id] * dayW + 1} y={y + 3} width={Math.max(2, len * dayW - 2)} height={row - 8} rx={4} className={critical ? 'pl-critical' : 'pl-task'} />
              {crashed.has(t.id) && (
                <text x={left + s.start[t.id] * dayW + 6} y={y + 16} className="pl-gantt-crew">
                  +crew
                </text>
              )}
            </g>
          )
        })}
        <line x1={left + s.days * dayW} x2={left + s.days * dayW} y1={18} y2={TURNAROUND.length * row + 26} className="pl-end" />
      </svg>
      <div className="pl-crews">
        {TURNAROUND.filter((t) => t.crashed < t.days).map((t) => (
          <label key={t.id} className={`pl-crew${s.critical.includes(t.id) ? ' pl-crew-critical' : ''}`}>
            <input type="checkbox" checked={crashed.has(t.id)} onChange={() => toggle(t.id)} />
            <span>
              <strong>{t.name}</strong>
              <small>
                {t.days} → {t.crashed} days for {money(t.crashCost)}
                {s.critical.includes(t.id) ? ' · critical' : ` · ${s.slack[t.id].toFixed(0)} days slack`}
              </small>
            </span>
          </label>
        ))}
      </div>
      <div className="pl-totals">
        <span>
          <strong>{s.days}</strong> days down
        </span>
        <span>
          Lost margin <strong>{money(lost)}</strong>
        </span>
        <span>
          Extra crews <strong>{money(s.crashCost)}</strong>
        </span>
        <span>
          Total <strong>{money(lost + s.crashCost)}</strong>
        </span>
        <button className="button" onClick={() => setCrashed(new Set(best))}>
          Planner’s best: {bestS.days} days, {money(bestS.days * daily + bestS.crashCost)}
        </button>
      </div>
    </>
  )
}
