import { useEffect, useMemo, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { complete, useCompleted } from './challenges.ts'
import { ConversionPfd } from './ConversionPfd.tsx'
import { CONVERSION_TASKS } from './conversionTasks.ts'
import { CRUDES } from './crudes.ts'
import { FCC_LIMITS, FCC_PRICES, FCC_PRODUCTS, feedMass, type FccResult } from './fcc.ts'
import { CatCrackerIcon } from './icons.tsx'
import { controls, conversionResult, usePlant, type ConversionResult, type Plant } from './plant.ts'
import { Gauge, money, Slider } from './ui.tsx'
import { VDU_LIMITS } from './vdu.ts'
import { usePlantClock } from './clock.ts'
import './Refinery.css'

type Tab = 'operate' | 'shift' | 'learn'

/** The vacuum unit and cat cracker's operator screen: one screen, because what the first makes decides how the second runs. */
export function ConversionPanel() {
  usePlantClock()
  const plant = usePlant((p) => p)
  const result = useMemo(() => conversionResult(plant), [plant])
  const [tab, setTab] = useState<Tab>('operate')

  useEffect(() => {
    for (const t of CONVERSION_TASKS) if (t.met(plant, result)) complete(t.id)
  }, [plant, result])

  return (
    <Panel
      title="Vacuum unit and cat cracker"
      subtitle="Units 200 and 300 at Marshgate: turning the bottom of the barrel into petrol"
      icon={<CatCrackerIcon />}
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
        <ConversionPfd plant={plant} result={result} />
        {tab === 'operate' && <Operate plant={plant} result={result} />}
        {tab === 'shift' && <Shift plant={plant} result={result} />}
        {tab === 'learn' && <Learn />}
      </div>
    </Panel>
  )
}

function Operate({ plant, result }: { plant: Plant; result: ConversionResult }) {
  const { vdu, fcc } = result
  const warnings = [...vdu.warnings, ...fcc.warnings]
  return (
    <div className="cdu-grid">
      <section className="cdu-card">
        <h3>Vacuum unit</h3>
        <p className="cdu-note">
          Atmospheric residue arrives at {result.cdu.products.residue.rate.toFixed(1)} kb/d, everything in the crude that boils above{' '}
          {result.cdu.products.residue.from.toFixed(0)} °C.
        </p>
        <Slider
          label="Furnace outlet"
          value={plant.vdu.cot}
          min={VDU_LIMITS.cot.min}
          max={VDU_LIMITS.cot.max}
          step={1}
          unit="°C"
          onChange={(cot) => controls.setVdu({ cot })}
        />
        <Slider
          label="Flash zone pressure"
          value={plant.vdu.pressure}
          min={VDU_LIMITS.pressure.min}
          max={VDU_LIMITS.pressure.max}
          step={1}
          unit="mmHg"
          onChange={(pressure) => controls.setVdu({ pressure })}
        />
        <div className="cdu-row">
          <span>Stripping steam</span>
          <div className="segmented">
            <button className="button" aria-pressed={!plant.vdu.steam} onClick={() => controls.setVdu({ steam: false })}>
              Dry
            </button>
            <button className="button" aria-pressed={plant.vdu.steam} onClick={() => controls.setVdu({ steam: true })}>
              Wet
            </button>
          </div>
        </div>
        <p className="cdu-note">
          At {plant.vdu.pressure.toFixed(0)} mmHg{plant.vdu.steam ? ' with steam' : ''}, oil that boils at {plant.vdu.cot.toFixed(0)} °C in
          the flash zone would boil at <strong>{vdu.cutPoint.toFixed(0)} °C</strong> at atmospheric pressure. That is the cut point
          between gas oil and vacuum residue.
        </p>
        <CutBar result={result} />
        <h3>Gas oil to the cracker</h3>
        <dl className="cdu-readings">
          <dt>Carbon residue</dt>
          <dd className={vdu.carbon > 1.5 ? 'cdu-bad' : ''}>
            {vdu.carbon.toFixed(2)} wt% <small className="muted">turns straight to coke</small>
          </dd>
          <dt>Nickel and vanadium</dt>
          <dd className={vdu.metals > 5 ? 'cdu-bad' : ''}>
            {vdu.metals.toFixed(1)} ppm <small className="muted">poison the catalyst</small>
          </dd>
          <dt>Crackability</dt>
          <dd>{vdu.crackability.toFixed(2)} × Brent</dd>
        </dl>
      </section>

      <section className="cdu-card">
        <h3>Cat cracker</h3>
        <Slider
          label="Feed rate"
          value={plant.fcc.feed}
          min={FCC_LIMITS.feed.min}
          max={FCC_LIMITS.feed.max}
          step={1}
          unit="kb/d"
          onChange={(feed) => controls.setFcc({ feed })}
        />
        <Slider
          label="Feed preheat"
          value={plant.fcc.preheat}
          min={FCC_LIMITS.preheat.min}
          max={FCC_LIMITS.preheat.max}
          step={5}
          unit="°C"
          onChange={(preheat) => controls.setFcc({ preheat })}
        />
        <Slider
          label="Riser outlet"
          value={plant.fcc.rot}
          min={FCC_LIMITS.rot.min}
          max={FCC_LIMITS.rot.max}
          step={1}
          unit="°C"
          onChange={(rot) => controls.setFcc({ rot })}
        />
        <Slider
          label="Catalyst activity"
          value={plant.fcc.activity}
          min={FCC_LIMITS.activity.min}
          max={FCC_LIMITS.activity.max}
          step={1}
          unit="MAT"
          onChange={(activity) => controls.setFcc({ activity })}
        />
        <Slider
          label="Catalyst cooler"
          value={plant.fcc.cooler}
          min={FCC_LIMITS.cooler.min}
          max={FCC_LIMITS.cooler.max}
          step={1}
          unit="MW"
          onChange={(cooler) => controls.setFcc({ cooler })}
        />
        <p className="cdu-note">
          {result.toTank >= 0
            ? `The vacuum unit makes ${result.vdu.vgoRate.toFixed(1)} kb/d of gas oil; ${result.toTank.toFixed(1)} kb/d of it goes to tank.`
            : `The vacuum unit makes ${result.vdu.vgoRate.toFixed(1)} kb/d of gas oil; the other ${(-result.toTank).toFixed(1)} kb/d comes from tank.`}
        </p>
        <dl className="cdu-readings">
          <dt>Catalyst to oil</dt>
          <dd>
            {fcc.catOil.toFixed(1)} <small className="muted">· {fcc.circulation.toFixed(0)} t of catalyst a minute</small>
          </dd>
          <dt>Conversion</dt>
          <dd>{fcc.conversion.toFixed(1)}%</dd>
          <dt>Gasoline octane</dt>
          <dd>{fcc.octane.toFixed(1)} RON</dd>
        </dl>
        <h3>Limits</h3>
        <Gauge label="Regenerator" value={fcc.regenTemp} min={600} max={800} limit={FCC_LIMITS.regenMax} unit="°C" />
        <Gauge label="Air blower" value={fcc.air} min={0} max={200} limit={FCC_LIMITS.airMax} unit="t/h" />
        <Gauge label="Wet gas compressor" value={fcc.gas} min={0} max={60} limit={FCC_LIMITS.gasMax} unit="t/h" />
        <Gauge
          label="Slide valve"
          value={fcc.catOil}
          min={FCC_LIMITS.catOilMin}
          max={FCC_LIMITS.catOilMax}
          limit={FCC_LIMITS.catOilMax - 0.01}
          unit="cat/oil"
          digits={1}
          low={FCC_LIMITS.catOilMin + 0.01}
        />
      </section>

      <section className="cdu-card cdu-wide">
        <h3>Heat balance</h3>
        <HeatBalance fcc={fcc} />
      </section>

      <section className="cdu-card cdu-wide">
        <h3>Products</h3>
        <Products plant={plant} fcc={fcc} />
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
        <button className="button button-quiet" onClick={controls.resetConversion}>
          Reset both units to design
        </button>
      </section>
    </div>
  )
}

/** Where the crude goes: the crude unit's products, gas oil and vacuum residue, as shares of the barrel. */
function CutBar({ result }: { result: ConversionResult }) {
  const { vdu } = result
  const lighter = 100 - vdu.vgo - vdu.residue
  const parts = [
    { name: 'Crude unit products', share: lighter, colour: '#e8d27a' },
    { name: 'Vacuum gas oil', share: vdu.vgo, colour: '#c98b4a' },
    { name: 'Vacuum residue', share: vdu.residue, colour: '#5a3e30' },
  ]
  return (
    <div className="cv-cut">
      <div className="cv-stack" role="img" aria-label={parts.map((p) => `${p.name} ${p.share.toFixed(1)}%`).join(', ')}>
        {parts.map((p) => (
          <div key={p.name} style={{ width: `${p.share}%`, background: p.colour }} />
        ))}
      </div>
      <ul className="cv-legend">
        {parts.map((p) => (
          <li key={p.name}>
            <span className="cdu-swatch" style={{ background: p.colour }} /> {p.name} <strong>{p.share.toFixed(1)}%</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

const HEAT_PARTS = [
  { id: 'feedHeating', name: 'Heating the feed', colour: '#e0a458' },
  { id: 'vaporising', name: 'Vaporising it', colour: '#e8d27a' },
  { id: 'cracking', name: 'Cracking (endothermic)', colour: '#d9733c' },
  { id: 'air', name: 'Heating the air', colour: '#9fd0e0' },
  { id: 'cooler', name: 'Catalyst cooler', colour: '#6fa8dc' },
  { id: 'losses', name: 'Losses and steam', colour: '#7c8a96' },
] as const

/** Where the heat from burning the coke goes, per kilogram of feed. */
function HeatBalance({ fcc }: { fcc: FccResult }) {
  const { heat } = fcc
  const surplus = Math.max(0, heat.unbalanced)
  const shortfall = Math.max(0, -heat.unbalanced)
  const scale = heat.coke + shortfall
  const width = (v: number) => `${(v / scale) * 100}%`
  return (
    <div className="cv-heat">
      <div className="cv-heat-row">
        <span>Coke burned</span>
        <div className="cv-stack">
          <div style={{ width: width(heat.coke), background: '#e06a2a' }} />
          {shortfall > 1 && <div className="cv-unbalanced" style={{ width: width(shortfall) }} title="Shortfall" />}
        </div>
        <output>{heat.coke.toFixed(0)} kJ/kg</output>
      </div>
      <div className="cv-heat-row">
        <span>Goes to</span>
        <div className="cv-stack" role="img" aria-label={HEAT_PARTS.map((p) => `${p.name} ${heat[p.id].toFixed(0)} kJ/kg`).join(', ')}>
          {HEAT_PARTS.map((p) => (
            <div key={p.id} style={{ width: width(heat[p.id]), background: p.colour }} />
          ))}
          {surplus > 1 && <div className="cv-unbalanced" style={{ width: width(surplus) }} title="Surplus" />}
        </div>
        <output />
      </div>
      <ul className="cv-legend">
        {HEAT_PARTS.map((p) => (
          <li key={p.id}>
            <span className="cdu-swatch" style={{ background: p.colour }} /> {p.name} <strong>{heat[p.id].toFixed(0)}</strong>
          </li>
        ))}
        {(surplus > 1 || shortfall > 1) && (
          <li className="cdu-bad">
            <span className="cdu-swatch cv-unbalanced" /> {surplus > 1 ? 'Surplus with nowhere to go' : 'Shortfall'}{' '}
            <strong>{(surplus || shortfall).toFixed(0)}</strong>
          </li>
        )}
      </ul>
      <p className="cdu-note">
        The cracker burns {fcc.yields.coke.toFixed(1)}% of its feed as coke, and that fire is its only source of heat, so in steady
        running the two bars are the same length. Ask the riser for more heat, by running it hotter or the feed cooler, and the slide valve opens to
        send more catalyst. More catalyst cracks more oil, which lays down more coke, until the coke burned pays for exactly what was
        asked.
      </p>
    </div>
  )
}

function Products({ plant, fcc }: { plant: Plant; fcc: FccResult }) {
  const tonnesPerHour = (feedMass(plant.fcc.feed) * 3600) / 1000
  const e = fcc.economics
  return (
    <div className="cdu-table-wrap">
      <table className="cdu-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Yield</th>
            <th>Value</th>
            <th>Goes to</th>
          </tr>
        </thead>
        <tbody>
          {FCC_PRODUCTS.map((p) => (
            <tr key={p.id}>
              <td>
                <span className="cdu-swatch" style={{ background: p.colour }} /> {p.name}
              </td>
              <td>
                {fcc.yields[p.id].toFixed(1)} wt%<small> · {((fcc.yields[p.id] / 100) * tonnesPerHour).toFixed(1)} t/h</small>
              </td>
              <td>{p.id === 'coke' ? <span className="muted">—</span> : `$${FCC_PRICES[p.id]}/t`}</td>
              <td className="cdu-goes">{p.goesTo}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="cdu-readings">
        <dt>Products</dt>
        <dd>{money(e.productValue)} a day</dd>
        <dt>Gas oil feed</dt>
        <dd>
          −{money(e.feedCost)} <small className="muted">(${FCC_PRICES.feed}/t)</small>
        </dd>
        <dt>Margin</dt>
        <dd>
          <strong className={e.margin < 0 ? 'cdu-bad' : 'cdu-good'}>{money(e.margin)} a day</strong>{' '}
          <span className="muted">(${(e.margin / (plant.fcc.feed * 1000)).toFixed(2)} a barrel)</span>
        </dd>
      </dl>
      <p className="cdu-note">
        Coke never leaves the unit, so every tonne of it is a tonne of feed that earned nothing. Prices are illustrative, and leave out
        catalyst, power and the treating the products need next.
      </p>
    </div>
  )
}

function Shift({ plant, result }: { plant: Plant; result: ConversionResult }) {
  const completed = useCompleted()
  return (
    <div className="cdu-shift">
      <p>
        Requests from the planners and the shift supervisor. These units answer at once, so a task is done as soon as you meet it.
        Progress is saved in this browser.
      </p>
      <ol className="cdu-tasks">
        {CONVERSION_TASKS.map((t) => {
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
      <h3>Why a vacuum</h3>
      <p>
        The crude unit can't heat its residue past about 370 °C without cracking it, so half the barrel of a heavy crude leaves the
        bottom unboiled. Much of it is gas oil, perfectly good feed for making petrol and diesel. The vacuum unit reheats the residue to
        about 400 °C and flashes it at around a twentieth of an atmosphere, which steam ejectors hold by sucking the vapour away. At
        that pressure the gas oil boils off at temperatures that don't crack it.
      </p>
      <p>
        How much lower? The Clausius–Clapeyron equation relates boiling point and pressure through the heat of vaporisation. Refiners
        use it to quote an atmospheric equivalent temperature: the temperature the same oil would boil at under one atmosphere. At 40
        mmHg, oil boiling at 395 °C is equivalent to about 550 °C. Steam in the flash zone helps further: it shares the pressure, so the
        oil's own partial pressure is lower.
      </p>
      <p>
        The column is fat and short, and filled with packing instead of trays. Vapour at low pressure takes up a huge volume, and
        packing lets it through with very little pressure drop, so the bottom stays as close as possible to the vacuum at the top.
      </p>
      <h3>How deep to cut</h3>
      <p>
        A deeper cut lifts more gas oil, but the heaviest molecules carry the asphaltenes and the metals. Conradson carbon residue turns
        straight to coke in the cracker, and nickel and vanadium poison its catalyst: nickel makes hydrogen and coke, and vanadium
        destroys the zeolite. So the cut point is a trade between more feed for the cracker and dirtier feed.
      </p>
      <h3>The cat cracker</h3>
      <p>
        At the bottom of the riser, hot gas oil meets catalyst at around 700 °C: a fine powder of zeolite crystals, which flows like a
        liquid when gas is blown through it. The oil vaporises and the mixture shoots up the riser in two or three seconds. On the
        zeolite's acid sites, long molecules break into shorter ones through carbocation chemistry: chains split, branch and close
        into rings, which is why cat cracked petrol has a good octane. Cyclones in the reactor separate the catalyst from the vapour,
        and the vapour goes to the main fractionator to be split into gas, LPG, petrol, light cycle oil and slurry.
      </p>
      <p>
        Cracking leaves a little coke on the catalyst, which covers the acid sites. Steam strips off the oil it can, and the spent
        catalyst runs down a standpipe into the regenerator, where air burns the coke off at about 700 °C. The clean, hot catalyst
        goes back to the riser through a slide valve, carrying the heat of that fire with it.
      </p>
      <h3>Heat balance</h3>
      <p>
        The cracker has no furnace for the reaction. Its only heat is the coke it makes, so it always makes exactly as much coke as it
        needs. The operator sets the riser outlet temperature; the slide valve then opens to whatever catalyst flow holds it, and
        everything else follows. Hotter feed means the riser needs less heat from the catalyst, so less circulates, less oil cracks and
        less coke is made: hotter feed lowers conversion, and the regenerator runs hotter because the same coke burns on less catalyst.
        Engineers call this the unit "seeking its own heat balance", and it is the first thing a new FCC operator has to learn.
      </p>
      <h3>Limits</h3>
      <ul>
        <li>
          <strong>Regenerator temperature</strong>: above about 750 °C the steam in the flue gas strips aluminium out of the zeolite and
          the catalyst dies, and the internals and cyclones reach their metal limits.
        </li>
        <li>
          <strong>Air blower</strong>: every kilogram of coke needs about 14 kg of air. When the blower is at capacity, coke builds up on
          the catalyst, and the unit has to cut feed.
        </li>
        <li>
          <strong>Wet gas compressor</strong>: it carries the gas and LPG from the main fractionator. Overcracking makes gas instead of
          petrol, and fills it.
        </li>
        <li>
          <strong>Slide valve</strong>: it can only open so far. If the riser needs more heat than the catalyst can bring, the outlet
          temperature falls.
        </li>
      </ul>
      <h3>About this model</h3>
      <p className="muted">
        Cut points use Clausius–Clapeyron with a constant entropy of vaporisation. The cracker's conversion follows second-order kinetics
        in the catalyst to oil ratio with an Arrhenius temperature term, and the heat balance is solved exactly for the catalyst to oil
        ratio. Yields, octane and limits are shaped to published typical values (Sadeghbeigi's Fluid Catalytic Cracking Handbook, Gary
        and Handwerk's Petroleum Refining), so the trends are right and the numbers typical, but it is not a design tool.
      </p>
    </div>
  )
}
