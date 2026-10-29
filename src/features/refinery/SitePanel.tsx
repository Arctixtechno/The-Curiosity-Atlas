import { useEffect, useMemo, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { openOverlay } from '../../world/overlay.ts'
import { complete } from './challenges.ts'
import { usePlantClock } from './clock.ts'
import { CRUDES } from './crudes.ts'
import { ManagerIcon } from './icons.tsx'
import { BLENDING_OVERLAY, CDU_OVERLAY, CONVERSION_OVERLAY, LIGHT_ENDS_OVERLAY, REFORMER_OVERLAY, TREATING_OVERLAY } from './overlayIds.ts'
import { controls, savedAt, usePlant, type Plant } from './plant.ts'
import { siteBalance, type SiteBalance } from './site.ts'
import { SITE_TASKS } from './siteTasks.ts'
import { daysOfCover, ledgerTotal, rundowns, TANK_IDS, TANK_LIMITS, TANKS, type TankFarm, type TankId } from './tankFarm.ts'
import { CurveChart, money, SimClock, TaskList } from './ui.tsx'
import './Refinery.css'

type Tab = 'margin' | 'tanks' | 'shift' | 'learn'

/** The plant manager's screen: the whole site's margin, every unit at a glance, and the tank farm and jetty. */
export function SitePanel() {
  usePlantClock()
  const plant = usePlant((p) => p)
  const balance = useMemo(() => siteBalance(plant), [plant])
  const [tab, setTab] = useState<Tab>('margin')

  useEffect(() => {
    for (const t of SITE_TASKS) if (t.met(plant, balance)) complete(t.id)
  }, [plant, balance])

  return (
    <Panel title="Plant manager" subtitle="All of Marshgate on one screen: the margin, every unit, and the tank farm and jetty" icon={<ManagerIcon />} wide>
      <div className="cdu">
        <div className="cdu-bar">
          <div className="segmented" role="tablist" aria-label="Screen">
            {(
              [
                ['margin', 'Margin'],
                ['tanks', 'Tank farm'],
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
        <Kpis plant={plant} balance={balance} />
        {tab === 'margin' && <Margin plant={plant} balance={balance} />}
        {tab === 'tanks' && <Tanks farm={plant.tanks} balance={balance} />}
        {tab === 'shift' && (
          <TaskList
            intro="Targets from the refinery manager. Each is done as soon as you meet it, and progress is saved in this browser."
            tasks={SITE_TASKS}
            plant={plant}
            result={balance}
          />
        )}
        {tab === 'learn' && <Learn />}
      </div>
    </Panel>
  )
}

function Kpis({ plant, balance }: { plant: Plant; balance: SiteBalance }) {
  const total = ledgerTotal(plant.tanks)
  const saved = savedAt()
  return (
    <div className="sm-kpis">
      <div className={`sm-kpi${balance.margin < 0 ? ' sm-kpi-bad' : ''}`}>
        <span>Margin</span>
        <strong>{money(balance.margin)}</strong>
        <small>a day, {balance.perBarrel >= 0 ? '$' : '−$'}{Math.abs(balance.perBarrel).toFixed(2)} a barrel</small>
      </div>
      <div className="sm-kpi">
        <span>Crude</span>
        <strong>{balance.crude.rate.toFixed(0)} kb/d</strong>
        <small>
          {CRUDES[plant.furnace.crude].name} at ${balance.crude.price}
        </small>
      </div>
      <div className={`sm-kpi${total < 0 ? ' sm-kpi-bad' : ''}`}>
        <span>Since you took over</span>
        <strong>{money(total)}</strong>
        <small>over {plant.tanks.day.toFixed(1)} days</small>
      </div>
      <div className={`sm-kpi${plant.tanks.starved ? ' sm-kpi-bad' : ''}`}>
        <span>Plant</span>
        <strong>{plant.tanks.starved ? 'Shut down' : 'Running'}</strong>
        <small>
          {saved ? 'Saved in this browser' : 'Saves in this browser as you go'}{' '}
          <button className="sm-link" onClick={() => window.confirm('Start the whole plant afresh? Every setting and the tank farm go back to the start.') && controls.reset()}>
            Start afresh
          </button>
        </small>
      </div>
    </div>
  )
}

/* ---------------- Margin ---------------- */

function Margin({ plant, balance }: { plant: Plant; balance: SiteBalance }) {
  const products = balance.products
  const costs = balance.costs
  return (
    <div className="cdu-grid">
      <section className="cdu-card cdu-wide">
        <h3>Where a barrel goes</h3>
        <Sankey balance={balance} />
        <p className="cdu-note muted">
          Barrels out are {balance.volumeGain.toFixed(1)}% of barrels in: cracking makes lighter, less dense products, so the same tonnes take up
          more room.{balance.vgoToTank < -0.05 ? ` The cat cracker is also drawing ${(-balance.vgoToTank).toFixed(1)} kb/d of gas oil from its tank.` : ''}
        </p>
      </section>
      <section className="cdu-card">
        <h3>Sales</h3>
        <table className="sm-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>kb/d</th>
              <th>$/bbl</th>
              <th>a day</th>
            </tr>
          </thead>
          <tbody>
            {products.map((o) => (
              <tr key={o.id} title={o.note}>
                <td>
                  <span className="cdu-swatch" style={{ background: o.colour }} /> {o.name}
                  <small className="muted"> {o.note}</small>
                </td>
                <td>{o.rate.toFixed(1)}</td>
                <td>{o.price.toFixed(0)}</td>
                <td>{money(o.rate * (o.id === 'sulphur' ? 1 : 1000) * o.price)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Revenue</td>
              <td>{money(balance.revenue)}</td>
            </tr>
          </tfoot>
        </table>
      </section>
      <section className="cdu-card">
        <h3>Costs</h3>
        <table className="sm-table">
          <tbody>
            <tr>
              <td>
                Crude <small className="muted">{plant.furnace.feed.toFixed(0)} kb/d</small>
              </td>
              <td>{money(balance.crude.cost)}</td>
            </tr>
            {costs.map((c) => (
              <tr key={c.name}>
                <td>
                  {c.name} <small className="muted">{c.note}</small>
                </td>
                <td>{money(c.dollars)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Margin</td>
              <td className={balance.margin >= 0 ? 'cdu-good' : 'cdu-bad'}>{money(balance.margin)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="cdu-note muted">Prices are illustrative, in dollars, and held steady. Real margins swing with the market every day.</p>
      </section>
      <section className="cdu-card cdu-wide">
        <h3>Every unit</h3>
        <Units balance={balance} />
      </section>
    </div>
  )
}

/** Crude on the left, every product on the right, with bands as wide as the flows. */
function Sankey({ balance }: { balance: SiteBalance }) {
  const W = 920
  const H = 250
  const liquids = balance.products.filter((o) => o.id !== 'sulphur' && o.rate > 0.05)
  const total = liquids.reduce((s, o) => s + o.rate, 0) || 1
  const gap = 8
  const usable = H - 20 - gap * (liquids.length - 1)
  const leftH = H - 20
  let leftY = 10
  let rightY = 10
  const x0 = 150
  const x1 = 700
  return (
    <svg className="pfd sm-sankey" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Where each barrel of crude goes">
      <rect x={x0 - 24} y={10} width={24} height={leftH} rx={4} fill={CRUDES_COLOUR} />
      <text x={x0 - 32} y={H / 2 - 4} className="pfd-product" style={{ textAnchor: 'end' }}>
        Crude
      </text>
      <text x={x0 - 32} y={H / 2 + 12} className="pfd-note" style={{ textAnchor: 'end' }}>
        {balance.crude.rate.toFixed(0)} kb/d
      </text>
      {liquids.map((o) => {
        const lh = (o.rate / total) * leftH
        const rh = (o.rate / total) * usable
        const ly = leftY
        const ry = rightY
        leftY += lh
        rightY += rh + gap
        const mid = (x0 + x1) / 2
        const d = `M${x0} ${ly} C${mid} ${ly} ${mid} ${ry} ${x1} ${ry} V${ry + rh} C${mid} ${ry + rh} ${mid} ${ly + lh} ${x0} ${ly + lh} Z`
        return (
          <g key={o.id}>
            <path d={d} fill={o.colour} opacity={0.55} />
            <rect x={x1} y={ry} width={14} height={Math.max(1, rh)} fill={o.colour} />
            <text x={x1 + 22} y={ry + rh / 2 + 4} className="pfd-note" style={{ textAnchor: 'start', fill: '#e6edf2' }}>
              {o.name} · {o.rate.toFixed(1)} kb/d · {((o.rate / total) * 100).toFixed(0)}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}

const CRUDES_COLOUR = '#5a4632'

const perDay = (unit: 'kbbl' | 't') => (unit === 't' ? 't/d' : 'kb/d')

/** Each unit's state in a line, with its screen a click away. */
function Units({ balance }: { balance: SiteBalance }) {
  const { units } = balance
  const { treating, gasPlant, isom, alky, petrol, diesel } = units
  const { conversion, reforming, dht, sru, hydrogen } = treating
  const { cdu, vdu, fcc } = conversion
  const rows: { name: string; reading: string; warnings: string[]; overlay: string }[] = [
    { name: 'Crude unit', reading: `${cdu.products.diesel.rate.toFixed(1)} kb/d diesel, furnace ${cdu.furnace.fired.toFixed(0)} MW`, warnings: cdu.warnings, overlay: CDU_OVERLAY },
    { name: 'Vacuum unit', reading: `cut point ${vdu.cutPoint.toFixed(0)} °C`, warnings: vdu.warnings, overlay: CONVERSION_OVERLAY },
    { name: 'Cat cracker', reading: `${fcc.conversion.toFixed(0)}% conversion, ${fcc.octane.toFixed(1)} RON`, warnings: fcc.warnings, overlay: CONVERSION_OVERLAY },
    { name: 'Reformer', reading: `${reforming.reformer.octane.toFixed(1)} RON, ${reforming.reformer.hydrogen.toFixed(0)} t/d H₂`, warnings: [...reforming.nht.warnings, ...reforming.reformer.warnings], overlay: REFORMER_OVERLAY },
    { name: 'Hydrotreating', reading: `diesel ${dht.sulphurOut.toFixed(1)} ppm S, H₂ ${hydrogen.imported > 0 ? `short ${hydrogen.imported.toFixed(0)} t/d` : 'balanced'}`, warnings: dht.warnings, overlay: TREATING_OVERLAY },
    { name: 'Sulphur plant', reading: `${sru.recovery.toFixed(1)}% recovery, SO₂ ${sru.so2.toFixed(1)} t/d`, warnings: sru.warnings, overlay: TREATING_OVERLAY },
    { name: 'Light ends', reading: `alkylate ${alky.octane.toFixed(1)}, isomerate ${isom.octane.toFixed(1)} RON`, warnings: [...gasPlant.warnings, ...alky.warnings], overlay: LIGHT_ENDS_OVERLAY },
    {
      name: 'Blending',
      reading: `${petrol.grade.name} ${petrol.blend.onSpec ? 'on spec' : 'off spec'}, diesel ${diesel.blend.onSpec ? 'on spec' : 'off spec'}`,
      warnings: [...(petrol.blend.onSpec ? [] : ['Petrol is off spec and selling as blendstock.']), ...(diesel.blend.onSpec ? [] : ['Diesel is off spec and selling as blendstock.'])],
      overlay: BLENDING_OVERLAY,
    },
  ]
  return (
    <ul className="sm-units">
      {rows.map((r) => (
        <li key={r.name} className={r.warnings.length ? 'sm-unit-warn' : ''}>
          <span className={`sm-lamp${r.warnings.length ? ' sm-lamp-warn' : ''}`} aria-hidden="true" />
          <strong>{r.name}</strong>
          <span className="muted">{r.reading}</span>
          <span className={r.warnings.length ? 'cdu-bad' : 'cdu-good'} title={r.warnings.join(' ')}>
            {r.warnings.length ? `${r.warnings.length} warning${r.warnings.length > 1 ? 's' : ''}` : 'Normal'}
          </span>
          <button className="button button-quiet" onClick={() => openOverlay(r.overlay)}>
            Open
          </button>
        </li>
      ))}
    </ul>
  )
}

/* ---------------- Tank farm ---------------- */

function Tanks({ farm, balance }: { farm: TankFarm; balance: SiteBalance }) {
  const [selected, setSelected] = useState<TankId>('crude')
  const flows = rundowns(balance)
  const spec = TANKS[selected]
  const net = (farm.starved && selected !== 'crude' ? 0 : flows[selected]) - spec.lifting
  const cover = daysOfCover(farm, flows, selected)
  const days = farm.history.map((h) => h.day)
  const first = days[0] ?? 0
  const last = Math.max(first + 1, days.at(-1) ?? 1)
  return (
    <div className="cdu-grid">
      <section className="cdu-card cdu-wide">
        <TankDrawing farm={farm} flows={flows} selected={selected} onSelect={setSelected} />
        <div className="bl-buttons">
          <span className="muted">Run the tank farm on, with the units as they are:</span>
          {[1, 7, 30].map((d) => (
            <button key={d} className="button" onClick={() => controls.runDays(d)}>
              {d === 1 ? '1 day' : `${d} days`}
            </button>
          ))}
          <label className="sm-check">
            <input type="checkbox" checked={farm.autoCrude} onChange={(e) => controls.setAutoCrude(e.target.checked)} /> Standing order for crude
          </label>
        </div>
      </section>

      <section className="cdu-card">
        <h3>{spec.name}</h3>
        <dl className="cdu-readings">
          <dt>Level</dt>
          <dd>
            {farm.levels[selected].toFixed(0)} of {spec.capacity} {spec.unit}{' '}
            <small className="muted">({((farm.levels[selected] / spec.capacity) * 100).toFixed(0)}%)</small>
          </dd>
          <dt>{selected === 'crude' ? 'To the crude unit' : 'From the units'}</dt>
          <dd>
            {Math.abs(flows[selected]).toFixed(1)} {perDay(spec.unit)}
          </dd>
          {spec.lifting > 0 && (
            <>
              <dt>Out by {spec.liftingBy}</dt>
              <dd>
                {spec.lifting} {perDay(spec.unit)}
              </dd>
            </>
          )}
          <dt>Net</dt>
          <dd className={net < 0 ? '' : ''}>
            {net >= 0 ? '+' : '−'}
            {Math.abs(net).toFixed(1)} {perDay(spec.unit)}
          </dd>
          <dt>{cover > 0 ? 'Full in' : 'Empty in'}</dt>
          <dd className={Math.abs(cover) < 3 ? 'cdu-bad' : ''}>{Number.isFinite(cover) ? `${Math.abs(cover).toFixed(1)} days` : 'steady'}</dd>
        </dl>
        <button className="button button-primary" onClick={() => controls.bookShip(selected)}>
          {selected === 'crude' || selected === 'vgo' ? `Order a cargo (${spec.cargo} ${spec.unit})` : `Book a ${spec.cargoBy} to lift ${spec.cargo} ${spec.unit}`}
        </button>
        <p className="cdu-note muted">
          {spec.cargoBy === 'ship'
            ? `Ships take ${selected === 'crude' || selected === 'vgo' ? 3 : 1.5} days to arrive and a day to pump. One berth: they queue, and each day alongside past the first costs demurrage.`
            : 'Trains load in the sidings, not at the jetty.'}
        </p>
      </section>

      <section className="cdu-card">
        <h3>Jetty and sidings</h3>
        <Jetty farm={farm} />
        <h3>Books</h3>
        <table className="sm-table">
          <tbody>
            <tr>
              <td>Units' margin while running</td>
              <td>{money(farm.ledger.margin)}</td>
            </tr>
            <tr>
              <td>Demurrage</td>
              <td className={farm.ledger.demurrage > 0 ? 'cdu-bad' : ''}>−{money(farm.ledger.demurrage).replace('−', '')}</td>
            </tr>
            <tr>
              <td>Tank-top sales below price</td>
              <td className={farm.ledger.distressed > 0 ? 'cdu-bad' : ''}>−{money(farm.ledger.distressed).replace('−', '')}</td>
            </tr>
            <tr>
              <td>Shut down for want of crude</td>
              <td className={farm.ledger.lost > 0 ? 'cdu-bad' : ''}>−{money(farm.ledger.lost).replace('−', '')}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>Since you took over</td>
              <td>{money(ledgerTotal(farm))}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="cdu-card">
        <h3>Levels</h3>
        <CurveChart
          label="Tank levels over the last days"
          x={{ min: first, max: last, label: 'plant day' }}
          y={{ min: 0, max: 100, label: '% full' }}
          curves={TANK_IDS.map((id) => ({ name: TANKS[id].name, colour: TANKS[id].colour === '#5a4632' ? '#b08a60' : TANKS[id].colour, points: farm.history.map((h) => [h.day, h.levels[id] * 100] as [number, number]) }))}
          lines={[{ y: TANK_LIMITS.high * 100, label: 'high' }]}
        />
      </section>

      <section className="cdu-card">
        <h3>Log</h3>
        <ol className="sm-log">
          {farm.log.map((e, i) => (
            <li key={`${e.day}-${i}`} className={`sm-log-${e.kind}`}>
              <time>day {e.day.toFixed(1)}</time> {e.text}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

/** The tanks as a row of cylinders, filled to their levels, with what's flowing in and out. */
function TankDrawing({ farm, flows, selected, onSelect }: { farm: TankFarm; flows: Record<TankId, number>; selected: TankId; onSelect: (id: TankId) => void }) {
  const W = 920
  const H = 230
  const n = TANK_IDS.length
  const slot = W / n
  const top = 40
  const height = 140
  return (
    <svg textAnchor="middle" className="pfd sm-tanks" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="The tank farm">
      {TANK_IDS.map((id, i) => {
        const spec = TANKS[id]
        const share = farm.levels[id] / spec.capacity
        const cx = slot * i + slot / 2
        const w = id === 'crude' ? 84 : id === 'lpg' || id === 'sulphur' ? 56 : 70
        const fillH = height * share
        const net = (farm.starved && id !== 'crude' ? 0 : flows[id]) - spec.lifting
        const alarm = share >= TANK_LIMITS.high || share <= TANK_LIMITS.heel * 1.5
        const ships = farm.ships.filter((s) => s.tank === id)
        return (
          <g
            key={id}
            className={`sm-tank${selected === id ? ' sm-tank-selected' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`${spec.name}, ${(share * 100).toFixed(0)}% full`}
            aria-pressed={selected === id}
            onClick={() => onSelect(id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(id))}
          >
            <text x={cx} y={top - 22} className="pfd-label">
              {spec.name}
            </text>
            <text x={cx} y={top - 8} className="pfd-note" style={alarm ? { fill: '#ff8a6a' } : undefined}>
              {(share * 100).toFixed(0)}% {net > 0.05 ? '▲' : net < -0.05 ? '▼' : '–'}
            </text>
            {id === 'lpg' ? (
              <>
                <circle cx={cx} cy={top + height / 2} r={w / 2} className="sm-shell" />
                <clipPath id="sm-lpg-clip">
                  <circle cx={cx} cy={top + height / 2} r={w / 2 - 3} />
                </clipPath>
                <rect x={cx - w / 2} y={top + height / 2 + w / 2 - w * share} width={w} height={w * share} fill={spec.colour} clipPath="url(#sm-lpg-clip)" opacity={0.85} />
              </>
            ) : (
              <>
                <rect x={cx - w / 2} y={top} width={w} height={height} rx={id === 'sulphur' ? 2 : 6} className="sm-shell" />
                <rect x={cx - w / 2 + 3} y={top + height - fillH + 1} width={w - 6} height={Math.max(0, fillH - 4)} rx={3} fill={spec.colour} opacity={0.85} className="sm-fill" />
                <line x1={cx - w / 2} x2={cx + w / 2} y1={top + height * (1 - TANK_LIMITS.high)} y2={top + height * (1 - TANK_LIMITS.high)} className="rf-limit" />
              </>
            )}
            <text x={cx} y={top + height + 18} className="pfd-note">
              {farm.levels[id].toFixed(0)} {spec.unit}
            </text>
            {ships.length > 0 && (
              <text x={cx} y={top + height + 34} className="pfd-note" style={{ fill: '#a9c9e8' }}>
                {ships.some((s) => s.berthed !== undefined) ? (spec.cargoBy === 'train' ? '🚆 loading' : '⚓ alongside') : `${spec.cargoBy} due`}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function Jetty({ farm }: { farm: TankFarm }) {
  if (farm.ships.length === 0) return <p className="muted">No ships or trains booked. Pick a tank above to book one.</p>
  return (
    <ul className="sm-ships">
      {farm.ships.map((s) => {
        const spec = TANKS[s.tank]
        const done = 1 - s.remaining / s.size
        const waiting = s.berthed !== undefined && farm.day - s.berthed > 1
        return (
          <li key={s.id}>
            <div>
              <strong>{s.name}</strong>{' '}
              <span className="muted">
                {s.kind === 'load' ? 'lifting' : 'bringing'} {spec.name.toLowerCase()}
              </span>
            </div>
            {s.berthed === undefined ? (
              <span className="muted">{s.eta > farm.day ? `due in ${(s.eta - farm.day).toFixed(1)} days` : 'waiting for the berth'}</span>
            ) : (
              <div className="cv-stack sm-progress" title={`${(done * 100).toFixed(0)}%`}>
                <div style={{ width: `${done * 100}%`, background: waiting ? '#e07a5f' : spec.colour === '#5a4632' ? '#b08a60' : spec.colour }} />
              </div>
            )}
            {waiting && <span className="cdu-bad">on demurrage: the tank can't keep up</span>}
          </li>
        )
      })}
    </ul>
  )
}

function Learn() {
  return (
    <div className="cdu-learn">
      <h3>The margin</h3>
      <p>
        A refinery earns the difference between what its products sell for and what its crude costs, less what it spends running: fuel,
        steam, power, hydrogen, chemicals. Planners call it the gross margin, and quote it per barrel of crude. In good years a complex
        refinery like Marshgate makes $8–15 a barrel; in bad ones, close to nothing, and simple refineries lose money and close.
      </p>
      <p>
        Every unit you run feeds into it. Blend petrol off spec and a whole pool sells as cheap blendstock. Run the reformer harder and
        there's octane to blend cheaper components with, and hydrogen for the hydrotreaters. Cut deeper in the vacuum unit and there's
        more gas oil to crack into petrol, and less fuel oil, the cheapest thing a refinery makes.
      </p>
      <h3>The tank farm</h3>
      <p>
        Units run day and night at steady rates; crude comes in by the shipload and products leave by road, pipeline and ship in lumps.
        The tanks between them are what make that work. Schedulers watch every tank's days of cover: book ships too late and a product
        tank tops out, and the units must slow down or the product goes at a distressed price. Let the crude run out and the whole plant
        stops, while its costs carry on.
      </p>
      <p>
        Ships cost money while they wait. A charter gives a fixed time alongside, and every day over it costs demurrage, tens of
        thousands of dollars a day for a tanker. So the jetty schedule matters as much as the tanks.
      </p>
      <h3>About this model</h3>
      <p className="muted">
        Product values are the illustrative prices used on every screen. Tank sizes, liftings and cargo sizes are typical of a 100 kb/d
        coastal refinery. The tank farm runs on the plant clock, and can be run ahead a day, a week or a month at a time with the units
        held steady. Everything you set is saved in this browser.
      </p>
    </div>
  )
}
